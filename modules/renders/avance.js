// Pestaña Avance Mensual (Plan vs Ejecución) — extraída a su propio
// archivo (Fase 2 de modularización). Módulo ES real (Fase 3, 2026-08-30,
// cuarta tanda: Metas, KPIs y Reportes) — ver nota de migración en mov.js
// (primera tanda, mismo patrón).
export function renderAvance() {
  if (!$("s-avance")) return;
  var eq = S.g('eq') || []; var reg = S.g('reg') || [];
  var fMes = $('fAvanceMes')?.value || new Date().toISOString().slice(0, 7);
  var meses = mesesAutomaticos();
  var _hoyAv = new Date(); var _hoyAvStr = _hoyAv.toISOString().slice(0, 10);
  var yr = parseInt(fMes.slice(0, 4)); var mn = parseInt(fMes.slice(5, 7));
  var diasMes = new Date(yr, mn, 0).getDate();
  // Día de referencia: si es el mes actual, el día de hoy; si es un mes ya pasado, el mes completo (100%); si es futuro, 0.
  var diaActual = (fMes === _hoyAvStr.slice(0, 7)) ? _hoyAv.getDate() : (fMes < _hoyAvStr.slice(0, 7) ? diasMes : 0);
  var pctEsperado = Math.round(diaActual / diasMes * 100);
  var avanceData = S.g('avanceData') || {};

  var eqAvance = eq.map(function (e) {
    var regM = reg.filter(function (r) { return r.equipo === e.sigla && (r.fechaEntrada || r.fechaEjec || '').slice(0, 7) === fMes });
    var planificados = avanceData[e.sigla] ? avanceData[e.sigla][fMes] || 0 : 0;
    var ejecutados = regM.length;
    var pctAvance = planificados > 0 ? Math.round(ejecutados / planificados * 100) : (ejecutados > 0 ? 100 : null);
    var diff = pctAvance === null ? null : pctAvance - pctEsperado;
    return { sigla: e.sigla, tipo: e.tipo, plan: planificados, ejec: ejecutados, pct: pctAvance, esp: pctEsperado, diff: diff };
  });

  var totalPlan = eqAvance.reduce(function (s, e) { return s + e.plan }, 0);
  var totalEjec = eqAvance.reduce(function (s, e) { return s + e.ejec }, 0);
  var totalPct = totalPlan > 0 ? Math.round(totalEjec / totalPlan * 100) : null;

  $('s-avance').innerHTML =
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,15 8,10 11,13 17,4"/><polyline points="12,4 17,4 17,9"/></svg> Avance Mensual</div>' +
    '<div class="sec-s">Plan vs Ejecución · Día ' + diaActual + ' de ' + diasMes + ' (' + pctEsperado + '% del mes)</div></div></div>' +
    '<div class="toolbar"><select id="fAvanceMes" onchange="renders.avance()">' +
    meses.map(function (m) { return '<option' + (fMes === m ? ' selected' : '') + '>' + m + '</option>' }).join('') + '</select></div>' +

    // Progress bar general
    '<div style="background:var(--bg3);border-radius:10px;padding:16px;margin-bottom:16px">' +
    '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:12px;font-weight:700">Avance Flota</span><span style="font-size:20px;font-weight:800;color:' + (totalPct === null ? 'var(--tx3)' : totalPct >= pctEsperado ? 'var(--ok)' : 'var(--danger)') + '">' + (totalPct === null ? '—' : totalPct + '%') + '</span></div>' +
    '<div style="position:relative;background:color-mix(in srgb,' + (totalPct === null ? 'var(--tx3)' : totalPct >= pctEsperado ? 'var(--ok)' : 'var(--danger)') + ' 18%,var(--bg4));border-radius:8px;height:20px;overflow:hidden">' +
    '<div style="position:absolute;left:' + pctEsperado + '%;top:0;bottom:0;width:2px;background:var(--tx3);z-index:2"></div>' +
    '<div style="background:' + (totalPct === null ? 'var(--tx3)' : totalPct >= pctEsperado ? 'var(--ok)' : 'var(--danger)') + ';height:100%;width:' + Math.min(totalPct || 0, 100) + '%;border-radius:8px;transition:width .3s"></div></div>' +
    '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--tx3);margin-top:4px"><span>' + totalEjec + ' de ' + totalPlan + ' PMs</span><span>Esperado: ' + pctEsperado + '%</span></div></div>' +

    '<div class="tbl-wrap"><table>' +
    '<tr><th>Equipo</th><th>Tipo</th><th>PM Plan</th><th>PM Ejec</th><th>%Avance</th><th>Barra</th><th>%Esperado</th><th>Diferencia</th><th>Estado</th></tr>' +
    eqAvance.map(function (e, i) {
      var sinPlan = e.pct === null;
      var col = sinPlan ? 'var(--tx3)' : e.pct >= e.esp ? 'var(--ok)' : e.pct >= e.esp * 0.7 ? 'var(--w)' : 'var(--danger)';
      return '<tr>' +
        '<td class="mono" style="color:var(--ac)">' + escapeHtml(e.sigla) + '</td>' +
        '<td style="font-size:11px">' + escapeHtml(e.tipo) + '</td>' +
        '<td class="ed mono" contenteditable onblur="var a=S.g(\'avanceData\')||{};if(!a[\'' + escapeHtml(e.sigla) + '\'])a[\'' + escapeHtml(e.sigla) + '\']={}; a[\'' + escapeHtml(e.sigla) + '\'][\'' + fMes + '\']=parseInt(this.innerText)||0;S.s(\'avanceData\',a);refreshAll()" style="color:var(--info);text-align:center">' + e.plan + '</td>' +
        '<td class="mono" style="text-align:center;font-weight:600">' + e.ejec + '</td>' +
        '<td class="mono" style="color:' + col + ';font-weight:700;text-align:center">' + (sinPlan ? '—' : e.pct + '%') + '</td>' +
        '<td><div style="position:relative;background:color-mix(in srgb,' + col + ' 18%,var(--bg4));border-radius:4px;height:12px;width:100px;overflow:hidden"><div style="position:absolute;left:' + e.esp + '%;top:0;bottom:0;width:1px;background:var(--tx3)"></div><div style="background:' + col + ';height:100%;width:' + Math.min(e.pct || 0, 100) + '%"></div></div></td>' +
        '<td class="mono" style="text-align:center;color:var(--tx3)">' + e.esp + '%</td>' +
        '<td class="mono" style="text-align:center;color:' + col + ';font-weight:600">' + (sinPlan ? '—' : (e.diff >= 0 ? '+' : '') + e.diff + '%') + '</td>' +
        '<td style="font-size:10px">' + (sinPlan ? '⚪ SIN PLAN' : e.pct >= e.esp ? '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> EN PLAN' : e.pct >= e.esp * 0.7 ? '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> RIESGO' : '🔴 ATRASADO') + '</td></tr>';
    }).join('') +
    '<tr style="font-weight:700;background:var(--bg3)"><td colspan="2">TOTAL FLOTA</td>' +
    '<td style="text-align:center">' + totalPlan + '</td><td style="text-align:center">' + totalEjec + '</td>' +
    '<td style="text-align:center;color:' + (totalPct === null ? 'var(--tx3)' : totalPct >= pctEsperado ? 'var(--ok)' : 'var(--danger)') + '">' + (totalPct === null ? '—' : totalPct + '%') + '</td>' +
    '<td></td><td style="text-align:center">' + pctEsperado + '%</td>' +
    '<td style="text-align:center;color:' + (totalPct === null ? 'var(--tx3)' : totalPct >= pctEsperado ? 'var(--ok)' : 'var(--danger)') + '">' + (totalPct === null ? '—' : (totalPct - pctEsperado >= 0 ? '+' : '') + (totalPct - pctEsperado) + '%') + '</td>' +
    '<td>' + (totalPct === null ? '⚪ SIN PLAN' : totalPct >= pctEsperado ? '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> EN PLAN' : '🔴 ATRASADO') + '</td></tr>' +
    '</table></div>' +
    '<div class="chart-box" style="margin-top:18px;border-left:3px solid var(--ac)"><div class="chart-t">Curva S de PM</div>' +
    '<div style="font-size:12px;color:var(--tx2);padding:4px 0 10px">La curva S del programa de mantención (plan vs real por semana, mes, semestre o año) está en <b>Planificación y Agenda → Planificador</b>.</div>' +
    '<button class="btn" onclick="window._planiSub=\'plan\';go(\'plani\')">Abrir en el Planificador</button></div>';
}

// ═══ CURVA S DE PM Y CUMPLIMIENTO DEL PROGRAMA (2026-10-11) ═══ — ver curvaSPM / cumplimientoProgramaMeses (logic.js): plan = hitos de horómetro del mes, ponderado por las
// horas estándar de cada PM (Configuración); real = registros de PM del mes. Acumulado día a día.
function _avanceCurvaSVG(c) {
  var W = 680, H = 270, pl = 46, pr = 14, pt = 14, pb = 34, iw = W - pl - pr, ih = H - pt - pb;
  var maxY = Math.max(1, c.totales.planH, c.serie[c.diaCorte] && c.serie[c.diaCorte].realH || 0, c.proyeccionCierreH || 0);
  var paso = maxY <= 20 ? 5 : maxY <= 60 ? 10 : maxY <= 150 ? 25 : maxY <= 400 ? 50 : 100;
  var topY = Math.ceil(maxY / paso) * paso;
  var X = function (d) { return pl + d / c.dias * iw; }, Y = function (v) { return pt + ih - v / topY * ih; };
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Curva S de PM: horas planificadas y ejecutadas acumuladas por día" style="display:block;max-width:820px">';
  for (var g = 0; g <= topY; g += paso) svg += '<line x1="' + pl + '" y1="' + Y(g) + '" x2="' + (W - pr) + '" y2="' + Y(g) + '" stroke="var(--bd)" stroke-width="1" opacity=".6"/><text x="' + (pl - 6) + '" y="' + (Y(g) + 3) + '" text-anchor="end" font-size="10" fill="var(--tx3)">' + g + '</text>';
  var MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'], DIAS_C = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  var ticks = [];
  for (var d = 1; d <= c.dias; d++) {
    var fd = c.serie[d].fecha, dn = parseInt(fd.slice(8, 10), 10);
    if (c.periodo === 'semana') ticks.push([d, DIAS_C[new Date(fd + 'T12:00:00').getDay()] + ' ' + dn]);
    else if (c.periodo === 'mes') { if (dn === 1 || dn % 5 === 0) ticks.push([d, '' + dn]); }
    else if (dn === 1) ticks.push([d, MESES_C[parseInt(fd.slice(5, 7), 10) - 1]]);
  }
  ticks.forEach(function (tk) { svg += '<text x="' + X(tk[0]) + '" y="' + (H - pb + 14) + '" text-anchor="middle" font-size="10" fill="var(--tx3)">' + tk[1] + '</text>'; });
  svg += '<text x="' + (pl + iw / 2) + '" y="' + (H - 4) + '" text-anchor="middle" font-size="10" fill="var(--tx3)">' + (c.periodo === 'semana' || c.periodo === 'mes' ? 'día' : 'mes') + '</text><text x="10" y="' + (pt + ih / 2) + '" font-size="10" fill="var(--tx3)" transform="rotate(-90 10 ' + (pt + ih / 2) + ')" text-anchor="middle">horas de PM acumuladas</text>';
  var linea = function (serie, key, hasta) { var pts = []; for (var i = 0; i <= hasta; i++) if (serie[i][key] != null) pts.push(X(i).toFixed(1) + ',' + Y(serie[i][key]).toFixed(1)); return pts.join(' '); };
  svg += '<polyline points="' + linea(c.serie, 'planH', c.dias) + '" fill="none" stroke="var(--tx3)" stroke-width="2" stroke-dasharray="6 4" stroke-linejoin="round"/>';
  if (c.diaCorte > 0) {
    svg += '<polyline points="' + linea(c.serie, 'realH', c.diaCorte) + '" fill="none" stroke="var(--ac)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    var r = c.serie[c.diaCorte].realH;
    svg += '<circle cx="' + X(c.diaCorte) + '" cy="' + Y(r) + '" r="4.5" fill="var(--ac)" stroke="var(--bg2)" stroke-width="2"/>';
    if (c.diaCorte < c.dias) {
      svg += '<line x1="' + X(c.diaCorte) + '" y1="' + pt + '" x2="' + X(c.diaCorte) + '" y2="' + (pt + ih) + '" stroke="var(--tx3)" stroke-width="1" stroke-dasharray="2 3"/><text x="' + (X(c.diaCorte) + 4) + '" y="' + (pt + 10) + '" font-size="10" fill="var(--tx3)">hoy</text>';
      if (c.proyeccionCierreH != null) svg += '<line x1="' + X(c.diaCorte) + '" y1="' + Y(r) + '" x2="' + X(c.dias) + '" y2="' + Y(c.proyeccionCierreH) + '" stroke="var(--ac)" stroke-width="2" stroke-dasharray="2 4" opacity=".7"/><circle cx="' + X(c.dias) + '" cy="' + Y(c.proyeccionCierreH) + '" r="3.5" fill="var(--bg2)" stroke="var(--ac)" stroke-width="2"/>';
    }
  }
  // zonas de hover por día (el navegador muestra el <title>)
  for (var k = 1; k <= c.dias; k++) {
    var sp = c.serie[k], w = iw / c.dias;
    svg += '<rect x="' + (X(k) - w / 2) + '" y="' + pt + '" width="' + w + '" height="' + ih + '" fill="transparent"><title>' + 'Día ' + k + ' (' + sp.fecha + ') · plan ' + sp.planH + ' h (' + sp.planN + ' PM)' + (sp.realH != null ? ' · real ' + sp.realH + ' h (' + sp.realN + ' PM)' : '') + '</title></rect>';
  }
  return svg + '</svg>';
}
var _MESES_L = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function _curvaFmt(iso) { return parseInt(iso.slice(8, 10), 10) + '-' + _MESES_L[parseInt(iso.slice(5, 7), 10) - 1]; }
var _curvaEtiqueta = periodoEtiqueta, _curvaOpciones = periodoOpciones;   // logic.js (el selector de Disponibilidad usa los mismos)
function _sumarDias(iso, n) { return new Date(new Date(iso + 'T12:00:00').getTime() + n * 86400000).toISOString().slice(0, 10); }
function _avanceCurvaSHTML(eq, reg, rerender) {
  rerender = rerender || 'renders.avance()';
  try {
    if (typeof curvaSPM !== 'function') return '';
    var cfg = S.g('cfg') || {}, hist = S.g('hist') || [];
    var hoy = new Date().toISOString().slice(0, 10);
    var tipo = $('fCurvaTipo') ? $('fCurvaTipo').value : 'mes';
    var opts = _curvaOpciones(tipo, hoy);
    var ref = $('fCurvaRef') ? $('fCurvaRef').value : '';
    if (window._curvaTipoPrev !== tipo || !opts.some(function (x) { return x.v === ref; })) ref = periodoRango(tipo, hoy).desde;
    window._curvaTipoPrev = tipo;
    var d = { reg: reg, hist: hist, hoy: hoy }, o = { periodo: tipo, ref: ref, duraciones: cfg.duracionPMHoras };
    var c = curvaSPM(eq, d, o);
    var etq = _curvaEtiqueta(tipo, c.desde, c.hasta);
    var controles = '<div class="toolbar" style="margin:0 0 10px"><select id="fCurvaTipo" onchange="' + rerender + '" title="Período de la curva">' +
      [['semana', 'Semana'], ['mes', 'Mes'], ['semestre', 'Semestre'], ['anio', 'Año']].map(function (t) { return '<option value="' + t[0] + '"' + (t[0] === tipo ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select>' +
      '<select id="fCurvaRef" onchange="' + rerender + '">' + opts.map(function (x) { return '<option value="' + x.v + '"' + (x.v === ref ? ' selected' : '') + '>' + escapeHtml(x.label) + '</option>'; }).join('') + '</select></div>';
    var pf = function (x) { return x == null ? '—' : Math.round(x * 100) + '%'; };
    var h1 = function (x) { return (Math.round(x * 10) / 10 + '').replace('.', ','); };
    var col = c.cumplimiento == null ? 'var(--tx3)' : c.cumplimiento >= 0.95 ? 'var(--ok)' : c.cumplimiento >= 0.8 ? 'var(--w)' : 'var(--danger)';
    var dur = c.duraciones;
    var cab = '<div class="chart-box" style="margin-top:18px;border-left:3px solid var(--ac)"><div class="chart-t">Curva S de PM — plan vs real acumulado (horas) · ' + escapeHtml(etq) + '</div>' + controles +
      '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px;line-height:1.5">El <b>plan</b> son los PM que cada equipo debe alcanzar en el período según su horómetro y su frecuencia, con el tipo que corresponde a cada hito. Cada PM pesa sus <b>horas estándar</b> (PM1 ' + dur.PM1 + ' h · PM2 ' + dur.PM2 + ' h · PM3 ' + dur.PM3 + ' h · PM4 ' + dur.PM4 + ' h; se cambian en Configuración), así un PM4 pesa lo que cuatro PM1. Lo <b>real</b> son los PM registrados. No incluye PM vencidos de períodos anteriores: si se hacen tarde cuentan como ejecutados cuando se hacen.</div>';
    if (!c.totales.planH && !c.totales.realH) {
      return cab + '<div style="font-size:12px;color:var(--tx3);padding:4px 0">Sin PM planificados ni ejecutados para este período con los datos disponibles' + (c.sinBase.length ? ' (' + c.sinBase.length + ' equipo(s) sin lectura de horómetro al inicio del período)' : '') + '.</div></div>';
    }
    var tarj = function (t, v, sub, colr) { return '<div class="card"><div class="card-t">' + t + '</div><div class="card-v" style="' + (colr ? 'color:' + colr : '') + '">' + v + '</div><div class="card-s">' + sub + '</div></div>'; };
    var enCurso = c.diaCorte > 0 && c.diaCorte < c.dias;
    var tarjetas = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin-bottom:10px">' +
      tarj('Cumplimiento ' + (enCurso ? 'a la fecha' : 'del período'), pf(c.cumplimiento), h1(c.totales.realH) + ' h ejecutadas de ' + h1(c.totales.planCorteH) + ' h' + (enCurso ? ' que tocaban a hoy' : ''), col) +
      tarj('Por cantidad de PM', pf(c.cumplimientoN), fn(c.totales.realN) + ' ejecutados de ' + fn(c.totales.planCorteN) + ' que tocaban') +
      tarj('Brecha', (c.brechaH > 0 ? '−' : '+') + h1(Math.abs(c.brechaH)) + ' h', c.brechaH > 0 ? 'faltan por ejecutar respecto del plan a la fecha' : 'adelanto sobre el plan a la fecha', c.brechaH > 0 ? 'var(--w)' : 'var(--ok)') +
      (enCurso ? tarj('Cierre proyectado', pf(c.proyeccionCierrePct), 'de ' + h1(c.totales.planH) + ' h del período, si se mantiene el ritmo', c.proyeccionCierrePct != null && c.proyeccionCierrePct < 0.9 ? 'var(--w)' : 'var(--ok)') : tarj('Plan del período', h1(c.totales.planH) + ' h', fn(c.totales.planN) + ' PM')) + '</div>';
    var leyenda = '<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:11px;color:var(--tx2);margin:2px 0 6px"><span><svg width="26" height="8" style="vertical-align:middle"><line x1="0" y1="4" x2="26" y2="4" stroke="var(--tx3)" stroke-width="2" stroke-dasharray="6 4"/></svg> Plan acumulado</span><span><svg width="26" height="8" style="vertical-align:middle"><line x1="0" y1="4" x2="26" y2="4" stroke="var(--ac)" stroke-width="2.5"/></svg> Real acumulado</span>' + (enCurso ? '<span><svg width="26" height="8" style="vertical-align:middle"><line x1="0" y1="4" x2="26" y2="4" stroke="var(--ac)" stroke-width="2" stroke-dasharray="2 4"/></svg> Proyección al cierre</span>' : '') + '</div>';
    var avisos = '';
    if (c.sinBase.length) avisos += '<div style="font-size:10px;color:var(--tx3);margin-top:6px">Sin lectura de horómetro al inicio del período (no entran al plan): ' + c.sinBase.map(escapeHtml).join(', ') + '.</div>';
    if (c.anomalos.length) avisos += '<div style="font-size:10px;color:var(--w);margin-top:4px">Horómetro con más horas que las posibles en el período (lectura dudosa, no entran al plan): ' + c.anomalos.map(escapeHtml).join(', ') + '.</div>';
    if (c.estimados.length) avisos += '<div style="font-size:10px;color:var(--tx3);margin-top:4px">Plan anclado a la primera lectura del período (no había una anterior): ' + c.estimados.map(escapeHtml).join(', ') + '.</div>';
    if (c.sinTipo) avisos += '<div style="font-size:10px;color:var(--tx3);margin-top:4px">' + fn(c.sinTipo) + ' registro(s) con tipo de PM desconocido no suman horas.</div>';
    if (c.realTiposAntiguos) avisos += '<div style="font-size:10px;color:var(--tx3);margin-top:4px">' + fn(c.realTiposAntiguos) + ' registro(s) con tipo antiguo (PM5–PM9) se contaron como su PM equivalente.</div>';
    var filasEq = c.equipos.filter(function (x) { return x.planN || x.realN; }).slice(0, 10).map(function (x) {
      var cc = x.cumplimiento == null ? 'var(--tx3)' : x.cumplimiento >= 0.95 ? 'var(--ok)' : x.cumplimiento >= 0.8 ? 'var(--w)' : 'var(--danger)';
      return '<tr><td class="mono" style="color:var(--ac)">' + escapeHtml(x.sigla) + '</td><td class="mono" style="text-align:right">' + fn(x.planCorteN) + ' / ' + fn(x.realN) + '</td><td class="mono" style="text-align:right">' + h1(x.planCorteH) + ' / ' + h1(x.realH) + '</td><td class="mono" style="text-align:right;color:' + cc + ';font-weight:700">' + pf(x.cumplimiento) + '</td><td class="mono" style="text-align:right">' + (x.atrasoH > 0 ? '−' + h1(x.atrasoH) + ' h' : '—') + '</td></tr>';
    }).join('');
    var tipos = ['PM1', 'PM2', 'PM3', 'PM4'].map(function (t) { var x = c.tipos[t]; return '<tr><td style="font-weight:600">' + t + ' <span style="color:var(--tx3)">(' + x.horas + ' h)</span></td><td class="mono" style="text-align:right">' + fn(x.planCorte) + '</td><td class="mono" style="text-align:right">' + fn(x.real) + '</td><td class="mono" style="text-align:right">' + h1(x.planCorte * x.horas) + ' / ' + h1(x.real * x.horas) + '</td></tr>'; }).join('');
    var nPrev = tipo === 'semana' ? 8 : tipo === 'mes' ? 8 : tipo === 'semestre' ? 4 : 3, perLista = [], curP = periodoRango(tipo, hoy);
    for (var ip = 0; ip < nPrev; ip++) { perLista.unshift({ desde: curP.desde, hasta: curP.hasta, periodo: tipo, etiqueta: _curvaEtiqueta(tipo, curP.desde, curP.hasta) }); curP = periodoRango(tipo, _sumarDias(curP.desde, -1)); }
    var hist8 = cumplimientoProgramaPeriodos(eq, d, perLista, { duraciones: cfg.duracionPMHoras });
    var histHTML = hist8.length ? '<div style="font-weight:700;font-size:12px;margin:14px 0 4px">Cumplimiento del programa ' + ({ semana: 'semana a semana', mes: 'mes a mes', semestre: 'semestre a semestre', anio: 'año a año' })[tipo] + '</div><div class="tbl-wrap"><table style="font-size:11px"><tr><th>Período</th><th style="text-align:right">Horas plan / real</th><th style="text-align:right">PM plan / real</th><th style="text-align:right">Cumplimiento (horas)</th><th style="width:34%"></th></tr>' +
      hist8.map(function (m) {
        var cc = m.cumplimiento >= 0.95 ? 'var(--ok)' : m.cumplimiento >= 0.8 ? 'var(--w)' : 'var(--danger)', w = Math.min(100, Math.round(m.cumplimiento * 100));
        return '<tr><td class="mono">' + escapeHtml(m.etiqueta) + (m.parcial ? ' <span style="color:var(--tx3)">(en curso)</span>' : '') + '</td><td class="mono" style="text-align:right">' + h1(m.planH) + ' / ' + h1(m.realH) + '</td><td class="mono" style="text-align:right">' + fn(m.planN) + ' / ' + fn(m.realN) + '</td><td class="mono" style="text-align:right;color:' + cc + ';font-weight:700">' + pf(m.cumplimiento) + '</td><td><div style="background:var(--bg4);border-radius:4px;height:10px"><div style="background:' + cc + ';height:100%;width:' + w + '%;border-radius:4px"></div></div></td></tr>';
      }).join('') + '</table></div><div style="font-size:10px;color:var(--tx3);margin-top:4px">Más de 100 % significa más PM hechos que hitos alcanzados en el período (PM atrasados que se pusieron al día o anticipados). Solo se muestran períodos con lectura de horómetro en al menos la mitad de los equipos.</div>' : '';
    var diaria;
    if (c.periodo === 'semana' || c.periodo === 'mes') {
      diaria = '<details style="margin-top:10px"><summary style="cursor:pointer;font-size:11px;color:var(--tx2)">Ver tabla diaria</summary><div class="tbl-wrap"><table style="font-size:10px"><tr><th>Día</th><th style="text-align:right">Plan (h)</th><th style="text-align:right">Real (h)</th><th style="text-align:right">Plan (PM)</th><th style="text-align:right">Real (PM)</th></tr>' +
        c.serie.slice(1).map(function (x) { return '<tr><td class="mono">' + escapeHtml(_curvaFmt(x.fecha)) + '</td><td class="mono" style="text-align:right">' + x.planH + '</td><td class="mono" style="text-align:right">' + (x.realH == null ? '—' : x.realH) + '</td><td class="mono" style="text-align:right">' + x.planN + '</td><td class="mono" style="text-align:right">' + (x.realN == null ? '—' : x.realN) + '</td></tr>'; }).join('') + '</table></div></details>';
    } else {
      var porMes = {}, orden = [];
      c.serie.slice(1).forEach(function (x) { var k = x.fecha.slice(0, 7); if (!porMes[k]) { porMes[k] = { k: k }; orden.push(k); } porMes[k].fin = x; });
      var antes = { planH: 0, realH: 0 };
      diaria = '<details style="margin-top:10px"><summary style="cursor:pointer;font-size:11px;color:var(--tx2)">Ver tabla mensual</summary><div class="tbl-wrap"><table style="font-size:10px"><tr><th>Mes</th><th style="text-align:right">Plan del mes (h)</th><th style="text-align:right">Real del mes (h)</th><th style="text-align:right">Plan acumulado (h)</th><th style="text-align:right">Real acumulado (h)</th></tr>' +
        orden.map(function (k) {
          var f = porMes[k].fin, rH = f.realH, mp = f.planH - antes.planH, mr = rH == null ? null : rH - antes.realH;
          antes = { planH: f.planH, realH: rH == null ? antes.realH : rH };
          return '<tr><td class="mono">' + escapeHtml(_MESES_L[parseInt(k.slice(5, 7), 10) - 1] + ' ' + k.slice(0, 4)) + '</td><td class="mono" style="text-align:right">' + mp + '</td><td class="mono" style="text-align:right">' + (mr == null ? '—' : mr) + '</td><td class="mono" style="text-align:right">' + f.planH + '</td><td class="mono" style="text-align:right">' + (rH == null ? '—' : rH) + '</td></tr>';
        }).join('') + '</table></div></details>';
    }
    return cab + tarjetas + leyenda + _avanceCurvaSVG(c) + avisos +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin-top:12px"><div><div style="font-weight:700;font-size:12px;margin-bottom:4px">Equipos con más atraso</div><div class="tbl-wrap"><table style="font-size:11px"><tr><th>Equipo</th><th style="text-align:right">PM plan / real</th><th style="text-align:right">Horas plan / real</th><th style="text-align:right">Cumpl.</th><th style="text-align:right">Atraso</th></tr>' + (filasEq || '<tr><td colspan="5" style="color:var(--tx3)">Sin datos</td></tr>') + '</table></div></div>' +
      '<div><div style="font-weight:700;font-size:12px;margin-bottom:4px">Por tipo de PM</div><div class="tbl-wrap"><table style="font-size:11px"><tr><th>Tipo</th><th style="text-align:right">Plan</th><th style="text-align:right">Real</th><th style="text-align:right">Horas plan / real</th></tr>' + tipos + '</table></div></div></div>' +
      histHTML + diaria + '</div>';
  } catch (e) { return ''; }
}

// Puente window/renders — ver nota en mov.js (primera tanda).
// La curva S de PM se muestra en Planificación y Agenda → Planificador (plan.js la pide por window).
window._avanceCurvaSBloque = function (rerender) { return _avanceCurvaSHTML(S.g('eq') || [], S.g('reg') || [], rerender); };
window.renderAvance = renderAvance;
renders.avance = renderAvance;
