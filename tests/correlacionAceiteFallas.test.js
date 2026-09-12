import { describe, it, expect } from 'vitest';
import { correlacionAceiteFallas } from '../logic.js';

function ace(over) {
  return { _sigla: 'CN-1', fecha: '2026-01-01', descriptor: 'Motor', estado: 'NORMAL', ...over };
}

function correctivo(over) {
  return { sigla: 'CN-1', componente: 'Motor', fecha: '2026-01-15', ...over };
}

describe('correlacionAceiteFallas', () => {
  it('no reporta tasa para un componente con menos de 5 muestras de un lado (sample insuficiente)', () => {
    const muestras = [ace({ estado: 'ALERTA', fecha: '2026-01-01' }), ace({ estado: 'ALERTA', fecha: '2026-02-01' })];
    const eventos = [correctivo({ fecha: '2026-01-10' })];
    const r = correlacionAceiteFallas(muestras, eventos);
    const motor = r.find((g) => g.componente === 'MOTOR');
    expect(motor.tasaAlerta).toBeNull();
  });

  it('detecta una tasa alta de ALERTA seguida de falla real dentro de la ventana (60 días por defecto)', () => {
    const muestras = [
      ace({ estado: 'ALERTA', fecha: '2026-01-01' }), // seguida de falla 2026-01-20 (19 días)
      ace({ estado: 'ALERTA', fecha: '2026-02-01' }), // seguida de falla 2026-02-15 (14 días)
      ace({ estado: 'ALERTA', fecha: '2026-03-01' }), // seguida de falla 2026-03-10 (9 días)
      ace({ estado: 'ALERTA', fecha: '2026-04-01' }), // seguida de falla 2026-04-25 (24 días)
      ace({ estado: 'ALERTA', fecha: '2026-05-01' }), // SIN falla después
    ];
    const eventos = [
      correctivo({ fecha: '2026-01-20' }),
      correctivo({ fecha: '2026-02-15' }),
      correctivo({ fecha: '2026-03-10' }),
      correctivo({ fecha: '2026-04-25' }),
    ];
    const r = correlacionAceiteFallas(muestras, eventos);
    const motor = r.find((g) => g.componente === 'MOTOR');
    expect(motor.alertaTotal).toBe(5);
    expect(motor.alertaConFalla).toBe(4);
    expect(motor.tasaAlerta).toBe(80);
  });

  it('NO cuenta una falla fuera de la ventana de días como "anticipada"', () => {
    const muestras = [
      ace({ estado: 'ALERTA', fecha: '2026-01-01' }), ace({ estado: 'ALERTA', fecha: '2026-01-02' }),
      ace({ estado: 'ALERTA', fecha: '2026-01-03' }), ace({ estado: 'ALERTA', fecha: '2026-01-04' }),
      ace({ estado: 'ALERTA', fecha: '2026-01-05' }),
    ];
    const eventos = [correctivo({ fecha: '2026-06-01' })]; // muy lejos en el tiempo, no cuenta
    const r = correlacionAceiteFallas(muestras, eventos, 60);
    const motor = r.find((g) => g.componente === 'MOTOR');
    expect(motor.alertaConFalla).toBe(0);
    expect(motor.tasaAlerta).toBe(0);
  });

  it('NO cuenta una falla ANTERIOR a la muestra de aceite (solo mira hacia adelante)', () => {
    const muestras = [
      ace({ estado: 'ALERTA', fecha: '2026-02-01' }), ace({ estado: 'ALERTA', fecha: '2026-02-02' }),
      ace({ estado: 'ALERTA', fecha: '2026-02-03' }), ace({ estado: 'ALERTA', fecha: '2026-02-04' }),
      ace({ estado: 'ALERTA', fecha: '2026-02-05' }),
    ];
    const eventos = [correctivo({ fecha: '2026-01-01' })]; // antes de todas las muestras
    const r = correlacionAceiteFallas(muestras, eventos);
    const motor = r.find((g) => g.componente === 'MOTOR');
    expect(motor.alertaConFalla).toBe(0);
  });

  it('compara ALERTA vs NORMAL del mismo componente y calcula el lift', () => {
    const muestras = [
      // 5 ALERTA, todas seguidas de falla real
      ace({ estado: 'ALERTA', fecha: '2026-01-01' }), ace({ estado: 'ALERTA', fecha: '2026-01-02' }),
      ace({ estado: 'ALERTA', fecha: '2026-01-03' }), ace({ estado: 'ALERTA', fecha: '2026-01-04' }),
      ace({ estado: 'ALERTA', fecha: '2026-01-05' }),
      // 5 NORMAL, ninguna seguida de falla real
      ace({ estado: 'NORMAL', fecha: '2026-05-01' }), ace({ estado: 'NORMAL', fecha: '2026-05-02' }),
      ace({ estado: 'NORMAL', fecha: '2026-05-03' }), ace({ estado: 'NORMAL', fecha: '2026-05-04' }),
      ace({ estado: 'NORMAL', fecha: '2026-05-05' }),
    ];
    const eventos = [correctivo({ fecha: '2026-01-20' })]; // dentro de ventana de las ALERTA, lejos de las NORMAL
    const r = correlacionAceiteFallas(muestras, eventos);
    const motor = r.find((g) => g.componente === 'MOTOR');
    expect(motor.tasaAlerta).toBe(100);
    expect(motor.tasaNormal).toBe(0);
    expect(motor.lift).toBeNull(); // tasaNormal=0 -> lift indefinido, no se inventa un número (división por 0)
  });

  it('calcula lift>1 cuando ALERTA predice mejor que NORMAL (evidencia real de valor predictivo)', () => {
    // 4 ALERTA con un correctivo real a los pocos días (dentro de ventana) + 1 ALERTA lejos de cualquier evento
    const alertaConFalla = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'].map((f) => ace({ estado: 'ALERTA', fecha: f }));
    const alertaSinFalla = [ace({ estado: 'ALERTA', fecha: '2026-09-01' })]; // lejos de todo evento (>60 días)
    // 1 NORMAL con un correctivo real cerca + 4 NORMAL lejos de cualquier evento
    const normalConFalla = [ace({ estado: 'NORMAL', fecha: '2026-06-01' })];
    const normalSinFalla = ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'].map((f) => ace({ estado: 'NORMAL', fecha: f }));
    const muestras = [...alertaConFalla, ...alertaSinFalla, ...normalConFalla, ...normalSinFalla];
    const eventos = [
      correctivo({ fecha: '2026-01-10' }), correctivo({ fecha: '2026-01-11' }),
      correctivo({ fecha: '2026-01-12' }), correctivo({ fecha: '2026-01-13' }),
      correctivo({ fecha: '2026-06-05' }), // dentro de ventana de normalConFalla, lejos de normalSinFalla (sept)
    ];
    const r = correlacionAceiteFallas(muestras, eventos);
    const motor = r.find((g) => g.componente === 'MOTOR');
    expect(motor.tasaAlerta).toBe(80); // 4 de 5
    expect(motor.tasaNormal).toBe(20); // 1 de 5
    expect(motor.lift).toBe(4);
  });

  it('normaliza mayúsculas/tildes para cruzar descriptor (aceite) con componente (correctivos)', () => {
    const muestras = [
      ace({ descriptor: 'Transmisión', estado: 'ALERTA', fecha: '2026-01-01' }),
      ace({ descriptor: 'Transmisión', estado: 'ALERTA', fecha: '2026-01-02' }),
      ace({ descriptor: 'Transmisión', estado: 'ALERTA', fecha: '2026-01-03' }),
      ace({ descriptor: 'Transmisión', estado: 'ALERTA', fecha: '2026-01-04' }),
      ace({ descriptor: 'Transmisión', estado: 'ALERTA', fecha: '2026-01-05' }),
    ];
    const eventos = [correctivo({ componente: 'TRANSMISION', fecha: '2026-01-10' })];
    const r = correlacionAceiteFallas(muestras, eventos);
    const trans = r.find((g) => g.componente === 'TRANSMISION');
    expect(trans).toBeDefined();
    expect(trans.alertaConFalla).toBe(5); // el correctivo del 10-ene cae dentro de la ventana de las 5 muestras (1 al 5 de enero)
  });

  it('no mezcla equipos distintos (una falla en CN-2 no cuenta para una alerta de CN-1)', () => {
    const muestras = [
      ace({ _sigla: 'CN-1', estado: 'ALERTA', fecha: '2026-01-01' }),
      ace({ _sigla: 'CN-1', estado: 'ALERTA', fecha: '2026-01-02' }),
      ace({ _sigla: 'CN-1', estado: 'ALERTA', fecha: '2026-01-03' }),
      ace({ _sigla: 'CN-1', estado: 'ALERTA', fecha: '2026-01-04' }),
      ace({ _sigla: 'CN-1', estado: 'ALERTA', fecha: '2026-01-05' }),
    ];
    const eventos = [correctivo({ sigla: 'CN-2', fecha: '2026-01-10' })];
    const r = correlacionAceiteFallas(muestras, eventos);
    const motor = r.find((g) => g.componente === 'MOTOR');
    expect(motor.alertaConFalla).toBe(0);
  });

  it('ignora muestras sin sigla resuelta, sin descriptor, sin fecha o con estado desconocido', () => {
    const muestras = [
      ace({ _sigla: '', estado: 'ALERTA' }), ace({ descriptor: '', estado: 'ALERTA' }),
      ace({ fecha: '', estado: 'ALERTA' }), ace({ estado: 'DESCONOCIDO' }),
    ];
    const r = correlacionAceiteFallas(muestras, []);
    expect(r).toEqual([]);
  });

  it('array vacío sin datos', () => {
    expect(correlacionAceiteFallas([], [])).toEqual([]);
    expect(correlacionAceiteFallas(undefined, undefined)).toEqual([]);
  });

  it('no muta los arreglos originales (pura)', () => {
    const muestras = [ace({ estado: 'ALERTA' })];
    const eventos = [correctivo({})];
    const copiaM = muestras.map((m) => ({ ...m }));
    const copiaE = eventos.map((e) => ({ ...e }));
    correlacionAceiteFallas(muestras, eventos);
    expect(muestras).toEqual(copiaM);
    expect(eventos).toEqual(copiaE);
  });
});
