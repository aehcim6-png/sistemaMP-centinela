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
  expect(Object.keys(JSON.parse(ins.body)[0]).sort()).toEqual(['activo', 'categoria', 'codigo', 'descripcion', 'id', 'observacion', 'origen', 'origenId', 'precioUnit', 'stockCritico', 'ubicacion', 'unidad']);
  expect(Object.keys(JSON.parse(mov.body)[0]).sort()).toEqual(['cantidad', 'destino', 'documento', 'fecha', 'id', 'insumoId', 'observacion', 'precioUnit', 'referencia', 'tipo', 'usuario']);
});

test('kardex unificado: activar filtros, lubricantes y repuestos; el PM y la OC recibida mueven el kardex y el stock antiguo; un cambio a mano se detecta y se cuadra', async ({ page }) => {
  test.setTimeout(120000);
  await entrar(page);
  const r = await page.evaluate(async () => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const toasts = []; window.toast = (m) => { toasts.push(String(m)); };
    go('stk2');
    for (let i = 0; i < 100 && typeof renders.stk2 !== 'function'; i++) await esp(100);
    const mem = {
      ins: [], insMov: [], mov: [], mapaRep: [], comprasDetalle: [], pau: [],
      stk: [{ _id: 'f1', nParte: 'LF9009', descripcion: 'Filtro aceite', equipoModelo: 'D375', stockBodega: 6, consumoMes: 2, precioUnit: 10000 }],
      lub: [{ _id: 'l1', nombre: 'Aceite 15W40', unidad: 'L', stock: 80, precio: 3000 }],
      repuestos: [{ _id: 'r1', componente: 'Inyector', nParte: 'INJ-1', equipo: 'CN-9502', stockActual: 4, stockMinimo: 2, precioUnit: 500000 }],
      ordenes: [{ _id: 'o1', componente: 'Inyector', nParte: 'INJ-1', cantidad: 3, proveedor: 'Proveedor X', fecha: '2026-10-01', estado: 'Pendiente' }],
    };
    const g = S.g.bind(S), s = S.s.bind(S);
    S.g = (k) => (k in mem ? mem[k] : g(k)); S.s = (k, v) => { if (k in mem) { mem[k] = v; return true; } return s(k, v); };
    const out = {};
    window._stk2Sub = 'ins'; await renders.stk2();
    for (let i = 0; i < 100 && !(document.getElementById('s-ins') || {}).innerText; i++) await esp(100);
    out.aviso = document.getElementById('s-ins').innerText;
    // 1) activar
    insActivar(); await esp(100);
    out.modal = document.body.innerText;
    insActivarConfirmar(); await esp(200);
    out.items = mem.ins.map((i) => i.origen + ':' + i.descripcion);
    out.iniciales = mem.insMov.filter((m) => m.tipo === 'inicial').map((m) => m.cantidad).sort((a, b) => a - b);
    out.sinDescuadre = (document.getElementById('s-ins').innerText.match(/stock distinto/) || []).length;
    // 2) un PM descuenta 2 filtros y 7,5 L: el kardex lo anota con equipo y PM
    descontarStock([{ rep: 'Filtro aceite LF9009', can: 2 }, { rep: 'Aceite 15W40', can: 7.5 }], '2026-10-26', 'CN-9502', 'PM2');
    await esp(100);
    const insF = mem.ins.find((i) => i.origen === 'filtro')._id;
    const sal = insumosSaldos(mem.insMov);
    out.saldoFiltroTrasPM = sal[insF].saldo; out.legadoFiltro = mem.stk[0].stockBodega;
    out.salidasPM = mem.insMov.filter((m) => m.tipo === 'salida').map((m) => [m.cantidad, m.destino, m.documento]);
    // 3) OC recibida: entrada al kardex y al stock de repuestos
    const { recibirOC } = await import('/modules/renders/rep.js');
    recibirOC(0); await esp(100);
    const insR = mem.ins.find((i) => i.origen === 'repuesto')._id;
    out.saldoRepTrasOC = insumosSaldos(mem.insMov)[insR].saldo; out.legadoRep = mem.repuestos[0].stockActual;
    out.toastOC = toasts.filter((t) => /OC marcada/.test(t)).pop();
    // 4) alguien edita el stock a mano en la pantalla antigua
    mem.lub[0].stock = 50;
    renders.ins(); await esp(100);
    out.avisoDescuadre = document.getElementById('s-ins').innerText;
    insDescuadres(); await esp(100);
    out.tablaDescuadre = document.body.innerText;
    insCuadrar(1); await esp(100);
    const insL = mem.ins.find((i) => i.origen === 'lubricante')._id;
    out.saldoLubTrasCuadre = insumosSaldos(mem.insMov)[insL].saldo;
    out.ajusteLub = mem.insMov.filter((m) => m.tipo === 'ajuste').map((m) => m.cantidad);
    // 5) una salida manual en el kardex baja también el stock de la pantalla antigua
    insMovimiento(insF, 'salida'); await esp(100);
    document.getElementById('imCant').value = '1'; document.getElementById('imDoc').value = 'vale 9';
    insGuardarMov(insF, 'salida'); await esp(100);
    out.legadoFiltroTrasSalidaManual = mem.stk[0].stockBodega;
    return out;
  });
  expect(r.aviso).toContain('3 ítems de Stock Filtros, Lubricantes y Repuestos aún no tienen kardex');
  expect(r.modal).toContain('Activar el kardex');
  expect(r.items.sort()).toEqual(['filtro:Filtro aceite', 'lubricante:Aceite 15W40', 'repuesto:Inyector']);
  expect(r.iniciales).toEqual([4, 6, 80]);
  expect(r.sinDescuadre).toBe(0);
  expect(r.saldoFiltroTrasPM).toBe(4);
  expect(r.legadoFiltro).toBe(4);
  expect(r.salidasPM).toEqual(expect.arrayContaining([[2, 'CN-9502', 'PM PM2'], [7.5, 'CN-9502', 'PM PM2']]));
  expect(r.saldoRepTrasOC).toBe(7);
  expect(r.legadoRep).toBe(7);
  expect(r.toastOC).toContain('entrada sumada al kardex de «Inyector»');
  expect(r.avisoDescuadre).toContain('1 ítem(s) tienen un stock distinto');
  expect(r.tablaDescuadre).toContain('Aceite 15W40');
  expect(r.saldoLubTrasCuadre).toBe(50);
  expect(r.ajusteLub).toEqual([-22.5]);                      // 80 − 7,5 del PM = 72,5 en el kardex; la pantalla dice 50
  expect(r.legadoFiltroTrasSalidaManual).toBe(3);
});
