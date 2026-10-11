// Programa de cambio de neumáticos: agrupa las fechas ya proyectadas por semana/mes/semestre/año, ancla la fecha en la última medición, separa vencidos y arma la curva S (avance real + proyección).
import { describe, it, expect } from 'vitest';
const L = require('../logic.js');

const hoy = '2026-10-14'; // miércoles; semana 12-oct al 18-oct; mes oct; 2.º semestre
const neu = (sigla, base, dias, extra) => Object.assign({ sigla, posicion: 'P1', serie: 'S' + sigla, base, dias, precio: 1000, motivo: 'remanente 10mm', confianza: 'Alta (4 mediciones)' }, extra || {});

describe('neuProgramaCambios', () => {
  it('ancla la fecha en la última medición (no en hoy)', () => {
    const r = L.neuProgramaCambios([neu('A', '2026-09-14', 60)], [], { hoy, periodo: 'semestre' });
    const x = r.pendientes[0];
    expect(x.fechaCambio).toBe('2026-11-13');
    expect(x.diasMedicion).toBe(30);
    expect(L.neuProgramaCambios([neu('A', '2026-09-14', 60)], [], { hoy, periodo: 'mes' }).totales.pendientes).toBe(0);   // cae en noviembre, no en octubre
  });
  it('separa vencidos: la fecha ya pasó y el neumático sigue sin cambiarse', () => {
    const r = L.neuProgramaCambios([neu('A', '2026-07-27', 40), neu('B', '2026-10-01', 20)], [], { hoy, periodo: 'mes' });
    expect(r.vencidos.map((x) => x.sigla)).toEqual(['A']);   // 27-jul + 40 d = 5-sep
    expect(r.vencidos[0].fechaCambio).toBe('2026-09-05');
    expect(r.vencidos[0].medicionVieja).toBe(true);
    expect(r.pendientes.map((x) => x.sigla)).toEqual(['B']); // 21-oct
    expect(r.totales.vencidos).toBe(1);
  });
  it('agrupa por semana, mes, semestre y año', () => {
    const items = [neu('A', '2026-10-14', 2), neu('B', '2026-10-14', 10), neu('C', '2026-10-14', 40), neu('D', '2026-10-14', 100), neu('E', '2027-01-10', 30)];
    const sem = L.neuProgramaCambios(items, [], { hoy, periodo: 'semana' });
    expect(sem.totales.pendientes).toBe(1);
    expect(sem.subperiodos.length).toBe(7);
    const mes = L.neuProgramaCambios(items, [], { hoy, periodo: 'mes' });
    expect(mes.totales.pendientes).toBe(2);                    // A (16-oct) y B (24-oct)
    expect(mes.subperiodos.reduce((t, s) => t + s.proyectados, 0)).toBe(2);
    const s2 = L.neuProgramaCambios(items, [], { hoy, periodo: 'semestre' });
    expect(s2.totales.pendientes).toBe(3);                     // hasta 31-dic: A, B y C (23-nov); D (22-ene) y E quedan fuera
    const anio = L.neuProgramaCambios(items, [], { hoy, periodo: 'anio' });
    expect(anio.subperiodos.length).toBe(12);
    expect(anio.totales.pendientes).toBe(3);
  });
  it('un período futuro no incluye hoy: la curva parte en 0 y se informa el arrastre', () => {
    const items = [neu('A', '2026-10-14', 5), neu('B', '2026-10-14', 40), neu('V', '2026-08-01', 10)];
    const r = L.neuProgramaCambios(items, [], { hoy, periodo: 'mes', ref: '2026-11-10' });
    expect(r.futuro).toBe(true);
    expect(r.totales.arrastre).toBe(2);       // V (vencido) y A (19-oct) vencen antes de noviembre
    expect(r.totales.pendientes).toBe(1);     // B (23-nov)
    expect(r.curva[0].proyeccion).toBe(0);
    expect(r.curva[r.curva.length - 1].proyeccion).toBe(1);
    expect(r.curva.every((d) => d.real === null)).toBe(true);
  });
  it('curva S del período actual: real hasta hoy y proyección desde el nivel real + vencidos', () => {
    const items = [neu('V', '2026-08-01', 10), neu('A', '2026-10-14', 5), neu('B', '2026-10-14', 12)];
    const reales = ['2026-10-02', '2026-10-09', '2026-09-30'];
    const r = L.neuProgramaCambios(items, reales, { hoy, periodo: 'mes' });
    expect(r.totales.reales).toBe(2);         // el de septiembre queda fuera del mes
    const dHoy = r.curva.find((d) => d.fecha === hoy);
    expect(dHoy.real).toBe(2);
    expect(dHoy.proyeccion).toBe(3);          // 2 reales + 1 vencido a cambiar ya
    const fin = r.curva[r.curva.length - 1];
    expect(fin.proyeccion).toBe(5);           // + A (19-oct) y B (26-oct)
    expect(r.totales.proyectadoTotal).toBe(5);
    expect(r.curva[0].proyeccion).toBeNull();
    expect(fin.real).toBeNull();
    // monótona
    const ys = r.curva.map((d) => d.proyeccion).filter((v) => v != null);
    ys.forEach((v, k) => { if (k) expect(v).toBeGreaterThanOrEqual(ys[k - 1]); });
  });
  it('suma costos de pendientes y vencidos', () => {
    const r = L.neuProgramaCambios([neu('V', '2026-08-01', 10, { precio: 500 }), neu('A', '2026-10-14', 5, { precio: 700 })], [], { hoy, periodo: 'mes' });
    expect(r.totales.costoPendiente).toBe(700);
    expect(r.totales.costoVencidos).toBe(500);
  });
  it('sin base de medición usa hoy y descarta días no numéricos', () => {
    const r = L.neuProgramaCambios([neu('A', null, 3), neu('B', '2026-10-14', NaN)], [], { hoy, periodo: 'semana' });
    expect(r.pendientes.length).toBe(1);
    expect(r.pendientes[0].fechaCambio).toBe('2026-10-17');
    expect(r.pendientes[0].diasMedicion).toBeNull();
  });
  it('el período pasado solo muestra lo realizado', () => {
    const r = L.neuProgramaCambios([neu('A', '2026-10-14', 5)], ['2026-09-10', '2026-09-20'], { hoy, periodo: 'mes', ref: '2026-09-15' });
    expect(r.totales.reales).toBe(2);
    expect(r.totales.pendientes).toBe(0);
    expect(r.curva[r.curva.length - 1].real).toBe(2);
    expect(r.curva.every((d) => d.proyeccion === null)).toBe(true);
  });
});

describe('neuCambiosRealizados', () => {
  it('cuenta cada cambio una vez aunque la posición esté escrita distinto o la carga venga repetida', () => {
    const h = [
      { sigla: 'CN-1', posicion: '1', fecha: '2026-05-10' },
      { sigla: 'CN-1', posicion: 'Posicion 1', fecha: '2026-05-10' },     // misma posición y fecha: repetido
      { sigla: 'CN-1', posicion: 'Posición 1', fecha: '2026-05-10' },
      { sigla: 'CN-1', posicion: 'Pos. 2', fecha: '2026-05-10' },        // otra posición el mismo día: otro cambio
      { sigla: 'CN-1', posicion: 'Posicion 1', fecha: '2025-03-10' },
      { sigla: 'CN-2', posicion: null, fecha: '2026-06-01' },             // sin posición: no se puede deduplicar
      { sigla: 'CN-2', posicion: null, fecha: '2026-06-01' },
      { sigla: 'CN-3', posicion: '1', fecha: '' }                         // sin fecha: se ignora
    ];
    expect(L.neuCambiosRealizados(h)).toEqual(['2025-03-10', '2026-05-10', '2026-05-10', '2026-06-01', '2026-06-01']);
  });
});
