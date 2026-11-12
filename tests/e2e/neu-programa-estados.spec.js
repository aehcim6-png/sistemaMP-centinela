const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Programa de cambio de neumáticos: cada neumático cae en UN estado (Cambiar ya / Medir primero / En el período / Sin medición),
// igual para cualquier período; las tarjetas filtran la tabla y ya no existe el «total del período».
async function entrar(page) {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
  await page.setViewportSize({ width: 1400, height: 1000 });
}

test('Programa de cambios: un estado por neumático, tarjetas que filtran y sin total del período', async ({ page }) => {
  test.setTimeout(120000);
  await entrar(page);
  await page.evaluate(async () => { go('neu'); await new Promise((x) => setTimeout(x, 2500)); });
  const r = await page.evaluate(() => {
    const dia = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
    const mk = (sigla, pos, rem, serie) => ({ id: 'n' + sigla + pos, sigla, serie, marca: 'MICHELIN', medida: '27.00R49', posicion: String(pos), numPos: pos, estado: 'Operativo', tipoEquipo: 'CAEX', vidaUtil: 6000, remNuevo: 91, remanente: rem, horomInstalacion: 0, horasAcum: 0 });
    const med = (serie, sigla, fecha, horom, rem) => ({ id: serie + fecha, serie, sigla, posicion: '3', fecha, horom, remExt: rem, remInt: rem, remProm: rem });
    S.s('eq', [{ sigla: 'EQ-1', tipo: 'Camion', modelo: 'X', horomActual: 5000, hrsDia: 15 }, { sigla: 'EQ-2', tipo: 'Camion', modelo: 'X', horomActual: 5000, hrsDia: 15 }, { sigla: 'EQ-3', tipo: 'Camion', modelo: 'X', horomActual: 5000, hrsDia: 15 }]);
    S.s('neu', [mk('EQ-1', 3, 12, 'A1'), mk('EQ-2', 3, 12, 'B1'), mk('EQ-3', 3, 60, 'C1'), mk('EQ-3', 4, 60, 'SIN1')]);   // posiciones traseras: las delanteras tienen además un límite de horas
    // A1: rápido y medido hace 5 días (cambiar ya) · B1: igual pero medido hace 100 días (medir primero) · C1: sano · SIN1: sin mediciones
    S.s('neuMed', [
      med('A1', 'EQ-1', dia(-40), 4000, 40), med('A1', 'EQ-1', dia(-5), 4700, 12),
      med('B1', 'EQ-2', dia(-160), 2000, 40), med('B1', 'EQ-2', dia(-100), 2700, 12),
      med('C1', 'EQ-3', dia(-40), 4000, 70), med('C1', 'EQ-3', dia(-5), 4700, 60),
    ]);
    S.s('neuHist', []);
    window._neuProgTipo = 'mes'; window._neuProgRef = null; window._neuProgFiltro = 'todos';
    programaCambiosNeu();
    const out = {};
    const modal = () => document.body.innerText.replace(/\s+/g, ' ');
    out.texto = modal();
    out.tarjetas = [...document.querySelectorAll('button[onclick*="_neuProgFiltro"]')].map((b) => b.innerText.replace(/\s+/g, ' ').trim());
    out.sinTotal = !out.texto.includes('Total del período');
    // filtro por tarjeta
    window._neuProgFiltro = 'sin_medicion'; programaCambiosNeu();
    out.filtroSin = modal();
    window._neuProgFiltro = 'medir_primero'; programaCambiosNeu();
    out.filtroMedir = modal();
    // cambiar de período no cambia el significado de las urgentes
    window._neuProgFiltro = 'todos'; window._neuProgTipo = 'anio'; programaCambiosNeu();
    out.anio = [...document.querySelectorAll('button[onclick*="_neuProgFiltro"]')].map((b) => b.innerText.replace(/\s+/g, ' ').trim());
    window._neuProgTipo = 'mes'; programaCambiosNeu();
    return out;
  });
  expect(r.sinTotal).toBe(true);
  expect(r.tarjetas).toHaveLength(4);
  expect(r.tarjetas[0]).toContain('Cambiar ya');
  expect(r.tarjetas[1]).toContain('Medir primero');
  expect(r.tarjetas[2]).toContain('En el período');
  expect(r.tarjetas[3]).toContain('Sin medición');
  expect(r.tarjetas[0]).toMatch(/Cambiar ya\s*1/);
  expect(r.tarjetas[1]).toMatch(/Medir primero\s*1/);
  expect(r.tarjetas[3]).toMatch(/Sin medición\s*1/);
  expect(r.texto).toContain('Cambiar ya');
  expect(r.filtroSin).toContain('EQ-3 pos. 4');
  expect(r.filtroSin).not.toContain('EQ-2');
  expect(r.filtroMedir).toContain('EQ-2');
  expect(r.filtroMedir).not.toContain('EQ-3 pos. 4');
  // las tarjetas «Cambiar ya», «Medir primero» y «Sin medición» valen lo mismo en mes y en año
  expect(r.anio[0]).toBe(r.tarjetas[0]);
  expect(r.anio[1]).toBe(r.tarjetas[1]);
  expect(r.anio[3]).toBe(r.tarjetas[3]);
  await page.screenshot({ path: process.env.NEU_PROG_PNG || 'test-results/neu-programa.png' });
});

test('Neumáticos sin serie propia (aljibe): se proyectan por equipo y posición en vez de salir «sin medición»', async ({ page }) => {
  test.setTimeout(120000);
  await entrar(page);
  await page.evaluate(async () => { go('neu'); await new Promise((x) => setTimeout(x, 2500)); });
  const r = await page.evaluate(() => {
    const dia = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
    S.s('eq', [{ sigla: 'ALJ-1', tipo: 'Camion', modelo: 'X', horomActual: 5000, hrsDia: 15 }]);
    // Aljibe sin serie (el libro dice «Sin serie»), posición 3 con nombre largo; lecturas guardadas solo con la posición «3»
    S.s('neu', [{ id: 'nALJ3', sigla: 'ALJ-1', serie: 'Sin serie', marca: 'WESTLAKE', medida: '315/80R22.5', posicion: 'P3-TraIzExt', numPos: 3, estado: 'Operativo', tipoEquipo: 'ALJ', vidaUtil: 6000, remNuevo: 20, remanente: 8, fechaInst: dia(-120), horomInstalacion: 0, horasAcum: 0 }]);
    const med = (fecha, horom, rem, serie) => ({ id: 'm' + fecha, serie, sigla: 'ALJ-1', posicion: '3', fecha, horom, remExt: rem, remInt: rem, remProm: rem });
    S.s('neuMed', [med(dia(-200), 100, 19, null), med(dia(-90), 3000, 14, null), med(dia(-30), 4200, 11, null), med(dia(-5), 4700, 8, null)]);   // la primera es anterior a la instalación: no cuenta
    S.s('neuHist', []);
    window._neuProgTipo = 'anio'; window._neuProgRef = null; window._neuProgFiltro = 'todos';
    const p = neuProyeccion(S.g('neu')[0], _neuMedPorSerie(), _eqPorSigla());
    programaCambiosNeu();
    return { conf: p && p.confianza, sinMedicion: [...document.querySelectorAll('button[onclick*="_neuProgFiltro"]')].map((b) => b.innerText.replace(/\s+/g, ' ').trim()).pop() };
  });
  expect(r.conf).not.toBe('Estimado');
  expect(r.sinMedicion).toMatch(/Sin medición\s*0/);
});
