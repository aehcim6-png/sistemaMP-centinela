import { describe, it, expect } from 'vitest';
import { chatWhatsAppMensajes, chatWhatsAppSigla, chatWhatsAppReportes, chatWhatsAppAnalizar } from '../logic.js';

const SIGLAS = ['CN-9503', 'CN-9501', 'CN-9502', 'CN-9507', 'CN-10159', 'CF-9510', 'CF-8769', 'BD-10139', 'MN-6112', 'MN-5926', 'CN-5131', 'CN-5133',
  'TI-5141', 'TI-5142', 'TI-9941', 'TI-9942', 'GE-10019'];

// Chat tal como lo exporta WhatsApp (día-mes-año, 2 dígitos).
const CHAT = [
  '03-12-24 21:30 - Los mensajes y las llamadas están cifrados de extremo a extremo.',
  '28-10-26 09:40 - Franz Werdenhausen: Equipo: CAEX 88',
  'Estatus: FS',
  'Motivo: Suspe pos 1 reventada.',
  'Horómetro: 23374',
  'Lugar: parqueo general',
  'Operador: Mauricio Contreras',
  '28-10-26 09:42 - Franz Werdenhausen: Corrección @⁨José Danilo⁩.',
  'CAEX 85',
  '28-10-26 19:03 - José Danilo: Equipo: CAEX 85',
  'Estatus: operativo',
  'Motivo: normalización de suspensión y limpieza',
  'Horómetro: 23380',
  'Lugar: parqueo general',
  '29-10-26 03:34 - +56 9 5528 6785: 03:00',
  'Equipo: CF 510',
  'Estatus: Fuera de servicio',
  'Motivo: Falla sistema de engrase',
  'Horómetro: 16210',
  '29-10-26 05:45 - Maicol Orostegui: Equipo: CF 510',
  'Estatus:operativo  Motivo: chequeo y reparación sistema engrase automático',
  'Horómetro: 16210',
  '29-10-26 07:20 - +56 9 5528 6785: TI 5141= 23.045',
  'TI 5142= 16731',
  'TI 9942= 166',
  'Gen OP.= 15028',
  '29-10-26 08:00 - Franz Werdenhausen: Equipo: MN 26',
  'Estatus: Backlog',
  'Motivo: foco mayor derecho no funciona.',
  'Horómetro: 9445',
  '29-10-26 09:00 - Franz Werdenhausen: Equipo: MN12',
  'Estatus: FS',
  'Motivo: evaluación de código E03',
  'Horómetro: xxxx',
  '29-10-26 20:10 - José Danilo: Equipo: CN-5131',
  'Estatus: operativo',
  'Motivo: mantencion programada PM2',
  'Horómetro: 12450',
  '30-10-26 17:55 - José Danilo: operativa TI-9941',
  '30-10-26 18:00 - Franz Werdenhausen: ¿hay factibilidad de dejar operativo el CF-510?',
  '30-10-26 18:10 - José Danilo: Operativo',
  '30-10-26 18:20 - Franz Werdenhausen: Equipo: TI-9941',
  'Estatus: FS',
  'Motivo: condensador en fallo',
  'Horómetro: XXX',
].join('\n');

describe('chatWhatsAppMensajes', () => {
  it('une las líneas de continuación al mensaje y descarta los avisos del sistema', () => {
    const m = chatWhatsAppMensajes(CHAT);
    expect(m[0]).toMatchObject({ f: '2026-10-28', h: '09:40', autor: 'Franz Werdenhausen' });
    expect(m[0].texto).toContain('Estatus: FS');
    expect(m[0].texto).toContain('Operador: Mauricio Contreras');
    expect(m.some(x => /cifrados/.test(x.texto))).toBe(false);
  });
  it('entiende el formato con barras, coma y a. m./p. m., y las entidades HTML', () => {
    const m = chatWhatsAppMensajes('28/10/2026, 9:05 p. m. - Ana: dos &lt;Multimedia omitido&gt;\n29/10/2026, 12:10 a. m. - Ana: hola');
    expect(m[0]).toMatchObject({ f: '2026-10-28', h: '21:05', autor: 'Ana', texto: 'dos <Multimedia omitido>' });
    expect(m[1]).toMatchObject({ f: '2026-10-29', h: '00:10' });
  });
  it('entrada vacía o sin formato no rompe', () => {
    expect(chatWhatsAppMensajes('')).toEqual([]);
    expect(chatWhatsAppMensajes(null)).toEqual([]);
    expect(chatWhatsAppMensajes('texto suelto sin fecha')).toEqual([]);
  });
});

describe('chatWhatsAppSigla', () => {
  it('traduce los apodos del chat a la sigla del sistema', () => {
    expect(chatWhatsAppSigla('CAEX 85', SIGLAS)).toBe('CN-9503');
    expect(chatWhatsAppSigla('CE-159', SIGLAS)).toBe('CN-10159');
    expect(chatWhatsAppSigla('CF 510', SIGLAS)).toBe('CF-9510');
    expect(chatWhatsAppSigla('MN12', SIGLAS)).toBe('MN-6112');
    expect(chatWhatsAppSigla('BD 139', SIGLAS)).toBe('BD-10139');
    expect(chatWhatsAppSigla('TI 5141', SIGLAS)).toBe('TI-5141');
  });
  it('«Aljibe 5131» y «CA5133» se resuelven por el número único; «Gen 10019» al generador', () => {
    expect(chatWhatsAppSigla('Aljibe 5131', SIGLAS)).toBe('CN-5131');
    expect(chatWhatsAppSigla('CA5133', SIGLAS)).toBe('CN-5133');
    expect(chatWhatsAppSigla('GEN-10019', SIGLAS)).toBe('GE-10019');
  });
  it('lo que no está en el sistema o es ambiguo da null', () => {
    expect(chatWhatsAppSigla('Aljibe 73', SIGLAS)).toBeNull();
    expect(chatWhatsAppSigla('MN 92', SIGLAS)).toBeNull();
    expect(chatWhatsAppSigla('86', SIGLAS)).toBeNull();
    expect(chatWhatsAppSigla('', SIGLAS)).toBeNull();
    expect(chatWhatsAppSigla(null, SIGLAS)).toBeNull();
  });
});

describe('chatWhatsAppReportes', () => {
  const R = chatWhatsAppReportes(chatWhatsAppMensajes(CHAT), SIGLAS);
  it('lee la plantilla completa y clasifica el estatus', () => {
    const a = R.reportes.find(r => r.motivo.startsWith('Falla sistema de engrase'));
    expect(a).toMatchObject({ sigla: 'CF-9510', estatus: 'fs', horom: 16210, hint: '03:00' });
    expect(R.reportes.find(r => r.sigla === 'MN-5926').estatus).toBe('backlog');
  });
  it('lee los campos aunque vengan en la misma línea', () => {
    const b = R.reportes.find(r => r.motivo.startsWith('chequeo y reparación'));
    expect(b).toMatchObject({ sigla: 'CF-9510', estatus: 'operativo' });
  });
  it('«Horómetro: xxxx» queda sin valor', () => {
    expect(R.reportes.find(r => r.sigla === 'MN-6112').horom).toBeNull();
  });
  it('la «Corrección» del mismo autor cambia el equipo del aviso de su familia', () => {
    const c = R.reportes.find(r => r.motivo.startsWith('Suspe'));
    expect(c.sigla).toBe('CN-9503');
    expect(c.corregido).toBe(true);
  });
  it('lee el bloque diario (punto de miles incluido) y el generador de operaciones', () => {
    const l = R.lecturas;
    expect(l.find(x => x.sigla === 'TI-5141').valor).toBe(23045);
    expect(l.find(x => x.sigla === 'TI-5142').valor).toBe(16731);
    expect(l.find(x => x.sigla === 'TI-9942').valor).toBe(166);
    expect(l.find(x => x.sigla === 'GE-10019').valor).toBe(15028);
  });
  it('un aviso libre corto de «operativa TI-9941» cuenta; la pregunta «dejar operativo» no', () => {
    expect(R.reportes.some(r => r.libre && r.sigla === 'TI-9941' && r.estatus === 'operativo')).toBe(true);
    expect(R.reportes.some(r => r.libre && r.sigla === 'CF-9510')).toBe(false);
    expect(R.libresSinEquipo).toBe(1);
  });
  it('un equipo que no está en el sistema se informa sin resolver', () => {
    const r = chatWhatsAppReportes(chatWhatsAppMensajes('28-10-26 09:40 - A: Equipo: Aljibe 73\nEstatus: FS\nMotivo: luz'), SIGLAS);
    expect(r.sinResolver).toEqual({ 'Aljibe 73': 1 });
    expect(r.reportes[0].sigla).toBeNull();
  });
});

describe('chatWhatsAppAnalizar · paradas, PM y backlog', () => {
  const A = chatWhatsAppAnalizar(CHAT, { siglas: SIGLAS, desde: '2026-10-01', hist: [], ot: [], reg: [] });
  it('empareja la falla con su «operativo»: entrada con la hora escrita en el aviso y duración', () => {
    const p = A.paradas.find(x => x.sigla === 'CF-9510');
    expect(p.entrada).toEqual({ f: '2026-10-29', h: '03:00' });
    expect(p.salida).toEqual({ f: '2026-10-29', h: '05:45' });
    expect(p.duracion).toBe('2h 45min');
    expect(p.estado).toBe('nueva');
    expect(p.marcado).toBe(true);
  });
  it('usa el equipo corregido y cruza el cierre de otro día', () => {
    const p = A.paradas.find(x => x.sigla === 'CN-9503');
    expect(p.entrada).toEqual({ f: '2026-10-28', h: '09:40' });
    expect(p.duracion).toBe('9h 23min');
  });
  it('lo que sigue fuera de servicio queda como abierta y sin marcar', () => {
    const abiertas = A.paradas.filter(x => x.estado === 'abierta');
    expect(abiertas.map(x => x.sigla).sort()).toEqual(['MN-6112', 'TI-9941']);
    expect(abiertas.every(x => x.marcado === false && x.salida === null)).toBe(true);
  });
  it('un «operativo» con mantención programada PM sin falla abierta es un PM, no una parada', () => {
    expect(A.pm).toHaveLength(1);
    expect(A.pm[0]).toMatchObject({ sigla: 'CN-5131', tipoPM: 'PM2', estado: 'nueva', marcado: true });
    expect(A.paradas.some(x => x.sigla === 'CN-5131')).toBe(false);
  });
  it('el backlog se lista pero no se carga solo', () => {
    expect(A.backlog).toEqual([expect.objectContaining({ sigla: 'MN-5926', fecha: '2026-10-29' })]);
  });
  it('«desde» recorta los mensajes anteriores', () => {
    const B = chatWhatsAppAnalizar(CHAT, { siglas: SIGLAS, desde: '2026-10-30' });
    expect(B.paradas.map(x => x.sigla)).toEqual(['TI-9941']);
  });
  it('con equipos fuera del sistema no inventa nada', () => {
    const B = chatWhatsAppAnalizar(CHAT, { siglas: [], desde: '2026-10-01' });
    expect(B.paradas).toEqual([]);
  });
  it('una parada de más de 21 días queda dudosa y sin marcar', () => {
    const t = '01-09-26 10:00 - A: Equipo: CF 510\nEstatus: FS\nMotivo: x\n' + '30-10-26 10:00 - A: Equipo: CF 510\nEstatus: operativo\nMotivo: y';
    const B = chatWhatsAppAnalizar(t, { siglas: SIGLAS });
    expect(B.paradas[0]).toMatchObject({ estado: 'dudosa', marcado: false });
  });
});

describe('chatWhatsAppAnalizar · contra lo ya cargado', () => {
  const ot = (o) => Object.assign({ sigla: 'CF-9510', fechaEntrada: '2026-10-29', horaEntrada: '03:10', fechaSalida: '2026-10-29', horaSalida: '05:40' }, o);
  it('una OT del mismo equipo en esas horas la marca como duplicada y sin marcar', () => {
    const A = chatWhatsAppAnalizar(CHAT, { siglas: SIGLAS, ot: [ot()] });
    const p = A.paradas.find(x => x.sigla === 'CF-9510');
    expect(p).toMatchObject({ estado: 'duplicada', marcado: false });
    expect(A.resumen.paradasDuplicadas).toBe(1);
  });
  it('una OT abierta de ese equipo cercana a la falla se cierra en vez de crear otra', () => {
    const A = chatWhatsAppAnalizar(CHAT, { siglas: SIGLAS, ot: [{ sigla: 'CF-9510', fechaEntrada: '2026-10-29', horaEntrada: '02:50' }] });
    const p = A.paradas.find(x => x.sigla === 'CF-9510');
    expect(p).toMatchObject({ estado: 'cierra', refIndice: 0, marcado: true });
  });
  it('una OT de otro equipo o de otro día no estorba', () => {
    const A = chatWhatsAppAnalizar(CHAT, { siglas: SIGLAS, ot: [ot({ sigla: 'CN-9507' }), ot({ fechaEntrada: '2026-09-01', fechaSalida: '2026-09-01' })] });
    expect(A.paradas.find(x => x.sigla === 'CF-9510').estado).toBe('nueva');
  });
  it('un PM del mismo equipo, tipo y día ya registrado queda duplicado', () => {
    const A = chatWhatsAppAnalizar(CHAT, { siglas: SIGLAS, reg: [{ equipo: 'CN-5131', tipoPM: 'PM2', fechaEntrada: '2026-10-29' }] });
    expect(A.pm[0]).toMatchObject({ estado: 'duplicada', marcado: false });
  });
});

describe('chatWhatsAppAnalizar · horómetros', () => {
  const hist = [
    { sigla: 'TI-5141', fecha: '2026-10-27', horomFin: 23000 },
    { sigla: 'TI-5141', fecha: '2026-10-31', horomFin: 23100 },
    { sigla: 'TI-5142', fecha: '2026-10-29', horomFin: 16731 },
    { sigla: 'TI-9942', fecha: '2026-10-27', horomFin: 150 },
    { sigla: 'GE-10019', fecha: '2026-10-27', horom: 15000 },
  ];
  const A = chatWhatsAppAnalizar(CHAT, { siglas: SIGLAS, hist });
  const h = (s) => A.horometros.find(x => x.sigla === s);
  it('una lectura coherente con las vecinas de la base queda lista y marcada', () => {
    expect(h('TI-5141')).toMatchObject({ valor: 23045, estado: 'ok', marcado: true });
  });
  it('si ya hay lectura de ese equipo ese día, no se vuelve a proponer', () => {
    expect(h('TI-5142')).toMatchObject({ estado: 'ya', marcado: false });
  });
  it('un valor menor que el anterior, mayor que el siguiente o un salto imposible quedan para revisar', () => {
    const t = [
      '29-10-26 07:00 - A: TI 5141= 22000', 'TI 5142= 16731',
      '30-10-26 07:00 - A: TI 5141= 99999', 'TI 9942= 160',
      '31-10-26 07:00 - A: TI 9942= 9000', 'TI 5142= 16740',
    ].join('\n');
    const B = chatWhatsAppAnalizar(t, { siglas: SIGLAS, hist: [
      { sigla: 'TI-5141', fecha: '2026-10-28', horomFin: 23000 },
      { sigla: 'TI-9942', fecha: '2026-10-28', horomFin: 150 },
      { sigla: 'TI-9942', fecha: '2026-11-05', horomFin: 200 },
    ] });
    const e = (s, f) => B.horometros.find(x => x.sigla === s && x.fecha === f).estado;
    expect(e('TI-5141', '2026-10-29')).toBe('menor');
    expect(e('TI-5141', '2026-10-30')).toBe('salto');
    expect(e('TI-9942', '2026-10-30')).toBe('ok');
    expect(e('TI-9942', '2026-10-31')).toBe('mayor');
    expect(B.horometros.find(x => x.estado === 'menor').marcado).toBe(false);
  });
  it('equipos sin lecturas en la base no se pueden validar: quedan sin marcar', () => {
    const B = chatWhatsAppAnalizar(CHAT, { siglas: SIGLAS, hist: [] });
    expect(B.horometros.every(x => x.estado === 'sin-vecinos' && x.marcado === false)).toBe(true);
  });
  it('dos lecturas del chat que se contradicen entre sí se marcan ambas', () => {
    const t = '29-10-26 07:00 - A: TI 5141= 23060\nTI 5142= 1\n30-10-26 07:00 - A: TI 5141= 23040\nTI 5142= 1';
    const B = chatWhatsAppAnalizar(t, { siglas: SIGLAS, hist: [{ sigla: 'TI-5141', fecha: '2026-10-27', horomFin: 23000 }, { sigla: 'TI-5141', fecha: '2026-11-01', horomFin: 23100 }] });
    const L = B.horometros.filter(x => x.sigla === 'TI-5141');
    expect(L.map(x => x.estado)).toEqual(['incoherente', 'incoherente']);
  });
  it('el resumen cuenta cada grupo', () => {
    expect(A.resumen.horomOk).toBe(h('TI-5141').estado === 'ok' ? A.horometros.filter(x => x.estado === 'ok').length : -1);
    expect(A.resumen.horomYa).toBe(1);
  });
});

// ── Mejoras 2026-11-11: avisos libres de falla y cambios de componente ──
const SIGLAS2 = [...SIGLAS, 'CF-10162', 'MN-5926'];
describe('aviso libre de falla sin plantilla', () => {
  const chat = [
    '05-11-26 22:23 - Eugenio Salinas: CE-88 fuera de servicio por suspensión pos 1 y golpeteo en transmisión',
    '05-11-26 22:24 - Eugenio Salinas: Equipo en traslado a taller',
    '06-11-26 00:35 - Carlos: Equipo: CE-88',
    'H:17646.2',
    'Motivo: se normalizan niveles de suspensiones delanteras',
    'Estatus: Operativo',
    'Lugar: Taller Mantenimiento',
  ].join('\n');
  const SIG = [...SIGLAS, 'CN-9502'];
  it('lo lee como falla y la empareja con el «operativo» de la plantilla', () => {
    const r = chatWhatsAppReportes(chatWhatsAppMensajes(chat), SIG);
    const fs = r.reportes.find((x) => x.estatus === 'fs');
    expect(fs).toMatchObject({ sigla: 'CN-9502', libre: true });
    expect(fs.motivo).toContain('suspensión pos 1 y golpeteo en transmisión');
    const a = chatWhatsAppAnalizar(chat, { siglas: SIG });
    expect(a.paradas).toHaveLength(1);
    expect(a.paradas[0]).toMatchObject({ sigla: 'CN-9502', estado: 'nueva' });
    expect(a.paradas[0].entrada).toEqual({ f: '2026-11-05', h: '22:23' });
    expect(a.paradas[0].salida).toEqual({ f: '2026-11-06', h: '00:35' });
    expect(a.paradas[0].duracion).toBe('2h 12min');
  });
  it('no cuenta preguntas, peticiones ni mensajes con dos equipos', () => {
    const t = (txt) => chatWhatsAppReportes(chatWhatsAppMensajes('05-11-26 10:00 - Alguien: ' + txt), SIG).reportes.filter((x) => x.estatus === 'fs').length;
    expect(t('Cf-510 F/ S y sin observaciones?')).toBe(0);
    expect(t('favor dejar el CF-510 fuera de servicio')).toBe(0);
    expect(t('CF-510 fuera de servicio y CF-769 también')).toBe(0);
    expect(t('el equipo quedó fuera de servicio')).toBe(0);
    expect(t('CF-510 F/S por pasadores agripados')).toBe(1);
  });
});

describe('cambios de componente propuestos para el Historial', () => {
  const op = (hora, equipo, motivo, h = 'xxxx') => `10-11-26 ${hora} - Carlos: Equipo: ${equipo}\nEstatus: operativo\nMotivo: ${motivo}\nHorómetro: ${h}\nLugar: taller`;
  const chat = [
    op('10:00', 'CF-162', 'CAMBIO DE BALDE'),
    op('10:10', 'CN-9507', 'cambio de asiento', '20772'),
    op('10:20', 'MN-5926', 'cambio de cuchillas', '9565'),
    op('10:30', 'CF-769', 'CAMBIO FLEXIBLE HIDRÁULICO CILINDRO PANTOGRAFO Y CAMBIO ACIETE HIDRÁULICO', '16225'),
    op('10:40', 'CF-510', 'cambio flexible de alta preseion cilindro de levante relleno de 1000 litros de aceite hidráulico', '15991'),
    op('10:50', 'CF-510', 'instalación de flexibles hidráulicos'),
    op('11:00', 'CF-510', 'engrase pasadores de balde y reposición de calzas de balde'),
    op('11:10', 'CF-769', 'Cambio Canillera Balde, cambio de entredientes a balde'),
    op('11:20', 'CF-510', 'Reparación tope pasador de balde'),
    op('11:30', 'CF-510', 'instalacion de pasador de balde derecho'),
  ].join('\n');
  const SIG = [...SIGLAS2, 'CN-9507'];
  it('propone solo los cambios claros, con el nombre del Historial', () => {
    const a = chatWhatsAppAnalizar(chat, { siglas: SIG });
    expect(a.cambios.map((c) => [c.sigla, c.comp, c.horom])).toEqual([
      ['CF-10162', 'Balde', null],
      ['CN-9507', 'Asiento', 20772],
      ['MN-5926', 'GET / Cuchillas', 9565],
      ['CF-8769', 'Flexible hidráulico del implemento', 16225],
      ['CF-9510', 'Flexible hidráulico del implemento', 15991],
      ['CF-9510', 'Pasador de balde', null],
    ]);
    expect(a.cambios.every((c) => c.estado === 'nueva' && c.marcado)).toBe(true);
    expect(a.resumen.cambiosNuevos).toBe(6);
  });
  it('un cambio que ya está en el Historial (±3 días, también como Balde/Implemento) queda duplicado y sin marcar', () => {
    const a = chatWhatsAppAnalizar(chat, { siglas: SIG, comp: [{ sigla: 'CF-10162', comp: 'Balde/Implemento', fechaInst: '2026-11-08' }, { sigla: 'CN-9507', comp: 'Asiento', fechaInst: '2026-10-01' }] });
    const bal = a.cambios.find((c) => c.comp === 'Balde');
    expect(bal).toMatchObject({ estado: 'duplicada', marcado: false });
    expect(a.cambios.find((c) => c.comp === 'Asiento')).toMatchObject({ estado: 'nueva', marcado: true });
    expect(a.resumen).toMatchObject({ cambiosNuevos: 5, cambiosDuplicados: 1 });
  });
  it('un «fuera de servicio» no es un cambio ni un aviso repetido el mismo día cuenta dos veces', () => {
    const dos = op('10:00', 'CF-162', 'CAMBIO DE BALDE') + '\n' + op('15:00', 'CF-162', 'cambio de balde');
    expect(chatWhatsAppAnalizar(dos, { siglas: SIG }).cambios).toHaveLength(1);
    const fs = '10-11-26 10:00 - Carlos: Equipo: CF-162\nEstatus: fuera de servicio\nMotivo: cambio de balde\nHorómetro: 3300';
    expect(chatWhatsAppAnalizar(fs, { siglas: SIG }).cambios).toHaveLength(0);
  });
});
