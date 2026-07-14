const { esLubricante } = require('../logic.js');

describe('esLubricante — clasifica un repuesto de pauta como lubricante o filtro', () => {
  it('vacío o nulo -> false', () => {
    expect(esLubricante('')).toBe(false);
    expect(esLubricante(null)).toBe(false);
  });

  it('lubricantes obvios por palabra clave', () => {
    expect(esLubricante('Aceite motor 15W40')).toBe(true);
    expect(esLubricante('Grasa Mobilgrease')).toBe(true);
    expect(esLubricante('Refrigerante Antifreeze')).toBe(true);
  });

  it('"filtro de aceite" es un FILTRO, no un lubricante — la trampa explícita del código', () => {
    expect(esLubricante('Filtro de aceite motor')).toBe(false);
    expect(esLubricante('Kit Filtro aceite hidráulico')).toBe(false);
    expect(esLubricante('Elemento filtro de aceite')).toBe(false);
  });

  it('un texto que empieza con un N° de parte se trata como filtro, no lubricante', () => {
    expect(esLubricante('600-185-6100 aceite')).toBe(false);
  });

  it('o-rings, anillos y correas nunca son lubricante aunque mencionen aceite', () => {
    expect(esLubricante('Oring sello aceite')).toBe(false);
    expect(esLubricante('Anillo retén aceite motor')).toBe(false);
    expect(esLubricante('Correa aceite bomba')).toBe(false);
  });

  it('repuesto sin ninguna palabra clave de lubricante -> false', () => {
    expect(esLubricante('Perno de rueda')).toBe(false);
  });
});
