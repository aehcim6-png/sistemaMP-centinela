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
// ═══════════════════════════════════════════════════════════════
window.renderOt=function(){
  const ot=S.g('ot')||[],eq=S.g('eq')||[];
  const reg=S.g('reg')||[];
  // Equipos AÚN fuera de servicio (mismo criterio y banner que Disponibilidad) — con
  // cientos de correctivos acumulados, estas OT (a veces de meses atrás) quedaban
  // enterradas varias páginas adentro de la tabla, sin ningún aviso arriba que las
  // destacara. El usuario reportó no verlas más pese a que la data seguía ahí.
  const fsEnCursoOT=equiposFueraDeServicioAhora(ot);
  const fsEnCursoOTHTML=fsEnCursoOT.length?
    '<div style="background:rgba(239,68,68,.08);border:1px solid var(--danger);border-radius:8px;padding:10px 14px;margin-bottom:14px">'+
    '<b style="font-size:12px;color:var(--danger)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="8"/><line x1="4.5" y1="15.5" x2="15.5" y2="4.5"/></svg> '+fsEnCursoOT.length+' equipo'+(fsEnCursoOT.length===1?'':'s')+' AÚN fuera de servicio</b>'+
    fsEnCursoOT.map(function(x){
      var dias=(typeof rangoDias==='function'?rangoDias(x.o.fechaEntrada,new Date().toISOString().slice(0,10)):[]).length;
      return'<div style="display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px">'+
        '<span class="mono" style="color:var(--ac);min-width:70px">'+escapeHtml(x.o.sigla)+'</span>'+
        '<span style="color:var(--tx3)">desde '+x.o.fechaEntrada+' ('+dias+' día'+(dias===1?'':'s')+') — '+escapeHtml(x.o.sintoma||'')+'</span>'+
        '<button class="btn-s" style="margin-left:auto;flex-shrink:0" onclick="cerrarSalidaServicio('+x.i+')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> Volvió a operar</button>'+
        '</div>';
    }).join('')+
    '</div>':'';
  const fEq=$('fOtEq')?.value||'',fTipo=$('fOtTipo')?.value||'',fEst=$('fOtEst')?.value||'';
  // Incluir correctivos que vienen de Registro PM
  const regCorr=reg.filter(r=>r.tipoPM==='Correctivo'||r.estatusEq==='Fuera de Servicio');
  const todos=[...ot,...regCorr.map(r=>({sigla:r.equipo,fecha:r.fechaEntrada,tipo:'Correctivo (desde PM)',
    criticidad:r.estatusEq==='Fuera de Servicio'?'Reparación Inmediata':'No Aplica',
    sintoma:r.obs||'Mantención correctiva',sistema:'',tecnico:r.tecnico,
    horom:r.horomReal,costo:0,duracion:r.duracion,
    fechaEntrada:r.fechaEntrada,horaEntrada:r.horaEntrada,
    fechaSalida:r.fechaSalida,horaSalida:r.horaSalida,
    estatusEq:r.estatusEq,fromReg:true}))];
  const fil=todos.filter(o=>(!fEq||o.sigla===fEq)&&(!fTipo||o.tipo?.includes(fTipo))&&(!fEst||o.estatusEq===fEst));
  const pg=_pagSlice('ot',fil);
  const tc=ot.reduce((s,o)=>s+(o.costo||0),0);
  const inmed=fil.filter(o=>o.criticidad==='Reparación Inmediata').length;
  const fds=fil.filter(o=>o.estatusEq==='Fuera de Servicio').length;
    // Component breakdown
  var comps={};ot.forEach(function(o){if(o.componente){comps[o.componente]=(comps[o.componente]||0)+1;}});
  var compCards=Object.entries(comps).sort(function(a,b){return b[1]-a[1]}).slice(0,8).map(function(c){
    return'<div class="card" style="padding:6px;text-align:center"><div style="font-size:10px;color:var(--tx3)">'+escapeHtml(c[0])+'</div><div style="font-size:18px;font-weight:700;color:'+(c[1]>=3?'var(--danger)':c[1]>=2?'var(--w)':'var(--tx)')+'">'+c[1]+'</div><div style="font-size:9px;color:var(--tx3)">fallas</div></div>';
  }).join('')||'<div class="card" style="padding:6px;color:var(--tx3);font-size:11px">Ingresa componente en cada OT para ver análisis</div>';
  $('s-ot').innerHTML=`
    <div class="sec-h"><div>
      <div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="8"/><line x1="10" y1="6" x2="10" y2="11"/><circle cx="10" cy="14" r="0.6" fill="currentColor" stroke="none"/></svg> Correctivos / Órdenes de Trabajo</div>
      <div class="sec-s">${todos.length} total (incluye correctivos del Registro PM)</div>
    </div>
      <button class="btn" onclick="addOT()">+ Nueva OT</button> <button class="btn btn-o" onclick="importOT()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar CSV/JSON</button> <button class="btn btn-o" onclick="analisisFallas()"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,5 8,10 11,7 17,16"/><polyline points="12,16 17,16 17,11"/></svg> Análisis de Fallas (MTBF)</button> <button class="btn btn-o" onclick="go('insp')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Inspecciones</button>
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
    </div>
    <div class="toolbar">
      <select id="fOtEq" onchange="window._pag.ot=1;renders.ot()"><option value="">Todos equipos</option>${eq.map(e=>`<option${e.sigla===fEq?' selected':''}>${escapeHtml(e.sigla)}</option>`).join('')}</select>
      <select id="fOtTipo" onchange="window._pag.ot=1;renders.ot()"><option value="">Todo tipo</option><option>Correctivo</option><option>Falla Operacional</option><option>Cambio de Componente</option></select>
      <select id="fOtEst" onchange="window._pag.ot=1;renders.ot()"><option value="">Todo estatus</option><option value="Fuera de Servicio">Fuera de Servicio</option><option value="Operativo">Operativo</option></select>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-bottom:12px">
    ${compCards}
    </div>
    ${!fil.length?'<div class="card"><p style="color:var(--tx3);text-align:center;padding:20px">Sin OT con los filtros actuales</p></div>':`
    ${_pagHTML('ot',pg)}
    <div class="tbl-wrap"><table>
      <tr><th>N°</th><th>Equipo</th><th>Tipo</th><th>Fecha</th><th>Duración</th><th>Síntoma <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Causa Raíz <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Componente <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Solución <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Estado OT <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Técnico</th><th>Costo <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Cód.Falla</th><th>AST</th><th>LOTO</th><th>Autoriz.</th><th></th></tr>
      ${pg.items.map((o)=>{
        const i=ot.indexOf(o);
        const idx=fil.indexOf(o);
        const col=o.estatusEq==='Fuera de Servicio'?'var(--danger)':'var(--ok)';
        const fromReg=o.fromReg;
        const es='background:transparent;border:none;color:var(--tx);font-size:11px;width:100%';
        const estOT=o.estadoOT||'Cerrada';
        const estCol2=estOT==='Pendiente'?'var(--danger)':estOT==='En Ejecución'?'var(--w)':'var(--ok)';
        var otRow='<tr style="'+(o.estatusEq==='Fuera de Servicio'||estOT==='Pendiente'?'background:rgba(239,68,68,.04)':'')+'">';
        otRow+='<td class="mono" style="color:var(--tx3)">'+(fromReg?'<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="10" height="15" rx="1.5"/><rect x="7.5" y="2" width="5" height="2.5" rx="0.8"/><line x1="7" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/><line x1="7" y1="15" x2="11" y2="15"/></svg>REG':'OT-'+String(idx+1).padStart(3,'0'))+'</td>';
        otRow+='<td class="mono" style="color:var(--ac)">'+escapeHtml(o.sigla||'—')+'</td>';
        otRow+='<td style="font-size:10px"><span class="badge '+(o.tipo?.includes('Falla')||o.tipo==='Correctivo'?'b-r':'b-y')+'">'+(o.tipo||'—')+'</span></td>';
        otRow+='<td class="mono" style="font-size:10px">'+fd(o.fechaEntrada||o.fecha)+'</td>';
        otRow+='<td class="mono" style="font-size:10px;color:var(--w)">'+(o.duracion||'—')+'</td>';
        otRow+='<td style="max-width:120px"><input value="'+escapeHtml(o.sintoma||'')+'" '+(fromReg?'disabled':'onchange="edOT('+i+',\'sintoma\',this.value)"')+' style="'+es+'" title="'+escapeHtml(o.sintoma||'')+'"></td>';
        otRow+='<td style="max-width:120px"><input value="'+escapeHtml(o.causaRaiz||'')+'" '+(fromReg?'disabled':'onchange="edOT('+i+',\'causaRaiz\',this.value)"')+' style="'+es+';color:var(--w)" placeholder="Causa..."></td>';
        otRow+='<td style="max-width:90px"><input value="'+escapeHtml(o.componente||'')+'" '+(fromReg?'disabled':'onchange="edOT('+i+',\'componente\',this.value)"')+' style="'+es+'" placeholder="Componente..."></td>';
        otRow+='<td style="max-width:120px"><input value="'+escapeHtml(o.solucion||'')+'" '+(fromReg?'disabled':'onchange="edOT('+i+',\'solucion\',this.value)"')+' style="'+es+';color:var(--ok)" placeholder="Solución..."></td>';
        if(fromReg){otRow+='<td><span style="font-size:10px">PM</span></td>';}
        else{otRow+='<td><select onchange="edOT('+i+',\'estadoOT\',this.value)" style="font-size:10px;background:var(--bg3);color:'+estCol2+';border:1px solid var(--bd);border-radius:3px;font-weight:600"><option'+(estOT==='Pendiente'?' selected':'')+'>Pendiente</option><option'+(estOT==='En Ejecución'?' selected':'')+'>En Ejecución</option><option'+(estOT==='Cerrada'?' selected':'')+'>Cerrada</option></select></td>';}
        otRow+='<td style="font-size:10px">'+escapeHtml(o.tecnico||'—')+'</td>';
        if(fromReg){otRow+='<td class="mono" style="font-size:10px">$'+fn(o.costo||0)+'</td>';}
        else{otRow+='<td><input type="number" value="'+(o.costo||0)+'" onchange="edOT('+i+',\'costo\',parseFloat(this.value)||0)" style="width:60px;background:var(--bg3);border:1px solid var(--bd);color:var(--tx);text-align:center;border-radius:3px;font-size:10px"></td>';}
        otRow+='<td>'+(fromReg?'<span style="font-size:9px;color:var(--tx3)">PM</span> ':'<button class="btn-x" onclick="gestionarFotosOT('+i+')" title="Evidencia (foto o PDF)" style="margin-right:4px">📷'+(o.fotos&&o.fotos.length?' '+o.fotos.length:'')+'</button>')+'<button class="btn-s btn-d" onclick="delRow(\'ot\','+i+',\'ot\')" title="Eliminar"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg></button></td>';
        otRow+='</tr>';
        return otRow;
      }).join('')}
    </table></div>
    ${_pagHTML('ot',pg)}`}`;
};
window.analisisFallas=function(){
  const ot=S.g('ot')||[];
  const reg=S.g('reg')||[];
  const eq=S.g('eq')||[];
  const fn2=v=>Math.round(v||0).toLocaleString('es-CL');
  // Reunir todas las fallas (OT + correctivos de PM)
  const regCorr=reg.filter(r=>r.tipoPM==='Correctivo'||r.estatusEq==='Fuera de Servicio').map(r=>({
    sigla:r.equipo,fecha:r.fechaEntrada,componente:r.componente||'',sistema:'',
    sintoma:r.obs||'',horom:r.horomReal||0,duracion:r.duracion||''
  }));
  const fallas=[...ot,...regCorr].filter(f=>f.sigla);

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

window.addOT=function(){
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
    <br><button class="btn" onclick="saveOT()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar OT</button> <button class="btn btn-o" onclick="cm()">Cancelar</button> <button type="button" class="btn btn-o" onclick="_iniciarOTPorVoz()">${ICONS.mic} Completar por voz</button>`);
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
window._iniciarOTPorVoz=function(){
  if(!document.getElementById('oEq')&&typeof addOT==='function')addOT();
  _iniciarFlujoVoz(window.OT_VOZ_PASOS,function(){if(typeof saveOT==='function')saveOT();},_otVozResumenTexto);
};

window.calcDurOT=function(){
  const fe=$('oFecEnt')?.value,he=$('oHoraEnt')?.value;
  const fs=$('oFecSal')?.value,hs=$('oHoraSal')?.value;
  if(!fe||!he||!fs||!hs)return;
  const ms=new Date(fs+'T'+hs)-new Date(fe+'T'+he);
  if(ms<0){$('oDur').value='⚠️ Inválido';return;}
  $('oDur').value=Math.floor(ms/3600000)+'h '+String(Math.floor((ms%3600000)/60000)).padStart(2,'0')+'min';
};
window.saveOT=function(){
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
window.gestionarFotosOT=function(idx){
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
window._otFotosSeleccionadas=async function(ev){
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
window.quitarFotoOT=function(fi){
  var ot=S.g('ot')||[];
  var o=ot[window._otFotoIdx];
  if(!o||!o.fotos)return;
  if(!confirm('¿Quitar esta foto del registro?\n(sigue guardada en Supabase Storage, solo se desvincula de esta OT)'))return;
  o.fotos.splice(fi,1);
  S.s('ot',ot);
  _renderModalFotosOT();
  renders.ot();
};

window.edOT=function(i,key,val){
  var ot=S.g('ot')||[];
  // SLA de primera respuesta: se marca UNA sola vez, apenas la OT deja de
  // estar 'Pendiente' (a 'En Ejecución' o directo a 'Cerrada') — ver Costos >
  // MTBF/MTTR. Se lee ot[i].estadoOT ANTES de que _edCampo lo sobreescriba.
  if(key==='estadoOT'&&val!=='Pendiente'&&ot[i]&&ot[i].estadoOT==='Pendiente'&&!ot[i].primeraAtencionEn){
    ot[i].primeraAtencionEn=new Date().toISOString();
  }
  if(_edCampo('ot',ot,i,key,val)){refreshAll();toast('✅ Guardado');}
};
