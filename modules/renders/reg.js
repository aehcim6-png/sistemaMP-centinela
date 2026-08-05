// ═══════════════════════════════════════════════════════════════
// REGISTRO DE MANTENCIÓN — PM y Correctivos
// El flujo por voz (REG_VOZ_PASOS/_regVozResumenTexto/_iniciarRegPorVoz) y el
// importador CSV (importRegCSV/processImportReg) vivían lejos, mezclados con
// los de otras pestañas (voz: junto a OT/Stock/Lub/Neu; CSV: junto al de
// Neumáticos) — se juntan acá porque solo los usa este módulo.
// ═══════════════════════════════════════════════════════════════
// ---- REGISTRO EJECUCION (full CRUD + inline) ----
window.renderReg=function(){
  const reg=S.g('reg')||[],eq=S.g('eq')||[];
  const fEq=$('fRegEq')?.value||'',fPM=$('fRegPM')?.value||'',fEst=$('fRegEst')?.value||'';
  const fil=reg.filter(r=>{
    if(fEq&&r.equipo!==fEq)return false;
    if(fPM&&r.tipoPM!==fPM)return false;
    if(fEst&&!r.estatusEq?.includes(fEst))return false;
    return true;
  }).slice().reverse();
  const pg=_pagSlice('reg',fil);
  $('s-reg').innerHTML=`
    <div class="sec-h"><div>
      <div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="10" height="15" rx="1.5"/><rect x="7.5" y="2" width="5" height="2.5" rx="0.8"/><line x1="7" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/><line x1="7" y1="15" x2="11" y2="15"/></svg> Registro de Mantención — PM y Correctivos</div>
      <div class="sec-s">${reg.length} registros totales</div>
    </div>
      <div style="display:flex;gap:8px">
        <button class="btn" onclick="addReg()">+ Registrar PM</button>
        <button class="btn btn-o" onclick="exportCSV('reg')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> CSV</button>
        <button class="btn btn-o" onclick="importRegCSV()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar CSV</button>
      </div>
    </div>
    <div class="help-tip">🔵 Celdas azules = haz clic para editar directamente · <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg> = editar registro completo (útil para registros anteriores sin hora) · Duración se recalcula automáticamente</div>
    <div class="toolbar">
      <select id="fRegEq" onchange="window._pag.reg=1;renders.reg()"><option value="">Todos equipos</option>${eq.map(e=>`<option${e.sigla===fEq?' selected':''}>${escapeHtml(e.sigla)}</option>`).join('')}</select>
      <select id="fRegPM" onchange="window._pag.reg=1;renders.reg()"><option value="">Todo tipo</option><option>PM1</option><option>PM2</option><option>PM3</option><option>PM4</option><option>Correctivo</option></select>
      <select id="fRegEst" onchange="window._pag.reg=1;renders.reg()"><option value="">Todo estatus</option><option>Operativo</option><option>Fuera de Servicio</option></select>
    </div>
    ${_pagHTML('reg',pg)}
    <div class="tbl-wrap"><table id="tbl-reg">
      <tr>
        ${_sTh('tbl-reg',0,'N°','num')}${_sTh('tbl-reg',1,'Equipo','str')}${_sTh('tbl-reg',2,'Tipo PM','str')}
        ${_sTh('tbl-reg',3,'F. Entrada','date')}${_sTh('tbl-reg',4,'H. Entrada','str')}
        ${_sTh('tbl-reg',5,'F. Salida','date')}${_sTh('tbl-reg',6,'H. Salida','str')}
        ${_sTh('tbl-reg',7,'Duración','str')}${_sTh('tbl-reg',8,'Horóm.','num')}
        ${_sTh('tbl-reg',9,'Estatus','str')}${_sTh('tbl-reg',10,'Técnico','str')}${_sTh('tbl-reg',11,'Observaciones','str')}
        ${_sTh('tbl-reg',12,'Estado Ejec.','str')}<th><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg></th>
      </tr>
      ${pg.items.map((r,_)=>{
        const i=reg.indexOf(r);
        const col=r.estatusEq==='Fuera de Servicio'?'var(--danger)':'var(--ok)';
        const pmCol=r.tipoPM==='PM4'?'var(--pm4)':r.tipoPM==='PM3'?'var(--pm3)':r.tipoPM==='PM2'?'var(--pm2)':r.tipoPM==='Correctivo'?'var(--danger)':'var(--pm1)';
        return`<tr>
          <td class="mono" style="color:var(--tx3)">${r.nReg||i+1}</td>
          <td class="mono" style="color:var(--ac)">${escapeHtml(r.equipo)}</td>
          <td><span class="badge" style="background:${pmCol}22;color:${pmCol};border:1px solid ${pmCol}55">${r.tipoPM}</span></td>
          ${edCell(r.fechaEntrada||r.fechaEjec||'','fechaEntrada',i,'reg','date')}
          ${edCell(r.horaEntrada||'','horaEntrada',i,'reg')}
          ${edCell(r.fechaSalida||r.fechaEjec||'','fechaSalida',i,'reg','date')}
          ${edCell(r.horaSalida||'','horaSalida',i,'reg')}
          <td class="mono" style="font-size:11px;color:var(--warn)">${r.duracion||'<span style="color:var(--tx3)">clic <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></span>'}</td>
          ${edCell(r.horomReal||0,'horomReal',i,'reg','number')}
          ${edCell(r.estatusEq||'Operativo','estatusEq',i,'reg','select',['Operativo','Fuera de Servicio'])}
          ${edCell(r.tecnico||'','tecnico',i,'reg','select',_tecnicosDisponibles().concat(['']))}
          ${edCell(r.obs||'','obs',i,'reg')}
          <td><span class="badge ${r.estado?.includes('ANTICIPADA')?'b-g':r.estado?.includes('ATRASADA')?'b-r':'b-y'}">${r.estado||'—'}</span></td>
          <td style="display:flex;gap:3px">
            <button class="btn-s" onclick="editarReg(${i})" title="Editar completo" style="background:rgba(59,130,246,.15);color:var(--info)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></button>
            <button class="btn-s btn-d" onclick="delRow('reg',${i},'reg')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg></button>
          </td>
        </tr>`;
      }).join('')}
    </table></div>
    ${_pagHTML('reg',pg)}`;
};
window.addReg=function(){
  const eq=S.g('eq')||[];
  const per=_tecnicosDisponibles();
  const hoy=new Date().toISOString().slice(0,10);
  const hora=new Date().toTimeString().slice(0,5);
  sm(`<h3><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="10" height="15" rx="1.5"/><rect x="7.5" y="2" width="5" height="2.5" rx="0.8"/><line x1="7" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/><line x1="7" y1="15" x2="11" y2="15"/></svg> Registrar Mantención</h3>
    <div class="form-row">
      <div class="fg"><label>Equipo *</label>
        <select id="rEq" onchange="rAutoHorom();rMostrarConsumos()">
          <option value="">Seleccionar...</option>
          ${eq.map(e=>`<option value="${escapeHtml(e.sigla)}">${escapeHtml(e.sigla)} — ${escapeHtml(e.modelo)}</option>`).join('')}
        </select>
      </div>
      <div class="fg"><label>Última ejecución</label>
        <input id="rUltEjec" readonly style="opacity:.7;background:var(--bg3);border:1px solid var(--bd);border-radius:4px;padding:6px" placeholder="—">
      </div>
      <div class="fg"><label>Tipo PM *</label>
        <select id="rPM" onchange="rMostrarConsumos()">
          <option>PM1</option><option>PM2</option><option>PM3</option><option>PM4</option><option>Correctivo</option>
        </select>
      </div>
      <div class="fg"><label>Estatus Equipo</label>
        <select id="rEstatusEq">
          <option>Operativo</option>
          <option>Fuera de Servicio</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="fg"><label>Fecha Entrada *</label><input type="date" id="rFecEnt" value="${hoy}" onchange="calcDurReg()"></div>
      <div class="fg"><label>Hora Entrada</label><input type="time" id="rHoraEnt" value="${hora}" onchange="calcDurReg()"></div>
      <div class="fg"><label>Fecha Salida</label><input type="date" id="rFecSal" value="${hoy}" onchange="calcDurReg()"></div>
      <div class="fg"><label>Hora Salida</label><input type="time" id="rHoraSal" onchange="calcDurReg()"></div>
    </div>
    <div class="form-row">
      <div class="fg"><label>Duración (calculada)</label><input id="rDur" readonly placeholder="Auto" style="opacity:.7"></div>
      <div class="fg"><label>Horómetro Real *</label><input type="number" id="rHor" placeholder="Horas actuales"></div>
      <div class="fg"><label>Técnico</label>
        <select id="rTec">
          <option value="">Sin asignar</option>
          ${per.map(p=>`<option>${p}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="fg" style="flex:2"><label>Observaciones / Trabajos realizados</label>
        <input id="rObs" style="width:100%" placeholder="Ej: Cambio filtros, aceite motor, revisión general...">
      </div>
      <div class="fg"><label>Repuestos utilizados</label>
        <input id="rRep" style="width:100%" placeholder="Filtros, lubricantes, repuestos...">
      </div>
    </div>
    <div class="form-row">
    <div class="fg"><label>Turno</label><select id="regTurno"><option>Día</option><option>Noche</option></select></div>
    <div class="fg"><label>Operador Equipo</label><input id="regOperador" placeholder="Quién operaba..."></div>
    <div class="fg"><label>Ubicación</label><input id="regUbicacion" placeholder="Pit, Rampa, Planta..."></div>
    </div>
    <div class="form-row">
    <div class="fg"><label>AST Completado</label><select id="regAST"><option>Sí</option><option>No</option><option>N/A</option></select></div>
    <div class="fg"><label>LOTO Aplicado</label><select id="regLOTO"><option>Sí</option><option>No</option><option>N/A</option></select></div>
    </div>
    <br><button class="btn" onclick="saveReg()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Registrar</button>
    <button class="btn btn-o" onclick="cm()">Cancelar</button>
    <button type="button" class="btn btn-o" onclick="_iniciarRegPorVoz()">${ICONS.mic} Completar por voz</button>`);
};
window.editarReg=function(i){
  const reg=S.g('reg')||[];
  const r=reg[i];if(!r)return;
  const eq=S.g('eq')||[];
  const per=_tecnicosDisponibles();
  sm(`<h3><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg> Editar Registro — ${escapeHtml(r.equipo)} ${r.tipoPM}</h3>
    <div class="form-row">
      <div class="fg"><label>Equipo</label>
        <select id="eRq">
          ${eq.map(e=>`<option${e.sigla===r.equipo?' selected':''}>${escapeHtml(e.sigla)}</option>`).join('')}
        </select>
      </div>
      <div class="fg"><label>Tipo PM</label>
        <select id="ePM">
          ${['PM1','PM2','PM3','PM4','Correctivo'].map(p=>`<option${p===r.tipoPM?' selected':''}>${p}</option>`).join('')}
        </select>
      </div>
      <div class="fg"><label>Estatus Equipo</label>
        <select id="eEstatus">
          <option${r.estatusEq==='Fuera de Servicio'?'':' selected'}>Operativo</option>
          <option${r.estatusEq==='Fuera de Servicio'?' selected':''}>Fuera de Servicio</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="fg"><label>Fecha Entrada</label><input type="date" id="eFecEnt" value="${r.fechaEntrada||r.fechaEjec||''}" onchange="calcDurEdit()"></div>
      <div class="fg"><label>Hora Entrada</label><input type="time" id="eHoraEnt" value="${r.horaEntrada||''}" onchange="calcDurEdit()"></div>
      <div class="fg"><label>Fecha Salida</label><input type="date" id="eFecSal" value="${r.fechaSalida||r.fechaEjec||''}" onchange="calcDurEdit()"></div>
      <div class="fg"><label>Hora Salida</label><input type="time" id="eHoraSal" value="${r.horaSalida||''}" onchange="calcDurEdit()"></div>
    </div>
    <div class="form-row">
      <div class="fg"><label>Duración (calculada)</label><input id="eDur" readonly value="${r.duracion||''}" placeholder="Ingresa horas para calcular" style="opacity:.7"></div>
      <div class="fg"><label>Horómetro Real</label><input type="number" id="eHor" value="${r.horomReal||''}"></div>
      <div class="fg"><label>Técnico</label>
        <select id="eTec">
          <option value="">Sin asignar</option>
          ${per.map(p=>`<option${p===r.tecnico?' selected':''}>${p}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="fg" style="flex:2"><label>Observaciones / Trabajos realizados</label>
        <input id="eObs" value="${escapeHtml(r.obs||'')}" style="width:100%">
      </div>
      <div class="fg"><label>Repuestos utilizados</label>
        <input id="eRep" value="${escapeHtml(r.repuestos||'')}" style="width:100%">
      </div>
    </div>
    <button class="btn" onclick="saveEditReg(${i})"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar cambios</button>
    <button class="btn btn-o" onclick="cm()">Cancelar</button>`);
};
window.calcDurEdit=function(){
  const d=duracionHM($('eFecEnt')?.value,$('eHoraEnt')?.value,$('eFecSal')?.value,$('eHoraSal')?.value);
  if(!d)return;
  $('eDur').value=d.ms<0?'<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> Hora inválida':d.texto;
};
window.saveEditReg=function(i){
  const reg=S.g('reg')||[];
  if(!reg[i])return;
  const fEnt=$('eFecEnt').value,hEnt=$('eHoraEnt').value;
  const fSal=$('eFecSal').value,hSal=$('eHoraSal').value;
  // Mismas validaciones que al crear un registro (saveReg) — antes no existían acá,
  // así que editar aceptaba cualquier combinación de fechas sin avisar.
  if(!fEnt)return toast('⚠️ Ingresa fecha de entrada');
  if(!fechaEsPlausible(fEnt))return toast('⚠️ Fecha de entrada fuera de rango válido — revisa el año');
  if(!fechaEsPlausible(fSal))return toast('⚠️ Fecha de salida fuera de rango válido — revisa el año');
  if(fEnt&&fSal&&fechaEsAnterior(fSal,fEnt))return toast('⚠️ Fecha de salida no puede ser anterior a entrada');
  const dEdit=duracionHM(fEnt,hEnt,fSal,hSal);
  if(dEdit&&dEdit.ms<0)return toast('⚠️ Hora de salida es anterior a entrada — revisa fechas/horas');
  let durStr=reg[i].duracion||'—';
  if(dEdit&&dEdit.ms>0)durStr=dEdit.texto;
  const hr=parseInt($('eHor').value)||reg[i].horomReal||0;
  const nuevoEquipo=$('eRq').value;
  const eq=S.g('eq');
  const e=eq.find(x=>x.sigla===nuevoEquipo);
  // Recalcula cumplimiento (a tiempo/atrasada) contra la fecha de PM esperada que
  // quedó guardada al crear el registro — antes editar la fecha de entrada dejaba el
  // estado/desvío mostrando un valor calculado con la fecha vieja, sin avisar.
  const fechaEsperada=reg[i].fechaProg;
  const desv=fechaEsperada?Math.round((new Date(fEnt)-new Date(fechaEsperada))/864e5):(reg[i].desvioDias||0);
  reg[i]={...reg[i],
    equipo:nuevoEquipo,
    tipo:e?.tipo||reg[i].tipo||'',
    modelo:e?.modelo||reg[i].modelo||'',
    tipoPM:$('ePM').value,
    estatusEq:$('eEstatus').value,
    fechaEntrada:fEnt,horaEntrada:hEnt,
    fechaSalida:fSal,horaSalida:hSal,
    duracion:durStr,
    // duracionH es el número que usan TODOS los totales de HH y costos. Antes se
    // actualizaba solo 'duracion' (el texto que se ve), así que editar las horas
    // de un registro dejaba el número viejo sumando para siempre en los informes.
    duracionH:(dEdit&&dEdit.ms>0)?Math.round(dEdit.horas*10)/10:(reg[i].duracionH||0),
    horomReal:hr,
    desvioDias:desv,
    estado:desv<=0?'<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> ANTICIPADA':'🔴 ATRASADA',
    tecnico:$('eTec').value,
    obs:$('eObs').value,
    repuestos:$('eRep').value,
  };
  S.s('reg',reg);
  // Actualizar horómetro del equipo si corresponde. Guardar 'reg' ANTES de
  // _recalcEq: el anclaje de PM lee el último registro real vía S.g('reg'), así
  // que si se recalculara antes de guardar seguiría viendo el registro viejo.
  if(e&&hr>e.horomActual){e.horomActual=hr;_recalcEq(e);S.s('eq',eq);renderHeader();}
  cm();refreshAll();toast('✅ Registro actualizado');
};
window.rAutoHorom=function(){
  const eq=S.g('eq')||[];
  const e=eq.find(x=>x.sigla===$('rEq').value);
  if(e&&e.horomActual)$('rHor').value=e.horomActual;
  // Auto-detectar tipo PM
  if(e){
    const pm=C.tipoPM(C.proxPM(e.horomActual,e.frecPM||250),e.frecPM||250);
    $('rPM').value=pm;
  }
  // Mostrar última ejecución de este equipo
  if($('rUltEjec')){
    const reg=S.g('reg')||[];
    const sigla=$('rEq').value;
    const ult=reg.filter(r=>r.equipo===sigla).sort((a,b)=>(b.fechaEntrada||'').localeCompare(a.fechaEntrada||''))[0];
    $('rUltEjec').value=ult?(ult.fechaEntrada||ult.fechaEjec||'Sin fecha'):'Sin registros';
  }
}
window.rMostrarConsumos=function(){
  const sig=$('rEq')?.value,pm=$('rPM')?.value;
  if(!sig||!pm)return;
  const cons=getPautasConsumo(sig,pm);
  const div=$('rConsumos'),lista=$('rConsumosLista');
  if(!div||!lista)return;
  if(cons.length===0){div.style.display='none';return;}
  div.style.display='block';
  lista.innerHTML=cons.map(c=>'<span style="display:inline-block;background:var(--bg4);border-radius:4px;padding:2px 8px;margin:2px;font-size:11px">'+
    (c.rep||c.act)+': <b>'+(c.can||0)+'</b></span>').join('');
};
;
window.calcDurReg=function(){
  const d=duracionHM($('rFecEnt').value,$('rHoraEnt').value,$('rFecSal').value,$('rHoraSal').value);
  if(!d)return;
  $('rDur').value=d.ms<0?'<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> Hora inválida':d.texto;
};
window.saveReg=function(){
  const eqSigla=$('rEq').value;
  if(!eqSigla)return toast('⚠️ Selecciona un equipo');
  const hr=parseInt($('rHor').value)||0;
  if(!hr)return toast('⚠️ Ingresa el horómetro real');
  const eq=S.g('eq'),reg=S.g('reg')||[];
  const e=eq.find(x=>x.sigla===eqSigla);
  const tp=$('rPM').value;
  const fEnt=$('rFecEnt').value,hEnt=$('rHoraEnt').value;
  const fSal=$('rFecSal').value,hSal=$('rHoraSal').value;
  const estatusEq=$('rEstatusEq').value;
  // Validaciones extra (v10.1)
  if(!fEnt)return toast('⚠️ Ingresa fecha de entrada');
  if(!fechaEsPlausible(fEnt))return toast('⚠️ Fecha de entrada fuera de rango válido — revisa el año');
  if(!fechaEsPlausible(fSal))return toast('⚠️ Fecha de salida fuera de rango válido — revisa el año');
  if(fEnt&&fSal&&fechaEsAnterior(fSal,fEnt))return toast('⚠️ Fecha de salida no puede ser anterior a entrada');
  const dReg=duracionHM(fEnt,hEnt,fSal,hSal);
  if(dReg&&dReg.ms<0)return toast('⚠️ Hora de salida es anterior a entrada — revisa fechas/horas');
  // Bug real: registrar un PM con FECHA ANTERIOR (ingresado con retraso, ej. "esto
  // pasó hace 2 meses") y su horómetro de esa fecha hacía retroceder el horómetro
  // ACTUAL del equipo al valor viejo, aunque desde entonces ya se hubiera avanzado
  // más. Un registro retroactivo (fecha < última fecha de horómetro conocida) es
  // dato histórico válido, pero nunca debe mover el horómetro en vivo del equipo
  // hacia atrás — solo lo hace el registro más reciente cronológicamente.
  const esRetroactivo=!!(e&&e.fechaHorom&&fechaEsAnterior(fEnt,e.fechaHorom));
  if(!esRetroactivo&&e&&e.horomActual&&hr<e.horomActual){
    if(!confirm('⚠️ REGRESIÓN DE HORÓMETRO\n\n'+eqSigla+' tiene horómetro actual: '+e.horomActual.toLocaleString('es-CL')+'h\nEstás registrando: '+hr.toLocaleString('es-CL')+'h ('+(e.horomActual-hr).toLocaleString('es-CL')+'h menos)\n\n¿Es error de digitación? Cancela y corrige.\n¿Continuar de todas formas?'))return;
  }
  // Calcular duración en horas
  let durH=0,durStr='—';
  if(dReg&&dReg.ms>0){durH=dReg.horas;durStr=dReg.texto;}
  const desv=e?Math.round((new Date(fEnt)-new Date(e.fechaProxPM))/864e5):0;
  reg.push({
    nReg:reg.reduce(function(m,r){return Math.max(m,r.nReg||0);},0)+1,
    equipo:eqSigla,tipo:e?.tipo||'',modelo:e?.modelo||'',tipoPM:tp,
    fechaEntrada:fEnt,horaEntrada:hEnt,
    fechaSalida:fSal,horaSalida:hSal,
    duracion:durStr,duracionH:durH,
    horomReal:hr,horomProg:e?.horomProxPM||0,
    fechaProg:e?.fechaProxPM||'',
    desvioDias:desv,
    estado:desv<=0?'<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> ANTICIPADA':'🔴 ATRASADA',
    estatusEq,
    tecnico:$('rTec').value,
    repuestos:$('rRep').value,
    obs:$('rObs').value,
    turno:$('regTurno')?.value||'',
    operador:$('regOperador')?.value||'',
    ubicacion:$('regUbicacion')?.value||'',
    ast:$('regAST')?.value||'',
    loto:$('regLOTO')?.value||'',
    proxTipo:C.tipoPM(C.proxPM(hr,e?.frecPM||250),e?.frecPM||250),
    horomProx:C.proxPM(hr,e?.frecPM||250),
  });
  // Get consumos from pauta and descount stock
  const consumos_pm=getPautasConsumo(eqSigla,tp);
  if(consumos_pm.length>0){
    reg[reg.length-1].consumosPauta=consumos_pm.map(c=>({rep:c.rep||'',cant:c.can||0}));
  }
  S.s('reg',reg);
  // Actualizar horómetro y estatus del equipo — solo si NO es retroactivo. Un
  // registro con fecha pasada sigue alimentando el historial (para tasaDiariaReal,
  // etc.) pero no toca el horómetro en vivo del equipo, que ya avanzó desde esa fecha.
  if(e){
    if(!esRetroactivo){
      e.horomActual=hr;
      e.fechaHorom=fEnt;
      _recalcEq(e);
      S.s('eq',eq);
    }
    // Fix 1: Alimentar historial de horómetros automáticamente desde el registro
    // (construirLecturaHistorial ya busca la lectura previa CRONOLÓGICAMENTE a fEnt,
    // no la más reciente del historial completo — necesario para que un registro
    // retroactivo calcule su horomIni contra el dato que de verdad venía antes).
    const hist=S.g('hist')||[];
    hist.push(construirLecturaHistorial(hist,eqSigla,fEnt,hr,'reg'));
    S.s('hist',hist);
  }
  // Descontar stock automáticamente
  const logC=descontarStock(consumos_pm,fEnt,eqSigla,tp);
  // Fix 3 (v10.4): OT automática cuando FS — cualquier tipoPM.
  // Chequea si ya existe OT abierta con FS para el mismo equipo → evita duplicados
  let msgOT='';
  if(estatusEq==='Fuera de Servicio'){
    const ot=S.g('ot')||[];
    const yaAbierta=ot.find(function(o){
      return o.sigla===eqSigla && o.estatusEq==='Fuera de Servicio'
        && (o.estadoOT==='Pendiente'||o.estadoOT==='En Ejecución');
    });
    if(yaAbierta){
      msgOT=' · <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> OT FS ya abierta ('+yaAbierta.fecha+') — no se duplica';
    } else {
      const esCorr=tp==='Correctivo';
      ot.unshift({sigla:eqSigla,fecha:fEnt,tipo:esCorr?'Correctivo':tp,
        criticidad:esCorr?'Reparación Inmediata':'FS durante '+tp,
        sintoma:$('rObs').value||(esCorr?'Detención equipo':'FS reportado durante '+tp),
        sistema:'',tecnico:$('rTec').value,estadoOT:'Pendiente',estatusEq:'Fuera de Servicio',
        horom:hr,costo:0,duracion:durStr,fechaIngreso:new Date().toISOString().slice(0,10)});
      S.s('ot',ot);
      msgOT=' · OT '+(esCorr?'correctivo':tp)+' creada';
    }
  }
  // Fix 4: Avisar si el equipo vuelve a Operativo tras haber estado FS
  let msgOp='';
  if(estatusEq==='Operativo'){
    const otAbiertas=(S.g('ot')||[]).filter(o=>o.sigla===eqSigla&&o.estatusEq==='Fuera de Servicio'&&(o.estadoOT==='Pendiente'||o.estadoOT==='En Ejecución'));
    const regFS=reg.filter(r=>r.equipo===eqSigla&&r.estatusEq==='Fuera de Servicio');
    if(otAbiertas.length||regFS.length){
      msgOp=' · 🟢 Vuelve a Operativo'+(otAbiertas.length?' ('+otAbiertas.length+' OT abierta'+(otAbiertas.length!==1?'s':'')+')':'');
    }
  }
  cm();refreshAll();
  const msgRetro=esRetroactivo?' · <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Fecha retroactiva: no se modificó el horómetro actual del equipo':'';
  toast('✅ '+tp+' — '+eqSigla+(logC&&logC.length?' · Stock: -'+logC.length+' items':'')+msgOT+msgOp+msgRetro);
};

// ---- Flujo: Registro PM por voz ----
window.REG_VOZ_PASOS=[
  {campo:'rEq',pregunta:'¿Qué equipo? Di la sigla, por ejemplo TI cinco uno cuatro dos.',tipo:'equipo',requerido:true},
  {campo:'rHor',pregunta:'¿Cuál es el horómetro actual del equipo?',tipo:'numero',requerido:true,requierePositivo:true,etiqueta:'Horómetro'},
  {campo:'rPM',pregunta:'¿Qué tipo de mantención hiciste? Di PM1, PM2, PM3, PM4, o correctivo.',tipo:'opciones',requerido:false},
  {campo:'rObs',pregunta:'¿Qué trabajos realizaste? Puedes decir "omitir" para saltar.',tipo:'texto_opcional',requerido:false},
  {campo:'rRep',pregunta:'¿Qué repuestos o filtros usaste? Di "omitir" si no aplica.',tipo:'texto_opcional',requerido:false},
];
function _regVozResumenTexto(){
  var sig=document.getElementById('rEq').value||'sin equipo';
  var hor=document.getElementById('rHor').value||'sin horómetro';
  var pm=document.getElementById('rPM').value||'';
  var obs=document.getElementById('rObs').value||'';
  return 'Resumen: equipo '+sig+', horómetro '+hor+(pm?', tipo '+pm:'')+(obs?', trabajos: '+obs:'')+'.';
}
window._iniciarRegPorVoz=function(){
  if(!document.getElementById('rEq')&&typeof addReg==='function')addReg();
  _iniciarFlujoVoz(window.REG_VOZ_PASOS,function(){if(typeof saveReg==='function')saveReg();},_regVozResumenTexto);
};

// ═══ IMPORTAR REGISTRO PM ═══
window.importRegCSV=function(){
  sm('<h3><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar Registros PM</h3>'+
    '<p style="font-size:12px;color:var(--tx3)">CSV con columnas: equipo, tipoPM, fechaEntrada, horaEntrada, fechaSalida, horaSalida, horomReal, estatusEq, tecnico, obs<br><br>También acepta JSON (array de objetos).</p>'+
    '<input type="file" id="regFile" accept=".csv,.json" style="margin:12px 0"><br>'+
    '<label><input type="checkbox" id="regReplace"> Reemplazar todo (si no, agrega)</label><br><br>'+
    '<button class="btn" onclick="processImportReg()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Procesar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
};
window.processImportReg=function(){
  var file=$('regFile')?.files[0];if(!file)return toast('⚠️ Selecciona un archivo');
  var replace=$('regReplace')?.checked||false;
  var reader=new FileReader();
  reader.onload=function(e){
    var reg=replace?[]:S.g('reg')||[];var txt=e.target.result.replace(/^\uFEFF/,'');var added=0,dup=0;
    // \u00CDndice de registros ya existentes para no duplicar (equipo|fechaEntrada|horaEntrada|
    // tipoPM|horomReal) \u2014 antes esta importaci\u00F3n no ten\u00EDa NING\u00DAN control anti-duplicado,
    // as\u00ED que reimportar el mismo archivo (o uno con fechas superpuestas) agregaba una
    // copia exacta cada vez. Bug real encontrado: 4 cargas del mismo maestro dejaron 809
    // filas duplicadas (1097 de 288 reales) en TODOS los equipos de la flota.
    var existentes={};
    reg.forEach(function(r){existentes[(r.equipo||'')+'|'+(r.fechaEntrada||'')+'|'+(r.horaEntrada||'')+'|'+(r.tipoPM||'')+'|'+(r.horomReal||'')]=true;});
    try{
      if(file.name.endsWith('.json')){
        var data=JSON.parse(txt);if(Array.isArray(data)){data.forEach(function(r){
          var clave=(r.equipo||'')+'|'+(r.fechaEntrada||'')+'|'+(r.horaEntrada||'')+'|'+(r.tipoPM||'')+'|'+(r.horomReal||'');
          if(existentes[clave]){dup++;return;}
          existentes[clave]=true;reg.push(r);added++;
        });}
      } else {
        var lines=txt.split('\n').filter(function(l){return l.replace(/\r/g,'').trim().length>3;});
        var sep=lines[0].includes(';')?';':lines[0].includes('\t')?'\t':',';
        var hdr=lines[0].split(sep).map(function(h){
          return h.replace(/\r/g,'').replace(/"/g,'').trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
            .replace(/[^\x00-\x7F]/g,'');
        });
        function ci(names){for(var n=0;n<names.length;n++){for(var j=0;j<hdr.length;j++){if(hdr[j].indexOf(names[n])>=0)return j;}}return -1;}
        var iEq=ci(['equipo','sigla']);
        var iTipo=ci(['tipo pm','tipo_pm','tipopm','detalle']);
        var iFE=ci(['fecha entrada','fecha de interv','fechaentrada']);
        if(iFE<0)iFE=ci(['fecha']);
        var iHE=ci(['hora entrada','hora de inicio','horaentrada']);
        if(iHE<0)iHE=ci(['hora inicio']);
        var iFS=ci(['fecha salida','fecha de proyec','fechasalida']);
        var iHS=ci(['hora salida','hora de termino','hora de termi','horasalida']);
        if(iHS<0)iHS=ci(['hora termino']);
        var iHorom=ci(['horometro','horom']);
        var iEst=ci(['estatus','status']);
        var iObs=ci(['observacion','obs','comentario','trabajos']);
        var iTec=ci(['supervisor','tecnico']);
        var iDur=ci(['duraci','duracion']);
        var iTurno=ci(['turno']);
        var iOT=ci(['ot trabajo','ot_trabajo']);
        var iTipoInt=ci(['tipo de intervenci','tipo_intervencion']);

        function gv(vals,idx){return idx>=0&&idx<vals.length?vals[idx].replace(/"/g,'').replace(/\r/g,'').trim():'';}
        function parseFecha(f){if(!f||f==='No Aplica')return '';var m=f.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);if(m){var y=m[3].length===2?'20'+m[3]:m[3];return y+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[1]).slice(-2);}return f;}

        // Fix B: nReg único basado en el máximo existente (no en length)
        var nextNReg=reg.reduce(function(m,r){return Math.max(m,r.nReg||0);},0)+1;
        for(var i=1;i<lines.length;i++){
          var vals=lines[i].split(sep);
          if(vals.length<3)continue;
          var sigla=gv(vals,iEq);
          if(!sigla||sigla.length<2)continue;
          var tipoPM=gv(vals,iTipo).replace(/\s+/g,'');
          var pmMatch=tipoPM.match(/PM\d/i);
          tipoPM=pmMatch?pmMatch[0].toUpperCase():tipoPM||'PM1';
          var tipoInt=gv(vals,iTipoInt);
          if(tipoInt&&tipoInt.toLowerCase().indexOf('correctiv')>=0)tipoPM='Correctivo';
          var fe=parseFecha(gv(vals,iFE));
          var fs=iFS>=0?parseFecha(gv(vals,iFS)):fe;if(!fs)fs=fe;
          var he=gv(vals,iHE);
          var hs=gv(vals,iHS);
          // Calculate duration from hours if no duration column
          var durH=0;var durRaw='';
          if(iDur>=0){durRaw=gv(vals,iDur);var dm=durRaw.match(/(\d+):(\d+)/);durH=dm?parseInt(dm[1])+parseInt(dm[2])/60:parseFloat(durRaw)||0;}
          else if(he&&hs){var hp=he.split(':');var sp=hs.split(':');if(hp.length>=2&&sp.length>=2){durH=Math.round(((parseInt(sp[0])*60+parseInt(sp[1]))-(parseInt(hp[0])*60+parseInt(hp[1])))/60*10)/10;if(durH<0)durH+=24;durRaw=Math.floor(durH)+':'+(''+(Math.round((durH%1)*60))).padStart(2,'0');}}
          var horomStr=gv(vals,iHorom).replace(/\./g,'').replace(/,/g,'');
          var horom=parseInt(horomStr)||0;
          var estatus=gv(vals,iEst)||'Operativo';
          var tecnico=gv(vals,iTec);
          var obs=gv(vals,iObs);
          var turno=iTurno>=0?gv(vals,iTurno):'';
          var ot=iOT>=0?gv(vals,iOT):'';
          if(turno&&turno!=='No Aplica')obs+=(obs?' | ':'')+turno;
          if(ot&&ot!=='No Aplica')obs+=(obs?' | ':'')+'OT: '+ot;

          var claveCsv=sigla+'|'+fe+'|'+he+'|'+tipoPM+'|'+horom;
          if(existentes[claveCsv]){dup++;continue;}
          existentes[claveCsv]=true;
          reg.push({
            nReg:nextNReg++,equipo:sigla,tipoPM:tipoPM,
            fechaEntrada:fe,horaEntrada:he,fechaSalida:fs||fe,horaSalida:hs,
            duracion:durRaw||(durH>0?durH+'h':'—'),duracionH:Math.round(durH*10)/10,
            horomReal:horom,estatusEq:estatus,tecnico:tecnico,obs:obs,
            estado:'A tiempo',fechaEjec:fe
          });added++;
        }
      }
      S.s('reg',reg);cm();refreshAll();
      toast('✅ '+added+' registros '+(replace?'cargados':'agregados')+(dup?' · '+dup+' duplicado(s) omitido(s)':''));
    }catch(err){toast('❌ Error: '+err.message);}
  };reader.readAsText(file,'UTF-8');
};
