// Pestaña Carta Gantt (Gantt de Mantención, sub-pestaña de Planificación y
// Agenda) — extraída a su propio archivo (Fase 2 de modularización). Script
// plano (NO módulo ES), mismo scope global de siempre. mesesAutomaticos() y
// _progDiaDetectarSigla() quedan en index.html — también las usan
// renders.avance y el parser de Programación Diaria respectivamente.
window.renderGantt=function(){
  if(!$("s-gantt"))return;
  var eq=S.g('eq')||[];var ganttData=S.g('gantt')||[];
  var fMes=$('fGanttMes')?.value||new Date().toISOString().slice(0,7);
  var yr=parseInt(fMes.slice(0,4));var mn=parseInt(fMes.slice(5,7));
  var daysInMonth=new Date(yr,mn,0).getDate();
  var today=new Date().toISOString().slice(0,10);
  var todayDay=today.slice(0,7)===fMes?parseInt(today.slice(8,10)):0;
  var meses=mesesAutomaticos(ganttData.map(function(g){return g.inicio}).concat(ganttData.map(function(g){return g.fin})));

  // Sync gantt data with equipos
  // Salvaguarda: si 'eq' llega vacío (misma clase de bug que syncEquipos), no filtrar/guardar.
  if(eq.length){
  var gSiglas=ganttData.map(function(g){return g.sigla});
  eq.forEach(function(e){
    if(gSiglas.indexOf(e.sigla)<0){
      ganttData.push({sigla:e.sigla,tipo:e.tipo,pm:e.tipoPM||'PM1',inicio:'',fin:'',estado:'Planificado',avance:0});
    }
  });
  // Refresca el tipo de PM de las filas AÚN NO planificadas (sin fechas): quedó
  // congelado al crearse la fila, con las fórmulas de ese momento. Una fila ya
  // planificada no se toca — sus fechas y PM son decisión del planificador.
  ganttData.forEach(function(g){
    if(g.inicio||g.fin)return;
    var e=eq.find(function(x){return x.sigla===g.sigla});
    if(e&&e.tipoPM)g.pm=e.tipoPM;
  });
  ganttData=ganttData.filter(function(g){return eq.some(function(e){return e.sigla===g.sigla})});
  S.s('gantt',ganttData);
  }

  var regGantt=S.g('reg')||[];var otGantt=S.g('ot')||[];
  var progDiaGantt=S.g('progDia')||[];
  var siglasEqGantt=eq.map(function(e){return e.sigla;});
  // Índice sigla+fecha -> Set(técnicos) construido UNA vez — antes se recorría
  // progDiaGantt completo (con su propio scan de bloques + detección de sigla) por
  // CADA fila de la tabla (equipo), es decir O(equipos × entradas × bloques);
  // ahora es O(entradas × bloques) una sola vez, y cada fila solo hace un lookup.
  var tecnicosPorSiglaFecha={};
  progDiaGantt.forEach(function(pd){
    (pd.bloques||[]).forEach(function(b){
      var sig=_progDiaDetectarSigla(b.actividad,siglasEqGantt);
      if(!sig)return;
      var clave=sig+'|'+pd.fecha;
      if(!tecnicosPorSiglaFecha[clave])tecnicosPorSiglaFecha[clave]=new Set();
      tecnicosPorSiglaFecha[clave].add(pd.nombre);
    });
  });
  var days=[];for(var d=1;d<=daysInMonth;d++)days.push(d);

  $('s-gantt').innerHTML=
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Gantt de Mantención</div>'+
    '<div class="sec-s">Plan vs Ejecución · Click en celda de fecha para editar</div></div></div>'+
    '<div class="toolbar"><select id="fGanttMes" onchange="renders.gantt()">'+
    meses.map(function(m){return'<option'+(fMes===m?' selected':'')+'>'+m+'</option>'}).join('')+'</select>'+
    '<div style="display:flex;gap:8px;font-size:10px;align-items:center">'+
    '<span style="display:inline-block;width:14px;height:14px;background:#AED6F1;border-radius:2px"></span> Planificado '+
    '<span style="display:inline-block;width:14px;height:14px;background:#82E0AA;border-radius:2px"></span> Ejecutado '+
    '<span style="display:inline-block;width:14px;height:14px;background:#F5B7B1;border-radius:2px"></span> Atrasado '+
    '<span style="display:inline-block;width:14px;height:14px;background:#F9E79F;border-radius:2px"></span> En Ejecución</div></div>'+
    '<div class="tbl-wrap" style="overflow-x:auto"><table style="font-size:10px">'+
    '<tr><th style="min-width:80px">Equipo</th><th>PM</th><th style="min-width:75px">Inicio</th><th style="min-width:75px">Fin</th><th>Estado</th><th>%</th>'+
    days.map(function(d){return'<th style="width:22px;text-align:center;font-size:9px;'+(d===todayDay?'background:#f59e0b;color:#fff':'')+'">'+d+'</th>'}).join('')+'</tr>'+
    ganttData.map(function(g,gi){
      var iniDay=g.inicio?parseInt(g.inicio.slice(8,10)):0;
      var finDay=g.fin?parseInt(g.fin.slice(8,10)):0;
      var iniMes=g.inicio?g.inicio.slice(0,7):'';
      var finMes=g.fin?g.fin.slice(0,7):'';
      var diasEjecPM={},diasEjecCorr={};
      var fechasReales=[];
      regGantt.forEach(function(r){
        var f=r.fechaEntrada||r.fechaEjec||'';
        if(r.equipo===g.sigla&&f.slice(0,7)===fMes){diasEjecPM[parseInt(f.slice(8,10))]=true;fechasReales.push(f);}
      });
      otGantt.forEach(function(o){
        var f=o.fecha||'';
        if(o.sigla===g.sigla&&f.slice(0,7)===fMes){diasEjecCorr[parseInt(f.slice(8,10))]=true;fechasReales.push(f);}
      });
      var totalEjecReal=Object.keys(diasEjecPM).length+Object.keys(diasEjecCorr).length;
      var hayReal=fechasReales.length>0;
      fechasReales.sort();
      var iniMostrar=hayReal?fechasReales[0]:g.inicio;
      var finMostrar=hayReal?fechasReales[fechasReales.length-1]:g.fin;
      var estadoMostrar=hayReal?'Ejecutado':g.estado;
      var avanceMostrar=hayReal?100:g.avance;
      // Técnicos que trabajaron en este equipo, según Programación Diaria de las
      // mismas fechas con registro real — lookup en el índice precomputado de arriba.
      var tecnicosGantt=[];
      if(hayReal){
        var setTec=new Set();
        var fechasUnicas={};fechasReales.forEach(function(f){fechasUnicas[f.slice(0,10)]=true;});
        Object.keys(fechasUnicas).forEach(function(f){
          var s=tecnicosPorSiglaFecha[g.sigla+'|'+f];
          if(s)s.forEach(function(n){setTec.add(n);});
        });
        tecnicosGantt=[...setTec];
      }
      return'<tr'+(hayReal?' style="background:rgba(34,197,94,.06)"':'')+'>'+
        '<td class="mono" style="color:var(--ac)">'+escapeHtml(g.sigla)+'</td>'+
        '<td>'+pb(g.pm)+'</td>'+
        '<td class="ed" contenteditable onblur="edGantt('+gi+',\'inicio\',this.innerText.trim())" style="font-size:9px" title="'+(hayReal?'Auto-detectado desde reg/ot — puedes igual editarlo a mano':'')+'">'+iniMostrar+'</td>'+
        '<td class="ed" contenteditable onblur="edGantt('+gi+',\'fin\',this.innerText.trim())" style="font-size:9px">'+finMostrar+'</td>'+
        '<td>'+(hayReal?'<span style="font-size:9px;color:#22c55e;font-weight:700"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> Ejecutado ('+totalEjecReal+' reg.)</span>'+(tecnicosGantt.length?'<br><span style="font-size:8px;color:var(--tx3)" title="Según Programación Diaria"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11 A6 6 0 0 1 16 11" fill="none"/><line x1="2" y1="11" x2="18" y2="11"/><line x1="10" y1="5" x2="10" y2="3"/></svg> '+escapeHtml(tecnicosGantt.join(', '))+'</span>':''):
        '<select onchange="edGantt('+gi+',\'estado\',this.value)" style="font-size:9px;background:var(--bg3);color:var(--tx);border:1px solid var(--bd);border-radius:3px;padding:1px">'+
        ['Planificado','En Ejecución','Ejecutado','Atrasado','Postergado'].map(function(s){return'<option'+(g.estado===s?' selected':'')+'>'+s+'</option>'}).join('')+'</select>')+'</td>'+
        '<td class="'+(hayReal?'':'ed')+' mono" '+(hayReal?'':'contenteditable onblur="edGantt('+gi+',\'avance\',parseInt(this.innerText)||0)"')+' style="text-align:center;'+(hayReal?'color:#22c55e;font-weight:700':'')+'">'+avanceMostrar+'%</td>'+
        days.map(function(d){
          var inRange=iniMes===fMes&&finMes===fMes&&d>=iniDay&&d<=finDay;
          var bg='';
          if(diasEjecCorr[d])bg='#82E0AA';
          else if(diasEjecPM[d])bg='#82E0AA';
          else if(inRange){
            if(g.estado==='Ejecutado')bg='#82E0AA';
            else if(g.estado==='Atrasado')bg='#F5B7B1';
            else if(g.estado==='En Ejecución')bg='#F9E79F';
            else bg='#AED6F1';
          }
          var todayMark=d===todayDay?'border-left:2px solid #f59e0b;':'';
          var titulo=diasEjecPM[d]?' title="PM ejecutado"':diasEjecCorr[d]?' title="Correctivo registrado"':'';
          return'<td'+titulo+' style="'+todayMark+(bg?'background:'+bg:'')+'"></td>';
        }).join('')+'</tr>';
    }).join('')+
    '</table></div>';
};
window.edGantt=function(idx,key,val){
  var g=S.g('gantt')||[];
  _edCampo('gantt',g,idx,key,val);
  refreshAll();
};
