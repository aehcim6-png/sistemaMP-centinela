// Pestaña Costos, HH y Confiabilidad (sub-pestaña de Costos & Stock) —
// extraída a su propio archivo (Fase 2 de modularización). Script plano
// (NO módulo ES), mismo scope global de siempre.
window.renderCos = function () {
  if (!$("s-cos")) return;
  var reg = S.g('reg') || [];
  var ot = S.g('ot') || [];
  var mov = S.g('mov') || [];
  var eq = S.g('eq') || [];
  var stk = S.g('stk') || [];
  var lub = S.g('lub') || [];
  var hh = S.g('hh') || 25000;
  var fVista = $('fCosVista')?.value || 'costos';

  // ═══ CALCULATE HH DATA ═══
  var hhTecnico = {}, hhEquipo = {}, hhMes = {};
  var hhPlanTotal = 0, hhRealTotal = 0;
  // HH planificada = duración típica real de ese PM (mediana por equipo+tipo,
  // flota como respaldo). Antes se sumaba p.hrs de las pautas, que es el
  // INTERVALO de cada tarea, no su duración — inflaba el plan por miles.
  var _hhPlanDe = hhPlanEstimator(reg);
  reg.forEach(function (r) {
    var durH = r.duracionH || 0;
    var tec = r.tecnico || 'Sin asignar';
    var eqS = r.equipo || '';
    var mes = (r.fechaEntrada || r.fechaEjec || '').slice(0, 7);
    // HH real
    if (!hhTecnico[tec]) hhTecnico[tec] = { real: 0, plan: 0, n: 0 };
    hhTecnico[tec].real += durH; hhTecnico[tec].n++;
    if (!hhEquipo[eqS]) hhEquipo[eqS] = { real: 0, plan: 0, n: 0 };
    hhEquipo[eqS].real += durH; hhEquipo[eqS].n++;
    if (mes) { if (!hhMes[mes]) hhMes[mes] = { real: 0, plan: 0, n: 0 }; hhMes[mes].real += durH; hhMes[mes].n++; }
    hhRealTotal += durH;
    var planHrs = _hhPlanDe(eqS, r.tipoPM || 'PM1');
    hhTecnico[tec].plan += planHrs;
    hhEquipo[eqS].plan += planHrs;
    if (mes) hhMes[mes].plan += planHrs;
    hhPlanTotal += planHrs;
  });

  // ═══ CALCULATE MTBF / MTTR ═══
  // Índice ot-por-sigla, construido UNA vez — antes cada equipo filtraba 'ot'
  // COMPLETO, y esto corre siempre (sin importar qué sub-pestaña de Costos & Stock
  // esté visible), O(equipos × correctivos) en cada apertura de esta pestaña.
  var otPorSiglaCos = {};
  ot.forEach(function (o) { if (o && o.sigla) (otPorSiglaCos[o.sigla] = otPorSiglaCos[o.sigla] || []).push(o); });
  // SLA de primera respuesta: horas entre 'fecha' (día reportado) y
  // 'primeraAtencionEn' (timestamp que ot.js marca la primera vez que la OT
  // deja de estar Pendiente). Solo existe para OT creadas/editadas desde que
  // se agregó este campo — OT antiguas devuelven null, no cero.
  function _slaRespuestaHoras(o) {
    if (!o.primeraAtencionEn || !o.fecha) return null;
    var reportado = new Date(o.fecha + 'T00:00:00').getTime();
    var atendido = new Date(o.primeraAtencionEn).getTime();
    if (isNaN(reportado) || isNaN(atendido)) return null;
    return Math.max(0, Math.round((atendido - reportado) / 3600000));
  }
  var mtbfEquipo = {};
  eq.forEach(function (e) {
    var fallas = (otPorSiglaCos[e.sigla] || []).filter(function (o) { return esFallaMTBF(o); });
    var reparaciones = fallas.filter(function (o) { return o.duracion && o.duracion !== '—'; });
    // MTTR = promedio duración reparaciones
    var totalRepH = 0;
    reparaciones.forEach(function (o) {
      var m = o.duracion.match(/(\d+)h/);
      if (m) totalRepH += parseInt(m[1]);
    });
    var mttr = reparaciones.length > 0 ? Math.round(totalRepH / reparaciones.length * 10) / 10 : 0;
    // MTBF real = horas entre fallas sucesivas, usando el horómetro registrado en
    // cada falla (no el horómetro actual del equipo, que infla el número con el
    // simple paso del tiempo sin que haya vuelto a fallar)
    var mtbf = C.mtbfReal(fallas.map(function (o) { return o.horom; }));
    var conSla = fallas.map(_slaRespuestaHoras).filter(function (h) { return h != null; });
    var sla = conSla.length ? Math.round(conSla.reduce(function (s, h) { return s + h; }, 0) / conSla.length) : null;
    mtbfEquipo[e.sigla] = { mtbf: mtbf, mttr: mttr, fallas: fallas.length, reparaciones: reparaciones.length, sla: sla, conSla: conSla.length };
  });

  // ═══ COST DATA ═══
  var meses = [...new Set(reg.map(function (r) { return (r.fechaEntrada || r.fechaEjec || '').slice(0, 7) }))].filter(function (m) { return m; }).sort().reverse();
  var costoMes = {};
  reg.forEach(function (r) {
    var mes = (r.fechaEntrada || r.fechaEjec || '').slice(0, 7); if (!mes) return;
    if (!costoMes[mes]) costoMes[mes] = { hh: 0, filtros: 0, lubricantes: 0, total: 0, pms: 0 };
    costoMes[mes].hh += (r.duracionH || 2) * hh; costoMes[mes].pms++;
  });
  mov.forEach(function (m) {
    if (!costoMes[m.mes]) costoMes[m.mes] = { hh: 0, filtros: 0, lubricantes: 0, total: 0, pms: 0 };
    if (m.tipo === 'Filtro') { var f = stk.find(function (s) { return s.descripcion === m.item || s.nParte === m.nParte; }); costoMes[m.mes].filtros += (m.cant || 0) * (f && f.precioUnit ? f.precioUnit : 0); }
    else { var l = lub.find(function (lb) { return lb.nombre === m.item; }); costoMes[m.mes].lubricantes += (m.cant || 0) * (l && l.precio ? l.precio : 0); }
  });
  Object.keys(costoMes).forEach(function (m) { costoMes[m].total = costoMes[m].hh + costoMes[m].filtros + costoMes[m].lubricantes; });
  var totalG = 0; Object.values(costoMes).forEach(function (c) { totalG += c.total; });
  var eficiencia = hhRealTotal > 0 ? Math.round(hhPlanTotal / hhRealTotal * 100) : null;

  // Presupuesto mensual (monto fijo, configurado en Configuración > Tarifas y
  // Metas) — comparado contra el gasto real ya calculado arriba por mes. Sin
  // presupuesto definido (0/vacío) se muestra "Sin definir" en vez de una
  // desviación sin sentido contra cero.
  var presupuestoMensual = (S.g('cfg') || {}).presupuestoMensual || 0;
  function desviacionPresupuesto(totalReal) {
    if (!presupuestoMensual) return null;
    return Math.round((totalReal - presupuestoMensual) / presupuestoMensual * 100);
  }
  var mesActual = meses[0] || '';
  var desvMesActual = mesActual ? desviacionPresupuesto(costoMes[mesActual].total) : null;

  var content = '';

  if (fVista === 'costos') {
    content =
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:14px">' +
      '<div class="card" style="border-left:3px solid var(--ac)"><div class="card-t">Total Acumulado</div><div style="font-size:20px;font-weight:700;color:var(--ac)">$' + Math.round(totalG).toLocaleString() + '</div></div>' +
      '<div class="card"><div class="card-t">HH Reales</div><div class="card-v">' + Math.round(hhRealTotal) + 'h</div><div class="card-s">' + reg.length + ' intervenciones</div></div>' +
      '<div class="card"><div class="card-t">HH Planificadas</div><div class="card-v">' + Math.round(hhPlanTotal) + 'h</div><div class="card-s" title="Mediana histórica de duración real por equipo+tipoPM (hhPlanEstimator, logic.js) — ya no usa el intervalo de las pautas, que sobreestimaba el plan">Mediana histórica</div></div>' +
      '<div class="card"><div class="card-t">Eficiencia HH</div><div class="card-v" style="color:' + (eficiencia === null ? 'var(--tx3)' : eficiencia >= 80 ? 'var(--ok)' : eficiencia >= 60 ? 'var(--w)' : 'var(--danger)') + '">' + (eficiencia === null ? '—' : eficiencia + '%') + '</div><div class="card-s">' + (eficiencia === null ? 'Sin datos' : 'Plan vs Real') + '</div></div>' +
      '<div class="card"><div class="card-t">Presupuesto vs Real (' + (mesActual || 'mes actual') + ')</div><div class="card-v" style="color:' + (desvMesActual === null ? 'var(--tx3)' : desvMesActual > 0 ? 'var(--danger)' : 'var(--ok)') + '">' + (desvMesActual === null ? '—' : (desvMesActual > 0 ? '+' : '') + desvMesActual + '%') + '</div><div class="card-s">' + (presupuestoMensual ? '$' + Math.round(presupuestoMensual).toLocaleString() + '/mes' : 'Sin definir (Configuración)') + '</div></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:14px">' +
      meses.slice(0, 6).map(function (m) { var c = costoMes[m]; return '<div class="card"><b>' + m + '</b> (' + c.pms + ' PMs)<br><span style="font-size:11px">HH: $' + Math.round(c.hh).toLocaleString() + '</span><br><span style="font-size:11px">Filtros: $' + Math.round(c.filtros).toLocaleString() + '</span><br><span style="font-size:11px">Lub: $' + Math.round(c.lubricantes).toLocaleString() + '</span><br><b style="color:var(--ac)">Total: $' + Math.round(c.total).toLocaleString() + '</b></div>'; }).join('') +
      '</div>' +
      '<div class="tbl-wrap"><table><tr><th>Mes</th><th>PMs</th><th>HH ($)</th><th>Filtros ($)</th><th>Lubricantes ($)</th><th>Total ($)</th><th>Desviación Presupuesto</th></tr>' +
      meses.map(function (m) {
        var c = costoMes[m]; var d = desviacionPresupuesto(c.total);
        var dTxt = d === null ? '<span style="color:var(--tx3)">—</span>' : '<b style="color:' + (d > 0 ? 'var(--danger)' : 'var(--ok)') + '">' + (d > 0 ? '+' : '') + d + '%</b>';
        return '<tr><td><b>' + m + '</b></td><td>' + c.pms + '</td><td>$' + Math.round(c.hh).toLocaleString() + '</td><td>$' + Math.round(c.filtros).toLocaleString() + '</td><td>$' + Math.round(c.lubricantes).toLocaleString() + '</td><td style="color:var(--ac);font-weight:700">$' + Math.round(c.total).toLocaleString() + '</td><td style="text-align:center">' + dTxt + '</td></tr>';
      }).join('') +
      '</table></div>';

  } else if (fVista === 'hh') {
    // HH POR TÉCNICO
    var tecList = Object.entries(hhTecnico).sort(function (a, b) { return b[1].real - a[1].real; });
    var eqList = Object.entries(hhEquipo).sort(function (a, b) { return b[1].real - a[1].real; });
    content =
      '<div class="cards">' +
      '<div class="card"><div class="card-t">HH Real Total</div><div class="card-v">' + Math.round(hhRealTotal) + 'h</div></div>' +
      '<div class="card"><div class="card-t">HH Plan Total</div><div class="card-v">' + Math.round(hhPlanTotal) + 'h</div></div>' +
      '<div class="card"><div class="card-t">Eficiencia</div><div class="card-v" style="color:' + (eficiencia === null ? 'var(--tx3)' : eficiencia >= 80 ? 'var(--ok)' : 'var(--w)') + '">' + (eficiencia === null ? '—' : eficiencia + '%') + '</div><div class="card-s">' + (eficiencia === null ? 'Sin datos' : eficiencia > 100 ? 'Tardó más que lo planificado' : 'Más rápido que lo planificado') + '</div></div>' +
      '<div class="card"><div class="card-t">Intervenciones</div><div class="card-v">' + reg.length + '</div></div>' +
      '</div>' +

      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">' +
      '<div class="chart-box"><div class="chart-t"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11 A6 6 0 0 1 16 11" fill="none"/><line x1="2" y1="11" x2="18" y2="11"/><line x1="10" y1="5" x2="10" y2="3"/></svg> HH por Técnico</div>' +
      '<div class="tbl-wrap"><table><tr><th>Técnico</th><th>HH Real</th><th>HH Plan</th><th>Eficiencia</th><th>Intervenciones</th></tr>' +
      tecList.map(function (t) {
        var ef = t[1].real > 0 ? Math.round(t[1].plan / t[1].real * 100) : 0;
        return '<tr><td style="font-size:11px">' + escapeHtml(t[0]) + '</td><td style="text-align:center;font-weight:600">' + Math.round(t[1].real) + 'h</td><td style="text-align:center">' + Math.round(t[1].plan) + 'h</td><td style="text-align:center;color:' + (ef >= 80 ? 'var(--ok)' : 'var(--w)') + '">' + ef + '%</td><td style="text-align:center">' + t[1].n + '</td></tr>';
      }).join('') +
      '</table></div></div>' +

      '<div class="chart-box"><div class="chart-t"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="4" width="6" height="6"/><line x1="9" y1="10" x2="4" y2="10"/><line x1="4" y1="10" x2="4" y2="13"/><circle cx="5.5" cy="15" r="2.5"/><circle cx="14" cy="15" r="3.5"/><line x1="15" y1="10" x2="15" y2="4"/></svg> HH por Equipo</div>' +
      '<div class="tbl-wrap"><table><tr><th>Equipo</th><th>HH Real</th><th>HH Plan</th><th>Eficiencia</th><th>PMs</th></tr>' +
      eqList.slice(0, 20).map(function (e) {
        var ef = e[1].real > 0 ? Math.round(e[1].plan / e[1].real * 100) : 0;
        return '<tr><td class="mono" style="color:var(--ac)">' + e[0] + '</td><td style="text-align:center;font-weight:600">' + Math.round(e[1].real) + 'h</td><td style="text-align:center">' + Math.round(e[1].plan) + 'h</td><td style="text-align:center;color:' + (ef >= 80 ? 'var(--ok)' : 'var(--w)') + '">' + ef + '%</td><td style="text-align:center">' + e[1].n + '</td></tr>';
      }).join('') +
      '</table></div></div></div>';

  } else if (fVista === 'mtbf') {
    // MTBF / MTTR
    var mtbfList = Object.entries(mtbfEquipo).sort(function (a, b) {
      if (a[1].mtbf == null && b[1].mtbf == null) return 0;
      if (a[1].mtbf == null) return 1;
      if (b[1].mtbf == null) return -1;
      return a[1].mtbf - b[1].mtbf;
    });
    var conMtbf = mtbfList.filter(function (m) { return m[1].mtbf != null; });
    content =
      '<div class="cards">' +
      '<div class="card"><div class="card-t">MTBF Promedio Flota</div><div class="card-v">' + (conMtbf.length ? Math.round(conMtbf.reduce(function (s, m) { return s + m[1].mtbf; }, 0) / conMtbf.length) + 'h' : '—') + '</div><div class="card-s">' + (conMtbf.length ? 'Tiempo medio entre fallas · ' + conMtbf.length + ' equipos con ≥2 fallas' : 'Ningún equipo con ≥2 fallas registradas') + '</div></div>' +
      '<div class="card"><div class="card-t">MTTR Promedio</div><div class="card-v">' + (function () { var conRep = mtbfList.filter(function (m) { return m[1].mttr > 0; }); return conRep.length ? (Math.round(conRep.reduce(function (s, m) { return s + m[1].mttr; }, 0) / conRep.length * 10) / 10 + 'h') : '—'; })() + '</div><div class="card-s">Tiempo medio de reparación</div></div>' +
      '<div class="card"><div class="card-t">Total Fallas</div><div class="card-v" style="color:var(--danger)">' + mtbfList.reduce(function (s, m) { return s + m[1].fallas; }, 0) + '</div></div>' +
      (function () {
        var conSla = mtbfList.filter(function (m) { return m[1].sla != null; });
        var totalConSla = mtbfList.reduce(function (s, m) { return s + m[1].conSla; }, 0);
        var prom = conSla.length ? Math.round(conSla.reduce(function (s, m) { return s + m[1].sla; }, 0) / conSla.length) : null;
        return '<div class="card"><div class="card-t">SLA 1ra Respuesta</div><div class="card-v" style="color:' + (prom == null ? 'var(--tx3)' : prom <= 4 ? 'var(--ok)' : prom <= 24 ? 'var(--w)' : 'var(--danger)') + '">' + (prom == null ? '—' : prom + 'h') + '</div><div class="card-s">' + (totalConSla ? totalConSla + ' correctivo(s) con dato' : 'Se captura desde ahora en adelante') + '</div></div>';
      })() +
      '</div>' +

      '<div style="padding:10px;background:var(--bg3);border-radius:6px;margin-bottom:12px;font-size:12px">' +
      '<b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> MTBF</b> = Horas entre fallas sucesivas, según el horómetro registrado en cada falla (necesita ≥2 fallas) → mientras MÁS alto, MEJOR (equipo más confiable)<br>' +
      '<b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> MTTR</b> = Promedio duración reparaciones → mientras MÁS bajo, MEJOR (reparaciones más rápidas)<br>' +
      '<b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> SLA 1ra Respuesta</b> = Horas entre que se reportó la falla y que alguien la atendió por primera vez (no el cierre) → mientras MÁS bajo, MEJOR. Solo cuenta correctivos registrados desde que se agregó esta medición.</div>' +

      '<div class="tbl-wrap"><table>' +
      '<tr><th>Equipo</th><th>Modelo</th><th>Horómetro</th><th>Fallas</th><th>MTBF (hrs)</th><th>Confiabilidad</th><th>Reparaciones</th><th>MTTR (hrs)</th><th>Mantenibilidad</th><th>SLA 1ra Resp. (hrs)</th></tr>' +
      mtbfList.map(function (m) {
        var e = eq.find(function (x) { return x.sigla === m[0]; });
        var mb = m[1].mtbf;
        var mtbfCol = mb == null ? 'var(--tx3)' : mb > 2000 ? 'var(--ok)' : mb > 500 ? 'var(--w)' : 'var(--danger)';
        var mttrCol = m[1].mttr === 0 ? 'var(--tx3)' : m[1].mttr < 4 ? 'var(--ok)' : m[1].mttr < 8 ? 'var(--w)' : 'var(--danger)';
        var slaCol = m[1].sla == null ? 'var(--tx3)' : m[1].sla <= 4 ? 'var(--ok)' : m[1].sla <= 24 ? 'var(--w)' : 'var(--danger)';
        return '<tr>' +
          '<td class="mono" style="color:var(--ac)">' + m[0] + '</td>' +
          '<td style="font-size:11px">' + (e ? escapeHtml(e.modelo) : '') + '</td>' +
          '<td style="text-align:center">' + (e ? e.horomActual : 0) + '</td>' +
          '<td style="text-align:center;color:var(--danger);font-weight:600">' + m[1].fallas + '</td>' +
          '<td style="text-align:center;font-weight:700;color:' + mtbfCol + '">' + (mb == null ? '—' : mb) + '</td>' +
          '<td style="text-align:center"><span style="font-size:11px;color:' + mtbfCol + '">' + (mb == null ? 'Datos insuf. (' + m[1].fallas + ' falla' + (m[1].fallas === 1 ? '' : 's') + ')' : mb > 2000 ? '🟢 Alta' : mb > 500 ? '🟡 Media' : '🔴 Baja') + '</span></td>' +
          '<td style="text-align:center">' + m[1].reparaciones + '</td>' +
          '<td style="text-align:center;font-weight:700;color:' + mttrCol + '">' + m[1].mttr + '</td>' +
          '<td style="text-align:center"><span style="font-size:11px;color:' + mttrCol + '">' + (m[1].mttr === 0 ? '— Sin datos' : m[1].mttr < 4 ? '🟢 Rápido' : m[1].mttr < 8 ? '🟡 Normal' : '🔴 Lento') + '</span></td>' +
          '<td style="text-align:center;font-weight:700;color:' + slaCol + '">' + (m[1].sla == null ? '—' : m[1].sla) + '</td></tr>';
      }).join('') +
      '</table></div>';
  }

  $('s-cos').innerHTML =
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="8"/><text x="10" y="14" font-size="9" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">$</text></svg> Costos, HH y Confiabilidad</div>' +
    '<div class="sec-s">Desde registros PM + consumos · HH: $' + hh.toLocaleString() + '/hr</div></div></div>' +
    '<div class="toolbar">' +
    '<select id="fCosVista" onchange="renders.cos()" style="font-weight:600">' +
    '<option value="costos"' + (fVista === 'costos' ? ' selected' : '') + '><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="8"/><text x="10" y="14" font-size="9" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">$</text></svg> Costos por Mes</option>' +
    '<option value="hh"' + (fVista === 'hh' ? ' selected' : '') + '><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11 A6 6 0 0 1 16 11" fill="none"/><line x1="2" y1="11" x2="18" y2="11"/><line x1="10" y1="5" x2="10" y2="3"/></svg> HH por Técnico / Equipo</option>' +
    '<option value="mtbf"' + (fVista === 'mtbf' ? ' selected' : '') + '><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> MTBF / MTTR</option></select></div>' +
    content;
}
