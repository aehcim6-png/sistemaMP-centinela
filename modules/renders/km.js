// ═══════════════════════════════════════════════════════════════
// IMPORTAR LA PLANILLA «CONTROL KILOMETRAJE» (2026-11-03)
//
// La planilla de equipos livianos (camionetas y bus) se repite cada semana: la mantiene una persona de la faena en Excel. Esta pantalla toma el .xlsx,
// lo lee con kilometrajeAnalizar (logic.js, con pruebas) y muestra lo que PROPONE: la lectura de km de cada equipo (validada contra su historial) y la
// próxima mantención. NUNCA guarda sin que la persona revise y marque. Es una vía ADICIONAL: el registro manual de lecturas y el CSV siguen igual.
//
// La próxima mantención NO se escribe directo: el sistema la recalcula desde la grilla del equipo y un valor puesto a mano se perdería. Cuando la planilla
// es más cercana que el sistema se fija en «pmPendienteManual» (el campo que gana si es menor); ver kilometrajeAnalizar.
//
// Módulo ES (mismo patrón que chat.js): sin imports, todo vía el realm global compartido con logic.js/store.js/index.html.
// ═══════════════════════════════════════════════════════════════

var _kmAn = null;       // último análisis (lo que se muestra y lo que se marca)
var _kmFilas = null;    // filas de la planilla (se conservan para volver a analizar con otra fecha)
var _kmNombre = '';

function _kmHoy() { return new Date().toISOString().slice(0, 10); }
function _kmF(f) { return f ? f.slice(8, 10) + '-' + f.slice(5, 7) + '-' + f.slice(2, 4) : ''; }

export function importarKilometraje() {
  if (window._userRole === 'lector') return toast('⛔ Tu rol es solo lectura');
  _kmAn = null; _kmFilas = null; _kmNombre = '';
  sm('<h3>📋 Importar planilla «Control Kilometraje»</h3>' +
    '<p style="font-size:12px;color:var(--tx3);margin:0 0 8px">Sube el Excel de equipos livianos (camionetas y bus). El sistema lee el km de cada equipo y su próxima mantención, y te muestra qué propone cargar. <b>No se guarda nada hasta que lo marques y confirmes.</b></p>' +
    '<p style="font-size:11px;color:var(--tx3);margin:0 0 10px">Es una vía adicional: el registro manual de lecturas y el CSV de horómetros siguen funcionando igual.</p>' +
    '<input type="file" id="kmArchivo" accept=".xlsx,.xls" onchange="_kmArchivoElegido(this)" style="margin:6px 0 10px">' +
    '<div id="kmEstado" style="font-size:12px;color:var(--tx3)">Elige el archivo para empezar.</div>' +
    '<div style="margin-top:12px"><button class="btn btn-o" onclick="cm()">Cancelar</button></div>');
}

export async function _kmArchivoElegido(input) {
  var file = input && input.files && input.files[0];
  if (!file) return;
  var est = $('kmEstado');
  if (est) est.textContent = '⏳ Leyendo ' + file.name + '…';
  try {
    if (typeof XLSX === 'undefined' || !XLSX.read) throw new Error('La biblioteca de Excel no cargó. Recarga la página.');
    var wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    var hoja = null;
    // la hoja correcta es la que tiene las columnas «Sigla» y «Km Actual»; se prueba cada una por si el libro trae varias
    wb.SheetNames.some(function (n) {
      var filas = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null });
      var ok = filas.some(function (f) { var t = (f || []).map(function (c) { return String(c || '').toLowerCase().trim(); }); return t.indexOf('sigla') >= 0 && t.indexOf('km actual') >= 0; });
      if (ok) { hoja = filas; return true; }
      return false;
    });
    if (!hoja) throw new Error('No encontré una hoja con las columnas «Sigla» y «Km Actual». ¿Es la planilla Control Kilometraje?');
    _kmFilas = hoja; _kmNombre = file.name;
    _kmAnalizar('');
  } catch (err) {
    if (est) est.textContent = '❌ ' + err.message;
  }
}

function _kmAnalizar(fecha) {
  _kmAn = kilometrajeAnalizar(_kmFilas, { equipos: S.g('eq') || [], hist: S.g('hist') || [], fecha: fecha || '' });
  if (_kmAn.error) {
    var est = $('kmEstado');
    if (est) est.textContent = '❌ ' + _kmAn.error;
    return;
  }
  _kmPintar();
}

export function _kmVolverAnalizar() {
  _kmAnalizar($('kmFecha') ? $('kmFecha').value : '');
}

var _KM_ETIQ = { ok: 'Lista', ya: 'Ya hay lectura ese día', menor: 'Menor que la anterior', mayor: 'Mayor que la siguiente', rapido: 'Salto grande', sinfecha: 'Sin fecha',
  igual: 'Igual al sistema', manual: 'Fijar a mano', sistema: 'Manda el sistema', frecuencia: 'No cuadra con la frecuencia' };
function _kmBadge(e) {
  var bueno = e === 'ok' || e === 'manual';
  var neutro = e === 'ya' || e === 'igual' || e === 'sistema';
  var col = bueno ? 'var(--ok,#1a7f37)' : neutro ? 'var(--tx3)' : 'var(--w,#b36b00)';
  return '<span style="font-size:10px;font-weight:700;color:' + col + '">' + escapeHtml(_KM_ETIQ[e] || e) + '</span>';
}
function _kmContar() {
  var a = _kmAn || {};
  return [].concat(a.lecturas || [], a.mantenciones || []).filter(function (x) { return x.marcado; }).length;
}
function _kmCasilla(sec, i, x) {
  var puede = x.estado === 'ok' || x.estado === 'manual' || x.estado === 'menor' || x.estado === 'mayor' || x.estado === 'rapido';
  return puede ? '<input type="checkbox"' + (x.marcado ? ' checked' : '') + ' onchange="_kmMarcar(\'' + sec + '\',' + i + ',this.checked)">' : '';
}
function _kmSeccion(titulo, n, cuerpo, abierta) {
  return '<details' + (abierta ? ' open' : '') + ' style="margin:8px 0;border:1px solid var(--bd);border-radius:8px;padding:6px 10px"><summary style="cursor:pointer;font-weight:700;font-size:13px">' + titulo + ' <span style="color:var(--tx3);font-weight:400">(' + n + ')</span></summary>' + cuerpo + '</details>';
}

function _kmPintar() {
  var a = _kmAn, h = '';
  h += '<h3>📋 Control Kilometraje — propuesta</h3>';
  h += '<p style="font-size:12px;color:var(--tx3);margin:0 0 6px">' + escapeHtml(_kmNombre) + ' · ' + a.resumen.filas + ' equipos en la planilla. Marca lo que quieras cargar.</p>';
  h += '<div style="font-size:12px;margin-bottom:8px">Fecha de las lecturas <input type="date" id="kmFecha" value="' + escapeHtml(a.fecha || _kmHoy()) + '"> <button class="btn btn-o" style="padding:2px 8px" onclick="_kmVolverAnalizar()">Volver a revisar</button> <span style="color:var(--tx3)">' + (a.fechaOrigen === 'planilla' ? '(la que trae la planilla)' : a.fechaOrigen === 'manual' ? '(la que elegiste)' : '(la planilla no trae fecha: elígela)') + '</span></div>';
  var lr = a.lecturas.map(function (x, i) {
    return '<tr><td>' + _kmCasilla('lecturas', i, x) + '</td><td class="mono" style="color:var(--ac)">' + escapeHtml(x.sigla) + '</td><td>' + escapeHtml(x.patente || '') + '</td><td class="mono">' + _kmF(x.fecha) + '</td><td class="mono" style="text-align:right">' + fn(x.valor) + '</td><td class="mono" style="text-align:right;color:var(--tx3)">' + (x.prev ? fn(x.prev.valor) + ' (' + _kmF(x.prev.fecha) + ')' : '—') + '</td><td>' + _kmBadge(x.estado) + (x.nota ? '<div style="font-size:10px;color:var(--tx3)">' + escapeHtml(x.nota) + '</div>' : '') + '</td></tr>';
  }).join('');
  h += _kmSeccion('Lecturas de km', a.lecturas.length, a.lecturas.length ? '<div class="tbl-wrap"><table><tr><th></th><th>Equipo</th><th>Patente</th><th>Fecha</th><th>Km</th><th>Anterior</th><th>Estado</th></tr>' + lr + '</table></div>' : '<p style="font-size:12px;color:var(--tx3);margin:6px 0">Nada que cargar.</p>', true);
  var mr = a.mantenciones.map(function (x, i) {
    return '<tr><td>' + _kmCasilla('mantenciones', i, x) + '</td><td class="mono" style="color:var(--ac)">' + escapeHtml(x.sigla) + '</td><td class="mono" style="text-align:right">' + (x.ultima != null ? fn(x.ultima) : '—') + '</td><td class="mono" style="text-align:right">' + fn(x.proxPlanilla) + '</td><td class="mono" style="text-align:right">' + (x.proxSistema ? fn(x.proxSistema) : '—') + '</td><td>' + _kmBadge(x.estado) + (x.nota ? '<div style="font-size:10px;color:var(--tx3)">' + escapeHtml(x.nota) + '</div>' : '') + '</td></tr>';
  }).join('');
  h += _kmSeccion('Próxima mantención', a.mantenciones.length, a.mantenciones.length ? '<div class="tbl-wrap"><table><tr><th></th><th>Equipo</th><th>Última (planilla)</th><th>Próxima (planilla)</th><th>Próxima (sistema)</th><th>Qué pasa</th></tr>' + mr + '</table></div><p style="font-size:10px;color:var(--tx3);margin:4px 0">El sistema calcula la próxima mantención desde su grilla; «Fijar a mano» solo se usa cuando la planilla es más cercana.</p>' : '<p style="font-size:12px;color:var(--tx3);margin:6px 0">Nada que revisar.</p>', true);
  var av = [];
  if (a.sinEquipo.length) av.push('Equipos de la planilla que no están en el sistema (no se cargaron): <b>' + a.sinEquipo.map(function (x) { return escapeHtml(x.sigla) + (x.patente ? ' (' + escapeHtml(x.patente) + ')' : '') + (x.km ? ' ' + fn(x.km) + ' km' : ' sin km'); }).join(', ') + '</b>. Para cargarlos hay que darlos de alta en Equipos.');
  if (a.sinKm.length) av.push('Sin km en la planilla: <b>' + a.sinKm.map(function (x) { return escapeHtml(x.sigla); }).join(', ') + '</b>.');
  if (a.notas.length) av.push('Notas de la planilla: ' + a.notas.map(function (n) { return '<b>' + escapeHtml(n.sigla) + '</b> ' + escapeHtml(n.texto); }).join(' · '));
  if (av.length) h += '<div style="font-size:11px;color:var(--tx3);margin:8px 0">' + av.map(function (x) { return '• ' + x; }).join('<br>') + '</div>';
  h += '<div style="display:flex;gap:8px;align-items:center;margin-top:10px"><button class="btn" id="kmBtnImportar" onclick="_kmImportar()">Cargar lo marcado (' + _kmContar() + ')</button><button class="btn btn-o" onclick="cm()">Cancelar</button></div>';
  sm(h);
  $('mc').style.maxWidth = '980px';
}

export function _kmMarcar(sec, i, v) {
  var L = _kmAn && _kmAn[sec];
  if (!L || !L[i]) return;
  L[i].marcado = !!v;
  var b = $('kmBtnImportar');
  if (b) b.textContent = 'Cargar lo marcado (' + _kmContar() + ')';
}

export function _kmImportar() {
  if (!_kmAn) return;
  if (window._userRole === 'lector') return toast('⛔ Tu rol es solo lectura');
  var hoy = _kmHoy(), origen = 'Control Kilometraje (importado ' + hoy + ')';
  var eq = S.g('eq') || [], hist = S.g('hist') || [];
  var res = { lect: 0, lectSaltadas: 0, mant: 0, mantSaltadas: 0 };
  var yaHay = {};
  hist.forEach(function (x) { yaHay[x.sigla + '|' + x.fecha] = true; });
  var maxPorEq = {};
  _kmAn.lecturas.forEach(function (x) {
    if (!x.marcado) return;
    // mientras se revisaba pudo aparecer una lectura ese día: no se duplica
    if (yaHay[x.sigla + '|' + x.fecha]) { res.lectSaltadas++; return; }
    yaHay[x.sigla + '|' + x.fecha] = true;
    hist.push({ sigla: x.sigla, fecha: x.fecha, turno: '', horom: x.valor, horomIni: x.prev ? x.prev.valor : null, horomFin: x.valor, origen: origen });
    res.lect++;
    var m = maxPorEq[x.sigla];
    if (!m || x.fecha > m.fecha || (x.fecha === m.fecha && x.valor > m.valor)) maxPorEq[x.sigla] = { fecha: x.fecha, valor: x.valor };
  });
  // El horómetro actual de cada equipo sigue a su lectura más reciente (igual que el importador CSV y el del chat).
  eq.forEach(function (e) {
    var m = maxPorEq[e.sigla];
    if (m && m.valor >= (e.horomActual || 0) && (!e.fechaHorom || m.fecha >= e.fechaHorom)) { e.horomActual = m.valor; e.fechaHorom = m.fecha; _recalcEq(e); }
  });
  // Próxima mantención: se fija en pmPendienteManual (gana si es menor que la que calcula el sistema).
  _kmAn.mantenciones.forEach(function (x) {
    if (!x.marcado || x.estado !== 'manual') return;
    var e = eq.find(function (q) { return q.sigla === x.sigla; });
    if (!e) { res.mantSaltadas++; return; }
    e.pmPendienteManual = x.proxPlanilla;
    _recalcEq(e);
    res.mant++;
  });
  if (res.lect) S.s('hist', hist);
  if (res.lect || res.mant) S.s('eq', eq);
  cm(); refreshAll();
  var filas = [];
  if (res.lect) filas.push(res.lect + ' lectura(s) de km');
  if (res.mant) filas.push(res.mant + ' próxima(s) mantención(es) fijada(s) a mano');
  var saltos = res.lectSaltadas + res.mantSaltadas;
  sm('<h3>' + ICONS.check + ' Planilla importada</h3>' +
    (filas.length ? '<p style="font-size:13px">' + filas.map(escapeHtml).join('<br>') + '</p>' : '<p style="font-size:13px">No había nada marcado para cargar.</p>') +
    (saltos ? '<p style="font-size:12px;color:var(--w)">⚠️ ' + saltos + ' ítem(s) se omitieron porque mientras revisabas ya apareció el mismo dato.</p>' : '') +
    '<p style="font-size:11px;color:var(--tx3)">Las lecturas quedan con el origen «' + escapeHtml(origen) + '».</p>' +
    '<button class="btn" onclick="cm()">Cerrar</button>');
  _kmAn = null; _kmFilas = null;
}

// Puente window — ver nota en mov.js (primera tanda).
window.importarKilometraje = importarKilometraje;
window._kmArchivoElegido = _kmArchivoElegido;
window._kmVolverAnalizar = _kmVolverAnalizar;
window._kmMarcar = _kmMarcar;
window._kmImportar = _kmImportar;
