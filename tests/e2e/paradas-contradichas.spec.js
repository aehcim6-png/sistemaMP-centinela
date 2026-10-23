const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Auditoría de Datos → «Paradas largas que el horómetro contradice» (24-oct-2026): lista las OT de 24 h o más durante las cuales el horómetro avanzó; la persona corrige la fecha de salida
// (y las horas si las sabe). Una salida de servicio abierta se cierra con la fecha indicada. Nada cambia solo; solo administradores.
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
  window._sembrarPar = () => {
    S.s('eq', [{ sigla: 'ZZ-1', tipo: 'Motoniveladora', modelo: 'X', hrsDia: 11 }, { sigla: 'ZZ-2', tipo: 'Camion', modelo: 'X', hrsDia: 12 }]);
    const o = (id, sigla, fecha, extra) => Object.assign({ _id: id, sigla, tipo: 'Correctivo', criticidad: 'Alta', estadoOT: 'Cerrada', fecha, fechaEntrada: fecha, fechaSalida: fecha }, extra);
    S.s('ot', [
      o('p1', 'ZZ-1', '2025-11-12', { fechaSalida: '2025-12-12', duracion: '696h 55min', horom: 8744, sintoma: 'ampolleta foco' }),
      o('a1', 'ZZ-1', '2025-11-13', { duracion: '8h 00min', horom: 8764 }), o('a2', 'ZZ-1', '2025-11-23', { duracion: '1h 00min', horom: 8880 }), o('a3', 'ZZ-1', '2025-12-03', { duracion: '2h 00min', horom: 8947 }),
      o('f1', 'ZZ-2', '2026-05-01', { tipo: 'Fuera de Servicio', estatusEq: 'Fuera de Servicio', estadoOT: 'Pendiente', fechaSalida: null, criticidad: 'Reparación Inmediata', sintoma: 'taller externo' }),
    ]);
    S.s('hist', [
      { _id: 'h1', sigla: 'ZZ-2', fecha: '2026-05-10', horomFin: 500, horom: 500 }, { _id: 'h2', sigla: 'ZZ-2', fecha: '2026-06-20', horomFin: 500, horom: 500 },
      { _id: 'h3', sigla: 'ZZ-2', fecha: '2026-08-10', horomFin: 540, horom: 540 }, { _id: 'h4', sigla: 'ZZ-2', fecha: '2026-08-12', horomFin: 575, horom: 575 },
    ]);
  };
`;

async function abrirAuditoria(page) {
  await page.evaluate(async (datos) => {
    const esp = (ms) => new Promise((x) => setTimeout(x, ms));
    eval(datos);
    window._sembrarPar(); go('audit');
    for (let i = 0; i < 100 && (typeof renders.audit !== 'function' || !document.getElementById('s-audit')); i++) await esp(100);
    for (let k = 0; k < 12; k++) {
      window._sembrarPar(); renders.audit(); await esp(400);
      if (document.getElementById('parDudosas')) break;
    }
  }, DATOS);
}

test('lista la parada de 696 h con el horómetro avanzando y la salida de servicio abierta cuyo equipo ya volvió', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page);
  await abrirAuditoria(page);
  const bloque = page.locator('#parDudosas');
  await expect(bloque).toContainText('Paradas largas que el horómetro contradice (2)', { timeout: 10000 });
  await expect(bloque).toContainText('ZZ-1');
  await expect(bloque).toContainText('error de digitación');
  await expect(bloque).toContainText('abierta');
  await expect(bloque).toContainText('Nada se cambia sin que lo corrijas tú');
  // listar no cambia nada
  const antes = await page.evaluate(() => { window._sembrarPar(); renders.audit(); return (S.g('ot') || []).map((o) => [o._id, o.estadoOT, o.fechaSalida, o.duracion || null].join('|')); });
  expect(antes).toContain('p1|Cerrada|2025-12-12|696h 55min');
  expect(antes).toContain('f1|Pendiente||');
});

test('corregir la parada cerrada: fecha de salida real y horas (o sin duración); cerrar la abierta con la fecha del primer movimiento', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page);
  const respuestas = [];
  page.on('dialog', async (d) => {
    respuestas.push(d.message().split('\n')[0]);
    if (d.type() === 'prompt') {
      // 1er prompt = fecha; 2º (solo en la cerrada) = horas
      const m = d.message();
      if (/Formato AAAA-MM-DD/.test(m)) return d.accept(d.defaultValue());
      return d.accept('3');
    }
    return d.accept();
  });
  await abrirAuditoria(page);
  await expect(page.locator('#parDudosas')).toBeVisible({ timeout: 10000 });
  // se siembra y se actúa en el mismo instante (la carga en segundo plano simulada vacía lo sembrado)
  const r = await page.evaluate(() => {
    const buscar = () => paradasContradichasPorHorometro(S.g('ot'), S.g('hist'), S.g('eq'));
    window._sembrarPar();
    let lista = buscar();
    window.parDudosaCorregir(lista.findIndex((c) => !c.abierta));
    const p1 = (S.g('ot') || []).find((x) => x._id === 'p1');
    const tras = buscar().map((c) => c.sigla + (c.abierta ? ' abierta' : ' cerrada'));
    window._sembrarPar();
    lista = buscar();
    window.parDudosaCorregir(lista.findIndex((c) => c.abierta));
    const f1 = (S.g('ot') || []).find((x) => x._id === 'f1');
    return { n: lista.length, p1: { fechaSalida: p1.fechaSalida, duracion: p1.duracion }, tras, f1: { estadoOT: f1.estadoOT, fechaSalida: f1.fechaSalida, solucion: f1.solucion } };
  });
  expect(r.n).toBe(2);
  expect(r.p1).toEqual({ fechaSalida: '2025-11-12', duracion: '3h 00min' });   // misma fecha de entrada (valor sugerido) y 3 h
  expect(r.tras).toEqual(['ZZ-2 abierta']);                                    // la corregida ya no se lista
  expect(r.f1.estadoOT).toBe('Cerrada');
  expect(r.f1.fechaSalida).toBe('2026-08-10');                                 // primer día en que el horómetro se movió
  expect(r.f1.solucion).toMatch(/Salida de servicio registrada \(\d+ días\)/);
  expect(respuestas.some((m) => /volvió a operar/.test(m))).toBe(true);
});

test('un usuario que no es administrador no ve las paradas dudosas', async ({ page }) => {
  test.setTimeout(90000);
  await entrar(page, 'operador');
  await abrirAuditoria(page).catch(() => {});
  await page.evaluate(async () => { const esp = (ms) => new Promise((x) => setTimeout(x, ms)); go('audit'); await esp(1500); });
  const texto = await page.evaluate(() => (document.getElementById('s-audit') || {}).innerText || '');
  expect(texto).toContain('Auditoría de Datos');
  expect(texto).not.toContain('Paradas largas que el horómetro contradice');
});
