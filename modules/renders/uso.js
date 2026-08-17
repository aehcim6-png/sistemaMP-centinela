// Pestaña "Uso del sistema" (dentro de Configuración, solo admin) — mismo
// patrón que log.js (verLogCambios/renderLog): verUsoPestanas() abre un
// modal con un <div id="s-uso"> vacío y renderUso() lo llena.
//
// A diferencia del resto de las pestañas, NO lee de S.g('uso_pestanas') —
// esa categoría no existe en TABLA_REAL a propósito (ver
// 20260817050000_crear_tabla_uso_pestanas.sql): un log que crece con cada
// clic no debería descargarse completo en cada login. Acá se trae con un
// fetch directo a PostgREST, on-demand, solo cuando un admin abre este
// modal — el mismo mecanismo que ya escribe los eventos (_logUsoPestana,
// modules/store.js).
window.verUsoPestanas = function () {
  sm('<div style="max-width:760px"><div id="s-uso">Cargando…</div><button class="btn btn-o" style="margin-top:12px" onclick="cm()">Cerrar</button></div>');
  renderUso();
};

window.renderUso = function () {
  var el = $('s-uso');
  if (!el) return;
  el.innerHTML = '<p style="font-size:12px;color:var(--tx3)">Cargando…</p>';
  var c = _sbCfg();
  var desde = new Date(Date.now() - 90 * 864e5).toISOString();
  fetch(c.url + '/rest/v1/uso_pestanas?select=pestana,fecha&fecha=gte.' + encodeURIComponent(desde) + '&order=fecha.desc&limit=20000', { headers: _sbHeaders() })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (filas) { _pintarUso(el, filas); })
    .catch(function (e) {
      el.innerHTML = '<p style="font-size:12px;color:var(--danger)">No se pudo cargar el uso: ' + escapeHtml(e.message) + '</p>';
    });
};

function _pintarUso(el, filas) {
  var ahora = Date.now();
  var conteos = {};
  filas.forEach(function (f) {
    if (!f || !f.pestana || !f.fecha) return;
    var edadDias = (ahora - new Date(f.fecha).getTime()) / 864e5;
    if (!conteos[f.pestana]) conteos[f.pestana] = { d7: 0, d30: 0, d90: 0, ultima: f.fecha };
    conteos[f.pestana].d90++;
    if (edadDias <= 30) conteos[f.pestana].d30++;
    if (edadDias <= 7) conteos[f.pestana].d7++;
    if (f.fecha > conteos[f.pestana].ultima) conteos[f.pestana].ultima = f.fecha;
  });
  var filasTabla = Object.keys(conteos).map(function (k) {
    var c = conteos[k];
    return { pestana: k, d7: c.d7, d30: c.d30, d90: c.d90, ultima: c.ultima };
  }).sort(function (a, b) { return b.d90 - a.d90; });

  if (!filasTabla.length) {
    el.innerHTML =
      '<div class="sec-h"><div><div class="sec-t">📊 Uso del sistema</div>' +
      '<div class="sec-s">Aperturas de pestañas y sub-pestañas — últimos 90 días</div></div></div>' +
      '<p style="font-size:12px;color:var(--tx3);padding:12px 0">Todavía no hay datos suficientes (esto empezó a registrarse el 2026-08-17). Vuelve en unos días.</p>';
    return;
  }
  el.innerHTML =
    '<div class="sec-h"><div><div class="sec-t">📊 Uso del sistema</div>' +
    '<div class="sec-s">Aperturas de pestañas y sub-pestañas — últimos 90 días</div></div></div>' +
    '<p style="font-size:11px;color:var(--tx3);margin:0 0 10px">Un clic en una pestaña o sub-pestaña cuenta una vez, sin importar cuánto tiempo se quedó abierta. Registrado desde el 2026-08-17 — mientras más días pasen, más confiable es la columna de 30/90 días.</p>' +
    '<div class="tbl-wrap"><table style="font-size:12px">' +
    '<tr><th>Pestaña</th><th style="text-align:center">7 días</th><th style="text-align:center">30 días</th><th style="text-align:center">90 días</th><th>Última vez</th></tr>' +
    filasTabla.map(function (f) {
      return '<tr><td class="mono">' + escapeHtml(f.pestana) + '</td>' +
        '<td style="text-align:center">' + f.d7 + '</td>' +
        '<td style="text-align:center">' + f.d30 + '</td>' +
        '<td style="text-align:center;font-weight:600">' + f.d90 + '</td>' +
        '<td class="mono" style="font-size:10px;color:var(--tx3)">' + new Date(f.ultima).toLocaleString('es-CL') + '</td></tr>';
    }).join('') +
    '</table></div>';
}
