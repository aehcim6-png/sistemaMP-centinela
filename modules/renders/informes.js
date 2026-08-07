// Pestaña Informes de Falla Catastrófica / Cambio de Componente Mayor
// (sub-pestaña de Componentes) — extraída a su propio archivo (Fase 2 de
// modularización). Script plano (NO módulo ES), mismo scope global de
// siempre. FOTOS_BUCKET/comprimirImagen/_subirArchivoBucket quedan en
// index.html — son un bucket/helpers de subida compartidos también por OT
// (fotos de correctivos) y Vencimientos (fotos de documentos).
const INFORMES_COMPS_SUGERIDOS=['Motor','Transmisión','Diferencial','Convertidor','Mandos Finales','Bomba Hidráulica','Turbo','Alternador','Motor de partida','Frenos','Dirección','Suspensión','Neumáticos','Sistema eléctrico','Cabina','Estructura','Refrigeración','Compresor A/C'];

// Sube una foto (blob ya comprimido) al bucket de Supabase Storage y devuelve su URL pública
async function subirFotoInforme(blob,sigla,idx){
  var path=sigla+'/'+Date.now()+'_'+idx+'.jpg';
  return _subirArchivoBucket(blob,path);
}

// La tabla de Componentes Mayores en sí es de edición en línea (sin
// formulario), así que el formulario real y valioso de esta sección es
// este: reportar una falla catastrófica o un cambio de componente mayor
// — el caso típico de alguien parado al lado de un equipo detenido, con
// las manos ocupadas. Las fotos de evidencia quedan fuera del flujo por
// razones obvias (necesitan cámara) — se pueden agregar después abriendo
// el informe ya guardado.
window.INFORME_VOZ_PASOS=[
  {campo:'ifEq',pregunta:'¿Qué equipo? Di la sigla.',tipo:'equipo',requerido:true},
  {campo:'ifTipo',pregunta:'¿Es una falla catastrófica o un cambio de componente mayor? Di falla catastrófica, o cambio componente mayor.',tipo:'opciones',requerido:false},
  {campo:'ifComp',pregunta:'¿Qué componente está afectado? Por ejemplo motor, transmisión, o diferencial.',tipo:'texto_opcional',requerido:false},
  {campo:'ifDesc',pregunta:'Descríbeme la falla.',tipo:'texto',requerido:true},
  {campo:'ifGen',pregunta:'¿Quién genera este informe? Di tu nombre.',tipo:'opciones',requerido:true},
  {campo:'ifCausa',pregunta:'¿Sabes la causa probable? Puedes decir "omitir" si no.',tipo:'texto_opcional',requerido:false},
];
function _infVozResumenTexto(){
  var sig=document.getElementById('ifEq').value||'sin equipo';
  var tipo=document.getElementById('ifTipo').value||'';
  var comp=document.getElementById('ifComp').value||'';
  var desc=document.getElementById('ifDesc').value||'sin descripción';
  var gen=document.getElementById('ifGen').value||'';
  return 'Resumen: '+tipo+' en '+sig+(comp?', componente '+comp:'')+', descripción: '+desc+(gen?', generado por '+gen:'')+'.';
}
window._iniciarInformePorVoz=function(){
  if(!document.getElementById('ifEq')&&typeof nuevoInforme==='function')nuevoInforme();
  _iniciarFlujoVoz(window.INFORME_VOZ_PASOS,function(){if(typeof guardarInforme==='function')guardarInforme();},_infVozResumenTexto);
};

// Abre el formulario. sigla/compIdx opcionales — si vienen desde una fila de Componentes Mayores, precarga datos.
window.nuevoInforme=function(sigla,compIdx){
  var eq=S.g('eq')||[];
  var compData=S.g('compMayores')||[];
  var compRow=(compIdx!=null && compIdx>=0)?compData[compIdx]:null;
  var eqObj=sigla?eq.find(function(e){return e.sigla===sigla;}):null;
  var per=_tecnicosDisponibles();
  var hoy=new Date().toISOString().slice(0,10);
  window._infCompIdx=(compIdx!=null && compIdx>=0)?compIdx:null;
  window._infFotos=[];
  sm(`<div style="max-width:700px">
    <h3><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="5,2 12,2 15,5 15,18 5,18"/><polyline points="12,2 12,5 15,5"/><line x1="7" y1="10" x2="13" y2="10"/><line x1="7" y1="13" x2="13" y2="13"/></svg> Informe de Falla / Cambio de Componente Mayor</h3>
    <div class="form-row">
      <div class="fg"><label>Equipo *</label><select id="ifEq" onchange="_infEqChange()"><option value="">Seleccionar...</option>${eq.map(function(e){return '<option'+(e.sigla===sigla?' selected':'')+'>'+escapeHtml(e.sigla)+'</option>';}).join('')}</select></div>
      <div class="fg"><label>Tipo de Evento *</label><select id="ifTipo"><option${!compRow?' selected':''}>Falla Catastrófica</option><option${compRow?' selected':''}>Cambio Componente Mayor</option></select></div>
    </div>
    <div class="form-row">
      <div class="fg"><label>Fecha del evento *</label><input type="date" id="ifFecha" value="${hoy}"></div>
      <div class="fg"><label>Horómetro actual</label><input type="number" id="ifHorom" value="${eqObj?eqObj.horomActual:(compRow?compRow.horomComp:'')||''}"></div>
      <div class="fg"><label>Costo estimado ($)</label><input type="number" id="ifCosto" value="${compRow?(compRow.costoRef||0):0}"></div>
    </div>
    <div class="form-row">
      <div class="fg" style="flex:2"><label>Componente afectado</label><input id="ifComp" list="ifCompList" value="${compRow?compRow.comp:''}" style="width:100%"><datalist id="ifCompList">${INFORMES_COMPS_SUGERIDOS.map(function(c){return '<option value="'+c+'">';}).join('')}</datalist></div>
      <div class="fg"><label>Generado por *</label><select id="ifGen"><option value="">—</option>${per.map(function(p){return '<option>'+p+'</option>';}).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="fg" style="flex:1;width:100%"><label>Descripción de la falla *</label><textarea id="ifDesc" rows="3" style="width:100%"></textarea></div>
    </div>
    <div class="form-row">
      <div class="fg" style="flex:1;width:100%"><label>Causa probable</label><textarea id="ifCausa" rows="2" style="width:100%"></textarea></div>
    </div>
    <div class="form-row">
      <div class="fg" style="width:100%"><label>Fotos de evidencia</label><input type="file" id="ifFotos" accept="image/*" capture="environment" multiple onchange="_infFotosChange(event)">
      <div id="ifPreview" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"></div></div>
    </div>
    <br><button class="btn" id="ifBtnGuardar" onclick="guardarInforme()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Generar Informe y PDF</button> <button class="btn btn-o" onclick="cm()">Cancelar</button> <button type="button" class="btn btn-o" onclick="_iniciarInformePorVoz()">${ICONS.mic} Completar por voz</button>
  </div>`);
};
window._infEqChange=function(){
  var sig=$('ifEq').value;
  var eq=S.g('eq')||[];
  var e=eq.find(function(x){return x.sigla===sig;});
  if(e && $('ifHorom'))$('ifHorom').value=e.horomActual;
};
window._infFotosChange=async function(ev){
  var files=Array.prototype.slice.call(ev.target.files||[]);
  var prev=$('ifPreview');
  prev.innerHTML='⏳ Procesando fotos...';
  var resultados=[];
  for(var i=0;i<files.length;i++){
    var r=await comprimirImagen(files[i]);
    if(r)resultados.push(r);
  }
  window._infFotos=resultados;
  prev.innerHTML=resultados.map(function(r){return '<img src="'+r.dataUrl+'" style="width:70px;height:70px;object-fit:cover;border-radius:6px;border:1px solid var(--bor)">';}).join('')
    || '<span style="font-size:11px;color:var(--muted)">No se pudieron procesar las fotos seleccionadas</span>';
};
window.guardarInforme=async function(){
  var sigla=$('ifEq').value;
  var tipoEvento=$('ifTipo').value;
  var desc=$('ifDesc').value.trim();
  var gen=$('ifGen').value;
  if(!sigla)return toast('⚠️ Selecciona equipo');
  if(!desc)return toast('⚠️ Ingresa descripción de la falla');
  if(!gen)return toast('⚠️ Selecciona quién genera el informe');

  var eq=S.g('eq')||[];
  var eqObj=eq.find(function(e){return e.sigla===sigla;});
  var btn=$('ifBtnGuardar');
  var fotos=window._infFotos||[];
  var urls=[];
  if(btn){btn.disabled=true;btn.textContent='⏳ Subiendo fotos...';}
  try{
    for(var i=0;i<fotos.length;i++){
      var url=await subirFotoInforme(fotos[i].blob,sigla,i);
      urls.push(url);
    }
  }catch(err){
    toast('❌ Error subiendo fotos: '+err.message);
    if(btn){btn.disabled=false;btn.textContent='<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Generar Informe y PDF';}
    return;
  }

  var inf={
    id:Date.now()+'_'+Math.random().toString(36).slice(2,8),
    sigla:sigla,
    tipo:eqObj?eqObj.tipo:'',
    modelo:eqObj?eqObj.modelo:'',
    unidad:eqObj?eqObj.unidad:'',
    fecha:$('ifFecha').value,
    tipoEvento:tipoEvento,
    componente:$('ifComp').value.trim(),
    horometroActual:parseFloat($('ifHorom').value)||0,
    costoEstimado:parseFloat($('ifCosto').value)||0,
    descripcion:desc,
    causaProbable:$('ifCausa').value.trim(),
    generadoPor:gen,
    fotos:urls,
    fechaCreacion:new Date().toISOString()
  };

  var lista=S.g('informesFalla')||[];
  lista.push(inf);
  S.s('informesFalla',lista);

  // Reset opcional del contador de vida útil, solo si vino ligado a una fila de Componentes Mayores
  if(tipoEvento==='Cambio Componente Mayor' && window._infCompIdx!=null){
    if(confirm('¿Este informe corresponde a un cambio real de componente?\n\nSi confirmas, se reinicia el contador de vida útil de "'+inf.componente+'" en '+sigla+' (horómetro de instalación = '+inf.horometroActual+', fecha = '+inf.fecha+').')){
      var compData=S.g('compMayores')||[];
      if(compData[window._infCompIdx]){
        compData[window._infCompIdx].horomComp=inf.horometroActual;
        compData[window._infCompIdx].fechaInst=inf.fecha;
        S.s('compMayores',compData);
      }
    }
  }

  generarPDFInforme(inf,fotos.map(function(f){return f.dataUrl;}));
  cm();
  toast('✅ Informe generado y PDF descargado');
  renders.informes();
  refreshAll();
};

// Vuelve a descargar el PDF de un informe ya guardado (re-descarga las fotos desde Storage)
window.regenerarPDF=async function(id){
  var lista=S.g('informesFalla')||[];
  var inf=lista.find(function(x){return x.id===id;});
  if(!inf)return toast('❌ Informe no encontrado');
  toast('⏳ Descargando fotos...');
  var dataUrls=[];
  for(var i=0;i<(inf.fotos||[]).length;i++){
    try{
      var resp=await fetch(inf.fotos[i]);
      var blob=await resp.blob();
      var durl=await new Promise(function(res){var r=new FileReader();r.onload=function(e){res(e.target.result);};r.readAsDataURL(blob);});
      dataUrls.push(durl);
    }catch(e){}
  }
  generarPDFInforme(inf,dataUrls);
};

function generarPDFInforme(inf,dataUrls){
  var jspdfNs=window.jspdf;
  if(!jspdfNs){toast('❌ No se pudo cargar el generador de PDF (revisa conexión a internet)');return;}
  var jsPDF=jspdfNs.jsPDF;
  var doc=new jsPDF({unit:'mm',format:'a4'});
  var pageW=210,pageH=297,marginL=20,marginR=20,contentW=pageW-marginL-marginR;
  var y=0;

  // Barra superior de color
  doc.setFillColor(184,51,31);
  doc.rect(0,0,pageW,6,'F');
  y=18;

  // Título
  doc.setFont('helvetica','bold');doc.setFontSize(16);doc.setTextColor(26,26,26);
  var titulo=inf.tipoEvento==='Falla Catastrófica'?'INFORME DE FALLA CATASTRÓFICA':'INFORME DE CAMBIO DE COMPONENTE MAYOR';
  doc.text(titulo,marginL,y);
  y+=6;
  doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(136,136,136);
  doc.text('SistemaMP Centinela  ·  Generado '+new Date().toLocaleString('es-CL')+'  ·  N° '+String(inf.id).slice(0,13),marginL,y);
  y+=6;
  doc.setDrawColor(221,221,221);doc.line(marginL,y,pageW-marginR,y);
  y+=8;

  // Datos en 2 columnas (label chico gris + valor)
  function campoDual(l1,v1,l2,v2){
    var colW=contentW/2;
    doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(85,85,85);
    doc.text(l1,marginL,y);
    if(l2)doc.text(l2,marginL+colW,y);
    y+=4.5;
    doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(17,17,17);
    var lines1=doc.splitTextToSize(String(v1||'—'),colW-5);
    doc.text(lines1,marginL,y);
    var maxLines=lines1.length;
    if(l2){
      var lines2=doc.splitTextToSize(String(v2||'—'),colW-5);
      doc.text(lines2,marginL+colW,y);
      maxLines=Math.max(maxLines,lines2.length);
    }
    y+=5*maxLines+4;
  }
  campoDual('EQUIPO',inf.sigla+' — '+(inf.modelo||inf.tipo||''),'FECHA DEL EVENTO',inf.fecha);
  campoDual('HORÓMETRO ACTUAL',inf.horometroActual+' '+(inf.unidad==='km'?'km':'h'),'TIPO DE EVENTO',inf.tipoEvento);
  campoDual('COMPONENTE AFECTADO',inf.componente,'COSTO ESTIMADO','$'+Number(inf.costoEstimado||0).toLocaleString('es-CL'));
  campoDual('GENERADO POR',inf.generadoPor,'','');
  y+=2;

  function seccion(t){
    doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(184,51,31);
    doc.text(t.toUpperCase(),marginL,y);
    y+=6;
    doc.setTextColor(0,0,0);
  }
  function parrafo(texto){
    doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(17,17,17);
    var lines=doc.splitTextToSize(String(texto||'—'),contentW);
    doc.text(lines,marginL,y);
    y+=5*lines.length+6;
  }
  seccion('Descripción de la Falla');
  parrafo(inf.descripcion);
  seccion('Causa Probable');
  parrafo(inf.causaProbable);

  if(dataUrls && dataUrls.length){
    if(y>240){doc.addPage();y=20;}
    seccion('Evidencia Fotográfica');
    var imgW=(contentW-8)/2,imgH=imgW*0.75,xPos=marginL,count=0;
    dataUrls.forEach(function(durl){
      if(y+imgH>265){doc.addPage();y=20;xPos=marginL;count=0;}
      try{doc.addImage(durl,'JPEG',xPos,y,imgW,imgH);}catch(e){}
      count++;
      if(count%2===0){xPos=marginL;y+=imgH+8;}else{xPos=marginL+imgW+8;}
    });
    if(dataUrls.length%2!==0)y+=imgH+8;
  }

  // Firmas — Jefe de Maquinaria / Jefe de Taller (línea en blanco, sin nombre precargado)
  if(y>240){doc.addPage();y=30;}else{y=Math.max(y+15,245);}
  doc.setDrawColor(221,221,221);doc.line(marginL,y,pageW-marginR,y);
  y+=22;
  var firmaColW=contentW/2;
  var lineaFirma='______________________________';
  doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(0,0,0);
  doc.text(lineaFirma,marginL+firmaColW/2,y,{align:'center'});
  doc.text(lineaFirma,marginL+firmaColW+firmaColW/2,y,{align:'center'});
  y+=5;
  doc.setFont('helvetica','bold');doc.setFontSize(9);
  doc.text('Jefe de Maquinaria',marginL+firmaColW/2,y,{align:'center'});
  doc.text('Jefe de Taller',marginL+firmaColW+firmaColW/2,y,{align:'center'});

  doc.save('Informe_'+inf.sigla+'_'+inf.fecha+'.pdf');
}

window.renderInformes=function(){
  var lista=(S.g('informesFalla')||[]).slice().sort(function(a,b){return (b.fechaCreacion||'').localeCompare(a.fechaCreacion||'');});
  var costoTotal=lista.reduce(function(s,i){return s+(i.costoEstimado||0);},0);
  var pg=_pagSlice('informes',lista);
  $('s-informes').innerHTML=
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="5,2 12,2 15,5 15,18 5,18"/><polyline points="12,2 12,5 15,5"/><line x1="7" y1="10" x2="13" y2="10"/><line x1="7" y1="13" x2="13" y2="13"/></svg> Informes de Falla y Cambio de Componente</div>'+
    '<div class="sec-s">'+lista.length+' informe(s) · Costo total estimado: $'+Math.round(costoTotal).toLocaleString('es-CL')+'</div></div>'+
    '<button class="btn" onclick="nuevoInforme(\'\',null)">+ Nuevo Informe</button></div>'+
    _pagHTML('informes',pg)+
    '<div class="tbl-wrap"><table>'+
    '<tr><th>Equipo</th><th>Fecha</th><th>Tipo</th><th>Componente</th><th>Costo Est.</th><th>Fotos</th><th>Generado por</th><th></th></tr>'+
    pg.items.map(function(i){
      return '<tr>'+
        '<td class="mono" style="color:var(--ac)">'+escapeHtml(i.sigla)+'</td>'+
        '<td class="mono">'+i.fecha+'</td>'+
        '<td>'+(i.tipoEvento==='Falla Catastrófica'?'🔴 Falla Catastrófica':'<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><polygon points="10,2.5 16,6 16,13 10,16.5 4,13 4,6"/><circle cx="10" cy="9.5" r="2.3"/></svg> Cambio Componente')+'</td>'+
        '<td>'+escapeHtml(i.componente||'—')+'</td>'+
        '<td class="mono">$'+Math.round(i.costoEstimado||0).toLocaleString('es-CL')+'</td>'+
        '<td>'+(i.fotos?i.fotos.length:0)+' 📷</td>'+
        '<td style="font-size:11px">'+escapeHtml(i.generadoPor||'—')+'</td>'+
        '<td><button class="btn-x" onclick="regenerarPDF(\''+i.id+'\')" title="Descargar PDF"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg></button> <button class="btn-x" onclick="delInforme(\''+i.id+'\')" title="Eliminar"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg></button></td></tr>';
    }).join('')+
    '</table></div>'+
    _pagHTML('informes',pg)+
    (lista.length?'':'<p style="padding:20px;color:var(--muted)">No hay informes generados todavía.</p>');
};
window.delInforme=function(id){
  if(!confirm('¿Eliminar este informe? (Las fotos quedan guardadas en Supabase Storage, no se borran automáticamente)'))return;
  var todos=S.g('informesFalla')||[];
  var fila=todos.find(function(x){return x.id===id;});
  if(fila)_moverAPapelera('informesFalla',fila);
  var lista=todos.filter(function(x){return x.id!==id;});
  S.s('informesFalla',lista);
  renders.informes();
};
