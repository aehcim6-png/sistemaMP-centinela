// Pestaña Buscador Maestro — extraída a su propio archivo (Fase 2 de
// modularización). Script plano (NO módulo ES), mismo scope global de
// siempre. Solo lectura (ficha por equipo + ranking de problemáticos);
// compEstado vive en logic.js.
window.renderBuscar=function(){
  var eq=S.g('eq')||[];var reg=S.g('reg')||[];var ot=S.g('ot')||[];
  // otConHist (auditoría 2026-08-18, mismo hallazgo que Ratio Preventivo/Flota sin
  // falla/Informes KPI): 'ot' a secas dejaba fallas de meses sin registro formal
  // (ver correctivos_historico) invisibles en el conteo de Fallas/MTBF de la ficha
  // y del ranking de más abajo — solo se usa para eso, nunca se muestra fila por
  // fila (otHist no trae síntoma/solución/operador para una tabla detallada).
  var otConHist=ot.concat(_otHistComoOt(S.g('otHist')||[]));
  var hist=S.g('hist')||[];var insp=S.g('insp')||[];
  var comp=S.g('compMayores')||[];
  // Ficha completa (auditoría 2026-08): antes faltaban 6 fuentes de datos que
  // solo se veían yendo a su propia pestaña — Neumáticos, Tren de Rodaje,
  // Análisis de Aceite, Vencimientos, Historial de Componentes y Destrabe —
  // más el costo de materiales (solo se mostraba costo de mano de obra).
  var neuTodos=S.g('neu')||[];
  var cadTodos=S.g('cad')||[];
  var aceTodos=S.g('aceite')||[];
  if(aceTodos.length&&typeof window._aceiteResolverSiglas==='function')window._aceiteResolverSiglas(aceTodos);
  var vencTodos=S.g('venc')||{};
  var compHistTodos=S.g('compHist')||[];
  var destrabeTodos=S.g('destrabe')||[];
  var movTodos=S.g('mov')||[];
  var lubBuscar=S.g('lub')||[];var stkBuscar=S.g('stk')||[];
  var fEq=$('fBuscarEq')?.value||'';
  var fDesde=$('fBuscarDesde')?.value||'';
  var fHasta=$('fBuscarHasta')?.value||'';
  var fAnio=$('fBuscarAnio')?.value||'';
  var siglas=[...new Set(eq.map(function(e){return e.sigla}))].sort();
  // Años reales presentes en registros PM y correctivos
  var aniosBuscar={};
  reg.forEach(function(r){var f=(r.fechaEntrada||r.fechaEjec||'').slice(0,4);if(f.length===4)aniosBuscar[f]=1;});
  otConHist.forEach(function(o){var f=(o.fecha||'').slice(0,4);if(f.length===4)aniosBuscar[f]=1;});
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
    var otF=otConHist.filter(function(o){return o.sigla===fEq&&inRange(o.fecha)});
    var histF=hist.filter(function(h){return h.sigla===fEq&&inRange(h.fecha)});
    var inspF=insp.filter(function(i){return i.equipo===fEq&&inRange(i.fecha)});
    var compF=comp.filter(function(c){return c.sigla===fEq});
    var neuF=neuTodos.filter(function(n){return n.sigla===fEq});
    var cadF=cadTodos.filter(function(c){return c.sigla===fEq});
    var aceF=aceTodos.filter(function(m){return m._sigla===fEq&&inRange(m.fecha)});
    var vencF=vencTodos[fEq]||{};
    var vencFilas=Object.keys(vencF).filter(function(t){return vencF[t]&&(vencF[t].ultima||vencF[t].proxima)});
    var compHistF=compHistTodos.filter(function(h){return h.sigla===fEq}).slice().sort(function(a,b){return(b.fechaInst||'').localeCompare(a.fechaInst||'');});
    var destrabeF=destrabeTodos.filter(function(d){return d.equipo===fEq});
    var destrabeActivosF=destrabeF.filter(function(d){return d.estado!=='Resuelto'});
    var movF=movTodos.filter(function(m){return m.equipo===fEq&&inRange((m.mes||'')+'-01')});

    // KPIs del equipo
    var hhEq=Math.round(regF.reduce(function(s,r){return s+(r.duracionH||0)},0));
    var fallasEqArr=otF.filter(function(o){return esFallaMTBF(o);});
    var fallasEq=fallasEqArr.length;
    var mtbfEq=C.mtbfReal(fallasEqArr.map(function(o){return o.horom;}));
    var costoEq=hhEq*(S.g('hh')||25000);
    // Costo de materiales consumidos (mismo criterio que Metas vs Realidad: Filtro
    // busca precio en Stock Filtros por descripción/N°parte, el resto en Lubricantes
    // por nombre) — antes Buscar solo mostraba costo de mano de obra.
    var costoMatEq=0;
    movF.forEach(function(mv){
      if(mv.tipo==='Filtro'){var f=stkBuscar.find(function(s){return s.descripcion===mv.item||s.nParte===mv.nParte});costoMatEq+=(mv.cant||0)*((f&&f.precioUnit)||0);}
      else{var l=lubBuscar.find(function(lb){return lb.nombre===mv.item});costoMatEq+=(mv.cant||0)*((l&&l.precio)||0);}
    });

    // ═══ SCORE DE SALUD DEL EQUIPO — combina 4 señales que este sistema ya
    // calcula cada una por separado (Componentes Mayores, Neumáticos, Aceite,
    // Confiabilidad) en un solo número, vía scoreSaludEquipo (logic.js) — mismo
    // patrón que el Índice de Salud de Flota del Dashboard, a nivel de UN equipo.
    // "Componentes"/"Neumáticos" reflejan el estado ACTUAL (no dependen del rango
    // de fecha elegido arriba, igual que compF/neuF); "Aceite" usa el historial
    // completo del equipo (no aceF, que sí está acotado al rango) porque importa
    // la ÚLTIMA muestra de cada componente lubricado, no las que caen dentro de
    // un rango elegido para otra cosa. "Confiabilidad" reutiliza el mismo mtbfEq
    // de arriba, sobre una ventana fija de 30 días (mismo horizonte que la
    // Probabilidad de Falla de Predictivo) — sí depende del rango si mtbfEq
    // cambia con él, mismo comportamiento que el resto de esta ficha.
    var compsConDato=compF.map(function(c){return compEstado(c,eqObj?eqObj.horomActual:0,eqObj?eqObj.hrsDia:null);}).filter(function(s){return s.conDato;});
    var componentesPct=compsConDato.length?Math.round(compsConDato.filter(function(s){return s.hrsRest>1000;}).length/compsConDato.length*1000)/10:null;
    var neuOperativos=neuF.filter(function(n){return n.estado==='Operativo';});
    var neumaticosPct=neuOperativos.length?Math.round(neuOperativos.filter(function(n){return typeof neuDebeCambiar!=='function'||!neuDebeCambiar(n);}).length/neuOperativos.length*1000)/10:null;
    var aceHistEq=aceTodos.filter(function(m){return m._sigla===fEq;});
    var aceUltimaPorComp={};
    aceHistEq.forEach(function(m){var k=m.componente||'?';if(!aceUltimaPorComp[k]||(m.fecha||'')>(aceUltimaPorComp[k].fecha||''))aceUltimaPorComp[k]=m;});
    var aceUltimas=Object.keys(aceUltimaPorComp).map(function(k){return aceUltimaPorComp[k];});
    var aceitePct=aceUltimas.length?Math.round(aceUltimas.filter(function(m){return m.estado==='NORMAL';}).length/aceUltimas.length*1000)/10:null;
    var horasPeriodoEq=eqObj?(eqObj.hrsDia||12)*30:null;
    var confiabilidadPct=confiabilidadReal(mtbfEq,horasPeriodoEq);
    var scoreEq=scoreSaludEquipo({componentesPct:componentesPct,neumaticosPct:neumaticosPct,aceitePct:aceitePct,confiabilidadPct:confiabilidadPct});
    var scoreCol=scoreEq.valor==null?'var(--bd)':scoreEq.valor>=80?'#22c55e':scoreEq.valor>=55?'#f59e0b':'#ef4444';
    // Tendencia — el Dashboard es quien guarda el snapshot diario por equipo
    // (saludEquipoHist) cada vez que se abre; acá solo se lee, con el mismo
    // registrarSnapshotSalud/tendenciaSaludSemanal que ya usa la Tendencia del
    // Índice de Salud de Flota, un historial por sigla en vez de uno global.
    var _hoyISOBuscar=new Date().toISOString().slice(0,10);
    var tendenciaEq=scoreEq.valor!=null?tendenciaSaludSemanal((S.g('saludEquipoHist')||{})[fEq]||{},_hoyISOBuscar):null;

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

    // ═══ SCORE DE SALUD DEL EQUIPO ═══
    '<div style="background:linear-gradient(145deg,var(--bg3),var(--bg4));border-radius:10px;padding:14px 18px;margin-bottom:16px;border:2px solid '+scoreCol+';display:flex;align-items:center;gap:18px;flex-wrap:wrap">'+
    '<div style="text-align:center;min-width:120px">'+
    '<div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:var(--tx3)">Score de Salud</div>'+
    '<div style="font-size:38px;font-weight:900;color:'+scoreCol+';line-height:1;margin:2px 0">'+(scoreEq.valor==null?'—':scoreEq.valor)+(scoreEq.valor==null?'':'<span style="font-size:16px">%</span>')+'</div>'+
    '<div style="font-size:9px;color:var(--tx3)">'+(scoreEq.n?scoreEq.n+' de 4 señales con dato':'sin datos suficientes')+'</div>'+
    (tendenciaEq&&tendenciaEq.delta!=null?
      '<div style="font-size:11px;font-weight:600;margin-top:2px;color:'+(tendenciaEq.delta>0?'#22c55e':tendenciaEq.delta<0?'#ef4444':'var(--tx3)')+'">'+(tendenciaEq.delta>0?'▲':tendenciaEq.delta<0?'▼':'→')+' '+Math.abs(tendenciaEq.delta)+' pts vs hace 7 días</div>'
      :(scoreEq.valor!=null?'<div style="font-size:9px;color:var(--tx3);margin-top:2px">Sin dato de hace 7 días aún</div>':''))+
    '</div>'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap;flex:1">'+
    scoreEq.detalle.map(function(c){
      var col=c.valor==null?'var(--tx3)':c.valor>=80?'#22c55e':c.valor>=55?'#f59e0b':'#ef4444';
      return '<div style="background:var(--bg4);border-radius:8px;padding:6px 12px;text-align:center;min-width:84px">'+
        '<div style="font-size:9px;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px">'+c.nombre+'</div>'+
        '<div style="font-size:15px;font-weight:700;color:'+col+'">'+(c.valor==null?'—':c.valor+'%')+'</div></div>';
    }).join('')+
    '</div></div>'+

    // KPIs del período
    '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:16px">'+
    '<div class="card" style="margin:0"><div class="card-t">PMs Ejecutados</div><div class="card-v">'+regF.length+'</div></div>'+
    '<div class="card" style="margin:0"><div class="card-t">Correctivos</div><div class="card-v" style="color:var(--danger)">'+fallasEq+'</div></div>'+
    '<div class="card" style="margin:0"><div class="card-t">MTBF</div><div class="card-v" style="color:'+(mtbfEq==null?'var(--tx3)':mtbfEq>2000?'var(--ok)':'var(--w)')+'">'+(mtbfEq==null?'—':mtbfEq+'h')+'</div></div>'+
    '<div class="card" style="margin:0"><div class="card-t">HH Total</div><div class="card-v">'+hhEq+'h</div></div>'+
    '<div class="card" style="margin:0"><div class="card-t">Costo MO</div><div class="card-v" style="color:var(--ac)">$'+Math.round(costoEq).toLocaleString()+'</div></div>'+
    '<div class="card" style="margin:0"><div class="card-t">Costo Materiales</div><div class="card-v" style="color:var(--ac)">$'+Math.round(costoMatEq).toLocaleString()+'</div></div>'+
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
    '<div class="chart-box" style="margin-bottom:12px"><div class="chart-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Inspecciones ('+inspF.length+')</div>'+
    (inspF.length?'<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Fecha</th><th>Visual</th><th>Niveles</th><th>Fugas</th><th>Frenos</th><th>Obs</th></tr>'+
    inspF.slice().reverse().map(function(i){return'<tr><td>'+i.fecha+'</td><td>'+i.visual+'</td><td>'+i.niveles+'</td><td>'+i.fugas+'</td><td>'+i.frenos+'</td><td style="font-size:10px">'+escapeHtml(i.obs)+'</td></tr>'}).join('')+'</table></div>':'<div style="padding:10px;color:var(--tx3)">Sin inspecciones</div>')+'</div>'+

    // Neumáticos
    '<div class="chart-box" style="margin-bottom:12px"><div class="chart-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="3"/></svg> Neumáticos ('+neuF.length+')</div>'+
    (neuF.length?'<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Posición</th><th>Serie</th><th>Marca</th><th>Medida</th><th>Remanente</th><th>%</th><th>Estado</th></tr>'+
    neuF.map(function(n){return'<tr><td>'+escapeHtml(n.posicion||'')+'</td><td class="mono">'+escapeHtml(n.serie||'')+'</td><td>'+escapeHtml(n.marca||'')+'</td><td>'+escapeHtml(n.medida||'')+'</td><td>'+(n.remanente!=null?n.remanente+'mm':'—')+'</td><td>'+(n.pctRemanente!=null?n.pctRemanente+'%':'—')+'</td><td style="font-size:10px">'+escapeHtml(n.estado||'')+'</td></tr>'}).join('')+'</table></div>':'<div style="padding:10px;color:var(--tx3)">Sin neumáticos registrados</div>')+'</div>'+

    // Tren de Rodaje — solo aplica a equipos con oruga, se muestra igual con
    // "sin registros" para los que no, mismo criterio que el resto de la ficha.
    '<div class="chart-box" style="margin-bottom:12px"><div class="chart-t"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M8 12 L6 14 a3 3 0 0 1 -4 -4 L4 8 a3 3 0 0 1 4 -4 L10 6" fill="none"/><path d="M12 8 L14 6 a3 3 0 0 1 4 4 L16 12 a3 3 0 0 1 -4 4 L10 14" fill="none"/></svg> Tren de Rodaje ('+cadF.length+')</div>'+
    (cadF.length?'<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Lado</th><th>Componente</th><th>Valor Actual</th><th>%</th><th>Estado</th></tr>'+
    cadF.map(function(c){var p=c.pctRemanente;var col=p==null?'var(--tx3)':p<30?'var(--danger)':p<50?'var(--warn)':'var(--ok)';return'<tr><td>'+escapeHtml(c.lado||'')+'</td><td>'+escapeHtml(c.componente||'')+'</td><td>'+(c.valorActual!=null?c.valorActual:'—')+'</td><td style="color:'+col+'">'+(p!=null?p+'%':'—')+'</td><td style="font-size:10px">'+escapeHtml(c.estado||'')+'</td></tr>'}).join('')+'</table></div>':'<div style="padding:10px;color:var(--tx3)">Sin registros (no aplica o sin datos)</div>')+'</div>'+

    // Análisis de Aceite
    '<div class="chart-box" style="margin-bottom:12px"><div class="chart-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="2" x2="8" y2="8"/><line x1="12" y1="2" x2="12" y2="8"/><line x1="6.5" y1="2" x2="13.5" y2="2"/><polygon points="8,8 12,8 16,17 4,17"/><line x1="6" y1="13" x2="14" y2="13"/></svg> Análisis de Aceite ('+aceF.length+')</div>'+
    (aceF.length?'<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Fecha</th><th>Componente</th><th>Estado</th><th>Obs</th></tr>'+
    aceF.slice().reverse().map(function(m){return'<tr><td>'+escapeHtml(m.fecha||'')+'</td><td>'+escapeHtml(m.componente||'')+'</td><td style="font-size:10px">'+escapeHtml(m.estado||'')+'</td><td style="font-size:10px">'+escapeHtml(m.obs||'')+'</td></tr>'}).join('')+'</table></div>':'<div style="padding:10px;color:var(--tx3)">Sin muestras en el período</div>')+'</div>'+

    // Vencimientos Documentales
    '<div class="chart-box" style="margin-bottom:12px"><div class="chart-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/><circle cx="13.5" cy="13" r="1.3" fill="currentColor" stroke="none"/></svg> Vencimientos Documentales ('+vencFilas.length+')</div>'+
    (vencFilas.length?'<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Tipo</th><th>Última</th><th>Próxima</th><th>Estado</th></tr>'+
    vencFilas.map(function(t){var v=vencF[t];var est=vencEstado(v.proxima,v.periodicidadMeses!=null);return'<tr><td>'+escapeHtml(t)+'</td><td>'+(v.ultima||'—')+'</td><td>'+(v.proxima||'—')+'</td><td style="color:'+est.color+';font-size:10px">'+est.label+'</td></tr>'}).join('')+'</table></div>':'<div style="padding:10px;color:var(--tx3)">Sin vencimientos registrados</div>')+'</div>'+

    // Historial de Componentes — cuánto duró cada instalación real (distinto de
    // Componentes Mayores de arriba, que solo muestra el estado ACTUAL).
    '<div class="chart-box" style="margin-bottom:12px"><div class="chart-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5.5 V10 l3 2" fill="none"/><circle cx="10" cy="10" r="7.5"/></svg> Historial de Componentes ('+compHistF.length+')</div>'+
    (compHistF.length?'<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Componente</th><th>Fecha Inst.</th><th>Horómetro</th><th>Fuente</th><th>Obs</th></tr>'+
    compHistF.map(function(h){return'<tr><td>'+escapeHtml(h.comp||'')+'</td><td>'+(h.fechaInst||'—')+'</td><td class="mono">'+(h.horomInstalacion!=null?h.horomInstalacion:'—')+'</td><td style="font-size:10px;color:var(--tx2)">'+escapeHtml(h.fuente||'')+'</td><td style="font-size:10px">'+escapeHtml(h.obs||'')+'</td></tr>'}).join('')+'</table></div>':'<div style="padding:10px;color:var(--tx3)">Sin eventos registrados</div>')+'</div>'+

    // Gestión de Destrabe
    '<div class="chart-box"><div class="chart-t"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9 V6 a3 3 0 0 1 6 0" fill="none"/></svg> Gestión de Destrabe ('+destrabeActivosF.length+' activos de '+destrabeF.length+')</div>'+
    (destrabeF.length?'<div class="tbl-wrap"><table style="font-size:11px"><tr><th>Trabajo</th><th>Motivo Bloqueo</th><th>Responsable</th><th>F.Compromiso</th><th>Estado</th></tr>'+
    destrabeF.slice().reverse().map(function(d){return'<tr><td>'+escapeHtml(d.trabajo||'')+'</td><td style="font-size:10px">'+escapeHtml(d.motivo||'')+'</td><td>'+escapeHtml(d.responsable||'')+'</td><td>'+(d.fechaCompromiso||'—')+'</td><td style="font-size:10px">'+escapeHtml(d.estado||'')+'</td></tr>'}).join('')+'</table></div>':'<div style="padding:10px;color:var(--tx3)">Sin registros de destrabe</div>')+'</div>';

  } else {
    // Ranking de equipos problemáticos — vista por defecto (sin equipo elegido).
    // Índices por sigla (ya con el mismo filtro de tipo/rango de fecha aplicado),
    // construidos UNA vez en vez de un ot.filter()+reg.filter() completos POR CADA
    // equipo — con cientos de equipos y miles de correctivos/registros, esto era
    // O(equipos × filas) en la vista que se ve primero al abrir esta pestaña.
    var otPorSiglaBuscar={},regPorSiglaBuscar={};
    otConHist.forEach(function(o){
      if(!o.sigla||!(esFallaMTBF(o)&&inRange(o.fecha)))return;
      (otPorSiglaBuscar[o.sigla]=otPorSiglaBuscar[o.sigla]||[]).push(o);
    });
    reg.forEach(function(r){
      if(!r.equipo||!inRange(r.fechaEntrada||r.fechaEjec))return;
      (regPorSiglaBuscar[r.equipo]=regPorSiglaBuscar[r.equipo]||[]).push(r);
    });
    var ranking=eq.map(function(e){
      var fallasArr=otPorSiglaBuscar[e.sigla]||[];
      var hh=Math.round((regPorSiglaBuscar[e.sigla]||[]).reduce(function(s,r){return s+(r.duracionH||0)},0));
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
    '<input type="date" id="fBuscarDesde" value="'+fDesde+'" onchange="renders.buscar()" style="background:var(--bg3);color:var(--tx);border:1px solid var(--bd);border-radius:4px;padding:4px" placeholder="Desde" aria-label="Fecha desde">'+
    '<input type="date" id="fBuscarHasta" value="'+fHasta+'" onchange="renders.buscar()" style="background:var(--bg3);color:var(--tx);border:1px solid var(--bd);border-radius:4px;padding:4px" placeholder="Hasta" aria-label="Fecha hasta">'+
    ((fEq||fAnio||fDesde||fHasta)?'<button class="btn btn-o" onclick="$(\'fBuscarEq\').value=\'\';$(\'fBuscarAnio\').value=\'\';$(\'fBuscarDesde\').value=\'\';$(\'fBuscarHasta\').value=\'\';renders.buscar()">✕ Limpiar</button>':'')+
    '</div>'+content;
};
