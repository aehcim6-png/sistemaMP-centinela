import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const L = require('../logic.js');
const { sistemasDeTexto, sistemasCubiertosPorPM, calidadEjecucionPM, _lecturaRazonCE, _relativoCE, _fraccionDiasConFallaCE } = L;

// Fecha base + n días (UTC, sin zona horaria de por medio).
const F = (n) => new Date(Date.UTC(2026, 0, 1) + n * 86400000).toISOString().slice(0, 10);
const corr = (sigla, dia, sistema) => ({ tipo: 'Correctivo', sigla, fecha: F(dia), sistema });
const pm = (equipo, dia, tipoPM, extra) => Object.assign({ equipo, tipoPM, fechaEntrada: F(dia), fechaSalida: F(dia), horaEntrada: '14:00' }, extra || {});

describe('sistemasDeTexto', () => {
  it('reconoce sistemas por palabra clave, también con texto mal codificado', () => {
    expect(sistemasDeTexto('Aceite Motor OM 470 LA')).toEqual(['motor']);
    expect(sistemasDeTexto('ElÃ©ctrico')).toEqual(['electrico']);
    expect(sistemasDeTexto('HidrÃ¡ulico')).toEqual(['hidraulico']);
    expect(sistemasDeTexto('Desgaste de zapatas y tambores')).toEqual(['frenos']);
    expect(sistemasDeTexto('Componentes ejes delanteros')).toEqual(['transmision']);
  });
  it('"eje" solo cuenta como palabra: "ejecutar" no es transmisión', () => {
    expect(sistemasDeTexto('ejecutar revision')).toEqual([]);
  });
  it('texto vacío o sin sistema → []', () => {
    expect(sistemasDeTexto('')).toEqual([]);
    expect(sistemasDeTexto(null)).toEqual([]);
    expect(sistemasDeTexto('Cabina')).toEqual([]);
  });
});

describe('sistemasCubiertosPorPM: pautas acumulativas y mapa de equipos', () => {
  const pautas = [
    { sigla: 'EQ1', pm: 'PM1', act: 'Revisar frenos' },
    { sigla: 'EQ1', pm: 'PM2', act: 'Revisar hidraulico' },
    { sigla: 'EQ1', pm: 'PM3', act: 'Aceite de transmision' },
    { sigla: 'EQ1', pm: 'PM4', act: 'Bateria y alternador' },
  ];
  it('PM1 cubre solo lo suyo; PM2 suma PM1; PM4 cubre todo', () => {
    expect(sistemasCubiertosPorPM(pautas, 'EQ1', 'PM1', {}).sistemas.sort()).toEqual(['frenos']);
    expect(sistemasCubiertosPorPM(pautas, 'EQ1', 'PM2', {}).sistemas.sort()).toEqual(['frenos', 'hidraulico']);
    expect(sistemasCubiertosPorPM(pautas, 'EQ1', 'PM4', {}).sistemas.sort()).toEqual(['electrico', 'frenos', 'hidraulico', 'transmision']);
  });
  it('PM5..PM9 (importaciones viejas) se tratan como PM4', () => {
    expect(sistemasCubiertosPorPM(pautas, 'EQ1', 'PM6', {}).sistemas.length).toBe(4);
  });
  it('un equipo que comparte pauta (GRUPO_PAUTAS) usa la del grupo', () => {
    const r = sistemasCubiertosPorPM(pautas, 'EQ2', 'PM2', { EQ2: 'EQ1' });
    expect(r.hayPauta).toBe(true);
    expect(r.sistemas.sort()).toEqual(['frenos', 'hidraulico']);
  });
  it('equipo sin ninguna fila de pauta → hayPauta=false', () => {
    expect(sistemasCubiertosPorPM(pautas, 'EQ9', 'PM1', {}).hayPauta).toBe(false);
  });
});

describe('_fraccionDiasConFallaCE (línea base)', () => {
  it('unión de [f-H, f-1] recortada al período, sin contar dos veces los solapes', () => {
    // período 10..49 (40 días), H=7. Fallas en 20 y 22: [13,19] ∪ [15,21] = 13..21 → 9 días
    expect(_fraccionDiasConFallaCE([20, 22], 10, 49, 7)).toBeCloseTo(9 / 40, 10);
  });
  it('una falla fuera del período no aporta; sin fallas → 0', () => {
    expect(_fraccionDiasConFallaCE([100], 10, 49, 7)).toBe(0);
    expect(_fraccionDiasConFallaCE([], 10, 49, 7)).toBe(0);
  });
});

describe('_lecturaRazonCE / _relativoCE (rango de confianza 95%)', () => {
  it('con menos de 10 eventos observados NO hay rango ni lectura', () => {
    const r = _lecturaRazonCE(9, 5);
    expect(r.razon).toBe(1.8);
    expect(r.ic95).toBeNull();
    expect(r.senal).toBe('insuficiente');
  });
  it('sin esperado → insuficiente, sin razón', () => {
    expect(_lecturaRazonCE(12, 0)).toMatchObject({ razon: null, senal: 'insuficiente' });
  });
  it('sobre lo esperado cuando el rango entero queda por encima de 1', () => {
    const r = _lecturaRazonCE(40, 25.5);
    expect(r.razon).toBe(1.57);
    expect(r.ic95[0]).toBeGreaterThan(1);
    expect(r.senal).toBe('sobre');
  });
  it('no concluyente cuando el rango cruza 1', () => {
    const r = _lecturaRazonCE(12, 12);
    expect(r.razon).toBe(1);
    expect(r.ic95[0]).toBeLessThan(1);
    expect(r.ic95[1]).toBeGreaterThan(1);
    expect(r.senal).toBe('no_concluyente');
  });
  it('bajo lo esperado cuando el rango entero queda por debajo de 1', () => {
    expect(_lecturaRazonCE(10, 30).senal).toBe('bajo');
  });
  it('grupo vs resto: insuficiente si alguno tiene <10 eventos; sobre si el rango queda sobre 1', () => {
    expect(_relativoCE({ obs: 8, esp: 3 }, { obs: 50, esp: 50 }).senal).toBe('insuficiente');
    const r = _relativoCE({ obs: 60, esp: 20 }, { obs: 50, esp: 50 });
    expect(r.razon).toBe(3);
    expect(r.senal).toBe('sobre');
  });
});

describe('calidadEjecucionPM', () => {
  // Escenario calculado a mano. Equipo EQ1, sistema motor. Fallas (día): 5 (misma visita
  // que el PM del día 5: NO cuenta), 10, 50. Última falla = 50 → con H=7 el corte es el día 43.
  // Período base = 5..43 (39 días). Cubiertos: f=5 → [-2,4] fuera; f=10 → [3,9]→5..9 (5 días);
  // f=50 → [43,49]→43 (1 día). Base = 6/39.
  const pautas = [{ sigla: 'EQ1', pm: 'PM1', act: 'Aceite motor' }];
  const correctivos = [corr('EQ1', 5, 'Motor diesel'), corr('EQ1', 10, 'Motor diesel'), corr('EQ1', 50, 'Motor diesel')];
  const registros = [
    pm('EQ1', 5, 'PM1', { horaEntrada: '02:00', pmCompleto: false, queFalto: 'filtro' }),
    pm('EQ1', 20, 'PM1', { horaEntrada: '14:00' }),
    pm('EQ1', 45, 'PM1'), // después del corte: su ventana de 7 días no está completa
  ];
  const r = calidadEjecucionPM(registros, correctivos, pautas, { horizonteDias: 7, grupoPautas: {} });

  it('corte por censura y conteo de PM evaluados', () => {
    expect(r.sinDatos).toBe(false);
    expect(r.corteFecha).toBe(F(43));
    expect(r.nPM).toBe(2);
    expect(r.nPMSinPauta).toBe(0);
  });
  it('observado: la falla del mismo día no cuenta, la del día 10 sí (solo en el PM del día 5)', () => {
    expect(r.total.obs).toBe(1);
  });
  it('esperado = línea base propia del equipo y sistema (6/39 por PM → 12/39)', () => {
    expect(r.total.esp).toBeCloseTo(12 / 39, 1);
    expect(r.total.razon).toBe(3.25);
  });
  it('con tan pocos eventos la lectura es "insuficiente"', () => {
    expect(r.total.senal).toBe('insuficiente');
    expect(r.porFranja.every((g) => g.senal === 'insuficiente')).toBe(true);
  });
  it('agrupa por franja horaria de entrada', () => {
    const m = r.porFranja.find((g) => g.clave === '00-06');
    const t = r.porFranja.find((g) => g.clave === '12-18');
    expect(m.nPM).toBe(1);
    expect(m.obs).toBe(1);
    expect(t.nPM).toBe(1);
    expect(t.obs).toBe(0);
  });
  it('agrupa por "PM completo según pauta": completo / incompleto / sin dato (null nunca es completo)', () => {
    const inc = r.porPautaCompleta.find((g) => g.clave === 'incompleto');
    const sd = r.porPautaCompleta.find((g) => g.clave === 'sin_dato');
    expect(inc.nPM).toBe(1);
    expect(sd.nPM).toBe(1);
    expect(r.porPautaCompleta.find((g) => g.clave === 'completo')).toBeUndefined();
  });
  it('un PM de equipo sin pauta no se evalúa y se informa', () => {
    const x = calidadEjecucionPM(registros.concat([pm('EQ9', 6, 'PM1')]), correctivos, pautas, {});
    expect(x.nPMSinPauta).toBe(1);
    expect(x.nPM).toBe(3);
    expect(x.total.obs).toBe(1);
  });
  it('sin fallas o sin PM → sinDatos', () => {
    expect(calidadEjecucionPM(registros, [], pautas, {}).sinDatos).toBe(true);
    expect(calidadEjecucionPM([], correctivos, pautas, {}).sinDatos).toBe(true);
  });
  it('una falla de OTRO sistema no cuenta como re-trabajo', () => {
    const otros = [corr('EQ1', 10, 'Cabina'), corr('EQ1', 50, 'Motor diesel')];
    const x = calidadEjecucionPM(registros, otros, pautas, {});
    expect(x.total.obs).toBe(0);
  });
});
