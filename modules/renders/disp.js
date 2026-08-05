// Pestaña Disponibilidad Mecánica — extraída a su propio archivo (Fase 2 de
// modularización). Script plano (NO módulo ES), mismo scope global de
// siempre. dispDownMap/dispEquipoMes viven en logic.js (fuente única
// compartida). registrarSalidaServicio/guardarSalidaServicio/
// cerrarSalidaServicio quedan en index.html — cerrarSalidaServicio también
// lo usa renders.ot (aún sin extraer) para el mismo listado de "fuera de
// servicio en curso".
window.renderDisp=function(){
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
    var totalFlota=conDatos.length?Math.round(conDatos.reduce(function(s,e){return s+e.pct},0)/conDatos.length*10)/10:0;
    var bajoMeta=conDatos.filter(function(e){return e.pct<meta}).length;
    var sinRegistros=conDatos.filter(function(e){return !e.manual&&e.diasReg===0}).length;
    var col=totalFlota>=meta?'var(--ok)':totalFlota>=70?'var(--w)':'var(--danger)';

    content=
    '<div style="display:flex;align-items:center;gap:16px;background:var(--bg3);border-radius:10px;padding:14px;margin-bottom:16px">'+
    '<div style="text-align:center;min-width:100px"><div style="font-size:36px;font-weight:800;color:'+col+'">'+totalFlota+'%</div><div style="font-size:10px;color:var(--tx3)">FLOTA '+fMes+'</div></div>'+
    '<div style="flex:1">'+
    '<div style="background:color-mix(in srgb,'+col+' 18%,var(--bg4));border-radius:6px;height:18px;overflow:hidden;margin-bottom:6px;cursor:default" onmouseenter="vizTip(event,\'Flota: '+totalFlota+'% · '+conDatos.length+' equipos con dato · '+bajoMeta+' bajo meta\')" onmousemove="vizTipMove(event)" onmouseleave="vizTipHide()"><div style="background:'+col+';height:100%;width:'+Math.min(totalFlota,100)+'%"></div></div>'+
    '<div style="font-size:12px;color:'+col+'">'+(totalFlota>=meta?'<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> Sobre meta '+meta+'%':'<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> Bajo meta — '+Math.round(meta-totalFlota)+'% brecha')+' · '+conDatos.length+' equipos · '+bajoMeta+' bajo meta</div>'+
    (sinRegistros>0?'<div style="font-size:11px;color:var(--warn);margin-top:4px" title="Estos equipos no tienen ninguna detención cargada este mes, así que su 100% es asumido — el promedio de flota puede estar inflado hasta que cargues sus datos"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> '+sinRegistros+' equipo'+(sinRegistros===1?'':'s')+' sin registros este mes (100% asumido — cargá sus salidas de servicio para que el número sea real)</div>':'')+'</div></div>'+
    '<div class="tbl-wrap"><table>'+
    '<tr><th>Equipo</th><th>Tipo</th><th>Modelo</th><th>Disp. %</th><th>Barra</th><th>vs Meta</th><th title="Respaldo del número: registros reales de detención, valor cargado a mano, o asumido por falta de datos">Datos</th></tr>'+
    eqDisp.sort(function(a,b){return(a.pct||999)-(b.pct||999)}).map(function(e){
      if(e.pct===undefined)return'<tr><td class="mono">'+escapeHtml(e.sigla)+'</td><td>'+escapeHtml(e.tipo)+'</td><td style="font-size:11px">'+escapeHtml(e.modelo)+'</td><td colspan="4" style="color:var(--tx3)">Sin datos</td></tr>';
      var c=e.pct>=meta?'var(--ok)':e.pct>=70?'var(--w)':'var(--danger)';
      // Etiqueta de respaldo del dato
      var datos;
      if(e.manual)datos='<span class="badge b-b" title="Valor cargado a mano (override o import)">✍ manual</span>';
      else if(e.diasReg>0)datos='<span style="font-size:10px;color:var(--tx3)" title="Días del mes con al menos una detención registrada"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> '+e.diasReg+' día'+(e.diasReg===1?'':'s')+' c/registro</span>';
      else datos='<span class="badge b-y" title="No hay ninguna detención cargada este mes — el % se asume completo. Cargá las salidas de servicio para que sea real."><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> sin registros</span>';
      return'<tr><td class="mono" style="color:var(--ac)">'+escapeHtml(e.sigla)+'</td><td style="font-size:11px">'+escapeHtml(e.tipo)+'</td><td style="font-size:11px">'+escapeHtml(e.modelo)+'</td>'+
        '<td class="mono ed" style="color:'+c+';font-weight:700" contenteditable onblur="var d=S.g(\'dispCalc\')||{};if(!d[\''+escapeHtml(e.sigla)+'\'])d[\''+escapeHtml(e.sigla)+'\']={}; d[\''+escapeHtml(e.sigla)+'\'][\''+fMes+'\']=parseFloat(this.innerText)||0;S.s(\'dispCalc\',d);refreshAll()">'+e.pct+'%</td>'+
        '<td><div style="background:color-mix(in srgb,'+c+' 18%,var(--bg4));border-radius:4px;height:10px;width:120px;overflow:hidden"><div style="background:'+c+';height:100%;width:'+Math.min(e.pct,100)+'%"></div></div></td>'+
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
    var todayA=new Date().toISOString().slice(0,10);
    var calcMF=function(sigla,mes){
      if(dispCalc[sigla]&&dispCalc[sigla][mes]!==undefined)return dispCalc[sigla][mes];
      if(mes==='2026-04'&&dAbr[sigla]!==undefined)return dAbr[sigla];
      var yyM=parseInt(mes.slice(0,4)),mmM=parseInt(mes.slice(5,7));
      var daysM=new Date(yyM,mmM,0).getDate();
      var eqObj=eq.find(function(e){return e.sigla===sigla});
      var hrsDia=eqObj?eqObj.hrsDia||12:12;
      var totalDown=0;var diasConDatos=0;
      for(var dd=1;dd<=daysM;dd++){var ds=mes+'-'+('0'+dd).slice(-2);if(ds>todayA)break;diasConDatos++;if(downMap[sigla]&&downMap[sigla][ds])totalDown+=downMap[sigla][ds];}
      if(!diasConDatos)return undefined;
      return Math.round((diasConDatos*hrsDia-totalDown)/(diasConDatos*hrsDia)*1000)/10;
    };
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
  var fsEnCurso=ot.map(function(o,i){return{o:o,i:i};}).filter(function(x){
    return x.o.estatusEq==='Fuera de Servicio'&&x.o.fechaEntrada&&!x.o.fechaSalida;
  });
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

  $('s-disp').innerHTML=
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,5 8,10 11,7 17,16"/><polyline points="12,16 17,16 17,11"/></svg> Disponibilidad Mecánica</div>'+
    '<div class="sec-s">Cálculo automático desde registros PM + correctivos + equipo fuera de servicio · Meta editable</div></div>'+
    '<div style="display:flex;gap:8px"><button class="btn" style="background:var(--danger);color:#fff" onclick="registrarSalidaServicio()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="8"/><line x1="4.5" y1="15.5" x2="15.5" y2="4.5"/></svg> Registrar salida de servicio</button><button class="btn btn-o" onclick="exportCSV(\'disp\')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> CSV</button><button class="btn btn-o" onclick="importDispCSV()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar</button></div></div>'+
    fsEnCursoHTML+
    '<div class="toolbar">'+
    '<select id="fDispVista" onchange="renders.disp()"><option value="mensual"'+(fVista==='mensual'?' selected':'')+'><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Mensual</option><option value="semanal"'+(fVista==='semanal'?' selected':'')+'><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Semanal</option><option value="diario"'+(fVista==='diario'?' selected':'')+'><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Diario</option><option value="anual"'+(fVista==='anual'?' selected':'')+'><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Anual</option></select>'+
    '<select id="fDispMes" onchange="renders.disp()">'+meses.map(function(m){return'<option'+(fMes===m?' selected':'')+'>'+m+'</option>'}).join('')+'</select>'+
    '<select id="fDispAnio" onchange="renders.disp()">'+availYears.map(function(y){return'<option'+(fAnio===y?' selected':'')+'>'+y+'</option>'}).join('')+'</select>'+
    '<select id="fDispTipo" onchange="renders.disp()"><option value="">Todos los equipos</option>'+
    tipos.map(function(t){return'<option'+(fTipo===t?' selected':'')+'>'+t+'</option>'}).join('')+'</select>'+
    '<div style="font-size:11px;color:var(--tx3)">Meta: <span contenteditable style="color:var(--ac);font-weight:700;cursor:pointer" onblur="var v=parseFloat(this.innerText);if(v>0){S.s(\'dispMeta\',v);refreshAll()}">'+meta+'%</span></div>'+
    '</div>'+
    content;
};
