const { test, expect } = require('@playwright/test');
const { mockSupabase, SB_URL } = require('./helpers/mock-supabase');

// Auditoría de Datos → Clasificación asistida del componente (IA), 24-oct-2026. La función clasificar-correctivos solo propone; la persona marca y aplica. Nada se guarda solo,
// no se tocan tipoCausa ni categoriaMTTR, y a la IA solo se le envía el texto (sin teléfonos).
async function entrar(page, role) {
  await mockSupabase(page, { loginOk: true, role: role || 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
  await page.setViewportSize({ width: 1280, height: 900 });
}

const DATOS = `
  window._sembrarClasif = () => {
    S.s('eq', [{ sigla: 'ZZ-1', tipo: 'Camion', modelo: 'X' }]);
    S.s('ot', [
      { _id: 'o1', sigla: 'ZZ-1', tipo: 'Correctivo', fecha: '2026-03-01', sintoma: 'ruido raro al acelerar', solucion: 'se revisa y queda ok', estadoOT: 'Cerrada', componente: '', tipoCausa: '', categoriaMTTR: '' },
      { _id: 'o2', sigla: 'ZZ-1', tipo: 'Correctivo', fecha: '2026-03-02', sintoma: 'vibracion en cabina', estadoOT: 'Cerrada', componente: '' },
      { _id: 'o3', sigla: 'ZZ-1', tipo: 'Correctivo', fecha: '2026-03-03', sintoma: 'falla de turbo', estadoOT: 'Cerrada', componente: '' },
    ]);
    S.s('otHist', [
      { id: 'h1', sigla: 'ZZ-1', fecha: '2023-01-01', descripcion: '+56911112222: pierde potencia en subida', sistema: '', fuente: 'WhatsApp' },
      { id: 'h2', sigla: 'ZZ-1', fecha: '2023-01-02', descripcion: 'Control de neumáticos posición 3', sistema: 'Neumáticos' },
      { id: 'h3', sigla: 'ZZ-1', fecha: '2023-01-03', descripcion: 'Se realiza cambio de cuchillas', sistema: 'GET / Cuchillas' },
    ]);
  };
`;

async function abrirAuditoria(page) {
  await page.evaluate(async (datos) => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    eval(datos);
    window._sembrarClasif(); go('audit');
    for (let i = 0; i < 100 && (typeof renders.audit !== 'function' || !document.getElementById('s-audit')); i++) await esp(100);
    for (let k = 0; k < 12; k++) {
      window._sembrarClasif(); renders.audit(); await esp(400);
      if (document.getElementById('clasifIA')) break;
    }
  }, DATOS);
}

test('correctivos formales: la IA sugiere, la persona marca y aplica; solo se escribe «componente»', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page);
  const pedidos = [];
  await page.route(`${SB_URL}/functions/v1/clasificar-correctivos`, async (route) => {
    const body = JSON.parse(route.request().postData());
    pedidos.push(body);
    await page.evaluate(() => window._sembrarClasif());
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, sugerencias: body.items.map((i) => ({ id: i.id, componente: i.texto.includes('vibracion') ? 'Soporte de Cabina' : null, confianza: i.texto.includes('vibracion') ? 'alta' : 'baja', motivo: i.texto.includes('vibracion') ? 'dice cabina' : null })) }) });
  });
  await abrirAuditoria(page);
  // o3 lo deduce el diccionario; o1 y o2 no (se vuelve a sembrar y dibujar en cada intento: la carga en segundo plano simulada vacía lo sembrado)
  await expect.poll(() => page.evaluate(() => { window._sembrarClasif(); renders.audit(); return (document.getElementById('clasifIA') || {}).innerText || ''; }), { timeout: 15000 }).toContain('Sugerir: correctivos sin componente (2)');
  await page.evaluate(() => { window._sembrarClasif(); window.clasifIAPedir('formales'); });
  await expect(page.locator('#clasifIA')).toContainText('Soporte de Cabina', { timeout: 10000 });
  expect(pedidos[0].action).toBe('sugerir');
  expect(pedidos[0].items.map((i) => i.id).sort()).toEqual(['o1', 'o2']);
  // nada se guardó solo
  expect(await page.evaluate(() => (S.g('ot') || []).filter((o) => o.componente).length)).toBe(0);
  const r = await page.evaluate(() => {
    window._sembrarClasif();
    window.clasifIAMarcarAltas();   // solo o2 (confianza alta, con componente)
    window._sembrarClasif();
    window.clasifIAAplicar();
    const ot = S.g('ot') || [];
    return ot.map((o) => ({ id: o._id, componente: o.componente || '', tipoCausa: o.tipoCausa || '', categoriaMTTR: o.categoriaMTTR || '' }));
  });
  expect(r.find((o) => o.id === 'o2').componente).toBe('Soporte de Cabina');
  expect(r.find((o) => o.id === 'o1').componente).toBe('');
  expect(r.every((o) => !o.tipoCausa && !o.categoriaMTTR)).toBe(true);   // la causa y la categoría de MTTR nunca se tocan
});

test('historial: lo aplicado va a la función (que verifica al admin) y el teléfono nunca se envía', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page);
  const pedidos = [];
  await page.route(`${SB_URL}/functions/v1/clasificar-correctivos`, async (route) => {
    const body = JSON.parse(route.request().postData());
    pedidos.push(body);
    await page.evaluate(() => window._sembrarClasif());
    const resp = body.action === 'sugerir'
      ? { ok: true, sugerencias: body.items.map((i) => ({ id: i.id, componente: 'Motor', confianza: 'alta', motivo: 'pierde potencia' })) }
      : { ok: true, guardadas: body.items.length, yaTenian: 0, noExisten: 0 };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(resp) });
  });
  await abrirAuditoria(page);
  await page.evaluate(() => { window._sembrarClasif(); window.clasifIAPedir('historico'); });
  await expect(page.locator('#clasifIA')).toContainText('pierde potencia en subida', { timeout: 10000 });
  expect(JSON.stringify(pedidos[0])).not.toContain('56911112222');
  expect(pedidos[0].items).toEqual([{ id: 'h1', texto: 'pierde potencia en subida' }]);
  await page.evaluate(() => { window.clasifIAMarcarAltas(); window.clasifIAAplicar(); });
  await expect.poll(() => pedidos.length, { timeout: 10000 }).toBe(2);
  expect(pedidos[1]).toEqual({ action: 'aplicarHistorico', items: [{ id: 'h1', componente: 'Motor' }] });
});

test('medir acuerdo: compara la IA con lo que el historial ya traía y lista los desacuerdos', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page);
  await page.route(`${SB_URL}/functions/v1/clasificar-correctivos`, async (route) => {
    const body = JSON.parse(route.request().postData());
    await page.evaluate(() => window._sembrarClasif());
    // coincide con las dos filas del historial que ya traen sistema salvo con una
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, sugerencias: body.items.map((i) => ({ id: i.id, componente: i.id === 'h2' ? 'Neumáticos' : 'Motor', confianza: i.id === 'h2' ? 'alta' : 'media', motivo: null })) }) });
  });
  await abrirAuditoria(page);
  await page.evaluate(() => { window._sembrarClasif(); window.clasifIAMedir(); });
  await expect(page.locator('#clasifIA')).toContainText('Acuerdo de la IA', { timeout: 10000 });
  await expect(page.locator('#clasifIA')).toContainText('50%');
  await expect(page.locator('#clasifIA')).toContainText('Dónde no coincide (1)');
});

test('un error de la función se muestra y no rompe la pantalla; quien no es administrador no ve el bloque', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page);
  await page.route(`${SB_URL}/functions/v1/clasificar-correctivos`, async (route) => {
    await page.evaluate(() => window._sembrarClasif());
    return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Solo un administrador puede usar la clasificación asistida.' }) });
  });
  await abrirAuditoria(page);
  await page.evaluate(() => { window._sembrarClasif(); window.clasifIAPedir('formales'); });
  await expect(page.locator('#clasifIA')).toContainText('Solo un administrador puede usar la clasificación asistida', { timeout: 10000 });
  await expect(page.locator('#clasifIA button').first()).toBeEnabled();
});

test('un usuario que no es administrador no ve la clasificación asistida', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page, 'operador');
  await abrirAuditoria(page).catch(() => {});
  await page.evaluate(async () => { const esp = (ms) => new Promise((x) => setTimeout(x, ms)); go('audit'); await esp(1500); });
  const texto = await page.evaluate(() => (document.getElementById('s-audit') || {}).innerText || '');
  expect(texto).toContain('Auditoría de Datos');
  expect(texto).not.toContain('Clasificación asistida del componente');
});
