// Pestaña Buscador Maestro — extraída a su propio archivo (Fase 2 de
// modularización). Script plano (NO módulo ES), mismo scope global de
// siempre. Solo lectura (ficha por equipo + ranking de problemáticos);
// compEstado vive en logic.js.
window.renderBuscar=function(){
  var eq=S.g('eq')||[];var reg=S.g('reg')||[];var ot=S.g('ot')||[];
  var hist=S.g('hist')||[];var insp=S.g('insp')||[];
  var comp=S.g('compMayores')||[];
  var fEq=$('fBuscarEq')?.value||'';
  var fDesde=$('fBuscarDesde')?.value||'';
  var fHasta=$('fBuscarHasta')?.value||'';
  var fAnio=$('fBuscarAnio')?.value||'';
  var siglas=[...new Set(eq.map(function(e){return e.sigla}))].sort();
  // Años reales presentes en registros PM y correctivos
  var aniosBuscar={};
  reg.forEach(function(r){var f=(r.fechaEntrada||r.fechaEjec||'').slice(0,4);if(f.length===4)aniosBuscar[f]=1;});
  ot.forEach(function(o){var f=(o.fecha||'').slice(0,4);if(f.length===4)aniosBuscar[f]=1;});
  var aniosBuscarArr=Object.keys(aniosBuscar).sort().reverse();

  // Filtro por rango de fecha — se aplica IGUAL en la ficha y en el ranking.
  // Antes solo la ficha lo usaba; el ranking ignoraba año/desde/hasta y mostraba
  // siempre el acumulado histórico, prometiendo un filtro que no cumplía.
  var hayFiltroFecha=!!(fAnio||fDesde||fHasta);
  function inRange(fecha){
    if(!fecha)return true;
    if(fAnio&&fecha.slice(0,4)!==fAnio)return false;
    if(fDesde&&fecha<fDesde)return false;
    if(fHasta&&fecha>fHasta)return false;
    return true;
  }

  var content='';
  if(fEq){
    var eqObj=eq.find(function(e){return e.sigla===fEq});
    var regF=reg.filter(function(r){return r.equipo===fEq&&inRange(r.fechaEntrada||r.fechaEjec)});
    var otF=ot.filter(function(o){return o.sigla===fEq&&inRange(o.fecha)});
    var histF=hist.filter(function(h){return h.sigla===fEq&&inRange(h.fecha)});
    var inspF=insp.filter(function(i){return i.equipo===fEq&&inRange(i.fecha)});
    var compF=comp.filter(function(c){return c.sigla===fEq});

    // KPIs del equipo
    var hhEq=Math.round(regF.reduce(function(s,r){return s+(r.duracionH||0)},0));
    var fallasEqArr=otF.filter(function(o){return o.tipo==='Correctivo'||o.tipo==='Falla Operacional'});
    var fallasEq=fallasEqArr.length;
    var mtbfEq=C.mtbfReal(fallasEqArr.map(function(o){return o.horom;}));
    var costoEq=hhEq*(S.g('hh')||25000);

    content=
    // Ficha del equipo
    '<div style="background:var(--bg3);border-radius:10px;padding:16px;margin-bottom:16px">'+
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:12px">'+
    '<div><div style="font-size:10px;color:var(--tx3)">EQUIPO</div><div style="font-size:24px;font-weight:800;color:var(--ac)">'+escapeHtml(fEq)+'</div></div>'+
    '<div><div style="font-size:10px;color:var(--tx3)">TIPO</div><div style="font-size:14px;font-weight:600">'+(eqObj?escapeHtml(eqObj.tipo):'')+'</div><div style="font-size:11px;color:var(--tx3)">'+(eqObj?escapeHtml(eqObj.modelo):'')+'</div></div>'+
    '<div><div style="font-size:10px;color:var(--tx3)">HORÓMETRO</div><div style="font-size:20px;font-weight:700">'+(eqObj?eqObj.horomActual:0)+'h</div></div>'+
    '<div><div style="font-size:10px;color:var(--tx3)">ESTADO</div><div style="font-size:14px;font-weight:600">'+(eqObj?eqObj.estado:'')+'</div></div>'+
    '<div><div style="font-size:10px;color:var(--tx3)">PRÓX PM</div><div style="font-size:14px;font-weight:600">'+(eqObj?eqObj.tipoPM:'')+'</div><div style="font-size:11px;color:var(--tx3)">'+(eqObj?eqObj.diasParaPM:0)+' días</div></div>'+
    '</div></div>'+

    // KPIs del período
    '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px">'+
    '<div class="card" style="margin:0"><div class="card-t">PMs Ejecutados</div><div class="card-v">'+regF.length+'</div></div>'+
    '<div class="card" style="margin:0"><div class="card-t">Correctivos</div><div class="card-v" style="color:var(--danger)">'+fallasEq+'</div></div>'+
    '<div class="card" style="margin:0"><div class="card-t">MTBF</div><div class="card-v" style="color:'+(mtbfEq==null?'var(--tx3)':mtbfEq>2000?'var(--ok)':'var(--w)')+'">'+(mtbfEq==null?'—':mtbfEq+'h')+'</div></div>'+
    '<div class="card" style="margin:0"><div class="card-t">HH Total</div><div class="card-v">'+hhEq+'h</div></div>'+
    '<div class="card" style="margin:0"><div class="card-t">Costo MO</div><div class="card-v" style="color:var(--ac)">$'+Math.round(costoEq).toLocaleString()+'</div></div>'+
    '</div>'+

    // Registros PM
    '<div class="chart-box" style="margin-bottom:12px"><div class="chart-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="10" height="15" rx="1.5"/><rect x="7.5" y="2" width="5" height="2.5" rx="0.8"/><line x1="7" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/><line x1="7" y1="15" x2="11" y2="15"/></svg> Registros PM ('+regF.length+')</div>'+
    (regF.length?'<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Fecha</th><th>PM</th><th>Hora Ini</th><th>Hora Fin</th><th>Duración</th><th>Horóm</th><th>Técnico</th></tr>'+
    regF.slice().reverse().map(function(r){return'<tr><td>'+r.fechaEntrada+'</td><td>'+pb(r.tipoPM)+'</td><td>'+r.horaEntrada+'</td><td>'+r.horaSalida+'</td><td>'+r.duracion+'</td><td>'+r.horomReal+'</td><td style="font-size:10px">'+escapeHtml(r.tecnico||'')+'</td></tr>'}).join('')+'</table></div>':'<div style="padding:10px;color:var(--tx3)">Sin registros en el período</div>')+'</div>'+

    // Correctivos — solo fallas reales (Correctivo/Falla Operacional), mismo criterio
    // que la tarjeta KPI de arriba. Las salidas de servicio (Fuera de Servicio) no son
    // fallas y no se cuentan aquí; antes inflaban este encabezado y no calzaba con el KPI.
    '<div class="chart-box" style="margin-bottom:12px"><div class="chart-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="8"/><line x1="10" y1="6" x2="10" y2="11"/><circle cx="10" cy="14" r="0.6" fill="currentColor" stroke="none"/></svg> Correctivos ('+fallasEq+')</div>'+
    (fallasEq?'<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Fecha</th><th>Tipo</th><th>Componente</th><th>Cód.Falla</th><th>Síntoma</th><th>Causa Raíz</th><th>Estado</th></tr>'+
    fallasEqArr.slice().reverse().map(function(o){return'<tr><td>'+o.fecha+'</td><td>'+escapeHtml(o.tipo)+'</td><td>'+escapeHtml(o.componente||'')+'</td><td>'+escapeHtml(o.codFalla||'—')+'</td><td style="font-size:10px">'+escapeHtml(o.sintoma||'')+'</td><td style="font-size:10px">'+escapeHtml(o.causaRaiz||'')+'</td><td>'+o.estadoOT+'</td></tr>'}).join('')+'</table></div>':'<div style="padding:10px;color:var(--tx3)">Sin correctivos en el período</div>')+'</div>'+

    // Componentes Mayores
    '<div class="chart-box" style="margin-bottom:12px"><div class="chart-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><polygon points="10,2.5 16,6 16,13 10,16.5 4,13 4,6"/><circle cx="10" cy="9.5" r="2.3"/></svg> Componentes Mayores ('+compF.length+')</div>'+
    (compF.length?'<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Componente</th><th>Vida Útil</th><th>Hrs Rest</th><th>% Vida</th><th>Estado</th></tr>'+
    compF.map(function(c){
      var eO=eq.find(function(e){return e.sigla===c.sigla});
      var st=compEstado(c,eO?eO.horomActual:0,eO?eO.hrsDia:12);
      var dash='<span style="color:var(--tx3)">—</span>';
      if(!st.conDato)return'<tr style="opacity:.72"><td>'+escapeHtml(c.comp||'')+'</td><td>'+c.vidaUtil+'</td><td>'+dash+'</td><td>'+dash+'</td><td>'+st.estado+'</td></tr>';
      return'<tr><td>'+escapeHtml(c.comp||'')+'</td><td>'+c.vidaUtil+'</td><td style="color:'+(st.hrsRest<1000?'var(--danger)':'var(--ok)')+'">'+st.hrsRest+'</td><td>'+st.pctVida+'%</td><td>'+st.estado+'</td></tr>'}).join('')+'</table></div>':'')+'</div>'+

    // Horómetros recientes
    '<div class="chart-box" style="margin-bottom:12px"><div class="chart-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,15 8,10 11,13 17,4"/><polyline points="12,4 17,4 17,9"/></svg> Horómetros (últimos '+Math.min(histF.length,20)+')</div>'+
    (histF.length?'<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Fecha</th><th>Inicial</th><th>Final</th></tr>'+
    histF.slice(-20).reverse().map(function(h){return'<tr><td>'+h.fecha+'</td><td>'+h.horomIni+'</td><td>'+h.horomFin+'</td></tr>'}).join('')+'</table></div>':'<div style="padding:10px;color:var(--tx3)">Sin lecturas</div>')+'</div>'+

    // Inspecciones
    '<div class="chart-box"><div class="chart-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Inspecciones ('+inspF.length+')</div>'+
    (inspF.length?'<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Fecha</th><th>Visual</th><th>Niveles</th><th>Fugas</th><th>Frenos</th><th>Obs</th></tr>'+
    inspF.slice().reverse().map(function(i){return'<tr><td>'+i.fecha+'</td><td>'+i.visual+'</td><td>'+i.niveles+'</td><td>'+i.fugas+'</td><td>'+i.frenos+'</td><td style="font-size:10px">'+escapeHtml(i.obs)+'</td></tr>'}).join('')+'</table></div>':'<div style="padding:10px;color:var(--tx3)">Sin inspecciones</div>')+'</div>';

  } else {
    // Ranking de equipos problemáticos
    var ranking=eq.map(function(e){
      var fallasArr=ot.filter(function(o){return o.sigla===e.sigla&&(o.tipo==='Correctivo'||o.tipo==='Falla Operacional')&&inRange(o.fecha)});
      var hh=Math.round(reg.filter(function(r){return r.equipo===e.sigla&&inRange(r.fechaEntrada||r.fechaEjec)}).reduce(function(s,r){return s+(r.duracionH||0)},0));
      var costo=hh*(S.g('hh')||25000);
      return{sigla:e.sigla,tipo:e.tipo,modelo:e.modelo,fallas:fallasArr.length,hh:hh,costo:costo,horom:e.horomActual,mtbf:C.mtbfReal(fallasArr.map(function(o){return o.horom;}))};
    }).sort(function(a,b){return b.fallas-a.fallas||b.costo-a.costo});

    content=
    '<div class="chart-box"><div class="chart-t">🏆 Ranking de Equipos — Más Problemáticos'+(hayFiltroFecha?' <span style="font-weight:400;color:var(--tx3);font-size:12px">('+(fAnio||((fDesde||'…')+' → '+(fHasta||'…')))+')</span>':'')+'</div>'+
    '<div class="tbl-wrap"><table><tr><th>#</th><th>Equipo</th><th>Tipo</th><th>Fallas</th><th>HH Consumidas</th><th>Costo MO</th><th>MTBF</th><th>Acción</th></tr>'+
    ranking.map(function(r,i){
      var mtbf=r.mtbf;
      return'<tr style="'+(r.fallas>3?'background:rgba(239,68,68,.04)':'')+'">'+
        '<td style="font-weight:700">'+(i+1)+'</td>'+
        '<td class="mono" style="color:var(--ac);cursor:pointer" onclick="$(\'fBuscarEq\').value=\''+escapeHtml(r.sigla)+'\';renders.buscar()">'+escapeHtml(r.sigla)+'</td>'+
        '<td>'+escapeHtml(r.tipo)+'</td>'+
        '<td style="color:'+(r.fallas>3?'var(--danger)':'var(--tx)')+';font-weight:700">'+r.fallas+'</td>'+
        '<td>'+r.hh+'h</td>'+
        '<td style="color:var(--ac)">$'+Math.round(r.costo).toLocaleString()+'</td>'+
        '<td style="color:'+(mtbf==null?'var(--tx3)':mtbf>2000?'var(--ok)':'var(--w)')+'">'+(mtbf==null?'—':mtbf+'h')+'</td>'+
        '<td><button class="btn-s" onclick="$(\'fBuscarEq\').value=\''+escapeHtml(r.sigla)+'\';renders.buscar()">Ver →</button></td></tr>';
    }).join('')+'</table></div></div>';
  }

  $('s-buscar').innerHTML=
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8.5" cy="8.5" r="5.5"/><line x1="12.7" y1="12.7" x2="17.5" y2="17.5"/></svg> Buscador Maestro</div>'+
    '<div class="sec-s">Historial completo por equipo · Ranking de equipos problemáticos</div></div></div>'+
    '<div class="toolbar" style="gap:12px">'+
    '<select id="fBuscarEq" onchange="renders.buscar()" style="min-width:140px"><option value="">— Selecciona equipo o ver ranking —</option>'+
    siglas.map(function(s){return'<option'+(fEq===s?' selected':'')+'>'+escapeHtml(s)+'</option>'}).join('')+'</select>'+
    '<select id="fBuscarAnio" onchange="renders.buscar()" style="min-width:90px"><option value="">Año: Todos</option>'+
    aniosBuscarArr.map(function(y){return'<option'+(fAnio===y?' selected':'')+'>'+y+'</option>'}).join('')+'</select>'+
    aniosBuscarArr.map(function(y){return'<button class="btn-s" style="'+(fAnio===y?'background:var(--ac);color:#fff':'')+'" onclick="$(\'fBuscarAnio\').value=\''+y+'\';renders.buscar()">'+y+'</button>'}).join('')+
    '<input type="date" id="fBuscarDesde" value="'+fDesde+'" onchange="renders.buscar()" style="background:var(--bg3);color:var(--tx);border:1px solid var(--bd);border-radius:4px;padding:4px" placeholder="Desde">'+
    '<input type="date" id="fBuscarHasta" value="'+fHasta+'" onchange="renders.buscar()" style="background:var(--bg3);color:var(--tx);border:1px solid var(--bd);border-radius:4px;padding:4px" placeholder="Hasta">'+
    ((fEq||fAnio||fDesde||fHasta)?'<button class="btn btn-o" onclick="$(\'fBuscarEq\').value=\'\';$(\'fBuscarAnio\').value=\'\';$(\'fBuscarDesde\').value=\'\';$(\'fBuscarHasta\').value=\'\';renders.buscar()">✕ Limpiar</button>':'')+
    '</div>'+content;
};
