// Programa anual «vivo»: lo ejecutado sale de los registros de PM y lo que viene se proyecta desde el último PM real de cada equipo (23-nov-2026).
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const L = createRequire(import.meta.url)('../logic.js');

const hoy = new Date('2026-11-23T12:00:00Z');   // mes actual: NOV (índice 10)
// BD-9533: último PM real el 6-sep; próximo hito a las 11.250 h (PM1), hoy 11.050 h, 10 h/día → 20 días → 13-dic
const eq = [
  { sigla: 'BD-9533', tipo: 'Bulldozer', modelo: 'D375', frecPM: 250, hrsDia: 10, horomActual: 11050, horomProxPM: 11250, fechaProxPM: '2026-12-13' },
  // vencido: el hito (9.000) ya pasó (hoy 9.060) → cae hoy y se marca
  { sigla: 'CN-9501', tipo: 'Camión', modelo: 'X', frecPM: 250, hrsDia: 10, horomActual: 9060, horomProxPM: 9000, fechaProxPM: '2026-11-17' },
  // sin lectura confiable: sin fecha de próximo PM → no se proyecta
  { sigla: 'CN-9500', tipo: 'Camión', modelo: 'X', frecPM: 250, hrsDia: 10, horomActual: 5000, horomProxPM: 5000, fechaProxPM: '' },
];
const reg = [
  { equipo: 'BD-9533', tipoPM: 'PM4', fechaEntrada: '2026-09-06' },
  { equipo: 'BD-9533', tipoPM: 'PM1', fechaEntrada: '2026-11-04' },
  { equipo: 'BD-9533', tipoPM: 'PM1', fechaEntrada: '2025-06-01' },    // otro año: no cuenta
];
// el plan guardado se generó una vez: decía PM4 en agosto, PM1 en noviembre
const programa = [{ sigla: 'BD-9533', meses: { AGO: 'PM4', SEP: 'PM1', NOV: 'EJEC', DIC: 'PM3' } }, { sigla: 'CN-9501', meses: { OCT: 'PM2' } }];
const v = L.programaAnualVivo(eq, reg, programa, hoy, 2026, null);
const por = (s) => v.find(x => x.sigla === s);

describe('programaAnualVivo: meses ejecutados', () => {
  it('toma el tipo y la fecha reales del registro de PM', () => {
    expect(por('BD-9533').meses.SEP.eje).toEqual([{ tipo: 'PM4', fecha: '2026-09-06' }]);
    expect(por('BD-9533').meses.SEP.estado).toBe('ejecutado');
  });
  it('un registro de otro año no cuenta', () => {
    expect(por('BD-9533').meses.JUN.eje).toEqual([]);
  });
  it('un mes pasado que el plan guardado marcaba y no tiene registro queda «sin_registro» (no se afirma que no se hizo)', () => {
    expect(por('BD-9533').meses.AGO.estado).toBe('sin_registro');
    expect(por('BD-9533').meses.AGO.plan).toBe('PM4');
    expect(por('CN-9501').meses.OCT.estado).toBe('sin_registro');
  });
  it('un mes pasado sin plan y sin registro queda vacío', () => {
    expect(por('BD-9533').meses.FEB.estado).toBe('');
  });
});

describe('programaAnualVivo: lo que viene sale del próximo PM real, no del plan guardado', () => {
  it('proyecta el próximo hito y los siguientes con el tipo que corresponde al horómetro', () => {
    const d = por('BD-9533').meses.DIC;
    expect(d.estado).toBe('proyectado');
    expect(d.proy[0].tipo).toBe('PM1');                            // 11.250 h no es múltiplo de 500
    expect(d.proy[0].fecha).toBe('2026-12-13');
    expect(d.plan).toBe('PM3');                                    // lo que decía el plan guardado: se informa, no se usa
  });
  it('el plan guardado de un mes futuro no se usa para proyectar', () => {
    const c = por('BD-9533').meses.DIC;
    expect(c.proy.map(x => x.tipo)).not.toContain('PM3');
  });
  it('un PM vencido cae hoy, en el mes actual, y se marca', () => {
    const n = por('CN-9501').meses.NOV;
    expect(n.estado).toBe('vencido');
    expect(n.proy[0]).toMatchObject({ fecha: '2026-11-23', vencido: true });
    expect(por('CN-9501').prox.vencido).toBe(true);
  });
  it('un mes actual con PM ejecutado conserva lo ejecutado y además proyecta el que falta', () => {
    const n = por('BD-9533').meses.NOV;
    expect(n.estado).toBe('ejecutado');
    expect(n.eje[0].fecha).toBe('2026-11-04');
  });
  it('usa el ritmo real cuando se entrega (más lento → el PM cae más tarde)', () => {
    const lento = L.programaAnualVivo(eq, reg, programa, hoy, 2026, () => 5);
    expect(por('BD-9533').prox.fecha).toBe('2026-12-13');
    expect(lento.find(x => x.sigla === 'BD-9533').prox.fecha).toBe('2027-01-02');   // 200 h a 5 h/día = 40 días
    expect(lento.find(x => x.sigla === 'BD-9533').meses.DIC.proy).toEqual([]);
  });
});

describe('programaAnualVivo: sin dato no se inventa', () => {
  it('un equipo sin fecha de próximo PM no se proyecta y lleva aviso', () => {
    const s = por('CN-9500');
    expect(s.aviso).toMatch(/Sin lectura confiable/);
    expect(s.prox).toBeNull();
    expect(Object.values(s.meses).every(c => c.proy.length === 0)).toBe(true);
  });
  it('un próximo PM a más de 400 días avisa ritmo muy bajo o lectura dudosa', () => {
    const lejos = [{ sigla: 'CN-9507', frecPM: 250, hrsDia: 1, horomActual: 1000, horomProxPM: 2000, fechaProxPM: '2029-01-01' }];
    expect(L.programaAnualVivo(lejos, [], [], hoy, 2026, null)[0].aviso).toMatch(/ritmo muy bajo/);
  });
  it('un año pasado solo muestra lo ejecutado', () => {
    const a = L.programaAnualVivo(eq, reg, programa, hoy, 2025, null);
    const b = a.find(x => x.sigla === 'BD-9533');
    expect(b.meses.JUN.eje.length).toBe(1);
    expect(Object.values(b.meses).every(c => c.proy.length === 0 && c.estado !== 'sin_registro')).toBe(true);
  });
});

describe('programaAnualVivo: ajustes a mano (meses._manual)', () => {
  const conManual = (manual) => [{ sigla: 'BD-9533', meses: { AGO: 'PM4', _manual: manual } }];
  const r = (manual) => L.programaAnualVivo(eq, reg, conManual(manual), hoy, 2026, null).find(x => x.sigla === 'BD-9533');
  it('un PM fijado a mano en un mes que viene reemplaza lo proyectado, y guarda lo que decía el cálculo', () => {
    const d = r({ '2026-12': 'PM4' }).meses.DIC;
    expect(d.estado).toBe('proyectado');
    expect(d.proy.map(x => x.tipo)).toEqual(['PM4']);
    expect(d.manual).toBe('PM4');
    expect(d.auto.map(x => x.tipo)).toEqual(['PM1']);            // el cálculo automático decía PM1 el 13-dic
  });
  it('«sin PM» a mano quita el PM proyectado de ese mes', () => {
    const d = r({ '2026-12': 'NONE' }).meses.DIC;
    expect(d.proy).toEqual([]);
    expect(d.estado).toBe('');
    expect(d.manual).toBe('NONE');
  });
  it('un mes pasado sin registro: lo fijado a mano pasa a ser el plan; «sin PM» quita el aviso', () => {
    expect(r({ '2026-07': 'PM2' }).meses.JUL.estado).toBe('sin_registro');
    expect(r({ '2026-07': 'PM2' }).meses.JUL.plan).toBe('PM2');
    expect(r({ '2026-08': 'NONE' }).meses.AGO.estado).toBe('');   // el plan guardado decía PM4: ya no cuenta
  });
  it('un mes ejecutado no se ajusta a mano: manda el registro', () => {
    const s = r({ '2026-09': 'PM1' }).meses.SEP;
    expect(s.estado).toBe('ejecutado');
    expect(s.eje[0].tipo).toBe('PM4');
  });
  it('valores inválidos se ignoran y no mueven los demás meses', () => {
    const x = r({ '2026-12': 'PM9', '2026-10': 'basura' });
    expect(x.meses.DIC.manual).toBe('');
    expect(x.meses.DIC.proy[0].tipo).toBe('PM1');
  });
  it('lo ajustado a mano entra a la demanda de lubricantes y a las celdas del Gantt', () => {
    const lub = [{ _id: 'l1', nombre: 'MOBILGREASE XHP 322 MINE', unidad: 'Kilo', stock: 0 }];
    const mapaRep = [{ pautaId: 'p-gr', tipo: 'lubricante', refId: 'l1' }];
    const consumos = (sg, pm) => [{ _id: 'p-gr', rep: 'Mobilgrease', can: pm === 'PM4' ? 30 : 10 }];
    const vivo = L.programaAnualVivo(eq, reg, conManual({ '2026-12': 'PM4' }), hoy, 2026, null);
    const dem = L.demandaProgramaMes(conManual({ '2026-12': 'PM4' }), consumos, [], lub, mapaRep, hoy, reg, eq, vivo);
    expect(dem.meses[1].pm.PM4).toBe(1);                          // diciembre: el PM4 fijado a mano
    expect(dem.meses[1].lubricantes[0]).toBeGreaterThanOrEqual(30);   // los 30 kg del PM4 a mano (más lo de otros equipos)
    expect(L.programaVivoCeldas(vivo).find(x => x.sigla === 'BD-9533').meses.DIC).toBe('PM4');
  });
});

describe('programaVivoCeldas', () => {
  it('devuelve el formato simple: EJEC, tipo proyectado, tipo del plan en pasados sin registro', () => {
    const c = L.programaVivoCeldas(v).find(x => x.sigla === 'BD-9533').meses;
    expect(c.SEP).toBe('EJEC');
    expect(c.AGO).toBe('PM4');
    expect(c.DIC).toMatch(/^PM[1-4]$/);
    expect(c.FEB).toBe('');
  });
});

describe('demandaProgramaMes con el programa vivo', () => {
  const lub = [{ _id: 'l1', nombre: 'MOBILGREASE XHP 322 MINE', unidad: 'Kilo', stock: 0 }];
  const mapaRep = [{ pautaId: 'p-gr', tipo: 'lubricante', refId: 'l1' }];
  const consumos = (sg, pm) => [{ _id: 'p-gr', rep: 'Mobilgrease', can: pm === 'PM4' ? 30 : 10 }];
  const r = L.demandaProgramaMes(programa, consumos, [], lub, mapaRep, hoy, reg, eq, v);
  it('cuenta los PM proyectados (no las celdas guardadas) mes a mes', () => {
    expect(r.meses.map(m => m.etiqueta)).toEqual(['NOV', 'DIC']);
    // noviembre: el vencido de CN-9501 (hoy); diciembre: BD-9533 (13-dic) → no cuenta el «PM3» guardado
    expect(r.meses[0].pm.PM1 + r.meses[0].pm.PM2 + r.meses[0].pm.PM3 + r.meses[0].pm.PM4).toBeGreaterThanOrEqual(1);
    expect(r.meses[1].pm.PM3).toBe(0);
  });
  it('los meses pasados del plan sin registro van a atrasados, sin contarse como demanda', () => {
    const a = r.atrasados.map(x => x.sigla + x.mes);
    expect(a).toContain('BD-9533AGO');
    expect(a).toContain('CN-9501OCT');
  });
  it('el vencido no se cuenta dos veces (ya va en la proyección)', () => {
    expect(r.atrasados.every(x => !x.contado)).toBe(true);
  });
});
