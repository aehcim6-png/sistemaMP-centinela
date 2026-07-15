const { hayConflictoIds } = require('../logic.js');

describe('hayConflictoIds', () => {
  it('no hay conflicto si los conjuntos son idénticos', () => {
    expect(hayConflictoIds(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(false);
  });

  it('no hay conflicto si ambos están vacíos', () => {
    expect(hayConflictoIds([], [])).toBe(false);
  });

  it('detecta conflicto si el servidor tiene una fila que esta pestaña no conocía (alguien agregó)', () => {
    expect(hayConflictoIds(['a'], ['a', 'b'])).toBe(true);
  });

  it('detecta conflicto si el servidor ya no tiene una fila que esta pestaña sí tenía (alguien borró)', () => {
    expect(hayConflictoIds(['a', 'b'], ['a'])).toBe(true);
  });

  it('detecta conflicto con mismo tamaño pero distinto contenido (alguien reemplazó una fila)', () => {
    expect(hayConflictoIds(['a', 'b'], ['a', 'c'])).toBe(true);
  });

  it('el orden de los elementos no importa', () => {
    expect(hayConflictoIds(['c', 'a', 'b'], ['a', 'b', 'c'])).toBe(false);
  });

  it('acepta Sets directamente, no solo arreglos', () => {
    expect(hayConflictoIds(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(false);
    expect(hayConflictoIds(new Set(['a']), new Set(['a', 'b']))).toBe(true);
  });
});
