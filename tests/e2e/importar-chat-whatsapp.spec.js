const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Importar el chat de WhatsApp (2-nov-2026): se sube el .txt exportado, la pantalla propone horómetros, paradas y PM, la persona marca lo que quiere
// y solo entonces se guarda. Es una vía adicional: el botón de «Importar CSV» de siempre sigue en su lugar.

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

const CHAT = [
  '29-10-26 03:34 - Guardia: 03:00',
  'Equipo: CF 510',
  'Estatus: Fuera de servicio',
  'Motivo: Falla sistema de engrase',
  'Horómetro: 16210',
  'Lugar: taller',
  '29-10-26 05:45 - Maicol: Equipo: CF 510',
  'Estatus: operativo',
  'Motivo: reparación del engrase automático',
  'Horómetro: 16210',
  '29-10-26 07:20 - Guardia: TI 5141= 23045',
  'TI 5142= 16731',
  '29-10-26 20:10 - José: Equipo: CN-5131',
  'Estatus: operativo',
  'Motivo: mantencion programada PM2',
  'Horómetro: 12450',
].join('\n');

const SEMILLA = `
    S.s('eq', [
      { sigla: 'CF-9510', tipo: 'Cargador Frontal', modelo: 'WA900', horomActual: 16200, fechaHorom: '2026-10-27' },
      { sigla: 'TI-5141', tipo: 'Torre', modelo: 'X', horomActual: 23000, fechaHorom: '2026-10-27' },
      { sigla: 'TI-5142', tipo: 'Torre', modelo: 'X', horomActual: 16731, fechaHorom: '2026-10-27' },
      { sigla: 'CN-5131', tipo: 'Camion', modelo: 'X', horomActual: 12400, fechaHorom: '2026-10-27' },
    ]);
    S.s('hist', [
      { sigla: 'TI-5141', fecha: '2026-10-27', horom: 23000, horomFin: 23000 },
      { sigla: 'TI-5141', fecha: '2026-10-31', horom: 23100, horomFin: 23100 },
      { sigla: 'TI-5142', fecha: '2026-10-29', horom: 16731, horomFin: 16731 },
      { sigla: 'CF-9510', fecha: '2026-10-27', horom: 16200, horomFin: 16200 },
    ]);
    S.s('reg', []);
`;
const OT_DUPLICADA = `S.s('ot', [{ sigla: 'CF-9510', fechaEntrada: '2026-10-29', horaEntrada: '03:10', fechaSalida: '2026-10-29', horaSalida: '05:40', estadoOT: 'Cerrada', tipo: 'Correctivo' }]);`;
async function sembrar(page, conOT) {
  await page.evaluate(`(() => { ${SEMILLA} ${conOT ? OT_DUPLICADA : "S.s('ot', []);"} })()`);
}

test('el chat exportado se revisa y se carga solo lo marcado; los botones de siempre siguen', async ({ page }) => {
  test.setTimeout(90000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await entrar(page);
  await page.evaluate(() => go('hist'));
  // la vía antigua sigue ahí junto a la nueva
  await expect(page.locator('#s-hist')).toContainText('Importar CSV', { timeout: 15000 });
  await expect(page.locator('#s-hist')).toContainText('Importar chat de WhatsApp');
  // la carga en segundo plano puede vaciar lo sembrado: se siembra justo antes de abrir
  await expect(async () => {
    await sembrar(page, false);
    await page.evaluate(() => importarChatWhatsApp());
    await expect(page.locator('#chatArchivo')).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20000 });
  await page.locator('#chatDesde').fill('2026-10-01');
  await page.locator('#chatArchivo').setInputFiles({ name: 'Chat de WhatsApp con BSM.txt', mimeType: 'text/plain', buffer: Buffer.from(CHAT, 'utf8') });
  const panel = page.locator('#mc, .modal, [class*=modal]').filter({ hasText: 'Chat de WhatsApp — propuesta' }).first();
  await expect(panel).toContainText('Paradas', { timeout: 10000 });
  // la carga en segundo plano puede vaciar los equipos entre la siembra y el análisis: se resiembra y se vuelve a analizar hasta que aparezca
  await expect(async () => {
    await sembrar(page, false);
    await page.evaluate(() => _chatVolverAnalizar());
    await expect(panel).toContainText('CF-9510', { timeout: 2000 });
  }).toPass({ timeout: 20000 });
  await expect(panel).toContainText('2h 45min');
  await expect(panel).toContainText('PM2');
  await expect(panel).toContainText('Cargar lo marcado (4)');   // 1 parada + 2 horómetros que cuadran (TI-5142 ya tenía lectura ese día) + 1 PM → se ve abajo
  // se lee el resultado en la misma vuelta que se guarda: la carga en segundo plano podría pisarlo después
  const guardado = await page.evaluate(`(() => { ${SEMILLA} S.s('ot', []); _chatVolverAnalizar(); _chatImportar(); return { hist: S.g('hist'), ot: S.g('ot'), reg: S.g('reg'), eq: S.g('eq') }; })()`);
  const nuevaOT = guardado.ot.find((o) => o.sigla === 'CF-9510');
  expect(nuevaOT).toMatchObject({ fechaEntrada: '2026-10-29', horaEntrada: '03:00', fechaSalida: '2026-10-29', horaSalida: '05:45', estadoOT: 'Cerrada', estatusEq: 'Fuera de Servicio', tipo: 'Correctivo' });
  expect(nuevaOT.origen).toContain('WhatsApp');
  expect(guardado.hist.filter((h) => (h.origen || '').includes('WhatsApp')).map((h) => h.sigla).sort()).toEqual(['CF-9510', 'TI-5141']);
  expect(guardado.reg.find((r) => r.equipo === 'CN-5131')).toMatchObject({ tipoPM: 'PM2', fechaEntrada: '2026-10-29' });
  expect(guardado.eq.find((e) => e.sigla === 'TI-5141').horomActual).toBe(23045);
  expect(errores).toEqual([]);
});

test('lo desmarcado no se carga y lo ya cargado se detecta', async ({ page }) => {
  test.setTimeout(90000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await entrar(page);
  await page.evaluate(() => go('ot'));
  await expect(page.locator('#s-ot')).toContainText('Importar chat de WhatsApp', { timeout: 15000 });
  await expect(async () => {
    await sembrar(page);
    await page.evaluate(() => S.s('ot', [{ sigla: 'CF-9510', fechaEntrada: '2026-10-29', horaEntrada: '03:10', fechaSalida: '2026-10-29', horaSalida: '05:40', estadoOT: 'Cerrada', tipo: 'Correctivo' }]));
    await page.evaluate(() => importarChatWhatsApp());
    await expect(page.locator('#chatArchivo')).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20000 });
  await page.locator('#chatDesde').fill('2026-10-01');
  await page.locator('#chatArchivo').setInputFiles({ name: 'chat.txt', mimeType: 'text/plain', buffer: Buffer.from(CHAT, 'utf8') });
  const panel = page.locator('#mc, .modal, [class*=modal]').filter({ hasText: 'Chat de WhatsApp — propuesta' }).first();
  await expect(async () => {
    await sembrar(page, true);
    await page.evaluate(() => _chatVolverAnalizar());
    await expect(panel).toContainText('Ya cargada', { timeout: 2000 });
  }).toPass({ timeout: 20000 });
  const guardado = await page.evaluate(`(() => { ${SEMILLA} ${OT_DUPLICADA} _chatVolverAnalizar(); _chatMarcar('pm', 0, false); _chatImportar(); return { ot: S.g('ot'), reg: S.g('reg') }; })()`);
  expect(guardado.ot).toHaveLength(1);          // la parada ya estaba: no se duplica
  expect(guardado.reg).toHaveLength(0);         // el PM se desmarcó
  expect(errores).toEqual([]);
});
