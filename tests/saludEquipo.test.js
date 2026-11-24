import { describe, it, expect } from 'vitest';
import { scoreSaludEquipo, motivoPrincipalSalud } from '../logic.js';

describe('scoreSaludEquipo', () => {
  it('devuelve null si no hay ninguna dimensión con dato', () => {
    const r = scoreSaludEquipo({});
    expect(r.valor).toBeNull();
    expect(r.n).toBe(0);
  });

  it('promedia las 4 dimensiones cuando todas tienen dato', () => {
    const r = scoreSaludEquipo({ componentesPct: 100, neumaticosPct: 80, aceitePct: 60, confiabilidadPct: 100 });
    expect(r.valor).toBe(85);
    expect(r.n).toBe(4);
  });

  it('promedia solo las dimensiones disponibles, sin inventar las que faltan', () => {
    // Caso real: equipo sin muestras de aceite y sin 2 fallas registradas
    // (así que no hay MTBF) — solo componentes y neumáticos tienen dato.
    const r = scoreSaludEquipo({ componentesPct: 90, neumaticosPct: 70, aceitePct: null, confiabilidadPct: null });
    expect(r.valor).toBe(80);
    expect(r.n).toBe(2);
  });

  it('el detalle trae las 4 dimensiones con su nombre, tenga dato o no', () => {
    const r = scoreSaludEquipo({ componentesPct: 90 });
    expect(r.detalle.map(c => c.nombre)).toEqual(['Componentes', 'Neumáticos', 'Aceite', 'Confiabilidad']);
    expect(r.detalle.find(c => c.nombre === 'Aceite').valor).toBeNull();
  });

  it('redondea a un decimal', () => {
    const r = scoreSaludEquipo({ componentesPct: 100, neumaticosPct: 66, confiabilidadPct: null, aceitePct: null });
    expect(r.valor).toBe(83);
  });

  it('un equipo perfecto en las 4 dimensiones da 100', () => {
    const r = scoreSaludEquipo({ componentesPct: 100, neumaticosPct: 100, aceitePct: 100, confiabilidadPct: 100 });
    expect(r.valor).toBe(100);
  });

  it('ignora valores no numéricos (undefined, NaN, string) como si faltara el dato', () => {
    const r = scoreSaludEquipo({ componentesPct: 80, neumaticosPct: 60, aceitePct: NaN, confiabilidadPct: '50' });
    expect(r.valor).toBe(70);
    expect(r.n).toBe(2);
  });

  it('con una sola señal con dato el equipo queda «sin datos suficientes» (valor null), no crítico ni sano (24-nov-2026)', () => {
    const r = scoreSaludEquipo({ confiabilidadPct: 0 });
    expect(r.valor).toBeNull();
    expect(r.n).toBe(1);
    expect(r.insuficiente).toBe(true);
    expect(r.detalle.find(c => c.nombre === 'Confiabilidad').valor).toBe(0);   // el detalle se conserva
    expect(scoreSaludEquipo({ confiabilidadPct: 0, componentesPct: 100 }).valor).toBe(50);   // con dos señales ya hay nota
  });
});

describe('motivoPrincipalSalud', () => {
  it('devuelve null si el detalle está vacío', () => {
    expect(motivoPrincipalSalud([])).toBeNull();
  });

  it('devuelve null si ninguna dimensión tiene dato', () => {
    const detalle = [{ nombre: 'Componentes', valor: null }, { nombre: 'Aceite', valor: null }];
    expect(motivoPrincipalSalud(detalle)).toBeNull();
  });

  it('elige la dimensión de valor más bajo entre las que tienen dato', () => {
    const detalle = [
      { nombre: 'Componentes', valor: 40 },
      { nombre: 'Neumáticos', valor: 90 },
      { nombre: 'Aceite', valor: null },
      { nombre: 'Confiabilidad', valor: 70 },
    ];
    expect(motivoPrincipalSalud(detalle)).toEqual({ nombre: 'Componentes', valor: 40 });
  });

  it('ignora las dimensiones sin dato al elegir la peor', () => {
    const detalle = [
      { nombre: 'Componentes', valor: null },
      { nombre: 'Neumáticos', valor: 55 },
      { nombre: 'Aceite', valor: 60 },
    ];
    expect(motivoPrincipalSalud(detalle)?.nombre).toBe('Neumáticos');
  });
});

describe('reglas de medición del Score de Salud (24-nov-2026)', () => {
  const { saludAceitePct, saludConfiabilidadPct, aceiteComponenteClave, claseOTDesdeTexto, esFallaMTBF } = require('../logic.js');
  const hoy = '2026-11-24';
  it('aceite: precaución vale la mitad, alerta cero, normal uno', () => {
    expect(saludAceitePct([{ fecha: '2026-11-01', componente: 'MOTOR', estado: 'NORMAL' }, { fecha: '2026-11-01', componente: 'TRANSMISION', estado: 'PRECAUCION' }, { fecha: '2026-11-01', componente: 'HIDRAULICO', estado: 'ALERTA' }], hoy)).toBe(50);
  });
  it('aceite: una muestra de más de 90 días no cuenta; sin muestras recientes no hay dato', () => {
    expect(saludAceitePct([{ fecha: '2026-07-10', componente: 'MOTOR', estado: 'ALERTA' }], hoy)).toBeNull();
    expect(saludAceitePct([{ fecha: '2026-07-10', componente: 'MOTOR', estado: 'ALERTA' }, { fecha: '2026-11-10', componente: 'TRANSMISION', estado: 'NORMAL' }], hoy)).toBe(100);
  });
  it('aceite: un componente mal escrito (HIRAULICO) cuenta como el mismo y manda la muestra más nueva', () => {
    expect(aceiteComponenteClave('hiraulico')).toBe('HIDRAULICO');
    expect(saludAceitePct([{ fecha: '2026-11-01', componente: 'HIDRAULICO', estado: 'PRECAUCION' }, { fecha: '2026-11-02', componente: 'HIRAULICO', estado: 'NORMAL' }], hoy)).toBe(100);
  });
  it('confiabilidad: con menos de 3 fallas no hay dato (dos fallas a 26 h de distancia ya no dan 0 %)', () => {
    expect(saludConfiabilidadPct([5616, 5642], 12)).toBeNull();
    expect(saludConfiabilidadPct([100, 400, 700], 12)).not.toBeNull();
  });
  it('clasificación: instalar focos solares, un ítem de Backlog y un golpe de parachoques no son fallas', () => {
    expect(claseOTDesdeTexto('instalación focos solares')).toBe('instalacion');
    expect(claseOTDesdeTexto('Backlog: revisar soporte de la cámara de fatiga y somnolencia')).toBe('preventiva');
    expect(claseOTDesdeTexto('Golpe en parachoques y cañeria')).toBe('operacional');
    expect(esFallaMTBF({ tipo: 'Correctivo', sintoma: 'instalación focos solares', horom: 562 })).toBe(false);
  });
  it('lo que sí es falla sigue siéndolo (golpeteo de motor, falla de focos, cañería dañada)', () => {
    expect(claseOTDesdeTexto('Golpeteo en motor')).toBe('correctiva');
    expect(claseOTDesdeTexto('Falla de focos de trabajo')).toBe('correctiva');
    expect(claseOTDesdeTexto('Cañería dañada')).toBe('correctiva');
  });
});

describe('matriz de salud propuesta (24-nov-2026)', () => {
  const { scoreSaludMatriz, saludHistorialPct, SALUD_MATRIZ_PROPUESTA } = require('../logic.js');
  it('los pesos de las categorías suman 100 y los de los subsistemas también', () => {
    expect(Object.values(SALUD_MATRIZ_PROPUESTA.pesos).reduce((a, b) => a + b, 0)).toBe(100);
    expect(Object.values(SALUD_MATRIZ_PROPUESTA.subsistemas).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it('promedia ponderado por categoría y muestra la confianza del dato', () => {
    const r = scoreSaludMatriz({ condicion: 80, historial: 60, preventivo: 100 });
    expect(r.valor).toBe(Math.round((80 * 30 + 60 * 55 + 100 * 15) / 100 * 10) / 10);   // 72,0
    expect(r.confianza).toBe(100);                       // telemetría pesa 0: no cuenta como faltante
    expect(r.banda).toBe('advertencia');
  });
  it('sin una categoría, su peso se reparte entre las que sí tienen dato y baja la confianza', () => {
    const r = scoreSaludMatriz({ historial: 60, preventivo: 100 });
    expect(r.valor).toBe(Math.round((60 * 55 + 100 * 15) / 70 * 10) / 10);
    expect(r.confianza).toBe(70);
  });
  it('con menos de 2 categorías con dato queda sin nota (insuficiente), no crítico', () => {
    const r = scoreSaludMatriz({ historial: 0 });
    expect(r.valor).toBeNull();
    expect(r.insuficiente).toBe(true);
    expect(r.banda).toBe('sin_datos');
  });
  it('la capa B pondera los subsistemas dentro de «condición» y reparte el peso del que falta', () => {
    const r = scoreSaludMatriz({ condicion: { tren: 40, hidraulico: 100 }, historial: 100 });
    // condición = (40*55 + 100*30) / 85 = 61,2 ; total = (61,2*30 + 100*55) / 85
    expect(r.categorias.find(c => c.nombre === 'condicion').valor).toBe(61.2);
    expect(r.valor).toBe(Math.round((61.2 * 30 + 100 * 55) / 85 * 10) / 10);
  });
  it('un crítico (veto) limita el Score a 39 aunque el promedio sea sano, y lo dice', () => {
    const r = scoreSaludMatriz({ condicion: 100, historial: 100, preventivo: 100, criticos: ['aceite en alerta: MOTOR'] });
    expect(r.valor).toBe(39);
    expect(r.banda).toBe('critica');
    expect(r.veto).toMatchObject({ antes: 100, motivos: ['aceite en alerta: MOTOR'] });
  });
  it('un crítico también marca a un equipo con pocos datos (no queda «sin datos»)', () => {
    expect(scoreSaludMatriz({ historial: 100, criticos: ['componente vencido'] }).valor).toBe(39);
  });
  it('historial: las bandas siguen las tasas observadas (fallas previas y paradas largas)', () => {
    expect(saludHistorialPct(0, 0)).toBe(100);
    expect(saludHistorialPct(2, 0)).toBe(75);
    expect(saludHistorialPct(4, 0)).toBe(40);
    expect(saludHistorialPct(9, 0)).toBe(0);
    expect(saludHistorialPct(0, 1)).toBe(60);
    expect(saludHistorialPct(0, 3)).toBe(20);
    expect(saludHistorialPct(null, null)).toBeNull();
  });
});

describe('saludMatrizEquipos: la matriz calculada para la flota (24-nov-2026)', () => {
  const L = require('../logic.js');
  const hoy = new Date('2026-11-24T12:00:00Z');
  const eq = [
    { sigla: 'A-1', horomActual: 10000, hrsDia: 12, diasParaPM: 20, fechaProxPM: '2026-12-14', frecPM: 250 },
    { sigla: 'B-1', horomActual: 10000, hrsDia: 12, diasParaPM: -5, fechaProxPM: '2026-11-19', frecPM: 250 },
    { sigla: 'C-1', horomActual: 500, hrsDia: 12, diasParaPM: 999, fechaProxPM: '', frecPM: 250 },
  ];
  const comp = [
    { sigla: 'A-1', comp: 'Motor', esOriginal: true, vidaUtil: 15000 },
    { sigla: 'A-1', comp: 'Bomba hidráulica', esOriginal: true, vidaUtil: 15000 },
    { sigla: 'B-1', comp: 'Motor', esOriginal: true, vidaUtil: 9000 },          // ya pasó su vida: componente vencido → veto
    { sigla: 'C-1', comp: 'Motor', fechaInst: '', horomComp: 0, vidaUtil: 15000 },   // sin instalación: no es dato
  ];
  const ace = [
    { _sigla: 'A-1', fecha: '2026-11-10', componente: 'MOTOR', estado: 'NORMAL' },
    { _sigla: 'B-1', fecha: '2026-11-10', componente: 'TRANSMISION', estado: 'ALERTA' },   // alerta en tren de potencia → veto
  ];
  const ot = [
    { sigla: 'A-1', tipo: 'Correctivo', sintoma: 'falla de bomba', fecha: '2026-10-01', horom: 9900, estado: 'Cerrada', duracion: '4h' },
    { sigla: 'B-1', tipo: 'Correctivo', sintoma: 'falla de motor', fecha: '2026-11-01', horom: 9990, estado: 'Cerrada', duracion: '30h 00min' },
  ];
  const r = L.saludMatrizEquipos(eq, comp, [], ace, ot, null, hoy);
  it('un equipo sano en condición y sin muestras malas obtiene nota con sus tres categorías', () => {
    expect(r['A-1'].matriz.valor).not.toBeNull();
    expect(r['A-1'].sub.tren).toBe(100);             // aceite normal + motor con vida
    expect(r['A-1'].sub.hidraulico).toBe(100);
    expect(r['A-1'].fallas90).toBe(1);
    expect(r['A-1'].historial).toBe(75);
    expect(r['A-1'].preventivo).toBe(85);
    expect(r['A-1'].matriz.criticos).toBeUndefined();
    expect(r['A-1'].criticos).toEqual([]);
  });
  it('alerta de aceite en el tren de potencia, componente vencido y una parada de 24 h o más activan el veto (máximo 39)', () => {
    expect(r['B-1'].criticos).toEqual(expect.arrayContaining(['aceite en alerta: TRANSMISION', 'componente vencido: Motor']));
    expect(r['B-1'].matriz.valor).toBeLessThanOrEqual(39);
    expect(r['B-1'].matriz.veto.motivos.length).toBeGreaterThanOrEqual(2);
    expect(r['B-1'].paradas12m).toBe(1);
  });
  it('un equipo sin dato real ni OT queda sin datos suficientes (no se inventa nota ni historial)', () => {
    expect(r['C-1'].historial).toBeNull();
    expect(r['C-1'].preventivo).toBeNull();
    expect(r['C-1'].matriz.valor).toBeNull();
    expect(r['C-1'].matriz.insuficiente).toBe(true);
  });
  it('clasifica los componentes por subsistema', () => {
    expect(L.saludSubsistemaDe('Mando final izquierdo')).toBe('tren');
    expect(L.saludSubsistemaDe('Bomba hidráulica')).toBe('hidraulico');
    expect(L.saludSubsistemaDe('Radiador')).toBe('otros');
  });
});

describe('método del Score de Salud en uso (24-nov-2026)', () => {
  const L = require('../logic.js');
  const hoy = new Date('2026-11-24T12:00:00Z');
  const eq = [{ sigla: 'A-1', tipo: 'Camion', horomActual: 10000, hrsDia: 12, diasParaPM: 20, fechaProxPM: '2026-12-14', frecPM: 250 }];
  const comp = [{ sigla: 'A-1', comp: 'Motor', esOriginal: true, vidaUtil: 15000 }];
  const aceiteAlerta = [{ _sigla: 'A-1', fecha: '2026-11-15', componente: 'MOTOR', estado: 'ALERTA' }];
  afterEach(() => { delete global.window; });
  it('por defecto es la matriz: el Score trae sus categorías, la confianza y conserva el Score anterior', () => {
    const r = L.equiposConSaludFlota(eq, comp, [], [], [], null, hoy)[0];
    expect(r.score.metodo).toBe('matriz');
    expect(r.score.detalle.map(d => d.nombre)).toEqual(['Condición', 'Historial', 'Preventivo']);
    expect(r.scoreAnterior.detalle.map(d => d.nombre)).toContain('Componentes');
  });
  it('un aceite en alerta en el motor activa el veto: el Score queda en 39 o menos y dice por qué', () => {
    const r = L.equiposConSaludFlota(eq, comp, [], aceiteAlerta, [], null, hoy)[0];
    expect(r.score.valor).toBeLessThanOrEqual(39);
    expect(r.score.veto.motivos).toEqual(['aceite en alerta: MOTOR']);
  });
  it('con window._saludMetodo = «actual» vuelve al promedio simple de antes', () => {
    global.window = { _saludMetodo: 'actual' };
    expect(L.saludMetodoVigente()).toBe('actual');
    const r = L.equiposConSaludFlota(eq, comp, [], [], [], null, hoy)[0];
    expect(r.score.metodo).toBeUndefined();
    expect(r.score.detalle.map(d => d.nombre)).toContain('Componentes');
  });
});
