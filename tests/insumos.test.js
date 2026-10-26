// Stock de insumos con kardex (26-oct-2026): el saldo sale de los movimientos, las salidas no pasan del saldo, el conteo físico genera el ajuste y «Qué comprar» suma los insumos.
import { describe, it, expect } from 'vitest';
import { insumoDelta, insumosSaldos, insumosKardex, insumoValidarSalida, insumosAjusteConteo, insumosResumen, insumosParsearLista, planCompras,
  kardexLegadoValor, kardexAplicarLegado, kardexPlanActivacion, kardexDescuadres, kardexSalidasPM, insumoParaOC } from '../logic.js';

const HOY = '2026-10-26';
const mov = (insumoId, fecha, tipo, cantidad, extra = {}) => ({ insumoId, fecha, tipo, cantidad, ...extra });

describe('saldo y kardex', () => {
  const movs = [
    mov('a', '2026-08-01', 'inicial', 20),
    mov('a', '2026-08-10', 'salida', 5, { documento: 'vale 12', referencia: 'Juan Pérez', destino: 'CN-9502' }),
    mov('a', '2026-08-20', 'entrada', 10, { documento: 'guía 55' }),
    mov('a', '2026-09-01', 'ajuste', -2, { observacion: 'conteo físico' }),
    mov('b', '2026-09-01', 'inicial', 7),
  ];
  it('saldo = inicial + entradas − salidas ± ajustes, por ítem', () => {
    const s = insumosSaldos(movs);
    expect(s.a).toMatchObject({ entradas: 30, salidas: 5, ajustes: -2, saldo: 23, n: 4, primerMov: '2026-08-01', ultimoMov: '2026-09-01' });
    expect(s.b.saldo).toBe(7);
  });
  it('insumoDelta: la salida resta, el ajuste ya trae su signo', () => {
    expect(insumoDelta({ tipo: 'salida', cantidad: 3 })).toBe(-3);
    expect(insumoDelta({ tipo: 'entrada', cantidad: 3 })).toBe(3);
    expect(insumoDelta({ tipo: 'ajuste', cantidad: -4 })).toBe(-4);
  });
  it('el kardex ordena por fecha con el saldo corrido y deja documento, quién retira y destino', () => {
    const k = insumosKardex(movs, 'a');
    expect(k.map(r => r.saldo)).toEqual([20, 15, 25, 23]);
    expect(k[1]).toMatchObject({ salida: 5, entrada: null, documento: 'vale 12', referencia: 'Juan Pérez', destino: 'CN-9502' });
    expect(k[3]).toMatchObject({ salida: 2, entrada: null });          // ajuste negativo se ve como salida
  });
  it('el mismo día: primero lo que entra y al final la salida (no inventa saldo negativo)', () => {
    const m2 = [mov('c', '2026-10-01', 'salida', 4), mov('c', '2026-10-01', 'entrada', 5), mov('c', '2026-10-01', 'inicial', 1)];
    const k = insumosKardex(m2, 'c');
    expect(k.map(r => r.tipo)).toEqual(['inicial', 'entrada', 'salida']);
    expect(k.some(r => r.negativo)).toBe(false);
  });
  it('un saldo bajo cero queda marcado en el punto donde ocurre', () => {
    const k = insumosKardex([mov('d', '2026-10-01', 'salida', 3), mov('d', '2026-10-05', 'entrada', 10)], 'd');
    expect(k.map(r => r.negativo)).toEqual([true, false]);
  });
});

describe('validar salida y conteo físico', () => {
  it('rechaza sacar más que el saldo y cantidades no positivas', () => {
    expect(insumoValidarSalida(5, 5).ok).toBe(true);
    expect(insumoValidarSalida(5, 6)).toMatchObject({ ok: false });
    expect(insumoValidarSalida(5, 6).motivo).toMatch(/ajuste de conteo/);
    expect(insumoValidarSalida(5, 0).ok).toBe(false);
    expect(insumoValidarSalida(5, 'x').ok).toBe(false);
  });
  it('el ajuste es lo contado menos el saldo; sin diferencia o conteo inválido no hay ajuste', () => {
    expect(insumosAjusteConteo(10, 7)).toBe(-3);
    expect(insumosAjusteConteo(10, 12)).toBe(2);
    expect(insumosAjusteConteo(10, 10)).toBeNull();
    expect(insumosAjusteConteo(10, '')).toBeNull();
    expect(insumosAjusteConteo(10, -1)).toBeNull();
    expect(insumosAjusteConteo(10, 'abc')).toBeNull();
    expect(insumosAjusteConteo(0, 4)).toBe(4);
  });
});

describe('insumosResumen', () => {
  const insumos = [
    { _id: 'a', descripcion: 'Guante', categoria: 'EPP', unidad: 'PAR', stockCritico: 5, precioUnit: 735 },
    { _id: 'b', descripcion: 'Resma', categoria: 'Librería', unidad: 'UN', stockCritico: 0, precioUnit: 0 },
    { _id: 'c', descripcion: 'Batería 12V', categoria: 'Baterías', unidad: 'UN', stockCritico: 2, precioUnit: 90000 },
    { _id: 'd', descripcion: 'Sin movimientos', categoria: 'Otros' },
  ];
  const movs = [
    mov('a', '2026-07-01', 'inicial', 40),
    mov('a', '2026-08-15', 'salida', 12), mov('a', '2026-09-15', 'salida', 12), mov('a', '2026-10-15', 'salida', 12),
    mov('b', '2026-10-20', 'inicial', 10), mov('b', '2026-10-24', 'salida', 2),
    mov('c', '2026-09-01', 'inicial', 2),
  ];
  const r = insumosResumen(insumos, movs, { hoy: HOY });
  const f = id => r.filas.find(x => x._id === id);
  it('estado por saldo y stock crítico; sin movimientos es SIN STOCK', () => {
    expect(f('a')).toMatchObject({ saldo: 4, estado: 'CRÍTICO', entradas: 40, salidas: 36 });
    expect(f('b').estado).toBe('OK');
    expect(f('c').estado).toBe('CRÍTICO');               // saldo 2 ≤ crítico 2
    expect(f('d')).toMatchObject({ saldo: 0, estado: 'SIN STOCK', ultimoMov: null });
  });
  it('consumo mensual de los últimos 90 días y cobertura', () => {
    expect(f('a').consumoMes).toBe(12);
    expect(f('a').coberturaMeses).toBe(0.3);
    expect(f('a').pocaHistoria).toBe(false);
  });
  it('con poca historia el consumo se marca y no se proyecta con confianza', () => {
    expect(f('b').pocaHistoria).toBe(true);
  });
  it('valor del saldo y totales; ordena lo urgente primero', () => {
    expect(f('a').valor).toBe(4 * 735);
    expect(r.totales).toMatchObject({ items: 4, sinStock: 1, criticos: 2, sinCritico: 2 });
    expect(r.filas[0].estado).toBe('SIN STOCK');
  });
  it('un ítem inactivo no cuenta en los totales', () => {
    const r2 = insumosResumen([{ ...insumos[3], activo: false }], [], { hoy: HOY });
    expect(r2.totales.items).toBe(0);
  });
});

describe('insumosParsearLista', () => {
  it('lee descripción, unidad, stock, crítico, precio y categoría; ignora el encabezado', () => {
    const r = insumosParsearLista('Descripción\tUnidad\tStock\nGuante cabritilla\tPAR\t14\t5\t735\nLentes\tUN\t40\t10\t1.600,50\tEPP', 'Librería');
    expect(r.errores).toEqual([]);
    expect(r.filas).toEqual([
      { descripcion: 'Guante cabritilla', unidad: 'PAR', stock: 14, stockCritico: 5, precioUnit: 735, categoria: 'Librería' },
      { descripcion: 'Lentes', unidad: 'UN', stock: 40, stockCritico: 10, precioUnit: 1600.5, categoria: 'EPP' },
    ]);
  });
  it('informa línea y motivo de lo que no sirve: sin descripción, número inválido, repetido', () => {
    const r = insumosParsearLista('Lentes;UN;1\nLentes;UN;2\n;UN;1\nX;UN;abc\nY;UN;1;-3', 'EPP');
    expect(r.filas).toHaveLength(1);
    expect(r.errores.map(e => e.linea)).toEqual([2, 3, 4, 5]);
    expect(r.errores[0].motivo).toMatch(/repetido/);
  });
  it('una categoría desconocida cae en la categoría por defecto', () => {
    expect(insumosParsearLista('A;UN;1;0;0;Inventada', 'Limpieza').filas[0].categoria).toBe('Limpieza');
  });
});

describe('«Qué comprar» con insumos', () => {
  const insumos = [
    { _id: 'a', descripcion: 'Guante', categoria: 'EPP', unidad: 'PAR', stockCritico: 5, precioUnit: 1000 },
    { _id: 'z', descripcion: 'Cubierto', categoria: 'Otros', unidad: 'UN', stockCritico: 0, precioUnit: 10 },
  ];
  const movs = [mov('a', '2026-07-01', 'inicial', 40), mov('a', '2026-08-15', 'salida', 12), mov('a', '2026-09-15', 'salida', 12), mov('a', '2026-10-15', 'salida', 12),
    mov('z', '2026-07-01', 'inicial', 1000)];
  const resumen = insumosResumen(insumos, movs, { hoy: HOY }).filas;
  const r = planCompras({ hoy: HOY, insumos: resumen, plazoFn: () => ({ dias: 10, peor: 40, fuente: 'prueba', supuesto: false }) });
  it('compra el consumo del horizonte más el stock crítico menos el saldo; lo cubierto no aparece', () => {
    expect(r.insumos).toHaveLength(1);
    const a = r.insumos[0];
    expect(a.comprar).toEqual({ mes: 13, semestre: 73, anio: 147 });     // 12 al mes × 365/30 = 146 + crítico 5 − saldo 4
    expect(a.costo.anio).toBe(147000);
    expect(r.insumosCubiertos).toBe(0);                                  // «z» no tiene consumo ni crítico: ni se cuenta
  });
  it('pedir antes de: el saldo ya está bajo el crítico, hay que pedir ya', () => {
    expect(r.insumos[0].pedirAntes).toMatchObject({ ya: true });
    expect(r.totales.mes.insumos).toBe(1);
    expect(r.totales.anio.costo).toBe(147000);
  });
  it('avisa si el último movimiento es viejo', () => {
    const viejo = planCompras({ hoy: '2026-12-31', insumos: resumen, plazoFn: () => ({ dias: 10, peor: null, fuente: 'p', supuesto: false }) });
    expect(viejo.avisos.some(a => a.tipo === 'insumos')).toBe(true);
    expect(r.avisos.some(a => a.tipo === 'insumos')).toBe(false);
  });
  it('sin la lista de insumos no hay sección ni avisos de insumos', () => {
    const sin = planCompras({ hoy: HOY });
    expect(sin.insumos).toEqual([]);
    expect(sin.avisos.some(a => a.tipo === 'insumos')).toBe(false);
  });
});

// ── Kardex unificado: filtros, lubricantes y repuestos ──
const STK = [{ _id: 'f1', nParte: 'LF9009', descripcion: 'Filtro aceite', equipoModelo: 'D375', stockBodega: 6, consumoMes: 2, precioUnit: 10000 },
  { _id: 'f2', nParte: 'LF9009', descripcion: 'Filtro aceite', equipoModelo: 'D155', stockBodega: 2, precioUnit: 9000 },   // misma descripción, otro modelo
  { _id: 'f3', descripcion: '', stockBodega: 3 }];
const LUB = [{ _id: 'l1', nombre: 'Aceite 15W40', unidad: 'L', stock: 80, precio: 3000 }];
const REP = [{ _id: 'r1', componente: 'Inyector', nParte: 'INJ-1', equipo: 'CN-9502', stockActual: 4, stockMinimo: 2, precioUnit: 500000 }];

describe('kardexPlanActivacion', () => {
  it('crea un insumo por fila con su stock de hoy como saldo inicial, sin chocar por descripciones repetidas', () => {
    const p = kardexPlanActivacion(STK, LUB, REP, []);
    expect(p.porOrigen).toEqual({ filtro: 2, lubricante: 1, repuesto: 1 });
    expect(p.sinNombre).toBe(1);
    const f1 = p.filas.find(x => x.origenId === 'f1'), f2 = p.filas.find(x => x.origenId === 'f2');
    expect(f1).toMatchObject({ origen: 'filtro', categoria: 'Filtros', descripcion: 'Filtro aceite', codigo: 'LF9009', stock: 6, precioUnit: 10000, observacion: 'Equipo/modelo: D375' });
    expect(f2.descripcion).toBe(f1.descripcion);
    expect(p.filas.find(x => x.origen === 'lubricante')).toMatchObject({ categoria: 'Lubricantes', unidad: 'L', stock: 80, precioUnit: 3000 });
    expect(p.filas.find(x => x.origen === 'repuesto')).toMatchObject({ stockCritico: 2, stock: 4, precioUnit: 500000 });   // el mínimo del repuesto pasa a ser su stock crítico
  });
  it('lo ya activado no se duplica', () => {
    const p = kardexPlanActivacion(STK, LUB, REP, [{ _id: 'i1', origen: 'filtro', origenId: 'f1' }]);
    expect(p.yaActivos).toBe(1);
    expect(p.filas.some(x => x.origenId === 'f1')).toBe(false);
  });
});

describe('copia del saldo a las pantallas antiguas', () => {
  it('filtro: stockBodega, cobertura y estado; lubricante y repuesto: su campo; nunca bajo cero', () => {
    const f = { ...STK[0] }; kardexAplicarLegado('filtro', f, 1);
    expect(f.stockBodega).toBe(1);
    expect(f.mesesCubierto).toBe(0.5);
    expect(f.estado).toContain('COMPRAR');
    const l = { ...LUB[0] }; kardexAplicarLegado('lubricante', l, 12.5); expect(l.stock).toBe(12.5);
    const r = { ...REP[0] }; kardexAplicarLegado('repuesto', r, -3); expect(r.stockActual).toBe(0);
    expect(kardexLegadoValor('repuesto', REP[0])).toBe(4);
  });
});

describe('kardexDescuadres', () => {
  const ins = [{ _id: 'i1', origen: 'filtro', origenId: 'f1', descripcion: 'Filtro aceite', codigo: 'LF9009' }, { _id: 'i2', origen: 'lubricante', origenId: 'l1', descripcion: 'Aceite' }, { _id: 'i3', origen: 'repuesto', origenId: 'borrado', descripcion: 'Perdido' }];
  const movs = [mov('i1', '2026-10-01', 'inicial', 6), mov('i2', '2026-10-01', 'inicial', 80)];
  it('detecta lo que alguien editó a mano en la pantalla antigua y las filas que ya no existen', () => {
    const stk = [{ ...STK[0], stockBodega: 5 }], d = kardexDescuadres(stk, LUB, REP, ins, movs);
    expect(d.descuadres).toEqual([{ insumoId: 'i1', origen: 'filtro', descripcion: 'Filtro aceite', codigo: 'LF9009', kardex: 6, legado: 5, diferencia: -1 }]);
    expect(d.huerfanos.map(h => h.insumoId)).toEqual(['i3']);
  });
  it('sin diferencias no hay descuadres', () => {
    expect(kardexDescuadres([STK[0]], LUB, [], ins.slice(0, 2), movs).descuadres).toEqual([]);
  });
});

describe('salidas automáticas por PM', () => {
  it('cada baja de stock en una pantalla antigua con ítem vinculado queda como salida del kardex, con equipo y PM', () => {
    const ins = [{ _id: 'i1', origen: 'filtro', origenId: 'f1' }, { _id: 'i2', origen: 'lubricante', origenId: 'l1' }];
    const antes = { filtro: { f1: 6, f2: 2 }, lubricante: { l1: 80 } };
    const despues = { filtro: [{ ...STK[0], stockBodega: 4 }, STK[1]], lubricante: [{ ...LUB[0], stock: 62.5 }] };
    const s = kardexSalidasPM(ins, antes, despues, { fecha: '2026-10-26', equipo: 'CN-9502', pm: 'PM2' });
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ insumoId: 'i1', tipo: 'salida', cantidad: 2, destino: 'CN-9502', documento: 'PM PM2', fecha: '2026-10-26' });
    expect(s[1]).toMatchObject({ insumoId: 'i2', cantidad: 17.5 });
  });
  it('un ítem sin kardex activado no genera movimiento', () => {
    expect(kardexSalidasPM([], { filtro: { f1: 6 } }, { filtro: [{ ...STK[0], stockBodega: 1 }] }, {})).toEqual([]);
  });
});

describe('insumoParaOC', () => {
  const ins = [{ _id: 'a', codigo: 'LF9009', descripcion: 'Filtro aceite' }, { _id: 'b', codigo: 'LF9009', descripcion: 'Filtro aceite' }, { _id: 'c', codigo: 'INJ-1', descripcion: 'Inyector' }, { _id: 'd', codigo: '', descripcion: 'Resma papel' }];
  it('coincide por N° de parte; si hay dos con el mismo, no adivina', () => {
    expect(insumoParaOC(ins, { nParte: 'inj-1' })._id).toBe('c');
    expect(insumoParaOC(ins, { nParte: 'LF9009' })).toBeNull();
  });
  it('sin N° de parte, por nombre exacto; si no hay coincidencia, null', () => {
    expect(insumoParaOC(ins, { componente: 'resma PAPEL' })._id).toBe('d');
    expect(insumoParaOC(ins, { componente: 'Algo distinto' })).toBeNull();
  });
});

describe('«Qué comprar» no repite filtros ni lubricantes del kardex', () => {
  it('solo los insumos sin origen y los repuestos entran en «Insumos generales»', () => {
    const base = { activo: true, stockCritico: 5, consumoMes: 3, saldo: 1, unidad: 'UN', precioUnit: 100 };
    const r = planCompras({ hoy: HOY, insumos: [{ ...base, _id: '1', descripcion: 'Filtro', origen: 'filtro' }, { ...base, _id: '2', descripcion: 'Aceite', origen: 'lubricante' }, { ...base, _id: '3', descripcion: 'Inyector', origen: 'repuesto' }, { ...base, _id: '4', descripcion: 'Guante', origen: null }] });
    expect(r.insumos.map(x => x.nombre).sort()).toEqual(['Guante', 'Inyector']);
  });
});
