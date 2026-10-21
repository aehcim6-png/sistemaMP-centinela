// ═══════════════════════════════════════════════════════════════════════
// AUDITORÍA DE DATOS — cruce automático de fuentes para detectar lo que
// antes solo se encontraba revisando a mano (ver auditoría 2026-08:
// horómetros retrocediendo en CN-9501/CN-4656/CN-9500/CN-9503/CN-9507,
// componentes con dato genérico sin cruzar contra correctivos reales,
// OT cerradas sin dejar registrada la solución). Corre sobre los datos ya
// cargados en memoria (S.g) cada vez que se abre la pestaña — no requiere
// pedirlo, se recalcula solo con cada visita.
// window.renderAudit + los 6 chequeos que alimenta.
//
// Módulo ES real (Fase 3, 2026-08-30, undécima tanda: Grupo 6 — depende de
// neu.js, ya migrado en la décima tanda) — ver nota de migración en mov.js
// (primera tanda, mismo patrón). Único caso de esta migración con un dato
// (no función) compartido entre archivos: _AUDIT_MESES (más abajo) lo lee
// también pred.js por nombre de variable suelto. Mientras audit.js era
// script plano, ese `const` de nivel superior vivía en el scope global
// compartido y cualquier módulo podía leerlo así. Al pasar audit.js a
// módulo ES, su propio `const` de nivel superior queda privado al módulo
// — deja de ser visible por fuera — así que se agrega el puente
// window._AUDIT_MESES más abajo para que pred.js lo siga encontrando
// exactamente igual que antes.
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

// Chequeo 5 (2026-08-22, a pedido del usuario — automatiza lo que se hizo a
// mano cruzando ~40 Excel en la auditoría 2026-08 de neumáticos): la última
// medición REAL de una posición (planilla mensual, en 'neuMed') registra un
// neumático distinto al que 'neu' todavía muestra como montado ('Operativo')
// — señal de que el equipo cambió esa goma pero nadie movió la saliente a
// Existencias/De baja ni actualizó la serie acá.
// Mismo criterio de emparejamiento sigla+posición que ya usa verDetalleNeu
// (neu.js) — no se inventa uno nuevo que pudiera divergir del historial que
// el usuario ya ve al abrir el detalle de cada neumático.
// Filtro de falso positivo: si la medición "distinta" es ANTERIOR o igual a
// la fecha de instalación que ya tiene el neumático actual (n.fechaInst), no
// es un dato perdido — es un cambio bien registrado en el sistema, solo que
// todavía no le ha tocado su primera medición nueva (normal, no un hallazgo).
function _auditNeuSinSalida(){
  const neu=S.g('neu')||[];
  const allMeds=(S.g('neuMed')&&S.g('neuMed').length)?S.g('neuMed'):(INIT.neuMed||[]);
  var hallazgos=[];
  neu.forEach(function(n){
    if(!n||n.estado!=='Operativo'||!n.sigla)return;
    var posStr=String(n.numPos||n.posicion||'');
    var deEstaPosicion=allMeds.filter(function(m){
      return m&&m.sigla===n.sigla&&m.serie&&m.fecha&&(String(m.posicion)===posStr||m.posicion===n.posicion);
    });
    if(!deEstaPosicion.length)return;
    var ultima=deEstaPosicion.reduce(function(a,b){return b.fecha>a.fecha?b:a;});
    if(ultima.serie===n.serie)return;
    if(n.fechaInst&&ultima.fecha<=n.fechaInst)return;
    hallazgos.push({sigla:n.sigla,posicion:n.posicion,serieSistema:n.serie,fechaInstSistema:n.fechaInst,
      serieUltimaMedicion:ultima.serie,fechaUltimaMedicion:ultima.fecha,remanenteUltimaMedicion:ultima.remProm});
  });
  return hallazgos.sort(function(a,b){return(b.fechaUltimaMedicion||'').localeCompare(a.fechaUltimaMedicion||'');});
}

// Chequeo 6 (2026-08-23): cierra el círculo del aviso proactivo de Score de
// Salud (avisar-salud-equipo) — hasta ahora, una vez mandado el WhatsApp/
// correo, nada confirmaba si de verdad se hizo algo con eso. Busca equipos
// con una alerta ('changelog', accion='Alerta salud equipo') de hace 3 días
// o más SIN ningún correctivo nuevo registrado desde esa fecha — probable
// aviso leído y no seguido.
// Parsea sigla/fecha/motivo/causa del mismo 'detalle' delimitado que arma
// avisar-salud-equipo (no hay columnas propias — el aviso vive en el mismo
// changelog genérico que el resto de la auditoría de accesos).
// Limitación real, no oculta: un equipo puede haberse arreglado sin que
// quede una OT/correctivo formal (ej. se cambió un componente directo en
// Componentes Mayores, o el dato de origen era un error) — como el resto de
// esta pestaña, esto es "revisar", no una prueba de que nadie hizo nada.
var _AUDIT_ALERTA_SALUD_DIAS=3;
function _auditAlertaSaludSinSeguimiento(){
  const log=S.g('changelog')||[];
  const ot=S.g('ot')||[];
  const otHist=S.g('otHist')||[];
  const hoy=new Date().toISOString().slice(0,10);
  var ultimaPorSigla={};
  log.forEach(function(c){
    if(!c||c.accion!=='Alerta salud equipo'||!c.detalle)return;
    var partes=c.detalle.split('|');
    var sigla=partes[0],fecha=partes[1];
    if(!sigla||!fecha)return;
    if(!ultimaPorSigla[sigla]||fecha>ultimaPorSigla[sigla].fecha){
      var motivoM=/motivo=([a-z]+)/.exec(c.detalle);
      var causaM=/causa=([^|]+)/.exec(c.detalle);
      ultimaPorSigla[sigla]={fecha:fecha,motivo:motivoM?motivoM[1]:'',causa:causaM?causaM[1].split(' —')[0].trim():''};
    }
  });
  var ultimoCorrectivoPorSigla={};
  ot.concat(otHist).forEach(function(o){
    if(!o||!o.sigla||!o.fecha)return;
    if(!ultimoCorrectivoPorSigla[o.sigla]||o.fecha>ultimoCorrectivoPorSigla[o.sigla])ultimoCorrectivoPorSigla[o.sigla]=o.fecha;
  });
  var hallazgos=[];
  Object.keys(ultimaPorSigla).forEach(function(sigla){
    var a=ultimaPorSigla[sigla];
    var dias=Math.floor((new Date(hoy)-new Date(a.fecha))/86400000);
    if(dias<_AUDIT_ALERTA_SALUD_DIAS)return;
    var ultCorr=ultimoCorrectivoPorSigla[sigla];
    if(ultCorr&&ultCorr>a.fecha)return; // hubo un correctivo DESPUÉS de la alerta — seguimiento real
    hallazgos.push({sigla:sigla,fechaAlerta:a.fecha,dias:dias,motivo:a.motivo,causa:a.causa,ultimoCorrectivo:ultCorr||null});
  });
  return hallazgos.sort(function(a,b){return b.dias-a.dias;});
}

const _AUDIT_MESES=[{v:'01',l:'Ene'},{v:'02',l:'Feb'},{v:'03',l:'Mar'},{v:'04',l:'Abr'},{v:'05',l:'May'},{v:'06',l:'Jun'},{v:'07',l:'Jul'},{v:'08',l:'Ago'},{v:'09',l:'Sep'},{v:'10',l:'Oct'},{v:'11',l:'Nov'},{v:'12',l:'Dic'}];

export function renderAudit(){
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
  const neuSinSalida=_auditNeuSinSalida().filter(function(h){return pasaFiltro(h.fechaUltimaMedicion,h.sigla);});
  const alertasSinSeguimiento=_auditAlertaSaludSinSeguimiento().filter(function(h){return pasaFiltro(h.fechaAlerta,h.sigla);});

  const anios=[...new Set(ot.map(function(o){return(o.fecha||'').slice(0,4);}).filter(Boolean))].sort().reverse();

  // Completitud de los correctivos (2026-10-18): componente, costo y causa raíz alimentan el costo de
  // mantenimiento, el FMEA y las predicciones. Al cerrar un correctivo ahora se piden (ver edOT en ot.js).
  const corrComp=ot.filter(function(o){return(o.tipo==='Correctivo'||o.tipo==='Falla Operacional')&&pasaFiltro(o.fecha,o.sigla);});
  const nCorr=corrComp.length;
  const pct=function(n){return nCorr?Math.round(n/nCorr*100):0;};
  const conComp=corrComp.filter(function(o){return o.componente&&String(o.componente).trim();}).length;
  const conCompTexto=corrComp.filter(function(o){return(o.componente&&String(o.componente).trim())||(typeof _componenteDeSintoma==='function'&&_componenteDeSintoma(o.sintoma||''));}).length;
  const conCosto=corrComp.filter(function(o){return o.costo>0;}).length;
  const conCausa=corrComp.filter(function(o){return o.causaRaiz&&String(o.causaRaiz).trim();}).length;
  const colPct=function(p){return p>=80?'var(--ok)':p>=40?'var(--w)':'var(--danger)';};
  // Prueba del diccionario de componentes con datos que NO se usaron para afinarlo: el historial 2022-2025
  // (descripción distinta + «sistema» ya asignado). Cobertura y acuerdo con esa etiqueta.
  const evDic=(typeof evaluarDiccionarioComponentes==='function')?evaluarDiccionarioComponentes((S.g('otHist')||[]).map(function(o){return{texto:o.descripcion,etiqueta:o.sistema};})):null;
  const dicHTML=evDic?'<div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--bd)"><div style="font-weight:600;font-size:12px;margin-bottom:4px">¿El diccionario que deduce el componente funciona con textos nuevos?</div>'+
    '<div style="font-size:11px;color:var(--tx3);padding-bottom:8px">El diccionario se afinó con los correctivos actuales, así que medirlo ahí no prueba nada. Se probó con el historial 2022–2025 ('+evDic.n+' descripciones), que no se usó para afinarlo.</div>'+
    '<div style="display:flex;gap:18px;flex-wrap:wrap"><div><div style="font-size:22px;font-weight:700;color:'+colPct(evDic.pctClasificadas)+'">'+String(evDic.pctClasificadas).replace('.',',')+'%</div><div style="font-size:11px;color:var(--tx3);max-width:190px">de las descripciones del historial recibe un componente (rango '+String(evDic.icClasificadas[0]).replace('.',',')+'–'+String(evDic.icClasificadas[1]).replace('.',',')+' %)</div></div>'+
    (evDic.pctAcuerdo!=null?'<div><div style="font-size:22px;font-weight:700;color:'+colPct(evDic.pctAcuerdo)+'">'+String(evDic.pctAcuerdo).replace('.',',')+'%</div><div style="font-size:11px;color:var(--tx3);max-width:230px">coincide con el «sistema» que ya traía el historial ('+evDic.acuerdos+' de '+evDic.clasificadasConEtiqueta+'; rango '+String(evDic.icAcuerdo[0]).replace('.',',')+'–'+String(evDic.icAcuerdo[1]).replace('.',',')+' %)</div></div>':'')+'</div>'+
    (evDic.desacuerdos.length?'<details style="margin-top:8px"><summary style="cursor:pointer;font-size:11px">Dónde no coincide</summary><div style="font-size:11px;color:var(--tx3);padding:6px 0">'+evDic.desacuerdos.map(function(d){return escapeHtml(d.par)+' ('+d.n+')';}).join(' · ')+'<br>Muchos son categorías más finas que la etiqueta del historial (por ejemplo «Radio/Comunicaciones» dentro de «Sistema Eléctrico»), no errores. La etiqueta del historial viene de una clasificación previa y tiene descripciones con varios temas: no es una verdad perfecta.</div></details>':'')+'</div>':'';
  const completitudHTML=nCorr?'<div class="chart-box" style="margin-bottom:14px;border-left:3px solid var(--ac)"><div class="chart-t">Completitud de los correctivos ('+nCorr+')</div>'+
    '<div style="font-size:11px;color:var(--tx3);padding:4px 0 10px">Qué porcentaje de los correctivos tiene cargados los datos que alimentan el costo de mantenimiento, el análisis de causa raíz y las predicciones. Desde ahora, al cerrar un correctivo el sistema pide completar lo que falte.</div>'+
    '<div style="display:flex;gap:18px;flex-wrap:wrap">'+
    [['Componente cargado',pct(conComp)],['Componente (cargado o deducido del texto)',pct(conCompTexto)],['Costo',pct(conCosto)],['Causa raíz',pct(conCausa)]].map(function(x){return'<div><div style="font-size:22px;font-weight:700;color:'+colPct(x[1])+'">'+x[1]+'%</div><div style="font-size:11px;color:var(--tx3);max-width:160px">'+x[0]+'</div></div>';}).join('')+
    '</div>'+dicHTML+'</div>':'';

  $('s-audit').innerHTML=`
    <div class="sec-h"><div>
      <div class="sec-t">${ICONS.eye} Auditoría de Datos</div>
      <div class="sec-s">Cruce automático de fuentes — se recalcula solo cada vez que abres esta pestaña</div>
    </div>${window._userRole==='admin'?'<button class="btn" onclick="verAuditoriaCambios()" title="Historial de cambios campo por campo: quién, en qué pestaña, qué valor había antes y cuál quedó">'+ICONS.eye+' Quién cambió qué</button>':''}</div>
    <div class="toolbar" style="margin-bottom:14px">
      <select id="faSigla" onchange="renders.audit()"><option value="">Todos los equipos</option>${eq.slice().sort(function(a,b){return(a.sigla||'').localeCompare(b.sigla||'');}).map(function(e){return`<option${e.sigla===fSig?' selected':''}>${escapeHtml(e.sigla)}</option>`;}).join('')}</select>
      <select id="faAnio" onchange="renders.audit()"><option value="">Todos los años</option>${anios.map(function(a){return`<option value="${a}"${a===fAnio?' selected':''}>${a}</option>`;}).join('')}</select>
      <select id="faMes" onchange="renders.audit()"><option value="">Todos los meses</option>${_AUDIT_MESES.map(function(m){return`<option value="${m.v}"${m.v===fMes?' selected':''}>${m.l}</option>`;}).join('')}</select>
      ${(fSig||fAnio||fMes)?'<button class="btn-o" onclick="$(\'faSigla\').value=\'\';$(\'faAnio\').value=\'\';$(\'faMes\').value=\'\';renders.audit()">Limpiar filtros</button>':''}
    </div>
    ${completitudHTML}
    <div class="audit-summary">
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
      <div class="card" style="flex:1;min-width:170px;padding:10px 14px;text-align:center;${neuSinSalida.length?'border-color:var(--danger)':''}">
        <div style="font-size:24px;font-weight:700;color:${neuSinSalida.length?'var(--danger)':'var(--ok)'}">${neuSinSalida.length}</div>
        <div style="font-size:11px;color:var(--tx3)">Neumáticos cambiados sin registrar la salida</div>
      </div>
      <div class="card" style="flex:1;min-width:170px;padding:10px 14px;text-align:center;${alertasSinSeguimiento.length?'border-color:var(--warn)':''}">
        <div style="font-size:24px;font-weight:700;color:${alertasSinSeguimiento.length?'var(--warn)':'var(--ok)'}">${alertasSinSeguimiento.length}</div>
        <div style="font-size:11px;color:var(--tx3)">Alertas de Salud de Equipo sin seguimiento (${_AUDIT_ALERTA_SALUD_DIAS}+ días)</div>
      </div>
    </div>

    <div class="audit-section-title sec-t" style="font-size:13px;margin-bottom:6px">${ICONS.warn} Horómetro retrocede entre OT consecutivas (${saltos.length})</div>
    <div style="font-size:11px;color:var(--tx3);margin-bottom:8px">Cada fila es un salto imposible entre dos OT del mismo equipo, ordenadas por fecha — revisar en terreno cuál lectura es la correcta.</div>
    ${saltos.length?`<div class="tbl-wrap" style="margin-bottom:22px"><table>
      <tr><th>Equipo</th><th>Fecha anterior</th><th>Horóm. anterior</th><th>Fecha</th><th>Horóm.</th><th>Delta</th><th>Síntoma</th></tr>
      ${saltos.map(function(h){
        return`<tr><td class="mono" style="color:var(--ac)">${escapeHtml(h.sigla)}</td><td>${escapeHtml(h.fechaAnt)}</td><td class="mono">${fn(h.horomAnt)}</td>
          <td>${escapeHtml(h.fecha)}</td><td class="mono">${fn(h.horom)}</td>
          <td class="mono" style="color:var(--danger);font-weight:700">${fn(h.delta)}</td>
          <td style="font-size:11px;color:var(--tx2)">${escapeHtml(h.sintoma)}</td></tr>`;
      }).join('')}
    </table></div>`:'<div style="font-size:12px;color:var(--ok);margin-bottom:22px">✅ Sin saltos hacia atrás detectados</div>'}

    <div class="audit-section-title sec-t" style="font-size:13px;margin-bottom:6px">${ICONS.bulb} Componentes con dato genérico sin validar (${compsSinValidar.length} tipos)</div>
    <div style="font-size:11px;color:var(--tx3);margin-bottom:8px">Todavía usan vida útil/costo estimado de industria — falta cruzarlos contra un reemplazo real (correctivos u Órdenes de Compra) como ya se hizo con Batería, Alternador, Motor de Partida, Bomba de Combustible y Balde.${(fAnio||fMes)?' Este listado no tiene fecha propia, así que el filtro de Año/Mes no le aplica — solo el de Equipo.':''}</div>
    ${compsSinValidar.length?`<div class="tbl-wrap" style="margin-bottom:22px"><table>
      <tr><th>Componente</th><th>N° equipos</th><th>Equipos</th></tr>
      ${compsSinValidar.map(function(c){
        return`<tr><td style="font-weight:600">${escapeHtml(c.comp)}</td><td class="mono">${c.n}</td><td style="font-size:11px;color:var(--tx2)">${c.equipos.map(function(s){return escapeHtml(s);}).join(', ')}</td></tr>`;
      }).join('')}
    </table></div>`:'<div style="font-size:12px;color:var(--ok);margin-bottom:22px">✅ Todos los componentes tienen dato validado</div>'}

    <div class="audit-section-title sec-t" style="font-size:13px;margin-bottom:6px">${ICONS.doc} OT cerradas sin solución registrada (${otSinSolucion.length})</div>
    ${otSinSolucion.length?`<div class="tbl-wrap" style="margin-bottom:22px"><table>
      <tr><th>Equipo</th><th>Fecha</th><th>Síntoma</th></tr>
      ${otSinSolucion.slice(0,50).map(function(o){
        return`<tr><td class="mono" style="color:var(--ac)">${escapeHtml(o.sigla)}</td><td>${escapeHtml(o.fecha||'')}</td><td style="font-size:11px;color:var(--tx2)">${escapeHtml(o.sintoma||'')}</td></tr>`;
      }).join('')}
    </table>${otSinSolucion.length>50?`<div style="font-size:11px;color:var(--tx3);padding:6px">...y ${otSinSolucion.length-50} más</div>`:''}</div>`:'<div style="font-size:12px;color:var(--ok);margin-bottom:22px">✅ Todas las OT cerradas tienen solución registrada</div>'}

    <div class="audit-section-title sec-t" style="font-size:13px;margin-bottom:6px">${ICONS.warn} Reportes automáticos por revisar (${porRevisar.length})</div>
    <div style="font-size:11px;color:var(--tx3);margin-bottom:8px">Cargados solos desde WhatsApp/correo (whatsapp-webhook/email-webhook), pero el parser no logró clasificarlos con confianza — se guardaron igual (nunca se descartan en silencio) para que se confirmen o corrijan acá. Si el equipo/componente es correcto, no hace falta hacer nada; si no, corrígelo por SQL directo sobre correctivos_historico (tabla de solo lectura desde la app, a propósito).</div>
    ${porRevisar.length?`<div class="tbl-wrap" style="margin-bottom:22px"><table>
      <tr><th>Equipo</th><th>Fecha</th><th>Sistema</th><th>Descripción</th><th>Fuente</th></tr>
      ${porRevisar.slice(0,50).map(function(o){
        return`<tr><td class="mono" style="color:var(--ac)">${escapeHtml(o.sigla||'')}</td><td>${escapeHtml(o.fecha||'')}</td><td>${escapeHtml(o.sistema||'')}</td><td style="font-size:11px;color:var(--tx2)">${escapeHtml((o.descripcion||'').slice(0,120))}</td><td style="font-size:10px;color:var(--warn)">${escapeHtml(o.fuente||'')}</td></tr>`;
      }).join('')}
    </table>${porRevisar.length>50?`<div style="font-size:11px;color:var(--tx3);padding:6px">...y ${porRevisar.length-50} más</div>`:''}</div>`:'<div style="font-size:12px;color:var(--ok);margin-bottom:22px">✅ Sin reportes automáticos pendientes de revisión</div>'}

    <div class="audit-section-title sec-t" style="font-size:13px;margin-bottom:6px">${ICONS.warn} Neumáticos cambiados sin registrar la salida (${neuSinSalida.length})</div>
    <div style="font-size:11px;color:var(--tx3);margin-bottom:8px">La última medición real de esa posición (planilla mensual) trae una serie distinta a la que el sistema todavía muestra como montada — probablemente se cambió el neumático en terreno pero nunca se movió el saliente a Existencias/De baja acá. Usa "↺ Cambio" en Neumáticos para corregirlo.</div>
    ${neuSinSalida.length?`<div class="tbl-wrap" style="margin-bottom:22px"><table>
      <tr><th>Equipo</th><th>Posición</th><th>Serie en sistema</th><th>Serie última medición</th><th>Fecha medición</th><th>Remanente medido</th></tr>
      ${neuSinSalida.slice(0,50).map(function(h){
        return`<tr><td class="mono" style="color:var(--ac)">${escapeHtml(h.sigla)}</td><td>${escapeHtml(h.posicion||'')}</td><td class="mono">${escapeHtml(h.serieSistema||'—')}</td><td class="mono" style="color:var(--danger);font-weight:700">${escapeHtml(h.serieUltimaMedicion)}</td><td>${escapeHtml(h.fechaUltimaMedicion)}</td><td class="mono">${h.remanenteUltimaMedicion!=null?h.remanenteUltimaMedicion+'mm':'—'}</td></tr>`;
      }).join('')}
    </table>${neuSinSalida.length>50?`<div style="font-size:11px;color:var(--tx3);padding:6px">...y ${neuSinSalida.length-50} más</div>`:''}</div>`:'<div style="font-size:12px;color:var(--ok);margin-bottom:22px">✅ Sin cambios de neumático pendientes de registrar</div>'}

    <div class="audit-section-title sec-t" style="font-size:13px;margin-bottom:6px">${ICONS.warn} Alertas de Salud de Equipo sin seguimiento (${alertasSinSeguimiento.length})</div>
    <div style="font-size:11px;color:var(--tx3);margin-bottom:8px">El sistema ya avisó por WhatsApp/correo que este equipo cruzó a Salud Baja o cayó fuerte (Dashboard → Equipos con Salud Baja), hace ${_AUDIT_ALERTA_SALUD_DIAS} días o más, y no hay ningún correctivo nuevo registrado desde entonces — probable aviso sin seguimiento. Ojo: si se arregló sin dejar una OT formal (ej. cambio de componente directo en Componentes Mayores), esto puede ser un falso positivo — revisar, no es prueba de que nadie hizo nada.</div>
    ${alertasSinSeguimiento.length?`<div class="tbl-wrap"><table>
      <tr><th>Equipo</th><th>Fecha alerta</th><th>Días sin seguimiento</th><th>Motivo</th><th>Causa</th><th>Último correctivo</th></tr>
      ${alertasSinSeguimiento.slice(0,50).map(function(h){
        return`<tr><td class="mono" style="color:var(--ac)">${escapeHtml(h.sigla)}</td><td>${escapeHtml(h.fechaAlerta)}</td><td class="mono" style="color:var(--danger);font-weight:700">${h.dias}</td><td>${h.motivo==='caida'?'Caída fuerte':'Cruce a Salud Baja'}</td><td style="font-size:11px;color:var(--tx2)">${escapeHtml(h.causa||'—')}</td><td>${escapeHtml(h.ultimoCorrectivo||'Sin correctivos registrados')}</td></tr>`;
      }).join('')}
    </table>${alertasSinSeguimiento.length>50?`<div style="font-size:11px;color:var(--tx3);padding:6px">...y ${alertasSinSeguimiento.length-50} más</div>`:''}</div>`:'<div style="font-size:12px;color:var(--ok)">✅ Sin alertas de salud pendientes de seguimiento</div>'}
  `;
  _auditOrdenar();
}

// Orden por prioridad (2026-10-21): las 6 revisiones iban siempre en el mismo orden aunque 5 estuvieran en cero (cada una con su título, su explicación y un
// «✅ sin hallazgos»). Ahora las que SÍ tienen hallazgos van primero, tal cual, y las que están en cero se juntan en un solo bloque plegado («Controles sin
// hallazgos»). Se reacomodan los nodos ya dibujados (no se recalcula nada ni se pierde ningún texto); el estado abierto/cerrado se recuerda al redibujar.
function _auditOrdenar(){
  var raiz=$('s-audit');
  if(!raiz||raiz.querySelector('.audit-sec'))return;
  var titulos=[].slice.call(raiz.children).filter(function(e){return e.classList.contains('audit-section-title');});
  if(!titulos.length)return;
  var secciones=titulos.map(function(t){
    var sec=document.createElement('section'),m=/\((\d+)/.exec(t.textContent),hijos=[t],n=t.nextElementSibling;
    sec.className='audit-sec';sec.dataset.n=m?m[1]:'0';
    while(n&&!n.classList.contains('audit-section-title')){hijos.push(n);n=n.nextElementSibling;}
    t.parentNode.insertBefore(sec,t);
    hijos.forEach(function(h){sec.appendChild(h);});
    return sec;
  });
  var sin=secciones.filter(function(x){return +x.dataset.n===0;});
  if(!sin.length)return;
  var d=document.createElement('details');
  d.className='audit-ok';d.open=!!window._auditOkAbierto;
  d.addEventListener('toggle',function(){window._auditOkAbierto=d.open;});
  var sm=document.createElement('summary');
  sm.textContent='Controles sin hallazgos ('+sin.length+' de '+secciones.length+')';
  d.appendChild(sm);
  sin.forEach(function(x){d.appendChild(x);});
  raiz.appendChild(d);   // al final: las secciones con hallazgos quedaron arriba, en su orden original
}

// Puente window/renders — ver nota en mov.js (primera tanda). _AUDIT_MESES
// también se puentea (no es función) porque pred.js lo lee por nombre
// suelto — ver nota de migración arriba.
window.renderAudit = renderAudit;
window._AUDIT_MESES = _AUDIT_MESES;
renders.audit = renderAudit;
