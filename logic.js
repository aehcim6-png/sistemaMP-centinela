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
  // Alerta de overhaul (PM4): mismo problema que tenía tipoPM antes de su fix —
  // bandas fijas en horas (250/500/1000) sin importar el frecPM propio del equipo.
  // Para un vehículo por kilómetros (frecPM=10000) esto mostraba "🔴 URGENTE (<250h)"
  // comparando un remanente en KM contra un umbral pensado en HORAS. Ahora las
  // bandas son 1x/2x/4x el frecPM del equipo (igual que las 4 escalas de tipoPM),
  // y la unidad mostrada es la real del equipo, no siempre "h".
  alertaPM4(h,frecPM=250,unidad='h'){const f=frecPM||250;return h<f?{t:'URGENTE (<'+f+unidad+')',c:'b-r'}:h<f*2?{t:'PRÓXIMA (<'+(f*2)+unidad+')',c:'b-y'}:h<f*4?{t:'PLANIFICAR',c:'b-b'}:{t:'OK — '+h.toLocaleString()+unidad,c:'b-g'}},
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
  // MTBF real: promedio de horas de operación ENTRE fallas sucesivas, usando el
  // horómetro real registrado en cada falla (ot.horom) — no "horómetro actual del
  // equipo ÷ cantidad de fallas" (la fórmula vieja), que reparte todas las fallas
  // parejo desde la hora 0 y no distingue un equipo que las tiene agrupadas de uno
  // que las tiene bien espaciadas — además cambiaba solo porque pasa el tiempo,
  // no porque haya vuelto a fallar. Necesita al menos 2 fallas con horómetro válido
  // para tener un intervalo real que medir; si no, no se inventa un número — null.
  mtbfReal(horomFallas){
    const validos=(horomFallas||[]).filter(h=>h>0).sort((a,b)=>a-b);
    if(validos.length<2)return null;
    return Math.round((validos[validos.length-1]-validos[0])/(validos.length-1));
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

// Duración entre entrada y salida de un PM/correctivo — un solo lugar para el cálculo
// que antes estaba copiado 4 veces (calcDurReg, calcDurEdit, saveReg y saveEditReg,
// cada uno con su propia versión del mismo "new Date(fSal+hSal)-new Date(fEnt+hEnt)").
// null si falta algún dato; si no, {ms, horas, texto}. Un ms negativo (salida antes
// que entrada) se devuelve tal cual — cada llamador decide si eso es un error a
// mostrar o simplemente no usar el texto.
function duracionHM(fEnt,hEnt,fSal,hSal){
  if(!fEnt||!hEnt||!fSal||!hSal)return null;
  const ms=new Date(fSal+'T'+hSal)-new Date(fEnt+'T'+hEnt);
  const horas=ms/3600000;
  const texto=Math.floor(ms/3600000)+'h '+String(Math.floor((ms%3600000)/60000)).padStart(2,'0')+'min';
  return{ms,horas,texto};
}

// Lista de días ISO (YYYY-MM-DD) desde 'desde' hasta 'hasta' inclusive. Usado por el
// cálculo de disponibilidad para marcar cada día de una salida de servicio de varios
// días. Devuelve [] si las fechas son inválidas o 'hasta' es anterior a 'desde'.
function rangoDias(desde, hasta){
  if(!desde)return [];
  if(!hasta)hasta=desde;
  var d=new Date(desde+'T00:00:00'), fin=new Date(hasta+'T00:00:00');
  if(isNaN(d)||isNaN(fin)||fin<d)return [];
  var out=[], guard=0;
  while(d<=fin && guard++<3660){ out.push(d.toISOString().slice(0,10)); d.setDate(d.getDate()+1); }
  return out;
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

// ═══ PREDICTIVO (2026-07) — estadísticas en vivo desde ordenes_compra_historico ═══
// Extraído de index.html/computePred() para poder testearlo sin arrancar la app.
// leadTime queda fijo en 34 días porque el histórico real no trae fecha de entrega —
// mismo supuesto que ya usan riesgoQuiebre() y el default de repuestos en index.html.
function predFromOrdenes(oc){
  var LEAD=34;
  var porEquipo={},porItem={},costoPorMes={},pedidosGlobal=new Set(),costoGlobal=0;
  var mesMin=null,mesMax=null;
  (oc||[]).forEach(function(o){
    var mes=(o.fecha||'').slice(0,7);
    if(!mes||!o.pedido)return;
    if(mesMin===null||mes<mesMin)mesMin=mes;
    if(mesMax===null||mes>mesMax)mesMax=mes;
    pedidosGlobal.add(o.pedido);
    costoGlobal+=(o.costo||0);
    costoPorMes[mes]=(costoPorMes[mes]||0)+(o.costo||0);
    if(o.sigla){
      var e=porEquipo[o.sigla];
      if(!e)e=porEquipo[o.sigla]={pedidos:new Set(),costo:0,meses:{}};
      e.pedidos.add(o.pedido);
      e.costo+=(o.costo||0);
      var em=e.meses[mes];
      if(!em)em=e.meses[mes]={pedidos:new Set(),c:0};
      em.pedidos.add(o.pedido);
      em.c+=(o.costo||0);
    }
    if(o.detalle){
      var it=porItem[o.detalle];
      if(!it)it=porItem[o.detalle]={pedidos:new Set(),costo:0,equipos:[],equiposSet:new Set(),meses:new Set(),ultFecha:''};
      it.pedidos.add(o.pedido);
      it.costo+=(o.costo||0);
      it.meses.add(mes);
      if(o.sigla&&!it.equiposSet.has(o.sigla)&&it.equipos.length<5){it.equiposSet.add(o.sigla);it.equipos.push(o.sigla);}
      if(o.fecha&&o.fecha>it.ultFecha)it.ultFecha=o.fecha;
    }
  });

  function mesesEnRango(desde,hasta){
    var out=[];
    if(!desde||!hasta)return out;
    var y=parseInt(desde.slice(0,4),10),m=parseInt(desde.slice(5,7),10);
    var yF=parseInt(hasta.slice(0,4),10),mF=parseInt(hasta.slice(5,7),10);
    while(y<yF||(y===yF&&m<=mF)){
      out.push(y+'-'+(m<10?'0':'')+m);
      m++;if(m>12){m=1;y++;}
    }
    return out;
  }

  var rangoMeses=mesesEnRango(mesMin,mesMax);

  var equiposOut={};
  for(var sigla in porEquipo){
    var e=porEquipo[sigla];
    var mesesConDatos=Object.keys(e.meses);
    var primerMes=mesesConDatos.reduce(function(a,b){return a<b?a:b;});
    var rangoEq=mesesEnRango(primerMes,mesMax);
    var trend=rangoEq.map(function(m){var em=e.meses[m];return{m:m,n:em?em.pedidos.size:0,c:em?em.c:0};});
    var mesesN=mesesConDatos.length||1;
    equiposOut[sigla]={
      totalPedidos:e.pedidos.size,
      totalCosto:e.costo,
      meses:mesesN,
      promPedMes:Math.round((e.pedidos.size/mesesN)*10)/10,
      promCostoMes:Math.round(e.costo/mesesN),
      leadTimeProm:LEAD,
      trend:trend
    };
  }

  var topItems=[];
  for(var detalle in porItem){
    var it=porItem[detalle];
    var mesesN2=it.meses.size||1;
    topItems.push({
      item:detalle,
      total:it.pedidos.size,
      equipos:it.equipos,
      promMes:Math.round((it.pedidos.size/mesesN2)*10)/10,
      leadTime:LEAD,
      ultFecha:it.ultFecha,
      costoTotal:it.costo
    });
  }
  topItems.sort(function(a,b){return b.total-a.total;});

  var costoMes=rangoMeses.map(function(m){return{m:m,c:costoPorMes[m]||0};});
  var mesesGlobalesN=rangoMeses.length||1;

  return{
    equipos:equiposOut,
    topItems:topItems,
    costoMes:costoMes,
    resumen:{
      totalPedidos:pedidosGlobal.size,
      totalCosto:costoGlobal,
      promedioMensual:Math.round(costoGlobal/mesesGlobalesN),
      leadTimeGlobal:LEAD,
      rangoDesde:mesMin||'—',
      rangoHasta:mesMax||'—'
    }
  };
}

// ═══ STOCK — estado de reabastecimiento (una sola fuente de verdad) ═══
// La pregunta real NO es "¿tengo menos de 1 mes de stock?" sino "¿me quedo sin ANTES de
// que llegue el reemplazo?" — y eso depende del lead time (días que tarda la reposición).
// Antes había 3 fórmulas distintas para lo mismo: la tabla de Stock (<1mes=COMPRAR),
// la edición (stock<=1mes=COMPRAR) y riesgoQuiebre (stock<leadTime, la única correcta).
// El Dashboard leía el proxy de 1 mes, así que con lead time de 34 días (>1 mes) marcaba
// "OK" cosas que en realidad ya iban a quebrar antes de que llegara la compra. Esta
// función unifica todo con el criterio de riesgoQuiebre: se compra cuando la cobertura
// cae por debajo del lead time. leadDias por defecto 34 (mismo supuesto que ya usaba
// riesgoQuiebre y el default de repuestos), o el propio del ítem si lo tiene.
function stockEstado(stockBodega, consumoMes, leadDias){
  var cm=consumoMes||0;
  var stock=stockBodega||0;
  var lead=leadDias>0?leadDias:34;
  var leadMeses=lead/30;
  if(cm<=0)return{nivel:'OK',ico:'✅',txt:'OK',meses:null,motivo:'sin consumo registrado'};
  var meses=stock/cm;
  if(stock<=0)return{nivel:'COMPRAR',ico:'🔴',txt:'COMPRAR',meses:0,motivo:'sin stock'};
  if(meses<leadMeses)return{nivel:'COMPRAR',ico:'🔴',txt:'COMPRAR',meses:meses,
    motivo:'quiebre en ~'+Math.round(meses*30)+'d y la reposición tarda '+lead+'d'};
  if(meses<2)return{nivel:'BAJO',ico:'🟡',txt:'BAJO',meses:meses,motivo:'menos de 2 meses de cobertura'};
  return{nivel:'OK',ico:'✅',txt:'OK',meses:meses,motivo:Math.round(meses*10)/10+' meses de cobertura'};
}

// ═══ PAGINACIÓN — slicing puro, usado por _pagSlice en index.html ═══
function pagSlice(arr,page,pageSize){
  var lista=arr||[];
  var totalPages=Math.max(1,Math.ceil(lista.length/pageSize));
  var p=page||1;
  if(p>totalPages)p=totalPages;
  if(p<1)p=1;
  return{page:p,totalPages:totalPages,total:lista.length,items:lista.slice((p-1)*pageSize,p*pageSize)};
}

// ═══ DETECCIÓN DE EDICIÓN CONCURRENTE — usado por _syncTablaGenericaInner ═══
// true si el conjunto de ids que esta pestaña creía tener (antes de guardar) no
// coincide con el conjunto de ids que hay ahora mismo en el servidor — señal de que
// alguien más cambió esta tabla mientras esta pestaña estaba abierta sin refrescar.
function hayConflictoIds(idsAntes,idsServidor){
  var a=idsAntes instanceof Set?idsAntes:new Set(idsAntes||[]);
  var s=idsServidor instanceof Set?idsServidor:new Set(idsServidor||[]);
  if(a.size!==s.size)return true;
  for(var id of s){if(!a.has(id))return true;}
  return false;
}

if (typeof window !== 'undefined') {
  window._tokensMaterial = _tokensMaterial;
  window._scoreMaterial = _scoreMaterial;
  window.precioMaterial = precioMaterial;
  window.predFromOrdenes = predFromOrdenes;
  window.stockEstado = stockEstado;
  window.rangoDias = rangoDias;
  window._rangoDias = rangoDias;
  window.pagSlice = pagSlice;
  window.hayConflictoIds = hayConflictoIds;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    C, fd, fn, escapeHtml,
    _tokensMaterial, _scoreMaterial, precioMaterial,
    esLubricante, vencReglaDefault, vencCalcProximo, vencEstado,
    fechaEsPlausible, fechaEsAnterior, duracionHM,
    predFromOrdenes, stockEstado, rangoDias, pagSlice, hayConflictoIds
  };
}
