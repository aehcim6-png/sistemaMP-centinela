// ═══════════════════════════════════════════════════════════════
// METAS & KPIs — Cuadro de Mando e Informes Descargables
// window.renderKpi + el generador Excel multi-hoja y los 8 informes
// descargables (Disponibilidad/MTBF/HH/Cumplimiento/Costos/Backlog/
// Componentes/Ejecutivo), exclusivos de esta pestaña. reporteEjecutivoExcel
// (otro reporte, con su propio motor HTML→Excel más simple) es de
// Configuración, no de acá — queda compartido en index.html.
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// INFORMES KPI — 8 REPORTES DESCARGABLES
// ═══════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════
// EXCEL MULTI-SHEET GENERATOR + 8 KPI REPORTS
// ═══════════════════════════════════════════════════════════════

window._excelStyles=function(){
  return '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>'+
  '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'+
  '<Styles>'+
  '<Style ss:ID="hdr"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="10"/><Interior ss:Color="#2C3E50" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>'+
  '<Style ss:ID="title"><Font ss:Bold="1" ss:Size="14" ss:Color="#2C3E50"/></Style>'+
  '<Style ss:ID="sub"><Font ss:Size="10" ss:Color="#7F8C8D"/></Style>'+
  '</Styles>';
};

window.genExcelSheet=function(title,headers,rows){
  var xml='<Worksheet ss:Name="'+escapeHtml(title.substring(0,31))+'">';
  xml+='<Table>';
  xml+='<Row><Cell ss:StyleID="title"><Data ss:Type="String">'+escapeHtml(title)+' — SistemaMP Centinela</Data></Cell></Row>';
  xml+='<Row><Cell ss:StyleID="sub"><Data ss:Type="String">Besalco Minería S.A. — Faena Centinela Ripios OXE · '+new Date().toISOString().slice(0,10)+'</Data></Cell></Row>';
  xml+='<Row></Row>';
  xml+='<Row>';headers.forEach(function(h){xml+='<Cell ss:StyleID="hdr"><Data ss:Type="String">'+escapeHtml(h)+'</Data></Cell>';});xml+='</Row>';
  // csvCeldaSegura (logic.js): protege contra CSV/Formula Injection — solo
  // en celdas de texto, nunca en las de tipo Number (un costo o delta
  // negativo real no es un vector de esto, y antepone el apóstrofo ahí lo
  // convertiría de número a texto sin necesidad).
  rows.forEach(function(row){xml+='<Row>';row.forEach(function(cell){var t=typeof cell==='number'?'Number':'String';var v=t==='Number'?cell:csvCeldaSegura(cell);xml+='<Cell><Data ss:Type="'+t+'">'+escapeHtml(v)+'</Data></Cell>';});xml+='</Row>';});
  xml+='</Table></Worksheet>';return xml;
};

window._dlExcel=function(xml,fn){xml+='</Workbook>';var b=new Blob([xml],{type:'application/vnd.ms-excel'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=fn;a.click();toast('✅ '+fn+' descargado');};

window.genExcel=function(title,headers,rows,fn){var xml=_excelStyles();xml+=genExcelSheet(title,headers,rows);_dlExcel(xml,fn);};

window.printReport=function(title,html){
  var w=window.open('','','width=900,height=700');
  w.document.write('<html><head><title>'+title+'</title><style>body{font-family:Arial;margin:20px;color:#222}table{border-collapse:collapse;width:100%;margin:10px 0}th,td{border:1px solid #ddd;padding:6px 8px;font-size:11px}th{background:#2C3E50;color:#fff;text-align:center}.ok{background:#D5F5E3}.warn{background:#FEF9E7}.danger{background:#FADBD8}h1{color:#2C3E50;font-size:18px}h2{color:#1A5276;font-size:14px;margin-top:16px}.meta{color:#7F8C8D;font-size:11px;margin-bottom:16px}.kpi{display:inline-block;border:1px solid #ddd;border-radius:6px;padding:10px 20px;margin:4px;text-align:center}.kpi b{display:block;font-size:22px;color:#2C3E50}.kpi span{font-size:10px;color:#7F8C8D}</style></head><body>');
  w.document.write('<h1>'+title+'</h1><div class="meta">Besalco Minería S.A. — Faena Centinela Ripios OXE · '+new Date().toISOString().slice(0,10)+'</div>');
  w.document.write(html+'</body></html>');w.document.close();w.print();
};

// ═══ DATA COLLECTORS (shared between individual + rptTodos) ═══
window._getDispData=function(){
  var eq=S.g('eq')||[];var dd=S.g('dispCalc')||{};var dA=INIT.dispAbril||{};var meta=S.g('dispMeta')||85;
  eq.forEach(function(e){if(!dd[e.sigla])dd[e.sigla]={};if(dA[e.sigla]!==undefined&&!dd[e.sigla]['2026-04'])dd[e.sigla]['2026-04']=dA[e.sigla];});
  var ms=[...new Set(Object.values(dd).flatMap(function(d){return Object.keys(d)}))].sort();if(!ms.length)ms=['2026-04'];
  var h=['Equipo','Tipo','Modelo'].concat(ms).concat(['Promedio','vs Meta']);
  var r=eq.map(function(e){var vs=ms.map(function(m){return dd[e.sigla]&&dd[e.sigla][m]!==undefined?dd[e.sigla][m]:'—';});var n=vs.filter(function(v){return v!=='—'});var p=n.length?Math.round(n.reduce(function(s,v){return s+v},0)/n.length*10)/10:0;return[e.sigla,e.tipo,e.modelo].concat(vs).concat([p,p>=meta?'OK':'Bajo']);});
  return{headers:h,rows:r};
};
window._getMTBFData=function(){
  var eq=S.g('eq')||[];var ot=(S.g('ot')||[]).concat(_otHistComoOt(S.g('otHist')||[]));
  var h=['Equipo','Modelo','Horómetro','Fallas','MTBF (hrs)','Confiabilidad','Reparaciones','MTTR (hrs)','Mantenibilidad'];
  var r=eq.map(function(e){var f=ot.filter(function(o){return o.sigla===e.sigla&&esFallaMTBF(o)});var rp=f.filter(function(o){return o.duracion&&o.duracion!=='—'});var mttr=C.mttrReal(f.map(function(o){return o.duracion;}));var mtbf=C.mtbfReal(f.map(function(o){return o.horom;}));return[e.sigla,e.modelo,e.horomActual,f.length,mtbf==null?'—':mtbf,mtbf==null?'Datos insuf.':mtbf>2000?'Alta':mtbf>500?'Media':'Baja',rp.length,mttr,mttr===0?'Sin datos':mttr<4?'Rápido':mttr<8?'Normal':'Lento'];});
  return{headers:h,rows:r};
};
window._getHHData=function(){
  var reg=S.g('reg')||[];var hT={},hE={};
  // HH Plan = duración típica real (mediana equipo+tipo), no la suma de p.hrs
  // de las pautas — esa columna es el intervalo de cada tarea, no su duración.
  var planDe=hhPlanEstimator(reg);
  reg.forEach(function(r){var d=r.duracionH||0;var t=r.tecnico||'Sin asignar';var e=r.equipo||'';if(!hT[t])hT[t]={r:0,p:0,n:0};hT[t].r+=d;hT[t].n++;if(!hE[e])hE[e]={r:0,p:0,n:0};hE[e].r+=d;hE[e].n++;var pH=planDe(e,r.tipoPM||'PM1');hT[t].p+=pH;hE[e].p+=pH;});
  var h=['Tipo','Nombre','HH Real','HH Plan','Eficiencia %','Intervenciones'];
  var r=Object.entries(hT).sort(function(a,b){return b[1].r-a[1].r}).map(function(t){return['Técnico',t[0],Math.round(t[1].r),Math.round(t[1].p),t[1].r>0?Math.round(t[1].p/t[1].r*100):0,t[1].n];});
  r=r.concat(Object.entries(hE).sort(function(a,b){return b[1].r-a[1].r}).map(function(e){return['Equipo',e[0],Math.round(e[1].r),Math.round(e[1].p),e[1].r>0?Math.round(e[1].p/e[1].r*100):0,e[1].n];}));
  return{headers:h,rows:r};
};
window._getCumplData=function(){
  var reg=S.g('reg')||[];var eq=S.g('eq')||[];var pE={};
  // regEsATiempo (logic.js): fuente única — antes r.estado==='A tiempo' nunca
  // coincidía con el dato real guardado (bug real, auditoría 2026-08). Registros
  // no evaluables (ej. importados por CSV sin fecha esperada) no cuentan ni como
  // a tiempo ni como atrasados — quedan fuera de "e" (ejecutados evaluables).
  reg.forEach(function(r){var ev=regEsATiempo(r);if(ev===null)return;if(!pE[r.equipo])pE[r.equipo]={e:0,a:0,t:0};pE[r.equipo].e++;if(ev)pE[r.equipo].a++;else pE[r.equipo].t++;});
  eq.forEach(function(e){if(!pE[e.sigla])pE[e.sigla]={e:0,a:0,t:0};});
  var h=['Equipo','Tipo','Ejecutados evaluables','A Tiempo','Atrasados','% Cumplimiento','Estado'];
  var r=Object.entries(pE).sort(function(a,b){return b[1].e-a[1].e}).map(function(e){var p=e[1].e>0?Math.round(e[1].a/e[1].e*100):null;return[e[0],(eq.find(function(x){return x.sigla===e[0]})||{}).tipo||'',e[1].e,e[1].a,e[1].t,p===null?'—':p,p===null?'Sin datos':p>=80?'OK':p>=50?'Regular':'Bajo'];});
  return{headers:h,rows:r};
};
window._getCostosData=function(){
  var reg=S.g('reg')||[];var mov=S.g('mov')||[];var stk=S.g('stk')||[];var lub=S.g('lub')||[];var hh=S.g('hh')||25000;var cM={};
  reg.forEach(function(r){var m=(r.fechaEntrada||r.fechaEjec||'').slice(0,7);if(!m)return;if(!cM[m])cM[m]={h:0,f:0,l:0,t:0,p:0};cM[m].h+=(r.duracionH||2)*hh;cM[m].p++;});
  mov.forEach(function(m){if(!cM[m.mes])cM[m.mes]={h:0,f:0,l:0,t:0,p:0};if(m.tipo==='Filtro'){var f=stk.find(function(s){return s.descripcion===m.item||s.nParte===m.nParte});cM[m.mes].f+=(m.cant||0)*(f&&f.precioUnit?f.precioUnit:0);}else{var l=lub.find(function(lb){return lb.nombre===m.item});cM[m.mes].l+=(m.cant||0)*(l&&l.precio?l.precio:0);}});
  Object.keys(cM).forEach(function(m){cM[m].t=cM[m].h+cM[m].f+cM[m].l});
  var ms=Object.keys(cM).sort().reverse();var tG=Object.values(cM).reduce(function(s,c){return s+c.t},0);
  var h=['Mes','PMs','HH ($)','Filtros ($)','Lubricantes ($)','Total ($)'];
  var r=ms.map(function(m){var c=cM[m];return[m,c.p,Math.round(c.h),Math.round(c.f),Math.round(c.l),Math.round(c.t)];});
  r.push(['TOTAL',r.reduce(function(s,x){return s+x[1]},0),r.reduce(function(s,x){return s+x[2]},0),r.reduce(function(s,x){return s+x[3]},0),r.reduce(function(s,x){return s+x[4]},0),Math.round(tG)]);
  return{headers:h,rows:r};
};
window._getBacklogData=function(){
  var ot=S.g('ot')||[];var eq=S.g('eq')||[];
  var eqPorSigla={};eq.forEach(function(e){if(e&&e.sigla)eqPorSigla[e.sigla]=e;});
  var pd=ot.filter(function(o){return o.estadoOT==='Pendiente'||o.estadoOT==='En Ejecución'});
  var h=['Equipo','Tipo Falla','Componente','Fecha','Estado OT','Días Pendiente','Síntoma','Causa Raíz','Prioridad'];
  var ORDEN_PRIORIDAD={'CRÍTICO':0,'URGENTE':1,'Normal':2};
  var r=pd.map(function(o){
    var d=o.fecha?Math.round((Date.now()-new Date(o.fecha).getTime())/86400000):0;
    // Un correctivo pendiente en un equipo Crítico (Ficha Técnica > Criticidad) nunca
    // aparece como Normal: sube a URGENTE de entrada y a CRÍTICO si además lleva más
    // de 7 días — la antigüedad sola no debe ocultar una falla en un activo que no
    // puede parar. Equipos Esencial/General siguen el umbral original por días.
    var esCritico=(eqPorSigla[o.sigla]||{}).criticidad==='Crítico';
    var prioridad=esCritico?(d>7?'CRÍTICO':'URGENTE'):(d>14?'CRÍTICO':d>7?'URGENTE':'Normal');
    return{fila:[o.sigla||'',o.tipo||'',o.componente||'',o.fecha||'',o.estadoOT||'Pendiente',d,o.sintoma||'',o.causaRaiz||'',prioridad],prioridad:prioridad,dias:d};
  }).sort(function(a,b){return ORDEN_PRIORIDAD[a.prioridad]-ORDEN_PRIORIDAD[b.prioridad]||b.dias-a.dias;}).map(function(x){return x.fila;});
  return{headers:h,rows:r};
};
window._getCompData=function(){
  var eq=S.g('eq')||[];var cd=S.g('compMayores')||[];
  cd.forEach(function(c){var eO=eq.find(function(e){return e.sigla===c.sigla});var hA=eO?eO.horomActual:0;c.hrsUsadas=hA-(c.horomComp||0);if(c.hrsUsadas<0)c.hrsUsadas=hA;c.hrsRest=Math.max((c.vidaUtil||0)-c.hrsUsadas,0);c.pctVida=c.vidaUtil?Math.round(c.hrsUsadas/c.vidaUtil*100):0;var hD=eO?eO.hrsDia:12;c.diasRest=hD>0?Math.round(c.hrsRest/hD):0;c.estadoCalc=c.hrsRest<=0?'VENCIDO':c.hrsRest<1000?'PLANIFICAR':c.hrsRest<2000?'MONITOREAR':'OK';});
  var h=['Equipo','Componente','Hrs Instalación','Vida Útil','Hrs Usadas','% Vida','Hrs Restantes','Días Rest','Costo Ref ($)','Estado'];
  var r=cd.sort(function(a,b){return a.hrsRest-b.hrsRest}).map(function(c){return[c.sigla,c.comp,c.horomComp,c.vidaUtil,c.hrsUsadas,c.pctVida,c.hrsRest,c.diasRest,Math.round(c.costoRef||0),c.estadoCalc];});
  return{headers:h,rows:r};
};
window._getEjecutivoData=function(){
  var eq=S.g('eq')||[];var reg=S.g('reg')||[];var ot=(S.g('ot')||[]).concat(_otHistComoOt(S.g('otHist')||[]));var cd=S.g('compMayores')||[];var dd=S.g('dispCalc')||{};var dA=INIT.dispAbril||{};var meta=S.g('dispMeta')||85;
  eq.forEach(function(e){if(!dd[e.sigla])dd[e.sigla]={};if(dA[e.sigla]!==undefined&&!dd[e.sigla]['2026-04'])dd[e.sigla]['2026-04']=dA[e.sigla];});
  var dV=eq.map(function(e){var d=dd[e.sigla];if(!d)return null;var v=Object.values(d);return v.length?v[v.length-1]:null}).filter(function(v){return v!==null});
  var dP=dV.length?Math.round(dV.reduce(function(s,v){return s+v},0)/dV.length*10)/10:null;
  var tF=ot.filter(function(o){return esFallaMTBF(o)}).length;
  // MTBF de flota real (ver mtbfFlotaReal en logic.js) — bug real encontrado en este
  // mismo Reporte Ejecutivo: usaba horómetro-EN-VIVO (crece solo con el tiempo) ÷
  // fallas de TODA la vida, el mismo defecto que C.mtbfReal ya documenta y corrige
  // para el caso por-equipo. Con este reporte yendo directo a jefatura, mostraba un
  // "MTBF Flota" que subía día a día sin que la confiabilidad real cambiara en nada.
  var mtbf=mtbfFlotaReal(eq,ot);
  var hhR=Math.round(reg.reduce(function(s,r){return s+(r.duracionH||0)},0));
  var urg=eq.filter(function(e){return e.diasParaPM<=3}).length;
  cd.forEach(function(c){var eO=eq.find(function(e){return e.sigla===c.sigla});c.hrsRest=Math.max((c.vidaUtil||0)-(eO?eO.horomActual:0)+(c.horomComp||0),0);});
  var cC=cd.filter(function(c){return c.hrsRest<=1000}).length;var pO=ot.filter(function(o){return o.estadoOT==='Pendiente'}).length;
  var h=['KPI','Valor','Meta/Ref','Estado'];
  var r=[['Equipos en Flota',eq.length,'—','—'],['Disponibilidad Mecánica',dP===null?'—':dP+'%',meta+'%',dP===null?'Sin datos':dP>=meta?'OK':'Bajo'],['MTBF Flota',mtbf===null?'—':mtbf+' hrs','>2000 hrs',mtbf===null?'Sin datos':mtbf>2000?'Alta':mtbf>500?'Media':'Baja'],['Total Fallas',tF,'—','—'],['HH Reales',hhR+' hrs','—','—'],['PMs Ejecutados',reg.length,'—','—'],['Equipos Urgentes',urg,'0',urg===0?'OK':urg+' equipos'],['Backlog Pendientes',pO,'0',pO===0?'OK':pO+' pendientes'],['Componentes Críticos',cC,'0',cC===0?'OK':cC+' comp']];
  return{headers:h,rows:r};
};

// ═══ DOWNLOAD ALL 8 IN ONE EXCEL ═══
window.rptTodos=function(){
  var xml=_excelStyles();
  xml+=genExcelSheet('EJECUTIVO',_getEjecutivoData().headers,_getEjecutivoData().rows);
  xml+=genExcelSheet('DISPONIBILIDAD',_getDispData().headers,_getDispData().rows);
  xml+=genExcelSheet('MTBF-MTTR',_getMTBFData().headers,_getMTBFData().rows);
  xml+=genExcelSheet('HORAS HOMBRE',_getHHData().headers,_getHHData().rows);
  xml+=genExcelSheet('CUMPLIMIENTO PM',_getCumplData().headers,_getCumplData().rows);
  xml+=genExcelSheet('COSTOS',_getCostosData().headers,_getCostosData().rows);
  xml+=genExcelSheet('BACKLOG',_getBacklogData().headers,_getBacklogData().rows);
  xml+=genExcelSheet('COMPONENTES',_getCompData().headers,_getCompData().rows);
  _dlExcel(xml,'Informes_KPI_Centinela_'+new Date().toISOString().slice(0,10)+'.xls');
};

// ═══ INDIVIDUAL REPORTS ═══
window.rptDisp=function(fmt){var d=_getDispData();if(fmt==='excel')genExcel('Disponibilidad',d.headers,d.rows,'Informe_Disponibilidad.xls');else{var h='<h2>Disponibilidad Mecánica</h2><table><tr>'+d.headers.map(function(x){return'<th>'+x+'</th>'}).join('')+'</tr>'+d.rows.map(function(r){var p=r[r.length-2];return'<tr class="'+(p>=85?'ok':p>=70?'warn':'danger')+'">'+r.map(function(c){return'<td>'+escapeHtml(c)+'</td>'}).join('')+'</tr>'}).join('')+'</table>';printReport('Informe Disponibilidad',h);}};
window.rptMTBF=function(fmt){var d=_getMTBFData();if(fmt==='excel')genExcel('MTBF-MTTR',d.headers,d.rows,'Informe_MTBF_MTTR.xls');else{var h='<h2>MTBF / MTTR</h2><table><tr>'+d.headers.map(function(x){return'<th>'+x+'</th>'}).join('')+'</tr>'+d.rows.map(function(r){return'<tr class="'+(r[5]==='Alta'?'ok':r[5]==='Media'?'warn':'danger')+'">'+r.map(function(c){return'<td>'+escapeHtml(c)+'</td>'}).join('')+'</tr>'}).join('')+'</table>';printReport('Informe MTBF/MTTR',h);}};
window.rptHH=function(fmt){var d=_getHHData();if(fmt==='excel')genExcel('Horas Hombre',d.headers,d.rows,'Informe_HH.xls');else{var h='<h2>Horas Hombre</h2><table><tr>'+d.headers.map(function(x){return'<th>'+x+'</th>'}).join('')+'</tr>'+d.rows.map(function(r){return'<tr>'+r.map(function(c){return'<td>'+escapeHtml(c)+'</td>'}).join('')+'</tr>'}).join('')+'</table>';printReport('Informe HH',h);}};
window.rptCumpl=function(fmt){var d=_getCumplData();if(fmt==='excel')genExcel('Cumplimiento PM',d.headers,d.rows,'Informe_Cumplimiento_PM.xls');else{var h='<h2>Cumplimiento PM</h2><table><tr>'+d.headers.map(function(x){return'<th>'+x+'</th>'}).join('')+'</tr>'+d.rows.map(function(r){return'<tr class="'+(r[5]==='—'?'':r[5]>=80?'ok':r[5]>=50?'warn':'danger')+'">'+r.map(function(c){return'<td>'+escapeHtml(c)+'</td>'}).join('')+'</tr>'}).join('')+'</table>';printReport('Informe Cumplimiento PM',h);}};
window.rptCostos=function(fmt){var d=_getCostosData();if(fmt==='excel')genExcel('Costos',d.headers,d.rows,'Informe_Costos.xls');else{var h='<h2>Costos Mantención</h2><table><tr>'+d.headers.map(function(x){return'<th>'+x+'</th>'}).join('')+'</tr>'+d.rows.map(function(r){return'<tr>'+r.map(function(c){return'<td>'+(typeof c==='number'?'$'+fn(c):escapeHtml(c))+'</td>'}).join('')+'</tr>'}).join('')+'</table>';printReport('Informe Costos',h);}};
window.rptBacklog=function(fmt){var d=_getBacklogData();if(fmt==='excel')genExcel('Backlog',d.headers,d.rows,'Informe_Backlog.xls');else{var h='<h2>Backlog OT</h2><table><tr>'+d.headers.map(function(x){return'<th>'+x+'</th>'}).join('')+'</tr>'+d.rows.map(function(r){return'<tr class="'+(r[8]==='CRÍTICO'?'danger':r[8]==='URGENTE'?'warn':'')+'">'+r.map(function(c){return'<td>'+escapeHtml(c)+'</td>'}).join('')+'</tr>'}).join('')+'</table>';printReport('Informe Backlog',h);}};
window.rptComp=function(fmt){var d=_getCompData();if(fmt==='excel')genExcel('Componentes',d.headers,d.rows,'Informe_Componentes.xls');else{var h='<h2>Componentes Mayores</h2><table><tr>'+d.headers.map(function(x){return'<th>'+x+'</th>'}).join('')+'</tr>'+d.rows.map(function(r){return'<tr class="'+(r[9]==='VENCIDO'?'danger':r[9]==='PLANIFICAR'?'warn':'')+'">'+r.map(function(c){return'<td>'+escapeHtml(c)+'</td>'}).join('')+'</tr>'}).join('')+'</table>';printReport('Informe Componentes',h);}};
window.rptEjecutivo=function(fmt){var d=_getEjecutivoData();if(fmt==='excel')genExcel('Ejecutivo',d.headers,d.rows,'Informe_Ejecutivo.xls');else{var h='<h2>Resumen Ejecutivo</h2><table><tr>'+d.headers.map(function(x){return'<th>'+x+'</th>'}).join('')+'</tr>'+d.rows.map(function(r){return'<tr>'+r.map(function(c){return'<td>'+escapeHtml(c)+'</td>'}).join('')+'</tr>'}).join('')+'</table>';printReport('Informe Ejecutivo',h);}};




window.renderKpi=function(){
  if(!$("s-kpi"))return;
  var eq=S.g('eq')||[];
  var reg=S.g('reg')||[];
  var ot=S.g('ot')||[];
  // otConHist (auditoría 2026-08-18, mismo hallazgo que Ratio Preventivo/Flota sin
  // falla): 'ot' a secas sigue siendo la fuente para Disponibilidad (downMap) y
  // Backlog, que 'otHist' no puede alimentar (sin estadoOT/fechaSalida) — solo se usa
  // esta versión combinada para mesesAll y los cálculos de MTBF/fallas, más abajo.
  var otConHist=ot.concat(_otHistComoOt(S.g('otHist')||[]));
  var mov=S.g('mov')||[];
  var stk=S.g('stk')||[];
  var lub=S.g('lub')||[];
  var hh=S.g('hh')||25000;
  var meta=S.g('dispMeta')||85;
  var dispData=S.g('dispCalc')||{};
  var dAbr=INIT.dispAbril||{};

  // ═══ CALCULATE ALL KPIs BY MONTH ═══
  var mesesAll=[...new Set(reg.map(function(r){return(r.fechaEntrada||r.fechaEjec||'').slice(0,7)}).concat(otConHist.map(function(o){return(o.fecha||'').slice(0,7)})).filter(function(m){return m}))].sort();
  var mesActualStr0=new Date().toISOString().slice(0,7);
  if(mesesAll.indexOf(mesActualStr0)===-1)mesesAll.push(mesActualStr0);
  mesesAll.sort();
  if(!mesesAll.length)mesesAll=[mesActualStr0];
  var fKpiAnchor=$('fKpiAnchor')?.value||mesesAll[mesesAll.length-1];
  var idxAnchor=mesesAll.indexOf(fKpiAnchor);if(idxAnchor<0)idxAnchor=mesesAll.length-1;
  var fKpiRango=$('fKpiRango')?.value||'12';
  var rangoN=fKpiRango==='todo'?(idxAnchor+1):parseInt(fKpiRango);
  var last12=mesesAll.slice(Math.max(0,idxAnchor-rangoN+1),idxAnchor+1);
  var MSN=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

  // 1. DISPONIBILIDAD por mes — misma fuente única que la pestaña Disponibilidad y Metas
  // (dispDownMap + dispEquipoMes en logic.js). Antes esta pestaña tenía su propia copia
  // sin el manejo de salida de servicio por período, así que no coincidía con las otras.
  var downMap=dispDownMap(reg,ot);
  var dispMes=last12.map(function(mes){
    var vals=eq.map(function(e){return dispEquipoMes(e.sigla,mes,{downMap:downMap,dispCalc:dispData,dAbr:dAbr,hrsDia:e.hrsDia||12});}).filter(function(v){return v!==null&&v!==undefined});
    return vals.length?Math.round(vals.reduce(function(s,v){return s+v},0)/vals.length*10)/10:null;
  });
  var dispActual=dispMes[dispMes.length-1];

  // 2. MTBF — horas reales de operación ENTRE fallas sucesivas. mtbfFlotaReal()
  // ahora vive en logic.js (fuente única compartida con _getEjecutivoData, más
  // abajo en este mismo archivo — antes cada uno tenía su propia versión y la del
  // Reporte Ejecutivo seguía usando la fórmula vieja: horómetro-total ÷ nº de
  // fallas, que sube solo con el paso del tiempo).
  // MTBF mensual = horas de flota del mes ÷ fallas del mes (tasa mensual legítima). Un mes
  // SIN fallas ya no devuelve las horas completas (número absurdo que siempre gana la meta):
  // se muestra como "sin dato", porque no hubo un intervalo entre fallas que medir.
  var mtbfMes=last12.map(function(mes){
    var fallasM=contarFallasMes(otConHist,mes);
    var hrsM=eq.reduce(function(s,e){return e.unidad==='km'?s:s+(e.hrsDia||12)*30},0);
    return fallasM>0?Math.round(hrsM/fallasM):null;
  });
  var mtbfActual=mtbfFlotaReal(eq,otConHist);
  var totalFallas=contarFallasMes(otConHist);

  // 3. CUMPLIMIENTO by month — regEsATiempo (logic.js) en vez de comparar
  // r.estado==='A tiempo' (bug real, auditoría 2026-08, ver logic.js). Solo
  // cuenta registros evaluables (con desvioDias real).
  var cumplMes=last12.map(function(mes){
    var regMev=reg.filter(function(r){return(r.fechaEntrada||r.fechaEjec||'').slice(0,7)===mes&&regEsATiempo(r)!==null});
    var ant=regMev.filter(function(r){return regEsATiempo(r)===true}).length;
    return regMev.length?Math.round(ant/regMev.length*100):null;
  });
  var regEvActual=reg.filter(function(r){return regEsATiempo(r)!==null});
  var cumplActual=regEvActual.length?Math.round(regEvActual.filter(function(r){return regEsATiempo(r)===true}).length/regEvActual.length*100):null;

  // 4. COSTO POR HORA OPERADA by month
  var costoHrMes=last12.map(function(mes){
    var costoM=0;
    reg.filter(function(r){return(r.fechaEntrada||r.fechaEjec||'').slice(0,7)===mes}).forEach(function(r){costoM+=(r.duracionH||2)*hh;});
    mov.filter(function(m){return m.mes===mes}).forEach(function(m){
      if(m.tipo==='Filtro'){var f=stk.find(function(s){return s.descripcion===m.item||s.nParte===m.nParte});costoM+=(m.cant||0)*(f&&f.precioUnit?f.precioUnit:0);}
      else{var l=lub.find(function(lb){return lb.nombre===m.item});costoM+=(m.cant||0)*(l&&l.precio?l.precio:0);}
    });
    var hrsM=eq.reduce(function(s,e){return e.unidad==='km'?s:s+(e.hrsDia||12)*30},0);
    return hrsM>0?Math.round(costoM/hrsM):0;
  });
  var costoHrActual=costoHrMes.length?costoHrMes[costoHrMes.length-1]:0;

  // 5. RATIO PREV/CORR by month — contarFallasMes/ratioPreventivo (logic.js,
  // auditoría 2026-08-18): fuente única compartida con metas.js y dash.js, que
  // tenían cada uno su propia copia de este mismo cálculo (ver logic.js para
  // el detalle del bug: 'reg' nunca tiene tipoPM==='Correctivo', así que el
  // denominador tiene que sumar los correctivos reales de ot+otHist).
  var ratioMes=last12.map(function(mes){
    var regM=reg.filter(function(r){return(r.fechaEntrada||r.fechaEjec||'').slice(0,7)===mes});
    var prev=regM.filter(function(r){return r.tipoPM!=='Correctivo'}).length;
    return ratioPreventivo(prev,contarFallasMes(otConHist,mes));
  });
  var prevTotal=reg.filter(function(r){return r.tipoPM!=='Correctivo'}).length;
  var corrTotal=totalFallas;
  var ratioActual=ratioPreventivo(prevTotal,corrTotal);

  // 6. HH EFICIENCIA by month
  // Eficiencia HH: plan = duración típica real (mediana equipo+tipo), no la
  // suma de p.hrs de las pautas — esa columna es el intervalo, no la duración.
  var _efPlanDe=hhPlanEstimator(reg);
  var hhEfMes=last12.map(function(mes){
    var regM=reg.filter(function(r){return(r.fechaEntrada||r.fechaEjec||'').slice(0,7)===mes});
    var hhReal=0,hhPlan=0;
    regM.forEach(function(r){
      hhReal+=r.duracionH||0;
      hhPlan+=_efPlanDe(r.equipo,r.tipoPM||'PM1');
    });
    return hhReal>0?Math.round(hhPlan/hhReal*100):null;
  });
  var hhRealT=reg.reduce(function(s,r){return s+(r.duracionH||0)},0);
  var hhPlanT=0;
  reg.forEach(function(r){hhPlanT+=_efPlanDe(r.equipo,r.tipoPM||'PM1');});
  var hhEfActual=hhRealT>0?Math.round(hhPlanT/hhRealT*100):null;

  // ═══ SVG GAUGE GENERATOR ═══
  // Una proporción contra una meta → medidor (meter), no un gauge circular (skill dataviz)
  function meterKPI(val,max,meta,unit,tipTxt,invert){
    if(val===null||val===undefined){
      return '<div style="padding:2px 0 4px">'+
        '<div style="font-size:30px;font-weight:800;color:var(--tx3);line-height:1">—</div>'+
        '<div style="font-size:9px;color:var(--tx3);margin:4px 0 8px">'+unit+'</div>'+
        '<div style="background:var(--bg4);border-radius:8px;height:12px"></div>'+
        '</div>';
    }
    var pct=Math.min(val/max*100,100);
    var metaPct=Math.min(meta/max*100,100);
    var col=invert?(val<=meta?'#22c55e':val<=meta*1.3?'#f59e0b':'#ef4444'):(val>=meta?'#22c55e':val>=meta*0.7?'#f59e0b':'#ef4444');
    return '<div style="padding:2px 0 4px">'+
      '<div style="font-size:30px;font-weight:800;color:'+col+';line-height:1">'+val+'</div>'+
      '<div style="font-size:9px;color:var(--tx3);margin:4px 0 8px">'+unit+'</div>'+
      '<div style="position:relative;background:color-mix(in srgb,'+col+' 18%,var(--bg4));border-radius:8px;height:12px;overflow:hidden;cursor:default" onmouseenter="vizTip(event,\''+tipTxt+'\')" onmousemove="vizTipMove(event)" onmouseleave="vizTipHide()">'+
      '<div style="position:absolute;left:'+metaPct+'%;top:-2px;bottom:-2px;width:2px;background:var(--tx3);z-index:2"></div>'+
      '<div style="background:'+col+';height:100%;width:'+pct+'%;border-radius:8px;transition:width .5s"></div></div>'+
      '</div>';
  }

  // ═══ BAR CHART WITH META LINE ═══
  function barsWithMeta(vals,labels,metaVal,maxVal,unit,invertMeta){
    var valsConDato=vals.filter(function(v){return v!==null&&v!==undefined});
    if(!maxVal)maxVal=Math.max.apply(null,valsConDato.concat([metaVal||1]))*1.2||100;
    var metaH=metaVal?Math.round(metaVal/maxVal*100):0;
    return '<div style="position:relative;height:120px;display:flex;align-items:flex-end;gap:2px;padding-top:15px">'+
      (metaVal?'<div style="position:absolute;top:'+(100-metaH)+'%;left:0;right:0;border-top:2px solid var(--tx3);z-index:1"><span style="font-size:7px;color:var(--tx3);position:absolute;right:0;top:-10px">Meta '+metaVal+unit+'</span></div>':'')+
      vals.map(function(v,i){
        if(v===null||v===undefined){
          return '<div style="flex:1;text-align:center;display:flex;flex-direction:column;justify-content:flex-end;height:100%">'+
            '<div style="font-size:7px;font-weight:600;color:var(--tx3)">—</div>'+
            '<div class="bar" style="background:var(--bg4);height:2%"></div>'+
            '<div style="font-size:7px;color:var(--tx3);margin-top:2px">'+labels[i]+'</div></div>';
        }
        var h=maxVal>0?Math.max(v/maxVal*100,2):2;
        var ok=invertMeta?(v<=metaVal):(v>=metaVal);
        var col=ok?'#22c55e':(v>=metaVal*0.7||invertMeta&&v<=metaVal*1.3)?'#f59e0b':'#ef4444';
        var tipTxt=labels[i]+': '+v+unit;
        return '<div style="flex:1;text-align:center;display:flex;flex-direction:column;justify-content:flex-end;height:100%">'+
          '<div style="font-size:7px;font-weight:600;color:var(--tx)">'+v+'</div>'+
          '<div class="bar" style="background:'+col+';height:'+h+'%;cursor:default" onmouseenter="vizTip(event,\''+tipTxt+'\')" onmousemove="vizTipMove(event)" onmouseleave="vizTipHide()"></div>'+
          '<div style="font-size:7px;color:var(--tx3);margin-top:2px">'+labels[i]+'</div></div>';
      }).join('')+'</div>';
  }

  var mesLabels=last12.map(function(m){return MSN[parseInt(m.slice(5,7))-1]||m.slice(5)});

  // ═══ BUILD CUADROS DE MANDO ═══
  $('s-kpi').innerHTML=
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Cuadro de Mando KPI</div>'+
    '<div class="sec-s">Indicadores automáticos · Actualización en tiempo real desde registros</div></div>'+
    '<button class="btn" onclick="rptTodos()" style="padding:8px 20px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Descargar Todo Excel</button></div>'+
    '<div class="toolbar">'+
    '<select id="fKpiAnchor" onchange="renders.kpi()">'+mesesAll.map(function(m){return'<option'+(m===fKpiAnchor?' selected':'')+'>'+m+'</option>'}).join('')+'</select>'+
    '<select id="fKpiRango" onchange="renders.kpi()">'+
    ['3','6','12','24','36','todo'].map(function(r){return'<option value="'+r+'"'+(r===fKpiRango?' selected':'')+'>'+(r==='todo'?'Todo el histórico':'Últimos '+r+' meses')+'</option>'}).join('')+
    '</select></div>'+

    // 1. DISPONIBILIDAD
    '<div class="chart-box" style="display:grid;grid-template-columns:160px 1fr;gap:16px;margin-bottom:16px;padding:16px">'+
    '<div style="text-align:center">'+
    '<div style="font-size:12px;font-weight:700;color:var(--tx3);margin-bottom:4px">DISPONIBILIDAD MECÁNICA</div>'+
    meterKPI(dispActual,100,meta,'%',dispActual===null?'':'Disponibilidad: '+dispActual+'% · meta '+meta+'%')+
    '<div style="font-size:10px;margin-top:4px;color:'+(dispActual===null?'var(--tx3)':dispActual>=meta?'#22c55e':'#ef4444')+'">'+(dispActual===null?'Sin datos':'Meta: '+meta+'%')+'</div>'+
    '<div style="display:flex;gap:4px;margin-top:6px;justify-content:center">'+
    '<button class="btn-s" onclick="rptDisp(\'excel\')" style="font-size:9px" title="Descargar Excel"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg></button>'+
    '<button class="btn-s" onclick="rptDisp(\'print\')" style="font-size:9px" title="Imprimir"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="5" y="7" width="10" height="6" rx="0.8"/><polyline points="6,7 6,3 14,3 14,7"/><rect x="7" y="13" width="6" height="4"/></svg></button></div>'+
    '</div>'+
    '<div>'+barsWithMeta(dispMes,mesLabels,meta,100,'%',false)+'</div></div>'+

    // 2. MTBF
    '<div class="chart-box" style="display:grid;grid-template-columns:160px 1fr;gap:16px;margin-bottom:16px;padding:16px">'+
    '<div style="text-align:center">'+
    '<div style="font-size:12px;font-weight:700;color:var(--tx3);margin-bottom:4px">MTBF FLOTA</div>'+
    (mtbfActual!=null?
      meterKPI(Math.min(mtbfActual,9999),10000,2000,'hrs','MTBF real: '+mtbfActual+'h · promedio de intervalos entre fallas')+
      '<div style="font-size:10px;margin-top:4px;color:'+(mtbfActual>2000?'#22c55e':mtbfActual>500?'#f59e0b':'#ef4444')+'">'+(mtbfActual>2000?'Alta':mtbfActual>500?'Media':'Baja')+' confiabilidad</div>'
      :'<div style="font-size:26px;font-weight:800;color:var(--tx3);padding:14px 0">—</div><div style="font-size:10px;color:var(--tx3)">Ningún equipo con ≥2 fallas registradas para medir el intervalo</div>')+
    '<div style="font-size:9px;color:var(--tx3);margin-top:4px">'+totalFallas+' fallas totales</div>'+
    '<div style="display:flex;gap:4px;margin-top:6px;justify-content:center">'+
    '<button class="btn-s" onclick="rptMTBF(\'excel\')" style="font-size:9px" title="Descargar Excel"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg></button>'+
    '<button class="btn-s" onclick="rptMTBF(\'print\')" style="font-size:9px" title="Imprimir"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="5" y="7" width="10" height="6" rx="0.8"/><polyline points="6,7 6,3 14,3 14,7"/><rect x="7" y="13" width="6" height="4"/></svg></button></div>'+
    '</div>'+
    '<div>'+barsWithMeta(mtbfMes,mesLabels,2000,Math.max.apply(null,mtbfMes)*1.2||10000,'h',false)+'</div></div>'+

    // 3. CUMPLIMIENTO PM
    '<div class="chart-box" style="display:grid;grid-template-columns:160px 1fr;gap:16px;margin-bottom:16px;padding:16px">'+
    '<div style="text-align:center">'+
    '<div style="font-size:12px;font-weight:700;color:var(--tx3);margin-bottom:4px">CUMPLIMIENTO PM</div>'+
    meterKPI(cumplActual,100,90,'%',cumplActual===null?'':'Cumplimiento: '+cumplActual+'% · '+reg.length+' ejecuciones')+
    '<div style="font-size:10px;margin-top:4px;color:'+(cumplActual===null?'var(--tx3)':cumplActual>=90?'#22c55e':cumplActual>=70?'#f59e0b':'#ef4444')+'">'+(cumplActual===null?'Sin datos':'Meta: 90%')+'</div>'+
    '<div style="font-size:9px;color:var(--tx3)">'+reg.length+' ejecuciones</div>'+
    '<div style="display:flex;gap:4px;margin-top:6px;justify-content:center">'+
    '<button class="btn-s" onclick="rptCumpl(\'excel\')" style="font-size:9px" title="Descargar Excel"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg></button>'+
    '<button class="btn-s" onclick="rptCumpl(\'print\')" style="font-size:9px" title="Imprimir"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="5" y="7" width="10" height="6" rx="0.8"/><polyline points="6,7 6,3 14,3 14,7"/><rect x="7" y="13" width="6" height="4"/></svg></button></div>'+
    '</div>'+
    '<div>'+barsWithMeta(cumplMes,mesLabels,90,100,'%',false)+'</div></div>'+

    // 4. COSTO POR HORA OPERADA
    '<div class="chart-box" style="display:grid;grid-template-columns:160px 1fr;gap:16px;margin-bottom:16px;padding:16px">'+
    '<div style="text-align:center">'+
    '<div style="font-size:12px;font-weight:700;color:var(--tx3);margin-bottom:4px">COSTO / HORA OPERADA</div>'+
    meterKPI(costoHrActual,Math.max(costoHrActual*2,5000),3000,'$/hr','Costo: $'+fn(costoHrActual)+'/hr · meta ≤$3.000/hr',true)+
    '<div style="font-size:10px;margin-top:4px;color:'+(costoHrActual<=3000?'#22c55e':'#ef4444')+'">Meta: ≤$3.000/hr</div>'+
    '<div style="display:flex;gap:4px;margin-top:6px;justify-content:center">'+
    '<button class="btn-s" onclick="rptCostos(\'excel\')" style="font-size:9px" title="Descargar Excel"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg></button>'+
    '<button class="btn-s" onclick="rptCostos(\'print\')" style="font-size:9px" title="Imprimir"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="5" y="7" width="10" height="6" rx="0.8"/><polyline points="6,7 6,3 14,3 14,7"/><rect x="7" y="13" width="6" height="4"/></svg></button></div>'+
    '</div>'+
    '<div>'+barsWithMeta(costoHrMes,mesLabels,3000,Math.max.apply(null,costoHrMes)*1.3||5000,'',true)+'</div></div>'+

    // 5. RATIO PREVENTIVO vs CORRECTIVO
    '<div class="chart-box" style="display:grid;grid-template-columns:160px 1fr;gap:16px;margin-bottom:16px;padding:16px">'+
    '<div style="text-align:center">'+
    '<div style="font-size:12px;font-weight:700;color:var(--tx3);margin-bottom:4px">RATIO PREVENTIVO</div>'+
    meterKPI(ratioActual,100,80,'%',ratioActual===null?'':'Ratio preventivo: '+ratioActual+'% · '+prevTotal+' prev / '+corrTotal+' corr')+
    '<div style="font-size:10px;margin-top:4px;color:'+(ratioActual===null?'var(--tx3)':ratioActual>=80?'#22c55e':ratioActual>=60?'#f59e0b':'#ef4444')+'">'+(ratioActual===null?'Sin datos':'Meta: 80% preventivo')+'</div>'+
    '<div style="font-size:9px;color:var(--tx3)">'+prevTotal+' prev / '+corrTotal+' corr</div>'+
    '<div style="display:flex;gap:4px;margin-top:6px;justify-content:center">'+
    '<button class="btn-s" onclick="rptBacklog(\'excel\')" style="font-size:9px" title="Descargar Excel"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg></button>'+
    '<button class="btn-s" onclick="rptBacklog(\'print\')" style="font-size:9px" title="Imprimir"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="5" y="7" width="10" height="6" rx="0.8"/><polyline points="6,7 6,3 14,3 14,7"/><rect x="7" y="13" width="6" height="4"/></svg></button></div>'+
    '</div>'+
    '<div>'+barsWithMeta(ratioMes,mesLabels,80,100,'%',false)+'</div></div>'+

    // 6. EFICIENCIA HH
    '<div class="chart-box" style="display:grid;grid-template-columns:160px 1fr;gap:16px;margin-bottom:16px;padding:16px">'+
    '<div style="text-align:center">'+
    '<div style="font-size:12px;font-weight:700;color:var(--tx3);margin-bottom:4px">EFICIENCIA HH</div>'+
    meterKPI(hhEfActual,150,80,'%',hhEfActual===null?'':'Eficiencia HH: '+hhEfActual+'% · Real '+Math.round(hhRealT)+'h / Plan '+Math.round(hhPlanT)+'h')+
    '<div style="font-size:10px;margin-top:4px;color:'+(hhEfActual===null?'var(--tx3)':hhEfActual>=80?'#22c55e':'#f59e0b')+'">'+(hhEfActual===null?'Sin datos':'Meta: 80%')+'</div>'+
    '<div style="font-size:9px;color:var(--tx3)">Real: '+Math.round(hhRealT)+'h · Plan: '+Math.round(hhPlanT)+'h</div>'+
    '<div style="display:flex;gap:4px;margin-top:6px;justify-content:center">'+
    '<button class="btn-s" onclick="rptHH(\'excel\')" style="font-size:9px" title="Descargar Excel"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg></button>'+
    '<button class="btn-s" onclick="rptHH(\'print\')" style="font-size:9px" title="Imprimir"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="5" y="7" width="10" height="6" rx="0.8"/><polyline points="6,7 6,3 14,3 14,7"/><rect x="7" y="13" width="6" height="4"/></svg></button></div>'+
    '</div>'+
    '<div>'+barsWithMeta(hhEfMes,mesLabels,80,Math.max.apply(null,hhEfMes.concat([100]))*1.2||150,'%',false)+'</div></div>'+

    // BOTONES DE DESCARGA
    '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px">'+
    '<button class="btn" onclick="rptTodos()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Excel Completo (8 hojas)</button>'+
    '<button class="btn btn-o" onclick="rptEjecutivo(\'excel\')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Ejecutivo</button>'+
    '<button class="btn btn-o" onclick="rptComp(\'excel\')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><polygon points="10,2.5 16,6 16,13 10,16.5 4,13 4,6"/><circle cx="10" cy="9.5" r="2.3"/></svg> Componentes</button>'+
    '<button class="btn btn-o" onclick="rptEjecutivo(\'print\')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="5" y="7" width="10" height="6" rx="0.8"/><polyline points="6,7 6,3 14,3 14,7"/><rect x="7" y="13" width="6" height="4"/></svg> Imprimir Ejecutivo</button>'+
    '</div>';
};
