const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Paso 3 «reglas que fuerzan y escalan» (29-oct-2026): pantalla Tareas con vencidas y escaladas, aviso en el Dashboard y falla repetida que no se cierra sin acción con fecha.
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

test('Tareas: cuenta abiertas, vencidas y escaladas, dice a quién se escala y avisa en el Dashboard', async ({ page }) => {
  test.setTimeout(120000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await entrar(page);
  const r = await page.evaluate(async () => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const dia = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    const sembrar = () => {
      S.s('eq', []);
      S.s('tareas', [
        { _id: 't1', clave: 'a', origen: 'pedir_ya', sigla: 'CN-9501', titulo: 'Pedir ya: ALTERNATOR de CN-9501', responsable: 'Comprador', fechaLimite: dia(2), estado: 'Abierta' },
        { _id: 't2', clave: 'b', origen: 'falla_repetida', sigla: 'CN-9500', titulo: 'Falla repetida de Motor en CN-9500: cambiar sello', responsable: 'Carlos Trigo', fechaLimite: dia(-1), estado: 'Abierta' },
        { _id: 't3', clave: 'c', origen: 'manual', sigla: null, titulo: 'Revisar pauta de lubricación', responsable: 'Camilo Santander', fechaLimite: dia(-6), estado: 'Abierta' },
        { _id: 't4', clave: 'd', origen: 'manual', sigla: null, titulo: 'Tarea ya hecha', responsable: 'Carlos Trigo', fechaLimite: dia(-20), estado: 'Hecha' }
      ]);
    };
    go('tareas');
    for (let i = 0; i < 100 && !document.querySelector('#s-tareas'); i++) await esp(100);
    await esp(1500);
    sembrar(); window.renderTareas(true);
    const texto = document.getElementById('s-tareas').innerText;
    sembrar(); window._tareasVista.estado = 'todas'; window.renderTareas(true);
    const todas = document.getElementById('s-tareas').innerText;
    const menu = [...document.querySelectorAll('#nav .nav-grp button')].map((b) => b.getAttribute('title'));
    sembrar(); renderHeader();
    const encabezado = document.getElementById('hs').innerText;
    sembrar(); go('dash');
    for (let i = 0; i < 50 && !document.querySelector('#avisoTareas'); i++) { sembrar(); if (typeof window.renderDash === 'function') window.renderDash(); await esp(150); }
    const aviso = document.getElementById('avisoTareas') ? document.getElementById('avisoTareas').innerText : '';
    return { texto, todas, aviso, menu, encabezado };
  });
  expect(r.texto).toMatch(/Tareas que las reglas obligan a hacer/);
  expect(r.texto).toMatch(/Pedir ya: ALTERNATOR de CN-9501/);
  expect(r.texto).toMatch(/Vencida/);
  expect(r.texto).toMatch(/Escalada/);
  expect(r.texto).toMatch(/José Yáñez/);          // escala a: jefe de taller de la cuadrilla de Carlos Trigo
  expect(r.texto).toMatch(/Javier Cárdenas/);     // y de la de Camilo Santander
  expect(r.texto).not.toMatch(/Tarea ya hecha/);  // «sin cerrar» no muestra lo cerrado
  expect(r.todas).toMatch(/Tarea ya hecha/);
  expect(r.menu).toContain('Tareas');             // pestaña propia del menú (ya no es sub-pestaña de Metas & KPIs)
  expect(r.encabezado).toMatch(/tareas vencidas/i);
  expect(r.aviso).toMatch(/2 tareas vencidas/);
  expect(r.aviso).toMatch(/1 escalada/);
  expect(errores).toEqual([]);
});

test('una falla repetida no se cierra sin causa raíz y una acción con responsable y fecha, y la acción queda como tarea', async ({ page }) => {
  test.setTimeout(120000);
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await entrar(page);
  const r = await page.evaluate(async () => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    const dia = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    window._otSub = window._otSub; go('ot');
    for (let i = 0; i < 100 && !document.querySelector('#s-ot'); i++) await esp(100);
    await esp(2000);
    S.s('eq', [{ sigla: 'CN-1', tipo: 'Camion', modelo: 'X', horomActual: 1000 }]);
    S.s('tareas', []);
    S.s('ot', [
      { _id: 'prev', sigla: 'CN-1', tipo: 'Correctivo', estadoOT: 'Cerrada', fechaEntrada: dia(-30), sintoma: 'Fuga de aceite', componente: 'Motor', causaRaiz: 'sello', costo: 1000, duracion: '2h', motivoDemora: 'Sin demora', reparacion: 'Definitiva' },
      { _id: 'act', sigla: 'CN-1', tipo: 'Correctivo', estadoOT: 'En Ejecución', fechaEntrada: dia(-1), sintoma: 'Fuga de aceite otra vez', componente: 'Motor', causaRaiz: 'sello', costo: 2000, duracion: '2h', motivoDemora: 'Sin demora', reparacion: 'Definitiva' }
    ]);
    window.edOT(1, 'estadoOT', 'Cerrada');
    const dialogo = document.body.innerText;
    const haySinCompletar = /Cerrar sin completar/.test(dialogo);
    // sin acción: no cierra
    window._otCierreGuardar(1, true);
    const estadoTrasIntento = S.g('ot')[1].estadoOT;
    const tareasTrasIntento = (S.g('tareas') || []).length;
    // con la acción: cierra y crea la tarea
    document.getElementById('ocRepAccion').value = 'Cambiar el sello del cárter';
    document.getElementById('ocRepResp').value = 'Carlos Trigo';
    document.getElementById('ocRepFecha').value = dia(5);
    window._otCierreGuardar(1, true);
    const t = (S.g('tareas') || [])[0] || null;
    return { dialogo, haySinCompletar, estadoTrasIntento, tareasTrasIntento, estadoFinal: S.g('ot')[1].estadoOT, tarea: t && { origen: t.origen, responsable: t.responsable, fechaLimite: t.fechaLimite, titulo: t.titulo, sigla: t.sigla }, esperadaFecha: dia(5) };
  });
  expect(r.dialogo).toMatch(/Falla repetida/);
  expect(r.dialogo).toMatch(/No se puede cerrar sin causa raíz y sin una acción con responsable y fecha/);
  expect(r.haySinCompletar).toBe(false);
  expect(r.estadoTrasIntento).not.toBe('Cerrada');
  expect(r.tareasTrasIntento).toBe(0);
  expect(r.estadoFinal).toBe('Cerrada');
  expect(r.tarea).toMatchObject({ origen: 'falla_repetida', responsable: 'Carlos Trigo', sigla: 'CN-1', fechaLimite: r.esperadaFecha });
  expect(r.tarea.titulo).toMatch(/Cambiar el sello del cárter/);
  expect(errores).toEqual([]);
});
