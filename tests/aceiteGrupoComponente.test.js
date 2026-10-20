import { describe, it, expect } from 'vitest';
import { aceiteOutliers, outliersMultivariadosAceite, correlacionAceiteFallas } from '../logic.js';

// En las muestras reales el campo 'descriptor' viene vacío y el tipo de componente está en 'componente'.
// Antes los detectores solo miraban 'descriptor' y no analizaban nada; ahora usan descriptor o, si falta, componente.
const base = (i, extra) => Object.assign({ _sigla: 'CN-1', fecha: '2026-01-' + String(1 + (i % 28)).padStart(2, '0'), descriptor: '', componente: 'MOTOR', estado: 'NORMAL',
  hierro: 10 + (i % 5), cobre: 5 + (i % 3), plomo: 3 + (i % 4), aluminio: 4 + (i % 2), silicio: 6 + (i % 3), cromo: 1 + (i % 2) }, extra || {});

describe('aceite: grupo por descriptor o, si está vacío, por componente', () => {
  it('aceiteOutliers marca un metal absurdo aunque el descriptor esté vacío', () => {
    const ace = Array.from({ length: 8 }, (_, i) => base(i));
    ace.push(base(9, { hierro: 900 }));
    const r = aceiteOutliers(ace);
    expect(r).toHaveLength(1);
    expect(r[0].metal).toBe('hierro');
  });
  it('outliersMultivariadosAceite analiza el grupo por componente', () => {
    let semilla = 12345;
    const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648; };
    const ace = Array.from({ length: 20 }, (_, i) => base(i, { hierro: 10 + azar() * 6, cobre: 5 + azar() * 4, plomo: 3 + azar() * 5, aluminio: 4 + azar() * 3, silicio: 6 + azar() * 4, cromo: 1 + azar() * 3 }));
    ace.push(base(30, { hierro: 60, cobre: 1, plomo: 40, aluminio: 1, silicio: 30, cromo: 20 }));
    const r = outliersMultivariadosAceite(ace);
    expect(r).toHaveLength(1);
    expect(r[0].descriptor).toBe('MOTOR');
    expect(r[0].n).toBe(21);
    expect(r[0].outliers.length).toBeGreaterThanOrEqual(1);
  });
  it('correlacionAceiteFallas cruza por el componente cuando no hay descriptor', () => {
    const ace = [base(1, { estado: 'ALERTA' })];
    const eventos = [{ sigla: 'CN-1', componente: 'Motor', fecha: '2026-02-01' }];
    const r = correlacionAceiteFallas(ace, eventos, 60);
    expect(r).not.toBeNull();
  });
});
