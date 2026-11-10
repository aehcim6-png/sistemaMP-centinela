const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Aceite (litros) y grasa (kilos) repuestos en la OT: se guardan como movimientos de stock «Lubricante» con origen «OT …»,
// descuentan el stock y suman al consumo semanal y mensual de la pestaña Lubricantes (junto con el PM y los registros manuales).
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

test('Nueva OT con aceite y grasa descuenta stock y suma al consumo de Lubricantes', async ({ page }) => {
  test.setTimeout(120000);
  await entrar(page);
  const r = await page.evaluate(async () => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const hoy = new Date().toISOString().slice(0, 10);
    const eq = [{ sigla: 'ZZ-1', tipo: 'Cargador', modelo: 'X', horomActual: 1500 }];
    const lub = [{ _id: 'l1', nombre: 'MOBILTRANS HD 50', unidad: 'Litro', stock: 1200, consumoMes: 0, precio: 2612 }, { _id: 'l2', nombre: 'MOBILGREASE XHP 322 MINE', unidad: 'Kilo', stock: 20, consumoMes: 0, precio: 5883 }];
    const sembrar = () => { S.s('eq', eq); S.s('ot', []); S.s('lub', lub.map((l) => Object.assign({}, l))); S.s('mov', []); };
    sembrar(); go('ot'); await esp(2500); sembrar();
    const out = {};
    window.toast = (m) => { out.toast = m; };
    addOT();
    out.seccion = !!document.getElementById('oLubFilas') && document.body.textContent.includes('Aceite (litros) o grasa (kilos) repuesto');
    document.getElementById('oEq').value = 'ZZ-1';
    document.getElementById('oSint').value = 'Corte de flexible de cilindro de levante';
    oLubAgregarFila(); oLubAgregarFila();
    const filas = document.querySelectorAll('#oLubFilas .oLubFila');
    filas[0].querySelector('.oLubSel').value = 'MOBILTRANS HD 50'; oLubUnidad(filas[0].querySelector('.oLubSel')); filas[0].querySelector('.oLubCant').value = '1000';
    filas[1].querySelector('.oLubSel').value = 'MOBILGREASE XHP 322 MINE'; oLubUnidad(filas[1].querySelector('.oLubSel')); filas[1].querySelector('.oLubCant').value = '2.5';
    out.unidades = [...filas].map((f) => f.querySelector('.oLubUni').textContent);
    // línea con error: no guarda la OT
    const f3 = document.createElement('div'); f3.className = 'oLubFila';
    f3.innerHTML = '<select class="oLubSel"><option value="MOBILTRANS HD 50"></option></select><input class="oLubCant" value="0">';
    document.getElementById('oLubFilas').appendChild(f3);
    f3.querySelector('.oLubSel').value = 'MOBILTRANS HD 50';
    window.confirm = () => true;
    saveOT();
    out.otConError = S.g('ot').length; out.toastError = out.toast;
    f3.remove();
    saveOT();
    const ot = S.g('ot')[0];
    out.solucion = ot && ot.solucion;
    const mov = S.g('mov'), lubs = S.g('lub');
    out.mov = mov.map((m) => ({ item: m.item, cant: m.cant, pm: m.pm, equipo: m.equipo, ant: m.ant, nuevo: m.nuevo }));
    out.stock = lubs.map((l) => [l.nombre, l.stock]);
    out.resumen = lubConsumoResumen(mov, 'MOBILTRANS HD 50', hoy);
    // registro manual desde Lubricantes
    S.s('lub', lubs); S.s('mov', mov); // la carga en segundo plano simulada puede haber vaciado lo guardado
    await addLubConsumo(); await esp(1500);
    document.getElementById('lcEq').innerHTML = '<option>ZZ-1</option>'; document.getElementById('lcEq').value = 'ZZ-1';
    document.getElementById('lcItem').value = 'MOBILTRANS HD 50'; document.getElementById('lcCant').value = '30';
    out.opts = [...document.getElementById('lcItem').options].map((o) => o.value); out.lcval = document.getElementById('lcItem').value;
    S.s('lub', lubs); S.s('mov', mov);
    await saveLubConsumo(); out.toastManual = out.toast;
    out.resumen2 = lubConsumoResumen(S.g('mov'), 'MOBILTRANS HD 50', hoy);
    // pestaña Lubricantes con las columnas nuevas
    const fijo = { eq, lub: S.g('lub'), mov: S.g('mov') }, g0 = S.g.bind(S);
    S.g = (k) => (fijo[k] ? fijo[k].slice() : g0(k));
    if (!document.getElementById('s-lub')) { const d = document.createElement('div'); d.id = 's-lub'; document.body.appendChild(d); }
    await renderLub(); await esp(500);
    const sec = document.getElementById('s-lub');
    const cab = [...sec.querySelectorAll('tr')][0].textContent;
    out.cabecera = ['Sem.', 'Mes', 'Prom.3m'].every((c) => cab.includes(c));
    const fila = [...sec.querySelectorAll('tr')].find((tr) => tr.textContent.includes('Litro') || tr.innerHTML.includes('MOBILTRANS HD 50'));
    out.titMes = [...sec.querySelectorAll('td[title*="OT "]')].map((td) => td.getAttribute('title') + ' => ' + td.textContent);
    return out;
  });
  expect(r.seccion).toBe(true);
  expect(r.unidades).toEqual(['L', 'kg']);
  expect(r.otConError).toBe(0);
  expect(r.toastError).toContain('Aceite / grasa');
  expect(r.solucion).toContain('Aceite: MOBILTRANS HD 50 1000 L');
  expect(r.solucion).toContain('Grasa: MOBILGREASE XHP 322 MINE 2.5 kg');
  expect(r.mov).toEqual([
    { item: 'MOBILTRANS HD 50', cant: 1000, pm: 'OT Correctivo', equipo: 'ZZ-1', ant: 1200, nuevo: 200 },
    { item: 'MOBILGREASE XHP 322 MINE', cant: 2.5, pm: 'OT Correctivo', equipo: 'ZZ-1', ant: 20, nuevo: 17.5 },
  ]);
  expect(r.stock).toEqual([['MOBILTRANS HD 50', 200], ['MOBILGREASE XHP 322 MINE', 17.5]]);
  expect(r.resumen.semana).toBe(1000);
  expect(r.resumen.porOrigenMes.OT).toBe(1000);
  expect(r.toastManual, JSON.stringify([r.opts, r.lcval])).toContain('sumado');
  expect(r.resumen2.semana).toBe(1030);
  expect(r.resumen2.porOrigenMes.Manual).toBe(30);
  expect(r.cabecera).toBe(true);
  expect(r.titMes.join(' ')).toContain('OT 1000');
});
