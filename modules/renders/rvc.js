// Sub-pestaña «Reparar vs comprar» de Componentes (2026-10-28): para cada pieza que se repara o se compra, ¿cuál conviene? Precio y plazo salen de las compras, la vida de lo reparado y de lo nuevo del
// Historial de Componentes, y la detención del costo de hora detenida. El cálculo vive en logic.js (repararVsComprar y rvc*, con pruebas); acá solo se arma lo que se ve.
// Regla de la pantalla: si no se sabe cuánto dura lo reparado, NO se recomienda: se muestra el punto de equilibrio. Módulo ES lazy, mismo patrón que ger.js.
const _rvcE = t => escapeHtml(String(t == null ? '' : t));
const _rvcPeso = v => v == null ? '—' : '$' + fn(Math.round(v));
const _rvcDias = d => d == null ? '—' : fn(Math.round(d * 10) / 10) + ' d';
const _rvcH = h => h == null ? '—' : fn(Math.round(h)) + ' h';
const _RVC_VEREDICTO = {
  reparar: ['Conviene reparar', 'var(--ok)'], comprar: ['Conviene comprar', 'var(--danger)'], parecido: ['Parecido', 'var(--tx2)'],
  equilibrio: ['Falta medir la vida de lo reparado', 'var(--warn)'], solo_reparado: ['Solo se repara', 'var(--tx2)'], solo_nuevo: ['Solo se compra', 'var(--tx2)'], sin_datos: ['Sin datos', 'var(--tx3)']
};
window._rvcEstado = window._rvcEstado || { sinReserva: true, extra: '' };

function _rvcOpcion(o, t) {
  if (!o.n) return '<span style="color:var(--tx3)">sin compras</span>';
  return '<b>' + _rvcPeso(o.precio) + '</b><div style="font-size:10px;color:var(--tx3)">' + o.n + ' línea' + (o.n === 1 ? '' : 's') + (o.n > 1 ? ' · ' + _rvcPeso(o.min) + ' a ' + _rvcPeso(o.max) : '') + '<br>plazo ' + _rvcDias(o.plazoDias) + (o.nPlazo ? ' (' + o.nPlazo + ')' : '') + '</div>';
}
function _rvcVida(v) {
  if (!v.instalados) return '<span style="color:var(--tx3)">—</span>';
  return v.vida ? '<b>' + _rvcH(v.vida) + '</b><div style="font-size:10px;color:var(--tx3)">' + v.terminados + ' tramo' + (v.terminados === 1 ? '' : 's') + ' terminado' + (v.terminados === 1 ? '' : 's') + '</div>' : '<span style="color:var(--tx3)">sin tramos terminados</span><div style="font-size:10px;color:var(--tx3)">' + v.instalados + ' instalado' + (v.instalados === 1 ? '' : 's') + '</div>';
}
function _rvcFilaResumen(f) {
  const vv = _RVC_VEREDICTO[f.decision];
  return '<tr><td><b>' + _rvcE(f.nombre) + '</b></td>' +
    '<td style="color:' + vv[1] + ';font-weight:700;white-space:nowrap">' + vv[0] + '</td>' +
    '<td class="mono" style="text-align:right">' + _rvcOpcion(f.reparado) + '</td><td class="mono" style="text-align:right">' + _rvcOpcion(f.nuevo) + '</td>' +
    '<td class="mono" style="text-align:right">' + _rvcVida(f.vidas.reparado) + '</td><td class="mono" style="text-align:right">' + _rvcVida(f.vidas.nuevo) + '</td>' +
    '<td class="mono" style="text-align:right">' + (f.porMilReparado != null ? _rvcPeso(f.porMilReparado) : '—') + '</td><td class="mono" style="text-align:right">' + (f.porMilNuevo != null ? _rvcPeso(f.porMilNuevo) : '—') + '</td>' +
    '<td class="mono" style="text-align:right">' + (f.equilibrio != null ? Math.round(f.equilibrio * 100) + ' %' : '—') + '</td></tr>' +
    '<tr><td colspan="9" style="font-size:11px;line-height:1.5;color:var(--tx2);padding:2px 8px 8px;border-top:none">' + _rvcE(f.motivo) + (f.avisos.length && f.decision !== 'sin_datos' ? ' <span style="color:var(--warn)">· ' + f.avisos.map(_rvcE).join(' · ') + '</span>' : '') + '</td></tr>';
}
function _rvcDetalle(f, sinReserva) {
  const linea = (c) => '<tr><td class="mono">' + _rvcE(c.fecha || '') + '</td><td>' + _rvcE(c.sigla || '') + '</td><td>' + _rvcE(c.detalle) + '</td><td class="mono" style="text-align:right">' + _rvcPeso(c.precio) + '</td><td class="mono" style="text-align:right">' + _rvcDias(c.plazo) + '</td><td>' + _rvcE(c.proveedor || '') + '</td></tr>';
  const cab = '<tr><th style="text-align:left">Fecha</th><th style="text-align:left">Equipo</th><th style="text-align:left">Detalle</th><th style="text-align:right">Precio unitario</th><th style="text-align:right">Plazo</th><th style="text-align:left">Proveedor</th></tr>';
  const tot = (t) => t ? _rvcPeso(t.precio) + ' + ' + _rvcH(t.horasDet) + ' detenido × ' + _rvcPeso(f.costoHoraDet) + ' = <b>' + _rvcPeso(t.total) + '</b>' : '—';
  const estados = ['reparado', 'nuevo', 'usado', 'sin dato'].map(k => { const v = f.vidas[k]; return '<tr><td>' + k + '</td><td class="mono" style="text-align:right">' + v.instalados + '</td><td class="mono" style="text-align:right">' + v.terminados + '</td><td class="mono" style="text-align:right">' + _rvcH(v.horasExpuestas) + '</td><td class="mono" style="text-align:right">' + _rvcH(v.vida) + '</td><td class="mono" style="text-align:right">' + _rvcH(v.mediana) + '</td></tr>'; }).join('');
  return '<details style="margin:6px 0"><summary style="cursor:pointer;font-size:12px;color:var(--ac)">' + _rvcE(f.nombre) + ': de dónde salen los números</summary><div style="padding:6px 0 10px">' +
    '<div style="font-size:11px;line-height:1.7"><b>Reparar:</b> ' + tot(f.totalReparado) + '<br><b>Comprar:</b> ' + tot(f.totalNuevo) + '<br>Horas del cambio: ' + (f.hCambio != null ? _rvcH(f.hCambio) + ' (mediana de ' + f.nHCambio + ' correctivo' + (f.nHCambio === 1 ? '' : 's') + ')' : 'sin dato') + ' · ' + (sinReserva ? 'se cuenta la espera del plazo completo' : 'con pieza de reserva: no se cuenta espera') + '</div>' +
    '<div style="font-size:11px;font-weight:700;margin:8px 0 3px">Vida de lo instalado, según cómo quedó anotado el cambio</div>' +
    '<div class="tbl-wrap"><table style="font-size:11px"><tr><th style="text-align:left">Estado</th><th style="text-align:right">Instalados</th><th style="text-align:right">Tramos terminados</th><th style="text-align:right">Horas de uso</th><th style="text-align:right">Vida (horas ÷ cambios)</th><th style="text-align:right">Mediana</th></tr>' + estados + '</table></div>' +
    '<div style="font-size:11px;font-weight:700;margin:8px 0 3px">Últimas reparaciones pagadas</div><div class="tbl-wrap"><table style="font-size:11px">' + cab + (f.reparado.casos.map(linea).join('') || '<tr><td colspan="6" style="color:var(--tx3)">ninguna</td></tr>') + '</table></div>' +
    '<div style="font-size:11px;font-weight:700;margin:8px 0 3px">Últimas compras de la pieza</div><div class="tbl-wrap"><table style="font-size:11px">' + cab + (f.nuevo.casos.map(linea).join('') || '<tr><td colspan="6" style="color:var(--tx3)">ninguna</td></tr>') + '</table></div></div></details>';
}

export function renderRvc() {
  const el = $('s-rvc'); if (!el) return;
  const est = window._rvcEstado;
  let r;
  try {
    const cfg = S.g('cfg') || {};
    const aj = tboAjustesCosto(function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, null, S.g('hh'), cfg.costoHoraDetUSD, cfg.costoHoraDetModelos, cfg.tasaUSD);
    let extra = null;
    const txt = String(est.extra || '').trim();
    if (txt) { const rx = new RegExp(txt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); extra = { id: 'extra', nombre: txt, comp: rx, item: rx }; }
    r = repararVsComprar({ hoy: new Date().toISOString().slice(0, 10), compras: S.g('comprasDetalle') || [], compHist: S.g('compHist') || [], equipos: S.g('eq') || [], ot: S.g('ot') || [], aj, sinReserva: est.sinReserva, extra });
  } catch (e) { console.error('renderRvc', e); el.innerHTML = '<div class="chart-box"><div class="chart-t">Reparar vs comprar</div><div style="color:var(--danger)">No se pudo calcular: ' + _rvcE(e.message) + '</div></div>'; return; }
  const conVeredicto = r.filas.filter(f => f.decision === 'reparar' || f.decision === 'comprar' || f.decision === 'parecido').length;
  const soloUna = r.filas.filter(f => f.decision === 'solo_reparado' || f.decision === 'solo_nuevo').length;
  el.innerHTML = '<div class="chart-box" style="margin-bottom:14px"><div class="chart-t">Reparar vs comprar</div>' +
    '<div style="font-size:11px;color:var(--tx2);line-height:1.6">Para cada pieza se compara <b>reparar</b> (lo que se pagó en servicios de reparación) contra <b>comprar</b> (lo que se pagó por la pieza). Se cuenta el precio, las horas que el equipo queda detenido (el cambio y, si no hay pieza de reserva, la espera del plazo de entrega, a su costo de hora detenida) y cuánto dura cada opción según el Historial de Componentes. ' +
    '<b>Costo por 1.000 h</b> = (precio + horas detenidas × costo de la hora detenida) ÷ vida × 1.000. Si no se sabe cuánto dura lo reparado, no se recomienda: se muestra el <b>equilibrio</b> (reparar conviene si lo reparado dura al menos ese porcentaje de lo que dura uno nuevo).</div>' +
    '<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end;margin-top:10px">' +
    '<div><label style="font-size:11px;display:block;margin-bottom:2px">¿Hay pieza de reserva?</label><select id="rvcReserva" onchange="rvcCambiarReserva(this.value)"><option value="no"' + (est.sinReserva ? ' selected' : '') + '>No: el equipo espera el plazo completo</option><option value="si"' + (est.sinReserva ? '' : ' selected') + '>Sí: solo cuenta el tiempo del cambio</option></select></div>' +
    '<div><label style="font-size:11px;display:block;margin-bottom:2px">Probar otra pieza</label><input id="rvcOtra" type="text" placeholder="ej.: radiador" value="' + _rvcE(est.extra) + '" style="width:160px" onkeydown="if(event.key===\'Enter\')rvcBuscarPieza()"> <button class="btn btn-sm" onclick="rvcBuscarPieza()">Calcular</button></div>' +
    '</div>' +
    '<div style="font-size:12px;margin-top:10px"><b>' + conVeredicto + '</b> de ' + r.filas.length + ' piezas tienen datos para comparar el costo por hora de uso' + (soloUna ? ' y ' + soloUna + ' solo se ' + 'han hecho de una manera (no hay con qué comparar)' : '') + '.</div>' +
    '<div style="font-size:11px;color:var(--tx2);margin-top:6px">Desde el 29 de octubre, al agregar un evento en Componentes → Historial hay que indicar si lo instalado es <b>nuevo, reparado o usado</b>: con eso esta comparación mejora con cada cambio. Los asientos y alternadores sin estado anotado se toman como reparados (se reparan siempre).</div></div>' +
    '<div class="chart-box" style="margin-bottom:14px"><div class="tbl-wrap" style="max-height:70vh;overflow:auto"><table style="font-size:11px"><tr><th style="text-align:left">Pieza</th><th style="text-align:left">Veredicto</th><th style="text-align:right">Reparar<br>precio y plazo</th><th style="text-align:right">Comprar<br>precio y plazo</th><th style="text-align:right">Vida<br>reparado</th><th style="text-align:right">Vida<br>nuevo</th><th style="text-align:right">$ por 1.000 h<br>reparar</th><th style="text-align:right">$ por 1.000 h<br>comprar</th><th style="text-align:right">Equilibrio</th></tr>' +
    r.filas.map(_rvcFilaResumen).join('') + '</table></div>' +
    '<div style="margin-top:8px">' + r.filas.map(f => _rvcDetalle(f, r.sinReserva)).join('') + '</div>' +
    '<div style="font-size:10.5px;color:var(--tx3);line-height:1.5;margin-top:8px"><b>Con qué datos:</b> líneas de compra firmadas o recibidas (mediana del precio unitario; el plazo, solo de las recibidas), Historial de Componentes (cada cambio anotado como reparado, nuevo o usado; la vida es el horómetro hasta el siguiente cambio en el mismo equipo), correctivos que mencionan la pieza (horas del cambio) y el costo de hora detenida de Configuración. ' +
    '<br><b>Límites:</b> un asiento «usado» o «retirado de otro equipo» no cuenta como reparado ni como nuevo. Un precio con pocas líneas es una referencia, no una cotización. Cuando el cambio no quedó anotado como reparado o nuevo, esa vida no entra a la comparación. La detención por falla no incluye la producción perdida más allá del costo de hora detenida.</div></div>';
  setTimeout(function () { if (typeof aplicarOrdenUniversal === 'function') aplicarOrdenUniversal('s-rvc'); }, 60);
}
export function rvcCambiarReserva(v) { window._rvcEstado.sinReserva = v !== 'si'; renderRvc(); }
export function rvcBuscarPieza() { const i = $('rvcOtra'); window._rvcEstado.extra = i ? i.value : ''; renderRvc(); }

// Puente window/renders — ver nota en mov.js (primera tanda).
window.renderRvc = renderRvc;
window.rvcCambiarReserva = rvcCambiarReserva;
window.rvcBuscarPieza = rvcBuscarPieza;
renders.rvc = renderRvc;
