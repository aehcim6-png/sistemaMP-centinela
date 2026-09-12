import { describe, it, expect } from 'vitest';
import { aceiteOutliers } from '../logic.js';

function muestra(over) {
  return { sigla: 'CN-1', fecha: '2026-01-01', descriptor: 'MOTOR', hierro: 10, cobre: 5, ...over };
}

describe('aceiteOutliers', () => {
  it('no marca nada con menos de 5 muestras del mismo descriptor+metal (mediana no confiable)', () => {
    const ace = [muestra({ hierro: 10 }), muestra({ hierro: 12 }), muestra({ hierro: 900 })];
    expect(aceiteOutliers(ace)).toEqual([]);
  });

  it('marca una muestra con un metal >10x la mediana de su mismo descriptor Y >2x el umbral fijo de alerta', () => {
    const ace = [
      muestra({ hierro: 10 }), muestra({ hierro: 12 }), muestra({ hierro: 11 }),
      muestra({ hierro: 10 }), muestra({ hierro: 9 }),
      muestra({ hierro: 500 }), // 500 >> 10x mediana(~10) y >> 2x umbral(50) -> outlier
    ];
    const r = aceiteOutliers(ace);
    expect(r.length).toBe(1);
    expect(r[0].metal).toBe('hierro');
    expect(r[0].valor).toBe(500);
    expect(r[0].muestra.hierro).toBe(500);
  });

  it('NO marca un desgaste real alto que supera la mediana pero no supera 2x el umbral fijo (no confundir alerta genuina con error)', () => {
    const ace = [
      muestra({ hierro: 5 }), muestra({ hierro: 4 }), muestra({ hierro: 6 }),
      muestra({ hierro: 5 }), muestra({ hierro: 4 }),
      muestra({ hierro: 60 }), // >10x la mediana(~5) pero 60 < 2x50=100 -> no es "posible error", puede ser desgaste real
    ];
    expect(aceiteOutliers(ace)).toEqual([]);
  });

  it('NO marca un valor alto en términos absolutos si no es estadísticamente extremo para su propio descriptor (ej. MOTOR con desgaste crónico alto pero parejo)', () => {
    const ace = [
      muestra({ hierro: 105 }), muestra({ hierro: 110 }), muestra({ hierro: 108 }),
      muestra({ hierro: 112 }), muestra({ hierro: 100 }),
      muestra({ hierro: 115 }), // por encima del umbral fijo (50) pero consistente con la mediana de ESTE grupo (~108) -> no es un error de digitación
    ];
    expect(aceiteOutliers(ace)).toEqual([]);
  });

  it('compara cada descriptor por separado (no mezcla MOTOR con TRANSMISION)', () => {
    const motor = (h) => muestra({ descriptor: 'MOTOR', hierro: h });
    const trans = (h) => muestra({ descriptor: 'TRANSMISION', hierro: h });
    const ace = [
      motor(10), motor(11), motor(9), motor(10), motor(12),
      trans(200), trans(210), trans(190), trans(205), trans(195), // TRANSMISION tiene desgaste típico alto — no es un error para SU grupo
    ];
    expect(aceiteOutliers(ace)).toEqual([]);
  });

  it('revisa varios metales por muestra, no solo uno', () => {
    const ace = [
      muestra({ hierro: 10, cobre: 5 }), muestra({ hierro: 11, cobre: 6 }), muestra({ hierro: 9, cobre: 4 }),
      muestra({ hierro: 10, cobre: 5 }), muestra({ hierro: 12, cobre: 6 }),
      muestra({ hierro: 10, cobre: 300 }), // cobre extremo, hierro normal
    ];
    const r = aceiteOutliers(ace);
    expect(r.length).toBe(1);
    expect(r[0].metal).toBe('cobre');
  });

  it('ignora muestras sin descriptor o con metal en 0/ausente', () => {
    const ace = [
      muestra({ descriptor: '', hierro: 99999 }),
      muestra({ hierro: 0 }), muestra({}),
      muestra({ hierro: 10 }), muestra({ hierro: 11 }), muestra({ hierro: 9 }), muestra({ hierro: 10 }),
    ];
    expect(aceiteOutliers(ace)).toEqual([]);
  });

  it('array vacío sin muestras', () => {
    expect(aceiteOutliers([])).toEqual([]);
    expect(aceiteOutliers(undefined)).toEqual([]);
  });

  it('no muta el arreglo original (pura)', () => {
    const ace = [
      muestra({ hierro: 10 }), muestra({ hierro: 11 }), muestra({ hierro: 9 }),
      muestra({ hierro: 10 }), muestra({ hierro: 12 }), muestra({ hierro: 500 }),
    ];
    const copia = ace.map((m) => ({ ...m }));
    aceiteOutliers(ace);
    expect(ace).toEqual(copia);
  });

  it('nunca modifica el campo estado de la muestra original (solo lista para revisión, no reclasifica)', () => {
    const ace = [
      muestra({ hierro: 10, estado: 'NORMAL' }), muestra({ hierro: 11, estado: 'NORMAL' }), muestra({ hierro: 9, estado: 'NORMAL' }),
      muestra({ hierro: 10, estado: 'NORMAL' }), muestra({ hierro: 12, estado: 'NORMAL' }),
      muestra({ hierro: 500, estado: 'ALERTA' }),
    ];
    aceiteOutliers(ace);
    expect(ace[5].estado).toBe('ALERTA');
  });
});
