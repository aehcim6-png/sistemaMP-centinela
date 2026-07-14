const { precioMaterial, _tokensMaterial, _scoreMaterial } = require('../logic.js');

describe('precioMaterial — resolución de precio de un repuesto/material', () => {
  it('prioriza el match exacto por N° de parte en Stock Filtros', () => {
    const stk = [{ nParte: '600-185-6100', precioUnit: 15000, descripcion: 'Filtro aire primario' }];
    const lub = [];
    // El texto de la pauta trae el N° de parte pegado, como en los datos reales.
    expect(precioMaterial('600-185-6100 Filtro aire primario', lub, stk)).toBe(15000);
  });

  it('sin match de N° de parte, cae al matching por palabras clave (lubricante)', () => {
    const lub = [{ nombre: 'MOBIL DELVAC 15W40', precio: 8000 }];
    const stk = [];
    expect(precioMaterial('Aceite motor Mobil Delvac 15W40', lub, stk)).toBe(8000);
  });

  it('respeta el umbral mínimo de similitud (0.6) — justo por debajo, no hay match', () => {
    // "Correa Alternador" son 2 tokens; el repuesto solo comparte 1 -> score 0.5 (<0.6)
    const stk = [{ nParte: '', descripcion: 'Correa Alternador', precioUnit: 5000 }];
    expect(precioMaterial('Correa', [], stk)).toBe(0);
  });

  it('con score exactamente en el umbral (0.6), sí hay match', () => {
    // 3 tokens en el producto, el repuesto comparte 2 -> score 2/3 ≈ 0.667 (>=0.6)
    const stk = [{ nParte: '', descripcion: 'Filtro Aire Secundario', precioUnit: 7000 }];
    expect(precioMaterial('Filtro Aire', [], stk)).toBe(7000);
  });

  it('sin ningún match razonable, devuelve 0 (no inventa un precio)', () => {
    expect(precioMaterial('Repuesto totalmente desconocido xyz', [], [])).toBe(0);
  });

  it('ignora candidatos con precio 0 o sin precio', () => {
    const lub = [{ nombre: 'MOBIL DELVAC 15W40', precio: 0 }];
    expect(precioMaterial('Aceite motor Mobil Delvac 15W40', lub, [])).toBe(0);
  });
});

describe('_tokensMaterial — tokenización para el matching', () => {
  it('descarta unidades de medida comunes (l, lt, kg, gl)', () => {
    const tokens = _tokensMaterial('Aceite 20L Mobil');
    expect(tokens).not.toContain('l');
    expect(tokens).toContain('aceite');
    expect(tokens).toContain('mobil');
  });
  it('descarta números largos (probables códigos, no palabras clave)', () => {
    const tokens = _tokensMaterial('Filtro 600185610');
    expect(tokens).not.toContain('600185610');
  });
});

describe('_scoreMaterial — score de similitud por tokens compartidos', () => {
  it('devuelve 1 cuando todos los tokens del producto están en el repuesto', () => {
    const repTok = _tokensMaterial('aceite mobil delvac');
    expect(_scoreMaterial(repTok, 'mobil delvac')).toBe(1);
  });
  it('devuelve 0 cuando el nombre del producto no tiene tokens válidos', () => {
    expect(_scoreMaterial(['algo'], '')).toBe(0);
  });
});
