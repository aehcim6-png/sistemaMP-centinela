// ═══════════════════════════════════════════════════════════════════════
// NEUMÁTICOS — Control de Flota de Neumáticos
// ═══════════════════════════════════════════════════════════════════════
// window.renderNeu + toda la UI/CRUD exclusiva de esta pestaña: alta/edición
// (addNeu/saveNeu), cambio de neumático (cambiarNeu/saveCambio), existencias
// (instalarDesdeExistencias/confirmarInstalarExistencias), sensores de
// presión (verSensores/instalarSensor/desmontarSensor/confirmarInstalarSensor
// /_desmontarSensorSiTiene), mediciones de remanente (addMedicionNeu/
// saveMedicionNeu), listados y detalle (verNeuLista/neuSort/histPosicion/
// verDetalleNeu/resumenFlotaNeu), y los flujos por voz propios (alta de
// neumático y medición de remanente).
//
// El MOTOR de cálculo (NEU_PRECIOS/NEU_CRITERIOS/neuCriterio/neuPct/
// neuHorasAcum/neuDebeCambiar/neuProxCambio/neuEstadoCalc/neuProyeccion/
// neuMetricas) queda COMPARTIDO en index.html a propósito: lo usan también
// dash.js (neuDebeCambiar), pred.js (neuPct) y el Reporte Ejecutivo de
// Metas & KPIs → Informes (kpi.js, varios) — mismo patrón que computePred
// con Predictivo.
//
// verCodigosQR/_descargarQR (aunque viven físicamente pegados a este bloque)
// son de Configuración, no de acá — quedan compartidos en index.html.
// importarRepuestosKomatsu es de Stock Filtros (ya extraída a stk.js) —
// también queda compartida en index.html, no es de Neumáticos.
//
// Módulo ES real (Fase 3, 2026-08-30, décima tanda: Grupo 5 — depende de
// cfg.js/reg.js, ya migrados en la novena y quinta tanda) — ver nota de
// migración en mov.js (primera tanda, mismo patrón). window.hrsLive
// (asignado dentro de renderNeu, no acá arriba) y window.NEU_VOZ_PASOS/
// NEUMED_VOZ_PASOS/_senFiltroEq/_senFiltroTxt (datos, no funciones) quedan
// sin tocar, mismo criterio que OT_VOZ_PASOS en ot.js (séptima tanda).
// ═══════════════════════════════════════════════════════════════════════

// El horómetro guardado en 'equipos' (horomActual) se actualiza solo
// periódicamente (import manual/Excel) — puede quedar rezagado frente a los
// horómetros que ya se registraron por OT en 'correctivos' para ese mismo
// equipo. Si se usa horomActual tal cual para timbrar un evento "ahora"
// (cambio/reasignación de neumático), un horomActual desactualizado escribe
// un horómetro que retrocede en el tiempo — encontrado en auditoría 2026-08
// en varios equipos (CN-4656, CN-9500, CN-9501, CN-9503, CN-9507...). Nunca
// bajar del máximo horómetro ya visto para ese equipo.

// Estados que significan "salió del equipo" — para estos, ultimaMedicion
// guarda la fecha de salida (no la de una medición real) y se muestra en la
// columna F.Salida de la tabla. No existe columna fechaBaja en Supabase
// (el campo lo setea cambiarNeu/saveCambio pero nunca se persiste ni se
// muestra en ningún lado), así que ultimaMedicion es el único dato real.
const ESTADOS_RETIRO_NEU=['Stock','De baja','Baja Desgaste','Baja Imprevisto'];

function _horomEquipoSeguro(sig){
  const eq=S.g('eq')||[];
  const e=eq.find(function(x){return x.sigla===sig;});
  const base=e?(parseFloat(e.horomActual)||0):0;
  const ot=S.g('ot')||[];
  let maxOt=0;
  ot.forEach(function(r){
    if(r.sigla===sig){
      const h=parseFloat(r.horom);
      if(!isNaN(h)&&h>maxOt)maxOt=h;
    }
  });
  return Math.max(base,maxOt);
}
// Horas reales acumuladas por un neumático HASTA AHORA (horómetro actual del
// equipo donde está montado, menos el horómetro que tenía al instalarse) —
// mismo cálculo que window.hrsLive() usa para mostrarlas en pantalla mientras
// está Operativo. Se llama justo ANTES de archivar el neumático a Stock/De
// baja, para CONGELAR ese número en la fila archivada (bug real, auditoría
// 2026-08-21, a pedido del usuario: "el neumático en stock, ¿tendré claro las
// horas de uso?" — no, hasta ahora no: el valor solo se calculaba al mostrar
// la tabla, nunca se guardaba de vuelta, así que un neumático retirado quedaba
// con las horas de cuando se instaló por última vez, normalmente 0, no las que
// realmente trabajó).
function _horasNeuAlRetiro(n){
  const eq=S.g('eq')||[];
  const e=eq.find(function(x){return x.sigla===n.sigla;});
  if(n.horomInstalacion==null||!e)return n.horasAcum||0;
  const base=n.horasBase!=null?n.horasBase:(n.horasAcum||0);
  return Math.max(0,Math.round(base+Math.max(0,(e.horomActual||0)-n.horomInstalacion)));
}

export function renderNeu(){
  const neu=S.g('neu')||[];
  const eqMapN={};(S.g('eq')||[]).forEach(e=>eqMapN[e.sigla]=e);
  window.hrsLive=n=>{
    const e=eqMapN[n.sigla];
    if(n.horomInstalacion!=null&&e&&(n.estado==='Operativo'||!n.estado)){
      const base=n.horasBase!=null?n.horasBase:(n.horasAcum||0);
      return{h:Math.round(base+Math.max(0,(e.horomActual||0)-n.horomInstalacion)),live:true};
    }
    return{h:Math.round(n.horasAcum||0),live:false};
  };
  const fEq=$('fNeuEq')?.value||'',fTipo=$('fNeuTipo')?.value||'',fEstado=$('fNeuEstado')?.value||'';
  const fil=neu.filter(n=>(!fEq||n.sigla===fEq)&&(!fTipo||n.tipoEquipo===fTipo)&&(!fEstado||(n.estado||'Operativo')===fEstado));
  // Ordenamiento por columna
  if(window._neuSort){
    const{key,dir}=window._neuSort;
    fil.sort((a,b)=>{
      let va=a[key],vb=b[key];
      if(key==='pctRemanente'){va=neuPct(a)||0;vb=neuPct(b)||0;}
      else if(key==='remanente'){va=va||0;vb=vb||0;}
      if(key==='hAcum'){va=(neuProyeccion(a)||{}).hrsAcumNeu??hrsLive(a).h;vb=(neuProyeccion(b)||{}).hrsAcumNeu??hrsLive(b).h;}
      if(typeof va==='string'){va=va||'';vb=vb||'';return dir*va.localeCompare(vb);}
      return dir*((va||0)-(vb||0));
    });
  }
  // Crítico = debe cambiarse YA (delantera pasada de horas o remanente en el límite de
  // retiro ~10mm), NO por % de goma bajo — un trasero al 25% aún tiene vida (se corre
  // hasta ~10mm/tela). Ver neuDebeCambiar / neuProxCambio.
  // Bug real (auditoría 2026-08): "Costo est. cambiar ya" usaba un precio parejo
  // (~USD 12.500/un) para CUALQUIER neumático crítico, aunque el sistema ya tiene
  // precios reales por tipo en NEU_PRECIOS (desde $195.304 un delantero de bus
  // hasta $19.601.166 uno de cargador CF) — podía salir hasta ~100x errado según
  // qué tipo de equipo tuviera los críticos. Ahora suma el precio real por tipo.
  const criticosNeu=fil.filter(neuDebeCambiar);
  const crit=criticosNeu.length;
  const costoCambiarYa=criticosNeu.reduce(function(s,n){return s+(neuPrecio(n).precio||0);},0);
  const prox=fil.filter(neuProxCambio).length;
  const sensoresOperativos=(S.g('sen')||[]).filter(s=>s.estado==='Operativo').length;
  const costoSensoresUSD=sensoresOperativos*SEN_PRECIO.usd;
  const eqs=[...new Set(neu.map(n=>n.sigla))].sort();
  const estadosNeu=[...new Set(neu.map(n=>n.estado||'Operativo'))].sort();
  const pg=_pagSlice('neu',fil);
  $('s-neu').innerHTML=`
    <div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="3"/></svg> Control de Neumáticos</div><div class="sec-s">${neu.length} neumáticos en ${eqs.length} equipos · 🔴 ${crit} para cambiar ya</div></div>
      <button class="btn" onclick="addNeu()">+ Nuevo</button> <button class="btn btn-o" onclick="importNeu()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar CSV</button> <button class="btn btn-o" onclick="resumenFlotaNeu()"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Resumen flota</button> <button class="btn btn-o" onclick="instalarDesdeExistencias()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 10 A6 6 0 0 1 15.5 6.5" fill="none"/><polyline points="15.5,3 15.5,6.5 12,6.5"/><path d="M16 10 A6 6 0 0 1 4.5 13.5" fill="none"/><polyline points="4.5,17 4.5,13.5 8,13.5"/></svg> Instalar desde Existencias</button> <button class="btn btn-o" onclick="verSensores()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="8" width="8" height="6" rx="1"/><line x1="8" y1="8" x2="8" y2="4"/><line x1="12" y1="8" x2="12" y2="4"/><line x1="10" y1="14" x2="10" y2="17"/></svg> Sensores</button> <button class="btn btn-o" onclick="_activarLeerChequeoNeu()">📷 Leer chequeo (foto)</button><input type="file" id="neuChequeoFoto" accept="image/*" capture="environment" style="display:none" onchange="_leerChequeoNeuFotoSeleccionada(this)">
    </div>
    <div class="cards">
      <div class="card"><div class="card-t">Total</div><div class="card-v">${neu.length}</div></div>
      <div class="card" onclick="verNeuLista('cambiar')" style="cursor:pointer" title="Ver cuáles son"><div class="card-t" style="color:var(--danger)">Cambiar ya <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2 10 A9 5 0 0 1 18 10 A9 5 0 0 1 2 10 Z" fill="none"/><circle cx="10" cy="10" r="2.3"/></svg></div><div class="card-v" style="color:var(--danger)">${crit}</div><div class="card-s">delantera +2.800h o goma ≤límite · clic para ver</div></div>
      <div class="card" onclick="verNeuLista('proximo')" style="cursor:pointer" title="Ver cuáles son"><div class="card-t" style="color:var(--warn)">Próximos (≤30 días) <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2 10 A9 5 0 0 1 18 10 A9 5 0 0 1 2 10 Z" fill="none"/><circle cx="10" cy="10" r="2.3"/></svg></div><div class="card-v" style="color:var(--warn)">${prox}</div><div class="card-s">clic para ver</div></div>
      <div class="card"><div class="card-t">Costo est. cambiar ya</div><div class="card-v" style="color:var(--ac)">$${fn(costoCambiarYa)}</div><div class="card-s">Precio real por tipo (NEU_PRECIOS)</div></div>
      <div class="card"><div class="card-t">Costo sensores (Operativo)</div><div class="card-v" style="color:var(--ac)">US$${fn(costoSensoresUSD)}</div><div class="card-s">${sensoresOperativos} × US$${SEN_PRECIO.usd} + IVA · ${SEN_PRECIO.proveedor}</div></div>
    </div>
    <div class="toolbar">
      <select id="fNeuEq" onchange="window._pag.neu=1;renders.neu()"><option value="">Todos equipos</option>${eqs.map(s=>`<option${s===fEq?' selected':''}>${escapeHtml(s)}</option>`).join('')}</select>
      <select id="fNeuTipo" onchange="window._pag.neu=1;renders.neu()"><option value="">Todos tipos</option><option value="CAEX">CAEX</option><option value="CF">Cargador</option><option value="MN">Motoniveladora</option><option value="ALJ">Aljibe</option><option value="CAM">Camioneta</option><option value="BUS">Bus</option></select>
      <select id="fNeuEstado" onchange="window._pag.neu=1;renders.neu()"><option value="">Todos estados</option>${estadosNeu.map(s=>`<option${s===fEstado?' selected':''}>${escapeHtml(s)}</option>`).join('')}</select>
    </div>
    ${_pagHTML('neu',pg)}
    <datalist id="dlMarcasNeu"><option value="MICHELIN"><option value="BRIDGESTONE"><option value="GOODYEAR"><option value="WESTLAKE"></datalist>
    <datalist id="dlSeriesNeu">${[...new Set(neu.map(n=>n.serie).filter(Boolean))].sort().map(s=>`<option value="${escapeHtml(s)}">`).join('')}</datalist>
    <div class="tbl-wrap"><table>
      <tr><th onclick="neuSort('sigla')" style="cursor:pointer" title="Click para ordenar">Equipo ⇅</th><th onclick="neuSort('tipoEquipo')" style="cursor:pointer">Tipo ⇅</th><th onclick="neuSort('posicion')" style="cursor:pointer">Pos. ⇅</th><th onclick="neuSort('serie')" style="cursor:pointer">Serie ⇅</th><th onclick="neuSort('numSensor')" style="cursor:pointer">Sensor ⇅</th><th onclick="neuSort('marca')" style="cursor:pointer">Marca ⇅</th><th>Medida</th><th onclick="neuSort('fechaInst')" style="cursor:pointer">F.Inst. ⇅</th><th onclick="neuSort('hAcum')" style="cursor:pointer" title="🔗 = proyectado en vivo desde horómetro del equipo">H.Acum <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M8 12 L6 14 a3 3 0 0 1 -4 -4 L4 8 a3 3 0 0 1 4 -4 L10 6" fill="none"/><path d="M12 8 L14 6 a3 3 0 0 1 4 4 L16 12 a3 3 0 0 1 -4 4 L10 14" fill="none"/></svg> ⇅</th><th onclick="neuSort('remanente')" style="cursor:pointer">Remanente ⇅</th><th onclick="neuSort('pctRemanente')" style="cursor:pointer">% ⇅</th><th title="Proyección con historial de mediciones (TD/RUL) — lo mismo que ve el 🔍, resumido acá para no tener que entrar a cada neumático">Vida Restante</th><th onclick="neuSort('estado')" style="cursor:pointer">Estado ⇅</th><th title="Fecha en que el neumático salió del equipo (queda registrada en ultimaMedicion al pasar a Stock/De baja) — vacío para los que siguen montados">F.Salida</th><th>↺</th></tr>
      ${pg.items.map((n,_)=>{
        const i=neu.indexOf(n);
        const pLive=neuPct(n);
        const sinDatosRem=pLive==null;
        const p=pLive||0;
        const col=sinDatosRem?'var(--tx3)':p<30?'var(--danger)':p<50?'var(--warn)':'var(--ok)';
        const lr=hrsLive(n);
        const proy=neuProyeccion(n);
        const proyCol=proy?(proy.diasRestantes<30?'var(--danger)':proy.diasRestantes<60?'var(--warn)':'var(--ok)'):'var(--tx3)';
        // El resaltado de la fila refleja ACCIÓN (cambiar ya / próximo), no % de goma:
        // un trasero con poca goma pero vida por delante no se pinta de rojo.
        const cambiarYa=neuDebeCambiar(n), proxCambio=neuProxCambio(n);
        return`<tr style="${cambiarYa?'background:rgba(239,68,68,.05)':proxCambio?'background:rgba(234,179,8,.04)':''}">
          <td class="mono" style="font-size:11px">${escapeHtml(n.sigla)}</td>
          <td style="font-size:10px;color:var(--tx2)">${n.tipoEquipo}</td>
          ${edCell(n.posicion,'posicion',i,'neu')}
          <td class="ed"><input type="text" list="dlSeriesNeu" value="${escapeHtml(n.serie||'')}" onchange="cev('neu',${i},'serie',this.value)" title="Al mover un neumático a otra posición/equipo, elige su serie de la lista en vez de volver a tipearla — evita typos que rompen el historial de mediciones"></td>
          ${edCell(n.numSensor||'','numSensor',i,'neu')}
          <td class="ed"><input type="text" list="dlMarcasNeu" value="${escapeHtml(n.marca||'')}" onchange="cev('neu',${i},'marca',this.value)"></td>
          ${edCell(n.medida||'','medida',i,'neu')}
          ${edCell(n.fechaInst||'','fechaInst',i,'neu','date')}
          <td class="mono" style="font-size:11px" title="${(proy&&proy.hrsAcumReal?'📏 Sumado de '+proy.confianza.match(/\d+/)+' mediciones reales':lr.live?'🔗 En línea con horómetro (sin mediciones suficientes para calcular real)':'⚠️ Manual')+(n.ultimaMedicion?' · Última medición: '+n.ultimaMedicion:' · Sin mediciones registradas')}">${fn(proy?proy.hrsAcumNeu:lr.h)}h${proy&&proy.hrsAcumReal?' <span style="color:var(--ac);font-size:9px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="2" y="7" width="16" height="6" rx="1"/><line x1="5" y1="7" x2="5" y2="9.5"/><line x1="8" y1="7" x2="8" y2="9.5"/><line x1="11" y1="7" x2="11" y2="9.5"/><line x1="14" y1="7" x2="14" y2="9.5"/></svg></span>':lr.live?' <span style="color:var(--ok);font-size:9px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M8 12 L6 14 a3 3 0 0 1 -4 -4 L4 8 a3 3 0 0 1 4 -4 L10 6" fill="none"/><path d="M12 8 L14 6 a3 3 0 0 1 4 4 L16 12 a3 3 0 0 1 -4 4 L10 14" fill="none"/></svg></span>':''}</td>
          ${edCell(n.remanente!=null?n.remanente:'','remanente',i,'neu','number')}
          ${(function(){
            // Gauge circular (2026-08-24, mismo lenguaje que Dashboard/Equipos/
            // Alertas PM4/Vencimientos/Stock): reemplaza la barra lineal de antes.
            // Se llena al revés que el % mostrado — menos goma restante = anillo
            // más lleno/más urgente, mismo criterio que Stock. Sin dato real
            // (sinDatosRem) el anillo queda solo con el track, sin arco de color.
            var pFill=sinDatosRem?0:Math.max(0,Math.min(100,100-p));
            var _nC=2*Math.PI*10,_nOff=Math.round((_nC*(1-pFill/100))*100)/100;
            return '<td><div style="display:inline-flex;align-items:center;gap:5px"><svg viewBox="0 0 26 26" width="20" height="20" style="transform:rotate(-90deg);flex:none"><circle cx="13" cy="13" r="10" fill="none" stroke="var(--bg3)" stroke-width="3.5"></circle>'+(sinDatosRem?'':'<circle class="gauge-ring" cx="13" cy="13" r="10" fill="none" stroke="'+col+'" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="'+_nC+'" stroke-dashoffset="'+_nC+'" data-off="'+_nOff+'"></circle>')+'</svg><span style="color:'+col+';font-size:11px" title="'+(sinDatosRem?'Nunca se registró una medición de remanente para este neumático':'')+'">'+(sinDatosRem?'— sin datos':p+'%')+'</span></div></td>';
          })()}
          <td style="font-size:10px;color:${proyCol}" title="${proy?'Motivo: '+escapeHtml(proy.motivoCambio)+' · Confianza: '+escapeHtml(proy.confianza):'Sin mediciones suficientes para proyectar'}">${proy?'≈'+proy.diasRestantes+'d ('+fn(proy.hrsRestantes)+'h)':'—'}</td>
          ${edCell(n.estado||'Operativo','estado',i,'neu','select',['Operativo','Evaluación','Reparación','Disponible Usado','Stock','Fuera de servicio','Baja Desgaste','Baja Imprevisto'])}
          <td class="mono" style="font-size:11px;color:var(--tx2)">${ESTADOS_RETIRO_NEU.includes(n.estado)?escapeHtml(n.ultimaMedicion||'—'):'—'}</td>
          <td>
            <button class="btn-s" style="background:rgba(234,179,8,.15);color:var(--warn)" onclick="cambiarNeu(${i})" title="Cambio">↺</button>
            <button class="btn-s" style="background:rgba(99,102,241,.15);color:#818cf8" onclick="addMedicionNeu(${i})" title="Medir"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="2" y="7" width="16" height="6" rx="1"/><line x1="5" y1="7" x2="5" y2="9.5"/><line x1="8" y1="7" x2="8" y2="9.5"/><line x1="11" y1="7" x2="11" y2="9.5"/><line x1="14" y1="7" x2="14" y2="9.5"/></svg></button>
            <button class="btn-s" style="background:rgba(16,185,129,.15);color:var(--ok)" onclick="verDetalleNeu(${i})" title="Gráfico"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8.5" cy="8.5" r="5.5"/><line x1="12.7" y1="12.7" x2="17.5" y2="17.5"/></svg></button>
            <button class="btn-s" style="background:rgba(245,158,11,.15);color:var(--ac)" onclick="histPosicion('${escapeHtml(n.sigla)}','${escapeHtml(n.posicion)}',${n.numPos||0})" title="Historial de esta posición">📍</button>
            <button class="btn-s" style="background:var(--bg3)" onclick="verHistorialNeu(${i})" title="Historial de este neumático (equipos/posiciones por los que pasó)"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg></button>
          </td>
        </tr>`;
      }).join('')}
    </table></div>${_pagHTML('neu',pg)}`;
  if(typeof _animGauges==='function')_animGauges('s-neu');
};

// Listado de neumáticos que hay que cambiar YA (o próximos) al apretar la tarjeta —
// muestra equipo, posición, serie y el motivo concreto, sin tener que revisar equipo
// por equipo. Ordena por urgencia (menos días restantes primero).
export function verNeuLista(modo){
  const neu=S.g('neu')||[];
  const esCambiar=modo!=='proximo';
  const lista=neu.filter(esCambiar?neuDebeCambiar:neuProxCambio)
    .map(n=>({n,proy:neuProyeccion(n),ec:neuEstadoCalc(n)}))
    .sort((a,b)=>((a.proy?a.proy.diasRestantes:0)-(b.proy?b.proy.diasRestantes:0)));
  const titulo=esCambiar?'🔴 Neumáticos para cambiar YA':'🟡 Neumáticos próximos (≤30 días)';
  if(!lista.length){sm(`<h3>${titulo}</h3><p style="color:var(--tx3)">No hay neumáticos en esta condición ahora mismo. 👍</p><button class="btn btn-o" onclick="cm()">Cerrar</button>`);return;}
  const filas=lista.map(({n,proy,ec})=>{
    const dias=proy?(proy.diasRestantes<=0?'ahora':'≈'+proy.diasRestantes+'d'):'—';
    const idx=neu.indexOf(n);
    return `<tr style="border-bottom:1px solid var(--bd)">
      <td style="padding:6px"><b>${escapeHtml(n.sigla)}</b></td>
      <td>${escapeHtml(n.posicion||'')}</td>
      <td class="mono" style="font-size:11px">${escapeHtml(n.serie||'—')}</td>
      <td style="text-align:center">${n.remanente!=null?n.remanente+'mm':'—'}</td>
      <td style="color:${ec.col};font-size:11px">${ec.ico} ${escapeHtml(ec.txt)}</td>
      <td style="text-align:center;color:${esCambiar?'var(--danger)':'var(--warn)'}">${dias}</td>
      <td><button class="btn-s" style="background:rgba(16,185,129,.15);color:var(--ok)" onclick="cm();verDetalleNeu(${idx})" title="Ver detalle"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8.5" cy="8.5" r="5.5"/><line x1="12.7" y1="12.7" x2="17.5" y2="17.5"/></svg></button></td>
    </tr>`;}).join('');
  sm(`<div style="max-width:720px"><h3>${titulo} <span style="color:var(--tx3);font-size:13px">(${lista.length})</span></h3>
    <div style="overflow-x:auto"><table style="width:100%;font-size:12px">
      <tr style="background:var(--bg3)"><th style="padding:6px;text-align:left">Equipo</th><th style="text-align:left">Posición</th><th style="text-align:left">Serie</th><th>Rem.</th><th style="text-align:left">Motivo</th><th>Restante</th><th></th></tr>
      ${filas}
    </table></div>
    <button class="btn btn-o" style="margin-top:12px" onclick="cm()">Cerrar</button></div>`);
};

// ---- Flujo: Nuevo Neumático por voz ----
// El texto de la pregunta usa las mismas palabras que aparecen en las
// opciones del formulario (CAEX, Cargador, Motoniveladora...) a propósito:
// el comparador calza contra el <option> real, así que si la pregunta ya
// "enseña" la palabra exacta, la persona la repite sin darse cuenta.
window.NEU_VOZ_PASOS=[
  {campo:'nNEq',pregunta:'¿Qué equipo? Di la sigla.',tipo:'equipo',requerido:true},
  {campo:'nNTipo',pregunta:'¿Qué tipo de equipo es? Di CAEX, cargador, motoniveladora, aljibe, camioneta, o bus.',tipo:'opciones',requerido:false},
  {campo:'nNPos',pregunta:'¿En qué posición va? Por ejemplo delantero izquierdo.',tipo:'texto_opcional',requerido:false},
  {campo:'nNSerie',pregunta:'¿Cuál es el número de serie del neumático?',tipo:'texto',requerido:true},
  {campo:'nNMarca',pregunta:'¿Qué marca es? Di Michelin, Bridgestone, Goodyear, o Westlake.',tipo:'opciones',requerido:false},
];
function _neuVozResumenTexto(){
  var sig=document.getElementById('nNEq').value||'sin equipo';
  var serie=document.getElementById('nNSerie').value||'sin serie';
  var marca=document.getElementById('nNMarca').value||'';
  var pos=document.getElementById('nNPos').value||'';
  return 'Resumen: neumático para '+sig+(pos?', posición '+pos:'')+', serie '+serie+(marca?', marca '+marca:'')+'.';
}
export function _iniciarNeuPorVoz(){
  if(!document.getElementById('nNEq')&&typeof addNeu==='function')addNeu();
  _iniciarFlujoVoz(window.NEU_VOZ_PASOS,function(){if(typeof saveNeu==='function')saveNeu();},_neuVozResumenTexto);
};

// ---- Flujo: Medición de Remanente de Neumático por voz ----
// Distinto a los demás: antes de poder abrir el formulario real hay que
// encontrar CUÁL neumático (equipo + posición), porque addMedicionNeu()
// necesita su índice. Una vez identificado, se apoya en el mismo motor
// genérico de siempre para el resto de los campos.
window.NEUMED_VOZ_PASOS=[
  {campo:'mRemExt',pregunta:'¿Cuál es el remanente exterior, en milímetros?',tipo:'numero',requerido:false,etiqueta:'Remanente exterior'},
  {campo:'mRemInt',pregunta:'¿Cuál es el remanente interior, en milímetros?',tipo:'numero',requerido:false,etiqueta:'Remanente interior'},
  {campo:'mPres',pregunta:'¿Cuál es la presión en PSI? Di "omitir" si no la mediste.',tipo:'numero_opcional',requerido:false,etiqueta:'Presión'},
  {campo:'mTemp',pregunta:'¿Y la temperatura? Di "omitir" si no la mediste.',tipo:'numero_opcional',requerido:false,etiqueta:'Temperatura'},
  {campo:'mObs',pregunta:'¿Alguna observación? Di "omitir" si no.',tipo:'texto_opcional',requerido:false},
];
function _neuMedVozResumenTexto(){
  var ext=document.getElementById('mRemExt').value||'sin dato';
  var int=document.getElementById('mRemInt').value||'sin dato';
  return 'Resumen: remanente exterior '+ext+' milímetros, interior '+int+' milímetros.';
}
export function _continuarMedicionPorVoz(neuIdx){
  _iniciarFlujoVoz(window.NEUMED_VOZ_PASOS,function(){if(typeof saveMedicionNeu==='function')saveMedicionNeu(neuIdx);},_neuMedVozResumenTexto);
};
export function _iniciarMedicionNeuPorVoz(){
  _hablarLuego('¿Qué equipo?',_neuMedVozEscucharEquipo);
};
function _neuMedVozEscucharEquipo(){
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){toast('⚠️ Voz no disponible en este navegador — funciona en Chrome/Edge');return;}
  var rec=new SR();
  rec.lang='es-CL';rec.interimResults=false;rec.maxAlternatives=1;
  rec.onresult=function(e){_neuMedVozCapturarEquipo(e.results[0][0].transcript);};
  rec.onerror=function(e){if(e.error!=='no-speech')toast('⚠️ Error de voz: '+e.error);};
  try{rec.start();}catch(e){}
}
function _neuMedVozCapturarEquipo(transcript){
  toast('🎙️ "'+transcript+'"');
  if(_normVoz(transcript)==='cancelar'){_hablar('Cancelado.');return;}
  var siglas=(S.g('eq')||[]).map(function(e){return e.sigla;});
  var tN=_normVoz(transcript).replace(/[\s-]/g,'');
  var idx=siglas.findIndex(function(s){var sN=_normVoz(s).replace(/[\s-]/g,'');return sN&&(tN.indexOf(sN)>=0||sN.indexOf(tN)>=0);});
  if(idx<0){_hablarLuego('No encontré ese equipo. Repite la sigla.',_neuMedVozEscucharEquipo);return;}
  var sigla=siglas[idx];
  var neu=S.g('neu')||[];
  var disponibles=neu.map(function(n,i){return{n:n,i:i};}).filter(function(x){return x.n.sigla===sigla&&x.n.estado==='Operativo';});
  if(!disponibles.length){_hablarLuego('No encontré neumáticos operativos en '+sigla+'. Repite otro equipo, o di cancelar.',_neuMedVozEscucharEquipo);return;}
  if(disponibles.length===1){_neuMedVozAbrir(disponibles[0].i);return;}
  window._neuMedVozCandidatos=disponibles;
  var posiciones=disponibles.map(function(x){return x.n.posicion;}).join(', ');
  _hablarLuego('Tiene varias posiciones: '+posiciones+'. ¿Cuál?',_neuMedVozEscucharPosicion);
}
function _neuMedVozEscucharPosicion(){
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR)return;
  var rec=new SR();
  rec.lang='es-CL';rec.interimResults=false;rec.maxAlternatives=1;
  rec.onresult=function(e){_neuMedVozCapturarPosicion(e.results[0][0].transcript);};
  rec.onerror=function(e){if(e.error!=='no-speech')toast('⚠️ Error de voz: '+e.error);};
  try{rec.start();}catch(e){}
}
// Palabras con las que la gente describe una posición (delantero, trasero...)
// vs. cómo quedan abreviadas en el dato real (Del, Tra...) — sin esto,
// "delantero izquierdo" nunca calzaba contra "P1-DelIzq".
var _NEU_POS_ABREV={delantero:'del',delantera:'del',trasero:'tra',trasera:'tra',
  izquierdo:'izq',izquierda:'izq',derecho:'der',derecha:'der',
  exterior:'ext',interior:'int',medio:'med',media:'med'};
function _normPosicionVoz(s){
  var t=_normVoz(s);
  Object.keys(_NEU_POS_ABREV).forEach(function(w){
    t=t.replace(new RegExp('\\b'+w+'\\b','g'),_NEU_POS_ABREV[w]);
  });
  return t.replace(/[\s-]/g,'');
}
function _neuMedVozCapturarPosicion(transcript){
  toast('🎙️ "'+transcript+'"');
  if(_normVoz(transcript)==='cancelar'){_hablar('Cancelado.');return;}
  var cand=window._neuMedVozCandidatos||[];
  // 1) Si dice el número ("p uno", "posición tres"), calza por NÚMERO exacto —
  //    nunca por texto parcial, porque "P1" es substring de "P10" y viceversa.
  var nDicho=_parseNumeroVoz(transcript);
  if(!isNaN(nDicho)){
    var porNumero=cand.filter(function(x){
      var m=(x.n.posicion||'').match(/^p(\d+)/i);
      return m&&parseInt(m[1],10)===nDicho;
    });
    if(porNumero.length===1){_neuMedVozAbrir(porNumero[0].i);return;}
  }
  // 2) Si no, intenta por descripción (delantero/trasero/izquierdo/derecho/...)
  var t=_normPosicionVoz(transcript);
  var mejor=-1,mejorLen=0;
  cand.forEach(function(x,ci){
    var pn=_normPosicionVoz(x.n.posicion);
    if(pn&&(t.indexOf(pn)>=0||pn.indexOf(t)>=0)&&pn.length>mejorLen){mejor=ci;mejorLen=pn.length;}
  });
  if(mejor<0){_hablarLuego('No identifiqué esa posición. Puedes decir el número, por ejemplo posición tres, o describirla, por ejemplo delantero izquierdo.',_neuMedVozEscucharPosicion);return;}
  _neuMedVozAbrir(cand[mejor].i);
}
function _neuMedVozAbrir(neuIdx){
  var n=(S.g('neu')||[])[neuIdx];
  addMedicionNeu(neuIdx);
  _iniciarFlujoVoz(window.NEUMED_VOZ_PASOS,function(){if(typeof saveMedicionNeu==='function')saveMedicionNeu(neuIdx);},_neuMedVozResumenTexto,n?('Posición '+n.posicion+' encontrada.'):null);
}

// ---- NEUMÁTICOS ----
/* renders.neu viejo eliminado v16.6 - usaba versión sin edición */
export function addNeu(){
  const eq=S.g('eq')||[];
  sm(`<h3><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="3"/></svg> Nuevo Neumático</h3>
    <div class="form-row">
      <div class="fg"><label>Equipo *</label><select id="nNEq"><option value="">Seleccionar...</option>${eq.map(e=>`<option>${escapeHtml(e.sigla)}</option>`).join('')}</select></div>
      <div class="fg"><label>Tipo equipo</label><select id="nNTipo"><option value="CAEX">CAEX</option><option value="CF">Cargador</option><option value="MN">Motoniveladora</option><option value="ALJ">Aljibe</option><option value="CAM">Camioneta</option><option value="BUS">Bus</option></select></div>
    </div>
    <div class="form-row">
      <div class="fg"><label>Posición</label><input id="nNPos" placeholder="Ej: P1-DelIzq"></div>
      <div class="fg"><label>N° Posición</label><input type="number" id="nNNumPos" min="1" max="10" value="1"></div>
    </div>
    <div class="form-row">
      <div class="fg"><label>N° Serie *</label><input id="nNSerie" list="dlSeriesNeu" title="Si este neumático viene de otro equipo/posición, elige su serie de la lista en vez de retiparla — un typo rompe el enlace con su historial de mediciones"></div>
      <div class="fg"><label>N° Sensor</label><input id="nNSensor"></div>
    </div>
    <div class="form-row">
      <div class="fg"><label>Marca</label><select id="nNMarca"><option>MICHELIN</option><option>BRIDGESTONE</option><option>GOODYEAR</option><option>WESTLAKE</option></select></div>
      <div class="fg"><label>Medida</label><input id="nNMedida" value="27.00R49"></div>
    </div>
    <div class="form-row">
      <div class="fg"><label>F. Instalación</label><input type="date" id="nNFec" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="fg"><label>Horas acumuladas</label><input type="number" id="nNAcum" value="0"></div>
      <div class="fg"><label>Remanente actual (mm)</label><input type="number" id="nNRem"></div>
    </div>
    <button class="btn" onclick="saveNeu()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button> <button type="button" class="btn btn-o" onclick="_iniciarNeuPorVoz()">${ICONS.mic} Completar por voz</button>`);
};
export function saveNeu(){
  const sig=$('nNEq').value,serie=$('nNSerie').value.trim();
  if(!sig)return toast('⚠️ Selecciona equipo');
  if(!serie)return toast('⚠️ Ingresa N° serie');
  const pos=$('nNPos').value;
  const neu=S.g('neu')||[];
  // Si ya hay un neumático operativo en ese equipo+posición, no pueden convivir dos
  // — se saca el antiguo a Existencias automáticamente (mismo criterio que
  // confirmarInstalarExistencias) para no dejar dos filas "Operativo" en el mismo lugar.
  const ocupadoIdx=neu.findIndex(x=>x.sigla===sig&&x.posicion===pos&&x.estado==='Operativo');
  if(ocupadoIdx>=0){
    if(!confirm(`Ya hay un neumático operativo en ${sig} ${pos} (serie ${neu[ocupadoIdx].serie}). ¿Moverlo a Existencias e instalar este nuevo en su lugar?`))return;
    const horasRetiroOcup=_horasNeuAlRetiro(neu[ocupadoIdx]);
    _desmontarSensorSiTiene(neu[ocupadoIdx].serie);
    neu[ocupadoIdx].estado='Stock';
    neu[ocupadoIdx].numSensor='';
    neu[ocupadoIdx].fechaBaja=new Date().toISOString().slice(0,10);
    neu[ocupadoIdx].horasAcum=horasRetiroOcup;
    neu[ocupadoIdx].horasBase=null;
  }
  const rem=parseFloat($('nNRem').value)||null;
  const tipo=$('nNTipo').value;
  const marca=$('nNMarca').value;
  // El % debe salir del mismo criterio por marca+posición que usa el resto de la app
  // (neuCriterio) — antes usaba un remanente genérico fijo (81mm) sin importar la
  // marca, y quedaba guardado así hasta la próxima medición (ver caso real: un
  // Bridgestone nuevo de 60mm mostraba 74% en vez de ~100%).
  const c=neuCriterio({tipoEquipo:tipo,posicion:pos,marca});
  const remNuevo=c.remNuevo||81;
  const pct=rem!=null?neuPct({tipoEquipo:tipo,posicion:pos,marca,remanente:rem}):null;
  const hAct=_horomEquipoSeguro(sig);
  const acum=parseInt($('nNAcum').value)||0;
  neu.push({id:_uuidV4(),sigla:sig,tipoEquipo:tipo,tipo:'Neumático',posicion:pos,
    numPos:parseInt($('nNNumPos').value)||1,numSensor:$('nNSensor').value,serie,
    marca:$('nNMarca').value,medida:$('nNMedida').value,vidaUtil:tipo==='ALJ'?3000:tipo==='MN'?5000:tipo==='CF'?5000:6000,
    horomInstalacion:hAct,horomActual:hAct,horasAcum:acum,remanente:rem,remNuevo,
    pctRemanente:pct,fechaInst:$('nNFec').value,alerta:450,estado:'Operativo'});
  S.s('neu',neu);cm();renders.neu();toast('✅ Neumático agregado');
};
export function cambiarNeu(i){
  const neu=S.g('neu')||[];const n=neu[i];
  const hAct=_horomEquipoSeguro(n.sigla);
  sm(`<h3>↺ Cambio — ${escapeHtml(n.sigla)} ${escapeHtml(n.posicion)}</h3>
    <p style="color:var(--tx2);margin-bottom:12px">Serie: <b>${escapeHtml(n.serie)}</b> · Remanente: <b>${n.remanente||'—'}mm</b></p>
    <div class="form-row">
      <div class="fg"><label>Destino neumático retirado</label><select id="cDest"><option>Stock</option><option>De baja</option></select></div>
      <div class="fg"><label>Remanente al retirar (mm)</label><input type="number" id="cRemAnt"></div>
    </div>
    <div class="form-row">
      <div class="fg"><label>Serie nuevo *</label><input id="cSerie" list="dlSeriesNeu" title="Si este neumático viene de otro equipo/posición, elige su serie de la lista en vez de retiparla — un typo rompe el enlace con su historial de mediciones"></div>
      <div class="fg"><label>Costo ($)</label><input type="number" id="cCosto" value="0"></div>
    </div>
    <button class="btn" onclick="saveCambio(${i},${hAct})"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Confirmar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>`);
};
export function saveCambio(i,hAct){
  const neu=S.g('neu')||[];const n=neu[i];
  const serieNuevo=$('cSerie').value.trim();
  if(!serieNuevo)return toast('⚠️ Ingresa serie nuevo');
  const remAnt=parseFloat($('cRemAnt').value)||0;
  const ot=S.g('ot')||[];
  ot.unshift({sigla:n.sigla,fecha:new Date().toISOString().slice(0,10),tipo:'Cambio de Neumático',
    criticidad:'No Aplica',sintoma:`Cambio ${n.posicion}. Retirado: ${n.serie} (${remAnt}mm). Instalado: ${serieNuevo}`,
    sistema:'Ruedas y neumáticos',costo:parseFloat($('cCosto').value)||0,horom:hAct});
  // Copia archivada del neumático retirado: necesita su PROPIO id — si copiara el
  // de 'n' (que sigue en el arreglo, mutado más abajo para representar el nuevo),
  // las 2 filas competirían por la misma fila real en la base (mismo id, mismo
  // upsert por lote) y una se pisaría a la otra.
  const horasRetiro=_horasNeuAlRetiro(n);
  neu.push({...n,id:_uuidV4(),serie:n.serie,estado:$('cDest').value==='Stock'?'Stock':'De baja',remanente:remAnt,fechaBaja:new Date().toISOString().slice(0,10),horasAcum:horasRetiro,horasBase:null});
  // Bug real (auditoría 2026-08): el sensor del neumático retirado (n.serie, ANTES
  // de mutar) nunca se desmontaba acá — a diferencia de saveNeu/confirmarInstalarExistencias,
  // que sí llaman _desmontarSensorSiTiene. El neumático nuevo quedaba mostrando el
  // N° de sensor del que se retiró, y sensores_neumaticos seguía apuntando al
  // neumático viejo (ya en Stock/De baja) como si siguiera montado.
  _desmontarSensorSiTiene(n.serie);
  n.serie=serieNuevo;n.horomInstalacion=hAct;n.horasAcum=0;n.numSensor='';
  // Igual que en saveNeu: el remanente de un neumático "nuevo" depende de la marca
  // (n.marca no cambia en este flujo, sigue siendo la misma posición) — usar
  // neuCriterio en vez del campo n.remNuevo guardado, que puede quedar desactualizado.
  n.remanente=neuCriterio(n).remNuevo||81;n.pctRemanente=100;n.estado='Operativo';n.fechaInst=new Date().toISOString().slice(0,10);
  S.s('neu',neu);S.s('ot',ot);cm();renders.neu();toast('✅ Cambio registrado');
};

// ── Instalar un neumático de Existencias (estado='Stock') en OTRO equipo ──
// A diferencia de cambiarNeu() (que archiva el saliente y crea uno entrante
// nuevo), acá se REACTIVA una fila que ya existe — el historial de mediciones
// sigue funcionando porque neuProyeccion() lo sigue por N° de serie, no por
// equipo/posición, así que no se pierde nada al reasignarlo.
export function instalarDesdeExistencias(){
  const neu=S.g('neu')||[];
  const stock=neu.map((n,i)=>({n,i})).filter(x=>x.n.estado==='Stock');
  if(!stock.length)return toast('⚠️ No hay neumáticos en Existencias (estado "Stock")');
  const eq=S.g('eq')||[];
  sm(`<h3><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 10 A6 6 0 0 1 15.5 6.5" fill="none"/><polyline points="15.5,3 15.5,6.5 12,6.5"/><path d="M16 10 A6 6 0 0 1 4.5 13.5" fill="none"/><polyline points="4.5,17 4.5,13.5 8,13.5"/></svg> Instalar desde Existencias</h3>
    <div class="fg"><label>Neumático en Existencias</label><select id="iexNeu">${stock.map(x=>`<option value="${x.i}">${escapeHtml(x.n.serie)} — ${escapeHtml(x.n.marca||'')} ${escapeHtml(x.n.medida||'')} (${x.n.remanente!=null?x.n.remanente+'mm':'sin medición'})</option>`).join('')}</select></div>
    <div class="form-row">
      <div class="fg"><label>Equipo destino</label><select id="iexEq">${eq.map(e=>`<option value="${escapeHtml(e.sigla)}">${escapeHtml(e.sigla)}</option>`).join('')}</select></div>
      <div class="fg"><label>Posición</label><input id="iexPos" placeholder="Ej: Delantera Izq"></div>
    </div>
    <div class="fg"><label>N° Posición</label><input type="number" id="iexNumPos" min="1" max="10" value="1"></div>
    <button class="btn" onclick="confirmarInstalarExistencias()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Instalar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>`);
};
export function confirmarInstalarExistencias(){
  const idx=parseInt($('iexNeu').value);
  const sig=$('iexEq').value;
  const pos=$('iexPos').value.trim();
  const numPos=parseInt($('iexNumPos').value)||1;
  if(!sig||!pos)return toast('⚠️ Completa equipo y posición');
  const neu=S.g('neu')||[];
  const n=neu[idx];
  if(!n)return toast('⚠️ Neumático no encontrado');
  // Si ya hay uno operativo en esa posición, hay que sacarlo primero (no se
  // puede tener dos neumáticos "Operativo" en la misma posición del mismo equipo).
  const ocupadoIdx=neu.findIndex(x=>x.sigla===sig&&x.posicion===pos&&x.estado==='Operativo');
  if(ocupadoIdx>=0){
    if(!confirm(`Ya hay un neumático operativo en ${sig} ${pos} (serie ${neu[ocupadoIdx].serie}). ¿Moverlo a Existencias e instalar este en su lugar?`))return;
    const horasRetiroOcup=_horasNeuAlRetiro(neu[ocupadoIdx]);
    _desmontarSensorSiTiene(neu[ocupadoIdx].serie);
    neu[ocupadoIdx].estado='Stock';
    neu[ocupadoIdx].numSensor='';
    neu[ocupadoIdx].fechaBaja=new Date().toISOString().slice(0,10);
    neu[ocupadoIdx].horasAcum=horasRetiroOcup;
    neu[ocupadoIdx].horasBase=null;
  }
  const hAct=_horomEquipoSeguro(sig);
  const origen=n.sigla?`${n.sigla} ${n.posicion||''}`.trim():'Existencias';
  n.sigla=sig;n.posicion=pos;n.numPos=numPos;
  n.horomInstalacion=hAct;n.estado='Operativo';n.fechaInst=new Date().toISOString().slice(0,10);
  delete n.fechaBaja;
  // Deja registro del movimiento en 'ot' (mismo patrón que saveCambio) para poder
  // reconstruir el historial de reasignaciones de este neumático por N° de serie.
  const ot=S.g('ot')||[];
  ot.unshift({sigla:sig,fecha:new Date().toISOString().slice(0,10),tipo:'Reasignación de Neumático',
    criticidad:'No Aplica',sintoma:`Reasignado desde ${origen}. Serie ${n.serie} instalado en ${sig} ${pos}.`,
    sistema:'Ruedas y neumáticos',costo:0,horom:hAct});
  S.s('ot',ot);
  S.s('neu',neu);cm();renders.neu();
  toast('✅ '+n.serie+' instalado en '+sig+' '+pos);
};

// ── Sensores de neumático como entidad propia (tabla 'sensores_neumaticos') ──
// Igual patrón que los neumáticos: un sensor puede desmontarse (queda en
// Existencias) y reinstalarse en un neumático DISTINTO al que traía siempre,
// sin perder su identidad.
// Cuando un neumático se manda a Existencias por conflicto de posición (dos
// altas en el mismo equipo+posición, ver saveNeu/confirmarInstalarExistencias),
// su sensor NO puede seguir mostrándose "Operativo" en ese equipo — quedaría
// mostrando una ubicación donde el neumático ya no está.
// Horas de uso reales del MONTAJE ACTUAL de un sensor (desde que se instaló
// hasta el horómetro actual del equipo donde está) — mismo criterio que
// _horasNeuAlRetiro() para neumáticos. Se llama al desmontar, para congelar la
// duración de ESE montaje en el historial y sumarla a s.horasAcum (total de
// vida del sensor) — a pedido del usuario 2026-08-21 ("el sensor también
// tendré su hora de uso"): antes el historial solo tenía fechas, sin ninguna
// forma de saber cuántas horas de uso real acumuló.
function _horasMontajeSensor(s){
  if(s.horomInstalacion==null||!s.sigla)return 0;
  const eq=S.g('eq')||[];
  const e=eq.find(function(x){return x.sigla===s.sigla;});
  if(!e)return 0;
  return Math.max(0,Math.round((e.horomActual||0)-s.horomInstalacion));
}
// Total de horas de uso del sensor: lo ya acumulado en montajes anteriores
// (congelado en s.horasAcum al desmontar) más lo que lleva en el montaje
// actual si sigue Operativo — mismo patrón "en vivo" que hrsLive() para
// neumáticos.
function _horasSensorTotal(s){
  return (s.horasAcum||0)+(s.estado==='Operativo'?_horasMontajeSensor(s):0);
}
function _desmontarSensorSiTiene(neuSerie){
  const sen=S.g('sen')||[];
  const s=sen.find(x=>x.neuSerie===neuSerie&&x.estado==='Operativo');
  if(!s)return;
  const horasMontaje=_horasMontajeSensor(s);
  if(!Array.isArray(s.historial))s.historial=[];
  s.historial.push({fecha:new Date().toISOString().slice(0,10),accion:'Desmontado',sigla:s.sigla,posicion:s.posicion,neuSerie:s.neuSerie,horasUso:horasMontaje});
  s.horasAcum=(s.horasAcum||0)+horasMontaje;
  s.estado='Stock';s.sigla='';s.posicion='';s.horomInstalacion=null;
  S.s('sen',sen);
}
// filtro de la ventana "Ver Sensores" (2026-08-21, a pedido del usuario: "no
// puedo ver el historial... de cuando fue instalado o en que equipo, o
// filtrar") — antes era una tabla plana de los 52 sensores sin buscador ni
// forma de acotar por equipo, y la fecha de instalación solo se veía
// entrando al historial de cada uno de a uno. window._senFiltroEq/_senFiltroTxt
// se guardan en window (no en el estado normal de la app) porque este modal
// se re-renderiza llamándose a sí mismo en cada tecla/cambio, sin pasar por
// renders.neu().
window._senFiltroEq=window._senFiltroEq||'';
window._senFiltroTxt=window._senFiltroTxt||'';
export function verSensores(){
  const sen=S.g('sen')||[];
  const eq=S.g('eq')||[];
  const fEq=window._senFiltroEq||'';
  const fTxt=(window._senFiltroTxt||'').trim().toLowerCase();
  const filtrados=sen.map((s,i)=>({s,i})).filter(function(x){
    if(fEq&&x.s.sigla!==fEq)return false;
    if(fTxt){
      const hay=[x.s.numSensor,x.s.sigla,x.s.posicion,x.s.neuSerie,x.s.marca].some(function(v){return(v||'').toLowerCase().includes(fTxt);});
      if(!hay)return false;
    }
    return true;
  });
  const rows=filtrados.map(function(x){
    const s=x.s,i=x.i;
    const ubic=s.estado==='Operativo'?escapeHtml(s.sigla||'—')+' '+escapeHtml(s.posicion||''):'<span style="color:var(--tx3)">En Existencias</span>';
    const horasTot=_horasSensorTotal(s);
    return`<tr>
      <td class="mono">${escapeHtml(s.numSensor||'—')}</td>
      <td style="font-size:11px">${escapeHtml(s.marca||'—')}</td>
      <td style="font-size:11px">${ubic}</td>
      <td class="mono" style="font-size:11px">${escapeHtml(s.neuSerie||'—')}</td>
      <td style="font-size:11px">${escapeHtml(s.fechaInst||'—')}</td>
      <td style="font-size:11px;text-align:right">${fn(horasTot)}h</td>
      <td style="font-size:11px;text-align:right">US$${SEN_PRECIO.usd}</td>
      <td style="white-space:nowrap">${s.estado==='Operativo'?`<button class="btn-s" style="background:rgba(239,68,68,.15);color:var(--danger)" onclick="desmontarSensor(${i})">Desmontar</button>`:`<button class="btn-s" style="background:rgba(16,185,129,.15);color:var(--ok)" onclick="instalarSensor(${i})">Instalar</button>`} <button class="btn-s" style="background:var(--bg3)" onclick="verHistorialSensor(${i})"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Historial</button></td>
    </tr>`;
  }).join('');
  const eqsConSensor=[...new Set(sen.map(function(s){return s.sigla;}).filter(Boolean))].sort();
  const costoFiltradosUSD=filtrados.length*SEN_PRECIO.usd;
  sm(`<div style="max-width:960px"><h3><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="8" width="8" height="6" rx="1"/><line x1="8" y1="8" x2="8" y2="4"/><line x1="12" y1="8" x2="12" y2="4"/><line x1="10" y1="14" x2="10" y2="17"/></svg> Sensores de Neumáticos</h3>
    <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">
      <input id="senFiltroTxt" placeholder="Buscar N° sensor, serie de neumático..." value="${escapeHtml(window._senFiltroTxt||'')}" oninput="window._senFiltroTxt=this.value;verSensores()" style="flex:1;min-width:180px;background:var(--bg3);border:1px solid var(--border);color:var(--tx);padding:6px 8px;border-radius:4px;font-size:12px">
      <select onchange="window._senFiltroEq=this.value;verSensores()" style="background:var(--bg3);border:1px solid var(--border);color:var(--tx);padding:6px 8px;border-radius:4px;font-size:12px">
        <option value="">Todos los equipos</option>
        ${eqsConSensor.map(function(sg){return'<option value="'+escapeHtml(sg)+'"'+(fEq===sg?' selected':'')+'>'+escapeHtml(sg)+'</option>';}).join('')}
      </select>
      ${(fEq||fTxt)?'<button class="btn-o" onclick="window._senFiltroEq=\'\';window._senFiltroTxt=\'\';verSensores()">Limpiar</button>':''}
    </div>
    <p style="font-size:11px;color:var(--tx3);margin:-4px 0 4px">${filtrados.length} de ${sen.length} sensores · Costo US$${SEN_PRECIO.usd} + IVA c/u (${SEN_PRECIO.proveedor}, ${SEN_PRECIO.modelo}) → <b>US$${fn(costoFiltradosUSD)}</b> + IVA en pantalla</p>
    <p style="font-size:10px;color:var(--tx3);margin:0 0 10px" title="${escapeHtml(SEN_PRECIO.fuente)}">SKU ${SEN_PRECIO.sku} · precio sin conversión a CLP (cotización no fija tipo de cambio)</p>
    <div style="overflow-x:auto"><table style="width:100%;font-size:12px">
    <tr style="background:var(--bg3)"><th style="padding:6px;text-align:left">N° Sensor</th><th>Marca</th><th>Ubicación</th><th>Neumático (serie)</th><th>Instalado</th><th>Horas uso</th><th>Costo</th><th></th></tr>
    ${rows||'<tr><td colspan="8" style="padding:12px;text-align:center;color:var(--tx3)">Sin sensores que coincidan con el filtro</td></tr>'}
    </table></div>
    <button class="btn btn-o" style="margin-top:12px" onclick="window._senFiltroEq=\'\';window._senFiltroTxt=\'\';cm()">Cerrar</button></div>`);
};
export function verHistorialSensor(i){
  const sen=S.g('sen')||[];
  const s=sen[i];
  if(!s)return;
  const hist=(s.historial||[]).slice().reverse();
  const horasTot=_horasSensorTotal(s);
  sm(`<div style="max-width:560px"><h3><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Historial — Sensor ${escapeHtml(s.numSensor||'')}</h3>
    <p style="color:var(--tx2);margin-bottom:4px;font-size:12px">Ubicación actual: <b>${s.estado==='Operativo'?escapeHtml(s.sigla||'')+' '+escapeHtml(s.posicion||''):'En Existencias'}</b></p>
    <p style="color:var(--tx2);margin-bottom:10px;font-size:12px">Horas de uso acumuladas${s.estado==='Operativo'?' <span title="Incluye lo que lleva en el montaje actual, calculado en vivo" style="color:var(--tx3)">(en vivo)</span>':''}: <b>${fn(horasTot)}h</b></p>
    ${hist.length?`<div>${hist.map(h=>`<div style="font-size:11px;padding:6px 8px;border-left:2px solid ${h.accion==='Instalado'?'var(--ok)':'var(--danger)'};margin-bottom:4px;background:var(--bg3);border-radius:4px">
      <b>${h.fecha}</b> — ${h.accion==='Instalado'?'<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> Instalado en':'⬅️ Desmontado de'} <b>${escapeHtml(h.sigla||'')} ${escapeHtml(h.posicion||'')}</b>${h.neuSerie?' (neumático serie '+escapeHtml(h.neuSerie)+')':''}${h.accion==='Desmontado'&&h.horasUso!=null?' <span style="color:var(--tx3)">— '+fn(h.horasUso)+'h en este montaje</span>':''}
    </div>`).join('')}</div>`:'<p style="font-size:11px;color:var(--tx3)">Sin movimientos registrados todavía</p>'}
    <button class="btn btn-o" style="margin-top:12px" onclick="verSensores()">← Volver</button></div>`);
};
export function desmontarSensor(i){
  const sen=S.g('sen')||[];
  const s=sen[i];
  if(!s)return;
  if(!confirm('¿Desmontar el sensor '+s.numSensor+' de '+s.sigla+' '+s.posicion+' y moverlo a Existencias?'))return;
  // El neumático donde estaba ya no tiene este sensor — se limpia el campo para
  // que la tabla de Neumáticos no siga mostrando un sensor que ya no está ahí.
  const neu=S.g('neu')||[];
  const ni=neu.findIndex(n=>n.serie===s.neuSerie&&n.numSensor===s.numSensor);
  if(ni>=0){neu[ni].numSensor='';S.s('neu',neu);}
  const horasMontaje=_horasMontajeSensor(s);
  if(!Array.isArray(s.historial))s.historial=[];
  s.historial.push({fecha:new Date().toISOString().slice(0,10),accion:'Desmontado',sigla:s.sigla,posicion:s.posicion,neuSerie:s.neuSerie,horasUso:horasMontaje});
  s.horasAcum=(s.horasAcum||0)+horasMontaje;
  s.estado='Stock';s.sigla='';s.posicion='';s.horomInstalacion=null;
  S.s('sen',sen);verSensores();
  toast('✅ Sensor '+s.numSensor+' movido a Existencias');
};
export function instalarSensor(i){
  const sen=S.g('sen')||[];
  const s=sen[i];
  if(!s)return;
  const neu=S.g('neu')||[];
  const activos=neu.map((n,ni)=>({n,ni})).filter(x=>x.n.estado==='Operativo');
  if(!activos.length)return toast('⚠️ No hay neumáticos operativos donde instalarlo');
  sm(`<h3><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="8" width="8" height="6" rx="1"/><line x1="8" y1="8" x2="8" y2="4"/><line x1="12" y1="8" x2="12" y2="4"/><line x1="10" y1="14" x2="10" y2="17"/></svg> Instalar sensor ${escapeHtml(s.numSensor||'')}</h3>
    <div class="fg"><label>Neumático destino</label><select id="isenNeu">${activos.map(x=>`<option value="${x.ni}">${escapeHtml(x.n.sigla)} ${escapeHtml(x.n.posicion||'')} — serie ${escapeHtml(x.n.serie)}</option>`).join('')}</select></div>
    <button class="btn" onclick="confirmarInstalarSensor(${i})"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Instalar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>`);
};
export function confirmarInstalarSensor(i){
  const ni=parseInt($('isenNeu').value);
  const neu=S.g('neu')||[];
  const n=neu[ni];
  if(!n)return toast('⚠️ Neumático no encontrado');
  const sen=S.g('sen')||[];
  const s=sen[i];
  if(!s)return;
  // Si ese neumático ya tenía otro sensor operativo, se desmonta solo (no puede
  // haber dos sensores activos en el mismo neumático a la vez).
  const otroIdx=sen.findIndex(function(x,xi){return xi!==i&&x.neuSerie===n.serie&&x.estado==='Operativo';});
  if(otroIdx>=0){
    const otro=sen[otroIdx];
    const horasMontajeOtro=_horasMontajeSensor(otro);
    if(!Array.isArray(otro.historial))otro.historial=[];
    otro.historial.push({fecha:new Date().toISOString().slice(0,10),accion:'Desmontado',sigla:otro.sigla,posicion:otro.posicion,neuSerie:otro.neuSerie,horasUso:horasMontajeOtro});
    otro.horasAcum=(otro.horasAcum||0)+horasMontajeOtro;
    otro.estado='Stock';otro.sigla='';otro.posicion='';otro.horomInstalacion=null;
  }
  // Respaldo: si este sensor quedó marcado en OTRO neumático (ej. se instaló sin
  // pasar por "Desmontar" primero), se limpia ahí también — nunca debe quedar el
  // mismo N° de sensor mostrado en dos neumáticos a la vez.
  neu.forEach(function(x){if(x!==n&&x.numSensor===s.numSensor)x.numSensor='';});
  s.estado='Operativo';s.sigla=n.sigla;s.posicion=n.posicion;s.neuSerie=n.serie;s.fechaInst=new Date().toISOString().slice(0,10);
  s.horomInstalacion=_horomEquipoSeguro(n.sigla);
  if(!Array.isArray(s.historial))s.historial=[];
  s.historial.push({fecha:new Date().toISOString().slice(0,10),accion:'Instalado',sigla:n.sigla,posicion:n.posicion,neuSerie:n.serie});
  n.numSensor=s.numSensor;
  S.s('sen',sen);S.s('neu',neu);cm();renders.neu();
  toast('✅ Sensor '+s.numSensor+' instalado en '+n.sigla+' '+(n.posicion||''));
};

// ── Registrar medición de remanente ───────────────────────
export function addMedicionNeu(neuIdx){
  const neu=S.g('neu')||[];const n=neu[neuIdx];
  if(!n)return;
  const eqArr=S.g('eq')||[];const e=eqArr.find(x=>x.sigla===n.sigla);
  const horomActual=e?e.horomActual:0;
  sm(`<h3><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="2" y="7" width="16" height="6" rx="1"/><line x1="5" y1="7" x2="5" y2="9.5"/><line x1="8" y1="7" x2="8" y2="9.5"/><line x1="11" y1="7" x2="11" y2="9.5"/><line x1="14" y1="7" x2="14" y2="9.5"/></svg> Medición Remanente — ${escapeHtml(n.sigla)} ${escapeHtml(n.posicion)}</h3>
    <p style="font-size:12px;color:var(--tx3)">Serie: <b>${escapeHtml(n.serie)}</b> | Marca: <b>${escapeHtml(n.marca)}</b></p>
    <div class="form-row">
      <div class="fg"><label>Fecha</label><input type="date" id="mFecha" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="fg"><label>Horómetro equipo</label><input type="number" id="mHorom" value="${horomActual}"></div>
    </div>
    <div class="form-row">
      <div class="fg"><label>Remanente Exterior (mm)</label><input type="number" id="mRemExt" min="0" max="200"></div>
      <div class="fg"><label>Remanente Interior (mm)</label><input type="number" id="mRemInt" min="0" max="200"></div>
    </div>
    <div class="form-row">
      <div class="fg"><label>Presión (PSI)</label><input type="number" id="mPres"></div>
      <div class="fg"><label>Temperatura (°C)</label><input type="number" id="mTemp"></div>
    </div>
    <div class="fg" style="margin-bottom:12px"><label>Observación</label><input id="mObs" style="width:100%"></div>
    <button class="btn" onclick="saveMedicionNeu(${neuIdx})"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar medición</button>
    <button class="btn btn-o" onclick="cm()">Cancelar</button>
    <button type="button" class="btn btn-o" onclick="_continuarMedicionPorVoz(${neuIdx})">${ICONS.mic} Completar por voz</button>`);
};

export function saveMedicionNeu(neuIdx){
  const neu=S.g('neu')||[];const n=neu[neuIdx];
  const remExt=parseFloat($('mRemExt').value)||0;
  const remInt=parseFloat($('mRemInt').value)||0;
  const remMin=Math.min(remExt||999,remInt||999);
  const remProm=remExt&&remInt?Math.round((remExt+remInt)/2):remExt||remInt;
  if(!remProm)return toast('⚠️ Ingresa al menos un remanente');
  const horom=parseFloat($('mHorom').value)||0;
  const med={
    neuId:n.id||n.serie,sigla:n.sigla,posicion:n.posicion,serie:n.serie,
    fecha:$('mFecha').value,horom,
    remExt:remExt||null,remInt:remInt||null,remMin,remProm,
    presion:parseFloat($('mPres').value)||null,
    temp:parseFloat($('mTemp').value)||null,
    obs:$('mObs').value||''
  };
  const meds=S.g('neuMed')||[];meds.push(med);S.s('neuMed',meds);
  // Actualizar remanente actual del neumático
  n.remanente=remProm;
  // pctRemanente = remanente ÷ remanente de fábrica de la marca (misma fórmula que neuPct,
  // el % que se muestra). Se guarda solo como caché para exportar/sincronizar; la tabla
  // siempre lo recalcula en vivo con neuPct para no depender de este valor.
  n.pctRemanente=neuPct(n);
  n.ultimaMedicion=med.fecha;
  S.s('neu',neu);cm();renders.neu();
  toast('✅ Medición guardada — '+n.sigla+' '+n.posicion+': '+remProm+'mm');
};

// ── Leer chequeo diario de neumáticos desde foto (leer-chequeo-neumaticos) ──
// La hoja trae hasta 4 paneles (uno por equipo), cada uno con su tabla de
// hasta 10 neumáticos — a diferencia de leer-pauta-pm/leer-informe-correctivo
// (que prellenan UN formulario), acá cada fila leída se empareja con un
// neumático YA REGISTRADO en ese Equipo+Posición y se muestra como una
// posible Medición Remanente para revisar y tildar antes de guardar. Nunca
// crea neumáticos nuevos ni guarda solo — la persona confirma cada fila.
export function _activarLeerChequeoNeu(){
  const inp=$('neuChequeoFoto');
  if(inp)inp.click();
};
export async function _leerChequeoNeuFotoSeleccionada(input){
  const file=input.files&&input.files[0];
  if(!file)return;
  toast('⏳ Leyendo chequeo...');
  try{
    const comp=await comprimirImagen(file);
    if(!comp){toast('⚠️ No se pudo leer la foto');input.value='';return;}
    const base64=comp.dataUrl.split(',')[1];
    const resp=await _llamarOCRFuncion('leer-chequeo-neumaticos',base64,'image/jpeg');
    if(resp.error){toast('⚠️ '+resp.error);input.value='';return;}
    _revisarChequeoNeuOCR(resp.datos||{paneles:[]});
  }catch(err){
    toast('⚠️ Error leyendo chequeo: '+err.message);
  }
  input.value='';
};
export function _revisarChequeoNeuOCR(datos){
  const eqArr=S.g('eq')||[];
  const neu=S.g('neu')||[];
  const paneles=(datos.paneles||[]).map(function(panel){
    const match=panel.equipo?_matchEquipoPorSiglaOCR(panel.equipo,eqArr):null;
    const siglaReal=match?match.sigla:null;
    const filas=(panel.neumaticos||[]).map(function(row){
      const idxNeu=siglaReal?neu.findIndex(function(n){return n.sigla===siglaReal&&n.numPos===row.posicion&&n.estado==='Operativo';}):-1;
      return{row,idxNeu};
    });
    return{panel,siglaReal,filas};
  });
  window._chequeoNeuOCRData=paneles;
  const bloques=paneles.map(function(pn,pi){
    const p=pn.panel;
    const eqLabel=pn.siglaReal?escapeHtml(pn.siglaReal):(p.equipo?'⚠️ "'+escapeHtml(p.equipo)+'" no identificado':'⚠️ sin equipo leído');
    const filasHtml=pn.filas.map(function(f,fi){
      const r=f.row;
      if(f.idxNeu<0){
        return `<tr style="opacity:.5"><td>${r.posicion}</td><td colspan="5" style="font-size:12px">Sin neumático Operativo registrado en esa posición — se omite</td></tr>`;
      }
      const n=neu[f.idxNeu];
      const dudoso=r.incierto?' style="background:rgba(234,179,8,.12)"':'';
      return `<tr${dudoso}>
        <td><input type="checkbox" id="chqSel_${pi}_${fi}" checked></td>
        <td>${r.posicion}<br><span style="font-size:11px;color:var(--tx3)">${escapeHtml(n.serie||'')}</span></td>
        <td><input type="number" id="chqPres_${pi}_${fi}" value="${r.presion??''}" style="width:60px"></td>
        <td><input type="number" id="chqTemp_${pi}_${fi}" value="${r.temperatura??''}" style="width:60px"></td>
        <td><input type="number" id="chqExt_${pi}_${fi}" value="${r.remExt??''}" style="width:60px"></td>
        <td><input type="number" id="chqInt_${pi}_${fi}" value="${r.remInt??''}" style="width:60px"></td>
      </tr>`;
    }).join('');
    return `<div style="margin-bottom:16px">
      <h4 style="margin-bottom:6px">${eqLabel} — ${p.fecha?escapeHtml(p.fecha):'sin fecha'}${p.horometro?' · '+p.horometro+'h':''}</h4>
      <div class="tbl-wrap"><table>
        <tr><th></th><th>Pos.</th><th>Presión</th><th>Temp.</th><th>Rem.Ext</th><th>Rem.Int</th></tr>
        ${filasHtml||'<tr><td colspan="6" style="font-size:12px">Sin filas con datos</td></tr>'}
      </table></div>
    </div>`;
  }).join('');
  sm(`<div style="max-width:720px"><h3>📷 Chequeo de neumáticos leído</h3>
    <p style="color:var(--tx2);font-size:13px;margin-bottom:12px">Revisa los valores antes de guardar — desmarca las filas que no correspondan. Las filas en amarillo tienen letra dudosa.</p>
    ${bloques||'<p>No se detectó ningún panel en la foto.</p>'}
    <button class="btn" onclick="_guardarChequeoNeuOCR()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar mediciones seleccionadas</button> <button class="btn btn-o" onclick="cm()">Cancelar</button></div>`);
};
export function _guardarChequeoNeuOCR(){
  const paneles=window._chequeoNeuOCRData||[];
  const neu=S.g('neu')||[];
  const meds=S.g('neuMed')||[];
  let count=0;
  paneles.forEach(function(pn,pi){
    pn.filas.forEach(function(f,fi){
      if(f.idxNeu<0)return;
      const chk=$('chqSel_'+pi+'_'+fi);
      if(!chk||!chk.checked)return;
      const n=neu[f.idxNeu];
      const presion=parseFloat($('chqPres_'+pi+'_'+fi).value);
      const temp=parseFloat($('chqTemp_'+pi+'_'+fi).value);
      const remExt=parseFloat($('chqExt_'+pi+'_'+fi).value)||0;
      const remInt=parseFloat($('chqInt_'+pi+'_'+fi).value)||0;
      const remMin=Math.min(remExt||999,remInt||999);
      const remProm=remExt&&remInt?Math.round((remExt+remInt)/2):remExt||remInt;
      if(!remProm)return; // mismo criterio que saveMedicionNeu: sin remanente no se guarda
      const horom=pn.panel.horometro||_horomEquipoSeguro(n.sigla);
      const fecha=pn.panel.fecha||new Date().toISOString().slice(0,10);
      const med={neuId:n.id||n.serie,sigla:n.sigla,posicion:n.posicion,serie:n.serie,
        fecha,horom,remExt:remExt||null,remInt:remInt||null,remMin,remProm,
        presion:isNaN(presion)?null:presion,temp:isNaN(temp)?null:temp,
        obs:f.row.comentarios||''};
      meds.push(med);
      n.remanente=remProm;n.pctRemanente=neuPct(n);n.ultimaMedicion=fecha;
      count++;
    });
  });
  S.s('neuMed',meds);S.s('neu',neu);cm();renders.neu();
  toast(count?('✅ '+count+' medición(es) guardada(s)'):'⚠️ No se guardó ninguna medición');
};

// ── Ordenamiento de columnas ──────────────────────────────
export function neuSort(key){
  if(window._neuSort&&window._neuSort.key===key){
    window._neuSort.dir*=-1;
  }else{
    window._neuSort={key,dir:1};
  }
  window._pag.neu=1;
  renders.neu();
};

// ── Historial por POSICIÓN (toda la vida de esa posición) ──
export function histPosicion(sigla,posNum,numPos){
  const allMeds=(S.g('neuMed')&&S.g('neuMed').length)?S.g('neuMed'):(INIT.neuMed||[]);
  // Las mediciones históricas (carga masiva) guardaron 'posicion' como el N°
  // de posición (ej. "6"), no la etiqueta descriptiva actual (ej. "P6-TraDeInt")
  // — hay que aceptar ambas formas o el historial sale vacío para todo lo migrado.
  const meds=allMeds.filter(m=>m.sigla===sigla&&(String(m.posicion)===String(posNum)||(numPos&&String(m.posicion)===String(numPos)))).sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.horom-b.horom);
  const fn2=v=>v?.toLocaleString('es-CL')||'—';
  // Agrupar por serie (cada neumático que pasó por la posición)
  const porSerie={};
  meds.forEach(m=>{if(!porSerie[m.serie])porSerie[m.serie]=[];porSerie[m.serie].push(m);});
  const series=Object.keys(porSerie);

  // SVG combinado de todas las series en esa posición
  let svg='';
  if(meds.length>=1){
    const W=560,H=260,padL=48,padR=24,padT=24,padB=44;
    const plotW=W-padL-padR,plotH=H-padT-padB;
    const xs=meds.map(m=>m.horom).filter(v=>v>0);
    let minH=Math.min(...xs),maxH=Math.max(...xs);
    if(minH===maxH)maxH=minH+100;
    const maxR=Math.max(95,...meds.map(m=>m.remProm))+5;
    const px=v=>padL+Math.round((v-minH)/(maxH-minH||1)*plotW);
    const py=r=>padT+plotH-Math.round(r/(maxR||1)*plotH);
    const colores=['#3987e5','#199e70','#c98500','#008300','#9085e9','#e66767','#d55181','#d95926']; // paleta categórica validada (skill dataviz)
    let grid='';
    [0,20,40,60,80].forEach(v=>{grid+=`<line x1="${padL}" y1="${py(v)}" x2="${W-padR}" y2="${py(v)}" stroke="var(--bd)" stroke-width="0.5" opacity="0.4"/><text x="${padL-6}" y="${py(v)+3}" text-anchor="end" font-size="9" fill="var(--tx3)">${v}</text>`;});
    let lineas='';
    series.forEach((s,si)=>{
      const col=colores[si%colores.length];
      const pts=porSerie[s].filter(m=>m.horom>0&&m.remProm!=null).map(m=>px(m.horom)+','+py(m.remProm));
      if(pts.length>=2)lineas+=`<polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="2"/>`;
      porSerie[s].filter(m=>m.horom>0&&m.remProm!=null).forEach(m=>{lineas+=`<circle cx="${px(m.horom)}" cy="${py(m.remProm)}" r="3" fill="${col}"><title>${s} | ${m.fecha}: ${m.remProm}mm</title></circle>`;});
    });
    svg=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px;background:var(--bg3);border-radius:8px;margin:12px 0">
      <rect x="${padL}" y="${py(10)}" width="${plotW}" height="${H-padB-py(10)}" fill="rgba(239,68,68,0.10)"/>
      ${grid}
      <line x1="${padL}" y1="${py(10)}" x2="${W-padR}" y2="${py(10)}" stroke="var(--danger)" stroke-width="1.5"/>
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H-padB}" stroke="var(--tx3)" stroke-width="1"/>
      <line x1="${padL}" y1="${H-padB}" x2="${W-padR}" y2="${H-padB}" stroke="var(--tx3)" stroke-width="1"/>
      ${lineas}
      <text x="${W-padR-4}" y="${py(10)-4}" text-anchor="end" font-size="9" fill="var(--tx2)">Retiro 10mm</text>
      <text x="${W/2}" y="${H-6}" text-anchor="middle" font-size="9" fill="var(--tx3)">Horómetro equipo →</text>
      <text x="12" y="${H/2}" text-anchor="middle" font-size="9" fill="var(--tx3)" transform="rotate(-90,12,${H/2})">Remanente (mm)</text>
    </svg>`;
  }

  // Leyenda de series con vida útil
  let leyenda='';
  const colores2=['#3987e5','#199e70','#c98500','#008300','#9085e9','#e66767','#d55181','#d95926']; // paleta categórica validada (skill dataviz)
  series.forEach((s,si)=>{
    const ms=porSerie[s];
    const hrsVida=ms.length>=2?Math.round(ms[ms.length-1].horom-ms[0].horom):0;
    const remIni=ms[0].remProm,remFin=ms[ms.length-1].remProm;
    leyenda+=`<div style="display:flex;align-items:center;gap:6px;font-size:11px;padding:3px 0">
      <span style="width:12px;height:12px;background:${colores2[si%colores2.length]};border-radius:2px;display:inline-block"></span>
      <b>${escapeHtml(s)}</b> · ${ms.length} med. · ${remIni}→${remFin}mm · ${fn2(hrsVida)}h vida</div>`;
  });

  sm(`<div style="max-width:600px">
    <h3>📍 Historial Posición ${escapeHtml(posNum)} — ${escapeHtml(sigla)}</h3>
    <p style="font-size:12px;color:var(--tx3)">${meds.length} mediciones · ${series.length} neumático(s) han pasado por esta posición</p>
    ${svg||'<p style="color:var(--tx3);text-align:center;padding:20px">Sin mediciones en esta posición</p>'}
    <div style="background:var(--bg3);border-radius:8px;padding:10px;margin-bottom:12px">
      <b style="font-size:12px">Neumáticos en esta posición:</b>
      ${leyenda}
    </div>
    <div style="overflow-x:auto;max-height:280px;overflow-y:auto"><table style="width:100%;font-size:11px">
      <tr style="background:var(--bg3);position:sticky;top:0"><th style="padding:4px">Fecha</th><th>Serie</th><th>Horóm</th><th>Rem.Int</th><th>Rem.Ext</th><th>Rem.Prom</th><th>Motivo</th></tr>
      ${meds.slice().reverse().map(m=>`<tr style="border-bottom:1px solid var(--bd)">
        <td style="padding:4px">${m.fecha}</td><td class="mono" style="font-size:10px">${escapeHtml(m.serie)}</td>
        <td>${fn2(m.horom)}</td><td>${m.remInt!=null?m.remInt:'—'}</td><td>${m.remExt!=null?m.remExt:'—'}</td>
        <td><b style="color:${m.remProm==null?'var(--tx3)':m.remProm<=10?'var(--danger)':m.remProm<=30?'var(--warn)':'var(--ok)'}">${m.remProm!=null?m.remProm+'mm':'—'}</b></td>
        <td style="color:var(--tx3);font-size:10px">${escapeHtml(m.motivo||'')}</td>
      </tr>`).join('')}
    </table></div>
    <button class="btn btn-o" style="margin-top:12px" onclick="cm()">Cerrar</button>
  </div>`);
};

// Historial del neumático por N° DE SERIE (2026-08-21, a pedido del usuario:
// "no puedo ver el historial... del neumático, de cuándo fue instalado o en
// qué equipo, o filtrar") — a diferencia de histPosicion (que muestra todos
// los neumáticos que pasaron por una POSICIÓN), esto muestra los equipos y
// posiciones por los que pasó ESTE neumático puntual, igual que "Ver
// Historial" ya hace para los sensores. La 'posicion' de cada evento es el
// número crudo del reporte de montaje del sensor (1-6), no la etiqueta
// descriptiva (ej. "P3-TraIzExt") — no hay forma confiable de traducir uno al
// otro para eventos históricos, así que se muestra tal cual en vez de
// inventar la etiqueta.
export function verHistorialNeu(neuIdx){
  const neu=S.g('neu')||[];
  const n=neu[neuIdx];
  if(!n)return;
  const hist=(n.historial||[]).slice().reverse();
  sm(`<div style="max-width:560px"><h3><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Historial — Neumático ${escapeHtml(n.serie||'')}</h3>
    <p style="color:var(--tx2);margin-bottom:10px;font-size:12px">Ubicación actual: <b>${escapeHtml(n.sigla||'')} ${escapeHtml(n.posicion||'')}</b> · Instalado: <b>${escapeHtml(n.fechaInst||'—')}</b></p>
    ${hist.length?`<div>${hist.map(h=>`<div style="font-size:11px;padding:6px 8px;border-left:2px solid ${h.accion==='Instalado'?'var(--ok)':'var(--danger)'};margin-bottom:4px;background:var(--bg3);border-radius:4px">
      <b>${h.fecha}</b> — ${h.accion==='Instalado'?'<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> Instalado en':'⬅️ Desmontado de'} <b>${escapeHtml(h.sigla||'')} pos. ${escapeHtml(h.posicion||'')}</b>${h.numSensor?' <span style="color:var(--tx3)">(sensor '+escapeHtml(h.numSensor)+')</span>':''}${h.accion==='Desmontado'&&h.horasUso!=null?' <span style="color:var(--tx3)">— '+fn(h.horasUso)+'h en este montaje</span>':''}
    </div>`).join('')}</div>`:'<p style="font-size:11px;color:var(--tx3)">Sin historial de montajes registrado para este neumático.</p>'}
    <button class="btn btn-o" style="margin-top:12px" onclick="verDetalleNeu(${neuIdx})">← Volver</button></div>`);
};

// ── Ordenamiento de columnas (fin) ─────────────────────────
export function verDetalleNeu(neuIdx){
  const neu=S.g('neu')||[];const n=neu[neuIdx];
  const allMeds=(S.g('neuMed')&&S.g('neuMed').length)?S.g('neuMed'):(INIT.neuMed||[]);
  const posStr=String(n.numPos||n.posicion||'');
  // Buscar por serie exacta O por sigla+posición (historial completo de la posición)
  const meds=allMeds.filter(m=>{
    const mismoSerie=m.neuId===n.serie||m.serie===n.serie;
    const mismaPosicion=m.sigla===n.sigla&&(String(m.posicion)===posStr||m.posicion===n.posicion);
    return mismoSerie||mismaPosicion;
  }).sort((a,b)=>a.horom-b.horom||a.fecha.localeCompare(b.fecha));
  const c=neuCriterio(n);
  const proy=neuProyeccion(n);
  const precio=neuPrecio(n);
  const fn2=v=>v?.toLocaleString('es-CL')||'—';

  // SVG del gráfico de degradación (curva real + proyección)
  let svg='';
  if(meds.length>=1){
    const W=560,H=260,padL=48,padR=24,padT=24,padB=44;
    const plotW=W-padL-padR,plotH=H-padT-padB;
    const xs=meds.map(m=>m.horom).filter(v=>v>0);
    const allRem=meds.map(m=>m.remProm);
    let minH=Math.min(...xs),maxH=Math.max(...xs);
    // si proyección, extender eje X
    let projX=null;
    if(proy&&proy.hrsRestantes&&xs.length){
      projX=maxH+proy.hrsRestantes;
      maxH=projX;
    }
    if(minH===maxH)maxH=minH+100;
    const remNuevo=c.remNuevo||91;
    const remRet=c.remRetiro||10;
    const maxR=Math.max(remNuevo,...allRem)+5;
    const px=v=>padL+Math.round((v-minH)/(maxH-minH||1)*plotW);
    const py=r=>padT+plotH-Math.round((r-0)/(maxR-0||1)*plotH);
    const pts=meds.filter(m=>m.horom>0&&m.remProm!=null).map(m=>({x:px(m.horom),y:py(m.remProm),h:m.horom,r:m.remProm,f:m.fecha}));
    // gridlines Y
    let grid='';
    [0,20,40,60,80,100].filter(v=>v<=maxR).forEach(v=>{
      grid+=`<line x1="${padL}" y1="${py(v)}" x2="${W-padR}" y2="${py(v)}" stroke="var(--bd)" stroke-width="0.5" opacity="0.4"/>`;
      grid+=`<text x="${padL-6}" y="${py(v)+3}" text-anchor="end" font-size="9" fill="var(--tx3)">${v}</text>`;
    });
    svg=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px;background:var(--bg3);border-radius:8px;margin:12px 0">
      <rect x="${padL}" y="${py(remRet)}" width="${plotW}" height="${H-padB-py(remRet)}" fill="rgba(239,68,68,0.10)"/>
      ${c.remRotar?`<rect x="${padL}" y="${py(c.remRotar)}" width="${plotW}" height="${py(remRet)-py(c.remRotar)}" fill="rgba(250,204,21,0.08)"/>`:''}
      ${grid}
      <line x1="${padL}" y1="${py(remRet)}" x2="${W-padR}" y2="${py(remRet)}" stroke="var(--danger)" stroke-width="1.5"/>
      ${c.remRotar?`<line x1="${padL}" y1="${py(c.remRotar)}" x2="${W-padR}" y2="${py(c.remRotar)}" stroke="#facc15" stroke-width="1.5"/>`:''}
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H-padB}" stroke="var(--tx3)" stroke-width="1"/>
      <line x1="${padL}" y1="${H-padB}" x2="${W-padR}" y2="${H-padB}" stroke="var(--tx3)" stroke-width="1"/>
      ${pts.length>=2?`<polyline points="${pts.map(p=>p.x+','+p.y).join(' ')}" fill="none" stroke="var(--ac)" stroke-width="2.5"/>`:''}
      ${proy&&projX&&pts.length?`<line x1="${pts[pts.length-1].x}" y1="${pts[pts.length-1].y}" x2="${px(projX)}" y2="${py(c.remRotar||remRet)}" stroke="#a78bfa" stroke-width="2" stroke-dasharray="6"/>
      <circle cx="${px(projX)}" cy="${py(c.remRotar||remRet)}" r="5" fill="#a78bfa"/>
      <text x="${px(projX)}" y="${py(c.remRotar||remRet)-8}" text-anchor="middle" font-size="9" fill="var(--tx2)">cambio</text>`:''}
      ${pts.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="var(--ac)"><title>${p.f}: ${p.r}mm @ ${p.h}h</title></circle>`).join('')}
      <text x="${W-padR-4}" y="${py(remRet)-4}" text-anchor="end" font-size="9" fill="var(--tx2)">Retiro ${remRet}mm</text>
      ${c.remRotar?`<text x="${W-padR-4}" y="${py(c.remRotar)-4}" text-anchor="end" font-size="9" fill="var(--tx2)">${c.accion} ${c.remRotar}mm</text>`:''}
      <text x="${W/2}" y="${H-6}" text-anchor="middle" font-size="9" fill="var(--tx3)">Horómetro equipo →</text>
      <text x="12" y="${H/2}" text-anchor="middle" font-size="9" fill="var(--tx3)" transform="rotate(-90,12,${H/2})">Remanente (mm)</text>
    </svg>`;
  }

  sm(`<div style="max-width:580px">
    <h3><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="3"/></svg> ${escapeHtml(n.sigla)} — ${escapeHtml(n.posicion)} | ${escapeHtml(n.serie)}</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
      <div style="background:var(--bg3);border-radius:6px;padding:8px;text-align:center">
        <div style="font-size:10px;color:var(--tx3)">Marca / Medida</div>
        <b style="font-size:12px">${escapeHtml(n.marca||'—')} ${escapeHtml(n.medida||'')}</b>
      </div>
      <div style="background:var(--bg3);border-radius:6px;padding:8px;text-align:center">
        <div style="font-size:10px;color:var(--tx3)">Remanente actual</div>
        <b style="font-size:16px;color:${neuEstadoCalc(n).col}">${n.remanente!=null?n.remanente+'mm':'Sin medición'}</b>
      </div>
      <div style="background:var(--bg3);border-radius:6px;padding:8px;text-align:center">
        <div style="font-size:10px;color:var(--tx3)">Estado</div>
        <b style="font-size:12px;color:${neuEstadoCalc(n).col}">${neuEstadoCalc(n).ico} ${neuEstadoCalc(n).txt}</b>
      </div>
    </div>
    ${svg||'<p style="color:var(--tx3);text-align:center;padding:20px">Sin mediciones — usa <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="2" y="7" width="16" height="6" rx="1"/><line x1="5" y1="7" x2="5" y2="9.5"/><line x1="8" y1="7" x2="8" y2="9.5"/><line x1="11" y1="7" x2="11" y2="9.5"/><line x1="14" y1="7" x2="14" y2="9.5"/></svg> Medir para agregar datos</p>'}
    ${proy?`<div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:12px">
      <b style="font-size:13px"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Proyección de vida</b>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px">
        <div style="text-align:center"><div style="font-size:10px;color:var(--tx3)">Hrs acumuladas</div><b style="color:var(--tx)">${fn2(proy.hrsAcumNeu)}h</b><div style="font-size:9px;color:var(--tx3)">de ${fn2(proy.targetHrs)}h</div></div>
        <div style="text-align:center"><div style="font-size:10px;color:var(--tx3)">Hrs restantes</div><b style="color:var(--ac)">${fn2(proy.hrsRestantes)}h</b></div>
        <div style="text-align:center"><div style="font-size:10px;color:var(--tx3)">Fecha cambio</div><b style="color:var(--warn)">${proy.fechaCambio}</b></div>
        <div style="text-align:center"><div style="font-size:10px;color:var(--tx3)">Días</div><b>${proy.diasRestantes}</b></div>
      </div>
      <div style="margin-top:8px;font-size:11px;color:var(--tx3)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> Cambio por: <b style="color:var(--warn)">${proy.motivoCambio}</b> · ${proy.confianza}${proy.desgasteMes?' · '+proy.desgasteMes+'mm/mes':''}</div>
    </div>`:''}
    <div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:12px">
      <b style="font-size:13px"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Métricas de rendimiento</b>
      ${(()=>{const m=neuMetricas(n);return `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px">
        <div style="text-align:center"><div style="font-size:10px;color:var(--tx3)">Rendimiento</div><b style="color:var(--ac)">${m.rendHmm?m.rendHmm+' h/mm':'—'}</b></div>
        <div style="text-align:center"><div style="font-size:10px;color:var(--tx3)">Costo/hora rodada</div><b>${m.costoHora?'$'+fn2(m.costoHora):'—'}</b></div>
        <div style="text-align:center"><div style="font-size:10px;color:var(--tx3)">Costo/mm</div><b>${m.costoMm?'$'+fn2(m.costoMm):'—'}</b></div>
        <div style="text-align:center"><div style="font-size:10px;color:var(--tx3)">mm gastados</div><b>${m.mmGastados}mm <span style="font-size:9px;color:var(--tx3)">de ${m.remNuevo}</span></b></div>
        <div style="text-align:center"><div style="font-size:10px;color:var(--tx3)">Vida proyectada</div><b style="color:var(--warn)">${m.vidaProyectada?fn2(m.vidaProyectada)+'h':'—'}</b></div>
        <div style="text-align:center"><div style="font-size:10px;color:var(--tx3)">${m.gastoPerdido>0?'<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> Gasto perdido':'Estado'}</div><b style="color:${m.gastoPerdido>0?'var(--danger)':'var(--ok)'}">${m.gastoPerdido>0?'$'+fn2(m.gastoPerdido):n.estado}</b></div>
      </div>`;})()}
    </div>
    <div style="background:var(--bg3);border-radius:8px;padding:12px;margin-bottom:12px">
      <b style="font-size:13px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="8"/><text x="10" y="14" font-size="9" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">$</text></svg> Costo proyectado</b>
      <div style="margin-top:6px;font-size:12px">
        <span style="color:var(--tx3)">Precio unitario:</span> <b>$${fn2(precio.precio)}</b> <span style="font-size:10px;color:var(--tx3)">(${precio.base})</span><br>
        <span style="color:var(--tx3)">Criterio retiro:</span> <b>${c.accion} a ${c.remRotar||c.remRetiro||10}mm</b>
        ${proy?`<br><span style="color:var(--tx3)">Fecha compra sugerida:</span> <b style="color:var(--warn)">${new Date(new Date(proy.fechaCambio).getTime()-30*86400000).toISOString().slice(0,10)}</b> <span style="font-size:10px;color:var(--tx3)">(30 días antes)</span>`:''}
      </div>
    </div>
    <div style="margin-bottom:12px">
      <b style="font-size:13px"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Historial de mediciones (${meds.length})</b>
      ${(()=>{const equiposPorSerie=[...new Set(meds.map(m=>m.sigla).filter(Boolean))];return equiposPorSerie.length>1?`<div style="font-size:10px;color:var(--warn);margin-top:4px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 10 A6 6 0 0 1 15.5 6.5" fill="none"/><polyline points="15.5,3 15.5,6.5 12,6.5"/><path d="M16 10 A6 6 0 0 1 4.5 13.5" fill="none"/><polyline points="4.5,17 4.5,13.5 8,13.5"/></svg> Este neumático pasó por ${equiposPorSerie.length} equipos distintos: ${equiposPorSerie.map(s=>escapeHtml(s)).join(', ')}</div>`:'';})()}
      ${meds.length?`<div style="overflow-x:auto;margin-top:6px"><table style="width:100%;font-size:11px">
        <tr style="background:var(--bg3)"><th style="padding:4px">Fecha</th><th>Equipo</th><th>Pos.</th><th>Horóm</th><th>Rem.Ext</th><th>Rem.Int</th><th>Rem.Prom</th><th>Presión</th><th>Obs</th></tr>
        ${meds.slice().reverse().slice(0,12).map(m=>`<tr style="border-bottom:1px solid var(--bd)">
          <td style="padding:4px">${m.fecha}</td>
          <td class="mono" style="color:var(--ac)">${escapeHtml(m.sigla||'—')}</td>
          <td style="font-size:10px">${escapeHtml(m.posicion||'—')}</td>
          <td>${fn2(m.horom)}</td>
          <td>${m.remExt!=null?m.remExt+'mm':'—'}</td><td>${m.remInt!=null?m.remInt+'mm':'—'}</td>
          <td><b>${m.remProm!=null?m.remProm+'mm':'—'}</b></td><td>${m.presion?m.presion+'psi':'—'}</td>
          <td style="color:var(--tx3)">${escapeHtml(m.obs||'')}</td>
        </tr>`).join('')}
      </table></div>`:'<p style="font-size:11px;color:var(--tx3)">Sin mediciones registradas</p>'}
    </div>
    ${(()=>{
      const ot=S.g('ot')||[];
      const movs=ot.filter(o=>o.sistema==='Ruedas y neumáticos'&&(o.tipo==='Reasignación de Neumático'||o.tipo==='Cambio de Neumático')&&(o.sintoma||'').includes(n.serie)).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
      if(!movs.length)return'';
      return`<div style="margin-bottom:12px">
        <b style="font-size:13px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 10 A6 6 0 0 1 15.5 6.5" fill="none"/><polyline points="15.5,3 15.5,6.5 12,6.5"/><path d="M16 10 A6 6 0 0 1 4.5 13.5" fill="none"/><polyline points="4.5,17 4.5,13.5 8,13.5"/></svg> Historial de movimientos (${movs.length})</b>
        <div style="margin-top:6px">${movs.map(o=>`<div style="font-size:11px;padding:6px 8px;border-left:2px solid var(--ac);margin-bottom:4px;background:var(--bg3);border-radius:4px">
          <b>${o.fecha}</b> — ${escapeHtml(o.sintoma||'')}
        </div>`).join('')}</div>
      </div>`;
    })()}
    <div style="display:flex;gap:8px">
      <button class="btn" onclick="cm();addMedicionNeu(${neuIdx})"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="2" y="7" width="16" height="6" rx="1"/><line x1="5" y1="7" x2="5" y2="9.5"/><line x1="8" y1="7" x2="8" y2="9.5"/><line x1="11" y1="7" x2="11" y2="9.5"/><line x1="14" y1="7" x2="14" y2="9.5"/></svg> Nueva medición</button>
      <button class="btn btn-o" onclick="verHistorialNeu(${neuIdx})"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Historial</button>
      <button class="btn btn-o" onclick="cm()">Cerrar</button>
    </div>
  </div>`);
};

// ── Resumen de flota neumáticos ────────────────────────────
// Cuánto duró (horas de horómetro) cada neumático real que ya fue reemplazado
// en una posición — mismo pedido/patrón que Historial de Componentes y el
// resumen de Tren de Rodaje (sesión 2026-08), pero acá el archivo de
// neumáticos retirados (cambiarNeu→estado 'Stock'/'De baja') nunca se usó en
// los datos reales, así que no hay de dónde sacar la vida por N° de serie.
// Lo que SÍ hay es el registro de cada evento real de "cambio de neumático
// posición X" en la tabla correctivos (ya cargado en 'historial_neumaticos',
// separado de 'neu' porque acá el dato es por POSICIÓN, no por serie —
// tampoco se puede mezclar con historial_componentes: unidades y agrupación
// distintas). Se excluyen Bus/Camioneta/Grúa del backfill: su horómetro
// suele ser kilometraje o un ciclo de uso muy distinto al de un CAEX/
// cargador/motoniveladora, mezclarlos habría distorsionado el promedio.
function _neuResumenVida(){
  const h=S.g('neuHist')||[];
  const porClave={};
  h.forEach(r=>{const k=r.sigla+'|'+r.posicion;(porClave[k]=porClave[k]||[]).push(r);});
  const todas=[];
  const porPosicion={};
  Object.keys(porClave).forEach(k=>{
    const arr=porClave[k].slice().sort((a,b)=>(parseFloat(a.horom)||0)-(parseFloat(b.horom)||0));
    for(let i=1;i<arr.length;i++){
      const hAnt=parseFloat(arr[i-1].horom),hAct=parseFloat(arr[i].horom);
      if(isNaN(hAnt)||isNaN(hAct)||hAct<=hAnt)continue;
      const dur=Math.round(hAct-hAnt);
      todas.push(dur);
      (porPosicion[arr[i].posicion]=porPosicion[arr[i].posicion]||[]).push(dur);
    }
  });
  const stats=arr=>({n:arr.length,prom:Math.round(arr.reduce((s,v)=>s+v,0)/arr.length),min:Math.min(...arr),max:Math.max(...arr)});
  return{
    general:todas.length?stats(todas):null,
    porPosicion:Object.keys(porPosicion).sort((a,b)=>a.localeCompare(b,'es',{numeric:true})).map(p=>({posicion:p,...stats(porPosicion[p])}))
  };
}
export function resumenFlotaNeu(){
  const neu=S.g('neu')||[];
  const fn2=v=>v?.toLocaleString('es-CL')||'0';
  // Agrupar por estado
  const porEstado={};
  let gastoPerdidoTotal=0, costoReposicion=0, alertasTotal=0;
  neu.forEach(n=>{
    const est=n.estado||'Operativo';
    if(!porEstado[est])porEstado[est]={estado:est,count:0,remProm:0,hrsProm:0,costoTotal:0,rendProm:0,nRend:0};
    const m=neuMetricas(n);
    const e=porEstado[est];
    e.count++;
    e.remProm+=n.remanente||0;
    e.hrsProm+=m.hrsAcum;
    e.costoTotal+=m.precio;
    if(m.rendHmm){e.rendProm+=m.rendHmm;e.nRend++;}
    gastoPerdidoTotal+=m.gastoPerdido;
    if(est==='Operativo')costoReposicion+=m.precio;
    if(neuDebeCambiar(n))alertasTotal++;
  });
  const estados=Object.values(porEstado).sort((a,b)=>b.count-a.count);
  const totalNeu=neu.length;
  const colorEstado=e=>e.includes('Baja')?'var(--danger)':e==='Operativo'?'var(--ok)':e==='Evaluación'||e==='Reparación'?'var(--warn)':'var(--tx2)';

  // Proyección de vida restante (TD/RUL, ver neuProyeccion) agregada a nivel de
  // flota — antes solo se veía neumático por neumático dentro del modal <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8.5" cy="8.5" r="5.5"/><line x1="12.7" y1="12.7" x2="17.5" y2="17.5"/></svg>.
  const operativos=neu.filter(n=>n.estado==='Operativo'||!n.estado);
  const proyConNeu=operativos.map(n=>({n,proy:neuProyeccion(n)})).filter(x=>x.proy);
  const proyecciones=proyConNeu.map(x=>x.proy);
  const necesita30=proyecciones.filter(p=>p.diasRestantes<30).length;
  const necesita60=proyecciones.filter(p=>p.diasRestantes>=30&&p.diasRestantes<60).length;
  const sinDatos=operativos.length-proyecciones.length;
  const vidaReal=_neuResumenVida();

  // PROYECCIÓN DE REEMPLAZOS POR PERÍODO (2026-08-27, a pedido del usuario tras ver
  // el gráfico de un neumático: "que me indique que de acuerdo al desgaste, de aquí
  // a fin de año vas a necesitar una cantidad de neumáticos" — no un promedio móvil
  // inventado, sino la SUMA de las fechaCambio ya calculadas por neuProyeccion
  // (regresión real sobre mediciones), agrupadas por período. Es más preciso que
  // Dotación de Taller/Tendencia de Compra porque cada neumático YA trae su propia
  // fecha proyectada — acá solo se agrupa, no se re-estima nada.
  const granNeu=window._neuProyGran||'mes';
  const porPeriodoNeu={};
  proyConNeu.forEach(function(x){
    const p=agruparPeriodo(x.proy.fechaCambio,granNeu);
    if(!porPeriodoNeu[p])porPeriodoNeu[p]={cant:0,costo:0};
    porPeriodoNeu[p].cant++;
    porPeriodoNeu[p].costo+=neuPrecio(x.n).precio||0;
  });
  const periodosNeuOrd=Object.keys(porPeriodoNeu).sort();
  const hoyISONeu=new Date().toISOString().slice(0,10);
  const finAnioISO=new Date().getFullYear()+'-12-31';
  const hastaFinAnio=proyConNeu.filter(x=>x.proy.fechaCambio<=finAnioISO);
  const costoHastaFinAnio=hastaFinAnio.reduce((s,x)=>s+(neuPrecio(x.n).precio||0),0);

  sm(`<div style="max-width:760px">
    <h3><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Resumen Flota Neumáticos</h3>
    ${vidaReal.general?`<b style="font-size:13px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5.5 V10 l3 2" fill="none"/><circle cx="10" cy="10" r="7.5"/></svg> Cuánto duró cada neumático (histórico real, CAEX/cargadores/motoniveladoras — horas de horómetro entre cambios):</b>
    <div style="background:var(--bg3);border-radius:8px;padding:10px;text-align:center;margin:8px 0 10px">
      <div style="font-size:9px;color:var(--tx3)">Todas las posiciones (${vidaReal.general.n} cambios medidos)</div>
      <b style="font-size:18px">${fn2(vidaReal.general.prom)}h promedio</b>
      <div style="font-size:10px;color:var(--tx2)">mín. ${fn2(vidaReal.general.min)}h · máx. ${fn2(vidaReal.general.max)}h</div>
    </div>
    <div class="tbl-wrap" style="margin-bottom:16px"><table style="width:100%;font-size:11px">
      <tr style="background:var(--bg3)"><th style="padding:6px;text-align:left">Posición</th><th>N° cambios</th><th>Promedio</th><th>Mínimo</th><th>Máximo</th></tr>
      ${vidaReal.porPosicion.map(r=>{
        const alerta=r.min<r.prom*0.5;
        return`<tr style="border-bottom:1px solid var(--bd)${alerta?';background:rgba(239,68,68,.05)':''}">
          <td style="padding:6px;font-weight:600">${escapeHtml(r.posicion)}</td>
          <td style="text-align:center">${r.n}</td>
          <td style="text-align:center">${fn2(r.prom)}h</td>
          <td style="text-align:center${alerta?';color:var(--danger);font-weight:700':''}">${fn2(r.min)}h${alerta?' ⚠️':''}</td>
          <td style="text-align:center">${fn2(r.max)}h</td>
        </tr>`;
      }).join('')}
    </table></div>
    <div style="font-size:10px;color:var(--tx2);margin-bottom:16px">⚠️ = algún cambio duró menos de la mitad del promedio de su posición — candidato a revisar garantía o calidad del neumático/proveedor.</div>`:''}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">
      <div style="background:var(--bg3);border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:10px;color:var(--tx3)">Total neumáticos</div>
        <b style="font-size:22px">${totalNeu}</b>
      </div>
      <div style="background:rgba(239,68,68,0.12);border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:10px;color:var(--tx3)">Cambiar ya 🔴</div>
        <b style="font-size:22px;color:var(--danger)">${alertasTotal}</b>
      </div>
      <div style="background:var(--bg3);border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:10px;color:var(--tx3)">Costo reposición operativos</div>
        <b style="font-size:14px;color:var(--ac)">$${fn2(costoReposicion)}</b>
      </div>
      <div style="background:${gastoPerdidoTotal>0?'rgba(239,68,68,0.12)':'var(--bg3)'};border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:10px;color:var(--tx3)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> Gasto perdido (bajas)</div>
        <b style="font-size:14px;color:${gastoPerdidoTotal>0?'var(--danger)':'var(--ok)'}">$${fn2(gastoPerdidoTotal)}</b>
      </div>
    </div>
    <b style="font-size:13px"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,5 8,10 11,7 17,16"/><polyline points="12,16 17,16 17,11"/></svg> Proyección de cambio (según historial de mediciones):</b>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0 16px">
      <div style="background:rgba(239,68,68,0.12);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:9px;color:var(--tx3)">Cambio &lt;30 días</div>
        <b style="font-size:18px;color:var(--danger)">${necesita30}</b>
      </div>
      <div style="background:rgba(234,179,8,0.1);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:9px;color:var(--tx3)">Cambio 30-60 días</div>
        <b style="font-size:18px;color:var(--warn)">${necesita60}</b>
      </div>
      <div style="background:var(--bg3);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:9px;color:var(--tx3)">Sin mediciones para proyectar</div>
        <b style="font-size:18px;color:var(--tx3)">${sinDatos}</b>
      </div>
    </div>
    <b style="font-size:13px"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Proyección de reemplazos por período:</b>
    <div class="card" style="margin:8px 0 10px;border-left:3px solid var(--ac)">
      <div style="font-size:11px;color:var(--tx3)">Necesarios hasta fin de ${new Date().getFullYear()} (según desgaste real de cada neumático operativo)</div>
      <b style="font-size:20px;color:var(--ac)">${hastaFinAnio.length} neumático(s)</b>
      <span style="font-size:12px;color:var(--tx2)"> · $${fn2(costoHastaFinAnio)}</span>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:8px">
      ${['mes','semestre','año'].map(g=>`<button class="btn ${granNeu===g?'':'btn-o'}" onclick="window._neuProyGran='${g}';resumenFlotaNeu()" style="text-transform:capitalize;font-size:11px;padding:4px 10px">${g}</button>`).join('')}
    </div>
    ${periodosNeuOrd.length?`<div class="tbl-wrap" style="margin-bottom:16px"><table style="width:100%;font-size:11px">
      <tr style="background:var(--bg3)"><th style="padding:6px;text-align:left">Período</th><th>Neumáticos</th><th>Costo estimado</th></tr>
      ${periodosNeuOrd.map(p=>{const d=porPeriodoNeu[p];const pasado=p<agruparPeriodo(hoyISONeu,granNeu);
        return`<tr style="border-bottom:1px solid var(--bd)${pasado?';background:rgba(239,68,68,.05)':''}">
        <td style="padding:6px"><b>${escapeHtml(p)}</b>${pasado?' <span style="color:var(--danger);font-size:9px">(atrasado)</span>':''}</td>
        <td style="text-align:center;font-weight:600">${d.cant}</td>
        <td style="text-align:center">$${fn2(d.costo)}</td>
      </tr>`;}).join('')}
    </table></div>
    <p style="font-size:10px;color:var(--tx3);margin:-10px 0 16px">Cada fecha sale de la proyección real de ESE neumático (regresión sobre sus mediciones, ver botón 🔍 en cada fila) — acá solo se agrupan por período, no se re-estima nada.</p>`:`<p style="font-size:11px;color:var(--tx3);margin-bottom:16px">Ningún neumático operativo tiene mediciones suficientes para proyectar todavía.</p>`}
    <b style="font-size:13px">Por estado:</b>
    <div style="overflow-x:auto;margin-top:8px"><table style="width:100%;font-size:11px">
      <tr style="background:var(--bg3)"><th style="padding:6px;text-align:left">Estado</th><th>Cant.</th><th>Rem. prom</th><th>Hrs prom</th><th>Rend. prom</th><th>Costo total</th></tr>
      ${estados.map(e=>`<tr style="border-bottom:1px solid var(--bd)">
        <td style="padding:6px"><b style="color:${colorEstado(e.estado)}">${e.estado}</b></td>
        <td style="text-align:center">${e.count}</td>
        <td style="text-align:center">${e.count?Math.round(e.remProm/e.count):0}mm</td>
        <td style="text-align:center">${fn2(Math.round(e.hrsProm/e.count))}h</td>
        <td style="text-align:center">${e.nRend?Math.round(e.rendProm/e.nRend)+' h/mm':'—'}</td>
        <td style="text-align:center">$${fn2(e.costoTotal)}</td>
      </tr>`).join('')}
    </table></div>
    <button class="btn btn-o" style="margin-top:12px" onclick="cm()">Cerrar</button>
  </div>`);
}

// Puente window/renders — ver nota en mov.js (primera tanda).
window.renderNeu = renderNeu;
window.verNeuLista = verNeuLista;
window._iniciarNeuPorVoz = _iniciarNeuPorVoz;
window._continuarMedicionPorVoz = _continuarMedicionPorVoz;
window._iniciarMedicionNeuPorVoz = _iniciarMedicionNeuPorVoz;
window.addNeu = addNeu;
window.saveNeu = saveNeu;
window.cambiarNeu = cambiarNeu;
window.saveCambio = saveCambio;
window.instalarDesdeExistencias = instalarDesdeExistencias;
window.confirmarInstalarExistencias = confirmarInstalarExistencias;
window.verSensores = verSensores;
window.verHistorialSensor = verHistorialSensor;
window.desmontarSensor = desmontarSensor;
window.instalarSensor = instalarSensor;
window.confirmarInstalarSensor = confirmarInstalarSensor;
window.addMedicionNeu = addMedicionNeu;
window.saveMedicionNeu = saveMedicionNeu;
window._activarLeerChequeoNeu = _activarLeerChequeoNeu;
window._leerChequeoNeuFotoSeleccionada = _leerChequeoNeuFotoSeleccionada;
window._revisarChequeoNeuOCR = _revisarChequeoNeuOCR;
window._guardarChequeoNeuOCR = _guardarChequeoNeuOCR;
window.neuSort = neuSort;
window.histPosicion = histPosicion;
window.verHistorialNeu = verHistorialNeu;
window.verDetalleNeu = verDetalleNeu;
window.resumenFlotaNeu = resumenFlotaNeu;
renders.neu = renderNeu;
