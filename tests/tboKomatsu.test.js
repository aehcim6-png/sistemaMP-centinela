// TBO Komatsu (TBO_Besalco_Mineria_jun_24.xlsm): datos del Excel + cruce contra compras reales.
import { describe, it, expect } from 'vitest';
const L = require('../logic.js');

describe('datos del Excel de TBO', () => {
  it('trae todos los ítems de las 3 hojas (58 camión, 71 cargador, 57 bulldozer)', () => {
    expect(L.TBO_ITEMS.camion).toHaveLength(58);
    expect(L.TBO_ITEMS.cargador).toHaveLength(71);
    expect(L.TBO_ITEMS.bulldozer).toHaveLength(57);
  });
  it('todo ítem cae en una familia conocida y su TBO es 2.000, 8.000, 12.000 o 16.000 h', () => {
    const ids = L.TBO_FAMILIAS.map(f => f[0]);
    ['camion', 'cargador', 'bulldozer'].forEach(k => L.TBO_ITEMS[k].forEach(r => {
      expect(ids).toContain(r[0]);
      expect([2000, 8000, 12000, 16000]).toContain(r[2]);
    }));
  });
  it("'Sugerido': 27 repuestos y el total del Excel (USD 173.030,5 = suma de cantidad × unitario)", () => {
    expect(L.TBO_SUGERIDO).toHaveLength(27);
    const total = L.TBO_SUGERIDO.reduce((s, r) => s + r[3] * r[4], 0);
    expect(Math.round(total * 100) / 100).toBe(173030.5);
  });
});

describe('tboClaseModelo', () => {
  it('reconoce los modelos Komatsu del Excel, con sus variantes de escritura', () => {
    expect(L.tboClaseModelo('Komatsu HD785-7')).toMatchObject({ clase: 'camion', exacto: true });
    expect(L.tboClaseModelo('Komatsu HD-785-7')).toMatchObject({ clase: 'camion', exacto: true });
    expect(L.tboClaseModelo('Komatsu WA900-8R')).toMatchObject({ clase: 'cargador' });
    expect(L.tboClaseModelo('Komatsu D375A-6R')).toMatchObject({ clase: 'bulldozer', modeloExcel: 'D375A-6R', exacto: true });
  });
  it('D65EX-18E0 usa el plan del D65EX-16 pero marcado como aproximado', () => {
    expect(L.tboClaseModelo('Komatsu D65EX-18E0')).toMatchObject({ clase: 'bulldozer', modeloExcel: 'D65EX-16', exacto: false });
    expect(L.tboClaseModelo('Komatsu D65EX-16')).toMatchObject({ exacto: true });
  });
  it('modelos sin plan TBO devuelven null', () => {
    ['Komatsu GD-705-5', 'Doosan LCV6-LED', 'Ford Ranger Crew DSL XL', '', null].forEach(m => expect(L.tboClaseModelo(m)).toBeNull());
  });
});

describe('tboFamiliaDeCompra', () => {
  const f = (d, t) => L.tboFamiliaDeCompra(d, t || 'Repuesto');
  it('componentes mayores caen en su familia del TBO', () => {
    expect(f('6505-67-5040rep Turbochar')).toEqual({ id: 'turbo', enTBO: true });
    expect(f('Alternador 24v')).toMatchObject({ id: 'alternador', enTBO: true });
    expect(f('Motor De Partida Hd785')).toMatchObject({ id: 'partida' });
    expect(f('04121-21748 Correa Caucho')).toMatchObject({ id: 'correas' });
  });
  it('N° de parte pegado y en inglés igual cruza (Orbitrol 561-40-84301 como "Steering Valve 5614084301")', () => {
    expect(f('Steering Valve 5614084301')).toMatchObject({ id: 'valvulas', enTBO: true });
  });
  it('orden de prioridad: bomba de combustible/agua antes que "bomba" a secas; cilindro antes que dirección', () => {
    expect(f('Bomba De Combustible Lh')).toMatchObject({ id: 'combustible' });
    expect(f('Bomba De Agua')).toMatchObject({ id: 'agua' });
    expect(f('Bomba Hidraulica Direccion')).toMatchObject({ id: 'bombas' });
    expect(f('Cilindro De Direccion')).toMatchObject({ id: 'cilindros' });
  });
  it('un filtro de aire NO es aire acondicionado (lubricantes/filtros va primero)', () => {
    expect(f('Filtro De Aire Primario')).toMatchObject({ id: 'lubricantes', enTBO: false });
  });
  it('lo que el plan del fabricante no cubre queda fuera del TBO', () => {
    expect(f('Entrediente Half Arrow Izq')).toEqual({ id: 'desgaste', enTBO: false });
    expect(f('Juego De Cadenas Con Zapata')).toMatchObject({ id: 'rodado', enTBO: false });
    expect(f('Litro Delvac Modern 15w-40')).toMatchObject({ id: 'lubricantes', enTBO: false });
    expect(f('Perno Cuch.1-1/4 X 5 5p8')).toMatchObject({ id: 'desgaste' });
    expect(f('Rodamiento 5612261960')).toMatchObject({ id: 'menores', enTBO: false });
  });
  it('servicios: por texto o por tipo; un servicio de un componente mayor se cuenta en el componente', () => {
    expect(f('Servicio Desmontaje Y Montaje', 'Servicio')).toMatchObject({ id: 'servicios', enTBO: false });
    expect(f('Traslado Maquinarias', 'Servicio')).toMatchObject({ id: 'servicios' });
    expect(f('Algo raro sin palabras clave', 'Servicio')).toMatchObject({ id: 'servicios' });
    expect(f('Servicio Reparacion Cilindro Levante', 'Servicio')).toMatchObject({ id: 'cilindros', enTBO: true });
  });
  it('sin ninguna pista → otros', () => {
    expect(f('Camioneta')).toEqual({ id: 'otros', enTBO: false });
    expect(f(null)).toEqual({ id: 'otros', enTBO: false });
  });
});

describe('tboUnirCompras', () => {
  const h = (p, s, d, c, extra) => Object.assign({ pedido: p, sigla: s, detalle: d, costo: c, tipo: 'Repuesto' }, extra);
  it('no duplica lo que está en las dos tablas y gana el histórico (trae tipo)', () => {
    const hist = [h(1, 'CN-1', 'Turbo', 100)];
    const det = [{ pedido: 1, sigla: 'CN-1', detalle: 'Turbo', costo: 100, estado: 'Recepcion Bodega' }];
    const r = L.tboUnirCompras(hist, det);
    expect(r).toHaveLength(1);
    expect(r[0].tipo).toBe('Repuesto');
  });
  it('suma lo que solo está en compras_detalle si la OC está firmada o recibida; ignora "por firmar"', () => {
    const det = [
      { pedido: 2, sigla: 'CN-1', detalle: 'Alternador', costo: 50, estado: 'OC Firmada' },
      { pedido: 3, sigla: 'CN-1', detalle: 'Alternador', costo: 70, estado: 'OC por Firmar' },
    ];
    const r = L.tboUnirCompras([], det);
    expect(r).toHaveLength(1);
    expect(r[0].pedido).toBe(2);
  });
  it('descarta costo 0 y tipos que no son Repuesto/Servicio (filtros, aceites, neumáticos)', () => {
    const hist = [h(1, 'CN-1', 'a', 0), h(2, 'CN-1', 'b', 10, { tipo: 'Filtro' }), h(3, 'CN-1', 'c', 10, { tipo: 'Aceite' }), h(4, 'CN-1', 'd', 10, { tipo: 'Servicio' })];
    expect(L.tboUnirCompras(hist, []).map(o => o.pedido)).toEqual([4].concat([]));
  });
});

describe('tboCruzarCompras', () => {
  const eq = [{ sigla: 'CN-1' }, { sigla: 'CN-2' }];
  const c = [
    { sigla: 'CN-1', detalle: 'Turbo', costo: 1000, proveedor: 'TURBODAL S.A' },
    { sigla: 'CN-2', detalle: 'Turbo', costo: 3000, proveedor: 'KOMATSU CHILE S.A.' },
    { sigla: 'CN-1', detalle: 'Entrediente', costo: 500, proveedor: 'X' },
    { sigla: 'OTRO', detalle: 'Turbo', costo: 9999, proveedor: 'X' },
  ];
  it('separa original (Komatsu) de otros, suma por equipo y deja fuera del TBO lo que corresponde', () => {
    const r = L.tboCruzarCompras(c, eq);
    expect(r.familias.turbo).toMatchObject({ lineas: 2, gasto: 4000, gastoOriginal: 3000, gastoOtros: 1000, enTBO: true });
    expect(r.familias.turbo.porEquipo).toEqual({ 'CN-1': 1000, 'CN-2': 3000 });
    expect(r.familias.desgaste.enTBO).toBe(false);
    expect(r.totales).toMatchObject({ lineas: 3, gasto: 4500, gastoTBO: 4000, gastoOriginal: 3000 });
  });
  it('ignora siglas que no son de la flota y permite filtrar por equipo', () => {
    expect(L.tboCruzarCompras(c, eq).totales.gasto).toBe(4500);
    expect(L.tboCruzarCompras(c, eq, ['CN-2']).totales.gasto).toBe(3000);
  });
});

describe('tboPlanEquipo (reproduce las cuentas del Excel con el horómetro vivo)', () => {
  const hoy = new Date('2026-10-10T12:00:00Z');
  it('CN-9500 con 12.534 h: correas 6 cambios, próximo a 14.000 (faltan 1.466); alternador 1 cambio, próximo a 16.000 (faltan 3.466)', () => {
    const p = L.tboPlanEquipo({ sigla: 'CN-9500', modelo: 'Komatsu HD785-7', horomActual: 12534, hrsDia: 10 }, hoy);
    const co = p.items.find(i => i.item === 'V-BELT');
    expect(co).toMatchObject({ tbo: 2000, cambiosTeoricos: 6, proximoH: 14000, restantesH: 1466 });
    const al = p.items.find(i => i.item === 'ALTERNATOR');
    expect(al).toMatchObject({ tbo: 8000, cambiosTeoricos: 1, proximoH: 16000, restantesH: 3466 });
    expect(p.items).toHaveLength(58);
  });
  it('fecha estimada con las horas/día del equipo (sin dato: 10 h/día)', () => {
    const p = L.tboPlanEquipo({ modelo: 'Komatsu HD785-7', horomActual: 12534, hrsDia: 20 }, hoy);
    expect(p.items.find(i => i.item === 'V-BELT').fechaProx).toBe('2026-12-22'); // 1466/20 ≈ 73 días desde el 10-oct
    const q = L.tboPlanEquipo({ modelo: 'Komatsu HD785-7', horomActual: 12534 }, hoy);
    expect(q.hrsDia).toBe(10);
  });
  it('equipo sin plan TBO → null', () => {
    expect(L.tboPlanEquipo({ modelo: 'Doosan LCV6-LED', horomActual: 100 }, hoy)).toBeNull();
  });
});

describe('tboCruzarSugerido', () => {
  const compras = [
    { detalle: '04121-21748 Correa Caucho', fecha: '2023-06-14', precioUnit: 52241, costo: 52241, cant: 1, proveedor: 'KOMATSU CHILE S.A.' },
    { detalle: 'Correa 0412121748', fecha: '2025-10-15', precioUnit: 84627, costo: 84627, cant: 1, proveedor: 'KOMATSU CHILE S.A.' },
    { detalle: '6505-67-5030rg Turbo Hd78', fecha: '2024-01-09', precioUnit: 2400000, costo: 2400000, cant: 1, proveedor: 'TURBODAL S.A' },
    { detalle: 'Soporte Goma (g) 561-40-6', fecha: '2022-12-26', precioUnit: 99857, costo: 798856, cant: 8, proveedor: 'KOMATSU CHILE S.A.' },
  ];
  it('cruza por N° de parte aun con guiones distintos y toma la última compra', () => {
    const r = L.tboCruzarSugerido(compras, 910).find(x => x.pn === '04121-21748');
    expect(r).toMatchObject({ exacto: true, nCompras: 2, ultFecha: '2025-10-15', ultPrecio: 84627, usd: 84.32, clpRef: Math.round(84.32 * 910) });
  });
  it('un repuesto sin compras queda con nCompras 0; sin tasa no calcula CLP', () => {
    const r = L.tboCruzarSugerido(compras, 0).find(x => x.pn === '423-S62-4330');
    expect(r.nCompras).toBe(0);
    expect(r.clpRef).toBeNull();
  });
  it('un N° de parte cortado a ~25 caracteres cruza por prefijo y se marca como parcial', () => {
    const r = L.tboCruzarSugerido(compras, 910).find(x => x.pn === '6505-67-5030');
    expect(r).toMatchObject({ nCompras: 1, exacto: true });
    const p = L.tboCruzarSugerido([{ detalle: '561-03-8165 cortado', fecha: '2024-01-01', precioUnit: 5, costo: 5, cant: 1 }], 910);
    expect(p.find(x => x.pn === '561-03-81654')).toMatchObject({ nCompras: 1, exacto: false }); // coincide el prefijo de 9 caracteres, no el N° completo
  });
});

describe('origen del repuesto', () => {
  it('clasifica el texto del campo origen', () => {
    expect(L.tboClasificarOrigen('KOMATSU')).toBe('original');
    expect(L.tboClasificarOrigen('Komatsu')).toBe('original');
    expect(L.tboClasificarOrigen('Original (Komatsu)')).toBe('original');
    ['TURBODAL', 'NIITSU Turbo Industries', 'Alternativo', 'Reparado', 'Reacondicionado'].forEach(o => expect(L.tboClasificarOrigen(o)).toBe('alternativo'));
    expect(L.tboClasificarOrigen('')).toBe('');
    expect(L.tboClasificarOrigen(null)).toBe('');
  });
  it('se infiere por la compra del mismo equipo cerca de la fecha del cambio (Komatsu = original, otro = alternativo)', () => {
    const compras = [
      { sigla: 'CN-1', detalle: 'Turbo Hd785', fecha: '2024-01-09', proveedor: 'TURBODAL S.A', tipo: 'Repuesto' },
      { sigla: 'CN-2', detalle: 'Turbo Hd785', fecha: '2024-01-10', proveedor: 'KOMATSU CHILE S.A.', tipo: 'Repuesto' },
      { sigla: 'CN-1', detalle: 'Alternador', fecha: '2024-01-10', proveedor: 'KOMATSU CHILE S.A.', tipo: 'Repuesto' },
    ];
    expect(L.tboOrigenPorCompra('CN-1', '2024-01-12', 'turbo', compras)).toBe('alternativo');
    expect(L.tboOrigenPorCompra('CN-2', '2024-01-12', 'turbo', compras)).toBe('original');
    expect(L.tboOrigenPorCompra('CN-1', '2024-06-12', 'turbo', compras)).toBe(''); // la compra está fuera de la ventana
    expect(L.tboOrigenPorCompra('CN-3', '2024-01-12', 'turbo', compras)).toBe('');
  });
});

describe('tboEstadoFlota — cuánto falta para cada cambio', () => {
  const hoy = new Date('2026-10-10T12:00:00Z');
  const eq = [{ sigla: 'CN-1', modelo: 'Komatsu HD785-7', horomActual: 12534, hrsDia: 20 }, { sigla: 'XX-1', modelo: 'Doosan LCV6-LED', horomActual: 100 }];
  it('equipos sin plan TBO no aparecen; cada equipo con plan trae todos sus ítems', () => {
    const r = L.tboEstadoFlota(eq, [], [], hoy);
    expect(r).toHaveLength(58);
    expect(r.every(x => x.sigla === 'CN-1')).toBe(true);
  });
  it('sin cambio registrado usa el plan teórico, nunca declara vencido', () => {
    const r = L.tboEstadoFlota(eq, [], [], hoy).find(x => x.item === 'V-BELT');
    expect(r).toMatchObject({ conDato: false, fuente: 'plan teórico', restantesH: 1466, nivel: 'ok' });
    expect(L.tboEstadoFlota(eq, [], [], hoy).every(x => x.nivel !== 'vencido')).toBe(true);
  });
  it('con un cambio registrado cuenta desde ese horómetro: turbo cambiado a las 5.000 h → 7.534 h desde, faltan 466 (planificar)', () => {
    const hist = [{ sigla: 'CN-1', comp: 'Turbo', fechaInst: '2023-05-01', horomInstalacion: 5000, origen: 'TURBODAL' }];
    const t = L.tboEstadoFlota(eq, hist, [], hoy).filter(x => /TURBOCHARGER/.test(x.item));
    expect(t).toHaveLength(2); // lado izquierdo y derecho
    t.forEach(x => expect(x).toMatchObject({ conDato: true, fuente: 'cambio registrado', desdeH: 7534, restantesH: 466, nivel: 'planificar', origenUlt: 'alternativo', dias: 23 }));
  });
  it('un cambio registrado hace más horas que el TBO queda vencido', () => {
    const hist = [{ sigla: 'CN-1', comp: 'Alternador', fechaInst: '2020-01-01', horomInstalacion: 1000 }];
    const a = L.tboEstadoFlota(eq, hist, [], hoy).find(x => x.item === 'ALTERNATOR');
    expect(a).toMatchObject({ desdeH: 11534, restantesH: -3534, nivel: 'vencido' });
  });
  it('toma el cambio más reciente (mayor horómetro) y marca "original de fábrica" desde Componentes Mayores', () => {
    const hist = [{ sigla: 'CN-1', comp: 'Alternador', horomInstalacion: 2000 }, { sigla: 'CN-1', comp: 'Alternador', horomInstalacion: 9000 }];
    expect(L.tboEstadoFlota(eq, hist, [], hoy).find(x => x.item === 'ALTERNATOR').desdeH).toBe(3534);
    const cm = [{ sigla: 'CN-1', comp: 'Transmisión', esOriginal: true }];
    const t = L.tboEstadoFlota(eq, [], cm, hoy).find(x => x.item === 'TRANSMISSION ASSY');
    expect(t).toMatchObject({ fuente: 'original de fábrica', desdeH: 12534, origenUlt: 'original', restantesH: 3466 });
  });
  it('una instalación de Componentes Mayores cuenta solo si trae fecha (como compEstado); sin fecha es una fila vacía', () => {
    const sinFecha = [{ sigla: 'CN-1', comp: 'Alternador', horomComp: 12534 }];
    expect(L.tboEstadoFlota(eq, [], sinFecha, hoy).find(x => x.item === 'ALTERNATOR').conDato).toBe(false);
    const conFecha = [{ sigla: 'CN-1', comp: 'Alternador', horomComp: 9000, fechaInst: '2025-01-01' }];
    expect(L.tboEstadoFlota(eq, [], conFecha, hoy).find(x => x.item === 'ALTERNATOR')).toMatchObject({ conDato: true, desdeH: 3534 });
  });
  it('ignora cambios con horómetro mayor al actual (dato mal cargado)', () => {
    const hist = [{ sigla: 'CN-1', comp: 'Alternador', horomInstalacion: 99999 }];
    expect(L.tboEstadoFlota(eq, hist, [], hoy).find(x => x.item === 'ALTERNATOR').conDato).toBe(false);
  });
  it('resumen de alertas', () => {
    const hist = [{ sigla: 'CN-1', comp: 'Alternador', horomInstalacion: 1000 }, { sigla: 'CN-1', comp: 'Turbo', horomInstalacion: 5000 }];
    const r = L.tboResumenAlertas(L.tboEstadoFlota(eq, hist, [], hoy));
    expect(r.vencidos).toBe(1);
    expect(r.conDato).toBe(3);
    expect(r.total).toBe(58);
    expect(r.planificar).toBeGreaterThanOrEqual(2);
  });
});

describe('tboVidaPorOrigen — cuánto duró, original vs alternativo, contra el TBO', () => {
  const hist = [
    { sigla: 'A', comp: 'Turbo', fechaInst: '2023-01-01', horomInstalacion: 1000, origen: 'Komatsu' },
    { sigla: 'A', comp: 'Turbo', fechaInst: '2023-06-01', horomInstalacion: 5000, origen: 'TURBODAL' },
    { sigla: 'A', comp: 'Turbo', fechaInst: '2024-01-01', horomInstalacion: 6000, origen: 'TURBODAL' },
    { sigla: 'B', comp: 'Turbo', fechaInst: '2023-01-01', horomInstalacion: 2000, origen: 'KOMATSU' },
    { sigla: 'B', comp: 'Turbo', fechaInst: '2023-09-01', horomInstalacion: 10000 },
    { sigla: 'A', comp: 'Asiento', fechaInst: '2023-01-01', horomInstalacion: 100 },
    { sigla: 'A', comp: 'Asiento', fechaInst: '2023-02-01', horomInstalacion: 700 },
  ];
  it('mide la duración entre cambios consecutivos y agrupa por origen', () => {
    const r = L.tboVidaPorOrigen(hist, []);
    const orig = r.find(x => x.comp === 'Turbo' && x.origen === 'original');
    const alt = r.find(x => x.comp === 'Turbo' && x.origen === 'alternativo');
    expect(orig).toMatchObject({ n: 2, mediana: 6000, min: 4000, max: 8000 }); // A: 1000→5000 = 4000, B: 2000→10000 = 8000
    expect(alt).toMatchObject({ n: 1, mediana: 1000 });                         // A: 5000→6000
  });
  it('compara contra el TBO de Komatsu (turbo = 8.000 h)', () => {
    const r = L.tboVidaPorOrigen(hist, []);
    expect(r.find(x => x.origen === 'original').tbo).toEqual({ min: 8000, max: 8000 });
    expect(r.find(x => x.origen === 'original').pctTBO).toBe(75);
    expect(r.find(x => x.origen === 'alternativo').pctTBO).toBe(13);
  });
  it('componentes fuera del plan se miden igual, sin TBO', () => {
    const a = L.tboVidaPorOrigen(hist, []).find(x => x.comp === 'Asiento');
    expect(a).toMatchObject({ origen: 'sin dato', n: 1, mediana: 600, tbo: null, pctTBO: null });
  });
  it('un origen vacío se infiere por la compra y se cuenta como inferido', () => {
    const h = [
      { sigla: 'C', comp: 'Turbo', fechaInst: '2023-03-01', horomInstalacion: 1000 },
      { sigla: 'C', comp: 'Turbo', fechaInst: '2023-09-01', horomInstalacion: 3000 },
    ];
    const compras = [{ sigla: 'C', detalle: 'Turbo Hd785', fecha: '2023-02-25', proveedor: 'TURBODAL S.A', tipo: 'Repuesto' }];
    const r = L.tboVidaPorOrigen(h, compras);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ origen: 'alternativo', n: 1, inferidos: 1, mediana: 2000 });
  });
  it('ignora eventos sin horómetro y duraciones no positivas', () => {
    const h = [{ sigla: 'D', comp: 'Turbo', horomInstalacion: null }, { sigla: 'D', comp: 'Turbo', horomInstalacion: 500 }, { sigla: 'D', comp: 'Turbo', horomInstalacion: 500 }];
    expect(L.tboVidaPorOrigen(h, [])).toEqual([]);
  });
});

describe('tboPrecioItem', () => {
  const compras = [
    { sigla: 'CN-1', detalle: 'Turbo Hd785', precioUnit: 8000000, costo: 8000000, cant: 1, fecha: '2024-01-01', proveedor: 'KOMATSU CHILE S.A.', tipo: 'Repuesto' },
    { sigla: 'CN-1', detalle: 'Turbo Hd785 rep', precioUnit: 2400000, costo: 2400000, cant: 1, fecha: '2025-01-01', proveedor: 'TURBODAL S.A', tipo: 'Repuesto' },
    { sigla: 'CN-2', detalle: 'Turbo Hd785 rep', precioUnit: 2800000, costo: 2800000, cant: 1, fecha: '2024-06-01', proveedor: 'NIVIMA 2020 SPA', tipo: 'Repuesto' },
    { sigla: 'CF-1', detalle: 'Turbo Wa900', precioUnit: 9000000, costo: 9000000, cant: 1, fecha: '2025-06-01', proveedor: 'KOMATSU CHILE S.A.', tipo: 'Repuesto' },
    { sigla: 'CN-1', detalle: 'Servicio cambio de turbo', precioUnit: 500000, costo: 500000, cant: 1, fecha: '2025-02-01', proveedor: 'X', tipo: 'Servicio' },
  ];
  it('separa lo pagado a Komatsu (original) de lo pagado a otros y usa solo equipos de la misma clase, sin servicios', () => {
    const p = L.tboPrecioItem('TURBOCHARGER (L)', 'camion', compras, ['CN-1', 'CN-2'], 910);
    expect(p).toMatchObject({ n: 3, original: { n: 1, mediana: 8000000 }, otros: { n: 2, mediana: 2600000 }, ultimo: 2400000, fechaUlt: '2025-01-01' });
  });
  it('trae el precio de lista USD del listado Sugerido solo para el camión y lo valoriza con la tasa', () => {
    const p = L.tboPrecioItem('TURBOCHARGER (L)', 'camion', [], [], 910);
    expect(p).toMatchObject({ usd: 8002.71, usdPN: '6505-67-5040', clpRef: Math.round(8002.71 * 910), n: 0 });
    expect(L.tboPrecioItem('TURBOCHARGER', 'cargador', [], [], 910).usd).toBeNull();
  });
  it('un ítem sin regla de precio ni compras se devuelve igual, sin precio', () => {
    expect(L.tboPrecioItem('MAIN FRAME & HITCH FRAME', 'camion', compras, ['CN-1'], 910)).toMatchObject({ n: 0, usd: null, mediana: null });
  });
});

describe('Excel: tipo de aplicación (macro Calculadora) y riesgo Weibull (macro Calculadora2)', () => {
  const hoy = new Date('2026-10-10T12:00:00Z');
  const eq = { sigla: 'CN-1', modelo: 'Komatsu HD785-7', horomActual: 12534, hrsDia: 20 };
  it('factores de aplicación = los de la macro: ligera 120%, normal 100%, severa 80%', () => {
    expect(L.TBO_APLICACION).toEqual({ ligera: 1.2, normal: 1, severa: 0.8 });
  });
  it('aplicación severa acorta el TBO (correas 2.000 → 1.600 h) y ligera lo alarga (→ 2.400 h)', () => {
    const sev = L.tboPlanEquipo(eq, hoy, 'severa');
    expect(sev).toMatchObject({ aplicacion: 'severa', factor: 0.8 });
    expect(sev.items.find(i => i.item === 'V-BELT')).toMatchObject({ tbo: 1600, tboFab: 2000, cambiosTeoricos: 7, proximoH: 12800, restantesH: 266 });
    const lig = L.tboPlanEquipo(eq, hoy, 'ligera');
    expect(lig.items.find(i => i.item === 'V-BELT')).toMatchObject({ tbo: 2400, cambiosTeoricos: 5, proximoH: 14400, restantesH: 1866 });
    expect(L.tboPlanEquipo(eq, hoy).aplicacion).toBe('normal');
    expect(L.tboPlanEquipo(eq, hoy, 'inventada').factor).toBe(1);
  });
  it('el estado de flota respeta la aplicación', () => {
    const e = L.tboEstadoFlota([eq], [], [], hoy, 'severa').find(x => x.item === 'V-BELT');
    expect(e).toMatchObject({ tbo: 1600, tboFab: 2000, restantesH: 266 });
  });
});

describe('tboRiesgoWeibull — reproduce la tabla Weibull oculta del Excel', () => {
  it('con t = TBO el riesgo es 5% (el TBO es el B5) y con t=0 es 0', () => {
    expect(L.tboRiesgoWeibull(8000, 8000)).toBeCloseTo(0.05, 10);
    expect(L.tboRiesgoWeibull(0, 8000)).toBe(0);
    expect(L.tboRiesgoWeibull(4000, 8000)).toBeLessThan(0.01);
  });
  it('coincide (±250 h, el redondeo de la tabla a 500 h) con celdas reales de la hoja Weibull', () => {
    // [TBO, Bx (probabilidad), horas en la tabla del Excel]
    const tabla = [[16000, 0.20, 26000], [16000, 0.50, 38000], [8000, 0.30, 15500], [8000, 0.50, 19000], [12000, 0.25, 21500], [12000, 0.10, 15500], [16000, 0.35, 32500], [8000, 0.15, 11500]];
    tabla.forEach(([tbo, p, horas]) => {
      // horas donde el riesgo vale p: invertimos la fórmula y comparamos con la tabla
      const t = tbo * Math.pow(Math.log(1 - p) / Math.log(0.95), 1 / 3);
      expect(Math.abs(t - horas)).toBeLessThanOrEqual(250);
      expect(L.tboRiesgoWeibull(t, tbo)).toBeCloseTo(p, 8);
    });
  });
  it('riesgo condicional en el horizonte: crece con las horas y es 0 con horizonte 0', () => {
    expect(L.tboRiesgoHorizonte(8000, 8000, 0)).toBe(0);
    const a = L.tboRiesgoHorizonte(4000, 8000, 500), b = L.tboRiesgoHorizonte(12000, 8000, 500);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    // 1 − S(t+h)/S(t): con t=0 coincide con el riesgo acumulado a h horas
    expect(L.tboRiesgoHorizonte(0, 8000, 8000)).toBeCloseTo(0.05, 10);
  });
  it('probabilidad 1–5 para la matriz (cortes en B5/B10/B20/B35)', () => {
    expect(L.tboProbNivel(0.02)).toBe(1);
    expect(L.tboProbNivel(0.05)).toBe(1);
    expect(L.tboProbNivel(0.07)).toBe(2);
    expect(L.tboProbNivel(0.15)).toBe(3);
    expect(L.tboProbNivel(0.30)).toBe(4);
    expect(L.tboProbNivel(0.60)).toBe(5);
  });
  it('el estado de flota trae riesgo y probabilidad: alternador con 11.534 h desde el cambio (TBO 8.000) ≈ 14% → nivel 3', () => {
    const hist = [{ sigla: 'CN-1', comp: 'Alternador', horomInstalacion: 1000 }];
    const a = L.tboEstadoFlota([{ sigla: 'CN-1', modelo: 'Komatsu HD785-7', horomActual: 12534, hrsDia: 20 }], hist, [], new Date('2026-10-10T12:00:00Z')).find(x => x.item === 'ALTERNATOR');
    expect(a.riesgo).toBeCloseTo(0.1424, 3);
    expect(a.prob).toBe(3);
    expect(a.riesgo500).toBeGreaterThan(0);
  });
});

describe('tboMatrizRiesgo', () => {
  const hoy = new Date('2026-10-10T12:00:00Z');
  const eqs = [{ sigla: 'CN-1', modelo: 'Komatsu HD785-7', horomActual: 30000, hrsDia: 20 }];
  const hist = [
    { sigla: 'CN-1', comp: 'Alternador', horomInstalacion: 1000 },   // 29.000 h desde, TBO 8.000 → riesgo altísimo
    { sigla: 'CN-1', comp: 'Turbo', horomInstalacion: 25000 },       // 5.000 h desde, TBO 8.000 → dentro del TBO
  ];
  const est = L.tboEstadoFlota(eqs, hist, [], hoy);
  it('solo entran los cambios con último cambio conocido; sin precio el impacto es neutro (3)', () => {
    const m = L.tboMatrizRiesgo(est, () => null);
    expect(m.items).toHaveLength(3); // alternador + 2 turbos (izq/der)
    m.items.forEach(i => expect(i.impacto).toBe(3));
    expect(m.items[0].item).toBe('ALTERNATOR');
    expect(m.items[0]).toMatchObject({ prob: 5, pxi: 15, nivelPxI: 'Alto' });
    expect(m.conPrecio).toBe(0);
  });
  it('con ≥5 precios usa quintiles para el impacto y suma PxI', () => {
    const precios = { ALTERNATOR: 2000000 };
    const muchos = est.concat([1, 2, 3, 4, 5].map(k => Object.assign({}, est[0], { item: 'X' + k, conDato: true, prob: 1, riesgo: 0.01 })));
    const valores = { ALTERNATOR: 9000000, X1: 100, X2: 200, X3: 300, X4: 400, X5: 500 };
    const m = L.tboMatrizRiesgo(muchos, x => valores[x.item] || null);
    const alt = m.items.find(i => i.item === 'ALTERNATOR');
    expect(alt.impacto).toBe(5);
    expect(alt.pxi).toBe(25);
    expect(alt.nivelPxI).toBe('Extremo');
    expect(precios.ALTERNATOR).toBeGreaterThan(0);
    expect(Object.keys(m.celdas).length).toBeGreaterThan(1);
  });
  it('los ítems teóricos (sin cambio registrado) no entran', () => {
    expect(L.tboMatrizRiesgo(L.tboEstadoFlota(eqs, [], [], hoy), () => null).items).toEqual([]);
  });
});

describe('tboCostoPorHora — original vs alternativo', () => {
  const eqs = [{ sigla: 'CN-1', modelo: 'Komatsu HD785-7' }, { sigla: 'CN-2', modelo: 'Komatsu HD785-7' }];
  const compras = [
    { sigla: 'CN-1', detalle: 'Turbo Hd785', precioUnit: 8000000, costo: 8000000, cant: 1, fecha: '2024-01-01', proveedor: 'KOMATSU CHILE S.A.', tipo: 'Repuesto' },
    { sigla: 'CN-2', detalle: 'Turbo Hd785 rep', precioUnit: 2400000, costo: 2400000, cant: 1, fecha: '2025-01-01', proveedor: 'TURBODAL S.A', tipo: 'Repuesto' },
  ];
  const vida = [
    { comp: 'Turbo', origen: 'original', mediana: 4000, tbo: { min: 8000, max: 8000 }, pctTBO: 50 },
    { comp: 'Turbo', origen: 'alternativo', mediana: 1000, tbo: { min: 8000, max: 8000 }, pctTBO: 13 },
    { comp: 'Asiento', origen: 'sin dato', mediana: 600, tbo: null, pctTBO: null },
  ];
  it('costo por hora = precio ÷ duración real; el alternativo barato pero de poca vida sale más caro por hora', () => {
    const r = L.tboCostoPorHora(vida, compras, eqs, 910);
    const o = r.find(x => x.origen === 'original'), a = r.find(x => x.origen === 'alternativo');
    expect(o).toMatchObject({ precio: 8000000, costoHora: 2000, costoHoraTBO: 1000, fuentePrecio: 'pagado a Komatsu' });
    expect(a).toMatchObject({ precio: 2400000, costoHora: 2400 });
    expect(a.costoHora).toBeGreaterThan(o.costoHora);
  });
  it('sin compras al original usa la lista Komatsu en USD valorizada con la tasa; componentes sin ítem en el plan quedan sin precio', () => {
    const r = L.tboCostoPorHora(vida, [], eqs, 910);
    expect(r.find(x => x.origen === 'original')).toMatchObject({ precio: Math.round(8002.71 * 910), fuentePrecio: 'lista Komatsu (USD)' });
    expect(r.find(x => x.comp === 'Asiento')).toMatchObject({ precio: null, costoHora: null });
  });
});

describe('TBO × Stock × Compras', () => {
  const hoy = new Date('2026-10-10T12:00:00Z');
  it('cantidad por cambio: la del listado Sugerido (6 inyectores, 2 motores de partida) o 1', () => {
    expect(L.tboCantidadItem('FUEL INJECTOR')).toBe(6);
    expect(L.tboCantidadItem('STARTING MOTOR')).toBe(2);
    expect(L.tboCantidadItem('ALTERNATOR')).toBe(1);
    expect(L.tboCantidadItem('MAIN FRAME & HITCH FRAME')).toBe(1);
  });

  describe('tiempo de entrega', () => {
    const rec = (det, t) => ({ estado: 'Recepcion Bodega', detalle: det, tiempoRespuesta: t });
    const cd = [rec('Turbo Hd785', '10 dias 0h 0m'), rec('Turbo Hd785 rg', '20 dias 0h 0m'), rec('Turbo repar', '30 dias 2h 0m'), rec('Correa Caucho', '2 dias 0h 0m'),
      { estado: 'OC Firmada', detalle: 'Turbo X', tiempoRespuesta: '99 dias' }, rec('Sin dato', null)];
    it('usa la mediana de los pedidos recibidos de ese repuesto (≥3); ignora los abiertos', () => {
      const f = L.tboLeadTimeFn(cd);
      expect(f('TURBOCHARGER (L)')).toMatchObject({ dias: 20, n: 3 });
      expect(f('TURBOCHARGER (L)').fuente).toContain('3 pedidos de este repuesto');
    });
    it('con menos de 3 pedidos usa la mediana de todos los recibidos; sin historial, 34 días', () => {
      const f = L.tboLeadTimeFn(cd);
      expect(f('V-BELT')).toMatchObject({ n: 4 });
      expect(f('V-BELT').fuente).toContain('todos los pedidos');
      expect(L.tboLeadTimeFn([])('ALTERNATOR')).toEqual({ dias: 34, n: 0, fuente: 'sin historial: 34 días por defecto', gamma: null, p90: null });
    });
  });

  describe('stock', () => {
    const stk = [
      { nParte: '600-861-9122', descripcion: 'Alternador', equipoModelo: 'HD785-7', stockBodega: 2, pendiente: 1 },
      { nParte: '600-861-9122', descripcion: 'Alternador', equipoModelo: 'WA900', stockBodega: 5 },
      { nParte: '6505-67-5040', descripcion: 'Turbo LH', equipoModelo: 'CN-9500', stockBodega: 1 },
    ];
    const rep = [{ nParte: '600-861-9122', componente: 'Alternador', equipo: 'HD785-7', stockActual: 3 }];
    const f = L.tboStockFn(stk, rep);
    it('cruza por N° de parte (sin importar guiones) y solo cuenta lo que sirve al equipo (su sigla, su modelo o sin equipo)', () => {
      expect(f('ALTERNATOR', 'CN-9500', 'Komatsu HD785-7')).toMatchObject({ enStock: 2, pendiente: 1, porPN: true });
      expect(f('TURBOCHARGER (L)', 'CN-9500', 'Komatsu HD785-7').enStock).toBe(1);
      expect(f('TURBOCHARGER (L)', 'CN-9501', 'Komatsu HD785-7').enStock).toBe(0); // el turbo está asignado a CN-9500
    });
    it('Stock y Repuestos Críticos no se suman (pueden ser el mismo repuesto): toma el mayor', () => {
      const r = f('ALTERNATOR', 'CN-9500', 'Komatsu HD785-7');
      expect(r).toMatchObject({ enStock: 2, enCriticos: 3, unidades: 3 });
    });
    it('un ítem sin forma de reconocerlo no inventa stock', () => {
      expect(f('MAIN FRAME & HITCH FRAME', 'CN-9500', 'Komatsu HD785-7').unidades).toBe(0);
    });
  });

  describe('pedidos abiertos', () => {
    const cd = [
      { estado: 'OC Firmada', detalle: 'Alternador 24v', sigla: 'CN-9501', fecha: '2026-09-20', proveedor: 'KOMATSU' },
      { estado: 'Recepcion Bodega', detalle: 'Alternador 24v', sigla: 'CN-9500', fecha: '2026-01-01', proveedor: 'KOMATSU' },
      { estado: 'OC por Firmar', detalle: 'Alternador wa900', sigla: 'CF-1', fecha: '2026-10-01', proveedor: 'X' },
    ];
    const f = L.tboPedidosAbiertosFn(cd, [{ estado: 'Pendiente', componente: 'Alternador', equipo: 'CN-9500', fecha: '2026-10-05', proveedor: 'Y' }, { estado: 'Recibida', componente: 'Alternador', equipo: 'CN-9500' }], hoy);
    it('toma OC por firmar/firmadas y las OC creadas en la app (Pendiente) de ese equipo o de su clase; ignora recibidas y de otras clases', () => {
      const r = f('ALTERNATOR', 'CN-9500', ['CN-9500', 'CN-9501']);
      expect(r).toHaveLength(2);
      expect(r.map(p => p.origen).sort()).toEqual(['compras', 'ordenes']);
      expect(r.find(p => p.origen === 'compras')).toMatchObject({ dias: 21, estado: 'OC Firmada' }) // 20,5 días redondeados;
    });
    it('un ítem sin forma de reconocerlo → sin pedidos', () => {
      expect(f('MAIN FRAME & HITCH FRAME', 'CN-9500', ['CN-9500'])).toEqual([]);
    });
  });

  describe('tboDecisionCompra', () => {
    it('hay stock → cubierto; hay pedido → en camino', () => {
      expect(L.tboDecisionCompra({ dias: 5, lead: 30, stock: 1, pedidos: 0, fechaProx: '2026-10-15' }).decision).toBe('cubierto');
      expect(L.tboDecisionCompra({ dias: 5, lead: 30, stock: 0, pedidos: 1, fechaProx: '2026-10-15' }).decision).toBe('en_camino');
    });
    it('sin stock ni pedido: pedir ya si el cambio llega antes de lead+7; planificar hasta 45 días más; después no urgente', () => {
      expect(L.tboDecisionCompra({ dias: 30, lead: 30, stock: 0, pedidos: 0, fechaProx: '2026-11-09' }).decision).toBe('pedir_ya');
      expect(L.tboDecisionCompra({ dias: 37, lead: 30, stock: 0, pedidos: 0, fechaProx: '2026-11-16' }).decision).toBe('pedir_ya');
      expect(L.tboDecisionCompra({ dias: 60, lead: 30, stock: 0, pedidos: 0, fechaProx: '2026-12-09' }).decision).toBe('planificar');
      expect(L.tboDecisionCompra({ dias: 200, lead: 30, stock: 0, pedidos: 0, fechaProx: '2027-04-29' }).decision).toBe('no_urgente');
    });
    it('"pedir antes del" = fecha del cambio − (lead + 7 días de colchón)', () => {
      const r = L.tboDecisionCompra({ dias: 60, lead: 30, stock: 0, pedidos: 0, fechaProx: '2026-12-09' });
      expect(r.pedirAntesDe).toBe('2026-11-02');
      expect(r.diasParaPedir).toBe(23);
    });
  });

  describe('tboPlanCompras', () => {
    const eq = [{ sigla: 'CN-1', modelo: 'Komatsu HD785-7', horomActual: 12534, hrsDia: 20 }];
    const hist = [{ sigla: 'CN-1', comp: 'Alternador', horomInstalacion: 4000, fechaInst: '2025-01-01' }]; // 8.534 h desde, TBO 8.000 → vencido
    const est = L.tboEstadoFlota(eq, hist, [], hoy);
    const ctx = (extra) => Object.assign({ hoy, equipos: eq, compras: [], comprasDetalle: [], stk: [], repuestos: [], ordenes: [], tasa: 910 }, extra);
    it('un cambio vencido sin stock ni pedido es "pedir ya", con costo = lista USD × tasa', () => {
      const r = L.tboPlanCompras(est, ctx());
      const a = r.filas.find(f => f.item === 'ALTERNATOR');
      expect(a).toMatchObject({ decision: 'pedir_ya', cant: 1, precio: Math.round(2192.14 * 910), lead: { dias: 34 } });
      expect(r.totales.pedir_ya).toBe(1);
      expect(r.totales.presupuestoPedirYa).toBe(Math.round(2192.14 * 910));
    });
    it('con stock queda cubierto y no suma al presupuesto', () => {
      const r = L.tboPlanCompras(est, ctx({ stk: [{ nParte: '600-861-9122', descripcion: 'Alternador', equipoModelo: 'HD785-7', stockBodega: 1 }] }));
      expect(r.filas.find(f => f.item === 'ALTERNATOR').decision).toBe('cubierto');
      expect(r.totales.presupuestoPedirYa).toBe(0);
    });
    it('con un pedido abierto queda en camino', () => {
      const r = L.tboPlanCompras(est, ctx({ comprasDetalle: [{ estado: 'OC Firmada', detalle: 'Alternador', sigla: 'CN-1', fecha: '2026-10-01', proveedor: 'K' }] }));
      expect(r.filas.find(f => f.item === 'ALTERNATOR')).toMatchObject({ decision: 'en_camino' });
    });
    it('el plan teórico (sin cambio registrado) no entra salvo que se pida; se cuentan los omitidos', () => {
      const sinDato = L.tboEstadoFlota(eq, [], [], hoy);
      const a = L.tboPlanCompras(sinDato, ctx());
      expect(a.filas).toEqual([]);
      expect(a.omitidosTeoricos).toBeGreaterThan(0);
      const b = L.tboPlanCompras(sinDato, ctx(), { incluirTeorico: true });
      expect(b.filas.length).toBeGreaterThan(0);
    });
    it('ordena primero lo que hay que pedir ya', () => {
      const hist2 = hist.concat([{ sigla: 'CN-1', comp: 'Turbo', horomInstalacion: 6000, fechaInst: '2025-01-01' }]); // turbos: 6.534 h desde → faltan 1.466 h = 73 días
      const r = L.tboPlanCompras(L.tboEstadoFlota(eq, hist2, [], hoy), ctx({ stk: [{ nParte: '600-861-9122', descripcion: 'Alternador', equipoModelo: 'HD785-7', stockBodega: 1 }] }));
      const orden = r.filas.map(f => f.decision);
      expect(orden.indexOf('pedir_ya')).toBeLessThan(orden.indexOf('cubierto') === -1 ? 99 : orden.indexOf('cubierto'));
    });
  });
});

describe('Beta, Bernoulli y Gamma', () => {
  describe('Gamma: CDF (gamma incompleta regularizada) y cuantil — contra fórmulas cerradas', () => {
    it('P(1,x) = 1 − e^−x; P(2,x) = 1 − (1+x)e^−x; P(1/2,x) = erf(√x)', () => {
      expect(L._gammaIncRegularizada(1, 2)).toBeCloseTo(1 - Math.exp(-2), 10);
      expect(L._gammaIncRegularizada(2, 2)).toBeCloseTo(1 - 3 * Math.exp(-2), 10);
      expect(L._gammaIncRegularizada(0.5, 1)).toBeCloseTo(0.8427007929, 8);
      expect(L._gammaIncRegularizada(5, 12)).toBeCloseTo(0.9923996, 6);
      expect(L._gammaIncRegularizada(3, 0)).toBe(0);
    });
    it('rama de fracción continua (x grande) también cuadra: P(1,10)', () => {
      expect(L._gammaIncRegularizada(1, 10)).toBeCloseTo(1 - Math.exp(-10), 10);
    });
    it('gammaCDF usa la escala; el cuantil invierte la CDF; con k=1 (exponencial) q90 = θ·ln10', () => {
      expect(L.gammaCDF(20, 2, 10)).toBeCloseTo(L._gammaIncRegularizada(2, 2), 12);
      expect(L.gammaCuantil(0.9, 1, 5)).toBeCloseTo(5 * Math.log(10), 5);
      const q = L.gammaCuantil(0.75, 3.6, 8.33);
      expect(L.gammaCDF(q, 3.6, 8.33)).toBeCloseTo(0.75, 8);
      expect(L.gammaCuantil(0, 2, 2)).toBeNull();
    });
    it('ajuste por momentos: k = media²/var, θ = var/media; pide ≥5 datos positivos y varianza > 0', () => {
      const f = L.ajusteGammaMomentos([10, 20, 30, 40, 50]);
      expect(f.k).toBeCloseTo(3.6, 10);
      expect(f.theta).toBeCloseTo(250 / 30, 10);
      expect(f.k * f.theta).toBeCloseTo(30, 10); // media = k·θ
      expect(L.ajusteGammaMomentos([1, 2, 3, 4])).toBeNull();
      expect(L.ajusteGammaMomentos([5, 5, 5, 5, 5])).toBeNull();
      expect(L.ajusteGammaMomentos([0, -1, 5, 6, 7, 8])).toBeNull(); // los no positivos se descartan → quedan 4
    });
  });

  describe('Beta–Bernoulli', () => {
    it('Beta(1,1): el cuantil de p es p; intervalo 90% = [0,05; 0,95]', () => {
      expect(L.betaCuantil(0.3, 1, 1)).toBeCloseTo(0.3, 8);
      const b = L.betaBernoulliPosterior(0, 0);
      expect(b).toMatchObject({ a: 1, b: 1, media: 0.5 });
      expect(b.ic90[0]).toBeCloseTo(0.05, 8);
      expect(b.ic90[1]).toBeCloseTo(0.95, 8);
    });
    it('posterior: 8 éxitos de 10 con prior uniforme → Beta(9,3), media 0,75, y el IC contiene la media', () => {
      const b = L.betaBernoulliPosterior(8, 10);
      expect(b).toMatchObject({ a: 9, b: 3, media: 0.75, exitos: 8, n: 10 });
      expect(b.ic90[0]).toBeLessThan(0.75);
      expect(b.ic90[1]).toBeGreaterThan(0.75);
      expect(L._betaIncompletaRegularizada(b.ic90[0], 9, 3)).toBeCloseTo(0.05, 6);
      expect(L._betaIncompletaRegularizada(b.ic90[1], 9, 3)).toBeCloseTo(0.95, 6);
    });
    it('con 2 casos el intervalo es muy ancho: 2 de 2 NO es 100%', () => {
      const b = L.betaBernoulliPosterior(2, 2);
      expect(b.media).toBeCloseTo(0.75, 10);
      expect(b.ic90[0]).toBeLessThan(0.55);
    });
    it('P(X1 > X2): contra Uniforme da la media de X1 (Beta(2,1) → 2/3); simétrico → 1/2; muy distintos → casi 1', () => {
      expect(L.probabilidadMayorBeta(2, 1, 1, 1)).toBeCloseTo(2 / 3, 6);
      expect(L.probabilidadMayorBeta(3, 3, 3, 3)).toBeCloseTo(0.5, 6);
      expect(L.probabilidadMayorBeta(9, 3, 3, 9)).toBeGreaterThan(0.99);
      expect(L.probabilidadMayorBeta(9, 3, 3, 9) + L.probabilidadMayorBeta(3, 9, 9, 3)).toBeCloseTo(1, 6);
    });
  });

  describe('vida por origen: ¿llega al TBO? (Bernoulli) y comparación original vs alternativo', () => {
    // original: 4 cambios, 3 llegan a 8.000 h; alternativo: 4 cambios, 0 llegan
    const mk = (sigla, h0, dur, origen) => [{ sigla, comp: 'Turbo', fechaInst: '2023-01-01', horomInstalacion: h0, origen }, { sigla, comp: 'Turbo', fechaInst: '2024-01-01', horomInstalacion: h0 + dur, origen: 'x' }];
    const hist = [].concat(mk('A', 1000, 9000, 'Komatsu'), mk('B', 1000, 8500, 'Komatsu'), mk('C', 1000, 8000, 'Komatsu'), mk('D', 1000, 5000, 'Komatsu'),
      mk('E', 1000, 2000, 'Turbodal'), mk('F', 1000, 1500, 'Turbodal'), mk('G', 1000, 3000, 'Turbodal'), mk('H', 1000, 1000, 'Turbodal'));
    const rows = L.tboVidaPorOrigen(hist, []);
    it('cada fila trae el posterior Beta del éxito "duró ≥ TBO"', () => {
      const o = rows.find(r => r.origen === 'original'), a = rows.find(r => r.origen === 'alternativo');
      expect(o.bern).toMatchObject({ exitos: 3, n: 4, a: 4, b: 2 });
      expect(a.bern).toMatchObject({ exitos: 0, n: 4, a: 1, b: 5 });
      expect(o.bern.media).toBeCloseTo(4 / 6, 10);
    });
    it('sin TBO único no hay Bernoulli', () => {
      const sinTbo = L.tboVidaPorOrigen([{ sigla: 'A', comp: 'Asiento', horomInstalacion: 100 }, { sigla: 'A', comp: 'Asiento', horomInstalacion: 700 }], []);
      expect(sinTbo[0].bern).toBeNull();
    });
    it('probabilidad de que el original sea mejor que el alternativo', () => {
      const c = L.tboComparaOrigen(rows);
      expect(c).toHaveLength(1);
      expect(c[0]).toMatchObject({ comp: 'Turbo', nOriginal: 4, nAlternativo: 4 });
      expect(c[0].pOriginalMejor).toBeGreaterThan(0.9);
      expect(c[0].pOriginalMejor).toBeCloseTo(L.probabilidadMayorBeta(4, 2, 1, 5), 10);
    });
    it('si falta uno de los dos orígenes no compara', () => {
      expect(L.tboComparaOrigen(rows.filter(r => r.origen === 'original'))).toEqual([]);
    });
  });

  describe('tiempo de entrega con Gamma → probabilidad de llegar a tiempo y percentil 90', () => {
    const rec = (det, d) => ({ estado: 'Recepcion Bodega', detalle: det, tiempoRespuesta: d + ' dias 0h 0m' });
    const cd = [10, 14, 18, 25, 40, 60].map(d => rec('Turbo Hd785', d));
    const f = L.tboLeadTimeFn(cd);
    it('con ≥5 pedidos del repuesto ajusta una Gamma; el p90 queda sobre la mediana', () => {
      const r = f('TURBOCHARGER (L)');
      expect(r.gamma).not.toBeNull();
      expect(r.gamma.n).toBe(6);
      expect(r.p90).toBeGreaterThan(r.dias);
      expect(L.gammaCDF(r.p90, r.gamma.k, r.gamma.theta)).toBeGreaterThanOrEqual(0.9 - 1e-6);
    });
    it('la probabilidad de llegar a tiempo crece con los días disponibles', () => {
      const r = f('TURBOCHARGER (L)');
      const p10 = L.tboProbLlegaAntes(r, 10), p30 = L.tboProbLlegaAntes(r, 30), p90 = L.tboProbLlegaAntes(r, 90);
      expect(p10).toBeLessThan(p30);
      expect(p30).toBeLessThan(p90);
      expect(p90).toBeGreaterThan(0.95);
      expect(L.tboProbLlegaAntes({ gamma: null }, 30)).toBeNull();
    });
    it('el plan de compra pide cuando falta menos que el p90, no que mediana+7', () => {
      const cdd = cd.concat([{ estado: 'Recepcion Bodega', detalle: 'Alternador', tiempoRespuesta: '5 dias 0h 0m' }]);
      const sinP90 = L.tboDecisionCompra({ dias: 40, lead: 18, stock: 0, pedidos: 0, fechaProx: '2026-11-19' }); // tope 25
      const conP90 = L.tboDecisionCompra({ dias: 40, lead: 18, leadP90: 50, stock: 0, pedidos: 0, fechaProx: '2026-11-19' });
      expect(sinP90.decision).toBe('planificar');
      expect(sinP90.criterio).toBe('mediana+margen');
      expect(conP90).toMatchObject({ decision: 'pedir_ya', criterio: 'p90', tope: 50 });
      expect(conP90.pedirAntesDe).toBe('2026-09-30');
      expect(cdd.length).toBe(7);
    });
    it('el plan de compra trae la probabilidad de que el repuesto llegue antes del cambio', () => {
      const eq = [{ sigla: 'CN-1', modelo: 'Komatsu HD785-7', horomActual: 12534, hrsDia: 20 }];
      const hist = [{ sigla: 'CN-1', comp: 'Turbo', horomInstalacion: 4300, fechaInst: '2025-01-01' }]; // 8.234 h desde → vencido
      const hoy = new Date('2026-10-10T12:00:00Z');
      const r = L.tboPlanCompras(L.tboEstadoFlota(eq, hist, [], hoy), { hoy, equipos: eq, compras: [], comprasDetalle: cd, stk: [], repuestos: [], ordenes: [], tasa: 910 });
      const t = r.filas.find(x => /TURBOCHARGER/.test(x.item));
      expect(t.decision).toBe('pedir_ya');
      expect(t.probATiempo).toBeLessThan(0.1); // el cambio es ya: casi seguro no alcanza
      expect(t.criterio).toBe('p90');
    });
  });
});

describe('Reemplazo óptimo por costo (política de reemplazo por edad) y matriz de estrategia RCM', () => {
  const R = (t, b, e) => Math.exp(-Math.pow(t / e, b));
  describe('piezas numéricas, contra fórmulas cerradas', () => {
    it('∫₀ᵀ R(t)dt: β=1 es η(1−e^(−T/η)); β=2 en T→∞ tiende a η·√π/2', () => {
      expect(L.tboIntegralR(500, 1, 1000)).toBeCloseTo(1000 * (1 - Math.exp(-0.5)), 6);
      expect(L.tboIntegralR(10000, 2, 1000)).toBeCloseTo(1000 * Math.sqrt(Math.PI) / 2, 4);
      expect(L.tboIntegralR(0, 2, 1000)).toBe(0);
    });
    it('MTTF Weibull = η·Γ(1+1/β): β=1 → η; β=2 → η√π/2', () => {
      expect(L.tboMTTFWeibull(1, 1000)).toBeCloseTo(1000, 6);
      expect(L.tboMTTFWeibull(2, 1000)).toBeCloseTo(886.2269, 3);
    });
    it('costo por hora con β=1 (cerrada): [Cp·e^(−T/η) + Cf·(1−e^(−T/η))] / (η(1−e^(−T/η)))', () => {
      const T = 700, e = 1000, Cp = 500, Cf = 4000, q = Math.exp(-T / e);
      expect(L.tboCostoPoliticaEdad(T, 1, e, Cp, Cf)).toBeCloseTo((Cp * q + Cf * (1 - q)) / (e * (1 - q)), 6);
    });
  });

  describe('tboReemplazoOptimo', () => {
    const beta = 3, eta = 1000, Cp = 1000, Cf = 10000;
    const o = L.tboReemplazoOptimo(beta, eta, Cp, Cf);
    it('encuentra un T* interior que mejora a dejar correr hasta la falla', () => {
      expect(o.existe).toBe(true);
      expect(o.T).toBeGreaterThan(0);
      expect(o.T).toBeLessThan(eta);
      expect(o.costoHora).toBeLessThan(o.costoHoraRTF);
      expect(o.costoHoraRTF).toBeCloseTo(Cf / L.tboMTTFWeibull(beta, eta), 8);
      expect(o.ahorroVsRTF).toBeCloseTo(1 - o.costoHora / o.costoHoraRTF, 10);
    });
    it('cumple la condición de primer orden h(T)·∫R − F(T) = Cp/(Cf−Cp) (verificación independiente del optimizador)', () => {
      const T = o.T, I = L.tboIntegralR(T, beta, eta), F = 1 - R(T, beta, eta), h = beta / eta * Math.pow(T / eta, beta - 1);
      expect(h * I - F).toBeCloseTo(Cp / (Cf - Cp), 4);
    });
    it('ningún otro T de una grilla fina tiene menor costo por hora', () => {
      for (let t = 20; t <= 4000; t += 20) expect(L.tboCostoPoliticaEdad(t, beta, eta, Cp, Cf)).toBeGreaterThanOrEqual(o.costoHora - 1e-9);
    });
    it('cuanto más cara es la falla frente al cambio, antes conviene cambiar (T* baja)', () => {
      const t5 = L.tboReemplazoOptimo(beta, eta, 1000, 5000).T, t20 = L.tboReemplazoOptimo(beta, eta, 1000, 20000).T;
      expect(t20).toBeLessThan(t5);
    });
    it('β ≤ 1 (azar o fallas tempranas): no existe óptimo por edad', () => {
      const r = L.tboReemplazoOptimo(1, 1000, 1000, 10000);
      expect(r.existe).toBe(false);
      expect(r.motivo).toContain('β≤1');
      expect(L.tboReemplazoOptimo(0.7, 1000, 1000, 10000).existe).toBe(false);
    });
    it('si fallar no cuesta más que cambiar (Cf ≤ Cp), no conviene cambiar antes', () => {
      expect(L.tboReemplazoOptimo(3, 1000, 1000, 1000).existe).toBe(false);
      expect(L.tboReemplazoOptimo(3, 1000, 1000, 800).existe).toBe(false);
    });
  });

  describe('matriz de estrategia (forma × consecuencia)', () => {
    it('clasifica la forma y la consecuencia', () => {
      expect(L.tboClaseForma(0.6)).toBe('temprana');
      expect(L.tboClaseForma(1.0)).toBe('azar');
      expect(L.tboClaseForma(3)).toBe('desgaste');
      expect(L.tboClaseConsecuencia(1.5)).toBe('bajo');
      expect(L.tboClaseConsecuencia(3)).toBe('medio');
      expect(L.tboClaseConsecuencia(8)).toBe('alto');
    });
    it('desgaste + consecuencia alta → cambio por edad a T*; azar + alta → por condición; temprana → investigar; azar + baja → dejar fallar', () => {
      expect(L.tboEstrategiaRCM(3, 8)).toMatchObject({ celda: 'desgaste|alto', estrategia: 'Cambio por edad a T*' });
      expect(L.tboEstrategiaRCM(1, 8).estrategia).toBe('Por condición');
      expect(L.tboEstrategiaRCM(0.6, 3).estrategia).toBe('Investigar la causa');
      expect(L.tboEstrategiaRCM(1, 1.2).estrategia).toBe('Dejar correr hasta la falla');
    });
    it('las 9 celdas de la matriz están definidas', () => {
      L.TBO_RCM_MATRIZ.filas.forEach(f => L.TBO_RCM_MATRIZ.columnas.forEach(c => expect(L.TBO_RCM_MATRIZ.celdas[f[0] + '|' + c[0]]).toHaveLength(2)));
    });
  });

  describe('parámetros de vida por grupo componente+origen', () => {
    it('con ≥5 cambios ajusta Weibull', () => {
      const p = L.tboParametrosVida({ vals: [4000, 5200, 6100, 6900, 7800, 9000], origen: 'original' });
      expect(p.fuente).toContain('Weibull ajustado con 6 cambios');
      expect(p.beta).toBeGreaterThan(1);
    });
    it('con 1–4 cambios: β=3 y η que reproduce la mediana observada', () => {
      const p = L.tboParametrosVida({ vals: [1000, 2000, 3000], origen: 'alternativo' });
      expect(p.beta).toBe(3);
      expect(1 - Math.exp(-Math.pow(2000 / p.eta, 3))).toBeCloseTo(0.5, 8); // la mediana (2.000 h) queda en F=50%
    });
    it('el original sin datos usa el modelo del fabricante (TBO = 5%); el alternativo sin datos no se estima', () => {
      const p = L.tboParametrosVida({ vals: [], origen: 'original', tbo: { min: 8000, max: 8000 } });
      expect(1 - Math.exp(-Math.pow(8000 / p.eta, 3))).toBeCloseTo(0.05, 8);
      expect(L.tboParametrosVida({ vals: [], origen: 'alternativo', tbo: { min: 8000, max: 8000 } })).toBeNull();
    });
  });

  describe('tboPoliticaOptimaFilas', () => {
    const filas = [
      { comp: 'Turbo', origen: 'original', vals: [3651, 4368, 5000], mediana: 4368, precio: 8100000, tbo: { min: 8000, max: 8000 } },
      { comp: 'Turbo', origen: 'alternativo', vals: [1626, 800], mediana: 1213, precio: 2325000, tbo: { min: 8000, max: 8000 } },
      { comp: 'Asiento', origen: 'sin dato', vals: [600], mediana: 600, precio: null, tbo: null },
    ];
    const ctx = { tarifaHH: 25000, hhCambio: 16, horasProg: 8, horasFalla: 24, costoHoraDet: 500000 };
    const r = L.tboPoliticaOptimaFilas(filas, ctx);
    it('Cp = repuesto + HH + parada programada; Cf = repuesto + HH + parada por falla', () => {
      expect(r[0].Cp).toBe(8100000 + 16 * 25000 + 8 * 500000);
      expect(r[0].Cf).toBe(8100000 + 16 * 25000 + 24 * 500000);
      expect(r[0].ratio).toBeCloseTo(r[0].Cf / r[0].Cp, 10);
    });
    it('con costo de detención, fallar cuesta más que cambiar y existe un T* menor al TBO; el ahorro vs TBO es no negativo', () => {
      expect(r[0].opt.existe).toBe(true);
      expect(r[0].opt.T).toBeLessThan(8000);
      expect(r[0].ahorroVsTBO).toBeGreaterThanOrEqual(0);
      expect(r[0].estrategia.celda).toMatch(/^desgaste\|/);
    });
    it('sin precio no se calcula nada; sin costo de detención no hay óptimo (fallar y cambiar cuestan lo mismo)', () => {
      expect(r[2].opt).toBeNull();
      const sinDet = L.tboPoliticaOptimaFilas(filas, Object.assign({}, ctx, { costoHoraDet: 0 }));
      expect(sinDet[0].opt.existe).toBe(false);
      expect(sinDet[0].Cf).toBe(sinDet[0].Cp);
    });
  });
});

describe('Bondad de ajuste y comparación de modelos (Weibull, log-normal, Gamma, exponencial)', () => {
  // Muestras "casi perfectas": se generan con la función de cuantiles del modelo en (i−0,5)/n, así que el ajuste debe recuperar los parámetros
  const mk = (cuantil, n) => Array.from({ length: n }, (_, i) => cuantil((i + 0.5) / n));
  describe('funciones especiales, contra valores conocidos', () => {
    it('digamma y trigamma: ψ(1)=−γ, ψ(½)=−γ−2ln2, ψ′(1)=π²/6, ψ′(½)=π²/2', () => {
      expect(L._digamma(1)).toBeCloseTo(-0.5772156649, 9);
      expect(L._digamma(0.5)).toBeCloseTo(-1.9635100260, 9);
      expect(L._trigamma(1)).toBeCloseTo(Math.PI * Math.PI / 6, 9);
      expect(L._trigamma(0.5)).toBeCloseTo(Math.PI * Math.PI / 2, 9);
    });
    it('Φ(z) normal estándar', () => {
      expect(L._normCDF(1.96)).toBeCloseTo(0.9750021, 6);
      expect(L._normCDF(-1)).toBeCloseTo(0.1586553, 6);
      expect(L._normCDF(0)).toBeCloseTo(0.5, 12);
    });
  });
  describe('ajuste por máxima verosimilitud: recupera los parámetros', () => {
    it('Weibull (β=2, η=100)', () => {
      const f = L.ajusteWeibullMLE(mk(p => 100 * Math.pow(-Math.log(1 - p), 1 / 2), 500));
      expect(f.beta).toBeCloseTo(2, 1);
      expect(f.eta).toBeCloseTo(100, 0);
    });
    it('Gamma (k=2, θ=10) — incluye el caso k<1', () => {
      const f = L.ajusteGammaMLE(mk(p => L.gammaCuantil(p, 2, 10), 500));
      expect(f.k).toBeCloseTo(2, 1);
      expect(f.k * f.theta).toBeCloseTo(20, 1);
      const g = L.ajusteGammaMLE(mk(p => L.gammaCuantil(p, 0.7, 30), 500));
      expect(g.k).toBeCloseTo(0.7, 1);
    });
    it('log-normal (μ=3, σ=0,8) y exponencial (media 25)', () => {
      const f = L.ajusteLogNormalMLE(mk(p => Math.exp(3 + 0.8 * 1.0 * ((q) => { let lo = -8, hi = 8; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; L._normCDF(m) < q ? lo = m : hi = m; } return (lo + hi) / 2; })(p)), 500));
      expect(f.mu).toBeCloseTo(3, 1);
      expect(f.sigma).toBeCloseTo(0.8, 1);
      expect(L.ajusteExponencialMLE(mk(p => -25 * Math.log(1 - p), 500)).theta).toBeCloseTo(25, 0);
    });
    it('piden ≥5 datos positivos', () => {
      expect(L.ajusteGammaMLE([1, 2, 3, 4])).toBeNull();
      expect(L.ajusteWeibullMLE([1, 2, 3])).toBeNull();
      expect(L.ajusteLogNormalMLE([5, 5, 5, 5, 5])).toBeNull(); // varianza 0
    });
  });
  describe('compararModelosVida', () => {
    it('con menos de 8 datos no compara', () => {
      expect(L.compararModelosVida([1, 2, 3, 4, 5, 6, 7])).toBeNull();
    });
    it('elige el modelo verdadero: muestra Weibull β=3 → Weibull; muestra log-normal → log-normal; exponencial → exponencial (o empate técnico)', () => {
      const w = L.compararModelosVida(mk(p => 100 * Math.pow(-Math.log(1 - p), 1 / 3), 300));
      expect(w.mejor).toBe('weibull');
      const ln = L.compararModelosVida(mk(p => { let lo = -8, hi = 8; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; L._normCDF(m) < p ? lo = m : hi = m; } return Math.exp(2.5 + 1.0 * (lo + hi) / 2); }, 300));
      expect(ln.mejor).toBe('lognormal');
      const ex = L.compararModelosVida(mk(p => -20 * Math.log(1 - p), 300));
      const dEx = ex.modelos.find(m => m.modelo === 'exponencial').dAICc;
      expect(dEx).toBeLessThan(2);
    });
    it('ΔAICc: el mejor vale 0, los demás ≥ 0 y vienen ordenados; AICc = AIC + 2k(k+1)/(n−k−1)', () => {
      const r = L.compararModelosVida(mk(p => 100 * Math.pow(-Math.log(1 - p), 1 / 3), 100));
      expect(r.modelos[0].dAICc).toBe(0);
      for (let i = 1; i < r.modelos.length; i++) expect(r.modelos[i].dAICc).toBeGreaterThanOrEqual(r.modelos[i - 1].dAICc);
      const w = r.modelos.find(m => m.modelo === 'weibull');
      expect(w.aicc).toBeCloseTo(w.aic + 2 * 2 * 3 / (100 - 2 - 1), 8);
      const e = r.modelos.find(m => m.modelo === 'exponencial');
      expect(e.aicc).toBeCloseTo(e.aic + 2 * 1 * 2 / (100 - 1 - 1), 8);
    });
    it('el error del percentil 90 del modelo verdadero es pequeño', () => {
      const r = L.compararModelosVida(mk(p => 100 * Math.pow(-Math.log(1 - p), 1 / 3), 400));
      expect(Math.abs(r.modelos.find(m => m.modelo === 'weibull').errP90)).toBeLessThan(0.03);
    });
    it('KS: la distancia de la muestra "perfecta" al modelo verdadero es chica (≈ 1/2n)', () => {
      const r = L.compararModelosVida(mk(p => 100 * Math.pow(-Math.log(1 - p), 1 / 3), 200));
      expect(r.modelos.find(m => m.modelo === 'weibull').D).toBeLessThan(0.01);
    });
    it('bootstrap paramétrico: es reproducible con la misma semilla; un modelo equivocado se rechaza y el correcto no', () => {
      const wb = mk(p => 100 * Math.pow(-Math.log(1 - p), 1 / 3), 80); // desgaste claro (β=3): la exponencial es un mal modelo
      const a = L.compararModelosVida(wb, { B: 100, semilla: 3 }), b = L.compararModelosVida(wb, { B: 100, semilla: 3 });
      expect(a.modelos.map(m => m.pBoot)).toEqual(b.modelos.map(m => m.pBoot));
      expect(a.modelos.find(m => m.modelo === 'exponencial').pBoot).toBeLessThan(0.05);
      expect(a.modelos.find(m => m.modelo === 'weibull').pBoot).toBeGreaterThan(0.05);
    });
  });
  describe('tiempos de entrega reales', () => {
    it('solo cuenta pedidos recibidos con tiempo > 0', () => {
      const cd = [{ estado: 'Recepcion Bodega', tiempoRespuesta: '2 dias 12h 0m' }, { estado: 'OC Firmada', tiempoRespuesta: '9 dias' }, { estado: 'Recepcion Bodega', tiempoRespuesta: null }, { estado: 'Recepcion Bodega', tiempoRespuesta: '10 dias 0h 0m' }];
      expect(L.tboTiemposEntrega(cd)).toEqual([2.5, 10]);
    });
  });
});
