// Sub-pestaña «Insumos» de Stock & Insumos (2026-10-26): inventario de bodega con kardex para lo que no es filtro ni lubricante (EPP, librería, limpieza, elementos de desgaste, baterías…).
// Modelo de las planillas «Inventario de bodega» que se llevaban a mano: catálogo + un kardex por ítem (entrada, salida con documento / quién retira / destino, saldo inicial, ajuste de conteo).
// El cálculo (saldo, estado, consumo, validaciones, lectura de lista pegada) está en logic.js (insumosResumen y compañía): acá solo se arma lo que se ve y se guardan los movimientos.
// El saldo nunca se escribe en el ítem; sale de sumar los movimientos. Ver el comentario de insumosResumen.
const _insHoy = () => new Date().toISOString().slice(0, 10);
const _insUsuario = () => (typeof window !== 'undefined' && window._userName) || '';
const _insUuid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => { const r = Math.random() * 16 | 0; return (ch === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
const _insNum = id => { const v = ($(id) || {}).value; return v === '' || v == null ? NaN : Number(String(v).replace(',', '.')); };
const _insOrigenTxt = { filtro: 'Stock Filtros', lubricante: 'Lubricantes', repuesto: 'Repuestos críticos' };
const _insCats = (sel) => INSUMO_CATEGORIAS.map(c => '<option' + (c === sel ? ' selected' : '') + '>' + escapeHtml(c) + '</option>').join('');
function _insFiltro() { return window._insFiltro || (window._insFiltro = { cat: '', estado: '', q: '', inactivos: false }); }
function _insDatos() {
  const insumos = S.g('ins') || [], movs = S.g('insMov') || [];
  return { insumos, movs, resumen: insumosResumen(insumos, movs, { hoy: _insHoy() }) };
}
const _insEstadoHTML = f => f.estado === 'SIN STOCK' ? '<span style="color:var(--danger);font-weight:700">🔴 Sin stock</span>' : f.estado === 'CRÍTICO' ? '<span style="color:var(--w);font-weight:700">🟡 Crítico</span>' : '<span style="color:var(--ok)">✅ OK</span>';

export function renderIns() {
  const el = $('s-ins'); if (!el) return;
  const { resumen } = _insDatos(), fl = _insFiltro(), t = resumen.totales;
  const q = fl.q.trim().toLowerCase();
  const filas = resumen.filas.filter(f => (fl.inactivos || f.activo) && (!fl.cat || f.categoria === fl.cat) && (!fl.estado || f.estado === fl.estado) &&
    (!q || (f.descripcion + ' ' + f.codigo + ' ' + f.ubicacion).toLowerCase().includes(q)));
  const dUlt = t.ultimoMov ? Math.round((new Date(_insHoy() + 'T12:00:00') - new Date(t.ultimoMov + 'T12:00:00')) / 86400000) : null;
  const card = (tit, val, col, sub) => '<div class="card"><div class="card-t">' + tit + '</div><div class="card-v"' + (col ? ' style="color:' + col + '"' : '') + '>' + val + '</div>' + (sub ? '<div class="card-s">' + sub + '</div>' : '') + '</div>';
  const fila = f => '<tr' + (f.activo ? '' : ' style="opacity:.5"') + '><td class="mono">' + escapeHtml(f.codigo) + '</td><td><b>' + escapeHtml(f.descripcion) + '</b>' + (f.origen ? ' <span style="font-size:9px;color:var(--tx3);border:1px solid var(--bd);border-radius:4px;padding:0 4px">' + escapeHtml(_insOrigenTxt[f.origen]) + '</span>' : '') + (f.ubicacion ? '<div style="font-size:10px;color:var(--tx3)">' + escapeHtml(f.ubicacion) + '</div>' : '') + '</td>' +
    '<td style="font-size:11px">' + escapeHtml(f.categoria) + '</td><td style="text-align:center">' + escapeHtml(f.unidad) + '</td>' +
    '<td class="mono" style="text-align:right">' + fn(f.entradas) + '</td><td class="mono" style="text-align:right">' + fn(f.salidas) + '</td>' +
    '<td class="mono" style="text-align:right;font-weight:700' + (f.saldoNegativo ? ';color:var(--danger)' : '') + '">' + fn(f.saldo) + '</td>' +
    '<td class="mono" style="text-align:right;color:var(--tx3)">' + (f.stockCritico > 0 ? fn(f.stockCritico) : '—') + '</td><td>' + _insEstadoHTML(f) + '</td>' +
    '<td class="mono" style="text-align:right;font-size:11px" title="Salidas de los últimos 90 días por mes' + (f.pocaHistoria ? ' — con poca historia, no es confiable' : '') + '">' + (f.consumoMes > 0 ? fn(f.consumoMes) + (f.pocaHistoria ? ' ⚠' : '') : '—') + (f.coberturaMeses != null ? '<div style="font-size:10px;color:var(--tx3)">alcanza ' + String(f.coberturaMeses).replace('.', ',') + ' m</div>' : '') + '</td>' +
    '<td style="white-space:nowrap"><button class="btn btn-o" style="font-size:10px;padding:2px 6px" onclick="insMovimiento(\'' + f._id + '\',\'entrada\')">+ Entrada</button> <button class="btn btn-o" style="font-size:10px;padding:2px 6px" onclick="insMovimiento(\'' + f._id + '\',\'salida\')">− Salida</button> <button class="btn btn-o" style="font-size:10px;padding:2px 6px" onclick="insKardex(\'' + f._id + '\')">Kardex</button> <button class="btn btn-o" style="font-size:10px;padding:2px 6px" onclick="insEditar(\'' + f._id + '\')">✎</button></td></tr>';
  el.innerHTML = '<div class="chart-box" style="margin-bottom:14px"><div class="chart-t">Insumos de bodega (kardex)</div>' +
    '<div style="font-size:11px;color:var(--tx2);line-height:1.55;margin-bottom:8px">Inventario de lo que no es filtro ni lubricante: EPP, librería, limpieza, elementos de desgaste, baterías y otros. El <b>saldo</b> sale de sumar los movimientos de cada ítem (saldo inicial + entradas − salidas ± ajustes); cada salida deja documento, quién retira y destino. Con el <b>conteo físico</b> se compara lo que hay en la bodega con el saldo del sistema.</div>' +
    '<div class="cards" style="margin-bottom:8px">' + card('Ítems activos', fn(t.items), '', 'en ' + new Set(resumen.filas.filter(f => f.activo).map(f => f.categoria)).size + ' categorías') +
      card('🔴 Sin stock', fn(t.sinStock), t.sinStock ? 'var(--danger)' : 'var(--ok)', '') + card('🟡 Críticos', fn(t.criticos), t.criticos ? 'var(--w)' : 'var(--ok)', 'bajo su stock crítico') +
      card('Valor en bodega', '$' + fn(Math.round(t.valor)), '', 'saldo × precio de referencia') + '</div>' +
    _insAvisosKardex() +
    (!t.items ? '<div style="padding:10px;margin-bottom:8px;border-radius:6px;background:rgba(99,102,241,.1);font-size:12px">Todavía no hay insumos. Usa <b>Cargar lista</b> para pegar el inventario desde Excel (descripción, unidad, stock, stock crítico, precio) o <b>+ Nuevo ítem</b> para agregarlos de a uno.</div>' : '') +
    (t.items && (dUlt == null || dUlt > 30) ? '<div style="padding:8px 10px;margin-bottom:8px;border-radius:6px;background:rgba(234,179,8,.12);font-size:11px;color:var(--warn)">⚠ ' + (dUlt == null ? 'Ningún ítem tiene movimientos' : 'El último movimiento es de hace <b>' + dUlt + ' días</b>') + ': si se sacaron o llegaron insumos sin registrarlos, el saldo no refleja la bodega. Haz un <b>conteo físico</b> para cuadrarlo.</div>' : '') +
    (t.items && t.sinCritico ? '<div style="font-size:11px;color:var(--tx3);margin-bottom:8px">' + fn(t.sinCritico) + ' ítem(s) no tienen stock crítico cargado: no pueden avisar cuando se están acabando.</div>' : '') +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">' +
      '<button class="btn" onclick="insNuevo()">+ Nuevo ítem</button><button class="btn btn-o" onclick="insLista()">Cargar lista</button><button class="btn btn-o" onclick="insConteo()">Conteo físico</button><button class="btn btn-o" onclick="insExportar()">Exportar CSV</button>' +
      '<select onchange="insFiltro(\'cat\',this.value)" style="font-size:12px"><option value="">Todas las categorías</option>' + _insCats(fl.cat) + '</select>' +
      '<select onchange="insFiltro(\'estado\',this.value)" style="font-size:12px"><option value="">Todos los estados</option>' + ['SIN STOCK', 'CRÍTICO', 'OK'].map(e => '<option' + (e === fl.estado ? ' selected' : '') + '>' + e + '</option>').join('') + '</select>' +
      '<input id="insBuscar" placeholder="Buscar descripción, código o ubicación…" value="' + escapeHtml(fl.q) + '" oninput="insFiltro(\'q\',this.value)" style="font-size:12px;min-width:220px">' +
      '<label style="font-size:11px;color:var(--tx3)"><input type="checkbox" ' + (fl.inactivos ? 'checked ' : '') + 'onchange="insFiltro(\'inactivos\',this.checked)"> ver inactivos</label></div>' +
    (filas.length ? '<div class="tbl-wrap" style="max-height:60vh;overflow:auto"><table style="font-size:11px"><tr><th>Código</th><th style="text-align:left">Descripción</th><th>Categoría</th><th>Unidad</th><th style="text-align:right">Entradas</th><th style="text-align:right">Salidas</th><th style="text-align:right">Saldo</th><th style="text-align:right">Crítico</th><th>Estado</th><th style="text-align:right">Consumo/mes</th><th></th></tr>' + filas.map(fila).join('') + '</table></div>'
      : (t.items ? '<div style="padding:12px;color:var(--tx3);font-size:12px">Ningún ítem coincide con el filtro.</div>' : '')) + '</div>';
  if (fl.q) { const b = $('insBuscar'); if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); } }
}
// Avisos del kardex unificado: ítems de filtros, lubricantes y repuestos sin kardex, y stock editado a mano en las pantallas antiguas.
function _insAvisosKardex() {
  const stk = S.g('stk') || [], lub = S.g('lub') || [], rep = S.g('repuestos') || [], ins = S.g('ins') || [], movs = S.g('insMov') || [];
  const plan = kardexPlanActivacion(stk, lub, rep, ins), d = kardexDescuadres(stk, lub, rep, ins, movs);
  let h = '';
  if (plan.filas.length) h += '<div style="padding:8px 10px;margin-bottom:8px;border-radius:6px;background:rgba(99,102,241,.1);font-size:12px"><b>' + fn(plan.filas.length) + ' ítems de Stock Filtros, Lubricantes y Repuestos aún no tienen kardex</b> (' + fn(plan.porOrigen.filtro) + ' filtros, ' + fn(plan.porOrigen.lubricante) + ' lubricantes, ' + fn(plan.porOrigen.repuesto) + ' repuestos). Al activarlo, su stock de hoy pasa a ser el saldo inicial y desde ahí cada entrada y salida queda registrada. <button class="btn" style="font-size:11px;padding:3px 10px;margin-left:6px" onclick="insActivar()">Activar kardex</button></div>';
  if (d.descuadres.length || d.huerfanos.length) h += '<div style="padding:8px 10px;margin-bottom:8px;border-radius:6px;background:rgba(234,179,8,.12);font-size:12px;color:var(--warn)">⚠ <b>' + fn(d.descuadres.length) + ' ítem(s) tienen un stock distinto en su pantalla (Stock Filtros, Lubricantes o Repuestos) que en el kardex</b>' + (d.huerfanos.length ? ' y ' + fn(d.huerfanos.length) + ' ya no existen allá' : '') + ': alguien editó el stock a mano o borró la fila. <button class="btn btn-o" style="font-size:11px;padding:3px 10px;margin-left:6px" onclick="insDescuadres()">Revisar y cuadrar</button></div>';
  return h;
}
export function insFiltro(k, v) { _insFiltro()[k] = v; renderIns(); }

// ── Nuevo ítem / edición ──
function _insForm(i) {
  const e = i || {}, fijo = e.origen ? ' disabled title="Este ítem viene de ' + escapeHtml(_insOrigenTxt[e.origen]) + ': el nombre se cambia allá"' : '';
  return '<div class="form-row"><div class="fg"><label>Descripción</label><input id="insDesc"' + fijo + ' value="' + escapeHtml(e.descripcion || '') + '"></div><div class="fg"><label>Código</label><input id="insCod" value="' + escapeHtml(e.codigo || '') + '"></div></div>' +
    '<div class="form-row"><div class="fg"><label>Categoría</label><select id="insCat"' + fijo + '>' + _insCats(e.categoria || (_insFiltro().cat || 'Otros')) + '</select></div><div class="fg"><label>Unidad</label><input id="insUni" value="' + escapeHtml(e.unidad || 'UN') + '"></div>' +
    '<div class="fg"><label>Stock crítico</label><input type="number" id="insCrit" min="0" step="any" value="' + (e.stockCritico || 0) + '"></div></div>' +
    '<div class="form-row"><div class="fg"><label>Ubicación</label><input id="insUbi" value="' + escapeHtml(e.ubicacion || '') + '"></div><div class="fg"><label>Precio unitario (referencia)</label><input type="number" id="insPre" min="0" step="any" value="' + (e.precioUnit || 0) + '"></div></div>' +
    '<div class="fg"><label>Observación</label><input id="insObs" value="' + escapeHtml(e.observacion || '') + '"></div>';
}
function _insLeerForm() {
  return { descripcion: ($('insDesc').value || '').trim(), codigo: ($('insCod').value || '').trim(), categoria: $('insCat').value, unidad: ($('insUni').value || '').trim() || 'UN',
    stockCritico: Math.max(0, _insNum('insCrit') || 0), ubicacion: ($('insUbi').value || '').trim(), precioUnit: Math.max(0, _insNum('insPre') || 0), observacion: ($('insObs').value || '').trim() };
}
export function insNuevo() {
  sm('<h3>Nuevo insumo</h3>' + _insForm() + '<div class="fg"><label>Saldo inicial (lo que hay hoy en la bodega)</label><input type="number" id="insIni" min="0" step="any" value="0"></div>' +
    '<button class="btn" onclick="insGuardarNuevo()">Guardar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
}
export function insGuardarNuevo() {
  const d = _insLeerForm(), ini = _insNum('insIni') || 0;
  if (!d.descripcion) return toast('⚠️ Falta la descripción');
  if (ini < 0) return toast('⚠️ El saldo inicial no puede ser negativo');
  const ins = S.g('ins') || [];
  if (ins.some(x => !x.origen && x.categoria === d.categoria && String(x.descripcion).trim().toUpperCase() === d.descripcion.toUpperCase())) return toast('⚠️ Ya existe un insumo con esa descripción en esa categoría');
  const id = _insUuid();
  ins.push(Object.assign({ _id: id, activo: true }, d));
  S.s('ins', ins);
  if (ini > 0) { const mv = S.g('insMov') || []; mv.push({ _id: _insUuid(), insumoId: id, fecha: _insHoy(), tipo: 'inicial', cantidad: ini, documento: 'saldo inicial', usuario: _insUsuario() }); S.s('insMov', mv); }
  cm(); renderIns(); toast('✅ Insumo agregado');
}
export function insEditar(id) {
  const i = (S.g('ins') || []).find(x => x._id === id); if (!i) return;
  sm('<h3>Editar insumo</h3>' + _insForm(i) + '<div style="font-size:11px;color:var(--tx3);margin-bottom:8px">El saldo no se edita acá: se cambia con entradas, salidas o un conteo físico, para que quede en el kardex.</div>' +
    '<button class="btn" onclick="insGuardarEdicion(\'' + id + '\')">Guardar</button> <button class="btn btn-o" onclick="insToggleActivo(\'' + id + '\')">' + (i.activo === false ? 'Reactivar' : 'Desactivar') + '</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
}
export function insGuardarEdicion(id) {
  const d = _insLeerForm(); if (!d.descripcion) return toast('⚠️ Falta la descripción');
  const ins = S.g('ins') || [], i = ins.find(x => x._id === id); if (!i) return;
  if (!i.origen && ins.some(x => x._id !== id && !x.origen && x.categoria === d.categoria && String(x.descripcion).trim().toUpperCase() === d.descripcion.toUpperCase())) return toast('⚠️ Ya existe un insumo con esa descripción en esa categoría');
  Object.assign(i, d); S.s('ins', ins); cm(); renderIns(); toast('✅ Insumo actualizado');
}
export function insToggleActivo(id) {
  const ins = S.g('ins') || [], i = ins.find(x => x._id === id); if (!i) return;
  i.activo = i.activo === false; S.s('ins', ins); cm(); renderIns(); toast(i.activo ? '✅ Insumo reactivado' : '✅ Insumo desactivado (queda su historial)');
}

// ── Entrada / salida ──
export function insMovimiento(id, tipo) {
  const { resumen } = _insDatos(), f = resumen.filas.find(x => x._id === id); if (!f) return;
  const sal = tipo === 'salida', eqs = (S.g('eq') || []).map(e => e.sigla).filter(Boolean);
  sm('<h3>' + (sal ? 'Salida de bodega' : 'Entrada a bodega') + ' — ' + escapeHtml(f.descripcion) + '</h3>' +
    '<div style="font-size:12px;margin-bottom:8px">Saldo actual: <b>' + fn(f.saldo) + ' ' + escapeHtml(f.unidad) + '</b></div>' +
    '<div class="form-row"><div class="fg"><label>Fecha</label><input type="date" id="imFecha" value="' + _insHoy() + '"></div><div class="fg"><label>Cantidad</label><input type="number" id="imCant" min="0" step="any"></div>' +
    '<div class="fg"><label>' + (sal ? 'N° de vale' : 'N° de guía / OC') + '</label><input id="imDoc"></div></div>' +
    '<div class="form-row"><div class="fg"><label>' + (sal ? 'Quién retira' : 'Proveedor') + '</label><input id="imRef"></div>' +
    (sal ? '<div class="fg"><label>Destino (equipo, trabajador o área)</label><input id="imDest" list="imEqs"><datalist id="imEqs">' + eqs.map(e => '<option value="' + escapeHtml(e) + '">').join('') + '</datalist></div>'
      : '<div class="fg"><label>Precio unitario</label><input type="number" id="imPre" min="0" step="any" value="' + (f.precioUnit || '') + '"></div>') + '</div>' +
    '<div class="fg"><label>Observación</label><input id="imObs"></div>' +
    '<button class="btn" onclick="insGuardarMov(\'' + id + '\',\'' + tipo + '\')">Registrar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
}
export function insGuardarMov(id, tipo) {
  const cant = _insNum('imCant'), fecha = $('imFecha').value;
  if (!fecha) return toast('⚠️ Falta la fecha');
  if (!(cant > 0)) return toast('⚠️ La cantidad debe ser mayor que cero');
  const movs = S.g('insMov') || [];
  if (tipo === 'salida') {
    const saldo = (insumosSaldos(movs)[id] || { saldo: 0 }).saldo, v = insumoValidarSalida(saldo, cant);
    if (!v.ok) return toast('⚠️ ' + v.motivo);
  }
  const m = { _id: _insUuid(), insumoId: id, fecha, tipo, cantidad: cant, documento: ($('imDoc').value || '').trim(), referencia: ($('imRef').value || '').trim(), observacion: ($('imObs').value || '').trim(), usuario: _insUsuario() };
  if (tipo === 'salida') m.destino = ($('imDest').value || '').trim();
  else { const p = _insNum('imPre'); if (p > 0) m.precioUnit = p; }
  movs.push(m); S.s('insMov', movs); kardexSincronizarLegado([id]); cm(); renderIns(); toast(tipo === 'salida' ? '✅ Salida registrada' : '✅ Entrada registrada');
}

// ── Kardex ──
export function insKardex(id) {
  const { insumos, movs, resumen } = _insDatos(), i = insumos.find(x => x._id === id), f = resumen.filas.find(x => x._id === id); if (!i || !f) return;
  const k = insumosKardex(movs, id), n = v => v == null ? '' : fn(v);
  const tipoTxt = { inicial: 'Saldo inicial', entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste' };
  sm('<div style="max-width:900px"><h3 style="margin:0 0 4px">Kardex — ' + escapeHtml(i.descripcion) + '</h3><div style="font-size:11px;color:var(--tx3);margin-bottom:8px">' + escapeHtml(i.categoria) + ' · unidad ' + escapeHtml(f.unidad) + (f.ubicacion ? ' · ' + escapeHtml(f.ubicacion) : '') + ' · saldo <b>' + fn(f.saldo) + '</b>' + (f.stockCritico > 0 ? ' · crítico ' + fn(f.stockCritico) : '') + '</div>' +
    (k.length ? '<div class="tbl-wrap" style="max-height:55vh;overflow:auto"><table style="font-size:11px"><tr><th>Fecha</th><th>Tipo</th><th>Documento</th><th>Referencia</th><th>Destino</th><th style="text-align:right">Entrada</th><th style="text-align:right">Salida</th><th style="text-align:right">Saldo</th><th>Observación</th></tr>' +
      k.map(r => '<tr><td>' + escapeHtml(String(r.fecha || '').slice(0, 10)) + '</td><td>' + tipoTxt[r.tipo] + '</td><td>' + escapeHtml(r.documento) + '</td><td>' + escapeHtml(r.referencia) + '</td><td>' + escapeHtml(r.destino) + '</td><td class="mono" style="text-align:right">' + n(r.entrada) + '</td><td class="mono" style="text-align:right">' + n(r.salida) + '</td><td class="mono" style="text-align:right;font-weight:700' + (r.negativo ? ';color:var(--danger)' : '') + '">' + fn(r.saldo) + '</td><td style="font-size:10px">' + escapeHtml(r.observacion) + '</td></tr>').join('') + '</table></div>'
      : '<div style="padding:10px;color:var(--tx3);font-size:12px">Este ítem todavía no tiene movimientos.</div>') +
    '<div style="margin-top:10px"><button class="btn btn-o" onclick="cm()">Cerrar</button></div></div>');
}

// ── Conteo físico: lo contado en bodega contra el saldo del sistema; la diferencia queda como ajuste en el kardex ──
export function insConteo() {
  const { resumen } = _insDatos(), fl = _insFiltro(), filas = resumen.filas.filter(f => f.activo && (!fl.cat || f.categoria === fl.cat));
  if (!filas.length) return toast('⚠️ No hay insumos para contar');
  sm('<div style="max-width:760px"><h3 style="margin:0 0 4px">Conteo físico' + (fl.cat ? ' — ' + escapeHtml(fl.cat) : '') + '</h3><div style="font-size:11px;color:var(--tx3);margin-bottom:8px">Anota lo que hay en la bodega. Lo que se deje vacío no se toca. Si el conteo difiere del saldo, se registra un <b>ajuste</b> en el kardex con la diferencia (queda la fecha, quién lo hizo y el motivo).</div>' +
    '<div class="tbl-wrap" style="max-height:50vh;overflow:auto"><table style="font-size:11px"><tr><th style="text-align:left">Ítem</th><th>Unidad</th><th style="text-align:right">Saldo sistema</th><th>Contado</th></tr>' +
    filas.map((f, n) => '<tr><td>' + escapeHtml(f.descripcion) + '</td><td style="text-align:center">' + escapeHtml(f.unidad) + '</td><td class="mono" style="text-align:right">' + fn(f.saldo) + '</td><td><input type="number" min="0" step="any" id="icC' + n + '" data-id="' + f._id + '" style="width:90px"></td></tr>').join('') + '</table></div>' +
    '<div class="fg" style="margin-top:8px"><label>Motivo / observación</label><input id="icObs" value="conteo físico"></div>' +
    '<button class="btn" onclick="insConteoGuardar(' + filas.length + ')">Registrar ajustes</button> <button class="btn btn-o" onclick="cm()">Cancelar</button></div>');
}
export function insConteoGuardar(n) {
  const movs = S.g('insMov') || [], sal = insumosSaldos(movs), obs = ($('icObs').value || 'conteo físico').trim(), fecha = _insHoy();
  let aj = 0, igual = 0; const tocados = [];
  for (let i = 0; i < n; i++) {
    const inp = $('icC' + i); if (!inp || inp.value === '') continue;
    const d = insumosAjusteConteo((sal[inp.dataset.id] || { saldo: 0 }).saldo, inp.value);
    if (d == null) { igual++; continue; }
    movs.push({ _id: _insUuid(), insumoId: inp.dataset.id, fecha, tipo: 'ajuste', cantidad: d, documento: 'conteo físico', observacion: obs, usuario: _insUsuario() }); aj++; tocados.push(inp.dataset.id);
  }
  if (!aj) { cm(); return toast(igual ? '✅ Todo lo contado coincide con el saldo' : '⚠️ No anotaste ningún conteo'); }
  S.s('insMov', movs); kardexSincronizarLegado(tocados); cm(); renderIns(); toast('✅ ' + aj + ' ajuste(s) registrado(s)' + (igual ? ' · ' + igual + ' coinciden' : ''));
}

// ── Carga por lista pegada ──
export function insLista() {
  sm('<div style="max-width:760px"><h3 style="margin:0 0 4px">Cargar lista de insumos</h3><div style="font-size:11px;color:var(--tx3);margin-bottom:8px">Pega filas desde Excel (o texto separado por «;»), una por línea: <b>descripción · unidad · stock · stock crítico · precio · categoría</b> (las dos últimas son opcionales). El stock queda como saldo inicial de hoy. Los ítems que ya existen no se duplican.</div>' +
    '<div class="fg"><label>Categoría por defecto</label><select id="ilCat">' + _insCats(_insFiltro().cat || 'Otros') + '</select></div>' +
    '<textarea id="ilTxt" rows="9" style="width:100%;font-size:12px" placeholder="Guante de cabritilla&#9;PAR&#9;14&#9;5&#9;735&#10;Lentes de seguridad&#9;UN&#9;40&#9;10&#9;1600" oninput="insListaVista()"></textarea>' +
    '<div id="ilVista" style="font-size:11px;margin:8px 0"></div>' +
    '<button class="btn" id="ilBtn" onclick="insListaGuardar()" disabled>Cargar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button></div>');
  const c = $('ilCat'); if (c) c.onchange = insListaVista;
}
export function insListaVista() {
  const r = insumosParsearLista(($('ilTxt') || {}).value || '', ($('ilCat') || {}).value), ins = S.g('ins') || [];
  const ya = r.filas.filter(f => ins.some(x => !x.origen && x.categoria === f.categoria && String(x.descripcion).trim().toUpperCase() === f.descripcion.toUpperCase())).length;
  $('ilVista').innerHTML = r.filas.length || r.errores.length ? '<b>' + (r.filas.length - ya) + '</b> ítem(s) nuevos' + (ya ? ' · ' + ya + ' ya existen (se omiten)' : '') + (r.errores.length ? ' · <span style="color:var(--danger)">' + r.errores.length + ' línea(s) con problema</span><div style="color:var(--danger)">' + r.errores.slice(0, 8).map(e => 'línea ' + e.linea + ': ' + escapeHtml(e.motivo)).join('<br>') + (r.errores.length > 8 ? '<br>…' : '') + '</div>' : '') : '';
  $('ilBtn').disabled = !(r.filas.length - ya > 0);
}
export function insListaGuardar() {
  const r = insumosParsearLista($('ilTxt').value, $('ilCat').value), ins = S.g('ins') || [], movs = S.g('insMov') || [], hoy = _insHoy();
  let nuevos = 0;
  r.filas.forEach(f => {
    if (ins.some(x => !x.origen && x.categoria === f.categoria && String(x.descripcion).trim().toUpperCase() === f.descripcion.toUpperCase())) return;
    const id = _insUuid();
    ins.push({ _id: id, descripcion: f.descripcion, codigo: '', categoria: f.categoria, unidad: f.unidad, stockCritico: f.stockCritico, ubicacion: '', precioUnit: f.precioUnit, observacion: '', activo: true });
    if (f.stock > 0) movs.push({ _id: _insUuid(), insumoId: id, fecha: hoy, tipo: 'inicial', cantidad: f.stock, documento: 'saldo inicial', observacion: 'carga de lista', usuario: _insUsuario() });
    nuevos++;
  });
  if (!nuevos) return toast('⚠️ No hay ítems nuevos para cargar');
  S.s('ins', ins); S.s('insMov', movs); cm(); renderIns(); toast('✅ ' + nuevos + ' insumo(s) cargado(s)' + (r.errores.length ? ' · ' + r.errores.length + ' línea(s) omitida(s)' : ''));
}

// ── Activar el kardex de filtros, lubricantes y repuestos ──
export function insActivar() {
  const plan = kardexPlanActivacion(S.g('stk') || [], S.g('lub') || [], S.g('repuestos') || [], S.g('ins') || []);
  if (!plan.filas.length) return toast('✅ Todo ya tiene kardex');
  const conStock = plan.filas.filter(f => f.stock > 0).length;
  sm('<div style="max-width:640px"><h3 style="margin:0 0 6px">Activar el kardex</h3>' +
    '<div style="font-size:12px;line-height:1.6;margin-bottom:8px">Se crea un ítem en el kardex por cada fila de <b>Stock Filtros</b> (' + fn(plan.porOrigen.filtro) + '), <b>Lubricantes</b> (' + fn(plan.porOrigen.lubricante) + ') y <b>Repuestos críticos</b> (' + fn(plan.porOrigen.repuesto) + ')' + (plan.sinNombre ? '; ' + fn(plan.sinNombre) + ' fila(s) sin nombre se omiten' : '') + '. Su <b>stock de hoy</b> (' + fn(conStock) + ' ítems con stock) queda como saldo inicial.</div>' +
    '<ul style="font-size:12px;line-height:1.6;margin:0 0 10px 18px;padding:0"><li>Desde ahora el saldo sale del kardex y se copia a esas pantallas: <b>los cambios de stock se hacen con entradas, salidas o conteo físico</b>, no editando el número a mano.</li>' +
    '<li>Los PM que descuentan stock siguen igual, y además dejan su salida en el kardex (equipo y PM).</li>' +
    '<li>Marcar una orden de compra como recibida suma la entrada si coincide con un solo ítem (por N° de parte o nombre exacto).</li>' +
    '<li>Si alguien edita el stock a mano en la pantalla antigua, el kardex lo avisa y se cuadra con un ajuste.</li>' +
    '<li>No se borra ni se cambia nada de esas pantallas ni del historial de consumos.</li></ul>' +
    '<button class="btn" onclick="insActivarConfirmar()">Activar (' + fn(plan.filas.length) + ' ítems)</button> <button class="btn btn-o" onclick="cm()">Cancelar</button></div>');
}
export function insActivarConfirmar() {
  const plan = kardexPlanActivacion(S.g('stk') || [], S.g('lub') || [], S.g('repuestos') || [], S.g('ins') || []);
  if (!plan.filas.length) { cm(); return toast('✅ Todo ya tiene kardex'); }
  const ins = S.g('ins') || [], movs = S.g('insMov') || [], hoy = _insHoy();
  plan.filas.forEach(f => {
    const id = _insUuid();
    ins.push({ _id: id, origen: f.origen, origenId: f.origenId, descripcion: f.descripcion, codigo: f.codigo, categoria: f.categoria, unidad: f.unidad, stockCritico: f.stockCritico, ubicacion: '', precioUnit: f.precioUnit, observacion: f.observacion, activo: true });
    if (f.stock > 0) movs.push({ _id: _insUuid(), insumoId: id, fecha: hoy, tipo: 'inicial', cantidad: f.stock, documento: 'saldo inicial', observacion: 'activación del kardex: stock de ' + _insOrigenTxt[f.origen] + ' al ' + hoy, usuario: _insUsuario() });
  });
  S.s('ins', ins); S.s('insMov', movs); cm(); renderIns(); toast('✅ Kardex activado para ' + plan.filas.length + ' ítems');
}

// ── Descuadres: stock editado a mano en las pantallas antiguas ──
export function insDescuadres() {
  const d = kardexDescuadres(S.g('stk') || [], S.g('lub') || [], S.g('repuestos') || [], S.g('ins') || [], S.g('insMov') || []);
  if (!d.descuadres.length && !d.huerfanos.length) { cm(); return toast('✅ Todo coincide'); }
  sm('<div style="max-width:760px"><h3 style="margin:0 0 4px">Stock distinto entre el kardex y su pantalla</h3><div style="font-size:11px;color:var(--tx3);margin-bottom:8px">Se supone que lo editado en la pantalla antigua es lo correcto (por ejemplo, un conteo): al cuadrar, el kardex registra un <b>ajuste</b> con la diferencia (queda la fecha y el motivo). Desmarca lo que no quieras cuadrar.</div>' +
    (d.descuadres.length ? '<div class="tbl-wrap" style="max-height:45vh;overflow:auto"><table style="font-size:11px"><tr><th></th><th style="text-align:left">Ítem</th><th>Origen</th><th style="text-align:right">Kardex</th><th style="text-align:right">Pantalla</th><th style="text-align:right">Diferencia</th></tr>' +
      d.descuadres.map((x, n) => '<tr><td><input type="checkbox" checked id="idc' + n + '" data-id="' + x.insumoId + '" data-dif="' + x.diferencia + '"></td><td>' + escapeHtml(x.descripcion) + (x.codigo ? ' <span class="mono" style="color:var(--tx3)">' + escapeHtml(x.codigo) + '</span>' : '') + '</td><td style="font-size:10px">' + escapeHtml(_insOrigenTxt[x.origen]) + '</td><td class="mono" style="text-align:right">' + fn(x.kardex) + '</td><td class="mono" style="text-align:right">' + fn(x.legado) + '</td><td class="mono" style="text-align:right;font-weight:700;color:' + (x.diferencia < 0 ? 'var(--danger)' : 'var(--ok)') + '">' + (x.diferencia > 0 ? '+' : '') + fn(x.diferencia) + '</td></tr>').join('') + '</table></div>' : '') +
    (d.huerfanos.length ? '<div style="font-size:11px;margin-top:8px;color:var(--warn)">' + fn(d.huerfanos.length) + ' ítem(s) del kardex ya no existen en su pantalla (se borró la fila): ' + d.huerfanos.slice(0, 6).map(h => escapeHtml(h.descripcion)).join(', ') + (d.huerfanos.length > 6 ? '…' : '') + '. <button class="btn btn-o" style="font-size:10px;padding:2px 8px" onclick="insDesactivarHuerfanos()">Desactivarlos (conservan su historial)</button></div>' : '') +
    '<div style="margin-top:10px">' + (d.descuadres.length ? '<button class="btn" onclick="insCuadrar(' + d.descuadres.length + ')">Cuadrar lo marcado</button> ' : '') + '<button class="btn btn-o" onclick="cm()">Cerrar</button></div></div>');
}
export function insCuadrar(n) {
  const movs = S.g('insMov') || [], hoy = _insHoy();
  let k = 0;
  for (let i = 0; i < n; i++) {
    const c = $('idc' + i); if (!c || !c.checked) continue;
    const dif = Number(c.dataset.dif); if (!dif) continue;
    movs.push({ _id: _insUuid(), insumoId: c.dataset.id, fecha: hoy, tipo: 'ajuste', cantidad: dif, documento: 'cuadre con pantalla anterior', observacion: 'el stock se editó a mano en su pantalla (Stock Filtros, Lubricantes o Repuestos)', usuario: _insUsuario() }); k++;
  }
  if (!k) { cm(); return toast('⚠️ No marcaste ningún ítem'); }
  S.s('insMov', movs); cm(); renderIns(); toast('✅ ' + k + ' ajuste(s) registrado(s) para cuadrar el kardex');
}
export function insDesactivarHuerfanos() {
  const d = kardexDescuadres(S.g('stk') || [], S.g('lub') || [], S.g('repuestos') || [], S.g('ins') || [], S.g('insMov') || []), ids = new Set(d.huerfanos.map(h => h.insumoId));
  const ins = S.g('ins') || []; ins.forEach(i => { if (ids.has(i._id)) i.activo = false; });
  S.s('ins', ins); cm(); renderIns(); toast('✅ ' + ids.size + ' ítem(s) desactivado(s)');
}

// ── Exportar ──
export function insExportar() {
  const { resumen } = _insDatos(), cab = ['Código', 'Descripción', 'Categoría', 'Unidad', 'Entradas', 'Salidas', 'Saldo', 'Stock crítico', 'Estado', 'Consumo mensual', 'Ubicación', 'Precio unitario', 'Valor'];
  const celda = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const lineas = [cab.map(celda).join(';')].concat(resumen.filas.filter(f => f.activo).map(f => [f.codigo, f.descripcion, f.categoria, f.unidad, f.entradas, f.salidas, f.saldo, f.stockCritico, f.estado, f.consumoMes, f.ubicacion, f.precioUnit, Math.round(f.valor)].map(celda).join(';')));
  const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'insumos-' + _insHoy() + '.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

// Puente window/renders — ver nota en mov.js (mismo grupo de migración).
window.renderIns = renderIns; window.insFiltro = insFiltro; window.insNuevo = insNuevo; window.insGuardarNuevo = insGuardarNuevo; window.insEditar = insEditar; window.insGuardarEdicion = insGuardarEdicion;
window.insToggleActivo = insToggleActivo; window.insMovimiento = insMovimiento; window.insGuardarMov = insGuardarMov; window.insKardex = insKardex; window.insConteo = insConteo; window.insConteoGuardar = insConteoGuardar;
window.insActivar = insActivar; window.insActivarConfirmar = insActivarConfirmar; window.insDescuadres = insDescuadres; window.insCuadrar = insCuadrar; window.insDesactivarHuerfanos = insDesactivarHuerfanos;
window.insLista = insLista; window.insListaVista = insListaVista; window.insListaGuardar = insListaGuardar; window.insExportar = insExportar;
renders.ins = renderIns;
