// Pestaña Costos, HH y Confiabilidad (sub-pestaña de Costos & Stock) —
// extraída a su propio archivo (Fase 2 de modularización). Módulo ES real
// (Fase 3, 2026-08-30, tercera tanda: Componentes/Costos) — ver nota de
// migración en mov.js (primera tanda, mismo patrón).
function _tcoMM(n) { var t = Math.round((n || 0) / 1e5); return '$' + fn(Math.floor(t / 10)) + ',' + (t % 10) + ' M'; }
// ═══ DIAGRAMA SANKEY (2026-10-13) ═══ dibuja el resultado de sankeyLayout (logic.js): nodos como barras y cintas curvas cuyo ancho es proporcional a la cantidad. Cada cinta toma el color de la rama de la
// primera columna de la que viene (la de mayor flujo si un nodo recibe de varias).
var _SK_PALETA = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b', '#84cc16'];
function _cosSankeySVG(links, columnas, fmt, ariaLabel) {
  var lay = sankeyLayout(links, columnas, { ancho: 520, alto: 420, anchoNodo: 12, separacion: 7 });
  if (!lay.nodos.length) return '';
  var mL = 215, mR = 175, W = lay.ancho + mL + mR, H = lay.alto + 8;
  var color = {}, k0 = 0;
  lay.nodos.filter(function (n) { return n.col === 0; }).forEach(function (n) { color[n.id] = _SK_PALETA[k0++ % _SK_PALETA.length]; });
  for (var c = 1; c < lay.columnas; c++) {
    lay.nodos.filter(function (n) { return n.col === c; }).forEach(function (n) {
      var mejor = null;
      lay.cintas.forEach(function (r) { if (r.destino === n.id && color[r.origen] && (!mejor || r.valor > mejor.valor)) mejor = r; });
      color[n.id] = mejor ? color[mejor.origen] : '#94a3b8';
    });
  }
  var rec = function (t) { t = String(t); return t.length > 24 ? t.slice(0, 23) + '…' : t; };
  var svg = '<g transform="translate(' + mL + ',4)">';
  lay.cintas.forEach(function (r) {
    var xm = (r.x0 + r.x1) / 2, w = Math.max(r.w, 0.6);
    svg += '<path d="M' + r.x0.toFixed(1) + ',' + (r.y0 + w / 2).toFixed(1) + ' C' + xm.toFixed(1) + ',' + (r.y0 + w / 2).toFixed(1) + ' ' + xm.toFixed(1) + ',' + (r.y1 + w / 2).toFixed(1) + ' ' + r.x1.toFixed(1) + ',' + (r.y1 + w / 2).toFixed(1) +
      '" fill="none" stroke="' + color[r.origen] + '" stroke-opacity=".38" stroke-width="' + w.toFixed(1) + '"><title>' + escapeHtml(r.origen + ' → ' + r.destino + ': ' + fmt(r.valor)) + '</title></path>';
  });
  lay.nodos.forEach(function (n) {
    var ult = n.col === lay.columnas - 1, prim = n.col === 0;
    svg += '<rect x="' + n.x.toFixed(1) + '" y="' + n.y.toFixed(1) + '" width="' + lay.anchoNodo + '" height="' + Math.max(n.h, 1).toFixed(1) + '" fill="' + color[n.id] + '"><title>' + escapeHtml(n.id + ': ' + fmt(n.valor)) + '</title></rect>';
    if (n.h >= 9) {
      var tx = prim ? n.x - 5 : n.x + lay.anchoNodo + 5, anc = prim ? 'end' : 'start';
      svg += '<text x="' + tx.toFixed(1) + '" y="' + (n.y + n.h / 2 + 3).toFixed(1) + '" font-size="10" text-anchor="' + anc + '" fill="var(--tx)" stroke="var(--bg2, var(--bg))" stroke-width="3" paint-order="stroke">' + escapeHtml(rec(n.id)) + ' <tspan fill="var(--tx3)">' + escapeHtml(fmt(n.valor)) + '</tspan></text>';
    }
  });
  svg += '</g>';
  return '<div style="overflow-x:auto"><svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;min-width:720px;max-width:' + W + 'px;height:auto;display:block;margin:0 auto" role="img" aria-label="' + escapeHtml(ariaLabel) + '">' + svg + '</svg></div>';
}
// ═══ ARRIENDO VS COMPRA (2026-10-13) ═══ arma, por modelo de equipo, los datos que el sistema SÍ mide (horas por día, valor de compra, vida contable, repuestos y servicios por hora del TCO,
// neumáticos por hora) para pasárselos a arriendoVsCompra (logic.js). Lo que el sistema no mide (tarifas de arriendo, dotación, litros por carga, UF, diésel, sueldos) lo escribe el usuario
// y se guarda en Configuración (cfg.arriendoVsCompra). Los equipos por kilómetros (camionetas, buses) quedan fuera: no se arriendan por hora.
function _arrMediana(a) {
  var v = a.filter(function (x) { return typeof x === 'number' && isFinite(x); }).sort(function (x, y) { return x - y; });
  if (!v.length) return null;
  var m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
function _arriendoGrupos() {
  var eqs = S.g('eq') || [], neu = S.g('neu') || [], tcoD = (typeof tcoFlotaAuto === 'function') ? tcoFlotaAuto() : null, tcoPor = {};
  if (tcoD) tcoD.res.equipos.forEach(function (r) { tcoPor[r.sigla] = r; });
  var grupos = {}, orden = [];
  eqs.forEach(function (e) {
    if (!e || !e.modelo || e.unidad === 'km') return;
    var k = _normalizarModelo(e.modelo);
    if (!grupos[k]) { grupos[k] = { clave: k, nombre: e.modelo, nEquipos: 0, hd: [], vc: [], vida: [], rep: [], neu: [] }; orden.push(k); }
    var g = grupos[k]; g.nEquipos++;
    if (Number(e.hrsDia) >= 1 && Number(e.hrsDia) <= 24) g.hd.push(Number(e.hrsDia));
    if (Number(e.valorCompra) > 0) g.vc.push(Number(e.valorCompra));
    var vida = Number(e.vidaContableH) > 0 ? Number(e.vidaContableH) : null;
    if (vida == null) { var cl = tboClaseModelo(e.modelo); if (cl && TCO_VIDA_CONTABLE_H[cl.clase]) vida = TCO_VIDA_CONTABLE_H[cl.clase]; }
    if (vida) g.vida.push(vida);
    if (tcoPor[e.sigla] && tcoPor[e.sigla].matPorHora != null) g.rep.push(tcoPor[e.sigla].matPorHora);
    var nh = 0, hay = false;
    neu.forEach(function (n) {
      if (!n || n.sigla !== e.sigla || n.estado !== 'Operativo') return;
      var pr = (typeof neuPrecio === 'function') ? neuPrecio(n).precio : 0;
      if (pr > 0 && Number(n.vidaUtil) > 0) { nh += pr / Number(n.vidaUtil); hay = true; }
    });
    if (hay) g.neu.push(nh);
  });
  return orden.map(function (k) {
    var g = grupos[k];
    return { clave: g.clave, nombre: g.nombre, nEquipos: g.nEquipos, horasDia: _arrMediana(g.hd), valorCompra: _arrMediana(g.vc), vidaContableH: _arrMediana(g.vida), repuestosPorHora: _arrMediana(g.rep), neumaticosPorHora: _arrMediana(g.neu) };
  }).sort(function (a, b) { return b.nEquipos - a.nEquipos || (a.nombre < b.nombre ? -1 : 1); });
}
// Guarda un supuesto en cfg.arriendoVsCompra. ambito 'general' (UF, diésel, sueldos, disponibilidades…) o 'modelo' (dotación, litros, tarifas de ese modelo). Vacío = vuelve al valor sugerido.
// Disponibilidades y valor residual se escriben en % y se guardan como fracción. Solo un administrador puede cambiarlos.
export function arriendoCambiar(ambito, clave, campo, v) {
  if (window._userRole !== 'admin') return;
  var n = parseFloat(v), c = S.g('cfg') || {}, a = Object.assign({}, c.arriendoVsCompra || {});
  var val = (v !== '' && isFinite(n) && n >= 0) ? n : null;
  if (ambito === 'general') {
    if (['dispHumedo', 'dispSeco', 'residual'].indexOf(campo) >= 0 && val != null) val = val / 100;
    if (val != null && ['dispHumedo', 'dispSeco'].indexOf(campo) >= 0 && !(val > 0 && val <= 1)) { toast('La disponibilidad debe estar entre 0 y 100 %'); return renders.cos(); }
    if (val != null && campo === 'residual' && val >= 1) { toast('El valor residual debe ser menor a 100 %'); return renders.cos(); }
    if (val != null && ['uf', 'horasCarga', 'meses', 'diasMes'].indexOf(campo) >= 0 && !(val > 0)) val = null;
    if (val == null) delete a[campo]; else a[campo] = val;
  } else {
    var m = Object.assign({}, a.modelos || {}), u = Object.assign({}, m[clave] || {});
    if (val == null) delete u[campo]; else u[campo] = val;
    if (Object.keys(u).length) m[clave] = u; else delete m[clave];
    if (Object.keys(m).length) a.modelos = m; else delete a.modelos;
  }
  c.arriendoVsCompra = Object.keys(a).length ? a : null;
  S.s('cfg', c);
  renders.cos();
}
export function renderCos() {
  if (!$("s-cos")) return;
  var reg = S.g('reg') || [];
  var ot = S.g('ot') || [];
  var mov = S.g('mov') || [];
  var eq = S.g('eq') || [];
  var stk = S.g('stk') || [];
  var lub = S.g('lub') || [];
  // comprasDetalle (2026-09-30, paso 2 de la migración acordada con el usuario,
  // ver arquitectura.md sección 85): reemplaza a 'ocHist' acá — a diferencia del
  // paso 1 (costoSugeridoPorCruce), esta función SUMA costo por sigla, así que
  // concatenar ambas fuentes duplicaría el ~98,4% que ya está en las dos
  // (inflaría el gasto real al doble). Además se encontró un caso real donde
  // 'ocHist' atribuye mal el equipo de una línea de OC: pedido 14515/OC 767168
  // (Filtro Petróleo, Comprador Guillermo Tapia) — el despacho.xlsx real tiene
  // 6 líneas para CN-6113/CN-9500(x2)/CN-9501/CN-9502/CN-9503, NINGUNA para
  // CN-4656, pero 'ocHist' sí le atribuye una línea a CN-4656. 'compras_detalle'
  // es el re-import verificado directo del Excel, más confiable en este punto.
  var ocHist = S.g('comprasDetalle') || [];
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
  // otConHist (auditoría 2026-08-18, mismo hallazgo que Ratio Preventivo/Flota sin
  // falla/Informes KPI/Buscar/Dashboard): 'ot' a secas deja meses sin registro
  // formal (ver correctivos_historico, cargado desde WhatsApp) invisibles en
  // Fallas/MTBF. Acá es seguro sumar además para MTTR y SLA: 'reparaciones' y
  // 'conSla' ya filtran por o.duracion/o.primeraAtencionEn presentes — como
  // otHist nunca trae esos campos (no hay fallback tipo "asumir 8h" en este
  // archivo, a diferencia del Dashboard), sus filas se cuentan en Fallas/MTBF
  // pero quedan automáticamente afuera del promedio de MTTR/SLA, sin distorsión.
  var otConHistCos = ot.concat(_otHistComoOt(S.g('otHist') || []), _informesFallaComoOt(S.g('informesFalla') || []));
  var otPorSiglaCos = {};
  otConHistCos.forEach(function (o) { if (o && o.sigla) (otPorSiglaCos[o.sigla] = otPorSiglaCos[o.sigla] || []).push(o); });
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
  // Forma real de la distribución de MTTR, a nivel FLOTA (2026-09-13, mismo
  // repaso de distribuciones estadísticas que llevó a Poisson en stock). El
  // "MTTR Promedio" de abajo es un promedio simple — mezcla equipos con muy
  // pocas reparaciones cada uno, casi ninguno llega a 5 para un ajuste propio.
  // Se juntan acá mismo las reparaciones de CADA equipo (misma lista
  //'reparaciones' ya filtrada por esFallaMTBF+duracion que ya usa MTTR, para
  // no divergir del universo de equipos que ya cuentan Total Fallas/MTBF/MTTR)
  // parseadas a horas con el mismo regex que usa C.mttrReal.
  var horasReparacionFlota = [];
  eq.forEach(function (e) {
    // 2026-10-23: una «falla» para MTBF y MTTR es una parada de PARADA_LARGA_H horas o más (esParadaLarga, logic.js). 'todas' son las intervenciones (cualquier correctivo): se siguen
    // usando para el SLA de primera respuesta y para la forma de la distribución de reparaciones, que necesitan también las cortas.
    var todas = (otPorSiglaCos[e.sigla] || []).filter(function (o) { return esFallaMTBF(o); });
    var fallas = todas.filter(function (o) { return esParadaLarga(o); });
    var repTodas = todas.filter(function (o) { return o.duracion && o.duracion !== '—'; });
    var reparaciones = fallas;   // toda parada larga tiene duración conocida
    // MTTR = promedio de horas de las paradas largas (mttrParadasLargas, logic.js)
    var _mp = mttrParadasLargas(fallas);
    var mttr = _mp ? _mp.promedio : 0;
    // MTBF real = horas entre fallas sucesivas, usando el horómetro registrado en
    // cada falla (no el horómetro actual del equipo, que infla el número con el
    // simple paso del tiempo sin que haya vuelto a fallar)
    var mtbf = C.mtbfReal(fallas.map(function (o) { return o.horom; }));
    // Intervalo de confianza del MTBF (95%, método chi-cuadrado exacto —
    // ver intervaloConfianzaMTBF en logic.js): con pocas fallas el MTBF
    // puntual es engañoso (ej. real: CN-10155 con 2 fallas da MTBF=430h
    // pero IC95%=[77h,16984h] — el punto casi no dice nada por sí solo).
    // null cuando hay <2 fallas, igual que mtbf.
    var ic = intervaloConfianzaMTBF(fallas.map(function (o) { return o.horom; }));
    // Error estándar / IC del MTTR (95%, t de Student con n−1 grados — ver
    // errorEstandarMTTR en logic.js): mismo motivo que el IC del MTBF de
    // arriba, pero acá el MTTR es un promedio de duraciones (no un conteo
    // de fallas), así que corresponde el método clásico SE=s/√n en vez de
    // chi-cuadrado. null cuando hay <2 reparaciones con duración.
    var seMttr = errorEstandarMTTR(fallas.map(function (o) { return o.duracion; }));
    var conSla = todas.map(_slaRespuestaHoras).filter(function (h) { return h != null; });
    var sla = conSla.length ? Math.round(conSla.reduce(function (s, h) { return s + h; }, 0) / conSla.length) : null;
    mtbfEquipo[e.sigla] = { mtbf: mtbf, mttr: mttr, fallas: fallas.length, intervenciones: todas.length, mttrDet: _mp, reparaciones: reparaciones.length, sla: sla, conSla: conSla.length, ic: ic, seMttr: seMttr };
    repTodas.forEach(function (o) {
      var m = String(o.duracion).match(/(\d+)h/);
      if (m) horasReparacionFlota.push(parseInt(m[1], 10));
    });
  });
  var mttrLogNormal = (typeof analisisMTTRLogNormal === 'function') ? analisisMTTRLogNormal(horasReparacionFlota) : null;

  // ═══ COST DATA ═══
  var meses = [...new Set(reg.map(function (r) { return (r.fechaEntrada || r.fechaEjec || '').slice(0, 7) }))].filter(function (m) { return m; }).sort().reverse();
  var costoMes = {};
  reg.forEach(function (r) {
    var mes = (r.fechaEntrada || r.fechaEjec || '').slice(0, 7); if (!mes) return;
    if (!costoMes[mes]) costoMes[mes] = { hh: 0, filtros: 0, lubricantes: 0, total: 0, pms: 0 };
    costoMes[mes].hh += (r.duracionH || 2) * hh; costoMes[mes].pms++;
  });
  mov.forEach(function (m) {
    // Auditoría 2026-09-16: antes un movimiento sin fecha real (registro PM importado
    // sin fechaEntrada/fechaEjec) llegaba con un mes FABRICADO ('2026-01', ver mov.js) —
    // indistinguible de un enero real, inflando "Total Acumulado" con un mes fantasma
    // que ni siquiera aparecía en el detalle mensual (que sí venía filtrando por 'reg').
    // mov.js ya no inventa esa fecha (mes:null en ese caso) — mismo guard que 'reg' de
    // arriba, ahora consistente entre ambas fuentes.
    if (!m.mes) return;
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
  var _hoyISOCos = new Date().toISOString().slice(0, 10);
  // desviacionPresupuesto ahora recibe el mes (YYYY-MM) para prorratear el
  // presupuesto SOLO cuando es el mes en curso (presupuestoProrrateado,
  // logic.js) — hallazgo de auditoría 2026-09: antes comparaba el gasto real
  // de, por ejemplo, los primeros 3 días del mes contra el presupuesto
  // COMPLETO, mostrando "bajo presupuesto" (verde) engañoso casi todo el mes
  // sin importar el ritmo real de gasto. Meses ya cerrados siguen comparando
  // contra el presupuesto completo, sin cambios.
  function desviacionPresupuesto(totalReal, mes) {
    if (!presupuestoMensual) return null;
    var base = presupuestoProrrateado(presupuestoMensual, mes, _hoyISOCos);
    if (!base) return null;
    return Math.round((totalReal - base) / base * 100);
  }
  var mesActual = meses[0] || '';
  var desvMesActual = mesActual ? desviacionPresupuesto(costoMes[mesActual].total, mesActual) : null;

  // Carta de control I-MR (SPC, logic.js) sobre el costo total mensual — no
  // es un outlier puntual (compara un registro contra la mediana de su
  // grupo) ni CUSUM (tendencia lenta sostenida): acá el límite es fijo,
  // calculado sobre TODA la serie, y señala el mes exacto en que el gasto
  // total salió del comportamiento normal del proceso. cartaControlIMR ya
  // exige mínimo 6 meses — con menos historial simplemente no aparece.
  var cartaCostoMensual = (typeof cartaControlIMR === 'function')
    ? cartaControlIMR(meses.map(function (m) { return { periodo: m, valor: costoMes[m].total }; }))
    : null;
  // Carta de control EWMA (2026-09-20): la I-MR de arriba es buena para un
  // salto grande en un solo mes, pero poco sensible a una deriva lenta y
  // sostenida (el costo subiendo de a poco, mes tras mes, sin que ningún
  // mes cruce el límite fijo) — mismo motivo por el que ya existe CUSUM
  // para aceite. Reusa la misma serie y la misma estimación de sigma que
  // la I-MR (cartaControlEWMA, logic.js).
  var ewmaCostoMensual = (typeof cartaControlEWMA === 'function')
    ? cartaControlEWMA(meses.map(function (m) { return { periodo: m, valor: costoMes[m].total }; }))
    : null;
  function _cosCartaEWMAHTML(carta) {
    if (!carta) return '';
    var filas = carta.detalle.slice().reverse();
    return '<div class="chart-box" style="margin-top:14px">' +
      '<div class="chart-t">📉 Carta de Control EWMA — Costo Total Mensual (deriva sostenida)</div>' +
      '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Complementa la carta I-MR de arriba: en vez de mirar cada mes por separado, suaviza la serie completa (λ=' + carta.lambda + ') para detectar una tendencia que se acumula de a poco, mes tras mes, aunque ningún mes individual sea una señal por sí solo. Línea central $' + fn(Math.round(carta.xBarra)) + '.</div>' +
      (carta.puntosFueraControl > 0
        ? '<div style="font-size:12px;color:var(--danger);font-weight:600;padding-bottom:8px">⚠ ' + carta.puntosFueraControl + ' mes(es) con deriva sostenida fuera de control</div>'
        : '<div style="font-size:12px;color:var(--ok);padding-bottom:8px">Sin deriva sostenida — la tendencia suavizada se mantiene dentro de los límites</div>') +
      '<div class="tbl-wrap"><table><tr><th>Mes</th><th>Total ($)</th><th>Suavizado (Z)</th><th>Estado</th></tr>' +
      filas.map(function (d) {
        var estado = d.fueraControl
          ? '<b style="color:var(--danger)">⚠ Fuera de control</b>'
          : '<span style="color:var(--ok)">Normal</span>';
        return '<tr><td><b>' + d.periodo + '</b></td><td>$' + fn(Math.round(d.valor)) + '</td><td>$' + fn(Math.round(d.z)) + '</td><td>' + estado + '</td></tr>';
      }).join('') +
      '</table></div></div>';
  }
  function _cosCartaControlHTML(carta) {
    if (!carta) return '';
    var filas = carta.detalle.slice().reverse();
    return '<div class="chart-box" style="margin-top:14px">' +
      '<div class="chart-t">📈 Carta de Control I-MR — Costo Total Mensual</div>' +
      '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Control Estadístico de Procesos (SPC): límites fijos calculados sobre toda la serie (línea central $' + fn(Math.round(carta.xBarra)) + ', límites $' + fn(Math.round(Math.max(0, carta.LCL))) + ' – $' + fn(Math.round(carta.UCL)) + '). Un mes fuera de estos límites es una señal de causa especial (algo cambió de verdad), distinto de la variación normal mes a mes. Requiere al menos 6 meses de historial.</div>' +
      (carta.puntosFueraControl > 0
        ? '<div style="font-size:12px;color:var(--danger);font-weight:600;padding-bottom:8px">⚠ ' + carta.puntosFueraControl + ' mes(es) fuera de control</div>'
        : '<div style="font-size:12px;color:var(--ok);padding-bottom:8px">Proceso bajo control — ningún mes fuera de los límites</div>') +
      '<div class="tbl-wrap"><table><tr><th>Mes</th><th>Total ($)</th><th>Estado</th></tr>' +
      filas.map(function (d) {
        var estado = d.fueraControl
          ? '<b style="color:var(--danger)">⚠ Fuera de control</b>'
          : '<span style="color:var(--ok)">Normal</span>';
        return '<tr><td><b>' + d.periodo + '</b></td><td>$' + fn(Math.round(d.valor)) + '</td><td>' + estado + '</td></tr>';
      }).join('') +
      '</table></div></div>';
  }
  // Matriz Jack-Knife (2026-10-02): cuadrantes MTBF vs MTTR por equipo, ver
  // matrizJackKnife (logic.js) — null si hay menos de 3 equipos con ambos
  // datos válidos, en cuyo caso no se muestra nada (sin inventar una matriz
  // con datos insuficientes).
  var _JK_INFO = {
    mundial: { t: '🏆 Clase Mundial', d: 'Falla poco y se arregla rápido', c: 'var(--ok)' },
    cronico: { t: '🔁 Crónico', d: 'Falla seguido, pero se arregla rápido', c: 'var(--w)' },
    agudo: { t: '⏱️ Agudo', d: 'Falla poco, pero cuando falla tarda mucho', c: 'var(--w)' },
    complejo: { t: '🔴 Complejo', d: 'Falla seguido Y tarda mucho — prioridad máxima', c: 'var(--danger)' }
  };
  // Gráfico Jack-Knife (2026-10-13): MTBF (eje X, escala logarítmica e invertida: a la derecha los que fallan más seguido) contra MTTR (eje Y, logarítmico), con las medianas de la flota como
  // líneas de corte (las mismas que clasifican a cada equipo) y líneas diagonales de igual pérdida: horas perdidas al año = (horas de operación al año ÷ MTBF) × MTTR, dibujadas con el ritmo
  // anual mediano de la flota; dos equipos sobre la misma diagonal pierden las mismas horas aunque uno falle poco y tarde mucho y el otro al revés.
  function _cosJackKnifeSVG(jk) {
    var W = 640, H = 380, mL = 52, mR = 16, mT = 14, mB = 44, pts = jk.puntos;
    var lx = function (v) { return Math.log10(v); };
    var xs = pts.map(function (p) { return p.mtbf; }), ys = pts.map(function (p) { return p.mttr; });
    var xmin = Math.min.apply(null, xs.concat(jk.medianaMtbf)) / 1.4, xmax = Math.max.apply(null, xs.concat(jk.medianaMtbf)) * 1.4;
    var ymin = Math.min.apply(null, ys.concat(jk.medianaMttr)) / 1.5, ymax = Math.max.apply(null, ys.concat(jk.medianaMttr)) * 1.5;
    var X = function (v) { return mL + (lx(xmax) - lx(v)) / (lx(xmax) - lx(xmin)) * (W - mL - mR); };   // invertido
    var Y = function (v) { return H - mB - (lx(v) - lx(ymin)) / (lx(ymax) - lx(ymin)) * (H - mT - mB); };
    var xc = X(jk.medianaMtbf), yc = Y(jk.medianaMttr), x0 = mL, x1 = W - mR, y0 = mT, y1 = H - mB;
    var fondo = function (x, y, w, h, c) { return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(0, w).toFixed(1) + '" height="' + Math.max(0, h).toFixed(1) + '" fill="' + c + '" fill-opacity=".07"/>'; };
    var svg = fondo(xc, y0, x1 - xc, yc - y0, 'var(--danger)') + fondo(x0, y0, xc - x0, yc - y0, 'var(--w)') + fondo(xc, yc, x1 - xc, y1 - yc, 'var(--w)') + fondo(x0, yc, xc - x0, y1 - yc, 'var(--ok)');
    // rejilla y etiquetas de ejes (potencias de 10 y 1-2-5)
    var marcas = function (a, b) { var out = [], d = Math.floor(Math.log10(a)); for (var e = d; e <= Math.ceil(Math.log10(b)); e++) [1, 2, 5].forEach(function (m) { var v = m * Math.pow(10, e); if (v >= a && v <= b) out.push(v); }); return out; };
    var nf = function (v) { return v >= 1000 ? (Math.round(v / 100) / 10 + '').replace('.', ',') + ' mil' : (v < 1 ? (v + '').replace('.', ',') : v + ''); };
    marcas(xmin, xmax).forEach(function (v) { svg += '<line x1="' + X(v).toFixed(1) + '" y1="' + y0 + '" x2="' + X(v).toFixed(1) + '" y2="' + y1 + '" stroke="var(--border)" stroke-opacity=".4"/><text x="' + X(v).toFixed(1) + '" y="' + (y1 + 14) + '" text-anchor="middle" font-size="9" fill="var(--tx3)">' + nf(v) + '</text>'; });
    marcas(ymin, ymax).forEach(function (v) { svg += '<line x1="' + x0 + '" y1="' + Y(v).toFixed(1) + '" x2="' + x1 + '" y2="' + Y(v).toFixed(1) + '" stroke="var(--border)" stroke-opacity=".4"/><text x="' + (x0 - 5) + '" y="' + (Y(v) + 3).toFixed(1) + '" text-anchor="end" font-size="9" fill="var(--tx3)">' + nf(v) + '</text>'; });
    svg += '<rect x="' + x0 + '" y="' + y0 + '" width="' + (x1 - x0) + '" height="' + (y1 - y0) + '" fill="none" stroke="var(--border)"/>';
    // diagonales de igual pérdida (horas/año) con el ritmo mediano de la flota
    if (jk.hrsAnioRef) {
      [25, 50, 100, 200, 500, 1000].forEach(function (L) {
        var f = function (m) { return L * m / jk.hrsAnioRef; };   // MTTR = L·MTBF/H
        var a = xmin, b = xmax, ya = f(a), yb = f(b);
        if (ya > ymax) { a = ymax * jk.hrsAnioRef / L; ya = ymax; } if (ya < ymin) { a = ymin * jk.hrsAnioRef / L; ya = ymin; }
        if (yb > ymax) { b = ymax * jk.hrsAnioRef / L; yb = ymax; } if (yb < ymin) { b = ymin * jk.hrsAnioRef / L; yb = ymin; }
        if (!(a < b)) return;
        svg += '<line x1="' + X(a).toFixed(1) + '" y1="' + Y(ya).toFixed(1) + '" x2="' + X(b).toFixed(1) + '" y2="' + Y(yb).toFixed(1) + '" stroke="var(--tx3)" stroke-dasharray="4 4" stroke-opacity=".7"/>' +
          '<text x="' + (X(a) - 3).toFixed(1) + '" y="' + (Y(ya) - 3).toFixed(1) + '" text-anchor="end" font-size="8" fill="var(--tx3)">' + L + ' h/año</text>';
      });
    }
    svg += '<line x1="' + xc.toFixed(1) + '" y1="' + y0 + '" x2="' + xc.toFixed(1) + '" y2="' + y1 + '" stroke="var(--tx2)" stroke-width="1.5"/><line x1="' + x0 + '" y1="' + yc.toFixed(1) + '" x2="' + x1 + '" y2="' + yc.toFixed(1) + '" stroke="var(--tx2)" stroke-width="1.5"/>';
    // nombres de cuadrante
    var cuad = function (txt, x, y, c, anc) { return '<text x="' + x + '" y="' + y + '" font-size="11" font-weight="700" fill="' + c + '" text-anchor="' + anc + '">' + txt + '</text>'; };
    svg += cuad('AGUDOS', x0 + 6, y0 + 14, 'var(--w)', 'start') + cuad('COMPLEJOS (agudos-crónicos)', x1 - 6, y0 + 14, 'var(--danger)', 'end') + cuad('CLASE MUNDIAL', x0 + 6, y1 - 6, 'var(--ok)', 'start') + cuad('CRÓNICOS', x1 - 6, y1 - 6, 'var(--w)', 'end');
    pts.forEach(function (p) {
      var c = _JK_INFO[p.cuadrante].c, r = 5;
      svg += '<circle cx="' + X(p.mtbf).toFixed(1) + '" cy="' + Y(p.mttr).toFixed(1) + '" r="' + r + '" fill="' + c + '" fill-opacity=".85"><title>' + escapeHtml(p.sigla) + ' — MTBF ' + fn(p.mtbf) + ' h · MTTR ' + p.mttr + ' h' + (p.horasPerdidasAnio != null ? ' · ≈' + Math.round(p.horasPerdidasAnio) + ' h perdidas al año' : '') + '</title></circle>' +
        '<text x="' + (X(p.mtbf) + 7).toFixed(1) + '" y="' + (Y(p.mttr) + 3).toFixed(1) + '" font-size="9" fill="var(--tx2)">' + escapeHtml(p.sigla) + '</text>';
    });
    svg += '<text x="' + ((x0 + x1) / 2) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="10" fill="var(--tx3)">MTBF (horas entre fallas, escala logarítmica) — a la derecha fallan más seguido</text>' +
      '<text x="12" y="' + ((y0 + y1) / 2) + '" text-anchor="middle" font-size="10" fill="var(--tx3)" transform="rotate(-90 12 ' + ((y0 + y1) / 2) + ')">MTTR (horas por parada, logarítmica)</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:' + W + 'px;height:auto;display:block;margin:0 auto" role="img" aria-label="Matriz Jack-Knife: MTBF contra MTTR por equipo">' + svg + '</svg>';
  }
  function _cosJackKnifeHTML(jk) {
    if (!jk) return '';
    var orden = { complejo: 0, agudo: 1, cronico: 2, mundial: 3 };
    var puntos = jk.puntos.slice().sort(function (a, b) { return orden[a.cuadrante] - orden[b.cuadrante] || (b.horasPerdidasAnio || 0) - (a.horasPerdidasAnio || 0); });
    var hp = function (v) { return v == null ? '—' : fn(Math.round(v)); };
    return '<div class="chart-box" style="margin-bottom:12px">' +
      '<div class="chart-t">🗺️ Matriz Jack-Knife — MTBF vs MTTR por equipo</div>' +
      '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Cruza confiabilidad (MTBF) y mantenibilidad (MTTR) de cada equipo contra la MEDIANA de la propia flota (MTBF ' + fn(jk.medianaMtbf) + 'h · MTTR ' + jk.medianaMttr + 'h) para separar "falla seguido" de "tarda mucho en arreglarse" — son problemas distintos con soluciones distintas. Las líneas punteadas unen puntos que pierden las mismas horas al año' + (jk.hrsAnioRef ? ' (calculadas con ' + fn(Math.round(jk.hrsAnioRef)) + ' h de operación al año, la mediana de la flota)' : '') + ': dos equipos sobre la misma línea cuestan lo mismo, aunque uno falle poco y tarde mucho y el otro al revés.</div>' +
      _cosJackKnifeSVG(jk) +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin:12px 0 10px">' +
      Object.keys(_JK_INFO).map(function (k) {
        var info = _JK_INFO[k];
        return '<div class="card" style="border-left:3px solid ' + info.c + '"><div class="card-t">' + info.t + '</div><div class="card-v" style="color:' + info.c + '">' + jk.resumen[k] + '</div><div class="card-s">' + info.d + (jk.nConHoras ? ' · ≈' + hp(jk.horasPerdidasPorCuadrante[k]) + ' h perdidas/año' : '') + '</div><div class="card-s" style="margin-top:4px;font-style:italic">' + escapeHtml(jk.acciones[k]) + '</div></div>';
      }).join('') +
      '</div>' +
      '<div class="tbl-wrap"><table><tr><th>Equipo</th><th>MTBF (hrs)</th><th>MTTR (hrs)</th><th>Paradas/año (est.)</th><th>Horas perdidas/año (est.)</th><th>Cuadrante</th></tr>' +
      puntos.map(function (p) {
        var info = _JK_INFO[p.cuadrante];
        return '<tr><td class="mono" style="color:var(--ac)">' + escapeHtml(p.sigla) + '</td><td style="text-align:center">' + fn(p.mtbf) + '</td><td style="text-align:center">' + p.mttr + '</td><td style="text-align:center">' + (p.fallasAnio == null ? '—' : (Math.round(p.fallasAnio * 10) / 10 + '').replace('.', ',')) + '</td><td style="text-align:center;font-weight:600">' + hp(p.horasPerdidasAnio) + '</td><td style="text-align:center;color:' + info.c + ';font-weight:700">' + info.t + '</td></tr>';
      }).join('') +
      '</table></div>' +
      '<div style="font-size:10px;color:var(--tx3);margin-top:6px">Fallas por año y horas perdidas son estimaciones: horas de operación al año del equipo (horas/día declaradas × 365) ÷ MTBF, por el MTTR. Un equipo sin horas/día válidas aparece con "—". Los cuadrantes se calculan con MTBF y MTTR reales, sin usar esa estimación.</div>' +
      '</div>';
  }

  var content = '';

  if (fVista === 'costos') {
    content =
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:14px">' +
      '<div class="card" style="border-left:3px solid var(--ac)"><div class="card-t">Total Acumulado</div><div style="font-size:20px;font-weight:700;color:var(--ac)">$' + fn(Math.round(totalG)) + '</div></div>' +
      '<div class="card"><div class="card-t">HH Reales</div><div class="card-v">' + Math.round(hhRealTotal) + 'h</div><div class="card-s">' + reg.length + ' intervenciones</div></div>' +
      '<div class="card"><div class="card-t">HH Planificadas</div><div class="card-v">' + Math.round(hhPlanTotal) + 'h</div><div class="card-s" title="Mediana histórica de duración real por equipo+tipoPM (hhPlanEstimator, logic.js) — ya no usa el intervalo de las pautas, que sobreestimaba el plan">Mediana histórica</div></div>' +
      '<div class="card"><div class="card-t">Eficiencia HH</div><div class="card-v" style="color:' + (eficiencia === null ? 'var(--tx3)' : eficiencia >= 80 ? 'var(--ok)' : eficiencia >= 60 ? 'var(--w)' : 'var(--danger)') + '">' + (eficiencia === null ? '—' : eficiencia + '%') + '</div><div class="card-s">' + (eficiencia === null ? 'Sin datos' : 'Plan vs Real') + '</div></div>' +
      '<div class="card" title="Mes en curso: presupuesto prorrateado por días transcurridos, no el mes completo"><div class="card-t">Presupuesto vs Real (' + (mesActual || 'mes actual') + ')</div><div class="card-v" style="color:' + (desvMesActual === null ? 'var(--tx3)' : desvMesActual > 0 ? 'var(--danger)' : 'var(--ok)') + '">' + (desvMesActual === null ? '—' : (desvMesActual > 0 ? '+' : '') + desvMesActual + '%') + '</div><div class="card-s">' + (presupuestoMensual ? '$' + fn(Math.round(presupuestoMensual)) + '/mes' + (mesActual === _hoyISOCos.slice(0, 7) ? ' (prorrateado a la fecha)' : '') : 'Sin definir (Configuración)') + '</div></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:14px">' +
      meses.slice(0, 6).map(function (m) { var c = costoMes[m]; return '<div class="card"><b>' + m + '</b> (' + c.pms + ' PMs)<br><span style="font-size:11px">HH: $' + fn(Math.round(c.hh)) + '</span><br><span style="font-size:11px">Filtros: $' + fn(Math.round(c.filtros)) + '</span><br><span style="font-size:11px">Lub: $' + fn(Math.round(c.lubricantes)) + '</span><br><b style="color:var(--ac)">Total: $' + fn(Math.round(c.total)) + '</b></div>'; }).join('') +
      '</div>' +
      '<div class="tbl-wrap"><table><tr><th>Mes</th><th>PMs</th><th>HH ($)</th><th>Filtros ($)</th><th>Lubricantes ($)</th><th>Total ($)</th><th>Desviación Presupuesto</th></tr>' +
      meses.map(function (m) {
        var c = costoMes[m]; var d = desviacionPresupuesto(c.total, m);
        var dTxt = d === null ? '<span style="color:var(--tx3)">—</span>' : '<b style="color:' + (d > 0 ? 'var(--danger)' : 'var(--ok)') + '">' + (d > 0 ? '+' : '') + d + '%</b>';
        return '<tr><td><b>' + m + '</b></td><td>' + c.pms + '</td><td>$' + fn(Math.round(c.hh)) + '</td><td>$' + fn(Math.round(c.filtros)) + '</td><td>$' + fn(Math.round(c.lubricantes)) + '</td><td style="color:var(--ac);font-weight:700">$' + fn(Math.round(c.total)) + '</td><td style="text-align:center">' + dTxt + '</td></tr>';
      }).join('') +
      '</table></div>' +
      _cosCartaControlHTML(cartaCostoMensual) +
      _cosCartaEWMAHTML(ewmaCostoMensual);

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
    // MTBF de flota: horas operadas ÷ paradas (mtbfFlotaAgrupado, logic.js), incluye equipos con 0 o 1 parada; mismo número que Dashboard e Informes KPI.
    var mtbfAgrCos = mtbfFlotaAgrupado(eq, otConHistCos, S.g('hist') || []);
    // Con paradas de ≥24 h los umbrales de 4 y 8 h ya no sirven (todas quedan «lentas»): Mantenibilidad se compara contra la mediana de la propia flota.
    var medMttrFlota = (function () { var v = mtbfList.map(function (m) { return m[1].mttr; }).filter(function (x) { return x > 0; }).sort(function (a, b) { return a - b; }); return v.length ? v[Math.floor((v.length - 1) / 2)] : 0; })();
    // % Correctivo Reactivo por HORAS (2026-10-02) — a diferencia de
    // ratioPreventivo (cuenta intervenciones), mide el tiempo real: horas de
    // reparación correctiva ya sumadas arriba en horasReparacionFlota (mismo
    // parseo "Xh" de o.duracion que usa MTTR) vs. hhRealTotal (horas reales de
    // PM en 'reg', ya calculado para la pestaña HH). null sin inventar si no
    // hubo ninguna hora registrada de ningún tipo.
    var horasCorrectivasFlota = horasReparacionFlota.reduce(function (s, h) { return s + h; }, 0);
    var pctCorrectivoReactivo = porcentajeCorrectivoReactivo(horasCorrectivasFlota, hhRealTotal);
    content =
      '<div class="cards">' +
      '<div class="card"><div class="card-t">MTBF Flota</div><div class="card-v">' + (mtbfAgrCos && mtbfAgrCos.mtbf ? fn(mtbfAgrCos.mtbf) + 'h' : '—') + '</div><div class="card-s">' + (mtbfAgrCos && mtbfAgrCos.mtbf ? 'Horas operadas ÷ paradas de ≥' + PARADA_LARGA_H + ' h: ' + mtbfAgrCos.paradas + ' paradas en ' + fn(mtbfAgrCos.horas) + ' h · IC95% ' + fn(mtbfAgrCos.inferior) + '–' + (mtbfAgrCos.superior == null ? '∞' : fn(mtbfAgrCos.superior)) + ' h' + (mtbfAgrCos.muestraChica ? ' · muestra chica (menos de ' + MTBF_FLOTA_MIN_PARADAS + ' paradas)' : '') + (mtbfAgrCos.paradasDudosas ? ' · ' + mtbfAgrCos.paradasDudosas + ' con duración dudosa: revisar en Auditoría' : '') : (mtbfAgrCos ? 'Sin paradas de ≥' + PARADA_LARGA_H + ' h en la ventana registrada' : 'Sin historial de horómetro o de duraciones para calcularlo')) + '</div></div>' +
      '<div class="card"><div class="card-t">MTTR Promedio</div><div class="card-v">' + (function () { var conRep = mtbfList.filter(function (m) { return m[1].mttr > 0; }); return conRep.length ? (Math.round(conRep.reduce(function (s, m) { return s + m[1].mttr; }, 0) / conRep.length * 10) / 10 + 'h') : '—'; })() + '</div><div class="card-s">Tiempo medio de reparación de las paradas de ≥' + PARADA_LARGA_H + ' h</div></div>' +
      '<div class="card"><div class="card-t">Paradas ≥' + PARADA_LARGA_H + ' h</div><div class="card-v" style="color:var(--danger)">' + mtbfList.reduce(function (s, m) { return s + m[1].fallas; }, 0) + '</div><div class="card-s">de ' + mtbfList.reduce(function (s, m) { return s + m[1].intervenciones; }, 0) + ' intervenciones en total</div></div>' +
      (function () {
        var conSla = mtbfList.filter(function (m) { return m[1].sla != null; });
        var totalConSla = mtbfList.reduce(function (s, m) { return s + m[1].conSla; }, 0);
        var prom = conSla.length ? Math.round(conSla.reduce(function (s, m) { return s + m[1].sla; }, 0) / conSla.length) : null;
        return '<div class="card"><div class="card-t">SLA 1ra Respuesta</div><div class="card-v" style="color:' + (prom == null ? 'var(--tx3)' : prom <= 4 ? 'var(--ok)' : prom <= 24 ? 'var(--w)' : 'var(--danger)') + '">' + (prom == null ? '—' : prom + 'h') + '</div><div class="card-s">' + (totalConSla ? totalConSla + ' correctivo(s) con dato' : 'Se captura desde ahora en adelante') + '</div></div>';
      })() +
      '<div class="card"><div class="card-t">% Correctivo Reactivo</div><div class="card-v" style="color:' + (pctCorrectivoReactivo == null ? 'var(--tx3)' : pctCorrectivoReactivo <= 20 ? 'var(--ok)' : pctCorrectivoReactivo <= 40 ? 'var(--w)' : 'var(--danger)') + '">' + (pctCorrectivoReactivo == null ? '—' : pctCorrectivoReactivo + '%') + '</div><div class="card-s">' + (pctCorrectivoReactivo == null ? 'Sin horas registradas' : 'Por horas · ' + Math.round(horasCorrectivasFlota) + 'h correctivas de ' + Math.round(horasCorrectivasFlota + hhRealTotal) + 'h totales · ideal &lt;20%') + '</div></div>' +
      '</div>' +

      '<div style="padding:10px;background:var(--bg3);border-radius:6px;margin-bottom:12px;font-size:12px">' +
      '<b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> MTBF</b> = Horas entre fallas sucesivas, según el horómetro registrado en cada falla (necesita ≥2 fallas) → mientras MÁS alto, MEJOR (equipo más confiable)<br>' +
      '<b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> MTTR</b> = Promedio duración reparaciones → mientras MÁS bajo, MEJOR (reparaciones más rápidas)<br>' +
      '<b><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> SLA 1ra Respuesta</b> = Horas entre que se reportó la falla y que alguien la atendió por primera vez (no el cierre) → mientras MÁS bajo, MEJOR. Solo cuenta correctivos registrados desde que se agregó esta medición.</div>' +

      (mttrLogNormal ?
        '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:12px">' +
        '<div class="chart-t">📐 Forma real del MTTR — toda la flota (log-normal)</div>' +
        '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Los tiempos de reparación casi nunca son simétricos: la mayoría son rápidas y unas pocas se alargan mucho (repuesto sin stock, diagnóstico difícil), lo que arrastra el promedio hacia arriba. La mediana real (log-normal) no se distorsiona por esa cola. P90 = 9 de cada 10 reparaciones terminan dentro de ese tiempo.</div>' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' +
        '<div class="card"><div class="card-t">Mediana real</div><div class="card-v">' + mttrLogNormal.mediana + 'h</div><div class="card-s">vs. promedio simple ' + mttrLogNormal.promedioSimple + 'h</div></div>' +
        '<div class="card"><div class="card-t">P90</div><div class="card-v" style="color:var(--w)">' + mttrLogNormal.p90 + 'h</div><div class="card-s">9 de cada 10 reparaciones terminan antes</div></div>' +
        '<div class="card"><div class="card-t">Muestra</div><div class="card-v">' + mttrLogNormal.n + '</div><div class="card-s">reparaciones con duración real</div></div>' +
        '</div></div>' : '') +

      _cosJackKnifeHTML(matrizJackKnife(mtbfList.map(function (m) { var e = (S.g('eq') || []).find(function (x) { return x.sigla === m[0]; }), hd = e ? Number(e.hrsDia) : 0; return { sigla: m[0], mtbf: m[1].mtbf, mttr: m[1].mttr, hrsAnio: hd >= 1 && hd <= 24 ? hd * 365 : null }; }))) +

      '<div class="tbl-wrap"><table>' +
      '<tr><th>Equipo</th><th>Modelo</th><th>Horómetro</th><th>Paradas ≥' + PARADA_LARGA_H + ' h</th><th>MTBF (hrs entre paradas)</th><th>Confiabilidad</th><th>Intervenciones</th><th>MTTR paradas (hrs)</th><th>Mantenibilidad</th><th>SLA 1ra Resp. (hrs)</th></tr>' +
      mtbfList.map(function (m) {
        var e = eq.find(function (x) { return x.sigla === m[0]; });
        var mb = m[1].mtbf;
        var ic = m[1].ic;
        var muestraChicaEq = mb != null && m[1].fallas < MTBF_MIN_PARADAS;   // 2 paradas = un solo intervalo: gris, no verde ni rojo
        var mtbfCol = mb == null || muestraChicaEq ? 'var(--tx3)' : mb > 2000 ? 'var(--ok)' : mb > 500 ? 'var(--w)' : 'var(--danger)';
        var icHtml = '';
        if (ic) {
          var muestraChica = ic.r < 5;
          icHtml = '<div style="font-size:8px;color:' + (muestraChica ? 'var(--w)' : 'var(--tx3)') + ';font-weight:400" title="Intervalo de confianza 95% del MTBF (método chi-cuadrado exacto, NIST 8.1.5.2) — con pocas fallas el punto es poco confiable por sí solo.">' +
            (muestraChica ? '⚠️ ' : '') + 'IC95%: ' + fn(ic.inferior) + '–' + fn(ic.superior) + 'h (' + ic.r + (ic.r === 1 ? ' intervalo' : ' intervalos') + ')</div>';
        }
        var mttrCol = m[1].mttr === 0 ? 'var(--tx3)' : m[1].mttr <= medMttrFlota ? 'var(--ok)' : 'var(--danger)';
        var se = m[1].seMttr;
        var seHtml = '';
        if (se) {
          var seMuestraChica = se.n < 5;
          seHtml = '<div style="font-size:8px;color:' + (seMuestraChica ? 'var(--w)' : 'var(--tx3)') + ';font-weight:400" title="Intervalo de confianza 95% del MTTR (t de Student; los tiempos de reparación son asimétricos, así que es orientativo) — con pocas reparaciones el promedio es poco confiable por sí solo.">' +
            (seMuestraChica ? '⚠️ ' : '') + 'IC95%: ' + fn(se.inferior) + '–' + fn(se.superior) + 'h (' + se.n + (se.n === 1 ? ' reparación' : ' reparaciones') + ')</div>';
        }
        var slaCol = m[1].sla == null ? 'var(--tx3)' : m[1].sla <= 4 ? 'var(--ok)' : m[1].sla <= 24 ? 'var(--w)' : 'var(--danger)';
        return '<tr>' +
          '<td class="mono" style="color:var(--ac)">' + m[0] + '</td>' +
          '<td style="font-size:11px">' + (e ? escapeHtml(e.modelo) : '') + '</td>' +
          '<td style="text-align:center">' + (e ? e.horomActual : 0) + '</td>' +
          '<td style="text-align:center;color:var(--danger);font-weight:600">' + m[1].fallas + '</td>' +
          '<td style="text-align:center;font-weight:700;color:' + mtbfCol + '">' + (mb == null ? '—' : mb) + icHtml + '</td>' +
          '<td style="text-align:center"><span style="font-size:11px;color:' + mtbfCol + '">' + (mb == null ? 'Datos insuf. (' + m[1].fallas + ' parada' + (m[1].fallas === 1 ? '' : 's') + ')' : muestraChicaEq ? '⚪ Muestra chica (' + m[1].fallas + ' paradas)' : mb > 2000 ? '🟢 Alta' : mb > 500 ? '🟡 Media' : '🔴 Baja') + '</span></td>' +
          '<td style="text-align:center">' + m[1].intervenciones + '</td>' +
          '<td style="text-align:center;font-weight:700;color:' + mttrCol + '">' + m[1].mttr + seHtml + '</td>' +
          '<td style="text-align:center"><span style="font-size:11px;color:' + mttrCol + '">' + (m[1].mttr === 0 ? '— Sin datos' : m[1].mttr <= medMttrFlota ? '🟢 ≤ mediana de la flota' : '🔴 sobre la mediana de la flota') + '</span></td>' +
          '<td style="text-align:center;font-weight:700;color:' + slaCol + '">' + (m[1].sla == null ? '—' : m[1].sla) + '</td></tr>';
      }).join('') +
      '</table></div>';
  } else if (fVista === 'tco') {
    // ═══ COSTO TOTAL DE PROPIEDAD POR EQUIPO (2026-10-11) ═══ capital + mantención + detención por hora de operación, comparado contra el modelo.
    // Ver tcoFlota (logic.js) para qué incluye (y qué no: mano de obra propia) y cómo se mide la ventana.
    var tcoD = (typeof tcoFlotaAuto === 'function') ? tcoFlotaAuto() : null;
    var tcoR = tcoD ? tcoD.res.equipos : [];
    var pHc = function (n) { return '$' + fn(Math.round(n)); };
    var sinCap = tcoR.filter(function (r) { return r.tcoPorHora == null; }).length;
    var totAnual = tcoR.reduce(function (a, r) { return a + (r.tcoAnual != null ? r.tcoAnual : r.matAnual + r.detAnual); }, 0);
    // Conciliación: valor contable implícito (Valor_Hora × vida) contra el valor de compra cargado — ver tcoConciliarValor (logic.js).
    var conc = (typeof tcoConciliarValor === 'function') ? tcoConciliarValor(S.g('eq') || []) : { filas: [], revisar: 0, sinValorCompra: [], umbral: 0.15 };
    var concHTML = conc.filas.length ?
      '<div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--bd)"><div style="font-weight:700;font-size:12px;margin-bottom:4px">Conciliación del valor contable</div>' +
      '<div style="font-size:11px;color:var(--tx2);line-height:1.55;margin-bottom:6px">Amortización por hora × vida contable = valor que la contabilidad reparte en horas. Debería parecerse al valor de compra cargado en Equipos. ' +
      (conc.revisar ? '<b style="color:var(--w)">' + fn(conc.revisar) + ' de ' + fn(conc.filas.length) + ' equipos difieren más de ' + Math.round(conc.umbral * 100) + '%</b>: o el valor de compra del programa está desactualizado, o la contabilidad incluye otros conceptos (neumáticos, tolva, flete, instalación). ' +
        'El capital por hora del TCO usa la <b>amortización contable</b> (es lo que la operación efectivamente paga por hora); con el valor de compra daría el valor de la última columna.' : '<b style="color:var(--ok)">Los valores concuerdan.</b>') + '</div>' +
      '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Equipo</th><th>Modelo</th><th style="text-align:right">Valor/h × vida</th><th style="text-align:right">Valor de compra</th><th style="text-align:right">Diferencia</th><th style="text-align:right">Capital/h contable</th><th style="text-align:right">Capital/h con valor de compra</th></tr>' +
      conc.filas.map(function (f) {
        var col = f.nivel === 'revisar' ? 'var(--w)' : 'inherit';
        return '<tr><td class="mono" style="color:var(--ac)">' + escapeHtml(f.sigla) + '</td><td style="font-size:10px">' + escapeHtml(f.modelo) + '</td>' +
          '<td class="mono" style="text-align:right" title="' + escapeHtml(pHc(f.valorHora) + '/h × ' + fn(f.vidaH) + ' h (' + f.vidaFuente + ')') + '">' + _tcoMM(f.valorImplicito) + '</td><td class="mono" style="text-align:right">' + _tcoMM(f.valorCompra) + '</td>' +
          '<td class="mono" style="text-align:right;font-weight:700;color:' + col + '">' + (f.difPct >= 0 ? '+' : '−') + (Math.round(Math.abs(f.difPct) * 1000) / 10 + '').replace('.', ',') + '%</td>' +
          '<td class="mono" style="text-align:right">' + pHc(f.capitalContable) + '</td><td class="mono" style="text-align:right">' + pHc(f.capitalCompra) + '</td></tr>';
      }).join('') + '</table></div>' +
      (conc.sinValorCompra.length ? '<div style="font-size:10px;color:var(--tx3);margin-top:4px">Sin valor de compra cargado (no se comparan): ' + conc.sinValorCompra.map(escapeHtml).join(', ') + '</div>' : '') + '</div>' : '';
    content =
      '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px"><div class="chart-t">🏗️ Costo Total de Propiedad por equipo</div>' +
      '<div style="font-size:11px;color:var(--tx2);line-height:1.55;padding:6px 0 10px">Este es el <b>costo real por hora</b> de cada equipo: cuánto cuesta <b>tenerlo</b> por hora de operación. Suma el <b>capital</b> (lo que costó el equipo repartido en sus horas de vida, o la amortización contable por hora, según lo que elijas abajo), <b>mantención</b> (repuestos y servicios de las órdenes de compra) y <b>detención</b> por falla (horas detenidas × el costo de hora detenida de Configuración' + (tcoD ? ', hoy ' + pHc(tcoD.aj.costoHoraDet) + '/h' + (Object.keys(tcoD.aj.porModelo || {}).length ? ' y valor propio en ' + fn(Object.keys(tcoD.aj.porModelo).length) + ' modelo(s)' : '') : '') + '). Se mide en la misma ventana para cada equipo y se compara con la mediana de su modelo. <b>No incluye mano de obra propia</b> (el costo de los correctivos no se registra). El indicador "Variable ÷ capital nuevo" dice si renovar podría convenir: bajo 1 significa que, aunque un equipo nuevo no gastara nada en mantención, no compensaría su capital.</div>' +
      '<div class="toolbar" style="margin-bottom:10px;flex-wrap:wrap"><label style="font-size:12px;color:var(--tx2)" title="La amortización contable es un valor de contabilidad (puede incluir otros conceptos o venir de otro precio): no es necesariamente lo que costó el equipo. Por defecto el capital se calcula con el valor de compra cargado en Equipos ÷ su vida en horas. Si a un equipo le falta ese dato se usa el otro, y la columna Capital/h dice cuál se usó. Lo cambia un administrador y vale para todos.">Capital por hora calculado con: ' +
      '<select id="fTcoCap" onchange="tcoCambiarFuenteCapital(this.value)"' + (window._userRole === 'admin' ? '' : ' disabled') + ' style="margin-left:4px"><option value="compra"' + ((tcoD && tcoD.fuenteCapital) !== 'contable' ? ' selected' : '') + '>Valor de compra ÷ vida en horas (lo que costó)</option><option value="contable"' + ((tcoD && tcoD.fuenteCapital) === 'contable' ? ' selected' : '') + '>Amortización contable (Horas a Amortizar)</option></select></label>' +
      (window._userRole === 'admin' ? '' : '<span style="font-size:11px;color:var(--tx3)">Solo un administrador puede cambiarlo.</span>') + '</div>' +
      (tcoR.length ?
        '<div class="cards" style="margin-bottom:10px"><div class="card"><div class="card-t">Equipos con datos</div><div class="card-v">' + fn(tcoR.length) + '</div><div class="card-s">con al menos 90 días de compras y horas de operación</div></div>' +
        '<div class="card"><div class="card-t">Costo anual de propiedad</div><div class="card-v" style="color:var(--ac)">' + _tcoMM(totAnual) + '</div><div class="card-s">suma de los equipos' + (sinCap ? ' (' + fn(sinCap) + ' sin capital cargado)' : '') + '</div></div>' +
        '<div class="card"><div class="card-t">Ventana de datos</div><div class="card-v" style="font-size:15px">hasta ' + escapeHtml(tcoD.res.hasta) + '</div><div class="card-s">' + (tcoD.res.mesesQuitados.length ? 'sin ' + tcoD.res.mesesQuitados.length + ' meses finales con carga incompleta' : 'todos los meses') + '</div></div></div>' +
        '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Equipo</th><th>Modelo</th><th style="text-align:right">Horas (ventana)</th><th style="text-align:right">Capital/h</th><th style="text-align:right">Mantención/h</th><th style="text-align:right">Detención/h</th><th style="text-align:right">TCO/h</th><th style="text-align:right" title="Costo variable (mantención + detención) por hora ÷ la mediana de su modelo">vs modelo</th><th style="text-align:right" title="Costo variable por hora ÷ capital por hora de una unidad nueva del mismo modelo. Menor a 1: renovar no conviene.">Variable ÷ capital nuevo</th></tr>' +
        tcoR.map(function (r) {
          var iv = r.indiceVsModelo, ic = iv == null ? 'inherit' : iv >= 1.5 ? 'var(--danger)' : iv >= 1.15 ? 'var(--w)' : iv <= 0.85 ? 'var(--ok)' : 'inherit';
          var rz = r.razonVariableCapitalNuevo, rc = rz == null ? 'inherit' : rz >= 1 ? 'var(--danger)' : rz >= 0.7 ? 'var(--w)' : 'var(--ok)';
          return '<tr><td class="mono" style="color:var(--ac)">' + escapeHtml(r.sigla) + '</td><td style="font-size:10px">' + escapeHtml(r.modelo || '') + '</td>' +
            '<td class="mono" style="text-align:right" title="' + escapeHtml(r.fuenteHoras) + '">' + fn(Math.round(r.horas)) + '</td>' +
            '<td class="mono" style="text-align:right" title="' + escapeHtml(r.capital ? 'Calculado con: ' + r.capital.fuente : 'Sin valor de compra ni amortización cargados') + '">' + (r.capitalPorHora != null ? pHc(r.capitalPorHora) : '<span style="color:var(--tx3)">—</span>') + '</td>' +
            '<td class="mono" style="text-align:right">' + pHc(r.matPorHora) + '</td><td class="mono" style="text-align:right">' + pHc(r.detPorHora) + '</td>' +
            '<td class="mono" style="text-align:right;font-weight:700">' + (r.tcoPorHora != null ? pHc(r.tcoPorHora) : '<span style="color:var(--tx3)">sin capital</span>') + '</td>' +
            '<td class="mono" style="text-align:right;color:' + ic + '">' + (iv == null ? '—' : (Math.round(iv * 100) / 100 + '').replace('.', ',') + '×') + '</td>' +
            '<td class="mono" style="text-align:right;color:' + rc + ';font-weight:600">' + (rz == null ? '—' : (Math.round(rz * 100) / 100 + '').replace('.', ',')) + '</td></tr>';
        }).join('') + '</table></div>' +
        '<div style="font-size:10px;color:var(--tx3);margin-top:6px">Ordenado por costo total por hora (sin capital: por costo variable). Las horas salen del historial de horómetros; si falta, de las horas/día declaradas. Para el detalle de un equipo (evolución por año) abre el Buscador Maestro. Para cargar el capital: Equipos → Importar Horas a Amortizar.</div>'
        : '<div style="padding:20px;text-align:center;color:var(--tx3)">Ningún equipo tiene todavía ≥90 días de compras registradas con horas de operación.</div>') +
      concHTML + '</div>';
  } else if (fVista === 'sankey') {
    // ═══ FLUJO DE HORAS Y COSTO — DIAGRAMAS SANKEY (2026-10-13) ═══ ver sankeyCostoTCO / sankeyHorasReparacion / sankeyLayout (logic.js) para qué cuenta cada uno.
    var skT = (typeof tcoFlotaAuto === 'function') ? tcoFlotaAuto() : null;
    var skCosto = skT ? sankeyCostoTCO(skT.res.equipos, { topEquipos: 10 }) : null;
    var skHoy = new Date(), skHasta = skHoy.toISOString().slice(0, 10), skDesde = new Date(skHoy.getTime() - 365 * 864e5).toISOString().slice(0, 10);
    var skEventos = otConHistCos.filter(esFallaMTBF).map(function (o) {
      var m = o.duracion ? String(o.duracion).match(/(\d+)h/) : null;
      return { sigla: o.sigla, fecha: String(o.fecha || '').slice(0, 10), durH: m ? parseInt(m[1], 10) : 0, componente: (o.componente && o.componente.trim()) || _componenteDeSintoma(o.sintoma) };
    });
    var skHoras = sankeyHorasReparacion(skEventos, eq, { desde: skDesde, hasta: skHasta, topEquipos: 10, topComponentes: 8 });
    var skFmtH = function (v) { return fn(Math.round(v)) + ' h'; };
    var skSinComp = (skHoras.links.filter(function (l) { return l.destino === 'Sin componente registrado'; }).reduce(function (a, l) { return a + l.valor; }, 0));
    content =
      '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px"><div class="chart-t">🔀 Costo anual de propiedad — de dónde viene la plata</div>' +
      '<div style="font-size:11px;color:var(--tx2);line-height:1.55;padding:6px 0 10px">Cada franja es dinero por año: a la izquierda el <b>concepto</b> (capital, mantención, detención por falla), al centro el <b>tipo de equipo</b>, a la derecha los <b>' + (skCosto && skCosto.meta.otros ? '10 equipos' : 'equipos') + ' de mayor costo</b>. El ancho es proporcional al monto. Es el mismo costo anualizado de la tabla de Costo Total de Propiedad; <b>no incluye mano de obra propia</b>.</div>' +
      (skCosto && skCosto.links.length ?
        '<div class="cards" style="margin-bottom:10px"><div class="card"><div class="card-t">Costo anual total</div><div class="card-v" style="color:var(--ac)">' + _tcoMM(skCosto.meta.total) + '</div><div class="card-s">' + fn(skCosto.meta.equipos) + ' equipos con datos</div></div>' +
        (skCosto.meta.sinCapital ? '<div class="card"><div class="card-t">Sin capital cargado</div><div class="card-v" style="color:var(--w)">' + fn(skCosto.meta.sinCapital) + '</div><div class="card-s">solo muestran mantención y detención</div></div>' : '') + '</div>' +
        _cosSankeySVG(skCosto.links, skCosto.columnas, _tcoMM, 'Diagrama Sankey del costo anual de propiedad: concepto, tipo de equipo y equipo')
        : '<div style="padding:20px;text-align:center;color:var(--tx3)">Ningún equipo tiene todavía ≥90 días de compras registradas con horas de operación.</div>') +
      '</div>' +
      '<div class="chart-box" style="border-left:3px solid var(--w);margin-bottom:16px"><div class="chart-t">🔀 Horas de reparación — dónde se va el tiempo (últimos 12 meses)</div>' +
      '<div style="font-size:11px;color:var(--tx2);line-height:1.55;padding:6px 0 10px">Horas de reparación de fallas (correctivos y fallas operacionales) desde ' + escapeHtml(skDesde) + ': <b>tipo de equipo</b> → <b>equipo</b> → <b>componente</b>. Solo cuentan las reparaciones con duración registrada; las demás no se inventan.</div>' +
      (skHoras.links.length ?
        '<div class="cards" style="margin-bottom:10px"><div class="card"><div class="card-t">Horas de reparación</div><div class="card-v" style="color:var(--w)">' + fn(Math.round(skHoras.meta.total)) + ' h</div><div class="card-s">' + fn(skHoras.meta.reparaciones) + ' reparaciones con duración</div></div>' +
        '<div class="card"><div class="card-t">Sin duración registrada</div><div class="card-v">' + fn(skHoras.meta.sinDuracion) + '</div><div class="card-s">fallas del período que no entran al diagrama</div></div>' +
        (skSinComp > 0 ? '<div class="card"><div class="card-t">Sin componente registrado</div><div class="card-v" style="color:var(--w)">' + Math.round(skSinComp / skHoras.meta.total * 100) + '%</div><div class="card-s">de las horas: falta anotar el componente en la OT</div></div>' : '') + '</div>' +
        _cosSankeySVG(skHoras.links, skHoras.columnas, skFmtH, 'Diagrama Sankey de horas de reparación: tipo de equipo, equipo y componente')
        : '<div style="padding:20px;text-align:center;color:var(--tx3)">No hay reparaciones con duración registrada en los últimos 12 meses.</div>') +
      '<div style="font-size:10px;color:var(--tx3);margin-top:6px">Los equipos o componentes fuera del top se agrupan en "Otros". Pasá el mouse sobre una barra o cinta para ver el valor exacto.</div></div>';
  } else if (fVista === 'arriendo') {
    // ═══ ARRIENDO VS COMPRA (2026-10-13) ═══ ver arriendoVsCompra (logic.js) para qué calcula y qué supone cada número.
    var arrCfg = (S.g('cfg') || {}).arriendoVsCompra || {}, arrEd = window._userRole === 'admin';
    var arrSup = Object.assign({}, arrCfg), arrRes = arriendoVsCompra(_arriendoGrupos(), arrSup);
    var u2 = function (v) { return v == null ? '—' : (Math.round(v * 100) / 100 + '').replace('.', ','); };
    var rango = function (o, k1, k2) { return o ? u2(o[k1]) + ' – ' + u2(o[k2]) : '—'; };
    var pct1 = function (v) { return v == null ? '—' : (Math.round(v * 1000) / 10 + '').replace('.', ',') + ' %'; };
    var inp = function (ambito, clave, campo, val, sug, ancho, pct) {
      var shown = val != null ? (pct ? Math.round(val * 1000) / 10 : val) : '';
      var ph = sug != null ? (pct ? Math.round(sug * 1000) / 10 : sug) : '';
      return '<input type="number" min="0" step="any" value="' + shown + '" placeholder="' + ph + '"' + (arrEd ? '' : ' disabled') + ' onchange="arriendoCambiar(\'' + ambito + '\',\'' + clave + '\',\'' + campo + '\',this.value)" style="width:' + (ancho || 84) + 'px;padding:4px;background:var(--bg2);color:var(--tx);border:1px solid var(--bd);border-radius:4px' + (arrEd ? '' : ';opacity:.6') + '">';
    };
    var lbl = function (t, ctl, tip) { return '<label style="font-size:11px;display:flex;align-items:center;gap:6px;justify-content:space-between;background:var(--bg3);border-radius:6px;padding:4px 8px"' + (tip ? ' title="' + escapeHtml(tip) + '"' : '') + '><span>' + t + '</span>' + ctl + '</label>'; };
    var G = ARRIENDO_GENERAL_DEFECTO, gs = function (k) { return arrCfg[k] != null ? arrCfg[k] : null; };
    var generalHTML =
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:6px;margin:8px 0">' +
      lbl('Valor de la UF ($)', inp('general', '', 'uf', gs('uf'), null, 96), 'No hay un valor por defecto: cambia todos los días. Sin él no se calcula nada.') +
      lbl('Precio neto del diésel ($/L)', inp('general', '', 'diesel', gs('diesel'), G.diesel), 'Neto: ya descontado el impuesto específico que se recupera. Confirma con tu contador qué parte se recupera hoy.') +
      lbl('Costo de un operador ($/mes)', inp('general', '', 'operador', gs('operador'), G.operador, 96)) +
      lbl('Costo de un mecánico ($/mes)', inp('general', '', 'mecanico', gs('mecanico'), G.mecanico, 96)) +
      lbl('Horas entre cargas de combustible', inp('general', '', 'horasCarga', gs('horasCarga'), G.horasCarga, 64)) +
      lbl('Duración del contrato (meses)', inp('general', '', 'meses', gs('meses'), G.meses, 64)) +
      lbl('Disponibilidad garantizada, húmedo (%)', inp('general', '', 'dispHumedo', gs('dispHumedo'), G.dispHumedo, 64, true), 'Supuesto: punto medio de la garantía habitual de 85 a 90 %.') +
      lbl('Disponibilidad propia, seco (%)', inp('general', '', 'dispSeco', gs('dispSeco'), G.dispSeco, 64, true), 'Supuesto neutro: igual que el húmedo. Cámbiala por tu disponibilidad real.') +
      lbl('Valor residual de lo comprado (%)', inp('general', '', 'residual', gs('residual'), G.residual, 64, true), 'Cuánto valdría la máquina al final del contrato, como % del valor de compra.') +
      '</div>';
    var filasRes = arrRes.ok ? arrRes.filas : [], nSug = filasRes.reduce(function (a, f) { return a + f.sugeridos.length; }, 0) + (arrRes.ok ? arrRes.generalSugerido.length : 0);
    var tablaRes = '', tablaDet = '', porModelo = '';
    if (arrRes.ok && filasRes.length) {
      tablaRes = '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Modelo</th><th style="text-align:right">Equipos</th><th style="text-align:right" title="Operador, mecánicos, combustible, neumáticos y repuestos por hora">Costos propios (UF/h)</th><th style="text-align:right">Seco con tus costos (UF/h)</th><th style="text-align:right">Húmedo (UF/h)</th><th style="text-align:right" title="Húmedo menos seco con tus costos. Positivo: conviene el seco.">Seco más barato por (UF/h)</th><th style="text-align:right" title="Si tu disponibilidad real en seco fuera menor a esto, el húmedo sale más barato por hora productiva.">Disp. de equilibrio</th><th style="text-align:right" title="Capital por hora + costos propios. Sin financiamiento ni cambios mayores.">Comprar (UF/h)</th><th style="text-align:right" title="Lo que pagarías en seco durante todo el contrato, en veces el valor de compra.">Seco en veces el valor de compra</th><th>Datos</th></tr>' +
        filasRes.map(function (f) {
          var dm = f.diferencia ? f.diferencia.medio : null, col = dm == null ? 'inherit' : dm > 0 ? 'var(--ok)' : 'var(--danger)';
          var est = f.completo ? '<span style="color:var(--ok)">completo</span>' : '<span style="color:var(--w)" title="' + escapeHtml('Falta: ' + f.faltan.join('; ')) + '">incompleto (' + f.faltan.length + ')</span>';
          if (f.sugeridos.length) est += ' <span style="color:var(--tx3)" title="' + escapeHtml('Usa valores sugeridos sin confirmar: ' + f.sugeridos.join(', ') + (f.fuenteSugerida ? '. ' + f.fuenteSugerida : '')) + '">· ' + f.sugeridos.length + ' sugeridos</span>';
          return '<tr><td style="font-weight:600">' + escapeHtml(f.nombre) + '</td><td class="mono" style="text-align:right">' + fn(f.nEquipos) + '</td><td class="mono" style="text-align:right">' + u2(f.propiosUF) + '</td>' +
            '<td class="mono" style="text-align:right">' + rango(f.seco, 'min', 'max') + '</td><td class="mono" style="text-align:right">' + rango(f.humedo, 'min', 'max') + '</td>' +
            '<td class="mono" style="text-align:right;color:' + col + ';font-weight:700">' + (f.diferencia ? rango(f.diferencia, 'min', 'max') + ' <span style="font-weight:400;color:var(--tx3)">(medio ' + u2(dm) + ')</span>' : '—') + '</td>' +
            '<td class="mono" style="text-align:right">' + pct1(f.equilibrio) + '</td><td class="mono" style="text-align:right">' + (f.compra ? u2(f.compra.totalUF) : '—') + '</td>' +
            '<td class="mono" style="text-align:right">' + (f.chequeo ? u2(f.chequeo.veces) + '×' : '—') + '</td><td style="font-size:10px">' + est + '</td></tr>';
        }).join('') + '</table></div>';
      tablaDet = '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Modelo</th><th style="text-align:right">Horas al mes</th><th style="text-align:right">Operadores</th><th style="text-align:right">Mecánicos</th><th style="text-align:right">Combustible</th><th style="text-align:right">Neumáticos</th><th style="text-align:right">Repuestos y servicios</th><th style="text-align:right">Total propio</th></tr>' +
        filasRes.map(function (f) {
          var c = f.costosCLP, cel = function (v) { return '<td class="mono" style="text-align:right">' + (v == null ? '<span style="color:var(--tx3)">falta</span>' : '$' + fn(Math.round(v)) + ' <span style="color:var(--tx3)">(' + u2(v / arrRes.uf) + ')</span>') + '</td>'; };
          return '<tr><td style="font-weight:600">' + escapeHtml(f.nombre) + '</td><td class="mono" style="text-align:right">' + (f.horasMes != null ? fn(Math.round(f.horasMes)) : '—') + '</td>' + cel(c.operador) + cel(c.mecanico) + cel(c.combustible) + cel(c.neumaticos) + cel(c.repuestos) +
            '<td class="mono" style="text-align:right;font-weight:700">$' + fn(Math.round(f.propiosCLP)) + ' <span style="font-weight:400;color:var(--tx3)">(' + u2(f.propiosUF) + ' UF)</span></td></tr>';
        }).join('') + '</table></div><div style="font-size:10px;color:var(--tx3);margin-top:4px">Pesos por hora y, entre paréntesis, UF por hora. "Falta" = el sistema no tiene ese dato (por ejemplo, repuestos pide 90 días de compras con horas de operación).</div>';
      porModelo = filasRes.map(function (f) {
        var u = (arrCfg.modelos && arrCfg.modelos[f.clave]) || {}, def = arriendoDefectoModelo(f.nombre) || {}, e = f.entradas;
        var dot = e.operadores != null ? e.operadores : null;
        return '<div style="border:1px solid var(--bd);border-radius:8px;padding:8px 10px;margin-bottom:8px"><div style="font-weight:700;font-size:12px">' + escapeHtml(f.nombre) + ' <span style="font-weight:400;color:var(--tx3)">(' + fn(f.nEquipos) + ' equipos)</span></div>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px;margin-top:6px">' +
          lbl('Operadores por equipo', inp('modelo', f.clave, 'operadores', u.operadores, dot, 64), 'Sugerido: 2 por cada turno de 12 h (relevo 7x7).') +
          lbl('Mecánicos por equipo', inp('modelo', f.clave, 'mecanicos', u.mecanicos, e.mecanicos, 64)) +
          lbl('Litros por carga', inp('modelo', f.clave, 'litrosCarga', u.litrosCarga, def.litrosCarga, 72), 'Sugerido: capacidad del estanque de un listado de concesionario (no oficial). Confírmalo con el surtidor.') +
          lbl('Tarifa seca mínima (UF/h)', inp('modelo', f.clave, 'secaMin', u.secaMin, def.secaMin, 64)) +
          lbl('Tarifa seca máxima (UF/h)', inp('modelo', f.clave, 'secaMax', u.secaMax, def.secaMax, 64)) +
          lbl('Tarifa húmeda mínima (UF/h)', inp('modelo', f.clave, 'humMin', u.humMin, def.humMin, 64)) +
          lbl('Tarifa húmeda máxima (UF/h)', inp('modelo', f.clave, 'humMax', u.humMax, def.humMax, 64)) +
          '</div>' + (def.fuente ? '<div style="font-size:10px;color:var(--tx3);margin-top:4px">Sugerencias: ' + escapeHtml(def.fuente) + '.</div>' : '<div style="font-size:10px;color:var(--w);margin-top:4px">Este modelo no tiene sugerencias: escribe tarifas y litros por carga para compararlo.</div>') + '</div>';
      }).join('');
    }
    content =
      '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px"><div class="chart-t">🧮 Arriendo vs compra — por modelo, por hora de operación</div>' +
      '<div style="font-size:11px;color:var(--tx2);line-height:1.55;padding:6px 0 10px">Compara tres caminos para un contrato largo: arrendar <b>seco</b> (tú pones operador, combustible, mantención y neumáticos), arrendar <b>húmedo</b> (todo incluido, con disponibilidad garantizada) y <b>comprar</b>. Lo que el sistema mide sale solo (horas por día, valor de compra, vida contable, repuestos y servicios del TCO, neumáticos); lo que no mide (UF, diésel, sueldos, dotación, litros por carga y <b>tarifas de arriendo</b>) lo escribes tú: lo que dejes vacío usa el valor sugerido que aparece en gris. <b>Las tarifas sugeridas son una estimación sin fuente: reemplázalas por cotizaciones reales.</b>' + (arrEd ? '' : ' <i>Solo un administrador puede cambiar estos valores.</i>') + '</div>' +
      '<div style="font-weight:700;font-size:12px">Supuestos generales</div>' + generalHTML +
      (arrRes.ok ? '' : '<div style="padding:14px;text-align:center;color:var(--w);font-weight:600">' + escapeHtml('Falta un dato: ' + arrRes.motivo + '.') + '</div>') +
      (arrRes.ok && !filasRes.length ? '<div style="padding:20px;text-align:center;color:var(--tx3)">No hay equipos por horas con modelo cargado.</div>' : '') +
      (arrRes.ok && filasRes.length ?
        '<div style="font-weight:700;font-size:12px;margin-top:10px">Resultado por modelo (UF por hora de operación)</div>' +
        (nSug ? '<div style="font-size:11px;color:var(--w);margin:4px 0">⚠ El resultado usa ' + nSug + ' valor(es) sugeridos que aún no confirmaste (se ven en gris dentro de cada casilla).</div>' : '') +
        tablaRes +
        '<div style="font-size:10px;color:var(--tx3);margin:6px 0 12px;line-height:1.5"><b>Cómo leerlo:</b> "seco más barato por" es húmedo menos seco con tus costos: <b style="color:var(--ok)">positivo</b> = conviene el seco. La disponibilidad de equilibrio es la que tendrías que tener en seco para que el húmedo empate. "Seco en veces el valor de compra" es lo que pagarías en tarifa seca durante todo el contrato dividido por lo que cuesta comprar la máquina: un número alto significa que la tarifa es cara frente al equipo. <b>No incluye</b> cambios mayores del plan del fabricante, seguros, lavado, supervisión, pañol ni financiamiento, y el valor de comprar no incluye esos mismos costos.</div>' +
        '<div style="font-weight:700;font-size:12px">Costos propios por hora (lo que pagas tú en seco)</div>' + tablaDet +
        '<div style="font-weight:700;font-size:12px;margin-top:14px">Supuestos por modelo</div><div style="margin-top:6px">' + porModelo + '</div>' : '') +
      '</div>';
  } else if (fVista === 'relativo') {
    // ═══ COSTO RELATIVO DE MANTENIMIENTO — indicador EN 15341 A&S1 (2026-09-16,
    // origen: revisión de contenido de Predictiva21 + carga real de Órdenes de
    // Compra históricas). Gasto REAL en repuestos (ordenes_compra_historico) ÷
    // valorCompra real del equipo, anualizado. Ver costoRelativoMantenimiento
    // (logic.js) para el porqué no incluye mano de obra ni se compara sin
    // anualizar entre equipos con distinto largo de historial.
    var crm = costoRelativoMantenimientoFlota(ocHist, eq);
    content =
      '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px"><div class="chart-t">💰 Costo Relativo de Mantenimiento</div>' +
      '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Gasto real en repuestos (Órdenes de Compra históricas) ÷ valor de compra del equipo, anualizado — indicador de la norma EN 15341 (A&S1). NO incluye mano de obra (el campo "Costo total" de las OT sigue sin completarse en la práctica) ni gastos de este sistema (solo lo que ya estaba en las OC importadas). Requiere valorCompra real y al menos 90 días de historial de OC para mostrarse — sin eso, no aparece.</div>' +
      (crm.length ?
        '<div class="tbl-wrap"><table><tr><th>Equipo</th><th>Tipo</th><th>Valor Compra</th><th>Gasto Repuestos (histórico)</th><th>Gasto Anualizado</th><th>Días Historial</th><th>% Anual</th></tr>' +
        crm.map(function (r) {
          var col = r.pct >= 15 ? 'var(--danger)' : r.pct >= 7 ? 'var(--w)' : 'var(--ok)';
          var c = r.concentracionMaxima;
          var aviso = c ? (' <span title="' + escapeHtml('Revisar: una sola línea de OC (' + (c.detalle || 'sin detalle') + ', ' + (c.fecha || '') + ') explica el ' + c.pctDelTotal + '% del gasto histórico de este equipo — puede ser un error de tipeo real, como el que ya se corrigió en CN-9502.') + '" style="cursor:help;color:var(--danger)">⚠️</span>') : '';
          return '<tr><td class="mono" style="color:var(--ac)">' + escapeHtml(r.sigla) + '</td>' +
            '<td style="font-size:11px">' + escapeHtml(r.tipo || '') + '</td>' +
            '<td class="mono" style="font-size:11px">$' + fn(r.valorCompra) + '</td>' +
            '<td class="mono" style="font-size:11px">$' + fn(r.gastoTotal) + '</td>' +
            '<td class="mono" style="font-size:11px">$' + fn(r.gastoAnual) + '</td>' +
            '<td style="text-align:center;font-size:11px;color:var(--tx3)">' + r.diasHistorial + '</td>' +
            '<td style="text-align:center;font-weight:700;color:' + col + '">' + r.pct + '%' + aviso + '</td></tr>';
        }).join('') +
        '</table></div>' +
        (crm.some(function (r) { return r.concentracionMaxima; }) ?
          '<div style="font-size:10px;color:var(--tx3);margin-top:4px">⚠️ = una sola línea de Orden de Compra explica ≥50% del gasto histórico de ese equipo — pasá el mouse para ver cuál. No siempre es un error (una reparación grande real puede concentrar gasto), pero conviene revisarla — así se encontró el error de tipeo real corregido en CN-9502 (19-10-2023, $12.791.624 declarado contra $139.997 de las otras compras del mismo ítem).</div>'
          : '')
        : '<div style="padding:20px;text-align:center;color:var(--tx3)">Ningún equipo cumple los dos requisitos a la vez: valorCompra real cargado y ≥90 días de historial de Órdenes de Compra.</div>') +
      '</div>';
  }

  $('s-cos').innerHTML =
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="8"/><text x="10" y="14" font-size="9" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">$</text></svg> Costos, HH y Confiabilidad</div>' +
    '<div class="sec-s">Desde registros PM + consumos · HH: $' + fn(hh) + '/hr</div></div></div>' +
    '<div class="toolbar">' +
    '<select id="fCosVista" onchange="renders.cos()" style="font-weight:600">' +
    '<option value="costos"' + (fVista === 'costos' ? ' selected' : '') + '><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="8"/><text x="10" y="14" font-size="9" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">$</text></svg> Costos por Mes</option>' +
    '<option value="hh"' + (fVista === 'hh' ? ' selected' : '') + '><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11 A6 6 0 0 1 16 11" fill="none"/><line x1="2" y1="11" x2="18" y2="11"/><line x1="10" y1="5" x2="10" y2="3"/></svg> HH por Técnico / Equipo</option>' +
    '<option value="mtbf"' + (fVista === 'mtbf' ? ' selected' : '') + '><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> MTBF / MTTR</option>' +
    '<option value="tco"' + (fVista === 'tco' ? ' selected' : '') + '>🏗️ Costo Total de Propiedad</option>' +
    '<option value="sankey"' + (fVista === 'sankey' ? ' selected' : '') + '>🔀 Flujo de horas y costo</option>' +
    '<option value="arriendo"' + (fVista === 'arriendo' ? ' selected' : '') + '>🧮 Arriendo vs compra</option>' +
    '<option value="relativo"' + (fVista === 'relativo' ? ' selected' : '') + '>💰 Costo Relativo de Mantenimiento</option></select> ' +
    '<button class="btn btn-o" onclick="verComprasProveedores()" title="Tiempo de respuesta real por proveedor y pedidos de compra que ya llevan más tiempo abierto de lo normal">📦 Compras — Proveedores</button></div>' +
    content;
}

// ═══ COMPRAS — TIEMPO DE RESPUESTA POR PROVEEDOR + PEDIDOS TRABADOS
// (2026-09-30) ═══ — pedido real del usuario tras importar 8.628 líneas de
// Compras reales (despacho.xlsx + OC.xlsx). Usa tiempoRespuestaPorProveedor
// (solo 'Recepcion Bodega', ciclo cerrado — nunca mezcla pedidos todavía
// abiertos) y pedidosPotencialmenteTrabados (los 'OC Firmada'/'OC por
// Firmar' que ya llevan más días transcurridos que lo normal de ESE
// proveedor, mediana real como respaldo si el proveedor no tiene muestra
// propia suficiente).
export function verComprasProveedores(){
  var compras=S.g('comprasDetalle')||[];
  var porProveedor=typeof tiempoRespuestaPorProveedor==='function'?tiempoRespuestaPorProveedor(compras):[];
  var trabados=typeof pedidosPotencialmenteTrabados==='function'?pedidosPotencialmenteTrabados(compras):[];
  var porComprador=typeof tiempoAprobacionOC==='function'?tiempoAprobacionOC(compras):[];
  sm(`<div style="max-width:760px">
    <h3>📦 Compras — Tiempo de Respuesta por Proveedor</h3>
    ${!compras.length?'<p style="font-size:11px;color:var(--w)">Todavía no hay datos de Compras importados.</p>':`
    <p style="font-size:12px;color:var(--tx3)">Tiempo de respuesta real (Pedido → llegada a bodega), solo pedidos con ciclo ya <b>cerrado</b> ("Recepción Bodega") — un pedido todavía abierto no cuenta acá, porque sesgaría el promedio a la baja.</p>
    <div style="overflow-x:auto;max-height:260px;overflow-y:auto">
    <table style="width:100%;font-size:11px">
      <tr style="background:var(--bg3);position:sticky;top:0"><th style="padding:4px;text-align:left">Proveedor</th><th style="text-align:right">Pedidos</th><th style="text-align:right">Días prom.</th><th style="text-align:right">Días mediana</th><th style="text-align:right">Costo total</th></tr>
      ${porProveedor.map(function(p){
        return `<tr style="border-bottom:1px solid var(--bd)"><td style="padding:4px">${escapeHtml(p.proveedor)}</td><td style="text-align:right">${p.nPedidos}</td><td style="text-align:right;color:${p.diasPromedio>20?'var(--danger)':p.diasPromedio>10?'var(--warn)':'var(--ok)'}">${p.diasPromedio}</td><td style="text-align:right">${p.diasMediana}</td><td style="text-align:right">$${fn(p.costoTotal)}</td></tr>`;
      }).join('')||'<tr><td colspan=5 style="text-align:center;padding:12px;color:var(--tx3)">Sin pedidos con ciclo cerrado todavía</td></tr>'}
    </table></div>
    <h3 style="margin-top:16px">⚠️ Pedidos Potencialmente Trabados</h3>
    <p style="font-size:12px;color:var(--tx3)">De los pedidos todavía abiertos ("OC Firmada"/"OC por Firmar"), cuáles ya llevan más días transcurridos que lo normal para ESE proveedor (mediana real de sus propios pedidos cerrados, o la mediana global si el proveedor no tiene al menos 3 pedidos de referencia).</p>
    ${trabados.length?`<div style="overflow-x:auto;max-height:260px;overflow-y:auto"><table style="width:100%;font-size:11px">
      <tr style="background:var(--bg3);position:sticky;top:0"><th style="padding:4px;text-align:left">Pedido</th><th style="text-align:left">Equipo</th><th style="text-align:left">Proveedor</th><th style="text-align:left">Detalle</th><th style="text-align:right">Días transcurridos</th><th style="text-align:right">Referencia</th></tr>
      ${trabados.map(function(t){
        return `<tr style="border-bottom:1px solid var(--bd)"><td style="padding:4px">${escapeHtml(t.pedido||'—')}</td><td style="color:var(--ac)">${escapeHtml(t.sigla||'—')}</td><td>${escapeHtml(t.proveedor||'—')}</td><td style="max-width:200px">${escapeHtml(t.detalle||'—')}</td><td style="text-align:right;color:var(--danger)">${t.diasTranscurridos}</td><td style="text-align:right" title="${t.usaRespaldoGlobal?'Mediana global (proveedor sin muestra propia suficiente)':'Mediana propia del proveedor'}">${t.diasReferencia}${t.usaRespaldoGlobal?' *':''}</td></tr>`;
      }).join('')}
    </table></div><p style="font-size:10px;color:var(--tx3);margin-top:4px">* Mediana global (ese proveedor todavía no tiene al menos 3 pedidos cerrados propios como referencia).</p>`:'<p style="color:var(--ok);text-align:center;padding:16px">Ningún pedido abierto supera lo normal de su proveedor todavía.</p>'}
    <h3 style="margin-top:16px">⏱️ Tiempo Interno de Aprobación de OC</h3>
    <p style="font-size:12px;color:var(--tx3)">La OC se envía al proveedor automáticamente el mismo día en que se aprueba/firma — esto mide solo la parte INTERNA del ciclo (Pedido → aprobación), la que la empresa controla y afecta la capacidad de respuesta para reparaciones, sin mezclar el tiempo de despacho del proveedor. Solo pedidos que HOY están en "OC Firmada" (para pedidos ya recibidos, esta fecha intermedia no queda guardada en los datos exportados).</p>
    ${porComprador.length?`<div style="overflow-x:auto;max-height:220px;overflow-y:auto"><table style="width:100%;font-size:11px">
      <tr style="background:var(--bg3);position:sticky;top:0"><th style="padding:4px;text-align:left">Comprador</th><th style="text-align:right">Pedidos</th><th style="text-align:right">Días prom.</th><th style="text-align:right">Días mediana</th></tr>
      ${porComprador.map(function(c){
        return `<tr style="border-bottom:1px solid var(--bd)"><td style="padding:4px">${escapeHtml(c.comprador)}</td><td style="text-align:right">${c.nPedidos}</td><td style="text-align:right;color:${c.diasPromedio>7?'var(--danger)':c.diasPromedio>3?'var(--warn)':'var(--ok)'}">${c.diasPromedio}</td><td style="text-align:right">${c.diasMediana}</td></tr>`;
      }).join('')}
    </table></div>`:'<p style="font-size:11px;color:var(--tx3);text-align:center;padding:12px">Sin pedidos en estado "OC Firmada" con fecha de aprobación registrada todavía.</p>'}
    `}
    <button class="btn btn-o" style="margin-top:8px" onclick="cm()">Cerrar</button>
  </div>`);
}

// Cambia la fuente del capital por hora del TCO ('compra' o 'contable'); se guarda en Configuración y vale para todos los usuarios y pantallas que muestran el TCO.
export function tcoCambiarFuenteCapital(v) {
  if (window._userRole !== 'admin') { toast('⛔ Solo un administrador puede cambiarlo'); return; }
  var c = S.g('cfg') || {};
  c.tcoCapitalFuente = v === 'contable' ? 'contable' : 'compra';
  S.s('cfg', c);
  toast('✅ Capital por hora: ' + (c.tcoCapitalFuente === 'contable' ? 'amortización contable' : 'valor de compra ÷ vida en horas'));
  renders.cos();
}

// Puente window/renders — ver nota en mov.js (primera tanda).
window.tcoCambiarFuenteCapital = tcoCambiarFuenteCapital;
window.renderCos = renderCos;
window.verComprasProveedores = verComprasProveedores;
window.arriendoCambiar = arriendoCambiar;
renders.cos = renderCos;
