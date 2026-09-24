import { describe, it, expect } from 'vitest';
import { proyeccionElementosDesgaste, _subpiezasDeSintoma } from '../logic.js';

function ot(sigla, fecha, sintoma) {
  return { sigla, fecha, sintoma };
}
function eq(sigla, tipo) {
  return { sigla, tipo };
}

describe('_subpiezasDeSintoma', () => {
  it('reconoce cada pieza por su palabra clave, sin mezclarlas', () => {
    expect(_subpiezasDeSintoma('cambio de cuchilla')).toEqual(['Cuchilla']);
    expect(_subpiezasDeSintoma('CAMBIO CUCHILLO')).toEqual(['Cuchilla']);
    expect(_subpiezasDeSintoma('se cambia ripper')).toEqual(['Ripper']);
    expect(_subpiezasDeSintoma('cambio de cantonera')).toEqual(['Cantonera']);
    expect(_subpiezasDeSintoma('reposicion entrecalza')).toEqual(['Entrecalza']);
    expect(_subpiezasDeSintoma('cae entrediente')).toEqual(['Entrediente/GETS']);
    expect(_subpiezasDeSintoma('cambio de gets')).toEqual(['Entrediente/GETS']);
    expect(_subpiezasDeSintoma('canillera desgastada')).toEqual(['Canillera']);
    expect(_subpiezasDeSintoma('falta puntera')).toEqual(['Puntera']);
    expect(_subpiezasDeSintoma('cambio de zapata')).toEqual(['Zapata']);
    expect(_subpiezasDeSintoma('rodillo dañado')).toEqual(['Rodillo']);
    expect(_subpiezasDeSintoma('oruga suelta')).toEqual(['Oruga/Cadena']);
    expect(_subpiezasDeSintoma('cambio deslizadera')).toEqual(['Deslizadera']);
  });

  it('devuelve varias piezas si el síntoma menciona más de una', () => {
    expect(_subpiezasDeSintoma('cambio de cuchilla y cantonera')).toEqual(['Cuchilla', 'Cantonera']);
  });

  it('devuelve arreglo vacío si no hay ninguna coincidencia', () => {
    expect(_subpiezasDeSintoma('falla en motor')).toEqual([]);
    expect(_subpiezasDeSintoma('')).toEqual([]);
    expect(_subpiezasDeSintoma(undefined)).toEqual([]);
  });
});

describe('proyeccionElementosDesgaste', () => {
  it('array vacío sin correctivos ni equipos', () => {
    expect(proyeccionElementosDesgaste([], [])).toEqual([]);
    expect(proyeccionElementosDesgaste(undefined, undefined)).toEqual([]);
  });

  it('ignora eventos que no mencionan ninguna pieza de desgaste conocida', () => {
    const equipos = [eq('MN-1', 'Motoniveladora')];
    const correctivos = [
      ot('MN-1', '2026-01-05', 'falla en motor'),
      ot('MN-1', '2026-02-05', 'falla hidraulica'),
    ];
    expect(proyeccionElementosDesgaste(correctivos, equipos)).toEqual([]);
  });

  it('con menos de 3 meses de historial, lambda y consumo quedan null (sin inventar un promedio con ruido)', () => {
    const equipos = [eq('MN-1', 'Motoniveladora')];
    const correctivos = [
      ot('MN-1', '2026-01-05', 'desgaste cuchillas'),
      ot('MN-1', '2026-02-10', 'cambio de cuchillas'),
      ot('MN-1', '2026-02-15', 'cambio de cuchillas'),
    ];
    const r = proyeccionElementosDesgaste(correctivos, equipos);
    const fila = r.find((x) => x.tipo === 'Motoniveladora' && x.pieza === 'Cuchilla');
    expect(fila.lambda).toBeNull();
    expect(fila.consumoMes).toBeNull();
    expect(fila.consumoAnual).toBeNull();
    expect(fila.nMeses).toBe(2);
  });

  it('con menos de 3 eventos (aunque el rango de meses sea suficiente), lambda queda null', () => {
    const equipos = [eq('MN-1', 'Motoniveladora')];
    const correctivos = [
      ot('MN-1', '2026-01-05', 'desgaste cuchillas'),
      ot('MN-1', '2026-03-10', 'cambio de cuchillas'),
    ];
    const r = proyeccionElementosDesgaste(correctivos, equipos);
    const fila = r.find((x) => x.tipo === 'Motoniveladora' && x.pieza === 'Cuchilla');
    expect(fila.nMeses).toBe(3);
    expect(fila.nEventos).toBe(2);
    expect(fila.lambda).toBeNull();
  });

  it('calcula lambda real = eventos / meses de historial real de ESA pieza, y consumo SIEMPRE en número entero', () => {
    // 6 eventos de cuchillas en Motoniveladora repartidos en 3 meses reales
    // (ene, feb, marzo) -> lambda = 6/3 = 2/mes.
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
    const fila = r.find((x) => x.tipo === 'Motoniveladora' && x.pieza === 'Cuchilla');
    expect(fila.nEventos).toBe(6);
    expect(fila.nMeses).toBe(3);
    expect(fila.lambda).toBe(2);
    expect(fila.consumoMes).toBe(2);
    expect(fila.consumoSemestre).toBe(12);
    expect(fila.consumoAnual).toBe(24);
    expect(Number.isInteger(fila.consumoSemana)).toBe(true);
    expect(Number.isInteger(fila.consumoMes)).toBe(true);
    expect(Number.isInteger(fila.consumoSemestre)).toBe(true);
    expect(Number.isInteger(fila.consumoAnual)).toBe(true);
  });

  it('agrupa por TIPO + PIEZA sin mezclar piezas distintas del mismo equipo ni el mismo tipo de equipo entre sí', () => {
    const equipos = [eq('MN-1', 'Motoniveladora'), eq('CF-1', 'Cargador Frontal')];
    const correctivos = [
      ot('MN-1', '2026-01-05', 'desgaste cuchillas'),
      ot('MN-1', '2026-02-05', 'cambio cuchillas'),
      ot('MN-1', '2026-03-05', 'cambio cuchillas'),
      ot('MN-1', '2026-01-10', 'cambio cantonera'),
      ot('MN-1', '2026-02-10', 'cambio cantonera'),
      ot('MN-1', '2026-03-10', 'cambio cantonera'),
      ot('CF-1', '2026-01-05', 'cambio entrecalzas'),
      ot('CF-1', '2026-01-20', 'cae entrediente, se repone'),
      ot('CF-1', '2026-02-05', 'reposicion entrecalza'),
      ot('CF-1', '2026-03-05', 'cambio de gets'),
    ];
    const r = proyeccionElementosDesgaste(correctivos, equipos);
    const mnCuchilla = r.find((x) => x.tipo === 'Motoniveladora' && x.pieza === 'Cuchilla');
    const mnCantonera = r.find((x) => x.tipo === 'Motoniveladora' && x.pieza === 'Cantonera');
    const cfEntrecalza = r.find((x) => x.tipo === 'Cargador Frontal' && x.pieza === 'Entrecalza');
    const cfGets = r.find((x) => x.tipo === 'Cargador Frontal' && x.pieza === 'Entrediente/GETS');
    expect(mnCuchilla.nEventos).toBe(3);
    expect(mnCantonera.nEventos).toBe(3);
    expect(cfEntrecalza.nEventos).toBe(2);
    expect(cfGets.nEventos).toBe(2);
    expect(r.filter((x) => x.tipo === 'Motoniveladora' && x.pieza === 'Cuchilla')).toHaveLength(1);
  });

  it('un evento que menciona dos piezas a la vez cuenta en ambos grupos (misma OT, dos repuestos distintos)', () => {
    const equipos = [eq('BD-1', 'Bulldozer')];
    const correctivos = [
      ot('BD-1', '2026-01-05', 'cambio de cuchilla y cantonera'),
      ot('BD-1', '2026-02-05', 'cambio cuchilla'),
      ot('BD-1', '2026-03-05', 'cambio cuchilla'),
      ot('BD-1', '2026-04-05', 'cambio cantonera'),
      ot('BD-1', '2026-05-05', 'cambio cantonera'),
    ];
    const r = proyeccionElementosDesgaste(correctivos, equipos);
    const cuchilla = r.find((x) => x.pieza === 'Cuchilla');
    const cantonera = r.find((x) => x.pieza === 'Cantonera');
    expect(cuchilla.nEventos).toBe(3);
    expect(cantonera.nEventos).toBe(3);
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
      ot('CF-1', '2026-01-20', 'cambio entrecalzas'),
      ot('CF-1', '2026-02-05', 'cambio entrecalzas'),
      ot('CF-1', '2026-02-15', 'cambio entrecalzas'),
      ot('CF-1', '2026-03-05', 'cambio entrecalzas'),
    ];
    const r = proyeccionElementosDesgaste(correctivos, equipos);
    expect(r[0].tipo).toBe('Cargador Frontal');
    expect(r[0].pieza).toBe('Entrecalza');
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
