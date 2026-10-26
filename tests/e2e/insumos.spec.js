const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Stock & Insumos → Insumos (26-oct-2026): carga por lista, entrada, salida (con tope en el saldo), kardex, conteo físico y el aporte a «Qué comprar».
async function entrar(page) {
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });
  await page.setViewportSize({ width: 1280, height: 1000 });
}

test('flujo completo: cargar lista, entrada, salida rechazada y aceptada, kardex, conteo y Qué comprar', async ({ page }) => {
  test.setTimeout(120000);
  await entrar(page);
  const r = await page.evaluate(async () => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const toasts = []; const t0 = window.toast; window.toast = (m) => { toasts.push(String(m)); };
    go('stk2');
    for (let i = 0; i < 100 && typeof renders.stk2 !== 'function'; i++) await esp(100);
    // el almacén de prueba vive en memoria: la carga de fondo simulada vacía los datos sembrados
    const mem = { ins: [], insMov: [], comprasDetalle: [] }; const g = S.g.bind(S), s = S.s.bind(S);
    S.g = (k) => (k in mem ? mem[k] : g(k)); S.s = (k, v) => { if (k in mem) { mem[k] = v; return true; } return s(k, v); };
    const out = {};
    window._stk2Sub = 'ins'; await renders.stk2();
    for (let i = 0; i < 100 && !(document.getElementById('s-ins') || {}).innerText; i++) await esp(100);
    out.vacio = (document.getElementById('s-ins') || {}).innerText || '';
    // 1) cargar lista pegada
    insLista(); await esp(100);
    document.getElementById('ilCat').value = 'EPP';
    document.getElementById('ilTxt').value = 'Descripción;Unidad;Stock;Crítico;Precio\nGuante cabritilla;PAR;14;5;735\nLentes;UN;40;10;1.600\nLentes;UN;1\nX;UN;abc';
    insListaVista();
    out.vista = document.getElementById('ilVista').innerText;
    insListaGuardar(); await esp(200);
    out.items = mem.ins.length; out.movsIni = mem.insMov.length;
    const guante = mem.ins.find((x) => x.descripcion === 'Guante cabritilla')._id;
    // 2) entrada
    insMovimiento(guante, 'entrada'); await esp(100);
    document.getElementById('imCant').value = '10'; document.getElementById('imDoc').value = 'guía 55'; document.getElementById('imRef').value = 'Proveedor X';
    insGuardarMov(guante, 'entrada'); await esp(100);
    // 3) salida mayor que el saldo: rechazada
    insMovimiento(guante, 'salida'); await esp(100);
    document.getElementById('imCant').value = '999'; insGuardarMov(guante, 'salida'); await esp(100);
    out.rechazo = toasts[toasts.length - 1]; out.movsTrasRechazo = mem.insMov.length;
    // 4) salida válida con vale, quién retira y destino
    insMovimiento(guante, 'salida'); await esp(100);
    document.getElementById('imCant').value = '20'; document.getElementById('imDoc').value = 'vale 7'; document.getElementById('imRef').value = 'Juan Pérez'; document.getElementById('imDest').value = 'CN-9502';
    insGuardarMov(guante, 'salida'); await esp(100);
    out.saldoTrasSalida = (insumosSaldos(mem.insMov)[guante] || {}).saldo;
    // 5) kardex
    insKardex(guante); await esp(100);
    out.kardex = document.body.innerText;
    cm();
    // 6) conteo físico: se cuentan 2 pero el sistema dice 4
    insConteo(); await esp(100);
    const inp = document.querySelector('#icC0'); const filasConteo = [...document.querySelectorAll('[id^=icC]')];
    const delGuante = filasConteo.find((i) => i.dataset.id === guante); delGuante.value = '2';
    insConteoGuardar(filasConteo.length); await esp(100);
    out.saldoTrasConteo = (insumosSaldos(mem.insMov)[guante] || {}).saldo;
    out.ajuste = mem.insMov.filter((m) => m.tipo === 'ajuste').map((m) => m.cantidad);
    // 7) Qué comprar con consumo de insumos
    mem.insMov.forEach((m) => { if (m.insumoId === guante && m.tipo === 'salida') m.fecha = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10); });
    queComprar(); await esp(300);
    out.qc = document.body.innerText;
    window.toast = t0;
    return out;
  });
  expect(r.vacio).toContain('Todavía no hay insumos');
  expect(r.vista).toMatch(/1.*ítem\(s\) nuevos|2.*ítem\(s\) nuevos/);
  expect(r.vista).toMatch(/2 línea\(s\) con problema/);
  expect(r.items).toBe(2);
  expect(r.movsIni).toBe(2);
  expect(r.rechazo).toMatch(/saldo es 24/);
  expect(r.movsTrasRechazo).toBe(3);                         // 2 iniciales + la entrada; la salida rechazada no se guardó
  expect(r.saldoTrasSalida).toBe(4);                         // 14 + 10 − 20
  expect(r.kardex).toContain('Kardex — Guante cabritilla');
  expect(r.kardex).toContain('vale 7');
  expect(r.kardex).toContain('Juan Pérez');
  expect(r.kardex).toContain('CN-9502');
  expect(r.saldoTrasConteo).toBe(2);
  expect(r.ajuste).toEqual([-2]);
  expect(r.qc).toContain('Insumos generales');
  expect(r.qc).toContain('Guante cabritilla');
});

test('lo que se guarda llega a la base con las columnas de las tablas insumos e insumos_movimientos', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page);
  const posts = [];
  page.on('request', (rq) => { if (rq.method() === 'POST' && /\/rest\/v1\/insumos(_movimientos)?\?/.test(rq.url())) posts.push({ url: rq.url(), body: rq.postData() }); });
  await page.evaluate(async () => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const id = crypto.randomUUID();
    S.s('ins', [{ _id: id, descripcion: 'Batería 12V', categoria: 'Baterías', unidad: 'UN', stockCritico: 2, ubicacion: 'Bodega 1', precioUnit: 90000, observacion: '', activo: true }]);
    S.s('insMov', [{ _id: crypto.randomUUID(), insumoId: id, fecha: '2026-10-26', tipo: 'inicial', cantidad: 5, documento: 'saldo inicial', usuario: 'Admin' }]);
    await esp(1500);
  });
  const ins = posts.find((p) => /\/insumos\?/.test(p.url)), mov = posts.find((p) => /\/insumos_movimientos\?/.test(p.url));
  expect(ins, 'POST a insumos').toBeTruthy();
  expect(mov, 'POST a insumos_movimientos').toBeTruthy();
  expect(Object.keys(JSON.parse(ins.body)[0]).sort()).toEqual(['activo', 'categoria', 'codigo', 'descripcion', 'id', 'observacion', 'precioUnit', 'stockCritico', 'ubicacion', 'unidad']);
  expect(Object.keys(JSON.parse(mov.body)[0]).sort()).toEqual(['cantidad', 'destino', 'documento', 'fecha', 'id', 'insumoId', 'observacion', 'precioUnit', 'referencia', 'tipo', 'usuario']);
});
