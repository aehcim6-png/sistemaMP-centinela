// Indicadores con las fórmulas del procedimiento corporativo PRO-MAN-010: MTTR, MTBF, MTBS y MA = MTBF ÷ (MTBF + MTTR) × 100.
import { describe, it, expect } from 'vitest';
import { kpiProMan010 } from '../logic.js';

const iso = (n) => new Date(Date.UTC(2026, 8, 1) + n * 864e5).toISOString().slice(0, 10);
// lecturas diarias de horómetro, 10 h por día, del 1-sep (día 0) al 31-oct (día 60)
const lecturas = (sigla, base) => Array.from({ length: 61 }, (_, d) => ({ sigla, fecha: iso(d), horom: base + d * 10 }));
// octubre = días 30 a 60: horas operadas en el mes = horómetro 31-oct − horómetro 30-sep = 31 × 10 = 310
const OCT = (dia) => `2026-10-${String(dia).padStart(2, '0')}`;

describe('kpiProMan010', () => {
  const eq = [{ sigla: 'A', tipo: 'Camión' }, { sigla: 'B', tipo: 'Cargador' }, { sigla: 'SIN', tipo: 'Camión' }];
  const hist = [].concat(lecturas('A', 1000), lecturas('B', 5000));
  const ot = [
    { sigla: 'A', tipo: 'Correctivo', fecha: OCT(3), duracion: '6h' },
    { sigla: 'A', tipo: 'Falla Operacional', fecha: OCT(10), duracion: '2h 30min' },
    { sigla: 'A', tipo: 'Correctivo', fecha: OCT(20) },                                   // falla sin duración: cuenta como falla, no inventa horas
    { sigla: 'A', tipo: 'Engrase General', fecha: OCT(5), duracion: '1h' },               // no es falla
    { sigla: 'A', tipo: 'Correctivo', fecha: '2026-09-15', duracion: '9h' },             // otro mes
  ];
  const reg = [{ equipo: 'A', fechaEntrada: OCT(12) }, { equipo: 'A', fechaEjec: OCT(25) }, { equipo: 'B', fechaEntrada: OCT(2) }, { equipo: 'A', fechaEntrada: '2026-09-01' }];

  it('aplica las fórmulas del procedimiento a cada equipo', () => {
    const r = kpiProMan010(eq, ot, reg, hist, '2026-10');
    const a = r.equipos.find((e) => e.sigla === 'A');
    expect(a.horas).toBe(310);
    expect(a.fallas).toBe(3);
    expect(a.sinDuracion).toBe(1);
    expect(a.horasReparacion).toBe(8.5);
    expect(a.mttr).toBe(4.3);              // 8,5 h ÷ 2 fallas con duración
    expect(a.mtbf).toBe(103.3);            // 310 ÷ 3
    expect(a.pm).toBe(2);
    expect(a.mtbs).toBe(62);               // 310 ÷ (3 fallas + 2 PM)
    expect(a.ma).toBe(96);                 // 103,33 ÷ (103,33 + 4,25) × 100
  });

  it('sin fallas: MTBF y MTTR vacíos, MA 100 y MTBS solo con las PM', () => {
    const b = kpiProMan010(eq, ot, reg, hist, '2026-10').equipos.find((e) => e.sigla === 'B');
    expect(b.fallas).toBe(0);
    expect(b.mtbf).toBeNull();
    expect(b.mttr).toBeNull();
    expect(b.ma).toBe(100);
    expect(b.sinFallas).toBe(true);
    expect(b.mtbs).toBe(310);
  });

  it('la flota suma horas, fallas y reparaciones antes de dividir (no promedia porcentajes)', () => {
    const f = kpiProMan010(eq, ot, reg, hist, '2026-10').flota;
    expect(f.equipos).toBe(2);
    expect(f.horas).toBe(620);
    expect(f.fallas).toBe(3);
    expect(f.mtbf).toBe(206.7);
    expect(f.mttr).toBe(4.3);
    expect(f.mtbs).toBe(103.3);           // 620 ÷ (3 + 3 PM)
    expect(f.ma).toBe(98);                // 206,67 ÷ (206,67 + 4,25)
  });

  it('el equipo sin horómetro en el mes queda aparte y no entra a la flota', () => {
    const r = kpiProMan010(eq, ot, reg, hist, '2026-10');
    expect(r.sinHorometro).toEqual(['SIN']);
    expect(r.equipos.map((e) => e.sigla)).toEqual(['A', 'B']);
  });

  it('fallas sin ninguna duración conocida: no hay MTTR y por lo tanto tampoco MA', () => {
    const r = kpiProMan010([{ sigla: 'A' }], [{ sigla: 'A', tipo: 'Correctivo', fecha: OCT(4) }], [], hist, '2026-10');
    expect(r.equipos[0].mttr).toBeNull();
    expect(r.equipos[0].ma).toBeNull();
  });

  it('cuenta la salida de servicio grave como falla, pero no la que no es falla real', () => {
    const fs = [
      { sigla: 'A', tipo: 'Fuera de Servicio', criticidad: 'Reparación Inmediata', fecha: OCT(8), duracion: '30h' },
      { sigla: 'A', tipo: 'Fuera de Servicio', criticidad: 'Sin repuesto', fecha: OCT(9), duracion: '50h' },
    ];
    const a = kpiProMan010([{ sigla: 'A' }], fs, [], hist, '2026-10').equipos[0];
    expect(a.fallas).toBe(1);
    expect(a.mttr).toBe(30);
  });

  it('mes inválido devuelve null; mes sin horómetro deja la flota en null', () => {
    expect(kpiProMan010(eq, ot, reg, hist, 'oct')).toBeNull();
    expect(kpiProMan010(eq, ot, reg, hist, '2027-03').flota).toBeNull();
  });
});
