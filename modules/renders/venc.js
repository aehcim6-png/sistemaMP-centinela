// Pestaña Vencimientos Documentales — extraída a su propio archivo (Fase 2
// de modularización). Módulo ES real (Fase 3, 2026-08-30, quinta tanda:
// Equipos y Mantención) — ver nota de migración en mov.js (primera tanda,
// mismo patrón). vencReglaDefault/vencCalcProximo/vencEstado viven en
// logic.js. comprimirImagen/_subirArchivoBucket quedan en index.html —
// bucket/helpers de subida compartidos también por Informes de Falla y OT.

// Reglas por tipo de equipo, confirmadas por el usuario. NO se inventan periodicidades
// para tipos sin regla conocida (quedan vacías y editables manualmente).
var VENC_TIPOS = ['Revisión Técnica','Permiso Circulación','Seguro','Sistema AFEX','Decreto 80'];

// Periodicidad por defecto en meses, según TIPO de equipo (solo lo confirmado por el usuario).
// null = sin regla conocida, queda 100% editable sin valor por defecto.
// vencReglaDefault / vencCalcProximo / vencEstado viven en logic.js.

// Los camiones aljibe (Mercedes Benz Arocs 3340, circulan por caminos públicos y SÍ
// necesitan Revisión Técnica/Permiso de Circulación) tienen el mismo campo tipo='Camion'
// que los CAEX (Komatsu HD785, uso interno de mina, no llevan esos documentos) — el dato
// no permite distinguirlos. Bug real encontrado: vencReglaDefault busca 'ALJIBE' dentro de
// tipo, que nunca aparece ahí, así que los aljibe NUNCA recibían la periodicidad sugerida
// (hoy no se nota porque ya tienen el dato cargado a mano, pero si se agrega otro aljibe o
// se borra el campo, quedaría sin ningún aviso). Se identifican por sigla, mismo criterio
// que ya usa GRUPO_PAUTAS para darles su propia pauta de mantención.
var VENC_SIGLAS_ALJIBE=['CN-5131','CN-5133'];
function _vencTipoEfectivo(e){
  if(e&&VENC_SIGLAS_ALJIBE.indexOf(e.sigla)>=0)return 'Camion Aljibe';
  return e?e.tipo:'';
}

export function renderVenc(){
  var eq=S.g('eq')||[];
  var venc=S.g('venc')||{}; // { sigla: { tipoVenc: {ultima:'YYYY-MM-DD', periodicidadMeses:N, proxima:'YYYY-MM-DD', obs:''} } }
  var fEq=$('fVencEq')?.value||'';
  var soloAlerta=$('fVencAlerta')?.checked||false;

  // Construir filas: una por equipo x tipo de vencimiento aplicable
  var filas=[];
  eq.forEach(function(e){
    if(fEq && e.sigla!==fEq)return;
    VENC_TIPOS.forEach(function(vt){
      var datosEq=venc[e.sigla]||{};
      var d=datosEq[vt]||{};
      var periodicidad = d.periodicidadMeses!=null ? d.periodicidadMeses : vencReglaDefault(_vencTipoEfectivo(e), vt);
      var proxima = d.proxima || vencCalcProximo(d.ultima, periodicidad);
      var est=vencEstado(proxima, periodicidad!=null);
      // Solo mostrar combinaciones que tengan regla, dato manual, o que el usuario haya tocado
      var tieneAlgo = periodicidad!=null || d.ultima || d.proxima || d.obs;
      if(!tieneAlgo && !soloAlerta) {
        // igual la mostramos para que pueda completarla, pero solo si aplica al tipo de equipo
        // (si no hay regla Y no hay dato, igual la dejamos visible y editable)
      }
      if(soloAlerta && !est.requiereAtencion) return;
      filas.push({sigla:e.sigla, tipo:e.tipo, vencTipo:vt, ultima:d.ultima||'', periodicidad:periodicidad, proxima:proxima||'', obs:d.obs||'', estado:est});
    });
  });

  // Rango para ordenar: vencido/próximo por sus días reales; "sin registrar (requerido)"
  // se trata como urgente (no sabemos hace cuánto falta, pero SÍ sabemos que se exige) en
  // vez de mandarlo al final junto con lo que de verdad no aplica a ese equipo.
  function _vencRango(f){
    if(f.estado.dias!==null)return f.estado.dias;
    if(f.estado.requiereAtencion)return -1;
    return 999999;
  }
  filas.sort(function(a,b){return _vencRango(a)-_vencRango(b);});

  var alertasActivas = filas.filter(function(f){return f.estado.requiereAtencion;});

  $('s-venc').innerHTML=
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Vencimientos Documentales</div>'+
    '<div class="sec-s">'+eq.length+' equipos · '+alertasActivas.length+' requieren atención</div></div>'+
    '<button class="btn btn-o" onclick="exportVencCSV()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> CSV</button></div>'+
    (alertasActivas.length?'<div style="background:rgba(239,68,68,.08);border:1px solid var(--danger);border-radius:8px;padding:10px 14px;margin-bottom:12px;color:var(--danger);font-size:13px">'+
      '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> <b>'+alertasActivas.length+' vencimiento(s) requieren atención</b> (vencidos, vencen en ≤30 días, o nunca se han registrado pese a que el tipo de equipo los exige): '+
      alertasActivas.slice(0,6).map(function(f){return escapeHtml(f.sigla)+' ('+escapeHtml(f.vencTipo)+')';}).join(', ')+
      (alertasActivas.length>6?' y '+(alertasActivas.length-6)+' más...':'')+'</div>':'')+
    '<div class="toolbar">'+
    '<select id="fVencEq" onchange="renders.venc()"><option value="">Todos equipos</option>'+
    eq.map(function(e){return'<option'+(fEq===e.sigla?' selected':'')+'>'+escapeHtml(e.sigla)+'</option>'}).join('')+'</select>'+
    '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--tx2)">'+
    '<input type="checkbox" id="fVencAlerta" onchange="renders.venc()"'+(soloAlerta?' checked':'')+'> Solo lo que requiere atención (vencido, ≤30 días, o nunca registrado)</label>'+
    '</div>'+
    '<div class="tbl-wrap"><table>'+
    '<tr><th>Equipo</th><th>Tipo</th><th>Documento</th><th>Último trámite <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Periodicidad (meses) <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Próximo vencimiento</th><th>Estado</th><th>Foto</th><th>Obs <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th></tr>'+
    filas.map(function(f){
      var fotoUrl=((venc[f.sigla]||{})[f.vencTipo]||{}).foto||'';
      // Gauge de "días hasta vencer" (2026-08-24, mismo lenguaje que
      // Dashboard/Equipos/Alertas PM4): tope de 90 días — la escala de un
      // vencimiento documental (meses/años) es mucho más larga que un PM, un
      // tope de 45 dejaría casi todo el anillo vacío incluso ya cerca. Solo se
      // dibuja si hay días reales (f.estado.dias!==null) — sin regla/sin dato
      // sigue mostrando el texto solo, nunca se inventa un número.
      var estCelda=f.estado.label;
      if(f.estado.dias!==null){
        var vDias=f.estado.dias, vCol=f.estado.color;
        var vPct=vDias<=0?100:Math.max(0,Math.min(100,100-(vDias/90*100)));
        var vC=2*Math.PI*10, vOff=Math.round((vC*(1-vPct/100))*100)/100;
        estCelda='<div style="display:inline-flex;align-items:center;gap:5px"><svg viewBox="0 0 26 26" width="20" height="20" style="transform:rotate(-90deg);flex:none"><circle cx="13" cy="13" r="10" fill="none" stroke="var(--bg4)" stroke-width="3.5"></circle><circle class="gauge-ring" cx="13" cy="13" r="10" fill="none" stroke="'+vCol+'" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="'+vC+'" stroke-dashoffset="'+vC+'" data-off="'+vOff+'"></circle></svg><span>'+f.estado.label+'</span></div>';
      }
      return '<tr style="'+(f.estado.dias!==null&&f.estado.dias<=30?'background:rgba(239,68,68,.04)':'')+'">'+
        '<td class="mono" style="color:var(--ac)">'+escapeHtml(f.sigla)+'</td>'+
        '<td style="font-size:11px;color:var(--tx3)">'+(f.tipo||'—')+'</td>'+
        '<td style="font-size:12px">'+f.vencTipo+'</td>'+
        '<td><input type="date" value="'+f.ultima+'" onchange="edVenc(\''+escapeHtml(f.sigla)+'\',\''+escapeHtml(f.vencTipo)+'\',\'ultima\',this.value)" style="background:transparent;border:none;color:var(--tx);font-size:11px"></td>'+
        '<td><input type="number" value="'+(f.periodicidad!=null?f.periodicidad:'')+'" placeholder="—" onchange="edVenc(\''+escapeHtml(f.sigla)+'\',\''+escapeHtml(f.vencTipo)+'\',\'periodicidadMeses\',this.value)" style="width:60px;background:transparent;border:none;color:var(--tx);font-size:11px"></td>'+
        '<td><input type="date" value="'+f.proxima+'" onchange="edVenc(\''+escapeHtml(f.sigla)+'\',\''+escapeHtml(f.vencTipo)+'\',\'proxima\',this.value)" style="background:transparent;border:none;color:var(--tx);font-size:11px"></td>'+
        '<td style="color:'+f.estado.color+';font-weight:600;font-size:11px">'+estCelda+'</td>'+
        celdaFotoVenc(f.sigla,f.vencTipo,fotoUrl,((venc[f.sigla]||{})[f.vencTipo]||{}).fotoTipo)+
        '<td><input value="'+escapeHtml(f.obs||'')+'" onchange="edVenc(\''+escapeHtml(f.sigla)+'\',\''+escapeHtml(f.vencTipo)+'\',\'obs\',this.value)" style="width:100%;background:transparent;border:none;color:var(--tx);font-size:11px" placeholder="..."></td>'+
        '</tr>';
    }).join('')+
    '</table></div>'+
    '<input type="file" id="vencFotoInput" accept="image/*,application/pdf" style="display:none" onchange="_vencFotoSeleccionada(event)">';
  if(typeof _animGauges==='function')_animGauges('s-venc');
}

function celdaFotoVenc(sigla,vencTipo,fotoUrl,fotoTipo){
  if(fotoUrl){
    var miniatura = fotoTipo==='pdf'
      ? '<div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:var(--bg3);border-radius:4px;cursor:pointer;border:1px solid var(--bor);font-size:16px" onclick="window.open(\''+fotoUrl+'\',\'_blank\')" title="Ver PDF"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="5,2 12,2 15,5 15,18 5,18"/><polyline points="12,2 12,5 15,5"/><line x1="7" y1="10" x2="13" y2="10"/><line x1="7" y1="13" x2="13" y2="13"/></svg></div>'
      : '<img src="'+fotoUrl+'" style="width:32px;height:32px;object-fit:cover;border-radius:4px;cursor:pointer;border:1px solid var(--bor)" onclick="window.open(\''+fotoUrl+'\',\'_blank\')" title="Ver foto completa">';
    return '<td style="text-align:center;white-space:nowrap">'+miniatura+'<br>'+
      '<a href="#" style="font-size:9px;color:var(--ac)" onclick="event.preventDefault();_vencAbrirSelector(\''+escapeHtml(sigla)+'\',\''+escapeHtml(vencTipo)+'\')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 10 A6 6 0 0 1 15.5 6.5" fill="none"/><polyline points="15.5,3 15.5,6.5 12,6.5"/><path d="M16 10 A6 6 0 0 1 4.5 13.5" fill="none"/><polyline points="4.5,17 4.5,13.5 8,13.5"/></svg> cambiar</a></td>';
  }
  return '<td style="text-align:center"><button class="btn-x" onclick="_vencAbrirSelector(\''+escapeHtml(sigla)+'\',\''+escapeHtml(vencTipo)+'\')" title="Subir foto o PDF del documento"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg></button></td>';
}
window._vencFotoTarget=null;
export function _vencAbrirSelector(sigla,vencTipo){
  window._vencFotoTarget={sigla:sigla,vencTipo:vencTipo};
  $('vencFotoInput').click();
}
export async function _vencFotoSeleccionada(ev){
  var file=ev.target.files&&ev.target.files[0];
  var target=window._vencFotoTarget;
  ev.target.value=''; // permite volver a elegir el mismo archivo después si hace falta
  if(!file||!target)return;
  var esPDF=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
  toast('⏳ Subiendo '+(esPDF?'PDF':'foto')+'...');
  try{
    var blob,ext,contentType;
    if(esPDF){
      blob=file;ext='pdf';contentType='application/pdf';
    }else{
      var comp=await comprimirImagen(file);
      if(!comp)return toast('❌ No se pudo procesar la imagen');
      blob=comp.blob;ext='jpg';contentType='image/jpeg';
    }
    var path='documentos/'+target.sigla+'/'+target.vencTipo.replace(/[^a-zA-Z0-9]/g,'_')+'_'+Date.now()+'.'+ext;
    var url=await _subirArchivoBucket(blob,path,contentType);
    var venc=S.g('venc')||{};
    if(!venc[target.sigla])venc[target.sigla]={};
    if(!venc[target.sigla][target.vencTipo])venc[target.sigla][target.vencTipo]={};
    venc[target.sigla][target.vencTipo].foto=url;
    venc[target.sigla][target.vencTipo].fotoTipo=esPDF?'pdf':'imagen';
    S.s('venc',venc);
    toast('✅ '+(esPDF?'PDF':'Foto')+' guardado');
    renders.venc();
  }catch(err){
    toast('❌ Error subiendo: '+err.message);
  }
}

export function edVenc(sigla,vencTipo,campo,val){
  var venc=S.g('venc')||{};
  if(!venc[sigla])venc[sigla]={};
  if(!venc[sigla][vencTipo])venc[sigla][vencTipo]={};
  if(campo==='periodicidadMeses'){
    venc[sigla][vencTipo][campo]=val===''?null:parseInt(val);
    // Si cambia periodicidad y hay fecha última, recalcula próxima automáticamente
    if(venc[sigla][vencTipo].ultima){
      venc[sigla][vencTipo].proxima=vencCalcProximo(venc[sigla][vencTipo].ultima, venc[sigla][vencTipo].periodicidadMeses);
    }
  }else if(campo==='ultima'){
    venc[sigla][vencTipo][campo]=val;
    // Recalcula próxima automáticamente si hay periodicidad
    var per=venc[sigla][vencTipo].periodicidadMeses;
    if(per==null){
      var eqArr=S.g('eq')||[];
      var eObj=eqArr.find(function(x){return x.sigla===sigla;});
      per=vencReglaDefault(_vencTipoEfectivo(eObj),vencTipo);
    }
    if(per)venc[sigla][vencTipo].proxima=vencCalcProximo(val, per);
  }else{
    venc[sigla][vencTipo][campo]=val;
  }
  S.s('venc',venc);
  renders.venc();
  var est=vencEstado(venc[sigla][vencTipo].proxima, venc[sigla][vencTipo].periodicidadMeses!=null);
  if(est.requiereAtencion){
    toast('⚠️ '+sigla+' · '+vencTipo+': '+est.label);
  }
}

export function exportVencCSV(){
  var eq=S.g('eq')||[];
  var venc=S.g('venc')||{};
  var filas=[];
  eq.forEach(function(e){
    VENC_TIPOS.forEach(function(vt){
      var d=(venc[e.sigla]||{})[vt]||{};
      var per=d.periodicidadMeses!=null?d.periodicidadMeses:vencReglaDefault(_vencTipoEfectivo(e),vt);
      var prox=d.proxima||vencCalcProximo(d.ultima,per);
      var est=vencEstado(prox,per!=null);
      filas.push({
        equipo:e.sigla,
        tipo:e.tipo||'',
        modelo:e.modelo||'',
        patente:e.patente||'',
        documento:vt,
        ultimo_tramite:d.ultima||'',
        periodicidad_meses:per!=null?per:'',
        proxima_fecha:prox||'',
        estado:est.label||'Sin datos',
        dias_restantes:est.dias!=null?est.dias:'',
        observacion:d.obs||''
      });
    });
  });
  if(!filas.length)return toast('Sin datos de vencimientos');
  var keys=Object.keys(filas[0]);
  // periodicidad_meses/dias_restantes son numéricos reales (dias_restantes puede ser
  // negativo, ej. "-15" = 15 días vencido) — csvCeldaSegura NO se les aplica, los
  // convertiría a texto y rompería el formato numérico en Excel/Sheets. El resto
  // (observacion en particular, texto libre) sí puede traer =+-@ al inicio sin mala
  // intención (ver csvCeldaSegura en logic.js) y necesita el prefijo de protección
  // contra CSV/Formula Injection. Las comillas internas se escapan aparte (estaban
  // rompiendo la estructura del CSV si un campo libre traía una comilla).
  var CAMPOS_NUMERICOS_VENC=['periodicidad_meses','dias_restantes'];
  var csv=[keys.join(';'),...filas.map(function(r){
    return keys.map(function(k){
      var v=r[k]??'';
      if(CAMPOS_NUMERICOS_VENC.indexOf(k)<0)v=csvCeldaSegura(v);
      return'"'+String(v).replace(/"/g,'""')+'"';
    }).join(';');
  })].join('\n');
  var blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='vencimientos_centinela_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  toast('📥 CSV vencimientos exportado ('+filas.length+' filas)');
}

// Puente window/renders — ver nota en mov.js (primera tanda).
window.renderVenc = renderVenc;
window._vencAbrirSelector = _vencAbrirSelector;
window._vencFotoSeleccionada = _vencFotoSeleccionada;
window.edVenc = edVenc;
window.exportVencCSV = exportVencCSV;
renders.venc = renderVenc;
