// Pestaña Disponibilidad Mecánica — extraída a su propio archivo (Fase 2 de
// modularización). Módulo ES real (Fase 3, 2026-08-30, quinta tanda:
// Equipos y Mantención) — ver nota de migración en mov.js (primera tanda,
// mismo patrón). dispDownMap/dispEquipoMes viven en logic.js (fuente única
// compartida). registrarSalidaServicio/guardarSalidaServicio/
// cerrarSalidaServicio quedan en index.html — cerrarSalidaServicio también
// lo usa renders.ot (aún sin extraer) para el mismo listado de "fuera de
// servicio en curso".
export function renderDisp(){
  var eq=S.g('eq')||[];
  var reg=S.g('reg')||[];
  var ot=S.g('ot')||[];
  var meta=S.g('dispMeta')||85;
  var fVista=$('fDispVista')?.value||'mensual';
  var fTipo=$('fDispTipo')?.value||'';
  var fAnio=$('fDispAnio')?.value||String(new Date().getFullYear());
  var mesActual=new Date().toISOString().slice(0,7);
  var fMes=$('fDispMes')?.value||mesActual;

  // Get all types for filter
  var tipos=[...new Set(eq.map(function(e){return e.tipo}))];

  // Filter equipment by type
  var eqFil=fTipo?eq.filter(function(e){return e.tipo===fTipo}):eq;

  // ═══ DISPONIBILIDAD — mapa de detenciones (fuente única compartida, ver logic.js) ═══
  var downMap=dispDownMap(reg,ot);

  // Get all dates from data
  var allDates=new Set();
  Object.values(downMap).forEach(function(d){Object.keys(d).forEach(function(k){allDates.add(k)})});
  allDates=Array.from(allDates).sort();

  // Also use INIT.dispAbril as fallback for monthly
  var dAbr=INIT.dispAbril||{};
  var dispCalc=S.g('dispCalc')||{};

  // Calculate daily availability for each equipment
  function calcDayDisp(sigla,fecha){
    var eqObj=eq.find(function(e){return e.sigla===sigla});
    var hrsDia=eqObj?eqObj.hrsDia||12:12;
    var down=(downMap[sigla]&&downMap[sigla][fecha])?downMap[sigla][fecha]:0;
    if(down>=hrsDia)return 0;
    return Math.round((hrsDia-down)/hrsDia*1000)/10;
  }

  // Disponibilidad mensual — misma función que usan KPI y Metas (ver dispEquipoMes en
  // logic.js). Devuelve undefined (no null) cuando no hay dato, para conservar los
  // chequeos `pct!==undefined` de esta pestaña.
  function calcMonthDisp(sigla,mes){
    var eqObj=eq.find(function(e){return e.sigla===sigla});
    if(!eqObj)return undefined;
    var v=dispEquipoMes(sigla,mes,{downMap:downMap,dispCalc:dispCalc,dAbr:dAbr,hrsDia:eqObj.hrsDia||12});
    return v==null?undefined:v;
  }

  // Get months and weeks from data
  var meses=[...new Set(allDates.map(function(d){return d.slice(0,7)}))].sort().reverse();
  if(!meses.length)meses=[mesActual];
  if(meses.indexOf('2026-04')<0&&dAbr&&Object.keys(dAbr).length)meses.unshift('2026-04');
  // Ensure all months of available years exist
  var availYears=[...new Set(meses.map(function(m){return m.slice(0,4)}))];
  var curYear=new Date().getFullYear();
  if(availYears.indexOf(String(curYear))<0)availYears.push(String(curYear));
  availYears.sort();
  availYears.forEach(function(y){for(var mi=1;mi<=12;mi++){var mk=y+'-'+('0'+mi).slice(-2);if(meses.indexOf(mk)<0)meses.push(mk);}});
  meses=meses.sort().reverse();

  // Get dates for selected month
  var mesDates=allDates.filter(function(d){return d.slice(0,7)===fMes}).sort();

  // Calculate fleet averages
  var flota={};
  if(fVista==='diario'){
    mesDates.forEach(function(d){
      var vals=eqFil.map(function(e){return calcDayDisp(e.sigla,d)});
      var prom=vals.length?Math.round(vals.reduce(function(s,v){return s+v},0)/vals.length*10)/10:0;
      flota[d]=prom;
    });
  }

  var content='';

  if(fVista==='mensual'){
    // ═══ VISTA MENSUAL ═══
    var eqDisp=eqFil.map(function(e){
      var pct=calcMonthDisp(e.sigla,fMes);
      // Cobertura de datos: distingue un % respaldado por registros reales de uno
      // asumido (100% solo porque no se cargó ninguna detención ese mes).
      var manual=!!(dispCalc[e.sigla]&&dispCalc[e.sigla][fMes]!==undefined)||(fMes==='2026-04'&&dAbr[e.sigla]!==undefined&&!(dispCalc[e.sigla]&&dispCalc[e.sigla][fMes]!==undefined));
      var diasReg=0;
      if(downMap[e.sigla])Object.keys(downMap[e.sigla]).forEach(function(dt){if(dt.slice(0,7)===fMes)diasReg++;});
      return{sigla:e.sigla,tipo:e.tipo,modelo:e.modelo,pct:pct,manual:manual,diasReg:diasReg};
    });
    var conDatos=eqDisp.filter(function(e){return e.pct!==undefined});
    var totalFlota=conDatos.length?Math.round(conDatos.reduce(function(s,e){return s+e.pct},0)/conDatos.length*10)/10:null;
    var bajoMeta=conDatos.filter(function(e){return e.pct<meta}).length;
    var sinRegistros=conDatos.filter(function(e){return !e.manual&&e.diasReg===0}).length;
    var col=totalFlota===null?'var(--tx3)':totalFlota>=meta?'var(--ok)':totalFlota>=70?'var(--w)':'var(--danger)';

    // ═══ DISPONIBILIDAD INTRÍNSECA (Ai) — mismo mes, mismo criterio de flota, pero
    // contando solo el tiempo perdido por fallas (correctivos), sin el PM planificado
    // (dispIntrinsecaEquipoMes, logic.js). La brecha Ao−Ai es la pregunta real de
    // gerencia: ¿la disponibilidad baja por fallas, o por la mantención que la empresa
    // misma programó? Solo se calcula en la vista mensual (donde vive el % de flota que
    // se compara contra meta) para no tocar diario/semanal/anual.
    var downMapCorrectivo=dispDownMap(reg,ot,undefined,{incluirPM:false});
    var aiVals=eqFil.map(function(e){return dispIntrinsecaEquipoMes(e.sigla,fMes,{downMapCorrectivo:downMapCorrectivo,hrsDia:e.hrsDia||12});}).filter(function(v){return v!==null;});
    var aiFlota=aiVals.length?Math.round(aiVals.reduce(function(s,v){return s+v},0)/aiVals.length*10)/10:null;
    var brechaAoAi=(totalFlota!==null&&aiFlota!==null)?Math.round((aiFlota-totalFlota)*10)/10:null;

    content=
    '<div style="display:flex;align-items:center;gap:16px;background:var(--bg3);border-radius:10px;padding:14px;margin-bottom:16px">'+
    '<div style="text-align:center;min-width:100px"><div style="font-size:36px;font-weight:800;color:'+col+'">'+(totalFlota===null?'—':totalFlota+'%')+'</div><div style="font-size:10px;color:var(--tx3)">FLOTA '+fMes+'</div></div>'+
    '<div style="flex:1">'+
    '<div style="background:color-mix(in srgb,'+col+' 18%,var(--bg4));border-radius:6px;height:18px;overflow:hidden;margin-bottom:6px;cursor:default" onmouseenter="vizTip(event,\''+(totalFlota===null?'Sin equipos con datos de disponibilidad este período':'Flota: '+totalFlota+'% · '+conDatos.length+' equipos con dato · '+bajoMeta+' bajo meta')+'\')" onmousemove="vizTipMove(event)" onmouseleave="vizTipHide()"><div style="background:'+col+';height:100%;width:'+Math.min(totalFlota||0,100)+'%"></div></div>'+
    '<div style="font-size:12px;color:'+col+'">'+(totalFlota===null?'Sin datos para este período':totalFlota>=meta?'<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> Sobre meta '+meta+'%':'<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> Bajo meta — '+Math.round(meta-totalFlota)+'% brecha')+(totalFlota===null?'':' · '+conDatos.length+' equipos · '+bajoMeta+' bajo meta')+'</div>'+
    (sinRegistros>0?'<div style="font-size:11px;color:var(--warn);margin-top:4px" title="Estos equipos no tienen ninguna detención cargada este mes, así que su 100% es asumido — el promedio de flota puede estar inflado hasta que cargues sus datos"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> '+sinRegistros+' equipo'+(sinRegistros===1?'':'s')+' sin registros este mes (100% asumido — cargá sus salidas de servicio para que el número sea real)</div>':'')+
    (aiFlota!==null?'<div style="font-size:11px;color:var(--tx3);margin-top:6px;padding-top:6px;border-top:1px solid var(--bg4)" title="Disponibilidad Operacional (Ao, arriba) cuenta fallas + PM planificado. Disponibilidad Intrínseca (Ai) cuenta SOLO fallas, sin el PM. La diferencia es cuánto de la indisponibilidad es mantención que la propia empresa programó, no un imprevisto.">Ai (solo fallas, sin PM): <b style="color:var(--tx)">'+aiFlota+'%</b>'+(brechaAoAi&&brechaAoAi>0.05?' · brecha Ao−Ai: <b style="color:var(--warn)">'+brechaAoAi+' pts</b> por PM planificado':'')+'</div>':'')+
    '</div></div>'+
    '<div class="tbl-wrap"><table>'+
    '<tr><th>Equipo</th><th>Tipo</th><th>Modelo</th><th>Disp. %</th><th>Barra</th><th>vs Meta</th><th title="Respaldo del número: registros reales de detención, valor cargado a mano, o asumido por falta de datos">Datos</th></tr>'+
    eqDisp.sort(function(a,b){return(a.pct||999)-(b.pct||999)}).map(function(e){
      if(e.pct===undefined)return'<tr><td class="mono">'+escapeHtml(e.sigla)+'</td><td>'+escapeHtml(e.tipo)+'</td><td style="font-size:11px">'+escapeHtml(e.modelo)+'</td><td colspan="4" style="color:var(--tx3)">Sin datos</td></tr>';
      var c=e.pct>=meta?'var(--ok)':e.pct>=70?'var(--w)':'var(--danger)';
      // Etiqueta de respaldo del dato
      var datos;
      if(e.manual)datos='<span class="badge b-b" title="Valor cargado a mano (override o import)">'+ICONS.pencil+' manual</span>';
      else if(e.diasReg>0)datos='<span style="font-size:10px;color:var(--tx3)" title="Días del mes con al menos una detención registrada"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> '+e.diasReg+' día'+(e.diasReg===1?'':'s')+' c/registro</span>';
      else datos='<span class="badge b-y" title="No hay ninguna detención cargada este mes — el % se asume completo. Cargá las salidas de servicio para que sea real."><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> sin registros</span>';
      return'<tr><td class="mono" style="color:var(--ac)">'+escapeHtml(e.sigla)+'</td><td style="font-size:11px">'+escapeHtml(e.tipo)+'</td><td style="font-size:11px">'+escapeHtml(e.modelo)+'</td>'+
        '<td class="mono ed" style="color:'+c+';font-weight:700" contenteditable onblur="var d=S.g(\'dispCalc\')||{};if(!d[\''+escapeHtml(e.sigla)+'\'])d[\''+escapeHtml(e.sigla)+'\']={}; d[\''+escapeHtml(e.sigla)+'\'][\''+fMes+'\']=parseFloat(this.innerText)||0;S.s(\'dispCalc\',d);refreshAll()">'+e.pct+'%</td>'+
        '<td>'+(function(){
          // Gauge circular (2026-08-24, mismo lenguaje que Dashboard/Equipos/Alertas
          // PM4/Vencimientos/Stock/Neumáticos): a diferencia de esas pantallas, acá el
          // anillo se llena EN EL MISMO SENTIDO que el %, no al revés — disponibilidad
          // es directamente "qué tan lleno/completo" está el mes, no una cuenta
          // regresiva hacia un umbral.
          var _dC=2*Math.PI*10,_dOff=Math.round((_dC*(1-Math.min(e.pct,100)/100))*100)/100;
          return '<div style="display:inline-flex;align-items:center;gap:6px"><svg viewBox="0 0 26 26" width="22" height="22" style="transform:rotate(-90deg);flex:none"><circle cx="13" cy="13" r="10" fill="none" stroke="var(--bg4)" stroke-width="3.5"></circle><circle class="gauge-ring" cx="13" cy="13" r="10" fill="none" stroke="'+c+'" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="'+_dC+'" stroke-dashoffset="'+_dC+'" data-off="'+_dOff+'"></circle></svg></div>';
        })()+'</td>'+
        '<td><span class="badge '+(e.pct>=meta?'b-g':e.pct>=70?'b-y':'b-r')+'">'+(e.pct>=meta?'<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> OK':'🔴 Bajo')+'</span></td>'+
        '<td>'+datos+'</td></tr>';
    }).join('')+
    '</table></div>';

  } else if(fVista==='diario'){
    // ═══ VISTA DIARIA ═══
    // Generate ALL days of month
    var yy=parseInt(fMes.slice(0,4)),mm=parseInt(fMes.slice(5,7));
    var daysInMonth=new Date(yy,mm,0).getDate();
    var today=new Date().toISOString().slice(0,10);
    mesDates=[];
    for(var dd=1;dd<=daysInMonth;dd++){
      var ds=fMes+'-'+('0'+dd).slice(-2);
      if(ds<=today)mesDates.push(ds);
    }
    if(!mesDates.length){content='<div style="padding:30px;text-align:center;color:var(--tx3)">Sin datos para '+fMes+'</div>';}
    else{
    var promFlota=Object.values(flota);
    var promGen=promFlota.length?Math.round(promFlota.reduce(function(s,v){return s+v},0)/promFlota.length*10)/10:0;
    var colG=promGen>=meta?'var(--ok)':'var(--danger)';
    content=
    '<div style="display:flex;align-items:center;gap:16px;background:var(--bg3);border-radius:10px;padding:14px;margin-bottom:16px">'+
    '<div style="text-align:center;min-width:100px"><div style="font-size:36px;font-weight:800;color:'+colG+'">'+promGen+'%</div><div style="font-size:10px;color:var(--tx3)">PROM DIARIO</div></div>'+
    '<div style="flex:1"><div style="font-size:12px;color:var(--tx3)">'+mesDates.length+' días con datos en '+fMes+'</div></div></div>'+
    '<div class="tbl-wrap" style="overflow-x:auto"><table>'+
    '<tr><th>Equipo</th><th>Tipo</th>'+mesDates.map(function(d){return'<th style="font-size:9px;writing-mode:vertical-lr;min-width:30px">'+d.slice(5)+'</th>'}).join('')+'<th>Prom</th></tr>'+
    eqFil.map(function(e){
      var vals=mesDates.map(function(d){return calcDayDisp(e.sigla,d)});
      var prom=vals.length?Math.round(vals.reduce(function(s,v){return s+v},0)/vals.length*10)/10:0;
      var pc=prom>=meta?'var(--ok)':prom>=70?'var(--w)':'var(--danger)';
      return'<tr><td class="mono" style="color:var(--ac);font-size:10px">'+escapeHtml(e.sigla)+'</td><td style="font-size:9px">'+escapeHtml(e.tipo)+'</td>'+
        vals.map(function(v){
          var vc=v>=meta?'var(--ok)':v>=70?'var(--w)':v<100?'var(--danger)':'var(--tx3)';
          var bg=v<meta?'rgba(239,68,68,.08)':'';
          return'<td class="mono" style="font-size:9px;text-align:center;color:'+vc+';background:'+bg+'">'+(v<100?v+'%':'100')+'</td>';
        }).join('')+
        '<td class="mono" style="font-weight:700;color:'+pc+'">'+prom+'%</td></tr>';
    }).join('')+
    '<tr style="font-weight:700;background:var(--bg3)"><td colspan="2">FLOTA</td>'+
    mesDates.map(function(d){var v=flota[d]||0;var c=v>=meta?'var(--ok)':'var(--danger)';return'<td class="mono" style="font-size:9px;text-align:center;color:'+c+'">'+v+'%</td>'}).join('')+
    '<td class="mono" style="color:'+colG+'">'+promGen+'%</td></tr>'+
    '</table></div>';}

  } else if(fVista==='semanal'){
    // ═══ VISTA SEMANAL ═══
    // Group dates by week
    var weeks={};
    var yyW=parseInt(fMes.slice(0,4)),mmW=parseInt(fMes.slice(5,7));
    var daysW=new Date(yyW,mmW,0).getDate();
    var todayW=new Date().toISOString().slice(0,10);
    var allDaysW=[];
    for(var dw=1;dw<=daysW;dw++){var dsw=fMes+'-'+('0'+dw).slice(-2);if(dsw<=todayW)allDaysW.push(dsw);}
    allDaysW.forEach(function(d){
      var dt=new Date(d);var w=Math.ceil(dt.getDate()/7);
      if(!weeks[w])weeks[w]=[];weeks[w].push(d);
    });
    var wKeys=Object.keys(weeks).sort(function(a,b){return a-b});
    if(!wKeys.length){content='<div style="padding:30px;text-align:center;color:var(--tx3)">Sin datos para '+fMes+'</div>';}
    else{
    content=
    '<div class="tbl-wrap"><table>'+
    '<tr><th>Equipo</th><th>Tipo</th>'+wKeys.map(function(w){return'<th>Sem '+w+'<br><span style="font-size:8px;color:var(--tx3)">'+weeks[w][0].slice(5)+' al '+weeks[w][weeks[w].length-1].slice(5)+'</span></th>'}).join('')+'<th>Prom</th></tr>'+
    eqFil.map(function(e){
      var wVals=wKeys.map(function(w){
        var vals=weeks[w].map(function(d){return calcDayDisp(e.sigla,d)});
        return vals.length?Math.round(vals.reduce(function(s,v){return s+v},0)/vals.length*10)/10:null;
      });
      var wValsConDato=wVals.filter(function(v){return v!==null});
      var prom=wValsConDato.length?Math.round(wValsConDato.reduce(function(s,v){return s+v},0)/wValsConDato.length*10)/10:null;
      var pc=prom===null?'var(--tx3)':prom>=meta?'var(--ok)':'var(--danger)';
      return'<tr><td class="mono" style="color:var(--ac)">'+escapeHtml(e.sigla)+'</td><td style="font-size:11px">'+escapeHtml(e.tipo)+'</td>'+
        wVals.map(function(v){if(v===null)return'<td class="mono" style="text-align:center;color:var(--tx3)">—</td>';var c=v>=meta?'var(--ok)':v>=70?'var(--w)':'var(--danger)';return'<td class="mono" style="text-align:center;color:'+c+';font-weight:600">'+v+'%</td>'}).join('')+
        '<td class="mono" style="font-weight:700;color:'+pc+'">'+(prom===null?'—':prom+'%')+'</td></tr>';
    }).join('')+
    '</table></div>';}

  } else if(fVista==='anual'){
    // ═══ VISTA ANUAL ═══
    try{
    var anio=parseInt(fAnio)||2026;
    var mesesAnio=['01','02','03','04','05','06','07','08','09','10','11','12'];
    var MSN=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
    // Bug real (auditoría 2026-08-30): la vista Anual tenía su propia calcMF()
    // en vez de reusar calcMonthDisp() (la que ya usa la vista Mensual, envoltorio
    // de dispEquipoMes — fuente única, logic.js). calcMF sumaba el downtime de
    // todos los días del mes SIN acotar cada día a hrsDia antes de sumar;
    // dispEquipoMes acota cada día (un Fuera de Servicio de 24h con hrsDia=12
    // cuenta como "0% ese día", no como "-100% ese día" arrastrando el promedio
    // más abajo). Mismo equipo, mismo mes, podía dar un % distinto en Anual que
    // en Mensual/Semanal/Diario de esta misma pestaña. Ahora las 4 vistas usan
    // la misma función.
    var calcMF=calcMonthDisp;
    var fleetMonth=mesesAnio.map(function(mm){var mes=anio+'-'+mm;var vals=eqFil.map(function(e){return calcMF(e.sigla,mes)}).filter(function(v){return v!==undefined});return vals.length?Math.round(vals.reduce(function(s,v){return s+v},0)/vals.length*10)/10:undefined;});
    var fleetVals=fleetMonth.filter(function(v){return v!==undefined});
    var fleetAnual=fleetVals.length?Math.round(fleetVals.reduce(function(s,v){return s+v},0)/fleetVals.length*10)/10:0;
    var colA=fleetAnual>=meta?'var(--ok)':fleetAnual>=70?'var(--w)':'var(--danger)';
    content=
    '<div style="display:flex;align-items:center;gap:16px;background:var(--bg3);border-radius:10px;padding:14px;margin-bottom:16px">'+
    '<div style="text-align:center;min-width:120px"><div style="font-size:36px;font-weight:800;color:'+colA+'">'+fleetAnual+'%</div><div style="font-size:10px;color:var(--tx3)">ANUAL '+anio+'</div></div>'+
    '<div style="flex:1"><div style="display:flex;gap:4px;align-items:flex-end;height:60px">'+
    fleetMonth.map(function(v,i){if(v===undefined)return'<div style="flex:1;text-align:center"><div style="font-size:8px;color:var(--tx3)">—</div><div style="font-size:8px">'+MSN[i]+'</div></div>';var c=v>=meta?'var(--ok)':v>=70?'var(--w)':'var(--danger)';var h=Math.max(v/100*50,3);var tipTxt=MSN[i]+': '+v+'% disponibilidad flota';return'<div style="flex:1;text-align:center"><div style="font-size:8px;font-weight:600;color:var(--tx)">'+v+'</div><div style="background:'+c+';height:'+h+'px;max-width:24px;margin:0 auto;border-radius:4px 4px 0 0;cursor:default" onmouseenter="vizTip(event,\''+tipTxt+'\')" onmousemove="vizTipMove(event)" onmouseleave="vizTipHide()"></div><div style="font-size:8px">'+MSN[i]+'</div></div>'}).join('')+
    '</div></div></div>'+
    '<div class="tbl-wrap"><table>'+
    '<tr><th>Equipo</th><th>Tipo</th>'+MSN.map(function(m){return'<th>'+m+'</th>'}).join('')+'<th>Anual</th></tr>'+
    eqFil.map(function(e){var vals=mesesAnio.map(function(mm){return calcMF(e.sigla,anio+'-'+mm)});var nums=vals.filter(function(v){return v!==undefined});var prom=nums.length?Math.round(nums.reduce(function(s,v){return s+v},0)/nums.length*10)/10:0;var pc=prom>=meta?'var(--ok)':'var(--danger)';return'<tr><td class="mono" style="color:var(--ac)">'+escapeHtml(e.sigla)+'</td><td style="font-size:10px">'+escapeHtml(e.tipo)+'</td>'+vals.map(function(v){if(v===undefined)return'<td style="color:var(--tx3);text-align:center;font-size:10px">—</td>';var c=v>=meta?'var(--ok)':v>=70?'var(--w)':'var(--danger)';return'<td class="mono" style="text-align:center;font-size:10px;color:'+c+';font-weight:600">'+v+'%</td>'}).join('')+'<td class="mono" style="font-weight:700;color:'+pc+'">'+prom+'%</td></tr>'}).join('')+
    '<tr style="font-weight:700;background:var(--bg3)"><td colspan="2">FLOTA</td>'+
    fleetMonth.map(function(v){if(v===undefined)return'<td style="text-align:center;color:var(--tx3)">—</td>';var c=v>=meta?'var(--ok)':'var(--danger)';return'<td class="mono" style="text-align:center;color:'+c+'">'+v+'%</td>'}).join('')+
    '<td class="mono" style="color:'+colA+'">'+fleetAnual+'%</td></tr>'+
    '</table></div>';
    }catch(err){content='<div style="padding:20px;color:var(--danger)">Error: '+err.message+'</div>';}

  }

  // Salidas de servicio EN CURSO (aún fuera de servicio, sin fecha de término) — se
  // listan con un botón para cerrarlas cuando el equipo vuelva a operar. Sin esto no
  // había forma de ver, desde esta pestaña, cuáles equipos siguen detenidos hoy.
  var fsEnCurso=equiposFueraDeServicioAhora(ot);
  var fsEnCursoHTML=fsEnCurso.length?
    '<div style="background:rgba(239,68,68,.08);border:1px solid var(--danger);border-radius:8px;padding:10px 14px;margin-bottom:14px">'+
    '<b style="font-size:12px;color:var(--danger)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="8"/><line x1="4.5" y1="15.5" x2="15.5" y2="4.5"/></svg> '+fsEnCurso.length+' equipo'+(fsEnCurso.length===1?'':'s')+' AÚN fuera de servicio</b>'+
    fsEnCurso.map(function(x){
      var dias=(typeof rangoDias==='function'?rangoDias(x.o.fechaEntrada,new Date().toISOString().slice(0,10)):[]).length;
      return'<div style="display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px">'+
        '<span class="mono" style="color:var(--ac);min-width:70px">'+escapeHtml(x.o.sigla)+'</span>'+
        '<span style="color:var(--tx3)">desde '+x.o.fechaEntrada+' ('+dias+' día'+(dias===1?'':'s')+') — '+escapeHtml(x.o.sintoma||'')+'</span>'+
        '<button class="btn-s" style="margin-left:auto" onclick="cerrarSalidaServicio('+x.i+')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> Volvió a operar</button>'+
        '</div>';
    }).join('')+
    '</div>':'';

  // ═══ PRODUCCIÓN PERDIDA POR DETENCIÓN (2026-09-25) ═══ — ver
  // produccionPerdidaPorDetencion en logic.js: el contrato real con
  // Centinela se paga por m3, no por hora de arriendo, así que "estuvo
  // detenido 40h" no es el número que convence a un gerente — "esas 40h
  // eran ~520 m3 que no se entregaron" sí, porque habla el mismo idioma
  // del contrato. Usa el mismo downMap real de arriba (dispDownMap) cruzado
  // contra rendimiento_modelos (Q real de ficha técnica del fabricante +
  // LF/E/Cm reales de terreno, cargados en "Configurar Rendimiento").
  // Hoy solo tiene fórmula activa para Cargador Frontal — el resto de los
  // tipos de equipo tienen su capacidad real cargada como referencia, pero
  // sin fórmula completa todavía (ver comentario en logic.js).
  var rendModelos=S.g('rendModelos')||[];
  var prodPerdida=typeof produccionPerdidaPorDetencion==='function'?produccionPerdidaPorDetencion(eq,rendModelos,downMap):[];
  var totalM3Perdidos=prodPerdida.reduce(function(a,r){return a+r.m3Perdidos;},0);
  var prodPerdidaHTML=
    '<div class="chart-box" style="margin-bottom:14px"><div class="chart-t">📉 Producción Perdida por Detención <span style="font-size:11px;color:var(--tx3)">— m³ que la flota no entregó por las horas reales de detención</span></div>'+
    '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Cruza las horas reales de detención (mismo dato de arriba) contra el rendimiento teórico del fabricante (Q real de ficha técnica × LF/E/Cm reales de terreno) — nunca inventa un parámetro faltante: un equipo sin los 4 datos completos de su modelo simplemente no aparece. Hoy solo Cargador Frontal tiene la fórmula completa activa.</div>'+
    (prodPerdida.length?
    '<div class="tbl-wrap"><table style="table-layout:fixed"><tr><th style="text-align:left;width:16%">Equipo</th><th style="text-align:left;width:26%">Modelo</th><th style="width:16%">Rendimiento teórico</th><th style="width:16%">Horas detenido</th><th style="width:16%">m³ perdidos</th></tr>'+
    prodPerdida.map(function(r){
      return '<tr><td class="mono" style="color:var(--ac)">'+escapeHtml(r.sigla)+'</td>'+
        '<td style="font-size:11px">'+escapeHtml(r.modelo)+'</td>'+
        '<td class="mono" style="text-align:center">'+r.rendimientoTeorico+' m³/h</td>'+
        '<td class="mono" style="text-align:center">'+r.horasDetenidas+'h</td>'+
        '<td class="mono" style="text-align:center;font-weight:700;color:var(--danger)">'+fn(r.m3Perdidos)+' m³</td></tr>';
    }).join('')+
    '<tr style="background:var(--bg3);font-weight:700"><td colspan="4">Total</td><td class="mono" style="text-align:center;color:var(--danger)">'+fn(totalM3Perdidos)+' m³</td></tr>'+
    '</table></div>'
    :'<div style="color:var(--tx3);text-align:center;padding:14px;font-size:12px">Sin equipos con los 4 parámetros reales completos (Q/LF/E/Cm) y horas de detención registradas todavía.</div>')+
    '<div style="margin-top:8px"><button class="btn btn-o" style="font-size:11px" onclick="configurarRendimientoModelos()">⚙️ Configurar Rendimiento por Modelo</button></div>'+
    '</div>';

  // ═══ MONTE CARLO DE DISPONIBILIDAD — proyección 30/60/90 días (2026-09-13,
  // ver simulacionMonteCarloDisponibilidad en logic.js) ═══ Remuestrea el
  // historial REAL de intervalos entre fallas y duraciones de reparación de
  // toda la flota — no modela el PM porque su fecha ya se conoce con
  // certeza (diasParaPM), no hay nada aleatorio que remuestrear ahí.
  // otMC (auditoría 2026-09-16, segunda pasada): a diferencia del resto de este
  // archivo (Ao/Ai, que se quedan con 'ot' puro a propósito — otHist no tiene
  // fechaSalida real), acá SÍ conviene sumar otHist + informesFalla: el texto de
  // esta sección promete remuestrear "TODA la flota", pero solo veía la tabla 'ot'
  // en vivo — un mes con 0 en 'ot' y 69 en otHist (caso real documentado en
  // dash.js) podía mostrar "historial insuficiente" o una proyección sesgada,
  // aunque el sistema sí tuviera de sobra. otHist/informesFalla no traen duración
  // de reparación (mismo caso ya documentado en cos.js) — quedan afuera de
  // _mcDu automáticamente, sin distorsión, solo aportan a los intervalos.
  var otMC=ot.concat(_otHistComoOt(S.g('otHist')||[]),_informesFallaComoOt(S.g('informesFalla')||[]));
  var _mcIv=intervalosFallaFlotaDias(otMC);
  var _mcDu=duracionesReparacionFlotaHoras(otMC);
  // Equipos AÚN fuera de servicio (fsEnCurso, ya calculado arriba) se excluyen del
  // "presupuesto" de horas — hallazgo de auditoría: incluirlos infla horasFlotaDiarias
  // con horas que hoy ya sabemos que no se van a operar, haciendo ver la disponibilidad
  // proyectada mejor de lo real.
  var _mcSiglasFS={};fsEnCurso.forEach(function(x){_mcSiglasFS[x.o.sigla]=true;});
  var _mcHorasFlota=eq.filter(function(e){return e.unidad!=='km'&&!_mcSiglasFS[e.sigla];}).reduce(function(s,e){return s+(e.hrsDia>0?e.hrsDia:12);},0);
  var _mcHorizontes=[30,60,90];
  var _mcResultados=_mcHorizontes.map(function(h){return simulacionMonteCarloDisponibilidad(_mcIv,_mcDu,h,_mcHorasFlota,1000);});
  var monteCarloHTML=
    '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:14px">'+
    '<div class="chart-t">🎲 Proyección Monte Carlo de disponibilidad de flota</div>'+
    '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Remuestrea (bootstrap) '+_mcIv.length+' intervalos reales entre fallas y '+_mcDu.length+' duraciones reales de reparación de TODA la flota, 1.000 veces por horizonte, para proyectar un RANGO honesto de disponibilidad (P10-P90) — no un solo número. No incluye mantención programada (PM): su fecha ya se conoce con certeza, no hay nada que remuestrear ahí. <b>Es un promedio de flota: mezcla por igual el historial de equipos nuevos y viejos, no dice qué tan riesgoso es UN equipo puntual</b> — para eso, ver el Índice de Riesgo en Componentes o Weibull en Estadística, que sí usan las horas reales de cada equipo.</div>'+
    (_mcResultados[0]?
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">'+
      _mcResultados.map(function(r,i){
        var h=_mcHorizontes[i];
        if(!r)return '<div class="card"><div class="card-t">'+h+' días</div><div class="card-v" style="color:var(--tx3)">—</div><div class="card-s">Historial insuficiente</div></div>';
        var col=r.dispP50>=90?'var(--ok)':r.dispP50>=75?'var(--w)':'var(--danger)';
        return '<div class="card"><div class="card-t">'+h+' días</div><div class="card-v" style="color:'+col+'">'+r.dispP50+'%</div><div class="card-s">Rango P10-P90: '+r.dispP10+'% – '+r.dispP90+'%</div><div class="card-s">'+r.fallasEsperadas+' falla(s) esperada(s) en la flota</div></div>';
      }).join('')+
      '</div>':
      '<div style="font-size:12px;color:var(--tx3);padding:4px 0">Historial insuficiente todavía ('+_mcIv.length+' intervalos entre fallas, '+_mcDu.length+' duraciones de reparación reales — se necesitan al menos 8 y 5 respectivamente).</div>')+
    '</div>';

  // ═══ PRONÓSTICO DE DISPONIBILIDAD POR EQUIPO (2026-10-11) ═══ — ver pronosticoDisponibilidadEquipos / backtestPronosticoDisponibilidad (logic.js): PM calendarizado + fallas de CADA
  // equipo con su historial + equipos que hoy siguen fuera de servicio, con rango, probabilidad de cumplir la meta y un backtest contra los meses pasados.
  var pronosticoHTML=(function(){
    var hz=parseInt($('fDispPronH')?.value)||30;
    var compHist=S.g('compHist')||[],histH=S.g('hist')||[];
    var clave=[hz,meta,eq.length,reg.length,otMC.length,compHist.length,histH.length,new Date().toISOString().slice(0,10)].join('|');
    var c=window._dispPronCache;
    var pr,bt;
    if(c&&c.clave===clave){pr=c.pr;bt=c.bt;}
    else{
      try{
        var comprasU=(typeof tboUnirCompras==='function')?tboUnirCompras(S.g('ocHist')||[],S.g('comprasDetalle')||[]):[];
        var dBase={reg:reg,ot:otMC,compHist:compHist,compMayores:S.g('compMayores')||[],compras:comprasU};
        pr=pronosticoDisponibilidadEquipos(eq,Object.assign({hoy:new Date().toISOString().slice(0,10)},dBase),{horizonteDias:hz,meta:meta,nSim:2000});
        bt=pr?backtestPronosticoDisponibilidad(eq,Object.assign({hoy:pr.datosHasta,hist:histH},dBase),{horizonteDias:hz,meta:meta,nSim:800,origenes:Math.max(3,Math.round(240/hz))}):null;
      }catch(e){pr=null;bt=null;}
      window._dispPronCache={clave:clave,pr:pr,bt:bt};
    }
    var sel='<select id="fDispPronH" onchange="renders.disp()" style="margin-left:8px">'+[30,60,90].map(function(h){return'<option value="'+h+'"'+(h===hz?' selected':'')+'>próximos '+h+' días</option>';}).join('')+'</select>';
    var cab='<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:14px"><div class="chart-t">🔮 Pronóstico de disponibilidad por equipo'+sel+'</div>'+
      '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Suma lo que ya se sabe: los <b>PM calendarizados</b> de cada equipo, sus <b>fallas esperadas</b> según su propio historial (los equipos con poca historia se acercan al promedio de la flota) y los equipos que <b>hoy siguen fuera de servicio</b>. Se simula 2.000 veces. Las fallas son las registradas: lo que no se carga no existe para el modelo.</div>';
    if(!pr)return cab+'<div style="font-size:12px;color:var(--tx3);padding:4px 0">Historial insuficiente todavía (se necesitan al menos 60 días de datos y 5 detenciones por falla registradas).</div></div>';
    var f=pr.flota,col=f.p50>=meta?'var(--ok)':f.p50>=meta-10?'var(--w)':'var(--danger)';
    var avisos='';
    if(pr.diasSinCarga>14)avisos+='<div style="font-size:11px;color:var(--w);margin-bottom:6px">⚠ El último registro de fallas/PM es del '+escapeHtml(pr.datosHasta)+' (hace '+fn(pr.diasSinCarga)+' días): la historia se corta ahí para no contar como "sin fallas" los días sin carga.</div>';
    if(pr.prolongados.length){
      avisos+='<div style="font-size:11px;color:var(--w);margin-bottom:6px;line-height:1.5">⚠ <b>'+fn(pr.prolongados.length)+' equipo(s) llevan más tiempo "Fuera de Servicio" sin fecha de término que lo habitual</b> ('+pr.prolongados.map(function(x){return escapeHtml(x.sigla)+' desde '+escapeHtml(x.desde)+' ('+fn(x.dias)+' d)';}).join(', ')+'). El programa los cuenta como detenidos todos los días, y el pronóstico supone que siguen así. '+
        '<b>Si esos registros están olvidados o el equipo ya volvió a operar, ciérralos</b> (Disponibilidad → salidas de servicio en curso): la disponibilidad pronosticada subiría a <b>'+f.sinProlongados.p50+'%</b> (rango '+f.sinProlongados.p10+'–'+f.sinProlongados.p90+'%).</div>';
    }
    var tarjetas='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin-bottom:10px">'+
      '<div class="card"><div class="card-t">Disponibilidad esperada</div><div class="card-v" style="color:'+col+'">'+f.p50+'%</div><div class="card-s">rango P10–P90: '+f.p10+'% – '+f.p90+'%</div></div>'+
      '<div class="card"><div class="card-t">Probabilidad de cumplir la meta</div><div class="card-v" style="color:'+col+'">'+f.probMeta+'%</div><div class="card-s">meta '+meta+'%</div></div>'+
      '<div class="card"><div class="card-t">Solo por fallas (sin PM)</div><div class="card-v">'+f.intrinseca.p50+'%</div><div class="card-s">rango '+f.intrinseca.p10+'% – '+f.intrinseca.p90+'%</div></div>'+
      '<div class="card"><div class="card-t">Historia usada</div><div class="card-v" style="font-size:16px">'+fn(pr.diasHistoria)+' días</div><div class="card-s">'+fn(pr.eventosHist)+' detenciones por falla · '+fn(pr.nEquipos)+' equipos</div></div></div>';
    var cp=pr.componentes,compHTML='';
    if(cp.gruposModelados.length){
      var gm=cp.gruposModelados.map(function(g){return escapeHtml(g.fam)+' ('+(g.origen==='sin dato'?'origen sin registrar':escapeHtml(g.origen))+(g.mezclaOrigenes?', orígenes mezclados':'')+'): forma β '+(Math.round(g.beta*100)/100+'').replace('.',',')+' con '+fn(g.completas)+' vidas completas';}).join(' · ');
      var sinDesgaste=cp.gruposModelados.every(function(g){return g.beta<1.1;});
      compHTML='<div style="font-size:11px;color:var(--tx2);margin-bottom:8px;line-height:1.5"><b>Edad de los componentes.</b> Se corrige la tasa de fallas de cada equipo según la edad de sus componentes con vida medida en la flota: '+gm+'. Efecto sobre la flota: <b>'+(f.p50-cp.sinAjuste.p50>=0?'+':'')+(Math.round((f.p50-cp.sinAjuste.p50)*10)/10+'').replace('.',',')+' puntos</b> (redistribuye riesgo entre equipos; '+fn(cp.equiposAjustados)+' equipos ajustados). '+
        (sinDesgaste?'<b style="color:var(--w)">β cercano o menor a 1: el riesgo no sube con la edad</b> — estos componentes fallan al azar o al inicio de su vida, así que la edad no ayuda a anticipar la falla (y cambiarlos por TBO no la evita).':'')+'</div>';
    }
    var btHTML=bt?'<div style="font-size:11px;color:var(--tx2);margin-bottom:8px;line-height:1.5"><b>¿Acierta?</b> Repetido desde '+fn(bt.origenes.length)+' fechas pasadas, usando solo lo que se sabía entonces: lo real cayó dentro del rango el <b>'+bt.cobertura+'%</b> de las veces (lo esperable ~80%), con un error medio de ±'+bt.errorMedioAbs+' puntos'+(Math.abs(bt.sesgo)>=1?' y un sesgo de '+(bt.sesgo>0?'+':'')+bt.sesgo+' (el pronóstico '+(bt.sesgo>0?'fue optimista':'fue pesimista')+')':'')+'. '+(bt.origenes.length<5?'Son pocas fechas: es evidencia anecdótica. ':'')+'El PM se tomó como el realmente hecho.'+(bt.componentes?' Con el ajuste por edad de componentes el error medio fue ±'+bt.errorMedioAbs+' puntos; sin él, ±'+bt.sinComponentes.errorMedioAbs+'.':'')+'</div>':'<div style="font-size:11px;color:var(--tx3);margin-bottom:8px">Sin historia suficiente para el backtest todavía.</div>';
    var filas=pr.equipos.slice(0,8).map(function(x){
      return'<tr><td class="mono" style="color:var(--ac)">'+escapeHtml(x.sigla)+(x.prolongado?' <span title="Fuera de servicio sin fecha de término desde hace mucho" style="color:var(--w)">⚠</span>':x.enCurso?' <span title="Fuera de servicio ahora" style="color:var(--danger)">●</span>':'')+'</td><td style="font-size:10px">'+escapeHtml(x.modelo)+'</td>'+
        '<td class="mono" style="text-align:right">'+fn(x.fallasHist)+'</td><td class="mono" style="text-align:right">'+(Math.round(x.fallasEsperadas*10)/10+'').replace('.',',')+'</td><td class="mono" style="text-align:right;color:'+(x.ajusteComponentes>0.05?'var(--w)':x.ajusteComponentes<-0.05?'var(--ok)':'var(--tx3)')+'" title="'+escapeHtml(x.componentes.map(function(c){return c.item+': '+fn(c.desdeH)+' h desde el último cambio';}).join(' · '))+'">'+(x.componentes.length?((x.ajusteComponentes>0?'+':'')+(Math.round(x.ajusteComponentes*100)/100+'').replace('.',',')):'—')+'</td><td class="mono" style="text-align:right">'+fn(x.pmProgramados)+'</td>'+
        '<td class="mono" style="text-align:right;font-weight:700;color:'+(x.dispP50>=meta?'var(--ok)':x.dispP50>=meta-10?'var(--w)':'var(--danger)')+'">'+x.dispP50+'%</td><td class="mono" style="text-align:right;color:var(--tx3)">'+x.dispP10+'%</td><td class="mono" style="text-align:right">'+(Math.round(x.perdidaPuntosFlota*10)/10+'').replace('.',',')+'</td></tr>';}).join('');
    return cab+avisos+tarjetas+compHTML+btHTML+
      '<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Equipo</th><th>Modelo</th><th style="text-align:right" title="Detenciones por falla registradas en la ventana de historia">Fallas hist.</th><th style="text-align:right" title="Fallas esperadas en el horizonte">Fallas esperadas</th><th style="text-align:right" title="Fallas que suma (o resta) la edad de sus componentes con vida medida">Ajuste por edad</th><th style="text-align:right">PM en el período</th><th style="text-align:right">Disp. esperada</th><th style="text-align:right">Pesimista (P10)</th><th style="text-align:right" title="Cuántos puntos de la disponibilidad de la flota resta este equipo">Puntos que resta</th></tr>'+filas+'</table></div>'+
      '<div style="font-size:10px;color:var(--tx3);margin-top:6px">Se muestran los 8 que más restan. Supuestos: las fallas llegan al azar, salvo el ajuste por edad de los componentes con vida medida; una falla de varios días seguidos cuenta como un solo evento; las duraciones salen de las reparaciones cerradas del propio equipo (o de la flota si tiene menos de 4); el PM dura lo que duraron los suyos.</div></div>';
  })();

  // ═══ SIMULADOR WHAT-IF DE POLÍTICAS DE MANTENIMIENTO (2026-09-17) ═══
  // Cuarto ítem del tercer lote "más ambicioso". Mismo Monte Carlo de
  // arriba (misma muestra real _mcIv/_mcDu/_mcHorasFlota, nada nuevo que
  // medir), pero acá quien mira la pantalla elige un escenario hipotético
  // — "¿y si mejoramos la confiabilidad un X%?" / "¿y si reparamos Y% más
  // rápido?" — y lo compara contra el escenario base (datos reales, sin
  // cambios). Es análisis de sensibilidad sobre datos reales, nunca una
  // predicción ni un costo de falla inventado: los dos porcentajes los
  // pone la persona, no el sistema (ver compararEscenariosMantenimiento,
  // logic.js).
  var _wiPctConfiab=window._whatIfPctConfiab!=null?window._whatIfPctConfiab:0;
  var _wiPctReparacion=window._whatIfPctReparacion!=null?window._whatIfPctReparacion:0;
  var _wiHorizonte=window._whatIfHorizonte||90;
  var _wiFactorIntervalo=1+(_wiPctConfiab/100);
  var _wiFactorDuracion=1-(_wiPctReparacion/100);
  var _wiResultado=(typeof compararEscenariosMantenimiento==='function')?
    compararEscenariosMantenimiento(_mcIv,_mcDu,_wiHorizonte,_mcHorasFlota,1000,_wiFactorIntervalo,_wiFactorDuracion):null;
  var whatIfHTML=
    '<div class="chart-box" style="border-left:3px solid var(--w);margin-bottom:14px">'+
    '<div class="chart-t">🧪 Simulador What-If de políticas de mantenimiento</div>'+
    '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Prueba un escenario hipotético sobre el mismo Monte Carlo de arriba — los porcentajes los elegís vos, no son una predicción del sistema. "Confiabilidad" escala los intervalos entre fallas (más espaciadas = menos fallas). "Velocidad de reparación" escala la duración de cada intervención.</div>'+
    '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end;margin-bottom:12px">'+
      '<div><label style="font-size:10px;color:var(--tx3);display:block">Mejora de confiabilidad</label>'+
      '<div style="display:flex;align-items:center;gap:4px"><input type="number" id="wiPctConfiab" value="'+_wiPctConfiab+'" min="0" max="300" step="5" style="width:70px;padding:6px;background:var(--bg3);color:var(--tx);border:1px solid var(--bd);border-radius:4px" onchange="window._whatIfPctConfiab=Math.max(0,Math.min(300,parseFloat(this.value)||0));renders.disp()"><span style="font-size:12px;color:var(--tx3)">% menos fallas</span></div></div>'+
      '<div><label style="font-size:10px;color:var(--tx3);display:block">Mejora de velocidad de reparación</label>'+
      '<div style="display:flex;align-items:center;gap:4px"><input type="number" id="wiPctReparacion" value="'+_wiPctReparacion+'" min="0" max="95" step="5" style="width:70px;padding:6px;background:var(--bg3);color:var(--tx);border:1px solid var(--bd);border-radius:4px" onchange="window._whatIfPctReparacion=Math.max(0,Math.min(95,parseFloat(this.value)||0));renders.disp()"><span style="font-size:12px;color:var(--tx3)">% menos horas por reparación</span></div></div>'+
      '<div><label style="font-size:10px;color:var(--tx3);display:block">Horizonte</label>'+
      '<select id="wiHorizonte" style="padding:6px;background:var(--bg3);color:var(--tx);border:1px solid var(--bd);border-radius:4px" onchange="window._whatIfHorizonte=parseInt(this.value);renders.disp()">'+
        [30,60,90].map(function(h){return'<option value="'+h+'"'+(_wiHorizonte===h?' selected':'')+'>'+h+' días</option>';}).join('')+
      '</select></div>'+
      ((_wiPctConfiab||_wiPctReparacion)?'<button class="btn-o" onclick="window._whatIfPctConfiab=0;window._whatIfPctReparacion=0;renders.disp()">Resetear</button>':'')+
    '</div>'+
    (_wiResultado?
    '<div class="tbl-wrap"><table style="table-layout:fixed"><tr><th style="text-align:left;width:22%">Escenario</th><th>Disponibilidad P50</th><th>Rango P10-P90</th><th>Fallas esperadas</th></tr>'+
    '<tr><td style="font-weight:600">Base (datos reales)</td><td style="text-align:center">'+_wiResultado.base.dispP50+'%</td><td style="text-align:center;color:var(--tx3)">'+_wiResultado.base.dispP10+'% – '+_wiResultado.base.dispP90+'%</td><td style="text-align:center">'+_wiResultado.base.fallasEsperadas+'</td></tr>'+
    '<tr><td style="font-weight:600">What-If ('+(_wiPctConfiab||0)+'% confiab. / '+(_wiPctReparacion||0)+'% reparación)</td><td style="text-align:center;font-weight:700;color:'+(_wiResultado.deltaDispP50>0?'var(--ok)':_wiResultado.deltaDispP50<0?'var(--danger)':'var(--tx3)')+'">'+_wiResultado.escenario.dispP50+'% <span style="font-size:10px">('+(_wiResultado.deltaDispP50>0?'+':'')+_wiResultado.deltaDispP50+'pp)</span></td><td style="text-align:center;color:var(--tx3)">'+_wiResultado.escenario.dispP10+'% – '+_wiResultado.escenario.dispP90+'%</td><td style="text-align:center">'+_wiResultado.escenario.fallasEsperadas+' <span style="font-size:10px;color:var(--tx3)">('+(_wiResultado.deltaFallasEsperadas>0?'+':'')+_wiResultado.deltaFallasEsperadas+')</span></td></tr>'+
    '</table></div>'
    :'<div style="font-size:12px;color:var(--tx3);padding:4px 0">Historial insuficiente para simular escenarios todavía (mismo mínimo que el Monte Carlo de arriba).</div>')+
    '</div>';

  $('s-disp').innerHTML=
    '<div class="sec-h dc-head"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,5 8,10 11,7 17,16"/><polyline points="12,16 17,16 17,11"/></svg> Disponibilidad Mecánica</div>'+
    '<div class="sec-s" title="Disponibilidad = (horas disponibles del día − horas caídas) / horas disponibles, promediado por período. Cuando un registro no tiene duración registrada se asume 4h (PM) u 8h (correctivo) para no perderlo del cálculo — estimación, no dato medido.">Cálculo automático desde registros PM + correctivos + equipo fuera de servicio · Meta editable · <span style="text-decoration:underline dotted">sin duración registrada = 4h/8h asumidas</span></div></div>'+
    '<div style="display:flex;gap:8px"><button class="btn" style="background:var(--danger);color:#fff" onclick="registrarSalidaServicio()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="8"/><line x1="4.5" y1="15.5" x2="15.5" y2="4.5"/></svg> Registrar salida de servicio</button><button class="btn btn-o" onclick="exportCSV(\'disp\')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> CSV</button><button class="btn btn-o" onclick="importDispCSV()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar</button></div></div>'+
    fsEnCursoHTML+
    dispReportabHTML(eq)+
    prodPerdidaHTML+
    monteCarloHTML+
    pronosticoHTML+
    whatIfHTML+
    '<div class="toolbar">'+
    '<select id="fDispVista" onchange="renders.disp()"><option value="mensual"'+(fVista==='mensual'?' selected':'')+'><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Mensual</option><option value="semanal"'+(fVista==='semanal'?' selected':'')+'><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Semanal</option><option value="diario"'+(fVista==='diario'?' selected':'')+'><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Diario</option><option value="anual"'+(fVista==='anual'?' selected':'')+'><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Anual</option></select>'+
    '<select id="fDispMes" onchange="renders.disp()">'+meses.map(function(m){return'<option'+(fMes===m?' selected':'')+'>'+m+'</option>'}).join('')+'</select>'+
    '<select id="fDispAnio" onchange="renders.disp()">'+availYears.map(function(y){return'<option'+(fAnio===y?' selected':'')+'>'+y+'</option>'}).join('')+'</select>'+
    '<select id="fDispTipo" onchange="renders.disp()"><option value="">Todos los equipos</option>'+
    tipos.map(function(t){return'<option'+(fTipo===t?' selected':'')+'>'+t+'</option>'}).join('')+'</select>'+
    '<div style="font-size:11px;color:var(--tx3)">Meta: <span contenteditable style="color:var(--ac);font-weight:700;cursor:pointer" onblur="var v=parseFloat(this.innerText);if(v>0){S.s(\'dispMeta\',v);refreshAll()}">'+meta+'%</span></div>'+
    '</div>'+
    content;
  if(typeof _animGauges==='function')_animGauges('s-disp');
}


// ═══ REPORTABILIDAD DIARIA DEL CLIENTE (2026-10-11) ═══ — ver reportabilidad* (logic.js). Una fila por equipo y día (OP/FS) en reportabilidad_diaria; se puede cargar cualquier fecha
// en cualquier orden y cargar un día de nuevo lo actualiza (no duplica). Importa los dos formatos de Excel del cliente (un archivo por día, o un libro con una hoja por día).
function _repTxt(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
export function dispReportabHTML(eq) {
  var filas = S.g('reportab') || [], meta = S.g('dispMeta') || 85, hoy = new Date().toISOString().slice(0, 10);
  var tipo = $('fRepTipo') ? $('fRepTipo').value : 'mes';
  var opts = periodoOpciones(tipo, hoy), ref = $('fRepRef') ? $('fRepRef').value : '';
  if (window._repTipoPrev !== tipo || !opts.some(function (x) { return x.v === ref; })) ref = periodoRango(tipo, hoy).desde;
  window._repTipoPrev = tipo;
  var rg = periodoRango(tipo, ref), etq = periodoEtiqueta(tipo, rg.desde, rg.hasta);
  var fechasCargadas = Array.from(new Set(filas.map(function (r) { return r.fecha; }))).sort();
  var cab = '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:14px"><div class="chart-t">📋 Reportabilidad diaria del cliente — disponibilidad contractual · ' + escapeHtml(etq) + '</div>' +
    '<div style="font-size:11px;color:var(--tx3);padding:6px 0 8px;line-height:1.5">Estatus OP / FS de cada equipo por día, tal como lo reporta el cliente (Excel de reportabilidad). Disponibilidad del día = equipos operativos ÷ equipos reportados. ' +
    (fechasCargadas.length ? 'Cargados <b>' + fn(fechasCargadas.length) + '</b> días, del ' + escapeHtml(fechasCargadas[0]) + ' al ' + escapeHtml(fechasCargadas[fechasCargadas.length - 1]) + '. ' : '') +
    'Puedes cargar archivos de cualquier fecha cuando los encuentres: un día que ya está cargado se actualiza, no se duplica.</div>' +
    '<div class="toolbar" style="margin:0 0 10px;gap:8px;flex-wrap:wrap">' + (window._userRole === 'lector' ? '' : '<label class="btn" style="cursor:pointer">⬆️ Importar reportabilidad (Excel)<input type="file" accept=".xlsx,.xls" multiple style="display:none" onchange="importarReportabilidad(event)"></label>') +
    (fechasCargadas.length ? '<select id="fRepDiaExp" title="Día a exportar">' + fechasCargadas.slice().reverse().map(function (f) { return '<option>' + f + '</option>'; }).join('') + '</select><button class="btn btn-o" onclick="exportarReportabilidadDia()">⬇️ Exportar ese día (Excel)</button>' : '') +
    '<select id="fRepTipo" onchange="renders.disp()">' + [['semana', 'Semana'], ['mes', 'Mes'], ['semestre', 'Semestre'], ['anio', 'Año']].map(function (t) { return '<option value="' + t[0] + '"' + (t[0] === tipo ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select>' +
    '<select id="fRepRef" onchange="renders.disp()">' + opts.map(function (x) { return '<option value="' + x.v + '"' + (x.v === ref ? ' selected' : '') + '>' + escapeHtml(x.label) + '</option>'; }).join('') + '</select></div>';
  if (!filas.length) return cab + '<div style="font-size:12px;color:var(--tx3);padding:4px 0">Todavía no hay reportabilidad cargada. Usa "Importar reportabilidad" con los Excel del cliente.</div></div>';
  var r = reportabilidadDisponibilidad(filas, rg.desde, rg.hasta, { hoy: hoy });
  if (!r.dias.length) return cab + '<div style="font-size:12px;color:var(--tx3);padding:4px 0">No hay días cargados dentro de este período. ' + (hoy > rg.hasta ? 'Si tienes reportes de esas fechas, impórtalos con el botón de arriba.' : '') + '</div></div>';
  var pf = function (x) { return x == null ? '—' : (Math.round(x * 1000) / 10 + '').replace('.', ',') + '%'; };
  var col = function (x) { return x == null ? 'var(--tx3)' : x * 100 >= meta ? 'var(--ok)' : x * 100 >= meta - 10 ? 'var(--w)' : 'var(--danger)'; };
  var tarj = function (t, v, s, c) { return '<div class="card"><div class="card-t">' + t + '</div><div class="card-v" style="' + (c ? 'color:' + c : '') + '">' + v + '</div><div class="card-s">' + s + '</div></div>'; };
  var tarjetas = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin-bottom:10px">' +
    tarj('Disponibilidad promedio', pf(r.promedio), 'promedio de los días con reporte · meta ' + meta + '%', col(r.promedio)) +
    tarj('Días con reporte', fn(r.diasConDato) + ' de ' + fn(r.diasPeriodo), r.diasPeriodo && r.diasConDato < r.diasPeriodo ? 'faltan ' + fn(r.diasPeriodo - r.diasConDato) + ' días (puedes cargarlos después)' : 'período completo', r.cobertura != null && r.cobertura < 0.8 ? 'var(--w)' : '') +
    tarj('Mejor día', r.maximo ? pf(r.maximo.disp) : '—', r.maximo ? escapeHtml(r.maximo.fecha) : '', 'var(--ok)') +
    tarj('Peor día', r.minimo ? pf(r.minimo.disp) : '—', r.minimo ? escapeHtml(r.minimo.fecha) + ' · ' + fn(r.minimo.fs) + ' FS' : '', col(r.minimo && r.minimo.disp)) + '</div>';
  // gráfico: una barra por día con reporte, ubicada en su fecha; línea de meta
  var W = 680, H = 230, pl = 40, pr = 10, pt = 12, pb = 34, iw = W - pl - pr, ih = H - pt - pb, n = Math.max(1, r.diasPeriodo || r.dias.length);
  var X = function (f) { return pl + ((new Date(f + 'T12:00:00') - new Date(rg.desde + 'T12:00:00')) / 86400000 + 0.5) / n * iw; }, Y = function (v) { return pt + ih - v * ih; };
  var bw = Math.max(2, Math.min(18, iw / n * 0.7));
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Disponibilidad diaria según la reportabilidad del cliente" style="display:block;max-width:820px">';
  [0, 0.25, 0.5, 0.75, 1].forEach(function (g) { svg += '<line x1="' + pl + '" y1="' + Y(g) + '" x2="' + (W - pr) + '" y2="' + Y(g) + '" stroke="var(--bd)" opacity=".6"/><text x="' + (pl - 6) + '" y="' + (Y(g) + 3) + '" text-anchor="end" font-size="10" fill="var(--tx3)">' + Math.round(g * 100) + '</text>'; });
  r.dias.forEach(function (d) { svg += '<rect x="' + (X(d.fecha) - bw / 2) + '" y="' + Y(d.disp) + '" width="' + bw + '" height="' + (ih * d.disp) + '" rx="2" fill="' + col(d.disp) + '"><title>' + d.fecha + ' · ' + pf(d.disp) + ' · ' + d.op + ' OP / ' + d.fs + ' FS' + (d.fsSiglas.length ? ' (' + d.fsSiglas.join(', ') + ')' : '') + '</title></rect>'; });
  svg += '<line x1="' + pl + '" y1="' + Y(meta / 100) + '" x2="' + (W - pr) + '" y2="' + Y(meta / 100) + '" stroke="var(--tx2)" stroke-width="1.5" stroke-dasharray="6 4"/><text x="' + (W - pr) + '" y="' + (Y(meta / 100) - 4) + '" text-anchor="end" font-size="10" fill="var(--tx2)">meta ' + meta + '%</text>';
  var MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'], paso = tipo === 'semana' ? 1 : tipo === 'mes' ? 5 : 0;
  for (var i = 0; i < n; i++) {
    var f = new Date(new Date(rg.desde + 'T12:00:00').getTime() + i * 86400000).toISOString().slice(0, 10), dn = parseInt(f.slice(8, 10), 10), lab = null;
    if (paso) { if (tipo === 'semana' || dn === 1 || dn % paso === 0) lab = '' + dn; } else if (dn === 1) lab = MES[parseInt(f.slice(5, 7), 10) - 1];
    if (lab) svg += '<text x="' + X(f) + '" y="' + (H - pb + 14) + '" text-anchor="middle" font-size="10" fill="var(--tx3)">' + lab + '</text>';
  }
  svg += '</svg>';
  var eps = reportabilidadEpisodios(filas).filter(function (e) { return e.ultimaVez >= rg.desde && e.primeraVez <= rg.hasta; });
  var rank = r.ranking.slice(0, 10).map(function (x) { return '<tr><td class="mono" style="color:var(--ac)">' + escapeHtml(x.sigla) + '</td><td class="mono" style="text-align:right">' + fn(x.dias) + ' de ' + fn(r.diasConDato) + '</td><td class="mono" style="text-align:right">' + Math.round(x.dias / r.diasConDato * 100) + '%</td></tr>'; }).join('');
  var filasEp = eps.slice(0, 20).map(function (e) {
    var est = e.cerrado ? '<span style="color:var(--ok)">cerrado</span>' : (e.diasVencida > 0 ? '<span style="color:var(--danger)">abierto · proyección vencida hace ' + fn(e.diasVencida) + ' d</span>' : '<span style="color:var(--w)">abierto</span>');
    return '<tr><td class="mono" style="color:var(--ac)">' + escapeHtml(e.sigla) + '</td><td style="font-size:10px;white-space:nowrap">' + escapeHtml(e.fechaDetencion || e.primeraVez) + '</td><td style="font-size:10px">' + escapeHtml(e.detalle || '—') + '</td>' +
      '<td class="mono" style="text-align:right">' + fn(e.diasVistos) + '</td><td class="mono" style="text-align:right;font-size:10px">' + escapeHtml(e.proyeccionFinal || '—') + (e.reprogramaciones ? ' <span style="color:var(--w)" title="Veces que cambió la fecha de proyección">(' + e.reprogramaciones + ' reprog.)</span>' : '') + '</td><td style="font-size:10px">' + est + '</td>' +
      '<td style="font-size:10px;max-width:360px;white-space:normal;color:var(--tx2)" title="' + escapeHtml(e.observacion) + '">' + escapeHtml(_repTxt(e.observacion, 140)) + '</td></tr>';
  }).join('');
  var diaria = '<details style="margin-top:10px"><summary style="cursor:pointer;font-size:11px;color:var(--tx2)">Ver tabla diaria</summary><div class="tbl-wrap"><table style="font-size:10px"><tr><th>Día</th><th style="text-align:right">OP</th><th style="text-align:right">FS</th><th style="text-align:right">Disponibilidad</th><th>Equipos FS</th></tr>' +
    r.dias.map(function (d) { return '<tr><td class="mono">' + d.fecha + '</td><td class="mono" style="text-align:right">' + d.op + '</td><td class="mono" style="text-align:right">' + d.fs + '</td><td class="mono" style="text-align:right;color:' + col(d.disp) + ';font-weight:700">' + pf(d.disp) + '</td><td style="font-size:10px">' + escapeHtml(d.fsSiglas.join(', ')) + '</td></tr>'; }).join('') + '</table></div></details>';
  return cab + tarjetas + svg +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:12px"><div><div style="font-weight:700;font-size:12px;margin-bottom:4px">Equipos con más días fuera de servicio</div><div class="tbl-wrap"><table style="font-size:11px"><tr><th>Equipo</th><th style="text-align:right">Días FS</th><th style="text-align:right">%</th></tr>' + (rank || '<tr><td colspan="3" style="color:var(--tx3)">Sin fuera de servicio en el período</td></tr>') + '</table></div></div></div>' +
    '<div style="font-weight:700;font-size:12px;margin:12px 0 4px">Fuera de servicio del período — detalle y seguimiento de la proyección</div><div class="tbl-wrap"><table style="font-size:11px"><tr><th>Equipo</th><th>Desde</th><th>Detalle</th><th style="text-align:right">Días vistos</th><th style="text-align:right">Proyección final</th><th>Estado</th><th>Observación</th></tr>' + (filasEp || '<tr><td colspan="7" style="color:var(--tx3)">Sin episodios en el período</td></tr>') + '</table></div>' +
    '<div style="font-size:10px;color:var(--tx3);margin-top:4px">"Días vistos" son los días con reporte cargado (puede haber huecos). Una proyección cuenta como cumplida si el equipo figura operativo a más tardar 2 días después de la fecha proyectada. Los registros son los del cliente: el programa no los corrige.</div>' + diaria + '</div>';
}

// Lee uno o más archivos (.xlsx de cualquiera de los dos formatos), arma el lote y muestra qué se va a cargar antes de escribir nada.
export function importarReportabilidad(ev) {
  var files = Array.prototype.slice.call(ev.target.files || []); ev.target.value = '';
  if (!files.length) return;
  var hojas = [], pend = files.length;
  files.forEach(function (file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        wb.SheetNames.forEach(function (nombre) {
          var filas = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, raw: true, defval: null });
          hojas.push({ nombre: nombre, archivo: file.name, filas: filas });
        });
      } catch (err) { toast('❌ No se pudo leer ' + file.name + ': ' + err.message); }
      if (--pend === 0) _repPrevisualizar(hojas);
    };
    reader.readAsArrayBuffer(file);
  });
}
function _repPrevisualizar(hojas) {
  var eq = S.g('eq') || [], exist = S.g('reportab') || [];
  var retiradas = (S.g('papelera') || []).filter(function (p) { return p.categoria === 'eq' && p.fila; }).map(function (p) { return p.fila.sigla; });
  exist.forEach(function (r) { if (retiradas.indexOf(r.sigla) < 0 && !eq.some(function (e) { return e.sigla === r.sigla; })) retiradas.push(r.sigla); });   // lo ya cargado de equipos que hoy no están
  var lote = reportabilidadArmarLote(hojas, { anio: new Date().getFullYear(), siglasPrograma: eq.map(function (e) { return e.sigla; }), siglasRetiradas: retiradas });
  var fus = reportabilidadFusionar(exist, lote.filas);
  window._reportabLote = { fus: fus, filas: lote.filas };
  var dias = Array.from(new Set(lote.filas.map(function (x) { return x.fecha; }))).sort();
  var h = '<h3>Importar reportabilidad diaria</h3>';
  if (!lote.filas.length) { sm(h + '<div style="font-size:12px;color:var(--tx3)">No encontré hojas de reportabilidad en los archivos (se espera una tabla con columnas Sigla/Equipo y Estatus).</div><div style="margin-top:12px"><button class="btn btn-o" onclick="cm()">Cerrar</button></div>'); return; }
  h += '<div style="font-size:12px;line-height:1.6;margin-bottom:8px">' + fn(dias.length) + ' día(s): ' + escapeHtml(dias[0]) + (dias.length > 1 ? ' → ' + escapeHtml(dias[dias.length - 1]) : '') + ' · ' + fn(lote.filas.length) + ' filas.<br>' +
    '<b style="color:var(--ok)">' + fn(fus.insertar.length) + ' nuevas</b> · <b style="color:var(--w)">' + fn(fus.actualizar.length) + ' actualizan lo ya cargado</b> · ' + fn(fus.iguales) + ' sin cambios.</div>';
  var av = [];
  lote.hojas.filter(function (x) { return x.posibleCopia; }).forEach(function (x) { av.push('⚠ ' + escapeHtml(x.archivo + ' / ' + x.nombre) + ' (' + escapeHtml(x.fecha) + '): parece una copia sin actualizar de otro día (misma información, fecha de cabecera de otro día). Se omitió.'); });
  lote.conflictos.forEach(function (c) { av.push('⚠ ' + escapeHtml(c.fecha) + ': dos archivos traen ese día y difieren en ' + c.equiposConEstatusDistinto + ' equipo(s); se usó ' + escapeHtml(c.usada) + '.'); });
  if (lote.duplicadasIdenticas) av.push('ℹ ' + fn(lote.duplicadasIdenticas) + ' hoja(s) repetida(s) idéntica(s) se ignoraron.');
  var desc = Object.keys(lote.desconocidas); if (desc.length) av.push('ℹ Equipos que no están en el programa (no se cargan): ' + desc.map(function (s) { return escapeHtml(s) + ' (' + lote.desconocidas[s] + ')'; }).join(', ') + '.');
  if (lote.ignoradas.length) av.push('ℹ Hojas ignoradas (sin tabla de reportabilidad): ' + lote.ignoradas.map(escapeHtml).join(', ') + '.');
  lote.hojas.forEach(function (x) { x.avisos.forEach(function (a) { if (av.length < 14) av.push('· ' + escapeHtml(x.nombre) + ': ' + escapeHtml(a)); }); });
  h += '<div style="font-size:11px;color:var(--tx2);line-height:1.5;max-height:200px;overflow:auto">' + av.slice(0, 14).map(function (a) { return '<div>' + a + '</div>'; }).join('') + '</div>' +
    '<div style="margin-top:12px;display:flex;gap:8px"><button class="btn" onclick="confirmarImportReportabilidad()"' + (fus.insertar.length + fus.actualizar.length ? '' : ' disabled') + '>✅ Cargar</button><button class="btn btn-o" onclick="cm()">Cancelar</button></div>';
  sm(h);
}
export function confirmarImportReportabilidad() {
  var l = window._reportabLote; if (!l) return;
  var exist = (S.g('reportab') || []).slice();
  l.fus.actualizar.forEach(function (a) { var x = exist.find(function (e) { return e._id === a._id; }); if (x) Object.assign(x, { siglaCliente: a.fila.siglaCliente, estatus: a.fila.estatus, ubicacion: a.fila.ubicacion, detalle: a.fila.detalle, fechaDetencion: a.fila.fechaDetencion, proyeccion: a.fila.proyeccion, ordenCompra: a.fila.ordenCompra, observacion: a.fila.observacion, mantenedor: a.fila.mantenedor, fuente: 'importado ' + new Date().toISOString().slice(0, 10) }); });
  l.fus.insertar.forEach(function (n) { exist.push({ _id: _uuidV4(), fecha: n.fecha, sigla: n.sigla, siglaCliente: n.siglaCliente, estatus: n.estatus, ubicacion: n.ubicacion, detalle: n.detalle, fechaDetencion: n.fechaDetencion, proyeccion: n.proyeccion, ordenCompra: n.ordenCompra, observacion: n.observacion, mantenedor: n.mantenedor, fuente: 'importado ' + new Date().toISOString().slice(0, 10) }); });
  S.s('reportab', exist);
  window._reportabLote = null; cm(); refreshAll();
  toast('✅ Reportabilidad cargada: ' + l.fus.insertar.length + ' nuevas, ' + l.fus.actualizar.length + ' actualizadas');
}
// Exporta un día en el formato del libro del cliente (Sigla, Sigla CEN, Marca - Modelo, Estatus 1=FS 2=OP, …).
export function exportarReportabilidadDia() {
  var f = $('fRepDiaExp') ? $('fRepDiaExp').value : ''; if (!f) return toast('Elige un día');
  var eq = S.g('eq') || [], filas = (S.g('reportab') || []).filter(function (r) { return r.fecha === f; }).sort(function (a, b) { return a.sigla < b.sigla ? -1 : 1; });
  var dif = function (a, b) { return Math.round((new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / 86400000); };
  var aoa = [['', 'REPORTABILIDAD DIARIA FAENA', '', '', '', '', '', '', '', '', f], ['', 'Sigla', 'Sigla CEN', 'Marca -  Modelo', 'Estatus', 'Ubicación', 'Detalle', 'Fecha Detencion', 'Dias F/S', 'Fecha Proyección', 'Orden de Compra', 'Observación']];
  filas.forEach(function (r, i) {
    var e = eq.find(function (x) { return x.sigla === r.sigla; });
    aoa.push([i + 1, r.siglaCliente || r.sigla, r.sigla, e ? e.modelo : '', r.estatus === 'FS' ? 1 : 2, r.ubicacion || '', r.detalle || '', r.fechaDetencion || '', r.estatus === 'FS' && r.fechaDetencion ? dif(f, r.fechaDetencion) : '', r.proyeccion || '', r.ordenCompra || '', r.observacion || '']);
  });
  var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), f.slice(8, 10) + '-' + f.slice(5, 7));
  XLSX.writeFile(wb, 'Reportabilidad_diaria_' + f + '.xlsx');
}
window.importarReportabilidad = importarReportabilidad;
window.confirmarImportReportabilidad = confirmarImportReportabilidad;
window.exportarReportabilidadDia = exportarReportabilidadDia;

// ═══ CONFIGURAR RENDIMIENTO POR MODELO (2026-09-25) ═══ — cada tipo de
// equipo usa una fórmula de rendimiento distinta (ver logic.js), así que
// cada uno necesita campos distintos. 'locked:true' marca los campos que
// ya tienen un valor REAL de ficha técnica del fabricante (no editables acá
// para no pisar un dato verificado por accidente) — el resto son los
// parámetros operativos que solo terreno puede medir.
var _RENDIMIENTO_CAMPOS_POR_TIPO = {
  'Cargador Frontal': [
    { k: 'q', label: 'Q — Capacidad de balde (m³)', locked: true },
    { k: 'lf', label: 'LF — Factor de llenado' },
    { k: 'e', label: 'E — Eficiencia de operación' },
    { k: 'cm', label: 'Cm — Tiempo de ciclo completo (min)' },
  ],
  'Camión Minero': [
    { k: 'q', label: 'Q — Capacidad de tolva (m³)', locked: true },
    { k: 'lf', label: 'LF — Factor de llenado' },
    { k: 'e', label: 'E — Eficiencia de operación' },
    { k: 'd', label: 'D — Distancia de transporte (km)' },
    { k: 'v1', label: 'V1 — Velocidad cargado (km/h)' },
    { k: 'v2', label: 'V2 — Velocidad vacío (km/h)' },
    { k: 't1', label: 'T1 — Tiempo de carga (min)' },
    { k: 't2', label: 'T2 — Tiempo de descarga (min)' },
  ],
  'Motoniveladora': [
    { k: 'le', label: 'Le — Ancho de hoja (m)', locked: true },
    { k: 'v', label: 'V — Velocidad de trabajo (km/h)' },
    { k: 'fe', label: 'Fe — Solape entre pasadas (m)' },
    { k: 'e', label: 'E — Eficiencia de operación' },
    { k: 'n', label: 'N — N° de pasadas' },
    { k: 't', label: 'T — Espesor de capa (m)' },
  ],
  'Bulldozer': [
    { k: 'q', label: 'Q — Capacidad de hoja (m³)', locked: true },
    { k: 'lf', label: 'LF — Factor de llenado' },
    { k: 'f', label: 'F — Factor de esponjamiento' },
    { k: 'e', label: 'E — Eficiencia de operación' },
    { k: 'cm', label: 'Cm — Tiempo de ciclo (min)' },
  ],
  'Camión Aljibe': [
    { k: 'q', label: 'Q — Capacidad de estanque (m³)', locked: true },
    { k: 'd', label: 'd — Dosis de aplicación (L/m²)' },
    { k: 'e', label: 'E — Eficiencia de operación' },
    { k: 't1', label: 't1 — Tiempo de llenado (min)' },
    { k: 't2', label: 't2 — Tiempo de descarga (min)' },
    { k: 't3', label: 't3 — Tiempo de traslado (min)' },
    { k: 't4', label: 't4 — Tiempo de retorno (min)' },
    { k: 'tr', label: 'tr — Tiempo de maniobra (min)' },
  ],
};
export function configurarRendimientoModelos() {
  var rendModelos = S.g('rendModelos') || [];
  sm('<div style="max-width:720px">' +
    '<h3>⚙️ Rendimiento Teórico por Modelo</h3>' +
    '<p style="font-size:12px;color:var(--tx3)">Los campos en <b>azul</b> son datos reales de ficha técnica del fabricante (no editables acá). Los demás son parámetros operativos que solo se consiguen midiendo en terreno — mientras falten, ese modelo no entra en el cálculo de "Producción Perdida por Detención" arriba. El campo "Fuente" documenta de dónde salió cada dato real.</p>' +
    rendModelos.map(function (r) {
      var campos = _RENDIMIENTO_CAMPOS_POR_TIPO[r.tipo] || [];
      var p = r.parametros || {};
      return '<div class="card" style="margin-bottom:12px">' +
        '<div style="font-weight:700;font-size:13px">' + escapeHtml(r.modelo) + ' <span style="font-size:11px;font-weight:400;color:var(--tx3)">— ' + escapeHtml(r.tipo) + '</span></div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin-top:8px">' +
        campos.map(function (c) {
          var val = p[c.k];
          if (c.locked) {
            return '<div><label style="font-size:10px;color:var(--tx3);display:block">' + escapeHtml(c.label) + '</label>' +
              '<div class="mono" style="color:var(--ac);font-weight:700">' + (val != null ? val : 'Sin dato') + '</div></div>';
          }
          return '<div><label style="font-size:10px;color:var(--tx3);display:block">' + escapeHtml(c.label) + '</label>' +
            '<input type="number" step="any" value="' + (val != null ? val : '') + '" placeholder="Sin medir" onchange="edRendModelo(' + JSON.stringify(r.modelo) + ',' + JSON.stringify(c.k) + ',this.value)" style="width:100%;' + CELL_INPUT_STYLE + '"></div>';
        }).join('') +
        '</div>' +
        (r.fuente ? '<div style="font-size:10px;color:var(--tx3);margin-top:8px;font-style:italic">' + escapeHtml(r.fuente) + '</div>' : '') +
        '</div>';
    }).join('') +
    '<button class="btn btn-o" onclick="cm()">Cerrar</button>' +
    '</div>');
}
export function edRendModelo(modelo, key, val) {
  var rendModelos = S.g('rendModelos') || [];
  var idx = rendModelos.findIndex(function (r) { return r.modelo === modelo; });
  if (idx < 0) return;
  var n = parseFloat(val);
  var parametros = Object.assign({}, rendModelos[idx].parametros || {});
  if (val === '' || isNaN(n)) delete parametros[key];
  else parametros[key] = n;
  rendModelos[idx] = Object.assign({}, rendModelos[idx], { parametros: parametros });
  S.s('rendModelos', rendModelos);
  refreshAll();
  toast('✅ Guardado');
  configurarRendimientoModelos();
}

// Puente window/renders — ver nota en mov.js (primera tanda).
window.renderDisp = renderDisp;
renders.disp = renderDisp;
