// ═══════════════════════════════════════════════════════════════
// PLAN SEMANAL — Planificación Semanal de Mantenciones
// verificarStockPM se movió acá porque solo la usa esta pestaña (chequeo de
// disponibilidad de repuestos en la Vista Tabla).
// ═══════════════════════════════════════════════════════════════
// ═══ MEJORA 4: Verificación de stock para plan semanal ═══
function verificarStockPM(sigla, tipoPM){
  try{
    var consumos = getPautasConsumo(sigla, tipoPM);
    if(!consumos || consumos.length===0)
      return '<td style="text-align:center;font-size:10px;color:var(--tx3)">—</td>';
    var stk = S.g('stk')||[];
    var lub = S.g('lub')||[];
    var norm = function(s){return (s||'').toString().toLowerCase().replace(/[^a-z0-9]/g,'');};
    var faltantes=0, criticos=0, total=0;
    consumos.forEach(function(c){
      if(!c.rep || !c.rep.trim()) return;
      total++;
      var nr = norm(c.rep);
      // Buscar en stock filtros
      var sf = stk.find(function(s){
        return (s.nParte && nr.indexOf(norm(s.nParte))>=0) ||
               (s.descripcion && norm(s.descripcion).length>5 && nr.indexOf(norm(s.descripcion).slice(0,12))>=0);
      });
      if(sf){
        var stock = sf.stockBodega||0;
        var consumoMes = sf.consumoMes||1;
        if(stock<=0 || (sf.estado&&sf.estado.indexOf('COMPRAR')>=0)) criticos++;
        else if(stock < consumoMes*1.5) faltantes++;
        return;
      }
      // Buscar en lubricantes
      var lb = lub.find(function(l){return l.nombre && nr.indexOf(norm(l.nombre).slice(0,10))>=0;});
      if(lb){
        if((lb.stock||0)<=0) criticos++;
        else if((lb.stock||0) < (lb.consumoMes||1)*1.5) faltantes++;
        return;
      }
      // No encontrado en inventario = sin dato
    });
    if(criticos>0)
      return '<td style="text-align:center;background:rgba(239,68,68,0.18)" title="'+criticos+' repuesto(s) sin stock — NO ejecutar"><b style="color:var(--danger)">🔴 '+criticos+'</b></td>';
    if(faltantes>0)
      return '<td style="text-align:center;background:rgba(245,158,11,0.15)" title="'+faltantes+' repuesto(s) con stock bajo"><b style="color:var(--warn)">🟡 '+faltantes+'</b></td>';
    if(total>0)
      return '<td style="text-align:center;background:rgba(16,185,129,0.12)" title="Repuestos disponibles"><b style="color:var(--ok)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg></b></td>';
    return '<td style="text-align:center;font-size:10px;color:var(--tx3)">—</td>';
  }catch(e){
    return '<td style="text-align:center;font-size:10px;color:var(--tx3)">—</td>';
  }
}

window.renderSem=function(){
  if(!$("s-sem"))return;
  var eq=S.g('eq')||[];
  var reg=S.g('reg')||[];
  var semData=S.g('planSem')||[];
  var semHist=S.g('planSemHist')||{};  // {semana: {cerrada:true, items:[...]}}
  var hh=S.g('hh')||25000;
  // La semana operativa parte los JUEVES y termina los MIÉRCOLES — así la
  // trabaja la faena, y el plan tiene que cortar en el mismo punto (antes iba
  // de lunes a domingo, así que el plan quedaba a caballo entre dos semanas
  // reales). Todo se ancla en un único punto — el jueves de la semana 1, o sea
  // el jueves en o antes del 1 de enero — para que el número de semana, sus
  // fechas y sus 7 días siempre estén de acuerdo entre sí.
  var DOW_INICIO=4;  // 0=Dom, 1=Lun … 4=Jue
  // Fecha local en ISO: toISOString() convierte a UTC y puede correr el día
  // completo según la zona horaria — justo lo que no queremos al cortar semanas.
  function isoLocal(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
  function inicioSemanaDe(d){var x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()-DOW_INICIO+7)%7));return x}
  function anclaSem1(y){return inicioSemanaDe(new Date(y,0,1))}
  // Diferencia en semanas exactas. Se redondea a días antes de dividir porque
  // el cambio de hora (horario de verano) hace que una semana no dure
  // exactamente 7×24h y un floor directo restaría una semana de más.
  function semanasEntre(a,b){return Math.round((a-b)/864e5)/7}
  // A qué año pertenece la semana de una fecha. Como la semana corta en jueves,
  // la última de diciembre se mete en enero (y al revés): los primeros días de
  // enero suelen ser todavía la semana 1 que arrancó en diciembre. Si el inicio
  // de esa semana ya llegó al ancla del año siguiente, la semana es la 1 de ese
  // año siguiente. Sin esto, el 31-dic quedaba como "semana 53" de un año de 52
  // y no aparecía en el selector.
  function anioSemanal(d){var ini=inicioSemanaDe(d);return ini>=anclaSem1(ini.getFullYear()+1)?ini.getFullYear()+1:ini.getFullYear()}
  var ANIO_SEM=anioSemanal(new Date());  // el planificador entero trabaja en este año
  function getWeekStart(w){var d=anclaSem1(ANIO_SEM);d.setDate(d.getDate()+(w-1)*7);return d}
  function getWeekNum(){return semanasEntre(inicioSemanaDe(new Date()),anclaSem1(ANIO_SEM))+1}
  function semanasDelAnio(){return semanasEntre(anclaSem1(ANIO_SEM+1),anclaSem1(ANIO_SEM))}
  function getWeekDates(w){
    var d=getWeekStart(w);var end=new Date(d);end.setDate(end.getDate()+6);
    return isoLocal(d)+' al '+isoLocal(end);
  }
  function getWeekDaysArr(w){
    var d=getWeekStart(w);var dias=[];
    for(var i=0;i<7;i++){var dd=new Date(d);dd.setDate(dd.getDate()+i);dias.push(dd);}
    return dias;
  }
  var DIAS_LABEL=['Jue','Vie','Sáb','Dom','Lun','Mar','Mié'];
  var MESES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  var diasMap={'jue':0,'vie':1,'sáb':2,'sab':2,'dom':3,'lun':4,'mar':5,'mié':6,'mie':6};

  // Estas tres líneas van DESPUÉS de los helpers de arriba, no antes: las
  // funciones se elevan (hoisting) pero el valor de un 'var' no, así que
  // llamar a getWeekNum() antes de asignar DOW_INICIO/ANIO_SEM lo hacía
  // devolver NaN. Con semActual=NaN toda comparación da falso, ninguna semana
  // se consideraba pasada y las anteriores nunca mostraban lo ejecutado.
  var semActual=getWeekNum();
  var fSemana=parseInt($('fSemNum')?.value||semActual);
  var fVistaSem=$('fVistaSem')?.value||'calendario';

  // ── ¿Esta semana está cerrada? ────────────────────────────────────────────
  var histEntry=semHist[fSemana]||null;
  var esCerrada=histEntry&&histEntry.cerrada===true;
  var esPasada=fSemana<semActual;

  // ── AUTO-REAL desde reg (PM ejecutados en esa semana) ────────────────────
  // Los registros de registros_pm traen 'equipo', 'tipoPM', 'duracionH' y las
  // fechas de entrada/salida/ejecución. Acá se filtraba por 'r.fecha' y
  // 'r.tipo===pm', campos que no existen en esos registros: la condición no
  // calzaba con nada y la función devolvía SIEMPRE una lista vacía, así que lo
  // ejecutado nunca se recuperaba solo en las semanas pasadas.
  function fechaReg(r){return r.fechaEjec||r.fechaSalida||r.fechaEntrada||''}
  function getRealFromReg(w){
    var diasW=getWeekDaysArr(w);
    var dMin=isoLocal(diasW[0]);
    var dMax=isoLocal(diasW[6]);
    return reg.filter(function(r){var f=fechaReg(r);return f>=dMin&&f<=dMax});
  }

  // ── BUILD ITEMS ───────────────────────────────────────────────────────────
  // Cada semana muestra LO SUYO. Antes el plan se armaba con
  // eq.filter(diasParaPM<=14), que se calcula desde HOY y no miraba la semana
  // elegida: cambiar de semana en el selector devolvía exactamente la misma
  // lista de PM. Ahora un equipo entra en la semana en que cae su fechaProxPM.
  var diasSemSel=getWeekDaysArr(fSemana);
  var wIni=isoLocal(diasSemSel[0]),wFin=isoLocal(diasSemSel[6]);
  var esActual=fSemana==semActual;
  var items;
  if(esCerrada){
    // Semana cerrada: mostrar histórico congelado
    items=histEntry.items||[];
  } else {
    // Distribuye días automáticamente, balanceando carga
    var diaContador={'Jue':0,'Vie':0,'Sáb':0,'Lun':0,'Mar':0,'Mié':0};
    // Precargar días ya ocupados por items manuales
    semData.filter(function(s){return s.semana==fSemana&&!s.auto&&s.diaSem}).forEach(function(s){
      var d=s.diaSem;if(diaContador[d]!==undefined)diaContador[d]++;
    });
    function autoDia(diasPM){
      // Urgencia, en el orden de la semana Jue→Mié: lo más urgente al primer
      // día (Jue) y lo menos urgente al final (Mié). El domingo no se carga.
      // 0-2d → Jue, 3-5d → Vie/Sáb, 6-10d → Lun/Mar, 11-14d → Mié/Mar
      var candidatos=diasPM<=2?['Jue']:diasPM<=5?['Vie','Sáb']:diasPM<=10?['Lun','Mar']:['Mié','Mar'];
      // Elegir el candidato con menos carga
      var mejor=candidatos.reduce(function(a,b){return(diaContador[a]||0)<=(diaContador[b]||0)?a:b});
      diaContador[mejor]=(diaContador[mejor]||0)+1;
      return mejor;
    }
    // Día que le toca dentro de ESTA semana según su fecha real. Al PLANIFICAR,
    // si cae domingo se adelanta al sábado — no se programa PM en domingo y
    // nunca se atrasa. Para un PM ya EJECUTADO ('exacto') el día es el real,
    // domingo incluido: mostrarlo el sábado sería mentir sobre cuándo se hizo
    // (caso real: CN-10155 ejecutado el domingo 19-jul aparecía el sábado 18).
    // null si la fecha no cae en la semana (entonces se usa autoDia).
    function diaPorFecha(f,exacto){
      if(!f)return null;
      var i=Math.round((new Date(f+'T00:00:00')-diasSemSel[0])/864e5);
      if(i<0||i>6)return null;
      var dl=DIAS_LABEL[i];if(dl==='Dom'&&!exacto)dl='Sáb';
      diaContador[dl]=(diaContador[dl]||0)+1;
      return dl;
    }
    // HH Plan desde la duración REAL típica del PM. La columna hrs de las
    // pautas es el INTERVALO de cada tarea ("Filtro aceite motor — cada 500h",
    // "Aceite motor del bus — cada 10.000 km"), NO su duración: sumarla como
    // minutos de trabajo daba planes de cientos de horas y costos de millones
    // (caso real: CN-10160 PM4 con "1725,6h" de plan y cumplimiento 1%). La
    // mejor estimación disponible es lo que ese PM tarda de verdad: mediana de
    // las duraciones registradas del mismo equipo y tipo en registros_pm, o de
    // la flota completa para ese tipo si el equipo aún no tiene historial.
    var hhPlanDe=hhPlanEstimator(reg);
    // Repuestos del equipo para ese tipo de PM, desde las pautas (eso sí está
    // bien en ellas); un PM mayor incluye las tareas de los menores.
    function itemPlan(e,tipoPM,diaSem){
      var siglaRef=GRUPO_PAUTAS[e.sigla]||e.sigla;
      var pmH={'PM1':['PM1'],'PM2':['PM1','PM2'],'PM3':['PM1','PM2','PM3'],'PM4':['PM1','PM2','PM3','PM4'],'PM5':['PM1','PM2','PM3','PM4'],'PM6':['PM1','PM2','PM3','PM4'],'PM7':['PM1','PM2','PM3','PM4'],'PM8':['PM1','PM2','PM3','PM4'],'PM9':['PM1','PM2','PM3','PM4']};
      var pmList=pmH[tipoPM]||[tipoPM];
      var repuestos=[];
      (S.g('pau')||INIT.pautas||[]).forEach(function(p){
        var pRef=GRUPO_PAUTAS[p.sigla]||p.sigla;
        if((p.sigla===siglaRef||pRef===siglaRef)&&pmList.includes(p.pm)){
          if(p.rep)repuestos.push(p.rep);
        }
      });
      var hhPlan=hhPlanDe(e.sigla,tipoPM);
      return{sigla:e.sigla,tipo:e.tipo||'',modelo:e.modelo||'',tipoPM:tipoPM,diasPM:e.diasParaPM||0,
        hhPlan:hhPlan,repuestos:repuestos.slice(0,5).join(' | ').substring(0,120),
        costoEst:Math.round(hhPlan*hh),tecnico:'',estado:'Planificado',
        diaSem:diaSem,obs:'',hhReal:0,estadoReal:'',obsReal:'',semana:parseInt(fSemana),auto:true};
    }
    // Los items guardados a mano mandan: el auto no vuelve a agregar esa sigla
    // (antes se colaba dos veces, una por manualItems y otra por autoItems).
    var manualItems=semData.filter(function(s){return s.semana==fSemana&&!s.auto});
    var yaManual={};manualItems.forEach(function(s){yaManual[s.sigla]=true});
    // Una semana lleva las DOS cosas, no una u otra: lo que YA se ejecutó en sus
    // días y lo que todavía está por venir. Antes la semana en curso solo
    // proyectaba desde fechaProxPM, así que un PM registrado el jueves no
    // aparecía por ninguna parte — y peor, al ejecutarlo su próxima PM se corre
    // hacia adelante y el equipo desaparecía de la semana: ni plan ni ejecución
    // (caso real: GE-10019 proyectado al 27, ejecutado el 25, no salía en la
    // semana 30). Por eso lo ejecutado se arma para cualquier semana con días
    // ya vividos, y la proyección solo para las que no han terminado.
    var yaEnSemana={};
    var ejecItems=getRealFromReg(fSemana).filter(function(r){return !yaManual[r.equipo]}).map(function(r){
      var e=eq.find(function(x){return x.sigla===r.equipo})||{sigla:r.equipo};
      var it=itemPlan(e,r.tipoPM||e.tipoPM||'PM1',diaPorFecha(fechaReg(r),true)||'Jue');
      it.estado='Ejecutado';it.hhReal=Math.round((r.duracionH||0)*10)/10;it.estadoReal='Ejecutado';
      it.obsReal=r.obs||'';it.tecnico=r.tecnico||'';
      // itemPlan llena diasPM con los días hasta la PRÓXIMA PM del equipo,
      // contados desde hoy — para un PM ya ejecutado ese número no significa
      // nada (mostraba cosas como "23d" junto a un trabajo ya hecho).
      it.diasPM=null;
      yaEnSemana[r.equipo]=true;
      return it;
    });
    // Proyección. No basta con mirar la fechaProxPM de cada equipo: eso es solo
    // su PRÓXIMO PM, así que las semanas lejanas quedaban casi vacías — falso,
    // porque tras ese PM viene otro ciclo completo ~2 semanas después, y otro.
    // Se proyecta la CADENA de hitos: el primero es horomProxPM/fechaProxPM (ya
    // con toda la lógica de PM anticipado), y los siguientes cada frecPM horas
    // avanzando al ritmo real del equipo. El tipo de cada hito sale de su
    // horómetro (C.tipoPM), no del tipo del primero. Las vencidas se arrastran
    // a la semana en curso, y un equipo con PM ya ejecutado en la semana no se
    // vuelve a proyectar en ella.
    var projItems=[];
    // Índice hist-por-sigla (ver _indicesRecalc en store.js) — sin esto, cada equipo
    // de la flota disparaba un filter() sobre TODO el historial de horómetros solo
    // para proyectar su cadena de PM de la semana.
    var _histIdxSem=_indicesRecalc().histPorSigla;
    if(!esPasada)eq.forEach(function(e){
      if(yaManual[e.sigla]||yaEnSemana[e.sigla]||!e.fechaProxPM)return;
      if(esActual&&e.fechaProxPM<wIni){
        projItems.push(itemPlan(e,e.tipoPM,diaPorFecha(e.fechaProxPM)||autoDia(e.diasParaPM)));
        return;
      }
      var freq=e.frecPM||250;
      var ritmo=_ritmoRealEq(e.sigla,e.hrsDia||12,_histIdxSem);
      if(!(ritmo>0))ritmo=e.hrsDia>0?e.hrsDia:0;
      var pasoDias=ritmo>0?freq/ritmo:0;
      var hito=e.horomProxPM||0;
      var fecha=new Date(e.fechaProxPM+'T00:00:00');
      var hoyMs=new Date().getTime();
      for(var k=0;k<60&&fecha<=diasSemSel[6];k++){
        var fIso=isoLocal(fecha);
        if(fIso>=wIni&&fIso<=wFin){
          var item=itemPlan(e,C.tipoPM(hito,freq),diaPorFecha(fIso)||autoDia(e.diasParaPM));
          item.diasPM=Math.max(0,Math.round((fecha.getTime()-hoyMs)/864e5));
          projItems.push(item);
        }
        if(!(pasoDias>0))break;    // sin ritmo no se puede proyectar más allá del primero
        hito+=freq;
        fecha=new Date(fecha.getTime()+pasoDias*864e5);
      }
    });
    items=manualItems.concat(ejecItems,projItems);

    // Auto-fill Real desde reg si es semana pasada y no está cerrada
    if(esPasada){
      var regsW=getRealFromReg(fSemana);
      items.forEach(function(it){
        if(!it.hhReal){
          var rMatch=regsW.find(function(r){return r.equipo===it.sigla&&r.tipoPM===it.tipoPM});
          if(rMatch){
            it.hhReal=Math.round((rMatch.duracionH||0)*10)/10;
            it.estadoReal=it.estadoReal||'Ejecutado';
            it.obsReal=it.obsReal||(rMatch.obs||'');
            it.auto=false;
          }
        }
      });
    }
  }

  var totalHHPlan=items.reduce(function(s,it){return s+(it.hhPlan||0)},0);
  var totalHHReal=items.reduce(function(s,it){return s+(it.hhReal||0)},0);
  var totalCosto=items.reduce(function(s,it){return s+(it.costoEst||0)},0);
  var cumpl=totalHHPlan>0?Math.round(totalHHReal/totalHHPlan*100):null;
  var weeks=[];for(var w=1,wTot=semanasDelAnio();w<=wTot;w++)weeks.push(w);

  // ── VISTA CALENDARIO ─────────────────────────────────────────────────────
  function renderCalendario(){
    var diasArr=getWeekDaysArr(fSemana);
    var pmBg={'PM1':'#14532d','PM2':'#1e3a5f','PM3':'#713f12','PM4':'#7f1d1d'};
    var pmTx={'PM1':'#86efac','PM2':'#93c5fd','PM3':'#fde047','PM4':'#fca5a5'};
    var thDias=DIAS_LABEL.map(function(dl,i){
      var dd=diasArr[i];
      var esHoy=dd.toDateString()===new Date().toDateString();
      return'<th style="text-align:center;min-width:90px;padding:8px 4px;'+(esHoy?'color:var(--ac3);border-bottom:2px solid var(--ac)':'')+'">'
        +dl+'<br><span style="font-family:var(--mono);font-weight:400;font-size:10px">'+dd.getDate()+' '+MESES[dd.getMonth()]+'</span></th>';
    }).join('');
    var rows=items.map(function(it){
      var diaNorm=(it.diaSem||'').trim().toLowerCase();
      var diaCelda=(diasMap[diaNorm]!=null)?diasMap[diaNorm]:-1;
      var bg=pmBg[it.tipoPM]||'#374151';
      var tx=pmTx[it.tipoPM]||'#e2e8f0';
      var esEjec=it.estadoReal==='Ejecutado'||it.hhReal>0;
      var celdas=DIAS_LABEL.map(function(dl,i){
        if(i===diaCelda){
          return'<td style="text-align:center;padding:4px 3px">'+
            '<div style="background:'+bg+';color:'+tx+';border-radius:4px;padding:4px 6px;font-weight:700;font-size:11px;border-left:3px solid '+tx+(esEjec?';opacity:0.6':'')+'">'
            +it.tipoPM+(esEjec?' ✓':'')+
            '</div>'+
            (it.tecnico?'<div style="font-size:9px;color:var(--tx3);margin-top:2px">'+escapeHtml(it.tecnico)+'</div>':'')+
            (esEjec&&it.hhReal>0?'<div style="font-size:9px;color:var(--ok);margin-top:1px">'+it.hhReal+'h real</div>':'')+
            '</td>';
        }
        return'<td style="padding:4px 3px"></td>';
      }).join('');
      var dcol=it.diasPM==null?'var(--tx3)':it.diasPM<=3?'var(--danger)':it.diasPM<=7?'var(--warn)':'var(--ok)';
      return'<tr>'+
        '<td style="font-size:11px;color:var(--tx3);padding:5px 8px">'+escapeHtml(it.tipo)+'</td>'+
        '<td class="mono" style="color:var(--ac);font-weight:700;padding:5px 8px">'+escapeHtml(it.sigla)+'</td>'+
        '<td style="text-align:center;padding:5px 4px">'+pb(it.tipoPM)+'</td>'+
        '<td class="mono" style="text-align:center;color:'+dcol+';padding:5px 4px">'+(it.diasPM==null?'—':it.diasPM+'d')+'</td>'+
        celdas+
        '<td style="text-align:center;font-size:10px;color:var(--tx3);padding:5px 4px">'+it.hhPlan+'h</td>'+
        '<td style="text-align:center;font-size:10px;color:'+(esEjec?'var(--ok)':'var(--tx3)')+';padding:5px 4px">'+(it.hhReal||'-')+(it.hhReal?'h':'')+' real</td>'+
        '</tr>';
    }).join('');
    if(!rows)rows='<tr><td colspan="14" style="text-align:center;color:var(--tx3);padding:20px">Sin PM programados para esta semana</td></tr>';
    return'<div style="overflow-x:auto;margin-bottom:16px">'+
      '<table style="min-width:900px;border-collapse:collapse;font-size:12px">'+
      '<thead><tr style="background:var(--bg3)">'+
        '<th style="text-align:left;min-width:90px;padding:8px">Tipo</th>'+
        '<th style="text-align:left;min-width:80px;padding:8px">Sigla BSM</th>'+
        '<th style="text-align:center;min-width:55px;padding:8px">PM</th>'+
        '<th style="text-align:center;min-width:45px;padding:8px">Días</th>'+
        thDias+
        '<th style="text-align:center;min-width:45px;padding:8px">HH Plan</th>'+
        '<th style="text-align:center;min-width:55px;padding:8px">HH Real</th>'+
      '</tr></thead>'+
      '<tbody>'+rows+'</tbody>'+
      '</table></div>'+
      '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;padding:8px 0">'+
      '<span style="font-size:11px;color:var(--tx2);font-weight:600">Leyenda:</span>'+
      ['PM1','PM2','PM3','PM4'].map(function(p){
        var pmBg2={'PM1':'#14532d','PM2':'#1e3a5f','PM3':'#713f12','PM4':'#7f1d1d'};
        var pmTx2={'PM1':'#86efac','PM2':'#93c5fd','PM3':'#fde047','PM4':'#fca5a5'};
        return'<div style="display:flex;align-items:center;gap:5px">'+
          '<div style="background:'+pmBg2[p]+';color:'+pmTx2[p]+';padding:2px 10px;border-radius:3px;font-size:10px;font-weight:700;border-left:2px solid '+pmTx2[p]+'">'+p+'</div>'+
          '<span style="font-size:10px;color:var(--tx3)">'+(p==='PM1'?'250h':p==='PM2'?'500h':p==='PM3'?'1.000h':'2.000h')+'</span>'+
          '</div>';
      }).join('')+
      (esCerrada?'<span style="font-size:10px;color:var(--warn);margin-left:auto"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9 V6 a3 3 0 0 1 6 0 V9" fill="none"/></svg> Semana cerrada — Histórico congelado</span>':
       esPasada?'<span style="font-size:10px;color:var(--ac3);margin-left:auto"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="8" r="5"/><line x1="8" y1="16" x2="12" y2="16"/><line x1="8.5" y1="13" x2="8.5" y2="16"/><line x1="11.5" y1="13" x2="11.5" y2="16"/></svg> Semana pasada — Revisa el Real y cierra</span>':
       '<span style="font-size:10px;color:var(--tx3);margin-left:auto"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="8" r="5"/><line x1="8" y1="16" x2="12" y2="16"/><line x1="8.5" y1="13" x2="8.5" y2="16"/><line x1="11.5" y1="13" x2="11.5" y2="16"/></svg> Cambia a Vista Tabla para asignar días y técnicos</span>')+
      '</div>';
  }

  // ── VISTA TABLA (edición + columnas Real) ─────────────────────────────────
  function renderTabla(){
    var lockStyle=esCerrada?'pointer-events:none;opacity:0.6':'';
    return'<div class="tbl-wrap"><table>'+
      '<tr><th>Equipo</th><th>Tipo</th><th>PM</th><th>Días PM</th>'+
      '<th>HH Plan</th><th>Costo Est</th><th>Técnico</th><th>Día</th><th>Estado Plan</th><th>Repuestos</th><th title="Disponibilidad de repuestos para este PM"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> Stock</th>'+
      '<th style="background:rgba(0,180,0,0.08);color:var(--ok)">HH Real</th>'+
      '<th style="background:rgba(0,180,0,0.08);color:var(--ok)">Estado Real</th>'+
      '<th style="background:rgba(0,180,0,0.08);color:var(--ok)">Obs Real</th>'+
      (esCerrada?'':'<th></th>')+
      '</tr>'+
      items.map(function(it,idx){
        var esEjec=it.estadoReal==='Ejecutado'||it.hhReal>0;
        return'<tr style="'+(esEjec?'background:rgba(0,180,0,0.04)':'')+'">'+
          '<td class="mono" style="color:var(--ac)">'+escapeHtml(it.sigla)+'</td>'+
          '<td style="font-size:11px">'+escapeHtml(it.tipo)+'</td>'+
          '<td>'+pb(it.tipoPM)+'</td>'+
          '<td class="mono" style="color:'+(it.diasPM<=3?'var(--danger)':it.diasPM<=7?'var(--warn)':'var(--ok)')+'">'+it.diasPM+'</td>'+
          '<td class="mono ed" contenteditable style="'+lockStyle+'" onblur="edSem('+idx+',\'hhPlan\',parseFloat(this.innerText)||0)">'+it.hhPlan+'</td>'+
          '<td class="mono ed" contenteditable style="'+lockStyle+'" onblur="edSem('+idx+',\'costoEst\',parseFloat(this.innerText)||0)">$'+fn(Math.round(it.costoEst))+'</td>'+
          '<td class="ed" contenteditable style="font-size:11px;'+lockStyle+'" onblur="edSem('+idx+',\'tecnico\',this.innerText.trim())">'+escapeHtml(it.tecnico)+'</td>'+
          '<td class="ed" contenteditable style="font-size:11px;color:var(--ac3);'+lockStyle+'" onblur="edSem('+idx+',\'diaSem\',this.innerText.trim())">'+escapeHtml(it.diaSem)+'</td>'+
          '<td style="'+lockStyle+'"><select onchange="edSem('+idx+',\'estado\',this.value)" style="font-size:10px;background:var(--bg3);color:var(--tx);border:1px solid var(--bd);border-radius:4px;padding:2px">'+
          ['Planificado','Confirmado','En Ejecución','Ejecutado','Postergado'].map(function(st){return'<option'+(it.estado===st?' selected':'')+'>'+st+'</option>'}).join('')+'</select></td>'+
          '<td style="font-size:10px;max-width:180px;'+lockStyle+'" class="ed" contenteditable onblur="edSem('+idx+',\'repuestos\',this.innerText.trim())">'+escapeHtml(it.repuestos)+'</td>'+
          verificarStockPM(it.sigla,it.tipoPM)+
          // Columnas REAL — siempre editables (Plan congelado, Real corregible)
          '<td class="mono ed" contenteditable style="background:rgba(0,180,0,0.06)" onblur="edSemReal('+fSemana+','+idx+',\'hhReal\',parseFloat(this.innerText)||0)">'+(it.hhReal||0)+'</td>'+
          '<td style="background:rgba(0,180,0,0.06)"><select onchange="edSemReal('+fSemana+','+idx+',\'estadoReal\',this.value)" style="font-size:10px;background:var(--bg3);color:var(--tx);border:1px solid var(--bd);border-radius:4px;padding:2px">'+
          ['','Ejecutado','Parcial','No Ejecutado','Postergado'].map(function(st){return'<option'+(it.estadoReal===st?' selected':'')+'>'+st+'</option>'}).join('')+'</select></td>'+
          '<td class="ed" contenteditable style="font-size:10px;background:rgba(0,180,0,0.06)" onblur="edSemReal('+fSemana+','+idx+',\'obsReal\',this.innerText.trim())">'+escapeHtml(it.obsReal||'')+'</td>'+
          (esCerrada?'':'<td><button class="btn-x" onclick="delSem('+idx+')" title="Eliminar"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg></button></td>')+
          '</tr>';
      }).join('')+
      '</table></div>';
  }

  var contenido=fVistaSem==='calendario'?renderCalendario():renderTabla();

  // ── BADGE SEMANA ──────────────────────────────────────────────────────────
  var badgeSem=esCerrada
    ?'<span style="background:var(--warn);color:#000;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:8px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9 V6 a3 3 0 0 1 6 0 V9" fill="none"/></svg> CERRADA</span>'
    :esPasada
    ?'<span style="background:var(--ac3);color:#000;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:8px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> PASADA</span>'
    :'<span style="background:var(--ok);color:#000;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:8px">★ ACTUAL</span>';
  if(fSemana>semActual) badgeSem='<span style="background:var(--bg3);color:var(--tx3);font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:8px">FUTURA</span>';

  // ── BOTÓN CERRAR SEMANA (solo si es pasada y no cerrada) ──────────────────
  var btnCerrar=(!esCerrada&&esPasada)
    ?'<button class="btn" style="background:var(--warn);color:#000" onclick="cerrarSemana('+fSemana+')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9 V6 a3 3 0 0 1 6 0 V9" fill="none"/></svg> Cerrar Semana '+fSemana+'</button>'
    :(esCerrada?'<button class="btn btn-o" onclick="reabrirSemana('+fSemana+')" style="font-size:10px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9 V6 a3 3 0 0 1 6 0" fill="none"/></svg> Reabrir</button>':'');

  $('s-sem').innerHTML=
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Planificación Semanal'+badgeSem+'</div>'+
    '<div class="sec-s">Semana '+fSemana+' · '+getWeekDates(fSemana)+' · '+(esPasada?'Muestra los PM ejecutados en esa semana':esActual?'Equipos con PM en esta semana + las vencidas pendientes':'Equipos con PM que caen en esta semana')+'</div></div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
    (esCerrada?'':'<button class="btn" onclick="addSemItem()">+ Agregar</button>')+
    '<button class="btn btn-o" onclick="exportCSV(\'sem\')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> CSV</button>'+
    '<button class="btn btn-o" onclick="importSemCSV()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar</button>'+
    btnCerrar+
    '</div></div>'+
    '<div class="toolbar" style="gap:8px;flex-wrap:wrap;align-items:center">'+
    '<button class="btn btn-o btn-s" onclick="navSem(-1)" title="Semana anterior">◀ Ant</button>'+
    '<select id="fSemNum" onchange="renders.sem()">'+
    weeks.map(function(w){
      var wNow=getWeekNum();
      var histW=semHist[w];
      var label=w===wNow?'★ Sem '+w+' (actual)':'Semana '+w;
      if(histW&&histW.cerrada)label='<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9 V6 a3 3 0 0 1 6 0 V9" fill="none"/></svg> '+label;
      return'<option value="'+w+'"'+(w==fSemana?' selected':'')+'>'+label+'</option>';
    }).join('')+
    '</select>'+
    '<button class="btn btn-o btn-s" onclick="navSem(1)" title="Semana siguiente">Sig ▶</button>'+
    '<div style="width:1px;height:20px;background:var(--border);margin:0 4px"></div>'+
    '<select id="fVistaSem" onchange="renders.sem()" style="background:var(--bg3);border:1px solid var(--border);color:var(--tx);padding:5px 8px;border-radius:4px;font-size:12px">'+
    '<option value="calendario"'+(fVistaSem==="calendario"?' selected':'')+'><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Vista Calendario</option>'+
    '<option value="tabla"'+(fVistaSem==="tabla"?' selected':'')+'><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Vista Tabla (editar)</option>'+
    '</select>'+
    '</div>'+
    '<div class="cards no-imprimir">'+
    '<div class="card"><div class="card-t">Trabajos Semana</div><div class="card-v">'+items.length+'</div></div>'+
    '<div class="card"><div class="card-t">HH Plan</div><div class="card-v">'+Math.round(totalHHPlan)+'h</div></div>'+
    (esPasada||esCerrada||totalHHReal>0?'<div class="card"><div class="card-t">HH Real</div><div class="card-v" style="color:var(--ok)">'+Math.round(totalHHReal)+'h</div></div>'+
    '<div class="card"><div class="card-t">Cumplimiento</div><div class="card-v" style="color:'+(cumpl===null?'var(--tx3)':cumpl>=80?'var(--ok)':cumpl>=50?'var(--warn)':'var(--danger)')+'">'+(cumpl===null?'—':cumpl+'%')+'</div></div>':'')+''+
    '<div class="card"><div class="card-t">Costo Estimado</div><div class="card-v" style="color:var(--ac)">$'+fn(Math.round(totalCosto))+'</div></div>'+
    '<div class="card"><div class="card-t">Tarifa HH</div><div class="card-v">$'+fn(hh)+'</div></div>'+
    '</div>'+
    contenido;
};

window.edSem=function(idx,key,val){
  var eq=S.g('eq')||[];
  var semData=S.g('planSem')||[];
  var semHist=S.g('planSemHist')||{};
  var fSemana=parseInt($('fSemNum')?.value||1);
  if(semHist[fSemana]&&semHist[fSemana].cerrada)return; // bloqueado si cerrada
  var autoItems=eq.filter(function(e){return e.diasParaPM<=14}).map(function(e){
    var exists=semData.find(function(s){return s.sigla===e.sigla&&s.semana==fSemana});
    if(exists)return exists;
    return{sigla:e.sigla,tipo:e.tipo,modelo:e.modelo||'',tipoPM:e.tipoPM||'PM1',diasPM:e.diasParaPM||0,hhPlan:0,repuestos:'',costoEst:0,tecnico:'',estado:'Planificado',diaSem:'',obs:'',hhReal:0,estadoReal:'',obsReal:'',semana:parseInt(fSemana),auto:true};
  });
  var manualItems=semData.filter(function(s){return s.semana==fSemana&&!s.auto});
  var items=manualItems.concat(autoItems);
  if(idx<items.length){
    items[idx][key]=val;items[idx].auto=false;
    semData=semData.filter(function(s){return s.semana!=fSemana});
    items.forEach(function(it){semData.push(it)});
    S.s('planSem',semData);
  }
  refreshAll();
};
window.addSemItem=function(){
  var eq=S.g('eq')||[];
  if(!eq.length)return toast('⚠️ No hay equipos cargados');
  sm('<h3>Agregar Ítem al Plan Semanal</h3>'+
    '<div class="form-row"><div class="fg"><label>Equipo</label><select id="semEq">'+
    eq.map(function(e){return'<option>'+escapeHtml(e.sigla)+'</option>'}).join('')+'</select></div>'+
    '<div class="fg"><label>Tipo PM</label><select id="semTipoPM"><option>PM1</option><option>PM2</option><option>PM3</option><option>PM4</option></select></div></div>'+
    '<br><button class="btn" onclick="saveNuevoSemItem()">💾 Guardar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
};
window.saveNuevoSemItem=function(){
  var sigla=$('semEq').value;
  var tipoPM=$('semTipoPM').value;
  var eq=S.g('eq')||[];
  var e=eq.find(function(x){return x.sigla===sigla});
  var semData=S.g('planSem')||[];
  var fSemana=parseInt($('fSemNum')?.value||1);
  semData.push({sigla:sigla,tipo:e?e.tipo:'',modelo:e?e.modelo:'',tipoPM:tipoPM,diasPM:0,hhPlan:0,repuestos:'',costoEst:0,tecnico:'',estado:'Planificado',diaSem:'',obs:'',hhReal:0,estadoReal:'',obsReal:'',semana:fSemana,auto:false});
  S.s('planSem',semData);cm();refreshAll();
};
window.delSem=function(idx){
  var eq=S.g('eq')||[];var semData=S.g('planSem')||[];
  var fSemana=$('fSemNum')?.value||1;
  var autoItems=eq.filter(function(e){return e.diasParaPM<=14}).map(function(e){
    var exists=semData.find(function(s){return s.sigla===e.sigla&&s.semana==fSemana});
    return exists||{sigla:e.sigla,semana:parseInt(fSemana),auto:true};
  });
  var manualItems=semData.filter(function(s){return s.semana==fSemana&&!s.auto});
  var items=manualItems.concat(autoItems);
  if(idx<items.length){
    var removed=items[idx];
    var filaReal=semData.find(function(s){return s.sigla===removed.sigla&&s.semana==fSemana});
    if(filaReal)_moverAPapelera('planSem',filaReal);
    semData=semData.filter(function(s){return!(s.sigla===removed.sigla&&s.semana==fSemana)});
    S.s('planSem',semData);refreshAll();
  }
};
window.navSem=function(delta){
  var sel=$('fSemNum');if(!sel)return;
  var cur=parseInt(sel.value)||1;
  var next=Math.max(1,Math.min(52,cur+delta));
  sel.value=next;renders.sem();
};
// edSemReal: edita SOLO columnas Real — funciona en semanas abiertas Y cerradas
window.edSemReal=function(semana,idx,key,val){
  var semHist=S.g('planSemHist')||{};
  var histEntry=semHist[semana];
  if(histEntry&&histEntry.cerrada){
    // Semana cerrada: actualizar en el histórico congelado
    if(histEntry.items&&histEntry.items[idx]){
      histEntry.items[idx][key]=val;
      S.s('planSemHist',semHist);
    }
  } else {
    // Semana abierta: actualizar en planSem normal
    var semData=S.g('planSem')||[];
    var eq=S.g('eq')||[];
    var autoItems=eq.filter(function(e){return e.diasParaPM<=14}).map(function(e){
      var exists=semData.find(function(s){return s.sigla===e.sigla&&s.semana==semana});
      if(exists)return exists;
      return{sigla:e.sigla,tipo:e.tipo,modelo:e.modelo||'',tipoPM:e.tipoPM||'PM1',diasPM:e.diasParaPM||0,hhPlan:0,repuestos:'',costoEst:0,tecnico:'',estado:'Planificado',diaSem:'',obs:'',hhReal:0,estadoReal:'',obsReal:'',semana:parseInt(semana),auto:true};
    });
    var manualItems=semData.filter(function(s){return s.semana==semana&&!s.auto});
    var items=manualItems.concat(autoItems);
    if(idx<items.length){
      items[idx][key]=val;items[idx].auto=false;
      semData=semData.filter(function(s){return s.semana!=semana});
      items.forEach(function(it){semData.push(it)});
      S.s('planSem',semData);
    }
  }
  refreshAll();
};
window.cerrarSemana=function(w){
  if(!confirm('¿Cerrar semana '+w+'?\n\nEsto congela el histórico Plan vs Real. Podrás reabrirla si necesitas corregir.'))return;
  var eq=S.g('eq')||[];
  var semData=S.g('planSem')||[];
  var semHist=S.g('planSemHist')||{};
  // Build items actuales para esta semana
  var autoItems=eq.filter(function(e){return e.diasParaPM<=14}).map(function(e){
    var exists=semData.find(function(s){return s.sigla===e.sigla&&s.semana==w});
    if(exists)return exists;
    return{sigla:e.sigla,tipo:e.tipo,modelo:e.modelo||'',tipoPM:e.tipoPM||'PM1',diasPM:e.diasParaPM||0,hhPlan:0,repuestos:'',costoEst:0,tecnico:'',estado:'Planificado',diaSem:'',obs:'',hhReal:0,estadoReal:'',obsReal:'',semana:parseInt(w),auto:true};
  });
  var manualItems=semData.filter(function(s){return s.semana==w&&!s.auto});
  var items=manualItems.concat(autoItems);
  semHist[w]={cerrada:true,fechaCierre:new Date().toISOString().slice(0,10),items:JSON.parse(JSON.stringify(items))};
  S.s('planSemHist',semHist);
  refreshAll();alert('✅ Semana '+w+' cerrada y guardada en histórico.');
};
window.reabrirSemana=function(w){
  if(!confirm('¿Reabrir semana '+w+'?\n\nPodrás editar el Plan y el Real nuevamente.'))return;
  var semHist=S.g('planSemHist')||{};
  if(semHist[w]){semHist[w].cerrada=false;}
  S.s('planSemHist',semHist);
  refreshAll();
};
window.importSemCSV=function(){
  var inp=document.createElement('input');inp.type='file';inp.accept='.csv,.json';
  inp.onchange=function(ev){
    var f=ev.target.files[0];if(!f)return;
    var r=new FileReader();r.onload=function(e){
      try{
        if(f.name.endsWith('.json')){S.s('planSem',JSON.parse(e.target.result));}
        else{
          var lines=e.target.result.split('\n');var sem=S.g('planSem')||[];
          var fSemana=parseInt($('fSemNum')?.value||1);
          for(var i=1;i<lines.length;i++){
            var c=lines[i].split(',');if(c.length<3)continue;
            sem.push({sigla:c[0].trim(),tipoPM:c[1].trim(),hhPlan:parseFloat(c[2])||0,tecnico:c[3]||'',diaSem:c[4]||'',estado:'Planificado',semana:fSemana,auto:false,tipo:'',modelo:'',diasPM:0,costoEst:0,repuestos:c[5]||'',obs:''});
          }
          S.s('planSem',sem);
        }
        refreshAll();alert('✅ Plan semanal importado');
      }catch(er){alert('❌ Error: '+er.message)}
    };r.readAsText(f);
  };inp.click();
};
