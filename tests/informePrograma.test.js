import { describe, it, expect } from 'vitest';
import { informeProgramaSemanal, informeBacklogPM, backlogDesdePM } from '../logic.js';

// Secciones I (certeza de programa) y II (cumplimiento de programa) del informe del cliente, reconstruidas con el historial de horómetros y los PM registrados.
const dia = (n) => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10); // n = 0 → 2026-01-01
// lecturas diarias entre 01-01 y 03-01; h(d) = base + ritmo·d (ritmo 0 = equipo parado)
const hist = (sigla, base, ritmo) => Array.from({ length: 60 }, (_, d) => ({ sigla, fecha: dia(d), horom: base + ritmo * d, horomFin: base + ritmo * d }));
const eq = (sigla) => ({ sigla, modelo: 'Komatsu HD785-7', frecPM: 250, hrsDia: 10 });
const pm = (equipo, horomReal, fechaEntrada) => ({ equipo, horomReal, fechaEntrada, tipoPM: 'PM1' });
// semana del 1 al 7 de febrero (día 31 = 01-Feb): al cierre del 31 de enero el horómetro de A, B y C es 450
const desde = '2026-02-01', hasta = '2026-02-07', hoy = '2026-03-01';

describe('informeProgramaSemanal — certeza y cumplimiento de programa', () => {
  const equipos = ['A', 'B', 'C', 'D', 'E'].map(eq);
  const h = [
    ...hist('A', 150, 10), // llega a 500 el 5 de febrero
    ...hist('B', 450 - 300, 0).map((x, i) => Object.assign(x, { horom: i < 31 ? 150 + 10 * i : 450, horomFin: i < 31 ? 150 + 10 * i : 450 })), // sube hasta 450 y después se queda parado
    ...hist('C', 150, 10),
    ...hist('E', 220, 10), // hIni (31-ene) = 520: el hito de 500 h ya estaba vencido
  ];
  const reg = [pm('A', 501, '2026-02-05'), pm('E', 250, '2026-01-10')];
  const r = informeProgramaSemanal(equipos, reg, h, desde, hasta, hoy);
  const f = (sigla) => r.filas.filter((x) => x.sigla === sigla);

  it('un equipo programado que llegó a sus horas y se ejecutó cuenta en certeza y en cumplimiento', () => {
    expect(f('A')[0]).toMatchObject({ hito: 500, tipoPM: 'PM2', programado: true, alcanzado: true, ejecutado: true });
  });
  it('un equipo parado (su horómetro no avanzó) baja la certeza, no es un atraso', () => {
    expect(f('B')[0]).toMatchObject({ hito: 500, programado: true, alcanzado: false, ejecutado: false });
  });
  it('un equipo que llegó a sus horas y no se ejecutó baja el cumplimiento', () => {
    expect(f('C')[0]).toMatchObject({ hito: 500, programado: true, alcanzado: true, ejecutado: false });
  });
  it('un hito ya vencido al empezar el período es arrastre y no entra a los porcentajes', () => {
    expect(f('E')[0]).toMatchObject({ hito: 500, arrastre: true });
  });
  it('un equipo sin lecturas de horómetro cercanas no se evalúa, no se inventa', () => {
    expect(r.sinHorometro).toEqual(['D']);
    expect(f('D')).toEqual([]);
  });
  it('los porcentajes: certeza = programados que llegaron ÷ programados; cumplimiento = alcanzados ejecutados ÷ alcanzados', () => {
    expect(r.resumen).toMatchObject({ programados: 3, programadosCumplieron: 2, certeza: 67, alcanzados: 2, ejecutados: 1, cumplimiento: 50, arrastrados: 1, sinHorometro: 1, metaCerteza: 85, metaCumplimiento: 100 });
  });
  it('sin equipos programados no inventa porcentajes', () => {
    const v = informeProgramaSemanal([eq('A')], [], hist('A', 150, 10), '2026-02-20', '2026-02-26', hoy);
    expect(v.resumen.programados).toBe(0);
    expect(v.resumen.certeza).toBeNull();
  });
});

describe('informeBacklogPM — backlog de pautas (sección V)', () => {
  const equipos = [{ sigla: 'CF-1', modelo: 'Komatsu WA900-8R', horomActual: 12888 }, { sigla: 'GE-1', modelo: 'JCB 20 KVA', horomActual: 8065 }];
  const items = [
    { id: 'b1', sigla: 'CF-1', fecha: '2025-10-27', horomBacklog: 12503, tarea: 'Cambio de filtro de combustible', sistema: 'Motor', conInsumo: true },
    { id: 'b2', sigla: 'GE-1', fecha: '2025-10-23', horomBacklog: 6298, tarea: 'Muestreo de aceite', sistema: 'Motor', conInsumo: false },
    { id: 'b3', sigla: 'GE-1', fecha: '2025-11-02', horomBacklog: 6400, tarea: 'Revisión eléctrica', sistema: 'Eléctrico', fechaCierre: '2025-12-01' },
    { id: 'b4', sigla: 'CF-1', fecha: '2026-02-01', horomBacklog: 12800, tarea: 'Futuro', sistema: 'Motor' },
  ];
  it('las horas pendientes son el horómetro actual menos el del día en que quedó pendiente, y se ordenan de más a menos', () => {
    const r = informeBacklogPM(items, equipos, '2026-01-07');
    expect(r.abiertos.map((b) => [b.id, b.horasPendientes])).toEqual([['b2', 1767], ['b1', 385]]);
  });
  it('el cumplimiento de cierre es cerrados ÷ total a la fecha, con y sin insumo entre los abiertos', () => {
    const r = informeBacklogPM(items, equipos, '2026-01-07');
    expect(r.resumen).toEqual({ total: 3, cerrados: 1, pendientes: 2, pctCierre: 33, conInsumo: 1, sinInsumo: 1 });
  });
  it('a una fecha anterior al cierre la tarea aún estaba abierta; las posteriores a la fecha no cuentan', () => {
    expect(informeBacklogPM(items, equipos, '2025-11-20').resumen).toMatchObject({ total: 3, cerrados: 0, pendientes: 3 });
    expect(informeBacklogPM(items, equipos, '2025-10-25').resumen.total).toBe(1);
  });
  it('sin tareas no inventa porcentaje', () => {
    expect(informeBacklogPM([], equipos, '2026-01-07').resumen.pctCierre).toBeNull();
  });
});

describe('backlogDesdePM — un PM incompleto genera su tarea pendiente', () => {
  it('con pmCompleto=false y texto, devuelve la tarea con el horómetro del PM', () => {
    expect(backlogDesdePM({ equipo: 'CF-1', pmCompleto: false, queFalto: ' Filtro de combustible ', fechaEntrada: '2026-01-05', horomReal: 12503, tipoPM: 'PM1', nReg: 7 }))
      .toMatchObject({ sigla: 'CF-1', fecha: '2026-01-05', horomBacklog: 12503, tarea: 'Filtro de combustible', conInsumo: false, fechaCierre: null });
  });
  it('PM completo, sin dato o sin texto no genera nada', () => {
    expect(backlogDesdePM({ equipo: 'A', pmCompleto: true, queFalto: '' })).toBeNull();
    expect(backlogDesdePM({ equipo: 'A', pmCompleto: null })).toBeNull();
    expect(backlogDesdePM({ equipo: 'A', pmCompleto: false, queFalto: '  ' })).toBeNull();
    expect(backlogDesdePM(null)).toBeNull();
  });
});
