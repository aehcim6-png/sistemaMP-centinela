import { describe, it, expect } from 'vitest';
import { evaluarDiccionarioComponentes } from '../logic.js';

describe('evaluarDiccionarioComponentes', () => {
  const base = [];
  for (let i = 0; i < 12; i++) base.push({ texto: 'Control de neumáticos posición ' + (i % 6 + 1), etiqueta: 'Neumáticos' });
  for (let i = 0; i < 8; i++) base.push({ texto: 'Se realiza cambio de cuchillas', etiqueta: 'GET / Cuchillas' });
  for (let i = 0; i < 6; i++) base.push({ texto: 'mantención semanal del equipo', etiqueta: '' });          // sin componente: no clasifica
  for (let i = 0; i < 4; i++) base.push({ texto: 'mal funcionamiento radio base', etiqueta: 'Sistema Eléctrico' }); // categoría más fina: desacuerdo
  for (let i = 0; i < 2; i++) base.push({ texto: 'cambio de asiento del operador', etiqueta: 'Neumáticos' });  // etiqueta distinta: desacuerdo
  it('mide cobertura y acuerdo con la etiqueta, con intervalos', () => {
    const r = evaluarDiccionarioComponentes(base);
    expect(r.n).toBe(32);
    expect(r.clasificadas).toBe(26);                      // todo menos las 6 de mantención semanal
    expect(r.pctClasificadas).toBeCloseTo(81.3, 1);
    expect(r.etiquetadas).toBe(26);
    expect(r.clasificadasConEtiqueta).toBe(26);
    expect(r.acuerdos).toBe(20);                          // neumáticos (12) + cuchillas (8)
    expect(r.pctAcuerdo).toBeCloseTo(76.9, 1);
    // Wilson 95 % de 20/26 (cálculo independiente): 57.9 % a 89.0 %
    expect(r.icAcuerdo[0]).toBeCloseTo(57.9, 0);
    expect(r.icAcuerdo[1]).toBeCloseTo(89.0, 0);
    expect(r.desacuerdos.map((d) => d.par)).toContain('Sistema Eléctrico → Radio/Comunicaciones');
    expect(r.desacuerdos[0].n).toBe(4);
  });
  it('no evalúa con menos de 30 filas con texto', () => {
    expect(evaluarDiccionarioComponentes(base.slice(0, 20))).toBeNull();
    expect(evaluarDiccionarioComponentes([])).toBeNull();
    expect(evaluarDiccionarioComponentes(null)).toBeNull();
  });
});
