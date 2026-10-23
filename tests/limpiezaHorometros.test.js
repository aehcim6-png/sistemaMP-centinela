// Limpieza asistida de horómetros (2026-10-24): qué lecturas son creíbles y qué se propone con las dudosas. Funciones puras: no cambian nada.
// Las series «reales» son tramos copiados de historial_horometros (proyecto SistemaMP, consulta del 23-oct-2026), con los errores tal como estaban.
import { describe, it, expect } from 'vitest';
import { cadenaLecturasHorometro, candidatosDigitacion, diagnosticarHorometros, coberturaRegistro, valorLecturaHorometro, C } from '../logic.js';

// 'AAMMDD:valor,...' → filas de historial (misma fecha: en el orden dado)
const iso = (t) => `20${t.slice(0, 2)}-${t.slice(2, 4)}-${t.slice(4, 6)}`;
const serie = (sigla, texto) => texto.split(',').map((tok, i) => { const [f, v] = tok.split(':'); return { _id: `${sigla}#${i}`, sigla, fecha: iso(f), horomFin: Number(v) }; });
const L = (texto) => texto.split(',').map((tok) => { const [f, v] = tok.split(':'); return { fecha: iso(f), valor: Number(v) }; });

describe('cadenaLecturasHorometro', () => {
  it('una serie normal queda entera, en orden de fecha', () => {
    const r = cadenaLecturasHorometro(L('260101:100,260102:110,260103:120'), 12);
    expect(r.cadena).toEqual([0, 1, 2]);
    expect(r.fuera).toEqual([]);
  });
  it('un 0 de relleno al inicio ya no hace descartar todas las lecturas reales siguientes', () => {
    const r = cadenaLecturasHorometro(L('260101:0,260102:0,260103:0,260328:20506,260419:20750,260507:21026'), 16);
    expect(r.sinDato).toEqual([0, 1, 2]);
    expect(r.cadena).toEqual([3, 4, 5]);
  });
  it('una lectura mala al comienzo de la serie se descarta y no arrastra a las buenas', () => {
    const r = cadenaLecturasHorometro(L('260101:99999,260102:100,260103:110,260104:121'), 12);
    expect(r.fuera).toEqual([0]);
    expect(r.cadena).toEqual([1, 2, 3]);
  });
  it('un salto imposible en medio se descarta y la serie sigue', () => {
    const r = cadenaLecturasHorometro(L('260126:17833,260127:178845,260205:17950'), 12);
    expect(r.cadena).toEqual([0, 2]);
    expect(r.fuera).toEqual([1]);
  });
  it('el tope usa el ritmo del equipo: un bus en km (300/día) no se descarta con la regla de 12 h/día', () => {
    const km = L('250907:340000,251207:371000,260104:381000');
    expect(cadenaLecturasHorometro(km, 12).cadena.length).toBeLessThan(3);
    expect(cadenaLecturasHorometro(km, 300).cadena).toEqual([0, 1, 2]);
  });
  it('dos lecturas el mismo día en cualquier orden no se tratan como retroceso', () => {
    const r = cadenaLecturasHorometro(L('260101:19800,260101:19792,260102:19807,260102:19800'), 16);
    expect(r.fuera).toEqual([]);
    expect(r.cadena.length).toBe(4);
  });
  it('empate entre dos lecturas incompatibles: se conserva la más antigua (como el filtro anterior)', () => {
    const r = cadenaLecturasHorometro(L('260101:5000,260110:4800,260120:5100'), 12);
    expect(r.cadena).toEqual([0, 2]);
  });
  it('sin lecturas o con fechas inválidas no falla', () => {
    expect(cadenaLecturasHorometro([], 12).cadena).toEqual([]);
    expect(cadenaLecturasHorometro(null).cadena).toEqual([]);
    expect(cadenaLecturasHorometro([{ fecha: 'mal', valor: 5 }], 12).cadena).toEqual([]);
  });
});

describe('C.lecturasValidas / C.horomHistorico con la cadena', () => {
  it('con ceros iniciales devuelve las lecturas reales (antes devolvía solo ceros)', () => {
    const hist = serie('TI-5144', '260301:0,260302:0,260303:0,260415:18720,260506:19000');
    expect(C.lecturasValidas(hist, 'TI-5144', 16).map((h) => h.horomFin)).toEqual([18720, 19000]);
    expect(C.horomHistorico(hist, 'TI-5144', '2026-05-10', 16)).toBe(19000);
    expect(C.horomHistorico(hist, 'TI-5144', '2026-03-10', 16)).toBeNull();
  });
  it('misma fecha: el horómetro de ese día es el mayor de las lecturas del día', () => {
    const hist = serie('A-1', '260101:19792,260101:19800');
    expect(C.horomHistorico(hist, 'A-1', '2026-01-01')).toBe(19800);
  });
});

describe('candidatosDigitacion', () => {
  it('dígito de menos: 1492 → 14092 si es lo único que cabe entre sus vecinos', () => {
    expect(candidatosDigitacion(1492, 14082, 14100)).toEqual([14092]);
  });
  it('dígito de más: 2264 → 264', () => {
    expect(candidatosDigitacion(2264, 255, 271)).toEqual([264]);
  });
  it('dígito cambiado: 22585 → 22685', () => {
    expect(candidatosDigitacion(22585, 22680, 22685)).toEqual([22685]);
  });
  it('dos dígitos intercambiados: 1243 → 1234', () => {
    expect(candidatosDigitacion(1243, 1234, 1234)).toEqual([1234]);
  });
  it('no inventa: sin candidato dentro del rango, o con decimales, devuelve vacío', () => {
    expect(candidatosDigitacion(15250, 15160, 15190)).toEqual([]);
    expect(candidatosDigitacion(9028.9, 9000, 9100)).toEqual([]);
    expect(candidatosDigitacion(0, 0, 10)).toEqual([]);
  });
});

describe('diagnosticarHorometros con tramos reales', () => {
  const eq = [{ sigla: 'CF-8769', hrsDia: 16 }, { sigla: 'CF-9510', hrsDia: 16 }, { sigla: 'CN-4656', hrsDia: 16 }, { sigla: 'BS-5752', hrsDia: 300 }, { sigla: 'CN-9502', hrsDia: 12 },
    { sigla: 'CN-5131', hrsDia: 12 }, { sigla: 'CN-5133', hrsDia: 16 }, { sigla: 'TI-5144', hrsDia: 16 }, { sigla: 'CN-6113', hrsDia: 12 }];
  const hist = [
    ...serie('CF-8769', '260209:14082,260209:14074,260210:1492,260210:14100,260211:14103,260211:14112'),
    ...serie('CF-9510', '260205:13133,260205:13133,260206:13133,260206:13033,260207:13133,260207:13033,260208:13033,260208:13133'),
    ...serie('CN-4656', '260205:22680,260205:22680,260206:22685,260206:22585,260207:22693,260207:22698'),
    ...serie('BS-5752', '250907:340000,251005:3510000,251102:3610000,251207:371000,260104:381000,260208:390204'),
    ...serie('CN-9502', '260215:0,260216:0,260222:16012,260222:16008,260527:16783,260623:16842,260624:16843,260823:6955,260824:6956'),
    ...serie('CN-5131', '260209:0,260209:10419,260210:10420,260210:10419,260211:12919,260211:12921,260212:10426,260212:10425'),
    ...serie('CN-5133', '260210:12916,260210:12916,260211:10422,260211:10422,260212:12923,260212:12923'),
    ...serie('TI-5144', '260301:0,260303:0,260303:18232,260304:0,260415:18720,260506:19000'),
    ...serie('CN-6113', '260101:9212,260102:9212,260103:9212'),
  ];
  const d = diagnosticarHorometros(hist, eq);
  const de = (s) => d.equipos.find((e) => e.sigla === s);
  const prop = (s, fecha, valor) => de(s).propuestas.find((p) => p.fecha === fecha && p.valor === valor);

  it('un dígito de menos con una sola corrección posible se propone corregir, con confianza alta si la ventana es angosta', () => {
    const p = prop('CF-8769', '2026-02-10', 1492);
    expect(p.tipo).toBe('corregir');
    expect(p.corregido).toBe(14092);
    expect(p.confianza).toBe('alta');
    expect(p.previo.valor).toBe(14082);
    expect(p.siguiente.valor).toBe(14100);
  });
  it('el dígito cambiado 13033 (en vez de 13133) y 22585 (en vez de 22685) se propone corregir', () => {
    de('CF-9510').propuestas.filter((p) => p.valor === 13033).forEach((p) => { expect(p.tipo).toBe('corregir'); expect(p.corregido).toBe(13133); });
    expect(prop('CN-4656', '2026-02-06', 22585).corregido).toBe(22685);
  });
  it('un dígito de más en un bus (3510000) tiene dos correcciones posibles y no se elige ninguna: se propone eliminar', () => {
    const p = prop('BS-5752', '2025-10-05', 3510000);
    expect(p.tipo).toBe('descartar');
    expect(p.corregido).toBeNull();
    expect(p.motivo).toMatch(/no se elige/);
    expect(de('BS-5752').validas).toBe(4);
  });
  it('lecturas que son un 10000 de menos (6955 en vez de 16955) se proponen con confianza media', () => {
    const p = prop('CN-9502', '2026-08-23', 6955);
    expect(p.tipo).toBe('corregir');
    expect(p.corregido).toBe(16955);
    expect(p.confianza).toBe('media');
  });
  it('lecturas intercambiadas entre dos equipos el mismo día se corrigen juntas (mismo grupo)', () => {
    const a = de('CN-5131').propuestas.filter((p) => p.tipo === 'intercambiar'), b = de('CN-5133').propuestas.filter((p) => p.tipo === 'intercambiar');
    expect(a.map((p) => p.valor).sort()).toEqual([12919, 12921]);
    expect(b.map((p) => p.valor)).toEqual([10422, 10422]);
    expect(a.every((p) => p.corregido === 10422)).toBe(true);
    expect(b.map((p) => p.corregido).sort()).toEqual([12919, 12921]);
    expect(new Set([...a, ...b].map((p) => p.grupo)).size).toBe(1);
  });
  it('los ceros de relleno se cuentan aparte, no son errores de la persona, y no bloquean las lecturas reales', () => {
    expect(de('TI-5144').sinDato).toBe(3);
    expect(de('TI-5144').validas).toBe(3);
    expect(de('TI-5144').propuestas.filter((p) => p.tipo === 'sin_dato').length).toBe(3);
    expect(de('TI-5144').propuestas.filter((p) => p.tipo !== 'sin_dato')).toEqual([]);
  });
  it('un equipo sin problemas no genera propuestas', () => {
    expect(de('CN-6113').propuestas).toEqual([]);
    expect(de('CN-6113').validas).toBe(3);
  });
  it('totales coherentes y ninguna propuesta cambia las filas originales', () => {
    const t = d.total;
    expect(t.lecturas).toBe(hist.length);
    expect(t.validas + t.sinDato + t.descartadas).toBe(t.lecturas);
    expect(hist.find((h) => h._id === 'CF-8769#2').horomFin).toBe(1492);
  });
});

describe('diagnosticarHorometros: ruido, bloques y reinicios', () => {
  it('una diferencia de menos de un día de uso (dos lecturas del mismo día en otro orden) no se propone, solo se cuenta', () => {
    const d = diagnosticarHorometros(serie('A-1', '260114:13838,260115:13846,260115:13837,260116:13850'), [{ sigla: 'A-1', hrsDia: 16 }]);
    expect(d.equipos[0].propuestas).toEqual([]);
    expect(d.equipos[0].ruido).toBe(1);
  });
  it('varias lecturas seguidas que forman su propia serie (cambio de horómetro) se piden revisar a mano, sin corrección', () => {
    const base = '260101:20000,260102:20010,260103:20020,260104:20030,260105:20040,260106:20050,260107:20060,260108:20070';
    const nuevo = '260109:100,260110:112,260111:125,260112:137';
    const d = diagnosticarHorometros(serie('B-1', `${base},${nuevo}`), [{ sigla: 'B-1', hrsDia: 12 }]);
    const rev = d.equipos[0].propuestas;
    expect(rev.length).toBe(4);
    expect(rev.every((p) => p.tipo === 'revisar' && p.corregido === null)).toBe(true);
    expect(rev[0].motivo).toMatch(/cambio o reinicio/);
  });
  it('entradas vacías no fallan', () => {
    expect(diagnosticarHorometros([], []).total.lecturas).toBe(0);
    expect(diagnosticarHorometros(null, null).equipos).toEqual([]);
  });
});

describe('la cobertura no cuenta un 0 como lectura', () => {
  it('las filas de horómetro en 0 no suman días con registro', () => {
    const c = coberturaRegistro({ hist: [{ sigla: 'A', fecha: '2026-03-01', horomFin: 0 }, { sigla: 'A', fecha: '2026-03-02', horomFin: 1500 }] });
    expect(c.A).toEqual(['2026-03-02']);
  });
});

describe('valorLecturaHorometro: filas con horomFin = 0 pero la lectura en horom (610 filas reales)', () => {
  it('usa horomFin si es positivo, si no horom; 0 solo si ambos son 0; null si no hay número', () => {
    expect(valorLecturaHorometro({ horomFin: 19800, horom: 19800 })).toBe(19800);
    expect(valorLecturaHorometro({ horomFin: 0, horom: 17556, horomIni: 17556 })).toBe(17556);
    expect(valorLecturaHorometro({ horom: 940 })).toBe(940);
    expect(valorLecturaHorometro({ horomFin: 0, horom: 0 })).toBe(0);
    expect(valorLecturaHorometro({ horomFin: null, horom: null })).toBeNull();
    expect(valorLecturaHorometro(null)).toBeNull();
  });
  it('lecturasValidas y el diagnóstico las cuentan como lecturas (antes se tomaban por ceros de relleno)', () => {
    const hist = ['260101:17556', '260102:17556', '260103:17580', '260104:17589'].map((t, i) => { const [f, v] = t.split(':'); return { _id: 'r' + i, sigla: 'TI-5144', fecha: iso(f), horomIni: Number(v), horomFin: 0, horom: Number(v) }; });
    expect(C.lecturasValidas(hist, 'TI-5144', 16).map(valorLecturaHorometro)).toEqual([17556, 17556, 17580, 17589]);
    const d = diagnosticarHorometros(hist, [{ sigla: 'TI-5144', hrsDia: 16 }]);
    expect(d.total.sinDato).toBe(0);
    expect(d.equipos[0].propuestas).toEqual([]);
  });
  it('un error de digitación en la columna horom también se detecta (178845 en vez de 17845)', () => {
    const v = [17833, 178845, 17855];
    const hist = v.map((x, i) => ({ _id: 'r' + i, sigla: 'TI-5144', fecha: `2026-01-${26 + i}`, horomFin: 0, horom: x }));
    const p = diagnosticarHorometros(hist, [{ sigla: 'TI-5144', hrsDia: 16 }]).equipos[0].propuestas;
    expect(p.length).toBe(1);
    expect(p[0].tipo).toBe('corregir');
    expect(p[0].corregido).toBe(17845);
  });
  it('tres lecturas seguidas con el mismo error de digitación se corrigen una a una, no se piden revisar como si fueran otro horómetro', () => {
    const buenas = ['260301:17150', '260302:17160', '260303:17179', '260304:17187', '260305:17196'];
    const malas = ['260306:18206', '260307:18222', '260308:18234'];   // +1.000 de más
    const resto = ['260309:17246', '260310:17246', '260311:17266'];
    const hist = buenas.concat(malas, resto).map((t, i) => { const [f, v] = t.split(':'); return { _id: 'r' + i, sigla: 'TI-5145', fecha: iso(f), horomFin: 0, horom: Number(v) }; });
    const p = diagnosticarHorometros(hist, [{ sigla: 'TI-5145', hrsDia: 16 }]).equipos[0].propuestas;
    expect(p.map((x) => x.tipo)).toEqual(['corregir', 'corregir', 'corregir']);
    expect(p.map((x) => x.corregido)).toEqual([17206, 17222, 17234]);
  });
});
