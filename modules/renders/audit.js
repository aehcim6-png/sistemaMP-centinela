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

// Chequeo 4 (2026-08-18): reportes cargados automáticamente por WhatsApp/
// correo (whatsapp-webhook/email-webhook) que el parser no pudo clasificar
// con confianza (equipo no reconocido, parece pregunta, parece PM
// programado en vez de correctivo, etc.) — se insertan igual en
// correctivos_historico (nunca se descartan en silencio), pero con
// fuente terminada en "— revisar" para que quede visible acá hasta que un
// admin confirme el dato o lo corrija/borre por SQL.
function _auditOtHistPorRevisar(){
  const otHist=S.g('otHist')||[];
  return otHist.filter(function(o){return o&&o.fuente&&/— revisar$/.test(o.fuente);})
    .sort(function(a,b){return(b.fecha||'').localeCompare(a.fecha||'');});
}

const _AUDIT_MESES=[{v:'01',l:'Ene'},{v:'02',l:'Feb'},{v:'03',l:'Mar'},{v:'04',l:'Abr'},{v:'05',l:'May'},{v:'06',l:'Jun'},{v:'07',l:'Jul'},{v:'08',l:'Ago'},{v:'09',l:'Sep'},{v:'10',l:'Oct'},{v:'11',l:'Nov'},{v:'12',l:'Dic'}];

window.renderAudit=function(){
  const eq=S.g('eq')||[];
  const ot=S.g('ot')||[];
  const fSig=$('faSigla')?.value||'';
  const fAnio=$('faAnio')?.value||'';
  const fMes=$('faMes')?.value||'';

  // Los 3 chequeos se calculan siempre sobre TODOS los datos — el filtro
  // solo decide qué mostrar, así los contadores de arriba nunca mienten
  // por un filtro que el usuario dejó puesto sin darse cuenta.
  function pasaFiltro(fecha,sigla){
    if(fSig&&sigla!==fSig)return false;
    if(fAnio&&(fecha||'').slice(0,4)!==fAnio)return false;
    if(fMes&&(fecha||'').slice(5,7)!==fMes)return false;
    return true;
  }
  const saltos=_auditHorometroRetrocede().filter(function(h){return pasaFiltro(h.fecha,h.sigla);});
  const otSinSolucion=_auditOTSinSolucion().filter(function(o){return pasaFiltro(o.fecha,o.sigla);});
  // Componentes sin validar no tiene fecha real (fechaInst queda null en la
  // estimación genérica) — solo se filtra por equipo, Mes/Año no aplica.
  const compsSinValidar=_auditComponentesSinValidar().map(function(c){
    var equipos=fSig?c.equipos.filter(function(s){return s===fSig;}):c.equipos;
    return{comp:c.comp,n:equipos.length,equipos:equipos};
  }).filter(function(c){return c.n>0;});
  const totalCompsSinValidar=compsSinValidar.reduce(function(s,c){return s+c.n;},0);
  // otHist no tiene 'estadoOT' pendiente/en ejecución (el adaptador siempre le
  // pone 'Cerrada'), así que pasaFiltro (pensado para 'ot') igual le sirve —
  // fecha/sigla son campos comunes a ambas tablas.
  const porRevisar=_auditOtHistPorRevisar().filter(function(o){return pasaFiltro(o.fecha,o.sigla);});

  const anios=[...new Set(ot.map(function(o){return(o.fecha||'').slice(0,4);}).filter(Boolean))].sort().reverse();

  $('s-audit').innerHTML=`
    <div class="sec-h"><div>
      <div class="sec-t">${ICONS.eye} Auditoría de Datos</div>
      <div class="sec-s">Cruce automático de fuentes — se recalcula solo cada vez que abres esta pestaña</div>
    </div></div>
    <div class="toolbar" style="margin-bottom:14px">
      <select id="faSigla" onchange="renders.audit()"><option value="">Todos los equipos</option>${eq.slice().sort(function(a,b){return(a.sigla||'').localeCompare(b.sigla||'');}).map(function(e){return`<option${e.sigla===fSig?' selected':''}>${escapeHtml(e.sigla)}</option>`;}).join('')}</select>
      <select id="faAnio" onchange="renders.audit()"><option value="">Todos los años</option>${anios.map(function(a){return`<option value="${a}"${a===fAnio?' selected':''}>${a}</option>`;}).join('')}</select>
      <select id="faMes" onchange="renders.audit()"><option value="">Todos los meses</option>${_AUDIT_MESES.map(function(m){return`<option value="${m.v}"${m.v===fMes?' selected':''}>${m.l}</option>`;}).join('')}</select>
      ${(fSig||fAnio||fMes)?'<button class="btn-o" onclick="$(\'faSigla\').value=\'\';$(\'faAnio\').value=\'\';$(\'faMes\').value=\'\';renders.audit()">Limpiar filtros</button>':''}
    </div>
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
      <div class="card" style="flex:1;min-width:170px;padding:10px 14px;text-align:center;${porRevisar.length?'border-color:var(--warn)':''}">
        <div style="font-size:24px;font-weight:700;color:${porRevisar.length?'var(--warn)':'var(--ok)'}">${porRevisar.length}</div>
        <div style="font-size:11px;color:var(--tx3)">Reportes automáticos (WhatsApp/correo) por revisar</div>
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
    <div style="font-size:11px;color:var(--tx3);margin-bottom:8px">Todavía usan vida útil/costo estimado de industria — falta cruzarlos contra un reemplazo real (correctivos u Órdenes de Compra) como ya se hizo con Batería, Alternador, Motor de Partida, Bomba de Combustible y Balde.${(fAnio||fMes)?' Este listado no tiene fecha propia, así que el filtro de Año/Mes no le aplica — solo el de Equipo.':''}</div>
    ${compsSinValidar.length?`<div class="tbl-wrap" style="margin-bottom:22px"><table>
      <tr><th>Componente</th><th>N° equipos</th><th>Equipos</th></tr>
      ${compsSinValidar.map(function(c){
        return`<tr><td style="font-weight:600">${escapeHtml(c.comp)}</td><td class="mono">${c.n}</td><td style="font-size:11px;color:var(--tx2)">${c.equipos.map(function(s){return escapeHtml(s);}).join(', ')}</td></tr>`;
      }).join('')}
    </table></div>`:'<div style="font-size:12px;color:var(--ok);margin-bottom:22px">✅ Todos los componentes tienen dato validado</div>'}

    <div class="sec-t" style="font-size:13px;margin-bottom:6px">${ICONS.doc} OT cerradas sin solución registrada (${otSinSolucion.length})</div>
    ${otSinSolucion.length?`<div class="tbl-wrap" style="margin-bottom:22px"><table>
      <tr><th>Equipo</th><th>Fecha</th><th>Síntoma</th></tr>
      ${otSinSolucion.slice(0,50).map(function(o){
        return`<tr><td class="mono" style="color:var(--ac)">${escapeHtml(o.sigla)}</td><td>${escapeHtml(o.fecha||'')}</td><td style="font-size:11px;color:var(--tx2)">${escapeHtml(o.sintoma||'')}</td></tr>`;
      }).join('')}
    </table>${otSinSolucion.length>50?`<div style="font-size:11px;color:var(--tx3);padding:6px">...y ${otSinSolucion.length-50} más</div>`:''}</div>`:'<div style="font-size:12px;color:var(--ok);margin-bottom:22px">✅ Todas las OT cerradas tienen solución registrada</div>'}

    <div class="sec-t" style="font-size:13px;margin-bottom:6px">${ICONS.warn} Reportes automáticos por revisar (${porRevisar.length})</div>
    <div style="font-size:11px;color:var(--tx3);margin-bottom:8px">Cargados solos desde WhatsApp/correo (whatsapp-webhook/email-webhook), pero el parser no logró clasificarlos con confianza — se guardaron igual (nunca se descartan en silencio) para que se confirmen o corrijan acá. Si el equipo/componente es correcto, no hace falta hacer nada; si no, corrígelo por SQL directo sobre correctivos_historico (tabla de solo lectura desde la app, a propósito).</div>
    ${porRevisar.length?`<div class="tbl-wrap"><table>
      <tr><th>Equipo</th><th>Fecha</th><th>Sistema</th><th>Descripción</th><th>Fuente</th></tr>
      ${porRevisar.slice(0,50).map(function(o){
        return`<tr><td class="mono" style="color:var(--ac)">${escapeHtml(o.sigla||'')}</td><td>${escapeHtml(o.fecha||'')}</td><td>${escapeHtml(o.sistema||'')}</td><td style="font-size:11px;color:var(--tx2)">${escapeHtml((o.descripcion||'').slice(0,120))}</td><td style="font-size:10px;color:var(--warn)">${escapeHtml(o.fuente||'')}</td></tr>`;
      }).join('')}
    </table>${porRevisar.length>50?`<div style="font-size:11px;color:var(--tx3);padding:6px">...y ${porRevisar.length-50} más</div>`:''}</div>`:'<div style="font-size:12px;color:var(--ok)">✅ Sin reportes automáticos pendientes de revisión</div>'}
  `;
};
