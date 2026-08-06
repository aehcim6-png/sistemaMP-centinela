// Pruebas de integración contra el código REAL de modules/store.js, mismo
// criterio que tests/papelera.test.js: sin reimplementar la lógica, sin
// DOM. Acá el foco es la integridad estructural de TABLA_REAL/TABLA_SINGLETON
// (el mapeo entero categoría->tabla real vive ahí, y ya mordió con bugs
// reales de config — ver 20260805040800_fix_destrabe_columnas_reales.sql:
// 'destrabe' mapeaba mal sus columnas y los datos se guardaban como null en
// silencio, sin que ningún test lo detectara) y el recorte de categorías
// que crecen sin límite (_recorteParaLocal), que si se rompe pierde datos
// del respaldo offline sin avisar.
global.window = { addEventListener: function () {}, crypto: global.crypto };
global.localStorage = (function () {
  var d = {};
  return {
    _d: d,
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; },
    setItem: function (k, v) { d[k] = String(v); },
    removeItem: function (k) { delete d[k]; }
  };
})();
global.fetch = function () { return Promise.reject(new Error('red deshabilitada en tests')); };
global._logChangeGenerico = function () {};
global.C = require('../logic.js').C; // store.js le agrega recalcAll a este mismo objeto

const { S, TABLA_REAL, TABLA_SINGLETON, _sbCache, _recorteParaLocal, _CATEGORIAS_CRECIENTES, _TOPE_FILAS_LOCAL } = require('../modules/store.js');

beforeEach(() => {
  for (const k in _sbCache) delete _sbCache[k];
  for (const k in localStorage._d) delete localStorage._d[k];
});

describe('TABLA_REAL — integridad estructural', () => {
  const claves = Object.keys(TABLA_REAL);

  it('tiene al menos las categorías esperadas (no se borró nada por accidente)', () => {
    expect(claves.length).toBeGreaterThanOrEqual(30);
    ['eq', 'reg', 'ot', 'hist', 'mov', 'aceite', 'compMayores', 'papelera'].forEach(function (k) {
      expect(claves).toContain(k);
    });
  });

  claves.forEach(function (k) {
    describe('TABLA_REAL.' + k, () => {
      const cfg = TABLA_REAL[k];
      it('tiene tabla/clave/claveDb/cols bien formados', () => {
        expect(typeof cfg.tabla).toBe('string');
        expect(cfg.tabla.length).toBeGreaterThan(0);
        expect(typeof cfg.clave).toBe('string');
        expect(typeof cfg.claveDb).toBe('string');
        expect(Array.isArray(cfg.cols)).toBe(true);
        expect(cfg.cols.length).toBeGreaterThan(0);
      });
      it('no tiene columnas duplicadas en cols (bug real ya visto: mapeo mal armado)', () => {
        const unicas = new Set(cfg.cols);
        expect(unicas.size).toBe(cfg.cols.length);
      });
      it('si clave no es "_id", clave debe estar incluida en cols (es un campo real de la fila)', () => {
        if (cfg.clave !== '_id') expect(cfg.cols).toContain(cfg.clave);
      });
    });
  });

  it('no hay dos categorías apuntando a la misma tabla real (colisión de mapeo)', () => {
    // ocHist es explícitamente de solo lectura y comparte convención con otros
    // históricos, así que se valida el resto del mapeo activo.
    const tablas = claves.map(function (k) { return TABLA_REAL[k].tabla; });
    const unicas = new Set(tablas);
    expect(unicas.size).toBe(tablas.length);
  });
});

describe('TABLA_SINGLETON — integridad estructural', () => {
  Object.keys(TABLA_SINGLETON).forEach(function (k) {
    it('TABLA_SINGLETON.' + k + ' tiene tabla y modo válidos', () => {
      const cfg = TABLA_SINGLETON[k];
      expect(typeof cfg.tabla).toBe('string');
      expect(['objeto', 'valor', 'datos']).toContain(cfg.modo);
    });
  });
});

describe('_recorteParaLocal', () => {
  it('no toca categorías que no crecen sin límite (ej. equipos)', () => {
    const arr = Array.from({ length: _TOPE_FILAS_LOCAL + 500 }, function (_, i) { return { sigla: 'X' + i }; });
    expect(_recorteParaLocal('eq', arr).length).toBe(arr.length);
  });

  it('no recorta si está por debajo del tope', () => {
    const arr = [{ fecha: '2026-01-01' }, { fecha: '2026-01-02' }];
    expect(_recorteParaLocal('hist', arr)).toEqual(arr);
  });

  it('recorta a _TOPE_FILAS_LOCAL cuando se pasa, quedándose con lo más reciente', () => {
    const arr = Array.from({ length: _TOPE_FILAS_LOCAL + 300 }, function (_, i) {
      // fechas ascendentes: el índice más alto es el más reciente
      return { fecha: '2020-01-01', idx: i, fechaOrden: String(1000000 + i) };
    }).map(function (o) { return { fecha: o.fechaOrden, idx: o.idx }; });
    const recortado = _recorteParaLocal('hist', arr);
    expect(recortado.length).toBe(_TOPE_FILAS_LOCAL);
    // Los índices más altos (más recientes) son los que sobreviven
    const idxSupervivientes = recortado.map(function (r) { return r.idx; });
    expect(Math.min.apply(null, idxSupervivientes)).toBe(300);
    expect(Math.max.apply(null, idxSupervivientes)).toBe(_TOPE_FILAS_LOCAL + 299);
  });

  it('cada clave de _CATEGORIAS_CRECIENTES existe en TABLA_REAL (no quedó una categoría vieja/renombrada)', () => {
    Object.keys(_CATEGORIAS_CRECIENTES).forEach(function (k) {
      expect(TABLA_REAL[k]).toBeDefined();
    });
  });
});

describe('S.g/S.s — contrato de copia superficial', () => {
  it('S.g devuelve un arreglo nuevo cada vez (no la misma referencia)', () => {
    S.s('ot', [{ sigla: 'A' }]);
    const g1 = S.g('ot');
    const g2 = S.g('ot');
    expect(g1).not.toBe(g2);
    expect(g1).toEqual(g2);
  });

  it('empujar a un arreglo de S.g() sin llamar S.s() no persiste el cambio', () => {
    S.s('ot', [{ sigla: 'A' }]);
    const arr = S.g('ot');
    arr.push({ sigla: 'B' });
    expect(S.g('ot').length).toBe(1); // el push de arriba no llegó a _sbCache
  });

  it('editar un campo de una fila devuelta por S.g() SÍ se refleja (misma referencia de fila, a propósito)', () => {
    S.s('ot', [{ sigla: 'A', estadoOT: 'Abierta' }]);
    const arr = S.g('ot');
    arr[0].estadoOT = 'Cerrada';
    // Documentado en store.js: las FILAS son la misma referencia que _sbCache,
    // solo el arreglo contenedor es una copia — este es el comportamiento
    // esperado que permite "S.g(k)[i].campo=x; S.s(k,arr)" en toda la app.
    expect(S.g('ot')[0].estadoOT).toBe('Cerrada');
  });
});
