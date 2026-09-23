import { describe, it, expect } from 'vitest';
import { proyeccionElementosDesgaste } from '../logic.js';

function ot(sigla, fecha, sintoma) {
  return { sigla, fecha, sintoma };
}
function eq(sigla, tipo) {
  return { sigla, tipo };
}

describe('proyeccionElementosDesgaste', () => {
  it('array vacío sin correctivos ni equipos', () => {
    expect(proyeccionElementosDesgaste([], [])).toEqual([]);
    expect(proyeccionElementosDesgaste(undefined, undefined)).toEqual([]);
  });

  it('ignora eventos que no clasifican como GET / Cuchillas', () => {
    const equipos = [eq('MN-1', 'Motoniveladora')];
    const correctivos = [
      ot('MN-1', '2026-01-05', 'falla en motor'),
      ot('MN-1', '2026-02-05', 'falla hidraulica'),
    ];
    expect(proyeccionElementosDesgaste(correctivos, equipos)).toEqual([]);
  });

  it('con menos de 3 meses de historial para ese tipo, lambda queda null (sin inventar un promedio con ruido)', () => {
    const equipos = [eq('MN-1', 'Motoniveladora')];
    const correctivos = [
      ot('MN-1', '2026-01-05', 'desgaste cuchillas'),
      ot('MN-1', '2026-02-10', 'cambio de cuchillas'),
    ];
    const r = proyeccionElementosDesgaste(correctivos, equipos);
    const mn = r.find((x) => x.tipo === 'Motoniveladora');
    expect(mn.lambda).toBeNull();
    expect(mn.proyeccionSemestre).toBeNull();
    expect(mn.nMeses).toBe(2);
  });

  it('calcula lambda real = eventos / meses de historial real de ESE tipo, y proyecta semestre/año', () => {
    // 6 eventos de cuchillas en Motoniveladora repartidos en 3 meses reales
    // (ene, feb inclusive hasta marzo) -> lambda = 6/3 = 2/mes.
    const equipos = [eq('MN-1', 'Motoniveladora'), eq('MN-2', 'Motoniveladora')];
    const correctivos = [
      ot('MN-1', '2026-01-05', 'Desgaste cuchillas'),
      ot('MN-2', '2026-01-20', 'cambio de cuchillas'),
      ot('MN-1', '2026-02-05', 'Desgaste de cuchillas'),
      ot('MN-2', '2026-02-20', 'CAMBIO CUCHILLAS'),
      ot('MN-1', '2026-03-01', 'cambio de cuchilla'),
      ot('MN-2', '2026-03-15', 'se cambia juego de cuchillas'),
    ];
    const r = proyeccionElementosDesgaste(correctivos, equipos);
    const mn = r.find((x) => x.tipo === 'Motoniveladora');
    expect(mn.nEventos).toBe(6);
    expect(mn.nMeses).toBe(3);
    expect(mn.lambda).toBe(2);
    expect(mn.proyeccionSemestre).toBe(12);
    expect(mn.proyeccionAnual).toBe(24);
  });

  it('agrupa por tipo de equipo sin mezclar Motoniveladora con Cargador Frontal, aunque caigan en la misma categoría de componente', () => {
    const equipos = [eq('MN-1', 'Motoniveladora'), eq('CF-1', 'Cargador Frontal')];
    const correctivos = [
      ot('MN-1', '2026-01-05', 'desgaste cuchillas'),
      ot('MN-1', '2026-02-05', 'cambio cuchillas'),
      ot('MN-1', '2026-03-05', 'cambio cuchillas'),
      ot('CF-1', '2026-01-05', 'cambio entrecalzas'),
      ot('CF-1', '2026-01-20', 'cae entrediente, se repone'),
      ot('CF-1', '2026-02-05', 'reposicion entrecalza'),
      ot('CF-1', '2026-03-05', 'cambio de gets'),
    ];
    const r = proyeccionElementosDesgaste(correctivos, equipos);
    const mn = r.find((x) => x.tipo === 'Motoniveladora');
    const cf = r.find((x) => x.tipo === 'Cargador Frontal');
    expect(mn.nEventos).toBe(3);
    expect(cf.nEventos).toBe(4);
    expect(mn.lambda).not.toBe(cf.lambda);
  });

  it('ignora eventos de equipos sin tipo cargado en la ficha (nunca inventa un tipo)', () => {
    const equipos = [eq('MN-1', '')];
    const correctivos = [
      ot('MN-1', '2026-01-05', 'desgaste cuchillas'),
      ot('MN-1', '2026-02-05', 'cambio cuchillas'),
      ot('MN-1', '2026-03-05', 'cambio cuchillas'),
    ];
    expect(proyeccionElementosDesgaste(correctivos, equipos)).toEqual([]);
  });

  it('ignora eventos de siglas que no existen en la ficha de equipos', () => {
    const equipos = [eq('MN-1', 'Motoniveladora')];
    const correctivos = [
      ot('MN-FANTASMA', '2026-01-05', 'desgaste cuchillas'),
      ot('MN-FANTASMA', '2026-02-05', 'cambio cuchillas'),
      ot('MN-FANTASMA', '2026-03-05', 'cambio cuchillas'),
    ];
    expect(proyeccionElementosDesgaste(correctivos, equipos)).toEqual([]);
  });

  it('ordena de mayor a menor lambda', () => {
    const equipos = [eq('MN-1', 'Motoniveladora'), eq('CF-1', 'Cargador Frontal')];
    const correctivos = [
      ot('MN-1', '2026-01-05', 'desgaste cuchillas'),
      ot('MN-1', '2026-02-05', 'cambio cuchillas'),
      ot('MN-1', '2026-03-05', 'cambio cuchillas'),
      ot('CF-1', '2026-01-05', 'cambio entrecalzas'),
      ot('CF-1', '2026-01-10', 'cambio entrecalzas'),
      ot('CF-1', '2026-01-20', 'cae entrediente'),
      ot('CF-1', '2026-02-05', 'reposicion entrecalza'),
      ot('CF-1', '2026-02-15', 'cambio de gets'),
      ot('CF-1', '2026-03-05', 'cambio de gets'),
    ];
    const r = proyeccionElementosDesgaste(correctivos, equipos);
    expect(r[0].tipo).toBe('Cargador Frontal');
    expect(r[0].lambda).toBeGreaterThan(r[1].lambda);
  });

  it('no muta los arreglos originales (pura)', () => {
    const equipos = [eq('MN-1', 'Motoniveladora')];
    const correctivos = [
      ot('MN-1', '2026-01-05', 'desgaste cuchillas'),
      ot('MN-1', '2026-02-05', 'cambio cuchillas'),
      ot('MN-1', '2026-03-05', 'cambio cuchillas'),
    ];
    const copiaEq = equipos.map((e) => ({ ...e }));
    const copiaOt = correctivos.map((c) => ({ ...c }));
    proyeccionElementosDesgaste(correctivos, equipos);
    expect(equipos).toEqual(copiaEq);
    expect(correctivos).toEqual(copiaOt);
  });
});
