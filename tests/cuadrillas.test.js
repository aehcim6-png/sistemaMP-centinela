// Cuadrillas de taller: qué cuadrilla es de cada técnico y cómo se ven lado a lado (29-oct-2026).
import { describe, it, expect } from 'vitest';
import { CUADRILLAS_TALLER, cuadrillaDeTecnico, cuadrillaEtiqueta, gerCuadrillas, panelGerencia } from '../logic.js';

const HOY = '2026-10-29';
const ot = (tecnico, duracion, extra) => ({ sigla: 'CN-1', tipo: 'Correctivo', estadoOT: 'Cerrada', fechaEntrada: '2026-08-02', tecnico, duracion, ...extra });
const pm = (tecnico, duracionH, obs) => ({ equipo: 'CN-1', tipoPM: 'PM1', tecnico, duracionH, obs });

describe('cuadrillaDeTecnico', () => {
  it('reconoce a cada técnico y jefe en su cuadrilla, con o sin tildes y con los nombres que ya tenía la lista', () => {
    expect(cuadrillaDeTecnico('Carlos Trigo')).toBe('yanez');
    expect(cuadrillaDeTecnico('maicol orostegui')).toBe('yanez');
    expect(cuadrillaDeTecnico('Jonathan Lara Yañez')).toBe('yanez');
    expect(cuadrillaDeTecnico('Danilo Yáñes Ávila')).toBe('yanez');
    expect(cuadrillaDeTecnico('Jonathan Bolados')).toBe('cardenas');
    expect(cuadrillaDeTecnico('Carlos Inzunza')).toBe('cardenas');
    expect(cuadrillaDeTecnico('Camilo Santander')).toBe('cardenas');
    expect(cuadrillaDeTecnico('Javier Cardenas')).toBe('cardenas');
    expect(cuadrillaDeTecnico('Juan Michea Veas')).toBe('cardenas');
  });
  it('un nombre que comparte solo el nombre de pila no es de la cuadrilla (Carlos Trigo ≠ Carlos Inzunza, Jonathan Lara ≠ Jonathan Bolados)', () => {
    expect(cuadrillaDeTecnico('Carlos Pérez')).toBeNull();
    expect(cuadrillaDeTecnico('Jonathan Pérez')).toBeNull();
    expect(cuadrillaDeTecnico('Carlos')).toBeNull();
  });
  it('varios nombres: la misma cuadrilla la asigna; de las dos es «mixta»; con uno desconocido no se asigna', () => {
    expect(cuadrillaDeTecnico('Carlos Inzunza y Jonathan Bolados')).toBe('cardenas');
    expect(cuadrillaDeTecnico('Carlos Inzunza / Camilo Santander')).toBe('cardenas');
    expect(cuadrillaDeTecnico('Maicol Orostegui y Camilo Santander')).toBe('mixta');
    expect(cuadrillaDeTecnico('Carlos Trigo / Robinson')).toBeNull();
    expect(cuadrillaDeTecnico('')).toBeNull();
    expect(cuadrillaDeTecnico(null)).toBeNull();
  });
  it('la etiqueta es el nombre de la cuadrilla, «Cuadrillas mixtas» o nada', () => {
    expect(cuadrillaEtiqueta('Carlos Trigo')).toBe('Cuadrilla Yáñez');
    expect(cuadrillaEtiqueta('Camilo Santander')).toBe('Cuadrilla Cárdenas');
    expect(cuadrillaEtiqueta('Maicol Orostegui y Camilo Santander')).toBe('Cuadrillas mixtas');
    expect(cuadrillaEtiqueta('Robinson')).toBe('');
  });
  it('ninguna persona está en las dos cuadrillas', () => {
    const todos = CUADRILLAS_TALLER.flatMap(c => c.tecnicos.concat(c.jefes));
    expect(new Set(todos).size).toBe(todos.length);
    CUADRILLAS_TALLER.forEach(c => c.tecnicos.forEach(t => expect(cuadrillaDeTecnico(t)).toBe(c.id)));
  });
});

describe('gerCuadrillas', () => {
  const lista = [
    ...Array.from({ length: 10 }, (_, i) => ot('Carlos Trigo', (i + 1) + 'h')),            // yáñez: 1..10 h
    ...Array.from({ length: 10 }, (_, i) => ot('Camilo Santander', (i * 2 + 2) + 'h')),    // cárdenas: 2..20 h
    ot('Maicol Orostegui y Camilo Santander', '5h'), ot('', '3h'), ot('Robinson', '3h'), ot('Carlos Trigo', '4h', { estadoOT: 'Abierta' }), ot('Carlos Trigo', '4h', { tipo: 'Preventivo' })
  ];
  const reg = [pm('Carlos Trigo', 3), pm('Carlos Trigo', 4, ' · duración ESTIMADA (mediana)'), pm('Jonathan Bolados', 5), pm('', 2), pm('Otro', 2)];
  const r = gerCuadrillas(lista, reg, HOY);
  const f = id => r.filas.find(x => x.id === id);

  it('cuenta solo correctivos cerrados con técnico reconocido y reparte los que no entran', () => {
    expect(f('yanez').correctivos).toBe(10);
    expect(f('cardenas').correctivos).toBe(10);
    expect(f('mixta').correctivos).toBe(1);
    expect(r.sinTecnico).toBe(1);
    expect(r.sinCuadrilla).toBe(1);
    expect(r.correctivosCerrados).toBe(23);
  });
  it('mediana, percentil 90 y porcentaje de largos (8 h o más) por cuadrilla', () => {
    expect(f('yanez').medianaH).toBe(5.5);
    expect(f('cardenas').medianaH).toBe(11);
    expect(f('yanez').pctLargos).toBe(30);
    expect(f('cardenas').pctLargos).toBe(70);
    expect(f('yanez').p90H).toBe(9.1);
  });
  it('en los PM solo cuentan las duraciones medidas; las estimadas se anotan aparte', () => {
    expect(f('yanez')).toMatchObject({ pm: 2, pmMedidos: 1, pmEstimados: 1, medianaPMH: 3 });
    expect(f('cardenas')).toMatchObject({ pm: 1, pmMedidos: 1, medianaPMH: 5 });
    expect(r.pmSinTecnico).toBe(1);
    expect(r.pmSinCuadrilla).toBe(1);
  });
  it('con menos de 10 casos en una cuadrilla avisa muestra chica y no es comparable', () => {
    const c = gerCuadrillas(lista.slice(0, 15), reg, HOY);
    expect(c.comparable).toBe(false);
    expect(c.filas.find(x => x.id === 'cardenas').muestraChica).toBe(true);
    expect(r.comparable).toBe(true);
  });
  it('sin datos no falla', () => {
    const c = gerCuadrillas([], [], HOY);
    expect(c.filas.find(x => x.id === 'yanez')).toMatchObject({ correctivos: 0, medianaH: null, pctLargos: null });
    expect(c.comparable).toBe(false);
  });
  it('panelGerencia la incluye', () => {
    expect(panelGerencia({ hoy: HOY, ot: lista, reg }).cuadrillas.filas.length).toBe(3);
  });
});
