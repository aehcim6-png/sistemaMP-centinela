// ═══════════════════════════════════════════════════════════════
// PRODUCCIÓN — ingesta de Reportes de Turno (Día/Noche) por OCR
// (2026-09-30, plan diseñado el 17-09 y retomado esta sesión).
//
// Reporte completo (2026-10-30): la foto guarda las cinco tablas del papel (CAEX,
// Carguío, Apoyo, Pérdida por Petróleo, Pérdida por Indisponibilidad), los totales de
// transporte y de carguío, la lista de disponibilidad y la bitácora de eventos.
// El Rendimiento real y el costo de downtime siguen mirando solo las categorías que
// ya usaban (CAEX / PerdidaIndisponibilidad — ver logic.js); las filas nuevas
// quedan guardadas para consulta. La conversión de la foto a filas es pura y está en
// logic.js (reporteTurnoFilas / reporteTurnoResolverSiglas, con pruebas). Ver docs/arquitectura.md.
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

  // Rendimiento Teórico por Tiempo de Ciclo real (2026-10-05): tiempoCicloMin
  // se capturaba por turno desde que existe este módulo pero no alimentaba
  // ningún cálculo — ver rendimientoPorCicloEquipoMes/brechaRendimientoCiclo
  // (logic.js). Sirve para CUALQUIER equipo con ciclo reportado (CAEX o
  // Carguío), no solo Cargador Frontal con los 4 parámetros de catálogo
  // cargados. La brecha solo se calcula cuando además hay rendimiento REAL
  // de vueltas/hr ese mes (hoy, solo CAEX vía rendimientoRealEquipoMes).
  var filasCiclo=fMes?eq.map(function(e){
    var teorico=rendimientoPorCicloEquipoMes(e.sigla,fMes,turnosEq,turnos);
    if(!teorico)return null;
    var real=rendimientoRealEquipoMes(e.sigla,fMes,turnosEq,turnos);
    var brecha=real?brechaRendimientoCiclo(real,teorico):null;
    return {sigla:e.sigla,modelo:e.modelo,teorico:teorico,real:real,brecha:brecha};
  }).filter(function(f){return f;}):[];
  filasCiclo.sort(function(a,b){return(b.brecha??-999)-(a.brecha??-999);});

  var filas=filtrados.map(function(t){
    var eqDelTurno=turnosEq.filter(function(e){return e.turnoId===t.id;});
    var nCaex=eqDelTurno.filter(function(e){return e.categoria==='CAEX';}).length;
    var nPerdida=eqDelTurno.filter(function(e){return e.categoria==='PerdidaIndisponibilidad';}).length;
    var nCarguio=eqDelTurno.filter(function(e){return e.categoria==='Carguio';}).length;
    var nApoyo=eqDelTurno.filter(function(e){return e.categoria==='Apoyo';}).length;
    return '<tr>'+
      '<td>'+escapeHtml(t.fecha||'')+'</td>'+
      '<td>'+(t.turno==='dia'?'Día':t.turno==='noche'?'Noche':escapeHtml(t.turno||''))+'</td>'+
      '<td style="font-size:12px">'+escapeHtml(t.supervisor||'—')+'</td>'+
      '<td class="mono">'+nCaex+'</td>'+
      '<td class="mono">'+(nCarguio||'—')+'</td>'+
      '<td class="mono">'+(nApoyo||'—')+'</td>'+
      '<td class="mono">'+(nPerdida||'—')+'</td>'+
      '<td class="mono">'+(t.totalToneladas!=null?t.totalToneladas:'—')+'</td>'+
      '<td class="mono">'+(t.rendimientoTransporteTonHr!=null?t.rendimientoTransporteTonHr:'—')+'</td>'+
      '</tr>';
  }).join('');

  $('s-prod').innerHTML=
    '<div class="sec-h"><div><div class="sec-t">'+ICONS.tractor+' Producción</div>'+
    '<div class="sec-s">'+turnos.length+' reporte(s) de turno cargado(s)</div></div></div>'+
    '<p style="color:var(--tx2);font-size:13px;margin-bottom:10px">Carga el Reporte de Producción por turno (foto) para que el sistema calcule Rendimiento real por equipo. '+
    'Se lee el reporte completo: CAEX, Carguío, Apoyo, Pérdida por Petróleo y por Indisponibilidad, los totales, la disponibilidad y la bitácora del turno. '+
    'El % de OEE queda pendiente de que se defina una meta de Rendimiento por tipo de equipo (no se inventa un valor nominal sin ese dato).</p>'+
    '<div class="toolbar">'+
    '<input type="month" id="fProdMes" value="'+escapeHtml(fMes)+'" onchange="renders.prod()">'+
    '<button class="btn" onclick="_activarLeerReporteProduccion()">📷 Leer reporte de turno (foto)</button>'+
    '<input type="file" id="prodReporteFoto" accept="image/*" capture="environment" style="display:none" onchange="_leerReporteProduccionFotoSeleccionada(this)">'+
    '</div>'+
    '<div class="tbl-wrap"><table>'+
    '<tr><th>Fecha</th><th>Turno</th><th>Supervisor</th><th>Equipos CAEX</th><th>Carguío</th><th>Apoyo</th><th>Filas Indisp.</th><th>Ton. Totales</th><th>Rend. Transporte [Ton/hr]</th></tr>'+
    (filas||'<tr><td colspan="9" style="font-size:12px;color:var(--tx3)">Sin reportes de turno cargados todavía.</td></tr>')+
    '</table></div>'+
    _prodCostoDowntimeHTML(filasDowntime,fMes,margenPorTon)+
    _prodRendimientoCicloHTML(filasCiclo,fMes);
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

// Rendimiento Teórico por Tiempo de Ciclo real (2026-10-05) — ver
// rendimientoPorCicloEquipoMes/brechaRendimientoCiclo/coeficienteVariacion/
// interpretacionCV (logic.js). Sin mes seleccionado, no se muestra nada
// (filasCiclo llega []).
function _prodRendimientoCicloHTML(filasCiclo,fMes){
  if(!fMes)return '';
  return '<div class="chart-box" style="margin-top:16px">'+
    '<div class="chart-t">🔁 Rendimiento Teórico por Tiempo de Ciclo — '+escapeHtml(fMes)+'</div>'+
    '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Vueltas/hr que darías si se repitiera sin pausas la MEDIANA del tiempo de ciclo real medido ese mes (no un parámetro fijo de catálogo) — sirve para CAEX y Carguío por igual. "Consistencia (CV)" es el Coeficiente de Variación del ciclo (σ/x̄) — dos equipos pueden tener el mismo ciclo mediano pero uno con ciclos parejos (CV bajo, "Estable") y otro muy errático (CV alto, señal de tránsito irregular, esperas intermitentes u otra causa operativa); bandas de lectura rápida, no un umbral de norma certificada. La "Brecha" solo aparece cuando además hay rendimiento real de vueltas/hr ese mes (hoy, solo CAEX): positiva = se pierde producción en esperas/colas que no quedan como horas de detención formal; negativa = el real superó la mediana teórica (dato válido, no un error).</div>'+
    (filasCiclo.length?
      '<div class="tbl-wrap"><table><tr><th>Equipo</th><th>Modelo</th><th>Ciclo mediano</th><th>Consistencia (CV)</th><th>Vueltas/hr teórico</th><th>Ton/hr teórico</th><th>Vueltas/hr real</th><th>Brecha</th></tr>'+
      filasCiclo.map(function(f){
        var b=f.brecha;
        var colB=b==null?'var(--tx3)':b>15?'var(--danger)':b>0?'var(--w)':'var(--ok)';
        var cv=f.teorico.cvPct;
        var lecturaCV=interpretacionCV(cv);
        var colCV=lecturaCV==='Errático'?'var(--danger)':lecturaCV==='Variable'?'var(--w)':lecturaCV==='Estable'?'var(--ok)':'var(--tx3)';
        return '<tr><td class="mono" style="color:var(--ac)">'+f.sigla+'</td>'+
          '<td style="font-size:11px">'+escapeHtml(f.modelo||'')+'</td>'+
          '<td style="text-align:center">'+f.teorico.cicloMedianoMin+' min</td>'+
          '<td style="text-align:center;font-weight:700;color:'+colCV+'">'+(cv!=null?cv+'% ('+lecturaCV+')':'—')+'</td>'+
          '<td style="text-align:center;font-weight:700">'+f.teorico.vueltasHrTeorico+'</td>'+
          '<td style="text-align:center">'+(f.teorico.tonHrTeorico!=null?f.teorico.tonHrTeorico:'—')+'</td>'+
          '<td style="text-align:center">'+(f.real?f.real.valor:'—')+'</td>'+
          '<td style="text-align:center;font-weight:700;color:'+colB+'">'+(b!=null?b+'%':'—')+'</td></tr>';
      }).join('')+
      '</table></div>'
      :'<div style="font-size:12px;color:var(--tx3)">Ningún equipo con ≥3 turnos con tiempo de ciclo registrado ese mes.</div>')+
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
    _revisarReporteProduccionOCR(resp.datos||{caex:[],carguio:[],apoyo:[],perdidaPetroleo:[],perdidaIndisponibilidad:[],camposInciertos:[]});
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

// Cada tabla del papel: título, columnas que se muestran para revisar y cómo sacar cada celda de la fila ya convertida (reporteTurnoFilas).
var _PROD_TABLAS=[
  {cat:'CAEX',pre:'prodCaex',titulo:'Producción Equipos CAEX',cols:['Horómetro','Horas','Vueltas','Rend.[V/Hr]','Operador','Ton'],
    cel:function(f){return [_prodHorom(f),_prodHoras(f),f.vueltas,f.rendimientoVueltasHr,escapeHtml(f.operador||''),f.totalTon];}},
  {cat:'Carguio',pre:'prodCarg',titulo:'Equipos de Carguío',cols:['Horómetro','Horas','Ton cargadas','Rend.[Ton/Hr]','Operador','Postura'],
    cel:function(f){return [_prodHorom(f),_prodHoras(f),f.totalTon,f.tonHr,escapeHtml(f.operador||''),escapeHtml(f.postura||'')];}},
  {cat:'Apoyo',pre:'prodApoyo',titulo:'Equipos de Apoyo',cols:['Horómetro','Horas','Operador','Área de trabajo'],
    cel:function(f){return [_prodHorom(f),_prodHoras(f),escapeHtml(f.operador||''),escapeHtml(f.areaTrabajo||'')];}},
  {cat:'PerdidaPetroleo',pre:'prodPetr',titulo:'Pérdida por Petróleo',cols:['Desde → hasta','Horas','Ton. asociado'],
    cel:function(f){return [escapeHtml((f.horaInicio||'')+' → '+(f.horaFin||'')),f.totalHoras,f.tonAsociadoPerdida];}},
  {cat:'PerdidaIndisponibilidad',pre:'prodPerd',titulo:'Pérdida por Indisponibilidad',cols:['Horómetro','Horas','Ton. asociado'],
    cel:function(f){return [_prodHorom(f),f.totalHoras,f.tonAsociadoPerdida];}}
];
function _prodHorom(f){return (f.horometroInicial==null&&f.horometroFinal==null)?'':(f.horometroInicial??'')+' → '+(f.horometroFinal??'');}
function _prodHoras(f){return f.totalHoras!=null?f.totalHoras:(f.estadoTexto?escapeHtml(f.estadoTexto):'—');}

function _prodTablaRevisionHTML(tb,items,eqArr){
  var cuerpo=items.map(function(it,i){
    var f=it.fila;
    var dudoso=it.incierto?' style="background:rgba(234,179,8,.12)"':'';
    var fuera=f.estadoTexto&&f.totalHoras==null?' <span style="font-size:10px;color:var(--danger)">(fuera de servicio)</span>':'';
    return '<tr'+dudoso+'>'+
      '<td><input type="checkbox" id="'+tb.pre+'Sel_'+it.idx+'" checked></td>'+
      '<td><select id="'+tb.pre+'Eq_'+it.idx+'" style="font-size:11px">'+_prodOptsEquipo(eqArr,it.siglaSugerida)+'</select>'+
      '<br><span style="font-size:10px;color:var(--tx3)">papel: '+escapeHtml(f.siglaOCR||f.equipoNombreOCR||'?')+(f.equipoNombreOCR&&f.siglaOCR?' / '+escapeHtml(f.equipoNombreOCR):'')+'</span>'+fuera+(it.contraste&&it.contraste.estado==='no-cuadra'?'<br><span style="font-size:10px;color:var(--danger)">Horómetros del sistema: '+it.contraste.horomSistema+' ('+escapeHtml(it.contraste.fechaSistema)+') — no cuadra con el papel</span>':it.contraste&&it.contraste.estado==='ok'?'<br><span style="font-size:10px;color:var(--ok)">✓ cuadra con Horómetros</span>':'')+'</td>'+
      tb.cel(f).map(function(c){return '<td class="mono" style="font-size:11px">'+(c==null?'':c)+'</td>';}).join('')+
      '</tr>';
  }).join('');
  return '<h4 style="margin:12px 0 6px">'+tb.titulo+' <span style="font-size:11px;color:var(--tx3);font-weight:400">('+items.length+')</span></h4>'+
    '<div class="tbl-wrap"><table><tr><th></th><th>Equipo</th>'+tb.cols.map(function(c){return '<th>'+c+'</th>';}).join('')+'</tr>'+
    (cuerpo||'<tr><td colspan="'+(tb.cols.length+2)+'" style="font-size:12px;color:var(--tx3)">Sin filas leídas</td></tr>')+
    '</table></div>';
}

function _prodTotalesHTML(d){
  var t=[['Total toneladas',d.totalToneladas],['Rend. transporte [Ton/hr]',d.rendimientoTransporteTonHr],['Total vueltas CAEX',d.totalVueltas],['Total horas CAEX',d.totalHorasCaex],
    ['Tiempo medio de ciclo [min]',d.tiempoMedioCicloMin],['Rend. CAEX [vueltas/hr]',d.rendimientoCaexVueltasHr],['Vueltas C.F.',d.vueltasCF],['Total Ton CF',d.totalTonCF],
    ['Total horas C.F.',d.totalHorasCF],['Rend. C.F. [Ton/hr]',d.rendimientoCFTonHr],['Rend. C.F. [Cargas/hr]',d.rendimientoCFCargasHr],['Vueltas aljibe',d.vueltasAljibe],['Primer cargado',d.primerCargado],['Último cargado',d.ultimoCargado]].filter(function(x){return x[1]!=null;});
  if(!t.length)return '';
  return '<h4 style="margin:12px 0 6px">Totales del turno (tal como vienen en el papel)</h4>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:6px;font-size:12px">'+
    t.map(function(x){return '<div style="background:var(--bg3);border-radius:6px;padding:6px 8px"><span style="color:var(--tx3)">'+x[0]+'</span><br><b class="mono">'+x[1]+'</b></div>';}).join('')+'</div>';
}

export function _revisarReporteProduccionOCR(datos){
  var eqArr=S.g('eq')||[];
  var turnosExistentes=S.g('prodTurno')||[];
  var inc=datos.camposInciertos||[];
  // Totales del papel que no son creíbles (error de Excel en el original): se avisan y NO se guardan.
  var dudT=reporteTurnoTotalesDudosos(datos);
  datos=Object.assign({},datos);
  dudT.forEach(function(x){datos[x.campo]=null;});
  var duplicado=datos.fecha&&datos.turno&&turnosExistentes.some(function(t){return t.fecha===datos.fecha&&t.turno===datos.turno;});

  // Filas ya convertidas y con el equipo sugerido; idx = posición en la lista completa (identifica los controles de cada fila).
  var items=reporteTurnoResolverSiglas(reporteTurnoFilas(datos),function(sigla){var m=_matchEquipoPorSiglaOCR(sigla,eqArr);return m?m.sigla:null;});
  var hist=S.g('hist')||[];
  items.forEach(function(it,i){
    it.idx=i;
    // Contraste con la pestaña Horómetros (control principal): si el horómetro final del papel no cuadra con la lectura del sistema, la fila sale en amarillo con el valor del sistema al lado.
    it.contraste=reporteTurnoContrasteHorometro(it.siglaSugerida,datos.fecha,it.fila.horometroFinal,hist);
    if(it.contraste.estado==='no-cuadra')it.incierto=true;
  });
  window._prodOCRData={datos:datos,items:items};

  var tablas=_PROD_TABLAS.map(function(tb){
    return _prodTablaRevisionHTML(tb,items.filter(function(it){return it.categoria===tb.cat;}),eqArr);
  }).join('');

  sm('<div style="max-width:900px"><h3>📷 Reporte de turno leído</h3>'+
    '<p style="color:var(--tx2);font-size:13px;margin-bottom:8px">Revisa los valores y el equipo asignado a cada fila antes de guardar — desmarca las que no correspondan. Las filas en amarillo tienen letra dudosa. Las tablas de Petróleo e Indisponibilidad solo traen el nombre corto del papel (ej. CAEX-85): el sistema lo cruza con las otras tablas de este mismo reporte; si no lo encuentra, elige tú el equipo.</p>'+
    (dudT.length?'<div style="background:rgba(239,68,68,.12);border:1px solid var(--danger);border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px">⚠️ El papel trae totales que no son creíbles (error de Excel en el original) y <b>no se guardarán</b>: '+dudT.map(function(x){return escapeHtml(x.campo)+' = '+escapeHtml(String(x.valor));}).join(', ')+'. Las filas por equipo sí se guardan.</div>':'')+
    (duplicado?'<div style="background:rgba(234,179,8,.12);border:1px solid var(--ac);border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px">⚠️ Ya existe un reporte cargado para '+escapeHtml(datos.fecha)+' turno '+escapeHtml(datos.turno)+' — revisa si esto es una corrección o un duplicado antes de guardar.</div>':'')+
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;font-size:12px">'+
    '<label>Fecha<br><input type="date" id="prodFecha" value="'+escapeHtml(datos.fecha||'')+'" style="'+(inc.includes('fecha')?'outline:2px solid var(--warn)':'')+'"></label>'+
    '<label>Turno<br><select id="prodTurnoSel"><option value="dia"'+(datos.turno==='dia'?' selected':'')+'>Día</option><option value="noche"'+(datos.turno==='noche'?' selected':'')+'>Noche</option></select></label>'+
    '<label>Grupo<br><input id="prodGrupo" value="'+escapeHtml(datos.grupoTurno||'')+'"></label>'+
    '<label>Supervisor<br><input id="prodSupervisor" value="'+escapeHtml(datos.supervisor||'')+'"></label>'+
    '<label>Contrato<br><input id="prodContrato" value="'+escapeHtml(datos.contrato||'')+'"></label>'+
    '<label>Total Toneladas<br><input type="number" id="prodTotalTon" value="'+(datos.totalToneladas??'')+'"></label>'+
    '<label>Rend. Transporte [Ton/hr]<br><input type="number" id="prodRendTransp" value="'+(datos.rendimientoTransporteTonHr??'')+'"></label>'+
    '</div>'+
    tablas+
    _prodTotalesHTML(datos)+
    '<h4 style="margin:12px 0 6px">Disponibilidad de equipos</h4>'+
    '<textarea id="prodDispon" rows="3" style="width:100%;font-size:12px">'+escapeHtml(datos.disponibilidadEquipos||'')+'</textarea>'+
    '<h4 style="margin:12px 0 6px">Bitácora del turno</h4>'+
    '<textarea id="prodBitacora" rows="7" style="width:100%;font-size:12px">'+escapeHtml(datos.bitacora||'')+'</textarea>'+
    '<h4 style="margin:12px 0 6px">Otras observaciones</h4>'+
    '<textarea id="prodObs" rows="2" style="width:100%;font-size:12px">'+escapeHtml(datos.observaciones||'')+'</textarea>'+
    '<div style="margin-top:14px"><button class="btn" onclick="_guardarReporteProduccionOCR()">'+ICONS.saveIco+' Guardar reporte de turno</button> <button class="btn btn-o" onclick="cm()">Cancelar</button></div>'+
    '</div>');
}

export function _guardarReporteProduccionOCR(){
  var pend=window._prodOCRData;
  if(!pend){toast('⚠️ No hay datos para guardar');return;}

  var fecha=$('prodFecha').value;
  var turno=$('prodTurnoSel').value;
  if(!fecha||!turno){toast('⚠️ Fecha y turno son obligatorios');return;}

  var d=pend.datos;
  var txt=function(id){var v=$(id)?$(id).value.trim():'';return v||null;};
  var turnoObj={
    id:_uuidV4(),
    fecha:fecha,
    turno:turno,
    supervisor:$('prodSupervisor').value||null,
    contrato:$('prodContrato').value||null,
    franjaDescarga:d.franjaDescarga||null,
    moduloDescarga:d.moduloDescarga||null,
    distanciaModulos:d.distanciaModulos??null,
    observacionesDistancia:d.observacionesDistancia||null,
    totalToneladas:parseFloat($('prodTotalTon').value)||null,
    rendimientoTransporteTonHr:parseFloat($('prodRendTransp').value)||null,
    totalVueltas:d.totalVueltas??null,
    observaciones:txt('prodObs'),
    registradoPor:(typeof window!=='undefined'&&window._userName)||null,
    fuente:'foto',
    grupoTurno:txt('prodGrupo'),
    tiempoMedioCicloMin:d.tiempoMedioCicloMin??null,
    totalHorasCaex:d.totalHorasCaex??null,
    rendimientoCaexVueltasHr:d.rendimientoCaexVueltasHr??null,
    vueltasCF:d.vueltasCF??null,
    totalTonCF:d.totalTonCF||null,
    totalHorasCF:d.totalHorasCF??null,
    rendimientoCFTonHr:d.rendimientoCFTonHr||null,
    rendimientoCFCargasHr:d.rendimientoCFCargasHr??null,
    vueltasAljibe:d.vueltasAljibe??null,
    primerCargado:d.primerCargado||null,
    ultimoCargado:d.ultimoCargado||null,
    disponibilidadEquipos:txt('prodDispon'),
    bitacora:txt('prodBitacora')
  };

  var filasEq=[];
  pend.items.forEach(function(it){
    var tb=_PROD_TABLAS.filter(function(t){return t.cat===it.categoria;})[0];
    var chk=$(tb.pre+'Sel_'+it.idx);
    if(!chk||!chk.checked)return;
    var sigla=$(tb.pre+'Eq_'+it.idx).value||null;
    filasEq.push(Object.assign({id:_uuidV4(),turnoId:turnoObj.id,sigla:sigla},it.fila));
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
