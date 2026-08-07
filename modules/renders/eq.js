// Pestaña Equipos (Control PM Dinámico) — extraída a su propio archivo (Fase
// 2 de modularización). Script plano (NO módulo ES), mismo scope global de
// siempre. Incluye la Ficha Técnica (editFicha/saveFicha) y su cascada de
// renombre de sigla (_cascadeRenameSigla), que en el monolito vivían lejos
// (cerca del final del archivo) pero solo las usa esta pestaña.
// _tecnicosDisponibles() queda en index.html porque también la usan
// renders.reg e renders.insp.
window.renderEq=function(){
  const eq=C.recalcAll();
  const tipos=[...new Set(eq.map(e=>e.tipo))];
  $('s-eq').innerHTML=`
    <div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="3.2"/><line x1="10" y1="2" x2="10" y2="4.2"/><line x1="10" y1="15.8" x2="10" y2="18"/><line x1="2" y1="10" x2="4.2" y2="10"/><line x1="15.8" y1="10" x2="18" y2="10"/><line x1="4.8" y1="4.8" x2="6.3" y2="6.3"/><line x1="13.7" y1="13.7" x2="15.2" y2="15.2"/><line x1="4.8" y1="15.2" x2="6.3" y2="13.7"/><line x1="13.7" y1="6.3" x2="15.2" y2="4.8"/></svg> Control PM Dinámico — Equipos</div><div class="sec-s">${eq.length} equipos · Click en celda azul para editar</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" onclick="addEquipo()">+ Nuevo Equipo</button><button class="btn" style="background:var(--info,#3b82f6)" onclick="importarEquiposNuevos()">⬆️ Importar Flota CSV</button><button class="btn btn-o" onclick="exportCSV('eq')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> CSV</button><button class="btn btn-o" style="color:var(--danger);border-color:var(--danger)" onclick="window._eqFiltroUrgente=!window._eqFiltroUrgente;renders.eq()" id="btnFiltroUrg">🔴 Solo PM4 Urgentes</button></div>
    </div>
    <div class="help-tip">🔵 Celdas editables = click y escriba · ⚫ Celdas grises = se calculan solas · <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg> = eliminar fila</div>
    <div class="toolbar">
      <select id="fTipo" onchange="renders.eq()"><option value="">Todos</option>${tipos.map(t=>`<option>${t}</option>`).join('')}</select>
      <select id="fEst" onchange="renders.eq()"><option value="">Todo estado</option><option>URGENTE</option><option>PRÓXIMA</option><option>AL DÍA</option><option>VENCIDA</option></select>
    </div>
    <div class="tbl-wrap"><table id="tbl-eq">
      <tr><th style="cursor:pointer;user-select:none" onclick="sortTable(&apos;tbl-eq&apos;,0,&apos;str&apos;)" title="Ordenar">Sigla</th><th style="cursor:pointer;user-select:none" onclick="sortTable(&apos;tbl-eq&apos;,1,&apos;str&apos;)" title="Ordenar">Tipo</th><th style="cursor:pointer;user-select:none" onclick="sortTable(&apos;tbl-eq&apos;,2,&apos;str&apos;)" title="Ordenar">Modelo</th><th style="cursor:pointer;user-select:none" onclick="sortTable(&apos;tbl-eq&apos;,3,&apos;num&apos;)" title="Ordenar">Hrs/Día</th><th style="cursor:pointer;user-select:none" onclick="sortTable(&apos;tbl-eq&apos;,4,&apos;num&apos;)" title="Ordenar">Horóm. Actual</th><th style="cursor:pointer;user-select:none" onclick="sortTable(&apos;tbl-eq&apos;,5,&apos;date&apos;)" title="Ordenar">Fecha Horóm.</th><th style="cursor:pointer;user-select:none" onclick="sortTable(&apos;tbl-eq&apos;,6,&apos;num&apos;)" title="Ordenar">Frec PM</th><th style="cursor:pointer;user-select:none" onclick="sortTable(&apos;tbl-eq&apos;,7,&apos;num&apos;)" title="Ordenar">Próx PM</th><th style="cursor:pointer;user-select:none" onclick="sortTable(&apos;tbl-eq&apos;,8,&apos;num&apos;)" title="Ordenar">Hrs Rest.</th><th style="cursor:pointer;user-select:none" onclick="sortTable(&apos;tbl-eq&apos;,9,&apos;num&apos;)" title="Ordenar">Días</th><th style="cursor:pointer;user-select:none" onclick="sortTable(&apos;tbl-eq&apos;,10,&apos;date&apos;)" title="Ordenar">Fecha Próx</th><th style="cursor:pointer;user-select:none" onclick="sortTable(&apos;tbl-eq&apos;,11,&apos;str&apos;)" title="Ordenar">Tipo PM</th><th>Estado</th><th><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg></th></tr>
      ${eq.filter(e=>{
        const ft=$('fTipo')?.value,fe=$('fEst')?.value;
        if(ft&&e.tipo!==ft)return false;if(fe&&!e.estado?.includes(fe))return false;
        if(window._eqFiltroUrgente&&!(e.tipoPM==='PM4'&&e.estado?.includes('URGENTE')))return false;
        return true;
      }).map((e,_,arr)=>{
        const i=eq.indexOf(e);
        return`<tr data-sigla="${escapeHtml(e.sigla)}">
          ${edCell(e.sigla,'sigla',i,'eq')}
          ${edCell(e.tipo,'tipo',i,'eq','select',_tiposEquipoDisponibles())}
          ${edCell(e.modelo,'modelo',i,'eq')}
          ${edCell(e.hrsDia,'hrsDia',i,'eq','number')}
          ${edCell(e.horomActual,'horomActual',i,'eq','number')}
          ${edCell(e.fechaHorom,'fechaHorom',i,'eq','date')}
          ${edCell(e.frecPM,'frecPM',i,'eq','number')}
          <td class="mono calc">${fn(e.horomProxPM)}</td>
          <td class="mono calc">${fn(e.hrsRestantes)}</td>
          <td class="mono calc" style="color:${e.diasParaPM<=7?'var(--danger)':e.diasParaPM<=30?'var(--warn)':'var(--ok)'}">${e.diasParaPM}</td>
          <td class="mono calc">${fd(e.fechaProxPM)}</td>
          <td class="calc">${pb(e.tipoPM)}</td>
          <td><span class="badge ${e.estado?.includes('URGENTE')||e.estado?.includes('VENCIDA')?'b-r':e.estado?.includes('PRÓXIMA')?'b-y':'b-g'}">${e.estado||''}</span></td>
          <td style="white-space:nowrap"><button class="btn-s" onclick="editFicha('${escapeHtml(e.sigla)}')" title="Ficha técnica"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg></button> <button class="btn-s btn-d" onclick="delRow('eq',${i},'eq')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg></button></td>
        </tr>`;
      }).join('')}
    </table></div>`;
};
window.addEquipo=function(){
  sm(`<h3>Nuevo Equipo</h3>
    <div class="form-row"><div class="fg"><label>Sigla</label><input id="nSigla"></div><div class="fg"><label>Tipo</label><select id="nTipo" onchange="window._nTipoChange&&window._nTipoChange()">${_tiposEquipoDisponibles().map(function(t){return'<option>'+escapeHtml(t)+'</option>'}).join('')}</select></div></div>
    <div class="form-row"><div class="fg"><label>Modelo</label><input id="nModelo"></div><div class="fg"><label>Proveedor</label><input id="nProv" value="Besalco"></div></div>
    <div class="form-row"><div class="fg"><label>N° Serie / Chasis</label><input id="nSerie"></div><div class="fg"><label>Patente</label><input id="nPatente"></div><div class="fg"><label>Año Fabricación</label><input id="nAnio" type="number" placeholder="2024"></div></div>
    <div class="form-row"><div class="fg"><label>Unidad medición</label><select id="nUnidad"><option value="hr">Horas (horómetro)</option><option value="km">Kilómetros (odómetro)</option></select></div><div class="fg"><label id="nHdLabel">Hrs/Día</label><input type="number" id="nHd" value="16"></div></div>
    <div class="form-row"><div class="fg"><label id="nHorLabel">Horómetro Actual</label><input type="number" id="nHor" value="0"></div><div class="fg"><label>Fecha</label><input type="date" id="nFec" value="${new Date().toISOString().slice(0,10)}"></div><div class="fg"><label id="nFrecLabel">Frec PM (hrs)</label><input type="number" id="nFrec" value="250"></div></div>
    <button class="btn" onclick="saveNewEq()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>`);
  // Autoajuste de labels y valores cuando cambia tipo
  window._nTipoChange=function(){
    var t=($('nTipo').value||'').toUpperCase();
    var esKm=t.indexOf('CAMIONETA')>=0||t.indexOf('BUS')>=0;
    $('nUnidad').value=esKm?'km':'hr';
    $('nHdLabel').textContent=esKm?'Km/Día':'Hrs/Día';
    $('nHorLabel').textContent=esKm?'Odómetro Actual':'Horómetro Actual';
    $('nFrecLabel').textContent=esKm?'Frec PM (km)':'Frec PM (hrs)';
    $('nFrec').value=esKm?10000:250;
    $('nHd').value=esKm?0:16;
  };
  // Autoajuste cuando cambia unidad manualmente
  $('nUnidad').onchange=function(){
    var esKm=this.value==='km';
    $('nHdLabel').textContent=esKm?'Km/Día':'Hrs/Día';
    $('nHorLabel').textContent=esKm?'Odómetro Actual':'Horómetro Actual';
    $('nFrecLabel').textContent=esKm?'Frec PM (km)':'Frec PM (hrs)';
    if(esKm&&parseFloat($('nFrec').value)<=500){$('nFrec').value=10000;$('nHd').value=0;}
    if(!esKm&&parseFloat($('nFrec').value)>=10000){$('nFrec').value=250;$('nHd').value=16;}
  };
};
window.saveNewEq=function(){
  const s=$('nSigla').value.trim();if(!s)return toast('Ingrese sigla');
  const eq=S.g('eq')||[];
  if(eq.find(function(x){return x.sigla===s;}))return toast('⚠️ La sigla '+s+' ya existe');
  const unidad=$('nUnidad').value||'hr';
  const n={
    sigla:s,tipo:$('nTipo').value,modelo:$('nModelo').value,
    numSerie:$('nSerie').value||'',patente:$('nPatente').value||'',
    anioFab:$('nAnio').value||'',proveedor:$('nProv').value||'',
    unidad:unidad,
    hrsDia:parseFloat($('nHd').value)||0,
    horomActual:parseInt($('nHor').value)||0,
    fechaHorom:$('nFec').value,
    frecPM:parseInt($('nFrec').value)||(unidad==='km'?10000:250),
    horomProxPM:0,hrsRestantes:0,diasParaPM:0,fechaProxPM:'',tipoPM:'',estado:''
  };
  _recalcEq(n);eq.push(n);S.s('eq',eq);cm();refreshAll();toast('✅ Equipo '+s+' agregado');
};

window.importarEquiposNuevos=function(){
  var eq=S.g('eq')||[];
  var hoy=new Date().toISOString().slice(0,10);

  // 8 equipos del CSV MAESTRA_EQUIPOS_ACTUALIZADA_2026
  // unidad:'km' → excluidos de cálculos de horas-flota (MTBF, Costo/Hr)
  // hrsDia:0 → el usuario completa cuando tenga el dato real
  // horomActual: usar dato real si existe en historial, 0 si no
  var nuevos=[
    {sigla:'CN-10159',tipo:'Camion',   modelo:'Komatsu HD-785-7',      numSerie:'37003',          patente:'VTHY-87',   anioFab:'2026',proveedor:'Besalco',unidad:'hr', hrsDia:16,  horomActual:805,   fechaHorom:hoy,frecPM:250,  horomProxPM:0,hrsRestantes:0,diasParaPM:0,fechaProxPM:'',tipoPM:'',estado:''},
    {sigla:'CN-10160',tipo:'Camion',   modelo:'Komatsu HD-785-7',      numSerie:'37005',          patente:'VTWV-72',   anioFab:'2026',proveedor:'Besalco',unidad:'hr', hrsDia:16,  horomActual:0,     fechaHorom:hoy,frecPM:250,  horomProxPM:0,hrsRestantes:0,diasParaPM:0,fechaProxPM:'',tipoPM:'',estado:''},
    {sigla:'CA-9927', tipo:'Camioneta',modelo:'Great Wall POER 4x4 MT',numSerie:'GW4D20M24597014416',patente:'TRDD-27',anioFab:'2024',proveedor:'Besalco',unidad:'km', hrsDia:0,   horomActual:67305, fechaHorom:'2026-07-07',frecPM:10000,horomProxPM:0,hrsRestantes:0,diasParaPM:0,fechaProxPM:'',tipoPM:'',estado:''},
    {sigla:'CA-6146', tipo:'Camioneta',modelo:'Great Wall POER 4x4 MT',numSerie:'LGWDCF197RJ620917',patente:'TJJF-80',anioFab:'2024',proveedor:'Besalco',unidad:'km', hrsDia:0,   horomActual:55581, fechaHorom:'2026-07-07',frecPM:10000,horomProxPM:0,hrsRestantes:0,diasParaPM:0,fechaProxPM:'',tipoPM:'',estado:''},
    {sigla:'CA-5979', tipo:'Camioneta',modelo:'Toyota Hilux',           numSerie:'8AJDB3CD4P1329122',patente:'SKKW-28',anioFab:'2023',proveedor:'Besalco',unidad:'km', hrsDia:0,   horomActual:114681,fechaHorom:'2026-07-07',frecPM:10000,horomProxPM:0,hrsRestantes:0,diasParaPM:0,fechaProxPM:'',tipoPM:'',estado:''},
    {sigla:'CA-10505',tipo:'Camioneta',modelo:'Ford Ranger Crew DSL XL',numSerie:'8AFBR01E2SJ005215',patente:'VXBK-91',anioFab:'2026',proveedor:'Besalco',unidad:'km', hrsDia:0,   horomActual:2500, fechaHorom:'2026-07-07',frecPM:10000,horomProxPM:0,hrsRestantes:0,diasParaPM:0,fechaProxPM:'',tipoPM:'',estado:''},
    {sigla:'CA-10506',tipo:'Camioneta',modelo:'Ford Ranger Crew DSL XL',numSerie:'8AFBR01E4SJ005216',patente:'VXBK-90',anioFab:'2026',proveedor:'Besalco',unidad:'km', hrsDia:0,   horomActual:2560, fechaHorom:'2026-07-07',frecPM:10000,horomProxPM:0,hrsRestantes:0,diasParaPM:0,fechaProxPM:'',tipoPM:'',estado:''},
    {sigla:'BS-5752', tipo:'Bus',       modelo:'King Long XMQQ6130',    numSerie:'71098792',       patente:'RTGK.77-2',anioFab:'2022',proveedor:'Besalco',unidad:'km', hrsDia:0,   horomActual:409000,fechaHorom:'2026-07-07',frecPM:10000,horomProxPM:0,hrsRestantes:0,diasParaPM:0,fechaProxPM:'',tipoPM:'',estado:''}
  ];

  var agregados=[];var omitidos=[];
  nuevos.forEach(function(n){
    var existe=eq.find(function(e){return e.sigla===n.sigla;});
    if(existe){omitidos.push(n.sigla);return;}
    _recalcEq(n);
    eq.push(n);
    agregados.push(n.sigla);
  });

  S.s('eq',eq);
  refreshAll();
  var msg='✅ Importados: '+agregados.join(', ');
  if(omitidos.length)msg+='\n⚠️ Ya existían (omitidos): '+omitidos.join(', ');
  msg+='\n\n<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="10" height="15" rx="1.5"/><rect x="7.5" y="2" width="5" height="2.5" rx="0.8"/><line x1="7" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/><line x1="7" y1="15" x2="11" y2="15"/></svg> Camionetas y Bus tienen hrsDia=0.\nEdita cada ficha técnica (✏️) para ingresar km/día cuando tengas el dato.';
  alert(msg);
};
window.editFicha=function(sigla){
  var eq=S.g('eq')||[];
  var e=eq.find(function(x){return x.sigla===sigla});
  if(!e)return;
  sm('<h3><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Ficha Técnica — '+escapeHtml(sigla)+'</h3>'+
    '<div class="form-row"><div class="fg"><label>Sigla</label><input id="ftSigla" value="'+escapeHtml(e.sigla||'')+'"></div>'+
    '<div class="fg"><label>Tipo</label><input id="ftTipo" value="'+escapeHtml(e.tipo||'')+'"></div>'+
    '<div class="fg"><label>Modelo</label><input id="ftModelo" value="'+escapeHtml(e.modelo||'')+'"></div></div>'+
    '<div class="form-row"><div class="fg"><label>N° Serie</label><input id="ftSerie" value="'+escapeHtml(e.numSerie||'')+'"></div>'+
    '<div class="fg"><label>Año Fabricación</label><input id="ftAnio" value="'+(e.anioFab||'')+'"></div>'+
    '<div class="fg"><label>VIN / Chasis</label><input id="ftVIN" value="'+escapeHtml(e.vin||'')+'"></div></div>'+
    '<div class="form-row"><div class="fg"><label>Proveedor</label><input id="ftProv" value="'+escapeHtml(e.proveedor||'')+'"></div>'+
    '<div class="fg"><label>Valor Compra ($)</label><input type="number" id="ftValor" value="'+(e.valorCompra||0)+'"></div>'+
    '<div class="fg"><label>Fecha Compra</label><input type="date" id="ftFechaCompra" value="'+(e.fechaCompra||'')+'"></div>'+
    '<div class="fg"><label title="Puesta en marcha en faena (horómetro ~0). Ancla para estimar la antigüedad de componentes.">Inicio Operacional</label><input type="date" id="ftInicioOper" value="'+(e.inicioOper||'')+'"></div></div>'+
    '<div class="form-row"><div class="fg"><label>Garantía Hasta (hrs)</label><input type="number" id="ftGarantia" value="'+(e.garantiaHasta||0)+'"></div>'+
    '<div class="fg"><label>Contrato Servicio</label><input id="ftContrato" value="'+escapeHtml(e.contrato||'')+'"></div>'+
    '<div class="fg"><label>Criticidad</label><select id="ftCriticidad"><option'+(e.criticidad==='Crítico'?' selected':'')+'>Crítico</option><option'+(e.criticidad==='Esencial'?' selected':'')+'>Esencial</option><option'+(!e.criticidad||e.criticidad==='General'?' selected':'')+'>General</option></select></div>'+
    '<div class="fg"><label>Hrs/Día</label><input type="number" id="ftHrsDia" value="'+(e.hrsDia||12)+'"></div></div>'+
    '<div class="form-row"><div class="fg"><label>Frec PM (hrs)</label><input type="number" id="ftFrec" value="'+(e.frecPM||250)+'"></div>'+
    '<div class="fg"><label>Horómetro Actual</label><input type="number" id="ftHorom" value="'+(e.horomActual||0)+'"></div></div>'+
    '<div class="form-row"><div class="fg" style="flex:1"><label title="Usalo solo si SABES que un hito de PM quedo sin hacerse (el sistema no puede detectarlo solo). Se limpia solo cuando registres ese PM.">Hito PM pendiente conocido (opcional)</label><input type="number" id="ftPmPendiente" value="'+(e.pmPendienteManual||'')+'" placeholder="ej: 15500"></div>'+
    '<div class="fg" style="flex:2"><label title="Obligatorio si marcas o cambias este hito — queda en el Log de Cambios junto con el número, para que quede registro de por qué, no solo de qué se cambió">Motivo (obligatorio si marcas/cambias el hito)</label><input id="ftPmMotivo" placeholder="ej: PM4 lo hizo el proveedor externo en terreno, no se alcanzó a registrar acá"></div></div>'+
    '<br><button class="btn" onclick="saveFicha(\''+escapeHtml(sigla)+'\')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
};
// Si se renombra la sigla de un equipo, propaga el cambio a todo lo que la referencia
// como clave (Registro PM, Correctivos, Horómetros, Neumáticos, Movimientos, Programa,
// Pautas, Componentes Mayores, Gantt, Vencimientos, Disponibilidad) — si no, el equipo
// renombrado queda huérfano de toda su historia.
function _cascadeRenameSigla(oldSigla,newSigla){
  if(!oldSigla||!newSigla||oldSigla===newSigla)return;
  var reg=S.g('reg')||[];var chReg=false;
  reg.forEach(function(r){if(r.equipo===oldSigla){r.equipo=newSigla;chReg=true;}});
  if(chReg)S.s('reg',reg);
  var ot=S.g('ot')||[];var chOt=false;
  ot.forEach(function(o){if(o.sigla===oldSigla){o.sigla=newSigla;chOt=true;}});
  if(chOt)S.s('ot',ot);
  var hist=S.g('hist')||[];var chHist=false;
  hist.forEach(function(h){if(h.sigla===oldSigla){h.sigla=newSigla;chHist=true;}});
  if(chHist)S.s('hist',hist);
  var neu=S.g('neu')||[];var chNeu=false;
  neu.forEach(function(n){if(n.sigla===oldSigla){n.sigla=newSigla;chNeu=true;}});
  if(chNeu)S.s('neu',neu);
  var mov=S.g('mov')||[];var chMov=false;
  mov.forEach(function(m){if(m.equipo===oldSigla){m.equipo=newSigla;chMov=true;}});
  if(chMov)S.s('mov',mov);
  var prg=S.g('prg')||[];var chPrg=false;
  prg.forEach(function(p){if(p.sigla===oldSigla){p.sigla=newSigla;chPrg=true;}});
  if(chPrg)S.s('prg',prg);
  var pau=S.g('pau')||[];var chPau=false;
  pau.forEach(function(p){if(p.sigla===oldSigla){p.sigla=newSigla;chPau=true;}});
  if(chPau)S.s('pau',pau);
  var comp=S.g('compMayores')||[];var chComp=false;
  comp.forEach(function(c){if(c.sigla===oldSigla){c.sigla=newSigla;chComp=true;}});
  if(chComp)S.s('compMayores',comp);
  var gantt=S.g('gantt')||[];var chGantt=false;
  gantt.forEach(function(g){if(g.sigla===oldSigla){g.sigla=newSigla;chGantt=true;}});
  if(chGantt)S.s('gantt',gantt);
  var venc=S.g('venc')||{};
  if(venc[oldSigla]){venc[newSigla]=venc[oldSigla];delete venc[oldSigla];S.s('venc',venc);}
  var disp=S.g('dispCalc')||{};
  if(disp[oldSigla]){disp[newSigla]=disp[oldSigla];delete disp[oldSigla];S.s('dispCalc',disp);}
  if(GRUPO_PAUTAS[oldSigla]!==undefined){GRUPO_PAUTAS[newSigla]=GRUPO_PAUTAS[oldSigla];delete GRUPO_PAUTAS[oldSigla];}
  Object.keys(GRUPO_PAUTAS).forEach(function(k){if(GRUPO_PAUTAS[k]===oldSigla)GRUPO_PAUTAS[k]=newSigla;});
}
window.saveFicha=function(sigla){
  var eq=S.g('eq')||[];
  var idx=eq.findIndex(function(x){return x.sigla===sigla});
  if(idx<0)return;
  // Salto implausible de horómetro — esta ficha nunca había tenido ningún chequeo al
  // editar el horómetro directo (a diferencia de Registro PM). Ver validarSaltoHorometro
  // en logic.js, mismo espíritu que el "Report Mantención" de Besalco Maquinarias.
  var horomAntes=eq[idx].horomActual,fechaHoromAntes=eq[idx].fechaHorom;
  var nuevoHorom=parseFloat($('ftHorom').value)||0;
  var hoyFicha=new Date().toISOString().slice(0,10);
  if(nuevoHorom!==horomAntes){
    var chkSaltoFicha=validarSaltoHorometro(nuevoHorom,horomAntes,fechaHoromAntes,hoyFicha,parseFloat($('ftHrsDia').value)||eq[idx].hrsDia);
    if(!chkSaltoFicha.valido&&!confirm('⚠️ '+chkSaltoFicha.motivo+'\n\n¿Es error de digitación? Cancela y corrige.\n¿Continuar de todas formas?'))return;
  }
  // Motivo obligatorio al marcar o cambiar un hito de PM pendiente manual — ver
  // validarMotivoPmPendiente en logic.js. El changelog genérico ya registra el
  // ANTES/DESPUÉS del número solo (automático en cada S.s('eq',...)); esto deja
  // registrado además el PORQUÉ, que antes no quedaba en ningún lado.
  var pendienteAntes=eq[idx].pmPendienteManual;
  var pendienteNuevo=parseFloat($('ftPmPendiente').value)||null;
  var motivoPendiente=($('ftPmMotivo')?.value||'').trim();
  var chkMotivo=validarMotivoPmPendiente(pendienteAntes,pendienteNuevo,motivoPendiente);
  if(!chkMotivo.valido){toast('⚠️ '+chkMotivo.motivoError);return;}
  var nuevaSigla=$('ftSigla').value||sigla;
  if(nuevaSigla!==sigla&&!confirm('Vas a cambiar la sigla de "'+sigla+'" a "'+nuevaSigla+'". Se actualizará en todos los registros relacionados (Registro PM, Correctivos, Horómetros, Neumáticos, Movimientos, Programa, Pautas, Componentes, Gantt, Vencimientos). ¿Continuar?'))return;
  eq[idx].sigla=nuevaSigla;
  eq[idx].tipo=$('ftTipo').value||'';
  eq[idx].modelo=$('ftModelo').value||'';
  eq[idx].numSerie=$('ftSerie').value||'';
  eq[idx].anioFab=$('ftAnio').value||'';
  eq[idx].vin=$('ftVIN').value||'';
  eq[idx].proveedor=$('ftProv').value||'';
  eq[idx].valorCompra=parseFloat($('ftValor').value)||0;
  eq[idx].fechaCompra=$('ftFechaCompra').value||'';
  eq[idx].inicioOper=$('ftInicioOper').value||null;
  eq[idx].garantiaHasta=parseFloat($('ftGarantia').value)||0;
  eq[idx].contrato=$('ftContrato').value||'';
  eq[idx].criticidad=$('ftCriticidad')?.value||'General';
  eq[idx].hrsDia=parseFloat($('ftHrsDia').value)||12;
  eq[idx].frecPM=parseFloat($('ftFrec').value)||250;
  eq[idx].pmPendienteManual=pendienteNuevo;
  eq[idx].horomActual=nuevoHorom;
  // fechaHorom no se actualizaba nunca desde acá (a diferencia de Registro PM) — con
  // el tiempo quedaba cada vez más vieja, y eso afecta tanto el chequeo de salto de
  // arriba en la próxima edición como el retroactivo de Registro PM (fechaEsAnterior
  // contra e.fechaHorom).
  if(nuevoHorom!==horomAntes)eq[idx].fechaHorom=hoyFicha;
  _recalcEq(eq[idx]);
  S.s('eq',eq);
  if(pendienteNuevo&&pendienteNuevo!==pendienteAntes){
    _logChange('PM pendiente manual — '+eq[idx].sigla,'Hito '+pendienteNuevo+'h marcado a mano · Motivo: '+motivoPendiente);
  }
  _cascadeRenameSigla(sigla,nuevaSigla);
  cm();refreshAll();
  toast('✅ Ficha de '+eq[idx].sigla+' actualizada');
};
