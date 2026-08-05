// ═══════════════════════════════════════════════════════════════
// HISTORIAL DE HORÓMETROS
// edHist/delHist/addHist/saveHist (con sus helpers _horomDeLectura/
// recalcularHorometroDesdeHistorial) vivían lejos, en la sección de
// utilidades genéricas al final del archivo. importHorom/processImportHorom
// vivían junto a los otros importadores CSV (OT, Neumáticos), dentro de lo
// que será el futuro cfg.js. Se juntan acá porque solo los usa esta pestaña.
// ═══════════════════════════════════════════════════════════════
// ---- HISTORIAL ----
window.renderHist=function(){
  var h=S.g('hist')||[];
  var eq=S.g('eq')||[];
  var fEq=$('fHistEq')?.value||'';
  var fVista=$('fHistVista')?.value||'todo';
  var fMes=$('fHistMes')?.value||'';

  // Get unique equipos and months
  var siglas=[...new Set(h.map(function(r){return r.sigla}))].sort();
  var meses=[...new Set(h.map(function(r){return(r.fecha||'').slice(0,7)}))].filter(function(m){return m&&m.length>=7}).sort().reverse();

  // Filter
  var fil=h.filter(function(r){
    if(fEq&&r.sigla!==fEq)return false;
    if(fMes&&(r.fecha||'').slice(0,7)!==fMes)return false;
    return true;
  });

  var content='';

  if(fVista==='todo'){
    // Vista tabla completa
    var histOrdenado=fil.slice().reverse();
    var pgHist=_pagSlice('hist',histOrdenado);
    content=
    _pagHTML('hist',pgHist)+
    '<div class="tbl-wrap"><table>'+
    '<tr><th>#</th><th>Equipo</th><th>Fecha</th><th>Hrm Inicial</th><th>Hrm Final</th><th>Hrs Operadas</th><th></th></tr>'+
    pgHist.items.map(function(r,i){
      var idx=h.indexOf(r);
      var hrsOp=(r.horomFin&&r.horomIni)?r.horomFin-r.horomIni:(r.horom||0);
      return'<tr>'+
        '<td class="mono" style="font-size:10px;color:var(--tx3)">'+(histOrdenado.length-((pgHist.page-1)*_PAG_SIZE)-i)+'</td>'+
        '<td class="mono ed" style="color:var(--ac)" contenteditable onblur="edHist('+idx+',\'sigla\',this.innerText.trim())">'+escapeHtml(r.sigla)+'</td>'+
        '<td class="mono ed" contenteditable onblur="edHist('+idx+',\'fecha\',this.innerText.trim())">'+r.fecha+'</td>'+
        '<td class="mono ed" contenteditable onblur="edHist('+idx+',\'horomIni\',parseFloat(this.innerText)||0)">'+(r.horomIni||r.horom||0)+'</td>'+
        '<td class="mono ed" contenteditable onblur="edHist('+idx+',\'horomFin\',parseFloat(this.innerText)||0);edHist('+idx+',\'horom\',parseFloat(this.innerText)||0)">'+(r.horomFin||r.horom||0)+'</td>'+
        '<td class="mono">'+hrsOp+'</td>'+
        '<td><button class="btn-x" onclick="delHist('+idx+')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg></button></td></tr>';
    }).join('')+
    '</table></div>'+
    _pagHTML('hist',pgHist);

  } else if(fVista==='diario'){
    // Vista diaria - último horómetro por equipo por día
    var eqFil=fEq?eq.filter(function(e){return e.sigla===fEq}):eq;
    var fechas=[...new Set(fil.map(function(r){return r.fecha}))].filter(function(f){return f}).sort().reverse().slice(0,31);
    content=
    '<div class="tbl-wrap" style="overflow-x:auto"><table>'+
    '<tr><th>Equipo</th>'+fechas.map(function(f){return'<th style="font-size:9px;writing-mode:vertical-lr;min-width:30px">'+f.slice(5)+'</th>'}).join('')+'</tr>'+
    eqFil.map(function(e){
      return'<tr><td class="mono" style="color:var(--ac)">'+escapeHtml(e.sigla)+'</td>'+
        fechas.map(function(f){
          var lectura=fil.filter(function(r){return r.sigla===e.sigla&&r.fecha===f});
          var val=lectura.length?lectura[lectura.length-1].horomFin||lectura[lectura.length-1].horom||0:0;
          return'<td class="mono" style="font-size:9px;text-align:center">'+(val||'—')+'</td>';
        }).join('')+'</tr>';
    }).join('')+
    '</table></div>';

  } else if(fVista==='semanal'){
    // Vista semanal - promedio hrs operadas por semana
    var eqFil=fEq?eq.filter(function(e){return e.sigla===fEq}):eq;
    var weeks={};
    fil.forEach(function(r){
      if(!r.fecha)return;
      var d=new Date(r.fecha);var w=r.fecha.slice(0,7)+'-S'+Math.ceil(d.getDate()/7);
      if(!weeks[w])weeks[w]=[];weeks[w].push(r);
    });
    var wKeys=Object.keys(weeks).sort().reverse().slice(0,12);
    content=
    '<div class="tbl-wrap"><table>'+
    '<tr><th>Equipo</th>'+wKeys.map(function(w){return'<th style="font-size:10px">'+w+'</th>'}).join('')+'</tr>'+
    eqFil.map(function(e){
      return'<tr><td class="mono" style="color:var(--ac)">'+escapeHtml(e.sigla)+'</td>'+
        wKeys.map(function(w){
          var lecturas=weeks[w].filter(function(r){return r.sigla===e.sigla});
          if(!lecturas.length)return'<td style="color:var(--tx3);text-align:center">—</td>';
          var maxH=Math.max.apply(null,lecturas.map(function(r){return r.horomFin||r.horom||0}));
          return'<td class="mono" style="text-align:center">'+maxH+'</td>';
        }).join('')+'</tr>';
    }).join('')+
    '</table></div>';

  } else if(fVista==='mensual'){
    // Vista mensual - horómetro máximo por equipo por mes
    var eqFil=fEq?eq.filter(function(e){return e.sigla===fEq}):eq;
    var mesesVista=meses.slice(0,12);
    content=
    '<div class="tbl-wrap"><table>'+
    '<tr><th>Equipo</th><th>Tipo</th>'+mesesVista.map(function(m){return'<th>'+m+'</th>'}).join('')+'<th>Actual</th></tr>'+
    eqFil.map(function(e){
      return'<tr><td class="mono" style="color:var(--ac)">'+escapeHtml(e.sigla)+'</td><td style="font-size:10px">'+escapeHtml(e.tipo)+'</td>'+
        mesesVista.map(function(m){
          var lecturas=h.filter(function(r){return r.sigla===e.sigla&&(r.fecha||'').slice(0,7)===m});
          if(!lecturas.length)return'<td style="color:var(--tx3);text-align:center">—</td>';
          var maxH=Math.max.apply(null,lecturas.map(function(r){return r.horomFin||r.horom||0}));
          return'<td class="mono" style="text-align:center">'+maxH+'</td>';
        }).join('')+
        '<td class="mono" style="font-weight:700;color:var(--ac)">'+e.horomActual+'</td></tr>';
    }).join('')+
    '</table></div>';

  } else if(fVista==='anual'){
    // Vista anual
    var eqFil=fEq?eq.filter(function(e){return e.sigla===fEq}):eq;
    var years=[...new Set(h.map(function(r){return(r.fecha||'').slice(0,4)}))].filter(function(y){return y&&y.length===4}).sort();
    var MSN=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
    var fAnio=$('fHistAnio')?.value||years[years.length-1]||'2026';
    content=
    '<div class="toolbar"><select id="fHistAnio" onchange="renders.hist()">'+years.map(function(y){return'<option'+(fAnio===y?' selected':'')+'>'+y+'</option>'}).join('')+'</select></div>'+
    '<div class="tbl-wrap"><table>'+
    '<tr><th>Equipo</th>'+MSN.map(function(m){return'<th>'+m+'</th>'}).join('')+'</tr>'+
    eqFil.map(function(e){
      return'<tr><td class="mono" style="color:var(--ac)">'+escapeHtml(e.sigla)+'</td>'+
        MSN.map(function(m,mi){
          var mes=fAnio+'-'+('0'+(mi+1)).slice(-2);
          var lecturas=h.filter(function(r){return r.sigla===e.sigla&&(r.fecha||'').slice(0,7)===mes});
          if(!lecturas.length)return'<td style="color:var(--tx3);text-align:center;font-size:10px">—</td>';
          var maxH=Math.max.apply(null,lecturas.map(function(r){return r.horomFin||r.horom||0}));
          return'<td class="mono" style="text-align:center;font-size:10px">'+maxH+'</td>';
        }).join('')+'</tr>';
    }).join('')+
    '</table></div>';
  }

  // Stats
  var totalLecturas=fil.length;
  var eqsConDatos=[...new Set(fil.map(function(r){return r.sigla}))].length;

  $('s-hist').innerHTML=
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,15 8,10 11,13 17,4"/><polyline points="12,4 17,4 17,9"/></svg> Historial de Horómetros</div>'+
    '<div class="sec-s">'+h.length+' lecturas totales · '+eqsConDatos+' equipos con datos</div></div>'+
    '<div style="display:flex;gap:8px">'+
    '<button class="btn" onclick="addHist()">+ Registrar</button>'+
    '<button class="btn btn-o" onclick="importHorom()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar CSV</button>'+
    '<button class="btn btn-o" onclick="exportCSV(\'hist\')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> CSV</button></div></div>'+
    '<div class="toolbar">'+
    '<select id="fHistVista" onchange="window._pag.hist=1;renders.hist()">'+
    '<option value="todo"'+(fVista==='todo'?' selected':'')+'><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Todas las Lecturas</option>'+
    '<option value="diario"'+(fVista==='diario'?' selected':'')+'><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Diario</option>'+
    '<option value="semanal"'+(fVista==='semanal'?' selected':'')+'><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Semanal</option>'+
    '<option value="mensual"'+(fVista==='mensual'?' selected':'')+'><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Mensual</option>'+
    '<option value="anual"'+(fVista==='anual'?' selected':'')+'><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Anual</option>'+
    '</select>'+
    '<select id="fHistEq" onchange="window._pag.hist=1;renders.hist()"><option value="">Todos los equipos</option>'+
    siglas.map(function(s){return'<option'+(fEq===s?' selected':'')+'>'+s+'</option>'}).join('')+'</select>'+
    '<select id="fHistMes" onchange="window._pag.hist=1;renders.hist()"><option value="">Todos los meses</option>'+
    meses.map(function(m){return'<option'+(fMes===m?' selected':'')+'>'+m+'</option>'}).join('')+'</select>'+
    '</div>'+
    content;
};

window.importHorom=function(){
  sm('<h3><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar Horómetros</h3>'+
    '<p style="font-size:12px;color:var(--tx3)">CSV con columnas: sigla, fecha, horometro<br>El sistema actualiza automáticamente cada equipo.</p>'+
    '<input type="file" id="horomFile" accept=".csv,.json" style="margin:12px 0">'+
    '<br><button class="btn" onclick="processImportHorom()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Procesar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
};
window.processImportHorom=function(){
  var file=$('horomFile')?.files[0];
  if(!file)return toast('⚠️ Selecciona un archivo');
  var reader=new FileReader();
  reader.onload=function(e){
    var eq=S.g('eq')||[];
    var hist=S.g('hist')||[];
    var txt=e.target.result.replace(/^\uFEFF/,'');
    var nuevas=0,dup=0,sinEq=0,updated=0;
    var equiposNoExisten={};
    try{
      var lines=txt.split('\n').filter(function(l){return l.replace(/\r/g,'').trim().length>3;});
      var sep=lines[0].includes(';')?';':lines[0].includes('\t')?'\t':',';
      var hdr=lines[0].split(sep).map(function(h){return h.replace(/\r/g,'').replace(/"/g,'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x00-\x7F]/g,'');});
      function ci(names){for(var n=0;n<names.length;n++){for(var j=0;j<hdr.length;j++){if(hdr[j].indexOf(names[n])>=0)return j;}}return -1;}
      var iSigla=ci(['sigla interna','cod eq','sigla','equipo']);
      var iFecha=ci(['fecha']);
      var iTurno=ci(['turno']);
      var iInicial=ci(['h. inicial','inicial','horom_ini']);
      var iFinal=ci(['h. final','final','horometro','horom']);
      function gv(vals,idx){return idx>=0&&idx<vals.length?vals[idx].replace(/"/g,'').replace(/\r/g,'').trim():'';}
      function parseFecha(f){
        if(!f)return '';
        var m=f.match(/(\d{1,2})-(\d{1,2})-(\d{2,4})/);
        if(m){var y=m[3].length===2?'20'+m[3]:m[3];return y+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[1]).slice(-2);}
        var meses={ene:'01',feb:'02',mar:'03',abr:'04',may:'05',jun:'06',jul:'07',ago:'08',sep:'09',oct:'10',nov:'11',dic:'12'};
        var m2=f.match(/(\d{1,2})[-\/](\w{3})/i);
        if(m2){var mesNum=meses[m2[2].toLowerCase()];if(mesNum)return(new Date().getFullYear())+'-'+mesNum+'-'+('0'+m2[1]).slice(-2);}
        return f;
      }
      // Índice de lecturas ya existentes para no duplicar. La clave NO incluye turno:
      // la tabla historial_horometros no persiste 'turno', así que la misma lectura
      // importada con turno distinto (Día vs '') quedaba como dos filas idénticas en la
      // base — ese fue el origen de miles de duplicados exactos. Con la clave por
      // sigla|fecha|horomFin, una lectura con el mismo horómetro final del mismo día no
      // se vuelve a insertar aunque cambie el turno del CSV.
      var existentes={};
      hist.forEach(function(h){existentes[(h.sigla||'')+'|'+(h.fecha||'')+'|'+(h.horomFin||h.horom||'')]=true;});
      var siglasValidas={};eq.forEach(function(x){siglasValidas[x.sigla]=true;});

      for(var i=1;i<lines.length;i++){
        var vals=lines[i].split(sep);
        if(vals.length<2)continue;
        var sigla=gv(vals,iSigla);
        if(!sigla||sigla.length<2)continue;
        // Equipo que no existe en el sistema → no se carga (ej. MN-92)
        if(!siglasValidas[sigla]){equiposNoExisten[sigla]=true;sinEq++;continue;}
        var fecha=parseFecha(gv(vals,iFecha));
        var turno=gv(vals,iTurno);
        var horomFinal=parseFloat(gv(vals,iFinal).replace(/\./g,'').replace(/,/g,'.'))||0;
        var horomInicial=iInicial>=0?parseFloat(gv(vals,iInicial).replace(/\./g,'').replace(/,/g,'.'))||0:0;
        var horom=horomFinal||horomInicial;
        if(!horom)continue; // fila sin lectura (reserva, fuera de servicio) se omite
        var clave=sigla+'|'+fecha+'|'+horomFinal;
        if(existentes[clave]){dup++;continue;}
        existentes[clave]=true;
        hist.push({sigla:sigla,fecha:fecha,turno:turno,horom:horom,horomIni:horomInicial,horomFin:horomFinal});
        nuevas++;
      }
      // Recalcular horómetro actual de cada equipo = lectura de FECHA MÁS RECIENTE (no la última cargada)
      var maxPorEq={};
      hist.forEach(function(h){
        var hv=h.horomFin||h.horom||0;if(!hv||!h.fecha)return;
        if(!maxPorEq[h.sigla]||h.fecha>maxPorEq[h.sigla].fecha||(h.fecha===maxPorEq[h.sigla].fecha&&hv>maxPorEq[h.sigla].hv)){
          maxPorEq[h.sigla]={fecha:h.fecha,hv:hv};
        }
      });
      eq.forEach(function(x){
        var mx=maxPorEq[x.sigla];
        if(mx&&mx.hv>(x.horomActual||0)){
          x.horomActual=mx.hv;
          x.fechaHorom=mx.fecha;
          _recalcEq(x);
          updated++;
        }
      });
      S.s('eq',eq);S.s('hist',hist);cm();refreshAll();
      var msg='✅ '+nuevas+' lecturas nuevas · '+updated+' equipos actualizados';
      if(dup)msg+=' · '+dup+' duplicadas omitidas';
      var noEx=Object.keys(equiposNoExisten);
      if(noEx.length)msg+='\n⚠️ '+noEx.length+' equipo(s) no existen y se omitieron: '+noEx.join(', ');
      alert(msg);
    }catch(err){alert('❌ Error: '+err.message);}
  };
  reader.readAsText(file,'UTF-8');
};

window.edHist=function(idx,key,val){
  var h=S.g('hist')||[];
  _edCampo('hist',h,idx,key,val);
  // If editing horom, update equipment too
  if(h[idx]&&(key==='horomFin'||key==='horom')){
    var eq=S.g('eq')||[];
    var eqIdx=eq.findIndex(function(e){return e.sigla===h[idx].sigla});
    if(eqIdx>=0&&val>eq[eqIdx].horomActual){eq[eqIdx].horomActual=val;_recalcEq(eq[eqIdx]);S.s('eq',eq);}
  }
  refreshAll();
};
// Recalcula eq.horomActual como el máximo horomFin/horom del historial restante de esa
// sigla — usado cuando se borra la lectura que había fijado el horómetro actual, para
// que el equipo no quede con un valor "huérfano" que ya no corresponde a ningún registro.
// h.horomFin===0 es un valor legítimo (ej. reset de horómetro tras overhaul) — no
// tratarlo como "ausente" con ||, que lo confundiría con horom o con 0 por defecto.
function _horomDeLectura(h){return h.horomFin!=null?h.horomFin:(h.horom!=null?h.horom:0);}
function recalcularHorometroDesdeHistorial(sigla){
  var hist=(S.g('hist')||[]).filter(function(h){return h.sigla===sigla});
  var eq=S.g('eq')||[];
  var eqIdx=eq.findIndex(function(e){return e.sigla===sigla});
  if(eqIdx<0)return;
  var masReciente=hist.reduce(function(m,h){var v=_horomDeLectura(h);return v>(m?_horomDeLectura(m):-1)?h:m;},null);
  eq[eqIdx].horomActual=masReciente?_horomDeLectura(masReciente):0;
  eq[eqIdx].fechaHorom=masReciente?masReciente.fecha:'';
  _recalcEq(eq[eqIdx]);
  S.s('eq',eq);
}
window.delHist=function(idx){
  if(window._userRole && window._userRole!=='admin'){toast('⛔ Solo un administrador puede eliminar registros');return;}
  var h=S.g('hist')||[];
  if(!h[idx])return;
  var sigla=h[idx].sigla,horomEliminado=_horomDeLectura(h[idx]);
  if(confirm('¿Eliminar lectura de '+sigla+' del '+h[idx].fecha+'?')){
    h.splice(idx,1);S.s('hist',h);
    var eq=S.g('eq')||[];
    var eqIdx=eq.findIndex(function(e){return e.sigla===sigla});
    if(eqIdx>=0 && eq[eqIdx].horomActual===horomEliminado){
      if(confirm('El horómetro actual de '+sigla+' ('+horomEliminado+'h) venía justo de la lectura que eliminaste.\n\n¿Recalcular el horómetro del equipo desde el historial restante?')){
        recalcularHorometroDesdeHistorial(sigla);
      }
    }
    refreshAll();
  }
};
window.addHist=function(){
  var eq=S.g('eq')||[];
  var hoy=new Date().toISOString().slice(0,10);
  sm('<h3><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,15 8,10 11,13 17,4"/><polyline points="12,4 17,4 17,9"/></svg> Registrar Lectura Horómetro</h3>'+
    '<div class="form-row"><div class="fg"><label>Equipo</label><select id="hEq">'+
    eq.map(function(e){return'<option>'+escapeHtml(e.sigla)+'</option>'}).join('')+'</select></div>'+
    '<div class="fg"><label>Fecha</label><input type="date" id="hFecha" value="'+hoy+'"></div></div>'+
    '<div class="form-row"><div class="fg"><label>Horómetro Inicial</label><input type="number" id="hIni" value="0"></div>'+
    '<div class="fg"><label>Horómetro Final</label><input type="number" id="hFin" value="0"></div></div>'+
    '<br><button class="btn" onclick="saveHist()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
};
window.saveHist=function(){
  var sigla=$('hEq').value;
  var fecha=$('hFecha').value;
  var ini=parseFloat($('hIni').value)||0;
  var fin=parseFloat($('hFin').value)||0;
  if(!sigla||!fin)return toast('⚠️ Completa equipo y horómetro final');
  var h=S.g('hist')||[];
  h.push({sigla:sigla,fecha:fecha,horomIni:ini,horomFin:fin,horom:fin});
  S.s('hist',h);
  // Update equipment
  var eq=S.g('eq')||[];
  var eqIdx=eq.findIndex(function(e){return e.sigla===sigla});
  if(eqIdx>=0&&fin>eq[eqIdx].horomActual){eq[eqIdx].horomActual=fin;eq[eqIdx].fechaHorom=fecha;_recalcEq(eq[eqIdx]);S.s('eq',eq);}
  cm();refreshAll();
  toast('✅ Lectura registrada: '+sigla+' = '+fin+'h');
};
