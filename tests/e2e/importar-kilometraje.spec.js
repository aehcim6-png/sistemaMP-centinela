const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');
const fs = require('fs');
const path = require('path');
const XLSX = require('../../vendor/xlsx.core.min.js');

// Importar la planilla «Control Kilometraje» (3-nov-2026): se sube el .xlsx, la pantalla propone la lectura de km y la próxima mantención,
// la persona marca y solo entonces se guarda. La próxima mantención se fija en pmPendienteManual (el sistema recalcula la suya desde la grilla).
async function entrar(page) {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
  await page.setViewportSize({ width: 1400, height: 900 });
}

function planilla() {
  const f = 46327; // 01-11-2026
  const aoa = [
    ['CONTROL EQUIPOS LIVIANOS'],
    ['Sigla ', 'Tipo Equipo ', 'Equipo', 'Patente', 'Km Actual', 'KM Ultima Mantencion', 'Km Próxima Mantención', 'Km Faltantes', 'Última Actualización', 'Días Sin Informar', 'Rev. Técnica ', 'Días Rev. Técnica ', 'Estado', 'Comentarios', f],
    ['CA-5979', 'Camioneta', 'Hilux', 'SKKW.28-K', 124127, 114681, 124681, 554, f, 0, null, 394, 'OPERATIVA', null, 'Pendiente firmas OC 791917'],
    ['CA-10505', 'Camioneta', 'Ranger', 'VXBK.91-0', 23667, 16000, 26000, 2333, f, 0, null, 850, 'OPERATIVA'],
    ['CA-5135', 'Camioneta', 'Amarok', 'PSRG.90-2', null, 284789, 294789, 294789, null, 0, null, 150, 'OPERATIVA', 'Camioneta fuera de faena'],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Camionetas');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

const SEMILLA = `
  S.s('eq', [
    { sigla: 'CA-5979', tipo: 'Camioneta', modelo: 'Hilux', unidad: 'km', frecPM: 10000, horomActual: 118900, fechaHorom: '2026-08-24', horomProxPM: 130000 },
    { sigla: 'CA-10505', tipo: 'Camioneta', modelo: 'Ranger', unidad: 'km', frecPM: 16000, horomActual: 7032, fechaHorom: '2026-08-24', horomProxPM: 32000 },
  ]);
  S.s('hist', [
    { sigla: 'CA-5979', fecha: '2026-08-24', horom: 118900, horomFin: 118900 },
    { sigla: 'CA-10505', fecha: '2026-08-24', horom: 7032, horomFin: 7032 },
  ]);
`;

test('la planilla se revisa y se carga solo lo marcado; la próxima mantención se fija a mano solo si es más cercana', async ({ page }) => {
  test.setTimeout(90000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await entrar(page);
  await page.evaluate(() => go('hist'));
  await expect(page.locator('#s-hist')).toContainText('Importar CSV', { timeout: 15000 });
  await expect(page.locator('#s-hist')).toContainText('Importar Control Kilometraje');
  // la carga en segundo plano puede vaciar lo sembrado: se siembra justo antes de abrir
  await expect(async () => {
    await page.evaluate(`(() => { ${SEMILLA} })()`);
    await page.evaluate(() => importarKilometraje());
    await expect(page.locator('#kmArchivo')).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20000 });
  await page.locator('#kmArchivo').setInputFiles({ name: 'Control Kilometraje.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: planilla() });
  const panel = page.locator('#mc, .modal, [class*=modal]').filter({ hasText: 'Control Kilometraje — propuesta' }).first();
  await expect(panel).toContainText('Lecturas de km', { timeout: 10000 });
  // la carga en segundo plano puede vaciar los equipos entre la siembra y el análisis: se resiembra y se vuelve a revisar hasta que aparezcan
  await expect(async () => {
    await page.evaluate(`(() => { ${SEMILLA} })()`);
    await page.evaluate(() => _kmVolverAnalizar());
    await expect(panel).toContainText('124.127', { timeout: 2000 });
  }).toPass({ timeout: 20000 });
  await expect(panel).toContainText('Fijar a mano');                    // CA-5979: 124.681 es más cercano que 130.000
  await expect(panel).toContainText('No cuadra con la frecuencia');     // CA-10505: la planilla suma 10.000 a una camioneta de 16.000
  await expect(panel).toContainText('CA-5135');                         // no está en el sistema
  await expect(panel).toContainText('Pendiente firmas OC 791917');      // las notas de la planilla se muestran
  await expect(panel).toContainText('Cargar lo marcado (3)');           // 2 lecturas + 1 próxima mantención
  // se guarda en la misma vuelta que se revisa: la carga en segundo plano podría pisarlo después
  const g = await page.evaluate(`(() => { ${SEMILLA} _kmVolverAnalizar(); _kmImportar(); return { hist: S.g('hist'), eq: S.g('eq') }; })()`);
  const nuevas = g.hist.filter((h) => (h.origen || '').includes('Control Kilometraje'));
  expect(nuevas.map((h) => h.sigla).sort()).toEqual(['CA-10505', 'CA-5979']);
  expect(nuevas.find((h) => h.sigla === 'CA-5979')).toMatchObject({ fecha: '2026-11-01', horomFin: 124127, horomIni: 118900 });
  const e79 = g.eq.find((e) => e.sigla === 'CA-5979');
  expect(e79.horomActual).toBe(124127);
  expect(e79.fechaHorom).toBe('2026-11-01');
  expect(e79.pmPendienteManual).toBe(124681);
  expect(e79.horomProxPM).toBe(124681);                                  // el sistema respeta el manual porque es menor que su grilla (130.000)
  const e105 = g.eq.find((e) => e.sigla === 'CA-10505');
  expect(e105.horomActual).toBe(23667);
  expect(e105.pmPendienteManual).toBeFalsy();                            // el valor dudoso de la planilla no se cargó
  expect(errores).toEqual([]);
});

test('lo desmarcado no se carga y una lectura ya existente ese día no se duplica', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page);
  await page.evaluate(() => go('hist'));
  await expect(page.locator('#s-hist')).toContainText('Importar Control Kilometraje', { timeout: 15000 });
  await expect(async () => {
    await page.evaluate(`(() => { ${SEMILLA} })()`);
    await page.evaluate(() => importarKilometraje());
    await expect(page.locator('#kmArchivo')).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20000 });
  await page.locator('#kmArchivo').setInputFiles({ name: 'k.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: planilla() });
  const panel = page.locator('#mc, .modal, [class*=modal]').filter({ hasText: 'Control Kilometraje — propuesta' }).first();
  await expect(async () => {
    await page.evaluate(`(() => { ${SEMILLA} S.s('hist', S.g('hist').concat([{ sigla: 'CA-5979', fecha: '2026-11-01', horom: 124127, horomFin: 124127 }])); })()`);
    await page.evaluate(() => _kmVolverAnalizar());
    await expect(panel).toContainText('Ya hay lectura ese día', { timeout: 2000 });
  }).toPass({ timeout: 20000 });
  const g = await page.evaluate(`(() => { ${SEMILLA} S.s('hist', S.g('hist').concat([{ sigla: 'CA-5979', fecha: '2026-11-01', horom: 124127, horomFin: 124127 }])); _kmVolverAnalizar(); _kmMarcar('mantenciones', 0, false); _kmImportar(); return { hist: S.g('hist'), eq: S.g('eq') }; })()`);
  expect(g.hist.filter((h) => h.sigla === 'CA-5979' && h.fecha === '2026-11-01')).toHaveLength(1);   // no se duplicó
  expect(g.eq.find((e) => e.sigla === 'CA-5979').pmPendienteManual).toBeFalsy();                        // se desmarcó
});
