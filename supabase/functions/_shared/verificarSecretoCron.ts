// Verifica el secreto de un cron contra Supabase Vault (función restringida verificar_secreto_cron), distinguiendo TRES resultados en vez de dos:
//   'valido'   — la base confirmó que el secreto coincide.
//   'invalido' — la base respondió y el secreto NO coincide (alguien llamó sin el secreto correcto). Es definitivo: no se reintenta.
//   'error'    — la verificación en sí falló (la API respondió 401/5xx, o no hubo respuesta). NO dice nada sobre el secreto.
// Antes los tres casos se trataban igual («No autorizado», 401, sin dejar registro): el 19-oct-2026 un rechazo pasajero de la API a esta misma
// llamada hizo que el resumen semanal de sistema-mp2 no se enviara y nadie se enterara. Ahora un 'error' se reintenta una vez y, si persiste,
// quien llama lo registra en salud_crons para que el detector de salud avise.
export type EstadoVerificacion = 'valido' | 'invalido' | 'error';
export interface ResultadoVerificacion {
  estado: EstadoVerificacion;
  http?: number; // último código HTTP recibido cuando estado === 'error' (undefined si no hubo respuesta)
}
export interface OpcionesVerificacion {
  reintentos?: number; // cuántas veces más intentar tras un 'error' (por defecto 1)
  esperaMs?: number; // pausa entre intentos (por defecto 700 ms)
  fetchFn?: typeof fetch; // inyectable para las pruebas
}

export async function verificarSecretoCron(
  supabaseUrl: string,
  serviceKey: string,
  nombreSecreto: string,
  valorRecibido: string,
  opciones: OpcionesVerificacion = {}
): Promise<ResultadoVerificacion> {
  const reintentos = opciones.reintentos ?? 1;
  const esperaMs = opciones.esperaMs ?? 700;
  const fetchFn = opciones.fetchFn ?? fetch;
  let http: number | undefined;
  for (let intento = 0; intento <= reintentos; intento++) {
    if (intento > 0 && esperaMs > 0) await new Promise((r) => setTimeout(r, esperaMs));
    try {
      const r = await fetchFn(`${supabaseUrl}/rest/v1/rpc/verificar_secreto_cron`, {
        method: 'POST',
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_secreto: nombreSecreto, valor_recibido: valorRecibido }),
      });
      http = r.status;
      if (r.ok) {
        const cuerpo = await r.json().catch(() => null);
        return { estado: cuerpo === true ? 'valido' : 'invalido' };
      }
    } catch {
      http = undefined; // sin respuesta (red, tiempo agotado)
    }
  }
  return { estado: 'error', http };
}

// Texto para salud_crons cuando la verificación falló (no el secreto): deja claro que ese día el proceso no corrió.
export function detalleErrorVerificacion(res: ResultadoVerificacion): string {
  return `No se pudo verificar el secreto del cron (${res.http ? 'HTTP ' + res.http : 'sin respuesta'}) — el proceso de hoy no se ejecutó`;
}
