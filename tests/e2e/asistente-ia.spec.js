const { test, expect } = require('@playwright/test');
const { mockSupabase, SB_URL } = require('./helpers/mock-supabase');

// Asistente de IA (29-oct-2026): el navegador le pregunta a la función, ejecuta aquí la herramienta que Claude pida con los datos reales cargados, y muestra la respuesta. La función de Claude está simulada.

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

test('el asistente pide una herramienta, el navegador la ejecuta con los datos reales y muestra la respuesta con los datos consultados', async ({ page }) => {
  test.setTimeout(90000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await entrar(page);
  const pedidos = [];
  // La carga en segundo plano puede vaciar los datos sembrados: se vuelven a sembrar justo antes de contestar, que es cuando el navegador ejecuta la herramienta.
  const sembrar = () => page.evaluate(() => { S.s('eq', [
    { sigla: 'CN-9500', tipo: 'Camion', modelo: 'X', estado: 'AL DÍA', horomActual: 1000 },
    { sigla: 'CN-9501', tipo: 'Camion', modelo: 'X', estado: 'URGENTE', horomActual: 5000, diasParaPM: 1 },
    { sigla: 'CN-9502', tipo: 'Camion', modelo: 'X', estado: 'VENCIDA', horomActual: 7000, diasParaPM: -5 },
  ]); });
  await page.route(`${SB_URL}/functions/v1/asistente-ia`, async (route) => {
    const cuerpo = JSON.parse(route.request().postData());
    pedidos.push(cuerpo);
    if (pedidos.length === 1) {
      await sembrar();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ stop_reason: 'tool_use', content: [
        { type: 'text', text: 'Reviso la flota.' },
        { type: 'tool_use', id: 'tu_1', name: 'estado_flota', input: {} },
      ] }) });
    }
    // segunda vuelta: Claude ya recibió el resultado de la herramienta y contesta con él
    const res = cuerpo.messages[cuerpo.messages.length - 1].content[0];
    const datos = JSON.parse(res.content);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ stop_reason: 'end_turn', content: [
      { type: 'text', text: '**' + datos.equipos.length + ' equipos** necesitan atención:\n- ' + datos.equipos.map((e) => e.sigla + ' (' + e.estado + ')').join('\n- ') },
    ] }) });
  });
  await page.evaluate(() => go('asistente'));
  await expect(page.locator('#s-asistente')).toContainText('solo lee', { timeout: 15000 });
  await expect(page.locator('#s-asistente')).toContainText('se envía a Anthropic');
  await page.locator('#asiInput').fill('¿Qué equipos tienen el PM vencido o urgente?');
  await page.locator('#asiBtn').click();
  await expect(page.locator('#asiChat')).toContainText('2 equipos', { timeout: 15000 });
  await expect(page.locator('#asiChat')).toContainText('CN-9502 (VENCIDA)');
  await expect(page.locator('#asiChat')).not.toContainText('CN-9500');
  await expect(page.locator('#asiChat')).toContainText('Datos consultados: estado de la flota');
  expect(pedidos.length).toBe(2);
  expect(pedidos[0].messages.length).toBe(1);                         // la primera vuelta lleva solo la pregunta
  expect(pedidos[1].messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
  expect(errores).toEqual([]);
});

test('si la función responde con un error (límite, clave sin configurar) se muestra tal cual y se puede volver a intentar', async ({ page }) => {
  test.setTimeout(90000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await entrar(page);
  await page.route(`${SB_URL}/functions/v1/asistente-ia`, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'El asistente todavía no está configurado (falta la clave de Anthropic en los secretos de la función).' }) }));
  await page.evaluate(() => go('asistente'));
  await expect(page.locator('#asiInput')).toBeVisible({ timeout: 15000 });
  await page.locator('#asiInput').fill('hola');
  await page.locator('#asiBtn').click();
  await expect(page.locator('#asiChat')).toContainText('falta la clave de Anthropic', { timeout: 15000 });
  await expect(page.locator('#asiInput')).toBeEnabled();
  expect(errores).toEqual([]);
});

test('el texto de la respuesta se escapa: un «<script>» dentro de un dato no se ejecuta', async ({ page }) => {
  await entrar(page);
  const html = await page.evaluate(async () => {
    await _cargarModuloLazy('asistente');
    return asistenteTextoAHtml('**Ojo** <img src=x onerror=alert(1)>\n- uno\n- <b>dos</b>');
  });
  expect(html).toContain('<b>Ojo</b>');
  expect(html).not.toContain('<img');
  expect(html).toContain('&lt;img');
  expect(html).toContain('<li>uno</li>');
  expect(html).toContain('<li>&lt;b&gt;dos&lt;/b&gt;</li>');
});

test('si el sistema redibuja la pestaña en segundo plano, la pregunta a medio escribir no se pierde', async ({ page }) => {
  test.setTimeout(60000);
  await entrar(page);
  await page.evaluate(() => go('asistente'));
  await expect(page.locator('#asiInput')).toBeVisible({ timeout: 15000 });
  await page.locator('#asiInput').fill('¿Cuánto gastamos en turbos?');
  await page.locator('#asiInput').focus();
  await page.evaluate(() => renders.asistente());
  await expect(page.locator('#asiInput')).toHaveValue('¿Cuánto gastamos en turbos?');
  await expect(page.locator('#asiInput')).toBeFocused();
});
