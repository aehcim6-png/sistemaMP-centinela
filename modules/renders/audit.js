// ═══════════════════════════════════════════════════════════════════════
// AUDITORÍA DE DATOS — cruce automático de fuentes para detectar lo que
// antes solo se encontraba revisando a mano (ver auditoría 2026-08:
// horómetros retrocediendo en CN-9501/CN-4656/CN-9500/CN-9503/CN-9507,
// componentes con dato genérico sin cruzar contra correctivos reales,
// OT cerradas sin dejar registrada la solución). Corre sobre los datos ya
// cargados en memoria (S.g) cada vez que se abre la pestaña — no requiere
// pedirlo, se recalcula solo con cada visita.
// window.renderAudit + los 3 chequeos que alimenta.
// ═══════════════════════════════════════════════════════════════════════

// Chequeo 1: horómetro que retrocede entre OT/correctivos consecutivas del
// mismo equipo (ordenadas por fecha) — imposible físicamente, siempre
// indica un dato mal digitado, un cruce de equipo o un timbrado con
// horómetro desactualizado (mismo origen que el bug ya corregido en
// neu.js/ot.js — este chequeo detecta si vuelve a pasar).
function _auditHorometroRetrocede(){
  const ot=S.g('ot')||[];
  const porEquipo={};
  ot.forEach(function(o){
    var h=parseFloat(o.horom);
    if(!o.sigla||isNaN(h)||!o.fecha)return;
    (porEquipo[o.sigla]=porEquipo[o.sigla]||[]).push({fecha:o.fecha,horom:h,sintoma:o.sintoma||''});
  });
  var hallazgos=[];
  Object.keys(porEquipo).forEach(function(sig){
    var arr=porEquipo[sig].slice().sort(function(a,b){return a.fecha<b.fecha?-1:a.fecha>b.fecha?1:0;});
    for(var i=1;i<arr.length;i++){
      if(arr[i].horom<arr[i-1].horom){
        hallazgos.push({sigla:sig,fechaAnt:arr[i-1].fecha,horomAnt:arr[i-1].horom,fecha:arr[i].fecha,horom:arr[i].horom,
          delta:Math.round(arr[i].horom-arr[i-1].horom),sintoma:arr[i].sintoma});
      }
    }
  });
  return hallazgos.sort(function(a,b){return a.delta-b.delta;});
}

// Chequeo 2: componentes mayores que siguen con la estimación genérica de
// industria (nunca se cruzaron contra un reemplazo real en correctivos ni
// contra el Excel) — mismo criterio que se usó para ir cerrando
// Batería/Alternador/Motor de Partida/Bomba de Combustible/Balde.
function _auditComponentesSinValidar(){
  const cd=S.g('compMayores')||[];
  var porComp={};
  cd.forEach(function(c){
    if(!c.obs||!/estimaci[oó]n gen[eé]rica|pendiente de validar/i.test(c.obs))return;
    (porComp[c.comp]=porComp[c.comp]||[]).push(c.sigla);
  });
  return Object.keys(porComp).sort().map(function(c){return{comp:c,n:porComp[c].length,equipos:porComp[c]};});
}

// Chequeo 3: OT correctivas/falla operacional ya cerradas sin ningún texto
// en 'solución' — no queda registrado qué se hizo realmente. Mismo cálculo
// que ya vivía como stat suelto en ot.js, acá queda como lista accionable.
function _auditOTSinSolucion(){
  const ot=S.g('ot')||[];
  return ot.filter(function(o){
    return(!o.estadoOT||o.estadoOT==='Cerrada')&&(o.tipo==='Correctivo'||o.tipo==='Falla Operacional')&&!(o.solucion&&o.solucion.trim());
  }).sort(function(a,b){return(b.fecha||'').localeCompare(a.fecha||'');});
}

window.renderAudit=function(){
  const saltos=_auditHorometroRetrocede();
  const compsSinValidar=_auditComponentesSinValidar();
  const otSinSolucion=_auditOTSinSolucion();
  const totalCompsSinValidar=compsSinValidar.reduce(function(s,c){return s+c.n;},0);

  $('s-audit').innerHTML=`
    <div class="sec-h"><div>
      <div class="sec-t">${ICONS.eye} Auditoría de Datos</div>
      <div class="sec-s">Cruce automático de fuentes — se recalcula solo cada vez que abres esta pestaña</div>
    </div></div>
    <div style="display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap">
      <div class="card" style="flex:1;min-width:170px;padding:10px 14px;text-align:center;${saltos.length?'border-color:var(--danger)':''}">
        <div style="font-size:24px;font-weight:700;color:${saltos.length?'var(--danger)':'var(--ok)'}">${saltos.length}</div>
        <div style="font-size:11px;color:var(--tx3)">Horómetros retrocediendo</div>
      </div>
      <div class="card" style="flex:1;min-width:170px;padding:10px 14px;text-align:center;${totalCompsSinValidar?'border-color:var(--warn)':''}">
        <div style="font-size:24px;font-weight:700;color:${totalCompsSinValidar?'var(--warn)':'var(--ok)'}">${totalCompsSinValidar}</div>
        <div style="font-size:11px;color:var(--tx3)">Componentes con dato genérico sin validar</div>
      </div>
      <div class="card" style="flex:1;min-width:170px;padding:10px 14px;text-align:center">
        <div style="font-size:24px;font-weight:700">${otSinSolucion.length}</div>
        <div style="font-size:11px;color:var(--tx3)">OT cerradas sin solución registrada</div>
      </div>
    </div>

    <div class="sec-t" style="font-size:13px;margin-bottom:6px">${ICONS.warn} Horómetro retrocede entre OT consecutivas (${saltos.length})</div>
    <div style="font-size:11px;color:var(--tx3);margin-bottom:8px">Cada fila es un salto imposible entre dos OT del mismo equipo, ordenadas por fecha — revisar en terreno cuál lectura es la correcta.</div>
    ${saltos.length?`<div class="tbl-wrap" style="margin-bottom:22px"><table>
      <tr><th>Equipo</th><th>Fecha anterior</th><th>Horóm. anterior</th><th>Fecha</th><th>Horóm.</th><th>Delta</th><th>Síntoma</th></tr>
      ${saltos.map(function(h){
        return`<tr><td class="mono" style="color:var(--ac)">${escapeHtml(h.sigla)}</td><td>${escapeHtml(h.fechaAnt)}</td><td class="mono">${h.horomAnt.toLocaleString('es-CL')}</td>
          <td>${escapeHtml(h.fecha)}</td><td class="mono">${h.horom.toLocaleString('es-CL')}</td>
          <td class="mono" style="color:var(--danger);font-weight:700">${h.delta.toLocaleString('es-CL')}</td>
          <td style="font-size:11px;color:var(--tx2)">${escapeHtml(h.sintoma)}</td></tr>`;
      }).join('')}
    </table></div>`:'<div style="font-size:12px;color:var(--ok);margin-bottom:22px">✅ Sin saltos hacia atrás detectados</div>'}

    <div class="sec-t" style="font-size:13px;margin-bottom:6px">${ICONS.bulb} Componentes con dato genérico sin validar (${compsSinValidar.length} tipos)</div>
    <div style="font-size:11px;color:var(--tx3);margin-bottom:8px">Todavía usan vida útil/costo estimado de industria — falta cruzarlos contra un reemplazo real (correctivos u Órdenes de Compra) como ya se hizo con Batería, Alternador, Motor de Partida, Bomba de Combustible y Balde.</div>
    ${compsSinValidar.length?`<div class="tbl-wrap" style="margin-bottom:22px"><table>
      <tr><th>Componente</th><th>N° equipos</th><th>Equipos</th></tr>
      ${compsSinValidar.map(function(c){
        return`<tr><td style="font-weight:600">${escapeHtml(c.comp)}</td><td class="mono">${c.n}</td><td style="font-size:11px;color:var(--tx2)">${c.equipos.map(function(s){return escapeHtml(s);}).join(', ')}</td></tr>`;
      }).join('')}
    </table></div>`:'<div style="font-size:12px;color:var(--ok);margin-bottom:22px">✅ Todos los componentes tienen dato validado</div>'}

    <div class="sec-t" style="font-size:13px;margin-bottom:6px">${ICONS.doc} OT cerradas sin solución registrada (${otSinSolucion.length})</div>
    ${otSinSolucion.length?`<div class="tbl-wrap"><table>
      <tr><th>Equipo</th><th>Fecha</th><th>Síntoma</th></tr>
      ${otSinSolucion.slice(0,50).map(function(o){
        return`<tr><td class="mono" style="color:var(--ac)">${escapeHtml(o.sigla)}</td><td>${escapeHtml(o.fecha||'')}</td><td style="font-size:11px;color:var(--tx2)">${escapeHtml(o.sintoma||'')}</td></tr>`;
      }).join('')}
    </table>${otSinSolucion.length>50?`<div style="font-size:11px;color:var(--tx3);padding:6px">...y ${otSinSolucion.length-50} más</div>`:''}</div>`:'<div style="font-size:12px;color:var(--ok)">✅ Todas las OT cerradas tienen solución registrada</div>'}
  `;
};
