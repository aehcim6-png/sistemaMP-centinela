import { describe, it, expect } from 'vitest';
import { testIndependenciaChi2, independenciaComponenteUbicacion } from '../logic.js';

// Tabla de referencia verificada independientemente contra
// scipy.stats.chi2_contingency (3 componentes x 3 ubicaciones, con una
// asociación real inyectada: Neumático concentrado en Rampa):
//   chi2=12.485, gl=4, p=0.01409
// y contra scipy.stats.chi2.ppf(0.95, gl) para confirmar que
// _CHI2_CRITICO_95 coincide con el crítico real en todo el rango 1..12.
const TABLA_ASOCIADA = {
  Neumatico: { Pit: 10, Rampa: 30, Planta: 10 },
  Motor: { Pit: 25, Rampa: 22, Planta: 23 },
  Hidraulico: { Pit: 15, Rampa: 12, Planta: 14 },
};

// Misma estructura pero sin asociación real (proporciones iguales entre
// filas, solo escaladas por el total de cada fila) — el chi2 debería ser
// muy bajo y no significativo.
const TABLA_INDEPENDIENTE = {
  Neumatico: { Pit: 20, Rampa: 20, Planta: 20 },
  Motor: { Pit: 20, Rampa: 20, Planta: 20 },
  Hidraulico: { Pit: 20, Rampa: 20, Planta: 20 },
};

describe('testIndependenciaChi2', () => {
  it('reproduce el valor de referencia verificado con scipy.stats.chi2_contingency', () => {
    const r = testIndependenciaChi2(TABLA_ASOCIADA);
    expect(r.chi2).toBeCloseTo(12.49, 2);
    expect(r.gl).toBe(4);
    expect(r.critico).toBeCloseTo(9.488, 2);
    expect(r.significativo).toBe(true);
  });

  it('sin asociación real, chi2 es 0 y no es significativo', () => {
    const r = testIndependenciaChi2(TABLA_INDEPENDIENTE);
    expect(r.chi2).toBe(0);
    expect(r.significativo).toBe(false);
  });

  it('null con menos de 2 filas o columnas', () => {
    expect(testIndependenciaChi2({ A: { X: 10, Y: 10 } })).toBeNull();
    expect(testIndependenciaChi2({ A: { X: 10 }, B: { X: 10 } })).toBeNull();
    expect(testIndependenciaChi2({})).toBeNull();
    expect(testIndependenciaChi2(null)).toBeNull();
  });

  it('null si alguna celda esperada es menor a 5 (regla de Cochran)', () => {
    const tablaChica = {
      A: { X: 2, Y: 1 },
      B: { X: 1, Y: 2 },
    };
    expect(testIndependenciaChi2(tablaChica)).toBeNull();
  });

  it('null si los grados de libertad exceden el rango verificado de la tabla (>12)', () => {
    // 5 filas x 4 columnas -> gl=(5-1)*(4-1)=12, todavía dentro de rango
    const tablaGrande = {};
    ['A', 'B', 'C', 'D', 'E'].forEach((f) => {
      tablaGrande[f] = { W: 10, X: 10, Y: 10, Z: 10 };
    });
    expect(testIndependenciaChi2(tablaGrande)).not.toBeNull();
    // 6 filas x 4 columnas -> gl=(6-1)*(4-1)=15, fuera de rango
    tablaGrande.F = { W: 10, X: 10, Y: 10, Z: 10 };
    expect(testIndependenciaChi2(tablaGrande)).toBeNull();
  });

  it('las celdas devueltas incluyen observado/esperado/índice por combinación', () => {
    const r = testIndependenciaChi2(TABLA_ASOCIADA);
    const celdaRampa = r.celdas.find((c) => c.fila === 'Neumatico' && c.columna === 'Rampa');
    expect(celdaRampa.observado).toBe(30);
    expect(celdaRampa.indice).toBeGreaterThan(1);
  });
});

describe('independenciaComponenteUbicacion', () => {
  function otsDesde(tabla) {
    const ots = [];
    let i = 0;
    Object.keys(tabla).forEach((comp) => {
      Object.keys(tabla[comp]).forEach((ubi) => {
        for (let k = 0; k < tabla[comp][ubi]; k++) {
          ots.push({ tipo: 'Correctivo', componente: comp, ubicacion: ubi, fecha: '2026-01-' + String(1 + (i++ % 28)).padStart(2, '0') });
        }
      });
    });
    return ots;
  }

  it('arma la tabla de contingencia desde OT reales y reproduce el mismo resultado', () => {
    const ots = otsDesde(TABLA_ASOCIADA);
    const r = independenciaComponenteUbicacion(ots);
    expect(r.chi2).toBeCloseTo(12.49, 2);
    expect(r.significativo).toBe(true);
  });

  it('ignora OT sin componente o sin ubicación', () => {
    const ots = otsDesde(TABLA_ASOCIADA).concat([
      { tipo: 'Correctivo', componente: 'Neumatico', fecha: '2026-02-01' }, // sin ubicacion
      { tipo: 'Correctivo', ubicacion: 'Pit', fecha: '2026-02-02' }, // sin componente
    ]);
    const r = independenciaComponenteUbicacion(ots);
    expect(r.chi2).toBeCloseTo(12.49, 2);
  });

  it('ignora OT que no son fallas reales (esFallaMTBF)', () => {
    const ots = otsDesde(TABLA_ASOCIADA).concat([
      { tipo: 'Preventivo', componente: 'Neumatico', ubicacion: 'Rampa', fecha: '2026-02-01' },
    ]);
    const r = independenciaComponenteUbicacion(ots);
    expect(r.chi2).toBeCloseTo(12.49, 2);
  });

  it('null sin datos suficientes', () => {
    expect(independenciaComponenteUbicacion([])).toBeNull();
    expect(independenciaComponenteUbicacion(null)).toBeNull();
  });
});
