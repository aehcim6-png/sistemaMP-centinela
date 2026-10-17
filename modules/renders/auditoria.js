// Historial de cambios campo por campo (2026-10-17): quién cambió qué, en qué pestaña, de qué valor a cuál y cuándo.
// Lee public.auditoria_cambios (tabla de solo agregar; solo un admin activo puede leerla). Se abre como ventana desde "Auditoría de Datos" → "Quién cambió qué".
// El registro lo escribe store.js en cada guardado confirmado en la nube (ver auditoriaDiff en logic.js). Los filtros se aplican en el servidor y se muestran
// de a 100 filas, de la más nueva a la más antigua.
var _AUD_PASO = 100;
var _audPag = 0;

export function verAuditoriaCambios() {
  if (window._userRole !== 'admin') { toast('⛔ Solo un administrador puede ver el historial de cambios'); return; }
  _audPag = 0;
  sm('<div style="max-width:1180px"><div id="s-auditcambios">Cargando…</div></div>');
  $('mc').style.maxWidth = '1200px';
  renderAuditoriaCambios();
}

function _audFiltros() {
  var v = function (id) { var e = $(id); return e ? e.value.trim() : ''; };
  return { usuario: v('acUsuario'), pestana: v('acPestana'), tabla: v('acTabla'), accion: v('acAccion'), texto: v('acTexto'), desde: v('acDesde'), hasta: v('acHasta') };
}

function _audUrl(f, offset) {
  var c = _sbCfg();
  var q = ['select=*', 'order=fecha.desc', 'limit=' + _AUD_PASO, 'offset=' + offset];
  var e = encodeURIComponent;
  // Texto libre: se quitan los caracteres que PostgREST usa como separadores para que no rompan el filtro.
  var limpio = function (t) { return t.replace(/[,()"*\\]/g, ' ').trim(); };
  var conds = [];
  if (f.usuario) conds.push('or(usuario_email.ilike.' + e('*' + limpio(f.usuario) + '*') + ',usuario_nombre.ilike.' + e('*' + limpio(f.usuario) + '*') + ')');
  if (f.pestana) q.push('pestana=eq.' + e(f.pestana));
  if (f.tabla) q.push('tabla=eq.' + e(f.tabla));
  if (f.accion) q.push('accion=eq.' + e(f.accion));
  if (f.texto) conds.push('or(referencia.ilike.' + e('*' + limpio(f.texto) + '*') + ',registro.ilike.' + e('*' + limpio(f.texto) + '*') + ',campo.ilike.' + e('*' + limpio(f.texto) + '*') + ')');
  if (conds.length) q.push('and=(' + conds.join(',') + ')');
  if (f.desde) q.push('fecha=gte.' + e(new Date(f.desde + 'T00:00:00').toISOString()));
  if (f.hasta) q.push('fecha=lt.' + e(new Date(new Date(f.hasta + 'T00:00:00').getTime() + 864e5).toISOString()));
  return c.url + '/rest/v1/auditoria_cambios?' + q.join('&');
}

function _audFecha(iso) {
  var d = new Date(iso);
  if (isNaN(d)) return '—';
  var p = function (n) { return ('0' + n).slice(-2); };
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

export function renderAuditoriaCambios() {
  var el = $('s-auditcambios');
  if (!el) return;
  var f = _audFiltros();
  var primera = !$('acUsuario');
  var cab = primera ? _audCabecera(f) : null;
  if (primera) el.innerHTML = cab + '<div id="acResultado"><p style="font-size:12px;color:var(--tx3)">Cargando…</p></div>';
  var res = $('acResultado');
  if (!res) return;
  res.innerHTML = '<p style="font-size:12px;color:var(--tx3)">Cargando…</p>';
  fetch(_audUrl(f, _audPag * _AUD_PASO), { headers: Object.assign({}, _sbHeaders(), { 'Prefer': 'count=exact' }) })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var total = parseInt(((r.headers.get('content-range') || '').split('/')[1]) || '0', 10) || 0;
      return r.json().then(function (filas) { return { filas: filas, total: total }; });
    })
    .then(function (x) { window._audUltimas = x.filas; _audPintar(res, x.filas, x.total); })
    .catch(function (e) {
      res.innerHTML = '<p style="font-size:12px;color:var(--danger)">No se pudo cargar el historial: ' + escapeHtml(e.message) + '</p>';
    });
}

function _audCabecera(f) {
  var tabs = (typeof TABS !== 'undefined' ? TABS : []).map(function (t) { return t.l; });
  var opt = function (lista, sel) { return lista.map(function (x) { return '<option' + (x === sel ? ' selected' : '') + '>' + escapeHtml(x) + '</option>'; }).join(''); };
  var tablas = typeof TABLA_REAL !== 'undefined' ? Object.keys(TABLA_REAL).map(function (k) { return TABLA_REAL[k].tabla; }).filter(function (t) { return ['changelog', 'mapeo_repuestos', 'alertas', 'ordenes_compra_historico', 'compras_detalle', 'papelera'].indexOf(t) < 0; }).sort() : [];
  return '<div class="sec-h"><div><div class="sec-t">' + ICONS.eye + ' Quién cambió qué</div>' +
    '<div class="sec-s">Cada cambio guardado queda con la persona, la pestaña y el valor de antes y de después. Nadie puede editar ni borrar este historial.</div></div>' +
    '<div class="acc-grupo"><button class="btn btn-o" onclick="auditoriaExportar()">Exportar CSV</button><button class="btn btn-o" onclick="cm()">Cerrar</button></div></div>' +
    '<div class="toolbar" style="flex-wrap:wrap">' +
    '<input id="acUsuario" placeholder="Persona (nombre o correo)" onchange="auditoriaFiltrar()" style="min-width:190px">' +
    '<select id="acPestana" onchange="auditoriaFiltrar()"><option value="">Todas las pestañas</option>' + opt(tabs, f.pestana) + '</select>' +
    '<select id="acTabla" onchange="auditoriaFiltrar()"><option value="">Todas las tablas</option>' + opt(tablas, f.tabla) + '</select>' +
    '<select id="acAccion" onchange="auditoriaFiltrar()"><option value="">Crear, editar y eliminar</option><option value="crear">Solo altas</option><option value="editar">Solo ediciones</option><option value="eliminar">Solo bajas</option></select>' +
    '<input id="acTexto" placeholder="Buscar equipo, registro o campo" onchange="auditoriaFiltrar()" style="min-width:200px">' +
    '<label style="font-size:11px;color:var(--tx3)">Desde <input type="date" id="acDesde" onchange="auditoriaFiltrar()"></label>' +
    '<label style="font-size:11px;color:var(--tx3)">Hasta <input type="date" id="acHasta" onchange="auditoriaFiltrar()"></label></div>';
}

function _audPintar(res, filas, total) {
  if (!filas.length) {
    res.innerHTML = '<div style="padding:28px;text-align:center;color:var(--tx3);font-size:13px">' +
      (total === 0 && !_audFiltrosActivos() ? 'Todavía no hay cambios registrados. El historial empieza a llenarse desde que se activó esta auditoría (17 oct 2026).' : 'Ningún cambio coincide con estos filtros.') + '</div>';
    return;
  }
  var desde = _audPag * _AUD_PASO + 1, hasta = _audPag * _AUD_PASO + filas.length;
  var totalConocido = total >= hasta; // el servidor no siempre informa el total
  var hayMas = totalConocido ? hasta < total : filas.length >= _AUD_PASO;
  if (!totalConocido) total = hasta;
  var color = { crear: 'var(--ok)', editar: 'var(--ac)', eliminar: 'var(--danger)' };
  res.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin:4px 0 8px;font-size:12px;color:var(--tx3)">' +
    '<span>' + desde + '–' + hasta + ' de ' + total + ' cambio' + (total === 1 ? '' : 's') + '</span>' +
    '<span><button class="btn-s btn-o" ' + (_audPag ? '' : 'disabled') + ' onclick="auditoriaPagina(-1)">← Más nuevos</button> <button class="btn-s btn-o" ' + (hayMas ? '' : 'disabled') + ' onclick="auditoriaPagina(1)">Más antiguos →</button></span></div>' +
    '<div class="tbl-wrap"><table style="font-size:12px"><tr><th>Cuándo</th><th>Quién</th><th>Pestaña</th><th>Registro</th><th>Qué</th><th>Antes</th><th>Después</th></tr>' +
    filas.map(function (r) {
      var que = r.accion === 'editar' ? '<b>' + escapeHtml(r.campo || '') + '</b>' : '<b style="color:' + color[r.accion] + '">' + (r.accion === 'crear' ? 'Alta' : 'Baja') + '</b>' + (r.campo ? ' · ' + escapeHtml(r.campo) : '');
      return '<tr>' +
        '<td class="mono" style="white-space:nowrap">' + _audFecha(r.fecha) + '</td>' +
        '<td>' + escapeHtml(r.usuario_nombre || '—') + '<div style="font-size:10px;color:var(--tx3)">' + escapeHtml(r.usuario_email || '') + (r.rol ? ' · ' + escapeHtml(r.rol) : '') + '</div></td>' +
        '<td>' + escapeHtml(r.pestana || '—') + (r.subpestana ? '<div style="font-size:10px;color:var(--tx3)">' + escapeHtml(r.subpestana) + '</div>' : '') + '</td>' +
        '<td>' + escapeHtml(r.referencia || '—') + '<div style="font-size:10px;color:var(--tx3)">' + escapeHtml(r.tabla) + (r.registro ? ' · ' + escapeHtml(String(r.registro).slice(0, 12)) : '') + '</div></td>' +
        '<td>' + que + '</td>' +
        '<td style="max-width:200px;white-space:normal;word-break:break-word;color:var(--tx3)">' + escapeHtml(r.valor_antes == null ? '—' : r.valor_antes) + '</td>' +
        '<td style="max-width:200px;white-space:normal;word-break:break-word">' + escapeHtml(r.valor_despues == null ? '—' : r.valor_despues) + '</td></tr>';
    }).join('') + '</table></div>';
}

function _audFiltrosActivos() {
  var f = _audFiltros();
  return !!(f.usuario || f.pestana || f.tabla || f.accion || f.texto || f.desde || f.hasta);
}

export function auditoriaFiltrar() { _audPag = 0; renderAuditoriaCambios(); }
export function auditoriaPagina(d) { _audPag = Math.max(0, _audPag + d); renderAuditoriaCambios(); }

export function auditoriaExportar() {
  var filas = window._audUltimas || [];
  if (!filas.length) { toast('No hay filas para exportar'); return; }
  var cols = ['fecha', 'usuario_nombre', 'usuario_email', 'rol', 'pestana', 'subpestana', 'tabla', 'registro', 'referencia', 'accion', 'campo', 'valor_antes', 'valor_despues'];
  var esc = function (v) { var s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  var csv = '﻿' + cols.join(';') + '\n' + filas.map(function (r) { return cols.map(function (c) { return esc(r[c]); }).join(';'); }).join('\n');
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'historial_de_cambios.csv';
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
}

// Puente window/renders — mismo patrón que log.js.
window.verAuditoriaCambios = verAuditoriaCambios;
window.renderAuditoriaCambios = renderAuditoriaCambios;
window.auditoriaFiltrar = auditoriaFiltrar;
window.auditoriaPagina = auditoriaPagina;
window.auditoriaExportar = auditoriaExportar;
renders.auditoria = renderAuditoriaCambios;
