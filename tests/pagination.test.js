const { pagSlice } = require('../logic.js');

describe('pagSlice', () => {
  const arr = Array.from({ length: 125 }, (_, i) => i);

  it('reparte en páginas del tamaño pedido', () => {
    const p1 = pagSlice(arr, 1, 50);
    expect(p1.page).toBe(1);
    expect(p1.totalPages).toBe(3);
    expect(p1.total).toBe(125);
    expect(p1.items).toEqual(arr.slice(0, 50));
  });

  it('la última página trae el resto, aunque sea más chica', () => {
    const p3 = pagSlice(arr, 3, 50);
    expect(p3.items.length).toBe(25);
    expect(p3.items[0]).toBe(100);
  });

  it('recorta (clampea) una página pedida por encima del total', () => {
    const p = pagSlice(arr, 99, 50);
    expect(p.page).toBe(3);
  });

  it('recorta (clampea) una página pedida por debajo de 1', () => {
    const p = pagSlice(arr, -5, 50);
    expect(p.page).toBe(1);
  });

  it('un arreglo vacío da 1 página vacía, no 0 páginas', () => {
    const p = pagSlice([], 1, 50);
    expect(p.totalPages).toBe(1);
    expect(p.items).toEqual([]);
  });

  it('un arreglo que entra completo en una página da totalPages=1', () => {
    const p = pagSlice([1, 2, 3], 1, 50);
    expect(p.totalPages).toBe(1);
  });

  it('sin page (undefined) asume página 1', () => {
    const p = pagSlice(arr, undefined, 50);
    expect(p.page).toBe(1);
  });
});
