// Pestaña «FODA» (2026-11-08): análisis de fortalezas, debilidades, oportunidades y amenazas con puntaje, estrategias cruzadas
// (FO ofensivas, FA defensivas, DO de reorientación, DA de supervivencia) como planes de acción con estado, y un tablero
// (gráfico circular, radar y estado de los planes). Todos los perfiles que ven la pestaña pueden mirar; solo un administrador
// edita (lo exige también la base de datos). Las sugerencias del sistema proponen fortalezas y debilidades calculadas con los datos
// (fodaSugerencias, logic.js): la persona las agrega o las descarta; lo externo (oportunidades y amenazas) se escribe a mano.
// El cálculo vive en logic.js con pruebas; acá solo se arma lo que se ve. Módulo ES lazy, mismo patrón que tareas.js.
const _fE = t => escapeHtml(String(t == null ? '' : t));
const _fHoy = () => new Date().toISOString().slice(0, 10);
const _F_COLOR = { F: 'var(--ok)', D: '#f97316', O: 'var(--info)', A: 'var(--danger)' };
const _F_ESTADO_COLOR = { Pendiente: 'var(--danger)', 'En proceso': 'var(--warn)', Culminado: 'var(--ok)' };
const _F_DESCARTE = 'fodaSugerenciasDescartadas';

function _fPuedeEditar() { return window._userRole === 'admin'; }
function _fNuevoRef() { return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function _fDescartadas() { try { return JSON.parse(localStorage.getItem(_F_DESCARTE) || '[]'); } catch (e) { return []; } }
function _fGuardarDescartadas(l) { try { localStorage.setItem(_F_DESCARTE, JSON.stringify(l)); } catch (e) { /* sin storage: se vuelve a proponer */ } }
function _fPuntos(n) { return '●'.repeat(n) + '○'.repeat(5 - n); }

// ── Gráficos (SVG simple, sin librerías) ──
function _fDonut(res) {
  const R = 40, C = 2 * Math.PI * R;
  if (!res.total) return '<div style="font-size:11px;color:var(--tx3);padding:30px 0;text-align:center">Aún no hay ítems.</div>';
  let acum = 0;
  const arcos = FODA_TIPOS.map(t => {
    const frac = res.porTipo[t].n / res.total, len = frac * C;
    const c = '<circle cx="60" cy="60" r="' + R + '" fill="none" stroke="' + _F_COLOR[t] + '" stroke-width="22" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" stroke-dashoffset="' + (-acum).toFixed(2) + '" transform="rotate(-90 60 60)"/>';
    acum += len; return c;
  }).join('');
  const leyenda = FODA_TIPOS.map(t => '<div style="font-size:11px;white-space:nowrap"><span style="display:inline-block;width:9px;height:9px;background:' + _F_COLOR[t] + ';margin-right:5px"></span>' + FODA_NOMBRES[t] + ' <b>' + res.porTipo[t].pct + ' %</b></div>').join('');
  return '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;justify-content:center"><svg viewBox="0 0 120 120" width="130" height="130" role="img" aria-label="Proporción de fortalezas, debilidades, oportunidades y amenazas">' + arcos + '</svg><div>' + leyenda + '</div></div>';
}
function _fRadar(res) {
  const max = Math.max(1, ...FODA_TIPOS.map(t => res.porTipo[t].puntos)), cx = 80, cy = 80, r = 56;
  // Fortalezas arriba, Debilidades a la derecha, Oportunidades abajo y Amenazas a la izquierda (como la plantilla).
  const dir = { F: [0, -1], D: [1, 0], O: [0, 1], A: [-1, 0] };
  const pt = (t, k) => (cx + dir[t][0] * r * k).toFixed(1) + ',' + (cy + dir[t][1] * r * k).toFixed(1);
  const anillos = [0.25, 0.5, 0.75, 1].map(k => '<polygon points="' + FODA_TIPOS.map(t => pt(t, k)).join(' ') + '" fill="none" stroke="var(--border)" stroke-width="0.6"/>').join('');
  const ejes = FODA_TIPOS.map(t => '<line x1="' + cx + '" y1="' + cy + '" x2="' + pt(t, 1).split(',')[0] + '" y2="' + pt(t, 1).split(',')[1] + '" stroke="var(--border)" stroke-width="0.6"/>').join('');
  const poly = '<polygon points="' + FODA_TIPOS.map(t => pt(t, res.porTipo[t].puntos / max)).join(' ') + '" fill="rgba(59,130,246,.25)" stroke="var(--info)" stroke-width="1.6"/>';
  const rot = { F: [80, 12, 'middle'], D: [150, 83, 'start'], O: [80, 156, 'middle'], A: [10, 83, 'end'] };
  const etiquetas = FODA_TIPOS.map(t => '<text x="' + rot[t][0] + '" y="' + rot[t][1] + '" text-anchor="' + rot[t][2] + '" font-size="8" fill="var(--tx2)">' + FODA_NOMBRES[t] + ' (' + res.porTipo[t].puntos + ')</text>').join('');
  return '<svg viewBox="0 0 160 164" width="100%" style="max-width:220px" role="img" aria-label="Puntaje de cada cuadrante">' + anillos + ejes + poly + etiquetas + '</svg>';
}
function _fBarras(res) {
  const max = Math.max(1, ...FODA_ESTADOS.map(e => res.estados[e]));
  return '<div style="display:flex;align-items:flex-end;justify-content:center;gap:22px;height:120px;padding-top:6px">' + FODA_ESTADOS.map(e => {
    const n = res.estados[e], h = Math.round(n / max * 90);
    return '<div style="text-align:center;font-size:11px"><div style="font-weight:700">' + n + '</div><div style="width:34px;height:' + (h || 2) + 'px;background:' + _F_ESTADO_COLOR[e] + ';margin:2px auto"></div><div style="color:var(--tx2)">' + e + '</div></div>';
  }).join('') + '</div>';
}

// ── Pantalla ──
function _fCuadrante(t, items, cods, ed) {
  const lista = items.filter(i => i.tipo === t);
  const filas = lista.length ? lista.map(i => '<div style="display:flex;gap:8px;align-items:flex-start;padding:5px 0;border-bottom:1px solid var(--border);font-size:12px">' +
    '<b style="color:' + _F_COLOR[t] + ';min-width:28px">' + _fE(cods[i.ref]) + '</b><div style="flex:1">' + _fE(i.texto) + (i.origen ? '<div style="font-size:10px;color:var(--tx3)">Sugerido por el sistema</div>' : '') + '</div>' +
    '<span title="Puntaje ' + (i.puntaje || 3) + ' de 5" style="font-size:10px;color:var(--tx2);white-space:nowrap">' + _fPuntos(i.puntaje || 3) + '</span>' +
    (ed ? '<span style="white-space:nowrap"><button class="btn btn-o btn-sm" onclick="fodaEditarItem(\'' + _fE(i.ref) + '\')" aria-label="Editar">✏️</button> <button class="btn btn-o btn-sm" onclick="fodaBorrarItem(\'' + _fE(i.ref) + '\')" aria-label="Borrar">🗑</button></span>' : '') + '</div>').join('')
    : '<div style="font-size:11px;color:var(--tx3);padding:8px 0">Sin ítems todavía.</div>';
  return '<div class="chart-box" style="border-top:3px solid ' + _F_COLOR[t] + '"><div class="chart-t" style="display:flex;justify-content:space-between;align-items:center"><span>' + FODA_NOMBRES[t] + ' <small style="color:var(--tx3)">(' + (t === 'F' || t === 'D' ? 'internas' : 'externas') + ')</small></span>' +
    (ed ? '<button class="btn btn-sm" onclick="fodaAgregarItem(\'' + t + '\')">+ Agregar</button>' : '') + '</div>' + filas + '</div>';
}
function _fSugerencias(items, ed) {
  const usadas = {}; items.forEach(i => { if (i.origen) usadas[i.origen] = true; });
  const desc = _fDescartadas();
  const sug = fodaSugerencias({ otHist: S.g('otHist') || [], hist: S.g('hist') || [], hoy: _fHoy() }).filter(s => !usadas[s.clave] && desc.indexOf(s.clave) < 0);
  const cuerpo = sug.length ? sug.map(s => '<div style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">' +
    '<b style="color:' + _F_COLOR[s.tipo] + ';min-width:90px">' + FODA_NOMBRES[s.tipo].replace(/s$/, '') + '</b><div style="flex:1">' + _fE(s.texto) + '</div>' +
    (ed ? '<span style="white-space:nowrap"><button class="btn btn-sm" onclick="fodaAceptarSugerencia(\'' + _fE(s.clave) + '\')">Agregar</button> <button class="btn btn-o btn-sm" onclick="fodaDescartarSugerencia(\'' + _fE(s.clave) + '\')">Descartar</button></span>' : '') + '</div>').join('')
    : '<div style="font-size:11px;color:var(--tx3);padding:8px 0">No hay sugerencias nuevas con los datos de hoy.</div>';
  return '<div class="chart-box" style="margin-bottom:14px"><div class="chart-t">Sugerencias del sistema</div>' +
    '<div style="font-size:11px;color:var(--tx2);line-height:1.6;margin-bottom:6px">Calculadas con los datos cargados (correctivos reales, horómetros, historial). Solo proponen fortalezas y debilidades: lo externo, oportunidades y amenazas, no sale de los datos y lo escribes tú. ' + (ed ? 'Tú decides qué agregar.' : 'Solo un administrador puede agregarlas.') + '</div>' + cuerpo + '</div>';
}
function _fEstrategias(items, ests, cods, ed) {
  const porRef = {}; items.forEach(i => { porRef[i.ref] = i; });
  const bloque = c => {
    const def = FODA_CRUCES[c], lista = ests.filter(e => e.cruce === c);
    const filas = lista.length ? lista.map(e => {
      const a = porRef[e.refA], b = porRef[e.refB];
      const cod = (a ? cods[a.ref] : '¿?') + ' × ' + (b ? cods[b.ref] : '¿?');
      const estado = ed
        ? '<select onchange="fodaEstadoCambiar(\'' + _fE(e.ref) + '\',this.value)" style="font-size:11px;color:' + _F_ESTADO_COLOR[e.estado] + '">' + FODA_ESTADOS.map(s => '<option' + (s === e.estado ? ' selected' : '') + '>' + s + '</option>').join('') + '</select>'
        : '<b style="color:' + _F_ESTADO_COLOR[e.estado] + '">' + _fE(e.estado) + '</b>';
      const resp = ed ? '<input value="' + _fE(e.responsable || '') + '" style="font-size:11px;width:120px" onchange="fodaEstrategiaCampo(\'' + _fE(e.ref) + '\',\'responsable\',this.value)">' : _fE(e.responsable || '—');
      const fecha = ed ? '<input type="date" value="' + _fE(e.fechaCompromiso || '') + '" style="font-size:11px" onchange="fodaEstrategiaCampo(\'' + _fE(e.ref) + '\',\'fechaCompromiso\',this.value)">' : _fE(e.fechaCompromiso || '—');
      return '<tr><td class="mono" style="white-space:nowrap" title="' + _fE((a ? a.texto : '') + ' × ' + (b ? b.texto : '')) + '">' + _fE(cod) + '</td><td style="text-align:left">' + _fE(e.texto) + '</td><td>' + resp + '</td><td>' + fecha + '</td><td>' + estado + '</td>' +
        (ed ? '<td><button class="btn btn-o btn-sm" onclick="fodaBorrarEstrategia(\'' + _fE(e.ref) + '\')" aria-label="Borrar">🗑</button></td>' : '') + '</tr>';
    }).join('') : '<tr><td colspan="' + (ed ? 6 : 5) + '" style="color:var(--tx3);padding:10px">Sin estrategias todavía.</td></tr>';
    return '<div class="chart-box" style="margin-bottom:12px"><div class="chart-t">' + def.nombre + '</div><div style="font-size:11px;color:var(--tx3);margin-bottom:6px">' + def.pregunta + '</div>' +
      '<div class="tbl-wrap"><table style="font-size:11px"><tr><th style="text-align:left">Cruce</th><th style="text-align:left">Estrategia</th><th>Responsable</th><th>Compromiso</th><th>Estado</th>' + (ed ? '<th></th>' : '') + '</tr>' + filas + '</table></div></div>';
  };
  return Object.keys(FODA_CRUCES).map(bloque).join('');
}

export function renderFoda() {
  const el = $('s-foda'); if (!el) return;
  const items = S.g('fodaItems') || [], ests = S.g('fodaEstrategias') || [], ed = _fPuedeEditar();
  const cods = fodaCodigos(items), res = fodaResumen(items, ests);
  const sin = res.sinEstrategia.length;
  el.innerHTML = '<div class="sec-h"><div><div class="sec-t">' + ICONS.foda + ' Análisis FODA</div><div class="sec-s">Fortalezas, debilidades, oportunidades y amenazas, con estrategias y planes de acción</div></div></div>' +
    (ed ? '' : '<div style="font-size:11px;color:var(--tx3);margin-bottom:10px">Solo un administrador puede editar el FODA; tú puedes verlo completo.</div>') +
    '<div class="grid2" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;margin-bottom:14px">' + FODA_TIPOS.map(t => _fCuadrante(t, items, cods, ed)).join('') + '</div>' +
    _fSugerencias(items, ed) +
    '<div class="chart-box" style="margin-bottom:14px"><div class="chart-t" style="display:flex;justify-content:space-between;align-items:center"><span>Estrategias cruzadas (planes de acción)</span>' + (ed ? '<button class="btn btn-sm" onclick="fodaAgregarEstrategia()">+ Agregar estrategia</button>' : '') + '</div>' +
    '<div style="font-size:11px;color:var(--tx2);line-height:1.6">Cada estrategia cruza una fortaleza o debilidad con una oportunidad o amenaza y es un plan de acción con responsable, fecha y estado.' + (sin ? ' <b style="color:var(--warn)">' + sin + ' ítem(s) aún no tienen ninguna estrategia.</b>' : '') + '</div></div>' +
    _fEstrategias(items, ests, cods, ed) +
    '<div class="chart-box"><div class="chart-t">Tablero</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;align-items:start">' +
    '<div><div style="font-size:11px;font-weight:700;text-align:center;margin-bottom:4px">Gráfico circular FODA</div>' + _fDonut(res) + '</div>' +
    '<div><div style="font-size:11px;font-weight:700;text-align:center;margin-bottom:4px">Radar: puntaje por cuadrante</div><div style="text-align:center">' + _fRadar(res) + '</div></div>' +
    '<div><div style="font-size:11px;font-weight:700;text-align:center;margin-bottom:4px">Estado de los planes de acción (' + res.planes + ')</div>' + _fBarras(res) + '</div></div>' +
    '<div class="tbl-wrap" style="margin-top:12px"><table style="font-size:11px"><tr><th style="text-align:left">Tipo</th><th>Ítems</th><th>%</th><th>Puntuación</th></tr>' +
    FODA_TIPOS.map(t => '<tr><td style="text-align:left;color:' + _F_COLOR[t] + ';font-weight:700">' + FODA_NOMBRES[t] + '</td><td>' + res.porTipo[t].n + '</td><td>' + res.porTipo[t].pct + ' %</td><td>' + res.porTipo[t].puntos + '</td></tr>').join('') + '</table></div></div>';
}

// ── Ítems ──
function _fFormItem(titulo, tipo, ref, texto, puntaje) {
  sm('<h3>' + titulo + '</h3><div class="form-row"><div class="fg"><label>Tipo</label><select id="fiTipo">' + FODA_TIPOS.map(t => '<option value="' + t + '"' + (t === tipo ? ' selected' : '') + '>' + FODA_NOMBRES[t] + '</option>').join('') + '</select></div>' +
    '<div class="fg"><label>Puntaje (1 a 5)</label><select id="fiPuntaje">' + [1, 2, 3, 4, 5].map(n => '<option' + (n === puntaje ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div></div>' +
    '<div class="form-row"><div class="fg" style="width:100%"><label>Descripción *</label><textarea id="fiTexto" rows="3" style="width:100%" placeholder="Qué es y por qué pesa">' + _fE(texto) + '</textarea></div></div>' +
    '<input type="hidden" id="fiRef" value="' + _fE(ref) + '"><br><button class="btn" onclick="fodaGuardarItem()">Guardar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
}
export function fodaAgregarItem(tipo) { if (!_fPuedeEditar()) return toast('⛔ Solo un administrador puede editar el FODA'); _fFormItem('Agregar a ' + FODA_NOMBRES[tipo], tipo, '', '', 3); }
export function fodaEditarItem(ref) {
  if (!_fPuedeEditar()) return toast('⛔ Solo un administrador puede editar el FODA');
  const i = (S.g('fodaItems') || []).find(x => x.ref === ref); if (!i) return;
  _fFormItem('Editar ítem', i.tipo, ref, i.texto, i.puntaje || 3);
}
export function fodaGuardarItem() {
  if (!_fPuedeEditar()) return toast('⛔ Solo un administrador puede editar el FODA');
  const tipo = $('fiTipo').value, texto = ($('fiTexto').value || '').trim(), puntaje = parseInt($('fiPuntaje').value, 10), ref = $('fiRef').value;
  if (texto.length < 3) return toast('⚠️ Describe el ítem');
  if (!(puntaje >= 1 && puntaje <= 5)) return toast('⚠️ El puntaje va de 1 a 5');
  const lista = S.g('fodaItems') || [];
  if (ref) {
    const i = lista.find(x => x.ref === ref); if (!i) return;
    if (i.tipo !== tipo && (S.g('fodaEstrategias') || []).some(e => e.refA === ref || e.refB === ref)) return toast('⚠️ Este ítem ya tiene estrategias: no se puede cambiar de tipo (bórralas primero)');
    i.tipo = tipo; i.texto = texto; i.puntaje = puntaje;
  } else lista.push({ ref: _fNuevoRef(), tipo, texto, puntaje, origen: null, usuario: window._userName || '' });
  S.s('fodaItems', lista); cm(); renderFoda(); toast('✅ Guardado');
}
export function fodaBorrarItem(ref) {
  if (!_fPuedeEditar()) return toast('⛔ Solo un administrador puede editar el FODA');
  const lista = S.g('fodaItems') || [], ests = S.g('fodaEstrategias') || [];
  const i = lista.find(x => x.ref === ref); if (!i) return;
  const ligadas = ests.filter(e => e.refA === ref || e.refB === ref);
  if (!confirm('¿Borrar «' + i.texto.slice(0, 60) + '»?' + (ligadas.length ? ' También se borrarán ' + ligadas.length + ' estrategia(s) que lo usan.' : ''))) return;
  if (ligadas.length) S.s('fodaEstrategias', ests.filter(e => e.refA !== ref && e.refB !== ref));
  S.s('fodaItems', lista.filter(x => x.ref !== ref)); renderFoda(); toast('🗑 Ítem borrado');
}
export function fodaAceptarSugerencia(clave) {
  if (!_fPuedeEditar()) return toast('⛔ Solo un administrador puede editar el FODA');
  const s = fodaSugerencias({ otHist: S.g('otHist') || [], hist: S.g('hist') || [], hoy: _fHoy() }).find(x => x.clave === clave);
  if (!s) return toast('⚠️ Esa sugerencia ya no aplica con los datos de hoy');
  const lista = S.g('fodaItems') || [];
  if (lista.some(x => x.origen === clave)) return;
  lista.push({ ref: _fNuevoRef(), tipo: s.tipo, texto: s.texto, puntaje: s.puntaje, origen: clave, usuario: window._userName || '' });
  S.s('fodaItems', lista); renderFoda(); toast('✅ Agregado al FODA (puedes editar el texto y el puntaje)');
}
export function fodaDescartarSugerencia(clave) { const d = _fDescartadas(); if (d.indexOf(clave) < 0) d.push(clave); _fGuardarDescartadas(d); renderFoda(); }

// ── Estrategias ──
export function fodaAgregarEstrategia() {
  if (!_fPuedeEditar()) return toast('⛔ Solo un administrador puede editar el FODA');
  const items = S.g('fodaItems') || [], cods = fodaCodigos(items);
  const op = tipos => items.filter(i => tipos.indexOf(i.tipo) >= 0).map(i => '<option value="' + _fE(i.ref) + '">' + _fE(cods[i.ref]) + ' · ' + _fE(i.texto.slice(0, 70)) + '</option>').join('');
  if (!items.some(i => i.tipo === 'F' || i.tipo === 'D') || !items.some(i => i.tipo === 'O' || i.tipo === 'A')) return toast('⚠️ Primero agrega al menos una fortaleza o debilidad y una oportunidad o amenaza');
  sm('<h3>Agregar estrategia</h3><div class="form-row"><div class="fg" style="width:100%"><label>Fortaleza o debilidad *</label><select id="feA" style="width:100%">' + op(['F', 'D']) + '</select></div></div>' +
    '<div class="form-row"><div class="fg" style="width:100%"><label>Oportunidad o amenaza *</label><select id="feB" style="width:100%">' + op(['O', 'A']) + '</select></div></div>' +
    '<div class="form-row"><div class="fg" style="width:100%"><label>Estrategia *</label><textarea id="feTexto" rows="3" style="width:100%" placeholder="Qué se va a hacer"></textarea></div></div>' +
    '<div class="form-row"><div class="fg"><label>Responsable</label><input id="feResp"></div><div class="fg"><label>Fecha de compromiso</label><input id="feFecha" type="date"></div>' +
    '<div class="fg"><label>Estado</label><select id="feEstado">' + FODA_ESTADOS.map(s => '<option>' + s + '</option>').join('') + '</select></div></div><br>' +
    '<button class="btn" onclick="fodaGuardarEstrategia()">Guardar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
}
export function fodaGuardarEstrategia() {
  if (!_fPuedeEditar()) return toast('⛔ Solo un administrador puede editar el FODA');
  const items = S.g('fodaItems') || [];
  const e = { ref: _fNuevoRef(), refA: $('feA').value, refB: $('feB').value, texto: ($('feTexto').value || '').trim(), responsable: ($('feResp').value || '').trim() || null, fechaCompromiso: $('feFecha').value || null, estado: $('feEstado').value, observaciones: null, usuario: window._userName || '' };
  const a = items.find(i => i.ref === e.refA), b = items.find(i => i.ref === e.refB);
  e.cruce = a && b ? fodaCruceDe(a.tipo, b.tipo) : null;
  const err = fodaEstrategiaError(e, items);
  if (err) return toast('⚠️ ' + err);
  const lista = S.g('fodaEstrategias') || [];
  lista.push(e); S.s('fodaEstrategias', lista); cm(); renderFoda(); toast('✅ Estrategia agregada');
}
export function fodaEstadoCambiar(ref, estado) {
  if (!_fPuedeEditar()) return toast('⛔ Solo un administrador puede editar el FODA');
  const lista = S.g('fodaEstrategias') || [], e = lista.find(x => x.ref === ref); if (!e || FODA_ESTADOS.indexOf(estado) < 0) return;
  e.estado = estado; S.s('fodaEstrategias', lista); renderFoda();
}
export function fodaEstrategiaCampo(ref, campo, v) {
  if (!_fPuedeEditar()) return;
  if (campo !== 'responsable' && campo !== 'fechaCompromiso') return;
  if (campo === 'fechaCompromiso' && v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
  const lista = S.g('fodaEstrategias') || [], e = lista.find(x => x.ref === ref); if (!e) return;
  e[campo] = (v || '').trim() || null; S.s('fodaEstrategias', lista);
}
export function fodaBorrarEstrategia(ref) {
  if (!_fPuedeEditar()) return toast('⛔ Solo un administrador puede editar el FODA');
  if (!confirm('¿Borrar esta estrategia?')) return;
  S.s('fodaEstrategias', (S.g('fodaEstrategias') || []).filter(x => x.ref !== ref)); renderFoda(); toast('🗑 Estrategia borrada');
}

// Puente window/renders — ver nota en mov.js (primera tanda).
window.renderFoda = renderFoda;
window.fodaAgregarItem = fodaAgregarItem;
window.fodaEditarItem = fodaEditarItem;
window.fodaGuardarItem = fodaGuardarItem;
window.fodaBorrarItem = fodaBorrarItem;
window.fodaAceptarSugerencia = fodaAceptarSugerencia;
window.fodaDescartarSugerencia = fodaDescartarSugerencia;
window.fodaAgregarEstrategia = fodaAgregarEstrategia;
window.fodaGuardarEstrategia = fodaGuardarEstrategia;
window.fodaEstadoCambiar = fodaEstadoCambiar;
window.fodaEstrategiaCampo = fodaEstrategiaCampo;
window.fodaBorrarEstrategia = fodaBorrarEstrategia;
renders.foda = renderFoda;
