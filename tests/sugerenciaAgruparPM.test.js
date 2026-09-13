import { describe, it, expect } from 'vitest';
import { sugerenciaAgruparPM } from '../logic.js';

describe('sugerenciaAgruparPM', () => {
  it('null sin equipo', () => {
    expect(sugerenciaAgruparPM(null)).toBeNull();
    expect(sugerenciaAgruparPM(undefined)).toBeNull();
  });

  it('sugiere agrupar cuando faltan pocos días para el PM (dentro del umbral de 7 por defecto)', () => {
    const r = sugerenciaAgruparPM({ tipoPM: 'PM2', diasParaPM: 3, hrsRestantes: 200, fechaProxPM: '2026-09-20' });
    expect(r).not.toBeNull();
    expect(r.tipoPM).toBe('PM2');
    expect(r.diasParaPM).toBe(3);
  });

  it('sugiere agrupar cuando faltan pocas horas (dentro del umbral de 48 por defecto), aunque falten muchos días', () => {
    const r = sugerenciaAgruparPM({ tipoPM: 'PM1', diasParaPM: 20, hrsRestantes: 30, fechaProxPM: '2026-10-10' });
    expect(r).not.toBeNull();
  });

  it('NO sugiere nada cuando el PM está lejos por ambos criterios', () => {
    const r = sugerenciaAgruparPM({ tipoPM: 'PM1', diasParaPM: 30, hrsRestantes: 400, fechaProxPM: '2026-11-01' });
    expect(r).toBeNull();
  });

  it('marca vencido:true cuando el PM ya está atrasado (días u horas negativas) — más razón todavía para agruparlo', () => {
    const r = sugerenciaAgruparPM({ tipoPM: 'PM3', diasParaPM: -2, hrsRestantes: -10, fechaProxPM: '2026-09-01' });
    expect(r).not.toBeNull();
    expect(r.vencido).toBe(true);
  });

  it('vencido:false cuando está cerca pero todavía no vencido', () => {
    const r = sugerenciaAgruparPM({ tipoPM: 'PM1', diasParaPM: 2, hrsRestantes: 20, fechaProxPM: '2026-09-15' });
    expect(r.vencido).toBe(false);
  });

  it('respeta umbrales personalizados', () => {
    const equipo = { tipoPM: 'PM1', diasParaPM: 10, hrsRestantes: 100, fechaProxPM: '2026-10-01' };
    expect(sugerenciaAgruparPM(equipo)).toBeNull(); // fuera del umbral por defecto
    expect(sugerenciaAgruparPM(equipo, 15, 48)).not.toBeNull(); // umbral de días más amplio
  });

  it('no considera "cerca" un equipo sin diasParaPM ni hrsRestantes calculados (datos ausentes, no cero)', () => {
    const r = sugerenciaAgruparPM({ tipoPM: 'PM1', fechaProxPM: null });
    expect(r).toBeNull();
  });
});
