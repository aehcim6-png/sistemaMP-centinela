import { describe, it, expect } from 'vitest';
import { reporteTurnoFilas, reporteTurnoResolverSiglas } from '../logic.js';

// Datos tal como los devuelve la lectura de la foto «PRODUCCIÓN TURNO DÍA» del 10/08/2026.
const datos = {
  caex: [
    { sigla: 'CN-9503', equipoNombre: 'CAEX-85', totalHoras: null, estadoTexto: 'fuera de servicio', operador: null, tonVuelta: 90, totalTon: 0, incierto: false },
    { sigla: 'CN-9501', equipoNombre: 'CAEX-86', horometroInicial: 21258.5, horometroFinal: 21265.8, totalHoras: 7.3, vueltas: 41, rendimientoVueltasHr: 5.6, tiempoCicloMin: 10.7, operador: 'NESTOR MENESES', tonVuelta: 90, totalTon: 3690, incierto: false },
  ],
  carguio: [
    { sigla: 'CF-9510', equipoNombre: 'CF-510', horometroInicial: 15646.5, horometroFinal: 15653.6, totalHoras: 7.1, tonelaje: 8256, rendimientoTonHr: 1162.8, operador: 'EMILIO PAEZ', postura: 'F11 M6', incierto: false },
    { sigla: 'CF-9511', equipoNombre: 'CF-511', totalHoras: null, estadoTexto: 'fuera de servicio', incierto: false },
  ],
  apoyo: [
    { sigla: 'BD-9509', equipoNombre: 'BD-509', horometroInicial: 12724, horometroFinal: 12729, totalHoras: 5, operador: 'EDWIN ZEPEDA', areaTrabajo: 'B2', incierto: false },
  ],
  perdidaPetroleo: [
    { equipoNombre: 'CAEX-86', horaInicio: '10:25', horaFin: '12:20', totalHoras: 1.92, tonAsociado: 0, incierto: false },
  ],
  perdidaIndisponibilidad: [
    { sigla: 'CAEX-85', totalHoras: 12, tonAsociado: 0, incierto: false },
    { sigla: 'CF-511', totalHoras: 12, tonAsociado: 0, incierto: true },
    { sigla: 'XX-1', totalHoras: 1, tonAsociado: 0, incierto: false },
  ],
};

describe('reporteTurnoFilas', () => {
  it('una fila por equipo de las cinco tablas, en orden, con su categoría', () => {
    const f = reporteTurnoFilas(datos);
    expect(f.map((x) => x.categoria)).toEqual(['CAEX', 'CAEX', 'Carguio', 'Carguio', 'Apoyo', 'PerdidaPetroleo', 'PerdidaIndisponibilidad', 'PerdidaIndisponibilidad', 'PerdidaIndisponibilidad']);
  });

  it('CAEX: conserva vueltas/ciclo/ton y el «fuera de servicio» sin inventar horas', () => {
    const [fuera, ok] = reporteTurnoFilas(datos);
    expect(fuera.fila.totalHoras).toBeNull();
    expect(fuera.fila.estadoTexto).toBe('fuera de servicio');
    expect(fuera.fila.operador).toBeNull();
    expect(ok.fila).toMatchObject({ categoria: 'CAEX', vueltas: 41, rendimientoVueltasHr: 5.6, tiempoCicloMin: 10.7, tonVuelta: 90, totalTon: 3690, operador: 'NESTOR MENESES', horometroInicial: 21258.5 });
  });

  it('Carguío: tonelaje→totalTon, rendimiento→tonHr, postura y operador', () => {
    const c = reporteTurnoFilas(datos).filter((x) => x.categoria === 'Carguio')[0].fila;
    expect(c).toMatchObject({ totalTon: 8256, tonHr: 1162.8, postura: 'F11 M6', operador: 'EMILIO PAEZ', totalHoras: 7.1 });
    expect(c.vueltas).toBeNull();
    expect(c.tiempoCicloMin).toBeNull();
  });

  it('Apoyo: área de trabajo; Petróleo: horas del reloj como texto, sin horómetro', () => {
    const ap = reporteTurnoFilas(datos).filter((x) => x.categoria === 'Apoyo')[0].fila;
    expect(ap.areaTrabajo).toBe('B2');
    const pe = reporteTurnoFilas(datos).filter((x) => x.categoria === 'PerdidaPetroleo')[0].fila;
    expect(pe).toMatchObject({ horaInicio: '10:25', horaFin: '12:20', totalHoras: 1.92, tonAsociadoPerdida: 0, horometroInicial: null, operador: null });
  });

  it('Indisponibilidad: ton asociado→tonAsociadoPerdida y la marca de dudoso se conserva', () => {
    const ind = reporteTurnoFilas(datos).filter((x) => x.categoria === 'PerdidaIndisponibilidad');
    expect(ind[1].fila.tonAsociadoPerdida).toBe(0);
    expect(ind[1].incierto).toBe(true);
    expect(ind[0].fila.tonAsociadoPerdida).toBe(0);
  });

  it('entradas vacías o ausentes no rompen, y los textos numéricos no se aceptan como número', () => {
    expect(reporteTurnoFilas({})).toEqual([]);
    expect(reporteTurnoFilas(null)).toEqual([]);
    const f = reporteTurnoFilas({ caex: [{ sigla: 'CN-1', totalHoras: '7,3', incierto: false }] });
    expect(f[0].fila.totalHoras).toBeNull();
  });
});

describe('reporteTurnoResolverSiglas', () => {
  const flota = { 'CN-9503': 'CN-9503', 'CN-9501': 'CN-9501', 'CF-9511': 'CF-9511', 'CF-9510': 'CF-9510', 'BD-9509': 'BD-9509' };
  const buscar = (s) => flota[s] || null;

  it('las tablas con sigla real la resuelven directo; Petróleo e Indisponibilidad usan el apodo de las otras filas del mismo reporte', () => {
    const r = reporteTurnoResolverSiglas(reporteTurnoFilas(datos), buscar);
    const por = (cat) => r.filter((x) => x.categoria === cat).map((x) => x.siglaSugerida);
    expect(por('CAEX')).toEqual(['CN-9503', 'CN-9501']);
    expect(por('PerdidaPetroleo')).toEqual(['CN-9501']);                       // CAEX-86 = CN-9501
    expect(por('PerdidaIndisponibilidad')).toEqual(['CN-9503', 'CF-9511', null]); // CAEX-85 = CN-9503; CF-511 por su sigla; XX-1 desconocido
  });

  it('un apodo ambiguo (dos equipos distintos con el mismo nombre corto) no se adivina', () => {
    const d = {
      caex: [{ sigla: 'CN-1', equipoNombre: 'CAEX-9', incierto: false }, { sigla: 'CN-2', equipoNombre: 'CAEX-9', incierto: false }],
      perdidaPetroleo: [{ equipoNombre: 'CAEX-9', totalHoras: 1, incierto: false }],
    };
    const r = reporteTurnoResolverSiglas(reporteTurnoFilas(d), (s) => s);
    expect(r.filter((x) => x.categoria === 'PerdidaPetroleo')[0].siglaSugerida).toBeNull();
  });
});
