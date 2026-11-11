// ═══════════════════════════════════════════════════════════════
// IMPORTAR EL CHAT DE WHATSAPP (2026-11-02)
//
// Los supervisores ya avisan cada falla y cada «operativo» en el grupo con la misma plantilla, y el guardia manda cada mañana el bloque de
// horómetros de las torres de iluminación. Esta pantalla toma el .txt (o el .zip) que exporta WhatsApp, lo lee con chatWhatsAppAnalizar
// (logic.js, con pruebas) y muestra lo que PROPONE cargar: paradas con entrada y salida, horómetros validados contra las lecturas vecinas y PM.
// NUNCA guarda sin que la persona revise y marque. Es una vía ADICIONAL: el CSV de horómetros, la OT manual y el registro de PM siguen igual.
//
// Módulo ES (mismo patrón que prod.js): sin imports, todo vía el realm global compartido con logic.js/store.js/index.html.
// ═══════════════════════════════════════════════════════════════

var _chatTxt = '';        // texto leído del archivo (se conserva para volver a analizar con otra fecha «desde»)
var _chatAn = null;       // último análisis (lo que se muestra y lo que se marca)
var _chatNombre = '';

function _chatHoy() { return new Date().toISOString().slice(0, 10); }
function _chatRestarDias(iso, n) { var d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); }
function _chatFecha(f) { return f ? f.slice(8, 10) + '-' + f.slice(5, 7) + '-' + f.slice(2, 4) : ''; }

// Abre el primer archivo de un .zip de WhatsApp (el .txt) con el descompresor del navegador. El directorio central da los tamaños aunque el
// archivo use «data descriptor», como hacen los zips que arma iOS.
async function _chatLeerZip(buf) {
  var v = new DataView(buf), u8 = new Uint8Array(buf), i, n = v.byteLength;
  for (i = n - 22; i >= 0 && i > n - 70000; i--) { if (v.getUint32(i, true) === 0x06054b50) break; }
  if (i < 0 || v.getUint32(i, true) !== 0x06054b50) throw new Error('El .zip no se pudo leer.');
  var cant = v.getUint16(i + 10, true), pos = v.getUint32(i + 16, true);
  for (var k = 0; k < cant; k++) {
    if (v.getUint32(pos, true) !== 0x02014b50) break;
    var metodo = v.getUint16(pos + 10, true), comp = v.getUint32(pos + 20, true), nlen = v.getUint16(pos + 28, true), elen = v.getUint16(pos + 30, true), clen = v.getUint16(pos + 32, true), ofs = v.getUint32(pos + 42, true);
    var nombre = new TextDecoder().decode(u8.subarray(pos + 46, pos + 46 + nlen));
    pos += 46 + nlen + elen + clen;
    if (!/\.txt$/i.test(nombre)) continue;
    var ini = ofs + 30 + v.getUint16(ofs + 26, true) + v.getUint16(ofs + 28, true), datos = u8.subarray(ini, ini + comp);
    if (metodo === 0) return new TextDecoder('utf-8').decode(datos);
    if (metodo === 8 && typeof DecompressionStream === 'function') {
      var flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new TextDecoder('utf-8').decode(await new Response(flujo).arrayBuffer());
    }
    throw new Error('Este navegador no abre el .zip. Descomprímelo y sube el .txt.');
  }
  throw new Error('El .zip no trae un archivo .txt.');
}

export function importarChatWhatsApp() {
  if (window._userRole === 'lector') return toast('⛔ Tu rol es solo lectura');
  _chatTxt = ''; _chatAn = null; _chatNombre = '';
  sm('<h3>💬 Importar chat de WhatsApp</h3>' +
    '<p style="font-size:12px;color:var(--tx3);margin:0 0 8px">Sube el archivo que exporta WhatsApp (grupo → ⋮ → Más → Exportar chat → <b>Sin archivos multimedia</b>). El sistema lee los avisos con la plantilla «Equipo / Estatus / Motivo / Horómetro» y el bloque diario de horómetros, y te <b>propone</b> qué cargar. No se guarda nada hasta que lo revises y lo marques.</p>' +
    '<p style="font-size:11px;color:var(--tx3);margin:0 0 10px">Es una vía adicional: el CSV de horómetros y el registro manual de OT y PM siguen funcionando igual.</p>' +
    '<input type="file" id="chatArchivo" accept=".txt,.zip,text/plain" onchange="_chatArchivoElegido(this)" style="margin:6px 0 10px">' +
    '<div style="font-size:12px;margin-bottom:12px">Leer los avisos <b>desde</b> <input type="date" id="chatDesde" value="' + _chatRestarDias(_chatHoy(), 30) + '" style="margin-left:4px"><span style="color:var(--tx3);margin-left:6px">(por defecto, los últimos 30 días)</span></div>' +
    '<div id="chatEstado" style="font-size:12px;color:var(--tx3)">Elige el archivo para empezar.</div>' +
    '<div style="margin-top:12px"><button class="btn btn-o" onclick="cm()">Cancelar</button></div>');
}

export async function _chatArchivoElegido(input) {
  var file = input && input.files && input.files[0];
  if (!file) return;
  var est = $('chatEstado');
  if (est) est.textContent = '⏳ Leyendo ' + file.name + '…';
  try {
    if (/\.zip$/i.test(file.name)) _chatTxt = await _chatLeerZip(await file.arrayBuffer());
    else _chatTxt = await new Promise(function (ok, mal) { var r = new FileReader(); r.onload = function () { ok(String(r.result)); }; r.onerror = function () { mal(new Error('No se pudo leer el archivo.')); }; r.readAsText(file, 'UTF-8'); });
    _chatNombre = file.name;
    _chatAnalizar($('chatDesde') ? $('chatDesde').value : '');
  } catch (err) {
    if (est) est.textContent = '❌ ' + err.message;
  }
}

function _chatAnalizar(desde) {
  var siglas = (S.g('eq') || []).map(function (e) { return e.sigla; });
  _chatAn = chatWhatsAppAnalizar(_chatTxt, { siglas: siglas, desde: desde || '', hist: S.g('hist') || [], ot: S.g('ot') || [], reg: S.g('reg') || [], comp: S.g('compHist') || [] });
  if (!_chatAn.mensajes) {
    var est = $('chatEstado');
    if (est) est.textContent = '⚠️ No encontré mensajes en ese archivo (¿es el .txt exportado de WhatsApp?) o no hay avisos desde esa fecha.';
    return;
  }
  _chatPintar();
}

export function _chatVolverAnalizar() {
  var d = $('chatDesde2') ? $('chatDesde2').value : '';
  _chatAnalizar(d);
}

var _CHAT_ETIQ = { nueva: 'Nueva', cierra: 'Cierra una OT abierta', duplicada: 'Ya cargada', abierta: 'Sigue abierta', dudosa: 'Revisar', ok: 'Lista', ya: 'Ya hay lectura', menor: 'Menor que la anterior', mayor: 'Mayor que la siguiente', salto: 'Salto imposible', incoherente: 'Se contradice', 'sin-vecinos': 'Sin lecturas para comparar' };
function _chatBadge(e) {
  var bueno = e === 'nueva' || e === 'cierra' || e === 'ok';
  var neutro = e === 'duplicada' || e === 'ya';
  var col = bueno ? 'var(--ok,#1a7f37)' : neutro ? 'var(--tx3)' : 'var(--w,#b36b00)';
  return '<span style="font-size:10px;font-weight:700;color:' + col + '">' + escapeHtml(_CHAT_ETIQ[e] || e) + '</span>';
}
function _chatContar() {
  var a = _chatAn || {};
  return [].concat(a.paradas || [], a.horometros || [], a.pm || [], a.cambios || []).filter(function (x) { return x.marcado; }).length;
}
function _chatCasilla(sec, i, x) {
  return '<input type="checkbox"' + (x.marcado ? ' checked' : '') + ' onchange="_chatMarcar(\'' + sec + '\',' + i + ',this.checked)">';
}
function _chatSeccion(titulo, n, cuerpo, abierta) {
  return '<details' + (abierta ? ' open' : '') + ' style="margin:8px 0;border:1px solid var(--bd);border-radius:8px;padding:6px 10px"><summary style="cursor:pointer;font-weight:700;font-size:13px">' + titulo + ' <span style="color:var(--tx3);font-weight:400">(' + n + ')</span></summary>' + cuerpo + '</details>';
}
function _chatMarcaTodo(sec, solo) {
  return '<div style="margin:6px 0;font-size:11px"><a href="#" onclick="_chatMarcarTodo(\'' + sec + '\',true);return false">Marcar todo lo propuesto</a> · <a href="#" onclick="_chatMarcarTodo(\'' + sec + '\',false);return false">Desmarcar todo</a>' + (solo ? ' <span style="color:var(--tx3)">· ' + solo + '</span>' : '') + '</div>';
}

function _chatPintar() {
  var a = _chatAn, r = a.resumen, h = '';
  h += '<h3>💬 Chat de WhatsApp — propuesta</h3>';
  h += '<p style="font-size:12px;color:var(--tx3);margin:0 0 6px">' + escapeHtml(_chatNombre) + ' · ' + a.mensajes + ' mensajes y ' + a.reportes + ' avisos con plantilla del ' + _chatFecha(a.desde) + ' al ' + _chatFecha(a.hasta) + '. Marca lo que quieras cargar y confirma abajo.</p>';
  h += '<div style="font-size:12px;margin-bottom:8px">Leer desde <input type="date" id="chatDesde2" value="' + escapeHtml($('chatDesde') ? $('chatDesde').value : (a.desde || '')) + '"> <button class="btn btn-o" style="padding:2px 8px" onclick="_chatVolverAnalizar()">Volver a analizar</button></div>';
  // Paradas
  var pr = a.paradas.map(function (p, i) {
    return '<tr><td>' + _chatCasilla('paradas', i, p) + '</td><td class="mono" style="color:var(--ac)">' + escapeHtml(p.sigla) + '</td><td class="mono">' + _chatFecha(p.entrada.f) + ' ' + p.entrada.h + '</td><td class="mono">' + (p.salida ? _chatFecha(p.salida.f) + ' ' + p.salida.h : '—') + '</td><td>' + escapeHtml(p.duracion || '—') + '</td><td style="max-width:260px">' + escapeHtml(p.motivo || '') + '</td><td>' + _chatBadge(p.estado) + (p.motivoEstado ? '<div style="font-size:10px;color:var(--tx3)">' + escapeHtml(p.motivoEstado) + '</div>' : '') + '</td></tr>';
  }).join('');
  h += _chatSeccion('Paradas (correctivos con entrada y salida)', a.paradas.length,
    a.paradas.length ? _chatMarcaTodo('paradas', 'Las «abiertas» y «ya cargadas» vienen sin marcar') + '<div class="tbl-wrap" style="max-height:260px;overflow:auto"><table><tr><th></th><th>Equipo</th><th>Entrada</th><th>Salida</th><th>Duración</th><th>Motivo</th><th>Estado</th></tr>' + pr + '</table></div>' : '<p style="font-size:12px;color:var(--tx3)">No hay paradas nuevas en ese período.</p>', true);
  // Horómetros
  var hr = a.horometros.map(function (x, i) {
    return '<tr><td>' + _chatCasilla('horometros', i, x) + '</td><td class="mono" style="color:var(--ac)">' + escapeHtml(x.sigla) + '</td><td class="mono">' + _chatFecha(x.fecha) + '</td><td class="mono" style="text-align:right">' + fn(x.valor) + '</td><td style="font-size:11px">' + escapeHtml(x.fuente) + '</td><td>' + _chatBadge(x.estado) + (x.motivo ? '<div style="font-size:10px;color:var(--tx3)">' + escapeHtml(x.motivo) + '</div>' : '') + '</td></tr>';
  }).join('');
  h += _chatSeccion('Horómetros', a.horometros.length,
    a.horometros.length ? _chatMarcaTodo('horometros', 'Solo vienen marcadas las que cuadran con las lecturas vecinas (' + r.horomOk + ')') + '<div class="tbl-wrap" style="max-height:260px;overflow:auto"><table><tr><th></th><th>Equipo</th><th>Fecha</th><th>Horómetro</th><th>Origen</th><th>Estado</th></tr>' + hr + '</table></div>' : '<p style="font-size:12px;color:var(--tx3)">No hay lecturas en ese período.</p>', a.horometros.length > 0);
  // PM
  var pm = a.pm.map(function (p, i) {
    return '<tr><td>' + _chatCasilla('pm', i, p) + '</td><td class="mono" style="color:var(--ac)">' + escapeHtml(p.sigla) + '</td><td>' + escapeHtml(p.tipoPM) + '</td><td class="mono">' + _chatFecha(p.entrada.f) + ' ' + p.entrada.h + '</td><td class="mono">' + (p.horom != null ? fn(p.horom) : '—') + '</td><td style="max-width:240px">' + escapeHtml(p.motivo || '') + '</td><td>' + _chatBadge(p.estado) + '</td></tr>';
  }).join('');
  h += _chatSeccion('Mantenciones programadas (PM)', a.pm.length,
    a.pm.length ? '<div class="tbl-wrap"><table><tr><th></th><th>Equipo</th><th>Tipo</th><th>Fecha</th><th>Horómetro</th><th>Motivo</th><th>Estado</th></tr>' + pm + '</table></div><p style="font-size:10px;color:var(--tx3);margin:4px 0">Se registra solo el PM (fecha, horómetro y motivo). No descuenta stock ni reprograma el próximo PM; eso se hace desde «Registrar PM».</p>' : '<p style="font-size:12px;color:var(--tx3)">No hay PM en ese período.</p>', false);
  // Cambios de componente (van al Historial de componentes)
  var cb = (a.cambios || []).map(function (c, i) {
    return '<tr><td>' + _chatCasilla('cambios', i, c) + '</td><td class="mono" style="color:var(--ac)">' + escapeHtml(c.sigla) + '</td><td>' + escapeHtml(c.comp) + '</td><td class="mono">' + _chatFecha(c.fecha) + ' ' + c.hora + '</td><td class="mono" style="text-align:right">' + (c.horom != null ? fn(c.horom) : '—') + '</td><td>' + escapeHtml(c.motivo || '') + '</td><td>' + _chatBadge(c.estado) + (c.motivoEstado ? '<div style="font-size:10px;color:var(--tx3)">' + escapeHtml(c.motivoEstado) + '</div>' : '') + '</td></tr>';
  }).join('');
  h += _chatSeccion('Cambios de componente (balde, asiento, cuchillas, flexible del implemento…)', (a.cambios || []).length,
    (a.cambios || []).length ? '<div class="tbl-wrap"><table><tr><th></th><th>Equipo</th><th>Componente</th><th>Fecha</th><th>Horómetro</th><th>Motivo</th><th>Estado</th></tr>' + cb + '</table></div><p style="font-size:10px;color:var(--tx3);margin:4px 0">Se anotan en Historial de componentes, que calcula cada cuántas horas y días se cambia cada pieza. Si el aviso no trae horómetro se usa la última lectura del equipo hasta esa fecha.</p>' : '<p style="font-size:12px;color:var(--tx3)">No hay cambios de componente en el chat.</p>', (r.cambiosNuevos || 0) > 0);
  // Backlog (solo informativo)
  var bl = a.backlog.map(function (b) { return '<tr><td class="mono" style="color:var(--ac)">' + escapeHtml(b.sigla) + '</td><td class="mono">' + _chatFecha(b.fecha) + ' ' + b.hora + '</td><td>' + escapeHtml(b.motivo || '') + '</td></tr>'; }).join('');
  h += _chatSeccion('Backlog avisado (solo para mirar, no se carga)', a.backlog.length, a.backlog.length ? '<div class="tbl-wrap" style="max-height:200px;overflow:auto"><table><tr><th>Equipo</th><th>Aviso</th><th>Motivo</th></tr>' + bl + '</table></div>' : '<p style="font-size:12px;color:var(--tx3)">Sin backlog en ese período.</p>', false);
  // Avisos
  var av = [];
  if (a.sinResolver.length) av.push('Equipos del chat que no están en el sistema (no se cargaron): <b>' + a.sinResolver.map(function (x) { return escapeHtml(x.nombre) + ' ×' + x.veces; }).join(', ') + '</b>.');
  if (a.libresSinEquipo) av.push(a.libresSinEquipo + ' mensaje(s) «Operativo» sin decir el equipo: no se pueden emparejar solos.');
  if (a.informativos) av.push(a.informativos + ' aviso(s) «operativo» de rutina (engrase, chequeo) sin una falla abierta: no se cargan.');
  av.push('Los avisos libres sin plantilla («CE-88 fuera de servicio por…») también se leen como falla, si nombran un solo equipo y no son pregunta ni petición.');
  av.push('«Disponible para pruebas operacionales» se toma como operativo (así lo avisa el taller); si Operaciones lo sigue teniendo detenido, desmarca esa parada.');
  av.push('La hora de entrada y de salida es la del aviso en el chat (o la que dice el texto, como «03:00»), no la hora real de la falla.');
  h += '<div style="font-size:11px;color:var(--tx3);margin:8px 0">' + av.map(function (x) { return '• ' + x; }).join('<br>') + '</div>';
  h += '<div style="display:flex;gap:8px;align-items:center;margin-top:10px"><button class="btn" id="chatBtnImportar" onclick="_chatImportar()">Cargar lo marcado (' + _chatContar() + ')</button><button class="btn btn-o" onclick="cm()">Cancelar</button></div>';
  sm(h);
  $('mc').style.maxWidth = '980px';
}

export function _chatMarcar(sec, i, v) {
  var L = _chatAn && _chatAn[sec];
  if (!L || !L[i]) return;
  L[i].marcado = !!v;
  var b = $('chatBtnImportar');
  if (b) b.textContent = 'Cargar lo marcado (' + _chatContar() + ')';
}
export function _chatMarcarTodo(sec, v) {
  var L = _chatAn && _chatAn[sec];
  if (!L) return;
  L.forEach(function (x) {
    // «marcar todo» solo toca lo que tiene sentido cargar; lo ya cargado nunca se marca de golpe
    if (v) x.marcado = (x.estado === 'nueva' || x.estado === 'cierra' || x.estado === 'ok');
    else x.marcado = false;
  });
  _chatPintar();
}

function _chatDuracionTexto(min) { var t = Math.max(0, Math.round(min)), h = Math.floor(t / 60), m = t % 60; return h + 'h ' + (m < 10 ? '0' : '') + m + 'min'; }

export function _chatImportar() {
  if (!_chatAn) return;
  if (window._userRole === 'lector') return toast('⛔ Tu rol es solo lectura');
  var hoy = _chatHoy(), origen = 'WhatsApp (chat importado ' + hoy + ')';
  var eq = S.g('eq') || [], hist = S.g('hist') || [], ot = S.g('ot') || [], reg = S.g('reg') || [];
  var res = { horom: 0, horomSaltadas: 0, nuevas: 0, cerradas: 0, cerradasSaltadas: 0, pm: 0, pmSaltados: 0, eqAct: 0, cambios: 0, cambiosSaltados: 0 };
  // 1) Horómetros: se vuelve a mirar que no haya aparecido una lectura ese día mientras se revisaba.
  var yaHay = {};
  hist.forEach(function (x) { yaHay[x.sigla + '|' + x.fecha] = true; });
  var maxPorEq = {};
  _chatAn.horometros.forEach(function (x) {
    if (!x.marcado) return;
    if (yaHay[x.sigla + '|' + x.fecha]) { res.horomSaltadas++; return; }
    yaHay[x.sigla + '|' + x.fecha] = true;
    hist.push({ sigla: x.sigla, fecha: x.fecha, turno: '', horom: x.valor, horomIni: null, horomFin: x.valor, origen: origen });
    res.horom++;
    var m = maxPorEq[x.sigla];
    if (!m || x.fecha > m.fecha || (x.fecha === m.fecha && x.valor > m.valor)) maxPorEq[x.sigla] = { fecha: x.fecha, valor: x.valor };
  });
  // El horómetro actual de cada equipo sigue a su lectura más reciente (igual que el importador CSV).
  eq.forEach(function (e) {
    var m = maxPorEq[e.sigla];
    if (m && m.valor > (e.horomActual || 0) && (!e.fechaHorom || m.fecha >= e.fechaHorom)) { e.horomActual = m.valor; e.fechaHorom = m.fecha; _recalcEq(e); res.eqAct++; }
  });
  // 2) Paradas: primero se cierran las OT abiertas que ya estaban (su posición cambiaría al agregar OT nuevas arriba) y después se crean las nuevas.
  _chatAn.paradas.forEach(function (p) {
    if (!p.marcado || p.estado !== 'cierra') return;
    var o = ot[p.refIndice];
    if (!o || o.sigla !== p.sigla || o.fechaSalida) { res.cerradasSaltadas++; return; }
    o.fechaSalida = p.salida.f; o.horaSalida = p.salida.h; o.duracion = p.duracion; o.estadoOT = 'Cerrada';
    o.fechaCierre = o.fechaCierre || p.salida.f;
    o.origen = o.origen || origen;
    res.cerradas++;
  });
  _chatAn.paradas.forEach(function (p) {
    if (!p.marcado || p.estado === 'cierra') return;
    var e = eq.find(function (x) { return x.sigla === p.sigla; });
    var hh = +p.entrada.h.slice(0, 2);
    ot.unshift({
      sigla: p.sigla, fecha: p.entrada.f, fechaEntrada: p.entrada.f, horaEntrada: p.entrada.h,
      fechaSalida: p.salida ? p.salida.f : '', horaSalida: p.salida ? p.salida.h : '', duracion: p.salida ? p.duracion : '—',
      tipo: 'Correctivo', criticidad: 'No Aplica', sintoma: p.motivo || 'Fuera de servicio (aviso del chat)', sistema: '', tecnico: '',
      causaRaiz: '', tipoCausa: '', categoriaMTTR: '', solucion: '', componente: '', estadoOT: p.salida ? 'Cerrada' : 'Abierta',
      horom: p.horom || (e && e.horomActual) || 0, estatusEq: 'Fuera de Servicio', costo: 0, clasificacionCosto: '',
      turno: (hh >= 8 && hh < 20) ? 'Día' : 'Noche', operador: p.operador && !/^x+$/i.test(p.operador) ? p.operador : '', ubicacion: p.lugar || '',
      codFalla: '', ast: '', loto: '', autorizadoPor: '', fechaIngreso: hoy, primeraAtencionEn: null, origen: origen
    });
    res.nuevas++;
  });
  // 3) PM
  _chatAn.pm.forEach(function (p) {
    if (!p.marcado) return;
    var e = eq.find(function (x) { return x.sigla === p.sigla; });
    var yaPM = reg.some(function (r) { return r && r.equipo === p.sigla && String(r.tipoPM || '').toUpperCase() === p.tipoPM && r.fechaEntrada === p.entrada.f; });
    if (yaPM) { res.pmSaltados++; return; }
    var durMin = p.salidaMin != null ? p.salidaMin - p.entradaMin : 0;
    reg.push({
      nReg: reg.reduce(function (m, r) { return Math.max(m, r.nReg || 0); }, 0) + 1,
      equipo: p.sigla, tipo: (e && e.tipo) || '', modelo: (e && e.modelo) || '', tipoPM: p.tipoPM,
      fechaEntrada: p.entrada.f, horaEntrada: p.entrada.h, fechaSalida: p.salida ? p.salida.f : '', horaSalida: p.salida ? p.salida.h : '',
      duracion: durMin > 0 ? _chatDuracionTexto(durMin) : '—', duracionH: durMin > 0 ? Math.round(durMin / 6) / 10 : 0,
      horomReal: p.horom || 0, estatusEq: 'Operativo', tecnico: '', repuestos: '', obs: (p.motivo || '') + ' (importado del chat de WhatsApp)',
      turno: '', operador: '', ubicacion: p.lugar || '', costo: 0, origen: origen
    });
    res.pm++;
  });
  // 4) Cambios de componente → Historial de componentes (si no hay horómetro en el aviso, la última lectura del equipo hasta esa fecha)
  var compHist = S.g('compHist') || [];
  var horomEn = function (sigla, fecha) {
    var mejor = null;
    hist.forEach(function (x) { var v = x.horomFin || x.horom; if (x.sigla === sigla && x.fecha && x.fecha <= fecha && v > 0 && (!mejor || x.fecha > mejor.fecha)) mejor = { fecha: x.fecha, v: v }; });
    return mejor ? mejor.v : null;
  };
  (_chatAn.cambios || []).forEach(function (c) {
    if (!c.marcado) return;
    var d = new Date(c.fecha + 'T00:00:00Z').getTime();
    var ya = compHist.some(function (h) { return h && h.sigla === c.sigla && h.fechaInst && (h.comp === c.comp || (c.comp === 'Balde' && h.comp === 'Balde/Implemento')) && Math.abs(new Date(h.fechaInst + 'T00:00:00Z').getTime() - d) <= 3 * 864e5; });
    if (ya) { res.cambiosSaltados++; return; }
    compHist.push({
      id: _uuidV4(), sigla: c.sigla, comp: c.comp, fechaInst: c.fecha, horomInstalacion: c.horom != null ? c.horom : horomEn(c.sigla, c.fecha),
      fuente: origen, obs: (c.motivo || '') + ' (importado del chat de WhatsApp)', origen: null, estadoPieza: null
    });
    res.cambios++;
  });
  if (res.horom) S.s('hist', hist);
  if (res.eqAct) S.s('eq', eq);
  if (res.nuevas || res.cerradas) S.s('ot', ot);
  if (res.pm) S.s('reg', reg);
  if (res.cambios) S.s('compHist', compHist);
  cm(); refreshAll();
  var filas = [];
  if (res.horom) filas.push(res.horom + ' lectura(s) de horómetro' + (res.eqAct ? ' · ' + res.eqAct + ' equipo(s) con horómetro actualizado' : ''));
  if (res.nuevas) filas.push(res.nuevas + ' OT correctiva(s) nueva(s)');
  if (res.cerradas) filas.push(res.cerradas + ' OT abierta(s) cerrada(s)');
  if (res.pm) filas.push(res.pm + ' PM registrado(s)');
  if (res.cambios) filas.push(res.cambios + ' cambio(s) de componente en el Historial');
  var saltos = res.horomSaltadas + res.cerradasSaltadas + res.pmSaltados + res.cambiosSaltados;
  sm('<h3>' + ICONS.check + ' Chat importado</h3>' +
    (filas.length ? '<p style="font-size:13px">' + filas.map(escapeHtml).join('<br>') + '</p>' : '<p style="font-size:13px">No había nada marcado para cargar.</p>') +
    (saltos ? '<p style="font-size:12px;color:var(--w)">⚠️ ' + saltos + ' ítem(s) se omitieron porque mientras revisabas ya apareció el mismo dato o la OT cambió.</p>' : '') +
    '<p style="font-size:11px;color:var(--tx3)">Todo queda con el origen «' + escapeHtml(origen) + '».</p>' +
    '<button class="btn" onclick="cm()">Cerrar</button>');
  _chatAn = null; _chatTxt = '';
}

// Puente window — ver nota en mov.js (primera tanda).
window.importarChatWhatsApp = importarChatWhatsApp;
window._chatArchivoElegido = _chatArchivoElegido;
window._chatVolverAnalizar = _chatVolverAnalizar;
window._chatMarcar = _chatMarcar;
window._chatMarcarTodo = _chatMarcarTodo;
window._chatImportar = _chatImportar;
