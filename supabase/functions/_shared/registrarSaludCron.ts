// Registro best-effort en public.salud_crons (ver migración
// *_crear_tabla_salud_crons.sql) — usado por backup-diario, whatsapp-webhook
// y email-webhook para dejar constancia de su propio resultado. Si esta
// llamada falla (red, tabla caída, lo que sea) NUNCA debe tumbar la
// respuesta real del cron/webhook que la invocó — por eso traga su propio
// error en vez de propagarlo.
export async function registrarSaludCron(
  supabaseUrl: string,
  serviceKey: string,
  nombre: string,
  exito: boolean,
  detalle: string
): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/rest/v1/salud_crons?on_conflict=nombre`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        nombre,
        ultimaEjecucion: new Date().toISOString(),
        exito,
        detalle: detalle.slice(0, 500),
      }),
    });
  } catch {
    // best-effort — ver comentario arriba.
  }
}
