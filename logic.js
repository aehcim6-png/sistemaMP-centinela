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
  // Cuántas veces el frecPM base cabe en el ciclo de este tipo de PM (PM4 cubre
  // 8x, PM3 4x, PM2 2x, PM1 1x — mismos umbrales que tipoPM). Tipos desconocidos
  // o mal cargados (ej. 'PM6'/'PM9' de importaciones viejas, 'Correctivo') caen a
  // 1x: es la opción conservadora, nunca empuja el próximo PM más de lo debido.
  tierMultPM(tipoPM){const t=String(tipoPM||'').toUpperCase().trim();return t==='PM4'?8:t==='PM3'?4:t==='PM2'?2:t==='PM1'?1:1;},
  // Próximo horómetro de PM. La grilla oficial (múltiplos de f desde el horómetro
  // CERO) se mantiene SIEMPRE fija — un PM hecho un poco antes o un poco después
  // de su hito no debe correr el resto del calendario para siempre (ese fue un
  // bug real: con frecPM=250, un PM hecho en 270 en vez de 250 corría el
  // siguiente hito a 520 en vez de dejarlo en 500). Lo único que sí puede pasar
  // es que un PM se haga ANTICIPADO — antes de llegar a su propio hito — y en ese
  // caso el hito recién cubierto no debe volver a pedirse casi de inmediato (bug
  // real: BD-10139 hizo un PM4 en horómetro 1977 y el sistema pedía "otro PM en
  // 23h" en 2000, el mismo hito que ese PM4 ya cubrió). 'horomUltimoPM'/'tipoUltimoPM'
  // (del registro más reciente en registros_pm) permiten detectar ese caso: si el
  // hito propio de ese PM (redondeado al múltiplo de su propio ciclo) ya alcanza o
  // supera lo que pediría la grilla pura, se salta un ciclo base más allá de ese
  // hito. Si el último PM quedó rezagado (hay huecos sin registrar), la grilla
  // pura ya da la respuesta correcta por sí sola — no hace falta ningún ajuste.
  // Un PM solo puede acreditar un hito que el equipo YA alcanzó. Math.round() snapea
  // al múltiplo MÁS CERCANO, así que también snapeaba HACIA ADELANTE — hasta medio
  // ciclo propio por delante del equipo — acreditando un servicio que todavía no
  // ocurrió y empujando el próximo PM más de un ciclo completo. Casos reales: el bus
  // BS-5752 (415.000 km, PM2 en 410.000) pedía su próximo PM a 15.000 km, y las
  // camionetas CA-5979/CA-9927 a 14.700/12.696 km — todas con ciclo de 10.000 km, o
  // sea imposible. Por eso el hito acreditado no puede estar más de freq/4 por
  // delante del horómetro actual; ese margen deja pasar el caso legítimo (BD-10139:
  // PM4 en 1977 cubriendo el hito 2000, a 23h del equipo) y corta los inventados.
  proxPM(h,f=250,horomUltimoPM,tipoUltimoPM){
    const freq=f||250;
    const grilla=Math.ceil(h/freq)*freq;
    if(horomUltimoPM==null||horomUltimoPM<0)return grilla;
    const cicloPropio=freq*this.tierMultPM(tipoUltimoPM);
    const hitoCubierto=Math.round(horomUltimoPM/cicloPropio)*cicloPropio;
    if(hitoCubierto-h>freq/4)return grilla;
    const siguienteSiAnticipado=hitoCubierto+freq;
    return siguienteSiAnticipado>grilla?siguienteSiAnticipado:grilla;
  },
  estado(d){return d<0?{t:'VENCIDA',c:'b-r',i:'🔴'}:d<=7?{t:'URGENTE',c:'b-r',i:'🔴'}:d<=30?{t:'PRÓXIMA',c:'b-y',i:'🟡'}:{t:'AL DÍA',c:'b-g',i:'🟢'}},
  // Alerta de overhaul (PM4): mismo problema que tenía tipoPM antes de su fix —
  // bandas fijas en horas (250/500/1000) sin importar el frecPM propio del equipo.
  // Para un vehículo por kilómetros (frecPM=10000) esto mostraba "🔴 URGENTE (<250h)"
  // comparando un remanente en KM contra un umbral pensado en HORAS. Ahora las
  // bandas son 1x/2x/4x el frecPM del equipo (igual que las 4 escalas de tipoPM),
  // y la unidad mostrada es la real del equipo, no siempre "h".
  alertaPM4(h,frecPM=250,unidad='h'){const f=frecPM||250;return h<f?{t:'URGENTE (<'+f+unidad+')',c:'b-r'}:h<f*2?{t:'PRÓXIMA (<'+(f*2)+unidad+')',c:'b-y'}:h<f*4?{t:'PLANIFICAR',c:'b-b'}:{t:'OK — '+h.toLocaleString()+unidad,c:'b-g'}},
  // Recalcula la programación de PM de un equipo. Para convertir "horas restantes"
  // en "días para el PM" usa 'ritmoDia' si se le pasa (el ritmo REAL observado del
  // equipo, ej. de tasaDiariaReal sobre su historial) — más fiel que las horas/día
  // nominales, que suelen sobreestimar el uso y hacen que las alertas salgan antes de
  // lo necesario. Si no se pasa ritmo (o es 0), cae al hrsDia nominal, como siempre.
  // 'horomUltimoPM'/'tipoUltimoPM' (opcionales): datos del último PM real ejecutado
  // (desde registros_pm), para que proxPM detecte un PM anticipado — ver su comentario.
  // e.pmPendienteManual (opcional, editable en Ficha Técnica): cuando hay un hueco
  // real desde el último PM registrado, proxPM no puede distinguir "se saltó de
  // verdad" (hay que avisar VENCIDA) de "se hizo pero no se anotó" (caso real
  // MN-5926/GE-10019, donde saltar a la grilla es lo correcto) — es indistinguible
  // solo con los números. Caso real CF-8769: hito 15.500 nunca se hizo, la grilla
  // saltaba derecho a 15.750 sin avisar. Si el usuario SABE que un hito quedó
  // pendiente, lo marca acá y gana sobre el cálculo automático (solo si es más
  // temprano que lo que ya calculó proxPM — si no, no tiene efecto). Se limpia
  // solo cuando se registra un PM real que lo cubre (ver saveReg en reg.js).
  recalc(e,ritmoDia,horomUltimoPM,tipoUltimoPM){
    const pAuto=this.proxPM(e.horomActual,e.frecPM||250,horomUltimoPM,tipoUltimoPM);
    const pManual=e.pmPendienteManual;
    const p=(pManual>0&&pManual<pAuto)?pManual:pAuto;
    const hr=p-e.horomActual;
    const ritmo=(ritmoDia&&ritmoDia>0)?ritmoDia:(e.hrsDia>0?e.hrsDia:0);
    const d=ritmo>0?Math.round(hr/ritmo):999;
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
// Previene "CSV/Formula Injection" (CWE-1236): una celda de texto que empieza
// con = + - @ (o tab/retorno de carro) se interpreta como fórmula al abrir el
// CSV/Excel exportado en Excel/Sheets — puede ejecutar comandos en la máquina
// de quien lo abre. Cualquier campo de texto libre del sistema (obs, motivo,
// proveedor, técnico...) puede terminar así sin mala intención (ej. "-15%
// bajo meta", "@turno noche"). Antepone un apóstrofo — Excel lo trata como
// "esto es texto", no se ve en la celda — solo cuando hace falta. No aplica
// a números reales (un costo o delta negativo real no es un vector de esto;
// cada punto de exportación decide si el valor es texto o número antes de
// llamar esto).
function csvCeldaSegura(v){
  var s=String(v??'');
  return /^[=+\-@\t\r]/.test(s)?"'"+s:s;
}

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

// Construye una fila de historial_horometros para una lectura nueva, buscando la
// lectura previa CRONOLÓGICAMENTE a 'fecha' (no la más reciente del historial
// completo) para fijar 'horomIni' correctamente incluso cuando la lectura nueva es
// retroactiva (fecha pasada, ingresada con retraso). Antes esto estaba duplicado
// en 2 lugares (saveReg y la edición directa del horómetro en Equipos) cada uno
// buscando el "anterior" de una forma ligeramente distinta.
function construirLecturaHistorial(hist,sigla,fecha,horom,origen){
  const anterior=(hist||[]).filter(function(h){return h&&h.sigla===sigla&&h.fecha&&h.fecha<=fecha;})
    .sort(function(a,b){return (b.fecha||'').localeCompare(a.fecha||'');})[0];
  return{
    sigla:sigla,fecha:fecha,
    horomIni:anterior?(anterior.horomFin!=null?anterior.horomFin:(anterior.horom||0)):0,
    horomFin:horom,horom:horom,origen:origen
  };
}

// Duración entre entrada y salida de un PM/correctivo — un solo lugar para el cálculo
// que antes estaba copiado 4 veces (calcDurReg, calcDurEdit, saveReg y saveEditReg,
// cada uno con su propia versión del mismo "new Date(fSal+hSal)-new Date(fEnt+hEnt)").
// null si falta algún dato; si no, {ms, horas, texto}. Un ms negativo (salida antes
// que entrada) se devuelve tal cual — cada llamador decide si eso es un error a
// mostrar o simplemente no usar el texto.
// Mediana de los valores positivos de una lista; null si no hay ninguno.
// Se usa para estimar la duración típica REAL de un PM desde registros_pm:
// la columna hrs de las pautas es el INTERVALO de cada tarea (cada 500h,
// cada 10.000 km…), no su duración, así que sumarla como "minutos de
// trabajo" daba HH Plan de cientos de horas y costos absurdos. La mediana
// (y no el promedio) para que un registro atípico no arrastre el plan.
// Lubricantes dados de baja y el producto VIGENTE que los reemplaza. Las pautas
// siguen nombrando el producto antiguo, así que sin esto la demanda se reparte
// entre el descontinuado y el nuevo: ninguna de las dos cifras sirve para
// comprar, y el producto viejo ni siquiera se consigue.
var LUB_REEMPLAZO={
  'MOBILUBE HD PLUS 85W-140':'MOBILUBE 1 SHC 75W90',
  'MOBILUBE SAE 80W90':'MOBILUBE 1 SHC 75W90',
  'MOBIL GEAR OIL 75W90':'MOBILUBE 1 SHC 75W90',
  'MOBILGREASE XHP 222':'MOBILGREASE XHP 322 MINE',
  'MOBIL DTE 10 EXCEL 46':'MOBILTRANS HD 10W',
  'MOBIL SUPER 2000 10W40':'MOBIL DELVAC XHP ESP S 10W-40'
};
function _normLub(s){return String(s||'').toUpperCase().replace(/\s+/g,' ').trim()}
// Nombre del lubricante vigente para uno dado; el mismo si no está reemplazado.
// Encadena por si un reemplazo fue a su vez reemplazado, con tope para no
// colgarse si alguien deja un ciclo en la tabla.
function lubVigente(nombre){
  var mapa={};
  Object.keys(LUB_REEMPLAZO).forEach(function(k){mapa[_normLub(k)]=LUB_REEMPLAZO[k];});
  var n=_normLub(nombre);
  for(var i=0;i<5&&mapa[n];i++)n=_normLub(mapa[n]);
  return n;
}
// ¿Este nombre corresponde a un producto descontinuado?
function lubEsObsoleto(nombre){return lubVigente(nombre)!==_normLub(nombre);}
function medianaPositiva(vals){
  var v=(vals||[]).filter(function(x){return x>0&&isFinite(x)}).sort(function(a,b){return a-b});
  if(!v.length)return null;
  var m=Math.floor(v.length/2);
  return v.length%2?v[m]:(v[m-1]+v[m])/2;
}
// Estimador de HH Plan para un PM: mediana de las duraciones reales registradas
// del mismo equipo+tipo, con la mediana de la flota para ese tipo como respaldo.
// Se construye UNA vez sobre registros_pm y devuelve una función (equipo,tipo)->horas.
// Es el único origen válido de "horas planificadas": la columna hrs de las pautas
// es el INTERVALO de cada tarea (cada 500h, cada 10.000 km…), no su duración —
// todo consumidor que la sumaba como horas de trabajo producía planes absurdos.
function hhPlanEstimator(regs){
  var porEq={},porTipo={};
  (regs||[]).forEach(function(r){
    if(!r)return;
    var d=r.duracionH;if(!(d>0&&isFinite(d)))return;
    var t=r.tipoPM||'';
    var k=(r.equipo||'')+'|'+t;
    (porEq[k]=porEq[k]||[]).push(d);
    (porTipo[t]=porTipo[t]||[]).push(d);
  });
  return function(equipo,tipoPM){
    var m=medianaPositiva(porEq[(equipo||'')+'|'+(tipoPM||'')]);
    if(m==null)m=medianaPositiva(porTipo[tipoPM||'']);
    return m==null?0:Math.round(m*10)/10;
  };
}
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

// ═══ DISPONIBILIDAD — fuente ÚNICA compartida por Disponibilidad, KPI y Metas ═══
// Antes cada pestaña tenía su propia copia del cálculo, con supuestos distintos (KPI sin
// el manejo de salida de servicio por período, Metas usando solo overrides manuales), así
// que los tres números nunca coincidían. Ahora todas pasan por estas dos funciones.

// Mapa {sigla: {fecha: horasDeDetención}} desde registros PM (reg) y correctivos (ot).
// Una salida de servicio con período (fechaEntrada→fechaSalida en días distintos) marca
// cada día del rango como día completo caído; el resto usa la duración real o un supuesto.
// Una salida de servicio SIN fecha de término (fechaSalida vacía) significa "el equipo
// TODAVÍA está fuera de servicio hoy" — se extiende día a día desde fechaEntrada hasta
// 'hoy' (parámetro opcional, default = fecha actual). Sin esto, una salida abierta solo
// contaba como caída su primer día y el equipo volvía a figurar disponible al día
// siguiente aunque en la realidad siguiera detenido.
function dispDownMap(reg, ot, hoy){
  var down={};
  var hoyISO=hoy||new Date().toISOString().slice(0,10);
  function add(sigla,fecha,horas){ if(!sigla||!fecha)return; if(!down[sigla])down[sigla]={}; down[sigla][fecha]=(down[sigla][fecha]||0)+horas; }
  (reg||[]).forEach(function(r){
    var sigla=r.equipo, fecha=r.fechaEntrada||r.fechaEjec||'';
    var durH=r.duracionH||0;
    if(!durH&&r.horaEntrada&&r.horaSalida){
      var hp=r.horaEntrada.split(':'), sp=r.horaSalida.split(':');
      if(hp.length>=2&&sp.length>=2){ durH=((parseInt(sp[0])*60+parseInt(sp[1]))-(parseInt(hp[0])*60+parseInt(hp[1])))/60; if(durH<0)durH+=24; }
    }
    if(!durH)durH=4; // supuesto si no hay duración
    add(sigla,fecha,durH);
  });
  (ot||[]).forEach(function(o){
    var sigla=o.sigla; if(!sigla)return;
    var fs=(o.estatusEq==='Fuera de Servicio'||o.estadoEq==='Fuera de Servicio');
    if(fs&&o.fechaEntrada&&o.fechaSalida&&o.fechaSalida>o.fechaEntrada){
      rangoDias(o.fechaEntrada,o.fechaSalida).forEach(function(d){ add(sigla,d,24); });
      return;
    }
    if(fs&&o.fechaEntrada&&!o.fechaSalida&&o.fechaEntrada<=hoyISO){
      rangoDias(o.fechaEntrada,hoyISO).forEach(function(d){ add(sigla,d,24); });
      return;
    }
    var fecha=o.fecha||o.fechaEntrada||''; if(!fecha)return;
    var durH=0; if(o.duracion){ var m=String(o.duracion).match(/(\d+)h/); if(m)durH=parseInt(m[1]); }
    if(!durH)durH=8; // supuesto si no hay duración
    if(fs)durH=24;   // fuera de servicio de un solo día
    add(sigla,fecha,durH);
  });
  return down;
}

// Disponibilidad mensual de un equipo (%). Prioridad: override manual (dispCalc) > dato
// original de abril (dAbr) > cálculo automático día a día desde el downMap. Devuelve null
// si no hay ningún dato (para distinguir "sin datos" de "0%").
function dispEquipoMes(sigla, mes, opts){
  opts=opts||{};
  var dispCalc=opts.dispCalc||{}, dAbr=opts.dAbr||{}, downMap=opts.downMap||{};
  var hrsDia=opts.hrsDia||12, hoyISO=opts.hoy||new Date().toISOString().slice(0,10);
  if(dispCalc[sigla]&&dispCalc[sigla][mes]!==undefined)return dispCalc[sigla][mes];
  if(mes==='2026-04'&&dAbr[sigla]!==undefined)return dAbr[sigla];
  var yy=parseInt(mes.slice(0,4),10), mm=parseInt(mes.slice(5,7),10);
  var dias=new Date(yy,mm,0).getDate();
  var totalDisp=0, conDato=0;
  for(var d=1;d<=dias;d++){
    var ds=mes+'-'+('0'+d).slice(-2);
    if(ds>hoyISO)break;
    var dn=(downMap[sigla]&&downMap[sigla][ds])||0;
    if(dn>hrsDia)dn=hrsDia;
    totalDisp+=(hrsDia-dn)/hrsDia*100;
    conDato++;
  }
  if(!conDato)return null;
  return Math.round(totalDisp/conDato*10)/10;
}

function vencCalcProximo(ultimaFecha, periodicidadMeses){
  if(!ultimaFecha||!periodicidadMeses)return null;
  var d=new Date(ultimaFecha+'T00:00:00');
  if(isNaN(d))return null;
  // Bug real (auditoría 2026-08-06): setMonth() con el día original todavía puesto
  // desborda cuando el mes destino tiene menos días — "31 ago + 6 meses" no daba
  // "28 feb" (último día de febrero), daba "3 mar" (JS interpreta "31 feb" como
  // "28 feb + 3 días"). Para un documento vencido/por vencer eso corría la fecha
  // 2-3 días de más. Fix: se avanza el mes con el día en 1 (nunca desborda), y
  // recién ahí se pone el día original, topado al último día real del mes destino.
  var diaOriginal=d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth()+parseInt(periodicidadMeses));
  var ultimoDiaMesDestino=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  d.setDate(Math.min(diaOriginal,ultimoDiaMesDestino));
  return d.toISOString().slice(0,10);
}

// 'tieneRegla' (opcional): true si este equipo/documento SÍ debería llevar control
// (hay periodicidad por regla o cargada a mano) aunque nunca se haya registrado una
// fecha. Sin esto, "nunca se ha registrado el Sistema AFEX de este camión" y "este
// camión no necesita Decreto 80" se veían exactamente igual ('Sin datos', gris) y
// ambos quedaban FUERA de las alertas — un documento exigido que nadie ha cargado
// nunca es más urgente que uno por vencer en 25 días, pero era invisible.
function vencEstado(proximaFecha, tieneRegla){
  if(!proximaFecha){
    if(tieneRegla)return{label:'🟠 Sin registrar (requerido)',color:'#f97316',dias:null,requiereAtencion:true};
    return{label:'Sin datos',color:'var(--tx3)',dias:null,requiereAtencion:false};
  }
  var hoy=new Date();hoy.setHours(0,0,0,0);
  var prox=new Date(proximaFecha+'T00:00:00');
  var dias=Math.round((prox-hoy)/86400000);
  if(dias<0)return{label:'🔴 VENCIDO ('+Math.abs(dias)+'d)',color:'var(--danger)',dias:dias,requiereAtencion:true};
  if(dias<=30)return{label:'🟡 Vence en '+dias+'d',color:'#eab308',dias:dias,requiereAtencion:true};
  return{label:'🟢 OK ('+dias+'d)',color:'var(--ok)',dias:dias,requiereAtencion:false};
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

// ═══ COMPONENTES MAYORES — estado según vida útil real ═══
// Un componente solo tiene proyección confiable si se conoce CUÁNDO se instaló.
// Sin fechaInst no sabemos su antigüedad real: los defaults auto-generados ponen
// horomComp = horómetro actual del equipo, lo que fingiría "0 horas usadas" para un
// motor que puede ser el original con 20.000h. En ese caso NO inventamos un % ni un
// 🟢 OK tranquilizador: devolvemos conDato=false para que la UI pida el dato real.
function compEstado(comp, horomActual, hrsDia){
  var c=comp||{};
  var esOrig=!!c.esOriginal;
  // Original = instalado con el equipo nuevo → sus horas usadas son el horómetro
  // completo, sin necesidad de estimar fecha. Si no es original, hace falta la fecha
  // de instalación (con horómetro medido o estimado) para saber cuánto lleva.
  if(!esOrig && !(c.fechaInst && c.horomComp!=null)){
    return {conDato:false, hrsUsadas:null, hrsRest:null, pctVida:null, diasRest:null,
      estado:'⚪ Falta instalación', barCol:'var(--tx3)'};
  }
  var hActual=horomActual||0;
  var horomInst=esOrig?0:(c.horomComp||0);
  var hrsUsadas=hActual-horomInst;
  if(hrsUsadas<0)hrsUsadas=0; // instalación posterior al horómetro actual = error de dato → 0, no el horómetro completo
  var vida=c.vidaUtil||0;
  var hrsRest=Math.max(vida-hrsUsadas,0);
  var pctVida=vida?Math.round(hrsUsadas/vida*100):null;
  var dia=hrsDia>0?hrsDia:12;
  var diasRest=Math.round(hrsRest/dia);
  var estado=hrsRest<=0?'🔴 VENCIDO':hrsRest<1000?'🟡 PLANIFICAR':hrsRest<2000?'📋 MONITOREAR':'🟢 OK';
  var barCol=pctVida>=90?'var(--danger)':pctVida>=70?'var(--w)':'var(--ok)';
  return {conDato:true, hrsUsadas:hrsUsadas, hrsRest:hrsRest, pctVida:pctVida,
    diasRest:diasRest, estado:estado, barCol:barCol};
}

// ═══ ESTIMACIÓN DE HORÓMETRO/KM EN UNA FECHA PASADA ═══
// Días calendario entre dos fechas ISO (yyyy-mm-dd). 0 si alguna es inválida.
function _diasEntreISO(desdeISO, hastaISO){
  if(!desdeISO||!hastaISO)return 0;
  var d1=new Date(desdeISO+'T00:00:00Z'), d2=new Date(hastaISO+'T00:00:00Z');
  if(isNaN(d1.getTime())||isNaN(d2.getTime()))return 0;
  return Math.round((d2.getTime()-d1.getTime())/86400000);
}

// Tasa diaria REAL (h/día o km/día) de un equipo, a partir de su historial de
// lecturas [{fecha, horom}]. Prioriza el ÚLTIMO tramo válido (entre las 2 lecturas
// más recientes que dan un avance plausible) en vez de promediar todo el historial:
// las horas máquina cambian por campaña/clima/disponibilidad — un equipo puede haber
// estado semanas casi parado y luego acelerar, y una mediana de TODO el historial
// (sobre todo si hay tramos con lecturas diarias densas mezclados con tramos con
// lecturas sueltas cada 1-2 meses, como pasa en la práctica) queda dominada por
// épocas viejas y no refleja el ritmo actual. Caso real: BD-9509 tenía mediana de
// todo su historial en 8h/día, pero su último tramo medido (23 días reales) corría a
// 11,2h/día — la mediana proyectaba su próximo PM ~10 días más tarde de lo real.
// Sigue ignorando resets de horómetro (deltas negativos o saltos enormes tipo
// 0→16.000) y días sin movimiento. Si no hay ningún tramo válido, cae a la tasa
// nominal (hrsDia).
// Cuando el historial trae lecturas DIARIAS (ej. importadas de un reporte de
// disponibilidad), el "último tramo" puede ser un solo día — y un día suelto
// atípico (turno parcial, equipo detenido media jornada) bastaba para definir
// TODO el ritmo proyectado (bug real: CF-8769/CF-9510 con un día de 3h
// mostraban ~3h/día de ritmo cuando su uso normal rondaba 15-18h/día, atrasando
// la alerta de PM semanas). Por eso se acumulan tramos consecutivos desde el más
// reciente hacia atrás hasta cubrir al menos MIN_DIAS días — un tramo largo
// (semanas, como en el caso BD-9509 de arriba) ya cumple eso de entrada y se usa
// solo, preservando la prioridad por el ritmo reciente.
var _TASA_MIN_DIAS = 5;
function tasaDiariaReal(readings, nominal){
  var nom=nominal>0?nominal:12;
  var rs=(readings||[]).filter(function(r){return r&&r.fecha&&r.horom!=null&&isFinite(r.horom);})
    .slice().sort(function(a,b){return a.fecha<b.fecha?-1:a.fecha>b.fecha?1:0;});
  var tramos=[];
  for(var i=1;i<rs.length;i++){
    var dd=_diasEntreISO(rs[i-1].fecha,rs[i].fecha);
    if(dd<=0)continue;
    var horas=rs[i].horom-rs[i-1].horom;
    var t=horas/dd;
    if(t<=0)continue;        // reset o sin avance
    if(t>nom*4)continue;     // salto implausible (>4x nominal) — dato malo
    tramos.push({dias:dd,horas:horas});
  }
  if(!tramos.length)return nom;
  var diasAcum=0, horasAcum=0;
  for(var j=tramos.length-1;j>=0;j--){
    diasAcum+=tramos[j].dias; horasAcum+=tramos[j].horas;
    if(diasAcum>=_TASA_MIN_DIAS)break;
  }
  return Math.round((horasAcum/diasAcum)*10)/10;
}

// Estima el horómetro/km que un equipo tenía en fechaISO, lo más fiel posible:
//  - fecha DENTRO del historial → interpola entre las 2 lecturas vecinas (casi exacto).
//  - fecha ANTERIOR al historial → si se conoce el INICIO operacional (puesta en marcha,
//    donde el horómetro era ~0) traza la recta (inicio,0)→(primer dato real): reproduce
//    la "cuenta fácil" horómetro/meses por equipo. Si no hay inicio, extrapola con la
//    tasa real hacia atrás.
//  - fecha POSTERIOR a la última lectura → extrapola hacia adelante (tope horomActual).
//  - sin historial usable → recta (inicio,0)→(hoy,horomActual) si hay inicio; si no, tasa.
// Nunca devuelve negativo ni pasa el horómetro actual.
function horomEnFecha(readings, fechaISO, horomActual, hoyISO, nominal, inicio){
  var tasa=tasaDiariaReal(readings,nominal);
  var rs=(readings||[]).filter(function(r){return r&&r.fecha&&r.horom!=null&&isFinite(r.horom);})
    .slice().sort(function(a,b){return a.fecha<b.fecha?-1:a.fecha>b.fecha?1:0;});
  // Antes o en la puesta en marcha → horómetro 0.
  if(inicio&&fechaISO<=inicio)return {horom:0, metodo:'inicio', tasaDia:tasa};
  var metodo=rs.length>=2?'':'nominal';
  var est=null;
  if(rs.length){
    var first=rs[0], last=rs[rs.length-1];
    if(fechaISO<first.fecha){
      if(inicio&&inicio<first.fecha){
        // recta desde (inicio, 0) hasta (first.fecha, first.horom)
        var spanI=_diasEntreISO(inicio,first.fecha);
        var fracI=spanI>0?_diasEntreISO(inicio,fechaISO)/spanI:0;
        est=first.horom*fracI;
        metodo='inicio';
      } else {
        est=first.horom-tasa*_diasEntreISO(fechaISO,first.fecha);
        metodo=metodo||'extrapolado';
      }
    } else if(fechaISO>=last.fecha){
      est=last.horom+tasa*_diasEntreISO(last.fecha,fechaISO);
      if(horomActual!=null&&est>horomActual)est=horomActual;
      metodo=metodo||'extrapolado';
    } else {
      for(var i=1;i<rs.length;i++){
        if(rs[i].fecha>=fechaISO){
          var a=rs[i-1], b=rs[i];
          var span=_diasEntreISO(a.fecha,b.fecha);
          var frac=span>0?_diasEntreISO(a.fecha,fechaISO)/span:0;
          est=a.horom+(b.horom-a.horom)*frac;
          metodo='interpolado';
          break;
        }
      }
    }
  } else if(inicio){
    // sin historial: recta (inicio,0)→(hoy,horomActual)
    var spanH=_diasEntreISO(inicio,hoyISO||fechaISO);
    var fracH=spanH>0?_diasEntreISO(inicio,fechaISO)/spanH:0;
    est=(horomActual||0)*fracH;
    metodo='inicio';
  } else {
    est=(horomActual||0)-tasa*_diasEntreISO(fechaISO,hoyISO||fechaISO);
    metodo='nominal';
  }
  if(est==null||!isFinite(est))est=0;
  if(est<0)est=0;
  if(horomActual!=null&&est>horomActual)est=horomActual;
  return {horom:Math.round(est), metodo:metodo, tasaDia:tasa};
}

// ═══ VALIDACIÓN DE SALTO DE HORÓMETRO ═══
// Inspirado en el control de "Report Mantención" del manual de Besalco Maquinarias
// (rechaza un horómetro que se salga de ±50h del último reporte diario) — pero
// adaptado: acá el horómetro no se reporta todos los días, se registra cada vez que
// alguien hace un PM o corrige el dato a mano, así que un margen FIJO de horas
// atraparía como "error" cualquier registro con varios días de diferencia real. El
// margen escala con los días transcurridos y el ritmo nominal del equipo — mismo
// umbral (4x el ritmo nominal) que ya usa tasaDiariaReal() para descartar saltos
// implausibles del historial, para no inventar un segundo criterio.
// No valida retroactivos (fechaNueva anterior a fechaAnterior) — ese caso ya lo
// cubre la regla de "solo el registro más reciente cronológicamente actualiza
// horomActual" (ver construirLecturaHistorial). Devuelve {valido:true} si no hay
// dato previo con qué comparar (primera lectura del equipo).
function validarSaltoHorometro(horomNuevo, horomAnterior, fechaAnterior, fechaNueva, hrsDia){
  if(horomAnterior==null||!fechaAnterior||!fechaNueva)return{valido:true};
  if(fechaNueva<fechaAnterior)return{valido:true};
  if(horomNuevo<horomAnterior){
    return{valido:false,motivo:'El horómetro no puede ser menor al último registrado ('+horomAnterior+', el '+fechaAnterior+')'};
  }
  var dias=Math.max(_diasEntreISO(fechaAnterior,fechaNueva),0)+1;
  var nominal=hrsDia>0?hrsDia:12;
  var tope=nominal*dias*4;
  var avance=horomNuevo-horomAnterior;
  if(avance>tope){
    return{valido:false,motivo:'El avance ('+Math.round(avance)+') es muy alto para '+dias+' día(s) desde el último dato ('+horomAnterior+', el '+fechaAnterior+') — revisa el horómetro ingresado'};
  }
  return{valido:true};
}

// ═══ CIERRE AUTOMÁTICO DE DESTRABE AL RECIBIR LA ORDEN DE COMPRA ═══
// Inspirado en el manual OTR de Besalco Maquinarias: una OT ligada a un PI/OC se
// cierra sola cuando la compra llega. Acá el equivalente es la fila de "Gestión de
// Destrabe" bloqueada por falta de repuesto — se resuelve sola cuando la OC
// vinculada (destrabe[i].idOrdenCompra) se marca recibida. Función pura: no toca
// Supabase ni localStorage, solo devuelve el arreglo actualizado (mismo patrón que
// el resto de logic.js) para que el wiring en destrabe.js/rep.js sea un simple
// S.s() con el resultado. No cierra el correctivo (OT) — que llegue el repuesto no
// significa que el trabajo ya se ejecutó, eso lo sigue confirmando el técnico.
function resolverDestrabePorOC(destrabeArr, idOrdenCompra, fechaRecibido){
  if(!Array.isArray(destrabeArr)||!idOrdenCompra)return destrabeArr;
  return destrabeArr.map(function(it){
    if(it&&it.idOrdenCompra===idOrdenCompra&&it.estado!=='Resuelto'){
      return Object.assign({},it,{
        estado:'Resuelto',
        accion:(it.accion?it.accion+' — ':'')+'(auto) Repuesto recibido '+fechaRecibido
      });
    }
    return it;
  });
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
  window.compEstado = compEstado;
  window.tasaDiariaReal = tasaDiariaReal;
  window.horomEnFecha = horomEnFecha;
  window.rangoDias = rangoDias;
  window._rangoDias = rangoDias;
  window.dispDownMap = dispDownMap;
  window.dispEquipoMes = dispEquipoMes;
  window.pagSlice = pagSlice;
  window.hayConflictoIds = hayConflictoIds;
  window.validarSaltoHorometro = validarSaltoHorometro;
  window.resolverDestrabePorOC = resolverDestrabePorOC;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    C, fd, fn, escapeHtml, csvCeldaSegura,
    _tokensMaterial, _scoreMaterial, precioMaterial,
    esLubricante, vencReglaDefault, vencCalcProximo, vencEstado,
    fechaEsPlausible, fechaEsAnterior, duracionHM, medianaPositiva, hhPlanEstimator,
    LUB_REEMPLAZO, lubVigente, lubEsObsoleto, construirLecturaHistorial,
    predFromOrdenes, stockEstado, compEstado, tasaDiariaReal, horomEnFecha, rangoDias, dispDownMap, dispEquipoMes, pagSlice, hayConflictoIds,
    validarSaltoHorometro, resolverDestrabePorOC
  };
}
