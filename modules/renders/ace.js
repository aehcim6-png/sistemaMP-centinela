// Pestaña Análisis de Aceite — extraída a su propio archivo (Fase 2 de
// modularización). Script plano (NO módulo ES), mismo scope global de
// siempre. _edCampo vive en index.html (compartido). exportTabla/
// imprimirTab (botones globales de la barra superior) también quedan en
// index.html — no son propios de esta pestaña.
window.renderAce=function(){
  var ace=S.g('aceite')||[];
  var fEq=$('fAceEq')?.value||'';
  var fEst=$('fAceEst')?.value||'';
  var eq=S.g('eq')||[];

  // Map component codes to equipment siglas — usa el campo 'equipo' directo si existe (datos COPEC nuevos);
  // si no, recurre al parsing legacy del campo 'componente' (datos cargados manualmente antes).
  var siglaMap={};
  ace.forEach(function(m){
    if(m.equipo){m._sigla=m.equipo;return;}
    var comp=(m.componente||'').replace(/[-_]?(MT|SH|TR|MFD|MFI|DIF|DD|DT|TRANS|HID|FR|REF|RF|MC|MDI|MG|MGT|DF|HD|TAND|TANI|FRENO|REFRIGERANTE)$/i,'');
    // Alias numéricos conocidos PRIMERO — deben correr ANTES del swap genérico de
    // prefijo de más abajo. Bug real encontrado el 2026-07-16: con el orden viejo
    // (swap genérico primero), "CE-88" ya se convertía en "CN-88" antes de llegar
    // acá, así que ningún .replace('CE-88',...) de esta tabla encontraba nada —
    // toda esta corrección era código muerto, y el resultado real terminaba siendo
    // un sigla inexistente ("CN-88") en vez de la real (CN-9502). Corregido de paso
    // el mapeo en sí, que además tenía varios códigos apuntando al equipo
    // equivocado (confirmado con el usuario). Mismo mapeo que ALIAS_EQUIPOS_PROGDIA
    // (Programación Diaria) para que ambas pantallas coincidan.
    comp=comp.replace('CE-84','CN-4656').replace('CE-85','CN-9503').replace('CE-86','CN-9501')
      .replace('CE-87','CN-9500').replace('CE-88','CN-9502').replace('CE-89','CN-9507')
      .replace('CE-113','CN-6113').replace('CE-155','CN-10155').replace('CE-159','CN-10159')
      .replace('CE-160','CN-10160').replace('CE-56','CN-4656')
      .replace('CF-510','CF-9510').replace('CF-511','CF-9511').replace('CF-769','CF-8769')
      .replace('BD-533','BD-9533').replace('BD-509','BD-9509').replace('BD-139','BD-10139')
      .replace('MN-12','MN-6112').replace('MN-16','MN-5926');
    // Respaldo genérico: solo entra en juego si el código no estaba en la tabla de
    // arriba (si ya se tradujo, comp ya no empieza con CE-/CF-/BD-/MN- y esto no hace nada).
    comp=comp.replace(/^CE-/,'CN-').replace(/^CF-/,'CF-').replace(/^BD-/,'BD-').replace(/^MN-/,'MN-');
    m._sigla=comp;
  });

  var fil=ace.filter(function(m){
    if(fEq&&!(m._sigla||'').includes(fEq)&&!(m.componente||'').includes(fEq))return false;
    if(fEst&&m.estado!==fEst)return false;
    return true;
  });

  // Alertas persistentes: mismo equipo+componente con 2 muestras SEGUIDAS en
  // ALERTA/PRECAUCION — el laboratorio ya avisó, dio recomendación, y el
  // problema seguía igual en la siguiente muestra. Auditoría real (2026-08):
  // pasa el 89% de las veces que sale ALERTA, y solo 15% de esas alertas
  // terminan en un correctivo que atienda el mismo componente dentro de 60
  // días — la herramienta pensada para anticipar la falla se está generando,
  // pero casi nunca se actúa sobre ella antes de la siguiente muestra.
  var porGrupoAce={};
  ace.forEach(function(m){
    var k=(m._sigla||'')+'|'+(m.componente||'');
    if(!(m._sigla||'').trim()||!(m.componente||'').trim()||!m.fecha)return;
    (porGrupoAce[k]=porGrupoAce[k]||[]).push(m);
  });
  var alertasPersistentes=[];
  Object.keys(porGrupoAce).forEach(function(k){
    var muestras=porGrupoAce[k].slice().sort(function(a,b){return a.fecha<b.fecha?-1:a.fecha>b.fecha?1:0;});
    var ultima=muestras[muestras.length-1],anterior=muestras[muestras.length-2];
    if(!anterior)return;
    var esProblema=function(m){return m.estado==='ALERTA'||m.estado==='PRECAUCION';};
    if(esProblema(ultima)&&esProblema(anterior)){
      alertasPersistentes.push({sigla:ultima._sigla,componente:ultima.componente,estado:ultima.estado,fecha:ultima.fecha,fechaAnterior:anterior.fecha,comentario:ultima.comentario||''});
    }
  });
  alertasPersistentes.sort(function(a,b){return(a.estado==='ALERTA'?0:1)-(b.estado==='ALERTA'?0:1);});
  var alertasPersistentesHTML=alertasPersistentes.length?
    '<div style="background:rgba(239,68,68,.08);border:1px solid var(--danger);border-radius:8px;padding:10px 14px;margin-bottom:14px">'+
    '<b style="font-size:12px;color:var(--danger)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="8"/><line x1="4.5" y1="15.5" x2="15.5" y2="4.5"/></svg> '+alertasPersistentes.length+' alerta'+(alertasPersistentes.length===1?'':'s')+' de aceite que NO se resolvió en la muestra siguiente</b>'+
    alertasPersistentes.map(function(a){
      return'<div style="display:flex;align-items:baseline;gap:8px;margin-top:6px;font-size:12px;flex-wrap:wrap">'+
        '<span class="mono" style="color:var(--ac);min-width:70px">'+escapeHtml(a.sigla)+'</span>'+
        '<span style="color:var(--tx2);font-weight:600">'+escapeHtml(a.componente)+'</span>'+
        '<b style="color:'+(a.estado==='ALERTA'?'var(--danger)':'var(--warn)')+'">'+a.estado+'</b>'+
        '<span style="color:var(--tx3)">desde '+a.fechaAnterior+', sigue igual el '+a.fecha+'</span>'+
        '</div>';
    }).join('')+
    '</div>':'';

  // Stats
  var normal=ace.filter(function(m){return m.estado==='NORMAL';}).length;
  var precaucion=ace.filter(function(m){return m.estado==='PRECAUCION';}).length;
  var alerta=ace.filter(function(m){return m.estado==='ALERTA';}).length;

  var allSiglas=[...new Set(ace.map(function(m){return m._sigla||m.componente;}))].sort();
  var is=CELL_INPUT_STYLE+';font-size:10px;padding:2px';
  var pg=_pagSlice('ace',fil);

  $('s-ace').innerHTML=
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="2" x2="8" y2="8"/><line x1="12" y1="2" x2="12" y2="8"/><line x1="6.5" y1="2" x2="13.5" y2="2"/><polygon points="8,8 12,8 16,17 4,17"/><line x1="6" y1="13" x2="14" y2="13"/></svg> Análisis de Aceite</div>'+
    '<div class="sec-s">'+ace.length+' muestras · Alimenta predictivo por condición</div></div>'+
    '<div><button class="btn" onclick="addAceite()">+ Manual</button> <button class="btn btn-o" onclick="importAceite()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar CSV</button></div></div>'+

    alertasPersistentesHTML+

    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">'+
    '<div class="card" style="cursor:pointer;border-left:3px solid #22c55e" onclick="$(\'fAceEst\').value=\'NORMAL\';window._pag.ace=1;renders.ace()"><div class="card-t">🟢 Normal</div><div class="card-v" style="color:#22c55e">'+normal+'</div></div>'+
    '<div class="card" style="cursor:pointer;border-left:3px solid #f59e0b" onclick="$(\'fAceEst\').value=\'PRECAUCION\';window._pag.ace=1;renders.ace()"><div class="card-t">🟡 Precaución</div><div class="card-v" style="color:#f59e0b">'+precaucion+'</div></div>'+
    '<div class="card" style="cursor:pointer;border-left:3px solid #ef4444" onclick="$(\'fAceEst\').value=\'ALERTA\';window._pag.ace=1;renders.ace()"><div class="card-t">🔴 Alerta</div><div class="card-v" style="color:#ef4444">'+alerta+'</div></div>'+
    '<div class="card" style="cursor:pointer" onclick="$(\'fAceEst\').value=\'\';window._pag.ace=1;renders.ace()"><div class="card-t">Total</div><div class="card-v">'+ace.length+'</div></div>'+
    '</div>'+

    '<div id="aceDashHolder"></div>'+

    '<div class="toolbar">'+
    '<select id="fAceEq" onchange="window._pag.ace=1;renders.ace()"><option value="">Todos equipos</option>'+
    allSiglas.map(function(s){return'<option'+(fEq===s?' selected':'')+'>'+s+'</option>'}).join('')+'</select>'+
    '<select id="fAceEst" onchange="window._pag.ace=1;renders.ace()"><option value="">Todo estado</option>'+
    '<option'+(fEst==='NORMAL'?' selected':'')+'>NORMAL</option>'+
    '<option'+(fEst==='PRECAUCION'?' selected':'')+'>PRECAUCION</option>'+
    '<option'+(fEst==='ALERTA'?' selected':'')+'>ALERTA</option></select>'+
    '<button class="btn btn-o" style="font-size:11px" onclick="$(\'fAceEq\').value=\'\';$(\'fAceEst\').value=\'\';window._pag.ace=1;renders.ace()">Limpiar</button>'+
    '</div>'+
    _pagHTML('ace',pg)+

    '<div class="tbl-wrap"><table>'+
    '<tr><th>Fecha</th><th>Equipo</th><th>Componente</th><th>Descriptor</th><th>Lubricante</th><th>Hrs</th>'+
    '<th>Fe</th><th>Cu</th><th>Pb</th><th>Al</th><th>Si</th><th>Cr</th>'+
    '<th>Visc</th><th>PQ</th><th>TBN</th><th>ISO</th><th>Estado <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Obs <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th></th></tr>'+
    pg.items.map(function(m,fi){
      var idx=ace.indexOf(m);
      var estCol=m.estado==='ALERTA'?'var(--danger)':m.estado==='PRECAUCION'?'var(--w)':'var(--ok)';
      var bg=m.estado==='ALERTA'?'background:rgba(239,68,68,.06)':m.estado==='PRECAUCION'?'background:rgba(245,158,11,.04)':'';
      // Highlight high metals
      function metalCell(v,lim){
        var n=parseFloat(v);if(isNaN(n))return'<td style="font-size:10px;color:var(--tx3)">—</td>';
        var c=n>lim*2?'var(--danger)':n>lim?'var(--w)':'var(--tx3)';
        return'<td style="font-size:10px;font-weight:'+(n>lim?'700':'400')+';color:'+c+'">'+n+'</td>';
      }
      return'<tr style="'+bg+'">'+
        '<td style="font-size:10px">'+m.fecha+'</td>'+
        '<td class="mono" style="font-size:10px;color:var(--ac)">'+(m._sigla||'')+'</td>'+
        '<td style="font-size:9px">'+escapeHtml(m.componente||'')+'</td>'+
        '<td style="font-size:10px">'+escapeHtml(m.descriptor||'')+'</td>'+
        '<td style="font-size:9px;max-width:100px">'+escapeHtml(m.lubricante||'')+'</td>'+
        '<td style="font-size:10px;text-align:center">'+(m.hrsComp||'')+'</td>'+
        metalCell(m.hierro,50)+metalCell(m.cobre,30)+metalCell(m.plomo,20)+
        metalCell(m.aluminio,20)+metalCell(m.silicio,25)+metalCell(m.cromo,10)+
        '<td style="font-size:10px;text-align:center">'+(m.visc40||m.visc100||'')+'</td>'+
        '<td style="font-size:10px;text-align:center">'+(m.pq||'')+'</td>'+
        '<td style="font-size:10px;text-align:center">'+(m.tbn||'')+'</td>'+
        '<td style="font-size:9px">'+(m.isoCode||'')+'</td>'+
        '<td><select onchange="edAce('+idx+',\'estado\',this.value)" style="font-size:10px;'+is+';color:'+estCol+';font-weight:600">'+
        '<option'+(m.estado==='NORMAL'?' selected':'')+'>NORMAL</option>'+
        '<option'+(m.estado==='PRECAUCION'?' selected':'')+'>PRECAUCION</option>'+
        '<option'+(m.estado==='ALERTA'?' selected':'')+'>ALERTA</option></select></td>'+
        '<td><input value="'+escapeHtml(m.comentario||'')+'" onchange="edAce('+idx+',\'comentario\',this.value)" style="width:80px;'+is+'" placeholder="..."></td>'+
        '<td><button class="btn-s btn-d" onclick="delAce('+idx+')" title="Eliminar"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg></button></td></tr>';
    }).join('')+
    '</table></div>'+
    _pagHTML('ace',pg);

  renderAceDash(ace);
};

// ═══ DASHBOARD VISUAL DE ACEITE (estilo reporte Mobil Assistance) ═══
// Usa el campo ESTADO ya asignado por el laboratorio en cada muestra real — no inventa umbrales.
function renderAceDash(ace){
  var holder=document.getElementById('aceDashHolder');
  if(!holder)return;
  var eq=S.g('eq')||[];
  var eqBySigla={};
  eq.forEach(function(e){eqBySigla[e.sigla]=e;});

  var normal=ace.filter(function(m){return m.estado==='NORMAL';}).length;
  var precaucion=ace.filter(function(m){return m.estado==='PRECAUCION';}).length;
  var alerta=ace.filter(function(m){return m.estado==='ALERTA';}).length;
  var total=ace.length||1;

  // ── Torta SVG Normal/Precaución/Alerta ──
  function arcoPath(cx,cy,r,startAngle,endAngle){
    var x1=cx+r*Math.cos(startAngle),y1=cy+r*Math.sin(startAngle);
    var x2=cx+r*Math.cos(endAngle),y2=cy+r*Math.sin(endAngle);
    var largeArc=(endAngle-startAngle)>Math.PI?1:0;
    return'M'+cx+','+cy+' L'+x1+','+y1+' A'+r+','+r+' 0 '+largeArc+' 1 '+x2+','+y2+' Z';
  }
  var datos=[{v:normal,c:'#22c55e',l:'NORMAL'},{v:precaucion,c:'#eab308',l:'PRECAUCIÓN'},{v:alerta,c:'#ef4444',l:'ALERTA'}];
  var ang=-Math.PI/2,svgSlices='';
  datos.forEach(function(d){
    if(d.v===0)return;
    var slice=d.v/total*Math.PI*2;
    var tipTxt=d.l+': '+d.v+' ('+Math.round(d.v/total*1000)/10+'%)';
    svgSlices+='<path d="'+arcoPath(110,110,100,ang,ang+slice)+'" fill="'+d.c+'" style="cursor:default" onmouseenter="vizTip(event,\''+tipTxt+'\')" onmousemove="vizTipMove(event)" onmouseleave="vizTipHide()"></path>';
    ang+=slice;
  });

  // ── Muestras mensuales (últimos 12 meses con datos) ──
  function parseFechaAce(f){
    if(!f)return null;
    var m=String(f).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m)return m[1]+'-'+m[2];
    var m2=String(f).match(/^(\d{2})-(\d{2})-(\d{4})/);
    if(m2)return m2[3]+'-'+m2[2];
    return null;
  }
  var porMes={};
  ace.forEach(function(m){var k=parseFechaAce(m.fecha);if(k)porMes[k]=(porMes[k]||0)+1;});
  var mesesKeys=Object.keys(porMes).sort();
  var maxMes=Math.max.apply(null,mesesKeys.map(function(k){return porMes[k];}).concat([1]));

  // ── Estado por tipo de equipo ──
  var porTipoEq={};
  ace.forEach(function(m){
    var e=eqBySigla[m._sigla];
    var tipo=e?e.tipo:'SIN EQUIPO';
    if(!porTipoEq[tipo])porTipoEq[tipo]={n:0,a:0,p:0,norm:0};
    porTipoEq[tipo].n++;
    if(m.estado==='ALERTA')porTipoEq[tipo].a++;
    else if(m.estado==='PRECAUCION')porTipoEq[tipo].p++;
    else porTipoEq[tipo].norm++;
  });
  var tiposOrdenados=Object.keys(porTipoEq).sort(function(a,b){return porTipoEq[b].n-porTipoEq[a].n;});

  // ── Estado por tipo de componente (descriptor) ──
  var porComp={};
  ace.forEach(function(m){
    var c=(m.descriptor||'SIN INFORMACION').toUpperCase().trim();
    if(!porComp[c])porComp[c]={n:0,a:0,p:0,norm:0};
    porComp[c].n++;
    if(m.estado==='ALERTA')porComp[c].a++;
    else if(m.estado==='PRECAUCION')porComp[c].p++;
    else porComp[c].norm++;
  });
  var compOrdenados=Object.keys(porComp).sort(function(a,b){return porComp[b].n-porComp[a].n;});

  // ── Estado por lubricante ──
  var porLub={};
  ace.forEach(function(m){
    var l=(m.lubricante||'SIN ESPECIFICAR').toUpperCase().trim();
    if(!porLub[l])porLub[l]={n:0,a:0,p:0,norm:0};
    porLub[l].n++;
    if(m.estado==='ALERTA')porLub[l].a++;
    else if(m.estado==='PRECAUCION')porLub[l].p++;
    else porLub[l].norm++;
  });
  var lubOrdenados=Object.keys(porLub).sort(function(a,b){return porLub[b].n-porLub[a].n;});

  function barraEstado(item,maxN){
    var pctN=item.n/maxN*100;
    var tipTxt=item.label+': Normal '+item.norm+' · Precaución '+item.p+' · Alerta '+item.a+' (de '+item.n+')';
    return '<div style="display:grid;grid-template-columns:140px 1fr 40px;gap:8px;align-items:center;margin-bottom:5px;font-size:11px">'+
      '<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--tx2)" title="'+escapeHtml(item.label)+'">'+escapeHtml(item.label)+'</div>'+
      '<div style="display:flex;height:16px;border-radius:3px;overflow:hidden;background:var(--bg4);width:'+Math.max(pctN,8)+'%;gap:2px;cursor:default" onmouseenter="vizTip(event,\''+tipTxt+'\')" onmousemove="vizTipMove(event)" onmouseleave="vizTipHide()">'+
      (item.a?'<div style="flex:'+item.a+' 1 0;background:#ef4444"></div>':'')+
      (item.p?'<div style="flex:'+item.p+' 1 0;background:#eab308"></div>':'')+
      (item.norm?'<div style="flex:'+item.norm+' 1 0;background:#22c55e"></div>':'')+
      '</div>'+
      '<div style="text-align:right;color:var(--tx3)">'+item.n+'</div></div>';
  }

  var maxTipo=Math.max.apply(null,tiposOrdenados.map(function(t){return porTipoEq[t].n;}).concat([1]));
  var maxComp=Math.max.apply(null,compOrdenados.map(function(c){return porComp[c].n;}).concat([1]));
  var maxLub=Math.max.apply(null,lubOrdenados.map(function(l){return porLub[l].n;}).concat([1]));

  var html='<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">';

  // Panel 1: Torta estado general
  html+='<div class="chart-box"><div class="chart-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Estado General de la Flota</div>';
  html+='<div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">';
  html+='<svg width="220" height="220" viewBox="0 0 220 220">'+svgSlices+'</svg>';
  html+='<div>';
  datos.forEach(function(d){
    var pct=total?Math.round(d.v/total*1000)/10:0;
    html+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13px">'+
      '<i style="display:inline-block;width:14px;height:14px;border-radius:3px;background:'+d.c+'"></i>'+
      '<span style="color:var(--tx2)">'+d.l+'</span>'+
      '<b style="margin-left:auto;font-family:var(--mono)">'+d.v+'</b>'+
      '<span style="color:var(--tx3);font-size:11px">('+pct+'%)</span></div>';
  });
  html+='</div></div></div>';

  // Panel 2: Muestras mensuales
  html+='<div class="chart-box"><div class="chart-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Muestras Mensuales</div>';
  html+='<div class="bars" style="height:140px">';
  mesesKeys.forEach(function(k){
    var v=porMes[k];
    var h=Math.max(v/maxMes*100,3);
    var label=k.slice(5)+'/'+k.slice(2,4);
    var tipTxt=label+': '+v+' muestras';
    html+='<div class="bar-c"><div class="bar-v">'+v+'</div><div class="bar" style="height:'+h+'%;background:var(--ac);cursor:default" onmouseenter="vizTip(event,\''+tipTxt+'\')" onmousemove="vizTipMove(event)" onmouseleave="vizTipHide()"></div><div class="bar-l">'+label+'</div></div>';
  });
  html+='</div></div>';
  html+='</div>'; // cierre grid 2 columnas

  // Panel 3: Estado por tipo de equipo
  html+='<div class="chart-box"><div class="chart-t"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="4" width="6" height="6"/><line x1="9" y1="10" x2="4" y2="10"/><line x1="4" y1="10" x2="4" y2="13"/><circle cx="5.5" cy="15" r="2.5"/><circle cx="14" cy="15" r="3.5"/><line x1="15" y1="10" x2="15" y2="4"/></svg> Estado por Tipo de Equipo</div>';
  html+=tiposOrdenados.map(function(t){return barraEstado({label:t,n:porTipoEq[t].n,a:porTipoEq[t].a,p:porTipoEq[t].p,norm:porTipoEq[t].norm},maxTipo);}).join('');
  html+='</div>';

  // Panel 4: Estado por tipo de componente
  html+='<div class="chart-box"><div class="chart-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="3.2"/><line x1="10" y1="2" x2="10" y2="4.2"/><line x1="10" y1="15.8" x2="10" y2="18"/><line x1="2" y1="10" x2="4.2" y2="10"/><line x1="15.8" y1="10" x2="18" y2="10"/><line x1="4.8" y1="4.8" x2="6.3" y2="6.3"/><line x1="13.7" y1="13.7" x2="15.2" y2="15.2"/><line x1="4.8" y1="15.2" x2="6.3" y2="13.7"/><line x1="13.7" y1="6.3" x2="15.2" y2="4.8"/></svg> Estado por Tipo de Componente</div>';
  html+=compOrdenados.map(function(c){return barraEstado({label:c,n:porComp[c].n,a:porComp[c].a,p:porComp[c].p,norm:porComp[c].norm},maxComp);}).join('');
  html+='</div>';

  // Panel 5: Estado por lubricante
  html+='<div class="chart-box"><div class="chart-t"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="5" y="3" width="10" height="14" rx="2"/><line x1="5" y1="7" x2="15" y2="7"/><line x1="5" y1="13" x2="15" y2="13"/></svg>️ Estado por Lubricante</div>';
  html+=lubOrdenados.map(function(l){return barraEstado({label:l,n:porLub[l].n,a:porLub[l].a,p:porLub[l].p,norm:porLub[l].norm},maxLub);}).join('');
  html+='</div>';

  html+='<div class="legend" style="margin-top:4px"><i style="background:#22c55e"></i>Normal &nbsp; <i style="background:#eab308"></i>Precaución &nbsp; <i style="background:#ef4444"></i>Alerta</div>';

  holder.innerHTML=html;
}

window.edAce=function(i,key,val){
  var ace=S.g('aceite')||[];
  if(_edCampo('aceite',ace,i,key,val)){refreshAll();toast('✅ Guardado');}
};
window.delAce=function(i){
  if(!confirm('¿Eliminar muestra?'))return;
  var ace=S.g('aceite')||[];_moverAPapelera('aceite',ace[i]);ace.splice(i,1);S.s('aceite',ace);refreshAll();toast('🗑️ Eliminada');
};

// Mapa de columnas del CSV de laboratorio COPEC -> campos internos del sistema.
// Soporta tanto encabezados cortos (legacy) como los encabezados reales de COPEC (mayúsculas con guion bajo).
var ACE_COPEC_MAP={
  NOMBRE_CLIENTE:'cliente',NOMBRE_FAENA:'faena',N_MUESTRA:'nMuestra',N_FRASCO:'nFrasco',
  FECHA_MUESTREO:'fecha',FECHA_SOLICITUD:'fechaSolicitud',FECHA_INGRESO:'fechaIngreso',FECHA_INFORME:'fechaInforme',
  HORAS_COMPONENTE:'hrsComp',HORAS_LUBRICANTE:'hrsLub',RELLENOS:'rellenos',
  LUBRICANTE:'lubricante',EQUIPO:'equipo',MARCA_COMPONENTE:'marcaComponente',DESCRIPTOR_COMPONENTE:'descriptor',
  VISCOSIDAD_40_C:'visc40',VISCOSIDAD_100_C:'visc100','PUNTO_DE_INFLAMACIÓN':'puntoInflamacion',
  PORCENTAJE_COMBUSTIBLE:'pctCombustible',PQ:'pq',HUMEDAD:'humedad',CONTENIDO_DE_AGUA:'contenidoAgua',
  TBN:'tbn',TAN:'tan',HOLLIN:'hollin',OXIDACION:'oxidacion',NITRACION:'nitracion',
  HIERRO:'hierro',COBRE:'cobre',PLOMO:'plomo',ALUMINIO:'aluminio',ESTANO:'estano',PLATA:'plata',
  CROMO:'cromo',NIQUEL:'niquel',MOLIBDENO:'molibdeno',TITANIO:'titanio',SILICIO:'silicio',
  SODIO:'sodio',POTASIO:'potasio',BORO:'boro',VANADIO:'vanadio',MAGNESIO:'magnesio',
  CALCIO:'calcio',FOSFORO:'fosforo',CINC:'cinc',BARIO:'bario',
  PARTICULAS_4_MICRAS:'part4u',PARTICULAS_6_MICRAS:'part6u',PARTICULAS_14_MICRAS:'part14u',
  PARTICULAS_25_MICRAS:'part25u',PARTICULAS_50_MICRAS:'part50u',PARTICULAS_100_MICRAS:'part100u',
  CODIGO_ISO:'isoCode',ULTRACENTRIFUGADO:'ultracentrifugado',TEST_DE_PARCHE:'testParche',
  AIR_RELEASE:'airRelease',RULER_NUMBER:'ruler',AMINAS:'aminas',FENOLES:'fenoles',RPVOT:'rpvot',
  ESPUMACION_TENDENCIA_1:'espTend1',ESPUMACION_TENDENCIA_2:'espTend2',ESPUMACION_TENDENCIA_3:'espTend3',
  ESPUMACION_ESTABILIDAD_1:'espEst1',ESPUMACION_ESTABILIDAD_2:'espEst2',ESPUMACION_ESTABILIDAD_3:'espEst3',
  DEMULSIBILIDAD:'demulsibilidad',ESTADO:'estado',COMENTARIO:'comentario',
  // Legacy / nombres cortos ya soportados antes — se mantienen por compatibilidad
  nMuestra:'nMuestra',fecha:'fecha',hrsComp:'hrsComp',hrsLub:'hrsLub',lubricante:'lubricante',
  componente:'componente',descriptor:'descriptor',hierro:'hierro',cobre:'cobre',plomo:'plomo',
  aluminio:'aluminio',silicio:'silicio',cromo:'cromo',sodio:'sodio',visc40:'visc40',visc100:'visc100',
  pq:'pq',tbn:'tbn',tan:'tan',isoCode:'isoCode',estado:'estado',comentario:'comentario',equipo:'equipo'
};
// Convierte fecha DD-MM-YYYY (formato COPEC) a YYYY-MM-DD si corresponde; si no calza, deja el valor tal cual.
function aceNormFecha(v){
  if(!v)return'';
  var m=String(v).match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if(m)return m[3]+'-'+m[2]+'-'+m[1];
  return v;
}
// Parser CSV simple que respeta comas dentro de comillas dobles (los comentarios de COPEC suelen traerlas)
function aceParseCSVLine(line){
  var out=[],cur='',inQ=false;
  for(var i=0;i<line.length;i++){
    var c=line[i];
    if(c==='"'){
      if(inQ&&line[i+1]==='"'){cur+='"';i++;}
      else inQ=!inQ;
    }else if(c===','&&!inQ){
      out.push(cur);cur='';
    }else{
      cur+=c;
    }
  }
  out.push(cur);
  return out.map(function(v){return v.trim();});
}
window.importAceite=function(){
  sm('<h3><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar Muestras de Aceite (CSV)</h3>'+
    '<p style="font-size:12px;color:var(--tx3)">Acepta el CSV exportado directamente del laboratorio COPEC (encabezados tipo NOMBRE_CLIENTE, EQUIPO, HIERRO, ESTADO, COMENTARIO, etc.) o el formato corto anterior (nMuestra, fecha, hierro...). Detecta automáticamente cuál es.</p>'+
    '<input type="file" id="aceFile" accept=".csv" style="margin:12px 0"><br>'+
    '<div style="margin:8px 0"><label><input type="checkbox" id="aceReplace"> Reemplazar todo</label></div>'+
    '<button class="btn" onclick="processAceCSV()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Procesar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
};
window.processAceCSV=function(){
  var file=$('aceFile')?.files[0];
  if(!file)return toast('⚠️ Selecciona archivo');
  var replace=$('aceReplace')?.checked||false;
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var lines=e.target.result.split('\n').filter(function(l){return l.trim();});
      var headers=aceParseCSVLine(lines[0]).map(function(h){return h.trim().replace(/^\uFEFF/,'');});
      var ace=replace?[]:S.g('aceite')||[];
      var added=0,omitidas=0;
      for(var i=1;i<lines.length;i++){
        var vals=aceParseCSVLine(lines[i]);
        var raw={};
        headers.forEach(function(h,j){raw[h]=vals[j]!==undefined?vals[j]:'';});
        // Si la fila no trae ningún metal/estado relevante (filas vacías típicas de export Excel), se omite.
        if(!raw.HIERRO&&!raw.hierro&&!raw.ESTADO&&!raw.estado&&!raw.N_MUESTRA&&!raw.nMuestra){omitidas++;continue;}
        var row={};
        Object.keys(raw).forEach(function(h){
          var key=ACE_COPEC_MAP[h];
          if(key)row[key]=raw[h];
        });
        ace.push({
          nMuestra:row.nMuestra||'',nFrasco:row.nFrasco||'',
          cliente:row.cliente||'',faena:row.faena||'',
          fecha:aceNormFecha(row.fecha)||'',
          fechaSolicitud:aceNormFecha(row.fechaSolicitud)||'',
          fechaIngreso:aceNormFecha(row.fechaIngreso)||'',
          fechaInforme:aceNormFecha(row.fechaInforme)||'',
          hrsComp:row.hrsComp||'',hrsLub:row.hrsLub||'',rellenos:row.rellenos||'',
          lubricante:row.lubricante||'',
          equipo:row.equipo||'',
          marcaComponente:row.marcaComponente||'',
          componente:row.componente||row.equipo||'',
          descriptor:row.descriptor||'',
          visc40:row.visc40||'',visc100:row.visc100||'',
          puntoInflamacion:row.puntoInflamacion||'',pctCombustible:row.pctCombustible||'',
          pq:row.pq||'',humedad:row.humedad||'',contenidoAgua:row.contenidoAgua||'',
          tbn:row.tbn||'',tan:row.tan||'',hollin:row.hollin||'',oxidacion:row.oxidacion||'',nitracion:row.nitracion||'',
          hierro:row.hierro||'',cobre:row.cobre||'',plomo:row.plomo||'',aluminio:row.aluminio||'',
          estano:row.estano||'',plata:row.plata||'',cromo:row.cromo||'',niquel:row.niquel||'',
          molibdeno:row.molibdeno||'',titanio:row.titanio||'',silicio:row.silicio||'',sodio:row.sodio||'',
          potasio:row.potasio||'',boro:row.boro||'',vanadio:row.vanadio||'',magnesio:row.magnesio||'',
          calcio:row.calcio||'',fosforo:row.fosforo||'',cinc:row.cinc||'',bario:row.bario||'',
          part4u:row.part4u||'',part6u:row.part6u||'',part14u:row.part14u||'',
          part25u:row.part25u||'',part50u:row.part50u||'',part100u:row.part100u||'',
          isoCode:row.isoCode||'',ultracentrifugado:row.ultracentrifugado||'',testParche:row.testParche||'',
          airRelease:row.airRelease||'',ruler:row.ruler||'',aminas:row.aminas||'',fenoles:row.fenoles||'',rpvot:row.rpvot||'',
          espTend1:row.espTend1||'',espTend2:row.espTend2||'',espTend3:row.espTend3||'',
          espEst1:row.espEst1||'',espEst2:row.espEst2||'',espEst3:row.espEst3||'',
          demulsibilidad:row.demulsibilidad||'',
          estado:(row.estado||'NORMAL').toUpperCase(),
          comentario:row.comentario||''
        });
        added++;
      }
      S.s('aceite',ace);cm();refreshAll();
      toast('✅ '+added+' muestras importadas'+(omitidas?' ('+omitidas+' filas vacías omitidas)':''));
    }catch(err){toast('❌ Error: '+err.message);}
  };
  reader.readAsText(file);
};

window.addAceite=function(){
  var eq=S.g('eq')||[];
  sm('<h3><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="2" x2="8" y2="8"/><line x1="12" y1="2" x2="12" y2="8"/><line x1="6.5" y1="2" x2="13.5" y2="2"/><polygon points="8,8 12,8 16,17 4,17"/><line x1="6" y1="13" x2="14" y2="13"/></svg> Nueva Muestra de Aceite</h3>'+
    '<div class="form-row"><div class="fg"><label>Equipo</label><select id="aEq">'+
    eq.map(function(e){return'<option>'+escapeHtml(e.sigla)+'</option>'}).join('')+'</select></div>'+
    '<div class="fg"><label>Componente</label><select id="aComp"><option>Motor</option><option>Transmisión</option><option>Hidráulico</option><option>Diferencial</option><option>Mando Final</option><option>Frenos</option></select></div>'+
    '<div class="fg"><label>Fecha</label><input type="date" id="aFec" value="'+new Date().toISOString().slice(0,10)+'"></div></div>'+
    '<div class="form-row"><div class="fg"><label>Lubricante</label><input id="aLub"></div>'+
    '<div class="fg"><label>Hrs Componente</label><input type="number" id="aHrs"></div></div>'+
    '<div class="form-row"><div class="fg"><label>Fe (Hierro)</label><input type="number" id="aFe" step="0.1"></div>'+
    '<div class="fg"><label>Cu (Cobre)</label><input type="number" id="aCu" step="0.1"></div>'+
    '<div class="fg"><label>Pb (Plomo)</label><input type="number" id="aPb" step="0.1"></div>'+
    '<div class="fg"><label>Al (Aluminio)</label><input type="number" id="aAl" step="0.1"></div>'+
    '<div class="fg"><label>Si (Silicio)</label><input type="number" id="aSi" step="0.1"></div>'+
    '<div class="fg"><label>Cr (Cromo)</label><input type="number" id="aCr" step="0.1"></div></div>'+
    '<div class="form-row"><div class="fg"><label>PQ</label><input type="number" id="aPQ"></div>'+
    '<div class="fg"><label>TBN</label><input type="number" id="aTBN" step="0.1"></div>'+
    '<div class="fg"><label>Estado</label><select id="aEstado"><option>NORMAL</option><option>PRECAUCION</option><option>ALERTA</option></select></div></div>'+
    '<div class="form-row"><div class="fg" style="flex:1"><label>Comentario</label><input id="aObs" style="width:100%"></div></div>'+
    '<button class="btn" onclick="saveAceite()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
};
window.saveAceite=function(){
  var ace=S.g('aceite')||[];
  ace.push({
    nMuestra:'M-'+Date.now(),fecha:$('aFec').value,
    componente:$('aEq').value+'-'+$('aComp').value.substring(0,3).toUpperCase(),
    descriptor:$('aComp').value,lubricante:$('aLub').value,
    hrsComp:$('aHrs').value,
    hierro:$('aFe').value,cobre:$('aCu').value,plomo:$('aPb').value,
    aluminio:$('aAl').value,silicio:$('aSi').value,cromo:$('aCr').value,
    pq:$('aPQ').value,tbn:$('aTBN').value,
    estado:$('aEstado').value,comentario:$('aObs').value
  });
  S.s('aceite',ace);cm();refreshAll();
  toast('✅ Muestra guardada');
};
