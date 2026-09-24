import { describe, it, expect } from 'vitest';
import { causasLatentesRepetidas } from '../logic.js';

function ev(sigla, fecha, componente, tipoCausa, extra) {
  return { sigla, fecha, componente, tipoCausa, causaRaiz: '', solucion: '', ...extra };
}

describe('causasLatentesRepetidas', () => {
  it('array vacío sin correctivos', () => {
    expect(causasLatentesRepetidas([])).toEqual([]);
    expect(causasLatentesRepetidas(undefined)).toEqual([]);
  });

  it('ignora eventos sin tipoCausa=Latente (Física/Humana/vacío no cuentan)', () => {
    const correctivos = [
      ev('MN-1', '2026-01-05', 'Frenos', 'Física'),
      ev('MN-2', '2026-01-10', 'Frenos', 'Humana'),
      ev('MN-3', '2026-01-15', 'Frenos', ''),
      ev('MN-4', '2026-01-20', 'Frenos', undefined),
    ];
    expect(causasLatentesRepetidas(correctivos)).toEqual([]);
  });

  it('con un solo evento Latente para un componente, no lo marca (necesita repetición)', () => {
    const correctivos = [ev('MN-1', '2026-01-05', 'Frenos', 'Latente')];
    expect(causasLatentesRepetidas(correctivos)).toEqual([]);
  });

  it('con 2+ eventos Latente del mismo componente, en equipos distintos, arma el grupo', () => {
    const correctivos = [
      ev('MN-1', '2026-01-05', 'Frenos', 'Latente'),
      ev('CF-2', '2026-02-10', 'Frenos', 'Latente'),
    ];
    const r = causasLatentesRepetidas(correctivos);
    expect(r).toHaveLength(1);
    expect(r[0].componente).toBe('Frenos');
    expect(r[0].nEventos).toBe(2);
    expect(r[0].nEquipos).toBe(2);
    expect(r[0].equipos.sort()).toEqual(['CF-2', 'MN-1']);
  });

  it('cuenta también repeticiones en el MISMO equipo (no exige que sean equipos distintos)', () => {
    const correctivos = [
      ev('MN-1', '2026-01-05', 'Frenos', 'Latente'),
      ev('MN-1', '2026-03-10', 'Frenos', 'Latente'),
    ];
    const r = causasLatentesRepetidas(correctivos);
    expect(r[0].nEventos).toBe(2);
    expect(r[0].nEquipos).toBe(1);
    expect(r[0].equipos).toEqual(['MN-1']);
  });

  it('no mezcla componentes distintos en el mismo grupo', () => {
    const correctivos = [
      ev('MN-1', '2026-01-05', 'Frenos', 'Latente'),
      ev('MN-2', '2026-01-10', 'Frenos', 'Latente'),
      ev('CF-1', '2026-01-05', 'Dirección', 'Latente'),
      ev('CF-2', '2026-01-10', 'Dirección', 'Latente'),
    ];
    const r = causasLatentesRepetidas(correctivos);
    expect(r).toHaveLength(2);
    const frenos = r.find((x) => x.componente === 'Frenos');
    const direccion = r.find((x) => x.componente === 'Dirección');
    expect(frenos.nEventos).toBe(2);
    expect(direccion.nEventos).toBe(2);
  });

  it('ignora eventos sin componente, sin sigla o sin fecha (nunca inventa el agrupador)', () => {
    const correctivos = [
      { sigla: 'MN-1', fecha: '2026-01-05', componente: '', tipoCausa: 'Latente' },
      { sigla: '', fecha: '2026-01-10', componente: 'Frenos', tipoCausa: 'Latente' },
      { sigla: 'MN-2', fecha: '', componente: 'Frenos', tipoCausa: 'Latente' },
    ];
    expect(causasLatentesRepetidas(correctivos)).toEqual([]);
  });

  it('la lista de eventos de cada grupo viene ordenada por fecha y trae causaRaiz/solucion', () => {
    const correctivos = [
      ev('MN-1', '2026-03-05', 'Frenos', 'Latente', { causaRaiz: 'no se auditó el procedimiento', solucion: 'se repuso pastilla' }),
      ev('MN-2', '2026-01-10', 'Frenos', 'Latente', { causaRaiz: 'checklist incompleto', solucion: 'se ajustó' }),
    ];
    const r = causasLatentesRepetidas(correctivos);
    expect(r[0].eventos[0].fecha).toBe('2026-01-10');
    expect(r[0].eventos[1].fecha).toBe('2026-03-05');
    expect(r[0].eventos[0].causaRaiz).toBe('checklist incompleto');
    expect(r[0].eventos[1].solucion).toBe('se repuso pastilla');
  });

  it('ordena los grupos de mayor a menor cantidad de eventos', () => {
    const correctivos = [
      ev('MN-1', '2026-01-05', 'Dirección', 'Latente'),
      ev('MN-2', '2026-01-10', 'Dirección', 'Latente'),
      ev('CF-1', '2026-01-05', 'Frenos', 'Latente'),
      ev('CF-2', '2026-01-10', 'Frenos', 'Latente'),
      ev('CF-3', '2026-01-15', 'Frenos', 'Latente'),
    ];
    const r = causasLatentesRepetidas(correctivos);
    expect(r[0].componente).toBe('Frenos');
    expect(r[0].nEventos).toBe(3);
    expect(r[1].componente).toBe('Dirección');
  });

  it('no muta el arreglo original (pura)', () => {
    const correctivos = [
      ev('MN-1', '2026-01-05', 'Frenos', 'Latente'),
      ev('MN-2', '2026-01-10', 'Frenos', 'Latente'),
    ];
    const copia = correctivos.map((c) => ({ ...c }));
    causasLatentesRepetidas(correctivos);
    expect(correctivos).toEqual(copia);
  });
});
