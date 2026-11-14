// Segunda copia del respaldo diario: nombres, vencimientos (solo toca archivos del patrón) y subida que nunca lanza.
import { describe, it, expect } from 'vitest';
import { nombreRespaldo, nombresVencidos, subirCopiaRespaldo, BUCKET_RESPALDOS } from '../supabase/functions/_shared/respaldoCopia.ts';

describe('nombresVencidos', () => {
  const lista = ['sistemamp-backup-2026-10-01.json.gz', 'sistemamp-backup-2026-10-14.json.gz', 'sistemamp-backup-2026-10-15.json.gz', 'sistemamp-backup-2026-11-13.json.gz', 'LEEME.txt', 'sistemamp-backup-mal.json.gz'];
  it('borra solo lo anterior a 30 días y deja intactos los archivos ajenos', () => {
    // hoy 13-nov, corte = 14-oct (no se borra el del 14-oct ni el 15-oct)
    expect(nombresVencidos(lista, '2026-11-13', 30)).toEqual(['sistemamp-backup-2026-10-01.json.gz']);
  });
  it('sin nada vencido devuelve vacío', () => { expect(nombresVencidos(['sistemamp-backup-2026-11-12.json.gz'], '2026-11-13')).toEqual([]); });
  it('el nombre lleva la fecha', () => { expect(nombreRespaldo('2026-11-13')).toBe('sistemamp-backup-2026-11-13.json.gz'); });
});

function falso({ errSubida, lista = [], errBorrar } = {}) {
  const llamadas = { upload: [], remove: [] };
  const api = {
    upload: (n, c, o) => { llamadas.upload.push([n, o]); return Promise.resolve({ error: errSubida || null }); },
    list: () => Promise.resolve({ data: lista.map((name) => ({ name })), error: null }),
    remove: (ns) => { llamadas.remove.push(ns); return Promise.resolve({ error: errBorrar || null }); },
  };
  return { sb: { storage: { from: (b) => { llamadas.bucket = b; return api; } } }, llamadas };
}

describe('subirCopiaRespaldo', () => {
  it('sube (reemplazando la del día) al bucket privado y borra las vencidas', async () => {
    const f = falso({ lista: ['sistemamp-backup-2026-09-01.json.gz', 'sistemamp-backup-2026-11-13.json.gz'] });
    const r = await subirCopiaRespaldo(f.sb, new Uint8Array([1, 2]), '2026-11-13');
    expect(r.ok).toBe(true); expect(r.borrados).toBe(1);
    expect(f.llamadas.bucket).toBe(BUCKET_RESPALDOS);
    expect(f.llamadas.upload[0][0]).toBe('sistemamp-backup-2026-11-13.json.gz');
    expect(f.llamadas.upload[0][1].upsert).toBe(true);
    expect(f.llamadas.remove[0]).toEqual(['sistemamp-backup-2026-09-01.json.gz']);
  });
  it('si la subida falla devuelve ok=false con el motivo y no borra nada', async () => {
    const f = falso({ errSubida: { message: 'bucket no existe' }, lista: ['sistemamp-backup-2026-01-01.json.gz'] });
    const r = await subirCopiaRespaldo(f.sb, new Uint8Array([1]), '2026-11-13');
    expect(r.ok).toBe(false); expect(r.detalle).toContain('bucket no existe'); expect(f.llamadas.remove).toHaveLength(0);
  });
  it('una excepción inesperada no se propaga (el correo ya salió)', async () => {
    const sb = { storage: { from: () => { throw new Error('red caída'); } } };
    const r = await subirCopiaRespaldo(sb, new Uint8Array([1]), '2026-11-13');
    expect(r.ok).toBe(false); expect(r.detalle).toContain('red caída');
  });
  it('si no se puede borrar una vencida, la copia del día igual cuenta como guardada', async () => {
    const f = falso({ lista: ['sistemamp-backup-2026-01-01.json.gz'], errBorrar: { message: 'sin permiso' } });
    const r = await subirCopiaRespaldo(f.sb, new Uint8Array([1]), '2026-11-13');
    expect(r.ok).toBe(true); expect(r.detalle).toContain('no se pudieron borrar');
  });
});
