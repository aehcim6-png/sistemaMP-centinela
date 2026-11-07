import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire(import.meta.url);
const { claseOTDesdeTexto, esFallaOTHist, soloFallasOTHist, _otHistComoOt, esFallaMTBF } = require('../logic.js');

// Las OT del Excel marcan «Correctiva» tareas que son rutina preventiva, cambios de desgaste o
// instalaciones (2026-11-07: ~35 % eran preventivas rutinarias). claseOT las separa sin tocar tipoInt.
describe('claseOTDesdeTexto', () => {
  it('rutina preventiva: control de neumáticos, presurizado, engrase, mantención semanal', () => {
    expect(claseOTDesdeTexto('Control de neumáticos')).toBe('preventiva');
    expect(claseOTDesdeTexto('Se realiza presurización neumático posición 1')).toBe('preventiva');
    expect(claseOTDesdeTexto('Se realiza engrase punto a punto de balde y relleno de aceite motor')).toBe('preventiva');
    expect(claseOTDesdeTexto('Mantención semanal')).toBe('preventiva');
  });
  it('desgaste planificado: cuchillas, entredientes, puntas de ripper', () => {
    expect(claseOTDesdeTexto('Se realiza cambio de cuchillas')).toBe('desgaste');
    expect(claseOTDesdeTexto('Reposicion de entrediente')).toBe('desgaste');
    expect(claseOTDesdeTexto('Cambio de puntas del ripper')).toBe('desgaste');
  });
  it('instalación o mejora: solo cuando hay verbo de instalar Y un objeto, sin palabra de falla', () => {
    expect(claseOTDesdeTexto('Se instala sistema de antisomnolencia')).toBe('instalacion');
    expect(claseOTDesdeTexto('Se realiza polarizado de parabrisas')).toBe('instalacion');
    expect(claseOTDesdeTexto('Se repara antena de radio base por corte eléctrico')).toBe('correctiva');
  });
  it('una palabra de falla gana sobre la rutina', () => {
    expect(claseOTDesdeTexto('Chequeo preventivo: se detecta fuga de aceite hidráulico')).toBe('correctiva');
    expect(claseOTDesdeTexto('Engrase, equipo fuera de servicio por código activo')).toBe('correctiva');
    expect(claseOTDesdeTexto('Cambio de turbo y engrase')).toBe('correctiva');
  });
  it('lo demás es correctiva y el texto vacío nunca inventa otra clase', () => {
    expect(claseOTDesdeTexto('CE-87 fuera de servicio por fuga de aceite hidráulico')).toBe('correctiva');
    expect(claseOTDesdeTexto('')).toBe('correctiva');
    expect(claseOTDesdeTexto(null)).toBe('correctiva');
  });
  it('tipoInt Programada o Predictiva es preventiva aunque el texto no lo diga', () => {
    expect(claseOTDesdeTexto('Equipo con PM4 en proceso', 'Programada')).toBe('preventiva');
    expect(claseOTDesdeTexto('lo que sea', 'Predictiva')).toBe('preventiva');
  });
  it('«dañadas» no se confunde con la sigla ADAS', () => {
    expect(claseOTDesdeTexto('Se instalan mangueras dañadas')).toBe('correctiva');
  });
});

describe('esFallaOTHist / soloFallasOTHist', () => {
  it('usa claseOT cuando está llenada, aunque el texto diga otra cosa', () => {
    expect(esFallaOTHist({ claseOT: 'preventiva', descripcion: 'fuga de aceite' })).toBe(false);
    expect(esFallaOTHist({ claseOT: 'correctiva', descripcion: 'Control de neumáticos' })).toBe(true);
  });
  it('sin claseOT la deduce del texto', () => {
    expect(esFallaOTHist({ descripcion: 'Control de neumáticos', tipoInt: 'Correctiva' })).toBe(false);
    expect(esFallaOTHist({ descripcion: 'Se cambia alternador' })).toBe(true);
    expect(esFallaOTHist(null)).toBe(false);
  });
  it('soloFallasOTHist y _otHistComoOt dejan fuera lo no-falla (así no inflan MTBF ni el ranking)', () => {
    const h = [
      { sigla: 'CN-9500', fecha: '2024-10-01', descripcion: 'Control de neumáticos', claseOT: 'preventiva', sistema: 'Neumáticos' },
      { sigla: 'CN-9500', fecha: '2024-10-02', descripcion: 'Falla alternador', claseOT: 'correctiva', sistema: 'Sist. Eléctrico' },
      { sigla: 'CF-9510', fecha: '2024-10-03', descripcion: 'Cambio de cuchillas', claseOT: 'desgaste', sistema: 'GETS' },
    ];
    expect(soloFallasOTHist(h)).toHaveLength(1);
    const adaptadas = _otHistComoOt(h);
    expect(adaptadas).toHaveLength(1);
    expect(adaptadas[0]).toMatchObject({ sigla: 'CN-9500', fecha: '2024-10-02', tipo: 'Correctivo' });
    expect(esFallaMTBF(adaptadas[0])).toBe(true);
  });
});

// El criterio vive dos veces (logic.js y la función SQL que llenó la columna). Este test evita que se desfasen.
describe('logic.js y la migración SQL usan los mismos patrones', () => {
  const js = readFileSync(new URL('../logic.js', import.meta.url), 'utf8');
  const sql = readFileSync(new URL('../supabase/migrations/20261107120000_clase_ot_correctivos_historico.sql', import.meta.url), 'utf8');
  const fuentesJs = [...js.matchAll(/var _CLASE_OT_\w+=\/(.+)\/i;/g)].map((m) => m[1].replace(/\\b/g, '\\y'));
  const fuentesSql = [...sql.matchAll(/~\* '([^']+)'/g)].map((m) => m[1]);
  it('hay 6 patrones en cada lado', () => {
    expect(fuentesJs).toHaveLength(6);
    expect(new Set(fuentesSql).size).toBe(6);
  });
  it('cada patrón de logic.js aparece igual en el SQL', () => {
    fuentesJs.forEach((p) => expect(fuentesSql).toContain(p));
  });
});
