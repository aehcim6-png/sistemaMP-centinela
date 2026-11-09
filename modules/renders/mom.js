// Pestaña «Entrenamiento MOM» (2026-11-09): «Planificar y ejecutar entrenamientos del MOM (Modelo Operacional de Mantenimiento) para roles ejecutivos y operacionales».
// Dos partes: el plan de entrenamientos (tema, audiencia, fechas, instructor, asistencia, estado y su cumplimiento) y la matriz RACI del proceso
// (por actividad y rol: R responsable, A aprueba, C consultado, I informado). Todos los perfiles que ven la pestaña pueden mirar; solo un administrador edita
// (lo exige también la base de datos). La matriz que se carga con «Cargar propuesta base» es una PROPUESTA para corregir, no el MOM del cliente.
// El cálculo vive en logic.js con pruebas (mom.test.js); acá solo se arma lo que se ve. Módulo ES lazy, mismo patrón que foda.js.
const _mE = t => escapeHtml(String(t == null ? '' : t));
const _mHoy = () => new Date().toISOString().slice(0, 10);
const _M_COLOR_LETRA = { R: 'var(--ok)', A: 'var(--danger)', C: 'var(--info)', I: 'var(--tx3)' };
const _M_COLOR_ESTADO = { Planificado: 'var(--info)', Ejecutado: 'var(--ok)', Reprogramado: 'var(--warn)', Cancelado: 'var(--tx3)', Atrasado: 'var(--danger)' };

function _mPuedeEditar() { return window._userRole === 'admin'; }
function _mSoloAdmin() { toast('⛔ Solo un administrador puede editar esta pestaña'); }
function _mId() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : undefined; }
function _mFecha(f) { return f ? f.slice(8, 10) + '-' + f.slice(5, 7) + '-' + f.slice(0, 4) : '—'; }
function _mNum(v) { return v == null || v === '' ? null : Number(v); }

// ── Resumen ──
function _mTarjetas(res) {
  const t = (titulo, valor, sub, color) => '<div class="card"><div class="card-t">' + titulo + '</div><div class="card-v" style="' + (color ? 'color:' + color : '') + '">' + valor + '</div><div class="card-s">' + sub + '</div></div>';
  const pct = v => v == null ? '—' : v + ' %';
  const colorCump = res.cumplimiento == null ? '' : res.cumplimiento >= 90 ? 'var(--ok)' : res.cumplimiento >= 70 ? 'var(--warn)' : 'var(--danger)';
  const e = res.porAudiencia.Ejecutivo, o = res.porAudiencia.Operacional;
  return '<div class="cards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px">' +
    t('Cumplimiento del plan', pct(res.cumplimiento), 'ejecutados ÷ (ejecutados + atrasados)', colorCump) +
    t('Ejecutados', res.porEstado.Ejecutado, res.horas + ' h de entrenamiento') +
    t('Atrasados', res.porEstado.Atrasado, 'fecha planificada ya pasó', res.porEstado.Atrasado ? 'var(--danger)' : '') +
    t('Próximos 30 días', res.proximos, 'planificados o reprogramados') +
    t('Asistencia', pct(res.asistencia), 'asistentes reales ÷ planificados (ejecutados)') +
    t('Ejecutivos / Operacionales', pct(e.cumplimiento) + ' / ' + pct(o.cumplimiento), e.total + ' y ' + o.total + ' entrenamientos') +
    '</div>';
}

// ── Plan de entrenamientos ──
function _mPlan(lista, ed, hoy) {
  const fAud = $('fMomAud')?.value || '', fEst = $('fMomEst')?.value || '';
  const filas = lista.map(e => ({ e, est: momEntrenamientoEstado(e, hoy) })).filter(x => (!fAud || x.e.audiencia === fAud) && (!fEst || x.est === fEst))
    .sort((a, b) => (a.e.fechaPlan || '').localeCompare(b.e.fechaPlan || ''));
  const cuerpo = filas.length ? filas.map(x => {
    const e = x.e, id = _mE(e._id || '');
    return '<tr><td style="text-align:left">' + _mE(e.tema) + (e.observaciones ? '<div style="font-size:10px;color:var(--tx3)">' + _mE(e.observaciones) + '</div>' : '') + '</td>' +
      '<td>' + _mE(e.audiencia) + '</td><td style="text-align:left;font-size:11px">' + _mE(e.roles || '—') + '</td>' +
      '<td class="mono">' + _mFecha(e.fechaPlan) + '</td><td class="mono">' + _mFecha(e.fechaReal) + '</td>' +
      '<td>' + _mE(e.instructor || '—') + '</td><td class="mono">' + (e.duracionH != null ? Number(e.duracionH) + ' h' : '—') + '</td>' +
      '<td class="mono">' + (e.asistentesReal != null ? e.asistentesReal : '—') + ' / ' + (e.asistentesPlan != null ? e.asistentesPlan : '—') + '</td>' +
      '<td><b style="color:' + _M_COLOR_ESTADO[x.est] + '">' + _mE(x.est) + '</b></td>' +
      (ed ? '<td style="white-space:nowrap">' + (e.estado !== 'Ejecutado' && e.estado !== 'Cancelado' ? '<button class="btn btn-sm" onclick="momMarcarEjecutado(\'' + id + '\')" title="Marcar como ejecutado">✔ Ejecutado</button> ' : '') +
        '<button class="btn btn-o btn-sm" onclick="momEditarEntren(\'' + id + '\')" aria-label="Editar">✏️</button> <button class="btn btn-o btn-sm" onclick="momBorrarEntren(\'' + id + '\')" aria-label="Borrar">🗑</button></td>' : '') + '</tr>';
  }).join('') : '<tr><td colspan="' + (ed ? 10 : 9) + '" style="color:var(--tx3);padding:12px">' + (lista.length ? 'Ningún entrenamiento coincide con el filtro.' : 'Aún no hay entrenamientos planificados.') + '</td></tr>';
  return '<div class="chart-box" style="margin-bottom:14px"><div class="chart-t" style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><span>Plan de entrenamientos</span>' +
    (ed ? '<button class="btn btn-sm" onclick="momAgregarEntren()">+ Planificar entrenamiento</button>' : '') + '</div>' +
    '<div class="toolbar" style="margin:6px 0"><select id="fMomAud" onchange="renders.mom()"><option value="">Todas las audiencias</option>' + MOM_AUDIENCIAS.map(a => '<option' + (a === fAud ? ' selected' : '') + '>' + a + '</option>').join('') + '</select>' +
    '<select id="fMomEst" onchange="renders.mom()"><option value="">Todos los estados</option>' + MOM_ESTADOS.concat(['Atrasado']).map(s => '<option' + (s === fEst ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></div>' +
    '<div class="tbl-wrap"><table style="font-size:11px"><tr><th style="text-align:left">Tema</th><th>Audiencia</th><th style="text-align:left">Roles destinatarios</th><th>Fecha plan</th><th>Fecha real</th><th>Instructor</th><th>Duración</th><th title="Asistentes reales / planificados">Asistencia</th><th>Estado</th>' + (ed ? '<th></th>' : '') + '</tr>' + cuerpo + '</table></div></div>';
}

// ── Matriz RACI ──
function _mMatriz(filas, ed) {
  const m = momRaciMatriz(filas);
  // Los roles ejecutivos van primero, luego los operacionales (dentro de cada grupo se respeta el orden guardado).
  const roles = m.roles.filter(r => r.audiencia === 'Ejecutivo').concat(m.roles.filter(r => r.audiencia !== 'Ejecutivo'));
  const nEj = roles.filter(r => r.audiencia === 'Ejecutivo').length, nOp = roles.length - nEj;
  const leyenda = MOM_LETRAS.map(l => '<span style="margin-right:12px;white-space:nowrap"><b style="color:' + _M_COLOR_LETRA[l] + '">' + l + '</b> ' + _mE(MOM_LETRAS_NOMBRE[l]) + '</span>').join('');
  const avisos = momRaciValidar(m);
  const avisosHtml = avisos.length ? '<div style="font-size:11px;color:var(--warn);margin:6px 0;line-height:1.6"><b>Revisar la regla RACI:</b> ' + avisos.map(a => '«' + _mE(a.actividad) + '» ' + a.texto).join(' · ') + '</div>' : (m.actividades.length ? '<div style="font-size:11px;color:var(--ok);margin:6px 0">✓ Cada actividad tiene una sola A y al menos una R.</div>' : '');
  let tabla;
  if (!m.actividades.length) {
    tabla = '<div style="font-size:12px;color:var(--tx3);padding:14px 0">La matriz está vacía.' + (ed ? ' Puedes cargar una propuesta base para corregirla o agregar tus propias actividades y roles.' : '') + '</div>';
  } else {
    const cab1 = '<tr><th rowspan="2" style="text-align:left;min-width:260px">Actividad del proceso</th>' + (nEj ? '<th colspan="' + nEj + '" style="background:var(--bg3)">Roles ejecutivos</th>' : '') + (nOp ? '<th colspan="' + nOp + '" style="background:var(--bg3)">Roles operacionales</th>' : '') + (ed ? '<th rowspan="2"></th>' : '') + '</tr>';
    const cab2 = '<tr>' + roles.map(r => '<th style="font-size:10px;min-width:84px">' + _mE(r.nombre) + (ed ? ' <button class="btn btn-o btn-sm" style="padding:0 4px" onclick="momBorrarRol(' + m.roles.findIndex(x => x.nombre === r.nombre) + ')" aria-label="Quitar este rol" title="Quitar este rol">✕</button>' : '') + '</th>').join('') + '</tr>';
    const cuerpo = m.actividades.map((a, i) => '<tr><td style="text-align:left">' + (i + 1) + '. ' + _mE(a) + '</td>' + roles.map(r => {
      const l = (m.celda[a] || {})[r.nombre] || null;
      if (!ed) return '<td style="text-align:center;font-weight:800;color:' + (l ? _M_COLOR_LETRA[l] : 'var(--tx3)') + '">' + (l || '·') + '</td>';
      return '<td style="text-align:center"><select style="font-weight:800;color:' + (l ? _M_COLOR_LETRA[l] : 'var(--tx3)') + '" onchange="momRaciCelda(' + i + ',' + m.roles.findIndex(x => x.nombre === r.nombre) + ',this.value)" aria-label="' + _mE(a + ' · ' + r.nombre) + '"><option value="">·</option>' + MOM_LETRAS.map(x => '<option' + (x === l ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></td>';
    }).join('') + (ed ? '<td><button class="btn btn-o btn-sm" onclick="momBorrarActividad(' + i + ')" aria-label="Borrar la actividad">🗑</button></td>' : '') + '</tr>').join('');
    tabla = '<div class="tbl-wrap"><table style="font-size:11px">' + cab1 + cab2 + cuerpo + '</table></div>';
  }
  return '<div class="chart-box" style="margin-bottom:14px"><div class="chart-t" style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><span>Matriz RACI — ' + _mE(MOM_PROCESO) + '</span><span>' +
    (ed && !m.actividades.length ? '<button class="btn btn-sm" onclick="momCargarBase()">Cargar propuesta base</button> ' : '') +
    (ed ? '<button class="btn btn-sm" onclick="momAgregarActividad()">+ Actividad</button> <button class="btn btn-sm" onclick="momAgregarRol()">+ Rol</button>' : '') + '</span></div>' +
    '<div style="font-size:11px;color:var(--tx2);line-height:1.6;margin:6px 0">' + leyenda + '</div>' + avisosHtml + tabla +
    (m.actividades.length ? '<div style="font-size:10px;color:var(--tx3);margin-top:6px">Regla: cada actividad con una sola <b>A</b> (quien rinde cuentas) y al menos una <b>R</b> (quien la ejecuta). La base inicial es una propuesta: corrígela según el MOM vigente.</div>' : '') + '</div>';
}


// ── Tareas ligadas a la matriz ──
// Cada tipo de Tarea del sistema (pedir ya, falla repetida, hallazgo de PM) se vincula a una actividad de la matriz: la pestaña Tareas muestra entonces quién la hace (R), a quién se escala si vence (A) y a quién se informa (I).
// Sin vínculo, o si la actividad se borra, rige la regla de siempre (el jefe de taller de la cuadrilla del responsable). Se guarda en cfg.momTareas.
function _mTareasVinculos(filas, ed) {
  const m = momRaciMatriz(filas), mapeo = (S.g('cfg') || {}).momTareas || {};
  const origenes = Object.keys(TAREAS_ORIGENES).filter(o => o !== 'manual');
  if (!m.actividades.length) return '<div class="chart-box" style="margin-bottom:14px"><div class="chart-t">Tareas ligadas a la matriz</div><div style="font-size:12px;color:var(--tx3);padding:8px 0">Cuando la matriz tenga actividades podrás vincular cada tipo de tarea a una de ellas.</div></div>';
  const filasHtml = origenes.map(o => {
    const act = mapeo[o] || '', idx = m.actividades.indexOf(act), roto = act && idx < 0, r = idx >= 0 ? momRaciDeActividad(filas, act) : null;
    const sel = ed ? '<select onchange="momVincularTarea(\'' + o + '\',this.value)" style="max-width:340px"><option value="">— sin vincular —</option>' + m.actividades.map((a, i) => '<option value="' + i + '"' + (i === idx ? ' selected' : '') + '>' + _mE(a) + '</option>').join('') + '</select>' : _mE(idx >= 0 ? act : '— sin vincular —');
    const res = r ? ['R', 'A', 'I'].filter(l => r[l].length).map(l => '<b style="color:' + _M_COLOR_LETRA[l] + '">' + l + '</b> ' + _mE(r[l].join(' / '))).join(' · ') : (roto ? '<span style="color:var(--warn)">La actividad vinculada ya no existe: rige la regla de siempre.</span>' : '<span style="color:var(--tx3)">Rige la regla de siempre (jefe de taller de la cuadrilla).</span>');
    return '<tr><td style="text-align:left;white-space:nowrap"><b>' + _mE(TAREAS_ORIGENES[o]) + '</b></td><td style="text-align:left">' + sel + '</td><td style="text-align:left;font-size:11px">' + res + '</td></tr>';
  }).join('');
  return '<div class="chart-box" style="margin-bottom:14px"><div class="chart-t">Tareas ligadas a la matriz</div>' +
    '<div style="font-size:11px;color:var(--tx2);line-height:1.6;margin:6px 0">Cada tipo de tarea del sistema se vincula a una actividad de la matriz. En la pestaña <b>Tareas</b> se verá quién la hace (R), a quién se escala si vence (A) y a quién se informa (I). El sistema <b>muestra</b> esto en pantalla: no manda correos.</div>' +
    '<div class="tbl-wrap"><table style="font-size:11px"><tr><th style="text-align:left">Tipo de tarea</th><th style="text-align:left">Actividad de la matriz</th><th style="text-align:left">Resultado</th></tr>' + filasHtml + '</table></div></div>';
}
export function momVincularTarea(origen, iAct) {
  if (!_mPuedeEditar()) return _mSoloAdmin();
  if (!TAREAS_ORIGENES[origen] || origen === 'manual') return;
  const m = momRaciMatriz(S.g('momRaci') || []), cfg = S.g('cfg') || {}, mapeo = Object.assign({}, cfg.momTareas || {});
  if (iAct === '' || iAct == null) delete mapeo[origen];
  else { const a = m.actividades[Number(iAct)]; if (a == null) return; mapeo[origen] = a; }
  cfg.momTareas = mapeo; S.s('cfg', cfg); renderMom(); toast('✅ Vínculo guardado');
}

export function renderMom() {
  const el = $('s-mom'); if (!el) return;
  const ed = _mPuedeEditar(), hoy = _mHoy();
  const plan = S.g('momEntren') || [], raci = S.g('momRaci') || [];
  el.innerHTML = '<div class="sec-h"><div><div class="sec-t">' + ICONS.mom + ' Entrenamiento MOM</div><div class="sec-s">' + _mE(MOM_PROCESO) + ' (Modelo Operacional de Mantenimiento) — roles ejecutivos y operacionales</div></div>' +
    '<button class="btn btn-o" onclick="imprimirTab(\'mom\',\'Entrenamientos del MOM — plan y matriz RACI\')">' + ICONS.printer + ' Imprimir</button></div>' +
    (ed ? '' : '<div style="font-size:11px;color:var(--tx3);margin-bottom:10px">Solo un administrador puede editar esta pestaña; tú puedes verla completa.</div>') +
    _mTarjetas(momEntrenamientoResumen(plan, hoy)) + _mPlan(plan, ed, hoy) + _mMatriz(raci, ed) + _mTareasVinculos(raci, ed);
}

// ── Entrenamientos ──
function _mFormEntren(titulo, e) {
  e = e || {};
  sm('<h3>' + titulo + '</h3>' +
    '<div class="form-row"><div class="fg" style="width:100%"><label>Tema *</label><input id="meTema" style="width:100%" value="' + _mE(e.tema || '') + '" placeholder="Ej.: Lectura del plan de mantenimiento y cierre de OT"></div></div>' +
    '<div class="form-row"><div class="fg"><label>Audiencia *</label><select id="meAud">' + MOM_AUDIENCIAS.map(a => '<option' + (a === (e.audiencia || 'Operacional') ? ' selected' : '') + '>' + a + '</option>').join('') + '</select></div>' +
    '<div class="fg"><label>Estado</label><select id="meEstado">' + MOM_ESTADOS.map(s => '<option' + (s === (e.estado || 'Planificado') ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></div></div>' +
    '<div class="form-row"><div class="fg" style="width:100%"><label>Roles destinatarios</label><input id="meRoles" style="width:100%" value="' + _mE(e.roles || '') + '" placeholder="Ej.: Planificador, Supervisor de Mantenimiento"></div></div>' +
    '<div class="form-row"><div class="fg"><label>Fecha planificada *</label><input id="mePlan" type="date" value="' + _mE(e.fechaPlan || '') + '"></div><div class="fg"><label>Fecha real</label><input id="meReal" type="date" value="' + _mE(e.fechaReal || '') + '"></div>' +
    '<div class="fg"><label>Duración (h)</label><input id="meDur" type="number" step="0.5" min="0" value="' + _mE(e.duracionH != null ? e.duracionH : '') + '"></div></div>' +
    '<div class="form-row"><div class="fg"><label>Instructor</label><input id="meInstr" value="' + _mE(e.instructor || '') + '"></div><div class="fg"><label>Asistentes planificados</label><input id="meAP" type="number" min="0" step="1" value="' + _mE(e.asistentesPlan != null ? e.asistentesPlan : '') + '"></div>' +
    '<div class="fg"><label>Asistentes reales</label><input id="meAR" type="number" min="0" step="1" value="' + _mE(e.asistentesReal != null ? e.asistentesReal : '') + '"></div></div>' +
    '<div class="form-row"><div class="fg" style="width:100%"><label>Observaciones</label><textarea id="meObs" rows="2" style="width:100%">' + _mE(e.observaciones || '') + '</textarea></div></div>' +
    '<input type="hidden" id="meId" value="' + _mE(e._id || '') + '"><br><button class="btn" onclick="momGuardarEntren()">Guardar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
}
export function momAgregarEntren() { if (!_mPuedeEditar()) return _mSoloAdmin(); _mFormEntren('Planificar entrenamiento', { fechaPlan: _mHoy() }); }
export function momEditarEntren(id) {
  if (!_mPuedeEditar()) return _mSoloAdmin();
  const e = (S.g('momEntren') || []).find(x => x._id === id); if (!e) return;
  _mFormEntren('Editar entrenamiento', e);
}
export function momMarcarEjecutado(id) {
  if (!_mPuedeEditar()) return _mSoloAdmin();
  const e = (S.g('momEntren') || []).find(x => x._id === id); if (!e) return;
  _mFormEntren('Registrar ejecución', Object.assign({}, e, { estado: 'Ejecutado', fechaReal: e.fechaReal || _mHoy() }));
}
export function momGuardarEntren() {
  if (!_mPuedeEditar()) return _mSoloAdmin();
  const v = id => ($(id).value || '').trim();
  const datos = { tema: v('meTema'), audiencia: v('meAud'), estado: v('meEstado'), roles: v('meRoles') || null, fechaPlan: v('mePlan'), fechaReal: v('meReal') || null, duracionH: _mNum(v('meDur')),
    instructor: v('meInstr') || null, asistentesPlan: _mNum(v('meAP')), asistentesReal: _mNum(v('meAR')), observaciones: v('meObs') || null };
  const err = momEntrenamientoError(datos);
  if (err) return toast('⚠️ ' + err);
  const lista = S.g('momEntren') || [], id = v('meId');
  if (id) {
    const e = lista.find(x => x._id === id); if (!e) return;
    Object.assign(e, datos);
  } else lista.push(Object.assign({ _id: _mId(), usuario: window._userName || '' }, datos));
  S.s('momEntren', lista); cm(); renderMom(); toast('✅ Guardado');
}
export function momBorrarEntren(id) {
  if (!_mPuedeEditar()) return _mSoloAdmin();
  const lista = S.g('momEntren') || [], e = lista.find(x => x._id === id); if (!e) return;
  if (!confirm('¿Borrar el entrenamiento «' + String(e.tema).slice(0, 60) + '»?')) return;
  S.s('momEntren', lista.filter(x => x._id !== id)); renderMom(); toast('🗑 Entrenamiento borrado');
}

// ── Matriz RACI ──
function _mUsuario() { return window._userName || ''; }
export function momCargarBase() {
  if (!_mPuedeEditar()) return _mSoloAdmin();
  if ((S.g('momRaci') || []).length) return toast('⚠️ La matriz ya tiene datos');
  S.s('momRaci', momRaciBaseFilas().map(f => Object.assign({ _id: _mId(), usuario: _mUsuario() }, f)));
  const cfg = S.g('cfg') || {};
  if (!cfg.momTareas || !Object.keys(cfg.momTareas).length) { cfg.momTareas = Object.assign({}, MOM_TAREA_ACTIVIDAD_BASE); S.s('cfg', cfg); }
  renderMom(); toast('✅ Propuesta base cargada: corrígela según el MOM vigente');
}
export function momRaciCelda(iAct, iRol, letra) {
  if (!_mPuedeEditar()) return _mSoloAdmin();
  const lista = S.g('momRaci') || [], m = momRaciMatriz(lista), a = m.actividades[iAct], r = m.roles[iRol] && m.roles[iRol].nombre;
  if (a == null || r == null) return;
  if (letra && MOM_LETRAS.indexOf(letra) < 0) return;
  const f = lista.find(x => x.actividad === a && x.rol === r); if (!f) return;
  f.letra = letra || null; S.s('momRaci', lista); renderMom();
}
export function momAgregarActividad() {
  if (!_mPuedeEditar()) return _mSoloAdmin();
  const hayRoles = momRaciMatriz(S.g('momRaci') || []).roles.length > 0;
  sm('<h3>Agregar actividad al proceso</h3><div class="form-row"><div class="fg" style="width:100%"><label>Actividad *</label><input id="maNombre" style="width:100%" placeholder="Ej.: Evaluar la efectividad del entrenamiento"></div></div>' +
    (hayRoles ? '' : '<div class="form-row"><div class="fg"><label>Primer rol de la matriz *</label><input id="maRol"></div><div class="fg"><label>Audiencia del rol</label><select id="maAud">' + MOM_AUDIENCIAS.map(a => '<option>' + a + '</option>').join('') + '</select></div></div>') +
    '<br><button class="btn" onclick="momGuardarActividad()">Guardar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
}
export function momGuardarActividad() {
  if (!_mPuedeEditar()) return _mSoloAdmin();
  const nombre = ($('maNombre').value || '').trim(); if (nombre.length < 3) return toast('⚠️ Escribe la actividad');
  const lista = S.g('momRaci') || [], m = momRaciMatriz(lista);
  if (m.actividades.indexOf(nombre) >= 0) return toast('⚠️ Esa actividad ya existe');
  let roles = m.roles.map((r, i) => ({ nombre: r.nombre, audiencia: r.audiencia, orden: (lista.find(x => x.rol === r.nombre) || {}).rolOrden || i + 1 }));
  if (!roles.length) {
    const rol = ($('maRol') && $('maRol').value || '').trim(); if (!rol) return toast('⚠️ Escribe el primer rol de la matriz');
    roles = [{ nombre: rol, audiencia: $('maAud').value, orden: 1 }];
  }
  const orden = lista.reduce((mx, f) => Math.max(mx, f.actOrden || 0), 0) + 1;
  roles.forEach(r => lista.push({ _id: _mId(), actividad: nombre, actOrden: orden, rol: r.nombre, rolOrden: r.orden, audienciaRol: r.audiencia, letra: null, usuario: _mUsuario() }));
  S.s('momRaci', lista); cm(); renderMom(); toast('✅ Actividad agregada');
}
export function momBorrarActividad(i) {
  if (!_mPuedeEditar()) return _mSoloAdmin();
  const lista = S.g('momRaci') || [], a = momRaciMatriz(lista).actividades[i]; if (a == null) return;
  if (!confirm('¿Borrar la actividad «' + a.slice(0, 70) + '» de la matriz?')) return;
  S.s('momRaci', lista.filter(x => x.actividad !== a)); renderMom(); toast('🗑 Actividad borrada');
}
export function momAgregarRol() {
  if (!_mPuedeEditar()) return _mSoloAdmin();
  if (!momRaciMatriz(S.g('momRaci') || []).actividades.length) return toast('⚠️ Primero agrega una actividad o carga la propuesta base');
  sm('<h3>Agregar rol a la matriz</h3><div class="form-row"><div class="fg"><label>Rol *</label><input id="mrNombre" placeholder="Ej.: Jefe de Operaciones"></div>' +
    '<div class="fg"><label>Audiencia</label><select id="mrAud">' + MOM_AUDIENCIAS.map(a => '<option>' + a + '</option>').join('') + '</select></div></div>' +
    '<br><button class="btn" onclick="momGuardarRol()">Guardar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
}
export function momGuardarRol() {
  if (!_mPuedeEditar()) return _mSoloAdmin();
  const nombre = ($('mrNombre').value || '').trim(), aud = $('mrAud').value; if (nombre.length < 2) return toast('⚠️ Escribe el rol');
  const lista = S.g('momRaci') || [], m = momRaciMatriz(lista);
  if (m.roles.some(r => r.nombre === nombre)) return toast('⚠️ Ese rol ya existe');
  const orden = lista.reduce((mx, f) => Math.max(mx, f.rolOrden || 0), 0) + 1;
  m.actividades.forEach(a => lista.push({ _id: _mId(), actividad: a, actOrden: (lista.find(x => x.actividad === a) || {}).actOrden || 0, rol: nombre, rolOrden: orden, audienciaRol: aud, letra: null, usuario: _mUsuario() }));
  S.s('momRaci', lista); cm(); renderMom(); toast('✅ Rol agregado');
}
export function momBorrarRol(i) {
  if (!_mPuedeEditar()) return _mSoloAdmin();
  const lista = S.g('momRaci') || [], r = momRaciMatriz(lista).roles[i]; if (!r) return;
  if (!confirm('¿Quitar el rol «' + r.nombre + '» de la matriz?')) return;
  S.s('momRaci', lista.filter(x => x.rol !== r.nombre)); renderMom(); toast('🗑 Rol quitado');
}

// Puente window/renders — ver nota en mov.js (primera tanda).
window.renderMom = renderMom;
window.momAgregarEntren = momAgregarEntren;
window.momEditarEntren = momEditarEntren;
window.momMarcarEjecutado = momMarcarEjecutado;
window.momGuardarEntren = momGuardarEntren;
window.momBorrarEntren = momBorrarEntren;
window.momCargarBase = momCargarBase;
window.momRaciCelda = momRaciCelda;
window.momAgregarActividad = momAgregarActividad;
window.momGuardarActividad = momGuardarActividad;
window.momBorrarActividad = momBorrarActividad;
window.momAgregarRol = momAgregarRol;
window.momGuardarRol = momGuardarRol;
window.momBorrarRol = momBorrarRol;
window.momVincularTarea = momVincularTarea;
renders.mom = renderMom;
