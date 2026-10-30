import { describe, it, expect } from 'vitest';
import { reporteTurnoFilas, reporteTurnoFilaDudosa, reporteTurnoContrasteHorometro, reporteTurnoAlias, reporteTurnoTotalesDudosos, reporteTurnoResolverSiglas } from '../logic.js';

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

describe('papeles de abril: errores de horómetro y totales de carguío', () => {
  it('CF-511 del 05-04 noche (horas -125990,9) marca la fila y los totales de carguío negativos se avisan', () => {
    expect(reporteTurnoFilaDudosa({ horometroInicial: 139973, horometroFinal: 13982.1, totalHoras: -125990.9 }, 'Carguio')).toBe(true);
    expect(reporteTurnoTotalesDudosos({ totalHorasCF: -125985.4, rendimientoCFTonHr: -0.2 }).map((x) => x.campo)).toEqual(['totalHorasCF', 'rendimientoCFTonHr']);
  });
  it('ciclo medio de 33,5 min y 129,8 h CAEX (29-03 día) se avisan; 17 min de ciclo normal no', () => {
    expect(reporteTurnoTotalesDudosos({ tiempoMedioCicloMin: 33.5, totalHorasCaex: 129.8 }).map((x) => x.campo)).toEqual(['tiempoMedioCicloMin', 'totalHorasCaex']);
    expect(reporteTurnoTotalesDudosos({ tiempoMedioCicloMin: 17.5, totalHorasCaex: 41 })).toEqual([]);
  });
  it('los apodos CAEX-155 y CAEX-159 se traducen (CE-155 → CN-10155, CE-159 → CN-10159)', () => {
    expect(reporteTurnoAlias('CAEX-155')).toBe('CN-10155');
    expect(reporteTurnoAlias('CAEX-159')).toBe('CN-10159');
  });
  it('CN-5131 con 9002,2 horas y horómetro 1648 → 10650,2 se marca', () => {
    expect(reporteTurnoFilaDudosa({ horometroInicial: 1648, horometroFinal: 10650.2, totalHoras: 9002.2 }, 'Apoyo')).toBe(true);
  });
});

describe('papeles de abril: fórmulas rotas del Excel', () => {
  it('rendimiento de carguío arrastrado de otro turno (5909 con 8976 t en 8 h) marca la fila; uno coherente no', () => {
    expect(reporteTurnoFilaDudosa({ totalHoras: 8, tonelaje: 8976, rendimientoTonHr: 5909 }, 'Carguio')).toBe(true);
    expect(reporteTurnoFilaDudosa({ totalHoras: 7.1, tonelaje: 8256, rendimientoTonHr: 1162.8 }, 'Carguio')).toBe(false);
    expect(reporteTurnoFilaDudosa({ totalHoras: 9.1, tonelaje: null, rendimientoTonHr: 0 }, 'Carguio')).toBe(false);
  });
  it('rendimiento de vueltas que no es vueltas ÷ horas marca la fila CAEX', () => {
    expect(reporteTurnoFilaDudosa({ vueltas: 48, totalHoras: 8.7, rendimientoVueltasHr: 5.5, tonVuelta: 90, totalTon: 4320 }, 'CAEX')).toBe(false);
    expect(reporteTurnoFilaDudosa({ vueltas: 18, totalHoras: 3.1, rendimientoVueltasHr: 0, tonVuelta: 90, totalTon: 1620 }, 'CAEX')).toBe(true);
  });
  it('pérdida por petróleo: horas que no calzan con desde-hasta (11:00 AM con 11 h) marcan la fila; 8:00→10:25 = 2,42 h no', () => {
    expect(reporteTurnoFilaDudosa({ horaInicio: null, horaFin: null, totalHoras: 0 }, 'PerdidaPetroleo')).toBe(false);
    expect(reporteTurnoFilaDudosa({ horaInicio: '08:00', horaFin: '10:25', totalHoras: 2.42 }, 'PerdidaPetroleo')).toBe(false);
    expect(reporteTurnoFilaDudosa({ horaInicio: '09:00', horaFin: '13:00', totalHoras: 2 }, 'PerdidaPetroleo')).toBe(true);
  });
  it('indisponibilidad de 121 horas (22-04 día) se marca', () => {
    expect(reporteTurnoFilaDudosa({ totalHoras: 121, tonAsociado: 46671 }, 'PerdidaIndisponibilidad')).toBe(true);
  });
  it('totales del 24-04 día (ciclo 565,8; 1041,6 h; transporte 21) y del 21-04 noche se avisan; uno normal no', () => {
    const malo = { tiempoMedioCicloMin: 565.8, totalHorasCaex: 1041.6, rendimientoTransporteTonHr: 21, totalToneladas: 21690 };
    expect(reporteTurnoTotalesDudosos(malo).map((x) => x.campo)).toEqual(['tiempoMedioCicloMin', 'totalHorasCaex']);
    expect(reporteTurnoTotalesDudosos({ totalToneladas: 20880, totalHorasCaex: 44.6, rendimientoTransporteTonHr: 400 }).map((x) => x.campo)).toEqual(['rendimientoTransporteTonHr']);
    expect(reporteTurnoTotalesDudosos({ totalToneladas: 20880, totalHorasCaex: 44.6, rendimientoTransporteTonHr: 468 })).toEqual([]);
  });
  it('CAEX-115 es el CAEX-155 (CN-10155); CF-769 y CAEX-159 se traducen', () => {
    expect(reporteTurnoAlias('CAEX-115')).toBe('CN-10155');
    expect(reporteTurnoAlias('CF-769')).toBe('CF-8769');
    expect(reporteTurnoAlias('CAEX-159')).toBe('CN-10159');
  });
});

describe('papeles del 14 al 29 de abril', () => {
  it('«fuera de servicio» con toneladas (CF-511 del 18-04: 8970 t) marca la fila; sin producción no', () => {
    expect(reporteTurnoFilaDudosa({ estadoTexto: 'fuera de servicio', totalHoras: 0, tonelaje: 8970 }, 'Carguio')).toBe(true);
    expect(reporteTurnoFilaDudosa({ estadoTexto: 'fuera de servicio', totalHoras: 0, tonelaje: null }, 'Carguio')).toBe(false);
  });
  it('petróleo con 11 h y solo la hora de inicio (22-04 día) marca la fila', () => {
    expect(reporteTurnoFilaDudosa({ horaInicio: '11:00', horaFin: null, totalHoras: 11 }, 'PerdidaPetroleo')).toBe(true);
  });
  it('horómetro inicial sin final y horas -11069 (25-04 día) marca la fila', () => {
    expect(reporteTurnoFilaDudosa({ horometroInicial: 11069, horometroFinal: null, totalHoras: -11069 }, 'Apoyo')).toBe(true);
  });
  it('un camión con 37,4 h (17-04 día) contamina los totales: 76,6 h, ciclo 17,4 y transporte 307 se avisan', () => {
    const d = { totalToneladas: 23490, totalHorasCaex: 76.6, tiempoMedioCicloMin: 17.4, rendimientoTransporteTonHr: 307, caex: [{ totalHoras: 9 }, { totalHoras: 37.4 }] };
    expect(reporteTurnoTotalesDudosos(d).map((x) => x.campo).sort()).toEqual(['rendimientoTransporteTonHr', 'tiempoMedioCicloMin', 'totalHorasCaex']);
    expect(reporteTurnoTotalesDudosos({ ...d, caex: [{ totalHoras: 9 }, { totalHoras: 8 }], totalHorasCaex: 47.4, tiempoMedioCicloMin: 10.6, rendimientoTransporteTonHr: 495, totalToneladas: 23490 })).toEqual([]);
  });
  it('los apodos pegados («CAEX155», «CAEX 85») también se traducen', () => {
    expect(reporteTurnoAlias('CAEX155')).toBe('CN-10155');
    expect(reporteTurnoAlias('CAEX 85')).toBe('CN-9503');
    expect(reporteTurnoAlias('CF-679')).toBeNull();
  });
});

describe('reporteTurnoContrasteHorometro (contra la pestaña Horómetros)', () => {
  const hist = [
    { sigla: 'CN-9503', fecha: '2026-08-10', horomIni: 21258.5, horomFin: 21265.8, horom: 21265.8 },
    { sigla: 'CN-9503', fecha: '2026-08-12', horomFin: 21280, horom: 21280 },
    { sigla: 'CF-9510', fecha: '2026-08-10', horomFin: 15653.6, horom: 15653.6 },
  ];
  it('un horómetro del papel que coincide con el del sistema cuadra', () => {
    expect(reporteTurnoContrasteHorometro('CN-9503', '2026-08-10', 21265.8, hist)).toMatchObject({ estado: 'ok', horomSistema: 21265.8 });
  });
  it('un dígito de más (208585,5) no cuadra y muestra el valor del sistema', () => {
    expect(reporteTurnoContrasteHorometro('CN-9503', '2026-08-10', 208585.5, hist)).toMatchObject({ estado: 'no-cuadra', horomSistema: 21265.8, fechaSistema: '2026-08-10' });
  });
  it('usa la lectura más cercana y deja holgura por los días de distancia', () => {
    expect(reporteTurnoContrasteHorometro('CN-9503', '2026-08-11', 21272, hist).estado).toBe('ok');
    expect(reporteTurnoContrasteHorometro('CN-9503', '2026-08-11', 21400, hist).estado).toBe('no-cuadra');
  });
  it('sin lectura cercana (más de 3 días), sin sigla o sin horómetro no se marca nada', () => {
    expect(reporteTurnoContrasteHorometro('CN-9503', '2026-04-08', 21260, hist).estado).toBe('sin-dato');
    expect(reporteTurnoContrasteHorometro(null, '2026-08-10', 21260, hist).estado).toBe('sin-dato');
    expect(reporteTurnoContrasteHorometro('CN-9503', '2026-08-10', null, hist).estado).toBe('sin-dato');
    expect(reporteTurnoContrasteHorometro('CN-9999', '2026-08-10', 100, hist).estado).toBe('sin-dato');
  });
});

describe('papeles del 29-04 al 09-05', () => {
  it('petróleo que cruza la medianoche (20:00 → 08:00 = 12 h; 20:00 → 22:30 = 2,5 h) no se marca; uno que no calza sí', () => {
    expect(reporteTurnoFilaDudosa({ horaInicio: '20:00', horaFin: '08:00', totalHoras: 12 }, 'PerdidaPetroleo')).toBe(false);
    expect(reporteTurnoFilaDudosa({ horaInicio: '20:00', horaFin: '22:30', totalHoras: 2.5 }, 'PerdidaPetroleo')).toBe(false);
    expect(reporteTurnoFilaDudosa({ horaInicio: '08:00', horaFin: '20:00', totalHoras: 5 }, 'PerdidaPetroleo')).toBe(true);
  });
  it('carguío con toneladas y 0 horas (08-05 día) se marca', () => {
    expect(reporteTurnoFilaDudosa({ totalHoras: 0, tonelaje: 13858, rendimientoTonHr: 0 }, 'Carguio')).toBe(true);
    expect(reporteTurnoFilaDudosa({ totalHoras: 7.3, tonelaje: null, rendimientoTonHr: 0 }, 'Carguio')).toBe(false);
  });
  it('totales de carguío del 08-05 (13.858 t con 0 h y rendimiento 0) y del 06-05 (119 vueltas con 0 t) se avisan', () => {
    expect(reporteTurnoTotalesDudosos({ totalTonCF: 13858, totalHorasCF: 0, rendimientoCFTonHr: 0, vueltasCF: 139 }).map((x) => x.campo).sort()).toEqual(['rendimientoCFTonHr', 'totalHorasCF']);
    expect(reporteTurnoTotalesDudosos({ totalTonCF: 0, totalHorasCF: 7.3, vueltasCF: 119, rendimientoCFTonHr: 0 }).map((x) => x.campo)).toEqual(['totalTonCF']);
    expect(reporteTurnoTotalesDudosos({ totalTonCF: 17975, totalHorasCF: 13.6, rendimientoCFTonHr: 1321.7, vueltasCF: 188 })).toEqual([]);
  });
});
