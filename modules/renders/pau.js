// Pestaña Pautas de Mantención — extraída a su propio archivo (Fase 2 de
// modularización). Script plano (NO módulo ES), mismo scope global de
// siempre. GRUPO_PAUTAS/getPautasConsumo/descontarStock/_edCampo quedan en
// index.html — son compartidos también por el flujo de guardado de
// Registro PM (consumo de stock al registrar un PM real) y otras pestañas.
window.renderPau=function(){
  const pau=S.g('pau')||INIT.pautas||[];
  const allEq=(S.g('eq')||[]).map(e=>e.sigla).sort();
  const se=$('fPauEq')?.value||allEq[0]||'';
  const sp=$('fPauPM')?.value||'';
  const fCat=$('fPauCat')?.value||'';
  const siglaRef=GRUPO_PAUTAS[se]||se;
  const pmH={'PM1':['PM1'],'PM2':['PM1','PM2'],'PM3':['PM1','PM2','PM3'],'PM4':['PM1','PM2','PM3','PM4'],'PM5':['PM1','PM2','PM3','PM4'],'PM6':['PM1','PM2','PM3','PM4'],'PM7':['PM1','PM2','PM3','PM4'],'PM8':['PM1','PM2','PM3','PM4'],'PM9':['PM1','PM2','PM3','PM4']};
  const pmList=sp?pmH[sp]||[sp]:[];
  const fil=pau.filter(p=>{
    const pRef=GRUPO_PAUTAS[p.sigla]||p.sigla;
    if(pRef!==siglaRef&&p.sigla!==siglaRef)return false;
    if(sp&&!pmList.includes(p.pm))return false;
    if(fCat&&!(p.cat||'').toLowerCase().includes(fCat.toLowerCase()))return false;
    return true;
  });
  const conRep=fil.filter(p=>p.rep&&p.rep.trim()).length;
  const refPau=pau.find(p=>p.sigla===siglaRef);
  const hoja=refPau?refPau.hoja:'—';
  const pg=_pagSlice('pau',fil);
  $('s-pau').innerHTML=
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Pautas de Mantención</div>'+
    '<div class="sec-s">'+pau.length+' actividades · Hoja: <b>'+escapeHtml(hoja)+'</b> · Ref: '+escapeHtml(siglaRef)+(se!==siglaRef?' (grupo '+escapeHtml(se)+')':'')+'</div></div>'+
    '<button class="btn" onclick="addPauta()">+ Nueva</button></div>'+
    '<div class="toolbar">'+
    '<select id="fPauEq" onchange="window._pag.pau=1;renders.pau()">'+allEq.map(function(e){return'<option'+(e===se?' selected':'')+'>'+escapeHtml(e)+'</option>'}).join('')+'</select>'+
    '<select id="fPauPM" onchange="window._pag.pau=1;renders.pau()"><option value="">Todo PM</option>'+
    '<option value="PM1"'+(sp==='PM1'?' selected':'')+'>PM1 (250h)</option>'+
    '<option value="PM2"'+(sp==='PM2'?' selected':'')+'>PM2 (500h) incl PM1</option>'+
    '<option value="PM3"'+(sp==='PM3'?' selected':'')+'>PM3 (1000h) incl PM1-2</option>'+
    '<option value="PM4"'+(sp==='PM4'?' selected':'')+'>PM4 (2000h) TODOS</option></select>'+
    '<input id="fPauCat" placeholder="Buscar categoría..." value="'+(fCat||'')+'" onchange="window._pag.pau=1;renders.pau()" style="max-width:140px">'+
    '<span style="color:var(--tx3);font-size:12px">'+fil.length+' act · '+conRep+' con repuesto</span></div>'+
    _pagHTML('pau',pg)+
    '<div class="tbl-wrap"><table>'+
    '<tr><th>Hoja</th><th>PM</th><th>Categoría</th><th>Actividad</th><th>Hrs</th><th>Repuesto / Insumo</th><th>Cant</th><th></th></tr>'+
    pg.items.map(function(p){
      var i=pau.indexOf(p);
      var es='background:transparent;border:none;color:var(--tx);font-size:11px;width:100%';
      return'<tr>'+
        '<td style="font-size:11px">'+escapeHtml(p.hoja)+'</td>'+
        '<td><select onchange="edPau('+i+',\'pm\',this.value)" style="font-size:11px;background:var(--bg3);color:var(--tx);border:1px solid var(--bd);border-radius:3px">'+
        ['PM1','PM2','PM3','PM4'].map(function(x){return'<option'+(p.pm===x?' selected':'')+'>'+x+'</option>'}).join('')+'</select></td>'+
        '<td><input value="'+escapeHtml(p.cat||'')+'" onchange="edPau('+i+',\'cat\',this.value)" style="'+es+';max-width:100px" title="Editar categoría"></td>'+
        '<td><input value="'+escapeHtml(p.act||'')+'" onchange="edPau('+i+',\'act\',this.value)" style="'+es+'" title="Editar actividad"></td>'+
        '<td><input type="number" value="'+(p.hrs||0)+'" onchange="edPau('+i+',\'hrs\',parseInt(this.value)||0)" style="width:55px;background:var(--bg3);border:1px solid var(--bd);color:var(--tx);text-align:center;border-radius:3px;font-size:11px"></td>'+
        '<td><input value="'+escapeHtml(p.rep||'')+'" onchange="edPau('+i+',\'rep\',this.value)" style="'+es+';color:var(--ac);font-weight:600;max-width:280px" title="Editar repuesto"></td>'+
        '<td><input type="number" value="'+(p.can||'')+'" onchange="edPau('+i+',\'can\',parseFloat(this.value)||0)" style="width:50px;background:var(--bg3);border:1px solid var(--bd);color:var(--ac);text-align:center;border-radius:3px;font-size:12px;font-weight:600"></td>'+
        '<td><button class="btn-s btn-d" onclick="delPauta('+i+')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg></button></td></tr>';
    }).join('')+
    '</table></div>'+
    _pagHTML('pau',pg);
};
window.edPau=function(i,key,val){
  var pau=S.g('pau')||INIT.pautas||[];
  if(_edCampo('pau',pau,i,key,val)){refreshAll();toast('✅ Guardado');}
};
window.delPauta=function(i){
  if(!confirm('¿Eliminar actividad?'))return;
  var pau=S.g('pau')||INIT.pautas||[];
  _moverAPapelera('pau',pau[i]);
  pau.splice(i,1);S.s('pau',pau);
  refreshAll();
  toast('🗑️ Eliminada');
};
window.addPauta=function(){
  const eq=S.g('eq')||[];
  sm('<h3>Nueva Actividad</h3>'+
    '<div class="form-row"><div class="fg"><label>Equipo</label><select id="pEq">'+eq.map(e=>'<option>'+escapeHtml(e.sigla)+'</option>').join('')+'</select></div>'+
    '<div class="fg"><label>Tipo PM</label><select id="pPM"><option>PM1</option><option>PM2</option><option>PM3</option><option>PM4</option></select></div></div>'+
    '<div class="form-row"><div class="fg"><label>Categoría</label><input id="pCat"></div><div class="fg"><label>Tope Hrs</label><input type="number" id="pHrs"></div></div>'+
    '<div class="form-row"><div class="fg" style="flex:1"><label>Actividad</label><input id="pAct" style="width:100%"></div></div>'+
    '<div class="form-row"><div class="fg" style="flex:1"><label>Repuesto</label><input id="pRep" style="width:100%"></div><div class="fg"><label>Cant</label><input type="number" id="pCant"></div></div>'+
    '<button class="btn" onclick="savePauta()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
};
window.savePauta=function(){
  var pau=S.g('pau')||INIT.pautas||[];
  pau.push({sigla:$('pEq').value,hoja:'Manual',pm:$('pPM').value,cat:$('pCat').value,act:$('pAct').value,hrs:parseInt($('pHrs').value)||0,rep:$('pRep').value,can:parseInt($('pCant').value)||0});
  S.s('pau',pau);
  cm();refreshAll();toast('✅ Actividad agregada');
};
