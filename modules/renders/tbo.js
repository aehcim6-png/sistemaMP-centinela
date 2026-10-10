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
      '<td class="mono" style="text-align:right;font-size:10px" title="' + escapeHtml(v.fuentePrecio || '') + '">' + (v.precio ? _tboPeso(v.precio) : '—') + '</td>' +
      '<td class="mono" style="text-align:right;font-weight:700">' + (v.costoHora ? _tboPeso(v.costoHora) + '/h' : '—') + (v.costoHoraTBO ? '<div style="font-size:9px;font-weight:400;color:var(--tx3)">a la vida TBO: ' + _tboPeso(v.costoHoraTBO) + '/h</div>' : '') + '</td></tr>';
  };
  h += '<div class="card-t" style="margin:18px 0 6px">Cuánto dura lo que cambiamos — original vs alternativo, contra el TBO de Komatsu</div>' +
    (vida.length ?
      '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Componente</th><th>Origen</th><th style="text-align:right">Cambios medidos</th><th style="text-align:right" title="Mediana de horas de horómetro entre un cambio y el siguiente">Duración (mediana)</th><th style="text-align:right">Mín–Máx</th><th style="text-align:right">TBO Komatsu</th><th style="text-align:right" title="Duración mediana ÷ TBO">% del TBO</th><th style="text-align:right" title="Mediana pagada por ese tipo de repuesto (original = lo pagado a Komatsu o su lista en USD; alternativo = lo pagado a otros proveedores)">Precio típico</th><th style="text-align:right" title="Precio típico ÷ horas que duró (mediana). Es lo que cuesta cada hora de uso del componente.">Costo por hora</th></tr>' +
      vidaTBO.map(filaVida).join('') + (vidaOtros.length ? '<tr><td colspan="9" style="font-size:10px;color:var(--tx3);padding-top:10px">Componentes que el plan de Komatsu no tiene (se miden igual, sin TBO):</td></tr>' + vidaOtros.map(filaVida).join('') : '') +
      '</table></div>' + _tboResumenCostoHora(vidaTBO) + '<p style="font-size:10px;color:var(--tx3);margin:4px 0 0">Duración = horas de horómetro entre un cambio y el siguiente del mismo componente en el mismo equipo (el último cambio de cada equipo sigue en uso y no cuenta). Con pocos cambios por origen, tomalo como indicio y no como conclusión.</p>'
      : '<div class="card" style="color:var(--tx3);font-size:12px">Todavía no hay cambios suficientes en el Historial de Componentes para medir duraciones.</div>');

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
renders.tbo = renderTbo;
