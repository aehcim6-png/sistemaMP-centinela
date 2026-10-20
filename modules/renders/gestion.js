// Pestaña Informe de gestión (sub-pestaña de Metas & KPIs): las secciones I y II (certeza y cumplimiento de programa), III (desviaciones de mantenimiento), IV (equipos fuera de servicio) y V (backlog de pautas) del informe semanal que
// arma el cliente ("Centinela Ripios OXE"), calculadas con los datos del sistema. El cálculo vive en logic.js (informeGestionPM / informeGestionFS, con pruebas);
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
    '<div style="font-size:11px;color:var(--tx2);line-height:1.55;padding:4px 0 10px">Equipos con una salida de servicio todavía abierta hoy, del más antiguo al más nuevo. Cuando vuelvan a operar se cierran desde Correctivos y salen de esta lista; hay que informarlos para que entren al programa de PM.</div>' + tablaFS + '</div>' + secBacklog;
  setTimeout(function () { aplicarOrdenUniversal('s-gestion'); }, 60);
}

// Puente window/renders — ver nota en mov.js (primera tanda).
window.renderGestion = renderGestion;
window.gestionPeriodo = gestionPeriodo;
window.gestionRango = gestionRango;
window.gestionBacklogAgregar = gestionBacklogAgregar;
window.gestionBacklogCerrar = gestionBacklogCerrar;
window.gestionBacklogInsumo = gestionBacklogInsumo;
renders.gestion = renderGestion;
