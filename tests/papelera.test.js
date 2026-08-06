// Pruebas de integración de la Papelera contra el código REAL de
// modules/store.js (S.g/S.s/_moverAPapelera/_purgarPapeleraVieja tal cual
// corren en la app) — no reimplementan la lógica, solo simulan el entorno
// de navegador que store.js espera (window/localStorage/fetch/
// _logChangeGenerico), igual de mínimo que hace falta para poder requerir
// el archivo desde Node sin arrancar la app completa.
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
global._logChangeGenerico = function () {}; // vive en index.html, no en store.js
global.C = require('../logic.js').C; // store.js le agrega recalcAll a este mismo objeto

const { S, TABLA_REAL, _moverAPapelera, _purgarPapeleraVieja, _sbCache } = require('../modules/store.js');

beforeEach(() => {
  // _sbCache y localStorage son compartidos entre tests (mismo require) — se
  // limpian para que cada test arranque de cero, igual que una pestaña nueva.
  for (const k in _sbCache) delete _sbCache[k];
  for (const k in localStorage._d) delete localStorage._d[k];
});

describe('TABLA_REAL.papelera', () => {
  it('está registrada con las columnas esperadas', () => {
    expect(TABLA_REAL.papelera).toBeDefined();
    expect(TABLA_REAL.papelera.tabla).toBe('papelera');
    expect(TABLA_REAL.papelera.cols).toEqual(['categoria', 'fila', 'fechaEliminacion', 'eliminadoPor']);
  });
});

describe('_moverAPapelera', () => {
  it('copia la fila eliminada a S.g("papelera") con su categoría', () => {
    const fila = { sigla: 'CN-9507', comp: 'Motor', estado: 'OK' };
    _moverAPapelera('compMayores', fila);
    const pap = S.g('papelera');
    expect(pap.length).toBe(1);
    expect(pap[0].categoria).toBe('compMayores');
    expect(pap[0].fila).toEqual(fila);
    expect(pap[0]._id).toBeTruthy();
    expect(pap[0].fechaEliminacion).toBeTruthy();
  });

  it('no hace nada si la fila es null/undefined (índice fuera de rango)', () => {
    _moverAPapelera('ot', undefined);
    // S.g de una categoría nunca guardada devuelve null (no []) — mismo
    // comportamiento que cualquier otra categoría de TABLA_REAL sin tocar.
    expect(S.g('papelera')).toBeNull();
  });

  it('clona profundo — mutar el objeto original después de moverlo no contamina la copia', () => {
    // Este es exactamente el bug real documentado en el handoff del proyecto:
    // S.g() devuelve filas que comparten referencia con _sbCache, así que sin
    // clonar acá cualquier mutación posterior de esa misma fila (por ejemplo
    // que el llamador siga usando la referencia antes del splice) se reflejaría
    // también en la copia ya "guardada" en la papelera.
    const original = { sigla: 'BD-9533', obs: 'antes' };
    _moverAPapelera('destrabe', original);
    original.obs = 'después — mutación tardía';
    original.campoNuevo = 'no debería aparecer en la papelera';
    const copiaGuardada = S.g('papelera')[0].fila;
    expect(copiaGuardada.obs).toBe('antes');
    expect(copiaGuardada.campoNuevo).toBeUndefined();
  });

  it('acumula varias filas eliminadas de categorías distintas', () => {
    _moverAPapelera('ot', { sigla: 'A' });
    _moverAPapelera('reg', { sigla: 'B' });
    _moverAPapelera('hist', { sigla: 'C' });
    const pap = S.g('papelera');
    expect(pap.map(function (p) { return p.categoria; })).toEqual(['ot', 'reg', 'hist']);
  });
});

describe('_purgarPapeleraVieja', () => {
  it('deja intactas las filas eliminadas hace menos de 30 días', () => {
    _moverAPapelera('aceite', { sigla: 'X' });
    _purgarPapeleraVieja();
    expect(S.g('papelera').length).toBe(1);
  });

  it('purga silenciosamente las filas eliminadas hace más de 30 días', () => {
    const hace40Dias = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    const hace5Dias = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    S.s('papelera', [
      { _id: '1', categoria: 'ot', fila: {}, fechaEliminacion: hace40Dias, eliminadoPor: 'Test' },
      { _id: '2', categoria: 'reg', fila: {}, fechaEliminacion: hace5Dias, eliminadoPor: 'Test' }
    ]);
    _purgarPapeleraVieja();
    const pap = S.g('papelera');
    expect(pap.length).toBe(1);
    expect(pap[0]._id).toBe('2');
  });

  it('no toca S.s si no hay nada que purgar (evita escrituras innecesarias)', () => {
    _moverAPapelera('ot', { sigla: 'A' });
    const antes = S.g('papelera');
    _purgarPapeleraVieja();
    const despues = S.g('papelera');
    // Misma cantidad de filas, purgar sin cambios no debería alterar el contenido
    expect(despues).toEqual(antes);
  });
});

describe('flujo completo: eliminar → papelera → restaurar', () => {
  it('el ciclo completo devuelve la fila a su categoría de origen intacta', () => {
    // Arrange: una "tabla" con una fila real
    var reg = [{ _id: 'r1', equipo: 'CN-9507', tipoPM: 'PM1' }, { _id: 'r2', equipo: 'BD-9533', tipoPM: 'PM2' }];
    S.s('reg', reg);

    // Act 1: eliminar la primera fila (mismo patrón que cualquier delX de la app)
    var actual = S.g('reg');
    _moverAPapelera('reg', actual[0]);
    actual.splice(0, 1);
    S.s('reg', actual);

    expect(S.g('reg').length).toBe(1);
    expect(S.g('reg')[0]._id).toBe('r2');
    var pap = S.g('papelera');
    expect(pap.length).toBe(1);
    expect(pap[0].fila._id).toBe('r1');

    // Act 2: restaurar (misma lógica que window._restaurarDePapelera en index.html)
    var item = pap[0];
    var destino = S.g(item.categoria);
    destino.push(item.fila);
    S.s(item.categoria, destino);
    pap.splice(0, 1);
    S.s('papelera', pap);

    // Assert: la fila volvió, la papelera quedó vacía
    var regFinal = S.g('reg');
    expect(regFinal.length).toBe(2);
    expect(regFinal.map(function (r) { return r._id; }).sort()).toEqual(['r1', 'r2']);
    expect(S.g('papelera').length).toBe(0);
  });
});
