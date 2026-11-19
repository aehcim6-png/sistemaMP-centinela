import { describe, it, expect } from 'vitest';
import { emparejarPautaTiempos } from '../logic.js';

// Pautas: cada actividad de la tabla `pautas` busca sus minutos en `pautas_tiempos` (PDF «Pauta Mantencion»), que escribe la misma tarea con otras palabras.
const tiempos = [
  { seccion: 'PM 1', act: 'Revisar alternador', topeHoras: 250, minutos: 10 },
  { seccion: 'PM 1', act: 'Cambio de Filtro Aire Motor', topeHoras: 250, minutos: 10 },
  { seccion: 'PM 1', act: 'Cambio de Filtro Aire secundario', topeHoras: 250, minutos: 0 },
  { seccion: 'PM 2', act: 'Cambio de filtro aceite Motor.', topeHoras: 500, minutos: 10 },
  { seccion: 'PM 2', act: 'Cambio, Prefiltro de combustible', topeHoras: 500, minutos: 10 },
  { seccion: 'PM 2', act: 'Cambio de Filtro de Combustible', topeHoras: 500, minutos: 15 },
  { seccion: 'PM 1', act: 'Revisar Niveles de lubricantes y refrigerante', topeHoras: 250, minutos: 10 },
  { seccion: 'PM 1', act: 'Revisar filtros de aire cabina', topeHoras: 250, minutos: 12 },
];
const f = (pm, cat, act, hrs) => ({ pm, cat, act, hrs });

describe('emparejarPautaTiempos', () => {
  it('une una actividad con su tarea del PDF aunque cambien las palabras (categoría + actividad contra «Revisar …»)', () => {
    const r = emparejarPautaTiempos([f('PM1', 'REVISAR', 'Alternador', 250)], tiempos);
    expect(r[0]).toMatchObject({ minutos: 10, tarea: 'Revisar alternador' });
  });
  it('tolera una falta de ortografía de la pauta («refrigerane»)', () => {
    const r = emparejarPautaTiempos([f('PM1', 'REVISAR', 'Niveles de lubricantes y refrigerane', 250)], tiempos);
    expect(r[0].tarea).toBe('Revisar Niveles de lubricantes y refrigerante');
  });
  it('distingue por la palabra rara: «secundario» no se confunde con «motor», «prefiltro» no se confunde con «filtro»', () => {
    const r = emparejarPautaTiempos([f('PM2', 'CAMBIO DE FILTRO', 'Filtro aire secundario motor', 500), f('PM2', 'CAMBIO DE FILTRO', 'Prefiltro combustible', 500)], tiempos);
    expect(r[0]).toMatchObject({ tarea: 'Cambio de Filtro Aire secundario', minutos: 0 });
    expect(r[1]).toMatchObject({ tarea: 'Cambio, Prefiltro de combustible', minutos: 10 });
  });
  it('si la actividad dice cambiar y la tarea dice revisar, no son la misma: sin minutos antes que minutos inventados', () => {
    const r = emparejarPautaTiempos([f('PM3', 'CAMBIO DE FILTRO', 'Filtro aire cabina', 1000)], tiempos);
    expect(r[0]).toBeNull();
  });
  it('un texto sin parecido queda sin minutos', () => {
    expect(emparejarPautaTiempos([f('PM1', 'REVISAR', 'Juego de valvulas', 250)], tiempos)[0]).toBeNull();
  });
  it('desempata con el texto exacto y la frecuencia: «Motor .» (cambio, 500 h) y «Motor ...» (muestreo, 250 h)', () => {
    const t = [
      { seccion: null, act: 'Motor .', topeHoras: 500, minutos: 60 },
      { seccion: null, act: 'Motor ...', topeHoras: 250, minutos: 5 },
    ];
    const r = emparejarPautaTiempos([f('PM2', 'CAMBIO DE ACEITE', 'Motor', 500), f('PM1', 'MUESTREO ACEITE', 'Motor ...', 250)], t);
    expect(r[0].minutos).toBe(60);
    expect(r[1].minutos).toBe(5);
  });
  it('sin tareas o sin filas no falla', () => {
    expect(emparejarPautaTiempos([f('PM1', 'REVISAR', 'Alternador', 250)], [])).toEqual([null]);
    expect(emparejarPautaTiempos([], tiempos)).toEqual([]);
    expect(emparejarPautaTiempos(null, null)).toEqual([]);
  });
});
