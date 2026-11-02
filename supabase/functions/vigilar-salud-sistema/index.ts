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
// 2026-11-02 (pedido real del usuario: "el programa debe poder reconocer
// posibles problemas sin que yo te diga ni existan alarmas"): además de las
// tareas programadas, el detector revisa la CALIDAD DE LOS DATOS (horómetros
// con un cero de más o de menos, horómetro actual de un equipo por debajo de
// su última lectura, equipos sin lectura en 7 días, OT abiertas hace más de
// 30 días y tablas temporales/respaldos olvidados). Es de solo lectura: avisa,
// no corrige nada. Ver evaluarCalidadDatos().
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

// ── Calidad de los datos (2026-11-02) ─────────────────────────────────────
// Misma regla física que usa el importador del chat (logic.js): un equipo no
// puede sumar más de 24 h por día (+30 h de margen por el cambio de turno) ni
// retroceder más que el margen de redondeo.
export interface EquipoCalidad { sigla: string; horomActual: number | string | null; fechaHorom: string | null }
export interface LecturaCalidad { sigla: string; fecha: string; horomFin: number | string | null }
export interface OTCalidad { sigla: string; fechaEntrada: string | null; estadoOT: string | null }
export interface DatosCalidad {
  equipos: EquipoCalidad[];
  lecturas: LecturaCalidad[];   // historial_horometros de los últimos ~60 días
  otAbiertas: OTCalidad[];
  tablasTemporales: string[];   // nombres tmp_/respaldo_/…_backup olvidados
}

const MARGEN_HORAS = 30;
const MARGEN_RETROCESO = 50;     // por debajo de esto un retroceso puede ser redondeo/orden del día
const DIAS_VENTANA_ATIPICAS = 45;
const DIAS_SIN_LECTURA = 7;
const DIAS_OT_ABIERTA = 30;
const MAX_ITEMS_POR_AVISO = 8;

function _dias(a: string, b: string): number {
  return Math.round((new Date(b.slice(0, 10)).getTime() - new Date(a.slice(0, 10)).getTime()) / 86_400_000);
}
function _lista(items: string[]): string {
  if (items.length <= MAX_ITEMS_POR_AVISO) return items.join('; ');
  return `${items.slice(0, MAX_ITEMS_POR_AVISO).join('; ')}; …y ${items.length - MAX_ITEMS_POR_AVISO} más`;
}

// Lecturas de horómetro que no cuadran con las de al lado: un pico que vuelve a
// lo normal en la lectura siguiente (cero de más: 178845 entre 17833 y 17855),
// un retroceso que se recupera (2264 entre 255 y 264) o, si es la última lectura
// del equipo, un salto/retroceso imposible sin poder confirmarlo con la siguiente.
export function detectarLecturasAtipicas(lecturas: LecturaCalidad[], ahoraISO: string): string[] {
  const desde = new Date(new Date(ahoraISO).getTime() - DIAS_VENTANA_ATIPICAS * 86_400_000).toISOString().slice(0, 10);
  const porSigla = new Map<string, { fecha: string; v: number }[]>();
  for (const l of lecturas) {
    const v = Number(l.horomFin);
    if (!l.sigla || !l.fecha || !(v > 0)) continue; // el 0 es "sin lectura", no un valor
    if (!porSigla.has(l.sigla)) porSigla.set(l.sigla, []);
    porSigla.get(l.sigla)!.push({ fecha: String(l.fecha).slice(0, 10), v });
  }
  const avisos: string[] = [];
  for (const [sigla, arr] of porSigla) {
    arr.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.v - b.v));
    // `ref` es la última lectura que se aceptó como buena: tras un pico, la lectura siguiente
    // (ya normal) se compara con ella y no con el pico, para no avisarla también.
    let ref = arr[0];
    for (let i = 1; i < arr.length; i++) {
      const cur = arr[i], prev = ref, next = arr[i + 1];
      const d = Math.max(1, _dias(prev.fecha, cur.fecha));
      const salto = cur.v > prev.v + 24 * d + MARGEN_HORAS;
      const retroceso = cur.v < prev.v - MARGEN_RETROCESO;
      if (!salto && !retroceso) { ref = cur; continue; }
      if (next) {
        const dTot = Math.max(1, _dias(prev.fecha, next.fecha));
        const vuelveANormal = salto
          ? next.v <= prev.v + 24 * dTot + MARGEN_HORAS && cur.v - next.v > MARGEN_RETROCESO
          : next.v >= prev.v - 5;
        if (!vuelveANormal) { ref = cur; continue; } // cambio sostenido (cambio de horómetro, reemplazo…): no es un dedazo
      }
      if (cur.fecha >= desde) {
        avisos.push(next
          ? `${sigla} ${cur.fecha}: ${cur.v} entre ${prev.v} y ${next.v} (${salto ? 'salto imposible' : 'retroceso'})`
          : `${sigla} ${cur.fecha}: última lectura ${cur.v} tras ${prev.v} (${salto ? 'salto imposible' : 'retroceso'}, sin lectura posterior para confirmarlo)`);
      }
      // la lectura atípica no pasa a ser la referencia
    }
  }
  return avisos;
}

// Pura y testeable sin red. Devuelve un aviso por tipo de hallazgo (con la lista
// resumida), vacío si los datos están sanos.
export function evaluarCalidadDatos(d: DatosCalidad, ahoraISO: string): string[] {
  const problemas: string[] = [];
  const hoy = ahoraISO.slice(0, 10);

  // 1) lecturas atípicas
  const atipicas = detectarLecturasAtipicas(d.lecturas, ahoraISO);
  if (atipicas.length) problemas.push(`Horómetros que no cuadran con sus vecinos (${atipicas.length}): ${_lista(atipicas)}.`);

  // 2) horómetro actual del equipo por debajo de su última lectura
  const ultima = new Map<string, { fecha: string; v: number }>();
  for (const l of d.lecturas) {
    const v = Number(l.horomFin);
    if (!l.sigla || !l.fecha || !(v > 0)) continue;
    const fecha = String(l.fecha).slice(0, 10);
    const u = ultima.get(l.sigla);
    if (!u || fecha > u.fecha || (fecha === u.fecha && v > u.v)) ultima.set(l.sigla, { fecha, v });
  }
  const desfasados: string[] = [];
  for (const e of d.equipos) {
    const u = ultima.get(e.sigla), actual = Number(e.horomActual);
    if (u && actual > 0 && actual < u.v - 5) desfasados.push(`${e.sigla} (equipo ${actual} < lectura ${u.v} del ${u.fecha})`);
  }
  if (desfasados.length) problemas.push(`Horómetro actual del equipo por debajo de su última lectura (${desfasados.length}): ${_lista(desfasados)}.`);

  // 3) equipos sin lectura reciente
  const sinLectura: string[] = [];
  for (const e of d.equipos) {
    if (!e.fechaHorom) { sinLectura.push(`${e.sigla} (sin ninguna lectura)`); continue; }
    const dias = _dias(e.fechaHorom, hoy);
    if (dias > DIAS_SIN_LECTURA) sinLectura.push(`${e.sigla} (${dias} días)`);
  }
  if (sinLectura.length) problemas.push(`Equipos sin lectura de horómetro hace más de ${DIAS_SIN_LECTURA} días (${sinLectura.length}): ${_lista(sinLectura)}.`);

  // 4) OT abiertas hace más de 30 días
  const otViejas: string[] = [];
  for (const o of d.otAbiertas) {
    if (!o.fechaEntrada) continue;
    const dias = _dias(o.fechaEntrada, hoy);
    if (dias > DIAS_OT_ABIERTA) otViejas.push(`${o.sigla} (${dias} días, desde ${String(o.fechaEntrada).slice(0, 10)})`);
  }
  if (otViejas.length) problemas.push(`OT abiertas hace más de ${DIAS_OT_ABIERTA} días (${otViejas.length}): ${_lista(otViejas)}.`);

  // 5) tablas temporales o de respaldo olvidadas
  if (d.tablasTemporales.length) problemas.push(`Tablas temporales o de respaldo olvidadas en la base (${d.tablasTemporales.length}): ${_lista(d.tablasTemporales)}. Revisar si ya se pueden borrar.`);

  return problemas;
}

import { verificarSecretoCron } from "../_shared/verificarSecretoCron.ts";

if (import.meta.main) {
Deno.serve(async (req: Request) => {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

    const secretoRecibido = req.headers.get('x-cron-secret') || '';
    const verif = await verificarSecretoCron(SUPABASE_URL, SERVICE_KEY, 'vigilar_salud_cron_secret', secretoRecibido);
    if (verif.estado === 'error') {
      // Es el propio monitor: no se registra a sí mismo en salud_crons, pero un fallo de verificación ya no se confunde con un secreto incorrecto.
      return new Response(JSON.stringify({ error: 'No se pudo verificar el secreto' }), { status: 503 });
    }
    if (verif.estado !== 'valido') {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }

    const rFilas = await fetch(`${SUPABASE_URL}/rest/v1/salud_crons?select=nombre,ultimaEjecucion,exito,detalle`, { headers });
    if (!rFilas.ok) {
      return new Response(JSON.stringify({ ok: false, error: `No se pudo leer salud_crons: ${rFilas.status}` }), { status: 500 });
    }
    const filas: FilaSaludCron[] = await rFilas.json();

    const problemas = evaluarSaludCrons(filas, new Date().toISOString());

    // Calidad de los datos (solo lectura). Si una lectura falla, se avisa que el detector no pudo revisar (no se calla).
    const ahoraISO = new Date().toISOString();
    const desdeLecturas = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
    const leerTodo = async (ruta: string): Promise<{ ok: boolean; filas: any[] }> => {
      const filas: any[] = [];
      for (let desde = 0; desde < 20000; desde += 1000) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, { headers: { ...headers, Range: `${desde}-${desde + 999}`, 'Range-Unit': 'items' } });
        if (!r.ok) return { ok: false, filas };
        const pagina = await r.json();
        filas.push(...pagina);
        if (pagina.length < 1000) break;
      }
      return { ok: true, filas };
    };
    const [rEq, rHist, rOT] = await Promise.all([
      leerTodo('equipos?select=sigla,horomActual,fechaHorom'),
      leerTodo(`historial_horometros?select=sigla,fecha,horomFin&fecha=gte.${desdeLecturas}&order=sigla,fecha`),
      leerTodo('correctivos?select=sigla,fechaEntrada,estadoOT&estadoOT=eq.Abierta'),
    ]);
    let tablasTemporales: string[] = [];
    try {
      const rTab = await fetch(`${SUPABASE_URL}/rest/v1/rpc/tablas_temporales_olvidadas`, { method: 'POST', headers, body: '{}' });
      if (rTab.ok) tablasTemporales = await rTab.json();   // si la función aún no existe (404) simplemente no se revisa este punto
    } catch (_) { /* no bloquea el resto */ }
    if (rEq.ok && rHist.ok && rOT.ok) {
      problemas.push(...evaluarCalidadDatos({ equipos: rEq.filas, lecturas: rHist.filas, otAbiertas: rOT.filas, tablasTemporales }, ahoraISO));
    } else {
      problemas.push(`Calidad de datos: no se pudieron leer ${[!rEq.ok && 'equipos', !rHist.ok && 'historial_horometros', !rOT.ok && 'correctivos'].filter(Boolean).join(', ')} — el detector de datos no pudo revisar hoy.`);
    }
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
      <ul>${problemas.map((p) => `<li>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</li>`).join('')}</ul>
      <p style="color:#888;font-size:12px;margin-top:16px">Alerta automática del detector de salud (tareas programadas, canal de reportes entrantes y calidad de los datos). Se repite mientras siga pendiente.</p>`;

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
