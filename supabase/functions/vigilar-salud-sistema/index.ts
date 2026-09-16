// ============================================================
// vigilar-salud-sistema — SistemaMP Centinela
// Capa 1 del detector de salud (2026-09-14, pedido real del usuario: "no
// existe un detector de situaciones... que nos avise que algo no
// funciona"). Lee lo que backup-diario/whatsapp-webhook/email-webhook ya
// registran en public.salud_crons (ver
// _shared/registrarSaludCron.ts) y manda UN correo de alerta si encuentra
// un problema real — nada si todo está bien (mismo criterio "se omite el
// envío si no hay nada urgente" que ya usa alerta-pm, para no generar
// ruido diario de "todo bien").
//
// A propósito NO infiere "algo está roto" de la AUSENCIA de actividad de
// los webhooks de WhatsApp/correo (que no llegue ningún mensaje un día
// dado no significa que el canal esté caído, puede que simplemente nadie
// haya reportado nada) — solo cuenta como problema un FALLO real y
// registrado por el propio proceso. backup-diario, alerta-pm y
// resumen-semanal son distintos: SÍ deben correr en su propia cadencia sin
// falta (diaria, diaria y semanal respectivamente), así que además de
// "falló" se chequea staleness (que no hayan corrido a tiempo).
//
// 2026-09-16 (hallazgo de auditoría): alerta-pm/resumen-semanal ya
// registraban en salud_crons (registrarSaludCron agregado ese mismo día),
// pero este detector nunca los leía — un fallo real de esos 2 correos a
// gerencia podía pasar inadvertido igual que antes de tener el registro.
//
// Pensada para correr una vez al día vía pg_cron, después de backup-diario
// (ver supabase/migrations/*_programar_vigilar_salud_sistema.sql).
// Mismo patrón de seguridad que backup-diario/alerta-pm: verificar_secreto_cron
// contra un secreto en Supabase Vault (vigilar_salud_cron_secret).
// ============================================================

const DESTINATARIO_FIJO = 'aehcim6@gmail.com';

export interface FilaSaludCron {
  nombre: string;
  ultimaEjecucion: string;
  exito: boolean;
  detalle: string | null;
}

const HORAS_STALE_BACKUP = 26;
const HORAS_STALE_ALERTA_PM = 26; // corre a diario, igual cadencia que backup-diario
const HORAS_STALE_RESUMEN_SEMANAL = 8 * 24; // corre semanal — 8 días de margen sobre 7
const HORAS_VENTANA_FALLO_WEBHOOK = 24;

// Chequeo compartido para los crons que deben correr en una cadencia fija sin
// falta (backup-diario, alerta-pm, resumen-semanal): problema si nunca se
// registró, si la última ejecución falló, o si la última exitosa quedó más
// vieja que 'horasStale' (no corrió a tiempo). Devuelve el mensaje de
// problema, o null si está todo bien.
function _chequeoCronConCadencia(porNombre: Map<string, FilaSaludCron>, nombre: string, horasStale: number, ahora: number): string | null {
  const fila = porNombre.get(nombre);
  if (!fila) return `${nombre}: nunca se ha registrado ninguna ejecución.`;
  const horasDesde = (ahora - new Date(fila.ultimaEjecucion).getTime()) / 3_600_000;
  if (!fila.exito) return `${nombre}: la última ejecución (${fila.ultimaEjecucion}) falló — ${fila.detalle || 'sin detalle'}.`;
  if (horasDesde > horasStale) return `${nombre}: la última ejecución exitosa fue hace ${horasDesde.toFixed(1)}h (más de ${horasStale}h) — no ha corrido a tiempo.`;
  return null;
}

// Pura y testeable sin red: recibe las filas ya leídas de salud_crons y la
// hora actual (inyectada, no Date.now() directo, para que los tests sean
// deterministas) y devuelve la lista de problemas encontrados (vacía si
// todo está bien).
export function evaluarSaludCrons(filas: FilaSaludCron[], ahoraISO: string): string[] {
  const ahora = new Date(ahoraISO).getTime();
  const problemas: string[] = [];
  const porNombre = new Map(filas.map((f) => [f.nombre, f]));

  const conCadencia: [string, number][] = [
    ['backup-diario', HORAS_STALE_BACKUP],
    ['alerta-pm', HORAS_STALE_ALERTA_PM],
    ['resumen-semanal', HORAS_STALE_RESUMEN_SEMANAL],
  ];
  for (const [nombre, horasStale] of conCadencia) {
    const problema = _chequeoCronConCadencia(porNombre, nombre, horasStale, ahora);
    if (problema) problemas.push(problema);
  }

  for (const nombre of ['whatsapp-webhook', 'email-webhook']) {
    const fila = porNombre.get(nombre);
    if (!fila || fila.exito) continue; // sin fallo registrado = nada que avisar
    const horasDesde = (ahora - new Date(fila.ultimaEjecucion).getTime()) / 3_600_000;
    if (horasDesde <= HORAS_VENTANA_FALLO_WEBHOOK) {
      problemas.push(`${nombre}: falló hace ${horasDesde.toFixed(1)}h — ${fila.detalle || 'sin detalle'}.`);
    }
  }

  return problemas;
}

if (import.meta.main) {
Deno.serve(async (req: Request) => {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

    const secretoRecibido = req.headers.get('x-cron-secret') || '';
    const rVerif = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verificar_secreto_cron`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ nombre_secreto: 'vigilar_salud_cron_secret', valor_recibido: secretoRecibido }),
    });
    const secretoValido = rVerif.ok ? await rVerif.json() : false;
    if (!secretoValido) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }

    const rFilas = await fetch(`${SUPABASE_URL}/rest/v1/salud_crons?select=nombre,ultimaEjecucion,exito,detalle`, { headers });
    if (!rFilas.ok) {
      return new Response(JSON.stringify({ ok: false, error: `No se pudo leer salud_crons: ${rFilas.status}` }), { status: 500 });
    }
    const filas: FilaSaludCron[] = await rFilas.json();

    const problemas = evaluarSaludCrons(filas, new Date().toISOString());
    if (problemas.length === 0) {
      return new Response(JSON.stringify({ ok: true, enviado: false, motivo: 'Sin problemas detectados' }), { status: 200 });
    }

    const rSecret = await fetch(`${SUPABASE_URL}/rest/v1/rpc/obtener_secreto_para_cron`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ nombre_secreto: 'resend_api_key' }),
    });
    const resendKey = rSecret.ok ? await rSecret.json() : null;
    if (!resendKey) {
      return new Response(JSON.stringify({ ok: false, error: 'No se pudo obtener la clave de Resend' }), { status: 500 });
    }

    const html = `
      <h2>🟠 SistemaMP Centinela — detector de salud del sistema</h2>
      <p>Se detectaron ${problemas.length} problema(s):</p>
      <ul>${problemas.map((p) => `<li>${p}</li>`).join('')}</ul>
      <p style="color:#888;font-size:12px;margin-top:16px">Alerta automática del detector de salud (backup diario + canal de reportes entrantes). Se repite mientras siga pendiente.</p>`;

    const rEmail = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Sistema MP Centinela <onboarding@resend.dev>',
        to: [DESTINATARIO_FIJO],
        subject: `🟠 ${problemas.length} problema(s) — Detector de salud SistemaMP Centinela`,
        html,
      }),
    });
    if (!rEmail.ok) {
      const detalle = await rEmail.text();
      return new Response(JSON.stringify({ ok: false, error: 'Resend rechazó el envío', detalle }), { status: 502 });
    }

    return new Response(JSON.stringify({ ok: true, enviado: true, problemas }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), { status: 500 });
  }
});
}
