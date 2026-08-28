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
  // Lecturas de historial_horometros de un equipo, ordenadas por fecha, con las
  // sospechosas descartadas: retrocede respecto de la lectura válida anterior, o
  // avanza más de 4x lo nominal en el tiempo transcurrido (mismo criterio que ya
  // usan tasaDiariaReal() y validarSaltoHorometro() para rechazar un ingreso
  // nuevo). Encontrado en auditoría (2026-08): 79 saltos implausibles + 82
  // retrocesos en 2.797 transiciones reales, de una importación que no pasó por
  // esa validación (ej. TI-5144 pasando de 17.833 a 178.845 en UN día) — sin este
  // filtro, horomHistorico() los tomaba igual como "la lectura vigente" para esa
  // fecha, así que el Dashboard podía mostrar un horómetro imposible al mirar un
  // mes pasado. No se borra nada de la base, solo se ignora al elegir la lectura.
  lecturasValidas(histArr,sigla){
    const val=h=>h.horomFin!=null?h.horomFin:h.horom;
    const rs=(histArr||[]).filter(h=>h&&h.sigla===sigla&&h.fecha&&val(h)!=null&&isFinite(val(h)))
      .slice().sort((a,b)=>a.fecha<b.fecha?-1:a.fecha>b.fecha?1:0);
    const out=[];
    let anterior=null;
    rs.forEach(r=>{
      if(anterior){
        const dias=Math.max(_diasEntreISO(anterior.fecha,r.fecha),0)+1;
        const avance=val(r)-val(anterior);
        if(avance<0||avance>12*dias*4)return; // sospechosa: no avanza 'anterior', se ignora
      }
      out.push(r);anterior=r;
    });
    return out;
  },
  // Horómetro de un equipo a la fecha límite dada, según historial_horometros (hist).
  // Toma el registro válido más reciente con fecha <= fechaLimite; null si no hay ninguno.
  horomHistorico(histArr,sigla,fechaLimite){
    let mejor=null;
    this.lecturasValidas(histArr,sigla).forEach(h=>{
      if(!h.fecha||h.fecha>fechaLimite)return;
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

// ═══ MTBF DE FLOTA — fuente ÚNICA compartida por el tablero de KPI y el Reporte
// Ejecutivo (Excel para jefatura) ═══
// Promedio de los MTBF REALES (C.mtbfReal, intervalos entre fallas sucesivas) de
// cada equipo — nunca "horas totales de la flota ÷ fallas totales de la flota":
// ese cociente usa el horómetro EN VIVO (crece solo, aunque el equipo no vuelva a
// fallar) y el conteo de fallas de TODA la vida (sin acotar a ningún período), así
// que el número sube día a día sin que la confiabilidad real haya cambiado en nada
// — el mismo defecto que ya documenta C.mtbfReal arriba, encontrado también acá en
// el Reporte Ejecutivo (bug real: kpi.js/_getEjecutivoData usaba exactamente ese
// cociente para el "MTBF Flota" que ve la jefatura). Equipos con menos de 2 fallas
// con horómetro válido no aportan — no hay intervalo real que promediar. null si
// ningún equipo de la flota tiene datos suficientes.
// Fuente única: ¿esta OT es una FALLA real para efectos de confiabilidad
// (MTBF, Confiabilidad R(t), % Flota sin falla, MTTR/Disponibilidad
// Inherente)? Incluye 'Fuera de Servicio' con criticidad 'Reparación
// Inmediata' — auditoría 2026-08: desde abril 2026 las fallas graves se
// empezaron a registrar por ahí (el flujo rápido de Disponibilidad) en vez
// de como Correctivo/Falla Operacional, y estas métricas solo miraban esos
// dos tipos — 5 meses de fallas reales (motor, diferencial, estructura)
// invisibles para MTBF/Confiabilidad aunque sí contaban para Disponibilidad
// Mecánica. No incluye otras 'Fuera de Servicio' (ej. sin repuesto, no es
// necesariamente una falla del equipo en sí) — solo las marcadas con la
// criticidad más alta.
function esFallaMTBF(o){
  if(!o)return false;
  if(o.tipo==='Correctivo'||o.tipo==='Falla Operacional')return true;
  return o.tipo==='Fuera de Servicio'&&o.criticidad==='Reparación Inmediata';
}

// Adapta 'otHist' (correctivos_historico: sigla/fecha/horometro/sistema, sin 'tipo'
// ni 'criticidad') a la misma forma que espera esFallaMTBF/mtbfFlotaReal — se le pone
// tipo:'Correctivo' a propósito (así es como se clasificó al cargar el histórico vía
// WhatsApp/Excel) para que se sume vía la MISMA función esFallaMTBF, no un criterio
// aparte. estadoOT:'Cerrada' (nunca 'Pendiente'/'En Ejecución') — un correctivo del
// histórico nunca debe aparecer en un Backlog de pendientes, y evita que quede
// literalmente "undefined" en tablas que muestran el estado de cada fila (ej. la
// tabla de Correctivos en Buscar → Ficha por equipo, bug real encontrado al probar
// este mismo cambio). Función pura (recibe otHist ya traído por quien llama, no toca
// S.g) para mantener el mismo criterio de logic.js que el resto del archivo — usado
// por kpi.js (Informes/Reporte Ejecutivo) y buscar.js (Ficha por equipo), auditoría
// 2026-08-18: mismo hallazgo que Ratio Preventivo/Flota sin falla, estos reportes
// también estaban ciegos a 'otHist'.
function _otHistComoOt(otHist){
  return (otHist||[]).map(function(o){
    return{sigla:o.sigla,fecha:o.fecha,horom:o.horometro,tipo:'Correctivo',componente:o.sistema,sintoma:o.sistema,estadoOT:'Cerrada'};
  });
}

// Cuenta correctivos reales (esFallaMTBF) de un mes 'YYYY-MM' dado, sobre un
// arreglo YA combinado de ot+otHist (ver _otHistComoOt/otConHist arriba, el
// mismo patrón que ya usan dash.js/kpi.js/buscar.js/pred.js/cos.js). Sin
// 'mes', cuenta el histórico completo. Fuente única para "Ratio Preventivo/
// Mantención" — auditoría 2026-08-18: Metas, Informes KPI y el Dashboard
// tenían cada uno su propia copia de este filtro, y las 3 terminaron
// desincronizadas entre sí (la del Dashboard ni siquiera miraba ot/otHist:
// contaba tipoPM==='Correctivo' sobre 'reg', un valor que nunca existe ahí).
function contarFallasMes(otConHist,mes){
  return (otConHist||[]).filter(function(o){
    if(!esFallaMTBF(o))return false;
    if(mes&&(o.fecha||o.fechaEntrada||'').slice(0,7)!==mes)return false;
    return true;
  }).length;
}

// Ratio Preventivo/Mantención: % de intervenciones preventivas (PM, 'reg')
// sobre el total (PM + correctivos reales). 'reg'/registros_pm NUNCA tiene
// tipoPM==='Correctivo' en toda su historia (los correctivos viven en
// 'ot'/'otHist', tabla aparte) — así que la cantidad de PM del período ES el
// conteo preventivo completo, sin necesidad de filtrar nada más. null si no
// hubo ninguna intervención de ningún tipo ese período — nunca se inventa un
// 100%/0% por falta de dato.
function ratioPreventivo(prevCount,corrCount){
  var total=(prevCount||0)+(corrCount||0);
  return total?Math.round(prevCount/total*100):null;
}

// Probabilidad de falla por equipo+componente (2026-08, a pedido del usuario:
// "podemos usar probabilidad" leyendo el historial real de correctivos).
// Recibe una lista plana de eventos {sigla, componente, fecha} — ya resueltos
// por quien llama (normalmente pred.js, que combina 'ot' con 'otHist', el
// historial 2022-2025 cargado desde Excel, usando su propia categorización de
// componente) para que esta función no dependa de esa lógica de texto libre y
// se pueda probar con datos sintéticos.
//
// Modelo: proceso de Poisson simple — el intervalo promedio entre fallas
// pasadas (MTBF en días, del mismo equipo+componente) estima la tasa de
// falla, y la probabilidad de que ocurra al menos una falla en los próximos
// 30 días es 1-e^(-30/MTBF). Es la misma familia de fórmula que ya usa
// mtbfFlotaReal/C.mtbfReal para horas, pero acá en días de calendario porque
// el historial de Excel no siempre trae horómetro confiable.
//
// Umbral de 3+ eventos (mismo criterio que diagnosticoFlota en pred.js para
// "requiereRCA"): con 1-2 fallas el promedio no significa nada — se descarta
// en vez de mostrar un número inventado.
function probabilidadFallaDesdeEventos(eventos){
  var grupos={};
  (eventos||[]).forEach(function(e){
    if(!e||!e.sigla||!e.componente||!e.fecha)return;
    var k=e.sigla+'|'+e.componente;
    if(!grupos[k])grupos[k]={sigla:e.sigla,componente:e.componente,fechas:[]};
    grupos[k].fechas.push(e.fecha);
  });
  return Object.keys(grupos).map(function(k){
    var g=grupos[k];
    // Dedup de fechas duplicadas consecutivas: varias líneas cargadas la
    // misma visita a terreno no deben contar como "intervalo de 0 días".
    var fechas=g.fechas.slice().sort().filter(function(f,i,arr){return i===0||f!==arr[i-1];});
    if(fechas.length<3)return null;
    var gaps=[];
    for(var i=1;i<fechas.length;i++)gaps.push((new Date(fechas[i])-new Date(fechas[i-1]))/864e5);
    var mtbfDias=gaps.reduce(function(a,b){return a+b;},0)/gaps.length;
    if(!mtbfDias||mtbfDias<=0)return null;
    var prob30=Math.round((1-Math.exp(-30/mtbfDias))*100);
    return{sigla:g.sigla,componente:g.componente,nEventos:fechas.length,mtbfDias:Math.round(mtbfDias),prob30dPct:prob30,ultimaFecha:fechas[fechas.length-1]};
  }).filter(Boolean).sort(function(a,b){return b.prob30dPct-a.prob30dPct;});
}

function mtbfFlotaReal(eq,ot){
  var perEq=[];
  (eq||[]).forEach(function(e){
    if(!e||e.unidad==='km')return;
    var horoms=(ot||[]).filter(function(o){return o&&o.sigla===e.sigla&&esFallaMTBF(o)&&o.horom>0;}).map(function(o){return o.horom;});
    var m=C.mtbfReal(horoms);
    if(m!=null)perEq.push(m);
  });
  if(!perEq.length)return null;
  return Math.round(perEq.reduce(function(a,b){return a+b;},0)/perEq.length);
}

// ═══ CUMPLIMIENTO PM — fuente ÚNICA para "¿este registro fue a tiempo?" ═══
// Bug real (auditoría 2026-08): el Dashboard/KPI/Metas comparaban literal
// r.estado==='A tiempo', pero ese campo NUNCA vale ese string exacto — saveReg/
// saveEditReg (reg.js) guardan un HTML con ícono/emoji ('...ANTICIPADA' o
// '🔴 ATRASADA'), y la importación CSV (reg.js processImportReg) ponía
// 'A tiempo' fijo en TODOS los registros sin calcular nada. Resultado: todo
// registro manual contaba como NO cumplido (aunque fuera a tiempo) y todo
// registro importado contaba como cumplido (aunque estuviera atrasado) — el
// "% Cumplimiento PM" no medía puntualidad real, medía por qué canal se
// cargó el dato. Se reemplaza la comparación de string por el dato numérico
// real (desvioDias, ya calculado y guardado por ambos flujos de registro
// manual). null = no evaluable (ej. importado por CSV, sin fecha esperada de
// referencia) — se excluye del cálculo en vez de inventar un resultado.
function regEsATiempo(r){
  if(!r||typeof r.desvioDias!=='number'||!isFinite(r.desvioDias))return null;
  return r.desvioDias<=0;
}

// ═══ CONFIABILIDAD REAL (R) — probabilidad de que un equipo NO falle durante
// un período de operación dado, asumiendo tasa de falla constante (distribución
// exponencial) — el supuesto estándar en análisis RAM (Reliability-Availability-
// Maintainability) e ISO 14224/RCM cuando solo se dispone del MTBF, sin curva de
// falla propia medida. Fórmula de libro: R(t) = e^(-t/MTBF).
// Esto es DISTINTO del "idxConf"/"% Flota sin falla" del Dashboard (ese es solo
// "cuántos equipos no tuvieron ningún correctivo este mes" — un conteo simple,
// no una probabilidad de confiabilidad). Devuelve null si no hay MTBF real
// (mtbfFlotaReal ya exige ≥2 fallas por equipo) — nunca inventa un número.
function confiabilidadReal(mtbf,horasPeriodo){
  if(!mtbf||mtbf<=0||horasPeriodo==null||horasPeriodo<0)return null;
  return Math.round(Math.exp(-horasPeriodo/mtbf)*1000)/10;
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

// ═══ FILTRO DE OUTLIERS EN ÓRDENES DE COMPRA (2026-08) ═══
// Auditoría real detectó errores de digitación en el precio unitario (ej. un
// cero de más al importar) que, sin filtrar, inflaban el costo histórico
// total en ~22%: 15 líneas de 6.748 sumaban $1.765M de los $7.843M totales,
// las 15 concentradas en un solo lote de 4 pedidos con el mismo proveedor y
// fecha (10-feb-2025) — un incidente puntual de importación, no un patrón
// real de precios. Se separa una línea cuando su precio unitario supera 50x
// la mediana de precio de ESE MISMO ítem (nunca comparando ítems distintos
// entre sí) — solo se exige mediana con 5+ compras del ítem, para no marcar
// como "anormal" algo con muestra insuficiente para tener una mediana
// confiable. Nunca borra el dato original: separa en {limpias, outliers}
// para que las líneas dudosas no distorsionen costo total/tendencias
// mientras se confirma el valor real con el proveedor.
function ordenesSinOutliers(oc){
  var preciosPorItem={};
  (oc||[]).forEach(function(o){
    if(!o||!o.detalle||!(o.precioUnit>0))return;
    var key=String(o.detalle).trim().toUpperCase();
    (preciosPorItem[key]=preciosPorItem[key]||[]).push(o.precioUnit);
  });
  var medianaPorItem={};
  Object.keys(preciosPorItem).forEach(function(key){
    if(preciosPorItem[key].length<5)return;
    medianaPorItem[key]=medianaPositiva(preciosPorItem[key]);
  });
  var limpias=[],outliers=[];
  (oc||[]).forEach(function(o){
    if(o&&o.detalle&&o.precioUnit>0){
      var mediana=medianaPorItem[String(o.detalle).trim().toUpperCase()];
      if(mediana!=null&&o.precioUnit>50*mediana){outliers.push(o);return;}
    }
    limpias.push(o);
  });
  return{limpias:limpias,outliers:outliers};
}

// ═══ PREDICTIVO (2026-07) — estadísticas en vivo desde ordenes_compra_historico ═══
// Extraído de index.html/computePred() para poder testearlo sin arrancar la app.
// leadTime queda fijo en 34 días porque el histórico real no trae fecha de entrega —
// mismo supuesto que ya usan riesgoQuiebre() y el default de repuestos en index.html.
function predFromOrdenes(ocCrudo){
  var LEAD=34;
  var sep=ordenesSinOutliers(ocCrudo);
  var oc=sep.limpias;
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
      rangoHasta:mesMax||'—',
      outliers:{n:sep.outliers.length,costo:sep.outliers.reduce(function(s,o){return s+(o.costo||0);},0)}
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

// ═══ VERIFICADOR DE INTEGRIDAD — "control de gestión": busca datos físicamente
// imposibles en lo ya guardado, no juicios de negocio ("esto no puede ser cierto",
// nunca "esto me parece raro"). Pura: recibe snapshots de las tablas relevantes
// (mismo shape que S.g() de cada categoría), no toca Supabase ni el DOM. Cada
// hallazgo trae severidad — 'alta' (dato corrupto/imposible en sí mismo) o 'media'
// (inconsistencia entre dos campos que puede ser caché vieja, no corrupción) — para
// que la UI los agrupe. El check de "estado desincronizado" compara el equipo
// contra SUS PROPIOS campos guardados (horomActual vs horomProxPM), no contra un
// recálculo desde cero con ritmoDia/pmPendienteManual — eso evita falsos positivos
// en equipos con ritmo real distinto al nominal, que no es un error de dato.
function verificarIntegridad(data){
  var d=data||{};
  var eq=d.eq||[], reg=d.reg||[], hist=d.hist||[], stk=d.stk||[], repuestos=d.repuestos||[],
      lub=d.lub||[], ordenes=d.ordenes||[], compMayores=d.compMayores||[], dispCalc=d.dispCalc||{};
  var out=[];
  function add(sev,check,msg){out.push({severidad:sev,check:check,msg:msg});}

  // 1) Horómetro que retrocedió respecto a su propio historial
  var porSigla={};
  hist.forEach(function(h){
    if(!h||!h.sigla||!h.fecha)return;
    (porSigla[h.sigla]=porSigla[h.sigla]||[]).push(h);
  });
  Object.keys(porSigla).forEach(function(sigla){
    var arr=porSigla[sigla].slice().sort(function(a,b){return a.fecha<b.fecha?-1:a.fecha>b.fecha?1:0;});
    for(var i=1;i<arr.length;i++){
      var prev=arr[i-1].horomFin!=null?arr[i-1].horomFin:arr[i-1].horom;
      var cur=arr[i].horomFin!=null?arr[i].horomFin:arr[i].horom;
      if(prev!=null&&cur!=null&&cur<prev){
        add('alta','horometroRetrocedido',sigla+': horómetro bajó de '+prev+' ('+arr[i-1].fecha+') a '+cur+' ('+arr[i].fecha+')');
        break; // un aviso por equipo basta, no inundar con cada tramo
      }
    }
  });

  // 2) Disponibilidad fuera de 0-100%
  Object.keys(dispCalc).forEach(function(sigla){
    var meses=dispCalc[sigla]||{};
    Object.keys(meses).forEach(function(mes){
      var v=meses[mes];
      if(typeof v==='number'&&(v<0||v>100)){
        add('alta','disponibilidadFueraDeRango',sigla+' ('+mes+'): disponibilidad '+v+'% — fuera de 0-100%');
      }
    });
  });

  // 3) Estado guardado desincronizado con lo que dice el propio horómetro del equipo
  eq.forEach(function(e){
    if(!e||e.horomActual==null||e.horomProxPM==null)return;
    var yaAlcanzado=e.horomActual>=e.horomProxPM;
    var diceVencida=/VENCID/i.test(e.estado||'')||(e.hrsRestantes!=null&&e.hrsRestantes<0);
    if(yaAlcanzado&&!diceVencida){
      add('media','estadoDesincronizado',(e.sigla||'?')+': el horómetro actual ('+e.horomActual+') ya alcanzó su propio próximo PM guardado ('+e.horomProxPM+'), pero el estado dice "'+(e.estado||'?')+'" — falta recalcular');
    }
  });

  // 4) Sigla de equipo duplicada
  var vistos={};
  eq.forEach(function(e){
    if(!e||!e.sigla)return;
    vistos[e.sigla]=(vistos[e.sigla]||0)+1;
  });
  Object.keys(vistos).forEach(function(sigla){
    if(vistos[sigla]>1)add('alta','siglaDuplicada',sigla+': aparece '+vistos[sigla]+' veces en Equipos');
  });

  // 5) Costos/precios negativos
  stk.forEach(function(s){
    if(s&&s.precioUnit<0)add('alta','precioNegativo','Stock filtros — '+(s.nParte||'?')+': precioUnit '+s.precioUnit);
  });
  repuestos.forEach(function(r){
    if(r&&r.precioUnit<0)add('alta','precioNegativo','Repuestos — '+(r.componente||r.nParte||'?')+': precioUnit '+r.precioUnit);
  });
  lub.forEach(function(l){
    if(l&&l.precio<0)add('alta','precioNegativo','Lubricantes — '+(l.nombre||'?')+': precio '+l.precio);
  });
  ordenes.forEach(function(o){
    if(o&&o.costoEstimado<0)add('alta','precioNegativo','Órdenes de compra — '+(o.componente||o.nParte||'?')+': costoEstimado '+o.costoEstimado);
  });

  // 6) Stock negativo
  stk.forEach(function(s){
    if(s&&s.stockBodega<0)add('alta','stockNegativo','Stock filtros — '+(s.nParte||'?')+': stockBodega '+s.stockBodega);
  });
  repuestos.forEach(function(r){
    if(r&&r.stockActual<0)add('alta','stockNegativo','Repuestos — '+(r.componente||r.nParte||'?')+': stockActual '+r.stockActual);
  });
  lub.forEach(function(l){
    if(l&&l.stock<0)add('alta','stockNegativo','Lubricantes — '+(l.nombre||'?')+': stock '+l.stock);
  });

  // 7) Registro PM/correctivo con fecha de salida anterior a la de entrada
  reg.forEach(function(r){
    if(r&&r.fechaEntrada&&r.fechaSalida&&fechaEsAnterior(r.fechaSalida,r.fechaEntrada)){
      add('alta','fechaSalidaAntesDeEntrada',(r.equipo||'?')+' ('+(r.fechaEntrada)+'): salió el '+r.fechaSalida+', antes de haber entrado el '+r.fechaEntrada);
    }
  });

  // 8) Componente mayor con vida útil <=0 o instalado "en el futuro" del equipo
  var horomPorSigla={};
  eq.forEach(function(e){if(e&&e.sigla)horomPorSigla[e.sigla]=e.horomActual;});
  compMayores.forEach(function(c){
    if(!c)return;
    if(c.vidaUtil!=null&&c.vidaUtil<=0){
      add('media','vidaUtilInvalida',(c.sigla||'?')+' — '+(c.comp||'?')+': vidaUtil '+c.vidaUtil+' (debe ser mayor a 0)');
    }
    if(!c.esOriginal&&c.fechaInst&&c.horomComp!=null){
      var hAct=horomPorSigla[c.sigla];
      if(hAct!=null&&hAct<c.horomComp){
        add('media','horasUsadasNegativas',(c.sigla||'?')+' — '+(c.comp||'?')+': instalado en horómetro '+c.horomComp+', pero el equipo hoy tiene '+hAct+' — menos que al instalarlo');
      }
    }
  });

  var orden={alta:0,media:1,baja:2};
  out.sort(function(a,b){return orden[a.severidad]-orden[b.severidad];});
  return out;
}

// ═══ ÍNDICE DE SALUD DE FLOTA — un solo número que resume el estado real de la
// operación, con tendencia semana a semana. Compuesto por 4 dimensiones que YA
// se calculan cada una por separado en el Dashboard (Cumplimiento PM, Disponibilidad,
// Stock sano, Confiabilidad) — no se inventa una fórmula nueva, se promedian las que
// ya existen y ya se validaron. Si falta alguna (ej. sin equipos con dato de
// disponibilidad este mes) se promedia solo con las disponibles, nunca se rellena con
// un supuesto. null si NINGUNA dimensión tiene dato.
function indiceSaludFlota(m){
  var d=m||{};
  var componentes=[
    {nombre:'Cumplimiento PM',valor:(typeof d.cumplPM==='number'&&isFinite(d.cumplPM))?d.cumplPM:null},
    {nombre:'Disponibilidad',valor:(typeof d.disponibilidad==='number'&&isFinite(d.disponibilidad))?d.disponibilidad:null},
    {nombre:'Stock sano',valor:(typeof d.stockSano==='number'&&isFinite(d.stockSano))?d.stockSano:null},
    {nombre:'Flota sin falla',valor:(typeof d.confiabilidad==='number'&&isFinite(d.confiabilidad))?d.confiabilidad:null}
  ];
  var usados=componentes.filter(function(c){return c.valor!=null;});
  if(!usados.length)return {valor:null,n:0,detalle:componentes};
  var suma=usados.reduce(function(s,c){return s+c.valor;},0);
  var valor=Math.round((suma/usados.length)*10)/10;
  return {valor:valor,n:usados.length,detalle:componentes};
}

// ═══ SCORE DE SALUD DEL EQUIPO — mismo patrón que indiceSaludFlota de arriba
// (promedio de dimensiones que YA se calculan cada una por separado), pero para
// UN equipo en vez de la flota completa. Las dimensiones no son las mismas que
// las de flota — "Stock sano" y "Cumplimiento PM" son conceptos de flota/bodega
// compartida, no de un equipo individual — sino las 4 que sí describen a un
// equipo puntual: estado de sus Componentes Mayores, sus Neumáticos, sus últimas
// muestras de Aceite, y su Confiabilidad real (MTBF propio). Cada valor se recibe
// YA calculado por quien llama (misma separación que indiceSaludFlota: acá solo
// se combina, no se recalcula compEstado/neuDebeCambiar/confiabilidadReal). Si
// falta alguna dimensión (ej. equipo sin muestras de aceite, o sin 2 fallas
// registradas para tener MTBF) se promedia solo con las disponibles — nunca se
// rellena con un supuesto. null si NINGUNA dimensión tiene dato.
function scoreSaludEquipo(m){
  var d=m||{};
  var dimensiones=[
    {nombre:'Componentes',valor:(typeof d.componentesPct==='number'&&isFinite(d.componentesPct))?d.componentesPct:null},
    {nombre:'Neumáticos',valor:(typeof d.neumaticosPct==='number'&&isFinite(d.neumaticosPct))?d.neumaticosPct:null},
    {nombre:'Aceite',valor:(typeof d.aceitePct==='number'&&isFinite(d.aceitePct))?d.aceitePct:null},
    {nombre:'Confiabilidad',valor:(typeof d.confiabilidadPct==='number'&&isFinite(d.confiabilidadPct))?d.confiabilidadPct:null}
  ];
  var usadas=dimensiones.filter(function(c){return c.valor!=null;});
  if(!usadas.length)return {valor:null,n:0,detalle:dimensiones};
  var suma=usadas.reduce(function(s,c){return s+c.valor;},0);
  var valor=Math.round((suma/usadas.length)*10)/10;
  return {valor:valor,n:usadas.length,detalle:dimensiones};
}

// Cuál de las dimensiones del Score de Salud del Equipo es la que más lo está
// arrastrando hacia abajo — para poder decir "por qué" en vez de solo mostrar
// el número (avisos de WhatsApp/correo, ficha de Buscar). La de valor más
// bajo entre las que tienen dato; null si ninguna dimensión tiene dato.
function motivoPrincipalSalud(detalle){
  var conDato=(detalle||[]).filter(function(c){return c&&typeof c.valor==='number'&&isFinite(c.valor);});
  if(!conDato.length)return null;
  return conDato.reduce(function(peor,c){return c.valor<peor.valor?c:peor;});
}

// Guarda (o actualiza, si ya corrió hoy) el valor del índice del día en el histórico
// {fecha: valor}, y descarta lo más viejo que SALUD_HIST_DIAS_MAX días — solo hace
// falta guardar suficiente para comparar semana a semana, no un historial indefinido.
// Pura: devuelve un objeto NUEVO, no muta 'historico'.
var SALUD_HIST_DIAS_MAX=120;
function registrarSnapshotSalud(historico,valorHoy,hoyISO){
  if(valorHoy==null||!hoyISO)return historico||{};
  var out=Object.assign({},historico||{});
  out[hoyISO]=valorHoy;
  var limite=new Date(hoyISO+'T00:00:00');
  limite.setDate(limite.getDate()-SALUD_HIST_DIAS_MAX);
  var limiteISO=limite.toISOString().slice(0,10);
  Object.keys(out).forEach(function(f){if(f<limiteISO)delete out[f];});
  return out;
}

// Tendencia semanal: compara el valor de hoy contra el snapshot más cercano a 7 días
// atrás, dentro de una ventana de 4-10 días (no hay snapshot todos los días si el
// sistema no se abre a diario, así que exigir EXACTAMENTE 7 días descartaría casi
// siempre un dato real disponible). Fuera de esa ventana, o sin dato de hoy, no hay
// tendencia confiable que mostrar — null, no un número inventado.
function tendenciaSaludSemanal(historico,hoyISO){
  var h=historico||{};
  var actual=h[hoyISO];
  if(actual==null)return null;
  var objetivo=new Date(hoyISO+'T00:00:00');objetivo.setDate(objetivo.getDate()-7);
  var mejorFecha=null,mejorDist=Infinity;
  Object.keys(h).forEach(function(f){
    if(f===hoyISO)return;
    var dist=Math.abs(new Date(f+'T00:00:00').getTime()-objetivo.getTime());
    if(dist<mejorDist){mejorDist=dist;mejorFecha=f;}
  });
  if(mejorFecha==null)return {actual:actual,hace7d:null,delta:null,fechaHace7d:null};
  var diasReales=Math.round((new Date(hoyISO+'T00:00:00')-new Date(mejorFecha+'T00:00:00'))/86400000);
  if(diasReales<4||diasReales>10)return {actual:actual,hace7d:null,delta:null,fechaHace7d:null};
  var delta=Math.round((actual-h[mejorFecha])*10)/10;
  return {actual:actual,hace7d:h[mejorFecha],delta:delta,fechaHace7d:mejorFecha};
}

// ═══ EQUIPOS FUERA DE SERVICIO AHORA MISMO ═══
// Mismo criterio que ya usaban disp.js y ot.js cada uno por su lado (duplicado
// literal): una OT con estatusEq='Fuera de Servicio', con fecha de entrada pero
// SIN fecha de salida — la salida de servicio sigue abierta hoy. Se consolida acá
// porque el header persistente (siempre visible, en cualquier pestaña — ver
// renderHeader en index.html) necesita el mismo número real, no una tercera copia
// del filtro. Devuelve [{o,i}] (equipo + su índice original en 'ot') para que los
// consumidores que ya ofrecen "Volvió a operar" (cerrarSalidaServicio(i)) sigan
// funcionando igual.
function equiposFueraDeServicioAhora(ot){
  return (ot||[]).map(function(o,i){return{o:o,i:i};}).filter(function(x){
    return x.o&&x.o.estatusEq==='Fuera de Servicio'&&x.o.fechaEntrada&&!x.o.fechaSalida;
  });
}

// ═══ MOTIVO OBLIGATORIO AL MARCAR UN PM PENDIENTE MANUAL ═══
// Autocrítica sobre la propia función pmPendienteManual (agregada antes en esta
// misma sesión, ver C.recalc arriba): sobrescribir el cálculo automático del
// próximo PM queda registrado en el changelog genérico (viejo valor → valor
// nuevo, automático en cada S.s('eq',...)), pero SIN ningún rastro de POR QUÉ
// alguien decidió que ese hito quedó pendiente — un dato que puede cambiar el
// estado de un equipo a VENCIDA de la nada necesita esa justificación, no solo
// el número. Exige motivo SOLO cuando de verdad se está marcando/cambiando un
// hito (no al limpiarlo — eso ya lo hace el sistema solo cuando se registra el
// PM real que lo cubre, ver saveReg en reg.js, y no necesita justificación).
function validarMotivoPmPendiente(pendienteAnterior,pendienteNuevo,motivo){
  var antes=pendienteAnterior||null;
  var nuevo=pendienteNuevo||null;
  var seEstaMarcando=nuevo>0&&nuevo!==antes;
  if(seEstaMarcando&&!(motivo&&motivo.trim())){
    return{valido:false,motivoError:'Anota el motivo: ¿cómo sabes que este hito de PM quedó pendiente? (ej. "PM4 lo hizo el proveedor externo en terreno, no se alcanzó a registrar acá")'};
  }
  return{valido:true};
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

// ═══ AGRUPAR UNA FECHA/MES EN SU PERÍODO (Mes/Semestre/Año) ═══
// Consolidada acá (2026-08-28, paso 2 del plan) desde 3 copias casi idénticas
// que habían salido cada una por su cuenta al construir Tendencia de Compra
// (_agruparPeriodoItem, index.html), Neumáticos (_agruparPeriodoNeu, neu.js) y
// Dotación de Taller (_agruparPeriodoDot, pred.js) — mismo cálculo, sin
// ninguna razón real para tener 3 versiones. Acepta tanto 'YYYY-MM' como una
// fecha ISO completa 'YYYY-MM-DD' (slice(0,7) es un no-op sobre 'YYYY-MM').
function agruparPeriodo(fechaOMes,gran){
  var mes=String(fechaOMes).slice(0,7);
  if(gran==='año')return mes.slice(0,4);
  if(gran==='semestre'){var yy=mes.slice(0,4),mm=parseInt(mes.slice(5,7));return yy+'-S'+(mm<=6?1:2);}
  return mes;
}

// ═══ GASTO PROYECTADO AGREGADO POR CATEGORÍA (Filtros/Lubricantes/Repuestos) ═══
// Movida acá desde index.html (2026-08-28, paso 2 del plan de reducir el
// acoplamiento entre lógica de negocio y UI) — es una función pura (sin DOM,
// sin S.g), así que pertenece junto al resto de logic.js, no mezclada con
// renderizado. La versión que construye HTML (_gastoProyectadoHTML) se quedó
// en index.html porque esa sí es UI.
//
// (2026-08-27, a pedido del usuario: "arma ese agregado total" — mismo espíritu que
// el "hasta fin de año" de Neumáticos, pero acá un ítem de stock NO tiene un solo
// evento de reemplazo como una goma: se consume y se repone en ciclos continuos.
// Por eso NO se cuenta "N ítems se agotan el mes X" (eso subestimaría el gasto real
// de un ítem que se repone varias veces antes de fin de año) — en cambio se proyecta
// el GASTO mensual al ritmo de consumo/compra real reciente de cada ítem (mismo
// promedio móvil que ya usa el botón 📈), y se distribuye hacia adelante.
// NO usa correctivos: en la BD real no existe ningún vínculo entre un correctivo y
// un ítem de stock específico (los correctivos solo tienen texto libre de síntoma/
// solución) — cruzarlos sería inventar una relación que no está. Para lo que exige
// el calendario de PM ya agendado (pautas + horómetro), esa proyección determinística
// ya existe aparte en Predictivo → Stock/Lubricantes vs. Próximos PM.
function _gastoProyectadoCategoria(items,getEventos,getPrecio,gran){
  gran=gran||'mes';
  var hoy=new Date();hoy.setDate(1);
  // Auditoría 2026-08-27 (a pedido del usuario, revisando bugs de lo construido el
  // día anterior): con datos reales, la mayoría de los ítems NO tienen precio
  // cargado (127/167 Filtros, 7/13 Lubricantes, 165/165 — el 100% — de Repuestos).
  // Antes, un ítem con historial real pero precio $0/vacío se contaba como "con
  // datos" y aportaba $0 en silencio — el total podía verse bajo (o directamente
  // $0 en Repuestos) sin ningún aviso de que la mayoría de los ítems quedaron
  // afuera. Ahora se separan 3 grupos: con historial Y precio (los únicos que
  // aportan al total), con historial pero SIN precio (excluidos del total, se
  // avisa aparte), y sin historial (excluidos, ya se avisaba antes).
  var itemsConDatos=0,itemsSinDatos=0,itemsSinPrecio=0;
  var HORIZONTE_MESES=12;
  var mesesFuturos=[];
  for(var i=0;i<HORIZONTE_MESES;i++){
    var d=new Date(hoy.getFullYear(),hoy.getMonth()+i,1);
    mesesFuturos.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));
  }
  var gastoMensual={};mesesFuturos.forEach(function(m){gastoMensual[m]=0;});

  items.forEach(function(item){
    var eventos=getEventos(item);
    var porMes={};
    (eventos||[]).forEach(function(e){if(!e.fecha)return;var m=e.fecha.slice(0,7);porMes[m]=(porMes[m]||0)+(e.cant||0);});
    var mesesConDatos=Object.keys(porMes).sort();
    if(!mesesConDatos.length){itemsSinDatos++;return;}
    var precio=getPrecio(item)||0;
    if(!precio){itemsSinPrecio++;return;}
    itemsConDatos++;
    var ultimos=mesesConDatos.slice(-6);
    var promMovil=ultimos.reduce(function(s,m){return s+porMes[m];},0)/ultimos.length;
    var gastoMes=promMovil*precio;
    mesesFuturos.forEach(function(m){gastoMensual[m]+=gastoMes;});
  });

  function agrupar(mes){
    if(gran==='año')return mes.slice(0,4);
    if(gran==='semestre'){var yy=mes.slice(0,4),mm=parseInt(mes.slice(5,7));return yy+'-S'+(mm<=6?1:2);}
    return mes;
  }
  var porPeriodo={};
  mesesFuturos.forEach(function(m){var p=agrupar(m);porPeriodo[p]=(porPeriodo[p]||0)+gastoMensual[m];});
  var periodosOrd=Object.keys(porPeriodo).sort();

  var anioActual=hoy.getFullYear();
  var mesesHastaFinAnio=mesesFuturos.filter(function(m){return m.slice(0,4)===String(anioActual);});
  var gastoHastaFinAnio=mesesHastaFinAnio.reduce(function(s,m){return s+gastoMensual[m];},0);

  return{porPeriodo:porPeriodo,periodosOrd:periodosOrd,gastoHastaFinAnio:gastoHastaFinAnio,itemsConDatos:itemsConDatos,itemsSinDatos:itemsSinDatos,itemsSinPrecio:itemsSinPrecio};
}

// ═══ MOTOR DE INTERPRETACIÓN AUTOMÁTICA — CATEGORÍA DE COMPONENTE DESDE SÍNTOMA ═══
// Movido acá desde pred.js (2026-08-28, paso 2 del plan) — es lógica pura de
// clasificación de texto, sin nada de UI, así que pertenece en logic.js junto
// al resto del cálculo de negocio. El campo "componente" de correctivos está
// vacío en el 100% de los registros reales (verificado 2026-07 — nadie lo
// llena en terreno); la descripción real vive como texto libre en "síntoma",
// sin formato consistente ("Asiento", "ASIENTO NO FUNCIONAL", "asiento con
// falla en respaldar", etc.). Sin esto, toda detección de "falla recurrente
// en el mismo componente" (Predictivo, Estadística) queda ciega — nunca
// encuentra nada que agrupar.
//
// Auditoría de cobertura real (2026-08-28, a pedido del usuario: "normaliza
// sintoma y sistema con NLP"): medida contra los 1.243 correctivos reales de
// la tabla 'correctivos' (889 síntomas distintos), la versión original de
// este diccionario solo clasificaba el 42.1% de las filas (523/1243). Una
// primera pasada de correcciones subió eso a 52.9% (658/1243). Segunda
// pasada (mismo día, revisando el siguiente tramo de síntomas sin
// categoría): ampliar 'presurizacion'→'presuriz' a nivel de raíz (atrapa
// también el verbo conjugado "se presuriza", no solo el sustantivo —
// revisados los 51 casos reales que contienen "presuriz" en toda la base,
// los 51 son de neumáticos, cero falsos positivos) + variantes de plural/
// espaciado/typo en 4 categorías existentes + una categoría nueva
// (Radio/Comunicaciones), subiendo la cobertura real medida a 57.6%
// (716/1243). Tercera pasada (mismo día, a pedido del usuario contra una
// lista de términos a revisar: lainas, sello, sensores, tornamesa, válvula,
// cañería, flexible, bomba centrífuga, cardán, retén — verificados uno por
// uno contra los datos reales antes de agregar nada): 'lainas' y 'bomba
// centrífuga' tienen CERO ocurrencias reales en toda la base — no se
// agregan, sería inventar. 'sello'/'sensor'/'válvula' aparecen pero cruzan
// demasiados sistemas distintos entre sí (un sensor puede ser de motor,
// suspensión o neumático; una válvula puede ser de freno, motor o carga) —
// forzarlos a una sola categoría sería menos preciso que dejarlos sin
// clasificar. 'retén' ya quedaba cubierto por 'diferecial' en el único caso
// real que existe. Sí se agregaron con evidencia real: 'suspencion' (typo
// con "c", 20 filas), 'cardán' (unido a Crucetas — un caso real muestra
// ambos términos en la misma falla, es el mismo conjunto mecánico),
// 'flexible' ampliada de frase a palabra sola y 'cañería' agregada a
// Mangueras/Fugas (34 filas combinadas, revisadas una por una — es el
// equivalente rígido de una manguera), y categoría nueva Tornamesa/Giro (2
// filas). Cobertura real medida: 59.7% (742/1243). El resto son mayormente
// casos genuinamente SIN componente
// específico (mantenimiento preventivo, cierre de backlog, partida de
// equipo, código de falla activo sin especificar sistema) — que quedan
// correctamente sin categoría, no es un hueco a rellenar — más una cola larga
// de síntomas únicos, casi todos con errores de tipeo distintos entre sí
// (ej. "trasnmision", "poscion", "sproket"), que queda fuera de esta pasada:
// no se puede tapar toda esa cola de una vez sin arriesgar clasificaciones
// falsas, así que se deja para ir sumando caso a caso con evidencia real,
// mismo criterio que ya se venía aplicando en las auditorías anteriores.
var _CATEGORIAS_COMPONENTE=[
  ['Asiento',['asiento']],
  ['Batería',['bateria','batería','baterias','baterías']],
  ['Motor de Partida',['motor de partida','motor partida']],
  ['Cilindro de Dirección',['cilindro direccion','cilindro de direccion','cilindro dirección','cilindro de dirección','cilindro volante']],
  // 'despresuriz'/'desprezuriz' (typo real visto en los datos)/'presuriz'
  // agregadas como RAÍZ, no palabra completa (2026-08-28, segunda pasada):
  // en el vocabulario real de esta flota (correctivos con "posición 1-6", el
  // mismo esquema P1-P2 delanteros/P3-P6 traseros de los Parámetros de
  // Neumáticos en Configuración) hablar de presión sin decir "neumático" es
  // casi siempre de todas formas sobre neumáticos. Usar la raíz en vez de la
  // palabra completa ('presurizacion') además atrapa las formas conjugadas
  // reales del verbo ("se presuriza posición 3", "se despresuriza") que la
  // primera pasada dejaba fuera — revisados los 51 casos reales que
  // contienen "presuriz" en toda la base: los 51 son de neumáticos, cero
  // falsos positivos.
  ['Neumáticos',['neumatico','neumático','neumaticos','neumáticos','despresuriz','desprezuriz','presuriz']],
  ['Frenos',['freno']],
  ['Transmisión',['transmision','transmisión']],
  ['Diferencial',['diferencial','diferecial']],
  ['Mandos Finales',['mandos finales','mando final']],
  ['Turbo',['turbo']],
  ['Alternador',['alternador']],
  ['Bomba de Agua',['bomba de agua','bomba agua']],
  // 'enfriador'/'enfriadores'/'refrigeracion' agregadas (2026-08-28): mismo
  // concepto que 'radiador'/'refrigerante' con otra familia de palabras
  // ("limpieza de enfriadores", "cañería de refrigeración rota") que no
  // calzaba con ninguna de las dos.
  ['Radiador/Enfriamiento',['radiador','refrigerante','enfriador','enfriadores','refrigeracion']],
  // 'suspencion' agregada (2026-08-28, tercera pasada): typo real muy
  // frecuente (20 filas) — "suspensión" escrita con "c" en vez de "s". El
  // único caso ambiguo real ("cable de suspensión neumática de ASIENTO")
  // igual clasifica bien porque "Asiento" está antes en esta lista y gana
  // primero.
  ['Suspensión',['suspension','suspensión','suspencion']],
  ['Inyectores',['inyector','inyectores']],
  // 'filtro decombustible' agregada (2026-08-28): typo real sin espacio
  // ("se reemplaza filtro decombustible y se puraga sistema", 2 filas).
  ['Filtro de Combustible',['filtro de combustible','filtro combustible','filtro decombustible']],
  ['Filtro de Aire',['filtro de aire','filtro aire']],
  // 'bomba de inyeccion'/'bomba inyeccion' agregadas (2026-08-28): variante
  // real vista en los datos ("perno de bomba inyeccion") que no calzaba con
  // 'bomba inyectora'.
  ['Bomba de Combustible',['bomba de combustible','bomba combustible','bomba inyectora','bomba de inyeccion','bomba inyeccion']],
  // Renombrada a 'Crucetas/Cardán' y agregado 'cardan'/'cardán' (2026-08-28,
  // tercera pasada): un caso real muestra ambos términos en la MISMA falla
  // ("...sector de cardan hacia transmision...se desmonta cardan y se
  // evidencia desgaste en polines de crucetas...") — es el mismo conjunto
  // mecánico (el cardán conecta transmisión y diferencial mediante las
  // crucetas), así que se unifican en una sola categoría.
  ['Crucetas/Cardán',['cruceta','crucetas','cardan','cardán']],
  // 'soportes de cabina' agregada (2026-08-28): plural real que no calzaba
  // con el singular ("soportes de cabina" tiene una "s" de más antes del
  // "de" que rompe el substring match).
  ['Soporte de Cabina',['soporte de cabina','soporte cabina','soportes de cabina']],
  ['Conectores/Cableado',['conector','conectores','arnes','arnés']],
  // 'flexible' (2026-08-28, tercera pasada): ampliada de la frase completa
  // 'flexible hidraulico' a la palabra sola — revisados los 24 casos reales
  // que contienen "flexible" en toda la base, los 24 son de mangueras/líneas
  // flexibles (hidráulico, combustible, freno, refrigeración), cero falsos
  // positivos. 'cañeria'/'cañería'/'caneria' agregadas (10 filas reales) —
  // es el equivalente rígido de una manguera (línea de combustible,
  // refrigerante, dirección), misma naturaleza física de falla.
  ['Mangueras/Fugas',['manguera','mangueras','flexible','cañeria','cañería','caneria']],
  // 'elementos desgaste' agregada (2026-08-28): variante real sin "de"
  // entre las dos palabras.
  ['Elemento de Desgaste',['elemento de desgaste','elementos de desgaste','elementos desgaste']],
  // Ampliado (auditoría 2026-08, pedido del usuario: "revisa bien, si cambian
  // tanto foco o ampolleta indica que la falla es más compleja"): el listado
  // original solo reconocía 'foco delantero'/'foco trasero' — no atrapaba
  // "foco faenero"/"focos faeneros" (la redacción real más común en las OT de
  // esta flota) ni errores de tipeo reales vistos en los datos ('ampoleta',
  // 'alpolleta', 'amplolleta'). Con el hueco, esos eventos quedaban SIN
  // categoría y el conteo de fallas repetidas (compFallas>=2/3 en
  // diagnosticoFlota) no los veía — un patrón real como el de CN-5133 (~18
  // eventos de foco/eléctrico en un año, probable falla de cableado/tierra,
  // no desgaste de ampolleta) pasaba invisible pese a estar en los datos.
  ['Foco/Ampolleta',['ampolleta','ampoleta','alpolleta','amplolleta','foco delantero','foco trasero','foco frontal','foco faenero','focos faeneros','faenero','luz baja','luz alta']],
  ['Sistema Hidráulico',['hidraulico','hidráulico']],
  // 'eléctrica'/'electrica' (2026-08-28, forma femenina — "falla eléctrica" no
  // calzaba con el keyword 'eléctrico' por la concordancia de género, 15
  // filas reales perdidas por esto solo) y 'bocina' (accesorio eléctrico)
  // agregadas.
  ['Sistema Eléctrico',['electrico','eléctrico','elÃ©ctrico','eléctrica','electrica','bocina']],
  // 'se carga ac'/'chequeo a/c'/'bajo flujo de a/c'/'sistema de ac'
  // agregadas (2026-08-28): variantes reales de "a/c" sin el espacio
  // requerido a ambos lados por el keyword ' a/c ' — se agregan como
  // frases completas, no la sigla sola ("ac"), porque "ac" de 2 letras
  // aparece dentro de otras palabras sin relación (ej. "AdBlue" escrito
  // "acblue" en un síntoma real) y generaría falsos positivos.
  ['Aire Acondicionado',['aire acondicionado',' a/c ','a/c.','condensador','se carga ac','chequeo a/c','bajo flujo de a/c','sistema de ac']],
  ['GET / Cuchillas',['cuchilla','entrediente','gets']],
  // Ampliado (auditoría 2026-08, mismo hueco que Foco/Ampolleta): solo
  // reconocía 'pasador del balde'/'pasador balde' (la falla del pasador), no
  // atrapaba "cambio de balde"/"desgaste del balde" (el reemplazo del balde
  // completo, la redacción real encontrada en correctivos) — esos eventos
  // quedaban sin categoría.
  ['Balde/Implemento',['pasador del balde','pasador de balde','pasador balde','cambio de balde','desgaste del balde','balde nuevo','balde por rotura']],
  // Nueva (auditoría 2026-08, pedido del usuario: "biela, pantógrafo, cambio
  // de pasadores y buje de balde o biela"): no existía ninguna categoría para
  // el varillaje/linkage del balde (biela de volteo/pantógrafo) — quedaba sin
  // categorizar pese a un patrón real serio: CF-9510 tuvo juego excesivo en
  // el eje de la biela (feb-2025), fisura en la biela (jul-2025) y rotura del
  // pantógrafo que obligó a cambiar el balde (feb-2026) — no es desgaste
  // normal, es una falla estructural recurrente en el mismo conjunto.
  // CF-8769 tuvo fisura de pantógrafo (feb-2026, 60 días fuera de servicio) y
  // otra falla estructural en el mismo conjunto + pasador del cilindro de
  // volteo (jul-2026, aún fuera de servicio). Ambos casos ameritan revisión
  // de ingeniería (sobrecarga, fatiga), no solo cambiar la pieza rota de nuevo.
  ['Biela/Pantógrafo',['biela','pantografo','pantógrafo']],
  // Nueva (2026-08, pedido del usuario al revisar el historial de "soporte de
  // cabina" cargado desde ordenes_trabajo): esos datos ya traían una categoría
  // propia, "Tren de Rodaje" (10 eventos reales — tensado de oruga/cadena,
  // pernos de sprocket y zapata, cambio de rodillos), específica de equipos
  // con orugas (bulldozer BD-xxxx). No existía en este listado — sin categoría
  // acá, un correctivo nuevo con "se cambian rodillos" o "tensado de cadena"
  // en el campo síntoma (que es donde vive el texto real, ver nota arriba)
  // quedaba sin clasificar o caía por accidente en otra categoría genérica.
  // 'rueda motriz' sumada (2026-08, auditoría de la fuente WhatsApp): 3 eventos
  // reales de BD-509 ("pernos sueltos de rueda motriz", "segmento rueda motriz
  // suelto") quedaban sin categoría — es la rueda dentada que mueve la oruga,
  // mismo conjunto mecánico que sprocket/zapata/cadena.
  ['Tren de Rodaje',['oruga','cadena','sprocket','zapata','rodillo','rueda tensora','rueda motriz']],
  // Nueva (2026-08-28): "engrase"/"relleno de grasa" es un patrón real muy
  // frecuente (39 filas) que no calzaba en ninguna categoría existente — es
  // una actividad de lubricación, no una falla de un componente específico,
  // así que se le da su propia categoría en vez de forzarla en otra.
  ['Engrase/Lubricación',['engrase','relleno de grasa','carga de grasa','tk de grasa','tk grasa','nivel de grasa','nivel grasa']],
  // Nueva (2026-08-28): "fuga de aceite"/"fuga aceite" (6 filas reales) es
  // físicamente distinto de una falla de manguera (Mangueras/Fugas, arriba) —
  // una fuga de aceite puede venir de un sello, un cárter fisurado, una junta,
  // no necesariamente una manguera — así que se separa en su propia categoría
  // en vez de mezclarla ahí.
  ['Fuga de Aceite',['fuga de aceite','fuga aceite']],
  // Nueva (2026-08-28): "falla en radio base"/"falla ptt radio" (4 filas
  // reales) — el radio de comunicación del equipo, sin categoría hasta ahora.
  ['Radio/Comunicaciones',['radio base','falla ptt']],
  // Nueva (2026-08-28, tercera pasada, término sugerido por el usuario): la
  // tornamesa es el mecanismo de giro de la superestructura (cargador
  // frontal/excavadora) — sin categoría hasta ahora (2 filas reales).
  ['Tornamesa/Giro',['tornamesa','torna mesa']],
  ['Motor',['motor']] // genérico — al final para que las categorías específicas de arriba (Motor de Partida, Bomba de Agua, etc.) ganen primero
];
// Deriva una categoría de componente desde el texto libre de "síntoma" cuando el
// campo estructurado viene vacío (que es casi siempre, ver nota arriba).
function _componenteDeSintoma(sintoma){
  if(!sintoma)return '';
  var t=sintoma.toLowerCase();
  for(var i=0;i<_CATEGORIAS_COMPONENTE.length;i++){
    var cat=_CATEGORIAS_COMPONENTE[i][0],keys=_CATEGORIAS_COMPONENTE[i][1];
    for(var j=0;j<keys.length;j++){if(t.indexOf(keys[j])>=0)return cat;}
  }
  return '';
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
  window.verificarIntegridad = verificarIntegridad;
  window.indiceSaludFlota = indiceSaludFlota;
  window.scoreSaludEquipo = scoreSaludEquipo;
  window.motivoPrincipalSalud = motivoPrincipalSalud;
  window.registrarSnapshotSalud = registrarSnapshotSalud;
  window.tendenciaSaludSemanal = tendenciaSaludSemanal;
  window.equiposFueraDeServicioAhora = equiposFueraDeServicioAhora;
  window.validarMotivoPmPendiente = validarMotivoPmPendiente;
  window.mtbfFlotaReal = mtbfFlotaReal;
  window.esFallaMTBF = esFallaMTBF;
  window._otHistComoOt = _otHistComoOt;
  window.contarFallasMes = contarFallasMes;
  window.ratioPreventivo = ratioPreventivo;
  window.probabilidadFallaDesdeEventos = probabilidadFallaDesdeEventos;
  window.confiabilidadReal = confiabilidadReal;
  window.regEsATiempo = regEsATiempo;
  window._gastoProyectadoCategoria = _gastoProyectadoCategoria;
  window.agruparPeriodo = agruparPeriodo;
  window._CATEGORIAS_COMPONENTE = _CATEGORIAS_COMPONENTE;
  window._componenteDeSintoma = _componenteDeSintoma;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    C, fd, fn, escapeHtml, csvCeldaSegura,
    _tokensMaterial, _scoreMaterial, precioMaterial,
    esLubricante, vencReglaDefault, vencCalcProximo, vencEstado,
    fechaEsPlausible, fechaEsAnterior, duracionHM, medianaPositiva, hhPlanEstimator,
    LUB_REEMPLAZO, lubVigente, lubEsObsoleto, construirLecturaHistorial,
    predFromOrdenes, ordenesSinOutliers, stockEstado, compEstado, tasaDiariaReal, horomEnFecha, rangoDias, dispDownMap, dispEquipoMes, pagSlice, hayConflictoIds,
    validarSaltoHorometro, resolverDestrabePorOC, verificarIntegridad,
    indiceSaludFlota, scoreSaludEquipo, motivoPrincipalSalud, registrarSnapshotSalud, tendenciaSaludSemanal,
    equiposFueraDeServicioAhora, validarMotivoPmPendiente, mtbfFlotaReal, confiabilidadReal, regEsATiempo, esFallaMTBF,
    probabilidadFallaDesdeEventos, _otHistComoOt, contarFallasMes, ratioPreventivo,
    _gastoProyectadoCategoria, agruparPeriodo,
    _CATEGORIAS_COMPONENTE, _componenteDeSintoma
  };
}
