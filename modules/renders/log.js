// Pestaña Log de Cambios (auditoría) — extraída a su propio archivo
// (Fase 2 de modularización). Script plano (NO módulo ES), mismo scope
// global de siempre.
//
// renderLog() en sí no tenía ningún botón ni contenedor que la mostrara en
// ninguna pestaña — quedaba huérfana desde antes de esta extracción. Se
// agrega verLogCambios() (mismo patrón que verAccesos(), ya usado en
// Configuración) para abrirla como modal: sm() reemplaza el contenido del
// modal por un <div id="s-log"> vacío y luego renderLog() lo llena — los
// filtros/paginación/"Limpiar" de adentro siguen funcionando porque cada
// uno vuelve a llamar renders.log(), que sigue encontrando el mismo div
// mientras el modal esté abierto.
window.verLogCambios = function () {
  sm('<div style="max-width:900px"><div id="s-log"></div><button class="btn btn-o" style="margin-top:12px" onclick="cm()">Cerrar</button></div>');
  renders.log();
};
window.renderLog = function () {
  var log = S.g('changelog') || [];
  var fAccion = $('fLogAccion')?.value || '';
  var fil = log.filter(function (l) { return !fAccion || l.accion.includes(fAccion); });
  var acciones = [...new Set(log.map(function (l) { return l.accion.split(' ')[0] + ' ' + l.accion.split(' ')[1]; }).filter(function (a) { return a.trim(); }))];
  var pg = _pagSlice('log', fil);
  $('s-log').innerHTML =
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="10" height="15" rx="1.5"/><rect x="7.5" y="2" width="5" height="2.5" rx="0.8"/><line x1="7" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/><line x1="7" y1="15" x2="11" y2="15"/></svg> Log de Cambios</div>' +
    '<div class="sec-s">' + log.length + ' registros · Auditoría del sistema</div></div>' +
    '<button class="btn btn-o" onclick="if(confirm(\'¿Limpiar log?\')){S.s(\'changelog\',[]);renders.log();}"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg> Limpiar</button></div>' +
    '<div class="toolbar">' +
    '<select id="fLogAccion" onchange="window._pag.log=1;renders.log()"><option value="">Todas las acciones</option>' +
    acciones.map(function (a) { return '<option' + (fAccion === a ? ' selected' : '') + '>' + a + '</option>' }).join('') + '</select></div>' +
    _pagHTML('log', pg) +
    '<div class="tbl-wrap"><table>' +
    '<tr><th>Fecha/Hora</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr>' +
    pg.items.map(function (l) {
      return '<tr><td class="mono" style="font-size:10px;white-space:nowrap">' + l.fecha + '</td>' +
        '<td style="font-size:11px">' + escapeHtml(l.usuario || '—') + '</td>' +
        '<td style="font-size:11px;font-weight:600">' + escapeHtml(l.accion) + '</td>' +
        '<td style="font-size:11px;color:var(--tx3);max-width:400px">' + escapeHtml(l.detalle) + '</td></tr>';
    }).join('') +
    '</table></div>' +
    _pagHTML('log', pg);
};
