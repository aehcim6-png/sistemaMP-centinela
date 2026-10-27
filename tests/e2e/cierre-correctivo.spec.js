const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');

// Al cerrar un correctivo sin componente, causa raíz o costo se abre una ventana para completarlos (no bloquea).
test('cerrar un correctivo pide componente, causa raíz y costo, y permite cerrar sin completar', async ({ page }) => {
  test.setTimeout(90000);   // con la carga en segundo plano y el equipo ocupado puede tardar
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await expect(page.locator('#li_pass')).toHaveValue('claveCorrecta123', { timeout: 15000 });
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 15000 });

  const r = await page.evaluate(async () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const mk = (id, duracion) => ({ _id: id, sigla: 'ZZ-1', tipo: 'Correctivo', fecha: hoy, sintoma: 'Falla de manguera hidráulica con fuga', estadoOT: 'Pendiente', costo: 0, componente: '', causaRaiz: '', horom: 100, duracion });
    // la carga en segundo plano puede pisar los datos recién puestos: se vuelven a poner si hace falta
    const sembrar = () => { S.s('eq', [{ sigla: 'ZZ-1', tipo: 'Camion', modelo: 'X' }]); S.s('ot', [mk('o1', '30h'), mk('o2', '2h')]); };
    sembrar();
    go('ot');
    for (let i = 0; i < 100 && !document.querySelector('#s-ot table'); i++) await new Promise(x => setTimeout(x, 100));
    const out = {};
    // 1) cerrar el primero → aparece la ventana, con el componente sugerido desde el texto
    for (let k = 0; k < 6; k++) {
      sembrar(); await new Promise(x => setTimeout(x, 300));
      await edOT(0, 'estadoOT', 'Cerrada');
      for (let i = 0; i < 20 && !document.getElementById('ocCausa'); i++) await new Promise(x => setTimeout(x, 100));
      if (document.getElementById('ocCausa')) break;
    }
    out.modalAbierto = !!document.getElementById('ocComp');
    out.sugerido = (document.getElementById('ocComp') || {}).value;
    out.antes = (S.g('ot')[0] || {}).estadoOT;
    document.getElementById('ocCausa').value = 'Desgaste normal';
    document.getElementById('ocCosto').value = '125000';
    // 1b) la primera duró 30 h: sin elegir el motivo de demora ni el tipo de reparación no cierra
    const toasts = []; const t0 = window.toast; window.toast = (m) => { toasts.push(String(m)); };
    await _otCierreGuardar(0, true);
    out.sinElegir = { estado: (S.g('ot')[0] || {}).estadoOT, aviso: toasts[toasts.length - 1] };
    document.getElementById('ocMotivo').value = 'Compra o aprobación interna lenta';
    await _otCierreGuardar(0, true);
    out.sinReparacion = { estado: (S.g('ot')[0] || {}).estadoOT, aviso: toasts[toasts.length - 1] };
    document.getElementById('ocRep').value = 'Provisoria';
    await _otCierreGuardar(0, true);
    window.toast = t0;
    const a = S.g('ot')[0];
    out.cerrado1 = { estado: a.estadoOT, comp: a.componente, causa: a.causaRaiz, costo: a.costo, motivo: a.motivoDemora, rep: a.reparacion };
    out.backlog = (S.g('backlogPM') || []).map((b) => ({ sigla: b.sigla, tarea: b.tarea, conInsumo: b.conInsumo }));
    // 2) cerrar el segundo sin completar → cierra igual, sin datos
    for (let k = 0; k < 6 && !document.getElementById('ocComp'); k++) {
      await edOT(1, 'estadoOT', 'Cerrada');
      for (let i = 0; i < 20 && !document.getElementById('ocComp'); i++) await new Promise(x => setTimeout(x, 100));
    }
    await _otCierreGuardar(1, false);
    const b = S.g('ot')[1];
    out.cerrado2 = { estado: b.estadoOT, comp: b.componente, costo: b.costo, motivo: b.motivoDemora, rep: b.reparacion };
    return out;
  });
  expect(r.modalAbierto).toBe(true);
  expect(r.sugerido).not.toBe('');           // sugerido desde el texto del síntoma
  expect(r.antes).toBe('Pendiente');         // no se cerró hasta confirmar
  expect(r.cerrado1.estado).toBe('Cerrada');
  expect(r.cerrado1.comp).not.toBe('');
  expect(r.cerrado1.causa).toBe('Desgaste normal');
  expect(r.cerrado1.costo).toBe(125000);
  expect(r.sinElegir.estado).toBe('Pendiente');                              // el motivo es obligatorio
  expect(r.sinElegir.aviso).toContain('motivo de demora');
  expect(r.sinReparacion.estado).toBe('Pendiente');                          // el tipo de reparación también
  expect(r.sinReparacion.aviso).toContain('definitiva o provisoria');
  expect(r.cerrado1.motivo).toBe('Compra o aprobación interna lenta');
  expect(r.cerrado1.rep).toBe('Provisoria');
  expect(r.backlog).toEqual([{ sigla: 'ZZ-1', tarea: 'Reparación definitiva pendiente: Falla de manguera hidráulica con fuga', conInsumo: true }]);   // la provisoria deja su tarea en el backlog
  expect(r.cerrado2.estado).toBe('Cerrada'); // «cerrar sin completar» no bloquea
  expect(r.cerrado2.costo).toBe(0);
  expect(r.cerrado2.motivo).toBe('Sin demora');                              // la segunda duró 2 h: sin motivo queda «Sin demora»
  expect(r.cerrado2.rep).toBe('Sin informar');                               // lo no informado queda anotado, no en blanco
});
