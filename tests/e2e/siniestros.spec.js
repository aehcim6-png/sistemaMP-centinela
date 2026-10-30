const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Siniestros (IT-AD-003): se registran en Vencimientos, el plazo de 5 días se ve en la lista y en el encabezado, los documentos se marcan,
// al pasar a «Informado» se pide la fecha y la bitácora del equipo se descarga.
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

test('registrar un siniestro, ver el plazo y el aviso, marcar documentos, informarlo y bajar la bitácora', async ({ page }) => {
  test.setTimeout(120000);
  await entrar(page);
  await page.evaluate(async () => { go('venc'); await new Promise((x) => setTimeout(x, 2500)); });
  // todo en un mismo turno, sin esperas: la carga en segundo plano (simulada vacía) pisaría lo sembrado
  const r = await page.evaluate(() => {
    const dIso = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    S.s('eq', [{ sigla: 'CA-1', tipo: 'Camioneta', modelo: 'Hilux' }]);
    S.s('ot', [{ _id: 'o1', sigla: 'CA-1', tipo: 'Correctivo', fecha: dIso(20), sintoma: 'Ruido en frenos', solucion: 'Cambio de pastillas', estadoOT: 'Cerrada' }]);
    S.s('reg', [{ _id: 'r1', equipo: 'CA-1', tipoPM: 'PM1', fechaEntrada: dIso(40), duracionH: 3 }]);
    // dIso(n) = hace n días: la revisión técnica venció hace 30 días; el permiso vence en 30
    S.s('venc', { 'CA-1': { 'Revisión Técnica': { proxima: dIso(30) }, 'Permiso Circulación': { proxima: dIso(-30) } } });
    S.s('siniestros', []);
    const toasts = []; const t0 = window.toast; window.toast = (m) => toasts.push(String(m));
    const out = {};
    renderVenc();
    // registrar: ocurrió hace 4 días → le queda 1 día
    registrarSiniestro();
    document.getElementById('snEq').value = 'CA-1';
    document.getElementById('snFecha').value = dIso(4);
    document.getElementById('snTipo').value = 'Vehículo liviano';
    document.getElementById('snFaena').value = 'Centinela';
    document.getElementById('snRelato').value = 'Choque menor en estacionamiento';
    document.getElementById('snTercero').checked = true;
    saveSiniestro();
    out.toastGuardar = toasts[toasts.length - 1];
    out.guardado = S.g('siniestros').map((s) => ({ sigla: s.sigla, estado: s.estado, tercero: s.terceroInvolucrado }));
    renderVenc(); renderHeader();
    out.seccion = document.getElementById('s-venc').innerText.replace(/\s+/g, ' ');
    out.header = document.body.innerText.replace(/\s+/g, ' ').toLowerCase();   // el encabezado va en mayúsculas por CSS
    // documentos: el del tercero se pide, se marcan dos
    sinDocumentos(0);
    out.modalDocs = document.body.innerText.replace(/\s+/g, ' ');
    sinMarcarDoc(0, 'informe', true); sinMarcarDoc(0, 'fotos', true); sinMarcarDoc(0, 'docsVehiculo', 'na');
    out.docs = S.g('siniestros')[0].documentos;
    out.modalDocs2 = document.body.innerText.replace(/\s+/g, ' ');
    // bitácora: un correctivo y un PM en los 12 meses previos
    const urls = []; const c0 = URL.createObjectURL; URL.createObjectURL = (b) => { urls.push(b); return 'blob:x'; };
    const clic0 = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { out.descarga = this.download; };
    sinBitacoraCSV(0);
    URL.createObjectURL = c0; HTMLAnchorElement.prototype.click = clic0;
    out.toastBitacora = toasts[toasts.length - 1];
    // informar: pide la fecha; queda informado a tiempo y desaparece del encabezado
    const p0 = window.prompt; window.prompt = () => dIso(0);
    sinCambiarEstado(0, 'Informado');
    window.prompt = p0;
    out.informado = { estado: S.g('siniestros')[0].estado, fecha: S.g('siniestros')[0].fechaInformado, hoy: dIso(0) };
    renderVenc(); renderHeader();
    out.seccion2 = document.getElementById('s-venc').innerText.replace(/\s+/g, ' ');
    out.header2 = document.body.innerText.toLowerCase().includes('siniestros por denunciar');
    window.toast = t0;
    return out;
  });
  expect(r.toastGuardar).toContain('hay que informarlo a Finanzas a más tardar');
  expect(r.guardado).toEqual([{ sigla: 'CA-1', estado: 'Por informar', tercero: true }]);
  expect(r.seccion).toContain('Siniestros');
  expect(r.seccion).toContain('Quedan 1 d');
  expect(r.seccion).toContain('vence(n) en 2 días o menos');
  expect(r.header).toContain('1 siniestros por denunciar');
  expect(r.modalDocs).toContain('0 de 9 documentos de entrada listos');
  expect(r.modalDocs).toContain('CA-1 Informe de Siniestro faena Centinela');
  expect(r.modalDocs).toContain('Revisión Técnica vencido');
  expect(r.modalDocs).toContain('Permiso Circulación vigente');
  expect(r.docs).toEqual({ informe: true, fotos: true, docsVehiculo: 'na' });
  expect(r.modalDocs2).toContain('2 de 8 documentos de entrada listos');
  expect(r.descarga).toMatch(/^bitacora_CA-1_/);
  expect(r.toastBitacora).toContain('(2 registros)');
  expect(r.informado).toEqual({ estado: 'Informado', fecha: r.informado.hoy, hoy: r.informado.hoy });
  expect(r.seccion2).toContain('informado a tiempo');
  expect(r.header2).toBe(false);
  if (process.env.SIN_CAPTURA) {
    await page.evaluate(() => sinDocumentos(0));
    await page.screenshot({ path: process.env.SIN_CAPTURA, fullPage: false });
  }
});
