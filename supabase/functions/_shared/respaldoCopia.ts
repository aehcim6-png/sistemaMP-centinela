// Segunda copia del respaldo diario: además del correo (Resend), el archivo .json.gz se guarda en un bucket PRIVADO de
// Supabase Storage y se conservan solo los últimos N días. Protege del caso «el correo se perdió, se borró o no llegó».
// OJO: vive en el mismo proyecto de Supabase, así que NO protege si el proyecto entero se perdiera; para eso hace falta una
// copia fuera (ver docs/arquitectura.md §222).
// Las funciones de nombres y vencimientos son puras (se prueban en tests/respaldoCopia.test.js); la subida recibe el cliente.

export const BUCKET_RESPALDOS = 'respaldos-diarios';
export const DIAS_CONSERVAR_RESPALDO = 30;
const PATRON = /^sistemamp-backup-(\d{4}-\d{2}-\d{2})\.json\.gz$/;

export function nombreRespaldo(fecha: string): string {
  return `sistemamp-backup-${fecha}.json.gz`;
}

// Nombres (de la carpeta del bucket) cuya fecha es más antigua que `diasConservar` días antes de `hoy` (YYYY-MM-DD).
// Solo toca archivos con el patrón del respaldo: cualquier otro archivo se deja en paz.
export function nombresVencidos(nombres: string[], hoy: string, diasConservar = DIAS_CONSERVAR_RESPALDO): string[] {
  const corte = new Date(hoy + 'T00:00:00Z').getTime() - diasConservar * 86400000;
  return nombres.filter((n) => {
    const m = PATRON.exec(n);
    return !!m && new Date(m[1] + 'T00:00:00Z').getTime() < corte;
  });
}

export type ResultadoCopia = { ok: boolean; detalle: string; borrados: number };

// Sube la copia (reemplaza la del mismo día) y borra las vencidas. Nunca lanza: devuelve ok=false con el motivo, para que el
// llamador lo deje en salud_crons sin perder el envío por correo.
export async function subirCopiaRespaldo(
  supabase: any,
  contenido: ArrayBuffer | Uint8Array,
  fecha: string,
  opts: { bucket?: string; dias?: number } = {},
): Promise<ResultadoCopia> {
  const bucket = opts.bucket ?? BUCKET_RESPALDOS;
  try {
    const { error } = await supabase.storage.from(bucket).upload(nombreRespaldo(fecha), contenido, {
      contentType: 'application/gzip',
      upsert: true,
    });
    if (error) return { ok: false, detalle: `subida: ${error.message ?? error}`, borrados: 0 };
    let borrados = 0;
    const { data: lista, error: errLista } = await supabase.storage.from(bucket).list('', { limit: 1000 });
    if (errLista) return { ok: true, detalle: `copia guardada; no se pudo listar para limpiar (${errLista.message ?? errLista})`, borrados };
    const vencidos = nombresVencidos((lista || []).map((f: { name: string }) => f.name), fecha, opts.dias ?? DIAS_CONSERVAR_RESPALDO);
    if (vencidos.length) {
      const { error: errBorrar } = await supabase.storage.from(bucket).remove(vencidos);
      if (errBorrar) return { ok: true, detalle: `copia guardada; no se pudieron borrar ${vencidos.length} vencidas (${errBorrar.message ?? errBorrar})`, borrados };
      borrados = vencidos.length;
    }
    return { ok: true, detalle: `copia guardada${borrados ? `, ${borrados} vencida(s) borradas` : ''}`, borrados };
  } catch (e) {
    return { ok: false, detalle: `subida: ${(e as Error).message}`, borrados: 0 };
  }
}
