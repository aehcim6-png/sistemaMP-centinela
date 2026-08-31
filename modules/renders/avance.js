// Pestaña Avance Mensual (Plan vs Ejecución) — extraída a su propio
// archivo (Fase 2 de modularización). Módulo ES real (Fase 3, 2026-08-30,
// cuarta tanda: Metas, KPIs y Reportes) — ver nota de migración en mov.js
// (primera tanda, mismo patrón).
export function renderAvance() {
  if (!$("s-avance")) return;
  var eq = S.g('eq') || []; var reg = S.g('reg') || [];
  var fMes = $('fAvanceMes')?.value || new Date().toISOString().slice(0, 7);
  var meses = mesesAutomaticos();
  var _hoyAv = new Date(); var _hoyAvStr = _hoyAv.toISOString().slice(0, 10);
  var yr = parseInt(fMes.slice(0, 4)); var mn = parseInt(fMes.slice(5, 7));
  var diasMes = new Date(yr, mn, 0).getDate();
  // Día de referencia: si es el mes actual, el día de hoy; si es un mes ya pasado, el mes completo (100%); si es futuro, 0.
  var diaActual = (fMes === _hoyAvStr.slice(0, 7)) ? _hoyAv.getDate() : (fMes < _hoyAvStr.slice(0, 7) ? diasMes : 0);
  var pctEsperado = Math.round(diaActual / diasMes * 100);
  var avanceData = S.g('avanceData') || {};

  var eqAvance = eq.map(function (e) {
    var regM = reg.filter(function (r) { return r.equipo === e.sigla && (r.fechaEntrada || r.fechaEjec || '').slice(0, 7) === fMes });
    var planificados = avanceData[e.sigla] ? avanceData[e.sigla][fMes] || 0 : 0;
    var ejecutados = regM.length;
    var pctAvance = planificados > 0 ? Math.round(ejecutados / planificados * 100) : (ejecutados > 0 ? 100 : null);
    var diff = pctAvance === null ? null : pctAvance - pctEsperado;
    return { sigla: e.sigla, tipo: e.tipo, plan: planificados, ejec: ejecutados, pct: pctAvance, esp: pctEsperado, diff: diff };
  });

  var totalPlan = eqAvance.reduce(function (s, e) { return s + e.plan }, 0);
  var totalEjec = eqAvance.reduce(function (s, e) { return s + e.ejec }, 0);
  var totalPct = totalPlan > 0 ? Math.round(totalEjec / totalPlan * 100) : null;

  $('s-avance').innerHTML =
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,15 8,10 11,13 17,4"/><polyline points="12,4 17,4 17,9"/></svg> Avance Mensual</div>' +
    '<div class="sec-s">Plan vs Ejecución · Día ' + diaActual + ' de ' + diasMes + ' (' + pctEsperado + '% del mes)</div></div></div>' +
    '<div class="toolbar"><select id="fAvanceMes" onchange="renders.avance()">' +
    meses.map(function (m) { return '<option' + (fMes === m ? ' selected' : '') + '>' + m + '</option>' }).join('') + '</select></div>' +

    // Progress bar general
    '<div style="background:var(--bg3);border-radius:10px;padding:16px;margin-bottom:16px">' +
    '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:12px;font-weight:700">Avance Flota</span><span style="font-size:20px;font-weight:800;color:' + (totalPct === null ? 'var(--tx3)' : totalPct >= pctEsperado ? 'var(--ok)' : 'var(--danger)') + '">' + (totalPct === null ? '—' : totalPct + '%') + '</span></div>' +
    '<div style="position:relative;background:color-mix(in srgb,' + (totalPct === null ? 'var(--tx3)' : totalPct >= pctEsperado ? 'var(--ok)' : 'var(--danger)') + ' 18%,var(--bg4));border-radius:8px;height:20px;overflow:hidden">' +
    '<div style="position:absolute;left:' + pctEsperado + '%;top:0;bottom:0;width:2px;background:var(--tx3);z-index:2"></div>' +
    '<div style="background:' + (totalPct === null ? 'var(--tx3)' : totalPct >= pctEsperado ? 'var(--ok)' : 'var(--danger)') + ';height:100%;width:' + Math.min(totalPct || 0, 100) + '%;border-radius:8px;transition:width .3s"></div></div>' +
    '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--tx3);margin-top:4px"><span>' + totalEjec + ' de ' + totalPlan + ' PMs</span><span>Esperado: ' + pctEsperado + '%</span></div></div>' +

    '<div class="tbl-wrap"><table>' +
    '<tr><th>Equipo</th><th>Tipo</th><th>PM Plan</th><th>PM Ejec</th><th>%Avance</th><th>Barra</th><th>%Esperado</th><th>Diferencia</th><th>Estado</th></tr>' +
    eqAvance.map(function (e, i) {
      var sinPlan = e.pct === null;
      var col = sinPlan ? 'var(--tx3)' : e.pct >= e.esp ? 'var(--ok)' : e.pct >= e.esp * 0.7 ? 'var(--w)' : 'var(--danger)';
      return '<tr>' +
        '<td class="mono" style="color:var(--ac)">' + escapeHtml(e.sigla) + '</td>' +
        '<td style="font-size:11px">' + escapeHtml(e.tipo) + '</td>' +
        '<td class="ed mono" contenteditable onblur="var a=S.g(\'avanceData\')||{};if(!a[\'' + escapeHtml(e.sigla) + '\'])a[\'' + escapeHtml(e.sigla) + '\']={}; a[\'' + escapeHtml(e.sigla) + '\'][\'' + fMes + '\']=parseInt(this.innerText)||0;S.s(\'avanceData\',a);refreshAll()" style="color:var(--info);text-align:center">' + e.plan + '</td>' +
        '<td class="mono" style="text-align:center;font-weight:600">' + e.ejec + '</td>' +
        '<td class="mono" style="color:' + col + ';font-weight:700;text-align:center">' + (sinPlan ? '—' : e.pct + '%') + '</td>' +
        '<td><div style="position:relative;background:color-mix(in srgb,' + col + ' 18%,var(--bg4));border-radius:4px;height:12px;width:100px;overflow:hidden"><div style="position:absolute;left:' + e.esp + '%;top:0;bottom:0;width:1px;background:var(--tx3)"></div><div style="background:' + col + ';height:100%;width:' + Math.min(e.pct || 0, 100) + '%"></div></div></td>' +
        '<td class="mono" style="text-align:center;color:var(--tx3)">' + e.esp + '%</td>' +
        '<td class="mono" style="text-align:center;color:' + col + ';font-weight:600">' + (sinPlan ? '—' : (e.diff >= 0 ? '+' : '') + e.diff + '%') + '</td>' +
        '<td style="font-size:10px">' + (sinPlan ? '⚪ SIN PLAN' : e.pct >= e.esp ? '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> EN PLAN' : e.pct >= e.esp * 0.7 ? '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> RIESGO' : '🔴 ATRASADO') + '</td></tr>';
    }).join('') +
    '<tr style="font-weight:700;background:var(--bg3)"><td colspan="2">TOTAL FLOTA</td>' +
    '<td style="text-align:center">' + totalPlan + '</td><td style="text-align:center">' + totalEjec + '</td>' +
    '<td style="text-align:center;color:' + (totalPct === null ? 'var(--tx3)' : totalPct >= pctEsperado ? 'var(--ok)' : 'var(--danger)') + '">' + (totalPct === null ? '—' : totalPct + '%') + '</td>' +
    '<td></td><td style="text-align:center">' + pctEsperado + '%</td>' +
    '<td style="text-align:center;color:' + (totalPct === null ? 'var(--tx3)' : totalPct >= pctEsperado ? 'var(--ok)' : 'var(--danger)') + '">' + (totalPct === null ? '—' : (totalPct - pctEsperado >= 0 ? '+' : '') + (totalPct - pctEsperado) + '%') + '</td>' +
    '<td>' + (totalPct === null ? '⚪ SIN PLAN' : totalPct >= pctEsperado ? '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> EN PLAN' : '🔴 ATRASADO') + '</td></tr>' +
    '</table></div>';
}

// Puente window/renders — ver nota en mov.js (primera tanda).
window.renderAvance = renderAvance;
renders.avance = renderAvance;
