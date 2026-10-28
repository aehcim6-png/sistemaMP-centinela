// «Reparar vs comprar»: precio y plazo desde compras, vida desde el Historial de Componentes, detención con el costo de hora detenida (28-oct-2026).
import { describe, it, expect } from 'vitest';
import { RVC_FAMILIAS, rvcCondicion, rvcVidas, rvcPrecios, repararVsComprar } from '../logic.js';

const ASIENTO = RVC_FAMILIAS.find(f => f.id === 'asiento');
const compra = (detalle, precio, extra) => ({ detalle, precioUnit: precio, costo: precio, cant: 1, estado: 'Recepcion Bodega', tiempoRespuesta: '10 dias 0h 0m', fecha: '2026-05-01', sigla: 'CN-1', ...extra });
const cambio = (sigla, horom, obs, extra) => ({ sigla, comp: 'Asiento', horomInstalacion: String(horom), obs, ...extra });
const eq = [{ sigla: 'CN-1', modelo: 'HD785-7', horomActual: 5000 }, { sigla: 'CN-2', modelo: 'HD785-7', horomActual: 5000 }];
const aj = { costoHoraDet: 100000, porModelo: {} };

describe('rvcCondicion', () => {
  it('lee el estado de lo instalado desde cómo quedó anotado el cambio', () => {
    expect(rvcCondicion('Reparado — Cambio de asiento')).toBe('reparado');
    expect(rvcCondicion('Nuevos — lado derecho')).toBe('nuevo');
    expect(rvcCondicion('Usado — se desinstala del CE-113')).toBe('usado');
    expect(rvcCondicion('Retirado de CE-86 — Cambio')).toBe('usado');
    expect(rvcCondicion('N/A — sin asiento')).toBe('sin dato');
    expect(rvcCondicion('', 'Turbo reacondicionado')).toBe('reparado');
    expect(rvcCondicion(null, null)).toBe('sin dato');
  });
});

describe('rvcVidas', () => {
  it('la vida de lo instalado es el horómetro hasta el siguiente cambio; el tramo abierto cuenta horas pero no cambios', () => {
    const h = [cambio('CN-1', 1000, 'Reparado — x'), cambio('CN-1', 1600, 'Nuevo — x'), cambio('CN-1', 3600, 'Reparado — x')];
    const r = rvcVidas(h, eq, ASIENTO).porEstado;
    expect(r.reparado).toMatchObject({ instalados: 2, terminados: 1, horasExpuestas: 600 + 1400, vida: 2000 });
    expect(r.nuevo).toMatchObject({ instalados: 1, terminados: 1, vida: 2000 });
  });
  it('dos filas a menos de 24 h son un solo cambio y se queda el estado conocido', () => {
    const h = [cambio('CN-1', 1000, 'Se desmonta'), cambio('CN-1', 1010, 'Nuevo — x'), cambio('CN-1', 2010, 'Nuevo — x')];
    const r = rvcVidas(h, eq, ASIENTO).porEstado;
    expect(r.nuevo.instalados).toBe(2);
    expect(r.nuevo.terminados).toBe(1);
    expect(r['sin dato'].instalados).toBe(0);
  });
  it('ignora otros componentes y filas sin horómetro', () => {
    const h = [{ sigla: 'CN-1', comp: 'Turbo', horomInstalacion: '100', obs: 'Nuevo' }, cambio('CN-1', null, 'Nuevo'), cambio('CN-1', 'abc', 'Nuevo')];
    expect(rvcVidas(h, eq, ASIENTO).equipos).toEqual([]);
  });
});

describe('rvcPrecios', () => {
  it('separa reparar de comprar, saca la mediana y el plazo, y deja afuera las partes y lo no firmado', () => {
    const c = [compra('Reparacion Asiento Caex', 500000), compra('Reparacion Asiento Camion', 600000, { tiempoRespuesta: '20 dias 0h 0m' }), compra('Asiento 4215731112', 2800000), compra('Amortiguador Asiento Oper', 175000),
      compra('Asiento 4215731112', 2600000, { estado: 'Por firmar' }), compra('Reparacion Alternador', 700000)];
    const r = rvcPrecios(c, ASIENTO);
    expect(r.reparado).toMatchObject({ n: 2, precio: 550000, plazoDias: 15, min: 500000, max: 600000 });
    expect(r.nuevo).toMatchObject({ n: 1, precio: 2800000, plazoDias: 10 });
  });
  it('no confunde con la pieza la mano de obra, los fletes ni los repuestos sueltos, y el sufijo REP del N° de parte es una reparación', () => {
    const c = [compra('Asiento 4215731112', 2706403), compra('Asiento De Operador (g) C', 1880000), compra('Mano De Obra Asiento', 170000), compra('Valvula Control Asiento O', 245000), compra('Fletes Trasl. Asiento,al', 160000), compra('Repuestos Asiento 561-50-', 70306), compra('20y-57-31200rep Asiento R', 515000)];
    const r = rvcPrecios(c, ASIENTO);
    expect(r.nuevo.n).toBe(2);
    expect(r.nuevo.precio).toBe((2706403 + 1880000) / 2);
    expect(r.reparado).toMatchObject({ n: 1, precio: 515000 });
  });
  it('si falta el precio unitario usa costo ÷ cantidad', () => {
    const r = rvcPrecios([{ detalle: 'Asiento X', precioUnit: null, costo: 4000000, cant: 2, estado: 'OC Firmada' }], ASIENTO);
    expect(r.nuevo.precio).toBe(2000000);
    expect(r.nuevo.plazoDias).toBeNull();
  });
});

describe('repararVsComprar', () => {
  const compras = [compra('Reparacion Asiento Caex', 500000), compra('Reparacion Asiento Caex', 540000), compra('Asiento 4215731112', 2800000)];
  const base = { hoy: '2026-10-28', equipos: eq, aj, compras };
  const fila = r => r.filas.find(f => f.id === 'asiento');

  it('con la vida de ambas opciones compara el costo por 1.000 h con la detención y el plazo', () => {
    const h = [cambio('CN-1', 0, 'Reparado — x'), cambio('CN-1', 500, 'Reparado — x'), cambio('CN-1', 1000, 'Reparado — x'), cambio('CN-2', 0, 'Nuevo — x'), cambio('CN-2', 2000, 'Nuevo — x'), cambio('CN-2', 4000, 'Nuevo — x')];
    const r = fila(repararVsComprar({ ...base, compHist: h, ot: [], sinReserva: false }));
    // vida reparado: 1000 h por cambio terminado... (500+500+4000 expuestas / 2 terminados) ; nuevo: (2000+2000+1000)/2
    expect(r.vidas.reparado.vida).toBe(2500);
    expect(r.vidas.nuevo.vida).toBe(2500);
    expect(r.porMilReparado).toBe(Math.round(520000 / 2500 * 1000));
    expect(r.porMilNuevo).toBe(Math.round(2800000 / 2500 * 1000));
    expect(r.decision).toBe('reparar');
  });
  it('sin reserva, la espera del plazo se cuenta como detención y puede dar vuelta la decisión', () => {
    const c = [compra('Reparacion Asiento Caex', 500000, { tiempoRespuesta: '40 dias 0h 0m' }), compra('Reparacion Asiento Caex', 540000, { tiempoRespuesta: '40 dias 0h 0m' }), compra('Asiento 4215731112', 2800000, { tiempoRespuesta: '2 dias 0h 0m' })];
    const r = fila(repararVsComprar({ ...base, compras: c, compHist: [], ot: [], sinReserva: true }));
    expect(r.totalReparado.horasDet).toBe(40 * 24);
    expect(r.totalReparado.total).toBe(520000 + 960 * 100000);
    expect(r.totalNuevo.total).toBe(2800000 + 48 * 100000);
    expect(r.decision).toBe('comprar');
    expect(r.motivo).toMatch(/aun si lo reparado durara lo mismo/);
  });
  it('sin saber cuánto dura lo reparado no recomienda: entrega el punto de equilibrio', () => {
    const r = fila(repararVsComprar({ ...base, compHist: [], ot: [], sinReserva: false }));
    expect(r.decision).toBe('equilibrio');
    expect(r.equilibrio).toBeCloseTo(520000 / 2800000, 3);
    expect(r.motivo).toMatch(/al menos 19 %/);
  });
  it('suma las horas del cambio sacadas de los correctivos que lo mencionan', () => {
    const ot = [{ tipo: 'Correctivo', estadoOT: 'Cerrada', sintoma: 'Asiento operador', solucion: 'Instalacion de asiento', duracion: '2h' }, { tipo: 'Correctivo', estadoOT: 'Cerrada', sintoma: 'Asiento', duracion: '4h' }, { tipo: 'Correctivo', estadoOT: 'Cerrada', sintoma: 'Motor', duracion: '9h' }];
    const r = fila(repararVsComprar({ ...base, compHist: [], ot, sinReserva: false }));
    expect(r.hCambio).toBe(3);
    expect(r.nHCambio).toBe(2);
    expect(r.totalNuevo.horasDet).toBe(3);
  });
  it('si falta el precio de una de las dos opciones dice cuál y no recomienda', () => {
    const r = fila(repararVsComprar({ ...base, compras: [compra('Asiento 4215731112', 2800000)], compHist: [], ot: [] }));
    expect(r.decision).toBe('sin_datos');
    expect(r.motivo).toMatch(/falta el precio de reparar/);
    const r2 = fila(repararVsComprar({ ...base, compras: [], compHist: [], ot: [] }));
    expect(r2.motivo).toMatch(/ni reparaciones/);
  });
  it('una pieza propia escrita por el usuario entra como una familia más', () => {
    const extra = { id: 'x', nombre: 'Radiador', comp: /^radiador/i, item: /radiador/i };
    const r = repararVsComprar({ ...base, compras: [compra('Reparacion Radiador', 100), compra('Radiador nuevo', 400)], compHist: [], ot: [], extra });
    expect(r.filas.find(f => f.id === 'x').nuevo.precio).toBe(400);
  });
});
