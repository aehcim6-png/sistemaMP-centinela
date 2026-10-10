// Pestaña "TBO Komatsu" (sub-pestaña de Componentes, 2026-10) — el plan de cambio por horas del fabricante
// (TBO_Besalco_Mineria_jun_24.xlsm) cruzado contra las compras reales de TODA la flota. Responde: ¿qué
// componentes dice Komatsu que se cambien y a qué horas?, ¿cuánto se gasta en eso (original Komatsu vs otros
// proveedores)?, ¿cuánto del gasto NO está en el plan (desgaste, rodado, servicios…)? y ¿qué se pagó de verdad
// por los repuestos del listado "Sugerido" (precios en USD)?
//
// OJO (decisión consciente): los "N° de cambios" del Excel son TEÓRICOS (horómetro ÷ TBO) — el archivo no trae
// historial real de cambios. Acá se recalculan con el horómetro vivo y se rotulan como teóricos. La lógica
// vive en logic.js (tbo*) y está cubierta por tests/tboKomatsu.test.js. Módulo ES lazy (ver _LAZY_VERS).
const _TBO_TASA_KEY = 'tboTasaUSD';
function _tboTasa() {
  try { var v = parseFloat(localStorage.getItem(_TBO_TASA_KEY)); if (v > 0) return v; } catch (e) { /* sin storage: usa el default */ }
  return 910; // mismo valor referencial que ya usa importarRepuestosKomatsu (no es un tipo de cambio oficial)
}
var _TBO_OPT_KEYS = { costoDet: 'tboCostoDet', horasFalla: 'tboHorasFalla', horasProg: 'tboHorasProg', hhCambio: 'tboHHCambio' };
function _tboParamOpt(k, def) {
  try { var v = parseFloat(localStorage.getItem(_TBO_OPT_KEYS[k])); if (v >= 0) return v; } catch (e) { /* sin storage: default */ }
  return def;
}
var _TBO_APLIC_KEY = 'tboAplic';
function _tboAplic() {
  try { var v = localStorage.getItem(_TBO_APLIC_KEY); if (TBO_APLICACION[v]) return v; } catch (e) { /* sin storage: normal */ }
  return 'normal'; // el Excel de Komatsu viene calculado en aplicación Normal
}
var _TBO_APLIC_TXT = { ligera: 'Ligera (TBO × 1,2)', normal: 'Normal (TBO × 1,0)', severa: 'Severa (TBO × 0,8)' };
var _TBO_COL_PROB = { 1: 'var(--ok)', 2: 'var(--tx2)', 3: 'var(--w)', 4: '#f97316', 5: 'var(--danger)' };
function _tboPct(r) { return r <= 0.05 + 1e-9 ? '≤ 5%' : Math.round(r * 100) + '%'; }
function _tboPeso(n) { return '$' + fn(Math.round(n || 0)); }
// Millones con 1 decimal. Usa fn() (única fuente de formato numérico, ver tests/consolidacionMttrYFormato): la
// parte entera con separador de miles y el decimal aparte.
function _tboMM(n) { var t = Math.round((n || 0) / 1e5); return '$' + fn(Math.floor(t / 10)) + ',' + (t % 10) + ' M'; }
function _tboHoras(f) { return f ? (f.min === f.max ? fn(f.min) + ' h' : fn(f.min) + '–' + fn(f.max) + ' h') : '—'; }

var _tboPlanFilas = []; // filas del plan de compras mostrado (el botón "Crear OC" usa su índice)
var _TBO_NIVEL = {
  vencido: ['🔴 Vencido', 'var(--danger)'],
  planificar: ['🟡 Planificar', 'var(--w)'],
  monitorear: ['📋 Monitorear', 'var(--tx2)'],
  ok: ['🟢 Al día', 'var(--ok)']
};
var _TBO_ORIGEN = { original: 'Original', alternativo: 'Alternativo / reparado', 'sin dato': 'Sin dato de origen', '': '—' };
function _tboDias(d) { return d <= 0 ? 'ya' : d < 60 ? d + ' días' : (Math.round(d / 30.4 * 10) / 10 + '').replace('.', ',') + ' meses'; }
function _tboUSD(n) { return 'US$' + fn(Math.round(n)); }
// Texto de precios de un ítem: lista Komatsu (USD, solo camión) + lo pagado, separado original / otros.
function _tboPrecioHTML(p) {
  if (!p || (!p.usd && !p.n)) return '<span style="color:var(--tx3)">sin precio</span>';
  var l = [];
  if (p.usd) l.push('Lista Komatsu: <b>' + _tboUSD(p.usd) + '</b>' + (p.clpRef ? ' ≈ ' + _tboPeso(p.clpRef) : ''));
  if (p.original.n) l.push('Original pagado: <b>' + _tboPeso(p.original.mediana) + '</b> (' + p.original.n + ')');
  if (p.otros.n) l.push('Alternativo/otros: <b>' + _tboPeso(p.otros.mediana) + '</b> (' + p.otros.n + ')');
  return l.join('<br>');
}
function _tboFilasFamilia(res, defs, equipoSel, clase, cantEq) {
  var filas = '';
  defs.forEach(function (d) {
    var r = res.familias[d[0]];
    var tbo = '';
    if (clase) tbo = _tboHoras(tboFamiliaDeClase(clase, d[0]));
    else {
      var min = Infinity, max = 0;
      ['camion', 'cargador', 'bulldozer'].forEach(function (k) { var f = tboFamiliaDeClase(k, d[0]); if (f) { min = Math.min(min, f.min); max = Math.max(max, f.max); } });
      tbo = max ? _tboHoras({ min: min, max: max }) : '—';
    }
    var prov = r ? Object.keys(r.proveedores).sort(function (a, b) { return r.proveedores[b] - r.proveedores[a]; }).slice(0, 2).map(function (p) { return escapeHtml(p.slice(0, 22)); }).join(', ') : '';
    var pctOrig = r && r.gasto > 0 ? Math.round(100 * r.gastoOriginal / r.gasto) : null;
    var nEq = r ? Object.keys(r.porEquipo).length : 0;
    filas += '<tr' + (r ? '' : ' style="opacity:.5"') + '>' +
      '<td style="font-weight:600">' + escapeHtml(d[1]) + '</td>' +
      (d.enTBO === false ? '' : '<td class="mono" style="font-size:11px">' + tbo + '</td>') +
      '<td class="mono" style="text-align:right">' + (r ? fn(r.lineas) : '0') + '</td>' +
      '<td class="mono" style="text-align:right;color:var(--ac)">' + (r ? _tboMM(r.gasto) : '—') + '</td>' +
      '<td class="mono" style="text-align:right">' + (r ? _tboMM(r.gastoOriginal) : '—') + '</td>' +
      '<td class="mono" style="text-align:right">' + (r ? _tboMM(r.gastoOtros) : '—') + '</td>' +
      '<td class="mono" style="text-align:right;' + (pctOrig !== null && pctOrig < 20 ? 'color:var(--warn)' : '') + '">' + (pctOrig === null ? '—' : pctOrig + '%') + '</td>' +
      '<td class="mono" style="text-align:right">' + (r && nEq > 1 ? _tboMM(r.gasto / nEq) : '—') + '</td>' +
      '<td style="font-size:10px;color:var(--tx3)">' + (prov || '—') + '</td></tr>';
  });
  return filas;
}

export function renderTbo() {
  var el = $('s-tbo'); if (!el) return;
  var eqs = S.g('eq') || [];
  var selPrev = $('tboEq') ? $('tboEq').value : '';
  var vistaPrev = $('tboNivel') ? $('tboNivel').value : 'urgente';
  var tasa = _tboTasa();
  var aplic = _tboAplic();
  var compras = tboUnirCompras(S.g('ocHist') || [], S.g('comprasDetalle') || []);
  var compHist = S.g('compHist') || [], compMay = S.g('compMayores') || [];
  var eqSel = selPrev ? eqs.find(function (e) { return e.sigla === selPrev; }) : null;
  var res = tboCruzarCompras(compras, eqs, eqSel ? [eqSel.sigla] : null);
  var claseSel = eqSel && tboClaseModelo(eqSel.modelo) ? tboClaseModelo(eqSel.modelo).clase : null;
  var conPlan = eqs.filter(function (e) { return tboClaseModelo(e.modelo); }).length;
  var tot = res.totales;
  var pctTBO = tot.gasto > 0 ? Math.round(100 * tot.gastoTBO / tot.gasto) : 0;
  var sinCompras = tot.lineas === 0;

  // Estado de cada cambio (qué toca y cuánto falta) — toda la flota, o solo el equipo elegido.
  var estadoTodo = tboEstadoFlota(eqs, compHist, compMay, new Date(), aplic);
  var estado = eqSel ? estadoTodo.filter(function (x) { return x.sigla === eqSel.sigla; }) : estadoTodo;
  var al = tboResumenAlertas(estado);
  var pctOrigTBO = (function () {
    var tb = 0, og = 0; TBO_FAMILIAS.forEach(function (f) { var r = res.familias[f[0]]; if (r) { tb += r.gasto; og += r.gastoOriginal; } });
    return tb > 0 ? Math.round(100 * og / tb) : 0;
  })();

  var opts = '<option value="">Todos los equipos (' + eqs.length + ')</option>' + eqs.slice().sort(function (a, b) { return String(a.sigla).localeCompare(String(b.sigla)); }).map(function (e) {
    var cl = tboClaseModelo(e.modelo);
    return '<option value="' + escapeHtml(e.sigla) + '"' + (e.sigla === selPrev ? ' selected' : '') + '>' + escapeHtml(e.sigla) + ' — ' + escapeHtml(e.modelo || '') + (cl ? '' : ' (sin plan TBO)') + '</option>';
  }).join('');

  var h = '<div class="sec-h"><div><div class="sec-t">TBO Komatsu — qué cambiar, cuándo y a qué costo</div>' +
    '<div class="sec-s">Plan de cambio por horas del fabricante cruzado con tus cambios reales, tus compras y el historial de componentes</div></div></div>' +
    '<div class="card" style="margin-bottom:12px;font-size:11px;color:var(--tx2);line-height:1.55">' +
    '<b>Cómo leerlo.</b> El TBO es la vida de un componente <b>original nuevo</b>; con repuestos alternativos o reparados puede durar menos, y también depende de la operación y el mantenimiento. ' +
    'Cuando hay un <b>cambio registrado</b> (Historial de Componentes / Componentes Mayores) el tiempo que falta se cuenta desde ese cambio. Sin ese dato se usa el <b>plan teórico</b> del Excel (próximo múltiplo del TBO), que nunca se marca como vencido porque no sabemos si el cambio se hizo. ' +
    'El origen sale del campo "Origen" del historial; si está vacío se infiere por el proveedor de la compra (<b>Komatsu Chile = original</b>, otro = alternativo) — es una aproximación. ' +
    'Las compras se cruzan <b>por descripción</b> (los pedidos no traen N° de parte y el texto viene cortado a ~25 caracteres).' +
    '</div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px">' +
    '<select id="tboEq" onchange="renders.tbo()" style="max-width:340px">' + opts + '</select>' +
    '<label style="font-size:11px;color:var(--tx3)">USD→CLP <input id="tboTasa" type="number" min="1" step="1" value="' + tasa + '" style="width:80px" onchange="tboCambiarTasa(this.value)"></label>' +
    '<span style="font-size:10px;color:var(--tx3)">Referencial (no oficial), solo para valorizar el listado "Sugerido" en pesos.</span>' +
    '<label style="font-size:11px;color:var(--tx3)" title="El TBO de aplicación = TBO de fábrica × 120% (ligera) / 100% (normal) / 80% (severa), igual que la macro del Excel de Komatsu">Aplicación <select id="tboAplic" onchange="tboCambiarAplic(this.value)">' +
    ['ligera', 'normal', 'severa'].map(function (k) { return '<option value="' + k + '"' + (k === aplic ? ' selected' : '') + '>' + _TBO_APLIC_TXT[k] + '</option>'; }).join('') + '</select></label></div>' +
    '<details style="margin-bottom:12px;font-size:11px;color:var(--tx2)"><summary style="cursor:pointer;color:var(--ac)">¿Cuándo un trabajo es ligero, normal o severo? (guía del Excel de Komatsu)</summary>' +
    '<div class="tbl-wrap" style="margin-top:6px"><table style="font-size:10px"><tr><th>Máquina</th><th>Ligera (TBO × 1,2)</th><th>Normal (TBO × 1,0)</th><th>Severa (TBO × 0,8)</th></tr>' +
    Object.keys(TBO_GUIA_APLICACION).map(function (k) { var g = TBO_GUIA_APLICACION[k]; return '<tr><td style="font-weight:600">' + escapeHtml(g[0]) + '</td>' + g[1].map(function (t) { return '<td style="white-space:normal">' + escapeHtml(t) + '</td>'; }).join('') + '</tr>'; }).join('') +
    '</table></div><div style="margin-top:4px;color:var(--tx3)">El ajuste es global (todos los equipos). Si la mayoría de tus camiones trabaja en pendientes sobre 10% y con traslados largos, la aplicación es severa y el TBO baja a 80%.</div></details>';

  h += '<div class="cards">' +
    '<div class="card"><div class="card-t">🔴 Vencidos</div><div class="card-v" style="color:' + (al.vencidos ? 'var(--danger)' : 'var(--ok)') + '">' + fn(al.vencidos) + '</div><div class="card-s">pasaron su TBO desde el último cambio registrado</div></div>' +
    '<div class="card"><div class="card-t">🟡 Planificar</div><div class="card-v" style="color:' + (al.planificar ? 'var(--w)' : 'var(--ok)') + '">' + fn(al.planificar) + '</div><div class="card-s">a menos de 1.000 h del cambio (plan teórico: 500 h)</div></div>' +
    '<div class="card"><div class="card-t">Con cambio registrado</div><div class="card-v">' + fn(al.conDato) + ' / ' + fn(al.total) + '</div><div class="card-s">ítems con último cambio conocido; el resto es plan teórico</div></div>' +
    '<div class="card"><div class="card-t">Gasto analizado</div><div class="card-v" style="color:var(--ac)">' + _tboMM(tot.gasto) + '</div><div class="card-s">' + pctTBO + '% dentro del plan TBO · ' + pctOrigTBO + '% de eso a Komatsu</div></div>' +
    '<div class="card"><div class="card-t">Equipos con plan TBO</div><div class="card-v">' + conPlan + ' / ' + eqs.length + '</div><div class="card-s">HD785-7, WA900-8R, D375A-6R y D65EX (aprox.)</div></div>' +
    '</div>';

  // ── Qué toca cambiar ──
  var nombreFam = {}; TBO_FAMILIAS.forEach(function (f) { nombreFam[f[0]] = f[1]; });
  var cache = {};
  var siglasDe = function (cl) { return eqs.filter(function (e) { var c = tboClaseModelo(e.modelo); return c && c.clase === cl; }).map(function (e) { return e.sigla; }); };
  var precioDe = function (it) { var k = it.item + '|' + it.clase; return cache[k] || (cache[k] = tboPrecioItem(it.item, it.clase, compras, siglasDe(it.clase), tasa)); };
  var lim = vistaPrev === 'todo' ? 100000 : vistaPrev === '2000' ? 2000 : 1000;
  var lista = estado.filter(function (x) { return vistaPrev === 'todo' || x.restantesH < lim; }).sort(function (a, b) { return a.restantesH - b.restantesH; });
  var MAX = eqSel ? 1000 : 150;
  h += '<div class="card-t" style="margin:16px 0 6px">Qué toca cambiar y cuánto falta' + (eqSel ? ' · ' + escapeHtml(eqSel.sigla) : ' · toda la flota') + '</div>' +
    '<div style="display:flex;gap:10px;align-items:center;margin-bottom:6px;flex-wrap:wrap"><select id="tboNivel" onchange="renders.tbo()">' +
    [['urgente', 'Vencidos y a menos de 1.000 h'], ['2000', 'Hasta 2.000 h'], ['todo', 'Todo el plan (' + fn(estado.length) + ' ítems)']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === vistaPrev ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
    '</select><span style="font-size:10px;color:var(--tx3)">' + fn(lista.length) + ' ítems' + (lista.length > MAX ? ' · se muestran los ' + fn(MAX) + ' más urgentes' : '') + '</span></div>' +
    '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Equipo</th><th>Ítem (como en el Excel)</th><th>Familia</th><th style="text-align:right">TBO</th><th style="text-align:right" title="Horas de horómetro desde el último cambio conocido (o desde el último múltiplo del TBO si no hay dato)">Desde el cambio</th><th style="text-align:right">Faltan</th><th style="text-align:right" title="Probabilidad de falla acumulada con las horas desde el último cambio (Weibull β=3, el TBO es el 5% — misma tabla del Excel). Pasá el mouse para ver la probabilidad en las próximas 500 h.">Riesgo</th><th style="text-align:right" title="Con las horas/día del equipo">En</th><th>Fecha est.</th><th>Último cambio</th><th>Estado</th><th>Precio</th></tr>' +
    (lista.slice(0, MAX).map(function (x) {
      var nv = _TBO_NIVEL[x.nivel], p = precioDe(x);
      return '<tr><td class="mono" style="color:var(--ac)">' + escapeHtml(x.sigla) + '</td><td style="font-size:10px">' + escapeHtml(x.item) + '</td><td style="font-size:10px">' + escapeHtml(nombreFam[x.fam] || x.fam) + '</td>' +
        '<td class="mono" style="text-align:right">' + fn(x.tbo) + ' h</td><td class="mono" style="text-align:right">' + fn(x.desdeH) + ' h</td>' +
        '<td class="mono" style="text-align:right;color:' + nv[1] + ';font-weight:700">' + (x.restantesH <= 0 ? '−' + fn(-x.restantesH) : fn(x.restantesH)) + ' h</td>' +
        '<td class="mono" style="text-align:right;font-weight:700;color:' + _TBO_COL_PROB[x.prob] + '" title="Próximas 500 h: ' + _tboPct(x.riesgo500) + '">' + _tboPct(x.riesgo) + '</td>' +
        '<td class="mono" style="text-align:right">' + _tboDias(x.dias) + '</td><td class="mono">' + escapeHtml(x.fechaProx) + '</td>' +
        '<td style="font-size:10px">' + escapeHtml(x.fuente) + (x.origenUlt ? ' · <b>' + escapeHtml(_TBO_ORIGEN[x.origenUlt]) + '</b>' : '') + (x.fechaUlt ? '<br>' + escapeHtml(x.fechaUlt) : '') + '</td>' +
        '<td style="color:' + nv[1] + ';font-size:10px;white-space:nowrap">' + nv[0] + (x.conDato ? '' : ' <span style="color:var(--tx3)">(teórico)</span>') + '</td>' +
        '<td style="font-size:10px;line-height:1.4">' + _tboPrecioHTML(p) + '</td></tr>';
    }).join('') || '<tr><td colspan="12" style="text-align:center;color:var(--tx3);padding:14px">Nada vencido ni cerca de su TBO con los datos actuales.</td></tr>') +
    '</table></div>' +
    '<p style="font-size:10px;color:var(--tx3);margin:4px 0 0">Para que "Faltan" sea real y no teórico, registrá cada cambio en Componentes → Historial de Componentes (con horómetro y <b>origen</b>: original o alternativo).</p>';

  // ── Plan de compra: TBO × Stock × Compras ──
  var incTeo = $('tboTeorico') ? $('tboTeorico').checked : false;
  var plan = tboPlanCompras(estado, { hoy: new Date(), equipos: eqs, compras: compras, comprasDetalle: S.g('comprasDetalle') || [], stk: S.g('stk') || [], repuestos: S.g('repuestos') || [], ordenes: S.g('ordenes') || [], tasa: tasa }, { incluirTeorico: incTeo });
  _tboPlanFilas = plan.filas.slice(0, 120);
  var pt = plan.totales;
  var _DEC = { pedir_ya: ['🔴 Pedir ya', 'var(--danger)'], planificar: ['🟡 Planificar pedido', 'var(--w)'], en_camino: ['📦 En camino', 'var(--ac)'], cubierto: ['✅ Hay stock', 'var(--ok)'], no_urgente: ['⚪ No urgente', 'var(--tx3)'] };
  h += '<div class="card-t" style="margin:18px 0 6px">Plan de compra — ¿alcanzamos a tener el repuesto antes del cambio?' + (eqSel ? ' · ' + escapeHtml(eqSel.sigla) : '') + '</div>' +
    '<div class="cards">' +
    '<div class="card"><div class="card-t">🔴 Pedir ya</div><div class="card-v" style="color:' + (pt.pedir_ya ? 'var(--danger)' : 'var(--ok)') + '">' + fn(pt.pedir_ya) + '</div><div class="card-s">' + (pt.presupuestoPedirYa ? _tboMM(pt.presupuestoPedirYa) + ' estimados' : 'el cambio llega antes que el repuesto') + '</div></div>' +
    '<div class="card"><div class="card-t">🟡 Planificar</div><div class="card-v" style="color:' + (pt.planificar ? 'var(--w)' : 'var(--ok)') + '">' + fn(pt.planificar) + '</div><div class="card-s">' + (pt.presupuestoPlanificar ? _tboMM(pt.presupuestoPlanificar) + ' · ' : '') + 'pedir en las próximas semanas</div></div>' +
    '<div class="card"><div class="card-t">✅ Cubiertos</div><div class="card-v">' + fn(pt.cubierto + pt.en_camino) + '</div><div class="card-s">' + fn(pt.cubierto) + ' con stock · ' + fn(pt.en_camino) + ' con pedido en curso</div></div>' +
    '<div class="card"><div class="card-t">Sin precio</div><div class="card-v">' + fn(pt.sinPrecio) + '</div><div class="card-s">de los que hay que pedir: no hay precio de referencia</div></div>' +
    '</div>' +
    '<label style="font-size:11px;color:var(--tx3);display:block;margin:4px 0 6px"><input id="tboTeorico" type="checkbox" ' + (incTeo ? 'checked ' : '') + 'onchange="renders.tbo()"> Incluir el plan teórico (' + fn(plan.omitidosTeoricos) + ' ítems sin cambio registrado que ' + (incTeo ? 'ya se incluyen' : 'quedan afuera') + ')</label>' +
    '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Equipo</th><th>Ítem</th><th style="text-align:right">Cambio en</th><th style="text-align:right" title="Días que tarda en llegar este repuesto: mediana de los pedidos ya recibidos (tiempo de respuesta real de Compras). Debajo, el percentil 90 (en 9 de cada 10 pedidos llega antes) según una Gamma ajustada.">Tarda en llegar</th><th style="text-align:right" title="Probabilidad de que el repuesto llegue antes del cambio si se pidiera hoy (Gamma ajustada a los tiempos de entrega reales)">Llega a tiempo</th><th>Pedir antes del</th><th style="text-align:right" title="Stock en bodega y repuestos críticos que sirven a este equipo (por N° de parte o por descripción). No se suman las dos fuentes.">Stock</th><th>Pedido abierto</th><th>Qué hacer</th><th style="text-align:right" title="Precio típico × cantidad por cambio">Costo est.</th><th></th></tr>' +
    (_tboPlanFilas.map(function (f, i) {
      var dc = _DEC[f.decision];
      var ped = f.pedidos.length ? f.pedidos.slice(0, 2).map(function (p) { return escapeHtml(p.estado) + (p.dias != null ? ' · ' + p.dias + ' d' : '') + '<br><span style="color:var(--tx3)">' + escapeHtml(String(p.proveedor || '').slice(0, 18)) + '</span>'; }).join('<br>') : '<span style="color:var(--tx3)">—</span>';
      var stTxt = f.stock.unidades ? '<b>' + fn(f.stock.unidades) + '</b>' + (f.stock.pendiente ? ' <span style="color:var(--tx3)">(+' + fn(f.stock.pendiente) + ' pend.)</span>' : '') : '<span style="color:var(--tx3)">0' + (f.stock.filas ? '' : ' (sin registro)') + '</span>';
      var puede = (f.decision === 'pedir_ya' || f.decision === 'planificar') ? '<button class="btn-s" style="font-size:10px" onclick="crearOCDesdeTBO(' + i + ')" title="Crea una orden de compra Pendiente en Compras con este repuesto">🛒 Crear OC</button>' : '';
      return '<tr><td class="mono" style="color:var(--ac)">' + escapeHtml(f.sigla) + '</td><td style="font-size:10px">' + escapeHtml(f.item) + (f.cant > 1 ? ' <span style="color:var(--tx3)">× ' + f.cant + '</span>' : '') + '</td>' +
        '<td class="mono" style="text-align:right">' + (f.dias <= 0 ? 'ya' : fn(f.dias) + ' d') + '<div style="font-size:9px;color:var(--tx3)">' + escapeHtml(f.fechaProx) + '</div></td>' +
        '<td class="mono" style="text-align:right" title="' + escapeHtml(f.lead.fuente) + '">' + fn(f.lead.dias) + ' d' + (f.lead.p90 ? '<div style="font-size:9px;color:var(--tx3)">p90: ' + fn(f.lead.p90) + ' d</div>' : '') + '</td>' +
        '<td class="mono" style="text-align:right;font-weight:700;color:' + (f.probATiempo == null ? 'var(--tx3)' : f.probATiempo >= 0.9 ? 'var(--ok)' : f.probATiempo >= 0.5 ? 'var(--w)' : 'var(--danger)') + '">' + (f.probATiempo == null ? '—' : Math.round(f.probATiempo * 100) + '%') + '</td>' +
        '<td class="mono" style="color:' + (f.diasParaPedir <= 0 ? 'var(--danger)' : 'inherit') + '">' + (f.diasParaPedir <= 0 ? 'ya (' + fn(-f.diasParaPedir) + ' d tarde)' : escapeHtml(f.pedirAntesDe || '—')) + '</td>' +
        '<td class="mono" style="text-align:right">' + stTxt + '</td><td style="font-size:10px;line-height:1.4">' + ped + '</td>' +
        '<td style="color:' + dc[1] + ';font-weight:700;white-space:nowrap;font-size:10px">' + dc[0] + '</td>' +
        '<td class="mono" style="text-align:right">' + (f.costoEst ? _tboPeso(f.costoEst) : '<span style="color:var(--tx3)">sin precio</span>') + '</td><td>' + puede + '</td></tr>';
    }).join('') || '<tr><td colspan="11" style="text-align:center;color:var(--tx3);padding:14px">Ningún cambio con repuesto por pedir en el horizonte (tiempo de entrega + 7 días de colchón + 90 días).</td></tr>') +
    '</table></div>' +
    '<p style="font-size:10px;color:var(--tx3);margin:4px 0 0">Regla: <b>Pedir ya</b> = sin stock ni pedido abierto y el cambio llega antes que el <b>percentil 90</b> del tiempo de entrega (es decir, pidiendo hoy hay menos de 90% de probabilidad de tenerlo a tiempo); <b>Planificar</b> = hasta 45 días más; se muestra lo que cambia dentro de ese plazo + 90 días. El tiempo de entrega sale de los pedidos reales ya recibidos de ese tipo de repuesto y se ajusta con una distribución <b>Gamma</b> (≥5 pedidos; con menos se usa la de todos los pedidos; sin historial, mediana + 7 días con un default de 34). El stock se cruza por N° de parte (listado Sugerido) o por descripción. "Crear OC" deja una orden Pendiente en Compras; no se compra nada solo.</p>';

  // ── Matriz de riesgo (probabilidad Weibull × impacto por precio) ──
  var precioCLP = function (x) { var p = precioDe(x); return p.original.mediana || p.mediana || p.clpRef || null; };
  var mx = tboMatrizRiesgo(estado, precioCLP);
  var nomProb = { 5: 'Muy alta (≥35%)', 4: 'Alta (20–35%)', 3: 'Media (10–20%)', 2: 'Baja (5–10%)', 1: 'Muy baja (≤5%)' };
  h += '<div class="card-t" style="margin:18px 0 6px">Matriz de riesgo — probabilidad de falla × impacto en costo (solo cambios con último cambio conocido)</div>';
  if (!mx.items.length) h += '<div class="card" style="color:var(--tx3);font-size:12px">Todavía no hay componentes con último cambio registrado en ' + (eqSel ? escapeHtml(eqSel.sigla) : 'la flota') + ': el resto es plan teórico y por construcción está dentro del TBO. Registrá los cambios en Historial de Componentes.</div>';
  else {
    h += '<div class="tbl-wrap"><table style="font-size:11px;text-align:center"><tr><th style="text-align:left">Probabilidad ↓ / Impacto →</th>' + [1, 2, 3, 4, 5].map(function (i) { return '<th>' + i + (i === 1 ? ' (bajo)' : i === 5 ? ' (alto)' : '') + '</th>'; }).join('') + '</tr>' +
      [5, 4, 3, 2, 1].map(function (pr) {
        return '<tr><td style="text-align:left;font-size:10px;white-space:nowrap">' + pr + ' · ' + nomProb[pr] + '</td>' + [1, 2, 3, 4, 5].map(function (im) {
          var n = mx.celdas[pr + '|' + im] || 0, niv = nivelRiesgoPxI(pr, im);
          return '<td style="background:' + (n ? niv.color : 'transparent') + (n ? ';color:#fff' : ';color:var(--tx3)') + ';font-weight:700;opacity:' + (n ? '1' : '.5') + '" title="' + niv.nivel + ' (PxI ' + niv.pxi + ')">' + (n || '·') + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</table></div>' +
      '<div class="tbl-wrap" style="margin-top:8px"><table style="font-size:11px"><tr><th>Equipo</th><th>Ítem</th><th style="text-align:right">Riesgo</th><th style="text-align:center">Prob.</th><th style="text-align:center">Impacto</th><th style="text-align:center">PxI</th><th>Nivel</th><th style="text-align:right">Precio usado</th></tr>' +
      mx.items.slice(0, 12).map(function (i) {
        return '<tr><td class="mono" style="color:var(--ac)">' + escapeHtml(i.sigla) + '</td><td style="font-size:10px">' + escapeHtml(i.item) + '</td><td class="mono" style="text-align:right;color:' + _TBO_COL_PROB[i.prob] + ';font-weight:700">' + _tboPct(i.riesgo) + '</td><td class="mono" style="text-align:center">' + i.prob + '</td><td class="mono" style="text-align:center">' + i.impacto + '</td><td class="mono" style="text-align:center;font-weight:700">' + i.pxi + '</td><td style="color:' + i.colorPxI + ';font-weight:700">' + i.nivelPxI + '</td><td class="mono" style="text-align:right">' + (i.valor ? _tboPeso(i.valor) : '<span style="color:var(--tx3)">sin precio (impacto 3)</span>') + '</td></tr>';
      }).join('') + '</table></div>' +
      '<p style="font-size:10px;color:var(--tx3);margin:4px 0 0">Probabilidad = riesgo acumulado Weibull con las horas desde el último cambio (la tabla oculta del Excel de Komatsu: β=3 y el TBO como 5%). Impacto = quintil del precio del componente entre los ' + fn(mx.conPrecio) + ' con precio (sin precio: 3, neutro). Mismas bandas Bajo/Moderado/Alto/Extremo que la Matriz de Riesgo de Predictivo. Con pocos ítems con precio los quintiles no se calculan y el impacto es 3.</p>';
  }

  // ── Vida real por origen ──
  var vida = tboCostoPorHora(tboVidaPorOrigen(compHist, compras), compras, eqs, tasa);
  var vidaTBO = vida.filter(function (v) { return v.tbo; });
  var vidaOtros = vida.filter(function (v) { return !v.tbo; });
  var filaVida = function (v) {
    var col = v.pctTBO == null ? 'inherit' : v.pctTBO >= 80 ? 'var(--ok)' : v.pctTBO >= 50 ? 'var(--w)' : 'var(--danger)';
    return '<tr><td style="font-weight:600">' + escapeHtml(v.comp) + '</td><td>' + escapeHtml(_TBO_ORIGEN[v.origen] || v.origen) + (v.inferidos ? ' <span style="font-size:9px;color:var(--tx3)" title="Origen inferido por el proveedor de la compra">(' + v.inferidos + ' inferido' + (v.inferidos > 1 ? 's' : '') + ')</span>' : '') + '</td>' +
      '<td class="mono" style="text-align:right">' + v.n + '</td><td class="mono" style="text-align:right;font-weight:700">' + fn(v.mediana) + ' h</td>' +
      '<td class="mono" style="text-align:right;font-size:10px">' + fn(v.min) + '–' + fn(v.max) + ' h</td>' +
      '<td class="mono" style="text-align:right">' + (v.tbo ? _tboHoras(v.tbo) : '—') + '</td>' +
      '<td class="mono" style="text-align:right;font-weight:700;color:' + col + '">' + (v.pctTBO == null ? '—' : v.pctTBO + '%') + '</td>' +
      '<td class="mono" style="text-align:right;font-size:11px">' + (v.bern ? '<b>' + Math.round(v.bern.media * 100) + '%</b><div style="font-size:9px;color:var(--tx3)">(' + Math.round(v.bern.ic90[0] * 100) + '–' + Math.round(v.bern.ic90[1] * 100) + '%) · ' + v.bern.exitos + ' de ' + v.bern.n + (v.n < 3 ? ' · pocos casos' : '') + '</div>' : '<span style="color:var(--tx3)">—</span>') + '</td>' +
      '<td class="mono" style="text-align:right;font-size:10px" title="' + escapeHtml(v.fuentePrecio || '') + '">' + (v.precio ? _tboPeso(v.precio) : '—') + '</td>' +
      '<td class="mono" style="text-align:right;font-weight:700">' + (v.costoHora ? _tboPeso(v.costoHora) + '/h' : '—') + (v.costoHoraTBO ? '<div style="font-size:9px;font-weight:400;color:var(--tx3)">a la vida TBO: ' + _tboPeso(v.costoHoraTBO) + '/h</div>' : '') + '</td></tr>';
  };
  h += '<div class="card-t" style="margin:18px 0 6px">Cuánto dura lo que cambiamos — original vs alternativo, contra el TBO de Komatsu</div>' +
    (vida.length ?
      '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Componente</th><th>Origen</th><th style="text-align:right">Cambios medidos</th><th style="text-align:right" title="Mediana de horas de horómetro entre un cambio y el siguiente">Duración (mediana)</th><th style="text-align:right">Mín–Máx</th><th style="text-align:right">TBO Komatsu</th><th style="text-align:right" title="Duración mediana ÷ TBO">% del TBO</th><th style="text-align:right" title="Probabilidad de que un cambio de este tipo llegue al TBO. Cada cambio es un ensayo sí/no (Bernoulli) y se estima con una Beta, que con pocos casos no da 0% ni 100% falsos. Entre paréntesis, intervalo creíble 90%.">¿Llega al TBO?</th><th style="text-align:right" title="Mediana pagada por ese tipo de repuesto (original = lo pagado a Komatsu o su lista en USD; alternativo = lo pagado a otros proveedores)">Precio típico</th><th style="text-align:right" title="Precio típico ÷ horas que duró (mediana). Es lo que cuesta cada hora de uso del componente.">Costo por hora</th></tr>' +
      vidaTBO.map(filaVida).join('') + (vidaOtros.length ? '<tr><td colspan="10" style="font-size:10px;color:var(--tx3);padding-top:10px">Componentes que el plan de Komatsu no tiene (se miden igual, sin TBO):</td></tr>' + vidaOtros.map(filaVida).join('') : '') +
      '</table></div>' + _tboResumenCostoHora(vidaTBO) + _tboResumenBeta(vidaTBO) + '<p style="font-size:10px;color:var(--tx3);margin:4px 0 0">Duración = horas de horómetro entre un cambio y el siguiente del mismo componente en el mismo equipo (el último cambio de cada equipo sigue en uso y no cuenta). Con pocos cambios por origen, tomalo como indicio y no como conclusión.</p>'
      : '<div class="card" style="color:var(--tx3);font-size:12px">Todavía no hay cambios suficientes en el Historial de Componentes para medir duraciones.</div>');

  // ── Reemplazo óptimo por costo + matriz de estrategia (RCM) ──
  var mttrFlota = (typeof duracionesReparacionFlotaHoras === 'function') ? medianaPositiva(duracionesReparacionFlotaHoras(S.g('ot') || [])) : null;
  var pOpt = {
    tarifaHH: S.g('hh') || 25000,
    hhCambio: _tboParamOpt('hhCambio', 16),
    horasProg: _tboParamOpt('horasProg', 8),
    horasFalla: _tboParamOpt('horasFalla', mttrFlota ? Math.round(mttrFlota) : 24),
    costoHoraDet: _tboParamOpt('costoDet', 0)
  };
  var pol = tboPoliticaOptimaFilas(vida.filter(function (v) { return v.origen !== 'sin dato' || v.precio; }), pOpt);
  var polCon = pol.filter(function (r) { return r.param && r.precio; });
  var _inp = function (id, k, val, label, ttl) { return '<label style="font-size:11px;color:var(--tx3)" title="' + ttl + '">' + label + ' <input id="' + id + '" type="number" min="0" step="any" value="' + val + '" style="width:90px" onchange="tboCambiarParamOpt(\'' + k + '\',this.value)"></label>'; };
  h += '<div class="card-t" style="margin:18px 0 6px">¿Cada cuántas horas conviene cambiar? — reemplazo óptimo por costo y estrategia por componente</div>' +
    '<div class="card" style="margin-bottom:8px;font-size:11px;color:var(--tx2);line-height:1.55">Un componente se cambia a la edad <b>T</b> (cambio programado, cuesta <b>Cp</b>) o falla antes (cuesta <b>Cf</b>, con la máquina detenida sin aviso). El costo por hora esperado es <b>C(T) = [Cp·R(T) + Cf·(1−R(T))] / ∫R(t)dt</b> con la vida Weibull del componente; la edad óptima <b>T*</b> es la que lo minimiza. Solo existe si el componente se desgasta (β&gt;1) y fallar cuesta más que cambiar. <b>El resultado depende del costo de una hora detenida</b>: sin él, fallar y cambiar cuestan lo mismo y el modelo no recomienda cambiar antes.</div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px">' +
    _inp('tboCostoDet', 'costoDet', pOpt.costoHoraDet, 'Costo de 1 hora detenida ($/h)', 'Lo que pierde la operación por cada hora que el equipo está detenido. Ej. toneladas por hora × margen por tonelada. Sin este dato el modelo no puede recomendar cambiar antes.') +
    _inp('tboHorasFalla', 'horasFalla', pOpt.horasFalla, 'Horas detenido por falla', 'Por defecto, la mediana de duración de los correctivos de la flota (si hay dato)') +
    _inp('tboHorasProg', 'horasProg', pOpt.horasProg, 'Horas detenido por cambio programado', 'Supuesto editable: un cambio planificado tarda menos que una falla') +
    _inp('tboHHCambio', 'hhCambio', pOpt.hhCambio, 'HH por cambio', 'Horas-hombre de mano de obra por cambio (supuesto editable). La tarifa por HH sale de Configuración: $' + fn(pOpt.tarifaHH)) +
    '</div>' +
    (pOpt.costoHoraDet > 0 ? '' : '<div class="card" style="margin-bottom:8px;border-left:3px solid var(--w);font-size:11px;color:var(--tx2)">⚠️ Sin costo de hora detenida: Cf = Cp, así que no hay edad óptima. Ingresá el costo para ver la recomendación.</div>') +
    (polCon.length ? '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Componente</th><th>Origen</th><th title="Forma y vida característica de la Weibull usada (la fuente está al pasar el mouse)">β / η</th><th style="text-align:right" title="Costo de un cambio programado: repuesto + mano de obra + parada programada">Cp</th><th style="text-align:right" title="Costo de una falla: repuesto + mano de obra + parada por falla. Entre paréntesis, cuántas veces más cuesta que un cambio programado">Cf (× Cp)</th><th style="text-align:right">Cambiar cada (T*)</th><th style="text-align:right">TBO fábrica</th><th style="text-align:right">Costo/h en T*</th><th style="text-align:right">Costo/h al TBO</th><th style="text-align:right">Costo/h dejando fallar</th><th>Qué hacer</th></tr>' +
      polCon.map(function (r) {
        var o = r.opt, tboRef = r.tbo && r.tbo.min === r.tbo.max ? r.tbo.min : null;
        var estr = r.estrategia ? '<b>' + escapeHtml(r.estrategia.estrategia) + '</b><div style="font-size:9px;color:var(--tx3);white-space:normal">' + escapeHtml(r.estrategia.detalle) + '</div>' : '—';
        return '<tr><td style="font-weight:600">' + escapeHtml(r.comp) + '</td><td>' + escapeHtml(_TBO_ORIGEN[r.origen] || r.origen) + '</td>' +
          '<td class="mono" style="font-size:10px" title="' + escapeHtml(r.param.fuente) + '">' + (Math.round(r.param.beta * 100) / 100 + '').replace('.', ',') + ' / ' + fn(Math.round(r.param.eta)) + ' h</td>' +
          '<td class="mono" style="text-align:right">' + _tboPeso(r.Cp) + '</td><td class="mono" style="text-align:right">' + _tboPeso(r.Cf) + ' <span style="color:var(--tx3)">(' + (Math.round(r.ratio * 10) / 10 + '').replace('.', ',') + '×)</span></td>' +
          '<td class="mono" style="text-align:right;font-weight:700;color:' + (o.existe ? 'var(--ac)' : 'var(--tx3)') + '" title="' + escapeHtml(o.existe ? '' : o.motivo) + '">' + (o.existe ? fn(Math.round(o.T / 10) * 10) + ' h' : 'sin óptimo') + '</td>' +
          '<td class="mono" style="text-align:right">' + (tboRef ? fn(tboRef) + ' h' : '—') + '</td>' +
          '<td class="mono" style="text-align:right">' + (o.existe ? _tboPeso(o.costoHora) + '/h' : '—') + '</td>' +
          '<td class="mono" style="text-align:right">' + (r.costoHoraTBOPol ? _tboPeso(r.costoHoraTBOPol) + '/h' + (r.ahorroVsTBO > 0.005 ? '<div style="font-size:9px;color:var(--ok)">T* ahorra ' + Math.round(r.ahorroVsTBO * 100) + '%</div>' : '') : '—') + '</td>' +
          '<td class="mono" style="text-align:right">' + _tboPeso(o.costoHoraRTF) + '/h</td><td style="font-size:10px">' + estr + '</td></tr>';
      }).join('') + '</table></div>' +
      '<p style="font-size:10px;color:var(--tx3);margin:4px 0 0">β y η: con 5 o más cambios medidos se ajusta una Weibull; con menos, β=3 (el supuesto de desgaste de Komatsu) y η según los cambios medidos; el original sin datos usa el modelo del TBO. Nunca se mezclan origen original y alternativo para estimar β. Con pocos cambios por origen, T* es una referencia para decidir, no una cifra exacta: mirá cuánto cambia al mover el costo de hora detenida.</p>'
      : '<div class="card" style="color:var(--tx3);font-size:12px">Falta precio o cambios medidos de los componentes para calcular el costo. Registrá los cambios en el Historial de Componentes y cargá compras con el repuesto.</div>');
  if (polCon.length) {
    h += '<div class="card-t" style="margin:14px 0 6px">Matriz de estrategia (RCM) — forma de la falla × cuánto más cuesta fallar que cambiar</div>' +
      '<div class="tbl-wrap"><table style="font-size:11px"><tr><th style="text-align:left">Forma de la falla ↓ / Consecuencia →</th>' + TBO_RCM_MATRIZ.columnas.map(function (c) { return '<th>' + c[1] + '</th>'; }).join('') + '</tr>' +
      TBO_RCM_MATRIZ.filas.map(function (f) {
        return '<tr><td style="font-weight:600;white-space:nowrap">' + f[1] + '</td>' + TBO_RCM_MATRIZ.columnas.map(function (c) {
          var k = f[0] + '|' + c[0], cel = TBO_RCM_MATRIZ.celdas[k];
          var items = polCon.filter(function (r) { return r.estrategia && r.estrategia.celda === k; });
          return '<td style="vertical-align:top;white-space:normal;min-width:150px;' + (items.length ? 'background:rgba(245,158,11,.08)' : '') + '"><div style="font-weight:700;font-size:10px">' + escapeHtml(cel[0]) + '</div>' +
            (items.length ? items.map(function (r) { return '<div style="font-size:10px;color:var(--ac)">• ' + escapeHtml(r.comp) + ' (' + (r.origen === 'original' ? 'orig.' : r.origen === 'alternativo' ? 'alt.' : 's/d') + ')</div>'; }).join('') : '<div style="font-size:9px;color:var(--tx3)">—</div>') + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</table></div>' +
      '<p style="font-size:10px;color:var(--tx3);margin:4px 0 0">Forma: β&lt;0,9 fallas tempranas (instalación o calidad), β≈1 al azar, β≥1,2 por desgaste. Consecuencia: Cf/Cp &lt;2 baja, 2–5 media, &gt;5 alta. Es la lógica clásica de selección de estrategia (RCM): el cambio por edad solo paga cuando hay desgaste y la falla sale cara; con fallas al azar conviene vigilar por condición.</p>';
    // Sensibilidad al costo de hora detenida del primer componente con parámetros
    var ref = polCon[0];
    var valores = [100000, 250000, 500000, 1000000, 2000000, 5000000];
    h += '<div class="card-t" style="margin:14px 0 6px">¿Cuánto cambia con el costo de la hora detenida? — ' + escapeHtml(ref.comp) + ' (' + escapeHtml(_TBO_ORIGEN[ref.origen] || ref.origen) + ')</div>' +
      '<div class="tbl-wrap"><table style="font-size:11px"><tr><th style="text-align:right">Costo de 1 hora detenida</th><th style="text-align:right">Cf/Cp</th><th style="text-align:right">Cambiar cada (T*)</th><th style="text-align:right">Costo/h en T*</th><th style="text-align:right">Costo/h dejando fallar</th><th>Qué hacer</th></tr>' +
      valores.map(function (cd) {
        var rr = tboPoliticaOptimaFilas([ref], Object.assign({}, pOpt, { costoHoraDet: cd }))[0];
        return '<tr><td class="mono" style="text-align:right">' + _tboPeso(cd) + '/h</td><td class="mono" style="text-align:right">' + (Math.round(rr.ratio * 10) / 10 + '').replace('.', ',') + '×</td>' +
          '<td class="mono" style="text-align:right;font-weight:700">' + (rr.opt.existe ? fn(Math.round(rr.opt.T / 10) * 10) + ' h' : 'sin óptimo') + '</td><td class="mono" style="text-align:right">' + (rr.opt.existe ? _tboPeso(rr.opt.costoHora) + '/h' : '—') + '</td><td class="mono" style="text-align:right">' + _tboPeso(rr.opt.costoHoraRTF) + '/h</td><td style="font-size:10px">' + escapeHtml(rr.estrategia.estrategia) + '</td></tr>';
      }).join('') + '</table></div>';
  }

  if (sinCompras) h += '<div class="card" style="color:var(--tx3);font-size:12px;margin-top:12px">No hay compras cargadas para ' + (eqSel ? escapeHtml(eqSel.sigla) : 'la flota') + '.</div>';

  // ── Gasto por familia ──
  var cab = '<th>Familia de componente</th><th title="Horas de cambio recomendadas por Komatsu (TBO de aplicación Normal)">TBO Komatsu</th>';
  var cabFuera = '<th>Concepto</th>';
  var cabRest = '<th style="text-align:right">Líneas</th><th style="text-align:right">Gasto</th><th style="text-align:right" title="Proveedor Komatsu Chile = repuesto original">Original (Komatsu)</th><th style="text-align:right" title="Otros proveedores: alternativos, reparados o reacondicionados">Otros proveedores</th><th style="text-align:right">% original</th><th style="text-align:right" title="Gasto promedio por equipo que compró algo de esta familia">Prom. por equipo</th><th>Principales proveedores</th>';
  var famDefs = TBO_FAMILIAS.map(function (f) { return [f[0], f[1]]; }).sort(function (a, b) { return ((res.familias[b[0]] || {}).gasto || 0) - ((res.familias[a[0]] || {}).gasto || 0); });
  var fueraDefs = TBO_FUERA.map(function (f) { var d = [f[0], f[1]]; d.enTBO = false; return d; }).sort(function (a, b) { return ((res.familias[b[0]] || {}).gasto || 0) - ((res.familias[a[0]] || {}).gasto || 0); });
  h += '<div class="card-t" style="margin:18px 0 6px">Gasto real dentro del plan del fabricante — por familia de componente' + (eqSel ? ' · ' + escapeHtml(eqSel.sigla) : '') + '</div>' +
    '<div class="tbl-wrap"><table style="font-size:11px"><tr>' + cab + cabRest + '</tr>' + _tboFilasFamilia(res, famDefs, !!eqSel, claseSel) + '</table></div>';
  h += '<div class="card-t" style="margin:18px 0 6px">Gasto fuera del plan del fabricante — lo que el TBO no cubre</div>' +
    '<div class="tbl-wrap"><table style="font-size:11px"><tr>' + cabFuera + cabRest + '</tr>' + _tboFilasFamilia(res, fueraDefs, !!eqSel, null) + '</table></div>' +
    '<p style="font-size:10px;color:var(--tx3);margin:4px 0 0">"Otros (sin clasificar)" son líneas cuya descripción no calzó con ninguna palabra clave (ej. vehículos comprados, repuestos solo con N° de parte).</p>';

  if (eqSel && !claseSel) {
    h += '<div class="card" style="margin-top:14px;font-size:12px;color:var(--tx3)">' + escapeHtml(eqSel.sigla) + ' (' + escapeHtml(eqSel.modelo || '') + ') no tiene plan TBO en el Excel de Komatsu (solo trae HD785-7, WA900-8R, D375A-6R y D65EX-16).</div>';
  }

  // ── Listado Sugerido ──
  var sug = tboCruzarSugerido(compras, tasa);
  h += '<div class="card-t" style="margin:18px 0 6px">Repuestos del listado "Sugerido" de Komatsu (HD785-7, precios Besalco en USD) vs lo pagado</div>' +
    '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>N° de parte</th><th>Repuesto</th><th style="text-align:right">Cant. x equipo</th><th style="text-align:right">Precio USD</th><th style="text-align:right">≈ CLP (tasa ' + fn(tasa) + ')</th><th style="text-align:right" title="Compras encontradas por N° de parte (en el texto del pedido)">Compras</th><th>Última compra</th><th style="text-align:right">Último precio pagado</th><th style="text-align:right" title="Último precio pagado ÷ precio de lista en pesos">Pagado / lista</th></tr>' +
    sug.map(function (s) {
      var ratio = s.ultPrecio && s.clpRef ? Math.round(100 * s.ultPrecio / s.clpRef) : null;
      return '<tr' + (s.nCompras ? '' : ' style="opacity:.55"') + '><td class="mono" style="font-size:10px">' + escapeHtml(s.pn) + '</td><td>' + escapeHtml(s.desc) + '</td>' +
        '<td class="mono" style="text-align:right">' + s.cant + '</td><td class="mono" style="text-align:right">' + _tboUSD(s.usd) + '</td>' +
        '<td class="mono" style="text-align:right">' + (s.clpRef ? _tboPeso(s.clpRef) : '—') + '</td>' +
        '<td class="mono" style="text-align:right">' + (s.nCompras ? s.nCompras + (s.exacto ? '' : ' (parcial)') : 'sin compras') + '</td>' +
        '<td style="font-size:10px">' + (s.ultFecha ? escapeHtml(s.ultFecha) + ' · ' + escapeHtml(String(s.ultProveedor || '').slice(0, 20)) : '—') + '</td>' +
        '<td class="mono" style="text-align:right">' + (s.ultPrecio ? _tboPeso(s.ultPrecio) : '—') + '</td>' +
        '<td class="mono" style="text-align:right">' + (ratio !== null ? ratio + '%' : '—') + '</td></tr>';
    }).join('') + '</table></div>' +
    '<p style="font-size:10px;color:var(--tx3);margin:4px 0 0">Total del listado por equipo (cantidad × unitario): ' + _tboUSD(sug.reduce(function (s, r) { return s + r.cant * r.usd; }, 0)) + '. Un "pagado/lista" muy bajo suele indicar repuesto alternativo o reparado.</p>';

  el.innerHTML = h;
}

// Crear una OC Pendiente (la misma tabla 'ordenes' que usa Repuestos → Comprar) desde una fila del plan de compra.
export function crearOCDesdeTBO(i) {
  var f = _tboPlanFilas[i]; if (!f) return;
  var nombre = {}; TBO_FAMILIAS.forEach(function (x) { nombre[x[0]] = x[1]; });
  var prov = f.precio ? 'KOMATSU CHILE S.A.' : ''; // el precio de referencia es el del original (editable)
  sm('<h3>🛒 Crear orden de compra desde el TBO</h3>' +
    '<div class="card" style="margin-bottom:12px;border-left:3px solid var(--ac)"><b>' + escapeHtml(nombre[f.fam] || f.fam) + '</b> — ' + escapeHtml(f.item) + (f.pn ? ' (' + escapeHtml(f.pn) + ')' : '') + '<br>' +
    'Equipo: ' + escapeHtml(f.sigla) + ' · cambio estimado ' + escapeHtml(f.fechaProx) + ' · tarda en llegar ~' + fn(f.lead.dias) + ' d<br>' +
    'Stock: <b>' + fn(f.stock.unidades) + '</b> · Pedidos abiertos: <b>' + f.pedidos.length + '</b></div>' +
    '<div class="form-row"><div class="fg"><label>Cantidad a pedir</label><input type="number" id="tboOcCant" value="' + f.cant + '" min="1"></div>' +
    '<div class="fg"><label>Costo estimado ($)</label><input type="number" id="tboOcCosto" value="' + (f.costoEst || 0) + '"></div></div>' +
    '<div class="form-row"><div class="fg"><label>Proveedor</label><input id="tboOcProv" value="' + escapeHtml(prov) + '" placeholder="Komatsu Chile / alternativo…"></div>' +
    '<div class="fg"><label>Fecha pedido</label><input type="date" id="tboOcFecha" value="' + new Date().toISOString().slice(0, 10) + '"></div></div>' +
    '<div class="form-row"><div class="fg" style="flex:1"><label>Observaciones</label><input id="tboOcObs" style="width:100%" value="' + escapeHtml(f.dias <= 0 ? 'TBO Komatsu: cambio ya vencido' : 'TBO Komatsu: cambio estimado ' + f.fechaProx + (f.pedirAntesDe ? ' (pedir antes del ' + f.pedirAntesDe + ')' : '')) + '"></div></div>' +
    '<button class="btn" onclick="confirmarOCDesdeTBO(' + i + ')">✔ Crear OC (Pendiente)</button>');
}
export function confirmarOCDesdeTBO(i) {
  var f = _tboPlanFilas[i]; if (!f) return;
  var nombre = {}; TBO_FAMILIAS.forEach(function (x) { nombre[x[0]] = x[1]; });
  var cant = parseInt($('tboOcCant').value) || 1;
  var oc = S.g('ordenes') || [];
  oc.push({
    fecha: $('tboOcFecha').value, componente: (nombre[f.fam] || f.fam) + ' — ' + f.item, nParte: f.pn || '', equipo: f.sigla,
    cantidad: cant, costoEstimado: parseInt($('tboOcCosto').value) || 0, proveedor: $('tboOcProv').value, obs: $('tboOcObs').value,
    estado: 'Pendiente', fechaEntrega: ''
  });
  S.s('ordenes', oc); cm(); renders.tbo();
  toast('🛒 OC creada (Pendiente) — ' + f.item + ' x' + cant);
}

// "Alternativo vs original": por componente que tiene las dos, cuánto cuesta cada hora de uso con cada uno.
function _tboResumenCostoHora(filas) {
  var por = {};
  filas.forEach(function (v) { if (v.costoHora) (por[v.comp] = por[v.comp] || {})[v.origen] = v; });
  var l = Object.keys(por).filter(function (c) { return por[c].original && por[c].alternativo; }).map(function (c) {
    var o = por[c].original, a = por[c].alternativo, pct = Math.round(100 * a.costoHora / o.costoHora);
    return '<b>' + escapeHtml(c) + '</b>: el alternativo cuesta ' + _tboPeso(a.costoHora) + '/h contra ' + _tboPeso(o.costoHora) + '/h del original (' + pct + '%) — ' + (pct > 100 ? '<span style="color:var(--danger)">sale más caro por hora</span>' : '<span style="color:var(--ok)">sale más barato por hora</span>') + ' (' + a.n + ' cambio' + (a.n > 1 ? 's' : '') + ' alt. vs ' + o.n + ' orig.)';
  });
  return l.length ? '<div class="card" style="margin-top:8px;font-size:11px;line-height:1.7">' + l.join('<br>') + '<div style="font-size:10px;color:var(--tx3);margin-top:4px">Costo por hora = precio típico ÷ duración mediana real. Un repuesto más barato puede salir más caro por hora si dura mucho menos. Con pocos cambios es un indicio, no una conclusión.</div></div>' : '';
}

// Comparación estadística original vs alternativo (Beta–Bernoulli): P(el original llega al TBO con más probabilidad que el alternativo).
function _tboResumenBeta(filas) {
  var c = tboComparaOrigen(filas);
  if (!c.length) return '';
  return '<div class="card" style="margin-top:8px;font-size:11px;line-height:1.7">' + c.map(function (x) {
    var p = Math.round(x.pOriginalMejor * 100);
    var col = p >= 90 ? 'var(--danger)' : p >= 70 ? 'var(--w)' : 'var(--tx2)';
    var txt = p >= 90 ? 'el original llega al TBO claramente más seguido' : p >= 70 ? 'el original tiende a llegar más seguido' : p > 30 ? 'todavía no se distinguen' : 'el alternativo tiende a llegar más seguido';
    return '<b>' + escapeHtml(x.comp) + '</b>: probabilidad de que el original llegue al TBO más seguido que el alternativo = <b style="color:' + col + '">' + p + '%</b> — ' + txt + ' (' + x.nOriginal + ' orig. vs ' + x.nAlternativo + ' alt.).';
  }).join('<br>') + '<div style="font-size:10px;color:var(--tx3);margin-top:4px">Método: cada cambio medido es un ensayo Bernoulli (¿duró al menos el TBO?); cada origen se resume con una distribución Beta y se compara cuál tiene mayor probabilidad de éxito. 50% = no hay diferencia detectable. Con 3–4 cambios por origen una diferencia grande puede ser casualidad: mirá los intervalos de la tabla.</div></div>';
}

export function tboCambiarParamOpt(k, v) {
  var n = parseFloat(v);
  if (!(n >= 0)) { toast('Ingresá un número mayor o igual a 0'); return; }
  try { localStorage.setItem(_TBO_OPT_KEYS[k], String(n)); } catch (e) { /* sin storage: queda solo en esta vista */ }
  renders.tbo();
}

export function tboCambiarAplic(v) {
  if (!TBO_APLICACION[v]) return;
  try { localStorage.setItem(_TBO_APLIC_KEY, v); } catch (e) { /* sin storage: queda solo en esta vista */ }
  renders.tbo();
}

export function tboCambiarTasa(v) {
  var n = parseFloat(v);
  if (!(n > 0)) { toast('Ingresá una tasa mayor a 0'); return; }
  try { localStorage.setItem(_TBO_TASA_KEY, String(n)); } catch (e) { /* sin storage: queda solo en esta vista */ }
  renders.tbo();
}

// Puente window/renders — ver nota en mov.js (primera tanda).
window.renderTbo = renderTbo;
window.tboCambiarTasa = tboCambiarTasa;
window.tboCambiarAplic = tboCambiarAplic;
window.tboCambiarParamOpt = tboCambiarParamOpt;
window.crearOCDesdeTBO = crearOCDesdeTBO;
window.confirmarOCDesdeTBO = confirmarOCDesdeTBO;
renders.tbo = renderTbo;
