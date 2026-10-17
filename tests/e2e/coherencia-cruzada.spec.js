// Revisión cruzada de coherencia: una misma cifra que aparece en varias pestañas tiene que dar lo mismo en todas.
// Carga la flota real de index.html más datos sintéticos (helpers/datos-coherencia.js), abre cada pantalla como la ve el usuario,
// lee el número que muestra y lo compara con las demás pantallas y con el cálculo de origen. No prueba que el número sea correcto
// (eso lo hacen las pruebas de logic.js); prueba que ninguna pantalla cuente distinto que otra.
const { test, expect } = require('@playwright/test');
const { mockSupabase } = require('./helpers/mock-supabase');
const { construirDatos } = require('./helpers/datos-coherencia');

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

async function entrar(page, D) {
  const TABLAS = {
    equipos: D.equipos, registros_pm: D.registros, historial_horometros: D.historial, correctivos: D.correctivos,
    informes_falla: D.informes, neumaticos: D.neumaticos, stock_filtros: D.stock, lubricantes: D.lubricantes,
  };
  await mockSupabase(page, { loginOk: true, role: 'admin', nombre: 'Admin Test' });
  await page.route(/\/rest\/v1\/([a-z_]+)(\?.*)?$/, (route) => {
    const u = route.request().url(), t = u.match(/\/rest\/v1\/([a-z_]+)/)[1];
    if (route.request().method() === 'GET' && TABLAS[t]) {
      const off = +((u.match(/[?&]offset=(\d+)/) || [])[1] || 0), lim = +((u.match(/[?&]limit=(\d+)/) || [])[1] || 1e9);
      const todo = TABLAS[t], sl = todo.slice(off, off + lim);
      return route.fulfill({ contentType: 'application/json', headers: { 'content-range': (sl.length ? off + '-' + (off + sl.length - 1) : '*') + '/' + todo.length }, body: JSON.stringify(sl) });
    }
    return route.fallback();
  });
  await page.goto('/');
  await page.waitForFunction(() => !!window._turnstileToken);
  await page.locator('#li_email').fill('admin@test.com');
  await page.locator('#li_pass').fill('claveCorrecta123');
  await page.locator('#li_btn').click();
  await expect(page.locator('#s-dash')).toHaveCount(1, { timeout: 30000 });
  await page.waitForFunction(() => { const v = S.g('hist'); return Array.isArray(v) && v.length > 100 && (S.g('ot') || []).length > 0; }, null, { timeout: 30000 });
  await page.waitForTimeout(800);
}

// Va a una pantalla (con su sub-pestaña) y devuelve su texto, con los saltos de línea ya colapsados a un espacio.
async function textoDe(page, id, sub, antes, marca) {
  await page.evaluate(([id, sub]) => { if (sub) window['_' + id + 'Sub'] = sub; window.go(id); }, [id, sub || null]);
  await page.waitForTimeout(1200);
  let t = '';
  // Un redibujado tardío (por ejemplo el que dispara un guardado) puede deshacer el cambio de vista: se reintenta hasta ver la marca.
  for (let i = 0; i < (marca ? 20 : 6); i++) {
    if (antes) { await antes(); await page.waitForTimeout(1200); }
    t = await page.evaluate((id) => document.getElementById('s-' + id).innerText.replace(/\s+/g, ' '), id);
    if (!marca || marca.test(t)) break;
    if (!antes) await page.waitForTimeout(1000); // sin acción previa, esperar a que la pantalla termine de dibujarse (bajo carga tarda)
  }
  return t;
}
const num = (t, re) => { const m = t.match(re); return m ? parseFloat(m[1].replace(/\./g, '').replace(',', '.')) : null; };
const numPunto = (t, re) => { const m = t.match(re); return m ? parseFloat(m[1]) : null; };

test('coherencia cruzada: las cifras repetidas entre pestañas coinciden', async ({ page }) => {
  test.setTimeout(180000);
  const D = construirDatos();
  const errores = []; page.on('pageerror', (e) => errores.push(e.message));
  await entrar(page, D);
  const hoy = new Date();
  const mesActual = MESES[hoy.getMonth()];
  const resultados = [];
  // Cada comparación: nombre, y lista de [fuente, valor]. Coherente si todos los valores no nulos son iguales (con tolerancia).
  const comparar = (nombre, pares, tol) => {
    const vals = pares.filter((p) => p[1] != null && !Number.isNaN(p[1]));
    const faltan = pares.filter((p) => p[1] == null || Number.isNaN(p[1])).map((p) => p[0]);
    const ok = vals.length > 1 && vals.every((p) => Math.abs(p[1] - vals[0][1]) <= (tol || 0));
    resultados.push({ nombre, ok, faltan, detalle: pares.map((p) => p[0] + '=' + p[1]).join(' · ') });
  };

  // ── Verdad de origen (los mismos cálculos de logic.js que usan las pantallas) ──
  const verdad = await page.evaluate(() => {
    const eq = S.g('eq') || [], ot = S.g('ot') || [];
    const todo = ot.concat(_otHistComoOt(S.g('otHist') || []), _informesFallaComoOt(S.g('informesFalla') || []));
    const urg = eq.filter((e) => e.estado && (e.estado.includes('URGENTE') || e.estado.includes('VENCIDA'))).length;
    return {
      equipos: eq.length, urgentes: urg,
      proximas: eq.filter((e) => e.estado && e.estado.includes('PRÓXIMA')).length,
      alDia: eq.filter((e) => e.estado && e.estado.includes('AL DÍA')).length,
      fallas: todo.filter(esFallaMTBF).length, mtbf: mtbfFlotaReal(eq, todo),
      hh: Math.round((S.g('reg') || []).reduce((s, r) => s + (r.duracionH || 0), 0)),
    };
  });
  expect(verdad.fallas, 'el dato de prueba debe traer fallas de OT + informe').toBeGreaterThan(40);

  // ── Estados de equipo: encabezado, Dashboard y Equipos ──
  const hs = await page.evaluate(() => document.getElementById('hs').innerText.replace(/\s+/g, ' '));
  const dash = await textoDe(page, 'dash', null, null, /CUMPLIMIENTO PM.*MTBF REAL DE FLOTA/);
  const eqUrg = await page.evaluate(async () => {
    const cont = async (v) => { document.getElementById('fEst') && (document.getElementById('fEst').value = v); renders.eq(); await new Promise((r) => setTimeout(r, 400)); const s = document.getElementById('fEst'); s.value = v; renders.eq(); await new Promise((r) => setTimeout(r, 400)); return document.querySelectorAll('#s-eq table tr').length - 1; };
    await window.go('eq'); await new Promise((r) => setTimeout(r, 800));
    return { urg: await cont('URGENTE'), venc: await cont('VENCIDA'), prox: await cont('PRÓXIMA'), dia: await cont('AL DÍA') };
  });
  comparar('Equipos URGENTES+VENCIDOS', [['cálculo', verdad.urgentes], ['encabezado', num(hs, /(\d+) URGENTES/)], ['Dashboard', num(dash, /URGENTES (\d+)/)], ['pestaña Equipos', eqUrg.urg + eqUrg.venc]]);
  comparar('Equipos PRÓXIMOS', [['cálculo', verdad.proximas], ['encabezado', num(hs, /(\d+) PRÓXIMAS/)], ['Dashboard', num(dash, /PRÓXIMAS (\d+)/)], ['pestaña Equipos', eqUrg.prox]]);
  comparar('Equipos AL DÍA', [['cálculo', verdad.alDia], ['encabezado', num(hs, /(\d+) AL DÍA/)], ['Dashboard', num(dash, /AL DÍA (\d+)/)], ['pestaña Equipos', eqUrg.dia]]);
  comparar('Total de equipos', [['cálculo', verdad.equipos], ['encabezado', num(hs, /(\d+) EQUIPOS/)], ['Dashboard', num(dash, /FLOTA\S* EN VIVO (\d+)/)]]);

  // ── Ventana "¿cuáles son?": cada número que se puede tocar abre una lista con exactamente esa cantidad de equipos ──
  await page.evaluate(() => window.go('dash')); await page.waitForTimeout(1200);
  const filasVentana = (llamada) => page.evaluate((f) => { new Function(f)(); const n = document.querySelectorAll('#mc table tr').length - 1; cm(); return n < 0 ? 0 : n; }, llamada);
  comparar('Ventana de urgentes (encabezado y Dashboard)', [['cálculo', verdad.urgentes], ['encabezado', await filasVentana("verEquiposGrupo('urg')")], ['Dashboard', await filasVentana("verEquiposDash('urg')")]]);
  comparar('Ventana de próximos (encabezado y Dashboard)', [['cálculo', verdad.proximas], ['encabezado', await filasVentana("verEquiposGrupo('prox')")], ['Dashboard', await filasVentana("verEquiposDash('prox')")]]);
  comparar('Ventana de al día (encabezado y Dashboard)', [['cálculo', verdad.alDia], ['encabezado', await filasVentana("verEquiposGrupo('aldia')")], ['Dashboard', await filasVentana("verEquiposDash('aldia')")]]);
  comparar('Ventana de la flota (encabezado y Dashboard)', [['cálculo', verdad.equipos], ['encabezado', await filasVentana("verEquiposGrupo('todos')")], ['Dashboard', await filasVentana("verEquiposDash('todos')")]]);
  comparar('Ventana de fuera de servicio', [['encabezado', num(hs, /(\d+) FUERA DE SERVICIO/)], ['ventana', await filasVentana("verEquiposGrupo('fs')")]]);
  comparar('Ventana de salud crítica', [['Mapa de Salud', num(dash, /(\d+) 🔴 Crítica/)], ['ventana', await filasVentana("verEquiposDash('s_crit')")]]);

  // ── Acciones agrupadas: los botones que pasan a "Más acciones" siguen existiendo y el menú abre y ejecuta ──
  const acc = await page.evaluate(async () => {
    window.go('ot');
    for (let i = 0; i < 40 && !document.querySelector('#s-ot .mas-acc > button'); i++) await new Promise((r) => setTimeout(r, 500));
    const s = document.getElementById('s-ot'), b = s.querySelector('.mas-acc > button');
    if (!b) return { enMenu: 0, abre: 0, modal: 0 };
    const enMenu = s.querySelectorAll('.mas-acc-m button').length;
    b.click(); const abre = b.closest('.mas-acc').classList.contains('abierto') ? 1 : 0;
    s.querySelector('.mas-acc-m button').click(); const modal = document.getElementById('mbg').classList.contains('show') ? 1 : 0;
    cm(); return { enMenu, abre, modal };
  });
  comparar('Correctivos: "Más acciones" tiene botones, abre y ejecuta', [['botones en el menú (≥2)', acc.enMenu >= 2 ? 1 : 0], ['el menú abre', acc.abre], ['un botón del menú actúa', acc.modal], ['esperado', 1]]);

  // ── Sub-pestañas, Predictivo agrupado y Estadística plegable: nada se perdió al reordenar ──
  const sp = await page.evaluate(async () => {
    const esp = (ms) => new Promise((r) => setTimeout(r, ms));
    const hasta = async (fn) => { for (let i = 0; i < 40 && !fn(); i++) await esp(500); };
    window._comp2Sub = 'pred'; window.go('comp2'); await hasta(() => document.getElementById('fPredVista'));
    const o = document.getElementById('fPredVista');
    const pred = { grupos: o.querySelectorAll('optgroup').length, opciones: o.querySelectorAll('option').length };
    const solapas = document.querySelectorAll('#s-comp2 .subtabs .subtab').length;
    window._comp2Sub = 'estadistica'; window._estadisticaVista = 'componente'; window.go('comp2'); await hasta(() => document.querySelectorAll('#s-estadistica > details.sec-pleg').length >= 2);
    const r = document.getElementById('s-estadistica');
    const pleg = r.querySelectorAll(':scope > details.sec-pleg').length, abiertos = r.querySelectorAll(':scope > details.sec-pleg[open]').length;
    window._estadisticaVista = 'equipo'; // las demás comprobaciones parten de la vista por equipo
    window._mkpiSub = 'metas'; window.go('mkpi'); await hasta(() => document.querySelectorAll('#s-mkpi .subtabs .subtab').length >= 5);
    const metas = [...document.querySelectorAll('#s-mkpi .subtabs .subtab')].map((b) => b.textContent.trim());
    return { pred, solapas, pleg, abiertos, metas };
  });
  comparar('Predictivo: 21 vistas en 6 grupos', [['vistas', sp.pred.opciones], ['esperado', 21]]);
  comparar('Predictivo: grupos', [['grupos', sp.pred.grupos], ['esperado', 6]]);
  comparar('Componentes: 8 sub-pestañas', [['solapas', sp.solapas], ['esperado', 8]]);
  comparar('Estadística por componente: bloques plegables (el primero abierto)', [['plegables ≥ 5', sp.pleg >= 5 ? 1 : 0], ['abiertos', sp.abiertos], ['esperado', 1]]);
  comparar('Metas & KPIs: orden de las sub-pestañas', [['orden correcto', sp.metas.join('|').match(/^Metas\|Avance del Mes\|Informes KPI\|Informe de gestión\|Resumen Ejecutivo$/) ? 1 : 0], ['esperado', 1]]);

  // ── Salud: Torre de Control contra el Mapa de Salud del Dashboard ──
  const torre = await textoDe(page, 'torre', null, null, /INTERVENIR AHORA/); // reintenta hasta que la Torre termine de dibujarse (bajo carga tarda más de 1,2 s)
  comparar('Salud — equipos críticos', [['Torre', num(torre, /(\d+) INTERVENIR AHORA/)], ['Dashboard', num(dash, /(\d+) 🔴 Crítica/)]]);
  comparar('Salud — equipos en atención', [['Torre', num(torre, /(\d+) ATENCIÓN PRÓXIMA/)], ['Dashboard', num(dash, /(\d+) 🟡 Advertencia/)]]);
  comparar('Salud — equipos sanos', [['Torre', num(torre, /(\d+) OPERATIVOS/)], ['Dashboard', num(dash, /(\d+) 🟢 Salud buena/)]]);
  comparar('Salud — sin datos', [['Torre', num(torre, /(\d+) SIN DATOS/)], ['Dashboard', num(dash, /(\d+) ⚪ sin datos/)]]);

  // ── Fallas y MTBF de flota ──
  const kpi = await textoDe(page, 'mkpi', 'kpi', null, /MTBF FLOTA.*CUMPLIMIENTO PM/);
  const cos = await textoDe(page, 'cos', null, async () => { await page.selectOption('#fCosVista', 'mtbf'); }, /TOTAL FALLAS/);
  const cosFila = await page.evaluate(() => {
    const o = {};
    [...document.querySelectorAll('#s-cos table tr')].forEach((tr) => { const c = [...tr.children].map((x) => x.innerText.trim()); if (/^[A-Z]{2}-\d+$/.test(c[0]) && c.length >= 8 && /^\d+$/.test(c[3])) o[c[0]] = { fallas: parseInt(c[3], 10), mtbf: parseInt(String(c[4]).replace(/\./g, ''), 10) }; });
    return o;
  });
  void errores;
  comparar('Fallas totales', [['cálculo (OT + historial + informes)', verdad.fallas], ['Informes KPI', num(kpi, /(\d+) fallas totales/)], ['Costos → MTBF/MTTR', num(cos, /TOTAL FALLAS (\d+)/)]]);
  comparar('MTBF de flota (h)', [['cálculo', verdad.mtbf], ['Dashboard', num(dash, /MTBF REAL DE FLOTA\S* (\d+)h/)], ['Informes KPI', num(kpi, /MTBF FLOTA (\d+) hrs/)], ['Costos → MTBF/MTTR', num(cos, /MTBF PROMEDIO FLOTA (\d+)h/)]]);
  comparar('Horas-hombre acumuladas', [['cálculo', verdad.hh], ['Dashboard', num(dash, /HH ACUMULADAS\S* (\d+)h/)], ['Informes KPI', num(kpi, /Real: (\d+)h/)], ['Costos', num(cos, /HH REALES (\d+)h/) ?? num(await textoDe(page, 'cos', null, async () => { await page.selectOption('#fCosVista', 'costos'); }, /HH REALES/), /HH REALES (\d+)h/)]]);

  // ── MTBF por equipo y fallas por equipo: Estadística contra Costos ──
  const est = await page.evaluate(async () => {
    window._comp2Sub = 'estadistica'; window.go('comp2'); await new Promise((r) => setTimeout(r, 1500));
    return [...document.querySelectorAll('#s-comp2 table tr')].map((tr) => [...tr.children].map((c) => c.innerText.trim()));
  });
  const estFila = {};
  est.forEach((f) => { const m = (f[0] || '').match(/([A-Z]{2}-\d+)/); if (m && f.length >= 7) estFila[m[1]] = { fallas: parseInt(f[2], 10), mtbf: parseInt(String(f[6]).replace(/\./g, ''), 10) }; });
  const comunes = Object.keys(estFila).filter((s) => cosFila[s]);
  expect(comunes.length, 'debe haber equipos con fallas en Estadística y Costos').toBeGreaterThan(3);
  comunes.forEach((s) => {
    comparar('Fallas de ' + s, [['Estadística', estFila[s].fallas], ['Costos', cosFila[s].fallas]]);
    comparar('MTBF de ' + s, [['Estadística', estFila[s].mtbf], ['Costos', cosFila[s].mtbf]], 1);
  });

  // ── Cifras del mes: Dashboard, Informes KPI y Metas ──
  const filaMetas = await page.evaluate(async () => {
    window._mkpiSub = 'metas'; window.go('mkpi'); await new Promise((r) => setTimeout(r, 1500));
    const o = {};
    [...document.querySelectorAll('#s-mkpi table tr')].forEach((tr) => { const c = [...tr.children].map((x) => x.innerText.trim()); if (c.length >= 20 && c[0]) o[c[0]] = c; });
    return o;
  });
  // fila: [indicador, meta anual, (meta, real) × 12 meses] — el real de un mes está en la posición 2 + 2*mes + 1
  const metasReal = (ind, mes) => { const f = Object.keys(filaMetas).find((k) => k.startsWith(ind)); if (!f) return null; const v = filaMetas[f][3 + 2 * mes]; return v === '—' || v == null ? null : parseFloat(v); };
  comparar('Disponibilidad del mes (%)', [['Dashboard', numPunto(dash, /DISPONIBILIDAD MECÁNICA\S* ([\d.]+)%/)], ['Metas', metasReal('Disponibilidad', hoy.getMonth())], ['Informes KPI', numPunto(kpi, /DISPONIBILIDAD MECÁNICA ([\d.]+) %/)]], 0.05);
  const mesesKpi = (nombre) => {
    // en "Informes KPI" cada indicador trae sus meses como "valor MES"; se toman los del año en curso
    const i = kpi.indexOf(nombre); if (i < 0) return {};
    const tramo = kpi.slice(i + nombre.length).split(/DISPONIBILIDAD MECÁNICA|MTBF FLOTA|CUMPLIMIENTO PM|COSTO \/ HORA OPERADA|RATIO PREVENTIVO|EFICIENCIA HH/)[0];
    const o = {}, re = /(—|[\d.]+) (ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)/g; let m, vistos = [];
    while ((m = re.exec(tramo))) vistos.push([m[2], m[1] === '—' ? null : parseFloat(m[1])]);
    const ini = vistos.map((x) => x[0]).lastIndexOf('ENE'); (ini >= 0 ? vistos.slice(ini) : vistos).forEach((x) => { o[x[0]] = x[1]; });
    return o;
  };
  ['MTBF FLOTA', 'RATIO PREVENTIVO', 'CUMPLIMIENTO PM'].forEach((nombre) => {
    const k = mesesKpi(nombre), met = { 'MTBF FLOTA': 'MTBF Mínimo', 'RATIO PREVENTIVO': 'Ratio Preventivo', 'CUMPLIMIENTO PM': 'Cumplimiento PM' }[nombre];
    MESES.forEach((mes, i) => {
      if (k[mes] === undefined) return;
      const real = metasReal(met, i);
      if (real == null && k[mes] == null) return;
      comparar(nombre + ' de ' + mes + ' (Informes KPI contra Metas)', [['Informes KPI', k[mes]], ['Metas', real]], nombre === 'MTBF FLOTA' ? 1 : 0.6);
    });
  });
  // Informe de gestión (secciones III y IV del informe del cliente): mismo % de PM dentro del estándar y mismos equipos fuera de servicio que el resto
  const gest = await textoDe(page, 'mkpi', 'gestion', async () => { await page.evaluate(() => window.gestionPeriodo('mes')); }, /DENTRO DEL ESTÁNDAR/);
  comparar('Equipos fuera de servicio', [['encabezado', num(hs, /(\d+) FUERA DE SERVICIO/)], ['Informe de gestión', num(gest, /IV\. Equipos fuera de servicio \((\d+)\)/)]]);
  comparar('Cumplimiento PM del mes (%)', [['Informe de gestión', numPunto(gest, /DENTRO DEL ESTÁNDAR (\d+)%/)], ['Dashboard', numPunto(dash, /CUMPLIMIENTO PM\S* ([\d.]+)%/)], ['Metas', metasReal('Cumplimiento PM', hoy.getMonth())], ['Informes KPI', mesesKpi('CUMPLIMIENTO PM')[mesActual] ?? null]], 0.6);

  // ── Auditoría de cambios: un cambio real hecho en la app llega al servidor con persona, pestaña y valores; lo que el sistema calcula solo, no ──
  const envios = [];
  await page.route(/\/rest\/v1\/auditoria_cambios/, (route) => {
    if (route.request().method() === 'POST') { try { envios.push(JSON.parse(route.request().postData() || '[]')); } catch (e) { /* ignorar */ } return route.fulfill({ status: 201, body: '' }); }
    return route.fallback();
  });
  const aud = await page.evaluate(async () => {
    window.go('eq'); await new Promise((r) => setTimeout(r, 900));
    const eqs = S.g('eq'), e0 = eqs[0], antes = e0.hrsDia;
    e0.hrsDia = (Number(antes) || 12) + 1;
    e0.estado = 'ESTADO CALCULADO DE PRUEBA'; // lo calcula el sistema: no debe quedar en la auditoría
    S.s('eq', eqs);
    return { sigla: e0.sigla, antes: String(antes), despues: String(e0.hrsDia) };
  });
  for (let i = 0; i < 50 && !envios.flat().some((r) => r.campo === 'hrsDia'); i++) await page.waitForTimeout(500); // el envío va en segundo plano: se espera hasta 25 s, no un tiempo fijo
  await page.waitForTimeout(500);
  const regsAud = envios.flat();
  const delCampo = regsAud.filter((r) => r.campo === 'hrsDia' && r.registro === aud.sigla && r.accion === 'editar' && r.tabla === 'equipos');
  comparar('Auditoría: el cambio de un campo llega con el valor de antes y de después', [['filas del campo editado', delCampo.length], ['valores correctos', delCampo.filter((r) => r.valor_antes === aud.antes && r.valor_despues === aud.despues).length], ['esperado', 1]]);
  comparar('Auditoría: queda la persona y la pestaña', [['persona, rol y pestaña', delCampo.filter((r) => r.usuario_nombre === 'Admin Test' && r.rol === 'admin' && r.pestana === 'Equipos').length], ['esperado', 1]]);
  comparar('Auditoría: los campos que calcula el sistema no se registran', [['filas de "estado"', regsAud.filter((r) => r.campo === 'estado').length], ['esperado', 0]]);
  comparar('Auditoría: todas las filas de un envío traen las mismas columnas', [['envíos con columnas distintas', envios.filter((lote) => new Set(lote.map((r) => Object.keys(r).sort().join(','))).size > 1).length], ['esperado', 0]]);

  const malas = resultados.filter((r) => !r.ok);
  console.log('Comparaciones: ' + resultados.length + ' · coinciden: ' + (resultados.length - malas.length) + ' · NO coinciden: ' + malas.length);
  malas.forEach((r) => console.log('  ✗ ' + r.nombre + ' → ' + r.detalle + (r.faltan.length ? ' (sin dato en: ' + r.faltan.join(', ') + ')' : '')));
  expect(malas.map((r) => r.nombre + ': ' + r.detalle), 'cifras que dan distinto según la pestaña').toEqual([]);
});
