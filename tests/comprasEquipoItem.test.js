// Compras del equipo por ítem (23-nov-2026): vocabulario es/en, cruce compra → instalación y próximo cambio medido.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const L = createRequire(import.meta.url)('../logic.js');

describe('comprasItemMatcher (vocabulario)', () => {
  it('reconoce el cinturón en español, inglés y términos técnicos', () => {
    ['cinturón', 'Cinturon de seguridad', 'seat belt', 'Seat Belt 5615781410', 'safety belt', 'cinturon de 3 puntas'].forEach(t => {
      expect(L.comprasItemMatcher(t).id).toBe('cinturon');
    });
  });
  it('un texto libre busca por subcadena sin tildes', () => {
    const m = L.comprasItemMatcher('Válvula');
    expect(m.id).toBe('libre');
    expect(m.rx.test('valvula de alivio')).toBe(true);
  });
  it('vacío no busca nada', () => {
    expect(L.comprasItemMatcher('  ')).toBeNull();
    expect(L.comprasEquipoItem({ sigla: '', item: 'asiento' })).toBeNull();
  });
});

const compra = (extra) => Object.assign({ pedido: '1', sigla: 'BD-9533', fecha: '2026-03-21', detalle: 'Seat Belt 5615781410', oc: '758390', cant: 1, costo: 986921, estado: 'Recepcion Bodega', fechaEstado: '2026-04-10' }, extra || {});

describe('comprasEquipoItem', () => {
  it('encuentra el cinturón pedido en inglés y no confunde carretes ni termoretráctil', () => {
    const r = L.comprasEquipoItem({
      sigla: 'BD-9533', item: 'cinturón',
      compras: [compra(), compra({ pedido: '2', detalle: 'Carrete Maguera Retractil', descripcionPedido: 'enrrollador manguera de grasa', costo: 679260 }), compra({ pedido: '3', detalle: 'Caja Termoretractil 560 P', costo: 37400 }),
        compra({ pedido: '4', sigla: 'CF-9511' })],
      ot: [], compHist: []
    });
    expect(r.filas.length).toBe(1);
    expect(r.filas[0].detalle).toBe('Seat Belt 5615781410');
    expect(r.resumen.sinEvidencia).toBe(1);
  });

  it('empareja la compra con la OT que dice cambio dentro de 180 días y deja la mención como relacionada', () => {
    const r = L.comprasEquipoItem({
      sigla: 'BD-9533', item: 'seat belt', compras: [compra()],
      ot: [{ sigla: 'BD-9533', fecha: '2025-11-13', horom: 9822, sintoma: 'EQUIPO DETENIDO POR NO CONTAR CON CINTURON DE 3 PUNTAS' },
        { sigla: 'BD-9533', fecha: '2026-04-20', horom: 10700, sintoma: 'Se instala cinturon de seguridad nuevo' }],
      compHist: [], horomFn: (f) => (f < '2026-04-01' ? 10600 : 10690)
    });
    const f = r.filas[0];
    expect(f.instalacion.fecha).toBe('2026-04-20');
    expect(f.instalacion.fuente).toBe('OT');
    expect(f.instalacion.dias).toBe(10);
    expect(f.instalacion.horom).toBe(10700);
    expect(f.horomCompra).toBe(10690);
    expect(f.relacionadas.map(x => x.fecha)).toEqual(['2025-11-13']);
  });

  it('prefiere el Historial de componentes y no usa dos veces el mismo cambio', () => {
    const r = L.comprasEquipoItem({
      sigla: 'CN-9500', item: 'alternador',
      compras: [compra({ sigla: 'CN-9500', detalle: 'Alternador 600-861-9122', fecha: '2024-01-10', fechaEstado: '2024-01-20', pedido: 'a' }),
        compra({ sigla: 'CN-9500', detalle: 'Alternador 600-861-9122', fecha: '2024-02-01', fechaEstado: '2024-02-10', pedido: 'b', costo: 5 })],
      ot: [], compHist: [{ sigla: 'CN-9500', comp: 'Alternador', fechaInst: '2024-01-25', horomInstalacion: 8000, obs: 'Nuevo' }]
    });
    expect(r.filas[0].instalacion.fuente).toBe('Historial de componentes');
    expect(r.filas[0].instalacion.horom).toBe(8000);
    expect(r.filas[1].instalacion).toBeNull();
  });

  it('un cambio del historial sin compra visible se informa aparte', () => {
    const r = L.comprasEquipoItem({ sigla: 'CE-86', item: 'asiento', compras: [], ot: [], compHist: [{ sigla: 'CE-86', comp: 'Asiento', fechaInst: '2024-01-06', horomInstalacion: 10935 }] });
    expect(r.filas.length).toBe(0);
    expect(r.sinCompra.length).toBe(1);
    expect(r.resumen.cambiosTotales).toBe(1);
  });

  it('mide el intervalo en horas entre cambios', () => {
    const hf = (f) => ({ '2023-01-10': 1000, '2023-09-10': 3000, '2024-06-10': 5600 }[f] ?? null);
    const r = L.comprasEquipoItem({
      sigla: 'X', item: 'alternador', horomFn: hf,
      compras: ['2023-01-10', '2023-09-10', '2024-06-10'].map((d, i) => compra({ sigla: 'X', detalle: 'Alternador', pedido: 'p' + i, fecha: d, fechaEstado: d })), ot: [], compHist: []
    });
    expect(r.intervalosH).toEqual([2000, 2600]);
  });
});

describe('comprasProximoCambio', () => {
  it('no da fecha con menos de 3 intervalos y dice cuántos faltan', () => {
    const p = L.comprasProximoCambio({ intervalosH: [2000], resumen: { ultimaHorom: 5000 } }, [], 6000, 15);
    expect(p.ok).toBe(false);
    expect(p.faltan).toBe(2);
  });
  it('con intervalos suficientes usa la mediana y estima días', () => {
    const p = L.comprasProximoCambio({ intervalosH: [2000], resumen: { ultimaHorom: 5000 } }, [{ intervalosH: [3000, 2600] }, { intervalosH: [2200] }], 6000, 20);
    expect(p.ok).toBe(true);
    expect(p.medianaH).toBe(2400);
    expect(p.origen).toBe('equipos del mismo modelo');
    expect(p.horasDesdeUltimo).toBe(1000);
    expect(p.restanH).toBe(1400);
    expect(p.restanDias).toBe(70);
  });
});
