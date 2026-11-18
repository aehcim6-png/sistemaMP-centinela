// Pestaña Informe de gestión (sub-pestaña de Metas & KPIs): las secciones I y II (certeza y cumplimiento de programa), III (desviaciones de mantenimiento), IV (equipos fuera de servicio) y V (backlog de pautas) del informe semanal que
// arma el cliente ("Centinela Ripios OXE"), calculadas con los datos del sistema. El cálculo vive en logic.js (informeGestionPM / informeGestionFS / informeConfiabilidadPM, con pruebas);
// acá solo se dibuja. Módulo ES lazy, mismo patrón que avance.js.
function _gestSumar(iso, n) { return new Date(new Date(iso + 'T12:00:00').getTime() + n * 86400000).toISOString().slice(0, 10); }
function _gestRango() {
  var hoy = new Date().toISOString().slice(0, 10), r = window._gestionRango;
  return r && r.desde && r.hasta ? r : { desde: _gestSumar(hoy, -6), hasta: hoy };
}
// Rango rápido: semana (últimos 7 días), mes en curso (hasta su último día), año en curso o todo el historial.
export function gestionPeriodo(p) {
  var hoy = new Date().toISOString().slice(0, 10);
  window._gestionRango = p === 'sem' ? { desde: _gestSumar(hoy, -6), hasta: hoy }
    : p === 'mes' ? { desde: hoy.slice(0, 8) + '01', hasta: new Date(+hoy.slice(0, 4), +hoy.slice(5, 7), 0, 12).toISOString().slice(0, 10) }
    : p === 'anio' ? { desde: hoy.slice(0, 5) + '01-01', hasta: hoy }
    : { desde: '2000-01-01', hasta: hoy };
  renders.gestion();
}
export function gestionRango() {
  var d = $('fGestDesde') && $('fGestDesde').value, h = $('fGestHasta') && $('fGestHasta').value;
  if (d && h && d <= h) window._gestionRango = { desde: d, hasta: h };
  else if (d && h) { toast('La fecha "desde" no puede ser posterior a "hasta"'); }
  renders.gestion();
}
// Backlog de pautas (sección V): alta, cierre y cambio de insumo de una tarea pendiente. Se guarda en la tabla backlog_pm (clave backlogPM).
export function gestionCalidadEq() {
  var v = $('fGestCalEq'); window._gestionCalidadEq = v ? v.value : '';
  renders.gestion();
}
// Actividad por período (sección IX): mensual, trimestral o anual.
export function gestionActividadPer() {
  var v = $('fGestActPer'); window._gestionActPer = v ? v.value : 'mes';
  renders.gestion();
}
export function gestionBacklogAgregar() {
  var sigla = $('bkSigla') && $('bkSigla').value, tarea = ($('bkTarea') && $('bkTarea').value || '').trim();
  if (!sigla || !tarea) { toast('Elige el equipo y escribe la tarea pendiente'); return; }
  var e = (S.g('eq') || []).find(function (x) { return x.sigla === sigla; }) || {}, bk = S.g('backlogPM') || [];
  bk.push({ sigla: sigla, fecha: new Date().toISOString().slice(0, 10), horomBacklog: e.horomActual > 0 ? e.horomActual : null, tarea: tarea,
    sistema: ($('bkSistema') && $('bkSistema').value || '').trim(), conInsumo: !!($('bkInsumo') && $('bkInsumo').checked), fechaCierre: null, observacion: '' });
  S.s('backlogPM', bk); toast('Tarea pendiente agregada'); renders.gestion();
}
export function gestionBacklogCerrar(i) {
  var bk = S.g('backlogPM') || [];
  if (!bk[i] || !confirm('¿Cerrar esta tarea pendiente? Quedará registrada con la fecha de hoy.')) return;
  bk[i].fechaCierre = new Date().toISOString().slice(0, 10); S.s('backlogPM', bk); renders.gestion();
}
export function gestionBacklogInsumo(i) {
  var bk = S.g('backlogPM') || [];
  if (!bk[i]) return;
  bk[i].conInsumo = !bk[i].conInsumo; S.s('backlogPM', bk); renders.gestion();
}
// Gráfico de barras de la desviación en horas de cada PM (como el gráfico del informe del cliente): verde dentro del estándar, ámbar adelantada, rojo atrasada.
function _gestGrafico(filas, tol) {
  var n = filas.length; if (!n) return '';
  var maxAbs = Math.max.apply(null, filas.map(function (f) { return Math.abs(f.horas); }).concat([tol, 10]));
  var tope = Math.ceil(maxAbs / 10) * 10, ancho = Math.max(n * 34 + 60, 320), alto = 220, y0 = alto / 2, esc = (alto / 2 - 24) / tope, bw = 20;
  var col = { dentro: 'var(--ok)', adelantada: 'var(--w)', atrasada: 'var(--danger)' };
  var svg = '<line x1="44" y1="' + y0 + '" x2="' + (ancho - 6) + '" y2="' + y0 + '" stroke="var(--bd)"/>';
  if (tol) svg += '<rect x="44" y="' + (y0 - tol * esc).toFixed(1) + '" width="' + (ancho - 50) + '" height="' + (tol * 2 * esc).toFixed(1) + '" fill="var(--ok)" opacity=".10"/>' +
    '<text x="46" y="' + (y0 - tol * esc - 3).toFixed(1) + '" font-size="9" fill="var(--tx3)">+' + tol + ' h</text><text x="46" y="' + (y0 + tol * esc + 10).toFixed(1) + '" font-size="9" fill="var(--tx3)">−' + tol + ' h</text>';
  [tope, -tope].forEach(function (v) { svg += '<text x="40" y="' + (y0 - v * esc + 3).toFixed(1) + '" font-size="9" text-anchor="end" fill="var(--tx3)">' + (v > 0 ? '+' : '−') + Math.abs(v) + '</text>'; });
  filas.forEach(function (f, i) {
    var x = 52 + i * 34, h = Math.abs(f.horas) * esc, y = f.horas >= 0 ? y0 - h : y0;
    svg += '<rect x="' + x + '" y="' + y.toFixed(1) + '" width="' + bw + '" height="' + Math.max(h, 1).toFixed(1) + '" fill="' + col[f.clase] + '"><title>' + escapeHtml(f.sigla + ' · ' + f.fecha + ' · ' + (f.horas > 0 ? '+' : '') + f.horas + ' h') + '</title></rect>' +
      '<text x="' + (x + bw / 2) + '" y="' + (f.horas >= 0 ? y - 3 : y + h + 10).toFixed(1) + '" font-size="9" text-anchor="middle" fill="var(--tx2)">' + (f.horas > 0 ? '+' : '') + f.horas + '</text>' +
      '<text transform="translate(' + (x + bw / 2 + 3) + ',' + (alto - 2) + ') rotate(-60)" font-size="9" fill="var(--tx3)">' + escapeHtml(f.sigla) + '</text>';
  });
  return '<div style="overflow-x:auto"><svg viewBox="0 0 ' + ancho + ' ' + (alto + 34) + '" style="min-width:' + ancho + 'px;max-width:100%;height:auto;display:block" role="img" aria-label="Desviación de mantenimiento en horas de cada PM">' + svg + '</svg></div>';
}
export function renderGestion() {
  if (!$('s-gestion')) return;
  var reg = S.g('reg') || [], eq = S.g('eq') || [], ot = S.g('ot') || [];
  var rg = _gestRango(), hoy = new Date().toISOString().slice(0, 10);
  var pm = informeGestionPM(reg, eq, rg.desde, rg.hasta), r = pm.resumen, fs = informeGestionFS(ot, eq, reg, hoy);
  var pr = informeProgramaSemanal(eq, reg, S.g('hist') || [], rg.desde, rg.hasta, hoy), rp = pr.resumen, bk = informeBacklogPM(S.g('backlogPM') || [], eq, hoy), rb = bk.resumen;
  var tolPct = Math.round(pm.tolerancia * 100);
  var frecs = {}; pm.filas.forEach(function (f) { frecs[f.frec] = 1; });
  var frecUnica = Object.keys(frecs).length === 1 ? +Object.keys(frecs)[0] : null, tolH = frecUnica ? Math.round(frecUnica * pm.tolerancia) : null;
  var colCls = { dentro: 'var(--ok)', adelantada: 'var(--w)', atrasada: 'var(--danger)' }, txtCls = { dentro: 'Dentro del estándar', adelantada: 'Adelantada', atrasada: 'Atrasada' };
  var sg = function (v) { return (v > 0 ? '+' : '') + v; };
  var card = function (t, v, s, c) { return '<div class="card"><div class="card-t">' + t + '</div><div class="card-v"' + (c ? ' style="color:' + c + '"' : '') + '>' + v + '</div><div class="card-s">' + s + '</div></div>'; };
  var btn = function (t, p) { return '<button class="btn btn-o" onclick="gestionPeriodo(\'' + p + '\')">' + t + '</button>'; };
  var pct = r.pct == null ? '—' : r.pct + '%', colPct = r.pct == null ? 'inherit' : r.pct >= 90 ? 'var(--ok)' : r.pct >= 75 ? 'var(--w)' : 'var(--danger)';
  var noEval = r.hitoSinRegistro + r.repetidos + r.sinDato;
  var tablaPM = pm.filas.length ?
    '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Sigla</th><th>Marca / modelo</th><th>PM</th><th>Fecha del PM</th><th style="text-align:right">Horómetro programa</th><th style="text-align:right">Horómetro real</th><th style="text-align:right">Desviación (h)</th><th style="text-align:right">Desviación (%)</th><th>Estado</th></tr>' +
    pm.filas.map(function (f) {
      return '<tr><td class="mono" style="color:var(--ac)">' + escapeHtml(f.sigla) + '</td><td>' + escapeHtml(f.modelo) + '</td><td>' + escapeHtml(f.tipoPM) + '</td><td class="mono">' + escapeHtml(fd(f.fecha)) + '</td>' +
        '<td class="mono" style="text-align:right">' + fn(f.horomPrograma) + '</td><td class="mono" style="text-align:right">' + fn(f.horomReal) + '</td>' +
        '<td class="mono" style="text-align:right;font-weight:700;color:' + colCls[f.clase] + '">' + sg(f.horas) + '</td><td class="mono" style="text-align:right">' + sg(f.pct) + '%</td>' +
        '<td style="color:' + colCls[f.clase] + ';font-weight:600">' + txtCls[f.clase] + '</td></tr>';
    }).join('') + '</table></div>'
    : '<div style="padding:18px;text-align:center;color:var(--tx3)">No hay PM con desvío calculable en este período.</div>';
  var tablaFS = fs.filas.length ?
    '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Sigla</th><th>Marca / modelo</th><th style="text-align:right">Horómetro actual</th><th>Último PM</th><th style="text-align:right">Horómetro último PM</th><th>Fuera de servicio desde</th><th style="text-align:right">Días FS</th><th>Sistema o conjunto</th><th>Observación / seguimiento</th></tr>' +
    fs.filas.map(function (f) {
      return '<tr><td class="mono" style="color:var(--ac)">' + escapeHtml(f.sigla) + '</td><td>' + escapeHtml(f.modelo) + '</td><td class="mono" style="text-align:right">' + (f.horomActual != null ? fn(f.horomActual) : '—') + '</td>' +
        '<td class="mono">' + escapeHtml(fd(f.ultimoPM)) + '</td><td class="mono" style="text-align:right">' + (f.horomUltimoPM != null ? fn(f.horomUltimoPM) : '—') + '</td>' +
        '<td class="mono">' + escapeHtml(fd(f.desde)) + '</td><td class="mono" style="text-align:right;font-weight:700;color:' + (f.dias >= 14 ? 'var(--danger)' : 'var(--w)') + '">' + fn(f.dias) + '</td>' +
        '<td>' + escapeHtml(f.sistema || '—') + '</td><td style="font-size:10px">' + escapeHtml(f.observacion || '—') + '</td></tr>';
    }).join('') + '</table></div>'
    : '<div style="padding:18px;text-align:center;color:var(--ok)">Ningún equipo está fuera de servicio ahora.</div>';

  var colMeta = function (v, meta) { return v == null ? 'inherit' : v >= meta ? 'var(--ok)' : 'var(--danger)'; };
  var si = function (b) { return b ? '<span style="color:var(--ok)">Sí</span>' : '<span style="color:var(--tx3)">No</span>'; };
  var tablaProg = pr.filas.length ?
    '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Sigla</th><th>Marca / modelo</th><th>PM</th><th style="text-align:right">Horómetro del hito</th><th style="text-align:right">Horómetro al inicio</th><th style="text-align:right">Horómetro al cierre</th><th>Programado</th><th>Llegó a sus horas</th><th>PM ejecutado</th></tr>' +
    pr.filas.map(function (f) {
      return '<tr' + (f.arrastre ? ' style="opacity:.7"' : '') + '><td class="mono" style="color:var(--ac)">' + escapeHtml(f.sigla) + '</td><td>' + escapeHtml(f.modelo) + '</td><td>' + escapeHtml(f.tipoPM) + '</td>' +
        '<td class="mono" style="text-align:right">' + fn(f.hito) + '</td><td class="mono" style="text-align:right">' + fn(f.horomInicio) + '</td><td class="mono" style="text-align:right">' + fn(f.horomFin) + '</td>' +
        (f.arrastre ? '<td colspan="2" style="color:var(--w)">Vencido al empezar el período (arrastre)</td>' : '<td>' + si(f.programado) + '</td><td>' + si(f.alcanzado) + '</td>') + '<td>' + si(f.ejecutado) + '</td></tr>';
    }).join('') + '</table></div>'
    : '<div style="padding:18px;text-align:center;color:var(--tx3)">Ningún equipo tenía un PM programado ni alcanzó uno en este período.</div>';
  var secProg =
    '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px"><div class="chart-t">I. Certeza de programa · II. Cumplimiento de programa</div>' +
    '<div style="font-size:11px;color:var(--tx2);line-height:1.55;padding:4px 0 10px">El programa se proyecta solo: un equipo toca cuando su horómetro llega al siguiente hito de 250 h (o de su frecuencia) y, como esa proyección no se guarda, aquí se reconstruye con el historial de horómetros y los PM registrados, con el ritmo de uso que tenía cada equipo al empezar el período. <b>Certeza:</b> de los equipos programados, cuántos llegaron a sus horas (un equipo parado no avanza horómetro y baja la certeza, no es un atraso). <b>Cumplimiento:</b> de los que llegaron a sus horas, cuántos tuvieron su PM. Un hito ya vencido al empezar el período es arrastre y no entra a los porcentajes. Pensado para semanas o meses.</div>' +
    '<div class="cards">' + card('Equipos programados', fn(rp.programados), 'PM proyectados en el período') +
    card('Llegaron a sus horas', fn(rp.programadosCumplieron), 'de los programados') +
    card('Certeza de programa', rp.certeza == null ? '—' : rp.certeza + '%', 'meta ' + rp.metaCerteza + '%', colMeta(rp.certeza, rp.metaCerteza)) +
    card('Ejecutados', fn(rp.ejecutados), 'de ' + fn(rp.alcanzados) + ' que llegaron a sus horas') +
    card('Cumplimiento de programa', rp.cumplimiento == null ? '—' : rp.cumplimiento + '%', 'meta ' + rp.metaCumplimiento + '%', colMeta(rp.cumplimiento, rp.metaCumplimiento)) + '</div>' +
    '<div style="font-size:12px;margin:2px 0 10px">' + (rp.programados ? 'Se programaron <b>' + fn(rp.programados) + '</b> equipos para mantenimiento periódico. Llegaron a sus horas <b>' + fn(rp.programadosCumplieron) + '</b>, lo que da <b>' + (rp.certeza == null ? '—' : rp.certeza + '%') + '</b> de certeza.' : 'No había equipos programados en este período.') +
    (rp.alcanzados ? ' Alcanzaron las horas de mantenimiento <b>' + fn(rp.alcanzados) + '</b> equipos y se ejecutaron <b>' + fn(rp.ejecutados) + '</b> mantenciones: <b>' + rp.cumplimiento + '%</b> de cumplimiento.' : '') + '</div>' +
    tablaProg +
    '<div style="font-size:10px;color:var(--tx3)">' + fn(rp.equiposEvaluados) + ' equipos evaluados' + (rp.sinHorometro ? ' · ' + fn(rp.sinHorometro) + ' sin lecturas de horómetro cercanas al período, no se evalúan: ' + escapeHtml(pr.sinHorometro.slice(0, 12).join(', ')) + (pr.sinHorometro.length > 12 ? '…' : '') : '') + (rp.noProgramadosAlcanzados ? ' · ' + fn(rp.noProgramadosAlcanzados) + ' hito(s) alcanzado(s) que no estaban proyectados' : '') + (rp.arrastrados ? ' · ' + fn(rp.arrastrados) + ' en arrastre' : '') + '.</div></div>';
  var optEq = eq.map(function (e) { return '<option value="' + escapeHtml(e.sigla) + '">' + escapeHtml(e.sigla + ' — ' + (e.modelo || '')) + '</option>'; }).join('');
  var tablaBk = bk.abiertos.length ?
    '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Sigla</th><th>Marca / modelo</th><th>Fecha</th><th style="text-align:right">Horómetro backlog</th><th style="text-align:right">Horómetro actual</th><th style="text-align:right">Horas pendientes de cierre</th><th>Tarea pendiente</th><th>Sistema afectado</th><th>Insumo</th><th></th></tr>' +
    bk.abiertos.map(function (b) {
      return '<tr><td class="mono" style="color:var(--ac)">' + escapeHtml(b.sigla) + '</td><td>' + escapeHtml(b.modelo) + '</td><td class="mono">' + escapeHtml(fd(b.fecha)) + '</td>' +
        '<td class="mono" style="text-align:right">' + (b.horomBacklog != null ? fn(b.horomBacklog) : '—') + '</td><td class="mono" style="text-align:right">' + (b.horomActual != null ? fn(b.horomActual) : '—') + '</td>' +
        '<td class="mono" style="text-align:right;font-weight:700">' + (b.horasPendientes != null ? fn(b.horasPendientes) : '—') + '</td><td>' + escapeHtml(b.tarea) + '</td><td>' + escapeHtml(b.sistema || '—') + '</td>' +
        '<td><button class="btn btn-o" style="padding:2px 8px;font-size:10px" onclick="gestionBacklogInsumo(' + b.idx + ')" title="Cambiar si ya hay insumo comprometido">' + (b.conInsumo ? 'Con insumo' : 'Sin insumo') + '</button></td>' +
        '<td><button class="btn" style="padding:2px 8px;font-size:10px" onclick="gestionBacklogCerrar(' + b.idx + ')">Cerrar</button></td></tr>';
    }).join('') + '</table></div>'
    : '<div style="padding:18px;text-align:center;color:var(--ok)">No hay tareas pendientes de pauta abiertas.</div>';
  var secBacklog =
    '<div class="chart-box" style="border-left:3px solid var(--w);margin-bottom:16px"><div class="chart-t">V. Cierre de backlog de pautas</div>' +
    '<div style="font-size:11px;color:var(--tx2);line-height:1.55;padding:4px 0 10px">Tareas que quedaron pendientes al hacer un PM (por ejemplo, un cambio de filtro por falta de insumo). Cuando un PM se registra como incompleto con "qué faltó", la tarea entra sola aquí; también se pueden agregar a mano. Al cerrarla queda con su fecha. Las horas pendientes son el horómetro actual del equipo menos el del día en que quedó pendiente. Hoy no hay tareas anteriores cargadas: el seguimiento parte desde que se registran.</div>' +
    '<div class="cards">' + card('Cerrados', fn(rb.cerrados), 'de ' + fn(rb.total) + ' tareas') + card('Pendientes', fn(rb.pendientes), fn(rb.conInsumo) + ' con insumo · ' + fn(rb.sinInsumo) + ' sin insumo', rb.pendientes ? 'var(--w)' : '') +
    card('Cumplimiento de cierre', rb.pctCierre == null ? '—' : rb.pctCierre + '%', 'a la fecha de hoy', rb.pctCierre == null ? '' : rb.pctCierre >= 80 ? 'var(--ok)' : 'var(--w)') + '</div>' + tablaBk +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px"><b style="font-size:11px">Agregar tarea pendiente:</b>' +
    '<select id="bkSigla"><option value="">Equipo…</option>' + optEq + '</select><input id="bkTarea" placeholder="Tarea pendiente (ej. cambio de filtro de combustible)" style="min-width:230px">' +
    '<input id="bkSistema" placeholder="Sistema afectado" style="width:140px"><label style="font-size:11px"><input type="checkbox" id="bkInsumo"> Con insumo</label><button class="btn" onclick="gestionBacklogAgregar()">Agregar</button></div></div>';
  // VI. Confiabilidad vs. PM atrasado (2026-11-17): solo lectura, todo el historial; no toca la grilla estática ni el cumplimiento.
  var _fallasConf = ot.concat(typeof _otHistComoOt === 'function' ? _otHistComoOt(S.g('otHist') || []) : [], typeof _informesFallaComoOt === 'function' ? _informesFallaComoOt(S.g('informesFalla') || []) : []);
  var cf = informeConfiabilidadPM(reg, eq, _fallasConf, hoy), tf = function (v) { return v == null ? '—' : String(v).replace('.', ','); };
  var totBandas = cf.bandas.reduce(function (a, b) { return a + b.pm; }, 0), noEvC = cf.noEvaluados.hitoSinRegistro + cf.noEvaluados.repetidos + cf.noEvaluados.sinDato;
  var colBanda = { adel20: 'var(--w)', adel10: 'var(--w)', dentro: 'var(--ok)', atras10: 'var(--danger)', atras20: 'var(--danger)' };
  var tablaConfBandas = '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Cuándo se hizo el PM (contra su hito)</th><th style="text-align:right">PM</th><th style="text-align:right">% de los evaluados</th></tr>' +
    cf.bandas.map(function (b) {
      return '<tr><td style="color:' + colBanda[b.id] + ';font-weight:600">' + escapeHtml(b.nombre) + '</td><td class="mono" style="text-align:right">' + fn(b.pm) + '</td><td class="mono" style="text-align:right">' + (totBandas ? Math.round(b.pm / totBandas * 100) + '%' : '—') + '</td></tr>';
    }).join('') + '</table></div><div style="font-size:10px;color:var(--tx3);margin:2px 0 10px">Sin evaluar: ' + fn(noEvC) + ' (' + fn(cf.noEvaluados.hitoSinRegistro) + ' salto de hito · ' + fn(cf.noEvaluados.repetidos) + ' repetidos · ' + fn(cf.noEvaluados.sinDato) + ' sin dato). Un PM a las 310 h cuando tocaba a las 250 h es +60 h (24 %): atrasado más de 20 %; a las 590 h cuando tocaba a las 500 h es +90 h: también.</div>';
  var tablaConfZonas = '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Horas del equipo</th><th style="text-align:right">Horas</th><th style="text-align:right">Fallas</th><th style="text-align:right">Fallas por 1.000 h</th></tr>' +
    [['Al día (hasta el hito + 10 % del ciclo)', cf.zonas.alDia], ['En mora (pasado el hito + 10 %, hasta que se hizo el PM)', cf.zonas.enMora]].map(function (z) {
      return '<tr><td>' + z[0] + '</td><td class="mono" style="text-align:right">' + fn(z[1].horas) + '</td><td class="mono" style="text-align:right">' + fn(z[1].fallas) + '</td><td class="mono" style="text-align:right;font-weight:700">' + (z[1].tasa == null ? '—' : tf(z[1].tasa)) + '</td></tr>';
    }).join('') + '</table></div>';
  var tablaConfEq = cf.filas.length ?
    '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Sigla</th><th>Marca / modelo</th><th style="text-align:right">PM evaluados</th><th style="text-align:right">Atrasados</th><th style="text-align:right">% atrasados</th><th style="text-align:right">Horas al día</th><th style="text-align:right">Horas en mora</th><th style="text-align:right">Fallas</th><th style="text-align:right">Fallas por 1.000 h</th><th>Lectura</th></tr>' +
    cf.filas.map(function (f) {
      return '<tr><td class="mono" style="color:var(--ac)">' + escapeHtml(f.sigla) + '</td><td>' + escapeHtml(f.modelo) + '</td><td class="mono" style="text-align:right">' + fn(f.pmEvaluados) + '</td>' +
        '<td class="mono" style="text-align:right;color:' + (f.atrasados ? 'var(--danger)' : 'inherit') + '">' + fn(f.atrasados) + '</td><td class="mono" style="text-align:right">' + (f.pctAtrasados == null ? '—' : f.pctAtrasados + '%') + '</td>' +
        '<td class="mono" style="text-align:right">' + fn(f.horasDia) + '</td><td class="mono" style="text-align:right">' + fn(f.horasMora) + '</td><td class="mono" style="text-align:right">' + fn(f.fallas) + '</td><td class="mono" style="text-align:right;font-weight:700">' + tf(f.tasa) + '</td>' +
        '<td style="font-size:10px;color:' + (f.atencion ? 'var(--danger)' : 'var(--tx3)') + ';font-weight:' + (f.atencion ? '700' : '400') + '">' + (f.atencion ? 'Atención: se atrasa seguido y falla sobre la flota' : (f.tasa == null ? 'pocas horas para evaluar' : '')) + '</td></tr>';
    }).join('') + '</table></div>'
    : '<div style="padding:18px;text-align:center;color:var(--tx3)">No hay tramos entre PM evaluables.</div>';
  var secConf =
    '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px"><div class="chart-t">VI. Confiabilidad vs. PM atrasado (todo el historial)</div>' +
    '<div style="font-size:11px;color:var(--tx2);line-height:1.55;padding:4px 0 10px">Responde dos cosas: <b>cuántos PM se hicieron atrasados o adelantados</b> contra su hito de la grilla (250, 500, 750 h…) y <b>si atrasarlo se paga con más fallas</b>. Para lo segundo, las horas de cada equipo entre un PM y el siguiente se separan en <b>al día</b> (hasta el hito + 10 % del ciclo) y <b>en mora</b> (pasado eso, hasta que se hizo el PM), y se compara cuántas fallas hubo por cada 1.000 h en cada zona. Es solo lectura: la grilla estática de PM y el cumplimiento no cambian.</div>' +
    '<div class="cards">' + card('PM evaluados', fn(totBandas), fn(cf.flota.equipos) + ' equipos') + card('Atrasados más de 10 %', fn(cf.bandas[3].pm + cf.bandas[4].pm), totBandas ? Math.round((cf.bandas[3].pm + cf.bandas[4].pm) / totBandas * 100) + '% de los evaluados' : '', 'var(--danger)') +
    card('Fallas por 1.000 h al día', tf(cf.zonas.alDia.tasa), fn(cf.zonas.alDia.fallas) + ' fallas en ' + fn(cf.zonas.alDia.horas) + ' h') + card('Fallas por 1.000 h en mora', tf(cf.zonas.enMora.tasa), fn(cf.zonas.enMora.fallas) + ' fallas en ' + fn(cf.zonas.enMora.horas) + ' h') + '</div>' +
    '<div style="font-weight:700;font-size:12px;margin:6px 0">Cuántos PM y con cuánto desvío</div>' + tablaConfBandas +
    '<div style="font-weight:700;font-size:12px;margin:6px 0">Fallas al día vs. en mora</div>' + tablaConfZonas +
    '<div style="font-size:11px;color:var(--tx2);line-height:1.55;margin:8px 0 10px"><b>Cómo leerlo:</b> si la tasa en mora fuera mayor que la de al día, atrasar el PM tendría costo en fallas. Si es igual o menor, el atraso es un incumplimiento de calendario más que un riesgo de falla. <b>Cuidado:</b> es una asociación, no una causa, y las horas en mora son pocas (la fila con menos de ' + fn(cf.minHoras) + ' h no calcula tasa). Un equipo que falla mucho suele recibir su PM antes y uno que trabaja poco se atrasa, y las fallas tienden a aparecer justo después de un PM (se detectan al intervenir). Sirve para decidir a quién atender primero, no para relajar la regla. Las fallas son las correctivas del histórico y de Correctivos (sin rutinas, desgaste ni instalaciones).</div>' +
    '<div style="font-weight:700;font-size:12px;margin:6px 0">Por equipo (primero los que más se atrasan y fallan sobre la flota)</div>' + tablaConfEq +
    '<div style="font-size:10px;color:var(--tx3)">«Atención» = al menos 2 PM atrasados, 30 % o más de sus PM atrasados y una tasa de fallas sobre la de la flota. Tramos fuera de 0,4 a 2,4 veces el ciclo no entran. Una falla sin horómetro se ubica por su fecha entre los dos PM.</div></div>';
  // VII. Calidad del dato PM + indicador estricto (2026-11-17): solo lectura; no cambia la grilla estática ni el margen oficial.
  var ca = informeCalidadPM(reg, eq, S.g('hist') || [], _fallasConf), es = ca.estricto, ct = ca.conteo, sgn = function (v) { return v == null ? '—' : (v > 0 ? '+' : '') + String(v).replace('.', ','); };
  var pctE = function (n) { return es.evaluados ? Math.round(n / es.evaluados * 100) + '%' : '—'; };
  var co = ca.corregido, pc = function (n) { return co.comparables ? Math.round(n / co.comparables * 100) + '%' : '—'; };
  var tablaCor = '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Cumplimiento de los PM con historial cercano (' + fn(co.comparables) + ')</th><th style="text-align:right">Adelantados</th><th style="text-align:right">Dentro del estándar</th><th style="text-align:right">Atrasados</th><th style="text-align:right">% dentro</th></tr>' +
    [['Oficial (horómetro anotado en el PM)', co.oficial], ['Corregido con el horómetro del historial', co.historial]].map(function (z, i) {
      return '<tr' + (i ? ' style="font-weight:700"' : '') + '><td>' + z[0] + '</td><td class="mono" style="text-align:right;color:var(--w)">' + fn(z[1].adelantado) + '</td><td class="mono" style="text-align:right;color:var(--ok)">' + fn(z[1].dentro) + '</td><td class="mono" style="text-align:right;color:var(--danger)">' + fn(z[1].atrasado) + '</td><td class="mono" style="text-align:right">' + pc(z[1].dentro) + '</td></tr>';
    }).join('') + '</table></div><div style="font-size:11px;color:var(--tx2);margin:4px 0 10px">Con el historial cambia la clase de <b>' + fn(co.cambian) + '</b> de ' + fn(co.comparables) + ' PM. <b>No verificables:</b> ' + fn(co.noVerificables) + ' PM anotados justo en el hito y sin lectura de historial a 20 días o menos (su «a tiempo» no se puede comprobar). Sin historial pero con una lectura anotada: ' + fn(co.sinHistorialUsaAnotado) + ' (no entran a la comparación). Mismo hito de la grilla y mismo margen de ±10 % del ciclo; solo cambia el horómetro con que se mide.</div>';
  var eqCal = window._gestionCalidadEq || '', siglasCal = Object.keys(ca.filas.reduce(function (a, f) { a[f.sigla] = 1; return a; }, {})).sort();
  var filasCal = ca.filas.filter(function (f) { return !eqCal || f.sigla === eqCal; }), mostrar = filasCal.slice(0, 150);
  var etiqAl = { nominal: 'Anotado justo en el hito y el historial dice otra cosa', historial: 'Horómetro del PM ≠ historial (más de 25 h)', nombre: 'El nombre del PM apunta a otro hito', congelado: 'Historial sin avance entre lecturas' };
  var tablaCal = mostrar.length ?
    '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Sigla</th><th>Fecha</th><th>PM</th><th style="text-align:right">Horómetro del PM</th><th style="text-align:right">Hito (sistema)</th><th style="text-align:right">Desvío exacto (h)</th><th style="text-align:right">Hito según nombre</th><th style="text-align:right">Desvío según nombre (h)</th><th style="text-align:right">Horómetro del historial</th><th style="text-align:right">Diferencia (h)</th><th style="text-align:right">Desvío según historial (h)</th><th style="text-align:right">Correctivos ±7 d</th><th>Alertas</th></tr>' +
    mostrar.map(function (f) {
      var gr = f.score >= 3;
      return '<tr><td class="mono" style="color:var(--ac)">' + escapeHtml(f.sigla) + '</td><td class="mono">' + escapeHtml(fd(f.fecha)) + '</td><td>' + escapeHtml(f.tipoPM) + '</td><td class="mono" style="text-align:right">' + fn(f.horomReal) + '</td>' +
        '<td class="mono" style="text-align:right">' + (f.hitoSistema != null ? fn(f.hitoSistema) : '—') + '</td><td class="mono" style="text-align:right">' + sgn(f.desvioSistema) + '</td>' +
        '<td class="mono" style="text-align:right">' + (f.hitoNombre != null ? fn(f.hitoNombre) : '—') + '</td><td class="mono" style="text-align:right;color:' + (f.desvioNombre != null && Math.abs(f.desvioNombre) > 100 ? 'var(--danger)' : 'inherit') + '">' + sgn(f.desvioNombre) + '</td>' +
        '<td class="mono" style="text-align:right">' + (f.horomHistorial != null ? fn(f.horomHistorial) : '—') + '</td><td class="mono" style="text-align:right;font-weight:700;color:' + (f.dif != null && Math.abs(f.dif) > 25 ? 'var(--danger)' : 'inherit') + '">' + sgn(f.dif) + '</td><td class="mono" style="text-align:right">' + sgn(f.desvioHistorial) + '</td>' +
        '<td class="mono" style="text-align:right">' + fn(f.correctivos) + '</td><td style="font-size:10px;color:' + (gr ? 'var(--danger)' : 'var(--w)') + '">' + f.alertas.map(function (a) { return escapeHtml(etiqAl[a]); }).join(' · ') + '</td></tr>';
    }).join('') + '</table></div>' + (filasCal.length > mostrar.length ? '<div style="font-size:10px;color:var(--tx3);margin-top:4px">Se muestran los ' + fn(mostrar.length) + ' de más prioridad de ' + fn(filasCal.length) + '; elige un equipo para ver el resto.</div>' : '')
    : '<div style="padding:18px;text-align:center;color:var(--ok)">Sin PM con alertas' + (eqCal ? ' para ' + escapeHtml(eqCal) : '') + '.</div>';
  var secCalidad =
    '<div class="chart-box" style="border-left:3px solid var(--w);margin-bottom:16px"><div class="chart-t">VII. Indicador estricto y calidad del dato PM</div>' +
    '<div style="font-size:11px;color:var(--tx2);line-height:1.55;padding:4px 0 10px">Dos vistas de apoyo, <b>sin cambiar</b> la grilla estática ni el margen oficial de ±10 % del ciclo. <b>1. Indicador estricto:</b> cuenta cualquier hora de desvío contra el hito (un PM a las 235 h cuando tocaba a las 250 h es adelantado, aunque el estándar lo acepte). <b>2. Calidad del dato y cumplimiento corregido:</b> compara cada PM con el horómetro del historial en esa fecha y con el hito que dice su nombre (PM1 = 250 h, PM2 = 500 h, PM3 = 1.000 h, PM4 = 2.000 h) para encontrar PM con la fecha o el horómetro mal anotado.</div>' +
    '<div class="cards">' + card('Exactos en el hito', fn(es.exacto), pctE(es.exacto) + ' de ' + fn(es.evaluados) + ' evaluados · muchos son hito anotado, no lectura') +
    card('Adelantados (cualquier hora)', fn(es.adelantado), pctE(es.adelantado) + ' · oficial (±10 %): ' + fn(es.oficialAdelantado), es.adelantado ? 'var(--w)' : '') +
    card('Atrasados (cualquier hora)', fn(es.atrasado), pctE(es.atrasado) + ' · oficial (±10 %): ' + fn(es.oficialAtrasado), es.atrasado ? 'var(--danger)' : '') +
    card('Dentro del margen oficial', fn(es.oficialDentro), pctE(es.oficialDentro) + ' de ' + fn(es.evaluados)) + '</div>' +
    '<div style="font-weight:700;font-size:12px;margin:6px 0">Cumplimiento corregido con el historial de horómetros</div>' + tablaCor +
    '<div style="font-size:12px;margin:2px 0 10px">PM con alertas de dato: <b>' + fn(ca.filas.length) + '</b> · ' + fn(ct.nominal) + ' anotados en el hito con historial distinto · ' + fn(ct.historial) + ' con horómetro que difiere más de 25 h del historial · ' + fn(ct.nombre) + ' con el nombre apuntando a otro hito · ' + fn(ct.congelado) + ' con historial sin avance. Sin lectura cercana para comparar: ' + fn(ct.sinLectura) + '.</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><span style="font-size:11px;color:var(--tx3)">Equipo:</span><select id="fGestCalEq" onchange="gestionCalidadEq()"><option value="">Todos</option>' +
    siglasCal.map(function (g) { return '<option value="' + escapeHtml(g) + '"' + (g === eqCal ? ' selected' : '') + '>' + escapeHtml(g) + '</option>'; }).join('') + '</select></div>' + tablaCal +
    '<div style="font-size:10px;color:var(--tx3);margin-top:6px">El horómetro del historial es la lectura de ese día o la interpolación entre dos lecturas a 20 días o menos. Una diferencia no dice cuál dato está mal: puede ser la fecha del PM, su horómetro o el historial (por ejemplo, un horómetro cambiado o repetido). Se revisa caso a caso; nada se corrige solo.</div></div>';
  // VIII. Tiempo del PM frente a la pauta (2026-11-18): solo lectura. Minutos por tarea de la tabla pautas_tiempos (PDF «Pauta Mantencion»); no cambia la grilla ni el margen oficial.
  var ctp = typeof cumplimientoTiempoPM === 'function' ? cumplimientoTiempoPM(reg, eq, S.g('pautasTiempos') || [], { grupoPautas: (typeof GRUPO_PAUTAS !== 'undefined' ? GRUPO_PAUTAS : {}), desde: '2023-01-01' }) : { nPM: 0, niveles: [], filas: [], total: { n: 0 } };
  var f1 = function (v) { return v == null ? '—' : String(v).replace('.', ','); };
  var tablaTp = ctp.niveles.length ?
    '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>PM</th><th style="text-align:right">PM</th><th style="text-align:right">Pide la pauta (h-persona)</th><th style="text-align:right">Duración anotada (mediana, h)</th><th style="text-align:right">Técnicos necesarios (mediana)</th><th style="text-align:right">Exigen más de 4 técnicos</th><th style="text-align:right">Tiempo corto / parcial / alcanza</th><th style="text-align:right">% alcanza con ' + ctp.cuadrilla + ' técnicos</th></tr>' +
    ctp.niveles.concat([Object.assign({ tipoPM: 'Total' }, ctp.total)]).map(function (n) {
      return '<tr' + (n.tipoPM === 'Total' ? ' style="font-weight:700"' : '') + '><td>' + escapeHtml(n.tipoPM) + '</td><td class="mono" style="text-align:right">' + fn(n.n) + '</td><td class="mono" style="text-align:right">' + f1(n.pautaHorasPersona) + '</td><td class="mono" style="text-align:right">' + f1(n.duracionMediana) + '</td><td class="mono" style="text-align:right">' + f1(n.tecnicosNecesariosMediana) + '</td><td class="mono" style="text-align:right;color:' + (n.pctMasDe4Tecnicos >= 30 ? 'var(--danger)' : 'inherit') + '">' + n.pctMasDe4Tecnicos + '%</td><td class="mono" style="text-align:right"><span style="color:var(--danger)">' + fn(n.corto) + '</span> / <span style="color:var(--w)">' + fn(n.parcial) + '</span> / <span style="color:var(--ok)">' + fn(n.alcanza) + '</span></td><td class="mono" style="text-align:right;font-weight:700">' + n.pctAlcanza + '%</td></tr>';
    }).join('') + '</table></div>'
    : '<div style="padding:18px;text-align:center;color:var(--tx3)">Sin PM con pauta de tiempos y duración anotada.</div>';
  var porEqTp = {};
  ctp.filas.forEach(function (f) { var g = porEqTp[f.equipo] = porEqTp[f.equipo] || { n: 0, corto: 0, alcanza: 0, tec: [] }; g.n++; if (f.clase === 'corto') g.corto++; if (f.clase === 'alcanza') g.alcanza++; g.tec.push(f.tecnicosNecesarios); });
  var filasEqTp = Object.keys(porEqTp).map(function (k) { var g = porEqTp[k], t = g.tec.slice().sort(function (a, b) { return a - b; }); return { eq: k, n: g.n, corto: g.corto, alcanza: g.alcanza, tec: t[t.length >> 1] }; })
    .filter(function (g) { return g.n >= 3; }).sort(function (a, b) { return b.corto / b.n - a.corto / a.n || b.n - a.n; }).slice(0, 12);
  var tablaEqTp = filasEqTp.length ?
    '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Equipo</th><th style="text-align:right">PM</th><th style="text-align:right">Técnicos necesarios (mediana)</th><th style="text-align:right">Con menos de la mitad del tiempo</th><th style="text-align:right">Alcanza</th></tr>' +
    filasEqTp.map(function (g) { return '<tr><td class="mono" style="color:var(--ac)">' + escapeHtml(g.eq) + '</td><td class="mono" style="text-align:right">' + fn(g.n) + '</td><td class="mono" style="text-align:right">' + f1(g.tec) + '</td><td class="mono" style="text-align:right;color:var(--danger)">' + fn(g.corto) + ' (' + Math.round(g.corto / g.n * 100) + '%)</td><td class="mono" style="text-align:right;color:var(--ok)">' + fn(g.alcanza) + ' (' + Math.round(g.alcanza / g.n * 100) + '%)</td></tr>'; }).join('') + '</table></div>' : '';
  var secTiempo =
    '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px"><div class="chart-t">VIII. Tiempo del PM frente a la pauta</div>' +
    '<div style="font-size:11px;color:var(--tx2);line-height:1.55;padding:4px 0 10px">La pauta de cada equipo dice cuántos minutos de trabajo lleva cada tarea. Sumando las tareas de cada nivel de PM se obtiene el trabajo que pide la pauta (en horas-persona) y se compara con la duración que se anotó al registrar el PM. <b>Es una señal, no una prueba:</b> no dice qué se omitió ni si el trabajo quedó bien; dice que el tiempo anotado no da para toda la pauta. Los minutos son de una persona, así que se supone una cuadrilla de <b>' + ctp.cuadrilla + ' técnicos</b> (el sistema guarda un solo nombre por PM, no cuántos fueron). Solo equipos con pauta de tiempos y medidos en horas, desde 2023.</div>' +
    '<div class="cards">' + card('PM comparados', fn(ctp.nPM), fn(ctp.sinPauta) + ' sin pauta de tiempos · ' + fn(ctp.sinDuracion) + ' sin duración') +
    card('Alcanzan con ' + ctp.cuadrilla + ' técnicos', ctp.total.n ? ctp.total.pctAlcanza + '%' : '—', 'duración × técnicos ≥ pauta', ctp.total.n && ctp.total.pctAlcanza < 50 ? 'var(--w)' : '') +
    card('Con menos de la mitad del tiempo', fn(ctp.total.corto || 0), ctp.total.n ? Math.round((ctp.total.corto || 0) / ctp.total.n * 100) + '% de los comparados' : '', ctp.total.corto ? 'var(--danger)' : '') + '</div>' +
    '<div style="font-weight:700;font-size:12px;margin:6px 0">Por nivel de PM</div>' + tablaTp +
    (tablaEqTp ? '<div style="font-weight:700;font-size:12px;margin:10px 0 6px">Equipos con más PM cortos (mínimo 3 PM)</div>' + tablaEqTp : '') +
    '<div style="font-size:10px;color:var(--tx3);margin-top:6px">Un PM al hito H incluye las tareas cuya frecuencia divide a H y las de 250 h o menos; las tareas cuya frecuencia no divide al hito (por ejemplo 800 h en un PM de 1.000 h) no se cuentan, así que la pauta pedida es un mínimo. Pautas de los PDF «Pauta Mantencion» del sistema de Besalco (18-11-2026); el bus se mide en km y queda fuera. Los PM largos pueden incluir reparaciones hechas en la misma parada.</div></div>';
  // IX. Actividad por período (2026-11-18): PM, correctivas y predictivas registradas por mes, trimestre o año. Solo lectura; las correctivas son la misma lista que usa Confiabilidad (sección VI).
  var perAct = window._gestionActPer || 'mes', limAct = perAct === 'mes' ? 24 : perAct === 'trimestre' ? 12 : 99;
  var act = typeof actividadPorPeriodo === 'function' ? actividadPorPeriodo({ reg: reg, fallas: _fallasConf, aceite: S.g('aceite') || [], ot: ot, otHist: S.g('otHist') || [] }, perAct) : { filas: [], total: {} };
  var verAct = act.filas.slice(0, limAct), totAct = verAct.reduce(function (a, f) { a.pm += f.pm; a.c += f.correctivas; a.m += f.muestrasAceite; a.o += f.medicionesOT; a.h += f.horasHH || 0; return a; }, { pm: 0, c: 0, m: 0, o: 0, h: 0 });
  var etqPer = function (k) { if (perAct === 'mes') { var m = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][+k.slice(5, 7) - 1]; return m + ' ' + k.slice(0, 4); } return perAct === 'trimestre' ? k.slice(5) + ' ' + k.slice(0, 4) : k; };
  var hoyK = new Date().toISOString().slice(0, 10), kHoy = perAct === 'anio' ? hoyK.slice(0, 4) : perAct === 'trimestre' ? hoyK.slice(0, 4) + '-T' + Math.ceil(+hoyK.slice(5, 7) / 3) : hoyK.slice(0, 7);
  var tablaAct = verAct.length ?
    '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Período</th><th style="text-align:right">PM realizados</th><th style="text-align:right">Correctivas</th><th style="text-align:right">Correctivas por PM</th><th style="text-align:right">Muestras de aceite</th><th style="text-align:right">Mediciones e inspecciones (OT)</th><th style="text-align:right">Horas hombre (OT históricas)</th></tr>' +
    verAct.map(function (f) {
      return '<tr><td>' + escapeHtml(etqPer(f.periodo)) + (f.periodo === kHoy ? ' <span style="font-size:10px;color:var(--tx3)">(en curso)</span>' : '') + '</td><td class="mono" style="text-align:right">' + fn(f.pm) + '</td><td class="mono" style="text-align:right;font-weight:700">' + fn(f.correctivas) + '</td><td class="mono" style="text-align:right">' + (f.correctivasPorPM == null ? '—' : String(f.correctivasPorPM).replace('.', ',')) + '</td><td class="mono" style="text-align:right">' + fn(f.muestrasAceite) + '</td><td class="mono" style="text-align:right">' + fn(f.medicionesOT) + '</td><td class="mono" style="text-align:right">' + (f.horasHH ? fn(f.horasHH) : '—') + '</td></tr>';
    }).join('') +
    '<tr style="font-weight:700"><td>Total mostrado</td><td class="mono" style="text-align:right">' + fn(totAct.pm) + '</td><td class="mono" style="text-align:right">' + fn(totAct.c) + '</td><td class="mono" style="text-align:right">' + (totAct.pm ? String(Math.round(totAct.c / totAct.pm * 10) / 10).replace('.', ',') : '—') + '</td><td class="mono" style="text-align:right">' + fn(totAct.m) + '</td><td class="mono" style="text-align:right">' + fn(totAct.o) + '</td><td class="mono" style="text-align:right">' + (totAct.h ? fn(Math.round(totAct.h * 10) / 10) : '—') + '</td></tr></table></div>'
    : '<div style="padding:18px;text-align:center;color:var(--tx3)">Sin actividad registrada.</div>';
  var secActividad =
    '<div class="chart-box" style="border-left:3px solid var(--ok);margin-bottom:16px"><div class="chart-t">IX. Actividad por período: PM, correctivas y predictivas</div>' +
    '<div style="font-size:11px;color:var(--tx2);line-height:1.55;padding:4px 0 10px">Cuántos PM, correctivas y trabajos predictivos quedaron <b>registrados</b> en cada período. Las correctivas son la misma lista que usa la sección VI (Confiabilidad): órdenes vigentes y del histórico que son fallas de verdad, más los informes de falla; no se cuentan las rutinas, instalaciones ni cambios planificados de desgaste que el Excel traía como «correctiva».</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><span style="font-size:11px;color:var(--tx3)">Ver por:</span><select id="fGestActPer" onchange="gestionActividadPer()">' +
    [['mes', 'Mes (últimos 24)'], ['trimestre', 'Trimestre (últimos 12)'], ['anio', 'Año']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === perAct ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' + tablaAct +
    '<div style="font-size:10px;color:var(--tx3);margin-top:6px"><b>Cómo leerlo:</b> el período en curso está incompleto y los primeros meses de 2023 también (la carga del historial fue creciendo), así que comparar contra ellos exagera la mejora. <b>Predictivas:</b> el sistema no marca de forma consistente lo predictivo; aquí van las muestras de aceite y las órdenes de tipo medición, inspección y diagnóstico o «Predictiva». Es lo registrado, no todo lo que se hizo.</div></div>';
  // X. Horas hombre por sistema (2026-11-18): solo las OT del histórico traen «horasHH» (Excel ORDENES_DE_TRABAJO); solo lectura.
  var hhh = typeof horasHombreHist === 'function' ? horasHombreHist(S.g('otHist') || []) : { total: { ots: 0, hh: 0 }, porSistema: [], porClase: [] };
  var tarifaHHx = +S.g('hh') || 0, etqClase = { correctiva: 'Correctivas', preventiva: 'Preventivas', desgaste: 'Cambios de desgaste', instalacion: 'Instalaciones', operacional: 'Eventos de operación' };
  var tablaHH = hhh.porSistema.length ?
    '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Sistema</th><th style="text-align:right">OT con horas</th><th style="text-align:right">Horas hombre</th><th style="text-align:right">Horas por OT</th><th style="text-align:right">De ellas, en correctivas</th>' + (tarifaHHx > 0 ? '<th style="text-align:right">Costo estimado de mano de obra</th>' : '') + '</tr>' +
    hhh.porSistema.slice(0, 12).map(function (x) {
      return '<tr><td>' + escapeHtml(x.sistema) + '</td><td class="mono" style="text-align:right">' + fn(x.ots) + '</td><td class="mono" style="text-align:right;font-weight:700">' + fn(x.hh) + '</td><td class="mono" style="text-align:right">' + String(x.hhPorOT).replace('.', ',') + '</td><td class="mono" style="text-align:right">' + fn(x.hhCorrectiva) + '</td>' + (tarifaHHx > 0 ? '<td class="mono" style="text-align:right">$' + fn(Math.round(x.hh * tarifaHHx)) + '</td>' : '') + '</tr>';
    }).join('') + '</table></div>'
    : '<div style="padding:18px;text-align:center;color:var(--tx3)">Sin horas hombre cargadas.</div>';
  var secHH =
    '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px"><div class="chart-t">X. Horas hombre por sistema (OT históricas)</div>' +
    '<div style="font-size:11px;color:var(--tx2);line-height:1.55;padding:4px 0 10px">Las horas de trabajo que el taller anotó en cada orden del Excel de órdenes de trabajo. Son horas de <b>trabajo de la persona</b>, no la duración de la orden: con varias personas la orden dura menos. Sirven para ver dónde se va la mano de obra, más allá de cuántas fallas hay: un sistema con pocas órdenes puede consumir muchas horas.</div>' +
    '<div class="cards">' + card('Horas hombre registradas', fn(hhh.total.hh), fn(hhh.total.ots) + ' OT con horas') + card('Horas por OT', hhh.total.hhPorOT == null ? '—' : String(hhh.total.hhPorOT).replace('.', ','), 'promedio de las OT con horas') +
    hhh.porClase.slice(0, 2).map(function (c) { return card(etqClase[c.clase] || c.clase, fn(c.hh) + ' h', fn(c.ots) + ' OT'); }).join('') + '</div>' + tablaHH +
    '<div style="font-size:10px;color:var(--tx3);margin-top:6px"><b>Límites:</b> solo las OT del histórico cargadas del Excel (hasta octubre de 2025) traen horas; las OT vigentes no las registran. Se cargaron 7.936 de las 9.856 horas del archivo (81 %): las órdenes repetidas con la misma descripción en el mismo día no se pudieron asignar con seguridad y quedaron sin horas.' + (tarifaHHx > 0 ? ' El costo usa la tarifa HH vigente, no la de cada fecha.' : '') + '</div></div>';
  $('s-gestion').innerHTML =
    secProg +
    '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px"><div class="chart-t">III. Desviaciones de mantenimiento</div>' +
    '<div style="font-size:11px;color:var(--tx2);line-height:1.55;padding:4px 0 10px">Compara el horómetro con que se hizo cada PM contra el horómetro en que tocaba. El estándar es el del informe del cliente: <b>±' + tolPct + '% del ciclo</b> (±25 h en el de 250 h); un PM adelantado o atrasado más allá de ese margen es una desviación. Los PM que se saltan un hito, los repetidos y los que no tienen horómetro no se evalúan.</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px"><span style="font-size:11px;color:var(--tx3)">Período:</span>' +
    '<input type="date" id="fGestDesde" value="' + rg.desde + '" onchange="gestionRango()"><span style="font-size:11px;color:var(--tx3)">al</span><input type="date" id="fGestHasta" value="' + rg.hasta + '" onchange="gestionRango()">' +
    btn('Últimos 7 días', 'sem') + btn('Mes en curso', 'mes') + btn('Año en curso', 'anio') + btn('Todo el historial', 'todo') + '</div>' +
    '<div class="cards">' + card('PM realizados', fn(r.total), 'en el período') +
    card('Dentro del estándar', pct, fn(r.dentro) + ' de ' + fn(r.evaluables) + ' evaluados', colPct) +
    card('Adelantados', fn(r.adelantadas), 'más de ' + tolPct + '% antes del hito', r.adelantadas ? 'var(--w)' : '') +
    card('Atrasados', fn(r.atrasadas), 'más de ' + tolPct + '% después del hito', r.atrasadas ? 'var(--danger)' : '') +
    card('Sin evaluar', fn(noEval), fn(r.hitoSinRegistro) + ' salto de hito · ' + fn(r.repetidos) + ' repetidos · ' + fn(r.sinDato) + ' sin dato') + '</div>' +
    (pm.filas.length && pm.filas.length <= 60 ? '<div style="font-weight:700;font-size:12px;margin:6px 0">Desviación de cada PM (horas)</div>' + _gestGrafico(pm.filas, tolH) :
      pm.filas.length ? '<div style="font-size:11px;color:var(--tx3);margin:6px 0">Son ' + fn(pm.filas.length) + ' PM: acorta el período para ver el gráfico (hasta 60).</div>' : '') +
    (pm.filas.length ? '<div style="font-size:10px;color:var(--tx3);margin:2px 0 10px">Verde: dentro del estándar · ámbar: adelantado · rojo: atrasado.' + (tolH ? ' La franja verde es ±' + tolH + ' h.' : '') + ' El horómetro programa es el hito de la grilla de la frecuencia del equipo (250, 500, 750 h…) que ese PM cubría.</div>' : '') +
    '<div style="font-weight:700;font-size:12px;margin:6px 0">PM ejecutados y su desviación</div>' + tablaPM +
    '<div style="font-size:10px;color:var(--tx3)">Los PM de camionetas y buses (por km) cuentan en el porcentaje con su desvío en días, pero no tienen horas de desviación para esta tabla.</div></div>' +
    '<div class="chart-box" style="border-left:3px solid var(--danger);margin-bottom:16px"><div class="chart-t">IV. Equipos fuera de servicio (' + fn(fs.total) + ')</div>' +
    '<div style="font-size:11px;color:var(--tx2);line-height:1.55;padding:4px 0 10px">Equipos con una salida de servicio todavía abierta hoy, del más antiguo al más nuevo. Cuando vuelvan a operar se cierran desde Correctivos y salen de esta lista; hay que informarlos para que entren al programa de PM.</div>' + tablaFS + '</div>' + secBacklog + secConf + secCalidad + secTiempo + secActividad + secHH;
  setTimeout(function () { aplicarOrdenUniversal('s-gestion'); }, 60);
}

// Puente window/renders — ver nota en mov.js (primera tanda).
window.renderGestion = renderGestion;
window.gestionPeriodo = gestionPeriodo;
window.gestionRango = gestionRango;
window.gestionCalidadEq = gestionCalidadEq;
window.gestionActividadPer = gestionActividadPer;
window.gestionBacklogAgregar = gestionBacklogAgregar;
window.gestionBacklogCerrar = gestionBacklogCerrar;
window.gestionBacklogInsumo = gestionBacklogInsumo;
renders.gestion = renderGestion;
