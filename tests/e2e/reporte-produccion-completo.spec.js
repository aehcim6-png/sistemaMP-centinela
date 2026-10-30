const { test, expect } = require('@playwright/test');
const { mockSupabase, SB_URL } = require('./helpers/mock-supabase');

// Reporte de producción completo (30-oct-2026): la foto del turno se lee entera (CAEX, Carguío, Apoyo, Pérdida por Petróleo e Indisponibilidad,
// totales, disponibilidad y bitácora), se revisa en el modal y se guarda con las categorías correctas. La función de lectura está simulada.

async function entrar(page) {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
  await page.setViewportSize({ width: 1280, height: 900 });
}

const LECTURA = {
  fecha: '2026-08-10', turno: 'dia', grupoTurno: 'G1', supervisor: 'ALBERTO GATICA PEÑA', contrato: '4540004976',
  totalToneladas: 19620, rendimientoTransporteTonHr: 489, totalVueltas: 218, totalHorasCaex: 40.1, tiempoMedioCicloMin: 11, rendimientoCaexVueltasHr: 5.4,
  vueltasCF: 218, totalTonCF: 20654, totalHorasCF: 15.2, rendimientoCFTonHr: 1358.8, rendimientoCFCargasHr: 14.3,
  disponibilidadEquipos: '1 CF\n4 CAEX', bitacora: '10:00 - 10:50 CF-510 FUERA DE SERVICIO POR FALTA DE COMBUSTIBLE', observaciones: 'REVISION DE EQUIPOS',
  caex: [
    { sigla: 'CN-9503', equipoNombre: 'CAEX-85', estadoTexto: 'fuera de servicio', tonVuelta: 90, totalTon: 0, incierto: false },
    { sigla: 'CN-9501', equipoNombre: 'CAEX-86', horometroInicial: 21258.5, horometroFinal: 21265.8, totalHoras: 7.3, vueltas: 41, rendimientoVueltasHr: 5.6, tiempoCicloMin: 10.7, operador: 'NESTOR MENESES', tonVuelta: 90, totalTon: 3690, incierto: false },
  ],
  carguio: [{ sigla: 'CF-9510', equipoNombre: 'CF-510', totalHoras: 7.1, tonelaje: 8256, rendimientoTonHr: 1162.8, operador: 'EMILIO PAEZ', postura: 'F11 M6', incierto: false }],
  apoyo: [{ sigla: 'BD-9509', equipoNombre: 'BD-509', totalHoras: 5, operador: 'EDWIN ZEPEDA', areaTrabajo: 'B2', incierto: false }],
  perdidaPetroleo: [{ equipoNombre: 'CAEX-86', horaInicio: '10:25', horaFin: '12:20', totalHoras: 1.92, tonAsociado: 0, incierto: false }],
  perdidaIndisponibilidad: [{ sigla: 'CAEX-85', totalHoras: 12, tonAsociado: 0, incierto: false }],
  camposInciertos: [],
};

test('la lectura completa se revisa y se guarda con carguío, apoyo, pérdida por petróleo, totales, disponibilidad y bitácora', async ({ page }) => {
  test.setTimeout(90000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await entrar(page);
  await page.route(`${SB_URL}/functions/v1/leer-reporte-produccion`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, datos: LECTURA }) }));
  await page.evaluate(() => go('prod'));
  await expect(page.locator('#s-prod')).toContainText('Se lee el reporte completo', { timeout: 15000 });
  // la carga en segundo plano puede vaciar lo sembrado: se siembra justo antes de abrir la revisión
  await page.evaluate((d) => {
    S.s('eq', [{ sigla: 'CN-9503', tipo: 'Camion', modelo: 'X' }, { sigla: 'CN-9501', tipo: 'Camion', modelo: 'X' }, { sigla: 'CF-9510', tipo: 'Cargador Frontal', modelo: 'X' }, { sigla: 'BD-9509', tipo: 'Bulldozer', modelo: 'X' }]);
    _revisarReporteProduccionOCR(d);
  }, LECTURA);
  const modal = page.locator('.modal, #modal, [class*=modal]').filter({ hasText: 'Reporte de turno leído' }).first();
  await expect(modal).toContainText('Equipos de Carguío');
  await expect(modal).toContainText('Equipos de Apoyo');
  await expect(modal).toContainText('Pérdida por Petróleo');
  await expect(modal).toContainText('Totales del turno');
  // el apodo del papel (CAEX-86 / CAEX-85) se cruza con las filas de este mismo reporte
  await expect(page.locator('#prodPetrEq_4')).toHaveValue('CN-9501');
  await expect(page.locator('#prodPerdEq_5')).toHaveValue('CN-9503');
  await expect(page.locator('#prodBitacora')).toHaveValue(/FALTA DE COMBUSTIBLE/);
  await page.locator('#prodCaexSel_1').uncheck();       // la persona puede destildar una fila
  await page.evaluate(() => _guardarReporteProduccionOCR());
  const guardado = await page.evaluate(() => ({ t: S.g('prodTurno'), e: S.g('prodTurnoEq') }));
  expect(guardado.t.length).toBe(1);
  expect(guardado.t[0]).toMatchObject({ fecha: '2026-08-10', turno: 'dia', grupoTurno: 'G1', vueltasCF: 218, totalTonCF: 20654, rendimientoCFTonHr: 1358.8, fuente: 'foto' });
  expect(guardado.t[0].bitacora).toContain('FALTA DE COMBUSTIBLE');
  expect(guardado.t[0].disponibilidadEquipos).toBe('1 CF\n4 CAEX');
  const cats = guardado.e.map((x) => x.categoria);
  expect(cats).toEqual(['CAEX', 'Carguio', 'Apoyo', 'PerdidaPetroleo', 'PerdidaIndisponibilidad']);   // CAEX-86 se destildó
  expect(guardado.e.every((x) => x.turnoId === guardado.t[0].id)).toBe(true);
  expect(guardado.e.filter((x) => x.categoria === 'Carguio')[0]).toMatchObject({ sigla: 'CF-9510', totalTon: 8256, tonHr: 1162.8, postura: 'F11 M6' });
  expect(guardado.e.filter((x) => x.categoria === 'PerdidaPetroleo')[0]).toMatchObject({ sigla: 'CN-9501', horaInicio: '10:25', horaFin: '12:20' });
  expect(errores).toEqual([]);
});

test('Producción muestra las toneladas movidas por día (día + noche) y el total del mes', async ({ page }) => {
  test.setTimeout(90000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await entrar(page);
  await page.evaluate(() => go('prod'));
  await expect(page.locator('#s-prod')).toContainText('Se lee el reporte completo', { timeout: 15000 });
  await page.evaluate(() => {
    S.s('prodTurno', [
      { id: 't1', fecha: '2026-06-19', turno: 'dia', totalToneladas: 20430 },
      { id: 't2', fecha: '2026-06-19', turno: 'noche', totalToneladas: 18540 },
    ]);
    S.s('prodTurnoEq', [{ id: 'e1', turnoId: 't2', categoria: 'CAEX', totalTon: 18540 }, { id: 'e2', turnoId: 't2', categoria: 'Carguio', totalTon: 15000 }]);
    document.getElementById('fProdMes').value = '2026-06';
    renders.prod();
  });
  const bloque = page.locator('#s-prod');
  await expect(bloque).toContainText('Toneladas movidas por día');
  await expect(bloque).toContainText('2026-06-19');
  await expect(bloque).toContainText('38.970');
  await expect(bloque).toContainText('⚠️');
  expect(errores).toEqual([]);
});
