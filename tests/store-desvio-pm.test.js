import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// El % de Cumplimiento PM (Dashboard, Informes KPI y Metas) se calcula con regEsATiempo, que lee reg.desvioDias. Ese campo no estaba en las columnas
// que store.js sincroniza con la tabla registros_pm, así que se perdía al recargar y el indicador quedaba vacío (revisión cruzada de coherencia, 2026-10-14).
describe('registros de PM: el desvío se guarda', () => {
  const store = fs.readFileSync(path.join(__dirname, '..', 'modules', 'store.js'), 'utf8');
  it('desvioDias está entre las columnas sincronizadas de reg', () => {
    const linea = store.split('\n').find((l) => /^\s*reg:\{tabla:'registros_pm'/.test(l));
    expect(linea).toBeTruthy();
    expect(linea).toContain("'desvioDias'");
  });
  it('existe la migración que crea la columna', () => {
    const dir = path.join(__dirname, '..', 'supabase', 'migrations');
    const sql = fs.readdirSync(dir).filter((f) => /desvio_dias/.test(f)).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
    expect(sql).toMatch(/add column if not exists "desvioDias"/);
  });
});
