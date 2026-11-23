// Lubricantes: consumo planificado desde el programa de PM × la pauta, y rellenos por fallas leídos de las OT (23-nov-2026).
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const L = createRequire(import.meta.url)('../logic.js');

describe('demandaProgramaMes', () => {
  const hoy = new Date('2026-11-23T12:00:00Z');
  const lub = [{ _id: 'l1', nombre: 'MOBILTRANS HD 10W', unidad: 'Litro', stock: 0 }, { _id: 'l2', nombre: 'MOBILGREASE XHP 322 MINE', unidad: 'Kilo', stock: 0 }];
  const mapaRep = [{ pautaId: 'p-hd', tipo: 'lubricante', refId: 'l1' }, { pautaId: 'p-gr', tipo: 'lubricante', refId: 'l2' }];
  const consumos = (sigla, pm) => pm === 'PM4' ? [{ _id: 'p-hd', rep: 'Mobiltrans HD 10W', can: 1020 }, { _id: 'p-gr', rep: 'Mobilgrease', can: 30 }] : pm === 'PM2' ? [{ _id: 'p-gr', rep: 'Mobilgrease', can: 10 }] : [];
  const programa = [
    { sigla: 'CF-9510', meses: { OCT: 'PM2', NOV: 'EJEC', DIC: 'PM4' } },
    { sigla: 'CF-9511', meses: { NOV: 'PM2', DIC: 'PM2', ENE: '' } },
  ];
  const r = L.demandaProgramaMes(programa, consumos, [], lub, mapaRep, hoy);
  it('cuenta los PM de cada mes por tipo, desde el mes actual', () => {
    expect(r.meses.map(m => m.etiqueta)).toEqual(['NOV', 'DIC']);
    expect(r.meses[0].pm).toEqual({ PM1: 0, PM2: 1, PM3: 0, PM4: 0 });
    expect(r.meses[1].pm).toEqual({ PM1: 0, PM2: 1, PM3: 0, PM4: 1 });
  });
  it('multiplica cada PM por lo que lleva su pauta, por lubricante y mes', () => {
    expect(r.meses[0].lubricantes[1]).toBe(10);            // grasa del PM2 de noviembre
    expect(r.meses[1].lubricantes[0]).toBe(1020);          // HD 10W del PM4 de diciembre
    expect(r.meses[1].lubricantes[1]).toBe(10 + 30);       // grasa del PM2 + PM4 de diciembre
  });
  it('un PM de un mes pasado sin marcar ejecutado no se cuenta pero se informa', () => {
    expect(r.atrasados).toEqual([{ sigla: 'CF-9510', mes: 'OCT', pm: 'PM2', registrado: false }]);
  });
  it('si el equipo tiene un PM registrado desde ese mes (pestañas de ingreso), el atrasado queda como registrado', () => {
    const r2 = L.demandaProgramaMes(programa, consumos, [], lub, mapaRep, hoy, [{ equipo: 'CF-9510', tipoPM: 'PM2', fechaEntrada: '2026-10-21' }, { equipo: 'CF-9511', tipoPM: 'PM1', fechaEntrada: '2026-09-01' }]);
    expect(r2.atrasados[0].registrado).toBe(true);
  });
  it('un repuesto de la pauta que parece lubricante pero no está en la bodega se informa aparte; los filtros no', () => {
    const r2 = L.demandaProgramaMes([{ sigla: 'X', meses: { DIC: 'PM1' } }], () => [{ _id: 'a', rep: 'MOBIL SUPER 2000 10W40', can: 4 }, { _id: 'b', rep: 'Filtro aceite motor 36870574', can: 2 }], [], [], [], hoy);
    expect(r2.meses[1].sinVincular).toEqual({ 'MOBIL SUPER 2000 10W40': 4 });
  });
  it('«EJEC» y celdas vacías no suman', () => {
    expect(r.meses[0].pm.PM1 + r.meses[0].pm.PM3 + r.meses[0].pm.PM4).toBe(0);
  });
});

describe('lubricanteCantidadesDeTexto', () => {
  const c = (t) => L.lubricanteCantidadesDeTexto(t).map(x => x.clase + ' ' + x.cant + x.unidad);
  it('lee la cantidad pegada a cada lubricante y deja fuera el refrigerante', () => {
    expect(c('Se rellenan 150 litros de aceite HD 50 para diferencial y 20 lts de refrigerante')).toEqual(['Aceite de transmisión / diferencial 150L']);
    expect(c('Se rellena 7 litros de refrigerante y 10 litros de aceite motor')).toEqual(['Aceite de motor 10L']);
    expect(c('Se rellenan 90 lts de refrigerante')).toEqual([]);
  });
  it('cantidad antes o después del nombre, y la grasa en kilos', () => {
    expect(c('Se realiza relleno de aceite hidraulico (10 lts) y relleno de aceite motor (22 lts)')).toEqual(['Aceite hidráulico 10L', 'Aceite de motor 22L']);
    expect(c('Se realiza relleno de fluidos, engrase general y relleno de depósito de grasa (50kg)')).toEqual(['Grasa 50kg']);
    expect(c('Se realiza cambio de aceite de diferencial 293 lts')).toEqual(['Aceite de transmisión / diferencial 293L']);
    expect(c('cambio flexible de alta presion, relleno de 1000 litros de aceite hidráulico')).toEqual(['Aceite hidráulico 1000L']);
  });
  it('sin cantidad no inventa', () => {
    expect(c('relleno TK grasa y revisión de niveles')).toEqual([]);
  });
});

describe('lubricanteNoPlanificado', () => {
  const tx = [
    { fecha: '2026-10-10', sigla: 'CN-9507', texto: 'se rellena con 30 litros de aceite hidraulico' },
    { fecha: '2026-10-10', sigla: 'CN-9507', texto: 'se rellena con 30 litros de aceite hidraulico' },   // el mismo aviso repetido no suma dos veces
    { fecha: '2026-05-02', sigla: 'CF-9510', texto: 'relleno depósito de grasa (50kg)' },
    { fecha: '2024-01-04', sigla: 'CN-9503', texto: 'relleno de aceite hidraulico (10 lts)' },
  ];
  it('suma por clase dentro de la ventana y promedia sobre la ventana completa (no infla los meses sin registro)', () => {
    const r12 = L.lubricanteNoPlanificado(tx, '2026-11-23', 12);
    expect(r12.filas.find(f => f.clase === 'Aceite hidráulico').total).toBe(30);
    expect(r12.filas.find(f => f.clase === 'Aceite hidráulico').promedioMensual).toBe(2.5);
    expect(r12.filas.find(f => f.clase === 'Grasa').promedioMensual).toBe(4.2);
    const r36 = L.lubricanteNoPlanificado(tx, '2026-11-23', 36);
    expect(r36.filas.find(f => f.clase === 'Aceite hidráulico').total).toBe(40);
  });
});
