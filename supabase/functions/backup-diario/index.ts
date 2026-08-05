// Backup diario automático — junta TODAS las tablas reales de la base, las
// comprime, y las manda por email vía Resend. Se dispara solo, todos los
// días, por un cron job de Postgres (pg_cron + pg_net) — ver la migración
// supabase/migrations/*_programar_backup_diario.sql. No depende de que la
// app esté abierta en ningún navegador, a diferencia del respaldo a carpeta
// local (que sí necesita una pestaña activa).
//
// Autenticación en dos capas, ninguna hardcodeada en este archivo:
// - Authorization: Bearer <anon key> — la misma clave pública que ya usa el
//   frontend (verify_jwt=true la exige igual que cualquier otra función).
// - X-Resend-Key: la clave real de Resend, guardada cifrada en Supabase
//   Vault y inyectada por el cron job en cada invocación — esta función
//   nunca la persiste ni la ve fuera de esta única request.
//
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY: inyectadas automáticamente por
// Supabase en TODA Edge Function, sin configurar nada — se usa la de
// service role acá (no la anon) para poder leer TODAS las filas sin
// chocar con RLS (esto es un respaldo completo, no una vista de usuario).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding/base64";

// Mismo set de tablas reales que TABLA_REAL/TABLA_SINGLETON en
// modules/store.js, más 'kv' (banderas legacy) y 'user_roles' (para poder
// reconstruir accesos ante un desastre total). Lista manual a propósito —
// mismo criterio que TABLA_REAL: una tabla nueva se agrega acá cuando se
// agrega allá, no se auto-descubre.
const TABLAS = [
  'kv', 'user_roles', 'equipos', 'registros_pm', 'correctivos', 'movimientos_stock',
  'historial_horometros', 'neumaticos', 'neumaticos_mediciones', 'pautas',
  'stock_filtros', 'lubricantes', 'repuestos', 'informes_falla', 'programa',
  'alertas', 'vencimientos', 'componentes_mayores', 'inspecciones', 'analisis_aceite',
  'ordenes_compra', 'plan_semanal', 'plan_semanal_historico', 'gantt', 'destrabe',
  'changelog', 'tabla_precios_maestro', 'configuracion', 'tarifa_hh',
  'meta_disponibilidad', 'metas', 'disponibilidad_calculada', 'avance_data',
  'mapeo_repuestos', 'ordenes_compra_historico', 'programacion_diaria',
  'sensores_neumaticos', 'tren_rodaje', 'tren_rodaje_mediciones',
  'movimientos_stock_backup_lub', 'stock_filtros_backup_csv', 'papelera'
];

// PostgREST impone un tope de filas por request (~1000 en este proyecto,
// mismo límite ya documentado en _fetchPaginado de modules/store.js) sin
// avisar — pedir de a PASO filas y seguir pidiendo hasta una página
// incompleta esquiva el tope sin depender de conocer su valor exacto.
const PASO = 500;
async function traerTodasLasFilas(supabase: any, tabla: string) {
  let todas: any[] = [];
  let desde = 0;
  while (true) {
    const { data, error } = await supabase.from(tabla).select('*').range(desde, desde + PASO - 1);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    todas = todas.concat(data || []);
    if (!data || data.length < PASO) break;
    desde += PASO;
  }
  return todas;
}

Deno.serve(async (req: Request) => {
  try {
    const resendKey = req.headers.get('x-resend-key');
    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'Falta el header X-Resend-Key' }), { status: 400 });
    }
    const destinatario = req.headers.get('x-backup-to') || 'aehcim6@gmail.com';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const tablas: Record<string, any[]> = {};
    const resumen: string[] = [];
    for (const t of TABLAS) {
      try {
        const filas = await traerTodasLasFilas(supabase, t);
        tablas[t] = filas;
        resumen.push(`${t}: ${filas.length}`);
      } catch (e) {
        resumen.push(`${t}: ERROR (${(e as Error).message})`);
      }
    }

    const fecha = new Date().toISOString().slice(0, 10);
    const payload = JSON.stringify({ fecha, tablas }, null, 0);

    // Comprime antes de mandar por email — un JSON de ~20-30MB sin comprimir
    // se acerca peligrosamente al límite de adjuntos de Resend (40MB); gzip
    // de un JSON tan repetitivo (mismas claves en cada fila) suele bajarlo
    // a una fracción de eso.
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(new TextEncoder().encode(payload));
    writer.close();
    const comprimido = new Response(cs.readable);
    const bufferComprimido = await comprimido.arrayBuffer();
    // encodeBase64 (no spread manual sobre el array de bytes) — con un
    // backup de varios MB, "String.fromCharCode(...bytes)" revienta el
    // límite de argumentos de función del motor de JS.
    const base64 = encodeBase64(bufferComprimido);

    const rEmail = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Respaldo SistemaMP Centinela <onboarding@resend.dev>',
        to: [destinatario],
        subject: `Respaldo diario SistemaMP Centinela — ${fecha}`,
        text: `Respaldo automático del ${fecha}.\n\nFilas por tabla:\n${resumen.join('\n')}\n\nEste correo se genera solo, todos los días — no hace falta abrir la app.`,
        attachments: [{
          filename: `sistemamp-backup-${fecha}.json.gz`,
          content: base64
        }]
      })
    });

    if (!rEmail.ok) {
      const detalle = await rEmail.text();
      return new Response(JSON.stringify({ ok: false, paso: 'envio_email', status: rEmail.status, detalle }), { status: 502 });
    }

    return new Response(JSON.stringify({ ok: true, fecha, resumen }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), { status: 500 });
  }
});
