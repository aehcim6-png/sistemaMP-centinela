// Sub-pestaña «Tareas» de Metas & KPIs (2026-10-29, paso 3 «reglas que fuerzan y escalan»): lo que las reglas obligan a hacer, con responsable y fecha límite, y lo que venció.
//  · «Pedir ya» del plan de compras (TBO) → una tarea por cada uno (se crean al abrir esta pantalla; si el pedido se hizo, queda «Resuelta sola»).
//  · Falla repetida → la acción con responsable y fecha que se exige al cerrar la OT.
//  · A mano → cualquier tarea que se quiera seguir.
// Vencida desde el día siguiente a la fecha límite; Escalada con 3 días o más de atraso (a la jefatura: el jefe de taller de la cuadrilla del responsable). El sistema no manda correos con esto: lo muestra aquí y en el Dashboard.
// El cálculo vive en logic.js (tareaEstado, tareasDePedirYa… con pruebas); acá solo se arma lo que se ve. Módulo ES lazy, mismo patrón que ger.js.
const _tarE = t => escapeHtml(String(t == null ? '' : t));
const _tarHoy = () => new Date().toISOString().slice(0, 10);
window._tareasVista = window._tareasVista || { estado: 'sin_cerrar', origen: '' };
const _TAR_COLOR = { Abierta: 'var(--ac)', Vencida: 'var(--warn)', Escalada: 'var(--danger)', Hecha: 'var(--ok)', Descartada: 'var(--tx3)', 'Resuelta sola': 'var(--tx3)' };

function _tarPuedeEditar() { return window._userRole !== 'lector'; }

// Crea las tareas de «pedir ya» que falten y deja resueltas solas las que ya no corresponden. Idempotente: la clave evita duplicados.
export function tareasSincronizar() {
  if (!_tarPuedeEditar()) return { nuevas: 0, resueltas: 0 };
  try {
    const cfg = S.g('cfg') || {}, eqs = S.g('eq') || [];
    let aplic = 'normal'; try { const v = localStorage.getItem('tboAplic'); if (TBO_APLICACION[v]) aplic = v; } catch (e) { /* sin storage: normal */ }
    const estado = tboEstadoFlota(eqs, S.g('compHist') || [], S.g('compMayores') || [], new Date(), aplic);
    const cd = S.g('comprasDetalle') || [];
    const plan = tboPlanCompras(estado, { hoy: new Date(), equipos: eqs, compras: tboUnirCompras(S.g('ocHist') || [], cd), comprasDetalle: cd, stk: S.g('stk') || [], repuestos: S.g('repuestos') || [], ordenes: S.g('ordenes') || [], tasa: Number(cfg.tasaUSD) > 0 ? Number(cfg.tasaUSD) : 910 }, {});
    const tareas = S.g('tareas') || [];
    const r = tareasDePedirYa(plan.filas, _tarHoy(), tareas);
    if (!r.nuevas.length && !r.resueltas.length) return { nuevas: 0, resueltas: 0 };
    r.resueltas.forEach(x => { const t = tareas.find(y => y.clave === x.clave); if (t) { t.estado = x.estado; t.fechaCierre = x.fechaCierre; t.observacion = x.observacion; } });
    r.nuevas.forEach(n => tareas.push(Object.assign({ usuario: window._userName || '' }, n)));
    S.s('tareas', tareas);
    return { nuevas: r.nuevas.length, resueltas: r.resueltas.length };
  } catch (e) { console.error('tareasSincronizar', e); return { nuevas: 0, resueltas: 0 }; }
}

export function tareasFiltrar(campo, v) { window._tareasVista[campo] = v; renderTareas(true); }
export function tareaEstadoCambiar(i, estado) {
  const tareas = S.g('tareas') || []; const t = tareas[i]; if (!t) return;
  t.estado = estado; t.fechaCierre = estado === 'Abierta' ? null : _tarHoy();
  S.s('tareas', tareas); renderTareas(true); toast('✅ Tarea ' + (estado === 'Abierta' ? 'reabierta' : estado.toLowerCase()));
}
export function tareaEditar(i, campo, v) {
  const tareas = S.g('tareas') || []; const t = tareas[i]; if (!t) return;
  if (campo === 'fechaLimite' && v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
  t[campo] = v || null; S.s('tareas', tareas); renderTareas(true);
}
export function tareaAgregarModal() {
  const per = CUADRILLAS_TALLER.reduce((a, c) => a.concat(c.jefes, c.tecnicos), []);
  sm('<h3>Agregar tarea</h3><div class="form-row"><div class="fg" style="width:100%"><label>Tarea *</label><input id="tnTitulo" style="width:100%" placeholder="Qué hay que hacer"></div></div>' +
    '<div class="form-row"><div class="fg"><label>Equipo</label><select id="tnSigla"><option value="">—</option>' + (S.g('eq') || []).map(e => '<option>' + _tarE(e.sigla) + '</option>').join('') + '</select></div>' +
    '<div class="fg"><label>Responsable *</label><select id="tnResp"><option value="">— elige —</option>' + per.map(n => '<option>' + _tarE(n) + '</option>').join('') + '<option>Comprador</option></select></div>' +
    '<div class="fg"><label>Fecha límite *</label><input id="tnFecha" type="date" value="' + _tareasSumarDias(_tarHoy(), 7) + '"></div></div>' +
    '<div class="form-row"><div class="fg" style="width:100%"><label>Detalle</label><input id="tnDetalle" style="width:100%"></div></div><br><button class="btn" onclick="tareaGuardarNueva()">Guardar</button>');
}
export function tareaGuardarNueva() {
  const titulo = ($('tnTitulo')?.value || '').trim(), resp = ($('tnResp')?.value || '').trim(), fecha = ($('tnFecha')?.value || '').trim();
  if (!titulo) return toast('⚠️ Escribe la tarea');
  if (!resp) return toast('⚠️ Elige el responsable');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return toast('⚠️ Indica la fecha límite');
  const tareas = S.g('tareas') || [];
  tareas.push({ clave: 'manual|' + Date.now() + '|' + Math.random().toString(36).slice(2, 8), origen: 'manual', sigla: ($('tnSigla')?.value || '') || null, titulo, detalle: ($('tnDetalle')?.value || '').trim() || null, responsable: resp, fechaLimite: fecha, estado: 'Abierta', fechaCierre: null, referencia: null, observacion: null, usuario: window._userName || '' });
  S.s('tareas', tareas); cm(); renderTareas(true); toast('✅ Tarea agregada');
}

export function renderTareas(sinSincronizar) {
  const el = $('s-tareas'); if (!el) return;
  const s = sinSincronizar ? { nuevas: 0, resueltas: 0 } : tareasSincronizar();
  const hoy = _tarHoy(), tareas = S.g('tareas') || [], v = window._tareasVista, ed = _tarPuedeEditar();
  const res = tareasResumen(tareas, hoy);
  const filas = tareas.map((t, i) => ({ t, i, e: tareaEstado(t, hoy) })).filter(x => (v.estado === 'sin_cerrar' ? TAREAS_CERRADAS.indexOf(x.e) < 0 : true) && (!v.origen || x.t.origen === v.origen))
    .sort((a, b) => { const o = { Escalada: 0, Vencida: 1, Abierta: 2 }; return (o[a.e] ?? 3) - (o[b.e] ?? 3) || String(a.t.fechaLimite || '9999').localeCompare(String(b.t.fechaLimite || '9999')); });
  const card = (t, n, c, sub) => '<div class="card"><div class="card-t">' + t + '</div><div class="card-v" style="color:' + c + '">' + fn(n) + '</div><div class="card-s">' + sub + '</div></div>';
  const resp = (t, i) => ed ? '<input value="' + _tarE(t.responsable || '') + '" style="font-size:11px;width:130px" onchange="tareaEditar(' + i + ',\'responsable\',this.value)">' : _tarE(t.responsable || '—');
  const fecha = (t, i) => ed ? '<input type="date" value="' + _tarE(t.fechaLimite || '') + '" style="font-size:11px" onchange="tareaEditar(' + i + ',\'fechaLimite\',this.value)">' : _tarE(t.fechaLimite || '—');
  const acc = (x) => !ed ? '' : TAREAS_CERRADAS.indexOf(x.e) >= 0
    ? '<button class="btn btn-o btn-sm" onclick="tareaEstadoCambiar(' + x.i + ',\'Abierta\')">Reabrir</button>'
    : '<button class="btn btn-sm" onclick="tareaEstadoCambiar(' + x.i + ',\'Hecha\')">Hecha</button> <button class="btn btn-o btn-sm" onclick="tareaEstadoCambiar(' + x.i + ',\'Descartada\')" title="Ya no corresponde">Descartar</button>';
  const tabla = filas.length ? '<div class="tbl-wrap" style="max-height:65vh;overflow:auto"><table style="font-size:11px"><tr><th style="text-align:left">Estado</th><th style="text-align:left">Origen</th><th style="text-align:left">Equipo</th><th style="text-align:left">Tarea</th><th style="text-align:left">Responsable</th><th style="text-align:left">Fecha límite</th><th style="text-align:left">Escala a</th><th></th></tr>' +
    filas.map(x => '<tr><td style="color:' + _TAR_COLOR[x.e] + ';font-weight:700;white-space:nowrap">' + _tarE(x.e) + '</td><td>' + _tarE(TAREAS_ORIGENES[x.t.origen] || x.t.origen) + '</td><td class="mono">' + _tarE(x.t.sigla || '—') + '</td>' +
      '<td>' + _tarE(x.t.titulo) + (x.t.detalle ? '<div style="font-size:10px;color:var(--tx3)">' + _tarE(x.t.detalle) + '</div>' : '') + '</td><td>' + resp(x.t, x.i) + '</td><td>' + fecha(x.t, x.i) + '</td>' +
      '<td style="font-size:10px">' + (x.e === 'Vencida' || x.e === 'Escalada' ? '<b style="color:' + _TAR_COLOR[x.e] + '">' + _tarE(tareaEscalaA(x.t)) + '</b>' : '—') + '</td><td style="white-space:nowrap">' + acc(x) + '</td></tr>').join('') + '</table></div>'
    : '<div style="font-size:12px;color:var(--tx3);padding:14px;text-align:center">No hay tareas' + (v.estado === 'sin_cerrar' ? ' sin cerrar' : '') + ' con este filtro.</div>';
  el.innerHTML = '<div class="chart-box" style="margin-bottom:14px"><div class="chart-t">Tareas que las reglas obligan a hacer</div>' +
    '<div style="font-size:11px;color:var(--tx2);line-height:1.6">Tres reglas generan tareas con responsable y fecha: <b>todo «pedir ya»</b> del plan de compras (3 días de plazo; si el pedido se hace, queda «Resuelta sola»); <b>una falla repetida</b> (mismo equipo y componente en 90 días) que exige causa raíz y una acción con fecha al cerrar la OT; y las que se agregan a mano. ' +
    'Además, todo hallazgo de un PM incompleto pasa solo al backlog de pautas. Una tarea <b>vence</b> al día siguiente de su fecha límite y se <b>escala</b> a la jefatura (el jefe de taller de la cuadrilla del responsable) con ' + TAREAS_ESCALA_DIAS + ' días o más de atraso. El sistema no manda correos: lo muestra aquí y en el Dashboard.</div>' +
    (s.nuevas || s.resueltas ? '<div style="font-size:11px;margin-top:6px;color:var(--ac)">Recién actualizado: ' + s.nuevas + ' tarea(s) nueva(s) de «pedir ya» y ' + s.resueltas + ' resuelta(s) sola(s).</div>' : '') + '</div>' +
    '<div class="cards">' + card('Abiertas', res.abiertas, 'var(--ac)', 'dentro de su plazo') + card('Vencidas', res.vencidas, res.vencidas ? 'var(--warn)' : 'var(--ok)', 'pasó la fecha límite') + card('Escaladas', res.escaladas, res.escaladas ? 'var(--danger)' : 'var(--ok)', TAREAS_ESCALA_DIAS + ' días o más de atraso') + card('Cerradas', res.cerradas, 'var(--tx2)', 'hechas, descartadas o resueltas solas') + '</div>' +
    '<div class="chart-box" style="margin-bottom:14px"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px">' +
    '<select onchange="tareasFiltrar(\'estado\',this.value)"><option value="sin_cerrar"' + (v.estado === 'sin_cerrar' ? ' selected' : '') + '>Sin cerrar</option><option value="todas"' + (v.estado === 'todas' ? ' selected' : '') + '>Todas</option></select>' +
    '<select onchange="tareasFiltrar(\'origen\',this.value)"><option value="">Todos los orígenes</option>' + Object.keys(TAREAS_ORIGENES).map(k => '<option value="' + k + '"' + (v.origen === k ? ' selected' : '') + '>' + _tarE(TAREAS_ORIGENES[k]) + '</option>').join('') + '</select>' +
    (ed ? '<button class="btn btn-sm" onclick="tareaAgregarModal()">+ Agregar tarea</button>' : '') + '</div>' + tabla + '</div>';
  setTimeout(function () { if (typeof aplicarOrdenUniversal === 'function') aplicarOrdenUniversal('s-tareas'); }, 60);
}

// Puente window/renders — ver nota en mov.js (primera tanda).
window.renderTareas = renderTareas;
window.tareasSincronizar = tareasSincronizar;
window.tareasFiltrar = tareasFiltrar;
window.tareaEstadoCambiar = tareaEstadoCambiar;
window.tareaEditar = tareaEditar;
window.tareaAgregarModal = tareaAgregarModal;
window.tareaGuardarNueva = tareaGuardarNueva;
renders.tareas = renderTareas;
