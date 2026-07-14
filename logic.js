// logic.js — lógica de negocio pura de SistemaMP Centinela, sin dependencias de DOM.
// Se carga como <script src="logic.js"></script> antes del script principal de
// index.html (mismo scope global de siempre, nada cambia para el resto de la app)
// y también se importa directo en los tests (Vitest/Node). Extraído el 2026-07-14
// para poder testear esta lógica sin arrancar la app completa.

const C = {
  // Clasifica el tipo de PM según cuántas veces se acumuló la frecuencia base del
  // equipo (frecPM): 1x -> PM1, 2x -> PM2, 4x -> PM3, 8x -> PM4 (mismos umbrales de
  // siempre — 250/500/1000/2000h — para el default frecPM=250 de los equipos por
  // horas). Antes los umbrales estaban fijos en horas (500/1000/2000), así que un
  // vehículo por kilómetros (frecPM=10000, ej. camionetas externalizadas) daba
  // SIEMPRE 'PM4' — cualquier múltiplo de 10.000 también es múltiplo de 2.000 — sin
  // importar si era su primer o su décimo servicio.
  tipoPM(h,frecPM=250){const f=frecPM||250;return h%(f*8)===0?'PM4':h%(f*4)===0?'PM3':h%(f*2)===0?'PM2':'PM1'},
  proxPM(h,f=250){return Math.ceil(h/f)*f},
  estado(d){return d<0?{t:'VENCIDA',c:'b-r',i:'🔴'}:d<=7?{t:'URGENTE',c:'b-r',i:'🔴'}:d<=30?{t:'PRÓXIMA',c:'b-y',i:'🟡'}:{t:'AL DÍA',c:'b-g',i:'🟢'}},
  alertaPM4(h){return h<250?{t:'URGENTE (<250h)',c:'b-r'}:h<500?{t:'PRÓXIMA (<500h)',c:'b-y'}:h<1000?{t:'PLANIFICAR',c:'b-b'}:{t:'OK — '+h.toLocaleString()+'h',c:'b-g'}},
  recalc(e){
    const p=this.proxPM(e.horomActual,e.frecPM||250);
    const hr=p-e.horomActual;
    const d=e.hrsDia>0?Math.round(hr/e.hrsDia):999;
    const hoy=new Date();
    e.horomProxPM=p;e.hrsRestantes=hr;e.diasParaPM=d;
    e.fechaProxPM=new Date(hoy.getTime()+d*864e5).toISOString().slice(0,10);
    e.tipoPM=this.tipoPM(p,e.frecPM||250);
    const s=this.estado(d);e.estado=s.i+' '+s.t;
    return e;
  },
  // Horómetro de un equipo a la fecha límite dada, según historial_horometros (hist).
  // Toma el registro más reciente con fecha <= fechaLimite; null si no hay ninguno.
  horomHistorico(histArr,sigla,fechaLimite){
    let mejor=null;
    (histArr||[]).forEach(h=>{
      if(h.sigla!==sigla||!h.fecha||h.fecha>fechaLimite)return;
      if(!mejor||h.fecha>mejor.fecha)mejor=h;
    });
    if(!mejor)return null;
    const v=mejor.horomFin!=null?mejor.horomFin:mejor.horom;
    return v==null?null:v;
  },
  // Reconstruye (mes pasado, desde hist) o proyecta (mes futuro, desde horomActual+hrsDia)
  // el estado de un equipo para un mes distinto al actual. Nunca inventa un número: si no
  // hay dato histórico para ese equipo antes de la fecha objetivo, devuelve null.
  estadoPeriodo(equipo,histArr,hoyISO,targetFechaISO){
    const mesHoy=hoyISO.slice(0,7),mesObjetivo=targetFechaISO.slice(0,7);
    let horom,fuente;
    if(mesObjetivo===mesHoy){
      horom=equipo.horomActual;fuente='vivo';
    } else if(targetFechaISO<hoyISO){
      horom=this.horomHistorico(histArr,equipo.sigla,targetFechaISO);
      if(horom==null)return null;
      fuente='historico';
    } else {
      const dias=Math.round((new Date(targetFechaISO+'T00:00:00')-new Date(hoyISO+'T00:00:00'))/86400000);
      horom=(equipo.horomActual||0)+(equipo.hrsDia||0)*dias;
      fuente='proyectado';
    }
    const horomProxPM=this.proxPM(horom,equipo.frecPM||250);
    const hrsRestantes=horomProxPM-horom;
    const diasParaPM=equipo.hrsDia>0?Math.round(hrsRestantes/equipo.hrsDia):999;
    const est=this.estado(diasParaPM);
    return{t:est.t,horom,horomProxPM,diasParaPM,tipoPM:this.tipoPM(horomProxPM,equipo.frecPM||250),fuente};
  }
};

function fd(d){return(!d||d==='None'||d===0)?'—':String(d).slice(0,10)}
function fn(n){return(n||0).toLocaleString('es-CL')}
function escapeHtml(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

function _tokensMaterial(s){
  return (s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(function(t){
    if(t.length<2)return false;
    if(/^\d+$/.test(t)&&t.length>=4)return false;
    if(t==='l'||t==='lt'||t==='lts'||t==='litro'||t==='litros'||t==='kg'||t==='gl')return false;
    return true;
  });
}
function _scoreMaterial(repTokens,prodNombre){
  var pt=_tokensMaterial(prodNombre);if(!pt.length)return 0;
  var hits=0;pt.forEach(function(t){if(repTokens.indexOf(t)>=0)hits++;});
  return hits/pt.length;
}
function precioMaterial(rep,lub,stk){
  var norm=function(s){return(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');};
  var nr=norm(rep);
  // 1) N° de parte exacto en Stock Filtros (lo más confiable)
  var sf=(stk||[]).find(function(s){return s.nParte&&nr.includes(norm(s.nParte))&&norm(s.nParte).length>=4;});
  if(sf&&sf.precioUnit>0)return sf.precioUnit;
  // 2) Match por palabras clave significativas
  var repTok=_tokensMaterial(rep);
  var mejor=0,precio=0;
  (lub||[]).forEach(function(l){
    if(!(l.precio>0))return;
    var sc=_scoreMaterial(repTok,l.nombre);
    if(sc>mejor){mejor=sc;precio=l.precio;}
  });
  (stk||[]).forEach(function(s){
    if(!(s.precioUnit>0))return;
    var sc=_scoreMaterial(repTok,s.descripcion);
    if(sc>mejor){mejor=sc;precio=s.precioUnit;}
  });
  return mejor>=0.6?precio:0;
}

// Determina si un repuesto de pauta es lubricante vs filtro
function esLubricante(rep){
  if(!rep)return false;
  var r=rep.toLowerCase();
  if(r.startsWith('filtro')||r.startsWith('kit filtro')||r.startsWith('prefiltro')||r.startsWith('elemento filtro'))return false;
  if(/^[a-z]?\d{3,}-/.test(r.trim()))return false;
  if(r.includes('oring')||r.includes('o-ring')||r.includes('anillo')||r.includes('correa')||r.includes('cartucho filtro'))return false;
  return (r.includes('aceite')||r.includes('mobil')||r.includes('grasa')||r.includes('refriger')||
          r.includes('antifreeze')||r.includes('15w')||r.includes('10w')||r.includes('30w')||
          r.includes('50w')||r.includes('75w')||r.includes('atf')||r.includes('fluid')||
          r.includes('mobilube')||r.includes('mobilgrease')||r.includes('mobiltrans')||
          r.includes('dte 10')||r.includes('delvac'));
}

function vencReglaDefault(tipoEquipo, vencTipo){
  var t=(tipoEquipo||'').toUpperCase();
  if(vencTipo==='Sistema AFEX'){
    // 'CAEX' nunca aparece en los tipos reales de equipo (los camiones mineros están
    // tipificados como 'Camion'/'Camion Aljibe') — sin este chequeo, el segmento más
    // grande y más crítico de la flota nunca recibía periodicidad sugerida. Ojo:
    // 'CAMION ' (con espacio) para no matchear 'CAMIONETA', que no debe llevar AFEX.
    if(t.indexOf('CAEX')>=0||t==='CAMION'||t.indexOf('CAMION ')>=0||t.indexOf('BULLDOZER')>=0||t.indexOf('CARGADOR')>=0) return 6;
    return null;
  }
  if(vencTipo==='Revisión Técnica'){
    if(t.indexOf('ALJIBE')>=0||t.indexOf('BUS')>=0) return 6;
    if(t.indexOf('CAMIONETA')>=0) return 12;
    return null;
  }
  if(vencTipo==='Permiso Circulación'){
    if(t.indexOf('ALJIBE')>=0||t.indexOf('CAMIONETA')>=0||t.indexOf('BUS')>=0) return 12;
    return null;
  }
  if(vencTipo==='Seguro'){
    if(t.indexOf('CAMIONETA')>=0) return 12;
    return null;
  }
  if(vencTipo==='Decreto 80'){
    if(t.indexOf('BUS')>=0) return 48;
    return null;
  }
  return null;
}

// Año en un rango plausible para este sistema (rechaza años corruptos tipo "10000-12-31",
// que un typo/import puede producir y que Postgres acepta sin problema como fecha válida).
function fechaEsPlausible(fecha){
  if(!fecha)return true; // vacío se valida aparte en cada flujo, no es "implausible"
  var m=String(fecha).match(/^(\d{4})-\d{2}-\d{2}$/);
  if(!m)return false;
  var anio=parseInt(m[1],10);
  return anio>=2000&&anio<=2100;
}
// Compara dos fechas ISO (YYYY-MM-DD) como fechas reales, no como texto — comparar
// texto falla cuando los años tienen distinta cantidad de dígitos: "10000-12-31" queda
// alfabéticamente ANTES que "2025-01-31" (el '1' va antes que el '2'), aunque sea un
// año ~8000 después. true si 'a' es estrictamente anterior a 'b'.
function fechaEsAnterior(a,b){
  return new Date(a+'T00:00:00').getTime()<new Date(b+'T00:00:00').getTime();
}

function vencCalcProximo(ultimaFecha, periodicidadMeses){
  if(!ultimaFecha||!periodicidadMeses)return null;
  var d=new Date(ultimaFecha+'T00:00:00');
  if(isNaN(d))return null;
  d.setMonth(d.getMonth()+parseInt(periodicidadMeses));
  return d.toISOString().slice(0,10);
}

function vencEstado(proximaFecha){
  if(!proximaFecha)return{label:'Sin datos',color:'var(--tx3)',dias:null};
  var hoy=new Date();hoy.setHours(0,0,0,0);
  var prox=new Date(proximaFecha+'T00:00:00');
  var dias=Math.round((prox-hoy)/86400000);
  if(dias<0)return{label:'🔴 VENCIDO ('+Math.abs(dias)+'d)',color:'var(--danger)',dias:dias};
  if(dias<=30)return{label:'🟡 Vence en '+dias+'d',color:'#eab308',dias:dias};
  return{label:'🟢 OK ('+dias+'d)',color:'var(--ok)',dias:dias};
}

if (typeof window !== 'undefined') {
  window._tokensMaterial = _tokensMaterial;
  window._scoreMaterial = _scoreMaterial;
  window.precioMaterial = precioMaterial;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    C, fd, fn, escapeHtml,
    _tokensMaterial, _scoreMaterial, precioMaterial,
    esLubricante, vencReglaDefault, vencCalcProximo, vencEstado,
    fechaEsPlausible, fechaEsAnterior
  };
}
