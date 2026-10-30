const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Recauchaje (PRO-MAN-004): un neumático en Stock se envía (queda «En recauchaje»), vuelve recauchado (Stock con la huella nueva)
// o lo rechaza el proveedor con su código (De baja). Uno montado no se puede enviar.
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

test('enviar, recibir y rechazar un recauchaje cambian el estado del neumático y quedan en el listado', async ({ page }) => {
  test.setTimeout(120000);
  await entrar(page);
  await page.evaluate(async () => { go('neu'); await new Promise((x) => setTimeout(x, 2500)); });
  // todo en un mismo turno, sin esperas: la carga en segundo plano (simulada vacía) pisaría lo sembrado
  const r = await page.evaluate(() => {
    const neu = [
      { id: 'n1', sigla: 'CN-1', serie: 'AAA111', marca: 'MICHELIN', medida: '27.00R49', posicion: 'Trasera', estado: 'Stock', remanente: 14 },
      { id: 'n2', sigla: 'CN-1', serie: 'BBB222', marca: 'MICHELIN', medida: '27.00R49', posicion: 'Trasera', estado: 'De baja', remanente: 9 },
      { id: 'n3', sigla: 'CN-2', serie: 'CCC333', marca: 'BRIDGESTONE', medida: '27.00R49', posicion: 'Delantera', estado: 'Operativo', remanente: 50 },
    ];
    S.s('eq', [{ sigla: 'CN-1', tipo: 'Camion', modelo: 'X' }, { sigla: 'CN-2', tipo: 'Camion', modelo: 'X' }]);
    S.s('neu', neu); S.s('neuRec', []);
    const toasts = []; const t0 = window.toast; window.toast = (m) => toasts.push(String(m));
    const out = {};
    renderNeu();
    out.botonesEnvio = document.querySelectorAll('#s-neu button[title="Enviar a recauchaje"]').length;
    // montado: no se puede
    enviarRecauchaje(2);
    out.avisoMontado = toasts[toasts.length - 1];
    // enviar los dos que están fuera del equipo
    enviarRecauchaje(0);
    out.textoModal = document.querySelector('.modal, #modal, [role="dialog"]') ? document.querySelector('.modal, #modal, [role="dialog"]').innerText : document.body.innerText;
    document.getElementById('rcGuia').value = 'GD-501'; document.getElementById('rcProv').value = 'Recauchadora Norte';
    saveEnvioRecauchaje(0);
    enviarRecauchaje(1); saveEnvioRecauchaje(1);
    out.trasEnvio = S.g('neu').map((n) => n.estado);
    out.envios = S.g('neuRec').map((x) => ({ serie: x.serie, estado: x.estado, num: x.numRecauchaje, guia: x.guiaDespacho, huella: x.huellaSalida }));
    // volver a enviar el mismo: bloqueado
    enviarRecauchaje(0);
    out.avisoDoble = toasts[toasts.length - 1];
    // recibir el primero
    recibirRecauchaje(0);
    document.getElementById('rrHuella').value = '62'; document.getElementById('rrCosto').value = '1500000';
    saveRecibirRecauchaje(0);
    // rechazar el segundo sin código: pide el código
    rechazarRecauchaje(1);
    saveRechazoRecauchaje(1);
    out.avisoSinCodigo = toasts[toasts.length - 1];
    document.getElementById('rjCod').value = 'F06';
    saveRechazoRecauchaje(1);
    out.final = S.g('neu').map((n) => ({ serie: n.serie, estado: n.estado, rem: n.remanente }));
    out.recs = S.g('neuRec').map((x) => ({ estado: x.estado, huella: x.huellaEntrada, costo: x.costo, cod: x.codigoRechazo }));
    out.listado = document.body.innerText.replace(/\s+/g, ' ');
    window.toast = t0;
    return out;
  });
  expect(r.botonesEnvio).toBe(2);
  expect(r.avisoMontado).toContain('Primero hay que retirarlo del equipo');
  expect(r.textoModal).toContain('sería el 1.º recauchaje');
  expect(r.trasEnvio).toEqual(['En recauchaje', 'En recauchaje', 'Operativo']);
  expect(r.envios).toEqual([
    { serie: 'AAA111', estado: 'Enviado', num: 1, guia: 'GD-501', huella: 14 },
    { serie: 'BBB222', estado: 'Enviado', num: 1, guia: '', huella: 9 },
  ]);
  expect(r.avisoDoble).toContain('Ya está en recauchaje');
  expect(r.avisoSinCodigo).toContain('Elige el código de rechazo');
  expect(r.final).toEqual([
    { serie: 'AAA111', estado: 'Stock', rem: 62 },
    { serie: 'BBB222', estado: 'De baja', rem: 9 },
    { serie: 'CCC333', estado: 'Operativo', rem: 50 },
  ]);
  expect(r.recs).toEqual([
    { estado: 'Recibido', huella: 62, costo: 1500000, cod: undefined },
    { estado: 'Rechazado', huella: undefined, costo: undefined, cod: 'F06' },
  ]);
  expect(r.listado).toContain('Recauchajes de neumáticos');
  expect(r.listado).toContain('Rechazos por código');
  expect(r.listado).toContain('F06 Daño lateral (1)');
  expect(r.listado).toContain('Rechazado F06');
  if (process.env.REC_CAPTURA) {
    // un envío más, abierto, para que el listado muestre también la sección «En el proveedor»
    await page.evaluate(() => { const n = S.g('neu'); n[2].estado = 'Stock'; S.s('neu', n); enviarRecauchaje(2); saveEnvioRecauchaje(2); verRecauchajes(); });
    await page.screenshot({ path: process.env.REC_CAPTURA, fullPage: false });
  }
});
