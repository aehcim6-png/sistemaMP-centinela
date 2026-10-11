// Reportabilidad diaria del cliente: lectura de los dos formatos de Excel, armado del lote, fusión idempotente (cargar fechas antiguas después), disponibilidad por período y episodios FS.
import { describe, it, expect } from 'vitest';
const L = require('../logic.js');

const serial = (iso) => Math.round((new Date(iso + 'T12:00:00Z') - new Date('1899-12-30T12:00:00Z')) / 86400000);
// formato A (archivo diario, sigla del programa, Estatus OP/FS)
const diario = (fechaCab, filas) => [
  [null, 'REPORTABILIDAD DIARIA CENTINELA', null, null, null, null, null, null, null, null, serial(fechaCab)],
  [null, 'Equipo', 'Marca -  Modelo', 'Estatus', 'Ubicación', 'Detalle', 'Detencion', 'Dias F/S', 'Proyeccion', 'Orden de Compra', 'Observacion', 'Mantenedor']
].concat(filas.map((f, i) => [i + 1, f[0], 'KOMATSU', f[1], 'TALLER BESALCO', f[2] || null, f[3] ? serial(f[3]) : null, null, f[4] ? serial(f[4]) : 'Sin Proyeccion', null, f[5] || null, null]));
// formato B (libro con una hoja por día, sigla del cliente y, a veces, "Sigla CEN"; Estatus 1=FS 2=OP)
const libro = (fechaCab, filas, conCen) => [
  [], [null, 'REPORTABILIDAD DIARIA FAENA', null, null, null, null, null, null, null, null, null, serial(fechaCab)],
  conCen ? [null, null, 'Sigla', 'Sigla CEN', 'Marca -  Modelo', 'Estatus', 'Ubicación', 'Detalle', 'Fecha Detencion', 'Dias F/S', 'Fecha Proyección', 'Orden de Compra', 'Observación']
    : [null, 'Sigla', 'Marca -  Modelo', 'Estatus', 'Ubicación', 'Detalle', 'Fecha Detencion', 'Dias F/S', 'Fecha Proyección', 'Orden de Compra', 'Observación']
].concat(filas.map((f, i) => conCen ? [i + 1, null, f[0], f[1], 'KOMATSU', f[2], 'TALLER BESALCO', f[3] || null, f[4] ? serial(f[4]) : null, null, f[5] ? serial(f[5]) : null, null, f[6] || null]
  : [i + 1, f[0], 'KOMATSU', f[2], 'TALLER BESALCO', f[3] || null, f[4] ? serial(f[4]) : null, null, f[5] ? serial(f[5]) : null, null, f[6] || null]));

describe('lectura de hojas', () => {
  it('formato diario: estatus OP/FS, fecha del nombre del archivo, FS con detalle, detención, proyección y observación', () => {
    const h = { nombre: 'centinela', archivo: '24-07-2026_Reportabilidad_diaria_Centinela.xlsx', filas: diario('2026-07-24', [['CN-9503', 'OP'], ['CN-9502', 'FS', 'Diferencial', '2026-04-30', null, 'Se reemplazó el diferencial'], ['CN-4656', null]]) };
    const p = L.reportabilidadParsearHoja(h, {});
    expect(p.fecha).toBe('2026-07-24'); expect(p.formato).toBe('diario');
    expect(p.filas).toHaveLength(2); expect(p.sinEstatus).toBe(1);                 // la fila sin estatus no cuenta
    const fs = p.filas.find((x) => x.sigla === 'CN-9502');
    expect(fs).toMatchObject({ estatus: 'FS', detalle: 'Diferencial', fechaDetencion: '2026-04-30', proyeccion: null, observacion: 'Se reemplazó el diferencial' });
    expect(p.filas.find((x) => x.sigla === 'CN-9503')).toMatchObject({ estatus: 'OP', detalle: '', fechaDetencion: null });
  });
  it('formato libro: estatus 1=FS 2=OP, fecha del nombre de la hoja (dd-mm) con el año de la cabecera, cruce de siglas del cliente', () => {
    const h = { nombre: '26-08', archivo: 'libro.xlsx', filas: libro('2026-10-05', [['CE-85', null, 2], ['CE-87', null, 1, 'MANDO FINAL', '2026-08-19', '2026-09-20', 'En evaluación']], false) };
    const p = L.reportabilidadParsearHoja(h, {});
    expect(p.fecha).toBe('2026-08-26');                                            // el nombre manda, no la cabecera
    expect(p.avisos.join(' ')).toMatch(/cabecera/);
    expect(p.filas.map((x) => [x.sigla, x.siglaCliente, x.estatus])).toEqual([['CN-9503', 'CE-85', 'OP'], ['CN-9500', 'CE-87', 'FS']]);
    expect(p.filas[1]).toMatchObject({ fechaDetencion: '2026-08-19', proyeccion: '2026-09-20', detalle: 'MANDO FINAL' });
  });
  it('con columna "Sigla CEN" usa la sigla del programa de la propia hoja', () => {
    const p = L.reportabilidadParsearHoja({ nombre: '05-10', archivo: 'l.xlsx', filas: libro('2026-10-05', [['CE-86', 'CN-9501', 1, 'MANDO FINAL', '2026-09-15', '2026-10-07']], true) }, {});
    expect(p.filas[0]).toMatchObject({ sigla: 'CN-9501', siglaCliente: 'CE-86', estatus: 'FS' });
  });
  it('no confunde otras hojas con reportabilidad, ignora filas TOTAL y entiende fechas como serial, texto o Date', () => {
    expect(L.reportabilidadParsearHoja({ nombre: 'Hoja1', filas: [[null, null], [null, null]] }, {})).toBeNull();
    expect(L.reportabilidadFechaDeNombre('17-07-2026_Reportabilidad_diaria_Centinela.xlsx')).toEqual({ iso: '2026-07-17', conAnio: true });
    expect(L.reportabilidadFechaDeNombre('05-10', 2026)).toEqual({ iso: '2026-10-05', conAnio: false });
    expect(L.reportabilidadFechaDeNombre('centinela', 2026)).toBeNull();
    const p = L.reportabilidadParsearHoja({ nombre: '24-07', filas: diario('2026-07-24', [['TOTAL', 'OP'], ['CN-9503', 'OP']]) }, {});
    expect(p.filas.map((x) => x.sigla)).toEqual(['CN-9503']);
    const f = diario('2026-07-24', [['CN-9502', 'FS', 'X', null, null]]); f[2][6] = '30-04-2026'; f[2][8] = new Date(2026, 6, 31);
    const q = L.reportabilidadParsearHoja({ nombre: '24-07', filas: f }, {});
    expect(q.filas[0]).toMatchObject({ fechaDetencion: '2026-04-30', proyeccion: '2026-07-31' });
  });
});

describe('armado del lote', () => {
  const dia = (nombre, archivo, fecha, filas) => ({ nombre, archivo, filas: diario(fecha, filas) });
  const base = [['CN-9503', 'OP'], ['CN-9502', 'FS', 'Diferencial', '2026-04-30']];
  it('une varios archivos, descarta repetidos idénticos y avisa los conflictos reales', () => {
    const hojas = [dia('centinela', '17-07-2026_a.xlsx', '2026-07-17', base), dia('centinela', '17-07-2026_copia.xlsx', '2026-07-17', base),
      dia('centinela', '23-07-2026_a.xlsx', '2026-07-23', base), dia('centinela', '23-07-2026_b.xlsx', '2026-07-23', [['CN-9503', 'OP'], ['CN-9502', 'OP']])];
    const r = L.reportabilidadArmarLote(hojas, {});
    expect(r.filas).toHaveLength(4); expect(r.duplicadasIdenticas).toBe(1);
    expect(r.conflictos).toHaveLength(1); expect(r.conflictos[0]).toMatchObject({ fecha: '2026-07-23', equiposConEstatusDistinto: 1 });
  });
  it('una hoja que es copia de otra día (misma información, cabecera de la fecha original) se omite', () => {
    const a = dia('centinela', '26-08-2026_x.xlsx', '2026-08-26', base), b = dia('centinela', '27-08-2026_x.xlsx', '2026-08-26', base);
    const r = L.reportabilidadArmarLote([a, b], {});
    expect(r.filas.map((x) => x.fecha)).toEqual(['2026-08-26', '2026-08-26']);    // solo el 26
    const copia = r.hojas.find((h) => h.fecha === '2026-08-27');
    expect(copia.posibleCopia).toBe(true);
  });
  it('solo carga equipos del programa o retirados que ya tienen historia; el resto se informa y no se carga', () => {
    const hojas = [dia('centinela', '17-07-2026_a.xlsx', '2026-07-17', [['CN-9503', 'OP'], ['MN-92', 'FS', 'X', '2026-07-20'], ['CN-6113', 'FS', 'Motor', '2025-12-22']])];
    const r = L.reportabilidadArmarLote(hojas, { siglasPrograma: ['CN-9503'], siglasRetiradas: ['CN-6113'] });
    expect(r.filas.map((x) => x.sigla)).toEqual(['CN-6113', 'CN-9503']); expect(r.desconocidas).toEqual({ 'MN-92': 1 });
    expect(L.reportabilidadArmarLote(hojas, { siglasPrograma: ['CN-9503'], siglasRetiradas: ['CN-6113'], excluir: ['CN-6113'] }).filas).toHaveLength(1);
  });
});

describe('fusionar con lo ya guardado (cargar datos antiguos después, en cualquier orden)', () => {
  const nueva = (fecha, sigla, estatus, extra) => Object.assign({ fecha, sigla, siglaCliente: '', estatus, ubicacion: 'TALLER BESALCO', detalle: '', fechaDetencion: null, proyeccion: null, ordenCompra: '', observacion: '', mantenedor: '' }, extra);
  it('lo nuevo se inserta, lo que cambió se actualiza con el mismo id y lo igual no se toca; cargar dos veces lo mismo no hace nada', () => {
    const exist = [Object.assign(nueva('2026-10-05', 'CN-9501', 'FS', { detalle: 'MANDO FINAL' }), { _id: 'a1' }), Object.assign(nueva('2026-10-05', 'CN-9503', 'OP'), { _id: 'a2' })];
    const lote = [nueva('2026-10-05', 'CN-9501', 'FS', { detalle: 'MANDO FINAL', proyeccion: '2026-10-07' }), nueva('2026-10-05', 'CN-9503', 'OP'), nueva('2026-07-17', 'CN-9503', 'OP')];
    const f = L.reportabilidadFusionar(exist, lote);
    expect(f.insertar).toHaveLength(1); expect(f.insertar[0].fecha).toBe('2026-07-17');   // una fecha anterior a lo ya cargado
    expect(f.actualizar).toHaveLength(1); expect(f.actualizar[0]._id).toBe('a1'); expect(f.iguales).toBe(1);
    const tras = exist.concat(f.insertar.map((n, i) => Object.assign({ _id: 'n' + i }, n)));
    const otra = L.reportabilidadFusionar(tras, lote);
    expect(otra.insertar).toHaveLength(0); expect(otra.actualizar).toHaveLength(1);       // la actualización de proyección aún no se aplicó en `tras`
  });
  it('un valor vacío y null cuentan como lo mismo', () => {
    const e = [Object.assign(nueva('2026-10-05', 'CN-9503', 'OP', { ubicacion: null, detalle: null }), { _id: 'x' })];
    expect(L.reportabilidadFusionar(e, [nueva('2026-10-05', 'CN-9503', 'OP', { ubicacion: '', detalle: '' })]).iguales).toBe(1);
  });
});

describe('disponibilidad y episodios', () => {
  const r = (fecha, sigla, estatus, extra) => Object.assign({ fecha, sigla, estatus, detalle: '', fechaDetencion: null, proyeccion: null, observacion: '', ordenCompra: '' }, extra);
  const filas = [
    r('2026-10-01', 'A', 'FS', { fechaDetencion: '2026-09-15', proyeccion: '2026-10-04', detalle: 'MANDO' }), r('2026-10-01', 'B', 'OP'), r('2026-10-01', 'C', 'OP'), r('2026-10-01', 'D', 'OP'),
    r('2026-10-03', 'A', 'FS', { fechaDetencion: '2026-09-15', proyeccion: '2026-10-07', detalle: 'MANDO' }), r('2026-10-03', 'B', 'FS', { fechaDetencion: '2026-10-03', proyeccion: '2026-10-03', detalle: 'NEUM' }), r('2026-10-03', 'C', 'OP'), r('2026-10-03', 'D', 'OP'),
    r('2026-10-05', 'A', 'FS', { fechaDetencion: '2026-09-15', proyeccion: '2026-10-07', detalle: 'MANDO' }), r('2026-10-05', 'B', 'OP'), r('2026-10-05', 'C', 'OP'), r('2026-10-05', 'D', 'OP')];
  it('disponibilidad por día = OP ÷ reportados; promedio, cobertura del período, mejor y peor día, ranking de días FS', () => {
    const d = L.reportabilidadDisponibilidad(filas, '2026-10-01', '2026-10-07', { hoy: '2026-10-07' });
    expect(d.dias.map((x) => [x.fecha, x.disp])).toEqual([['2026-10-01', 0.75], ['2026-10-03', 0.5], ['2026-10-05', 0.75]]);
    expect(d.promedio).toBeCloseTo((0.75 + 0.5 + 0.75) / 3, 10);
    expect(d.diasConDato).toBe(3); expect(d.diasPeriodo).toBe(7); expect(d.cobertura).toBeCloseTo(3 / 7, 10);
    expect(d.minimo.fecha).toBe('2026-10-03'); expect(d.maximo.disp).toBe(0.75);
    expect(d.ranking[0]).toEqual({ sigla: 'A', dias: 3 }); expect(d.ranking[1]).toEqual({ sigla: 'B', dias: 1 });
  });
  it('respeta el rango pedido, excluye equipos y no cuenta días futuros en la cobertura', () => {
    const d = L.reportabilidadDisponibilidad(filas, '2026-10-02', '2026-10-31', { hoy: '2026-10-05', excluir: ['A'] });
    expect(d.dias.map((x) => x.fecha)).toEqual(['2026-10-03', '2026-10-05']);
    expect(d.diasPeriodo).toBe(4); expect(d.dias[0].disp).toBeCloseTo(2 / 3, 10);
    expect(L.reportabilidadDisponibilidad([], '2026-10-01', '2026-10-31').promedio).toBeNull();
  });
  it('episodios FS: agrupa por fecha de detención, cuenta reprogramaciones, detecta cierre y proyección vencida', () => {
    const e = L.reportabilidadEpisodios(filas);
    const a = e.find((x) => x.sigla === 'A'), b = e.find((x) => x.sigla === 'B');
    expect(a).toMatchObject({ fechaDetencion: '2026-09-15', primeraVez: '2026-10-01', ultimaVez: '2026-10-05', diasVistos: 3, reprogramaciones: 1, cerrado: false, proyeccionFinal: '2026-10-07' });
    expect(a.cumplioProyeccion).toBeNull(); expect(a.diasVencida).toBe(0);                  // la proyección del 7-oct aún está dentro de plazo al último dato (5-oct)
    expect(b).toMatchObject({ cerrado: true, primerOP: '2026-10-05', cumplioProyeccion: true });
    const tarde = L.reportabilidadEpisodios(filas.concat([r('2026-10-10', 'A', 'FS', { fechaDetencion: '2026-09-15', proyeccion: '2026-10-07' })]));
    const a2 = tarde.find((x) => x.sigla === 'A');
    expect(a2.cumplioProyeccion).toBe(false); expect(a2.diasVencida).toBe(3);
  });
});
