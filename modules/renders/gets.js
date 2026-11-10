// Pestaña «Elementos de desgaste» (2026-11-10): cambios de cuchillas, puntas, entredientes, calzas, cantoneras, rodados… (GETS) que el taller llevaba en la planilla «Control GETS».
// Muestra, por equipo y pieza, el último cambio, cada cuánto se cambia en la práctica y cuándo toca el próximo, y dice con franqueza lo que NO se puede afirmar:
// la planilla llega hasta jun-2024 (las OT del sistema traen los cambios posteriores, por eso se UNEN: un cambio que está en ambas se cuenta una sola vez), y el horómetro de las planillas no coincide con el del sistema (por eso la vida se calcula con las FECHAS; las horas solo cuando el horómetro es fiable).
// Todos los perfiles que ven la pestaña pueden mirar; registran cambios los editores y administradores (lo exige también la base de datos). El cálculo vive en logic.js con pruebas (gets.test.js).
// Módulo ES lazy, mismo patrón que mom.js.
const _gE = t => escapeHtml(String(t == null ? '' : t));
const _gHoy = () => new Date().toISOString().slice(0, 10);
const _gFecha = f => f ? f.slice(8, 10) + '-' + f.slice(5, 7) + '-' + f.slice(0, 4) : '—';
const _G_COLOR = { 'Al día': 'var(--ok)', Próximo: 'var(--warn)', Vencido: 'var(--danger)', 'Sin registros recientes': 'var(--tx3)', 'Pocos datos': 'var(--tx3)' };
window._getsVista = window._getsVista || { estado: '', pieza: '' };
const _G_ORIGEN = { GETS: 'Planilla', 'GETS+OT': 'Planilla + OT', OT: 'OT' };
// Cambios de la planilla (gets_cambios) unidos con los de las OT, sin repetir (getsUnir, logic.js).
const _gTodos = () => getsUnir(S.g('getsCambios') || [], getsEventosDesdeOT(S.g('otHist') || [], S.g('ot') || []));

function _gPuedeRegistrar() { return window._userRole !== 'lector'; }
function _gId() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : undefined; }

function _gTarjetas(q, proy) {
  const t = (titulo, valor, sub, color) => '<div class="card"><div class="card-t">' + titulo + '</div><div class="card-v" style="' + (color ? 'color:' + color : '') + '">' + valor + '</div><div class="card-s">' + sub + '</div></div>';
  const venc = proy.filter(p => p.estado === 'Vencido').length, prox = proy.filter(p => p.estado === 'Próximo').length;
  return '<div class="cards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px">' +
    t('Cambios registrados', q.total, q.equipos + ' equipos · planilla ' + (q.planilla - q.enAmbos) + ' · OT ' + q.soloOT + ' · en ambas ' + q.enAmbos) +
    t('Último registro', _gFecha(q.ultimoRegistro), q.diasDesdeUltimo == null ? '—' : 'hace ' + q.diasDesdeUltimo + ' días', q.diasDesdeUltimo > 90 ? 'var(--warn)' : '') +
    t('Equipos con cambio en 90 días', q.equiposConCambioReciente, 'con registro reciente') +
    t('Vencidos', venc, 'pasó el cambio estimado', venc ? 'var(--danger)' : '') +
    t('Próximos (7 días)', prox, 'cambio estimado cerca', prox ? 'var(--warn)' : '') +
    t('Horómetro dudoso', q.horometroDudoso, 'no entra en las horas', q.horometroDudoso ? 'var(--warn)' : '') + '</div>';
}

function _gAviso(q, proy) {
  const msgs = [];
  if (q.diasDesdeUltimo != null && q.diasDesdeUltimo > 90) msgs.push('<b>El registro está desactualizado:</b> el último cambio cargado es del ' + _gFecha(q.ultimoRegistro) + ' (hace ' + q.diasDesdeUltimo + ' días) y solo ' + q.equiposConCambioReciente + ' equipo(s) tienen un cambio en los últimos 90 días. Por eso la mayoría figura «Sin registros recientes»: sin cambios nuevos cargados, el sistema no puede decir qué cambio toca. Registra los cambios de ahora con <b>+ Registrar cambio</b>.');
  if (q.horometroDudoso) msgs.push('<b>' + q.horometroDudoso + ' cambio(s) tienen horómetro dudoso</b> (retrocede o no coincide con las lecturas del sistema): su fecha cuenta, su horómetro no.');
  if (q.sinNParte) msgs.push('<b>' + q.sinNParte + ' de ' + q.planilla + ' cambios de la planilla no traen número de parte</b> y ' + q.sinCantidad + ' no traen cantidad: no se puede cruzar con el stock ni con las compras.');
  return msgs.length ? '<div style="font-size:11px;color:var(--warn);line-height:1.7;margin:0 0 12px;padding:8px 12px;border:1px solid var(--border);border-radius:8px">' + msgs.join('<br>') + '</div>' : '';
}

function _gProyeccion(proy) {
  const v = window._getsVista;
  const filas = proy.filter(p => (!v.estado || p.estado === v.estado) && (!v.pieza || p.pieza === v.pieza));
  const orden = { Vencido: 0, Próximo: 1, 'Al día': 2, 'Sin registros recientes': 3, 'Pocos datos': 4 };
  filas.sort((a, b) => (orden[a.estado] - orden[b.estado]) || ((a.diasParaProximo == null ? 9999 : a.diasParaProximo) - (b.diasParaProximo == null ? 9999 : b.diasParaProximo)) || a.sigla.localeCompare(b.sigla));
  const cuerpo = filas.length ? filas.map(p => '<tr><td class="mono" style="color:var(--ac)">' + _gE(p.sigla) + '</td><td style="text-align:left">' + _gE(p.pieza) + '</td><td>' + p.nCambios + '</td>' +
    '<td class="mono">' + _gFecha(p.ultimoCambio) + '<div style="font-size:10px;color:var(--tx3)">hace ' + p.diasDesdeUltimo + ' d' + (p.ultimoHorometro ? ' · ' + fn(p.ultimoHorometro) + ' h' : '') + '</div></td>' +
    '<td class="mono">' + (p.intervaloDias != null ? p.intervaloDias + ' d' : '—') + (p.intervaloHoras != null ? '<div style="font-size:10px;color:var(--tx3)">' + fn(p.intervaloHoras) + ' h</div>' : '') + '</td>' +
    '<td class="mono">' + (p.proximoCambio ? _gFecha(p.proximoCambio) + '<div style="font-size:10px;color:var(--tx3)">' + (p.diasParaProximo < 0 ? 'hace ' + (-p.diasParaProximo) + ' d' : 'en ' + p.diasParaProximo + ' d') + '</div>' : '—') + '</td>' +
    '<td><b style="color:' + _G_COLOR[p.estado] + '">' + _gE(p.estado) + '</b></td></tr>').join('')
    : '<tr><td colspan="7" style="color:var(--tx3);padding:12px">Ningún elemento coincide con el filtro.</td></tr>';
  const piezas = Array.from(new Set(proy.map(p => p.pieza))).sort();
  return '<div class="chart-box" style="margin-bottom:14px"><div class="chart-t" style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><span>Proyección del próximo cambio</span>' +
    (_gPuedeRegistrar() ? '<button class="btn btn-sm" onclick="getsAgregar()">+ Registrar cambio</button>' : '') + '</div>' +
    '<div style="font-size:11px;color:var(--tx2);line-height:1.6;margin:6px 0">El intervalo típico es la <b>mediana</b> de los días entre cambios consecutivos de la misma pieza en el mismo equipo (varias piezas cambiadas el mismo día cuentan como un cambio). Hacen falta al menos 3 cambios. Si el último cambio es muy antiguo respecto de ese intervalo, no se afirma nada: «Sin registros recientes».</div>' +
    '<div class="toolbar" style="margin:6px 0"><select onchange="getsFiltrar(\'estado\',this.value)"><option value="">Todos los estados</option>' + GETS_ESTADOS.map(e => '<option' + (e === v.estado ? ' selected' : '') + '>' + e + '</option>').join('') + '</select>' +
    '<select onchange="getsFiltrar(\'pieza\',this.value)"><option value="">Todas las piezas</option>' + piezas.map(e => '<option' + (e === v.pieza ? ' selected' : '') + '>' + _gE(e) + '</option>').join('') + '</select></div>' +
    '<div class="tbl-wrap" style="max-height:60vh;overflow:auto"><table style="font-size:11px"><tr><th style="text-align:left">Equipo</th><th style="text-align:left">Pieza</th><th>Cambios</th><th>Último cambio</th><th>Intervalo típico</th><th>Próximo estimado</th><th>Estado</th></tr>' + cuerpo + '</table></div></div>';
}

function _gRecientes(cambios) {
  const l = cambios.slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, 25);
  const filas = l.length ? l.map(c => '<tr><td class="mono">' + _gFecha(String(c.fecha).slice(0, 10)) + '</td><td class="mono" style="color:var(--ac)">' + _gE(c.sigla) + '</td><td style="text-align:left">' + _gE(c.descripcion) + '</td><td>' + _gE(c.pieza || getsPiezaDe(c.descripcion)) + '</td>' +
    '<td class="mono">' + (c.horometro ? fn(c.horometro) + (c.horometroDudoso ? ' <span title="Horómetro dudoso: retrocede o no coincide con las lecturas del sistema" style="color:var(--warn)">⚠</span>' : '') : '—') + '</td>' +
    '<td class="mono">' + _gE(c.nParte || '—') + '</td><td class="mono">' + (c.cantidad != null ? c.cantidad : '—') + '</td><td>' + _gE(c.responsable || '—') + '</td><td style="font-size:10px">' + _gE(_G_ORIGEN[c.origen] || 'Planilla') + '</td></tr>').join('')
    : '<tr><td colspan="9" style="color:var(--tx3);padding:12px">Aún no hay cambios registrados.</td></tr>';
  return '<div class="chart-box"><div class="chart-t">Últimos cambios registrados <span style="font-size:11px;color:var(--tx3)">— planilla y OT unidas; un cambio que está en ambas figura una sola vez</span></div><div class="tbl-wrap"><table style="font-size:11px"><tr><th>Fecha</th><th>Equipo</th><th style="text-align:left">Descripción</th><th>Pieza</th><th>Horómetro</th><th>N° parte</th><th>Cant.</th><th>Responsable</th><th>Fuente</th></tr>' + filas + '</table></div></div>';
}

export function renderGets() {
  const el = $('s-gets'); if (!el) return;
  const hoy = _gHoy(), cambios = _gTodos();
  const proy = getsProyeccion(cambios, hoy), q = getsCalidad(cambios, hoy);
  el.innerHTML = '<div class="sec-h"><div><div class="sec-t">' + ICONS.gets + ' Elementos de desgaste (GETS)</div><div class="sec-s">Cambios de cuchillas, puntas, entredientes, calzas y rodados: cada cuánto se cambian y cuándo toca el próximo</div></div></div>' +
    _gTarjetas(q, proy) + _gAviso(q, proy) + _gProyeccion(proy) + _gRecientes(cambios);
}

export function getsFiltrar(campo, v) { window._getsVista[campo] = v; renderGets(); }

export function getsAgregar() {
  if (!_gPuedeRegistrar()) return toast('⛔ Tu rol es solo lectura');
  const eqs = (S.g('eq') || []).map(e => e.sigla).sort();
  sm('<h3>Registrar cambio de elemento de desgaste</h3>' +
    '<div class="form-row"><div class="fg"><label>Equipo *</label><select id="gcEq"><option value="">— elige —</option>' + eqs.map(s => '<option>' + _gE(s) + '</option>').join('') + '</select></div>' +
    '<div class="fg"><label>Fecha *</label><input id="gcFecha" type="date" value="' + _gHoy() + '"></div><div class="fg"><label>Horómetro</label><input id="gcHor" type="number" min="0" step="1"></div></div>' +
    '<div class="form-row"><div class="fg" style="width:100%"><label>Qué se cambió *</label><input id="gcDesc" style="width:100%" placeholder="Ej.: Cambio de cuchillas laterales"></div></div>' +
    '<div class="form-row"><div class="fg"><label>N° de parte</label><input id="gcNp"></div><div class="fg"><label>Cantidad</label><input id="gcCant" type="number" min="1" step="1"></div></div>' +
    '<div class="form-row"><div class="fg" style="width:100%"><label>Observaciones</label><input id="gcObs" style="width:100%"></div></div><br>' +
    '<button class="btn" onclick="getsGuardar()">Guardar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
}
export function getsGuardar() {
  if (!_gPuedeRegistrar()) return toast('⛔ Tu rol es solo lectura');
  const v = id => ($(id).value || '').trim(), num = x => x === '' ? null : Number(x);
  const c = { sigla: v('gcEq'), siglaOriginal: null, fecha: v('gcFecha'), horometro: num(v('gcHor')), horometroDudoso: false, responsable: window._userName || null, descripcion: v('gcDesc'),
    nParte: v('gcNp') || null, cantidad: num(v('gcCant')), observaciones: v('gcObs') || null, fuente: 'Registrado en el programa', usuario: window._userName || '' };
  const err = getsCambioError(c);
  if (err) return toast('⚠️ ' + err);
  c.pieza = getsPiezaDe(c.descripcion);
  // Sin repetir: si ya figura un cambio del mismo equipo, ±1 día y la misma pieza (en la planilla o como OT), se avisa antes de guardar.
  const parecido = _gTodos().find(x => x.sigla === c.sigla && Math.abs(_tareasDias(String(x.fecha).slice(0, 10), c.fecha)) <= 1 && (x.pieza === c.pieza || x.pieza === 'Otro' || c.pieza === 'Otro'));
  if (parecido && !confirm('Ya figura un cambio parecido: ' + c.sigla + ', ' + _gFecha(String(parecido.fecha).slice(0, 10)) + ', ' + parecido.pieza + ' (' + (_G_ORIGEN[parecido.origen] || 'Planilla') + '). ¿Registrarlo igual?')) return;
  const lista = S.g('getsCambios') || [];
  lista.push(Object.assign({ _id: _gId() }, c));
  S.s('getsCambios', lista); cm(); renderGets(); toast('✅ Cambio registrado');
}

// Puente window/renders — ver nota en mov.js (primera tanda).
window.renderGets = renderGets;
window.getsFiltrar = getsFiltrar;
window.getsAgregar = getsAgregar;
window.getsGuardar = getsGuardar;
renders.gets = renderGets;
