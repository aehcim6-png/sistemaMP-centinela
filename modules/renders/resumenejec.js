// Resumen Ejecutivo (sub-pestaña de Metas & KPIs) — Nivel 4 de la propuesta
// de identidad visual de esta sesión: una sola pantalla, pensada para
// imprimir/exportar y mandarle a un dueño o gerente que nunca entra al
// sistema, con lo que hoy vive disperso en la pestaña Metas: el semáforo de
// los 8 indicadores del mes actual, las alertas de tendencia (Nivel 4 de
// "conectar los números", 2026-08) y los compromisos pendientes/vencidos
// (loop de responsabilidad, 2026-08-31). No calcula nada nuevo: reutiliza el
// snapshot que renderMetas() ya arma en window._metasCadena, forzando su
// cálculo primero por si esta sub-pestaña se abre sin haber pasado antes por
// "Metas".
export function renderResumenEjec() {
  if (!$('s-resumen')) return;
  if (typeof renders.metas === 'function') renders.metas();
  var snap = window._metasCadena;
  if (!snap) { $('s-resumen').innerHTML = '<p style="padding:16px;color:var(--tx3)">Sin datos suficientes todavía.</p>'; return; }
  var indicators = snap.indicators, realData = snap.realData, MSN = snap.MSN, hMFlota = snap.hMFlota;
  var mesActual = MSN[snap.mesActualIdx];
  var alertasTendencia = snap.alertasTendencia || [];
  var metas = S.g('metas') || {};

  // Mismo caso especial de MTBF que renderMetas()/verCadenaCausas() (no vive
  // directo en realData) y misma resolución meta-del-mes-o-anual que la
  // tabla de Metas — ver esos dos lugares para el original.
  function valorActual(id) {
    if (!realData[mesActual]) return null;
    if (id === 'mtbf') { var fM = realData[mesActual].correctivosDelMes; return fM > 0 ? Math.round(hMFlota / fM) : null; }
    var v = realData[mesActual][id];
    return v === undefined ? null : v;
  }
  function metaActual(ind) {
    var data = metas[ind.id];
    if (data && data.meses && data.meses[mesActual] && data.meses[mesActual].meta != null) return data.meses[mesActual].meta;
    return (data && data.metaAnual != null) ? data.metaAnual : ind.meta;
  }

  var filas = indicators.map(function (ind) {
    var real = valorActual(ind.id);
    var metaV = metaActual(ind);
    var sinDato = real == null;
    var ok = sinDato ? null : (ind.higher ? real >= metaV : real <= metaV);
    return {
      ind: ind, real: real, meta: metaV, sinDato: sinDato,
      col: sinDato ? 'var(--tx3)' : ok ? 'var(--ok)' : 'var(--danger)',
      ico: sinDato ? '⚪' : ok ? '🟢' : '🔴',
      ok: ok
    };
  });
  var conDato = filas.filter(function (f) { return !f.sinDato; }).length;
  var dentroMeta = filas.filter(function (f) { return f.ok === true; }).length;

  var compromisos = (S.g('compromisos') || [])
    .filter(function (c) { return c.estado === 'Pendiente' || c.estado === 'Vencido'; })
    .sort(function (a, b) { return (a.estado === 'Vencido' ? 0 : 1) - (b.estado === 'Vencido' ? 0 : 1); });

  var filasHtml = filas.map(function (f) {
    return '<tr><td style="font-weight:600">' + f.ico + ' ' + escapeHtml(f.ind.name) + '</td>' +
      '<td class="mono" style="text-align:center;color:' + f.col + ';font-weight:700">' + (f.sinDato ? '—' : f.real) + '</td>' +
      '<td class="mono" style="text-align:center;color:var(--tx3)">' + f.meta + '</td></tr>';
  }).join('');

  var tendenciaHtml = alertasTendencia.length ?
    '<div style="background:rgba(239,68,68,.06);border:1px solid var(--danger);border-radius:8px;padding:12px 16px;margin:16px 0">' +
    '<b style="color:var(--danger);font-size:12px">⚠️ Tendencias a vigilar</b>' +
    '<ul style="margin:6px 0 0;padding-left:18px;font-size:11px;color:var(--tx2)">' +
    alertasTendencia.map(function (t) { return '<li style="margin-bottom:4px">' + escapeHtml(t) + '</li>'; }).join('') +
    '</ul></div>' :
    '<p style="font-size:11px;color:var(--tx3);margin:16px 0">Sin tendencias de empeoramiento sostenido esta vez.</p>';

  var compromisosHtml = compromisos.length ?
    '<div class="tbl-wrap"><table style="font-size:11px">' +
    '<tr><th>Indicador</th><th>Acción</th><th>Responsable</th><th>Fecha compromiso</th><th>Estado</th></tr>' +
    compromisos.map(function (c) {
      var vencido = c.estado === 'Vencido';
      return '<tr><td>' + escapeHtml(c.indicadorName || c.indicadorId) + '</td>' +
        '<td style="max-width:260px">' + escapeHtml(c.accion || '') + '</td>' +
        '<td>' + escapeHtml(c.responsable || '—') + '</td>' +
        '<td class="mono">' + (c.fechaCompromiso || '—') + '</td>' +
        '<td style="color:' + (vencido ? 'var(--danger)' : 'var(--tx3)') + ';font-weight:600">' + (vencido ? '🔴' : '⏳') + ' ' + c.estado + '</td></tr>';
    }).join('') + '</table></div>' :
    '<p style="font-size:11px;color:var(--tx3);margin:8px 0">Sin compromisos pendientes ni vencidos.</p>';

  $('s-resumen').innerHTML =
    '<div class="sec-h"><div><div class="sec-t">' + ICONS.doc + ' Resumen Ejecutivo</div>' +
    '<div class="sec-s">' + mesActual + ' ' + new Date().getFullYear() + ' · generado ' + new Date().toLocaleDateString('es-CL') + '</div></div>' +
    '<button class="btn" onclick="imprimirTab(\'resumen\',\'Resumen Ejecutivo\')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="5" y="7" width="10" height="6" rx="0.8"/><polyline points="6,7 6,3 14,3 14,7"/><rect x="7" y="13" width="6" height="4"/></svg> Imprimir / PDF</button></div>' +
    '<div class="cards" style="margin-bottom:16px">' +
    '<div class="card"><div class="card-t">Indicadores dentro de meta</div><div class="card-v" style="color:' + (conDato ? (dentroMeta === conDato ? 'var(--ok)' : 'var(--danger)') : 'var(--tx3)') + '">' + dentroMeta + ' / ' + conDato + '</div><div class="card-s">con dato este mes (de ' + indicators.length + ' indicadores)</div></div>' +
    '<div class="card"><div class="card-t">Compromisos abiertos</div><div class="card-v" style="color:' + (compromisos.length ? 'var(--warn)' : 'var(--ok)') + '">' + compromisos.length + '</div><div class="card-s">pendientes o vencidos</div></div>' +
    '<div class="card"><div class="card-t">Tendencias en alerta</div><div class="card-v" style="color:' + (alertasTendencia.length ? 'var(--danger)' : 'var(--ok)') + '">' + alertasTendencia.length + '</div><div class="card-s">empeorando 3+ meses seguidos</div></div>' +
    '</div>' +
    '<b style="font-size:12px">🚦 Semáforo de indicadores — ' + mesActual + '</b>' +
    '<div class="tbl-wrap" style="margin-top:6px"><table style="font-size:11px">' +
    '<tr><th>Indicador</th><th style="text-align:center">Real</th><th style="text-align:center">Meta</th></tr>' + filasHtml + '</table></div>' +
    tendenciaHtml +
    '<b style="font-size:12px">📝 Compromisos pendientes / vencidos</b>' +
    compromisosHtml;
}

// Puente window/renders — ver nota en mov.js (primera tanda).
window.renderResumenEjec = renderResumenEjec;
renders.resumen = renderResumenEjec;
