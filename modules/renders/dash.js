// ═══════════════════════════════════════════════════════════════
// DASHBOARD — Tablero principal con KPIs de flota
// dashSetPeriodo/dashHoy se movieron acá porque solo las usa esta pestaña
// (selector de mes/año del tablero).
// ═══════════════════════════════════════════════════════════════
window.dashSetPeriodo=function(){
  var m=document.getElementById('dashMesSel'),a=document.getElementById('dashAnioSel');
  if(m)window._dashMes=parseInt(m.value);
  if(a)window._dashAnio=parseInt(a.value);
  renders.dash();
};
window.dashHoy=function(){
  window._dashMes=null;window._dashAnio=null;
  renders.dash();
};
window.renderDash=function(){
  const eq=C.recalcAll(),reg=S.g('reg')||[];
  const mov=S.g('mov')||[];
  const ot=S.g('ot')||[];
  const neu=S.g('neu')||[];
  const stk=S.g('stk')||[];
  const lub=S.g('lub')||[];
  const cfg=S.g('cfg')||{};
  const ordenes=S.g('ordenes')||[];
  // ── PERÍODO DEL DASHBOARD (mes/año seleccionable) ──
  const _hoy=new Date();
  const dashMes=(window._dashMes!=null?window._dashMes:_hoy.getMonth()+1);
  const dashAnio=(window._dashAnio!=null?window._dashAnio:_hoy.getFullYear());
  const dashPeriodo=dashAnio+'-'+String(dashMes).padStart(2,'0'); // 'YYYY-MM'
  const _diasMes=new Date(dashAnio,dashMes,0).getDate();
  const _MESNOM=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const dashLabel=_MESNOM[dashMes-1]+' '+dashAnio;
  // ── Urgentes/Próximas/Al Día del período elegido: en vivo si es el mes actual;
  // reconstruido desde historial_horometros si es un mes pasado; proyectado
  // (horomActual + hrsDia×días) si es un mes futuro. Un equipo sin dato histórico
  // suficiente para un mes pasado se excluye — nunca se inventa un número.
  const hist=S.g('hist')||[];
  const _hoyISO=_hoy.toISOString().slice(0,10);
  const _mesActualISO=_hoy.getFullYear()+'-'+String(_hoy.getMonth()+1).padStart(2,'0');
  const esMesActual=(dashPeriodo===_mesActualISO);
  let urg=[],prox=[],alDia=[],dashFuente='vivo';
  if(esMesActual){
    urg=eq.filter(e=>e.estado?.includes('URGENTE')||e.estado?.includes('VENCIDA'));
    prox=eq.filter(e=>e.estado?.includes('PROXIMA')||e.estado?.includes('PRÓXIMA'));
    alDia=eq.filter(e=>e.estado?.includes('AL DÍA')||e.estado?.includes('OK'));
  } else {
    const _targetISO=dashAnio+'-'+String(dashMes).padStart(2,'0')+'-'+String(_diasMes).padStart(2,'0');
    dashFuente=_targetISO<_hoyISO?'historico':'proyectado';
    // hist agrupado por sigla, UNA sola vez — antes cada equipo pasaba el arreglo
    // COMPLETO de historial_horometros a C.estadoPeriodo/C.horomHistorico, que lo
    // recorría entero buscando solo sus propias filas. Con cientos de equipos y
    // miles de lecturas, esto era O(equipos × historial) cada vez que el Dashboard
    // se mostraba en un mes pasado/proyectado. horomHistorico ya filtra por sigla
    // internamente, así que pasarle solo las filas de ESE equipo da el resultado
    // idéntico, mucho más rápido.
    const _histPorSiglaDash={};
    hist.forEach(function(h){if(h&&h.sigla)(_histPorSiglaDash[h.sigla]=_histPorSiglaDash[h.sigla]||[]).push(h);});
    eq.forEach(e=>{
      const r=C.estadoPeriodo(e,_histPorSiglaDash[e.sigla]||[],_hoyISO,_targetISO);
      if(!r)return;
      const eCopia=Object.assign({},e,{horomActual:r.horom,horomProxPM:r.horomProxPM,diasParaPM:r.diasParaPM,tipoPM:r.tipoPM});
      if(r.t==='URGENTE'||r.t==='VENCIDA')urg.push(eCopia);
      else if(r.t==='PRÓXIMA')prox.push(eCopia);
      else alDia.push(eCopia);
    });
  }
  const regMes=reg.filter(r=>(r.fechaEjec||r.fechaEntrada||'').slice(0,7)===dashPeriodo);
  // regEsATiempo (logic.js): fuente única para "¿fue a tiempo?" — antes se
  // comparaba r.estado==='A tiempo' (bug real, auditoría 2026-08: ese campo
  // nunca vale ese string exacto, ver comentario en logic.js). Se excluyen los
  // registros no evaluables (ej. importados por CSV sin fecha esperada de
  // referencia) del cálculo en vez de contarlos como cumplidos o atrasados.
  const regClasifPeriodo=regMes.filter(r=>regEsATiempo(r)!==null);
  const ant=regClasifPeriodo.filter(r=>regEsATiempo(r)===true).length;
  const atr=regClasifPeriodo.filter(r=>regEsATiempo(r)===false).length;
  const cum=regClasifPeriodo.length?Math.round(ant/regClasifPeriodo.length*100):null;
  // ── KPI CUMPLIMIENTO DE PROGRAMA (ejecutado a tiempo) del mes ──
  const semHistD=S.g('planSemHist')||{};
  let progPlan=0,progEjec=0;
  Object.values(semHistD).forEach(sem=>{
    const items=(sem&&sem.items)?sem.items:[];
    items.forEach(it=>{
      var fIt=(it.fecha||it.fechaProg||'');
      if(fIt&&fIt.slice(0,7)!==dashPeriodo)return;
      progPlan++;
      if((it.estadoReal||'').toLowerCase().includes('ejec'))progEjec++;
    });
  });
  const cumProg=progPlan?Math.round(progEjec/progPlan*100):0;
  const prev=regMes.filter(r=>r.tipoPM!=='Correctivo').length;
  const corr=regMes.filter(r=>r.tipoPM==='Correctivo').length;
  const pmC={PM1:0,PM2:0,PM3:0,PM4:0,Correctivo:0};regMes.forEach(r=>{if(pmC[r.tipoPM]!==undefined)pmC[r.tipoPM]++});
  const MS=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  const pm=MS.map((_,i)=>reg.filter(r=>{var d=new Date(r.fechaEjec||r.fechaEntrada);return d.getMonth()===i&&d.getFullYear()===2026}).length);
  const mx=Math.max(...pm,1);
  const tipos={};eq.forEach(e=>tipos[e.tipo]=(tipos[e.tipo]||0)+1);
  // Costs — Gasto del MES seleccionado (usa OC real si está cargada; si no, cae al cálculo viejo)
  const hh=S.g('hh')||25000;
  var costoTotal=0;
  if(ordenes.length){
    // Fuente real: órdenes de compra del mes elegido (cada una con fecha y costo)
    ordenes.forEach(function(o){
      if((o.fecha||'').slice(0,7)===dashPeriodo)costoTotal+=(o.costo||0);
    });
  } else {
    reg.forEach(r=>{if((r.fechaEjec||r.fechaEntrada||'').slice(0,7)===dashPeriodo)costoTotal+=(r.duracionH||2)*hh;});
    mov.forEach(m=>{
      if(m.mes!==dashPeriodo)return;
      if(m.tipo==='Filtro'){var f=stk.find(s=>s.descripcion===m.item);costoTotal+=(m.cant||0)*(f?.precioUnit||0);}
      else{var l=lub.find(lb=>lb.nombre===m.item);costoTotal+=(m.cant||0)*(l?.precio||0);}
    });
  }
  // Neumaticos stats
  var neuOk=neu.filter(n=>n.estado==='Operativo').length;
  var neuDet=neu.filter(n=>n.estado==='Deteriorado').length;
  // Índices precomputados (ver _neuMedPorSerie/_eqPorSigla en index.html) — sin esto,
  // neuDebeCambiar() repetía un filter()+sort() de TODA neumaticos_mediciones por cada
  // neumático de la flota, en cada apertura del Dashboard.
  var _neuMedIdx=_neuMedPorSerie(),_eqIdxNeu=_eqPorSigla();
  var neuCrit=neu.filter(function(n){return neuDebeCambiar(n,_neuMedIdx,_eqIdxNeu);}).length;
  // Stock critical — calculado EN VIVO con el criterio único (stockEstado: quiebre antes
  // del lead time), no leyendo el estado guardado (que con el proxy viejo de "1 mes"
  // subestimaba los COMPRAR y nunca escribía "BAJO").
  var _seDash=s=>stockEstado((s.stockBodega||0)+(s.pendiente||0),s.consumoMes||s.proyMes,s.leadTime).nivel;
  var stkCrit=stk.filter(s=>_seDash(s)==='COMPRAR').length;
  var stkBajo=stk.filter(s=>_seDash(s)==='BAJO').length;
  var stkOk=stk.filter(s=>_seDash(s)==='OK').length;
  // Gastos por equipo (from movimientos)
  var gastoEq={};
  mov.forEach(m=>{gastoEq[m.equipo]=(gastoEq[m.equipo]||0)+(m.cant||0);});
  // Top consumers
  var topEq=Object.entries(gastoEq).sort((a,b)=>b[1]-a[1]).slice(0,8);

  // ═══ CÁLCULOS DASHBOARD (versión limpia — un solo bloque) ═══
  var meta=S.g('dispMeta')||85;
  var dispCalcD=S.g('dispCalc')||{};var dAbr=INIT.dispAbril||{};
  // Disponibilidad de flota — misma fuente única que Disponibilidad, KPI y Metas (ver
  // dispEquipoMes en logic.js). Antes el Dashboard promediaba solo sobre los días CON
  // detención (ignorando los días buenos), lo que subestimaba el número; ahora recorre
  // todos los días del mes igual que el resto.
  var downMapD=dispDownMap(reg,ot);
  var mesAct=dashPeriodo;
  var dispVals=eq.map(function(e){return dispEquipoMes(e.sigla,mesAct,{downMap:downMapD,dispCalc:dispCalcD,dAbr:dAbr,hrsDia:e.hrsDia||12});}).filter(function(v){return v!==null&&v!==undefined});
  var dispFlota=dispVals.length?Math.round(dispVals.reduce(function(s,v){return s+v},0)/dispVals.length*10)/10:null;
  var dispCol=dispFlota===null?'var(--tx3)':dispFlota>=meta?'#22c55e':dispFlota>=70?'#f59e0b':'#ef4444';
  var bajoMeta=dispVals.filter(function(v){return v<meta}).length;
  // MTBF del mes — fallas tipificadas como Correctivo o Falla Operacional en el período
  var fallasMes=ot.filter(function(o){
    if(!(o.tipo==='Correctivo'||o.tipo==='Falla Operacional'))return false;
    return (o.fecha||o.fechaEntrada||'').slice(0,7)===dashPeriodo;
  }).length;
  var totalFallas=fallasMes;
  // Auditoría 2026-08: acá se calculaba mtbfFlota como "horas estimadas de flota del
  // mes ÷ fallas del mes" — exactamente el cociente que el propio logic.js ya
  // documenta como bug (ver comentario de mtbfFlotaReal): reparte todas las fallas
  // parejo desde la hora 0 y no usa el horómetro real de cada falla. Se reemplaza
  // por la fuente única ya corregida (mismo cálculo que usa Costos>MTBF/MTTR y el
  // Reporte Ejecutivo) — MTBF real de flota, promedio de los intervalos reales
  // entre fallas sucesivas de cada equipo, con TODO su historial (no acotado al
  // mes elegido: un MTBF con datos de un solo mes casi siempre tiene muy pocos
  // intervalos para ser representativo).
  var mtbfFlota=mtbfFlotaReal(eq,ot);
  // Horas de operación promedio por equipo en el período elegido — el "t" de
  // R(t)=e^(-t/MTBF) más abajo (ver confiabilidadReal en logic.js).
  var eqHrsUnidad=eq.filter(function(e){return e.unidad!=='km';});
  var horasPeriodoProm=eqHrsUnidad.length?eqHrsUnidad.reduce(function(s,e){return s+(e.hrsDia||12)*_diasMes;},0)/eqHrsUnidad.length:null;
  var hhTotal=Math.round(reg.reduce(function(s,r){return s+(r.duracionH||0)},0));
  var otPend=ot.filter(function(o){return o.estadoOT==='Pendiente'}).length;
  // Utilización de dotación según la última fecha cargada en Programación Diaria
  // (no "hoy" — se puede importar con 1-2 días de desfase, así que se usa la
  // fecha más reciente que de verdad tiene datos, no una que podría estar vacía).
  var progDiaTodo=S.g('progDia')||[];
  var progDiaFechasOrd=[...new Set(progDiaTodo.map(function(p){return p.fecha;}))].sort();
  var progDiaUltima=progDiaFechasOrd.length?progDiaFechasOrd[progDiaFechasOrd.length-1]:null;
  var progDiaHoy=progDiaUltima?_progDiaResumen(progDiaTodo.filter(function(p){return p.fecha===progDiaUltima;})):null;
  var utilDia=progDiaHoy?progDiaHoy.utilizacion:null;
  var otEjec=ot.filter(function(o){return o.estadoOT==='En Ejecución'}).length;
  var otCerr=ot.filter(function(o){return(!o.estadoOT||o.estadoOT==='Cerrada')&&(o.fecha||o.fechaEntrada||'').slice(0,7)===dashPeriodo}).length;
  var prevPct=regMes.length?Math.round(prev/regMes.length*100):null;
  var hrsFlotaMes=eq.reduce(function(s,e){return e.unidad==='km'?s:s+(e.hrsDia||12)*30},0);
  // Confiabilidad: equipos sin falla en el PERÍODO seleccionado (no en toda la historia)
  var eqConFallaMes=new Set(ot.filter(function(o){
    if(!(o.tipo==='Correctivo'||o.tipo==='Falla Operacional'))return false;
    return (o.fecha||o.fechaEntrada||'').slice(0,7)===dashPeriodo;
  }).map(function(o){return o.sigla;})).size;
  var idxConf=eq.length>0?Math.round((eq.length-eqConFallaMes)/eq.length*100):100;
  // Confiabilidad real (R) — probabilidad de NO fallar durante el período, según
  // R(t)=e^(-t/MTBF) (fórmula estándar RAM/ISO 14224, asume tasa de falla
  // constante). Distinto de idxConf de arriba: idxConf es un conteo simple
  // ("¿tuvo o no tuvo correctivos?"), esto es una probabilidad estadística real
  // usando el MTBF de flota ya corregido. null si no hay MTBF (mínimo 2 fallas
  // reales por equipo) — nunca se inventa un número.
  var confReal=confiabilidadReal(mtbfFlota,horasPeriodoProm);
  // MTTR del mes — cuando una OT no tiene duración registrada, se asume 8h en vez
  // de dejarla fuera del promedio (ver tooltip de la tarjeta más abajo: esto es
  // una ESTIMACIÓN, no un dato medido, para no perder la OT del cálculo).
  var otFallasMes=ot.filter(function(o){return(o.tipo==='Correctivo'||o.tipo==='Falla Operacional')&&(o.fecha||o.fechaEntrada||'').slice(0,7)===dashPeriodo;});
  var otFallasMesSinDuracion=otFallasMes.filter(function(o){return!o.duracion||!o.duracion.match(/(\d+)h/);}).length;
  var mttrF=otFallasMes.length>0?Math.round(otFallasMes.reduce(function(s,o){var d=0;if(o.duracion){var m=o.duracion.match(/(\d+)h/);if(m)d=parseInt(m[1]);}return s+(d||8);},0)/otFallasMes.length*10)/10:0;
  var dispInh=(mtbfFlota&&mtbfFlota>0)?Math.round(mtbfFlota/(mtbfFlota+mttrF)*1000)/10:null;
  // Backlog en semanas (HH pendientes / HH disponibles por semana). HH pendientes
  // asume 8h por OT sin duración propia (no hay otro dato disponible por OT). La
  // capacidad semanal SÍ tiene un dato real disponible — la dotación programada
  // en Programación Diaria (progDiaHoy, ya calculado arriba) — se usa cuando
  // existe; si no hay Programación Diaria cargada, cae a la estimación vieja
  // (5 técnicos por equipo × 8h), declarada como tal en el tooltip de la tarjeta.
  var hhPend=otPend*8;
  var dotacionReal=progDiaHoy?[...new Set(progDiaTodo.filter(function(p){return p.fecha===progDiaUltima;}).map(function(p){return p.nombre;}).filter(Boolean))].length:0;
  var hhSemFuente=dotacionReal>0?'real':'estimado';
  var hhSem=(dotacionReal>0?dotacionReal:eq.length*5)*8;
  var backlogSem=hhSem>0?Math.round(hhPend/hhSem*10)/10:0;
  // Costo/RAV — el benchmark de la industria (<2-3%) es ANUAL; costoTotal acá es
  // de UN mes, así que se anualiza (×12) para comparar en la misma escala. Antes
  // se comparaba el gasto de 1 mes directo contra el benchmark anual, mostrando
  // un número ~12x más sano de lo real.
  var totalRAV=eq.reduce(function(s,e){return s+(e.valorCompra||0)},0);
  var costoRAV=totalRAV>0?Math.round(costoTotal*12/totalRAV*10000)/100:0;
  // Retrabajo (fallas repetidas en mismo equipo+componente dentro de 30 días).
  // Antes comparaba cada OT del período contra TODAS las OT del sistema (O(n²)) en
  // una función que corre después de casi cada guardado de la app. Se agrupa primero
  // por sigla+componente (O(n)) y solo se compara dentro de cada grupo — mismos pares,
  // mismo resultado, sin recorrer registros de otro equipo/componente en vano.
  var gruposOtPorClave={};
  ot.forEach(function(o,i){
    if(!o.sigla||!o.componente)return;
    var k=o.sigla+'|'+o.componente;
    (gruposOtPorClave[k]=gruposOtPorClave[k]||[]).push({idx:i,fecha:o.fecha});
  });
  var retrab=0,retrabT=0;
  ot.forEach(function(o1,i1){
    if(!o1.sigla||!o1.componente)return;
    if((o1.fecha||o1.fechaEntrada||'').slice(0,7)!==dashPeriodo)return;
    retrabT++;
    var f1=new Date(o1.fecha||'2026-01-01').getTime();
    (gruposOtPorClave[o1.sigla+'|'+o1.componente]||[]).forEach(function(o2){
      if(o2.idx<=i1)return;
      if(Math.abs(new Date(o2.fecha||'2026-01-01').getTime()-f1)<2592000000)retrab++;
    });
  });
  var pctRetrab=retrabT>0?Math.round(retrab/retrabT*100):null;
  // Cumpl. Programa: solo mostrar si hay datos reales en planSemHist
  var hasPlanData=progPlan>0;
  // Criticidad por tipo
  var eqCrit=eq.filter(function(e){return e.criticidad==='Crítico'}).length;
  var eqEsen=eq.filter(function(e){return e.criticidad==='Esencial'}).length;
  var eqGral=eq.length-eqCrit-eqEsen;

  // ═══ ÍNDICE DE SALUD DE FLOTA — un solo número que resume las 4 dimensiones de
  // arriba (Cumplimiento PM, Disponibilidad, Stock sano, Confiabilidad), con
  // tendencia semana a semana. Solo se registra el snapshot del día (y solo tiene
  // sentido mostrar tendencia) viendo el mes ACTUAL — un mes histórico/proyectado
  // no es "el estado de hoy" y guardarlo ahí ensuciaría la serie de tiempo real.
  // Denominador: equipos REALMENTE clasificados (alDia+urg+prox), no eq.length.
  // En vivo (esMesActual) son lo mismo — todo equipo cae en una de las 3 bandas.
  // Pero para un mes histórico/proyectado, C.estadoPeriodo excluye a propósito los
  // equipos sin dato para esa fecha (arriba, línea ~51: "if(!r)return" — no inventa
  // un número), así que dividir por eq.length subestimaba el cumplimiento cada vez
  // que algún equipo no tenía historial para el mes elegido.
  var totalClasificadosPM=alDia.length+urg.length+prox.length;
  var cumplPM=totalClasificadosPM?Math.round(alDia.length/totalClasificadosPM*1000)/10:null;
  var totalStkSalud=stkOk+stkBajo+stkCrit;
  var stockSano=totalStkSalud?Math.round(stkOk/totalStkSalud*1000)/10:null;
  var salud=indiceSaludFlota({cumplPM:cumplPM,disponibilidad:dispFlota,stockSano:stockSano,confiabilidad:idxConf});
  var tendenciaSalud=null;
  if(esMesActual&&salud.valor!=null){
    var histSaludPrevio=S.g('saludFlotaHist')||{};
    var histSaludNuevo=registrarSnapshotSalud(histSaludPrevio,salud.valor,_hoyISO);
    if(JSON.stringify(histSaludNuevo)!==JSON.stringify(histSaludPrevio))S.s('saludFlotaHist',histSaludNuevo);
    tendenciaSalud=tendenciaSaludSemanal(histSaludNuevo,_hoyISO);
  }
  var saludCol=salud.valor==null?'var(--bd)':salud.valor>=85?'#22c55e':salud.valor>=70?'#f59e0b':'#ef4444';

  $('s-dash').innerHTML=

    // ═══ SELECTOR DE PERÍODO ═══
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:10px 14px;background:var(--bg3);border-radius:10px;flex-wrap:wrap">'+
    '<span style="font-size:12px;color:var(--tx3);font-weight:600"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Período del tablero:</span>'+
    '<select id="dashMesSel" onchange="dashSetPeriodo()" style="background:var(--bg);border:1px solid var(--bd);color:var(--tx);border-radius:6px;padding:5px 8px;font-size:12px">'+
    _MESNOM.map(function(m,i){return '<option value="'+(i+1)+'"'+(dashMes===i+1?' selected':'')+'>'+m+'</option>';}).join('')+
    '</select>'+
    '<select id="dashAnioSel" onchange="dashSetPeriodo()" style="background:var(--bg);border:1px solid var(--bd);color:var(--tx);border-radius:6px;padding:5px 8px;font-size:12px">'+
    [dashAnio-2,dashAnio-1,dashAnio,dashAnio+1].filter(function(v,i,a){return a.indexOf(v)===i;}).map(function(y){return '<option value="'+y+'"'+(dashAnio===y?' selected':'')+'>'+y+'</option>';}).join('')+
    '</select>'+
    '<button class="btn-s btn-o" onclick="dashHoy()">Hoy</button>'+
    '<span style="font-size:11px;color:var(--tx3);margin-left:auto">Mostrando: <b style="color:var(--ac)">'+dashLabel+'</b></span>'+
    '</div>'+

    // ═══ ÍNDICE DE SALUD DE FLOTA — un solo número, arriba de todo ═══
    '<div style="background:linear-gradient(145deg,var(--bg3),var(--bg4));border-radius:14px;padding:18px 22px;margin-bottom:20px;border:2px solid '+saludCol+';display:flex;align-items:center;gap:22px;flex-wrap:wrap">'+
    '<div style="text-align:center;min-width:150px">'+
    '<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:var(--tx3)">Índice de Salud de Flota</div>'+
    '<div style="font-size:48px;font-weight:900;color:'+saludCol+';line-height:1;margin:4px 0">'+(salud.valor==null?'—':salud.valor)+(salud.valor==null?'':'<span style="font-size:20px">%</span>')+'</div>'+
    (esMesActual?
      (tendenciaSalud&&tendenciaSalud.delta!=null?
        '<div style="font-size:11px;font-weight:600;color:'+(tendenciaSalud.delta>0?'#22c55e':tendenciaSalud.delta<0?'#ef4444':'var(--tx3)')+'">'+(tendenciaSalud.delta>0?'▲':tendenciaSalud.delta<0?'▼':'→')+' '+Math.abs(tendenciaSalud.delta)+' pts vs hace 7 días</div>'
        :'<div style="font-size:10px;color:var(--tx3)">Sin dato de hace 7 días aún</div>')
      :'<div style="font-size:10px;color:var(--tx3)">Tendencia solo viendo el mes actual</div>')+
    '</div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;flex:1">'+
    salud.detalle.map(function(c){
      var col=c.valor==null?'var(--tx3)':c.valor>=85?'#22c55e':c.valor>=70?'#f59e0b':'#ef4444';
      return '<div style="background:var(--bg4);border-radius:8px;padding:8px 14px;text-align:center;min-width:96px">'+
        '<div style="font-size:9px;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">'+c.nombre+'</div>'+
        '<div style="font-size:17px;font-weight:700;color:'+col+'">'+(c.valor==null?'—':c.valor+'%')+'</div></div>';
    }).join('')+
    '</div></div>'+

    // ═══ Z1: ARRIBA IZQUIERDA — KPI PRINCIPAL ═══
    // Disponibilidad grande — lo primero que ve el ojo
    '<div class="dg1" style="display:grid;grid-template-columns:300px 1fr;gap:20px;margin-bottom:24px">'+

    '<div style="background:linear-gradient(145deg,var(--bg3),var(--bg4));border-radius:14px;padding:24px;text-align:center;border:2px solid '+dispCol+';position:relative" title="Disponibilidad física/mecánica = (horas disponibles del día − horas caídas) / horas disponibles, promediado día a día del mes. Cuando un registro de PM o correctivo no tiene duración registrada, se asume 4h (PM) u 8h (correctivo) para no perderlo del cálculo — son estimaciones, no datos medidos.">'+
    '<div style="font-size:10px;text-transform:uppercase;letter-spacing:3px;color:var(--tx3);margin-bottom:4px">DISPONIBILIDAD MECÁNICA</div>'+
    '<div style="font-size:64px;font-weight:900;color:'+dispCol+';line-height:1;margin:8px 0">'+(dispFlota===null?'—':dispFlota)+(dispFlota===null?'':'<span style="font-size:28px">%</span>')+'</div>'+
    '<div style="margin:10px auto;width:85%;background:color-mix(in srgb,'+dispCol+' 18%,var(--bg4));border-radius:10px;height:12px;overflow:hidden;cursor:default" onmouseenter="vizTip(event,\''+(dispFlota===null?'Sin equipos con datos de disponibilidad en '+dashLabel:dispVals.length+' equipos con dato · promedio '+dispFlota+'% · meta '+meta+'%')+'\')" onmousemove="vizTipMove(event)" onmouseleave="vizTipHide()"><div style="background:'+dispCol+';height:100%;width:'+Math.min(dispFlota||0,100)+'%;border-radius:10px;transition:width .5s"></div></div>'+
    '<div style="font-size:11px;color:'+dispCol+';font-weight:600">'+(dispFlota===null?'Sin datos para este período':dispFlota>=meta?'<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> Sobre meta '+meta+'%':'<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> '+Math.round(meta-dispFlota)+'% bajo meta')+'</div>'+
    '<div style="font-size:9px;color:var(--tx3);margin-top:6px">'+dispVals.length+' equipos · '+dashLabel+'</div>'+
    '</div>'+

    // ═══ Z2: ARRIBA DERECHA — CONTEXTO / ESTADO GENERAL ═══
    '<div class="dg2" style="display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:1fr 1fr;gap:10px">'+

    // Fila 1: Estado de flota
    '<div style="background:var(--bg3);border-radius:10px;padding:14px;border-left:4px solid #ef4444">'+
    '<div style="font-size:9px;text-transform:uppercase;color:var(--tx3);letter-spacing:1px">Urgentes'+(dashFuente==='historico'?' (reconstruido)':dashFuente==='proyectado'?' (estimado)':'')+'</div>'+
    '<div style="font-size:32px;font-weight:800;color:#ef4444;line-height:1.2">'+urg.length+'</div>'+
    '<div style="font-size:9px;color:var(--tx3)">'+(urg.length?urg.slice(0,2).map(function(e){return escapeHtml(e.sigla)}).join(', '):(dashFuente==='vivo'?'—':'En '+dashLabel))+'</div></div>'+

    '<div style="background:var(--bg3);border-radius:10px;padding:14px;border-left:4px solid #f59e0b">'+
    '<div style="font-size:9px;text-transform:uppercase;color:var(--tx3);letter-spacing:1px">Próximas'+(dashFuente==='historico'?' (reconstruido)':dashFuente==='proyectado'?' (estimado)':'')+'</div>'+
    '<div style="font-size:32px;font-weight:800;color:#f59e0b;line-height:1.2">'+prox.length+'</div>'+
    '<div style="font-size:9px;color:var(--tx3)">'+(dashFuente==='vivo'?'En plan mensual':dashFuente==='historico'?'Reconstruido desde historial':'Estimado por horas/día')+'</div></div>'+

    '<div style="background:var(--bg3);border-radius:10px;padding:14px;border-left:4px solid '+(cum===null?'var(--bd)':cum>=80?'#22c55e':'#ef4444')+'">'+
    '<div style="font-size:9px;text-transform:uppercase;color:var(--tx3);letter-spacing:1px" title="% de PMs/correctivos ejecutados a tiempo o antes de su fecha esperada. Registros sin fecha esperada de referencia (ej. importados por CSV) no se pueden evaluar y quedan fuera del cálculo.">Cumplimiento PM</div>'+
    '<div style="font-size:32px;font-weight:800;color:'+(cum===null?'var(--tx3)':cum>=80?'#22c55e':'#ef4444')+';line-height:1.2">'+(cum===null?'—':cum+'%')+'</div>'+
    '<div style="font-size:9px;color:var(--tx3)">'+(cum===null?'Sin PMs evaluables en '+dashLabel:ant+' de '+regClasifPeriodo.length+' PMs evaluables'+(regMes.length>regClasifPeriodo.length?' ('+(regMes.length-regClasifPeriodo.length)+' sin fecha esperada)':''))+'</div></div>'+
     '<div style="background:var(--bg3);border-radius:10px;padding:14px;border-left:4px solid '+(hasPlanData?(cumProg>=85?'#22c55e':cumProg>=70?'#f59e0b':'#ef4444'):'var(--bd)')+'">'+
     '<div style="font-size:9px;text-transform:uppercase;color:var(--tx3);letter-spacing:1px">Cumpl. Programa</div>'+
     '<div style="font-size:32px;font-weight:800;color:'+(hasPlanData?(cumProg>=85?'#22c55e':cumProg>=70?'#f59e0b':'#ef4444'):'var(--tx3)')+';line-height:1.2">'+(hasPlanData?cumProg+'%':'—')+'</div>'+
     '<div style="font-size:9px;color:var(--tx3)">'+(hasPlanData?progEjec+' de '+progPlan+' a tiempo':'Cerrar semanas en Plan Semanal')+'</div></div>'+

    // Fila 2: Indicadores técnicos
    '<div style="background:var(--bg3);border-radius:10px;padding:14px;border-left:4px solid '+(mtbfFlota?(mtbfFlota>2000?'#22c55e':mtbfFlota>500?'#f59e0b':'#ef4444'):'var(--bd)')+'" title="MTBF real de flota: promedio del intervalo real entre fallas sucesivas de cada equipo (horómetro registrado en cada falla), con todo su historial — no se acota al mes elegido, un solo mes casi nunca tiene fallas suficientes para un promedio representativo. Fórmula estándar RAM/ISO 14224.">'+
    '<div style="font-size:9px;text-transform:uppercase;color:var(--tx3);letter-spacing:1px">MTBF Real de Flota</div>'+
    '<div style="font-size:28px;font-weight:800;color:'+(mtbfFlota?(mtbfFlota>2000?'#22c55e':mtbfFlota>500?'#f59e0b':'#ef4444'):'var(--tx3)')+';line-height:1.2">'+(mtbfFlota?mtbfFlota+'<span style="font-size:12px">h</span>':'—')+'</div>'+
    '<div style="font-size:9px;color:var(--tx3)">'+(mtbfFlota?totalFallas+' fallas en '+dashLabel+' · todo el historial':'Sin equipos con ≥2 fallas registradas')+'</div></div>'+

    '<div style="background:var(--bg3);border-radius:10px;padding:14px;border-left:4px solid var(--ac)">'+
    '<div style="font-size:9px;text-transform:uppercase;color:var(--tx3);letter-spacing:1px">Gasto '+dashLabel+'</div>'+
    '<div style="font-size:22px;font-weight:800;color:var(--ac);line-height:1.2">$'+Math.round(costoTotal/1000).toLocaleString()+'K</div>'+
    '<div style="font-size:9px;color:var(--tx3)">'+(ordenes.length?'OC reales del mes':'estimado')+'</div></div>'+

    '<div style="background:var(--bg3);border-radius:10px;padding:14px;border-left:4px solid '+(otPend>0?'#ef4444':'#22c55e')+'">'+
    '<div style="font-size:9px;text-transform:uppercase;color:var(--tx3);letter-spacing:1px">Backlog</div>'+
    '<div style="font-size:28px;font-weight:800;color:'+(otPend>0?'#ef4444':'#22c55e')+';line-height:1.2">'+otPend+'</div>'+
    '<div style="font-size:9px;color:var(--tx3)">'+otEjec+' en ejec · '+otCerr+' cerradas en '+dashLabel+'</div></div>'+

    '</div></div>'+

    // ═══ KPIs AVANZADOS ROW ═══
    '<div class="dg2" style="display:grid;grid-template-columns:repeat(8,1fr);gap:8px;margin-bottom:20px">'+
    '<div style="background:var(--bg3);border-radius:8px;padding:10px;text-align:center;border-top:3px solid '+(stkCrit===0?'#22c55e':stkCrit<=3?'#f59e0b':'#ef4444')+'" title="Ítems por comprar / bajo stock / OK"><div style="font-size:9px;text-transform:uppercase;color:var(--tx3)">Stock Crítico</div><div style="font-size:20px;font-weight:800;color:'+(stkCrit===0?'#22c55e':stkCrit<=3?'#f59e0b':'#ef4444')+'">'+stkCrit+'</div><div style="font-size:8px;color:var(--tx3)">🔴'+stkCrit+' · <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg>'+stkBajo+' · <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg>'+stkOk+'</div></div>'+
    '<div style="background:var(--bg3);border-radius:8px;padding:10px;text-align:center;border-top:3px solid '+(totalRAV===0?'var(--bd)':costoRAV<2?'#22c55e':costoRAV<3?'#f59e0b':'#ef4444')+'" title="Gasto de mantención ÷ Valor de Reemplazo de Activo (RAV), ANUALIZADO (gasto del mes ×12) para comparar contra el benchmark de industria (&lt;2-3% anual) en la misma escala."><div style="font-size:9px;text-transform:uppercase;color:var(--tx3)">Costo/RAV</div><div style="font-size:20px;font-weight:800;color:'+(totalRAV===0?'var(--tx3)':costoRAV<2?'#22c55e':costoRAV<3?'#f59e0b':'#ef4444')+'">'+(totalRAV===0?'—':costoRAV+'%')+'</div><div style="font-size:8px;color:var(--tx3)">'+(totalRAV===0?'Sin valor de compra (RAV) cargado':'Anualizado · Meta: &lt;2%')+'</div></div>'+
    '<div style="background:var(--bg3);border-radius:8px;padding:10px;text-align:center;border-top:3px solid '+(backlogSem<=4?'#22c55e':backlogSem<=6?'#f59e0b':'#ef4444')+'" title="HH pendientes (OT abiertas × 8h, único dato disponible por OT) ÷ capacidad semanal (dotación'+(hhSemFuente==='real'?' real de Programación Diaria: '+dotacionReal+' personas':' ESTIMADA: 5 técnicos por equipo, sin dato real de dotación cargado')+' × 5 días × 8h)."><div style="font-size:9px;text-transform:uppercase;color:var(--tx3)">Backlog</div><div style="font-size:20px;font-weight:800;color:'+(backlogSem<=4?'#22c55e':backlogSem<=6?'#f59e0b':'#ef4444')+'">'+backlogSem+'<span style="font-size:10px">sem</span></div><div style="font-size:8px;color:var(--tx3)">Sano: 2-4 · dotación '+(hhSemFuente==='real'?'real':'estimada')+'</div></div>'+
    '<div style="background:var(--bg3);border-radius:8px;padding:10px;text-align:center;border-top:3px solid '+(idxConf>=85?'#22c55e':idxConf>=70?'#f59e0b':'#ef4444')+'" title="Conteo simple, NO es una probabilidad de confiabilidad: % de equipos que no tuvieron NINGÚN correctivo/falla operacional este mes. Para la confiabilidad estadística real (R), ver la tarjeta Confiabilidad (R) más adelante."><div style="font-size:9px;text-transform:uppercase;color:var(--tx3)">% Flota sin falla</div><div style="font-size:20px;font-weight:800;color:'+(idxConf>=85?'#22c55e':idxConf>=70?'#f59e0b':'#ef4444')+'">'+idxConf+'%</div><div style="font-size:8px;color:var(--tx3)">Eq sin falla en '+dashLabel+'</div></div>'+
    '<div style="background:var(--bg3);border-radius:8px;padding:10px;text-align:center;border-top:3px solid '+(confReal==null?'var(--bd)':confReal>=85?'#22c55e':confReal>=60?'#f59e0b':'#ef4444')+'" title="Confiabilidad estadística real: R(t)=e^(-t/MTBF) — probabilidad de que un equipo promedio NO falle durante las horas que opera en '+dashLabel+', asumiendo tasa de falla constante (supuesto estándar RAM/ISO 14224 cuando solo se tiene el MTBF). Requiere MTBF real (≥2 fallas por equipo)."><div style="font-size:9px;text-transform:uppercase;color:var(--tx3)">Confiabilidad (R)</div><div style="font-size:20px;font-weight:800;color:'+(confReal==null?'var(--tx3)':confReal>=85?'#22c55e':confReal>=60?'#f59e0b':'#ef4444')+'">'+(confReal==null?'—':confReal+'%')+'</div><div style="font-size:8px;color:var(--tx3)">'+(confReal==null?'Sin MTBF suficiente':'R(t)=e^(-t/MTBF)')+'</div></div>'+
    '<div style="background:var(--bg3);border-radius:8px;padding:10px;text-align:center;border-top:3px solid '+(dispInh?(dispInh>=90?'#22c55e':dispInh>=80?'#f59e0b':'#ef4444'):'var(--bd)')+'" title="Disponibilidad Inherente = MTBF/(MTBF+MTTR), fórmula estándar RAM/ISO 14224. MTTR: cuando una OT no tiene duración registrada se asume 8h para no perderla del promedio ('+otFallasMesSinDuracion+' de '+otFallasMes.length+' OT de '+dashLabel+' sin duración registrada) — es una estimación, no un dato medido."><div style="font-size:9px;text-transform:uppercase;color:var(--tx3)">Disp. Inherente</div><div style="font-size:20px;font-weight:800;color:'+(dispInh?(dispInh>=90?'#22c55e':dispInh>=80?'#f59e0b':'#ef4444'):'var(--tx3)')+'">'+( dispInh?dispInh+'%':'—')+'</div><div style="font-size:8px;color:var(--tx3)">MTBF/(MTBF+MTTR)</div></div>'+
    '<div style="background:var(--bg3);border-radius:8px;padding:10px;text-align:center;border-top:3px solid '+(pctRetrab===null?'var(--bd)':pctRetrab<=5?'#22c55e':pctRetrab<=10?'#f59e0b':'#ef4444')+'"><div style="font-size:9px;text-transform:uppercase;color:var(--tx3)">Retrabajo</div><div style="font-size:20px;font-weight:800;color:'+(pctRetrab===null?'var(--tx3)':pctRetrab<=5?'#22c55e':pctRetrab<=10?'#f59e0b':'#ef4444')+'">'+(pctRetrab===null?'—':pctRetrab+'%')+'</div><div style="font-size:8px;color:var(--tx3)">'+(pctRetrab===null?'Sin fallas en el período':'Meta: &lt;5%')+'</div></div>'+
    '<div style="background:var(--bg3);border-radius:8px;padding:10px;text-align:center;border-top:3px solid #8b5cf6"><div style="font-size:9px;text-transform:uppercase;color:var(--tx3)">Criticidad</div><div style="font-size:11px;font-weight:700"><span style="color:#ef4444">'+eqCrit+'</span> Crít · <span style="color:#f59e0b">'+eqEsen+'</span> Esen · <span style="color:#22c55e">'+eqGral+'</span> Gen</div><div style="font-size:8px;color:var(--tx3)">'+eq.length+' equipos</div></div>'+
    '<div style="background:var(--bg3);border-radius:8px;padding:10px;text-align:center;border-top:3px solid '+(utilDia==null?'var(--bd)':utilDia<40?'#f59e0b':utilDia>85?'#ef4444':'#22c55e')+'" title="Bloques de 30 min con trabajo productivo (excluye charla, colación, vacaciones, licencia; incluye comisión de servicio) vs. disponibles, según Programación Diaria"><div style="font-size:9px;text-transform:uppercase;color:var(--tx3)">Dotación (Prog. Diaria)</div><div style="font-size:20px;font-weight:800;color:'+(utilDia==null?'var(--tx3)':utilDia<40?'#f59e0b':utilDia>85?'#ef4444':'#22c55e')+'">'+(utilDia==null?'—':utilDia+'%')+'</div><div style="font-size:8px;color:var(--tx3)">'+(progDiaUltima?progDiaUltima:'Sin datos importados')+'</div></div>'+
    '</div>'+

        // ═══ Z3: ABAJO IZQUIERDA — DESGLOSE / TENDENCIA ═══
    '<div class="dg1" style="display:grid;grid-template-columns:1fr 1.8fr 1fr;gap:16px;margin-bottom:24px">'+

    // Ratio Mantención: una proporción contra una meta → medidor (meter), no un donut de 2 rebanadas
    '<div class="chart-box" style="padding:16px"><div class="chart-t">Ratio Mantención · '+dashLabel+'</div>'+
    (function(){
      var totalPC=prev+corr;
      if(!totalPC)return'<div style="color:var(--tx3);text-align:center;padding:30px 10px;font-size:11px">Sin intervenciones registradas</div>';
      var mCol=prevPct>=80?'#22c55e':prevPct>=60?'#f59e0b':'#ef4444';
      var tipTxt='Preventivo: '+prev+' · Correctivo: '+corr+' de '+totalPC+' intervenciones';
      return '<div style="text-align:center;padding:6px 0 0">'+
        '<div style="font-size:36px;font-weight:800;color:'+mCol+';line-height:1">'+prevPct+'<span style="font-size:15px">%</span></div>'+
        '<div style="font-size:9px;color:var(--tx3);margin:4px 0 12px">preventivo del total de intervenciones</div>'+
        '<div style="position:relative;background:color-mix(in srgb,'+mCol+' 18%,var(--bg4));border-radius:8px;height:14px;overflow:hidden;cursor:default" onmouseenter="vizTip(event,\''+tipTxt+'\')" onmousemove="vizTipMove(event)" onmouseleave="vizTipHide()">'+
        '<div style="position:absolute;left:80%;top:-3px;bottom:-3px;width:2px;background:var(--tx3);z-index:2"></div>'+
        '<div style="background:'+mCol+';height:100%;width:'+Math.min(prevPct,100)+'%;border-radius:8px;transition:width .5s"></div></div>'+
        '<div style="display:flex;justify-content:space-between;font-size:9px;color:var(--tx3);margin-top:6px"><span>Meta: 80%</span><span>'+totalPC+' interv.</span></div>'+
        '<div style="display:flex;gap:14px;justify-content:center;margin-top:12px">'+
        '<span style="font-size:9px;color:var(--tx3);display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:'+mCol+';display:inline-block"></span>Preventivo ('+prev+')</span>'+
        '<span style="font-size:9px;color:var(--tx3);display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:var(--bg4);border:1px solid var(--tx3);display:inline-block"></span>Correctivo ('+corr+')</span>'+
        '</div></div>';
    })()+
    '</div>'+

    '<div class="chart-box" style="padding:16px"><div class="chart-t">Ejecuciones por Mes '+new Date().getFullYear()+'</div>'+
    '<div class="bars" style="height:140px">'+pm.map(function(v,i){
      var isCurrentOrPast=i<=new Date().getMonth();
      var tipTxt=MS[i]+': '+v+' ejecuciones'+(isCurrentOrPast?'':' (mes futuro)');
      return'<div class="bar-c"><div class="bar-v" style="font-size:10px;font-weight:600">'+(v||'')+'</div><div class="bar" style="height:'+Math.max(v/mx*100,3)+'%;background:'+(isCurrentOrPast?'var(--ac)':'var(--bd)')+';cursor:default" onmouseenter="vizTip(event,\''+tipTxt+'\')" onmousemove="vizTipMove(event)" onmouseleave="vizTipHide()"></div><div class="bar-l" style="font-size:9px">'+MS[i]+'</div></div>'
    }).join('')+'</div></div>'+

    '<div class="chart-box" style="padding:16px"><div class="chart-t">Distribución PM · '+dashLabel+'</div>'+
    '<div style="padding:10px 0">'+["PM1","PM2","PM3","PM4"].map(function(p,i){
      var v=pmC[p]||0;var total=regMes.length||1;var pct=Math.round(v/total*100);
      var colors=["#22c55e","#3b82f6","#f59e0b","#ef4444"];
      var tipTxt=p+': '+v+' de '+total+' ('+pct+'%)';
      // Identidad la lleva el swatch de color, no el texto (el texto usa tinta neutra)
      return'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:default" onmouseenter="vizTip(event,\''+tipTxt+'\')" onmousemove="vizTipMove(event)" onmouseleave="vizTipHide()">'+
        '<div style="width:44px;font-size:10px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:'+colors[i]+';display:inline-block;flex-shrink:0"></span>'+p+'</div>'+
        '<div style="flex:1;background:color-mix(in srgb,'+colors[i]+' 18%,var(--bg4));border-radius:4px;height:14px;overflow:hidden"><div style="background:'+colors[i]+';height:100%;width:'+pct+'%;border-radius:4px"></div></div>'+
        '<div style="width:40px;text-align:right;font-size:10px;font-weight:600;color:var(--tx)">'+v+'</div></div>';
    }).join('')+
    (corr?(function(){var pctC=Math.round(corr/(regMes.length||1)*100);var tipTxt='Correctivo: '+corr+' de '+(regMes.length||1)+' ('+pctC+'%)';return'<div style="display:flex;align-items:center;gap:8px;cursor:default" onmouseenter="vizTip(event,\''+tipTxt+'\')" onmousemove="vizTipMove(event)" onmouseleave="vizTipHide()"><div style="width:44px;font-size:10px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:#64748b;display:inline-block;flex-shrink:0"></span>Corr</div><div style="flex:1;background:color-mix(in srgb,#64748b 18%,var(--bg4));border-radius:4px;height:14px;overflow:hidden"><div style="background:#64748b;height:100%;width:'+pctC+'%;border-radius:4px"></div></div><div style="width:40px;text-align:right;font-size:10px;font-weight:600;color:var(--tx)">'+corr+'</div></div>';})():'')+
    '</div></div>'+

    '</div>'+

    // ═══ Z4: ABAJO DERECHA — ACCIÓN ═══
    '<div class="dg1" style="display:grid;grid-template-columns:1fr 280px;gap:16px">'+

    '<div class="chart-box" style="padding:16px"><div class="chart-t" style="color:#ef4444;font-size:13px">🔴 Equipos Urgentes — Intervenir Ahora'+(dashFuente==='vivo'?'':' · '+dashLabel+(dashFuente==='historico'?' (reconstruido)':' (estimado)'))+'</div>'+
    (urg.length?
    '<div class="tbl-wrap"><table style="font-size:11px">'+
    '<tr><th>Equipo</th><th>Tipo</th><th>Modelo</th><th>Horóm.</th><th>Próx PM</th><th>Días</th><th>PM</th></tr>'+
    urg.map(function(e){return'<tr>'+
      '<td class="mono" style="color:var(--ac);font-weight:700">'+escapeHtml(e.sigla)+'</td>'+
      '<td>'+escapeHtml(e.tipo)+'</td>'+
      '<td style="font-size:10px">'+escapeHtml(e.modelo)+'</td>'+
      '<td class="mono">'+fn(e.horomActual)+'</td>'+
      '<td class="mono">'+fn(e.horomProxPM)+'</td>'+
      '<td class="mono" style="color:#ef4444;font-weight:700">'+e.diasParaPM+'</td>'+
      '<td>'+pb(e.tipoPM)+'</td></tr>'}).join('')+
    '</table></div>'
    :'<div style="padding:20px;text-align:center;color:var(--ok)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> Sin equipos urgentes</div>')+
    '</div>'+

    // Resumen rápido lateral
    '<div style="display:flex;flex-direction:column;gap:10px">'+
    '<div style="background:var(--bg3);border-radius:10px;padding:14px;text-align:center">'+
    '<div style="font-size:9px;text-transform:uppercase;color:var(--tx3);letter-spacing:1px">Flota</div>'+
    '<div style="font-size:28px;font-weight:800;color:var(--tx)">'+eq.length+'</div>'+
    '<div style="font-size:9px;color:var(--tx3)">'+Object.entries(tipos).map(function(t){return t[1]+' '+t[0]}).join(' · ')+'</div></div>'+

    '<div style="background:var(--bg3);border-radius:10px;padding:14px;text-align:center">'+
    '<div style="font-size:9px;text-transform:uppercase;color:var(--tx3);letter-spacing:1px">HH Acumuladas</div>'+
    '<div style="font-size:28px;font-weight:800;color:var(--ac)">'+hhTotal+'<span style="font-size:12px">h</span></div>'+
    '<div style="font-size:9px;color:var(--tx3)">'+reg.length+' intervenciones</div></div>'+

    '<div style="background:var(--bg3);border-radius:10px;padding:14px;text-align:center">'+
    '<div style="font-size:9px;text-transform:uppercase;color:var(--tx3);letter-spacing:1px">Al Día</div>'+
    '<div style="font-size:28px;font-weight:800;color:#22c55e">'+alDia.length+'</div>'+
    '<div style="font-size:9px;color:var(--tx3)">Sin intervención próxima</div></div>'+

    '</div></div>';

  // ═══ BLOQUE 2: PRÓXIMOS PMs — 14 DÍAS ═══
  var proxPMs=eq.filter(function(e){return e.diasParaPM>0&&e.diasParaPM<=14;}).sort(function(a,b){return a.diasParaPM-b.diasParaPM;}).slice(0,8);
  var proxBlock='';
  if(proxPMs.length){
    proxBlock+='<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:16px">';
    proxBlock+='<div style="font-weight:600;font-size:13px;margin-bottom:10px;color:var(--tx2);display:flex;align-items:center;gap:6px"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Próximos PMs <span style="font-size:11px;color:var(--tx3)">(próximos 14 días)</span></div>';
    proxBlock+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">';
    proxPMs.forEach(function(e){
      var bColor=e.diasParaPM<=3?'#ef4444':'#f59e0b';
      proxBlock+='<div style="background:var(--bg3);border-radius:8px;padding:10px 12px;border-left:3px solid '+bColor+'">';
      proxBlock+='<div style="font-weight:700;font-size:14px;color:var(--ac)">'+escapeHtml(e.sigla)+'</div>';
      proxBlock+='<div style="font-size:11px;color:var(--tx2);margin-top:2px">'+pb(e.tipoPM)+' · <b style="color:'+bColor+'">'+e.diasParaPM+'d</b></div>';
      proxBlock+='<div style="font-size:10px;color:var(--tx3);margin-top:2px">'+fd(e.fechaProxPM)+'</div>';
      proxBlock+='</div>';
    });
    proxBlock+='</div></div>';
  }

  // ═══ BLOQUE 3: TENDENCIA DISPONIBILIDAD 6 MESES ═══
  var meses6=[];
  for(var mi=5;mi>=0;mi--){var md=new Date();md.setMonth(md.getMonth()-mi);meses6.push(md.toISOString().slice(0,7));}
  var dispTrend6=meses6.map(function(m){
    var vals=eq.map(function(e){
      if(dispCalcD[e.sigla]&&dispCalcD[e.sigla][m]!==undefined)return dispCalcD[e.sigla][m];
      if(m==='2026-04'&&dAbr[e.sigla]!==undefined)return dAbr[e.sigla];
      return null;
    }).filter(function(v){return v!==null;});
    return vals.length?Math.round(vals.reduce(function(a,b){return a+b;},0)/vals.length*10)/10:null;
  });
  var maxTrend=Math.max.apply(null,dispTrend6.filter(function(v){return v!==null;}).concat([100]));
  var trendBlock='<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:16px">';
  trendBlock+='<div style="font-weight:600;font-size:13px;margin-bottom:10px;color:var(--tx2)"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,15 8,10 11,13 17,4"/><polyline points="12,4 17,4 17,9"/></svg> Tendencia Disponibilidad — Últimos 6 Meses</div>';
  trendBlock+='<div style="display:flex;align-items:flex-end;gap:8px;height:80px;padding-top:10px">';
  dispTrend6.forEach(function(v,i){
    var pct=v!==null?Math.max(v/maxTrend*100,2):2;
    var col=v!==null?(v>=meta?'#22c55e':v>=70?'#f59e0b':'#ef4444'):'var(--bg4)';
    var label=meses6[i].slice(5);
    trendBlock+='<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">';
    trendBlock+='<div style="font-size:9px;font-weight:600;color:'+(v!==null?col:'var(--tx3)')+'">'+( v!==null?v+'%':'—')+'</div>';
    trendBlock+='<div style="width:100%;border-radius:3px 3px 0 0;height:'+pct+'%;background:'+col+';min-height:2px"></div>';
    trendBlock+='<div style="font-size:9px;color:var(--tx3)">'+label+'</div>';
    trendBlock+='</div>';
  });
  trendBlock+='</div>';
  trendBlock+='<div style="margin-top:8px;font-size:10px;color:var(--tx3)">Meta: '+meta+'% · Verde ≥ meta · Amarillo ≥ 70% · Rojo < 70%</div>';
  trendBlock+='</div>';

  // Agregar los 3 bloques al innerHTML existente
  var dashEl=document.getElementById('s-dash');
  dashEl.innerHTML+=proxBlock+trendBlock;

  renderHeader();
};
