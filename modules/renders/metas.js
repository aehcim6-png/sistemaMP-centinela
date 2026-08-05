// Pestaña Metas vs Realidad (sub-pestaña de Metas & KPIs) — extraída a su
// propio archivo (Fase 2 de modularización). Script plano (NO módulo ES),
// mismo scope global de siempre.
window.renderMetas = function () {
  if (!$("s-metas")) return;
  var eq = S.g('eq') || []; var reg = S.g('reg') || []; var ot = S.g('ot') || [];
  var stkM = S.g('stk') || []; var lubM = S.g('lub') || []; var movM = S.g('mov') || []; var tarifaHH = S.g('hh') || 25000;
  var metas = S.g('metas') || {};
  var MSN = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  var indicators = [
    { id: 'disp', name: 'Disponibilidad %', meta: 85, unit: '%', higher: true },
    { id: 'pms', name: 'PMs a Ejecutar', meta: 30, unit: '', higher: true },
    { id: 'cumpl', name: 'Cumplimiento PM %', meta: 90, unit: '%', higher: true },
    { id: 'gasto', name: 'Gasto Máx. HH+Repuestos ($)', meta: 5000000, unit: '$', higher: false },
    { id: 'hh', name: 'HH Máximas', meta: 200, unit: 'h', higher: false },
    { id: 'ratio', name: 'Ratio Preventivo %', meta: 80, unit: '%', higher: true },
    { id: 'mtbf', name: 'MTBF Mínimo (hrs)', meta: 2000, unit: 'h', higher: true },
    { id: 'backlog', name: 'OT Pendientes Máx', meta: 5, unit: '', higher: false }
  ];
  // Auto-calculate REAL values per month
  var realData = {};
  var anioMetas = new Date().getFullYear();
  var dispCalcMetas = S.g('dispCalc') || {};
  // Disponibilidad con la MISMA fuente única que las otras pestañas (ver dispEquipoMes en
  // logic.js): override manual > abril > cálculo automático. Antes Metas usaba SOLO los
  // overrides manuales, así que su disponibilidad no coincidía con Disponibilidad ni KPI.
  var downMapMetas = dispDownMap(reg, ot);
  var dAbrMetas = INIT.dispAbril || {};
  MSN.forEach(function (m, mi) {
    var mes = anioMetas + '-' + ('0' + (mi + 1)).slice(-2);
    var regM = reg.filter(function (r) { return (r.fechaEntrada || r.fechaEjec || '').slice(0, 7) === mes });
    var prev = regM.filter(function (r) { return r.tipoPM !== 'Correctivo' }).length;
    var dispValsM = eq.map(function (e) { return dispEquipoMes(e.sigla, mes, { downMap: downMapMetas, dispCalc: dispCalcMetas, dAbr: dAbrMetas, hrsDia: e.hrsDia || 12 }); }).filter(function (v) { return v !== null && v !== undefined });
    var hhMes = Math.round(regM.reduce(function (s, r) { return s + (r.duracionH || 0) }, 0));
    // Gasto REAL del mes = mano de obra (HH×tarifa) + repuestos/materiales consumidos.
    // Antes el "gasto" era solo HH×tarifa: ignoraba los repuestos, que suelen ser el
    // grueso del costo — un mes con poca mano de obra pero un repuesto caro se veía
    // "dentro de meta" cuando en realidad se gastó una fortuna.
    var costoRepM = 0;
    movM.filter(function (mv) { return mv.mes === mes; }).forEach(function (mv) {
      if (mv.tipo === 'Filtro') { var f = stkM.find(function (s) { return s.descripcion === mv.item || s.nParte === mv.nParte; }); costoRepM += (mv.cant || 0) * ((f && f.precioUnit) || 0); }
      else { var l = lubM.find(function (lb) { return lb.nombre === mv.item; }); costoRepM += (mv.cant || 0) * ((l && l.precio) || 0); }
    });
    // Backlog histórico: OT que estaban ABIERTAS al cierre de ese mes (se abrieron
    // antes de fin de mes y todavía no se habían cerrado). Antes se mostraba el conteo
    // de pendientes de HOY en los 12 meses por igual — un histórico falso.
    var finMes = mes + '-' + ('0' + new Date(anioMetas, mi + 1, 0).getDate()).slice(-2);
    var backlogMes = ot.filter(function (o) {
      var abierto = (o.fechaEntrada || o.fecha || o.fechaIngreso || '').slice(0, 10);
      if (!abierto || abierto > finMes) return false;
      var cerrado = (o.fechaSalida || '').slice(0, 10);
      if (cerrado) return cerrado > finMes;
      return o.estadoOT === 'Pendiente' || o.estadoOT === 'En Ejecución';
    }).length;
    realData[m] = {
      disp: dispValsM.length ? Math.round(dispValsM.reduce(function (s, v) { return s + v }, 0) / dispValsM.length * 10) / 10 : null,
      pms: regM.length,
      hh: hhMes,
      gasto: (regM.length || costoRepM) ? Math.round(hhMes * tarifaHH + costoRepM) : null,
      cumpl: regM.length ? Math.round(regM.filter(function (r) { return r.estado === 'A tiempo' }).length / regM.length * 100) : null,
      ratio: regM.length ? Math.round(prev / regM.length * 100) : null,
      backlog: backlogMes
    };
  });

  $('s-metas').innerHTML =
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="4.5"/><circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none"/></svg> Metas vs Realidad</div>' +
    '<div class="sec-s">Meta editable · Real se calcula automático desde registros</div></div></div>' +
    '<div class="tbl-wrap" style="overflow-x:auto"><table style="font-size:11px">' +
    '<tr><th rowspan="2" style="min-width:140px">Indicador</th><th rowspan="2">Meta Anual</th>' +
    MSN.map(function (m) { return '<th colspan="2" style="text-align:center;min-width:80px">' + m + '</th>' }).join('') + '</tr>' +
    '<tr>' + MSN.map(function () { return '<th style="color:#3b82f6;font-size:9px">META</th><th style="color:#22c55e;font-size:9px">REAL</th>' }).join('') + '</tr>' +
    indicators.map(function (ind) {
      if (!metas[ind.id]) metas[ind.id] = { metaAnual: ind.meta, meses: {} };
      var data = metas[ind.id];
      return '<tr><td style="font-weight:600">' + ind.name + '</td>' +
        '<td class="ed" style="color:#3b82f6;text-align:center;font-weight:700" contenteditable onblur="var m=S.g(\'metas\')||{};if(!m[\'' + ind.id + '\'])m[\'' + ind.id + '\']={}; m[\'' + ind.id + '\'].metaAnual=parseFloat(this.innerText)||0;S.s(\'metas\',m)">' + ind.meta + '</td>' +
        MSN.map(function (mes, mi) {
          var metaM = data.meses && data.meses[mes] ? data.meses[mes].meta : ind.meta;
          var real = realData[mes] ? realData[mes][ind.id] : null;
          if (real === undefined) real = null;
          if (ind.id === 'gasto') real = realData[mes] ? realData[mes].gasto : null; // HH + repuestos, no solo HH
          // MTBF mensual = horas de flota ÷ fallas del mes. Un mes SIN fallas ya no
          // devuelve las horas completas (número absurdo que siempre gana la meta): queda
          // "sin dato", porque no hubo intervalo entre fallas que medir ese mes.
          if (ind.id === 'mtbf') { var fM = ot.filter(function (o) { return (o.fecha || '').slice(0, 7) === anioMetas + '-' + ('0' + (mi + 1)).slice(-2) && (o.tipo === 'Correctivo' || o.tipo === 'Falla Operacional') }).length; var hM = eq.reduce(function (s, e) { return e.unidad === 'km' ? s : s + (e.hrsDia || 12) * 30 }, 0); real = fM > 0 ? Math.round(hM / fM) : null; }
          var sinDato = real === null;
          var ok = sinDato ? null : (ind.higher ? (real >= metaM) : (real <= metaM));
          var col = sinDato ? 'var(--tx3)' : ok ? '#22c55e' : '#ef4444';
          return '<td class="ed" style="color:#3b82f6;text-align:center;font-size:10px" contenteditable onblur="var m=S.g(\'metas\')||{};if(!m[\'' + ind.id + '\'])m[\'' + ind.id + '\']={}; if(!m[\'' + ind.id + '\'].meses)m[\'' + ind.id + '\'].meses={}; if(!m[\'' + ind.id + '\'].meses[\'' + mes + '\'])m[\'' + ind.id + '\'].meses[\'' + mes + '\']={}; m[\'' + ind.id + '\'].meses[\'' + mes + '\'].meta=parseFloat(this.innerText)||0;S.s(\'metas\',m)">' + metaM + '</td>' +
            '<td style="text-align:center;font-weight:600;color:' + col + ';font-size:10px">' + (sinDato ? '—' : real) + '</td>';
        }).join('') + '</tr>';
    }).join('') +
    '</table></div>';
  S.s('metas', metas);
};
