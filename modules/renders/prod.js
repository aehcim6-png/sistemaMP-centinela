// ═══════════════════════════════════════════════════════════════
// PRODUCCIÓN — ingesta de Reportes de Turno (Día/Noche) por OCR
// (2026-09-30, plan diseñado el 17-09 y retomado esta sesión).
//
// v1 acotado a propósito: solo Producción CAEX + Pérdida por Indisponibilidad
// (las 2 secciones que alimentan Rendimiento real — ver logic.js
// rendimientoRealEquipoMes/tonPerdidaIndisponibilidadMes). Carguío, Apoyo y
// Pérdida por Petróleo quedan para una vuelta futura — el esquema de
// produccion_turno_equipos ya las contempla (columna categoria), así que esa
// vuelta futura no exige otra migración, solo ampliar la Edge Function y esta
// UI. Ver docs/arquitectura.md.
//
// Mismo patrón que _revisarChequeoNeuOCR/_guardarChequeoNeuOCR (neu.js):
// NUNCA se escribe directo a producción — la persona revisa, puede
// destildar filas o reasignar el equipo, y solo al confirmar se guarda.
// Módulo ES (mismo patrón que dash.js/torre.js): sin imports, todo vía el
// realm global compartido con logic.js/store.js/index.html.
// ═══════════════════════════════════════════════════════════════

export function renderProd(){
  var turnos=S.g('prodTurno')||[];
  var turnosEq=S.g('prodTurnoEq')||[];
  var eq=S.g('eq')||[];
  var fMes=$('fProdMes')?.value||'';
  var filtrados=turnos.filter(function(t){return !fMes||(t.fecha||'').slice(0,7)===fMes;});
  filtrados.sort(function(a,b){
    var c=(b.fecha||'').localeCompare(a.fecha||'');
    return c!==0?c:(b.turno||'').localeCompare(a.turno||'');
  });

  // Costo de Downtime por equipo (2026-10-02): toneladas perdidas por
  // indisponibilidad (tonPerdidaIndisponibilidadMes) × margen/tonelada
  // (cfg.margenPorTon, Configuración > Tarifas y Metas). Solo se arma para
  // un mes concreto seleccionado (fMes) — sin mes, no hay "el mes" al que
  // cruzar la pérdida de cada equipo, así que se omite la sección entera
  // en vez de mezclar meses.
  var margenPorTon=(S.g('cfg')||{}).margenPorTon||0;
  var filasDowntime=fMes?eq.map(function(e){
    var ton=tonPerdidaIndisponibilidadMes(e.sigla,fMes,turnosEq,turnos);
    if(!ton)return null;
    var costo=costoDowntimeMes(ton.totalTon,margenPorTon);
    return {sigla:e.sigla,modelo:e.modelo,totalTon:ton.totalTon,totalHoras:ton.totalHoras,costo:costo};
  }).filter(function(f){return f;}):[];
  filasDowntime.sort(function(a,b){return b.totalTon-a.totalTon;});

  var filas=filtrados.map(function(t){
    var eqDelTurno=turnosEq.filter(function(e){return e.turnoId===t.id;});
    var nCaex=eqDelTurno.filter(function(e){return e.categoria==='CAEX';}).length;
    var nPerdida=eqDelTurno.filter(function(e){return e.categoria==='PerdidaIndisponibilidad';}).length;
    return '<tr>'+
      '<td>'+escapeHtml(t.fecha||'')+'</td>'+
      '<td>'+(t.turno==='dia'?'Día':t.turno==='noche'?'Noche':escapeHtml(t.turno||''))+'</td>'+
      '<td style="font-size:12px">'+escapeHtml(t.supervisor||'—')+'</td>'+
      '<td class="mono">'+nCaex+'</td>'+
      '<td class="mono">'+(nPerdida||'—')+'</td>'+
      '<td class="mono">'+(t.totalToneladas!=null?t.totalToneladas:'—')+'</td>'+
      '<td class="mono">'+(t.rendimientoTransporteTonHr!=null?t.rendimientoTransporteTonHr:'—')+'</td>'+
      '</tr>';
  }).join('');

  $('s-prod').innerHTML=
    '<div class="sec-h"><div><div class="sec-t">'+ICONS.tractor+' Producción</div>'+
    '<div class="sec-s">'+turnos.length+' reporte(s) de turno cargado(s)</div></div></div>'+
    '<p style="color:var(--tx2);font-size:13px;margin-bottom:10px">Carga el Reporte de Producción por turno (foto) para que el sistema calcule Rendimiento real por equipo. '+
    'Por ahora se procesan solo Producción CAEX y Pérdida por Indisponibilidad — Carguío, Apoyo y Pérdida por Petróleo quedan para una vuelta futura. '+
    'El % de OEE queda pendiente de que se defina una meta de Rendimiento por tipo de equipo (no se inventa un valor nominal sin ese dato).</p>'+
    '<div class="toolbar">'+
    '<input type="month" id="fProdMes" value="'+escapeHtml(fMes)+'" onchange="renders.prod()">'+
    '<button class="btn" onclick="_activarLeerReporteProduccion()">📷 Leer reporte de turno (foto)</button>'+
    '<input type="file" id="prodReporteFoto" accept="image/*" capture="environment" style="display:none" onchange="_leerReporteProduccionFotoSeleccionada(this)">'+
    '</div>'+
    '<div class="tbl-wrap"><table>'+
    '<tr><th>Fecha</th><th>Turno</th><th>Supervisor</th><th>Equipos CAEX</th><th>Filas Indisp.</th><th>Ton. Totales</th><th>Rend. Transporte [Ton/hr]</th></tr>'+
    (filas||'<tr><td colspan="7" style="font-size:12px;color:var(--tx3)">Sin reportes de turno cargados todavía.</td></tr>')+
    '</table></div>'+
    _prodCostoDowntimeHTML(filasDowntime,fMes,margenPorTon);
}

// Costo de Downtime por equipo (2026-10-02): toneladas perdidas por
// indisponibilidad × margen/tonelada — ver costoDowntimeMes (logic.js).
// Sin mes seleccionado, no se muestra nada (filasDowntime llega []).
function _prodCostoDowntimeHTML(filasDowntime,fMes,margenPorTon){
  if(!fMes)return '';
  var totalTon=0,totalCosto=0,conCosto=0;
  filasDowntime.forEach(function(f){totalTon+=f.totalTon;if(f.costo!=null){totalCosto+=f.costo;conCosto++;}});
  return '<div class="chart-box" style="margin-top:16px">'+
    '<div class="chart-t">💸 Costo de Downtime por Equipo — '+escapeHtml(fMes)+'</div>'+
    '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Toneladas perdidas por indisponibilidad (reportadas en el Reporte de Turno) × Margen por Tonelada (Configuración &gt; Tarifas y Metas).'+
    (margenPorTon?'':' <b style="color:var(--w)">Sin margen configurado — solo se muestran las toneladas, el costo queda sin calcular (nunca se inventa un valor de tonelada).</b>')+
    '</div>'+
    (filasDowntime.length?
      '<div class="cards" style="margin-bottom:10px">'+
      '<div class="card"><div class="card-t">Ton. Perdidas Total</div><div class="card-v" style="color:var(--danger)">'+fn(Math.round(totalTon))+'</div></div>'+
      '<div class="card"><div class="card-t">Costo Downtime Total</div><div class="card-v" style="color:'+(conCosto?'var(--danger)':'var(--tx3)')+'">'+(conCosto?'$'+fn(Math.round(totalCosto)):'—')+'</div></div>'+
      '</div>'+
      '<div class="tbl-wrap"><table><tr><th>Equipo</th><th>Modelo</th><th>Ton. Perdidas</th><th>Horas Indisp.</th><th>Costo Downtime</th></tr>'+
      filasDowntime.map(function(f){
        return '<tr><td class="mono" style="color:var(--ac)">'+f.sigla+'</td>'+
          '<td style="font-size:11px">'+escapeHtml(f.modelo||'')+'</td>'+
          '<td style="text-align:center;font-weight:600;color:var(--danger)">'+fn(f.totalTon)+'</td>'+
          '<td style="text-align:center">'+f.totalHoras+'h</td>'+
          '<td style="text-align:center;font-weight:700;color:'+(f.costo!=null?'var(--danger)':'var(--tx3)')+'">'+(f.costo!=null?'$'+fn(f.costo):'—')+'</td></tr>';
      }).join('')+
      '</table></div>'
      :'<div style="font-size:12px;color:var(--tx3)">Sin Pérdida por Indisponibilidad reportada ese mes.</div>')+
    '</div>';
}

export function _activarLeerReporteProduccion(){
  var inp=$('prodReporteFoto');
  if(inp)inp.click();
}

export async function _leerReporteProduccionFotoSeleccionada(input){
  var file=input.files&&input.files[0];
  if(!file)return;
  toast('⏳ Leyendo reporte de turno...');
  try{
    var comp=await comprimirImagen(file);
    if(!comp){toast('⚠️ No se pudo leer la foto');input.value='';return;}
    var base64=comp.dataUrl.split(',')[1];
    var resp=await _llamarOCRFuncion('leer-reporte-produccion',base64,'image/jpeg');
    if(resp.error){toast('⚠️ '+resp.error);input.value='';return;}
    _revisarReporteProduccionOCR(resp.datos||{caex:[],perdidaIndisponibilidad:[],camposInciertos:[]});
  }catch(err){
    toast('⚠️ Error leyendo reporte: '+err.message);
  }
  input.value='';
}

function _prodOptsEquipo(eqArr,siglaSeleccionada){
  var opts='<option value="">-- sin equipo --</option>';
  opts+=eqArr.map(function(e){
    return '<option value="'+escapeHtml(e.sigla)+'"'+(siglaSeleccionada===e.sigla?' selected':'')+'>'+escapeHtml(e.sigla)+'</option>';
  }).join('');
  return opts;
}

export function _revisarReporteProduccionOCR(datos){
  var eqArr=S.g('eq')||[];
  var turnosExistentes=S.g('prodTurno')||[];
  var inc=datos.camposInciertos||[];
  var duplicado=datos.fecha&&datos.turno&&turnosExistentes.some(function(t){return t.fecha===datos.fecha&&t.turno===datos.turno;});

  var caex=(datos.caex||[]).map(function(row){
    var match=row.sigla?_matchEquipoPorSiglaOCR(row.sigla,eqArr):null;
    return {row:row,siglaMatch:match?match.sigla:null};
  });
  var perdida=(datos.perdidaIndisponibilidad||[]).map(function(row){
    var match=row.sigla?_matchEquipoPorSiglaOCR(row.sigla,eqArr):null;
    return {row:row,siglaMatch:match?match.sigla:null};
  });
  window._prodOCRData={datos:datos,caex:caex,perdida:perdida};

  var filasCaex=caex.map(function(c,i){
    var r=c.row;
    var dudoso=r.incierto?' style="background:rgba(234,179,8,.12)"':'';
    var horasCel=r.totalHoras!=null?r.totalHoras:(r.estadoTexto?escapeHtml(r.estadoTexto):'—');
    return '<tr'+dudoso+'>'+
      '<td><input type="checkbox" id="prodCaexSel_'+i+'" checked></td>'+
      '<td><select id="prodCaexEq_'+i+'" style="font-size:11px">'+_prodOptsEquipo(eqArr,c.siglaMatch)+'</select>'+
      '<br><span style="font-size:10px;color:var(--tx3)">papel: '+escapeHtml(r.sigla||'?')+(r.equipoNombre?' / '+escapeHtml(r.equipoNombre):'')+'</span></td>'+
      '<td class="mono" style="font-size:11px">'+(r.horometroInicial??'')+' → '+(r.horometroFinal??'')+'</td>'+
      '<td class="mono">'+horasCel+'</td>'+
      '<td class="mono">'+(r.vueltas??'')+'</td>'+
      '<td class="mono">'+(r.rendimientoVueltasHr??'')+'</td>'+
      '<td style="font-size:11px">'+escapeHtml(r.operador||'')+'</td>'+
      '<td class="mono">'+(r.totalTon??'')+'</td>'+
      '</tr>';
  }).join('');

  var filasPerdida=perdida.map(function(c,i){
    var r=c.row;
    var dudoso=r.incierto?' style="background:rgba(234,179,8,.12)"':'';
    return '<tr'+dudoso+'>'+
      '<td><input type="checkbox" id="prodPerdSel_'+i+'" checked></td>'+
      '<td><select id="prodPerdEq_'+i+'" style="font-size:11px">'+_prodOptsEquipo(eqArr,c.siglaMatch)+'</select>'+
      '<br><span style="font-size:10px;color:var(--tx3)">papel: '+escapeHtml(r.sigla||'?')+'</span></td>'+
      '<td class="mono" style="font-size:11px">'+(r.horometroInicial??'')+' → '+(r.horometroFinal??'')+'</td>'+
      '<td class="mono">'+(r.totalHoras??'')+'</td>'+
      '<td class="mono">'+(r.tonAsociado??'')+'</td>'+
      '</tr>';
  }).join('');

  sm('<div style="max-width:820px"><h3>📷 Reporte de turno leído</h3>'+
    '<p style="color:var(--tx2);font-size:13px;margin-bottom:8px">Revisa los valores y el equipo asignado a cada fila antes de guardar — desmarca las que no correspondan. Las filas en amarillo tienen letra dudosa.</p>'+
    (duplicado?'<div style="background:rgba(234,179,8,.12);border:1px solid var(--ac);border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px">⚠️ Ya existe un reporte cargado para '+escapeHtml(datos.fecha)+' turno '+escapeHtml(datos.turno)+' — revisa si esto es una corrección o un duplicado antes de guardar.</div>':'')+
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;font-size:12px">'+
    '<label>Fecha<br><input type="date" id="prodFecha" value="'+escapeHtml(datos.fecha||'')+'" style="'+(inc.includes('fecha')?'outline:2px solid var(--warn)':'')+'"></label>'+
    '<label>Turno<br><select id="prodTurnoSel"><option value="dia"'+(datos.turno==='dia'?' selected':'')+'>Día</option><option value="noche"'+(datos.turno==='noche'?' selected':'')+'>Noche</option></select></label>'+
    '<label>Supervisor<br><input id="prodSupervisor" value="'+escapeHtml(datos.supervisor||'')+'"></label>'+
    '<label>Contrato<br><input id="prodContrato" value="'+escapeHtml(datos.contrato||'')+'"></label>'+
    '<label>Total Toneladas<br><input type="number" id="prodTotalTon" value="'+(datos.totalToneladas??'')+'"></label>'+
    '<label>Rend. Transporte [Ton/hr]<br><input type="number" id="prodRendTransp" value="'+(datos.rendimientoTransporteTonHr??'')+'"></label>'+
    '</div>'+
    '<h4 style="margin-bottom:6px">Producción Equipos CAEX</h4>'+
    '<div class="tbl-wrap"><table>'+
    '<tr><th></th><th>Equipo</th><th>Horómetro</th><th>Horas</th><th>Vueltas</th><th>Rend.[V/Hr]</th><th>Operador</th><th>Ton</th></tr>'+
    (filasCaex||'<tr><td colspan="8" style="font-size:12px">Sin filas CAEX leídas</td></tr>')+
    '</table></div>'+
    '<h4 style="margin:12px 0 6px">Pérdida por Indisponibilidad</h4>'+
    '<div class="tbl-wrap"><table>'+
    '<tr><th></th><th>Equipo</th><th>Horómetro</th><th>Horas</th><th>Ton. Asociado</th></tr>'+
    (filasPerdida||'<tr><td colspan="5" style="font-size:12px">Sin filas de pérdida por indisponibilidad leídas</td></tr>')+
    '</table></div>'+
    '<div style="margin-top:14px"><button class="btn" onclick="_guardarReporteProduccionOCR()">'+ICONS.saveIco+' Guardar reporte de turno</button> <button class="btn btn-o" onclick="cm()">Cancelar</button></div>'+
    '</div>');
}

export function _guardarReporteProduccionOCR(){
  var pend=window._prodOCRData;
  if(!pend){toast('⚠️ No hay datos para guardar');return;}

  var fecha=$('prodFecha').value;
  var turno=$('prodTurnoSel').value;
  if(!fecha||!turno){toast('⚠️ Fecha y turno son obligatorios');return;}

  var turnoObj={
    id:_uuidV4(),
    fecha:fecha,
    turno:turno,
    supervisor:$('prodSupervisor').value||null,
    contrato:$('prodContrato').value||null,
    franjaDescarga:pend.datos.franjaDescarga||null,
    moduloDescarga:pend.datos.moduloDescarga||null,
    distanciaModulos:pend.datos.distanciaModulos??null,
    observacionesDistancia:pend.datos.observacionesDistancia||null,
    totalToneladas:parseFloat($('prodTotalTon').value)||null,
    rendimientoTransporteTonHr:parseFloat($('prodRendTransp').value)||null,
    totalVueltas:pend.datos.totalVueltas??null,
    observaciones:pend.datos.observaciones||null,
    registradoPor:(typeof window!=='undefined'&&window._userName)||null,
    fuente:'foto'
  };

  var filasEq=[];
  pend.caex.forEach(function(c,i){
    var chk=$('prodCaexSel_'+i);
    if(!chk||!chk.checked)return;
    var sigla=$('prodCaexEq_'+i).value||null;
    var r=c.row;
    filasEq.push({
      id:_uuidV4(),turnoId:turnoObj.id,sigla:sigla,siglaOCR:r.sigla||null,categoria:'CAEX',
      equipoNombreOCR:r.equipoNombre||null,horometroInicial:r.horometroInicial??null,
      horometroFinal:r.horometroFinal??null,totalHoras:r.totalHoras??null,estadoTexto:r.estadoTexto||null,
      vueltas:r.vueltas??null,rendimientoVueltasHr:r.rendimientoVueltasHr??null,
      tiempoCicloMin:r.tiempoCicloMin??null,operador:r.operador||null,tonVuelta:r.tonVuelta??null,
      tonHr:null,totalTon:r.totalTon??null,postura:null,areaTrabajo:null,tonAsociadoPerdida:null
    });
  });
  pend.perdida.forEach(function(c,i){
    var chk=$('prodPerdSel_'+i);
    if(!chk||!chk.checked)return;
    var sigla=$('prodPerdEq_'+i).value||null;
    var r=c.row;
    filasEq.push({
      id:_uuidV4(),turnoId:turnoObj.id,sigla:sigla,siglaOCR:r.sigla||null,categoria:'PerdidaIndisponibilidad',
      equipoNombreOCR:null,horometroInicial:r.horometroInicial??null,horometroFinal:r.horometroFinal??null,
      totalHoras:r.totalHoras??null,estadoTexto:null,vueltas:null,rendimientoVueltasHr:null,tiempoCicloMin:null,
      operador:null,tonVuelta:null,tonHr:null,totalTon:null,postura:null,areaTrabajo:null,
      tonAsociadoPerdida:r.tonAsociado??null
    });
  });

  if(!filasEq.length){toast('⚠️ No se tildó ninguna fila — nada que guardar');return;}

  var turnos=S.g('prodTurno')||[];
  turnos.push(turnoObj);
  S.s('prodTurno',turnos);
  var turnosEq=S.g('prodTurnoEq')||[];
  turnosEq=turnosEq.concat(filasEq);
  S.s('prodTurnoEq',turnosEq);

  window._prodOCRData=null;
  cm();
  renders.prod();
  toast('✅ Reporte de turno guardado — '+filasEq.length+' fila(s)');
}

window.renderProd = renderProd;
window._activarLeerReporteProduccion = _activarLeerReporteProduccion;
window._leerReporteProduccionFotoSeleccionada = _leerReporteProduccionFotoSeleccionada;
window._revisarReporteProduccionOCR = _revisarReporteProduccionOCR;
window._guardarReporteProduccionOCR = _guardarReporteProduccionOCR;
renders.prod = renderProd;
