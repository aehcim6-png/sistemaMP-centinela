// Pestaña Stock Filtros (sub-pestaña de Stock & Insumos) — extraída a su
// propio archivo (Fase 2 de modularización). Módulo ES real (Fase 3,
// 2026-08-30, primera tanda: Stock & Insumos) — ver nota de migración en
// mov.js (mismo grupo). window.edI queda en index.html porque también lo
// usa renders.lub (ya extraída, comparte el mismo helper).
// Gauge de cobertura de stock (2026-08-24, mismo lenguaje que
// Dashboard/Equipos/Alertas PM4/Vencimientos): acá el anillo se llena al
// REVÉS que en un PM — mientras MENOS meses de cobertura queden, más lleno
// (más urgente), tope de 2 meses (ventana corta y relevante para reponer
// stock, a diferencia de los 45-90 días de las otras pantallas).
function _mesesGauge(meses, nivel) {
  var col = nivel === 'COMPRAR' ? 'var(--danger)' : nivel === 'BAJO' ? 'var(--warn)' : 'var(--ok)';
  var pct = meses >= 2 ? 0 : Math.max(0, Math.min(100, 100 - (meses / 2 * 100)));
  var C = 2 * Math.PI * 10, off = Math.round((C * (1 - pct / 100)) * 100) / 100;
  return '<div style="display:inline-flex;align-items:center;gap:5px"><svg viewBox="0 0 26 26" width="20" height="20" style="transform:rotate(-90deg);flex:none"><circle cx="13" cy="13" r="10" fill="none" stroke="var(--bg4)" stroke-width="3.5"></circle><circle class="gauge-ring" cx="13" cy="13" r="10" fill="none" stroke="' + col + '" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="' + C + '" data-off="' + off + '"></circle></svg><span class="mono" style="color:' + col + ';font-weight:600">' + meses.toFixed(1) + '</span></div>';
}
// ═══ PLAN DE REPOSICIÓN SEGÚN EL PROGRAMA DE PM (2026-10-11) ═══
// Cuánto necesitará de cada filtro y lubricante el programa de PM de la flota (próximos PM de cada equipo × pauta de cada PM), cruzado con el stock, lo pendiente y el
// plazo de entrega. Se calcula con planReposicionPM / demandaPlanificadaPM (logic.js). Complementa al "consumo/mes" tipeado a mano y al histórico.
var _STK_PLAN_COB_KEY = 'stkPlanCobertura';
function _stkPlanCob() {
  try { var v = parseInt(localStorage.getItem(_STK_PLAN_COB_KEY), 10); if (v === 30 || v === 60 || v === 90) return v; } catch (e) { /* sin storage: 30 */ }
  return 30;
}
export function stkCambiarCobertura(v) {
  var n = parseInt(v, 10);
  if (n !== 30 && n !== 60 && n !== 90) return;
  try { localStorage.setItem(_STK_PLAN_COB_KEY, String(n)); } catch (e) { /* sin storage: queda solo en esta vista */ }
  renders.stk();
}
function _stkPlanPMHTML(stk) {
  if (typeof demandaPlanificadaPM !== 'function' || typeof getPautasConsumo !== 'function') return '';
  var lub = S.g('lub') || [], eqs = S.g('eq') || [], mapa = S.g('mapaRep') || [], cob = _stkPlanCob();
  var verTodo = $('fStkPlanTodo') ? $('fStkPlanTodo').checked : false;
  var dem = demandaPlanificadaPM(eqs, getPautasConsumo, stk, lub, mapa, new Date(), 150);
  var plan = planReposicionPM(dem, stk, lub, { cobertura: cob });
  var urg = plan.filter(function (r) { return r.estado === 'pedir_ya'; }), pla = plan.filter(function (r) { return r.estado === 'planificar'; });
  var sinN = Object.keys(dem.sinStock).length;
  var fila = function (r) {
    var col = r.estado === 'pedir_ya' ? 'var(--danger)' : r.estado === 'planificar' ? 'var(--w)' : 'var(--ok)';
    var txt = r.estado === 'pedir_ya' ? '🔴 Pedir ya' : r.estado === 'planificar' ? '🟡 Planificar' : '✅ Cubierto';
    var antes = r.pedirAntesDias == null ? '—' : r.pedirAntesDias <= 0 ? '<span style="color:var(--danger)">ya (' + fn(-r.pedirAntesDias) + ' d tarde)</span>' : 'en ' + fn(r.pedirAntesDias) + ' d';
    var razon = r.razonPlanHist == null ? '<span style="color:var(--tx3)">sin consumo/mes cargado</span>' : (Math.round(r.razonPlanHist * 10) / 10 + '').replace('.', ',') + '× el histórico';
    return '<tr' + (r.estado === 'cubierto' ? ' style="opacity:.7"' : '') + '><td><b>' + escapeHtml(r.nombre) + '</b><div style="font-size:10px;color:var(--tx3)">' + (r.tipo === 'lubricante' ? 'Lubricante' : escapeHtml(r.nParte || 'Filtro')) + (r.equipoModelo ? ' · ' + escapeHtml(r.equipoModelo) : '') + '</div></td>' +
      '<td class="mono" style="text-align:right">' + fn(r.stockBodega) + (r.pendiente ? ' <span style="font-size:10px;color:var(--tx3)">(+' + fn(r.pendiente) + ' pend.)</span>' : '') + '</td>' +
      '<td class="mono" style="text-align:right" title="Lo que consumen los PM de la flota hasta ' + fn(r.lead + cob) + ' días (plazo de entrega + cobertura)">' + fn(Math.round(r.necesidad * 10) / 10) + '</td>' +
      '<td class="mono" style="text-align:right">' + (r.quiebreDias == null ? '—' : 'en ' + fn(r.quiebreDias) + ' d') + '</td>' +
      '<td class="mono" style="text-align:right" title="Plazo de entrega: ' + fn(r.lead) + ' d' + (r.leadPropio ? '' : ' (supuesto: no tiene plazo propio)') + '">' + antes + '</td>' +
      '<td class="mono" style="text-align:right;font-weight:700;color:' + col + '">' + (r.pedir > 0 ? fn(r.pedir) : '—') + '</td>' +
      '<td class="mono" style="text-align:right;font-size:11px">' + fn(Math.round(r.plan30 * 10) / 10) + ' / 30 d<div style="font-size:10px;color:var(--tx3)">' + razon + '</div></td>' +
      '<td style="color:' + col + ';font-weight:700;font-size:11px;white-space:nowrap">' + txt + '</td></tr>';
  };
  var filas = plan.filter(function (r) { return verTodo || r.estado !== 'cubierto'; });
  return '<div class="chart-box" style="margin-bottom:14px"><div class="chart-t">Plan de reposición según el programa de PM</div>' +
    '<div style="font-size:11px;color:var(--tx2);line-height:1.55;margin-bottom:8px">Los PM que vienen de cada equipo ya están calendarizados por horómetro y cada pauta dice qué filtros y lubricantes gasta. Acá se suman por ítem, se comparan con el stock y lo pendiente, y se avisa <b>cuándo hay que pedir</b> (quiebre menos plazo de entrega) y <b>cuánto</b> (lo que faltará hasta que llegue el pedido más la cobertura elegida). Calcula la demanda programada; los consumos no planificados (fallas) no están incluidos, por eso se muestra junto al histórico.</div>' +
    '<div class="cards" style="margin-bottom:8px">' +
    '<div class="card"><div class="card-t">🔴 Pedir ya</div><div class="card-v" style="color:' + (urg.length ? 'var(--danger)' : 'var(--ok)') + '">' + fn(urg.length) + '</div><div class="card-s">el quiebre llega antes que un pedido</div></div>' +
    '<div class="card"><div class="card-t">🟡 Planificar</div><div class="card-v" style="color:' + (pla.length ? 'var(--w)' : 'var(--ok)') + '">' + fn(pla.length) + '</div><div class="card-s">pedir en los próximos 30 días</div></div>' +
    '<div class="card"><div class="card-t">PM calendarizados</div><div class="card-v">' + fn(dem.pmContados) + '</div><div class="card-s">en los próximos 150 días, de ' + fn(eqs.length - dem.sinRitmo.length) + ' equipos' + (dem.sinRitmo.length ? ' (' + fn(dem.sinRitmo.length) + ' sin ritmo diario)' : '') + '</div></div>' +
    '<div class="card"><div class="card-t">Sin ítem de stock</div><div class="card-v" style="color:' + (sinN ? 'var(--w)' : 'var(--ok)') + '">' + fn(sinN) + '</div><div class="card-s">líneas de pauta sin filtro ni lubricante vinculado</div></div></div>' +
    '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:6px;font-size:11px;color:var(--tx3)"><label>Cubrir después de que llegue el pedido: <select id="fStkPlanCob" onchange="stkCambiarCobertura(this.value)" style="font-size:11px">' +
    [30, 60, 90].map(function (d) { return '<option value="' + d + '"' + (d === cob ? ' selected' : '') + '>' + d + ' días</option>'; }).join('') + '</select></label>' +
    '<label><input id="fStkPlanTodo" type="checkbox" ' + (verTodo ? 'checked ' : '') + 'onchange="renders.stk()"> Ver también los cubiertos (' + fn(plan.length - urg.length - pla.length) + ')</label></div>' +
    (filas.length ? '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Ítem</th><th style="text-align:right">En bodega</th><th style="text-align:right">Necesita</th><th style="text-align:right">Primer quiebre</th><th style="text-align:right">Pedir antes de</th><th style="text-align:right">Pedir</th><th style="text-align:right">Plan 30 d vs histórico</th><th>Estado</th></tr>' + filas.map(fila).join('') + '</table></div>'
      : '<div style="font-size:12px;color:var(--tx3);padding:8px 0">' + (plan.length ? 'Todos los ítems con consumo programado están cubiertos.' : 'Ningún PM calendarizado consume ítems de Stock o Lubricantes (revisa que los equipos tengan ritmo diario y que las pautas estén cargadas).') + '</div>') +
    (sinN ? '<details style="margin-top:6px;font-size:11px;color:var(--tx3)"><summary style="cursor:pointer">Líneas de pauta sin ítem de stock vinculado (' + fn(sinN) + ')</summary><div style="padding:4px 0">' + Object.keys(dem.sinStock).sort().map(function (k) { return escapeHtml(k) + ' <span class="mono">×' + fn(dem.sinStock[k]) + '</span>'; }).join(' · ') + '</div></details>' : '') + '</div>';
}

export function renderStk() {
  const stk = S.g('stk') || [];
  const mov = S.g('mov') || [];
  // Nivel en vivo (stockEstado) — no el estado guardado, para que conteo, filtro y tabla
  // usen todos el mismo criterio de quiebre-antes-del-lead-time.
  const _nivelStk = s => stockEstado((s.stockBodega || 0) + (s.pendiente || 0), s.consumoMes || s.proyMes, s.leadTime).nivel;
  const comprar = stk.filter(s => _nivelStk(s) === 'COMPRAR').length;
  const fEst = $('fStkEst')?.value || '';
  const fBusq = $('fStkBusq')?.value || '';
  // Last consumption date per item
  const lastUse = {}, totalCons = {};
  mov.forEach(function (m) {
    if (m.tipo === 'Filtro') {
      var key = m.item || '';
      if (!lastUse[key] || m.fecha > lastUse[key]) lastUse[key] = m.fecha;
      totalCons[key] = (totalCons[key] || 0) + (m.cant || 0);
    }
  });
  var filStk = stk.filter(function (s) {
    if (fEst && _nivelStk(s) !== fEst) return false;
    if (fBusq && !(s.descripcion || '').toLowerCase().includes(fBusq.toLowerCase()) && !(s.nParte || '').toLowerCase().includes(fBusq.toLowerCase())) return false;
    return true;
  });
  const pg = _pagSlice('stk', filStk);
  $('s-stk').innerHTML =
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="10,2 17,6 10,10 3,6"/><line x1="3" y1="6" x2="3" y2="13"/><line x1="17" y1="6" x2="17" y2="13"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="3" y1="13" x2="10" y2="18"/><line x1="17" y1="13" x2="10" y2="18"/></svg> Stock Filtros</div>' +
    '<div class="sec-s">' + stk.length + ' ítems · 🔴 ' + comprar + ' por comprar · <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg> Todo editable</div></div>' +
    '<button class="btn" onclick="addStock()">+ Nuevo</button> <button class="btn btn-o" onclick="importStkCSV()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar CSV</button> <button class="btn btn-o" onclick="resumenFlotaStk()">📊 Resumen</button> <button class="btn" style="background:#3ecf8e;color:#000" onclick="importarRepuestosKomatsu()"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="8"/><line x1="10" y1="6" x2="10" y2="11"/><circle cx="10" cy="14" r="0.6" fill="currentColor" stroke="none"/></svg> Repuestos Críticos Komatsu</button></div>' +
    _stkPlanPMHTML(stk) +
    '<div class="toolbar">' +
    '<select id="fStkEst" onchange="window._pag.stk=1;renders.stk()"><option value="">Todos</option><option' + (fEst === 'COMPRAR' ? ' selected' : '') + '>COMPRAR</option><option' + (fEst === 'BAJO' ? ' selected' : '') + '>BAJO</option><option' + (fEst === 'OK' ? ' selected' : '') + '>OK</option></select>' +
    '<input id="fStkBusq" placeholder="Buscar filtro/N°parte..." aria-label="Buscar filtro o número de parte" value="' + (fBusq || '') + '" onchange="window._pag.stk=1;renders.stk()" style="max-width:200px"></div>' +
    _pagHTML('stk', pg) +
    '<div class="tbl-wrap"><table>' +
    '<tr><th>Equipo <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Descripción <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>N°Parte <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Stock <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Consumido</th><th>Cons/Mes <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Últ.Fecha</th><th>Proy/Mes <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th title="Días de reposición de ESTE ítem. Vacío = usa el default de 34 días (estimación general, no dato real de este ítem)">Lead Time (d)</th><th>Meses</th><th>Estado</th><th>Precio <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th></th><th></th></tr>' +
    pg.items.map(function (s) {
      var i = stk.indexOf(s);
      var lastD = lastUse[s.descripcion] || lastUse[s.nParte] || '—';
      var acum = Math.round(totalCons[s.descripcion] || totalCons[s.nParte] || 0);
      var proy = s.proyMes || 0;
      var cm = s.consumoMes || 0;
      // Estado por lo que llegue primero al lead time (misma fuente que dashboard y
      // predictivo, ver stockEstado). El stock efectivo incluye lo pendiente de llegar.
      var se = stockEstado((s.stockBodega || 0) + (s.pendiente || 0), cm || proy, s.leadTime);
      var meses = se.meses != null ? se.meses : 0;
      var est = se.ico + ' ' + se.txt;
      var is = CELL_INPUT_STYLE + ';font-size:11px;padding:2px';
      return '<tr>' +
        '<td><input value="' + escapeHtml(s.equipoModelo || '') + '" onchange="edI(\'stk\',' + i + ',\'equipoModelo\',this.value)" style="width:70px;background:transparent;border:none;color:var(--tx);font-size:10px"></td>' +
        '<td><input value="' + escapeHtml(s.descripcion || '') + '" onchange="edI(\'stk\',' + i + ',\'descripcion\',this.value)" style="width:100%;background:transparent;border:none;color:var(--tx);font-size:11px"></td>' +
        '<td><input value="' + escapeHtml(s.nParte || '') + '" onchange="edI(\'stk\',' + i + ',\'nParte\',this.value)" style="width:90px;background:transparent;border:none;color:var(--tx3);font-size:10px">' + (s.codAlt ? '<div style="font-size:9px;color:var(--ac);opacity:.8" title="Código alterno (ex Tabla de Precios)">' + escapeHtml(s.codAlt) + '</div>' : '') + '</td>' +
        '<td><input type="number" value="' + (s.stockBodega || 0) + '" onchange="edI(\'stk\',' + i + ',\'stockBodega\',parseInt(this.value)||0)" style="width:45px;' + is + ';color:var(--ac);font-weight:600"></td>' +
        '<td style="text-align:center;font-size:11px;color:var(--tx3)">' + acum + '</td>' +
        '<td><input type="number" value="' + cm + '" onchange="edI(\'stk\',' + i + ',\'consumoMes\',parseInt(this.value)||0)" style="width:40px;' + is + '"></td>' +
        '<td style="font-size:10px;color:var(--tx3)">' + lastD + '</td>' +
        '<td><input type="number" value="' + proy + '" onchange="edI(\'stk\',' + i + ',\'proyMes\',parseInt(this.value)||0)" style="width:40px;' + is + ';color:var(--w);font-weight:600" title="Proyección manual"></td>' +
        '<td><input type="number" value="' + (s.leadTime || '') + '" placeholder="34" onchange="edI(\'stk\',' + i + ',\'leadTime\',parseInt(this.value)||0)" style="width:40px;' + is + (s.leadTime ? '' : ';color:var(--tx3);border-style:dashed') + '" title="' + (s.leadTime ? 'Dato real de este ítem' : 'Sin dato real — usando el default de 34 días') + '"></td>' +
        '<td style="text-align:center" title="' + escapeHtml(se.motivo) + '">' + _mesesGauge(meses, se.nivel) + '</td>' +
        '<td><span style="font-size:10px">' + est + '</span></td>' +
        '<td><input type="number" value="' + (s.precioUnit || 0) + '" onchange="edI(\'stk\',' + i + ',\'precioUnit\',parseInt(this.value)||0)" style="width:55px;' + is + (s.precioUnit ? '' : ';color:var(--tx3);border-style:dashed') + '" title="' + (s.precioUnit ? '' : 'Sin precio cargado (no confirmado que valga $0)') + '"></td>' +
        '<td><button class="btn-s" onclick="verTendenciaStk(' + i + ')" title="Tendencia y proyección de compra">'+ICONS.trend+'</button></td>' +
        '<td><button class="btn-s btn-d" onclick="delRow(\'stk\',' + i + ',\'stk\')" title="Eliminar"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg></button></td></tr>';
    }).join('') +
    '</table></div>' +
    _pagHTML('stk', pg);
  if (typeof _animGauges === 'function') _animGauges('s-stk');
}
export function addStock() {
  sm(`<h3>Nuevo Filtro</h3>
    <div class="form-row"><div class="fg"><label>Equipo/Modelo</label><input id="sEq"></div><div class="fg"><label>Descripción</label><input id="sDesc"></div></div>
    <div class="form-row"><div class="fg"><label>N° Parte</label><input id="sParte"></div><div class="fg"><label>Stock</label><input type="number" id="sStk" value="0"></div><div class="fg"><label>Consumo/Mes</label><input type="number" id="sCon" value="1"></div></div>
    <div class="form-row"><div class="fg"><label>Precio Unit.</label><input type="number" id="sPre" value="0"></div><div class="fg"><label>Lead Time (días)</label><input type="number" id="sLead" placeholder="34 (default si se deja vacío)"></div></div>
    <button class="btn" onclick="saveStock()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button> <button type="button" class="btn btn-o" onclick="_iniciarStockPorVoz()">${ICONS.mic} Completar por voz</button>`);
}
export function saveStock() {
  const stk = S.g('stk') || [];
  stk.push({ equipoModelo: $('sEq').value, descripcion: $('sDesc').value, nParte: $('sParte').value, stockBodega: parseInt($('sStk').value) || 0, consumoMes: parseInt($('sCon').value) || 1, pendiente: 0, mesesCubierto: 0, precioUnit: parseInt($('sPre').value) || 0, leadTime: parseInt($('sLead').value) || 0, comprar: 0, estado: '' });
  S.s('stk', stk); cm(); refreshAll(); toast('✅ Filtro agregado');
}

// Puente window/renders — ver nota en mov.js (mismo grupo de migración).
window.renderStk = renderStk;
window.addStock = addStock;
window.saveStock = saveStock;
window.stkCambiarCobertura = stkCambiarCobertura;
renders.stk = renderStk;
