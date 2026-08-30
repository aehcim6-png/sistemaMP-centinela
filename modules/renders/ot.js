// ═══════════════════════════════════════════════════════════════
// CORRECTIVOS / ÓRDENES DE TRABAJO
// addOT vivía separado de calcDurOT/saveOT/gestionarFotosOT (con la
// evidencia fotográfica) por el motor de comandos de voz que se mete en
// el medio (compartido con Stock/Lub/Neu/NeuMed). El flujo por voz propio
// (OT_VOZ_PASOS/_otVozResumenTexto/_iniciarOTPorVoz) vivía en esa misma
// sección. edOT vivía solo, después del cierre de Predictivo. Se juntan
// acá porque solo los usa esta pestaña. _dictarBtn/_dictar (dictado por
// voz genérico) y cerrarSalidaServicio (también usado por Disponibilidad)
// quedan compartidos en index.html.
// Módulo ES real (Fase 3, 2026-08-30, séptima tanda: Grupo 2 — Componentes/
// Destrabe/Correctivos, dependen de informes.js/rep.js/reg.js, ya migrados
// en tandas anteriores) — ver nota de migración en mov.js (primera tanda,
// mismo patrón).
// ═══════════════════════════════════════════════════════════════
// Resumen de búsqueda por palabra clave (2026-08, a pedido del usuario:
// "puedo buscar cualquier cosa y me indica cuándo se cambió y cuánto se
// cambió") — arriba de la tabla filtrada por 'fOtTexto' se agrega cuántas
// veces aparece el término, en qué rango de fechas y en cuántos equipos, más
// una alerta cuando el MISMO equipo concentra 3+ resultados para ese término
// — mismo umbral que ya usan compCards (>=3 = rojo) y el patrón de
// Biela/Pantógrafo en pred.js para fallas recurrentes en el mismo conjunto:
// no es evidencia de mala reparación por sí sola (depende de qué se buscó),
// así que el mensaje queda como sugerencia a revisar, no una conclusión.
function _otResumenBusquedaHTML(fil,fTexto){
  if(!fTexto||!fil.length)return'';
  var porEq={};
  fil.forEach(function(o){
    if(!o.sigla)return;
    (porEq[o.sigla]=porEq[o.sigla]||[]).push(o.fechaEntrada||o.fecha||'');
  });
  var fechas=fil.map(function(o){return o.fechaEntrada||o.fecha||'';}).filter(Boolean).sort();
  var nEquipos=Object.keys(porEq).length;
  var recurrentes=Object.keys(porEq).filter(function(s){return porEq[s].length>=3;})
    .map(function(s){
      var fs=porEq[s].filter(Boolean).slice().sort();
      var intervalos=[];
      for(var i=1;i<fs.length;i++){
        var d=_diasEntreISO(fs[i-1],fs[i]);
        if(d>0)intervalos.push(d);
      }
      var promDias=intervalos.length?Math.round(intervalos.reduce(function(a,b){return a+b;},0)/intervalos.length):null;
      return{sigla:s,veces:porEq[s].length,promDias:promDias};
    }).sort(function(a,b){return b.veces-a.veces;});
  var html='<div class="card" style="margin-bottom:10px;padding:10px 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+
    '<b style="font-size:12px">🔍 '+fil.length+' resultado'+(fil.length===1?'':'s')+' para "'+escapeHtml(fTexto)+'"</b>'+
    '<span style="font-size:11px;color:var(--tx3)">'+nEquipos+' equipo'+(nEquipos===1?'':'s')+
    (fechas.length?' · entre '+fd(fechas[0])+' y '+fd(fechas[fechas.length-1]):'')+'</span></div>';
  if(recurrentes.length){
    html+='<div style="background:rgba(239,68,68,.08);border:1px solid var(--danger);border-radius:8px;padding:10px 14px;margin-bottom:10px">'+
      '<b style="font-size:12px;color:var(--danger)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="8"/><line x1="10" y1="6" x2="10" y2="11"/><circle cx="10" cy="14" r="0.6" fill="currentColor" stroke="none"/></svg> Se repite 3+ veces en el mismo equipo — si es la misma falla, vale revisar causa raíz en vez de solo repetir el cambio</b>'+
      recurrentes.map(function(r){
        return'<div style="font-size:12px;margin-top:6px"><span class="mono" style="color:var(--ac);font-weight:600">'+escapeHtml(r.sigla)+'</span>'+
          ' — '+r.veces+' veces'+(r.promDias?' · cada ~'+r.promDias+' día'+(r.promDias===1?'':'s')+' en promedio':'')+'</div>';
      }).join('')+
      '</div>';
  }
  return html;
}
export function renderOt(){
  const ot=S.g('ot')||[],eq=S.g('eq')||[];
  const reg=S.g('reg')||[];
  // Equipos AÚN fuera de servicio (mismo criterio y banner que Disponibilidad) — con
  // cientos de correctivos acumulados, estas OT (a veces de meses atrás) quedaban
  // enterradas varias páginas adentro de la tabla, sin ningún aviso arriba que las
  // destacara. El usuario reportó no verlas más pese a que la data seguía ahí.
  // Ordenado por días descendente (el más crítico primero) y con etiqueta
  // "PROLONGADO" a partir de 14 días — mismo umbral que ya usa el Backlog
  // (kpi.js) para CRÍTICO, para mantener un solo criterio de urgencia en
  // toda la app. Antes venían en el orden que tuviera 'ot', así que un
  // equipo fuera de servicio hace 88 días podía aparecer más abajo que uno
  // de ayer, sin ningún aviso de que llevaba meses parado.
  const fsEnCursoOT=equiposFueraDeServicioAhora(ot).map(function(x){
    var dias=(typeof rangoDias==='function'?rangoDias(x.o.fechaEntrada,new Date().toISOString().slice(0,10)):[]).length;
    return{o:x.o,i:x.i,dias:dias};
  }).sort(function(a,b){return b.dias-a.dias;});
  const fsEnCursoOTHTML=fsEnCursoOT.length?
    '<div style="background:rgba(239,68,68,.08);border:1px solid var(--danger);border-radius:8px;padding:10px 14px;margin-bottom:14px">'+
    '<b style="font-size:12px;color:var(--danger)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="8"/><line x1="4.5" y1="15.5" x2="15.5" y2="4.5"/></svg> '+fsEnCursoOT.length+' equipo'+(fsEnCursoOT.length===1?'':'s')+' AÚN fuera de servicio</b>'+
    fsEnCursoOT.map(function(x){
      return'<div style="display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px">'+
        '<span class="mono" style="color:var(--ac);min-width:70px">'+escapeHtml(x.o.sigla)+'</span>'+
        '<span style="color:var(--tx3)">desde '+x.o.fechaEntrada+' ('+x.dias+' día'+(x.dias===1?'':'s')+') — '+escapeHtml(x.o.sintoma||'')+'</span>'+
        (x.dias>=14?'<b style="color:#fff;background:var(--danger);border-radius:4px;padding:1px 6px;font-size:10px">PROLONGADO</b>':'')+
        '<button class="btn-s" style="margin-left:auto;flex-shrink:0" onclick="cerrarSalidaServicio('+x.i+')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> Volvió a operar</button>'+
        '</div>';
    }).join('')+
    '</div>':'';
  const fEq=$('fOtEq')?.value||'',fTipo=$('fOtTipo')?.value||'',fEst=$('fOtEst')?.value||'',fTexto=($('fOtTexto')?.value||'').trim().toLowerCase();
  // Incluir correctivos que vienen de Registro PM
  const regCorr=reg.filter(r=>r.tipoPM==='Correctivo'||r.estatusEq==='Fuera de Servicio');
  const todos=[...ot,...regCorr.map(r=>({sigla:r.equipo,fecha:r.fechaEntrada,tipo:'Correctivo (desde PM)',
    criticidad:r.estatusEq==='Fuera de Servicio'?'Reparación Inmediata':'No Aplica',
    sintoma:r.obs||'Mantención correctiva',sistema:'',tecnico:r.tecnico,
    horom:r.horomReal,costo:0,duracion:r.duracion,
    fechaEntrada:r.fechaEntrada,horaEntrada:r.horaEntrada,
    fechaSalida:r.fechaSalida,horaSalida:r.horaSalida,
    estatusEq:r.estatusEq,fromReg:true}))];
  const _filtroOt=o=>(!fEq||o.sigla===fEq)&&(!fTipo||o.tipo?.includes(fTipo))&&(!fEst||o.estatusEq===fEst)&&
    (!fTexto||[o.componente,o.sintoma,o.causaRaiz,o.solucion].some(t=>(t||'').toLowerCase().includes(fTexto)));
  let fil=todos.filter(_filtroOt);
  // Al buscar por palabra clave, sumar también coincidencias del historial 2022-2024
  // (correctivos_historico, cargado vía otHist) — antes esta búsqueda solo miraba
  // 'ot' del día a día, así que un evento real como "cambio de alternador" cargado
  // desde Excel (con fecha y horómetro reales) no aparecía nunca acá, aunque sí
  // está en la base y ya se usa en Estadística/Predictivo. No se suma al listado
  // base sin búsqueda activa para no inflar "Total OT" con miles de filas
  // históricas de golpe — solo aparecen cuando el usuario efectivamente busca algo.
  if(fTexto){
    const histAsOt=(S.g('otHist')||[]).map(function(h){
      return{sigla:h.sigla,fecha:h.fecha,fechaEntrada:h.fecha,tipo:'Correctivo (histórico)',
        criticidad:'No Aplica',sintoma:h.descripcion||'',componente:h.sistema||'',
        causaRaiz:'',solucion:'',horom:h.horometro,costo:0,duracion:'—',
        estatusEq:'Operativo',tecnico:h.responsable||'',estadoOT:'Cerrada',fromHist:true};
    });
    fil=[...fil,...histAsOt.filter(_filtroOt)];
  }
  const pg=_pagSlice('ot',fil);
  const tc=ot.reduce((s,o)=>s+(o.costo||0),0);
  const inmed=fil.filter(o=>o.criticidad==='Reparación Inmediata').length;
  const fds=fil.filter(o=>o.estatusEq==='Fuera de Servicio').length;
    // Component breakdown
  var comps={};ot.forEach(function(o){if(o.componente){comps[o.componente]=(comps[o.componente]||0)+1;}});
  var compCards=Object.entries(comps).sort(function(a,b){return b[1]-a[1]}).slice(0,8).map(function(c){
    return'<div class="card" style="padding:6px;text-align:center"><div style="font-size:10px;color:var(--tx3)">'+escapeHtml(c[0])+'</div><div style="font-size:18px;font-weight:700;color:'+(c[1]>=3?'var(--danger)':c[1]>=2?'var(--w)':'var(--tx)')+'">'+c[1]+'</div><div style="font-size:9px;color:var(--tx3)">fallas</div></div>';
  }).join('')||'<div class="card" style="padding:6px;color:var(--tx3);font-size:11px">Ingresa componente en cada OT para ver análisis</div>';
  // Cierres sin evidencia: cuántas OT ya cerradas (Correctivo/Falla Operacional,
  // no las que vienen de Registro PM) no tienen ningún texto en 'solución' — no
  // dice qué se hizo realmente para resolver la falla. No es una falla de un
  // técnico puntual: hoy el sistema permite cerrar sin exigir esto, así que es
  // visibilidad de proceso para quien supervisa el cierre, no un juicio.
  var cerradasSinSolucion=ot.filter(function(o){
    return(!o.estadoOT||o.estadoOT==='Cerrada')&&(o.tipo==='Correctivo'||o.tipo==='Falla Operacional')&&!(o.solucion&&o.solucion.trim());
  }).length;
  var cerradasTotalEvidencia=ot.filter(function(o){return(!o.estadoOT||o.estadoOT==='Cerrada')&&(o.tipo==='Correctivo'||o.tipo==='Falla Operacional');}).length;
  var pctSinSolucion=cerradasTotalEvidencia?Math.round(cerradasSinSolucion/cerradasTotalEvidencia*100):0;
  $('s-ot').innerHTML=`
    <div class="sec-h"><div>
      <div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="8"/><line x1="10" y1="6" x2="10" y2="11"/><circle cx="10" cy="14" r="0.6" fill="currentColor" stroke="none"/></svg> Correctivos / Órdenes de Trabajo</div>
      <div class="sec-s">${todos.length} total (incluye correctivos del Registro PM)</div>
    </div>
      <button class="btn" onclick="addOT()">+ Nueva OT</button> <button class="btn btn-o" onclick="importOT()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar CSV/JSON</button> <button class="btn btn-o" onclick="analisisFallas()"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,5 8,10 11,7 17,16"/><polyline points="12,16 17,16 17,11"/></svg> Análisis de Fallas (MTBF)</button>${window._userRole==='admin'?' <button class="btn btn-o" onclick="analisisDocumentacion()"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Documentación por Técnico</button> <button class="btn btn-o" onclick="analisisReingresos()"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10a6 6 0 0 1 10.4-4.2M16 10a6 6 0 0 1-10.4 4.2"/><polyline points="14.4,3 14.4,5.8 11.6,5.8"/><polyline points="5.6,17 5.6,14.2 8.4,14.2"/></svg> Reingresos Tempranos</button>':''} <button class="btn btn-o" onclick="go('insp')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Inspecciones</button>
    </div>
    ${fsEnCursoOTHTML}
    <div class="cards">
      <div class="card"><div class="card-t">Total OT</div><div class="card-v">${todos.length}</div></div>
      <div class="card"><div class="card-t" style="color:var(--danger)">🔴 Pendientes</div><div class="card-v" style="color:var(--danger)">${todos.filter(o=>o.estadoOT==='Pendiente').length}</div><div class="card-s">Backlog</div></div>
      <div class="card"><div class="card-t" style="color:var(--warn)">🟡 En Ejecución</div><div class="card-v" style="color:var(--warn)">${todos.filter(o=>o.estadoOT==='En Ejecución').length}</div></div>
      <div class="card"><div class="card-t" style="color:var(--ok)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> Cerradas</div><div class="card-v" style="color:var(--ok)">${todos.filter(o=>!o.estadoOT||o.estadoOT==='Cerrada').length}</div></div>
      <!-- Nota: los correctivos que vienen de Registro PM (regCorr) no tienen estadoOT propio;
           al no ser 'Pendiente' ni 'En Ejecución' quedan en Cerradas, correcto porque
           representan una mantención ya ejecutada y registrada, no una OT abierta. -->
      <div class="card"><div class="card-t">Costo acumulado</div><div class="card-v" style="color:var(--ac)">$${fn(tc)}</div></div>
      <div class="card" title="OT cerradas sin ningún texto registrado en 'Solución' — no queda constancia de qué se hizo"><div class="card-t" style="color:${pctSinSolucion>=40?'var(--danger)':pctSinSolucion>=15?'var(--warn)':'var(--tx3)'}">Cerradas sin solución</div><div class="card-v" style="color:${pctSinSolucion>=40?'var(--danger)':pctSinSolucion>=15?'var(--warn)':'var(--tx)'}">${cerradasSinSolucion}</div><div class="card-s">${pctSinSolucion}% de las cerradas</div></div>
    </div>
    <div class="toolbar">
      <select id="fOtEq" onchange="window._pag.ot=1;renders.ot()"><option value="">Todos equipos</option>${eq.map(e=>`<option${e.sigla===fEq?' selected':''}>${escapeHtml(e.sigla)}</option>`).join('')}</select>
      <select id="fOtTipo" onchange="window._pag.ot=1;renders.ot()"><option value="">Todo tipo</option><option>Correctivo</option><option>Falla Operacional</option><option>Cambio de Componente</option></select>
      <select id="fOtEst" onchange="window._pag.ot=1;renders.ot()"><option value="">Todo estatus</option><option value="Fuera de Servicio">Fuera de Servicio</option><option value="Operativo">Operativo</option></select>
      <input type="text" id="fOtTexto" value="${escapeHtml(fTexto)}" placeholder="🔍 Buscar por componente/síntoma/solución (ej: alternador, turbo, asiento)..." oninput="window._pag.ot=1;renders.ot()" style="min-width:280px;background:var(--bg3);color:var(--tx);border:1px solid var(--bd);border-radius:4px;padding:5px 8px">
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-bottom:12px">
    ${compCards}
    </div>
    ${_otResumenBusquedaHTML(fil,fTexto)}
    ${!fil.length?'<div class="card"><p style="color:var(--tx3);text-align:center;padding:20px">Sin OT con los filtros actuales</p></div>':`
    ${_pagHTML('ot',pg)}
    <div class="tbl-wrap"><table>
      <tr><th>N°</th><th>Equipo</th><th>Tipo</th><th>Fecha</th><th>Duración</th><th>Síntoma <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Causa Raíz <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Componente <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Solución <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Estado OT <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Técnico</th><th>Costo <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Cód.Falla</th><th>AST</th><th>LOTO</th><th>Autoriz.</th><th></th></tr>
      ${pg.items.map((o)=>{
        const i=ot.indexOf(o);
        const idx=fil.indexOf(o);
        const col=o.estatusEq==='Fuera de Servicio'?'var(--danger)':'var(--ok)';
        const fromReg=o.fromReg;
        const fromHist=o.fromHist;
        const readOnly=fromReg||fromHist;
        const es='background:transparent;border:none;color:var(--tx);font-size:11px;width:100%';
        const estOT=o.estadoOT||'Cerrada';
        const estCol2=estOT==='Pendiente'?'var(--danger)':estOT==='En Ejecución'?'var(--w)':'var(--ok)';
        var otRow='<tr style="'+(o.estatusEq==='Fuera de Servicio'||estOT==='Pendiente'?'background:rgba(239,68,68,.04)':'')+'">';
        otRow+='<td class="mono" style="color:var(--tx3)">'+(fromReg?'<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="10" height="15" rx="1.5"/><rect x="7.5" y="2" width="5" height="2.5" rx="0.8"/><line x1="7" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/><line x1="7" y1="15" x2="11" y2="15"/></svg>REG':fromHist?'<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="7.5"/><path d="M10 5.5 V10 l3 2" fill="none"/></svg>HIST':'OT-'+String(idx+1).padStart(3,'0'))+'</td>';
        otRow+='<td class="mono" style="color:var(--ac)">'+escapeHtml(o.sigla||'—')+'</td>';
        otRow+='<td style="font-size:10px"><span class="badge '+(o.tipo?.includes('Falla')||o.tipo==='Correctivo'?'b-r':'b-y')+'">'+(o.tipo||'—')+'</span></td>';
        otRow+='<td class="mono" style="font-size:10px">'+fd(o.fechaEntrada||o.fecha)+'</td>';
        otRow+='<td class="mono" style="font-size:10px;color:var(--w)">'+(o.duracion||'—')+'</td>';
        otRow+='<td style="max-width:120px"><input value="'+escapeHtml(o.sintoma||'')+'" '+(readOnly?'disabled':'onchange="edOT('+i+',\'sintoma\',this.value)"')+' style="'+es+'" title="'+escapeHtml(o.sintoma||'')+'"></td>';
        otRow+='<td style="max-width:120px"><input value="'+escapeHtml(o.causaRaiz||'')+'" '+(readOnly?'disabled':'onchange="edOT('+i+',\'causaRaiz\',this.value)"')+' style="'+es+';color:var(--w)" placeholder="Causa..."></td>';
        otRow+='<td style="max-width:90px"><input value="'+escapeHtml(o.componente||'')+'" '+(readOnly?'disabled':'onchange="edOT('+i+',\'componente\',this.value)"')+' style="'+es+'" placeholder="Componente..."></td>';
        otRow+='<td style="max-width:120px"><input value="'+escapeHtml(o.solucion||'')+'" '+(readOnly?'disabled':'onchange="edOT('+i+',\'solucion\',this.value)"')+' style="'+es+';color:var(--ok)" placeholder="Solución..."></td>';
        if(fromReg){otRow+='<td><span style="font-size:10px">PM</span></td>';}
        else if(fromHist){otRow+='<td><span style="font-size:10px;color:var(--tx3)">Histórico</span></td>';}
        else{otRow+='<td><select onchange="edOT('+i+',\'estadoOT\',this.value)" style="font-size:10px;background:var(--bg3);color:'+estCol2+';border:1px solid var(--bd);border-radius:3px;font-weight:600"><option'+(estOT==='Pendiente'?' selected':'')+'>Pendiente</option><option'+(estOT==='En Ejecución'?' selected':'')+'>En Ejecución</option><option'+(estOT==='Cerrada'?' selected':'')+'>Cerrada</option></select></td>';}
        otRow+='<td style="font-size:10px">'+escapeHtml(o.tecnico||'—')+'</td>';
        if(fromReg){otRow+='<td class="mono" style="font-size:10px">$'+fn(o.costo||0)+'</td>';}
        else if(fromHist){otRow+='<td class="mono" style="font-size:10px;color:var(--tx3)">—</td>';}
        else{otRow+='<td><input type="number" value="'+(o.costo||0)+'" onchange="edOT('+i+',\'costo\',parseFloat(this.value)||0)" style="width:60px;'+CELL_INPUT_STYLE+';font-size:10px"></td>';}
        // Botón eliminar: solo para OT reales de este equipo (i>=0) — para filas que
        // vienen de Registro PM o del historial, 'i' es -1 (ot.indexOf no las
        // encuentra) y delRow('ot',-1,...) hace splice(-1,1), que borra el ÚLTIMO
        // elemento de 'ot' (una OT real y distinta), no un no-op. Bug preexistente
        // en fromReg que quedaba oculto porque casi nadie hacía clic ahí; se hace
        // explícito acá porque las filas de historial (fromHist) multiplican por
        // mucho cuántas filas ajenas a 'ot' aparecen en esta tabla al buscar.
        if(i<0){otRow+='<td><span style="font-size:9px;color:var(--tx3)">'+(fromReg?'PM':'HIST')+'</span></td>';}
        else{otRow+='<td><button class="btn-x" onclick="gestionarFotosOT('+i+')" title="Evidencia (foto o PDF)" style="margin-right:4px">📷'+(o.fotos&&o.fotos.length?' '+o.fotos.length:'')+'</button><button class="btn-s btn-d" onclick="delRow(\'ot\','+i+',\'ot\')" title="Eliminar"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg></button></td>';}
        otRow+='</tr>';
        return otRow;
      }).join('')}
    </table></div>
    ${_pagHTML('ot',pg)}`}`;
};
export function analisisFallas(){
  const ot=S.g('ot')||[];
  const reg=S.g('reg')||[];
  const eq=S.g('eq')||[];
  const fn2=v=>fn(Math.round(v||0));
  // Reunir todas las fallas (OT + correctivos de PM + otHist)
  const regCorr=reg.filter(r=>r.tipoPM==='Correctivo'||r.estatusEq==='Fuera de Servicio').map(r=>({
    sigla:r.equipo,fecha:r.fechaEntrada,componente:r.componente||'',sistema:'',
    sintoma:r.obs||'',horom:r.horomReal||0,duracion:r.duracion||''
  }));
  // otHist (auditoría 2026-08-18, mismo hallazgo que diagnosticoFlota en pred.js):
  // este popup ("Análisis de Fallas — MTBF", accesible desde Correctivos) es el
  // criterio "más suelto/antiguo" que Estadística ya mencionaba mejorar — nunca
  // miraba correctivos_historico (WhatsApp). Seguro de combinar: usa sigla/fecha/
  // componente/horom, todos presentes en el adaptador; 'duracion' no se usa acá.
  const otHistFallas=_otHistComoOt(S.g('otHist')||[]);
  const fallas=[...ot,...regCorr,...otHistFallas].filter(f=>f.sigla);

  // ── MTBF por COMPONENTE — tasa acotada a los últimos 12 meses ──
  // Antes: horómetro EN VIVO de toda la flota ÷ fallas de TODA la vida de ese
  // componente — el mismo defecto que C.mtbfReal ya documenta (el número sube
  // solo con el paso del tiempo, sin que el componente haya vuelto a fallar),
  // aplicado acá a nivel flota. Un intervalo real (C.mtbfReal) por componente
  // exigiría ≥2 fallas del MISMO componente en el MISMO equipo — en la práctica
  // deja "sin dato" a casi todos los componentes. Se usa en cambio el mismo
  // criterio ya validado en dash.js/metas.js para MTBF mensual: horas de flota
  // ESTIMADAS en un período ÷ fallas de ese componente en ESE MISMO período —
  // acotar ambos al mismo período rolling de 12 meses corta el crecimiento
  // artificial sin perder la utilidad práctica del reporte.
  const _hoyMTBF=new Date();
  const _desdeMTBF=new Date(_hoyMTBF);_desdeMTBF.setMonth(_desdeMTBF.getMonth()-12);
  const _desdeMTBFISO=_desdeMTBF.toISOString().slice(0,10);
  const fechaFalla=f=>f.fecha||f.fechaEntrada||'';
  const fallas12m=fallas.filter(f=>fechaFalla(f)>=_desdeMTBFISO);
  const diasPeriodoMTBF=Math.max(1,Math.round((_hoyMTBF-_desdeMTBF)/86400000));
  const horasFlotaPeriodo=eq.reduce((s,e)=>e.unidad==='km'?s:s+(e.hrsDia||12)*diasPeriodoMTBF,0);
  const porComp={};
  fallas12m.forEach(f=>{
    const c=f.componente||'Sin clasificar';
    if(!porComp[c])porComp[c]={comp:c,fallas:0,equipos:new Set(),horas:0};
    porComp[c].fallas++;
    porComp[c].equipos.add(f.sigla);
  });
  const comps=Object.values(porComp).map(c=>({
    ...c,nEquipos:c.equipos.size,
    mtbf:c.fallas>0?Math.round(horasFlotaPeriodo/c.fallas):0
  })).sort((a,b)=>b.fallas-a.fallas);

  // ── BAD ACTORS: equipos con más fallas ──
  const porEq={};
  fallas.forEach(f=>{if(!porEq[f.sigla])porEq[f.sigla]=[];porEq[f.sigla].push(f.horom);});
  const badActors=Object.entries(porEq).map(([sig,horoms])=>({sigla:sig,fallas:horoms.length,
    mtbf:C.mtbfReal(horoms)}))
    .sort((a,b)=>b.fallas-a.fallas).slice(0,8);

  const totalFallas=fallas.length;
  sm(`<div style="max-width:720px">
    <h3><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,5 8,10 11,7 17,16"/><polyline points="12,16 17,16 17,11"/></svg> Análisis de Fallas — MTBF</h3>
    <p style="font-size:12px;color:var(--tx3)">Tiempo Medio Entre Fallas por componente (últimos 12 meses) y por equipo (histórico completo) · ${totalFallas} fallas registradas en total</p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
      <div style="background:var(--bg3);border-radius:8px;padding:12px;text-align:center"><div style="font-size:10px;color:var(--tx3)">Fallas (12 meses)</div><b style="font-size:22px">${fallas12m.length}</b></div>
      <div style="background:var(--bg3);border-radius:8px;padding:12px;text-align:center"><div style="font-size:10px;color:var(--tx3)">Componentes afectados (12m)</div><b style="font-size:22px;color:var(--warn)">${comps.length}</b></div>
      <div style="background:var(--bg3);border-radius:8px;padding:12px;text-align:center"><div style="font-size:10px;color:var(--tx3)">Horas flota estim. (12m)</div><b style="font-size:14px;color:var(--ac)">${fn2(horasFlotaPeriodo)}h</b></div>
    </div>
    <b style="font-size:13px"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="8"/><line x1="10" y1="6" x2="10" y2="11"/><circle cx="10" cy="14" r="0.6" fill="currentColor" stroke="none"/></svg> MTBF por Componente — últimos 12 meses (menor MTBF = más problemático)</b>
    <div style="overflow-x:auto;margin:8px 0 16px"><table style="width:100%;font-size:11px">
      <tr style="background:var(--bg3)"><th style="padding:6px;text-align:left">Componente</th><th>Fallas</th><th>Equipos</th><th>MTBF (h)</th><th>Criticidad</th></tr>
      ${comps.map(c=>{const crit=c.mtbf<2000?'🔴 Alta':c.mtbf<5000?'🟡 Media':'🟢 Baja';return `<tr style="border-bottom:1px solid var(--bd)">
        <td style="padding:6px"><b>${escapeHtml(c.comp)}</b></td>
        <td style="text-align:center">${c.fallas}</td>
        <td style="text-align:center">${c.nEquipos}</td>
        <td style="text-align:center"><b>${fn2(c.mtbf)}</b></td>
        <td style="text-align:center">${crit}</td>
      </tr>`;}).join('')||'<tr><td colspan=5 style="text-align:center;padding:20px;color:var(--tx3)">Sin fallas con componente clasificado</td></tr>'}
    </table></div>
    <b style="font-size:13px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="4" width="6" height="6"/><line x1="9" y1="10" x2="4" y2="10"/><line x1="4" y1="10" x2="4" y2="13"/><circle cx="5.5" cy="15" r="2.5"/><circle cx="14" cy="15" r="3.5"/><line x1="15" y1="10" x2="15" y2="4"/></svg> Top Equipos Problemáticos (Bad Actors)</b>
    <div style="overflow-x:auto;margin-top:8px"><table style="width:100%;font-size:11px">
      <tr style="background:var(--bg3)"><th style="padding:6px;text-align:left">Equipo</th><th>Fallas</th><th>MTBF (h)</th></tr>
      ${badActors.map(b=>`<tr style="border-bottom:1px solid var(--bd)">
        <td style="padding:6px"><b>${escapeHtml(b.sigla)}</b></td>
        <td style="text-align:center">${b.fallas}</td>
        <td style="text-align:center">${b.mtbf==null?'—':fn2(b.mtbf)}</td>
      </tr>`).join('')||'<tr><td colspan=3 style="text-align:center;padding:20px;color:var(--tx3)">Sin datos</td></tr>'}
    </table></div>
    <p style="font-size:10px;color:var(--tx3);margin-top:12px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="8" r="5"/><line x1="8" y1="16" x2="12" y2="16"/><line x1="8.5" y1="13" x2="8.5" y2="16"/><line x1="11.5" y1="13" x2="11.5" y2="16"/></svg> MTBF por Componente = horas de flota estimadas EN LOS ÚLTIMOS 12 MESES ÷ fallas de ese componente en ese mismo período (así el número no sube solo porque pasa el tiempo sin que el componente haya vuelto a fallar). MTBF por Equipo (Bad Actors) = promedio de intervalos reales entre fallas sucesivas, histórico completo. Componentes con MTBF bajo son candidatos a revisión de proveedor o reemplazo preventivo.</p>
    <button class="btn btn-o" style="margin-top:8px" onclick="cm()">Cerrar</button>
  </div>`);
};

// Documentación por técnico — solo admin (ver botón condicionado arriba). De
// una auditoría real (2026-08): 56% de las OT cerradas de toda la flota no
// tenían 'solución' registrada, y esa brecha resultó estar concentrada casi
// por completo en 2 técnicos específicos (94% del total), no repartida pareja
// — un hallazgo con muestra grande (530 y 59 OT respectivamente) que amerita
// una conversación de terreno, no solo quedar enterrado en una consulta SQL.
// Normaliza el nombre del técnico (a veces viene "Nombre / RUT", a veces solo
// "Nombre") para no duplicar a la misma persona en dos filas — mismo criterio
// ya usado en el análisis de reincidencia por técnico.
export function analisisDocumentacion(){
  const ot=S.g('ot')||[];
  const porTecnico={};
  ot.forEach(function(o){
    if(!(o.tipo==='Correctivo'||o.tipo==='Falla Operacional'))return;
    if(!(!o.estadoOT||o.estadoOT==='Cerrada'))return;
    var nombre=(o.tecnico||'').split('/')[0].trim();
    if(!nombre)return;
    if(!porTecnico[nombre])porTecnico[nombre]={nombre:nombre,total:0,conSolucion:0};
    porTecnico[nombre].total++;
    if(o.solucion&&o.solucion.trim())porTecnico[nombre].conSolucion++;
  });
  // Umbral de 15 OT cerradas — evita que un técnico con 2-3 casos aparezca en
  // 0% o 100% por pura casualidad de muestra chica, mismo criterio usado al
  // verificar este hallazgo con SQL antes de construir la vista.
  const lista=Object.values(porTecnico).filter(function(t){return t.total>=15;})
    .map(function(t){return Object.assign(t,{pct:Math.round(t.conSolucion/t.total*100)});})
    .sort(function(a,b){return a.pct-b.pct;});
  sm(`<div style="max-width:600px">
    <h3><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Documentación por Técnico</h3>
    <p style="font-size:12px;color:var(--tx3)">De las OT cerradas (Correctivo/Falla Operacional), % con el campo "Solución" completado — no queda registro de qué se hizo si está vacío. Solo técnicos con 15+ OT cerradas (muestra suficiente).</p>
    <div style="overflow-x:auto;margin:8px 0"><table style="width:100%;font-size:11px">
      <tr style="background:var(--bg3)"><th style="padding:6px;text-align:left">Técnico</th><th>OT cerradas</th><th>Con solución</th><th>% documentado</th></tr>
      ${lista.map(function(t){
        var col=t.pct<50?'var(--danger)':t.pct<80?'var(--w)':'var(--ok)';
        return `<tr style="border-bottom:1px solid var(--bd)">
          <td style="padding:6px">${escapeHtml(t.nombre)}</td>
          <td style="text-align:center">${t.total}</td>
          <td style="text-align:center">${t.conSolucion}</td>
          <td style="text-align:center"><b style="color:${col}">${t.pct}%</b></td>
        </tr>`;
      }).join('')||'<tr><td colspan=4 style="text-align:center;padding:20px;color:var(--tx3)">Sin técnicos con 15+ OT cerradas todavía</td></tr>'}
    </table></div>
    <p style="font-size:10px;color:var(--tx3);margin-top:8px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="8" r="5"/><line x1="8" y1="16" x2="12" y2="16"/><line x1="8.5" y1="13" x2="8.5" y2="16"/><line x1="11.5" y1="13" x2="11.5" y2="16"/></svg> No mide calidad de reparación, solo si queda constancia escrita de qué se hizo. Un % bajo puede ser hábito de cómo se llena el parte en terreno, no necesariamente falta de trabajo real — vale una conversación antes de sacar conclusiones.</p>
    <button class="btn btn-o" style="margin-top:8px" onclick="cm()">Cerrar</button>
  </div>`);
};

// Reingresos tempranos por técnico — mide algo distinto de Documentación por
// Técnico: no si queda escrito qué se hizo, sino si lo que se hizo aguantó.
// Agrupa por equipo+componente (misma categorización por texto libre de
// _componenteDeSintoma(), definida en pred.js, porque el campo 'componente'
// viene vacío en casi todos los registros reales) y marca cuando el MISMO
// componente del MISMO equipo vuelve a fallar dentro de 7 días de cerrada la
// OT anterior — la atribución es al técnico que cerró esa OT anterior, no al
// que atendió el reingreso. Se excluyen a propósito los consumibles
// (neumáticos, GET/cuchillas, filtros, focos): su recurrencia es esperada por
// desgaste, no indicio de una reparación mal hecha. Verificado con SQL contra
// producción (2026-08): con esa exclusión, y sobre prácticamente la misma
// flota (23 equipos en común, así que no es que a uno le toquen los camiones
// peores), dos técnicos de volumen comparable mostraron 16.0% vs 7.2% de
// reingreso — más del doble.
export function analisisReingresos(){
  const ot=S.g('ot')||[];
  const EXCLUIR=['Neumáticos','GET / Cuchillas','Elemento de Desgaste','Filtro de Aire','Filtro de Combustible','Foco/Ampolleta'];
  const porGrupo={};
  ot.forEach(function(o){
    if(!(o.tipo==='Correctivo'||o.tipo==='Falla Operacional'))return;
    if(!o.sigla||!o.fechaEntrada)return;
    var comp=(o.componente||'').trim()||(typeof _componenteDeSintoma==='function'?_componenteDeSintoma(o.sintoma):'');
    if(!comp||EXCLUIR.indexOf(comp)>=0)return;
    var nombre=(o.tecnico||'').split('/')[0].trim();
    if(!nombre)return;
    var k=o.sigla+'|'+comp;
    (porGrupo[k]=porGrupo[k]||[]).push({entrada:o.fechaEntrada,salida:o.fechaSalida,tecnico:nombre});
  });
  const porTecnico={};
  Object.keys(porGrupo).forEach(function(k){
    var lista=porGrupo[k].slice().sort(function(a,b){return a.entrada<b.entrada?-1:a.entrada>b.entrada?1:0;});
    lista.forEach(function(actual,i){
      if(!actual.salida)return;
      if(!porTecnico[actual.tecnico])porTecnico[actual.tecnico]={nombre:actual.tecnico,total:0,reingresos:0};
      porTecnico[actual.tecnico].total++;
      var siguiente=lista[i+1];
      if(siguiente){
        var dias=_diasEntreISO(actual.salida,siguiente.entrada);
        if(dias>=0&&dias<=7)porTecnico[actual.tecnico].reingresos++;
      }
    });
  });
  // Umbral de 15 OT — mismo criterio que Documentación por Técnico, para no
  // sacar conclusiones de un técnico con 2-3 casos.
  const lista=Object.values(porTecnico).filter(function(t){return t.total>=15;})
    .map(function(t){return Object.assign(t,{pct:Math.round(t.reingresos/t.total*100)});})
    .sort(function(a,b){return b.pct-a.pct;});
  sm(`<div style="max-width:640px">
    <h3><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10a6 6 0 0 1 10.4-4.2M16 10a6 6 0 0 1-10.4 4.2"/><polyline points="14.4,3 14.4,5.8 11.6,5.8"/><polyline points="5.6,17 5.6,14.2 8.4,14.2"/></svg> Reingresos Tempranos por Técnico</h3>
    <p style="font-size:12px;color:var(--tx3)">De las OT cerradas por técnico (mismo equipo+componente, excluyendo consumibles de desgaste esperado), % donde el MISMO componente vuelve a fallar dentro de 7 días de cerrada la OT — indicio de que la reparación no quedó resuelta la primera vez. Solo técnicos con 15+ OT en esta base.</p>
    <div style="overflow-x:auto;margin:8px 0"><table style="width:100%;font-size:11px">
      <tr style="background:var(--bg3)"><th style="padding:6px;text-align:left">Técnico</th><th>OT en base</th><th>Reingresos ≤7d</th><th>% reingreso</th></tr>
      ${lista.map(function(t){
        var col=t.pct>=15?'var(--danger)':t.pct>=8?'var(--w)':'var(--ok)';
        return `<tr style="border-bottom:1px solid var(--bd)">
          <td style="padding:6px">${escapeHtml(t.nombre)}</td>
          <td style="text-align:center">${t.total}</td>
          <td style="text-align:center">${t.reingresos}</td>
          <td style="text-align:center"><b style="color:${col}">${t.pct}%</b></td>
        </tr>`;
      }).join('')||'<tr><td colspan=4 style="text-align:center;padding:20px;color:var(--tx3)">Sin técnicos con 15+ OT clasificadas todavía</td></tr>'}
    </table></div>
    <p style="font-size:10px;color:var(--tx3);margin-top:8px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="8" r="5"/><line x1="8" y1="16" x2="12" y2="16"/><line x1="8.5" y1="13" x2="8.5" y2="16"/><line x1="11.5" y1="13" x2="11.5" y2="16"/></svg> La categoría de componente se infiere del texto libre de "síntoma" (el campo estructurado casi nunca se llena), así que puede haber ruido puntual — pero con volumen suficiente la brecha entre técnicos es real, no artefacto de muestra. Vale usarlo como punto de partida para una conversación de taller, no como sanción automática.</p>
    <button class="btn btn-o" style="margin-top:8px" onclick="cm()">Cerrar</button>
  </div>`);
};

export function addOT(){
  const eq=S.g('eq')||[];
  const per=_tecnicosDisponibles();
  const sis=['Motor diésel','Hidráulico','Transmisión','Eléctrico','Frenos','Ruedas y neumáticos','Dirección','Estructura','Cabina','Climatización'];
  const hoy=new Date().toISOString().slice(0,10);
  const hora=new Date().toTimeString().slice(0,5);
  sm(`<h3><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="8"/><line x1="10" y1="6" x2="10" y2="11"/><circle cx="10" cy="14" r="0.6" fill="currentColor" stroke="none"/></svg> Nueva OT Correctivo</h3>
    <div class="form-row">
      <div class="fg"><label>Equipo *</label><select id="oEq"><option value="">Seleccionar...</option>${eq.map(e=>`<option>${escapeHtml(e.sigla)}</option>`).join('')}</select></div>
      <div class="fg"><label>Tipo</label><select id="oTipo"><option>Correctivo</option><option>Falla Operacional</option><option>Cambio de Componente</option><option>Cambio de Neumático</option><option>Relleno de Fluidos</option><option>Inspección</option></select></div>
      <div class="fg"><label>Estatus Equipo</label><select id="oEstatusEq"><option>Operativo</option><option>Fuera de Servicio</option></select></div>
    </div>
    <div class="form-row">
      <div class="fg"><label>Fecha Entrada *</label><input type="date" id="oFecEnt" value="${hoy}" onchange="calcDurOT()"></div>
      <div class="fg"><label>Hora Entrada</label><input type="time" id="oHoraEnt" value="${hora}" onchange="calcDurOT()"></div>
      <div class="fg"><label>Fecha Salida</label><input type="date" id="oFecSal" value="${hoy}" onchange="calcDurOT()"></div>
      <div class="fg"><label>Hora Salida</label><input type="time" id="oHoraSal" onchange="calcDurOT()"></div>
    </div>
    <div class="form-row">
      <div class="fg"><label>Duración</label><input id="oDur" readonly placeholder="Auto" style="opacity:.7"></div>
      <div class="fg"><label>Horómetro</label><input type="number" id="oHor"></div>
      <div class="fg"><label>Criticidad</label><select id="oCrit"><option>No Aplica</option><option>Reparación Inmediata</option><option>Proxima Mantención</option></select></div>
    </div>
    <div class="form-row">
      <div class="fg" style="flex:2"><label>Síntoma / Descripción *</label><div style="display:flex;gap:4px"><input id="oSint" style="width:100%">${_dictarBtn('oSint')}</div></div>
      <div class="fg"><label>Sistema</label><select id="oSis"><option value="">—</option>${sis.map(s=>`<option>${s}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="fg" style="flex:2"><label>Causa Raíz</label><input id="oCausa" style="width:100%" placeholder="¿Por qué falló?"></div>
      <div class="fg"><label>Componente</label><select id="oComp"><option value="">—</option><option>Motor</option><option>Bomba hidráulica</option><option>Transmisión</option><option>Diferencial</option><option>Mando final</option><option>Turbo</option><option>Alternador</option><option>Motor de partida</option><option>Frenos</option><option>Dirección</option><option>Suspensión</option><option>Neumáticos</option><option>Sistema eléctrico</option><option>Cabina</option><option>Estructura</option><option>Refrigeración</option><option>Compresor A/C</option></select></div>
    </div>
    <div class="form-row">
      <div class="fg" style="flex:2"><label>Solución aplicada</label><div style="display:flex;gap:4px"><input id="oSolucion" style="width:100%" placeholder="¿Qué se hizo?">${_dictarBtn('oSolucion')}</div></div>
      <div class="fg"><label>Estado OT</label><select id="oEstOT"><option>Cerrada</option><option>Pendiente</option><option>En Ejecución</option></select></div>
    </div>
    <div class="form-row">
      <div class="fg"><label>Técnico</label><select id="oTec"><option value="">—</option>${per.map(p=>`<option>${p}</option>`).join('')}</select></div>
      <div class="fg"><label>Costo total ($)</label><input type="number" id="oCosto" value="0"></div>
    </div>
    <div class="form-row">
    <div class="fg"><label>Turno</label><select id="otTurno"><option>Día</option><option>Noche</option></select></div>
    <div class="fg"><label>Operador</label><input id="otOperador" placeholder="Quién operaba..."></div>
    <div class="fg"><label>Ubicación</label><input id="otUbicacion" placeholder="Pit, Rampa, Planta..."></div>
    </div>
    <div class="form-row">
    <div class="fg"><label>Código Falla</label><select id="otCodFalla"><option value="">Seleccionar...</option><option>Eléctrico</option><option>Hidráulico</option><option>Mecánico</option><option>Estructural</option><option>Neumático</option><option>Motor</option><option>Transmisión</option><option>Error Operación</option><option>Otro</option></select></div>
    <div class="fg"><label>AST Completado</label><select id="otAST"><option>Sí</option><option>No</option><option>N/A</option></select></div>
    <div class="fg"><label>LOTO Aplicado</label><select id="otLOTO"><option>Sí</option><option>No</option><option>N/A</option></select></div>
    <div class="fg"><label>Autorizado por</label><input id="otAutoriza" placeholder="Nombre..."></div>
    </div>
    <br><button class="btn" onclick="saveOT()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar OT</button> <button class="btn btn-o" onclick="cm()">Cancelar</button> <button type="button" class="btn btn-o" onclick="_iniciarOTPorVoz()">${ICONS.mic} Completar por voz</button> <button type="button" class="btn btn-o" onclick="_activarLeerCorrectivoOT()">📷 Leer informe (foto)</button><input type="file" id="otCorrectivoFoto" accept="image/*" capture="environment" style="display:none" onchange="_leerCorrectivoOTFotoSeleccionada(this)">`);
};

// ── Leer informe de correctivo desde foto (leer-informe-correctivo) ──
// Misma función OCR que usa Registrar PM (reg.js) para el papel "INFORME
// MANTENIMIENTO EN TALLER" — acá prellena la ficha real donde se registran
// los correctivos, "Nueva OT Correctivo", en vez del registro de PM.
export function _activarLeerCorrectivoOT(){
  const inp=$('otCorrectivoFoto');
  if(inp)inp.click();
};
export async function _leerCorrectivoOTFotoSeleccionada(input){
  const file=input.files&&input.files[0];
  if(!file)return;
  toast('⏳ Leyendo informe...');
  try{
    const comp=await comprimirImagen(file);
    if(!comp){toast('⚠️ No se pudo leer la foto');input.value='';return;}
    const base64=comp.dataUrl.split(',')[1];
    const resp=await _llamarOCRFuncion('leer-informe-correctivo',base64,'image/jpeg');
    if(resp.error){toast('⚠️ '+resp.error);input.value='';return;}
    _prellenarDesdeOCRCorrectivoOT(resp.datos||{});
  }catch(err){
    toast('⚠️ Error leyendo informe: '+err.message);
  }
  input.value='';
};
export function _prellenarDesdeOCRCorrectivoOT(datos){
  const inc=datos.camposInciertos||[];
  function marcar(id,incierto){
    const el=$(id);
    if(!el)return;
    el.style.outline=incierto?'2px solid var(--warn)':'';
    el.style.background=incierto?'rgba(234,179,8,.12)':'';
  }
  if(datos.sigla){
    const eq=S.g('eq')||[];
    const cand=_matchEquipoPorSiglaOCR(datos.sigla,eq);
    marcar('oEq',true);
    if(cand)$('oEq').value=cand.sigla;
  }
  if(datos.horometro){$('oHor').value=datos.horometro;marcar('oHor',inc.includes('horometro'));}
  // "Entrega del equipo" = cuando entra a taller (inicio de la intervención);
  // "Recepción del equipo" = cuando se recibe de vuelta (fin) — mismo orden
  // que Entrada/Salida de este formulario.
  if(datos.fechaEntrega){$('oFecEnt').value=datos.fechaEntrega;marcar('oFecEnt',true);}
  else if(datos.fecha){$('oFecEnt').value=datos.fecha;marcar('oFecEnt',true);}
  if(datos.horaEntrega)$('oHoraEnt').value=datos.horaEntrega;
  if(datos.fechaRecepcion)$('oFecSal').value=datos.fechaRecepcion;
  if(datos.horaRecepcion)$('oHoraSal').value=datos.horaRecepcion;
  calcDurOT();
  if(datos.reparacionEfectuada){
    $('oSint').value=datos.reparacionEfectuada;
    marcar('oSint',inc.includes('reparacionEfectuada'));
  }
  const refs=[];
  if(datos.numeroOT)refs.push('OT '+datos.numeroOT);
  if(datos.incidente)refs.push('Incidente: '+datos.incidente);
  if(datos.mantenimientoAprobado)refs.push('Mantenimiento aprobado: '+datos.mantenimientoAprobado);
  if(datos.mantenedor)refs.push('Mantenedor: '+datos.mantenedor);
  if(datos.accionASeguir)refs.push('Acción a seguir: '+datos.accionASeguir);
  const causaEl=$('oCausa');
  if(causaEl){
    const partes=[];
    if(datos.observacionesDetectadas)partes.push(datos.observacionesDetectadas);
    if(refs.length)partes.push('['+refs.join(' · ')+']');
    if(partes.length){
      causaEl.value=partes.join(' — ');
      marcar('oCausa',inc.includes('observacionesDetectadas'));
    }
  }
  toast('📷 Informe leído — revisa los campos marcados en amarillo antes de guardar');
};

// ---- Flujo: Nueva OT Correctivo por voz ----
window.OT_VOZ_PASOS=[
  {campo:'oEq',pregunta:'¿Qué equipo? Di la sigla, por ejemplo TI cinco uno cuatro dos.',tipo:'equipo',requerido:true},
  {campo:'oSint',pregunta:'¿Cuál es el síntoma o problema?',tipo:'texto',requerido:true},
  {campo:'oTipo',pregunta:'¿Qué tipo de intervención? Por ejemplo correctivo, falla operacional, cambio de componente, cambio de neumático, relleno de fluidos, o inspección.',tipo:'opciones',requerido:false},
  {campo:'oCrit',pregunta:'¿Qué tan urgente es? Di reparación inmediata, próxima mantención, o no aplica.',tipo:'opciones',requerido:false},
  {campo:'oCausa',pregunta:'¿Sabes la causa raíz? Puedes decir "no sé" para saltar.',tipo:'texto_opcional',requerido:false},
];
function _otVozResumenTexto(){
  var sig=document.getElementById('oEq').value||'sin equipo';
  var sint=document.getElementById('oSint').value||'sin síntoma';
  var tipo=document.getElementById('oTipo').value||'';
  var crit=document.getElementById('oCrit').value||'';
  return 'Resumen: equipo '+sig+', síntoma '+sint+(tipo?', tipo '+tipo:'')+(crit&&crit!=='No Aplica'?', criticidad '+crit:'')+'.';
}
export function _iniciarOTPorVoz(){
  if(!document.getElementById('oEq')&&typeof addOT==='function')addOT();
  _iniciarFlujoVoz(window.OT_VOZ_PASOS,function(){if(typeof saveOT==='function')saveOT();},_otVozResumenTexto);
};

export function calcDurOT(){
  const fe=$('oFecEnt')?.value,he=$('oHoraEnt')?.value;
  const fs=$('oFecSal')?.value,hs=$('oHoraSal')?.value;
  if(!fe||!he||!fs||!hs)return;
  const ms=new Date(fs+'T'+hs)-new Date(fe+'T'+he);
  if(ms<0){$('oDur').value='⚠️ Inválido';return;}
  $('oDur').value=Math.floor(ms/3600000)+'h '+String(Math.floor((ms%3600000)/60000)).padStart(2,'0')+'min';
};
export function saveOT(){
  const sig=$('oEq').value,sint=$('oSint').value.trim();
  if(!sig)return toast('⚠️ Selecciona equipo');
  if(!sint)return toast('⚠️ Ingresa síntoma');
  const ot=S.g('ot')||[];
  const fEnt=$('oFecEnt').value,hEnt=$('oHoraEnt').value;
  const fSal=$('oFecSal').value,hSal=$('oHoraSal').value;
  let durStr='—';
  if(fEnt&&hEnt&&fSal&&hSal){
    const ms=new Date(fSal+'T'+hSal)-new Date(fEnt+'T'+hEnt);
    if(ms>0)durStr=Math.floor(ms/3600000)+'h '+String(Math.floor((ms%3600000)/60000)).padStart(2,'0')+'min';
  }
  const horom=parseInt($('oHor').value)||0;
  // Mismo resguardo que reg.js (registro de PM): sin esto, un horómetro mal
  // digitado en una OT correctiva se guardaba sin aviso y quedaba como un
  // retroceso imposible en 'correctivos' — encontrado en auditoría 2026-08
  // (decenas de saltos hacia atrás en el histórico, varios equipos).
  const eqChk=S.g('eq')||[];const eChk=eqChk.find(function(x){return x.sigla===sig;});
  if(horom>0&&eChk&&eChk.horomActual){
    const esRetroactivo=!!(eChk.fechaHorom&&fechaEsAnterior(fEnt,eChk.fechaHorom));
    if(!esRetroactivo&&horom<eChk.horomActual){
      if(!confirm('⚠️ REGRESIÓN DE HORÓMETRO\n\n'+sig+' tiene horómetro actual: '+fn(eChk.horomActual)+'h\nEstás registrando: '+fn(horom)+'h ('+fn((eChk.horomActual-horom))+'h menos)\n\n¿Es error de digitación? Cancela y corrige.\n¿Continuar de todas formas?'))return;
    } else if(!esRetroactivo){
      const chkSalto=validarSaltoHorometro(horom,eChk.horomActual,eChk.fechaHorom,fEnt,eChk.hrsDia);
      if(!chkSalto.valido&&!confirm('⚠️ '+chkSalto.motivo+'\n\n¿Es error de digitación? Cancela y corrige.\n¿Continuar de todas formas?'))return;
    }
  }
  const estadoOTNueva=$('oEstOT')?.value||'Cerrada';
  ot.unshift({sigla:sig,fecha:fEnt,fechaEntrada:fEnt,horaEntrada:hEnt,
    fechaSalida:fSal,horaSalida:hSal,duracion:durStr,
    tipo:$('oTipo').value,criticidad:$('oCrit').value,
    sintoma:sint,sistema:$('oSis').value,tecnico:$('oTec').value,
    causaRaiz:$('oCausa')?.value||'',solucion:$('oSolucion')?.value||'',
    componente:$('oComp')?.value||'',estadoOT:estadoOTNueva,
    horom,estatusEq:$('oEstatusEq').value,
    costo:parseFloat($('oCosto').value)||0,
    turno:$('otTurno')?.value||'',operador:$('otOperador')?.value||'',ubicacion:$('otUbicacion')?.value||'',
    codFalla:$('otCodFalla')?.value||'',ast:$('otAST')?.value||'',loto:$('otLOTO')?.value||'',
    autorizadoPor:$('otAutoriza')?.value||'',
    fechaIngreso:new Date().toISOString().slice(0,10),
    // Si se crea directo como 'En Ejecución'/'Cerrada' (nunca pasó por
    // Pendiente) la primera atención es ahora mismo — no queda en null
    // para siempre esperando una transición que ya no va a ocurrir.
    primeraAtencionEn:estadoOTNueva!=='Pendiente'?new Date().toISOString():null});
  // Retroalimentación: check fallas repetitivas → flag en predictivo
  var fallasMismoComp=ot.filter(function(o2){return o2.sigla===sig&&o2.componente===$('oComp')?.value&&o2.componente;}).length;
  if(fallasMismoComp>=2){toast('⚠️ '+sig+': '+fallasMismoComp+' fallas en '+ ($('oComp')?.value||'componente')+' — revisar predictivo');}
  if(horom>0){const eq=S.g('eq')||[];const e=eq.find(x=>x.sigla===sig);if(e&&horom>e.horomActual){e.horomActual=horom;_recalcEq(e);S.s('eq',eq);renderHeader();}}
  S.s('ot',ot);cm();refreshAll();toast('✅ OT guardada — '+sig);
};

// ---- EVIDENCIA FOTOGRÁFICA DE OT ----
export function gestionarFotosOT(idx){
  var ot=S.g('ot')||[];
  if(!ot[idx])return toast('❌ OT no encontrada');
  window._otFotoIdx=idx;
  _renderModalFotosOT();
};
function _renderModalFotosOT(){
  var ot=S.g('ot')||[];
  var o=ot[window._otFotoIdx];
  if(!o)return cm();
  var fotos=o.fotos||[];
  sm('<div style="max-width:600px">'+
    '<h3>📷 Evidencia Fotográfica</h3>'+
    '<div style="font-size:12px;color:var(--tx3);margin-bottom:10px">'+escapeHtml(o.sigla||'—')+' · '+escapeHtml(o.sintoma||'Sin síntoma registrado')+'</div>'+
    '<div id="otFotosGrid" style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">'+
    (fotos.length?fotos.map(function(url,fi){
      var esPdf=/\.pdf(\?|$)/i.test(url);
      var mini=esPdf
        ?'<div style="width:90px;height:90px;display:flex;align-items:center;justify-content:center;background:var(--bg3);border-radius:6px;border:1px solid var(--bor);font-size:32px;cursor:pointer" onclick="window.open(\''+url+'\',\'_blank\')" title="Ver PDF"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="5,2 12,2 15,5 15,18 5,18"/><polyline points="12,2 12,5 15,5"/><line x1="7" y1="10" x2="13" y2="10"/><line x1="7" y1="13" x2="13" y2="13"/></svg></div>'
        :'<img src="'+url+'" style="width:90px;height:90px;object-fit:cover;border-radius:6px;border:1px solid var(--bor);cursor:pointer" onclick="window.open(\''+url+'\',\'_blank\')" title="Ver completa">';
      return '<div style="position:relative">'+mini+
        '<button onclick="quitarFotoOT('+fi+')" title="Quitar" style="position:absolute;top:-6px;right:-6px;background:var(--danger);color:#fff;border:none;border-radius:50%;width:20px;height:20px;font-size:11px;cursor:pointer">✕</button></div>';
    }).join(''):'<span style="font-size:12px;color:var(--tx3)">Sin fotos todavía</span>')+
    '</div>'+
    '<label style="font-size:12px">Agregar fotos o PDF:</label><br>'+
    '<input type="file" id="otFotoInput" accept="image/*,application/pdf" multiple onchange="_otFotosSeleccionadas(event)">'+
    '<br><br><button class="btn btn-o" onclick="cm()">Cerrar</button>'+
  '</div>');
}
export async function _otFotosSeleccionadas(ev){
  var files=Array.prototype.slice.call(ev.target.files||[]);
  ev.target.value='';
  if(!files.length)return;
  var idx=window._otFotoIdx;
  var ot=S.g('ot')||[];
  var o=ot[idx];
  if(!o)return;
  toast('⏳ Subiendo '+files.length+' archivo(s)...');
  var errores=0;
  for(var i=0;i<files.length;i++){
    var file=files[i];
    var esPDF=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
    try{
      var blob,ext,contentType;
      if(esPDF){
        blob=file;ext='pdf';contentType='application/pdf';
      }else{
        var comp=await comprimirImagen(file);
        if(!comp){errores++;continue;}
        blob=comp.blob;ext='jpg';contentType='image/jpeg';
      }
      var path='ot/'+(o.sigla||'sin-equipo')+'/'+Date.now()+'_'+i+'.'+ext;
      var url=await _subirArchivoBucket(blob,path,contentType);
      if(!o.fotos)o.fotos=[];
      o.fotos.push(url);
    }catch(err){errores++;}
  }
  S.s('ot',ot);
  toast(errores?('⚠️ Guardadas con '+errores+' error(es)'):'✅ Guardado');
  _renderModalFotosOT();
  renders.ot();
};
export function quitarFotoOT(fi){
  var ot=S.g('ot')||[];
  var o=ot[window._otFotoIdx];
  if(!o||!o.fotos)return;
  if(!confirm('¿Quitar esta foto del registro?\n(sigue guardada en Supabase Storage, solo se desvincula de esta OT)'))return;
  o.fotos.splice(fi,1);
  S.s('ot',ot);
  _renderModalFotosOT();
  renders.ot();
};

export function edOT(i,key,val){
  var ot=S.g('ot')||[];
  // SLA de primera respuesta: se marca UNA sola vez, apenas la OT deja de
  // estar 'Pendiente' (a 'En Ejecución' o directo a 'Cerrada') — ver Costos >
  // MTBF/MTTR. Se lee ot[i].estadoOT ANTES de que _edCampo lo sobreescriba.
  if(key==='estadoOT'&&val!=='Pendiente'&&ot[i]&&ot[i].estadoOT==='Pendiente'&&!ot[i].primeraAtencionEn){
    ot[i].primeraAtencionEn=new Date().toISOString();
  }
  if(_edCampo('ot',ot,i,key,val)){refreshAll();toast('✅ Guardado');}
}

// Puente window/renders — ver nota en mov.js (primera tanda).
window.renderOt = renderOt;
window.analisisFallas = analisisFallas;
window.analisisDocumentacion = analisisDocumentacion;
window.analisisReingresos = analisisReingresos;
window.addOT = addOT;
window._activarLeerCorrectivoOT = _activarLeerCorrectivoOT;
window._leerCorrectivoOTFotoSeleccionada = _leerCorrectivoOTFotoSeleccionada;
window._prellenarDesdeOCRCorrectivoOT = _prellenarDesdeOCRCorrectivoOT;
window._iniciarOTPorVoz = _iniciarOTPorVoz;
window.calcDurOT = calcDurOT;
window.saveOT = saveOT;
window.gestionarFotosOT = gestionarFotosOT;
window._otFotosSeleccionadas = _otFotosSeleccionadas;
window.quitarFotoOT = quitarFotoOT;
window.edOT = edOT;
renders.ot = renderOt;
