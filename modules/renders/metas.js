// Pestaña Metas vs Realidad (sub-pestaña de Metas & KPIs) — extraída a su
// propio archivo (Fase 2 de modularización). Módulo ES real (Fase 3,
// 2026-08-30, cuarta tanda: Metas, KPIs y Reportes) — ver nota de
// migración en mov.js (primera tanda, mismo patrón).
export function renderMetas() {
  if (!$("s-metas")) return;
  var eq = S.g('eq') || []; var reg = S.g('reg') || []; var ot = S.g('ot') || []; var otHist = S.g('otHist') || [];
  var otConHist = ot.concat(_otHistComoOt(otHist));
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
  // Nivel 2 de "conectar los números" (control de gestión): mapa de dependencias
  // declarado a mano — qué indicador es causa CONOCIDA de cuál, según su propia
  // fórmula (ratio/mtbf se calculan directo desde correctivosDelMes; gasto desde hh)
  // o la relación operativa evidente (correctivos compiten por horas de taller, así
  // que empujan pms/disp/backlog). No es un motor que infiera causalidad de los
  // datos — es la misma cadena que ya describen los comentarios de este archivo,
  // ahora usada para comparar cada causa contra el mes anterior (ver el render).
  // cumpl no tiene causa declarada entre estos 8: no depende de ninguno de ellos.
  var DEP_MAP = {
    ratio: [{ id: 'correctivosDelMes', label: 'Correctivos del mes' }],
    mtbf: [{ id: 'correctivosDelMes', label: 'Correctivos del mes' }],
    pms: [{ id: 'correctivosDelMes', label: 'Correctivos del mes' }],
    disp: [{ id: 'correctivosDelMes', label: 'Correctivos del mes' }, { id: 'backlog', label: 'OT pendientes' }],
    hh: [{ id: 'pms', label: 'PM ejecutados' }],
    gasto: [{ id: 'hh', label: 'HH del mes' }],
    backlog: [{ id: 'correctivosDelMes', label: 'Correctivos del mes' }]
  };
  var metasAntes = JSON.stringify(metas);
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
    // regEsATiempo (logic.js): fuente única — antes r.estado==='A tiempo' nunca
    // coincidía con el dato real guardado (bug real, auditoría 2026-08).
    var regMev = regM.filter(function (r) { return regEsATiempo(r) !== null; });
    // Bug real (auditoría 2026-08): 'registros_pm' (reg) NUNCA tiene tipoPM='Correctivo'
    // en toda su historia — los correctivos viven en una tabla aparte ('correctivos'/ot),
    // que este cálculo nunca miraba. Resultado: "Ratio Preventivo" daba 100% en los 20
    // meses completos verificados (ene-2025 a ago-2026), incluso en meses con 100+
    // correctivos reales (ej. feb-2025: 117). Ahora el denominador es preventivos+
    // correctivos reales del mes (esFallaMTBF, misma fuente única que MTBF/Confiabilidad),
    // no solo los PM — así el ratio SÍ baja cuando hay mucha reactividad.
    var prev = regM.length;
    // contarFallasMes (logic.js, auditoría 2026-08-18): fuente única de "correctivos
    // reales del mes" (ot+otHist), compartida ahora con kpi.js y dash.js — antes cada
    // uno tenía su propia copia y terminaron desincronizados entre sí. Se SUMAN ambas
    // fuentes a pedido explícito del usuario tras revisar el trade-off: para meses con
    // buena cobertura en vivo (ej. marzo-2026: 51 en 'ot') esto puede sobre-contar si la
    // misma falla quedó también en el histórico un día distinto (no hay deduplicación
    // entre fuentes más allá de la que ya se hizo al cargar el histórico, por sigla+día
    // exacto) — se acepta ese riesgo a cambio de que los meses vacíos en 'ot' (como
    // agosto) dejen de mostrar un Ratio Preventivo 100% falso por falta de dato.
    var correctivosDelMes = contarFallasMes(otConHist, mes);
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
    // Se agrupa por equipo (backlogPorEq) para poder decir, además del total, cuál
    // equipo concentra más pendientes ese mes (usado más abajo en "motivos").
    var finMes = mes + '-' + ('0' + new Date(anioMetas, mi + 1, 0).getDate()).slice(-2);
    var backlogPorEq = {};
    ot.forEach(function (o) {
      var abierto = (o.fechaEntrada || o.fecha || o.fechaIngreso || '').slice(0, 10);
      if (!abierto || abierto > finMes) return;
      var cerrado = (o.fechaSalida || '').slice(0, 10);
      var siguePendiente = cerrado ? cerrado > finMes : (o.estadoOT === 'Pendiente' || o.estadoOT === 'En Ejecución');
      if (!siguePendiente) return;
      backlogPorEq[o.sigla] = (backlogPorEq[o.sigla] || 0) + 1;
    });
    var backlogMes = Object.values(backlogPorEq).reduce(function (s, n) { return s + n }, 0);
    var peorEqBacklog = Object.keys(backlogPorEq).sort(function (a, b) { return backlogPorEq[b] - backlogPorEq[a] })[0];
    // Motivo probable de cada indicador — Nivel 1 de "conectar los números": no es un
    // motor causal, solo muestra en el propio indicador el dato que ya se calculó acá
    // mismo y que normalmente explica por qué se movió (ej. MTBF cae junto con
    // correctivosDelMes, porque es su propio denominador). Se ve como tooltip solo en
    // las celdas rojas (real fuera de meta) — ver más abajo, en el render.
    var atrasadosM = regMev.length - regMev.filter(function (r) { return regEsATiempo(r) === true }).length;
    var motivos = {
      disp: correctivosDelMes + ' correctivo(s) y ' + backlogMes + ' OT pendiente(s) ese mes',
      pms: correctivosDelMes + ' correctivo(s) atendidos ese mes (compiten por las mismas horas de taller)',
      cumpl: regMev.length ? (atrasadosM + ' de ' + regMev.length + ' PM evaluables llegaron atrasados') : 'sin PM evaluables ese mes',
      gasto: '$' + fn(Math.round(hhMes * tarifaHH)) + ' en HH + $' + fn(Math.round(costoRepM)) + ' en repuestos',
      hh: prev + ' PM ejecutados' + (prev ? ' (' + Math.round(hhMes / prev * 10) / 10 + 'h promedio c/u)' : ''),
      ratio: correctivosDelMes + ' correctivo(s) vs ' + prev + ' preventivo(s) ese mes',
      mtbf: correctivosDelMes + ' falla(s) registrada(s) ese mes',
      backlog: peorEqBacklog ? (backlogPorEq[peorEqBacklog] + ' de ' + backlogMes + ' pendiente(s) son de ' + peorEqBacklog) : ''
    };
    realData[m] = {
      disp: dispValsM.length ? Math.round(dispValsM.reduce(function (s, v) { return s + v }, 0) / dispValsM.length * 10) / 10 : null,
      pms: regM.length,
      hh: hhMes,
      gasto: (regM.length || costoRepM) ? Math.round(hhMes * tarifaHH + costoRepM) : null,
      cumpl: regMev.length ? Math.round(regMev.filter(function (r) { return regEsATiempo(r) === true }).length / regMev.length * 100) : null,
      ratio: ratioPreventivo(prev, correctivosDelMes),
      correctivosDelMes: correctivosDelMes,
      backlog: backlogMes,
      motivos: motivos
    };
  });

  // Nivel 3 ("Cadena de Causas"): verCadenaCausas() necesita este mismo snapshot
  // (realData/DEP_MAP/indicators/MSN) recién calculado — se guarda acá en vez de
  // recalcularlo de nuevo al abrir el modal, para que muestre exactamente lo que
  // la persona está viendo en la tabla en ese momento, no un recálculo aparte.
  // Nivel 4 ("anticipar"): alertas de TENDENCIA — a diferencia de los Niveles 1-3
  // (que solo explican una celda YA roja), esto avisa aunque el indicador todavía
  // esté en verde, si viene empeorando 3+ meses seguidos. No es un modelo
  // estadístico ni predice un mes exacto: es una racha simple (cada mes igual o
  // peor que el anterior, con al menos un cambio real), la misma idea que "lleva
  // 3 meses cayendo" que cualquiera vería mirando la fila completa — solo que acá
  // se calcula y se muestra antes de que la persona tenga que notarlo sola.
  // Limitación conocida: solo mira dentro del año calendario en curso (MSN es
  // ENE-DIC de anioMetas) — en enero/febrero puede no alcanzar a ver una racha
  // que ya venía de diciembre del año anterior.
  var hMFlota = eq.reduce(function (s, e) { return e.unidad === 'km' ? s : s + (e.hrsDia || 12) * 30 }, 0);
  function valorIndicador(id, mes) {
    if (!realData[mes]) return null;
    if (id === 'mtbf') { var fM = realData[mes].correctivosDelMes; return fM > 0 ? Math.round(hMFlota / fM) : null; }
    var v = realData[mes][id];
    return v === undefined ? null : v;
  }
  var mesActualIdx = new Date().getMonth(); // 0=ENE, coincide con el índice de MSN
  // Nivel 3 ("Cadena de Causas") y abrirFormCompromiso() necesitan este mismo
  // snapshot recién calculado — se guarda acá (ya con hMFlota, para que el chequeo
  // especial de MTBF de abajo también pueda usarse fuera de esta función) en vez
  // de recalcularlo de nuevo al abrir el modal, para que muestre exactamente lo
  // que la persona está viendo en la tabla en ese momento.
  window._metasCadena = { realData: realData, DEP_MAP: DEP_MAP, indicators: indicators, MSN: MSN, hMFlota: hMFlota };
  function serieReciente(id, maxLen) {
    var i = mesActualIdx;
    while (i >= 0 && valorIndicador(id, MSN[i]) == null) i--; // ancla en el último mes CON dato
    var serie = [];
    for (; i >= 0 && serie.length < maxLen; i--) {
      var v = valorIndicador(id, MSN[i]);
      if (v == null) break;
      serie.unshift(v);
    }
    return serie;
  }
  // higherIsBetter=true → empeora si BAJA; false → empeora si SUBE. Exige al menos
  // un cambio real (una racha de puros empates no cuenta como "tendencia").
  function siempreEmpeora(serie, higherIsBetter) {
    if (serie.length < 3) return false;
    var huboCambio = false;
    for (var i = 1; i < serie.length; i++) {
      var mejora = higherIsBetter ? serie[i] > serie[i - 1] : serie[i] < serie[i - 1];
      if (mejora) return false;
      if (serie[i] !== serie[i - 1]) huboCambio = true;
    }
    return huboCambio;
  }
  var alertasTendencia = [];
  indicators.forEach(function (ind) {
    var serie = serieReciente(ind.id, 4);
    if (!siempreEmpeora(serie, ind.higher)) return;
    // Causas declaradas (DEP_MAP) que vienen subiendo en el mismo tramo — todas las
    // causas actuales de este archivo empeoran cuando SUBEN (correctivos, backlog,
    // pms, hh como causa de otro), así que se compara con higherIsBetter=false.
    var deps = DEP_MAP[ind.id] || [];
    var causasEnRacha = deps.filter(function (dep) {
      var s2 = serieReciente(dep.id, serie.length);
      return s2.length === serie.length && siempreEmpeora(s2, false);
    });
    alertasTendencia.push(ind.name + ' lleva ' + (serie.length - 1) + ' mes(es) seguidos empeorando: ' + serie.join(' → ') +
      (causasEnRacha.length ? ' — junto con ' + causasEnRacha.map(function (d) { return d.label }).join(' y ') + ', que también viene subiendo' : '') + '.');
  });
  var tendenciaHtml = alertasTendencia.length ?
    '<div style="background:rgba(239,68,68,.06);border:1px solid var(--danger);border-radius:8px;padding:12px 16px;margin-bottom:14px">' +
    '<b style="color:var(--danger);font-size:12px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> Tendencia — antes de que se ponga roja</b>' +
    '<div style="font-size:10px;color:var(--tx3);margin:2px 0 6px">Viene empeorando 3+ meses seguidos, esté o no dentro de meta todavía.</div>' +
    '<ul style="margin:0;padding-left:18px;font-size:11px;color:var(--tx2)">' +
    alertasTendencia.map(function (t) { return '<li style="margin-bottom:4px">' + escapeHtml(t) + '</li>'; }).join('') +
    '</ul></div>' : '';

  // Compromisos (loop de responsabilidad): evalúa solos los pendientes contra el
  // ÚLTIMO mes con dato real (no contra el mes en que se creó el compromiso otra
  // vez) — se marca "Cumplido" en cuanto el indicador mejora respecto a la línea
  // base guardada al crearlo (no hace falta que llegue a meta), y "Vencido" si ya
  // pasó la fecha comprometida y no mejoró. Nadie tiene que cerrar nada a mano.
  var compromisos = S.g('compromisos') || [];
  var compromisosAntes = JSON.stringify(compromisos);
  var hoyStr = new Date().toISOString().slice(0, 10);
  compromisos.forEach(function (c) {
    if (c.estado !== 'Pendiente' || c.valorBase == null) return;
    var ultimo = null;
    for (var i = mesActualIdx; i >= 0; i--) {
      var v = valorIndicador(c.indicadorId, MSN[i]);
      if (v != null) { ultimo = v; break; }
    }
    if (ultimo == null) return;
    var mejoro = c.higherEsMejor ? ultimo > c.valorBase : ultimo < c.valorBase;
    if (mejoro) { c.estado = 'Cumplido'; c.valorFinal = ultimo; c.fechaResolucion = hoyStr; }
    else if (c.fechaCompromiso && hoyStr > c.fechaCompromiso) { c.estado = 'Vencido'; c.valorFinal = ultimo; c.fechaResolucion = hoyStr; }
  });
  if (JSON.stringify(compromisos) !== compromisosAntes) S.s('compromisos', compromisos);

  var resueltos = compromisos.filter(function (c) { return c.estado === 'Cumplido' || c.estado === 'Vencido'; });
  var pctCumplidos = resueltos.length ? Math.round(resueltos.filter(function (c) { return c.estado === 'Cumplido'; }).length / resueltos.length * 100) : null;
  var ORDEN_ESTADO = { Pendiente: 0, Vencido: 1, Cumplido: 2 };
  var compromisosHtml = compromisos.length ?
    '<div style="margin-top:16px">' +
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">' +
    '<b style="font-size:12px">📝 Compromisos</b>' +
    (pctCumplidos != null ? '<span style="font-size:11px;color:var(--tx3)">' + pctCumplidos + '% cumplidos a tiempo (' + resueltos.length + ' resuelto(s))</span>' : '') +
    '</div>' +
    '<div class="tbl-wrap"><table style="font-size:11px">' +
    '<tr><th>Indicador</th><th>Acción</th><th>Responsable</th><th>Fecha compromiso</th><th>Base → Actual</th><th>Estado</th><th></th></tr>' +
    compromisos.slice().sort(function (a, b) { return (ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado]) || (a.fechaCompromiso || '').localeCompare(b.fechaCompromiso || ''); }).map(function (c) {
      // Índice en el arreglo SIN ordenar (mismo patrón que el resto del sistema,
      // ej. stk.js/pau.js) — no usa c._id porque ese campo solo lo asigna el
      // sync real con Supabase (S.s → _syncTablaGenericaInner), así que offline
      // o antes de la primera sincronización todavía no existe.
      var i = compromisos.indexOf(c);
      var colEst = c.estado === 'Cumplido' ? 'var(--ok)' : c.estado === 'Vencido' ? 'var(--danger)' : 'var(--tx3)';
      var icoEst = c.estado === 'Cumplido' ? '✅' : c.estado === 'Vencido' ? '🔴' : '⏳';
      return '<tr><td>' + escapeHtml(c.indicadorName || c.indicadorId) + '</td>' +
        '<td style="max-width:220px">' + escapeHtml(c.accion || '') + '</td>' +
        '<td>' + escapeHtml(c.responsable || '—') + '</td>' +
        '<td class="mono">' + (c.fechaCompromiso || '—') + '</td>' +
        '<td class="mono">' + (c.valorBase == null ? '—' : c.valorBase) + (c.valorFinal != null ? ' → ' + c.valorFinal : '') + '</td>' +
        '<td style="color:' + colEst + ';font-weight:600">' + icoEst + ' ' + c.estado + '</td>' +
        '<td><button class="btn-s btn-d" onclick="delCompromiso(' + i + ')" title="Eliminar"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg></button></td></tr>';
    }).join('') +
    '</table></div></div>' : '';

  $('s-metas').innerHTML = tendenciaHtml +
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="4.5"/><circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none"/></svg> Metas vs Realidad</div>' +
    '<div class="sec-s">Meta editable · Real se calcula automático desde registros</div></div></div>' +
    '<div class="tbl-wrap" style="overflow-x:auto"><table style="font-size:11px">' +
    '<tr><th rowspan="2" style="min-width:140px">Indicador</th><th rowspan="2">Meta Anual</th>' +
    MSN.map(function (m) { return '<th colspan="2" style="text-align:center;min-width:80px">' + m + '</th>' }).join('') + '</tr>' +
    '<tr>' + MSN.map(function () { return '<th style="color:var(--info);font-size:9px">META</th><th style="color:var(--ok);font-size:9px">REAL</th>' }).join('') + '</tr>' +
    indicators.map(function (ind) {
      if (!metas[ind.id]) metas[ind.id] = { metaAnual: ind.meta, meses: {} };
      var data = metas[ind.id];
      return '<tr><td style="font-weight:600">' + ind.name + '</td>' +
        '<td class="ed" style="color:var(--info);text-align:center;font-weight:700" contenteditable onblur="var m=S.g(\'metas\')||{};if(!m[\'' + ind.id + '\'])m[\'' + ind.id + '\']={}; m[\'' + ind.id + '\'].metaAnual=parseFloat(this.innerText)||0;S.s(\'metas\',m)">' + ind.meta + '</td>' +
        MSN.map(function (mes, mi) {
          var metaM = data.meses && data.meses[mes] ? data.meses[mes].meta : ind.meta;
          var real = realData[mes] ? realData[mes][ind.id] : null;
          if (real === undefined) real = null;
          if (ind.id === 'gasto') real = realData[mes] ? realData[mes].gasto : null; // HH + repuestos, no solo HH
          // MTBF mensual = horas de flota ÷ fallas del mes. Un mes SIN fallas ya no
          // devuelve las horas completas (número absurdo que siempre gana la meta): queda
          // "sin dato", porque no hubo intervalo entre fallas que medir ese mes.
          if (ind.id === 'mtbf') { var fM = realData[mes] ? realData[mes].correctivosDelMes : 0; var hM = eq.reduce(function (s, e) { return e.unidad === 'km' ? s : s + (e.hrsDia || 12) * 30 }, 0); real = fM > 0 ? Math.round(hM / fM) : null; }
          var sinDato = real === null;
          var ok = sinDato ? null : (ind.higher ? (real >= metaM) : (real <= metaM));
          var col = sinDato ? 'var(--tx3)' : ok ? 'var(--ok)' : 'var(--danger)';
          // Motivo probable (Nivel 1, ver "motivos" más arriba) — solo en celdas rojas,
          // para no ensuciar visualmente las que ya están dentro de meta.
          var motivo = (!sinDato && !ok && realData[mes] && realData[mes].motivos) ? realData[mes].motivos[ind.id] : '';
          // Nivel 2: si el indicador tiene causas declaradas (DEP_MAP) y hay dato del
          // mes anterior, se agrega cómo se movió cada causa — no afirma "por eso bajó",
          // solo muestra el número antes/después para que la persona saque su propia
          // conclusión (correlación conocida por fórmula/operación, no inferida).
          if (motivo && mi > 0 && DEP_MAP[ind.id] && realData[MSN[mi - 1]]) {
            var mesAnt = MSN[mi - 1];
            var clausulas = [];
            DEP_MAP[ind.id].forEach(function (dep) {
              var antes = realData[mesAnt][dep.id], ahora = realData[mes][dep.id];
              if (antes != null && ahora != null && antes !== ahora) clausulas.push(dep.label + ': ' + antes + ' → ' + ahora);
            });
            if (clausulas.length) motivo += ' · vs. mes anterior: ' + clausulas.join(', ');
          }
          // Nivel 3: la celda roja además es clickeable — abre "Cadena de Causas", el
          // mismo dato del tooltip pero como flujo visual con hasta 2 niveles de causa.
          var clickCadena = motivo ? ' onclick="verCadenaCausas(\'' + ind.id + '\',\'' + mes + '\')"' : '';
          return '<td class="ed" style="color:var(--info);text-align:center;font-size:10px" contenteditable onblur="var m=S.g(\'metas\')||{};if(!m[\'' + ind.id + '\'])m[\'' + ind.id + '\']={}; if(!m[\'' + ind.id + '\'].meses)m[\'' + ind.id + '\'].meses={}; if(!m[\'' + ind.id + '\'].meses[\'' + mes + '\'])m[\'' + ind.id + '\'].meses[\'' + mes + '\']={}; m[\'' + ind.id + '\'].meses[\'' + mes + '\'].meta=parseFloat(this.innerText)||0;S.s(\'metas\',m)">' + metaM + '</td>' +
            '<td style="text-align:center;font-weight:600;color:' + col + ';font-size:10px' + (motivo ? ';cursor:pointer;text-decoration:underline dotted' : '') + '"' + (motivo ? ' title="' + escapeHtml(motivo) + ' — clic para ver la cadena completa"' : '') + clickCadena + '>' + (sinDato ? '—' : real) + '</td>';
        }).join('') + '</tr>';
    }).join('') +
    '</table></div>' + compromisosHtml;
  if (JSON.stringify(metas) !== metasAntes) S.s('metas', metas);
}

// Nivel 3 de "conectar los números": el mismo mapa de causas del Nivel 2 (DEP_MAP),
// pero como flujo visual en vez de un tooltip de una línea — hasta 2 niveles de
// causa (ej. Gasto ← HH del mes ← PM ejecutados). No agrega ningún dato nuevo: usa
// el snapshot que renderMetas() ya calculó (window._metasCadena).
export function verCadenaCausas(indId, mes) {
  var snap = window._metasCadena;
  if (!snap) { toast('⚠️ Abre primero Metas & KPIs → Metas'); return; }
  var indicators = snap.indicators, DEP_MAP = snap.DEP_MAP, realData = snap.realData, MSN = snap.MSN, hMFlota = snap.hMFlota;
  var ind = indicators.find(function (i) { return i.id === indId; });
  if (!ind) return;
  var mi = MSN.indexOf(mes);
  var mesAnt = mi > 0 ? MSN[mi - 1] : null;

  // MTBF no vive en realData directo (se calcula aparte, igual que en la tabla
  // principal) — sin este caso especial, la caja de MTBF siempre mostraba "—".
  function valor(id, m) {
    if (!m || !realData[m]) return null;
    if (id === 'mtbf') { var fM = realData[m].correctivosDelMes; return fM > 0 ? Math.round(hMFlota / fM) : null; }
    var v = realData[m][id];
    return v === undefined ? null : v;
  }
  // Si el id es uno de los 8 indicadores de Metas, usa SU PROPIA meta para pintarlo
  // rojo/verde (ej. "PM ejecutados" como causa de HH también muestra si él mismo
  // está dentro de meta). Un id que no es indicador (ej. correctivosDelMes) no
  // tiene meta propia — queda en color neutro.
  function estadoDe(id, m) {
    var i2 = indicators.find(function (x) { return x.id === id; });
    var v = valor(id, m);
    if (!i2 || v == null) return null;
    return i2.higher ? v >= i2.meta : v <= i2.meta;
  }
  function caja(label, id, destacada) {
    var ahora = valor(id, mes), antes = mesAnt ? valor(id, mesAnt) : null;
    var okEst = estadoDe(id, mes);
    var col = okEst === null ? 'var(--tx)' : (okEst ? 'var(--ok)' : 'var(--danger)');
    var texto = ahora == null ? '—' : (antes != null && antes !== ahora ? (antes + ' → ' + ahora) : String(ahora));
    return '<div style="background:var(--bg3);border:1px solid var(--bd);border-left:4px solid ' + col + ';border-radius:8px;padding:10px 14px;min-width:150px' + (destacada ? ';box-shadow:0 0 0 2px ' + col : '') + '">' +
      '<div style="font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">' + escapeHtml(label) + '</div>' +
      '<div style="font-size:17px;font-weight:800;color:' + col + '">' + escapeHtml(texto) + '</div></div>';
  }
  var flecha = '<div style="font-size:20px;color:var(--tx3);align-self:center">→</div>';

  var deps = DEP_MAP[indId] || [];
  var cadenaHtml;
  if (!deps.length) {
    cadenaHtml = '<p style="font-size:12px;color:var(--tx3);padding:16px 0">Este indicador no tiene una causa declarada entre los otros 7 de Metas — es de nivel raíz acá (depende de factores fuera de este tablero, como dotación o programación de PM).</p>';
  } else {
    cadenaHtml = '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:16px 0">';
    deps.forEach(function (dep) {
      cadenaHtml += caja(dep.label, dep.id);
      var deps2 = DEP_MAP[dep.id];
      if (deps2 && deps2.length) {
        cadenaHtml += '<div style="font-size:10px;color:var(--tx3);width:100%;padding-left:6px">↳ "' + escapeHtml(dep.label) + '" a su vez depende de:</div>';
        deps2.forEach(function (dep2) { cadenaHtml += caja(dep2.label, dep2.id); });
        cadenaHtml += '<div style="width:100%"></div>';
      }
    });
    cadenaHtml += flecha + caja(ind.name, indId, true) + '</div>';
  }

  sm('<div style="max-width:680px">' +
    '<h3>🔗 Cadena de Causas — ' + escapeHtml(ind.name) + ' · ' + mes + '</h3>' +
    '<p style="font-size:11px;color:var(--tx3);margin:4px 0 0">' +
    (mesAnt ? 'Cada caja compara ' + mesAnt + ' → ' + mes + '.' : 'Sin mes anterior disponible para comparar (es el primer mes del año).') +
    ' No afirma que sea la única explicación — solo muestra la causa conocida (por fórmula u operación) y cómo se movió.</p>' +
    cadenaHtml +
    '<button class="btn" onclick="abrirFormCompromiso(\'' + indId + '\',\'' + mes + '\')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Registrar compromiso</button> ' +
    '<button class="btn btn-o" onclick="cm()">Cerrar</button>' +
    '</div>');
}

// Loop de responsabilidad: registrar QUÉ se va a hacer con un indicador rojo,
// QUIÉN es responsable y PARA CUÁNDO — se dispara desde el botón del modal de
// verCadenaCausas(). El valor actual del indicador queda como línea base: el
// compromiso se marca "Cumplido" solo (ver renderMetas) cuando el indicador
// mejore respecto a ese número, no cuando alguien lo tilde a mano.
export function abrirFormCompromiso(indId, mes) {
  var snap = window._metasCadena;
  if (!snap) { toast('⚠️ Abre primero Metas & KPIs → Metas'); return; }
  var ind = snap.indicators.find(function (i) { return i.id === indId; });
  if (!ind) return;
  var valorBase = snap.realData[mes] ? snap.realData[mes][indId] : null;
  if (indId === 'mtbf') {
    var fM = snap.realData[mes] ? snap.realData[mes].correctivosDelMes : 0;
    valorBase = fM > 0 ? Math.round(snap.hMFlota / fM) : null;
  }
  var per = _tecnicosDisponibles();
  var fechaSugerida = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  sm('<div style="max-width:480px">' +
    '<h3>📝 Registrar compromiso — ' + escapeHtml(ind.name) + ' · ' + mes + '</h3>' +
    '<p style="font-size:11px;color:var(--tx3)">Línea base: <b>' + (valorBase == null ? '—' : valorBase) + '</b>. Se marca cumplido solo cuando el indicador mejore respecto a este número — no hace falta que llegue a meta.</p>' +
    '<div class="form-row"><div class="fg" style="flex:1;width:100%"><label>Acción</label><textarea id="cpAccion" rows="2" style="width:100%" placeholder="Ej: reforzar dotación de mecánicos turno noche"></textarea></div></div>' +
    '<div class="form-row"><div class="fg"><label>Responsable</label><select id="cpResp"><option value="">Sin asignar</option>' + per.map(function (p) { return '<option>' + escapeHtml(p) + '</option>'; }).join('') + '</select></div>' +
    '<div class="fg"><label>Fecha compromiso</label><input type="date" id="cpFecha" value="' + fechaSugerida + '"></div></div>' +
    '<button class="btn" onclick="guardarCompromiso(\'' + indId + '\',\'' + escapeHtml(ind.name).replace(/'/g, "\\'") + '\',\'' + mes + '\',' + (valorBase == null ? 'null' : valorBase) + ',' + (ind.higher ? 'true' : 'false') + ')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar</button> ' +
    '<button class="btn btn-o" onclick="cm()">Cancelar</button>' +
    '</div>');
}
export function guardarCompromiso(indId, indName, mes, valorBase, higherEsMejor) {
  var accion = ($('cpAccion') && $('cpAccion').value.trim()) || '';
  if (!accion) return toast('⚠️ Describe la acción');
  var compromisos = S.g('compromisos') || [];
  compromisos.push({
    indicadorId: indId,
    indicadorName: indName,
    mes: mes,
    accion: accion,
    responsable: $('cpResp') ? $('cpResp').value : '',
    fechaCompromiso: $('cpFecha') ? $('cpFecha').value : '',
    fechaCreacion: new Date().toISOString().slice(0, 10),
    valorBase: valorBase,
    higherEsMejor: !!higherEsMejor,
    estado: 'Pendiente',
    valorFinal: null,
    fechaResolucion: null
  });
  S.s('compromisos', compromisos);
  cm();
  toast('✅ Compromiso registrado');
  refreshAll();
}
export function delCompromiso(i) {
  if (!confirm('¿Eliminar este compromiso?')) return;
  var compromisos = S.g('compromisos') || [];
  compromisos.splice(i, 1);
  S.s('compromisos', compromisos);
  refreshAll();
}

// Puente window/renders — ver nota en mov.js (primera tanda).
window.renderMetas = renderMetas;
window.verCadenaCausas = verCadenaCausas;
window.abrirFormCompromiso = abrirFormCompromiso;
window.guardarCompromiso = guardarCompromiso;
window.delCompromiso = delCompromiso;
renders.metas = renderMetas;
