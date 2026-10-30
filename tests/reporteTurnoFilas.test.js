import { describe, it, expect } from 'vitest';
import { reporteTurnoFilas, reporteTurnoFilaDudosa, reporteTurnoAlias, reporteTurnoTotalesDudosos, reporteTurnoResolverSiglas } from '../logic.js';

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
    const r = reporteTurnoResolverSiglas(reporteTurnoFilas(d), (s) => (s === 'CN-1' || s === 'CN-2' ? s : null));
    expect(r.filter((x) => x.categoria === 'PerdidaPetroleo')[0].siglaSugerida).toBeNull();
  });
});

describe('reporteTurnoFilaDudosa (errores de digitación del papel)', () => {
  it('una fila coherente no se marca', () => {
    expect(reporteTurnoFilaDudosa({ horometroInicial: 23099.1, horometroFinal: 23107.4, totalHoras: 8.3, vueltas: 44, tonVuelta: 90, totalTon: 3960 }, 'CAEX')).toBe(false);
  });
  it('horómetro final con un dígito de más (CAEX-85 del 10-03 noche: 208585,5) se marca', () => {
    expect(reporteTurnoFilaDudosa({ horometroInicial: 20849.3, horometroFinal: 208585.5, totalHoras: 187736.2 }, 'CAEX')).toBe(true);
  });
  it('horas negativas (CN-5131 del 05-03 noche: -4,2) se marcan', () => {
    expect(reporteTurnoFilaDudosa({ horometroInicial: 10488.5, horometroFinal: 10484.3, totalHoras: -4.2 }, 'Apoyo')).toBe(true);
  });
  it('horas que no coinciden con el avance del horómetro se marcan', () => {
    expect(reporteTurnoFilaDudosa({ horometroInicial: 100, horometroFinal: 108, totalHoras: 3 }, 'Apoyo')).toBe(true);
  });
  it('toneladas que no son vueltas × ton/vuelta se marcan; sin datos suficientes no se marca', () => {
    expect(reporteTurnoFilaDudosa({ vueltas: 41, tonVuelta: 90, totalTon: 5000 }, 'CAEX')).toBe(true);
    expect(reporteTurnoFilaDudosa({ totalHoras: null, estadoTexto: 'fuera de servicio' }, 'CAEX')).toBe(false);
  });
  it('reporteTurnoFilas conserva la marca en la fila resultante', () => {
    const f = reporteTurnoFilas({ apoyo: [{ sigla: 'CN-5131', horometroInicial: 10488.5, horometroFinal: 10484.3, totalHoras: -4.2, incierto: false }] });
    expect(f[0].incierto).toBe(true);
  });
});

describe('papeles de marzo/abril 2026: solo el apodo, sin sigla', () => {
  const flota = ['CN-9503', 'CN-9501', 'CN-9500', 'CN-9502', 'CN-9507', 'CF-9510', 'CF-9511', 'BD-9533', 'BD-9509', 'BD-10139', 'CN-5131', 'CN-5133', 'MN-6112', 'MN-5926'];
  const buscar = (s) => (flota.includes(s) ? s : null);
  it('traduce el apodo con la tabla de la reportabilidad', () => {
    expect(reporteTurnoAlias('CAEX-85')).toBe('CN-9503');
    expect(reporteTurnoAlias('CAEX-89')).toBe('CN-9507');
    expect(reporteTurnoAlias('CF-510')).toBe('CF-9510');
    expect(reporteTurnoAlias('BD-139')).toBe('BD-10139');
    expect(reporteTurnoAlias('CAEX-56')).toBeNull();
  });
  it('resuelve todas las tablas desde solo «Equipo»; los equipos que el sistema no tiene quedan sin asignar', () => {
    const d = {
      caex: [{ equipoNombre: 'CAEX-85', totalHoras: 8.7, incierto: false }, { equipoNombre: 'CAEX-56', totalHoras: 8.2, incierto: false }, { equipoNombre: 'CAEX-115', incierto: false }],
      carguio: [{ equipoNombre: 'CF-510', totalHoras: 9.3, incierto: false }],
      apoyo: [{ equipoNombre: 'BD-533', incierto: false }, { equipoNombre: 'CN-5131', incierto: false }, { equipoNombre: 'MN-12', incierto: false }, { equipoNombre: 'MN-92', incierto: false }],
      perdidaPetroleo: [{ equipoNombre: 'CAEX-86', horaInicio: '16:20', horaFin: '18:00', totalHoras: 1.67, tonAsociado: 838.2, incierto: false }],
      perdidaIndisponibilidad: [{ sigla: 'CAEX-89', totalHoras: 12, tonAsociado: 5994, incierto: false }],
    };
    const r = reporteTurnoResolverSiglas(reporteTurnoFilas(d), buscar).map((x) => x.siglaSugerida);
    expect(r).toEqual(['CN-9503', null, null, 'CF-9510', 'BD-9533', 'CN-5131', 'MN-6112', null, 'CN-9501', 'CN-9507']);
  });
  it('carguío con tonelaje en blanco y rendimiento 0,0 queda sin dato (no una producción de cero)', () => {
    const f = reporteTurnoFilas({ carguio: [{ equipoNombre: 'CF-510', totalHoras: 7.4, tonelaje: null, rendimientoTonHr: 0, incierto: false }] })[0].fila;
    expect(f.totalTon).toBeNull();
    expect(f.tonHr).toBeNull();
    expect(f.totalHoras).toBe(7.4);
  });
  it('más de 13 horas en un turno (CF-511 del 10-03 día: 20,4) se marca', () => {
    expect(reporteTurnoFilaDudosa({ horometroInicial: 13515.8, horometroFinal: 13536.2, totalHoras: 20.4 }, 'Carguio')).toBe(true);
  });
});

describe('reporteTurnoTotalesDudosos (turno noche del 10-03: totales con error de Excel)', () => {
  it('detecta ciclo de 47941 min, 187771 horas y rendimientos en 0 con producción', () => {
    const d = { tiempoMedioCicloMin: 47941.6, totalHorasCaex: 187771.1, rendimientoCaexVueltasHr: 0, totalVueltas: 234, rendimientoTransporteTonHr: 0, totalToneladas: 21060 };
    expect(reporteTurnoTotalesDudosos(d).map((x) => x.campo)).toEqual(['tiempoMedioCicloMin', 'totalHorasCaex', 'rendimientoCaexVueltasHr', 'rendimientoTransporteTonHr']);
  });
  it('un reporte normal no marca nada', () => {
    expect(reporteTurnoTotalesDudosos({ tiempoMedioCicloMin: 11.7, totalHorasCaex: 44.4, rendimientoCaexVueltasHr: 5.1, totalVueltas: 228, rendimientoTransporteTonHr: 462, totalToneladas: 20520 })).toEqual([]);
    expect(reporteTurnoTotalesDudosos(null)).toEqual([]);
  });
});

describe('errores de Excel de los papeles de marzo (valores negativos)', () => {
  it('toneladas perdidas negativas (CAEX-88 del 29-03 noche: -5204) marcan la fila', () => {
    expect(reporteTurnoFilaDudosa({ totalHoras: 12, tonAsociado: -5204 }, 'PerdidaIndisponibilidad')).toBe(true);
  });
  it('un horómetro final menor que el inicial (CAEX-87: 18871 → 18789,5) marca la fila', () => {
    expect(reporteTurnoFilaDudosa({ horometroInicial: 18871, horometroFinal: 18789.5, totalHoras: -81.5 }, 'CAEX')).toBe(true);
  });
  it('totales negativos (ciclo -11,5; horas -46,9; transporte -434) se avisan y no se guardan', () => {
    const d = { tiempoMedioCicloMin: -11.5, totalHorasCaex: -46.9, rendimientoCaexVueltasHr: -4.8, rendimientoTransporteTonHr: -434, totalToneladas: 20340 };
    expect(reporteTurnoTotalesDudosos(d).map((x) => x.campo)).toEqual(['tiempoMedioCicloMin', 'totalHorasCaex', 'rendimientoCaexVueltasHr', 'rendimientoTransporteTonHr']);
  });
});
