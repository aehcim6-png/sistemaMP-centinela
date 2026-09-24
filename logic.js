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
  // MTTR real: promedio de horas de reparación (campo 'duracion' de la OT,
  // formato "Xh") de las reparaciones con ese dato registrado. Consolidada
  // 2026-08-30 como fuente ÚNICA — a diferencia de mtbfReal (que ya tenía ese
  // comentario desde antes), este cálculo se había quedado reimplementado por
  // separado, línea por línea casi idéntico, en cos.js y kpi.js. Recibe la
  // lista de valores 'duracion' de las OT que SÍ son fallas (esFallaMTBF) —
  // filtra acá mismo las vacías/'—', igual que hacían ambas copias. El
  // denominador es la cantidad de reparaciones con 'duracion' registrada
  // (no solo las que matchean el regex "Xh"), y devuelve 0 (no null) cuando
  // no hay ninguna — mismo comportamiento exacto de las dos copias
  // originales, preservado a propósito para no cambiar ningún número que ya
  // se ve en pantalla.
  mttrReal(duraciones){
    const reps=(duraciones||[]).filter(d=>d&&d!=='—');
    if(!reps.length)return 0;
    let totalH=0;
    reps.forEach(d=>{const m=String(d).match(/(\d+)h/);if(m)totalH+=parseInt(m[1],10);});
    return Math.round(totalH/reps.length*10)/10;
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

// ═══ COSTO SUGERIDO POR CRUCE — cruza el texto de un correctivo (síntoma +
// solución + componente) contra el 'detalle' de las Órdenes de Compra
// reales del MISMO equipo (ordenes_compra_historico), dentro de una ventana
// de días, para sugerir de dónde podría salir el costo real de esa
// reparación — 2026-09-16, pedido del usuario tras notar que muchas OT
// mencionan el mismo repuesto/servicio que su OC (ej. real verificado: OT
// de CF-9510 15-mar-2026, síntoma "Falla eléctrica", solución "...cambio de
// alternador...", cruza con una OC del mismo día "Servicio Reparacion
// Alter[nador]", $550.000).
//
// El 'detalle' de ordenes_compra_historico está TRUNCADO a 25 caracteres
// (confirmado: ninguna fila supera esa longitud) — "alternador" queda
// "Alter". Por eso NO se puede reusar _scoreMaterial tal cual (exige
// coincidencia exacta de token): acá un token del detalle (candidato, casi
// siempre truncado) cuenta como coincidencia si es IGUAL o PREFIJO de un
// token del texto de la OT — mínimo 4 caracteres, para no dar falsos
// positivos con palabras cortas genéricas.
//
// Devuelve una LISTA de candidatos (puede haber más de uno: reparaciones
// similares del mismo equipo caen en la misma ventana de días), ordenada
// por score y cercanía de fecha — NUNCA un costo único "confirmado". Es una
// sugerencia para que un humano revise, no un reemplazo automático del
// costo real de la OT — mismo umbral (0.6) que ya usa precioMaterial.
function _tokenCoincideConTruncamiento(tokenCorto,tokenLargo){
  if(tokenCorto===tokenLargo)return true;
  if(tokenCorto.length>=4&&tokenLargo.indexOf(tokenCorto)===0)return true;
  if(tokenLargo.length>=4&&tokenCorto.indexOf(tokenLargo)===0)return true;
  return false;
}
function _scoreConTruncamiento(tokensQuery,textoCandidato){
  var tc=_tokensMaterial(textoCandidato);
  if(!tc.length)return 0;
  var hits=0;
  tc.forEach(function(t){
    if(tokensQuery.some(function(q){return _tokenCoincideConTruncamiento(t,q);}))hits++;
  });
  return hits/tc.length;
}
function costoSugeridoPorCruce(correctivo,ocHist,opts){
  opts=opts||{};
  var ventanaDias=opts.ventanaDias!=null?opts.ventanaDias:15;
  var umbral=opts.umbral!=null?opts.umbral:0.6;
  if(!correctivo||!correctivo.sigla||!correctivo.fecha)return[];
  var textoOT=[correctivo.sintoma,correctivo.solucion,correctivo.componente].filter(Boolean).join(' ');
  var tokensOT=_tokensMaterial(textoOT);
  if(!tokensOT.length)return[];
  var fechaOT=new Date(correctivo.fecha+'T00:00:00');
  var candidatos=[];
  (ocHist||[]).forEach(function(o){
    if(!o||o.sigla!==correctivo.sigla||!o.fecha||!(o.costo>0))return;
    var fechaOC=new Date(o.fecha+'T00:00:00');
    var diffDias=Math.round(Math.abs((fechaOC-fechaOT)/86400000));
    if(diffDias>ventanaDias)return;
    var score=_scoreConTruncamiento(tokensOT,o.detalle);
    if(score<umbral)return;
    candidatos.push({fecha:o.fecha,detalle:o.detalle,costo:o.costo,proveedor:o.proveedor||'',diffDias:diffDias,score:Math.round(score*100)/100});
  });
  return candidatos.sort(function(a,b){return b.score-a.score||a.diffDias-b.diffDias;});
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

// Adapta 'informesFalla' (tabla separada de Informes de Falla Catastrófica /
// Cambio de Componente Mayor, ver informes.js) a la misma forma que espera
// esFallaMTBF — mismo patrón que _otHistComoOt de arriba. Auditoría 2026-09:
// una falla catastrófica reportada por este formulario dedicado (el canal que
// alguien usa parado al lado de un equipo detenido, para el evento más grave)
// nunca se sumaba a 'ot'/'otHist', así que quedaba invisible para MTBF/
// Weibull/Pareto — el mismo tipo de bug ya corregido una vez para 'Fuera de
// Servicio' (ver esFallaMTBF, más arriba). Solo tipoEvento==='Falla
// Catastrófica' cuenta como falla real — 'Cambio Componente Mayor' es un
// reemplazo preventivo/planificado, no una falla, y no debe inflar el conteo.
function _informesFallaComoOt(informesFalla){
  return (informesFalla||[]).filter(function(i){return i&&i.sigla&&i.tipoEvento==='Falla Catastrófica';}).map(function(i){
    return{sigla:i.sigla,fecha:i.fecha,horom:i.horometroActual,tipo:'Correctivo',componente:i.componente,sintoma:i.descripcion,estadoOT:'Cerrada'};
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

// Cuántos equipos todavía no tienen 'criticidad' clasificada (dropdown Crítico/
// Esencial/General de Ficha Técnica, equipos.criticidad — solo-admin). Auditoría
// 2026-08-27 (ver comentario en pred.js, vista "dotacion"): en la base real de
// Besalco este campo estaba NULL para los 35 equipos, así que el único consumidor
// que sí lo usa (Backlog Inteligente, para pesar el impacto de una OT pendiente)
// no tenía ningún efecto real en la práctica. Esta cuenta es la fuente única para
// avisarle al admin que clasificarlos desbloquea esa priorización — mismo criterio
// que ya usa el Pareto de Modo de Falla con "Sin clasificar" (codFalla).
function equiposSinCriticidad(eq){
  return (eq||[]).filter(function(e){return e&&!e.criticidad;}).length;
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

// Pareto genérico (2026-09-11, generalizado desde el Pareto de Modo de Falla
// que ya vivía inline en modules/renders/estadistica.js, 2026-08-31): dada
// una lista YA agrupada (por modo de falla, equipo, componente, o cualquier
// otra agrupación con un campo numérico de conteo), la ordena descendente por
// ese campo y agrega el tratamiento Pareto completo: % del total, barra
// relativa al máximo, % acumulado, y la marca de "pocos vitales" (los
// primeros que juntos explican el 80% del total) — la regla básica de RCM
// para decidir dónde enfocar un plan de confiabilidad primero. No muta la
// lista de entrada. 'campo' por defecto 'fallas' (nombre ya usado en las 3
// vistas de Estadística que lo consumen: Equipo, Componente, Modo de Falla).
function paretoAcumulado(lista,campo){
  campo=campo||'fallas';
  var ordenada=(lista||[]).slice().sort(function(a,b){return (b[campo]||0)-(a[campo]||0);});
  var total=ordenada.reduce(function(s,r){return s+(r[campo]||0);},0);
  var max=ordenada.length?(ordenada[0][campo]||0):0;
  var acumPrev=0;
  return ordenada.map(function(r){
    var pct=total?Math.round(r[campo]/total*1000)/10:0;
    // "Pocos vitales": si el acumulado ANTES de esta fila ya llegó al 80%, esta
    // fila ya no es vital. La fila que recién cruza el 80% sí cuenta — es la
    // que empuja el total sobre el umbral.
    var vital=acumPrev<80;
    acumPrev+=pct;
    return Object.assign({},r,{
      pct:pct,
      acumulado:Math.round(acumPrev*10)/10,
      vital:vital,
      barPct:max?Math.round(r[campo]/max*100):0
    });
  });
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

// P(chi-cuadrado_df <= x) — CDF EXACTA (no una aproximación como
// Wilson-Hilferty) para grados de libertad PARES, vía la relación cerrada
// chi-cuadrado/Poisson: con df=2k (k entero), F(x)=1-Σ_{i=0}^{k-1}
// PoissonPMF(i, x/2). Reutiliza _poissonPMF (ya con log-factorial, sin
// desborde) en vez de implementar una función gamma aparte o una
// aproximación numérica de la normal — evita perder precisión justo en
// los grados de libertad bajos (2-4) que son el caso más común de esta
// flota (equipos con muy pocas fallas registradas). df SIEMPRE sale par
// acá (2r o 2r+2, ver intervaloConfianzaMTBF abajo), así que k=df/2 es
// siempre entero — no hace falta el caso general de df impar.
function _chiCuadradoCDF(x,df){
  var k=df/2;
  if(x<=0)return 0;
  var suma=0;
  for(var i=0;i<k;i++)suma+=_poissonPMF(i,x/2);
  return 1-suma;
}
// Cuantil de chi-cuadrado (inversa de _chiCuadradoCDF) por búsqueda
// binaria — la CDF de arriba es exacta y monótona creciente, así que la
// búsqueda binaria converge al mismo valor que una tabla de chi-cuadrado
// (verificado contra scipy.stats.chi2.ppf antes de escribir los tests:
// coincide a más de 10 decimales), sin necesitar ninguna aproximación.
function _chiCuadradoInv(p,df){
  if(p<=0)return 0;
  if(p>=1)return Infinity;
  var lo=0,hi=df+50*Math.sqrt(2*df)+50;
  for(var iter=0;iter<100;iter++){
    var mid=(lo+hi)/2;
    if(_chiCuadradoCDF(mid,df)<p)lo=mid;else hi=mid;
  }
  return (lo+hi)/2;
}
// ═══ INTERVALO DE CONFIANZA DEL MTBF ═══ — el MTBF (y todo lo que se
// deriva de él: Confiabilidad (R), Disp. Inherente) hoy se muestra como un
// número suelto, con la misma "seguridad" visual para un equipo con 2
// fallas que para uno con 50 — estadísticamente esos dos casos tienen
// incertidumbre MUY distinta (verificado con datos reales de la flota:
// CN-10155, 2 fallas, MTBF=430h pero IC95%=[77h,16984h] — el punto no
// significa casi nada con tan poca muestra; CN-5133, 53 fallas, MTBF=143h
// con IC95%=[109h,191h] — mucho más confiable). Método estándar de
// ingeniería de confiabilidad (NIST Engineering Statistics Handbook
// 8.1.5.2, ensayo terminado por tiempo): con r = intervalos entre fallas
// (n-1 fallas válidas) observados en un tiempo total T (= rango de
// horómetros), bajo el supuesto de tasa de falla constante (el mismo que
// ya usa confiabilidadReal/mtbfReal — proceso de renovación exponencial):
//   límite inferior = 2T / χ²(1-α/2; 2r+2)
//   límite superior = 2T / χ²(α/2; 2r)
// Mismo mínimo de datos y misma fuente cruda que C.mtbfReal (≥2 fallas
// válidas, mismos horómetros) — sin eso ni siquiera hay un MTBF que
// acompañar con un intervalo.
function intervaloConfianzaMTBF(horomFallas,confianza){
  confianza=(confianza>0&&confianza<1)?confianza:0.95;
  var validos=(horomFallas||[]).filter(function(h){return h>0;}).sort(function(a,b){return a-b;});
  if(validos.length<2)return null;
  var r=validos.length-1;
  var T=validos[validos.length-1]-validos[0];
  var mtbf=Math.round(T/r);
  var alpha=1-confianza;
  var chiInf=_chiCuadradoInv(1-alpha/2,2*r+2);
  var chiSup=_chiCuadradoInv(alpha/2,2*r);
  return{
    mtbf:mtbf,r:r,
    inferior:chiInf>0?Math.round(2*T/chiInf):0,
    superior:chiSup>0?Math.round(2*T/chiSup):null,
    confianza:confianza
  };
}

// Aproximación racional de Acklam (2003) para el cuantil de la normal
// estándar (inversa de la CDF) — error relativo <1.15e-9. No hay forma
// cerrada de la inversa de la normal (a diferencia del chi-cuadrado de
// arriba, que sí la tiene vía Poisson porque sus grados de libertad
// siempre salen pares): toda implementación real usa una aproximación
// numérica como esta, la misma familia de algoritmo que usan R y SciPy
// como fallback. Verificado contra scipy.stats.norm.ppf antes de escribir
// los tests: coincide a 7-9 cifras significativas.
function _normInv(p){
  if(p<=0)return -Infinity;
  if(p>=1)return Infinity;
  var a=[-3.969683028665376e+01,2.209460984245205e+02,-2.759285104469687e+02,1.383577518672690e+02,-3.066479806614716e+01,2.506628277459239e+00];
  var b=[-5.447609879822406e+01,1.615858368580409e+02,-1.556989798598866e+02,6.680131188771972e+01,-1.328068155288572e+01];
  var c=[-7.784894002430293e-03,-3.223964580411365e-01,-2.400758277161838e+00,-2.549732539343734e+00,4.374664141464968e+00,2.938163982698783e+00];
  var d=[7.784695709041462e-03,3.224671290700398e-01,2.445134137142996e+00,3.754408661907416e+00];
  var plow=0.02425,phigh=1-plow,q,r;
  if(p<plow){
    q=Math.sqrt(-2*Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }else if(p<=phigh){
    q=p-0.5;r=q*q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  }else{
    q=Math.sqrt(-2*Math.log(1-p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
}
// ═══ ERROR ESTÁNDAR / INTERVALO DE CONFIANZA DEL MTTR ═══ — el MTTR
// (tiempo promedio de reparación, Stock & Insumos → Costos → MTBF/MTTR) se
// mostraba como un promedio puro, sin ningún indicador de cuán preciso es
// — un MTTR de "4h" con 2 reparaciones no es igual de confiable que uno de
// "4h" con 40. Método de libro para el promedio de una muestra (a
// diferencia del MTBF, que es un CONTEO de fallas por unidad de tiempo —
// proceso de Poisson/exponencial — el MTTR es un promedio de duraciones
// individuales, el caso clásico de Error Estándar de la media):
//   SE = s/√n  (s = desviación estándar muestral, n = reparaciones con
//   duración registrada)
//   IC = media ± z(1-α/2)·SE
// Es una aproximación NORMAL (usa el cuantil z, no t de Student) — válida
// para muestras razonablemente grandes; con muestras muy chicas (<5,
// mismo umbral que ya usa ajusteWeibull/el aviso de IC del MTBF) la
// cobertura real es algo menor a la nominal, así que la UI (cos.js) lo
// marca visualmente en vez de mostrar una falsa precisión. Recibe el mismo
// input crudo que C.mttrReal (array de 'duracion', formato "Xh"), mismo
// mínimo de 2 reparaciones con dato — sin eso ni una desviación estándar
// se puede calcular.
function errorEstandarMTTR(duraciones,confianza){
  confianza=(confianza>0&&confianza<1)?confianza:0.95;
  var horas=(duraciones||[]).filter(function(d){return d&&d!=='—';}).map(function(d){
    var m=String(d).match(/(\d+)h/);
    return m?parseInt(m[1],10):null;
  }).filter(function(h){return h!=null;});
  var n=horas.length;
  if(n<2)return null;
  var media=horas.reduce(function(s,h){return s+h;},0)/n;
  var sumSqDesv=horas.reduce(function(s,h){return s+Math.pow(h-media,2);},0);
  var desvEst=Math.sqrt(sumSqDesv/(n-1));
  var se=desvEst/Math.sqrt(n);
  var alpha=1-confianza;
  var z=_normInv(1-alpha/2);
  return{
    media:Math.round(media*10)/10,n:n,se:Math.round(se*100)/100,
    inferior:Math.max(0,Math.round((media-z*se)*10)/10),
    superior:Math.round((media+z*se)*10)/10,
    confianza:confianza
  };
}

// ═══ INTERVALO DE CONFIANZA DE WILSON PARA UNA PROPORCIÓN (2026-09-21) ═══
// intervaloConfianzaMTBF/errorEstandarMTTR (arriba) ya dejaron de mostrar
// tasas y promedios sin margen de error — pero los PORCENTAJES del sistema
// ("% documentado", "% reingreso", etc., ver _estTablaTecnico en
// estadistica.js) siguen siendo un número puntual. Con muestra chica (el
// mínimo actual es n=15), un 80% observado puede en realidad estar entre
// 55% y 93% — una diferencia enorme que hoy no se ve.
//
// Wilson (1927) es el intervalo de confianza estándar para una proporción
// — mejor que la aproximación normal simple (Wald) para n chico o p cerca
// de 0%/100%, donde Wald puede dar límites fuera de [0,1] o ser demasiado
// angosto (recomendado sobre Wald por Agresti & Coull 1998):
//   centro = (p̂ + z²/(2n)) / (1 + z²/n)
//   margen = z·√(p̂(1−p̂)/n + z²/(4n²)) / (1 + z²/n)
// Verificado contra statsmodels.stats.proportion.proportion_confint
// (method='wilson') en 6 casos, incluidos los extremos p=0% y p=100% con
// n=15 (donde Wald se rompe): coincide a 4 decimales en todos.
function wilsonIC95(x,n){
  if(!(n>0)||x==null||x<0||x>n)return null;
  var z=1.96;
  var pHat=x/n;
  var denom=1+(z*z)/n;
  var centro=(pHat+(z*z)/(2*n))/denom;
  var margen=z*Math.sqrt(pHat*(1-pHat)/n+(z*z)/(4*n*n))/denom;
  return{
    pct:Math.round(pHat*1000)/10,
    lo:Math.round(Math.max(0,centro-margen)*1000)/10,
    hi:Math.round(Math.min(1,centro+margen)*1000)/10
  };
}

// ═══ MANN-KENDALL + PENDIENTE DE SEN — TENDENCIA MONOTÓNICA (2026-09-21) ═══
// "Tendencia Disponibilidad — Últimos 6 Meses" (Dashboard) hoy es solo un
// gráfico de barras con el promedio mensual — sin ningún veredicto sobre
// si esa tendencia es real o es ruido normal mes a mes. Con solo 6 puntos,
// una barra más alta al final puede ser una mejora real o pura casualidad.
//
// Mann-Kendall (Mann 1945/Kendall 1975) es el test no paramétrico estándar
// para tendencia monotónica en series de tiempo cortas — no asume que la
// tendencia sea lineal (a diferencia de una regresión) ni que los datos
// sean normales, solo mira el signo de cada comparación par a par, por eso
// es robusto con pocos puntos y ante un mes atípico:
//   S = Σᵢ<ⱼ sign(xⱼ−xᵢ)
//   Var(S) = [n(n−1)(2n+5) − Σt(t−1)(2t+5)] / 18   (corrección por
//                                                     empates, Gilbert 1987)
//   Z = (S∓1) / √Var(S)
// La pendiente de Sen es la MEDIANA de todas las pendientes par a par
// (xⱼ−xᵢ)/(j−i) — estimador robusto de cuánto cambia por período, no
// distorsionado por un outlier (a diferencia de la pendiente de una
// regresión de mínimos cuadrados).
//
// Verificado contra la librería pymannkendall (original_test) en 3 series
// (creciente, ruido, con empates): S, Var(S), Z y pendiente de Sen
// coinciden EXACTAMENTE en los tres casos.
function mannKendallTendencia(valores){
  var v=(valores||[]).filter(function(x){return x!=null&&isFinite(x);});
  var n=v.length;
  if(n<4)return null;
  var S=0;
  for(var i=0;i<n;i++){
    for(var j=i+1;j<n;j++){
      var d=v[j]-v[i];
      S+=d>0?1:d<0?-1:0;
    }
  }
  var conteos={};
  v.forEach(function(x){conteos[x]=(conteos[x]||0)+1;});
  var terminoEmpates=Object.keys(conteos).reduce(function(s,k){
    var t=conteos[k];
    return t>1?s+t*(t-1)*(2*t+5):s;
  },0);
  var varS=(n*(n-1)*(2*n+5)-terminoEmpates)/18;
  var z=0;
  if(varS>0){
    if(S>0)z=(S-1)/Math.sqrt(varS);
    else if(S<0)z=(S+1)/Math.sqrt(varS);
  }
  var pendientes=[];
  for(var i2=0;i2<n;i2++){
    for(var j2=i2+1;j2<n;j2++)pendientes.push((v[j2]-v[i2])/(j2-i2));
  }
  pendientes.sort(function(a,b){return a-b;});
  var m=pendientes.length;
  var senSlope=m%2?pendientes[(m-1)/2]:(pendientes[m/2-1]+pendientes[m/2])/2;
  var significativo=Math.abs(z)>1.96;
  return{
    n:n,S:S,varS:Math.round(varS*100)/100,z:Math.round(z*100)/100,
    senSlope:Math.round(senSlope*1000)/1000,
    significativo:significativo,
    tendencia:!significativo?'sin_certeza':(senSlope>0?'mejorando':'empeorando')
  };
}

// ═══ BONDAD DE AJUSTE (R²) DE UNA REGRESIÓN LINEAL SIMPLE ═══ — la
// proyección de desgaste de neumáticos (neuProyeccion, index.html) ajusta
// una recta a las últimas mediciones de remanente y proyecta cuándo se
// cambia, pero el campo 'confianza' que ya mostraba solo contaba CUÁNTAS
// mediciones había (3+ = "Alta") sin mirar si esa recta realmente ajusta
// bien — un neumático con 3 mediciones muy dispersas pasaba como "Alta
// confianza" solo por el número. R² mide qué tan bien explica la recta
// los datos reales: R²=1-SSE/SST, con SSE=Σ(y-ŷ)² (error del modelo) y
// SST=Σ(y-ȳ)² (varianza total de los datos) — fórmula de libro, sin
// aproximación. Recibe los mismos puntos {x,y} que ya arma neuProyeccion
// para su propio ajuste — no repite el cálculo, solo lo evalúa. null con
// menos de 2 puntos válidos o si todos los x son iguales (no hay
// pendiente que ajustar, caso degenerado).
function r2RegresionLineal(pts){
  var validos=(pts||[]).filter(function(p){return p&&p.y!=null&&isFinite(p.x)&&isFinite(p.y);});
  var n=validos.length;
  if(n<2)return null;
  var sx=0,sy=0,sxy=0,sx2=0;
  validos.forEach(function(p){sx+=p.x;sy+=p.y;sxy+=p.x*p.y;sx2+=p.x*p.x;});
  var denom=n*sx2-sx*sx;
  if(denom===0)return null;
  var pendiente=(n*sxy-sx*sy)/denom;
  var intercepto=(sy-pendiente*sx)/n;
  var media=sy/n;
  var sse=0,sst=0;
  validos.forEach(function(p){
    var yPred=intercepto+pendiente*p.x;
    sse+=Math.pow(p.y-yPred,2);
    sst+=Math.pow(p.y-media,2);
  });
  var r2=sst===0?1:1-sse/sst;
  return{pendiente:pendiente,intercepto:intercepto,r2:Math.round(Math.max(0,Math.min(1,r2))*1000)/1000,n:n};
}

// ═══ ANOVA DE UN FACTOR — ¿el promedio real difiere entre grupos (ej.
// MTTR por técnico), o es ruido de muestra chica? (2026-09-20) ═══
// Hoy las comparativas "por técnico" (tecnicosAltoReingreso,
// tecnicosBajaDocumentacion, la tabla Por Técnico de Estadística) solo
// muestran porcentajes/promedios crudos, sin ningún test de significancia
// — dos técnicos con 15 y 6 reparaciones podían verse "distintos" en la
// tabla aunque la diferencia fuera puro ruido de muestra. ANOVA de un
// factor responde eso: parte la varianza TOTAL de los datos en varianza
// ENTRE grupos (¿cuánto varían los promedios de cada técnico entre sí?) y
// varianza DENTRO de cada grupo (¿cuánto varía cada técnico contra su
// propio promedio?) — si la de ENTRE es mucho más grande que la de DENTRO
// (estadístico F alto), la diferencia entre técnicos es real, no ruido.
//
// _logGamma/_betaContinuaFraccion/_betaIncompletaRegularizada: el p-valor
// exacto de F requiere la función beta incompleta regularizada
// (relación estándar entre la distribución F y la Beta — ver cualquier
// texto de estadística). No hay una fórmula cerrada simple, así que se usa
// el algoritmo estándar de fracción continua (Numerical Recipes, Lentz),
// el mismo tipo de método numérico ya usado en esta sesión para _normInv
// — verificado independientemente contra scipy.stats.f.sf a >9 dígitos
// significativos antes de integrarse (ver tests).
function _logGamma(xx){
  var cof=[76.18009172947146,-86.50532032941677,24.01409824083091,-1.231739572450155,0.1208650973866179e-2,-0.5395239384953e-5];
  var x=xx,y=xx;
  var tmp=x+5.5;
  tmp-=(x+0.5)*Math.log(tmp);
  var ser=1.000000000190015;
  for(var j=0;j<=5;j++){y+=1;ser+=cof[j]/y;}
  return -tmp+Math.log(2.5066282746310005*ser/x);
}
function _betaContinuaFraccion(a,b,x){
  var MAXIT=200,EPS=3e-9,FPMIN=1e-300;
  var qab=a+b,qap=a+1,qam=a-1;
  var c=1;
  var d=1-qab*x/qap;
  if(Math.abs(d)<FPMIN)d=FPMIN;
  d=1/d;
  var h=d;
  for(var m=1;m<=MAXIT;m++){
    var m2=2*m;
    var aa=m*(b-m)*x/((qam+m2)*(a+m2));
    d=1+aa*d; if(Math.abs(d)<FPMIN)d=FPMIN;
    c=1+aa/c; if(Math.abs(c)<FPMIN)c=FPMIN;
    d=1/d;
    h*=d*c;
    aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));
    d=1+aa*d; if(Math.abs(d)<FPMIN)d=FPMIN;
    c=1+aa/c; if(Math.abs(c)<FPMIN)c=FPMIN;
    d=1/d;
    var del=d*c;
    h*=del;
    if(Math.abs(del-1)<EPS)break;
  }
  return h;
}
function _betaIncompletaRegularizada(x,a,b){
  if(x<0||x>1)return null;
  var bt;
  if(x===0||x===1){bt=0;}
  else{bt=Math.exp(_logGamma(a+b)-_logGamma(a)-_logGamma(b)+a*Math.log(x)+b*Math.log(1-x));}
  if(x<(a+1)/(a+b+2)){
    return bt*_betaContinuaFraccion(a,b,x)/a;
  }else{
    return 1-bt*_betaContinuaFraccion(b,a,1-x)/b;
  }
}
// p-valor de cola superior de F(d1,d2) evaluado en f — ver derivación en
// el comentario de arriba (relación F↔Beta incompleta regularizada).
function _pValorF(f,d1,d2){
  if(f<=0)return 1;
  var x=d2/(d2+d1*f);
  return _betaIncompletaRegularizada(x,d2/2,d1/2);
}
// Carta de control I-MR (Individuos y Rango Móvil) — Control Estadístico de
// Procesos (SPC) clásico para series de un solo valor por período (costo
// mensual, MTBF mensual, etc: no hay subgrupos, un dato por mes). Detecta
// el mes exacto en que un valor sale del comportamiento normal del
// proceso, distinto de un outlier puntual (comparación contra la mediana,
// ver ordenesSinOutliers/aceiteOutliers) o una tendencia lenta sostenida
// (CUSUM): acá el límite es fijo, calculado sobre TODA la serie.
// Constantes 2.66 (=3/d2, d2=1.128 tabulado para n=2) y 3.267 son las
// constantes estándar de Shewhart para cartas Individuos/Rango Móvil, no
// inventadas (Wikipedia "Shewhart individuals control chart", Quality
// Gurus, Six Sigma DSI). 'puntos': [{periodo:'YYYY-MM', valor:número}].
// Mínimo 6 puntos (mismo espíritu que el resto de los umbrales mínimos de
// esta sesión): con menos, ni la media ni el rango móvil promedio son una
// base confiable para fijar un límite.
function cartaControlIMR(puntos){
  var validos=(puntos||[]).filter(function(p){return p&&p.periodo&&p.valor!=null&&!isNaN(p.valor);})
    .slice().sort(function(a,b){return a.periodo<b.periodo?-1:a.periodo>b.periodo?1:0;});
  if(validos.length<6)return null;
  var valores=validos.map(function(p){return p.valor;});
  var n=valores.length;
  var xBarra=valores.reduce(function(s,v){return s+v;},0)/n;
  var rangosMoviles=[];
  for(var i=1;i<n;i++)rangosMoviles.push(Math.abs(valores[i]-valores[i-1]));
  var mrBarra=rangosMoviles.reduce(function(s,v){return s+v;},0)/rangosMoviles.length;
  var UCL=xBarra+2.66*mrBarra;
  var LCL=xBarra-2.66*mrBarra;
  var UCL_MR=3.267*mrBarra;
  var detalle=validos.map(function(p,i){
    var mr=i===0?null:Math.abs(valores[i]-valores[i-1]);
    return{
      periodo:p.periodo,
      valor:p.valor,
      fueraControl:p.valor>UCL||p.valor<LCL,
      rangoMovilFueraControl:mr!=null&&mr>UCL_MR
    };
  });
  return{
    n:n,
    xBarra:Math.round(xBarra*100)/100,
    mrBarra:Math.round(mrBarra*100)/100,
    UCL:Math.round(UCL*100)/100,
    LCL:Math.round(LCL*100)/100,
    UCL_MR:Math.round(UCL_MR*100)/100,
    detalle:detalle,
    puntosFueraControl:detalle.filter(function(p){return p.fueraControl;}).length
  };
}

// ═══ CARTA DE CONTROL EWMA (2026-09-20) ═══
// cartaControlIMR (arriba) es una carta Shewhart clásica: muy buena para
// detectar un salto grande en un solo mes, pero estadísticamente poco
// sensible a una DERIVA lenta y sostenida (el costo subiendo de a poco,
// mes tras mes, sin que ningún mes individual cruce el límite) — hueco
// bien documentado en control estadístico de procesos (Montgomery,
// "Introduction to Statistical Quality Control"): las cartas Shewhart y
// las cartas "con memoria" (EWMA/CUSUM) son complementarias, no
// intercambiables — mismo motivo por el que ya existe CUSUM para aceite,
// pero nunca para costos.
//
// Z_i = λ·X_i + (1−λ)·Z_(i−1), Z_0 = x̄. Límites EXACTOS en el punto i
// (no la versión asintótica simplificada, que es demasiado angosta al
// principio de la serie):
//   x̄ ± L·σ̂·√[(λ/(2−λ))·(1−(1−λ)^(2i))]
// λ=0.2 y L=3 son los valores estándar de la literatura (Lucas &
// Saccucci 1990) — no elegidos a mano. σ̂=MR̄/1.128 reusa EXACTAMENTE la
// misma estimación de sigma que ya usa cartaControlIMR, sobre la misma
// serie — nunca se inventa una varianza nueva.
//
// Verificado en Python: los límites calculados en cada punto i coinciden
// con la fórmula exacta de Montgomery, incluida la forma asintótica
// (el ancho converge a σ̂·√(λ/(2−λ)) cuando i crece).
function cartaControlEWMA(puntos,lambda,L){
  var lam=(lambda>0&&lambda<=1)?lambda:0.2;
  var Lm=L>0?L:3;
  var validos=(puntos||[]).filter(function(p){return p&&p.periodo&&p.valor!=null&&!isNaN(p.valor);})
    .slice().sort(function(a,b){return a.periodo<b.periodo?-1:a.periodo>b.periodo?1:0;});
  if(validos.length<6)return null;
  var valores=validos.map(function(p){return p.valor;});
  var n=valores.length;
  var xBarra=valores.reduce(function(s,v){return s+v;},0)/n;
  var rangosMoviles=[];
  for(var i=1;i<n;i++)rangosMoviles.push(Math.abs(valores[i]-valores[i-1]));
  var mrBarra=rangosMoviles.reduce(function(s,v){return s+v;},0)/rangosMoviles.length;
  var sigma=mrBarra/1.128;
  var z=xBarra;
  var detalle=validos.map(function(p,idx){
    var i=idx+1;
    z=lam*valores[idx]+(1-lam)*z;
    var varFactor=(lam/(2-lam))*(1-Math.pow(1-lam,2*i));
    var ancho=Lm*sigma*Math.sqrt(varFactor);
    var ucl=xBarra+ancho,lcl=xBarra-ancho;
    return{
      periodo:p.periodo,valor:p.valor,
      z:Math.round(z*100)/100,
      UCL:Math.round(ucl*100)/100,LCL:Math.round(lcl*100)/100,
      fueraControl:z>ucl||z<lcl
    };
  });
  return{
    n:n,xBarra:Math.round(xBarra*100)/100,sigma:Math.round(sigma*100)/100,
    lambda:lam,L:Lm,
    detalle:detalle,
    puntosFueraControl:detalle.filter(function(d){return d.fueraControl;}).length
  };
}

// ═══ MANN-WHITNEY U — ¿DOS MUESTRAS SON REALMENTE DISTINTAS? (2026-09-20) ═══
// indiceEfectividadMantenimiento (más abajo) compara la mediana de
// intervalos ANTES/DESPUÉS de un PM con un RATIO arbitrario (≥1.2 =
// "efectivo") — sin ningún test estadístico atrás, el mismo hueco que
// anovaUnFactor cerró para promedios de MTTR y logRankTest para curvas de
// supervivencia. Mann-Whitney U es el test no-paramétrico estándar para
// comparar dos muestras INDEPENDIENTES sin asumir que los datos son
// normales (los intervalos de mantenimiento casi nunca lo son) y sin
// censura (a diferencia de logRankTest) — cualquier libro de estadística
// no-paramétrica. Se juntan y ordenan ambas muestras, se les asigna un
// rango (promediando empates), U = R_A − n_A(n_A+1)/2, con σ_U corregido
// por empates. Verificado independientemente contra scipy.stats.
// mannwhitneyu (además de la fórmula de fuentes): coincide con el
// estadístico U y el p-valor exacto a 6 decimales en 3 casos, incluido
// uno con empates. Mínimo 5 observaciones por muestra (mismo umbral que
// el resto del archivo).
function mannWhitneyU(muestraA,muestraB){
  var a=(muestraA||[]).filter(function(v){return v!=null&&!isNaN(v);});
  var b=(muestraB||[]).filter(function(v){return v!=null&&!isNaN(v);});
  if(a.length<5||b.length<5)return null;
  var combinado=a.map(function(v){return{valor:v,grupo:'A'};})
    .concat(b.map(function(v){return{valor:v,grupo:'B'};}))
    .sort(function(x,y){return x.valor-y.valor;});
  var n=combinado.length;
  var i=0;
  while(i<n){
    var j=i;
    while(j+1<n&&combinado[j+1].valor===combinado[i].valor)j++;
    var rangoProm=(i+1+j+1)/2;
    for(var k=i;k<=j;k++)combinado[k].rango=rangoProm;
    i=j+1;
  }
  var rA=combinado.reduce(function(s,x){return x.grupo==='A'?s+x.rango:s;},0);
  var nA=a.length,nB=b.length;
  var uA=rA-nA*(nA+1)/2;
  var uB=nA*nB-uA;
  var u=Math.min(uA,uB);
  var meanU=nA*nB/2;
  var conteos={};
  combinado.forEach(function(x){conteos[x.valor]=(conteos[x.valor]||0)+1;});
  var tieSum=Object.keys(conteos).reduce(function(s,v){var t=conteos[v];return s+(t*t*t-t);},0);
  var sigmaU=Math.sqrt((nA*nB/12)*((n+1)-tieSum/(n*(n-1))));
  if(!(sigmaU>0))return null;
  var z=(u-meanU)/sigmaU;
  return{
    u:u,uA:uA,uB:uB,
    z:Math.round(z*100)/100,
    nA:nA,nB:nB,
    significativo:Math.abs(z)>1.96,
    medianaA:medianaPositiva(a),
    medianaB:medianaPositiva(b)
  };
}
// 'grupos': objeto {nombreGrupo:[valores numéricos...]} (ej. horas de MTTR
// por técnico, ya agrupadas por quien llama). minPorGrupo (default 5,
// mismo umbral ya usado para IC del MTBF/MTTR esta sesión): un grupo con
// menos observaciones se descarta ANTES del test — no se inventa
// significancia sobre una muestra insuficiente para siquiera estimar bien
// su propio promedio. Necesita al menos 2 grupos válidos para comparar.
function anovaUnFactor(grupos,minPorGrupo){
  var min=minPorGrupo||5;
  var nombres=Object.keys(grupos||{}).filter(function(g){
    var v=(grupos[g]||[]).filter(function(x){return x!=null&&isFinite(x);});
    return v.length>=min;
  });
  if(nombres.length<2)return null;
  var datosPorGrupo=nombres.map(function(g){return(grupos[g]||[]).filter(function(x){return x!=null&&isFinite(x);});});
  var todos=[];
  datosPorGrupo.forEach(function(d){todos=todos.concat(d);});
  var N=todos.length;
  var mediaGeneral=todos.reduce(function(s,x){return s+x;},0)/N;
  var k=nombres.length;
  var ssEntre=0,ssDentro=0;
  var gruposInfo=nombres.map(function(g,i){
    var d=datosPorGrupo[i];
    var n=d.length;
    var media=d.reduce(function(s,x){return s+x;},0)/n;
    ssEntre+=n*Math.pow(media-mediaGeneral,2);
    var sumSqDentro=d.reduce(function(s,x){return s+Math.pow(x-media,2);},0);
    ssDentro+=sumSqDentro;
    var desvEst=n>1?Math.sqrt(sumSqDentro/(n-1)):0;
    return{grupo:g,n:n,media:Math.round(media*100)/100,desvEst:Math.round(desvEst*100)/100};
  });
  var glEntre=k-1,glDentro=N-k;
  if(glDentro<1)return null;
  var msEntre=ssEntre/glEntre;
  var msDentro=ssDentro/glDentro;
  var F=msDentro>0?msEntre/msDentro:(msEntre>0?Infinity:0);
  var pValor=isFinite(F)?_pValorF(F,glEntre,glDentro):0;
  return{
    grupos:gruposInfo.sort(function(a,b){return b.media-a.media;}),
    k:k,N:N,
    ssEntre:Math.round(ssEntre*100)/100,ssDentro:Math.round(ssDentro*100)/100,
    glEntre:glEntre,glDentro:glDentro,
    msEntre:Math.round(msEntre*100)/100,msDentro:Math.round(msDentro*100)/100,
    F:Math.round(F*1000)/1000,
    pValor:pValor,
    significativo:pValor<0.05
  };
}

// ═══ KRUSKAL-WALLIS H — ANOVA NO PARAMÉTRICO (2026-09-20) ═══
// anovaUnFactor (arriba) compara duraciones de reparación por técnico
// asumiendo que los residuos son normales — pero el propio sistema ya
// documentó (analisisMTTRLogNormal) que los tiempos de reparación reales
// casi nunca son simétricos: la mayoría son rápidos y unos pocos se
// alargan mucho, sesgando la distribución hacia la derecha (log-normal),
// no normal. Kruskal-Wallis es el equivalente no paramétrico de ANOVA de
// un factor — compara los grupos por RANGOS, no por la media directa, sin
// asumir normalidad — mismo principio que Mann-Whitney U (arriba, ya usado
// en Efectividad del Mantenimiento) pero para más de 2 grupos.
//
// H = (12/(N(N+1))) × Σ(R_i²/n_i) − 3(N+1), con corrección por empates
// (rangos promedio en valores repetidos, mismo criterio que mannWhitneyU):
// H_corregido = H / (1 − Σ(t_j³−t_j)/(N³−N)).
// Bajo H0, H sigue aproximadamente una chi-cuadrado con k−1 grados de
// libertad — reusa DIRECTAMENTE la misma tabla _CHI2_CRITICO_95 ya
// existente (nunca se inventa un umbral nuevo).
//
// Verificado contra scipy.stats.kruskal, con y sin empates (valores
// redondeados a enteros, como puede pasar con horas de reparación
// tipeadas): coincide a 3+ decimales en ambos casos.
function kruskalWallis(grupos,minPorGrupo){
  var min=minPorGrupo||5;
  var nombres=Object.keys(grupos||{}).filter(function(g){
    var v=(grupos[g]||[]).filter(function(x){return x!=null&&isFinite(x);});
    return v.length>=min;
  });
  if(nombres.length<2)return null;
  var datosPorGrupo=nombres.map(function(g){return(grupos[g]||[]).filter(function(x){return x!=null&&isFinite(x);});});
  var combinado=[];
  datosPorGrupo.forEach(function(d,i){d.forEach(function(v){combinado.push({v:v,g:i});});});
  var N=combinado.length;
  combinado.sort(function(a,b){return a.v-b.v;});
  var rangos=new Array(N);
  var gruposEmpate=[];
  var i=0;
  while(i<N){
    var j=i;
    while(j+1<N&&combinado[j+1].v===combinado[i].v)j++;
    var rangoProm=(i+1+j+1)/2;
    for(var m=i;m<=j;m++)rangos[m]=rangoProm;
    if(j>i)gruposEmpate.push(j-i+1);
    i=j+1;
  }
  var sumaRangoPorGrupo=new Array(nombres.length).fill(0);
  combinado.forEach(function(item,idx){sumaRangoPorGrupo[item.g]+=rangos[idx];});
  var H=0;
  nombres.forEach(function(g,idx){
    var n=datosPorGrupo[idx].length;
    H+=(sumaRangoPorGrupo[idx]*sumaRangoPorGrupo[idx])/n;
  });
  H=(12/(N*(N+1)))*H-3*(N+1);
  var sumaEmpateCorr=gruposEmpate.reduce(function(s,t){return s+(t*t*t-t);},0);
  var factorCorr=1-sumaEmpateCorr/(N*N*N-N);
  if(factorCorr>0)H=H/factorCorr;
  var k=nombres.length;
  var gl=k-1;
  var critico=_CHI2_CRITICO_95[gl];
  if(critico==null)return null;
  var gruposInfo=nombres.map(function(g,idx){
    var d=datosPorGrupo[idx];
    return{grupo:g,n:d.length,mediana:medianaPositiva(d),sumaRangos:Math.round(sumaRangoPorGrupo[idx]*100)/100};
  });
  return{
    grupos:gruposInfo.sort(function(a,b){return a.mediana-b.mediana;}),
    k:k,N:N,H:Math.round(H*1000)/1000,gl:gl,critico:critico,
    significativo:H>critico
  };
}

// ═══ TEST DE LEVENE (BROWN-FORSYTHE) — VARIABILIDAD ENTRE GRUPOS (2026-09-21) ═══
// anovaUnFactor/kruskalWallis (arriba) responden "¿el MTTR promedio/mediana
// difiere entre técnicos?" — pero ninguno de los dos dice si un técnico es
// INCONSISTENTE (a veces muy rápido, a veces muy lento) frente a otro que
// simplemente es uniformemente más lento. Son problemas operativos
// distintos: uno pide supervisión/estandarización, el otro capacitación o
// reasignación. Levene prueba si la VARIABILIDAD (no el centro) difiere
// entre grupos.
//
// Variante Brown-Forsythe (centrada en la mediana, no en la media) —
// la versión robusta recomendada cuando los datos no son normales, que es
// justo el caso ya documentado del MTTR (analisisMTTRLogNormal):
//   Z_ij = |X_ij − mediana_i|
//   W = [(N−k)/(k−1)] × [Σnᵢ(Z̄ᵢ−Z̄)²] / [ΣΣ(Z_ij−Z̄ᵢ)²]
// Bajo H0, W sigue una F(k−1, N−k) — reusa DIRECTAMENTE _pValorF, la misma
// función que ya usa anovaUnFactor, sin inventar una distribución nueva.
// medianaPositiva (ya existente) centra cada grupo.
//
// Verificado contra scipy.stats.levene(center='median'): W=17.0832
// idéntico, p coincide a 6 decimales.
function levenePruebaVarianzas(grupos,minPorGrupo){
  var min=minPorGrupo||5;
  var nombres=Object.keys(grupos||{}).filter(function(g){
    var v=(grupos[g]||[]).filter(function(x){return x!=null&&isFinite(x)&&x>0;});
    return v.length>=min;
  });
  if(nombres.length<2)return null;
  var datosPorGrupo=nombres.map(function(g){return(grupos[g]||[]).filter(function(x){return x!=null&&isFinite(x)&&x>0;});});
  var zPorGrupo=datosPorGrupo.map(function(d){
    var med=medianaPositiva(d);
    return d.map(function(x){return Math.abs(x-med);});
  });
  var N=0,k=nombres.length,todosZ=[];
  zPorGrupo.forEach(function(z){N+=z.length;todosZ=todosZ.concat(z);});
  var granMediaZ=todosZ.reduce(function(s,v){return s+v;},0)/N;
  var ssEntre=0,ssDentro=0;
  var gruposInfo=nombres.map(function(g,i){
    var z=zPorGrupo[i];
    var n=z.length;
    var mediaZ=z.reduce(function(s,v){return s+v;},0)/n;
    ssEntre+=n*Math.pow(mediaZ-granMediaZ,2);
    var sumSqDentro=z.reduce(function(s,v){return s+Math.pow(v-mediaZ,2);},0);
    ssDentro+=sumSqDentro;
    return{grupo:g,n:n,mediana:medianaPositiva(datosPorGrupo[i]),desvAbsMediana:Math.round(mediaZ*100)/100};
  });
  var glEntre=k-1,glDentro=N-k;
  if(glDentro<1)return null;
  var msEntre=ssEntre/glEntre;
  var msDentro=ssDentro/glDentro;
  var W=msDentro>0?msEntre/msDentro:(msEntre>0?Infinity:0);
  var pValor=isFinite(W)?_pValorF(W,glEntre,glDentro):0;
  return{
    grupos:gruposInfo.sort(function(a,b){return b.desvAbsMediana-a.desvAbsMediana;}),
    k:k,N:N,glEntre:glEntre,glDentro:glDentro,
    W:Math.round(W*1000)/1000,
    pValor:pValor,
    significativo:pValor<0.05
  };
}

// ═══ AJUSTE WEIBULL — reemplaza el supuesto de tasa de falla CONSTANTE de
// confiabilidadReal (de arriba) por la forma real de falla de CADA equipo,
// estimada de sus propios intervalos entre fallas (2026-09-11, pedido del
// usuario tras comparar los 4 roles de una infografía de datos: "el
// Científico de Datos vería que esto asume una fórmula de libro, no un
// modelo ajustado a los datos reales").
//
// Método: regresión de rango mediano sobre el gráfico de probabilidad
// Weibull (el método estándar de análisis de confiabilidad cuando se hace
// a mano/sin librería estadística — el mismo que enseña cualquier curso de
// RCM/Weibull++): se linealiza la función de distribución acumulada Weibull
// con el cambio de variable x=ln(t), y=ln(-ln(1-F)), y el rango mediano F_i
// de cada intervalo ordenado se aproxima con la fórmula de Bernard
// F_i=(i-0.3)/(n+0.4). Una regresión lineal simple sobre (x,y) da la
// pendiente (β, el parámetro de FORMA) y la ordenada al origen (de la que
// sale η, el parámetro de ESCALA). β=1 recupera la exponencial de siempre
// (tasa de falla constante); β<1 = fallas tempranas/infantiles (la tasa de
// falla BAJA con el uso); β>1 = desgaste (la tasa de falla SUBE con el
// uso) — información que confiabilidadReal no puede dar porque asume β=1
// de entrada, nunca lo mide.
//
// Los intervalos son las diferencias entre horómetros de fallas SUCESIVAS
// (mismo dato crudo que ya usa mtbfReal) — no los horómetros en sí. Se
// asume que el equipo queda "como nuevo" después de cada reparación (el
// mismo supuesto de proceso de renovación que ya usa implícitamente
// mtbfReal/confiabilidadReal, no uno nuevo). Mínimo 5 intervalos (6 fallas)
// — más exigente que mtbfReal (2 fallas): acá se ajusta una recta a los
// datos, no se promedia, y con pocos puntos la pendiente ajustada es puro
// ruido, no una forma real. Devuelve null si no hay suficiente historial —
// nunca se inventa una forma de falla sin datos para sostenerla.
// Núcleo del ajuste — regresión de rango mediano sobre una MUESTRA ya
// preparada (no sabe si son intervalos entre fallas o vidas completas,
// eso lo decide quien llama). Compartido por ajusteWeibull (abajo, para
// equipos que fallan varias veces) y ajusteWeibullVidas (para poblaciones
// de unidades distintas — ver comentario de esa función). Extraído acá
// 2026-09-12 al agregar el segundo caso de uso, para no duplicar la
// regresión — el criterio de "≥5 datos" y el resto de la matemática es
// idéntico en ambos casos, solo cambia qué números se le pasan.
function _ajusteWeibullDeMuestra(muestra){
  var validos=(muestra||[]).filter(function(t){return t>0;}).sort(function(a,b){return a-b;});
  if(validos.length<5)return null;
  var n=validos.length;
  var sumX=0,sumY=0,sumXY=0,sumXX=0;
  var xs=[],ys=[];
  for(var j=0;j<n;j++){
    var rangoMediano=(j+1-0.3)/(n+0.4);
    var x=Math.log(validos[j]);
    var y=Math.log(-Math.log(1-rangoMediano));
    xs.push(x);ys.push(y);
    sumX+=x;sumY+=y;sumXY+=x*y;sumXX+=x*x;
  }
  var beta=(n*sumXY-sumX*sumY)/(n*sumXX-sumX*sumX);
  var intercepto=(sumY-beta*sumX)/n;
  var eta=Math.exp(-intercepto/beta);
  if(!isFinite(beta)||!isFinite(eta)||beta<=0||eta<=0)return null;
  var r={beta:Math.round(beta*100)/100,eta:Math.round(eta),n:n};
  var ic90=_intervaloConfianzaWeibull(xs,ys,sumX,sumXX,n,beta,intercepto);
  if(ic90)r.ic90=ic90;
  return r;
}

// Valores críticos t de Student, dos colas, 90% de confianza (α=0.10) — tabla
// estándar de cualquier libro de estadística, para df=1..30; más allá se usa
// la aproximación normal (z=1.645), ya prácticamente igual al t exacto. 90%
// (no 95%) porque es el estándar de la industria en análisis de
// confiabilidad Weibull (así reporta Minitab/ReliaSoft por defecto), no un
// número elegido al azar.
var _T_STUDENT_90=[6.314,2.920,2.353,2.132,2.015,1.943,1.895,1.860,1.833,1.812,1.796,1.782,1.771,1.761,1.753,1.746,1.740,1.734,1.729,1.725,1.721,1.717,1.714,1.711,1.708,1.706,1.703,1.701,1.699,1.697];
function _tCritico90(df){
  if(df<1)return 1.645;
  if(df<=30)return _T_STUDENT_90[df-1];
  return 1.645;
}

// Intervalo de confianza 90% para β/η (2026-09-12, pedido del usuario: "con
// qué formula no hemos puesto"): el ajuste de arriba da un β/η puntual, pero
// con muestras chicas (mínimo 5-6 datos) esa recta puede estar lejos de la
// realidad — mostrar solo el número sin su margen de error aparenta más
// certeza de la que hay. Se usa el error estándar de la pendiente/intercepto
// de la MISMA regresión de mínimos cuadrados de arriba (fórmulas estándar de
// OLS, sin librería externa) y se propaga a η con el método delta, ya que
// η=e^(-intercepto/β) depende de ambos parámetros de la regresión a la vez
// (que están correlacionados entre sí, no son independientes). Recibe los
// mismos xs/ys/sumas ya calculados por el llamador para no repetir el
// trabajo. Devuelve null si la varianza sale indefinida (df<1 o los x son
// todos iguales) en vez de inventar un intervalo.
function _intervaloConfianzaWeibull(xs,ys,sumX,sumXX,n,beta,intercepto){
  var df=n-2;
  if(df<1)return null;
  var sse=0;
  for(var i=0;i<n;i++){
    var pred=intercepto+beta*xs[i];
    var res=ys[i]-pred;
    sse+=res*res;
  }
  var mse=sse/df;
  var sxx=sumXX-(sumX*sumX)/n;
  if(!(sxx>0))return null;
  var varBeta=mse/sxx;
  var xBar=sumX/n;
  var varIntercepto=mse*(1/n+(xBar*xBar)/sxx);
  var covBetaIntercepto=-mse*xBar/sxx;
  // Método delta para ln(η) = -intercepto/β (η no sale directo de la
  // regresión, así que su varianza tampoco — hay que propagarla).
  var dBeta=intercepto/(beta*beta);
  var dIntercepto=-1/beta;
  var varLnEta=dBeta*dBeta*varBeta+dIntercepto*dIntercepto*varIntercepto+2*dBeta*dIntercepto*covBetaIntercepto;
  if(!(varBeta>=0)||!(varLnEta>=0))return null;
  var t=_tCritico90(df);
  var seBeta=Math.sqrt(varBeta);
  var seLnEta=Math.sqrt(varLnEta);
  var lnEta=-intercepto/beta;
  var betaMin=Math.max(0.01,beta-t*seBeta);
  var betaMax=beta+t*seBeta;
  var etaMin=Math.exp(lnEta-t*seLnEta);
  var etaMax=Math.exp(lnEta+t*seLnEta);
  if(!isFinite(betaMin)||!isFinite(betaMax)||!isFinite(etaMin)||!isFinite(etaMax))return null;
  return {
    betaMin:Math.round(betaMin*100)/100,
    betaMax:Math.round(betaMax*100)/100,
    etaMin:Math.round(etaMin),
    etaMax:Math.round(etaMax)
  };
}
function ajusteWeibull(horomFallas){
  var validos=(horomFallas||[]).filter(function(h){return h>0;}).sort(function(a,b){return a-b;});
  var intervalos=[];
  for(var i=1;i<validos.length;i++){
    var t=validos[i]-validos[i-1];
    if(t>0)intervalos.push(t);
  }
  return _ajusteWeibullDeMuestra(intervalos);
}

// ═══ EDAD VIRTUAL (Kijima simplificado) — estima si las reparaciones de un
// equipo lo dejan efectivamente "como nuevo" o si solo tapan el síntoma y la
// degradación se acumula pese a las intervenciones (concepto de Kijima,
// modelos de renovación imperfecta: q=0 "as good as new", q=1 "as bad as
// old"). NO es un ajuste de máxima verosimilitud del factor q real de Kijima
// (eso requiere resolver una verosimilitud no lineal) — es un proxy simple y
// honesto: toma los mismos intervalos entre fallas sucesivas que usa
// ajusteWeibull, los parte en primera y segunda mitad cronológica, y compara
// sus medianas. Si la segunda mitad falla MÁS seguido que la primera
// (intervalos más cortos), las reparaciones no están restaurando el equipo —
// factorQ se acerca a 1. Si se mantiene o mejora, factorQ=0 (sin evidencia de
// degradación acumulada). Mínimo 6 intervalos (7 fallas) — más exigente que
// ajusteWeibull (5 intervalos) porque acá se parte la muestra en dos mitades.
// Devuelve null si no hay suficiente historial — nunca se inventa un factor
// sin datos para sostenerlo.
function edadVirtualEquipo(horomFallas){
  var validos=(horomFallas||[]).filter(function(h){return h>0;}).sort(function(a,b){return a-b;});
  var intervalos=[];
  for(var i=1;i<validos.length;i++){
    var t=validos[i]-validos[i-1];
    if(t>0)intervalos.push(t);
  }
  if(intervalos.length<6)return null;
  var mitad=Math.floor(intervalos.length/2);
  var medPrimera=medianaPositiva(intervalos.slice(0,mitad));
  var medSegunda=medianaPositiva(intervalos.slice(intervalos.length-mitad));
  if(medPrimera==null||medSegunda==null)return null;
  var factorQ=medSegunda>=medPrimera?0:Math.round(Math.min(1,1-medSegunda/medPrimera)*100)/100;
  var interpretacion=
    factorQ===0?'Sin evidencia de degradación acumulada — las reparaciones mantienen el intervalo entre fallas':
    factorQ<0.34?'Degradación leve — las reparaciones restauran la mayor parte del equipo':
    factorQ<0.67?'Degradación moderada — las reparaciones tapan el síntoma pero no restauran del todo':
    'Degradación alta — las fallas vuelven cada vez más rápido pese a las reparaciones';
  return{nFallas:validos.length,medianaHorasPrimeraMitad:Math.round(medPrimera),medianaHorasSegundaMitad:Math.round(medSegunda),factorQ:factorQ,interpretacion:interpretacion};
}

// ═══ COSTO RELATIVO DE MANTENIMIENTO — uno de los indicadores de la norma EN
// 15341 (A&S1: costo de mantenimiento ÷ valor de reposición del activo).
// 2026-09-16: "gasto de mantenimiento" acá es el gasto REAL en repuestos y
// materiales (ordenes_compra_historico, cargado desde Órdenes de Compra
// reales) — NO incluye mano de obra: correctivos.costo sigue en $0 en el
// 100% de los registros (el campo existe en el formulario de OT pero nadie
// lo completa), así que no hay ese dato para sumar. Es un proxy real
// parcial, no el costo total de mantenimiento.
//
// Se anualiza: cada equipo tiene un historial de OC de distinto largo
// (algunos desde 2022, otros recién este año) — sumar el gasto total sin
// ajustar por cuántos días cubre ese historial castigaría injustamente a
// los equipos con más años de datos. Exige al menos 90 días de historial
// cubierto (si no, "gasto por año" sería una extrapolación de muy pocos
// datos) y un valorCompra real (>0). Devuelve null si no se cumplen esas
// condiciones — nunca un ratio inventado con datos insuficientes.
function costoRelativoMantenimiento(ocEquipo, valorCompra, opts){
  opts=opts||{};
  var minDias=opts.minDias||90;
  var conFecha=(ocEquipo||[]).filter(function(o){return o&&o.fecha;});
  var fechas=conFecha.map(function(o){return o.fecha;}).sort();
  if(!fechas.length||!valorCompra||valorCompra<=0)return null;
  var dias=(new Date(fechas[fechas.length-1]+'T00:00:00')-new Date(fechas[0]+'T00:00:00'))/86400000;
  if(dias<minDias)return null;
  var gastoTotal=conFecha.reduce(function(s,o){return s+(o.costo||0);},0);
  var gastoAnual=gastoTotal/(dias/365);
  var pct=Math.round((gastoAnual/valorCompra)*1000)/10;
  var r={gastoTotal:Math.round(gastoTotal),gastoAnual:Math.round(gastoAnual),diasHistorial:Math.round(dias),pct:pct};
  var concentracion=_concentracionMaximaOC(conFecha);
  if(concentracion)r.concentracionMaxima=concentracion;
  return r;
}

// ═══ CONCENTRACIÓN MÁXIMA EN UNA SOLA LÍNEA DE OC (2026-09-17) ═══ Caso
// real encontrado por el usuario: una sola línea con error de tipeo en
// precioUnit ($12.791.624 contra $139.997 de las otras 2 compras del mismo
// ítem — 91 veces más) infló el gasto histórico de un equipo en +$2.500M,
// llevando su Costo Relativo de 4,7% real a un 83,6% falso.
// ordenesSinOutliers (más arriba) no lo detecta en este caso puntual porque
// exige ≥5 compras comparables del mismo ítem para calcular una mediana
// confiable, y acá solo había 3 — esta función es un chequeo complementario
// e independiente: sin comparar contra el precio "normal" de ese ítem
// (que puede no tener suficientes comparables), simplemente avisa cuando
// UNA sola línea explica una fracción desproporcionada del gasto TOTAL de
// ESE equipo — la misma señal que hubiera hecho evidente el error real de
// tipeo con solo mirar la tabla. Umbral 50% elegido con los datos reales de
// la flota: varias reparaciones grandes legítimas (motor/componente mayor,
// compartidas por varios camiones del mismo modelo) llegan a ~35% de
// concentración con historiales largos (n de hasta 750 líneas) sin ser un
// error — 50% separa claramente esos casos reales de los que sí resultaron
// ser errores de tipeo (91%, 94%, 98% en los casos reales encontrados).
// Mínimo 3 líneas (con 1-2, "una línea domina el total" no dice nada).
function _concentracionMaximaOC(ocEquipo){
  var validas=(ocEquipo||[]).filter(function(o){return o&&o.costo>0;});
  if(validas.length<3)return null;
  var total=validas.reduce(function(s,o){return s+o.costo;},0);
  if(!(total>0))return null;
  var maxLinea=validas.reduce(function(m,o){return o.costo>m.costo?o:m;});
  var pct=maxLinea.costo/total;
  if(pct<0.5)return null;
  return{detalle:maxLinea.detalle||null,fecha:maxLinea.fecha||null,costo:Math.round(maxLinea.costo),pctDelTotal:Math.round(pct*1000)/10};
}

// Versión de flota: agrupa el histórico de OC por sigla y calcula
// costoRelativoMantenimiento para cada equipo con valorCompra real, ordenado
// de mayor a menor % (los que más gastan en repuestos respecto a su propio
// valor de compra primero — candidatos a revisar si conviene seguir
// invirtiendo en reparaciones o evaluar reemplazo).
function costoRelativoMantenimientoFlota(ocHist, eq, opts){
  var porSigla={};
  (ocHist||[]).forEach(function(o){if(o&&o.sigla)(porSigla[o.sigla]=porSigla[o.sigla]||[]).push(o);});
  var resultado=[];
  (eq||[]).forEach(function(e){
    if(!e||!e.valorCompra||e.valorCompra<=0)return;
    var r=costoRelativoMantenimiento(porSigla[e.sigla]||[],e.valorCompra,opts);
    if(r)resultado.push(Object.assign({sigla:e.sigla,tipo:e.tipo,valorCompra:e.valorCompra},r));
  });
  return resultado.sort(function(a,b){return b.pct-a.pct;});
}

// ═══ SEÑAL UNIFICADA DE REEMPLAZO — cruza 6 señales reales, cada una ya
// calculada en otra parte del sistema (Weibull, Matriz de Riesgo, Alerta
// Cruzada, Edad Virtual, Costo Relativo de Mantenimiento), para marcar un
// equipo como "candidato a evaluación de reemplazo" cuando varias coinciden
// a la vez. NO es un puntaje inventado ni un CAE/OEE con datos que no
// existen (rechazado varias veces en esta conversación por esa razón
// exacta) — cada señal individual ya se muestra en su propia pantalla, acá
// solo se CUENTAN cuántas están "encendidas" para el mismo equipo al mismo
// tiempo. Diseño original (2026-09-14): 4 señales, umbral 3 de 4. Ampliado
// 2026-09-16 a 6 señales (se sumaron Edad Virtual y Costo Relativo, ambas
// implementadas después); el umbral se reescala a 4 de 6 para mantener la
// misma exigencia relativa (~75%) que el diseño original, a pedido
// explícito del usuario.
//
// Las 6 señales:
// 1. Weibull β>1.5 — desgaste acelerado (ajusteWeibull)
// 2. Al menos un componente mayor con riesgoNivel '🔴 Alto' (compMayores —
//    ese campo no tiene nivel "Extremo", solo Alto/Medio/Revisar/Bajo/Sin datos)
// 3. Reincidencia — este equipo es el "equipoMasRepetido" de un componente
//    con severidad≥2 (diagnosticoFlota, pred.js)
// 4. Alerta Cruzada severity≥5 (alertaCruzada, pred.js)
// 5. Edad Virtual — factorQ≥0.67, "degradación alta" (edadVirtualEquipo)
// 6. Costo Relativo de Mantenimiento ≥15%/año (costoRelativoMantenimiento)
//
// Cada señal puede venir null (sin datos suficientes para evaluarla ESE
// equipo) — nunca se inventa un valor para completar el conteo; una señal
// null simplemente no suma ni resta. Devuelve null solo si NINGUNA de las
// 6 tiene dato (nada que concluir sobre ese equipo todavía).
function senalUnificadaReemplazo(entrada){
  entrada=entrada||{};
  var UMBRAL=4;
  var senales=[
    {clave:'weibull',nombre:'Weibull β>1.5 (desgaste acelerado)',activa:entrada.weibullBeta==null?null:entrada.weibullBeta>1.5},
    {clave:'riesgoComponente',nombre:'Componente con riesgo Alto',activa:entrada.tieneComponenteRiesgoAlto==null?null:!!entrada.tieneComponenteRiesgoAlto},
    {clave:'reincidencia',nombre:'Reincidencia (mismo equipo, misma falla)',activa:entrada.esReincidente==null?null:!!entrada.esReincidente},
    {clave:'alertaCruzada',nombre:'Alerta Cruzada severidad≥5',activa:entrada.alertaCruzadaSeverity==null?null:entrada.alertaCruzadaSeverity>=5},
    {clave:'edadVirtual',nombre:'Edad Virtual — degradación alta (Q≥0.67)',activa:entrada.edadVirtualFactorQ==null?null:entrada.edadVirtualFactorQ>=0.67},
    {clave:'costoRelativo',nombre:'Costo Relativo de Mantenimiento ≥15%/año',activa:entrada.costoRelativoPct==null?null:entrada.costoRelativoPct>=15}
  ];
  var evaluables=senales.filter(function(s){return s.activa!=null;});
  if(!evaluables.length)return null;
  var encendidas=senales.filter(function(s){return s.activa===true;});
  return{
    sigla:entrada.sigla||null,
    senales:senales,
    nEvaluables:evaluables.length,
    nEncendidas:encendidas.length,
    candidato:encendidas.length>=UMBRAL,
    encendidasNombres:encendidas.map(function(s){return s.nombre;})
  };
}

// ═══ AJUSTE WEIBULL DE POBLACIÓN — el uso "de libro" de Weibull en
// ingeniería de confiabilidad (2026-09-12, pedido del usuario: "¿y eso
// puede servir en los neumáticos?"): a diferencia de ajusteWeibull (arriba,
// intervalos entre fallas SUCESIVAS de UN mismo equipo — un proceso de
// renovación), acá la muestra es la vida completa de UNIDADES DISTINTAS de
// la misma familia (ej. neumáticos de la misma marca/medida ya dados de
// baja) — el análisis clásico de "vida de una población de componentes".
// Mismo núcleo de regresión, mismo mínimo de 5 datos, mismo significado de
// β/η — solo cambia de dónde sale cada número de la muestra.
function ajusteWeibullVidas(vidas){
  return _ajusteWeibullDeMuestra(vidas||[]);
}

// Agrupa una lista de {grupo, vida} (2026-09-12, mismo pedido) y ajusta
// Weibull de población a cada grupo por separado — mezclar grupos distintos
// (ej. dos marcas de neumático con vidas típicas muy distintas) diluiría la
// señal real de cada uno. Función genérica (no sabe qué es "grupo" ni
// "vida" — el llamador decide: marca+medida de neumático, modelo de
// componente, lo que corresponda) para poder reusarla más allá de
// neumáticos sin duplicar la lógica de agrupar+ajustar.
function analisisVidaUtilPorGrupo(items){
  var porGrupo={};
  (items||[]).forEach(function(it){
    if(!it||!it.grupo||!(it.vida>0))return;
    (porGrupo[it.grupo]=porGrupo[it.grupo]||[]).push(it.vida);
  });
  return Object.keys(porGrupo).sort().map(function(g){
    var vidas=porGrupo[g];
    return {grupo:g,n:vidas.length,ajuste:ajusteWeibullVidas(vidas)};
  });
}

// Ajusta Weibull por tipo de componente/categoría de falla, A NIVEL FLOTA
// (2026-09-12, mismo pedido que neumáticos/componentes mayores — la parte
// de Correctivos). A diferencia de ajusteWeibull (un equipo a la vez) y de
// analisisVidaUtilPorGrupo (recibe las vidas ya agrupadas por quien llama),
// acá se hacen las DOS cosas porque el agrupamiento es más específico:
// primero se agrupan los eventos por sigla+componente (no se pueden mezclar
// horómetros de equipos DISTINTOS entre sí — mismo criterio que ya usa
// _estMtbfPorComponente en estadistica.js), se calculan los intervalos
// reales DENTRO de cada equipo, y recién ahí se agrupan por componente para
// juntar (pool) entre equipos — la muestra que responde "¿cómo es la forma
// de falla de Motor/Frenos/etc. en TODA la flota?", no equipo por equipo.
// 'eventos' es la misma forma que ya arma _estFallasCombinadas
// (estadistica.js): {sigla, componente, horom, ...}.
function analisisVidaUtilCorrectivosPorComponente(eventos){
  var porEquipoComp={};
  (eventos||[]).forEach(function(e){
    if(!e||!e.componente||!(e.horom>0)||!e.sigla)return;
    var k=e.sigla+'|'+e.componente;
    (porEquipoComp[k]=porEquipoComp[k]||{componente:e.componente,horoms:[]}).horoms.push(e.horom);
  });
  var items=[];
  Object.keys(porEquipoComp).forEach(function(k){
    var g=porEquipoComp[k];
    var validos=g.horoms.filter(function(h){return h>0;}).sort(function(a,b){return a-b;});
    for(var i=1;i<validos.length;i++){
      var t=validos[i]-validos[i-1];
      if(t>0)items.push({grupo:g.componente,vida:t});
    }
  });
  return analisisVidaUtilPorGrupo(items);
}

// ═══ WEIBULL CON CENSURA CORRECTA — MLE (2026-09-16) ═══
// Los 4 ajustes Weibull de arriba (ajusteWeibull/ajusteWeibullVidas/
// analisisVidaUtilPorGrupo/analisisVidaUtilCorrectivosPorComponente) usan
// regresión de rango mediano sobre intervalos ya CERRADOS — el mismo
// límite que Kaplan-Meier (abajo) vino a resolver para la curva de
// supervivencia: un equipo que sigue en servicio sin haber vuelto a
// fallar, o un neumático/componente que sigue montado sin haberse dado de
// baja, "sobrevivió al menos hasta acá" — es información real que la
// regresión descarta por completo. Acá se resuelve lo mismo para β/η vía
// máxima verosimilitud (MLE), el método correcto de libro para Weibull con
// censura (Meeker & Escobar, "Statistical Methods for Reliability Data" —
// misma referencia que usan Minitab/ReliaSoft para "Weibull censored
// fit"), en vez de la regresión.
//
// Derivación (verificada con script Python independiente — Newton-Raphson
// de mano, sin scipy/numpy, comparado contra parámetros verdaderos
// conocidos generando datos sintéticos, y confirmando que el punto hallado
// es máximo local de la log-verosimilitud real, no solo raíz de la
// derivada): con r fallas reales y c censuras, log-verosimilitud
// ln L = r·ln β − r·β·ln η + (β−1)·Σ_fallas ln(t_i) − Σ_TODOS (t_i/η)^β.
// De ∂lnL/∂η=0 sale η(β) en forma cerrada: η^β = (1/r)·Σ_TODOS t_i^β
// (la suma es sobre TODOS —fallas y censuras—, pero se divide por r
// —solo fallas—, la asimetría real de trabajar con censura). Sustituyendo
// esa η(β) en ∂lnL/∂β=0 se cancela un término y queda una ecuación de una
// sola variable: g(β) = S2(β)/S1(β) − (1/r)·Σ_fallas ln(t_i) − 1/β = 0,
// con S1(β)=Σ_TODOS t_i^β, S2(β)=Σ_TODOS t_i^β·ln(t_i) — se resuelve con
// Newton-Raphson (g'(β) = (S3·S1−S2²)/S1² + 1/β², con S3=Σ_TODOS
// t_i^β·ln(t_i)²), sin ninguna librería externa. Semilla β=1 (asume
// tasa de falla constante como punto de partida neutro).
//
// Mínimo 5 FALLAS reales (no cuenta censuras para este mínimo — mismo
// umbral que el resto del stack Weibull de este archivo, la censura suma
// precisión, no baja la exigencia de evidencia real de falla). Devuelve
// null si Newton-Raphson no converge en 100 iteraciones o si algún
// resultado sale no-finito — nunca se fuerza un ajuste que no converge.
//
// Es un COMPLEMENTO a ajusteWeibull/ajusteWeibullVidas, no un reemplazo:
// esas 33+ funciones/tests existentes siguen intactos. 'observaciones' usa
// la MISMA forma {tiempo,censurado} que ya usa kaplanMeier/competingRisks
// (abajo) — no un formato nuevo.
function ajusteWeibullCensurado(observaciones){
  var obs=(observaciones||[]).filter(function(o){return o&&o.tiempo>0;});
  var fallas=obs.filter(function(o){return !o.censurado;});
  if(fallas.length<5)return null;
  var r=fallas.length;
  var sumLnFallas=0;
  for(var i=0;i<r;i++)sumLnFallas+=Math.log(fallas[i].tiempo);
  var C=sumLnFallas/r;
  function sumas(beta){
    var S1=0,S2=0,S3=0;
    for(var j=0;j<obs.length;j++){
      var t=obs[j].tiempo;
      var lt=Math.log(t);
      var p=Math.pow(t,beta);
      S1+=p;S2+=p*lt;S3+=p*lt*lt;
    }
    return[S1,S2,S3];
  }
  var beta=1,convergio=false;
  for(var it=0;it<100;it++){
    var s=sumas(beta);
    var S1=s[0],S2=s[1],S3=s[2];
    if(!(S1>0))return null;
    var g=S2/S1-C-1/beta;
    var gp=(S3*S1-S2*S2)/(S1*S1)+1/(beta*beta);
    if(!isFinite(g)||!isFinite(gp)||gp===0)return null;
    var betaNuevo=beta-g/gp;
    if(betaNuevo<=0)betaNuevo=beta/2;
    if(Math.abs(betaNuevo-beta)<1e-9){beta=betaNuevo;convergio=true;break;}
    beta=betaNuevo;
  }
  if(!convergio||!isFinite(beta)||beta<=0)return null;
  var sFinal=sumas(beta);
  var eta=Math.pow(sFinal[0]/r,1/beta);
  if(!isFinite(eta)||eta<=0)return null;
  return{beta:Math.round(beta*100)/100,eta:Math.round(eta),n:obs.length,nFallas:r,nCensurados:obs.length-r};
}

// Arma los intervalos {tiempo,censurado} de UN equipo (fallas sucesivas +
// el tramo final abierto hasta horomActual si sigue en servicio) — mismo
// criterio que ya usa kaplanMeierCorrectivosPorComponente/
// competingRisksPorEquipo, extraído acá para que ajusteWeibullEquipoCensurado
// y kijimaEquipo (2026-09-17, tarea siguiente del mismo lote) no dupliquen
// esta construcción. Nunca se inventa un horómetro si no hay dato real.
function _observacionesEquipoConCensura(horomFallas,horomActual){
  var validos=(horomFallas||[]).filter(function(h){return h>0;}).sort(function(a,b){return a-b;});
  var obs=[];
  for(var i=1;i<validos.length;i++){
    var t=validos[i]-validos[i-1];
    if(t>0)obs.push({tiempo:t,censurado:false});
  }
  if(validos.length&&horomActual>validos[validos.length-1]){
    var tCens=horomActual-validos[validos.length-1];
    if(tCens>0)obs.push({tiempo:tCens,censurado:true});
  }
  return obs;
}

// Versión equipo-a-equipo de ajusteWeibull, agregando la censura real: el
// tramo abierto desde la última falla registrada hasta el horómetro
// ACTUAL del equipo, cuando sigue en servicio sin haber vuelto a fallar.
function ajusteWeibullEquipoCensurado(horomFallas,horomActual){
  return ajusteWeibullCensurado(_observacionesEquipoConCensura(horomFallas,horomActual));
}

// Versión de población agrupada (neumáticos por posición, componentes
// mayores por tipo, etc.) — mismo agrupamiento que analisisVidaUtilPorGrupo
// pero cada ítem puede venir marcado censurado:true (la unidad sigue en
// uso, todavía no se dio de baja/reemplazó — su 'vida' hasta ahora es un
// mínimo real, no su vida completa).
function analisisVidaUtilPorGrupoCensurado(items){
  var porGrupo={};
  (items||[]).forEach(function(it){
    if(!it||!it.grupo||!(it.vida>0))return;
    (porGrupo[it.grupo]=porGrupo[it.grupo]||[]).push({tiempo:it.vida,censurado:!!it.censurado});
  });
  return Object.keys(porGrupo).sort().map(function(g){
    var obs=porGrupo[g];
    return{grupo:g,n:obs.length,ajuste:ajusteWeibullCensurado(obs)};
  });
}

// Versión "correctivos por componente, a nivel flota" con censura — mismo
// agrupamiento sigla+componente que analisisVidaUtilCorrectivosPorComponente,
// sumando el tramo final abierto de cada equipo (última falla de ESE
// componente hasta horomActual del equipo) como censura, igual que hace
// kaplanMeierCorrectivosPorComponente con Kaplan-Meier.
function ajusteWeibullCorrectivosPorComponenteCensurado(eventos,eq){
  var porEquipoComp={};
  (eventos||[]).forEach(function(e){
    if(!e||!e.componente||!(e.horom>0)||!e.sigla)return;
    var k=e.sigla+'|'+e.componente;
    (porEquipoComp[k]=porEquipoComp[k]||{sigla:e.sigla,componente:e.componente,horoms:[]}).horoms.push(e.horom);
  });
  var eqPorSigla={};
  (eq||[]).forEach(function(x){if(x&&x.sigla)eqPorSigla[x.sigla]=x;});
  var porGrupo={};
  Object.keys(porEquipoComp).forEach(function(k){
    var g=porEquipoComp[k];
    var validos=g.horoms.filter(function(h){return h>0;}).sort(function(a,b){return a-b;});
    for(var i=1;i<validos.length;i++){
      var t=validos[i]-validos[i-1];
      if(t>0)(porGrupo[g.componente]=porGrupo[g.componente]||[]).push({tiempo:t,censurado:false});
    }
    var eqObj=eqPorSigla[g.sigla];
    var ultimaFalla=validos[validos.length-1];
    if(eqObj&&eqObj.horomActual>ultimaFalla){
      var tCens=eqObj.horomActual-ultimaFalla;
      if(tCens>0)(porGrupo[g.componente]=porGrupo[g.componente]||[]).push({tiempo:tCens,censurado:true});
    }
  });
  return Object.keys(porGrupo).sort().map(function(comp){
    var obs=porGrupo[comp];
    return{componente:comp,n:obs.length,ajuste:ajusteWeibullCensurado(obs)};
  });
}

// ═══ KIJIMA TYPE I/II — FACTOR DE RESTAURACIÓN q POR MÁXIMA VEROSIMILITUD
// (2026-09-17) ═══ Segundo ítem del tercer lote, elegido por el usuario.
// edadVirtualEquipo (arriba, sección "EDAD VIRTUAL") ya da un proxy simple
// de Kijima comparando medianas de dos mitades de la muestra — honesto,
// pero no es el factor q real de los modelos de renovación imperfecta de
// Kijima (1989), que requieren resolver una verosimilitud no lineal. Esta
// sección SÍ lo hace, con los dos modelos clásicos de la literatura
// (ambos con V_0=0):
//   Tipo I  (ARA1): V_n = V_{n-1} + q·X_n   — la reparación reduce solo el
//     daño acumulado en el ÚLTIMO intervalo.
//   Tipo II (ARA∞): V_n = q·(V_{n-1} + X_n) — la reparación reduce TODA la
//     edad virtual acumulada hasta ese momento, no solo la última.
// q=0 en cualquiera de los dos ⇒ V_n=0 siempre (equivalente a un proceso
// de renovación, "como nuevo" cada vez). q=1 en cualquiera de los dos ⇒
// V_n=Σ X_i (edad real, sin ningún efecto de reparación — "como estaba").
// Los dos modelos COINCIDEN exactamente en esos dos extremos y solo
// difieren en el rango intermedio — verificado con datos sintéticos.
//
// Verosimilitud: dado un ajuste Weibull base (β/η, tomado de
// ajusteWeibullEquipoCensurado de ESTE equipo — se fijan, no se optimizan
// junto con q, para evitar la sobreparametrización de una optimización
// conjunta con pocos datos), cada intervalo X_n aporta la probabilidad
// condicional de fallar a la edad virtual V_{n-1}+X_n habiendo sobrevivido
// hasta V_{n-1} (misma idea de "vida remanente condicional" que ya usa
// rulWeibull): ln f(V_{n-1}+X_n) − ln S(V_{n-1}). El tramo final censurado
// (equipo todavía en servicio) aporta ln S(V_{n-1}+X_n) − ln S(V_{n-1}) en
// vez de la densidad — mismo principio de censura ya usado en
// ajusteWeibullCensurado. q∈[0,1] se resuelve con búsqueda de sección
// áurea (golden-section search, sin asumir que la verosimilitud es
// diferenciable en forma cerrada — a diferencia del β de Weibull arriba,
// acá no hay una ecuación trascendente simple de una sola raíz porque V_n
// es recursivo). Se ajustan AMBOS tipos y se elige el de mayor
// verosimilitud — no se asume de antemano cuál describe mejor a ese
// equipo.
//
// Verificado con script Python independiente: simulando procesos Kijima
// sintéticos con q y tipo conocidos (Tipo I y Tipo II, q=0/0,3/0,7/1), la
// búsqueda de sección áurea recupera el tipo correcto por verosimilitud en
// los 3 casos intermedios y coincide con una búsqueda exhaustiva en grilla
// de 1000 puntos (mismo q̂, misma verosimilitud) — no es un óptimo local
// espurio de la sección áurea.
function _logVerosimilitudKijima(obs,beta,eta,q,tipoII){
  var v=0,ll=0;
  for(var i=0;i<obs.length;i++){
    var x=obs[i].tiempo;
    var t=v+x;
    var lnSv=-Math.pow(v/eta,beta);
    var lnSt=-Math.pow(t/eta,beta);
    if(obs[i].censurado){
      ll+=lnSt-lnSv;
    }else{
      var lnft=Math.log(beta)-beta*Math.log(eta)+(beta-1)*Math.log(t)-Math.pow(t/eta,beta);
      ll+=lnft-lnSv;
    }
    v=tipoII?q*(v+x):v+q*x;
  }
  return ll;
}

// Búsqueda de sección áurea genérica para maximizar una función unimodal
// en [lo,hi] — sin derivadas, sin librería externa (misma técnica que
// Newton-Raphson arriba pero para cuando no hay una ecuación cerrada de la
// derivada, como acá con la verosimilitud recursiva de Kijima).
function _seccionAureaMax(f,lo,hi,tol){
  tol=tol||1e-4;
  var razon=(Math.sqrt(5)-1)/2;
  var a=lo,b=hi;
  var c=b-razon*(b-a),d=a+razon*(b-a);
  var fc=f(c),fd=f(d);
  for(var it=0;it<200&&(b-a)>tol;it++){
    if(fc>fd){b=d;d=c;fd=fc;c=b-razon*(b-a);fc=f(c);}
    else{a=c;c=d;fc=fd;d=a+razon*(b-a);fd=f(d);}
  }
  var q=(a+b)/2;
  return{q:q,valor:f(q)};
}

// Mínimo 5 fallas reales (mismo umbral que ajusteWeibullCensurado, del que
// depende para β/η) — con censura opcional del tramo final si el equipo
// sigue en servicio. Devuelve null si el ajuste base no converge — nunca
// se inventa un q sin una forma Weibull real detrás.
// Edad virtual AHORA MISMO (no solo justo después de la última reparación
// real): replica la misma recursión de Kijima sobre 'obs', pero el tramo
// final CENSURADO (equipo sigue en servicio, sin reparación todavía) solo
// suma el tiempo transcurrido sin aplicar el factor q — no hubo reparación
// que "restaure" nada en ese tramo, así que la edad virtual sigue subiendo
// tal cual hasta este momento. Sin tramo censurado (el equipo ya no tiene
// horómetro actual por encima de su última falla), devuelve la edad
// virtual justo después de la última reparación real. Usada por
// simulacionTrayectoriasGRP (abajo) como punto de partida real para
// proyectar fallas futuras — nunca arranca desde 0 si el equipo ya viene
// con desgaste acumulado real.
function _edadVirtualActual(obs,q,tipoII){
  var v=0;
  for(var i=0;i<obs.length;i++){
    var x=obs[i].tiempo;
    if(obs[i].censurado)return v+x;
    v=tipoII?q*(v+x):v+q*x;
  }
  return v;
}

function kijimaEquipo(horomFallas,horomActual){
  var obs=_observacionesEquipoConCensura(horomFallas,horomActual);
  var fallas=obs.filter(function(o){return!o.censurado;});
  if(fallas.length<5)return null;
  var ajusteBase=ajusteWeibullCensurado(obs);
  if(!ajusteBase)return null;
  var beta=ajusteBase.beta,eta=ajusteBase.eta;
  function evaluarTipo(tipoII){
    var r=_seccionAureaMax(function(q){return _logVerosimilitudKijima(obs,beta,eta,q,tipoII);},0,1);
    return{q:Math.round(r.q*100)/100,logLik:Math.round(r.valor*1000)/1000};
  }
  var tipoI=evaluarTipo(false);
  var tipoII=evaluarTipo(true);
  var modeloElegido=tipoI.logLik>=tipoII.logLik?'I':'II';
  var q=modeloElegido==='I'?tipoI.q:tipoII.q;
  var interpretacion=
    q<=0.1?'Reparaciones efectivas — el equipo vuelve prácticamente como nuevo cada vez (comportamiento cercano a un proceso de renovación)':
    q<0.34?'Restauración alta — las reparaciones recuperan la mayor parte de la vida del equipo':
    q<0.67?'Restauración parcial — las reparaciones tapan el síntoma pero no restauran del todo, la edad virtual se acumula':
    q<0.9?'Restauración baja — el desgaste se acumula pese a las reparaciones':
    'Reparación mínima — equivalente a solo reemplazar la pieza que falló, sin efecto sobre el desgaste general del equipo';
  return{
    beta:beta,eta:eta,
    nFallas:fallas.length,nCensurados:obs.length-fallas.length,
    tipoI:tipoI,tipoII:tipoII,
    modeloElegido:modeloElegido,q:q,
    edadVirtualActual:Math.round(_edadVirtualActual(obs,q,modeloElegido==='II')*10)/10,
    interpretacion:interpretacion
  };
}

// ═══ GRP — PROCESO DE RENOVACIÓN GENERAL: SIMULACIÓN DE TRAYECTORIAS
// (2026-09-17) ═══ Quinto y último ítem del tercer lote, depende del
// ajuste Kijima de arriba (β/η/q/tipo por equipo). "GRP" (General Renewal
// Process, Kijima 1989) es el nombre formal del modelo del que Tipo I/II
// son los dos casos concretos ya implementados — esta sección agrega la
// SIMULACIÓN hacia adelante: en vez de solo estimar q a partir del
// historial, proyecta miles de trayectorias futuras posibles de fallas
// para ESTE equipo puntual, partiendo de su propia edad virtual actual
// (edadVirtualActual de kijimaEquipo) y su propio β/η/q/tipo — a
// diferencia de simulacionMonteCarloDisponibilidad (que remuestrea
// intervalos reales de TODA la flota, un promedio, sin memoria de
// reparación imperfecta), acá la trayectoria de CADA equipo respeta su
// propio historial de qué tan bien lo restauran sus reparaciones.
//
// Muestreo: dado que el equipo está a edad virtual v, el tiempo hasta la
// próxima falla se obtiene invirtiendo la supervivencia condicional
// S(v+x)/S(v)=1−u (mismo principio que rulWeibull, pero generando un
// valor aleatorio u en vez de un percentil fijo p): v_falla =
// η·(−ln(S(v)·(1−u)))^(1/β), x = v_falla−v. Tras cada falla simulada, la
// edad virtual se actualiza con la MISMA recursión de Kijima (Tipo I:
// v+q·x; Tipo II: q·v_falla) — la reparación de la trayectoria simulada es
// tan buena o mala como la que YA mostró el historial real de ese equipo.
//
// Verificado con script Python independiente: con q=0 (cualquier tipo, se
// vuelven idénticos) la simulación GRP coincide EXACTO (0,000% de
// diferencia en 20.000 corridas) con un proceso de renovación clásico
// muestreado directo (intervalos Weibull i.i.d.) — confirma que la
// recursión colapsa correctamente al caso simple. Con q creciente
// (peor restauración), el número esperado de fallas en el mismo horizonte
// sube monótonamente (3,0→4,6→6,4→9,0 fallas para q=0/0,3/0,6/1,0), el
// comportamiento esperado. Caso determinístico (rng que siempre devuelve
// el mismo u) usado en los tests para verificar la trayectoria a mano,
// paso a paso.
function simulacionTrayectoriasGRP(beta,eta,q,tipoII,edadVirtualActual,horizonteHoras,nSimulaciones,rngOpcional){
  if(!(beta>0)||!(eta>0)||!(horizonteHoras>0))return null;
  var qq=q>=0&&q<=1?q:0;
  var v0=edadVirtualActual>=0?edadVirtualActual:0;
  var n=nSimulaciones>0?Math.round(nSimulaciones):1000;
  var rng=rngOpcional||Math.random;
  var fallasPorSim=[];
  var conFalla=0;
  for(var s=0;s<n;s++){
    var v=v0,tAcum=0,fallas=0;
    while(true){
      var u=rng();
      var sv=Math.exp(-Math.pow(v/eta,beta));
      var arg=sv*(1-u);
      if(!(arg>0))break;
      var t=eta*Math.pow(-Math.log(arg),1/beta);
      var x=t-v;
      if(x<0)x=0;
      tAcum+=x;
      if(tAcum>=horizonteHoras)break;
      fallas++;
      v=tipoII?qq*t:v+qq*x;
    }
    fallasPorSim.push(fallas);
    if(fallas>=1)conFalla++;
  }
  fallasPorSim.sort(function(a,b){return a-b;});
  function pct(p){
    var idx=Math.min(fallasPorSim.length-1,Math.max(0,Math.floor(p*(fallasPorSim.length-1))));
    return fallasPorSim[idx];
  }
  var suma=fallasPorSim.reduce(function(a,b){return a+b;},0);
  return{
    horizonteHoras:horizonteHoras,
    nSimulaciones:n,
    fallasP10:pct(0.10),
    fallasP50:pct(0.50),
    fallasP90:pct(0.90),
    fallasEsperadas:Math.round(suma/n*100)/100,
    probAlMenosUnaFalla:Math.round(conFalla/n*1000)/1000
  };
}

// Wrapper: toma directamente el resultado de kijimaEquipo (beta/eta/q/
// modeloElegido/edadVirtualActual) en vez de desarmarlo campo por campo —
// el uso normal de esta función es siempre "ya ajusté Kijima para este
// equipo, ahora quiero proyectar sus trayectorias futuras".
function simulacionTrayectoriasGRPDesdeKijima(ajusteKijima,horizonteHoras,nSimulaciones,rngOpcional){
  if(!ajusteKijima)return null;
  return simulacionTrayectoriasGRP(ajusteKijima.beta,ajusteKijima.eta,ajusteKijima.q,ajusteKijima.modeloElegido==='II',ajusteKijima.edadVirtualActual,horizonteHoras,nSimulaciones,rngOpcional);
}

// ═══ KAPLAN-MEIER — CURVA DE SUPERVIVENCIA NO PARAMÉTRICA (2026-09-16) ═══
// Complemento a Weibull, no un reemplazo: Weibull (arriba) AJUSTA una forma
// matemática (β/η) a la muestra — asume que la vida real sigue esa familia
// de curvas. Kaplan-Meier no asume ninguna distribución: calcula la
// probabilidad de supervivencia empírica directamente de los datos, punto
// por punto. La diferencia real que importa acá es que Kaplan-Meier SÍ
// puede usar observaciones CENSURADAS — un componente que todavía sigue en
// servicio (no ha fallado) aporta información real ("sobrevivió al menos
// hasta acá"), que el ajuste de Weibull de este archivo (regresión de rango
// mediano sobre intervalos ya CERRADOS) descarta por completo. Con muestras
// chicas — el caso típico acá — ignorar esa información censurada sesga la
// muestra hacia los componentes que fallan rápido (los que sí terminan de
// "vivir" a tiempo para entrar al cálculo).
//
// Fórmula clásica (estimador de Kaplan-Meier + varianza de Greenwood, la
// misma que reporta cualquier software de confiabilidad — Minitab/R
// survival/ReliaSoft): en cada tiempo de falla real t_i, S(t_i) = S(t_{i-1})
// × (1 − d_i/n_i), con n_i = observaciones aún "en riesgo" (tiempo≥t_i) y
// d_i = fallas exactamente en t_i. Las censuras no bajan la curva (no son
// una falla) pero SÍ salen del grupo "en riesgo" para los tiempos
// posteriores a su propio tiempo censurado.
//
// Mínimo 5 observaciones totales (mismo umbral que el resto del stack de
// confiabilidad de este archivo) y al menos 1 falla real — con puros
// censurados no hay ninguna caída que estimar.
function kaplanMeier(observaciones){
  var obs=(observaciones||[]).filter(function(o){return o&&o.tiempo>0;});
  if(obs.length<5)return null;
  var tiemposFalla=[].concat(obs).filter(function(o){return !o.censurado;}).map(function(o){return o.tiempo;});
  if(!tiemposFalla.length)return null;
  var tiemposUnicos=Array.from(new Set(tiemposFalla)).sort(function(a,b){return a-b;});
  var s=1,varAcum=0;
  var curva=[];
  tiemposUnicos.forEach(function(t){
    var enRiesgo=obs.filter(function(o){return o.tiempo>=t;}).length;
    var fallas=obs.filter(function(o){return !o.censurado&&o.tiempo===t;}).length;
    if(enRiesgo<=0)return;
    s=s*(1-fallas/enRiesgo);
    if(enRiesgo>fallas)varAcum+=fallas/(enRiesgo*(enRiesgo-fallas));
    var varS=s*s*varAcum;
    var se=Math.sqrt(varS);
    curva.push({
      tiempo:t,
      enRiesgo:enRiesgo,
      fallas:fallas,
      supervivencia:Math.round(s*1000)/1000,
      ic90Min:Math.max(0,Math.round((s-1.645*se)*1000)/1000),
      ic90Max:Math.min(1,Math.round((s+1.645*se)*1000)/1000)
    });
  });
  var medianaSupervivencia=null;
  for(var i=0;i<curva.length;i++){if(curva[i].supervivencia<=0.5){medianaSupervivencia=curva[i].tiempo;break;}}
  return{
    n:obs.length,
    nFallas:tiemposFalla.length,
    nCensurados:obs.length-tiemposFalla.length,
    curva:curva,
    medianaSupervivencia:medianaSupervivencia
  };
}

// ═══ LOG-RANK TEST — ¿DOS CURVAS DE SUPERVIVENCIA SON REALMENTE DISTINTAS? (2026-09-20) ═══
// Kaplan-Meier (arriba) calcula la curva de supervivencia real de un grupo,
// pero no dice si la diferencia ENTRE dos curvas (ej. dos componentes, dos
// modelos, dos ubicaciones) es real o ruido de muestra chica — la misma
// pregunta que anovaUnFactor ya resuelve para promedios de MTTR, pero acá
// para curvas completas, con censura (equipos que siguen en servicio sin
// haber fallado todavía) que un ANOVA o un t-test comunes no pueden usar
// correctamente. Log-Rank es el test estándar no-paramétrico para esto
// (Real Statistics, biostatsquid, cualquier libro de análisis de
// supervivencia) — nunca ajusta una distribución, solo compara fallas
// observadas contra las esperadas si ambos grupos tuvieran el mismo riesgo.
// En cada tiempo de falla real t_i (de cualquiera de los dos grupos):
// n_iA/n_iB = en riesgo en cada grupo, d_iA/d_iB = fallas reales ahí.
// E_iA = d_i×n_iA/n_i (fallas esperadas en A si el riesgo fuera igual).
// V_i = d_i×(n_i−d_i)×n_iA×n_iB / (n_i²×(n_i−1)) (varianza hipergeométrica).
// χ² = (ΣO_A−ΣE_A)² / ΣV_i, con 1 grado de libertad — mismo valor crítico
// de tabla (3.841, _CHI2_CRITICO_95) ya usado por testChiCuadradoUniforme
// para la misma decisión "significativo sí/no", sin reinventar esa parte.
// Mínimo 5 observaciones por grupo (mismo umbral que Kaplan-Meier) y al
// menos 1 falla real combinada — con puros censurados no hay nada que comparar.
function logRankTest(grupoA,grupoB){
  var obsA=(grupoA||[]).filter(function(o){return o&&o.tiempo>0;});
  var obsB=(grupoB||[]).filter(function(o){return o&&o.tiempo>0;});
  if(obsA.length<5||obsB.length<5)return null;
  var tiemposFalla=obsA.concat(obsB).filter(function(o){return !o.censurado;}).map(function(o){return o.tiempo;});
  if(!tiemposFalla.length)return null;
  var tiemposUnicos=Array.from(new Set(tiemposFalla)).sort(function(a,b){return a-b;});
  var oA=0,eA=0,v=0;
  tiemposUnicos.forEach(function(t){
    var enRiesgoA=obsA.filter(function(o){return o.tiempo>=t;}).length;
    var enRiesgoB=obsB.filter(function(o){return o.tiempo>=t;}).length;
    var n=enRiesgoA+enRiesgoB;
    var dA=obsA.filter(function(o){return !o.censurado&&o.tiempo===t;}).length;
    var dB=obsB.filter(function(o){return !o.censurado&&o.tiempo===t;}).length;
    var d=dA+dB;
    if(n<=1||d<=0)return;
    oA+=dA;
    eA+=d*enRiesgoA/n;
    if(n>1)v+=d*(n-d)*enRiesgoA*enRiesgoB/(n*n*(n-1));
  });
  if(!(v>0))return null;
  var chi2=Math.pow(oA-eA,2)/v;
  var critico=_CHI2_CRITICO_95[1];
  return{
    observadoA:oA,
    esperadoA:Math.round(eA*100)/100,
    chi2:Math.round(chi2*100)/100,
    critico:critico,
    significativo:chi2>critico,
    nA:obsA.length,nB:obsB.length,
    fallasA:obsA.filter(function(o){return !o.censurado;}).length,
    fallasB:obsB.filter(function(o){return !o.censurado;}).length
  };
}

// ═══ REGRESIÓN DE COX — HAZARD RATIO ENTRE DOS GRUPOS (2026-09-20) ═══
// logRankTest (arriba) responde "¿la diferencia es real o ruido?" — un
// sí/no. Cox cuantifica CUÁNTO: un hazard ratio (ej. "el grupo B falla
// 2.3 veces más rápido que el grupo A"), el número que sirve para una
// decisión real, no solo confirmar que la diferencia existe. Reusa
// exactamente los mismos datos {tiempo,censurado} de logRankTest/
// kaplanMeier (grupoA=referencia X=0, grupoB=comparado X=1 — HR>1 =
// grupoB falla más rápido que grupoA).
// Verosimilitud parcial de Cox con aproximación de Breslow para empates
// (la más simple de las dos estándar — mismo criterio "método práctico"
// ya usado en el ajuste de Weibull por rango mediano) — un único β,
// optimizado con Newton-Raphson (mismo tipo de algoritmo que Weibull
// censurado/Kijima). Verificado independientemente contra
// statsmodels.duration.hazard_regression.PHReg (ties='breslow'):
// coincide β/error estándar/HR a 5+ decimales en el caso normal.
// Guardia de divergencia (hallazgo real de la verificación, no teórico):
// con separación perfecta entre grupos (uno falla siempre antes que el
// otro, sin superposición de tiempos) la verosimilitud parcial no tiene
// máximo finito — β diverge a infinito, la MISMA patología que produce
// statsmodels en ese caso exacto (confirmado, no solo evitado). Si no
// converge en 50 iteraciones o el β resultante es numéricamente absurdo
// (|β|>15, HR de millones), se devuelve null — nunca se muestra una
// falsa precisión sobre datos que no la sostienen.
function coxPHBinario(grupoA,grupoB){
  var obsA=(grupoA||[]).filter(function(o){return o&&o.tiempo>0;}).map(function(o){return{tiempo:o.tiempo,censurado:!!o.censurado,x:0};});
  var obsB=(grupoB||[]).filter(function(o){return o&&o.tiempo>0;}).map(function(o){return{tiempo:o.tiempo,censurado:!!o.censurado,x:1};});
  if(obsA.length<5||obsB.length<5)return null;
  var obs=obsA.concat(obsB);
  var tiemposEvento=Array.from(new Set(obs.filter(function(o){return !o.censurado;}).map(function(o){return o.tiempo;}))).sort(function(a,b){return a-b;});
  if(!tiemposEvento.length)return null;
  function derivadas(beta){
    var l1=0,l2=0;
    for(var i=0;i<tiemposEvento.length;i++){
      var t=tiemposEvento[i];
      var enRiesgo=obs.filter(function(o){return o.tiempo>=t;});
      var n1=enRiesgo.filter(function(o){return o.x===1;}).length;
      var n0=enRiesgo.length-n1;
      var eventosEnT=obs.filter(function(o){return !o.censurado&&o.tiempo===t;});
      var d=eventosEnT.length;
      var s1=eventosEnT.filter(function(o){return o.x===1;}).length;
      var eb=Math.exp(beta);
      var D=n0+n1*eb;
      if(!(D>0))return null;
      l1+=s1-d*(n1*eb)/D;
      l2+=-d*n1*n0*eb/(D*D);
    }
    return{l1:l1,l2:l2};
  }
  var beta=0,convergio=false;
  for(var it=0;it<50;it++){
    var der=derivadas(beta);
    if(!der||!(der.l2<0))return null;
    var betaNuevo=beta-der.l1/der.l2;
    if(!isFinite(betaNuevo)||Math.abs(betaNuevo)>15)return null;
    if(Math.abs(betaNuevo-beta)<1e-8){beta=betaNuevo;convergio=true;break;}
    beta=betaNuevo;
  }
  if(!convergio||Math.abs(beta)>15)return null;
  var derFinal=derivadas(beta);
  if(!derFinal||!(derFinal.l2<0))return null;
  var se=Math.sqrt(-1/derFinal.l2);
  if(!isFinite(se)||se<=0)return null;
  var z=beta/se;
  var hr=Math.exp(beta);
  return{
    beta:Math.round(beta*1000)/1000,
    se:Math.round(se*1000)/1000,
    hr:Math.round(hr*100)/100,
    hrMin:Math.round(Math.exp(beta-1.96*se)*100)/100,
    hrMax:Math.round(Math.exp(beta+1.96*se)*100)/100,
    z:Math.round(z*100)/100,
    significativo:Math.abs(z)>1.96,
    nA:obsA.length,nB:obsB.length,
    fallasA:obsA.filter(function(o){return !o.censurado;}).length,
    fallasB:obsB.filter(function(o){return !o.censurado;}).length
  };
}

// Kaplan-Meier por componente, a nivel FLOTA (mismo agrupamiento sigla+
// componente que analisisVidaUtilCorrectivosPorComponente, arriba — no se
// duplica esa lógica de intervalos, solo se le agrega la censura real: el
// tramo abierto desde la última falla registrada de cada equipo hasta su
// horómetro actual, cuando el equipo sigue con ese componente en servicio
// sin haber vuelto a fallar. 'eq' se usa SOLO para leer horomActual — nunca
// se inventa un horómetro si el equipo no está en la lista.
function kaplanMeierCorrectivosPorComponente(eventos,eq){
  var porEquipoComp={};
  (eventos||[]).forEach(function(e){
    if(!e||!e.componente||!(e.horom>0)||!e.sigla)return;
    var k=e.sigla+'|'+e.componente;
    (porEquipoComp[k]=porEquipoComp[k]||{sigla:e.sigla,componente:e.componente,horoms:[]}).horoms.push(e.horom);
  });
  var eqPorSigla={};
  (eq||[]).forEach(function(x){if(x&&x.sigla)eqPorSigla[x.sigla]=x;});
  var porGrupo={};
  Object.keys(porEquipoComp).forEach(function(k){
    var g=porEquipoComp[k];
    var validos=g.horoms.filter(function(h){return h>0;}).sort(function(a,b){return a-b;});
    for(var i=1;i<validos.length;i++){
      var t=validos[i]-validos[i-1];
      if(t>0)(porGrupo[g.componente]=porGrupo[g.componente]||[]).push({tiempo:t,censurado:false});
    }
    var eqObj=eqPorSigla[g.sigla];
    var ultimaFalla=validos[validos.length-1];
    if(eqObj&&eqObj.horomActual>ultimaFalla){
      var tCens=eqObj.horomActual-ultimaFalla;
      if(tCens>0)(porGrupo[g.componente]=porGrupo[g.componente]||[]).push({tiempo:tCens,censurado:true});
    }
  });
  return Object.keys(porGrupo).sort().map(function(comp){
    var obs=porGrupo[comp];
    return{componente:comp,n:obs.length,km:kaplanMeier(obs),obs:obs};
  });
}

// ═══ COMPETING RISKS — QUÉ MODO DE FALLA "GANA LA CARRERA" PRIMERO (2026-09-16) ═══
// Segundo ítem del segundo lote de algoritmos "nivel siguiente" elegido por
// el usuario. Kaplan-Meier de arriba mide, PARA UN COMPONENTE A LA VEZ,
// tiempo hasta su propia primera falla — trata las fallas de OTROS
// componentes del mismo equipo como si nunca hubieran pasado, lo cual en
// presencia de varias causas reales de falla que compiten por sacar al
// equipo de servicio primero es un error clásico de análisis de
// supervivencia (infla la probabilidad de falla de cada causa individual,
// porque ignora que otra causa pudo "ganarle" antes). Competing Risks
// (riesgos competitivos, el estándar de confiabilidad para exactamente esta
// pregunta — "¿qué modo de falla es más probable que mate primero al
// equipo?") sí lo hace bien: separa los modos de falla reales
// (motor/transmisión/hidráulico/etc., ya clasificados) y estima, para cada
// uno, la probabilidad real de que sea LA PRÓXIMA falla que saque al equipo
// de servicio — información que Kaplan-Meier por componente no puede dar
// porque no compara causas entre sí.
//
// Estimador de Aalen-Johansen (el método no-paramétrico estándar para la
// Función de Incidencia Acumulada — CIF —, la misma referencia que reportan
// Minitab/R survival para "competing risks regression"): en cada tiempo de
// evento t_i (de CUALQUIER causa), CIF_k(t_i) = CIF_k(t_{i-1}) +
// S(t_{i-1})×(d_i,k/n_i), donde S es la supervivencia GLOBAL acumulada
// (todas las causas juntas, no por causa) HASTA ANTES de t_i, n_i = en
// riesgo, d_i,k = eventos de causa k exactamente en t_i. Después se
// actualiza S(t_i)=S(t_{i-1})×(1−d_i/n_i) con el total de eventos (todas
// las causas). Propiedad de conservación verificada con un caso de prueba
// a mano (script Python): Σ CIF_k(∞) + S(∞) = 1 exacto — todo el peso de
// la distribución se reparte entre "todavía no falló" y "falló por causa
// k", ninguna causa queda contada de más ni de menos.
function competingRisks(observaciones){
  var obs=(observaciones||[]).filter(function(o){return o&&o.tiempo>0;});
  if(obs.length<5)return null;
  var tiemposFalla=obs.filter(function(o){return !o.censurado;}).map(function(o){return o.tiempo;});
  if(!tiemposFalla.length)return null;
  var tiemposUnicos=Array.from(new Set(tiemposFalla)).sort(function(a,b){return a-b;});
  var causas=Array.from(new Set(obs.filter(function(o){return !o.censurado;}).map(function(o){return o.causa;})));
  var s=1,cifAcum={};
  causas.forEach(function(c){cifAcum[c]=0;});
  var curva=[];
  tiemposUnicos.forEach(function(t){
    var enRiesgo=obs.filter(function(o){return o.tiempo>=t;}).length;
    if(enRiesgo<=0)return;
    var eventosEnT=obs.filter(function(o){return !o.censurado&&o.tiempo===t;});
    var dTotal=eventosEnT.length;
    var porCausaEnT={};
    eventosEnT.forEach(function(o){porCausaEnT[o.causa]=(porCausaEnT[o.causa]||0)+1;});
    causas.forEach(function(c){
      var dk=porCausaEnT[c]||0;
      if(dk>0)cifAcum[c]+=s*(dk/enRiesgo);
    });
    s=s*(1-dTotal/enRiesgo);
    var snap={};
    causas.forEach(function(c){snap[c]=Math.round(cifAcum[c]*1000)/1000;});
    curva.push({tiempo:t,enRiesgo:enRiesgo,dTotal:dTotal,supervivenciaGlobal:Math.round(s*1000)/1000,cif:snap});
  });
  if(!curva.length)return null;
  var cifFinal={};
  causas.forEach(function(c){cifFinal[c]=Math.round(cifAcum[c]*1000)/1000;});
  var ranking=causas.map(function(c){return{causa:c,cif:cifFinal[c]};}).sort(function(a,b){return b.cif-a.cif;});
  return{
    n:obs.length,nFallas:tiemposFalla.length,nCensurados:obs.length-tiemposFalla.length,
    curva:curva,cifFinal:cifFinal,ranking:ranking,
    supervivenciaFinal:Math.round(s*1000)/1000
  };
}

// Arma las observaciones para competingRisks a partir de eventos reales de
// TODA la flota — a diferencia de kaplanMeierCorrectivosPorComponente/
// mcfCorrectivosPorComponente/rulHibridoPorComponente (que agrupan por
// sigla+componente porque comparan la vida de UN componente contra sí
// mismo entre equipos), acá se agrupa SOLO por sigla (equipo): dentro de
// cada equipo se ordenan TODAS sus fallas reales (de cualquier
// componente) por horómetro, y cada intervalo sucesivo es una
// observación con la causa siendo el componente que falló al final de
// ese intervalo — la pregunta es "de todo lo que le puede pasar a este
// equipo, ¿qué pasó primero después de la reparación anterior?", así que
// hay que mirar TODOS los componentes de un mismo equipo juntos, no uno
// a la vez. Mismo criterio de censura que el resto de la familia
// Kaplan-Meier: si el equipo sigue en servicio después de su última
// falla registrada, ese tramo final es censurado (sin causa, sin
// invención). No segmenta por tipo/modelo de equipo — quien llama puede
// pre-filtrar 'eventos'/'eq' si quiere un análisis por tipo de equipo.
function competingRisksPorEquipo(eventos,eq){
  var porEquipo={};
  (eventos||[]).forEach(function(e){
    if(!e||!e.componente||!(e.horom>0)||!e.sigla)return;
    (porEquipo[e.sigla]=porEquipo[e.sigla]||[]).push({horom:e.horom,componente:e.componente});
  });
  var eqPorSigla={};
  (eq||[]).forEach(function(x){if(x&&x.sigla)eqPorSigla[x.sigla]=x;});
  var observaciones=[];
  Object.keys(porEquipo).forEach(function(sigla){
    var ordenados=porEquipo[sigla].slice().sort(function(a,b){return a.horom-b.horom;});
    for(var i=1;i<ordenados.length;i++){
      var t=ordenados[i].horom-ordenados[i-1].horom;
      if(t>0)observaciones.push({tiempo:t,causa:ordenados[i].componente,censurado:false});
    }
    var eqObj=eqPorSigla[sigla];
    var ultimo=ordenados[ordenados.length-1];
    if(eqObj&&eqObj.horomActual>ultimo.horom){
      var tCens=eqObj.horomActual-ultimo.horom;
      if(tCens>0)observaciones.push({tiempo:tCens,causa:null,censurado:true});
    }
  });
  return competingRisks(observaciones);
}

// ═══ MCF — MEAN CUMULATIVE FUNCTION (2026-09-16) ═══
// Segunda mitad del par "Kaplan-Meier + MCF" (orden de prioridad elegido
// por el usuario). Kaplan-Meier (arriba) mide tiempo hasta la PRIMERA
// falla de cada componente — una vez que falló, ese equipo ya no aporta
// más información a la curva. Pero un componente que se repara y sigue en
// servicio puede volver a fallar (evento RECURRENTE) — eso es lo que
// Weibull y Kaplan-Meier de este archivo no capturan (ambos tratan cada
// intervalo/observación como independiente, perdiendo la trayectoria
// completa de cada equipo). MCF (Nelson, análisis de eventos recurrentes
// — el mismo método que reportan Minitab/ReliaSoft como "Recurrence
// Analysis") estima el número ACUMULADO ESPERADO de fallas de ese
// componente por equipo, en función del horómetro — responde "¿cuántas
// fallas de Motor debería esperar, en promedio, un equipo de este tipo a
// las X horas?", el insumo real para presupuestar repuestos/mano de obra
// a futuro, algo que ni el MTBF simple ni Weibull contestan directamente.
//
// Fórmula clásica (estimador de Nelson + su varianza, misma referencia
// que Kaplan-Meier/Greenwood arriba): en cada horómetro t_i donde ocurrió
// al menos una falla, M̂(t_i) = M̂(t_{i-1}) + d_i/n_i, con n_i = sistemas
// (equipos) aún "bajo observación" en t_i (su fin de observación es
// ≥t_i) y d_i = total de fallas exactamente en t_i, sumadas entre todos
// esos sistemas. Var(M̂(t)) = Σ_{t_i≤t} (1/n_i²)·Σ_j (d_ij−d̄_i)², donde
// d_ij es la cantidad de fallas del sistema j exactamente en t_i (casi
// siempre 0 o 1) y d̄_i=d_i/n_i — la varianza de Nelson para MCF, no la
// misma fórmula de Greenwood de Kaplan-Meier (son estimadores distintos:
// KM estima una probabilidad que nunca supera 1, MCF estima un conteo
// acumulado que no tiene techo).
//
// 'sistemas': [{fin, eventos:[horom,...]}] — fin = horómetro hasta donde
// ese sistema estuvo bajo observación (su censura), eventos = horómetros
// donde falló dentro de esa ventana. Eje de "edad" = horómetro absoluto
// (no calendario): asume que el horómetro arranca en 0 cuando el equipo
// entra en servicio nuevo — la misma asunción que ya usa el resto del
// sistema (Torre de Control, programa de PM), no una fecha de instalación
// de componente que este sistema no registra de forma confiable.
function mcf(sistemas){
  var sis=(sistemas||[]).filter(function(s){return s&&s.fin>0;}).map(function(s){
    return{fin:s.fin,eventos:(s.eventos||[]).filter(function(t){return t>0&&t<=s.fin;})};
  });
  var todosEventos=[];
  sis.forEach(function(s){todosEventos=todosEventos.concat(s.eventos);});
  if(todosEventos.length<5)return null;
  var tiemposUnicos=Array.from(new Set(todosEventos)).sort(function(a,b){return a-b;});
  var m=0,varAcum=0;
  var curva=[];
  tiemposUnicos.forEach(function(t){
    var enEstudio=sis.filter(function(s){return s.fin>=t;});
    var n=enEstudio.length;
    if(n<=0)return;
    var conteos=enEstudio.map(function(s){
      return s.eventos.filter(function(x){return x===t;}).length;
    });
    var d=conteos.reduce(function(a,b){return a+b;},0);
    var dbar=d/n;
    m+=dbar;
    var sumSqDev=conteos.reduce(function(acc,dij){return acc+Math.pow(dij-dbar,2);},0);
    varAcum+=sumSqDev/(n*n);
    var se=Math.sqrt(varAcum);
    curva.push({
      tiempo:t,enEstudio:n,fallas:d,
      mcf:Math.round(m*1000)/1000,
      ic90Min:Math.max(0,Math.round((m-1.645*se)*1000)/1000),
      ic90Max:Math.round((m+1.645*se)*1000)/1000
    });
  });
  if(!curva.length)return null;
  return{
    nSistemas:sis.length,
    nFallas:todosEventos.length,
    curva:curva,
    mcfFinal:curva[curva.length-1].mcf
  };
}

// MCF por componente, a nivel FLOTA — mismo agrupamiento sigla+componente
// que kaplanMeierCorrectivosPorComponente (arriba), pero en vez de
// intervalos entre fallas sucesivas, usa la trayectoria completa de cada
// equipo (todas sus fallas de ese componente dentro de su ventana de
// observación) — el insumo que MCF necesita para tratar eventos
// recurrentes. 'eq' se usa SOLO para leer horomActual (fin de
// observación real); sin ese dato, el fin de observación es la última
// falla registrada (nunca se inventa un tramo de observación adicional).
function mcfCorrectivosPorComponente(eventos,eq){
  var porCompEquipo={};
  (eventos||[]).forEach(function(e){
    if(!e||!e.componente||!(e.horom>0)||!e.sigla)return;
    porCompEquipo[e.componente]=porCompEquipo[e.componente]||{};
    (porCompEquipo[e.componente][e.sigla]=porCompEquipo[e.componente][e.sigla]||[]).push(e.horom);
  });
  var eqPorSigla={};
  (eq||[]).forEach(function(x){if(x&&x.sigla)eqPorSigla[x.sigla]=x;});
  return Object.keys(porCompEquipo).sort().map(function(comp){
    var porEquipo=porCompEquipo[comp];
    var sistemas=Object.keys(porEquipo).map(function(sigla){
      var horoms=porEquipo[sigla].filter(function(h){return h>0;}).sort(function(a,b){return a-b;});
      var eqObj=eqPorSigla[sigla];
      var ultimaFalla=horoms[horoms.length-1];
      var fin=(eqObj&&eqObj.horomActual>ultimaFalla)?eqObj.horomActual:ultimaFalla;
      return{sigla:sigla,fin:fin,eventos:horoms};
    });
    return{componente:comp,nEquipos:sistemas.length,mcf:mcf(sistemas)};
  });
}

// ═══ CROW-AMSAA — TENDENCIA DE LA TASA DE FALLAS (2026-09-16) ═══
// Tercer ítem del orden de prioridad elegido por el usuario, tras
// Kaplan-Meier+MCF. Ninguna de las herramientas anteriores contesta "¿la
// confiabilidad está mejorando o empeorando con el tiempo?": Weibull
// ajusta una forma fija a una muestra ya cerrada, Kaplan-Meier mide
// supervivencia hasta la primera falla, MCF acumula fallas esperadas — los
// tres miran una foto, no una tendencia en el tiempo calendario. Crow-AMSAA
// (ley de potencia no homogénea de Poisson, el estándar de "reliability
// growth analysis" de MIL-HDBK-189, el mismo método detrás del gráfico de
// Duane que reportan Minitab/ReliaSoft) modela el conteo acumulado de
// fallas N(t)=λ·t^β sobre el eje de TIEMPO CALENDARIO (no horómetro, la
// pregunta acá es de gestión/proceso, no de desgaste físico de una pieza):
// β&lt;1 = las fallas se están espaciando (mejorando), β≈1 = tasa estable,
// β&gt;1 = las fallas se están juntando (empeorando, revisar causa raíz o
// calidad del repuesto/proveedor).
//
// Estimador de máxima verosimilitud (MIL-HDBK-189, dato censurado en el
// tiempo — T es "hoy", no la última falla, porque el proceso sigue
// observándose después de la última falla registrada):
// β̂=n/Σln(T/t_i), λ̂=n/T^β̂. Con muestras chicas (el caso típico acá) el
// MLE de β tiene un sesgo positivo conocido — con datos simulados de un
// proceso realmente estable (β verdadero=1, n=8) el estimador crudo
// promedia ~1.14, no 1 — por eso se aplica la corrección estándar de
// MIL-HDBK-189 para dato censurado en el tiempo, β̂_corregido=β̂×(n-1)/n
// (verificado con simulación: reduce el promedio a ~0.99 en el mismo
// escenario). IC90 vía aproximación normal asintótica del MLE
// (SE(β̂)≈β̂/√n, misma convención z=1.645 del resto del archivo) — más
// simple que el intervalo exacto de chi-cuadrado de MIL-HDBK-189, pero
// sin agregar una segunda tabla de valores críticos al archivo.
function crowAMSAA(dias,horizonteDias){
  var validos=(dias||[]).filter(function(t){return t>0;}).sort(function(a,b){return a-b;});
  var n=validos.length;
  if(n<5)return null;
  var T=(horizonteDias>0?horizonteDias:0);
  if(T<validos[n-1])T=validos[n-1];
  var sumLn=0;
  validos.forEach(function(t){sumLn+=Math.log(T/t);});
  if(!(sumLn>0))return null;
  var betaCrudo=n/sumLn;
  var beta=betaCrudo*(n-1)/n;
  var lambda=n/Math.pow(T,beta);
  var se=beta/Math.sqrt(n);
  var betaMin=Math.max(0,Math.round((beta-1.645*se)*1000)/1000);
  var betaMax=Math.round((beta+1.645*se)*1000)/1000;
  var tendencia=betaMax<1?'mejorando':betaMin>1?'empeorando':'sin_certeza';
  return{
    n:n,T:T,
    beta:Math.round(beta*1000)/1000,
    lambda:Math.round(lambda*100000)/100000,
    ic90:{betaMin:betaMin,betaMax:betaMax},
    tendencia:tendencia
  };
}

function interpretacionCrowAMSAA(tendencia){
  if(tendencia==='mejorando')return 'Las fallas se están espaciando en el tiempo — la confiabilidad está mejorando';
  if(tendencia==='empeorando')return 'Las fallas se están juntando en el tiempo — la confiabilidad está empeorando, revisar causa raíz o calidad del repuesto/proveedor';
  return 'Sin certeza estadística todavía sobre si la tendencia mejora o empeora (el IC90 de β cruza 1)';
}

// Crow-AMSAA por componente, a nivel FLOTA — junta las fechas de falla de
// TODOS los equipos con ese componente en un solo proceso de llegadas (el
// método de "dato agrupado" de MIL-HDBK-189 para flotas de sistemas
// reparables similares), no un ajuste por equipo. Eje de tiempo = días
// calendario desde la primera falla registrada de ESE componente (+1 para
// que t_1 nunca sea 0), hasta 'hoy' (o el 'hoy' pasado por parámetro, para
// tests deterministas — mismo patrón que dispEquipoMes/simulacionMonteCarlo).
function crowAMSAAPorComponente(eventos,hoy){
  var porComp={};
  (eventos||[]).forEach(function(e){
    if(!e||!e.componente||!e.fecha)return;
    (porComp[e.componente]=porComp[e.componente]||[]).push(e.fecha);
  });
  var hoyISO=hoy||new Date().toISOString().slice(0,10);
  var hoyDate=new Date(hoyISO+'T00:00:00');
  return Object.keys(porComp).sort().map(function(comp){
    var fechas=porComp[comp].slice().sort();
    var ref=new Date(fechas[0]+'T00:00:00');
    var dias=fechas.map(function(f){
      var d=new Date(f+'T00:00:00');
      return Math.round((d-ref)/86400000)+1;
    });
    var horizonte=Math.round((hoyDate-ref)/86400000)+1;
    return{componente:comp,n:dias.length,crow:crowAMSAA(dias,horizonte)};
  });
}

// ═══ ÍNDICE DE EFECTIVIDAD DEL MANTENIMIENTO (2026-09-16) ═══
// Cuarto ítem del segundo lote de algoritmos "nivel siguiente" (reemplaza a
// "Actualización Bayesiana de Weibull" en el orden original — ver nota de
// la sección de RUL sobre por qué se descartó). Ninguna herramienta
// anterior contesta la pregunta de gestión real: "¿el mantenimiento
// preventivo está funcionando, o solo generamos trabajo?". Crow-AMSAA mide
// tendencia calendario, pero no distingue SI hubo un PM real de por medio —
// acá sí: compara, para cada equipo con PM realmente ejecutados
// (registros_pm con fecha real), el intervalo hasta la falla siguiente
// ANTES de cada PM contra el intervalo hasta la falla siguiente DESPUÉS de
// ese mismo PM. Si el mantenimiento preventivo funciona, el equipo debería
// tardar MÁS en volver a fallar después de un PM que antes — si no hay
// diferencia real (o el intervalo se acorta), el PM no está aportando lo
// que se espera de él.
//
// Método: comparación de medianas antes/después (mismo principio ya
// establecido en este archivo por edadVirtualEquipo, que compara 2 mitades
// de una serie de intervalos con medianaPositiva) — deliberadamente MÁS
// SIMPLE que ajustar Crow-AMSAA por separado a cada segmento (la cantidad
// real de PM ejecutados por equipo, 288 registros con fecha real
// confirmados contra la base de producción, no da muestra para dos ajustes
// de máxima verosimilitud separados con la confianza suficiente — una
// comparación de medianas es más robusta con esa muestra). ratio =
// medianaDespués/medianaAntes: &gt;1 el intervalo se alarga (el PM ayuda),
// cerca de 1 sin diferencia real, &lt;1 se acorta (el PM no está
// resolviendo la causa real, o llega tarde/mal).
function indiceEfectividadMantenimiento(fallas,pmEjecutados){
  var porEquipoFallas={};
  (fallas||[]).forEach(function(f){
    if(!f||!f.sigla||!f.fecha)return;
    (porEquipoFallas[f.sigla]=porEquipoFallas[f.sigla]||[]).push(f.fecha);
  });
  var porEquipoPM={};
  (pmEjecutados||[]).forEach(function(p){
    if(!p||!p.sigla||!p.fecha)return;
    (porEquipoPM[p.sigla]=porEquipoPM[p.sigla]||[]).push(p.fecha);
  });
  var intervalosAntes=[],intervalosDespues=[];
  Object.keys(porEquipoPM).forEach(function(sigla){
    var fallasEq=(porEquipoFallas[sigla]||[]).slice().sort();
    var pmsEq=porEquipoPM[sigla].slice().sort();
    pmsEq.forEach(function(fechaPM){
      var antes=fallasEq.filter(function(f){return f<fechaPM;});
      var despues=fallasEq.filter(function(f){return f>fechaPM;});
      if(antes.length){
        var dA=_diasEntreISO(antes[antes.length-1],fechaPM);
        if(dA>0)intervalosAntes.push(dA);
      }
      if(despues.length){
        var dD=_diasEntreISO(fechaPM,despues[0]);
        if(dD>0)intervalosDespues.push(dD);
      }
    });
  });
  // Mínimo 5 intervalos de cada lado — mismo criterio de muestra mínima que
  // el resto del archivo (Weibull/aceiteOutliers/correlacionAceiteFallas).
  if(intervalosAntes.length<5||intervalosDespues.length<5)return null;
  var medAntes=medianaPositiva(intervalosAntes);
  var medDespues=medianaPositiva(intervalosDespues);
  if(!(medAntes>0))return null;
  var ratio=Math.round((medDespues/medAntes)*100)/100;
  var veredicto=ratio>=1.2?'efectivo':ratio<=0.8?'no_efectivo':'sin_diferencia_clara';
  // Mann-Whitney U (arriba): el ratio de arriba dice HACIA DÓNDE se movió la
  // mediana, pero no si ese movimiento es real o ruido de muestra chica —
  // mismo hueco que anovaUnFactor/logRankTest cerraron para otras
  // comparaciones de dos grupos. testEstadistico queda null con menos de 5
  // intervalos de cada lado (mismo mínimo ya exigido arriba, así que en la
  // práctica siempre corre si esta función no devolvió null antes).
  var testEstadistico=typeof mannWhitneyU==='function'?mannWhitneyU(intervalosAntes,intervalosDespues):null;
  return{
    nAntes:intervalosAntes.length,nDespues:intervalosDespues.length,
    medianaAntesDias:Math.round(medAntes),medianaDespuesDias:Math.round(medDespues),
    ratio:ratio,veredicto:veredicto,
    testEstadistico:testEstadistico
  };
}

function interpretacionEfectividadMantenimiento(veredicto){
  if(veredicto==='efectivo')return 'Los equipos tardan real y sostenidamente más en volver a fallar después de un PM — el mantenimiento preventivo está funcionando';
  if(veredicto==='no_efectivo')return 'No hay evidencia de que el mantenimiento preventivo alargue el tiempo hasta la próxima falla — revisar si la pauta ataca la causa real, o si el PM llega tarde/mal ejecutado';
  return 'Diferencia real pero no concluyente entre antes y después del PM — sin certeza todavía sobre si está funcionando';
}

// ═══ CORRELACIÓN ACEITE ↔ FALLAS REALES (2026-09-12) ═══
// Origen real: mirando el sistema desde los 4 roles de datos, después del
// IC90 (Científico) y de aceiteOutliers (Analista/BI, calidad de dato)
// quedaba la pregunta de fondo que todo el módulo de Análisis de Aceite da
// por sentada sin haberla probado nunca: ¿un aceite en ALERTA/PRECAUCIÓN
// realmente anticipa una falla real, o es una alarma que no se cumple? Antes
// de esto nadie lo había medido — solo se asumía. Se investigó primero si
// existía un cruce de vocabulario entre 'descriptor' (aceite, dropdown real
// #aComp: Motor/Transmisión/Hidráulico/Diferencial/Mando Final/Frenos) y
// 'componente' (correctivos, dropdown real #oComp) — coinciden en varias
// categorías (Motor, Transmisión, Diferencial, Frenos), normalizando
// mayúsculas/tildes; no se inventa ningún alias entre categorías que no
// coincidan textualmente (ej. "Hidráulico" no se fuerza a calzar con "Bomba
// hidráulica" — son dropdowns distintos, y forzarlo sería inventar un cruce
// que el dato real no sostiene).
// Compara, por cada categoría de componente, la tasa de "a esta muestra le
// siguió una falla real del mismo equipo+componente dentro de la ventana"
// entre las muestras en ALERTA/PRECAUCIÓN vs las que salieron NORMAL. Un
// 'lift' >1 (la tasa de ALERTA es más alta que la de NORMAL) es evidencia de
// que el análisis de aceite SÍ anticipa fallas reales para ese componente;
// cerca de 1 es evidencia de que hoy no está anticipando nada. Mínimo 5
// muestras de cada lado (mismo criterio de sample size que el resto de
// logic.js) antes de reportar una tasa — con menos, no se dice nada en vez
// de inventar un porcentaje sin base.
function _normComponente(s){
  return (s||'').toUpperCase().trim()
    .replace(/Á/g,'A').replace(/É/g,'E').replace(/Í/g,'I').replace(/Ó/g,'O').replace(/Ú/g,'U');
}
function correlacionAceiteFallas(ace,eventos,diasVentana){
  diasVentana=diasVentana>0?diasVentana:60;
  var fechasFallaPorGrupo={};
  (eventos||[]).forEach(function(e){
    if(!e||!e.sigla||!e.componente||!e.fecha)return;
    var k=e.sigla+'|'+_normComponente(e.componente);
    (fechasFallaPorGrupo[k]=fechasFallaPorGrupo[k]||[]).push(e.fecha);
  });
  var porComponente={};
  (ace||[]).forEach(function(m){
    if(!m||!m._sigla||!m.descriptor||!m.fecha)return;
    if(m.estado!=='ALERTA'&&m.estado!=='PRECAUCION'&&m.estado!=='NORMAL')return;
    var comp=_normComponente(m.descriptor);
    var fechasFalla=fechasFallaPorGrupo[m._sigla+'|'+comp]||[];
    var siguioFalla=fechasFalla.some(function(f){
      var dias=_diasEntreISO(m.fecha,f);
      return dias>=0&&dias<=diasVentana;
    });
    if(!porComponente[comp])porComponente[comp]={alertaTotal:0,alertaConFalla:0,normalTotal:0,normalConFalla:0};
    var g=porComponente[comp];
    if(m.estado==='NORMAL'){
      g.normalTotal++;
      if(siguioFalla)g.normalConFalla++;
    }else{
      g.alertaTotal++;
      if(siguioFalla)g.alertaConFalla++;
    }
  });
  var MIN=5;
  return Object.keys(porComponente).sort().map(function(comp){
    var g=porComponente[comp];
    var tasaAlerta=g.alertaTotal>=MIN?Math.round(g.alertaConFalla/g.alertaTotal*1000)/10:null;
    var tasaNormal=g.normalTotal>=MIN?Math.round(g.normalConFalla/g.normalTotal*1000)/10:null;
    var lift=(tasaAlerta!=null&&tasaNormal!=null&&tasaNormal>0)?Math.round(tasaAlerta/tasaNormal*100)/100:null;
    return{componente:comp,alertaTotal:g.alertaTotal,alertaConFalla:g.alertaConFalla,tasaAlerta:tasaAlerta,
      normalTotal:g.normalTotal,normalConFalla:g.normalConFalla,tasaNormal:tasaNormal,lift:lift};
  });
}

// R(t) real según el ajuste Weibull de arriba — mismo rol que confiabilidadReal
// pero con β/η propios del equipo en vez de asumir β=1. R(t)=e^(-(t/η)^β),
// la generalización de la fórmula exponencial (con β=1 da exactamente lo
// mismo que confiabilidadReal).
function confiabilidadWeibull(ajuste,horasPeriodo){
  if(!ajuste||horasPeriodo==null||horasPeriodo<0)return null;
  var r=Math.exp(-Math.pow(horasPeriodo/ajuste.eta,ajuste.beta));
  return Math.round(r*1000)/10;
}

// ═══ CONFIABILIDAD DE SISTEMA (RBD en serie) — 2026-09-20 ═══
// confiabilidadWeibull (arriba) da R(t) de UN componente/equipo desde t=0. Un
// camión es un sistema en SERIE: cualquier componente mayor que falle para la
// máquina completa — el mismo supuesto que ya usa esFallaMTBF/dispDownMap en
// todo el sistema (nunca se asume redundancia que no existe). La fórmula
// estándar de confiabilidad de sistema en serie (cualquier libro de RCM/
// Weibull++) es el PRODUCTO de las confiabilidades individuales:
// R_sistema(t) = R_1(t) × R_2(t) × ... × R_n(t).
//
// Cada componente además ya tiene ALGO de uso (no arranca en t=0) — se usa
// confiabilidad CONDICIONAL: dado que ya sobrevivió hasta su edad actual,
// ¿cuál es la probabilidad de sobrevivir 'horasPeriodo' más?
// R(edad+horas)/R(edad) — la forma correcta de combinar componentes usados,
// no la ingenua R(horas) desde cero, que ignoraría que ya llevan desgaste.
function _rWeibullRaw(ajuste,horasPeriodo){
  if(!ajuste||horasPeriodo==null||horasPeriodo<0||!(ajuste.eta>0)||!(ajuste.beta>0))return null;
  return Math.exp(-Math.pow(horasPeriodo/ajuste.eta,ajuste.beta));
}
function _confiabilidadCondicionalRaw(ajuste,edadActual,horasPeriodo){
  var rEdad=_rWeibullRaw(ajuste,edadActual);
  var rEdadMasPeriodo=_rWeibullRaw(ajuste,(edadActual||0)+horasPeriodo);
  if(rEdad==null||rEdadMasPeriodo==null||rEdad<=0)return null;
  return rEdadMasPeriodo/rEdad;
}
// 'componentes': [{comp:'Motor',horomComp:12000},...] — instalación ACTUAL de
// cada componente mayor de ESE equipo (mismos campos que compMayores).
// 'ajustesPorTipo': {comp:{beta,eta}} — ajuste Weibull con censura POR TIPO DE
// COMPONENTE a nivel flota (ver ajusteWeibullCorrectivosPorComponenteCensurado/
// analisisVidaUtilPorGrupoCensurado) — nunca se ajusta Weibull con la historia
// de un solo equipo (muestra casi siempre insuficiente), se reusa la forma
// real ya estimada con TODA la flota y se aplica a la edad de ESTE componente.
// Componentes sin ajuste real (tipo con <5 cambios/censuras en toda la flota)
// se EXCLUYEN del producto — nunca se inventa un β/η sin datos que lo sostengan.
function confiabilidadSistemaEquipo(componentes,ajustesPorTipo,horomActualEquipo,horasPeriodo){
  if(!componentes||!componentes.length||horasPeriodo==null||horasPeriodo<0)return null;
  var rProducto=1,usados=0;
  var detalle=[];
  componentes.forEach(function(c){
    if(!c||!c.comp)return;
    var ajuste=ajustesPorTipo&&ajustesPorTipo[c.comp];
    if(!ajuste)return;
    var edadActual=Math.max(0,(horomActualEquipo||0)-(c.horomComp||0));
    var ri=_confiabilidadCondicionalRaw(ajuste,edadActual,horasPeriodo);
    if(ri==null)return;
    rProducto*=ri;
    usados++;
    detalle.push({comp:c.comp,r:Math.round(ri*1000)/10,edadActual:Math.round(edadActual)});
  });
  if(usados===0)return null;
  return{
    rSistema:Math.round(rProducto*1000)/10,
    componentesUsados:usados,
    componentesTotal:componentes.length,
    detalle:detalle.sort(function(a,b){return a.r-b.r;}),
    horasPeriodo:horasPeriodo
  };
}

// Interpretación en palabras de β (2026-09-11, mismo pedido) — para que el
// número no quede suelto sin explicación de qué significa.
function interpretacionFormaWeibull(beta){
  if(beta==null)return null;
  if(beta<0.9)return 'Fallas tempranas — la tasa de falla BAJA con el uso (posible problema de instalación/rodaje)';
  if(beta<=1.1)return 'Fallas aleatorias — tasa de falla estable, no depende de la edad del componente';
  return 'Desgaste — la tasa de falla SUBE con el uso (esperable, priorizar reemplazo preventivo)';
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
// 'opts.incluirPM' (default true): false excluye el downtime de 'reg' (PM planificado),
// dejando solo el de 'ot' (correctivos = tabla 'correctivos', ver store.js) — es el mapa
// que usa dispIntrinsecaEquipoMes para la Disponibilidad Intrínseca (Ai), que responde
// "cuánto tiempo perdí SOLO por fallas" separado de "cuánto perdí por mantención que yo
// mismo programé" (Ao, la Disponibilidad de siempre, sigue incluyendo ambos por defecto).
function dispDownMap(reg, ot, hoy, opts){
  var incluirPM=!(opts&&opts.incluirPM===false);
  var down={};
  var hoyISO=hoy||new Date().toISOString().slice(0,10);
  function add(sigla,fecha,horas){ if(!sigla||!fecha)return; if(!down[sigla])down[sigla]={}; down[sigla][fecha]=(down[sigla][fecha]||0)+horas; }
  if(incluirPM)(reg||[]).forEach(function(r){
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
    // Ai (incluirPM:false, Disponibilidad Intrínseca — solo fallas reales): una salida de
    // servicio marcada EXPLÍCITAMENTE como NO falla real (criticidad presente y distinta
    // de 'Reparación Inmediata' — selector ssCriticidad en index.html, ej. sin repuesto,
    // logística, administrativo) no debe restar acá, aunque sí siga restando en Ao
    // (Disponibilidad Operacional), que cuenta cualquier causa de detención por diseño.
    // 'criticidad' AUSENTE (dato histórico previo a ese selector) sigue contando como
    // antes — no se reinterpreta silenciosamente un vacío como "no es falla". Auditoría
    // 2026-09-16, segunda pasada: el fix que agregó ese selector nunca llegó a este mapa.
    if(fs&&!incluirPM&&o.criticidad&&o.criticidad!=='Reparación Inmediata')return;
    if(fs&&o.fechaEntrada&&o.fechaSalida&&o.fechaSalida>o.fechaEntrada){
      rangoDias(o.fechaEntrada,o.fechaSalida).forEach(function(d){ add(sigla,d,24); });
      return;
    }
    if(fs&&o.fechaEntrada&&!o.fechaSalida&&o.fechaEntrada<=hoyISO){
      rangoDias(o.fechaEntrada,hoyISO).forEach(function(d){ add(sigla,d,24); });
      return;
    }
    var fecha=o.fecha||o.fechaEntrada||''; if(!fecha)return;
    // Bug real (auditoría 2026-09-14): 'duracion' llega como texto "0h 32min"
    // para reparaciones reales de menos de 1 hora (ot.js:569,581) — el regex
    // matchea "0h" y parseInt da 0, un dato REAL medido. Pero '0' es falsy en
    // JS: 'if(!durH)durH=8' descartaba ese dato real y lo reemplazaba por 8h
    // asumidas, silenciosamente — no es el caso de "sin duración registrada"
    // (que el resto del sistema sí asume con honestidad), es un dato real
    // siendo tirado. Se distingue "el regex no matcheó nada" (sin dato) de
    // "matcheó y dio 0" (dato real, se respeta).
    var durH=null; if(o.duracion){ var m=String(o.duracion).match(/(\d+)h/); if(m)durH=parseInt(m[1]); }
    if(durH==null)durH=8; // supuesto SOLO si de verdad no hay duración registrada
    if(fs)durH=24;   // fuera de servicio de un solo día
    add(sigla,fecha,durH);
  });
  return down;
}

// Promedia el % de disponibilidad día a día de un mes a partir de un downMap ya armado
// (dispDownMap) — loop compartido por dispEquipoMes (Ao) y dispIntrinsecaEquipoMes (Ai),
// para que ambas midan el mismo mes de la misma forma y solo difieran en qué downMap
// reciben. Devuelve null si no hay ningún día con dato (para distinguir "sin datos" de "0%").
function _dispPctDesdeMapa(sigla, mes, downMap, hrsDia, hoyISO){
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

// Disponibilidad OPERACIONAL (Ao) mensual de un equipo (%). Prioridad: override manual
// (dispCalc) > dato original de abril (dAbr) > cálculo automático día a día desde el
// downMap. Devuelve null si no hay ningún dato (para distinguir "sin datos" de "0%").
function dispEquipoMes(sigla, mes, opts){
  opts=opts||{};
  var dispCalc=opts.dispCalc||{}, dAbr=opts.dAbr||{}, downMap=opts.downMap||{};
  var hrsDia=opts.hrsDia||12, hoyISO=opts.hoy||new Date().toISOString().slice(0,10);
  if(dispCalc[sigla]&&dispCalc[sigla][mes]!==undefined)return dispCalc[sigla][mes];
  if(mes==='2026-04'&&dAbr[sigla]!==undefined)return dAbr[sigla];
  return _dispPctDesdeMapa(sigla, mes, downMap, hrsDia, hoyISO);
}

// Disponibilidad INTRÍNSECA (Ai) mensual de un equipo (%) — mismo cálculo que
// dispEquipoMes pero recibe un downMap armado con dispDownMap(reg,ot,hoy,{incluirPM:false})
// (solo fallas reales, sin el tiempo de PM planificado). La brecha Ao−Ai es la pregunta
// real de gerencia: ¿la disponibilidad baja por fallas, o por la mantención que la propia
// empresa programó? (Predictiva21, terminología RAM: Ao = operacional, Ai = intrínseca).
// No usa overrides manuales (dispCalc/dAbr) porque esos representan un Ao ya mezclado a
// mano — no hay forma de separar de ahí cuánto era PM y cuánto era falla.
function dispIntrinsecaEquipoMes(sigla, mes, opts){
  opts=opts||{};
  var downMapCorrectivo=opts.downMapCorrectivo||{};
  var hrsDia=opts.hrsDia||12, hoyISO=opts.hoy||new Date().toISOString().slice(0,10);
  return _dispPctDesdeMapa(sigla, mes, downMapCorrectivo, hrsDia, hoyISO);
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
  if(dias<=30)return{label:'🟡 Vence en '+dias+'d',color:'var(--warn)',dias:dias,requiereAtencion:true};
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

// ═══ FILTRO DE OUTLIERS EN ANÁLISIS DE ACEITE (2026-09-12) ═══
// Origen real: mirando el sistema desde los 4 roles de datos (Ingeniero,
// Analista, Científico, BI), un hueco quedó pendiente — ordenesSinOutliers
// (arriba) es la ÚNICA detección de errores de digitación que existe en todo
// el sistema, y solo cubre costos. Un análisis de aceite con un cero de más
// en el hierro (ej. 500 en vez de 50 ppm) hoy se clasifica igual que un
// desgaste real: nadie lo distingue de una alerta genuina, y ese dato erróneo
// puede terminar contaminando cualquier análisis que use aceite (Torre de
// Control, Índice de Salud, y cualquier correlación futura entre aceite y
// fallas reales). Mismo criterio que ordenesSinOutliers (mediana de la MISMA
// categoría, mínimo 5 muestras para una mediana confiable) pero exige DOS
// señales a la vez, no una sola: (1) el valor es 10x o más la mediana
// histórica de ese metal en ESE tipo de aceite (descriptor — no 'componente',
// que es texto libre por equipo) Y (2) el valor supera además 2x el umbral
// fijo de alerta ya usado en la tabla (metalCell, ace.js) — un desgaste real
// severo puede superar la mediana igual sin ser un error de digitación; exigir
// ambas condiciones evita marcar como "posible error" una alerta genuina.
// Nunca modifica 'estado' ni borra nada — solo separa para revisión humana,
// mismo espíritu que ordenesSinOutliers.
var _ACEITE_UMBRAL_METAL={hierro:50,cobre:30,plomo:20,aluminio:20,silicio:25,cromo:10};
function aceiteOutliers(ace){
  var metales=Object.keys(_ACEITE_UMBRAL_METAL);
  var porGrupoMetal={};
  (ace||[]).forEach(function(m){
    if(!m||!m.descriptor)return;
    metales.forEach(function(met){
      if(m[met]>0)(porGrupoMetal[m.descriptor+'|'+met]=porGrupoMetal[m.descriptor+'|'+met]||[]).push(m[met]);
    });
  });
  var medianaPorGrupoMetal={};
  Object.keys(porGrupoMetal).forEach(function(k){
    if(porGrupoMetal[k].length<5)return;
    medianaPorGrupoMetal[k]=medianaPositiva(porGrupoMetal[k]);
  });
  var outliers=[];
  (ace||[]).forEach(function(m){
    if(!m||!m.descriptor)return;
    metales.forEach(function(met){
      if(!(m[met]>0))return;
      var mediana=medianaPorGrupoMetal[m.descriptor+'|'+met];
      if(mediana!=null&&m[met]>10*mediana&&m[met]>2*_ACEITE_UMBRAL_METAL[met]){
        outliers.push({muestra:m,metal:met,valor:m[met],mediana:mediana});
      }
    });
  });
  return outliers;
}

// ═══ DISTANCIA DE MAHALANOBIS — OUTLIERS MULTIVARIADOS DE ACEITE (2026-09-20) ═══
// aceiteOutliers (arriba) revisa cada metal POR SEPARADO contra la
// mediana de su propio grupo. El hueco real: una muestra puede tener
// hierro, cobre y cromo cada uno "normal" individualmente, pero la
// COMBINACIÓN de los tres ser una señal de desgaste real que ningún
// chequeo metal-por-metal detecta — la Distancia de Mahalanobis es la
// técnica estándar para esto (muy usada en análisis de aceite/monitoreo
// de condición real, no solo teoría): en vez de comparar cada metal
// contra su propio umbral, mide qué tan lejos está la combinación
// completa de metales de una muestra respecto del centro real de su
// grupo, usando la matriz de covarianza real (cómo los metales suelen
// moverse juntos), no un promedio ingenuo por separado.
// D² = (x−μ)ᵀ Σ⁻¹ (x−μ) sigue una distribución chi-cuadrado con k grados
// de libertad (k = cantidad de metales) — reusa DIRECTAMENTE la tabla
// _CHI2_CRITICO_95 ya existente (misma que usa logRankTest/
// testChiCuadradoUniforme), sin inventar un umbral nuevo.
// Solo usa muestras con TODOS los metales presentes (nunca completa un
// dato faltante) y exige harto historial por grupo — estimar una matriz
// de covarianza necesita bastante más muestra que una mediana simple;
// _MAHALANOBIS_MIN_MUESTRAS (15, elegido a propósito conservador) y
// además siempre más muestras que dimensiones (n>k, condición matemática
// para que la covarianza sea invertible).
// Verificado independientemente con Python/numpy/scipy: (1) la inversión
// de matriz por Gauss-Jordan (_invertirMatriz) coincide con
// numpy.linalg.inv a 6 decimales; (2) con un dataset determinístico de 16
// muestras "normales" + 1 outlier combinado (cada metal individualmente
// dentro de rango, combinación real inusual), el outlier inyectado da
// D²≈15.06 (por encima del umbral χ²95%,gl=6≈12.592) y ninguna de las 16
// muestras normales lo supera (máximo real ≈9.02).
var _MAHALANOBIS_MIN_MUESTRAS=15;
function _invertirMatriz(A){
  var n=A.length;
  var M=A.map(function(fila,i){return fila.concat(fila.map(function(_,j){return i===j?1:0;}));});
  for(var col=0;col<n;col++){
    var pivotRow=col;
    for(var r=col+1;r<n;r++)if(Math.abs(M[r][col])>Math.abs(M[pivotRow][col]))pivotRow=r;
    if(Math.abs(M[pivotRow][col])<1e-10)return null;
    var tmp=M[col];M[col]=M[pivotRow];M[pivotRow]=tmp;
    var piv=M[col][col];
    for(var j=0;j<2*n;j++)M[col][j]/=piv;
    for(var r2=0;r2<n;r2++){
      if(r2===col)continue;
      var factor=M[r2][col];
      for(var j2=0;j2<2*n;j2++)M[r2][j2]-=factor*M[col][j2];
    }
  }
  return M.map(function(fila){return fila.slice(n);});
}
function _covarianzaMuestral(muestras){
  var n=muestras.length,k=muestras[0].length;
  var media=new Array(k).fill(0);
  muestras.forEach(function(fila){fila.forEach(function(v,j){media[j]+=v;});});
  media=media.map(function(s){return s/n;});
  var cov=[];
  for(var i=0;i<k;i++)cov.push(new Array(k).fill(0));
  muestras.forEach(function(fila){
    for(var i2=0;i2<k;i2++)for(var j2=0;j2<k;j2++)cov[i2][j2]+=(fila[i2]-media[i2])*(fila[j2]-media[j2]);
  });
  for(var i3=0;i3<k;i3++)for(var j3=0;j3<k;j3++)cov[i3][j3]/=(n-1);
  return{media:media,cov:cov};
}
function outliersMultivariadosAceite(ace,minMuestras){
  var min=minMuestras||_MAHALANOBIS_MIN_MUESTRAS;
  var metales=Object.keys(_ACEITE_UMBRAL_METAL);
  var k=metales.length;
  var porGrupo={};
  (ace||[]).forEach(function(m){
    if(!m||!m.descriptor)return;
    var completo=metales.every(function(met){return m[met]>0;});
    if(!completo)return;
    (porGrupo[m.descriptor]=porGrupo[m.descriptor]||[]).push(m);
  });
  var resultado=[];
  Object.keys(porGrupo).sort().forEach(function(desc){
    var muestras=porGrupo[desc];
    if(muestras.length<=k||muestras.length<min)return;
    var filas=muestras.map(function(m){return metales.map(function(met){return m[met];});});
    var cr=_covarianzaMuestral(filas);
    var inv=_invertirMatriz(cr.cov);
    if(!inv)return;
    var umbral=_CHI2_CRITICO_95[k];
    if(umbral==null)return;
    var outliers=[];
    muestras.forEach(function(m,idx){
      var fila=filas[idx];
      var diff=fila.map(function(v,j){return v-cr.media[j];});
      var d2=0;
      for(var i=0;i<k;i++){
        var acc=0;
        for(var j=0;j<k;j++)acc+=diff[j]*inv[i][j];
        d2+=diff[i]*acc;
      }
      if(d2>umbral)outliers.push({muestra:m,d2:Math.round(d2*1000)/1000});
    });
    resultado.push({
      descriptor:desc,n:muestras.length,metales:metales,umbralChi2:umbral,
      outliers:outliers.sort(function(a,b){return b.d2-a.d2;})
    });
  });
  return resultado;
}

// ═══ CUSUM — DETECCIÓN DE ACELERACIÓN DE DESGASTE EN ACEITE (2026-09-16) ═══
// Quinto y último ítem del orden de prioridad elegido por el usuario. Lo
// que YA existe en Análisis de Aceite mira cada muestra SOLA: 'estado'
// (NORMAL/PRECAUCION/ALERTA) es un umbral fijo puntual, y aceiteOutliers
// (arriba) busca un valor absurdamente alto en UNA muestra (error de
// digitación). Ninguno de los dos ve una tendencia sostenida: varias
// muestras SEGUIDAS levemente por encima de lo normal para ESE equipo —
// cada una, sola, puede no cruzar el umbral fijo de alerta — pero juntas
// significan que el desgaste se está acelerando de verdad. Es el mismo
// hueco que "alertas persistentes" (arriba en ace.js) detecta a medias
// (2 muestras seguidas en ALERTA/PRECAUCION), pero acotado a que alguien
// ya haya marcado ambas como problema — un CUSUM lo ve directo en los
// números, sin depender de que 'estado' esté bien puesto.
//
// cusumAceite(valores) asume que 'valores' YA viene en orden CRONOLÓGICO
// (el llamador es responsable de ordenar por fecha antes de pasarlo acá —
// ver cusumAceitePorComponente, abajo, que hace exactamente eso): un
// rango móvil sobre datos desordenados no significa nada.
//
// CUSUM (suma acumulativa, control de procesos — Montgomery, "Introduction
// to Statistical Quality Control", el método estándar de la industria
// para detectar un corrimiento sostenido de la media, no un valor puntual
// fuera de rango) de UN SOLO LADO: acá solo importa que el metal SUBA
// (desgaste), nunca que baje. μ0 = mediana histórica de ESE metal para
// ESE equipo+componente (robusta a un outlier suelto, ya separado por
// aceiteOutliers). σ se estima con el RANGO MÓVIL promedio entre muestras
// consecutivas (σ=MR̄/1,128, d2 estándar para subgrupos de 2 — el método
// de Montgomery para "individuals charts" sin subgrupos racionales), NO
// con la varianza muestral de toda la serie: la varianza simple se infla
// con la propia aceleración que se está buscando (el corrimiento real
// termina inflando su propio umbral de detección y se vuelve invisible —
// verificado con un caso de prueba real donde la varianza simple daba
// σ=11 y NUNCA detectaba, contra σ=4 con rango móvil que sí detecta en el
// punto correcto). k (holgura) = 0.5σ y h (umbral de decisión) = 4σ son
// los valores de tabla estándar de la literatura de control de procesos
// (ARL≈168 en control, la misma referencia que ya se usa para el
// z=1.645/t-críticos de Weibull en este archivo) — no números elegidos a
// mano. C_i = max(0, C_{i-1} + (x_i - μ0 - k)); se dispara cuando C_i
// supera h.
function cusumAceite(valores){
  var validos=(valores||[]).filter(function(v){return v>0;});
  var n=validos.length;
  if(n<6)return null;
  var mu0=medianaPositiva(validos);
  var rangosMoviles=[];
  for(var i=1;i<n;i++)rangosMoviles.push(Math.abs(validos[i]-validos[i-1]));
  var mrBarra=rangosMoviles.reduce(function(s,x){return s+x;},0)/rangosMoviles.length;
  var sigma=mrBarra/1.128;
  if(!(sigma>0))return null;
  var k=0.5*sigma,h=4*sigma;
  var c=0,curva=[],indiceAlerta=null;
  validos.forEach(function(v,i){
    c=Math.max(0,c+(v-mu0-k));
    curva.push({indice:i,valor:v,cusum:Math.round(c*100)/100});
    if(indiceAlerta==null&&c>h)indiceAlerta=i;
  });
  return{
    n:n,
    mu0:Math.round(mu0*100)/100,
    sigma:Math.round(sigma*100)/100,
    k:Math.round(k*100)/100,
    h:Math.round(h*100)/100,
    curva:curva,
    indiceAlerta:indiceAlerta,
    detectado:indiceAlerta!=null
  };
}

// CUSUM por equipo+componente+metal, a nivel de cada instancia real (no
// pooled entre equipos — el desgaste de ESE motor se compara contra su
// propia historia, no contra la de otro equipo). 'ace' = muestras de
// analisis_aceite ya con m._sigla resuelto (_aceiteResolverSiglas,
// ace.js) — se agrupa por sigla+componente (mismo criterio que "alertas
// persistentes" en ace.js), ordenado por fecha, y se corre cusumAceite
// para cada uno de los 6 metales de desgaste ya trackeados
// (_ACEITE_UMBRAL_METAL, arriba). Solo devuelve grupos con al menos un
// metal con historial suficiente (nunca null en todos).
// Pendiente promedio (unidades de metal por DÍA calendario) entre la primera
// y la última muestra de una lista YA ordenada cronológicamente — usa solo
// los extremos (no una regresión completa) a propósito: con pocas muestras
// por tramo (el caso típico acá, antes/después de una alerta CUSUM) una
// regresión de mínimos cuadrados es más sensible a un solo punto ruidoso que
// la pendiente extremo a extremo, y acá solo se necesita la dirección y
// magnitud gruesa del cambio, no un ajuste fino.
function _pendienteEntreMuestras(muestras){
  if(!muestras||muestras.length<2)return null;
  var d0=new Date(muestras[0].fecha+'T00:00:00');
  var dN=new Date(muestras[muestras.length-1].fecha+'T00:00:00');
  var dias=(dN-d0)/86400000;
  if(!(dias>0))return null;
  return(muestras[muestras.length-1].valor-muestras[0].valor)/dias;
}

function cusumAceitePorComponente(ace){
  var metales=Object.keys(_ACEITE_UMBRAL_METAL);
  var porGrupo={};
  (ace||[]).forEach(function(m){
    var sigla=(m&&m._sigla||'').trim(),comp=(m&&m.componente||'').trim();
    if(!m||!sigla||!comp||!m.fecha)return;
    var k=sigla+'|'+comp;
    (porGrupo[k]=porGrupo[k]||{sigla:sigla,componente:comp,muestras:[]}).muestras.push(m);
  });
  var resultado=[];
  Object.keys(porGrupo).sort().forEach(function(k){
    var g=porGrupo[k];
    var ordenadas=g.muestras.slice().sort(function(a,b){return a.fecha<b.fecha?-1:a.fecha>b.fecha?1:0;});
    var porMetal={},tieneAlguno=false;
    metales.forEach(function(met){
      var conValor=ordenadas.filter(function(m){return m[met]>0;});
      var vals=conValor.map(function(m){return m[met];});
      var r=cusumAceite(vals);
      if(r){
        // Fecha real de la muestra donde se disparó la alerta, para mostrarla.
        r.fechaAlerta=r.indiceAlerta!=null?conValor[r.indiceAlerta].fecha:null;
        // Factor de aceleración real (2026-09-16, para RUL híbrido — ver
        // rulHibridoPorComponente): compara la pendiente real (metal/día)
        // ANTES vs DESPUÉS del punto donde CUSUM detectó la aceleración,
        // usando fechas reales (no el índice ordinal de la muestra, que
        // asumiría muestreo uniforme en el tiempo — falso en la realidad).
        // Acotado a [0,1] con el mismo estilo que ya usa edadVirtualEquipo
        // (arriba) para su factorQ: 0 = sin diferencia real de pendiente,
        // se acerca a 1 cuanto más grande es el salto real de velocidad de
        // desgaste. Si la pendiente "antes" no era positiva (desgaste
        // estable o bajando hasta ese punto), el salto es máximo (factor=1)
        // — no hay pendiente previa positiva contra la cual comparar.
        if(r.indiceAlerta!=null){
          var antes=conValor.slice(0,r.indiceAlerta+1).map(function(m){return{fecha:m.fecha,valor:m[met]};});
          var despues=conValor.slice(r.indiceAlerta).map(function(m){return{fecha:m.fecha,valor:m[met]};});
          var pAntes=_pendienteEntreMuestras(antes);
          var pDespues=_pendienteEntreMuestras(despues);
          if(pAntes!=null&&pDespues!=null&&pDespues>0){
            r.pendienteAntes=Math.round(pAntes*1000)/1000;
            r.pendienteDespues=Math.round(pDespues*1000)/1000;
            r.factorAceleracion=Math.round(Math.max(0,Math.min(1,pAntes<=0?1:(pDespues-pAntes)/pDespues))*100)/100;
          }
        }
        tieneAlguno=true;
      }
      porMetal[met]=r;
    });
    if(tieneAlguno)resultado.push({sigla:g.sigla,componente:g.componente,porMetal:porMetal});
  });
  return resultado;
}

// ═══ RUL HÍBRIDO — VIDA ÚTIL REMANENTE (Weibull + tendencia real de aceite,
// 2026-09-16) ═══
// Primer ítem del segundo orden de prioridad elegido por el usuario ("nivel
// siguiente"). Ninguna herramienta anterior contesta "¿cuántas horas le
// quedan de verdad a ESTE componente de ESTE equipo?": Weibull da la forma
// de la distribución de vida de la CATEGORÍA de componente a nivel flota,
// Kaplan-Meier/MCF miran supervivencia/conteo acumulado, Crow-AMSAA mira
// tendencia calendario. RUL (Remaining Useful Life) es el estándar de la
// industria de mantenimiento predictivo (CBM — condition-based maintenance)
// para la pregunta operativa real: "¿cuándo conviene programar el cambio?".
//
// Base matemática (Weibull, vida remanente condicional — el mismo principio
// detrás de las "vidas B10/B50" que reporta cualquier software de
// confiabilidad, aplicado acá como REMANENTE desde la edad actual t, no
// desde cero): dado que el componente sobrevivió hasta t, el tiempo
// adicional Δt tal que P(falla en [t,t+Δt] | sobrevivió a t)=p cumple
// R(t+Δt)/R(t)=1-p, que para Weibull tiene forma cerrada:
// Δt = η·[(t/η)^β − ln(1−p)]^(1/β) − t
// p=0.10 (B10 remanente) = estimación CONSERVADORA, el valor que ya usa la
// industria como "vida de diseño" — acá recomendado como el horizonte para
// programar el reemplazo. p=0.50 (B50 remanente) = estimación típica/mediana,
// el rango de incertidumbre real entre ambos es lo que pidió el usuario
// ("horas estimadas restantes con rango de incertidumbre"), no un número
// puntual que aparente más certeza de la que hay.
function rulWeibull(ajuste,edadActual,p){
  if(!ajuste||!(ajuste.beta>0)||!(ajuste.eta>0))return null;
  if(edadActual==null||edadActual<0||!(p>0)||!(p<1))return null;
  var inner=Math.pow(edadActual/ajuste.eta,ajuste.beta)-Math.log(1-p);
  if(!(inner>=0))return null;
  var tTotal=ajuste.eta*Math.pow(inner,1/ajuste.beta);
  return Math.max(0,Math.round((tTotal-edadActual)*10)/10);
}

// Combina el RUL base de Weibull (arriba) con la tendencia real de desgaste
// de aceite (cusumAceitePorComponente) para AJUSTAR la edad efectiva del
// componente cuando hay evidencia real de que se está desgastando más rápido
// que su propio historial — nunca cuando no hay esa evidencia (sin CUSUM
// detectado, o sin datos de aceite suficientes, el RUL queda igual al de
// Weibull puro, sin inventar un ajuste). edadEfectiva = edadActual×(1+factor),
// con factor∈[0,1] (nunca más que duplicar la edad efectiva) — mismo criterio
// de acotamiento que factorQ de edadVirtualEquipo. Con varios metales con
// aceleración detectada para el mismo componente, se usa el MAYOR factor
// (el metal que muestra la señal más fuerte manda — nunca se promedia hacia
// abajo una alerta real).
function rulHibridoComponente(ajuste,edadActual,cusumPorMetal){
  var base={b10:rulWeibull(ajuste,edadActual,0.10),b50:rulWeibull(ajuste,edadActual,0.50)};
  var mejorFactor=0,metalCausante=null;
  Object.keys(cusumPorMetal||{}).forEach(function(met){
    var r=cusumPorMetal[met];
    if(r&&r.detectado&&r.factorAceleracion>mejorFactor){
      mejorFactor=r.factorAceleracion;
      metalCausante=met;
    }
  });
  if(mejorFactor<=0||base.b10==null){
    return{b10:base.b10,b50:base.b50,ajustadoPorAceite:false,b10Ajustado:base.b10,b50Ajustado:base.b50,factorAceleracion:0,metalCausante:null};
  }
  var edadEfectiva=edadActual*(1+mejorFactor);
  return{
    b10:base.b10,b50:base.b50,
    ajustadoPorAceite:true,
    b10Ajustado:rulWeibull(ajuste,edadEfectiva,0.10),
    b50Ajustado:rulWeibull(ajuste,edadEfectiva,0.50),
    factorAceleracion:mejorFactor,
    metalCausante:metalCausante
  };
}

// Arma el RUL híbrido para cada instancia real equipo+componente — mismo
// agrupamiento sigla+componente que kaplanMeierCorrectivosPorComponente/
// mcfCorrectivosPorComponente (arriba), Weibull pooled a nivel flota por
// categoría de componente (analisisVidaUtilCorrectivosPorComponente, ya
// exige ≥5 intervalos), edad actual = horómetro actual del equipo menos su
// última falla registrada de ese componente (mismo criterio de censura que
// ya usa Kaplan-Meier). Sin ajuste de Weibull para esa categoría, o sin
// horómetro actual del equipo, esa instancia se omite — nunca se inventa
// un RUL sin ambos datos reales.
function rulHibridoPorComponente(eventos,eq,ace){
  var ajustePorComponente={};
  analisisVidaUtilCorrectivosPorComponente(eventos).forEach(function(g){
    ajustePorComponente[g.grupo]=g.ajuste;
  });
  var cusumPorGrupo={};
  cusumAceitePorComponente(ace).forEach(function(g){
    cusumPorGrupo[g.sigla+'|'+g.componente]=g.porMetal;
  });
  var porEquipoComp={};
  (eventos||[]).forEach(function(e){
    if(!e||!e.componente||!(e.horom>0)||!e.sigla)return;
    var k=e.sigla+'|'+e.componente;
    (porEquipoComp[k]=porEquipoComp[k]||{sigla:e.sigla,componente:e.componente,horoms:[]}).horoms.push(e.horom);
  });
  var eqPorSigla={};
  (eq||[]).forEach(function(x){if(x&&x.sigla)eqPorSigla[x.sigla]=x;});
  var resultado=[];
  Object.keys(porEquipoComp).sort().forEach(function(k){
    var g=porEquipoComp[k];
    var ajuste=ajustePorComponente[g.componente];
    if(!ajuste)return;
    var eqObj=eqPorSigla[g.sigla];
    if(!eqObj||!(eqObj.horomActual>0))return;
    var validos=g.horoms.filter(function(h){return h>0;}).sort(function(a,b){return a-b;});
    var ultimaFalla=validos[validos.length-1];
    var edadActual=eqObj.horomActual-ultimaFalla;
    if(!(edadActual>=0))return;
    var rul=rulHibridoComponente(ajuste,edadActual,cusumPorGrupo[k]);
    if(rul.b10==null)return;
    resultado.push(Object.assign({sigla:g.sigla,componente:g.componente,edadActual:edadActual},rul));
  });
  return resultado.sort(function(a,b){return(a.b10Ajustado!=null?a.b10Ajustado:a.b10)-(b.b10Ajustado!=null?b.b10Ajustado:b.b10);});
}

// ═══ MANTENIMIENTO OPORTUNISTA MULTI-COMPONENTE (2026-09-17) ═══ Tercer
// ítem del tercer lote. Idea real de mantenimiento oportunista (estándar de
// la industria — "group maintenance under opportunities"): si un equipo va
// a parar igual porque un componente está por fallar, conviene aprovechar
// esa MISMA parada para adelantar el cambio de otros componentes que ya
// están cerca de su propio fin de vida — evita una segunda parada
// independiente para lo mismo dentro de poco. Reusa el RUL híbrido ya
// construido (rulHibridoPorComponente) — ninguna medición nueva, solo se
// cruza contra sí mismo por equipo.
//
// El "ahorro" NO asume un costo de falla inventado (Cf sigue bloqueado por
// falta de dato real — ver Edad de Reemplazo Óptima/VoI, ambos declarados
// bloqueados esta sesión). Es más acotado y sí 100% real: el costo de
// MANO DE OBRA de una parada de mantenimiento adicional que se evita —
// duración real mediana de una intervención (duracionesReparacionFlotaHoras,
// ya existente) × tarifa HH real configurada (tarifa_hh, ya usada en todo
// el resto de la app para costos de mano de obra: kpi.js, metas.js, etc.).
// Ninguno de los dos números se inventa para esta función — ambos ya
// existían con otro propósito.
//
// El horizonte de "cuán cerca es cerca" para bundlear NO es un umbral
// arbitrario nuevo: se usa frecPM del propio equipo (cada cuánto se
// planifica su mantenimiento real) — si otro componente le queda más de un
// ciclo de PM de vida remanente respecto al que dispara la parada, todavía
// falta demasiado para que valga la pena adelantarlo.
function _rulEfectivoComponente(r){return r&&(r.b10Ajustado!=null?r.b10Ajustado:r.b10);}

// Evalúa UN equipo a la vez: 'componentesEquipo' es el subconjunto de
// rulHibridoPorComponente para ESE equipo (mismo sigla). Requiere al menos
// 2 componentes con RUL real — con solo 1 no hay nada que agrupar.
// Devuelve null si ninguno cae dentro del horizonte del que dispara la
// parada (el que tiene el RUL más bajo).
function oportunidadMantenimiento(componentesEquipo,horizonHoras,ahorroPorStop){
  var validos=(componentesEquipo||[]).filter(function(c){return c&&c.componente&&_rulEfectivoComponente(c)!=null&&_rulEfectivoComponente(c)>=0;});
  if(validos.length<2||!(horizonHoras>0))return null;
  var ordenados=validos.slice().sort(function(a,b){return _rulEfectivoComponente(a)-_rulEfectivoComponente(b);});
  var disparador=ordenados[0];
  var rulDisparador=_rulEfectivoComponente(disparador);
  var candidatos=ordenados.slice(1).filter(function(c){return _rulEfectivoComponente(c)-rulDisparador<=horizonHoras;});
  if(!candidatos.length)return null;
  return{
    disparador:{componente:disparador.componente,rul:Math.round(rulDisparador)},
    candidatos:candidatos.map(function(c){return{componente:c.componente,rul:Math.round(_rulEfectivoComponente(c)),diferenciaHoras:Math.round(_rulEfectivoComponente(c)-rulDisparador)};}),
    nCandidatos:candidatos.length,
    ahorroEstimado:Math.round(candidatos.length*(ahorroPorStop||0))
  };
}

// Versión a nivel FLOTA: agrupa rulHibridoPorComponente por equipo y evalúa
// cada uno con su propio frecPM real como horizonte. 'ot' se usa solo para
// la duración mediana real de intervención (duracionesReparacionFlotaHoras)
// — el mismo insumo que ya usa el Monte Carlo de disponibilidad. 'tarifaHH'
// es el valor real configurado (tarifa_hh) — se recibe como parámetro
// porque este archivo no lee la store directamente. Sin duración mediana
// real o sin tarifa configurada (>0), devuelve [] — nunca se inventa un
// ahorro con datos faltantes. Equipos sin frecPM real (>0) se omiten: sin
// ese dato no hay horizonte real de planificación para decidir "qué tan
// cerca es cerca".
function oportunidadesMantenimientoFlota(rulLista,eq,ot,tarifaHH){
  var medianaDuracion=medianaPositiva(duracionesReparacionFlotaHoras(ot));
  if(medianaDuracion==null||!(tarifaHH>0))return[];
  var ahorroPorStop=medianaDuracion*tarifaHH;
  var eqPorSigla={};
  (eq||[]).forEach(function(e){if(e&&e.sigla)eqPorSigla[e.sigla]=e;});
  var porSigla={};
  (rulLista||[]).forEach(function(r){if(r&&r.sigla)(porSigla[r.sigla]=porSigla[r.sigla]||[]).push(r);});
  var resultado=[];
  Object.keys(porSigla).sort().forEach(function(sigla){
    var eObj=eqPorSigla[sigla];
    if(!eObj||!(eObj.frecPM>0))return;
    var op=oportunidadMantenimiento(porSigla[sigla],eObj.frecPM,ahorroPorStop);
    if(op)resultado.push(Object.assign({sigla:sigla},op));
  });
  return resultado.sort(function(a,b){return b.nCandidatos-a.nCandidatos||b.ahorroEstimado-a.ahorroEstimado;});
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

// ═══ DEMANDA DE REPUESTOS — DISTRIBUCIÓN DE POISSON (2026-09-13) ═══
// Origen real: llevando la misma disciplina estadística de Weibull hacia
// otra pregunta real del sistema. stockEstado (arriba) decide "cuántos
// meses de cobertura quedan" dividiendo el stock por 'consumoMes' — un
// número FIJO tipeado a mano (ver stk.js) que nunca refleja que la demanda
// real varía mes a mes. Pero sí existe un registro real y fechado de cada
// consumo (movimientos_stock, generado automáticamente al descontar stock
// en cada PM — nunca a mano) que hoy solo alimenta el "Consumido"
// acumulado y el gasto proyectado ($), nunca la variabilidad real de la
// demanda. Poisson es la distribución estándar de teoría de inventario
// para "cantidad de unidades demandadas en un período" cuando la demanda
// viene de eventos discretos e independientes (cada PM que gasta un
// filtro) — exactamente el patrón real de este sistema.
//
// Detalle importante: 'movimientos_stock' solo registra consumo REAL —
// nunca hay una fila con cant=0 para un mes sin consumo de un ítem. Si se
// dividiera el total consumido por "cantidad de meses CON alguna fila",
// se ignorarían los meses de consumo cero y λ saldría inflado. Por eso el
// denominador es la cantidad de meses TOTALES observados por todo el
// sistema (desde el primer movimiento registrado hasta el último), no la
// cantidad de meses con movimiento de ESE ítem en particular.
// Suma de logaritmos en vez de producto directo (auditoría 2026-09-16, hallazgo real):
// la versión anterior calculaba Math.pow(lambda,k)/factorial(k) en aritmética normal —
// para λ y k moderadamente grandes (λ≳129, ej. un repuesto genérico consumido por buena
// parte de una flota grande) Math.pow(lambda,k) desborda a Infinity ANTES de dividirse
// por el factorial, y _stockParaNivelServicio (que acumula término a término hasta
// cruzar el 95%) corta apenas encuentra ese Infinity — devolviendo un stock de
// seguridad MUY por debajo del correcto, en silencio, sin ningún NaN/error visible.
// log(k!) se acumula como suma de logaritmos (nunca desborda, crece linealmente) y solo
// se exponencia el resultado final — mismo valor matemático, sin el desborde intermedio.
function _logFactorial(n){
  var r=0;
  for(var i=2;i<=n;i++)r+=Math.log(i);
  return r;
}
function _poissonPMF(k,lambda){
  if(lambda==null||!isFinite(lambda)||lambda<0||k<0)return null;
  if(lambda===0)return k===0?1:0;
  return Math.exp(-lambda+k*Math.log(lambda)-_logFactorial(k));
}
// Menor cantidad Q tal que P(demanda mensual ≤ Q) ≥ nivelServicio — la
// pregunta real de bodega: "¿cuánto stock cubre el X% de los meses sin
// quebrar?". Se acumula la PMF de Poisson término a término (sin librería
// externa) hasta cruzar el umbral.
function _stockParaNivelServicio(lambda,nivelServicio){
  var meta=(nivelServicio>0&&nivelServicio<1)?nivelServicio:0.95;
  var acumulado=0;
  for(var k=0;k<500;k++){
    acumulado+=_poissonPMF(k,lambda);
    if(acumulado>=meta)return k;
  }
  return 500;
}
// ═══ MODELO DE COLAS M/M/c — DOTACIÓN DE TALLER (2026-09-20) ═══
// Dotación de Taller hoy solo compara dotación real vs. carga de trabajo
// con tendencia — sin ningún modelo matemático detrás. Un taller es,
// matemáticamente, un sistema de colas: correctivos que llegan (arribos
// Poisson, tasa λ real), técnicos que los atienden (servidores en
// paralelo, c = dotación real), cada uno tardando un tiempo de reparación
// real (tasa de servicio μ=1/MTTR real). M/M/c (fórmula de Erlang C) es
// el modelo estándar de investigación operativa para esto — responde algo
// que hoy nadie contesta: con la dotación ACTUAL, ¿cuánto tiempo espera en
// promedio una OT antes de que un técnico la tome, y qué tan saturado está
// el taller?
// a = λ/μ (carga ofrecida, en "Erlangs"). ρ = a/c (utilización) — el
// sistema es inestable (cola crece sin límite) si ρ≥1, se devuelve null
// (nunca se muestra un tiempo de espera infinito o negativo).
// Los términos a^k/k! se acumulan por RAZÓN SUCESIVA (term_k =
// term_{k-1}×a/k) en vez de factoriales crudos — mismo motivo que ya
// forzó corregir _poissonPMF (auditoría 2026-09: factoriales grandes
// desbordan) — acá se evita el problema de raíz, sin necesitar log-espacio.
// Verificado dos veces de forma independiente: (1) analíticamente, el caso
// c=1 se reduce exactamente a la fórmula clásica de M/M/1 (Wq=ρ/(μ−λ));
// (2) numéricamente, contra la recursión de Erlang B (b(0)=1,
// b(n)=a·b(n-1)/(n+a·b(n-1)), C=c·b(c)/(c−a·(1−b(c)))) — un algoritmo
// completamente distinto, estándar en telecomunicaciones, que coincide a
// 10+ decimales con el cálculo directo en varios casos.
// Nunca sugiere una dotación "ideal": solo reporta las métricas reales
// para el c actual. ρ>0.85 (regla de bolsillo estándar de teoría de
// colas, no inventada) marca saturación.
function modeloColasMMC(lambda,mu,c){
  if(!(lambda>0)||!(mu>0)||!(c>0))return null;
  c=Math.round(c);
  var a=lambda/mu;
  var rho=a/c;
  if(rho>=1)return null;
  var term=1,sumB=term;
  for(var k=1;k<c;k++){term=term*a/k;sumB+=term;}
  var termC=term*a/c;
  var numer=termC*c/(c-a);
  var denom=sumB+numer;
  var probEspera=numer/denom;
  var tiempoEsperaHoras=probEspera/(c*mu-lambda);
  var numeroEnCola=lambda*tiempoEsperaHoras;
  var tiempoTotalHoras=tiempoEsperaHoras+1/mu;
  var numeroEnSistema=lambda*tiempoTotalHoras;
  return{
    a:Math.round(a*100)/100,
    rho:Math.round(rho*1000)/1000,
    probEspera:Math.round(probEspera*1000)/1000,
    tiempoEsperaHoras:Math.round(tiempoEsperaHoras*100)/100,
    numeroEnCola:Math.round(numeroEnCola*100)/100,
    tiempoTotalHoras:Math.round(tiempoTotalHoras*100)/100,
    numeroEnSistema:Math.round(numeroEnSistema*100)/100,
    saturado:rho>0.85
  };
}

// ═══ BAYES EMPÍRICO (SHRINKAGE GAMMA-POISSON) — TASAS DE FALLA CON POCO
// HISTORIAL (2026-09-20) ═══
// Todo lo construido en esta sesión es frecuentista (tests de hipótesis,
// MLE, regresión, cartas de control, colas). Esto es un enfoque distinto:
// un equipo con pocas fallas registradas hoy o se EXCLUYE (mínimo de
// muestra) o muestra un número puntual con un intervalo de confianza
// enorme — el Bayes Empírico es la técnica estándar para este problema
// exacto (la misma que usan aseguradoras — "credibility theory" — y
// estadística deportiva: el promedio de bateo de un jugador con pocos
// turnos al bate no se muestra crudo ni se descarta, se combina con el
// promedio de la liga). En vez de nada o un número que probablemente está
// lejos de la realidad, da una estimación ESTABILIZADA que combina el
// dato propio (poco, pero real) con lo que ya se sabe de toda la flota.
//
// Modelo: cada tasa de falla real λ_i (fallas por hora de exposición) se
// asume proveniente de una Gamma(α,β) común a toda la flota — los
// hiperparámetros se estiman de los propios datos por método de momentos
// (nunca inventados a mano). Para conteos Poisson n_i sobre exposición
// t_i: μ̂ = Σn_i/Σt_i (tasa pooled). La varianza observada de las tasas
// crudas r_i=n_i/t_i mezcla la varianza REAL entre equipos con el ruido
// de muestreo Poisson propio de cada uno — se resta ese ruido esperado
// (μ̂×k/Σt_i) para aislar la varianza real: σ²_entre = S² − μ̂×k/Σt_i. Si
// sale ≤0 (sin heterogeneidad real detectable más allá del ruido), se cae
// a "shrinkage total" — todos los equipos con la tasa de flota, nunca se
// inventa una diferencia que no existe. Si no, α=μ̂²/σ²_entre,
// β=μ̂/σ²_entre (Gamma con media μ̂, varianza σ²_entre), y la estimación
// final por equipo es la media posterior: λ̂_i=(α+n_i)/(β+t_i) — con poca
// exposición propia pesa más el promedio de flota, con mucha converge al
// dato propio.
//
// Verificado por SIMULACIÓN (técnica distinta a las verificaciones
// anteriores de esta sesión, pero igual de rigurosa): se generaron datos
// sintéticos desde una Gamma conocida, se simularon conteos Poisson con
// exposiciones muy heterogéneas (mismo problema real: equipos con mucho
// vs. poco historial) — el método recupera los hiperparámetros reales, y
// el estimador con shrinkage reduce el error cuadrático medio ~26%
// respecto de la tasa cruda frente a los valores reales conocidos de la
// simulación — el beneficio clásico y documentado de este tipo de
// estimador (mismo fenómeno que la paradoja de Stein).
// Mínimo 5 grupos con exposición real (mismo umbral mínimo del resto de
// esta sesión): con menos, la varianza entre grupos no es estimable con
// confianza.
function bayesEmpiricoGammaPoisson(grupos){
  var validos=(grupos||[]).filter(function(g){return g&&g.exposicion>0&&g.n!=null&&g.n>=0;});
  var k=validos.length;
  if(k<5)return null;
  var sumN=validos.reduce(function(s,g){return s+g.n;},0);
  var sumT=validos.reduce(function(s,g){return s+g.exposicion;},0);
  if(!(sumT>0))return null;
  var mu=sumN/sumT;
  var s2=validos.reduce(function(s,g){var r=g.n/g.exposicion;return s+g.exposicion*(r-mu)*(r-mu);},0)/sumT;
  var sigma2Entre=s2-mu*k/sumT;
  var fullShrink=!(sigma2Entre>0);
  var alpha=null,beta=null;
  if(!fullShrink){alpha=(mu*mu)/sigma2Entre;beta=mu/sigma2Entre;}
  var detalle=validos.map(function(g){
    var tasaCruda=g.n/g.exposicion;
    var tasaEstabilizada=fullShrink?mu:(alpha+g.n)/(beta+g.exposicion);
    return{
      id:g.id,n:g.n,exposicion:g.exposicion,
      tasaCruda:Math.round(tasaCruda*100000)/100000,
      tasaEstabilizada:Math.round(tasaEstabilizada*100000)/100000,
      mtbfEstabilizado:tasaEstabilizada>0?Math.round(1/tasaEstabilizada):null
    };
  });
  return{
    k:k,mu:Math.round(mu*100000)/100000,
    sigma2Entre:fullShrink?0:Math.round(sigma2Entre*1e8)/1e8,
    alpha:alpha!=null?Math.round(alpha*1000)/1000:null,
    beta:beta!=null?Math.round(beta*1000)/1000:null,
    fullShrink:fullShrink,
    detalle:detalle
  };
}

function _contarMesesEntre(mesIni,mesFin){
  if(!mesIni||!mesFin)return 0;
  var a=mesIni.split('-').map(Number),b=mesFin.split('-').map(Number);
  if(a.length<2||b.length<2||a.some(isNaN)||b.some(isNaN))return 0;
  return (b[0]-a[0])*12+(b[1]-a[1])+1;
}
// Mínimo 3 meses de historial ANTES de reportar nada — con menos, un
// promedio mensual es puro ruido, no una demanda real medida.
var _DEMANDA_MIN_MESES=3;
// Denominador de λ (auditoría 2026-09, corrige un hallazgo real sin reabrir el
// que este mismo cálculo ya evitó una vez, ver test "no ignora meses de
// consumo cero" en analisisDemandaRepuestos.test.js): el FIN del período
// sigue siendo el último mes observado por TODO el sistema (mesFinSistema) —
// eso preserva el criterio original de no ignorar los meses de consumo cero
// de un ítem que ya existía. Pero el INICIO ahora es el primer mes con
// movimiento de CADA ítem, no el primer mes del sistema completo — antes, un
// repuesto agregado recientemente (ej. sistema con 24 meses de historial,
// ítem nuevo con solo 2 meses de vida) diluía su consumo real entre 24 meses
// en vez de los 2 que realmente lleva trackeado, subestimando su demanda
// real. Meses ANTES de que el ítem existiera ya no cuentan como "demanda
// cero" — no son un dato real, es que el ítem todavía no se rastreaba.
function analisisDemandaRepuestos(movimientos){
  var todos=(movimientos||[]).filter(function(m){return m&&m.nParte&&m.mes;});
  if(!todos.length)return[];
  var mesesSistema=todos.map(function(m){return m.mes;}).sort();
  var mesFinSistema=mesesSistema[mesesSistema.length-1];
  var porNParte={};
  todos.forEach(function(m){
    var g=(porNParte[m.nParte]=porNParte[m.nParte]||{});
    g[m.mes]=(g[m.mes]||0)+(m.cant||0);
  });
  return Object.keys(porNParte).sort().map(function(nParte){
    var porMes=porNParte[nParte];
    var mesInicioItem=Object.keys(porMes).sort()[0];
    var mesesTotales=_contarMesesEntre(mesInicioItem,mesFinSistema);
    if(mesesTotales<_DEMANDA_MIN_MESES)return{nParte:nParte,nMeses:mesesTotales,lambda:null};
    var total=Object.keys(porMes).reduce(function(s,mes){return s+porMes[mes];},0);
    var lambda=total/mesesTotales;
    var p0=_poissonPMF(0,lambda);
    return{
      nParte:nParte,
      nMeses:mesesTotales,
      lambda:Math.round(lambda*100)/100,
      probSinConsumo:Math.round(p0*1000)/1000,
      probAlMenosUno:Math.round((1-p0)*1000)/1000,
      stockSeguridad95:_stockParaNivelServicio(lambda,0.95)
    };
  });
}

// ═══ PROYECCIÓN DE CONSUMO DE ELEMENTOS DE DESGASTE — GET/CUCHILLAS (2026-09-23) ═══
// Pedido del usuario: un comparativo real de cuánto se consume/compra en
// elementos de desgaste (cuchillas, entrecalzas/entredientes, cantoneras,
// ripper, zapatas, rodillos, oruga/cadena, deslizaderas, canilleras,
// punteras) por semana/mes/semestre/año, para proyectar compra — mismo tipo
// de pregunta que ya responde analisisDemandaRepuestos para repuestos con
// nParte, pero acá el dato real no vive en movimientos_stock (nadie carga
// estos cambios como movimiento de stock con nParte) sino en el texto libre
// de "síntoma" de Correctivos.
//
// Se agrupa por TIPO de equipo + PIEZA específica (2026-09-24, corrección
// pedida por el usuario tras revisar el primer Excel de esta misma
// proyección: "Y NI TIENE CAMBIO DE CANTONERA, PUNTERA, CUCHILLA... O RIPPER
// DE BULLDOZER" — juntar todo en una sola categoría por tipo de equipo era
// mezclar piezas que se compran por separado y a precio distinto). Por eso
// usa _SUBPIEZAS_DESGASTE, un clasificador PROPIO y más fino que
// _CATEGORIAS_COMPONENTE — ese último junta cuchilla/entrecalza/ripper/
// canillera bajo 'GET / Cuchillas' y zapata/rodillo/oruga bajo 'Tren de
// Rodaje', que es la categorización correcta para el resto del sistema
// (Kaplan-Meier, MCF, Crow-AMSAA agrupan por MODO DE FALLA), pero acá hace
// falta la PIEZA concreta a comprar, no el modo de falla.
//
// λ real = eventos reales ÷ meses de historial real de ESA pieza en ESE tipo
// de equipo (mismo _DEMANDA_MIN_MESES que el resto de la familia demanda —
// nunca se proyecta con menos de 3 meses NI con menos de 3 eventos). El
// consumo (semana/mes/semestre/año) se redondea siempre a número entero
// (Math.round): no se compra media cuchilla — mismo criterio verificado a
// mano contra el Excel que ya validó el usuario. "lambda" (la tasa
// cambios/mes) sí queda con decimales porque es un promedio estadístico, no
// una cantidad a comprar.
//
// No calcula costo: ningún repuesto de este tipo tiene precioUnit real
// cargado en Stock hoy — mostrar un $ inventado sería peor que no mostrar
// nada; la proyección es de CANTIDAD real, verificable contra el historial.
var _SUBPIEZAS_DESGASTE=[
  ['Cuchilla',['cuchilla','cuchillo','cuchillos']],
  ['Ripper',['ripper','riper']],
  ['Cantonera',['cantonera']],
  ['Entrecalza',['entrecalza']],
  ['Entrediente/GETS',['entrediente','gets']],
  ['Canillera',['canillera']],
  ['Puntera',['puntera']],
  ['Zapata',['zapata']],
  ['Rodillo',['rodillo']],
  ['Oruga/Cadena',['oruga']],
  ['Deslizadera',['deslizadera']]
];
function _subpiezasDeSintoma(sintoma){
  var s=(sintoma||'').toLowerCase();
  var out=[];
  for(var i=0;i<_SUBPIEZAS_DESGASTE.length;i++){
    var nombre=_SUBPIEZAS_DESGASTE[i][0],keys=_SUBPIEZAS_DESGASTE[i][1];
    for(var j=0;j<keys.length;j++){
      if(s.indexOf(keys[j])!==-1){out.push(nombre);break;}
    }
  }
  return out;
}
function proyeccionElementosDesgaste(correctivos,equipos){
  var tipoPorSigla={};
  (equipos||[]).forEach(function(e){if(e&&e.sigla)tipoPorSigla[e.sigla]=e.tipo||'';});
  var grupos={};
  (correctivos||[]).forEach(function(c){
    if(!c||!c.sigla||!c.fecha)return;
    var tipo=tipoPorSigla[c.sigla];
    if(!tipo)return;
    _subpiezasDeSintoma(c.sintoma).forEach(function(pieza){
      var k=tipo+'|'+pieza;
      (grupos[k]=grupos[k]||{tipo:tipo,pieza:pieza,meses:[]}).meses.push(c.fecha.slice(0,7));
    });
  });
  return Object.keys(grupos).map(function(k){
    var g=grupos[k];
    var meses=g.meses.slice().sort();
    var nEventos=meses.length;
    var mesInicio=meses[0],mesFin=meses[meses.length-1];
    var nMeses=_contarMesesEntre(mesInicio,mesFin);
    if(nMeses<_DEMANDA_MIN_MESES||nEventos<3){
      return{tipo:g.tipo,pieza:g.pieza,nEventos:nEventos,nMeses:nMeses,lambda:null,
        consumoSemana:null,consumoMes:null,consumoSemestre:null,consumoAnual:null};
    }
    var lambda=nEventos/nMeses;
    return{
      tipo:g.tipo,
      pieza:g.pieza,
      nEventos:nEventos,
      nMeses:nMeses,
      lambda:Math.round(lambda*100)/100,
      consumoSemana:Math.round(lambda/30*7),
      consumoMes:Math.round(lambda),
      consumoSemestre:Math.round(lambda*6),
      consumoAnual:Math.round(lambda*12)
    };
  }).sort(function(a,b){return (b.lambda||0)-(a.lambda||0);});
}

// ═══ MATRIZ DE CRITICIDAD DE REPUESTOS AVANZADA (2026-09-16) ═══
// Tercer ítem del segundo lote de algoritmos "nivel siguiente". stockEstado
// (arriba) ya decide "cuántos meses de cobertura quedan" con un criterio
// DETERMINÍSTICO (meses de cobertura < meses de lead time = COMPRAR) — no
// dice CUÁNTO RIESGO real hay de quebrar antes de que llegue la reposición,
// ni cuánto DUELE si pasa. Esta matriz combina 4 señales, todas ya
// existentes en el sistema, sin inventar ninguna nueva: Poisson (demanda
// real, analisisDemandaRepuestos arriba), lead time real (repuestos/stock),
// criticidad del equipo que lo usa (eq.criticidad) y stock actual — en la
// misma matriz Probabilidad×Impacto ya establecida (probabilidadComponente/
// umbralesImpacto/impactoDeValor/nivelRiesgoPxI, sección 36), aplicada acá
// a un dominio nuevo (repuestos) con una Probabilidad más rigurosa que las
// bandas cualitativas de probabilidadStockQuiebre.
//
// P(quiebre en la ventana de reposición) — a diferencia de stockEstado
// (que solo compara MESES de cobertura contra MESES de lead time, un
// umbral sin margen de error), acá se usa directamente la PMF de Poisson
// ya usada para stockSeguridad95: P(demanda en la ventana de lead time >
// stock disponible) = 1 − P(demanda ≤ stock) = 1 − Σ_{k=0}^{stock} PMF(k,
// λ_ventana), con λ_ventana=λ_mensual×(leadDias/30) — la demanda esperada
// en el tiempo real que tarda la reposición, no un mes fijo.
function probabilidadQuiebreLeadTime(lambdaMensual,leadDias,stockDisponible){
  if(lambdaMensual==null||!(lambdaMensual>=0)||!(leadDias>0))return null;
  var lambdaVentana=lambdaMensual*(leadDias/30);
  var stock=stockDisponible>0?Math.floor(stockDisponible):0;
  var acumulado=0;
  for(var k=0;k<=stock;k++){
    var p=_poissonPMF(k,lambdaVentana);
    if(p==null)return null;
    acumulado+=p;
    if(acumulado>=1)break;
  }
  return Math.max(0,Math.min(1,Math.round((1-acumulado)*1000)/1000));
}

// Probabilidad 1-5 desde la probabilidad continua de quiebre — mismo
// espíritu que probabilidadStockQuiebre (que mapea la ETIQUETA cualitativa
// de stockEstado), pero sobre el número real de Poisson en vez de bandas
// de meses de cobertura. 0 exacto no es un riesgo activo (no entra a la
// matriz, mismo criterio que el resto de la familia probabilidad*).
function probabilidadQuiebreABanda(probQuiebre){
  if(probQuiebre==null||!(probQuiebre>0))return null;
  if(probQuiebre>=0.8)return 5;
  if(probQuiebre>=0.5)return 4;
  if(probQuiebre>=0.2)return 3;
  if(probQuiebre>=0.05)return 2;
  return 1;
}

// Criticidad real de equipo (tabla 'equipos', valores reales confirmados:
// 'Crítico'/'Esencial'/'General') a la misma escala 1-5 del resto de la
// Matriz de Riesgo — mismo patrón que probabilidadComponente (mapeo
// disperso, no denso: refleja que "Crítico" pesa mucho más que un salto de
// 1 punto respecto a "Esencial").
function criticidadEquipoABanda(criticidad){
  if(criticidad==='Crítico')return 5;
  if(criticidad==='Esencial')return 3;
  if(criticidad==='General')return 1;
  return null;
}

// Arma la matriz final: 'items' ya viene armado por quien llama (pred.js) —
// una fila por repuesto/insumo con riesgo de quiebre real (mismo criterio
// de stk/lub que ya usa riesgoQuiebre), con 'probQuiebre' (de
// probabilidadQuiebreLeadTime), 'precioUnit' (costo real) y
// 'criticidadEquipo' (banda 1-5 ya resuelta, o null si el ítem no está
// asociado a ningún equipo con criticidad cargada). El Impacto toma el
// PEOR CASO entre "cuesta caro" (quintiles reales, mismo criterio de la
// Matriz de Riesgo) y "lo usa un equipo crítico" — nunca se minimiza una
// señal real con la otra.
function matrizCriticidadRepuestos(items){
  var conRiesgo=(items||[]).map(function(it){
    var p=probabilidadQuiebreABanda(it.probQuiebre);
    return Object.assign({},it,{probabilidad:p});
  }).filter(function(it){return it.probabilidad!=null;});
  var umbrales=umbralesImpacto(conRiesgo.map(function(it){return it.precioUnit;}));
  conRiesgo.forEach(function(it){
    var impactoCosto=impactoDeValor(it.precioUnit,umbrales,null);
    var impacto=it.criticidadEquipo!=null?Math.max(impactoCosto,it.criticidadEquipo):impactoCosto;
    var nv=nivelRiesgoPxI(it.probabilidad,impacto);
    it.impacto=impacto;it.impactoCosto=impactoCosto;it.pxi=nv.pxi;it.nivel=nv.nivel;it.color=nv.color;
  });
  return conRiesgo.sort(function(a,b){return b.pxi-a.pxi;});
}

// ═══ ANÁLISIS ABC-XYZ DE REPUESTOS (2026-09-20) ═══
// matrizCriticidadRepuestos (arriba) mide RIESGO (probabilidad de quiebre ×
// impacto) — responde "¿qué tan grave sería quedarme sin esto?". ABC-XYZ
// responde una pregunta distinta y complementaria, clásica de gestión de
// inventario: "¿dónde conviene invertir esfuerzo de control?", cruzando
// dos ejes que hoy no se calculan en ningún lado del sistema:
// - ABC: Pareto sobre el VALOR de consumo anualizado (consumo mensual
//   promedio × 12 × precio unitario) — el 20% de los ítems que concentran
//   ~80% del gasto son clase A (control estricto), hasta C (bajo valor).
//   Umbrales estándar 80/15/5 acumulado (no inventados — ver fuentes en
//   docs/arquitectura.md).
// - XYZ: coeficiente de variación de la demanda MENSUAL (σ/μ), calculado
//   sobre TODOS los meses del ítem, incluyendo meses de consumo cero —
//   mismo criterio ya establecido en analisisDemandaRepuestos (un mes sin
//   consumo es un dato real, no un hueco a ignorar: por eso se enumeran
//   los meses con _mesesEntreLista en vez de solo iterar los meses con
//   movimiento real). Umbrales CV≤0.5 (X, estable), 0.5–1.0 (Y, moderada),
//   >1.0 (Z, errática) — ajustados hacia arriba respecto al 0.25/0.5 típico
//   de retail, apropiado para repuestos (demanda naturalmente más
//   intermitente).
// Reusa _DEMANDA_MIN_MESES: sin suficiente historial, ni el valor ni la
// variabilidad de un ítem son medibles con confianza. Requiere precioUnit
// real (nunca se inventa un precio) — sin eso, el ítem se excluye.
function _mesesEntreLista(mesIni,mesFin){
  var a=mesIni.split('-').map(Number),b=mesFin.split('-').map(Number);
  if(a.length<2||b.length<2||a.some(isNaN)||b.some(isNaN))return[];
  var out=[],y=a[0],m=a[1];
  while(y<b[0]||(y===b[0]&&m<=b[1])){
    out.push(y+'-'+(m<10?'0'+m:''+m));
    m++;if(m>12){m=1;y++;}
  }
  return out;
}
function _cvClaseXYZ(cv){
  if(cv<=0.5)return'X';
  if(cv<=1.0)return'Y';
  return'Z';
}
function analisisABCXYZRepuestos(movimientos,stk){
  var todos=(movimientos||[]).filter(function(m){return m&&m.nParte&&m.mes;});
  if(!todos.length)return[];
  var mesFinSistema=todos.map(function(m){return m.mes;}).sort().slice(-1)[0];
  var precioPorNParte={};
  (stk||[]).forEach(function(s){if(s&&s.nParte&&s.precioUnit>0)precioPorNParte[s.nParte]=s.precioUnit;});
  var porNParte={};
  todos.forEach(function(m){
    var g=(porNParte[m.nParte]=porNParte[m.nParte]||{});
    g[m.mes]=(g[m.mes]||0)+(m.cant||0);
  });
  var items=Object.keys(porNParte).map(function(nParte){
    var porMes=porNParte[nParte];
    var mesInicioItem=Object.keys(porMes).sort()[0];
    var mesesTotales=_contarMesesEntre(mesInicioItem,mesFinSistema);
    if(mesesTotales<_DEMANDA_MIN_MESES)return null;
    var precioUnit=precioPorNParte[nParte];
    if(!(precioUnit>0))return null;
    var serie=_mesesEntreLista(mesInicioItem,mesFinSistema).map(function(mes){return porMes[mes]||0;});
    var media=serie.reduce(function(s,v){return s+v;},0)/serie.length;
    var varianza=serie.reduce(function(s,v){return s+(v-media)*(v-media);},0)/(serie.length-1);
    var cv=media>0?Math.sqrt(varianza)/media:null;
    return{
      nParte:nParte,
      nMeses:mesesTotales,
      consumoMensualProm:Math.round(media*100)/100,
      valorAnualizado:Math.round(media*12*precioUnit),
      cv:cv!=null?Math.round(cv*100)/100:null,
      claseXYZ:cv!=null?_cvClaseXYZ(cv):null
    };
  }).filter(Boolean);
  if(!items.length)return[];
  items.sort(function(a,b){return b.valorAnualizado-a.valorAnualizado;});
  var totalValor=items.reduce(function(s,it){return s+it.valorAnualizado;},0);
  var acumulado=0;
  items.forEach(function(it){
    acumulado+=it.valorAnualizado;
    var pctAcum=totalValor>0?acumulado/totalValor:1;
    it.pctAcumulado=Math.round(pctAcum*1000)/1000;
    it.claseABC=pctAcum<=0.8?'A':pctAcum<=0.95?'B':'C';
    it.clase=it.claseXYZ?it.claseABC+it.claseXYZ:null;
  });
  return items;
}

// ═══ PUNTO DE REORDEN CON STOCK DE SEGURIDAD (2026-09-20) ═══
// analisisABCXYZRepuestos (arriba) ya calcula, por repuesto y desde el
// historial real, la demanda mensual promedio y su coeficiente de
// variación — pero esa variabilidad hoy no alimenta ninguna decisión:
// stockEstado (más arriba en este archivo) compara la cobertura actual
// contra el lead time con un umbral FIJO, como si la demanda fuera
// perfectamente constante. Dos repuestos con el mismo consumo promedio
// pero muy distinta variabilidad (justo lo que separa clase X de clase Z)
// terminan con el mismo umbral de "comprar ahora", dejando sin margen real
// a los erráticos y con margen de sobra a los predecibles.
//
// Punto de Reorden (ROP) con stock de seguridad es la fórmula estándar de
// teoría de inventario para esto (Silver/Pyke/Peterson, "Inventory
// Management and Production Planning and Scheduling"; también Chopra &
// Meindl, "Supply Chain Management"):
//   ROP = μ_L + z·σ_L
//   μ_L = μ_mensual × (leadDias/30)      — demanda esperada durante el lead time
//   σ_L = σ_mensual × √(leadDias/30)     — escalado raíz-del-tiempo (demanda
//                                          i.i.d. entre meses, supuesto estándar)
//   z   = z-score del nivel de servicio elegido
// σ_mensual = cv × μ_mensual, reusando el cv que ya calcula
// analisisABCXYZRepuestos — nunca se inventa una varianza nueva. leadDias
// usa el mismo default de 34 días ya establecido en el sistema
// (predFromOrdenes, stockEstado) cuando el ítem no tiene lead time propio.
//
// Verificado con Monte Carlo (2M iteraciones, demanda diaria normal
// agregada sobre el lead time): la probabilidad real de NO quebrar stock
// usando el ROP coincide con el nivel de servicio elegido a 4 decimales
// (90%→0.9000, 95%→0.9500, 97.5%→0.9749). El redondeo final es hacia
// arriba (Math.ceil): redondear hacia abajo reduciría el nivel de servicio
// real por debajo del elegido.
var _Z_NIVEL_SERVICIO={0.90:1.2816,0.95:1.6449,0.975:1.96,0.99:2.3263};
function puntoReordenSeguridad(muMensual,cv,leadDias,nivelServicio){
  if(muMensual==null||!(muMensual>=0)||!(leadDias>0))return null;
  var ns=_Z_NIVEL_SERVICIO[nivelServicio]?nivelServicio:0.95;
  var z=_Z_NIVEL_SERVICIO[ns];
  var sigmaMensual=(cv!=null&&cv>0)?cv*muMensual:0;
  var leadMeses=leadDias/30;
  var muL=muMensual*leadMeses;
  var sigmaL=sigmaMensual*Math.sqrt(leadMeses);
  var stockSeguridad=z*sigmaL;
  return{
    muL:Math.round(muL*100)/100,
    sigmaL:Math.round(sigmaL*100)/100,
    stockSeguridad:Math.round(stockSeguridad*100)/100,
    z:z,nivelServicio:ns,
    rop:Math.ceil(muL+stockSeguridad)
  };
}

// Aplica puntoReordenSeguridad a la lista completa de analisisABCXYZRepuestos,
// cruzando con el lead time y stock actual real de cada repuesto (tabla
// stk). Marca bajoReorden cuando el stock actual (bodega + pendiente de
// llegar) ya cayó por debajo del punto de reorden calculado.
function puntosReordenRepuestos(itemsABCXYZ,stk,nivelServicio){
  var stockPorNParte={},leadPorNParte={};
  (stk||[]).forEach(function(s){
    if(!s||!s.nParte)return;
    stockPorNParte[s.nParte]=(s.stockBodega||0)+(s.pendiente||0);
    leadPorNParte[s.nParte]=s.leadTime>0?s.leadTime:34;
  });
  return(itemsABCXYZ||[]).map(function(it){
    var lead=leadPorNParte[it.nParte]||34;
    var r=puntoReordenSeguridad(it.consumoMensualProm,it.cv,lead,nivelServicio);
    if(!r)return null;
    var stockActual=stockPorNParte[it.nParte]||0;
    return Object.assign({nParte:it.nParte,claseABC:it.claseABC,claseXYZ:it.claseXYZ,
      stockActual:stockActual,leadDias:lead,bajoReorden:stockActual<r.rop},r);
  }).filter(Boolean);
}

// ═══ MTTR CON DISTRIBUCIÓN LOG-NORMAL (2026-09-13) ═══
// Origen real: mismo repaso de distribuciones estadísticas de confiabilidad
// que llevó a Poisson para stock (sección anterior). El MTTR que ya muestra
// Costos & Stock (mttrReal, arriba) es un PROMEDIO simple de horas de
// reparación — pero los tiempos de reparación real casi nunca son
// simétricos: la mayoría de las reparaciones son rápidas y unas pocas se
// alargan mucho (un repuesto que no estaba en bodega, un diagnóstico
// difícil), lo que arrastra el promedio hacia arriba y lo hace parecer peor
// de lo que es "típicamente". Log-normal es la distribución estándar para
// modelar exactamente ese patrón (el LOGARITMO de la duración sigue una
// normal) — mismo principio que ya se usa para Weibull, aplicado a otra
// pregunta real: no "cuándo va a fallar" sino "cuánto va a durar la
// reparación una vez que ya falló".
// mu/sigma son la media y desviación estándar MUESTRAL (n-1) del logaritmo
// de las duraciones reales — nunca se inventan, se calculan de la muestra.
// mediana = e^mu (el "típico" real, no distorsionado por la cola larga).
// p90 = e^(mu + 1.2816*sigma) — 1.2816 es el z-score estándar del percentil
// 90 de una normal (valor de tabla, igual que los t-críticos de Weibull),
// no un número elegido a mano: "9 de cada 10 reparaciones terminan dentro
// de este tiempo".
var _Z_P90=1.2816;
function analisisMTTRLogNormal(horas){
  var validos=(horas||[]).filter(function(h){return h>0;});
  if(validos.length<5)return null;
  var n=validos.length;
  var logs=validos.map(Math.log);
  var mu=logs.reduce(function(s,x){return s+x;},0)/n;
  var varianza=logs.reduce(function(s,x){return s+(x-mu)*(x-mu);},0)/(n-1);
  var sigma=Math.sqrt(varianza);
  if(!isFinite(mu)||!isFinite(sigma))return null;
  var promedioSimple=validos.reduce(function(s,x){return s+x;},0)/n;
  return{
    n:n,
    mediana:Math.round(Math.exp(mu)*10)/10,
    p90:Math.round(Math.exp(mu+_Z_P90*sigma)*10)/10,
    promedioSimple:Math.round(promedioSimple*10)/10
  };
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

// ═══ MATRIZ DE RIESGO (Probabilidad × Impacto) ═══
// Nivel 1 (2026-09-14): no inventa riesgos nuevos — mapea señales que el
// sistema YA calcula en otro lado (Índice de Riesgo de componentes,
// severidad de alerta cruzada por equipo, riesgo de quiebre de stock,
// componentes reincidentes de flota) a los ejes de una matriz de riesgo
// 5×5 (Probabilidad 1-5 × Impacto 1-5), para priorizar entre categorías
// distintas con un criterio único en vez de mirar 4 pantallas separadas.
// Funciones puras — pred.js arma la lista de riesgos con datos reales
// (modules/renders/pred.js, sub-vista "matriz") y llama a estas para
// clasificar cada uno.

// Probabilidad según el Índice de Riesgo de un componente mayor (comp.js,
// campo riesgoNivel ya persistido). Bajo/Sin datos no entran a la matriz —
// no son un riesgo activo, son "sin problema" o "sin evidencia".
function probabilidadComponente(riesgoNivel){
  if(riesgoNivel==='🔴 Alto')return 5;
  if(riesgoNivel==='🟡 Medio')return 3;
  if(riesgoNivel==='🟡 Revisar')return 2;
  return null;
}

// Probabilidad según la severidad de alerta cruzada de un equipo
// (pred.js, alertaCruzada() — combina inspección NOK, fallas repetidas,
// tendencia de costo, PM urgente y aceite). severity<2 (🟢) no entra: es
// el mismo corte que ya usa la vista "general" de Predictivo para no
// contar un equipo como "a vigilar".
function probabilidadEquipoSeveridad(severity){
  var s=severity||0;
  if(s>=8)return 5;
  if(s>=5)return 4;
  if(s>=3)return 3;
  if(s>=2)return 2;
  return null;
}

// Probabilidad de un ítem de stock/lubricante en riesgo de quiebre
// (pred.js, riesgoQuiebre() — ya usa stockEstado(), la fuente única de
// "cuándo comprar"). BAJO (🟡, cobertura entre el lead time y 2 meses) es
// el único nivel no-crítico que igual entra: ya es una señal real.
function probabilidadStockQuiebre(etiquetaRiesgo){
  var r=etiquetaRiesgo||'';
  if(r.indexOf('SIN STOCK')!==-1)return 5;
  if(r.indexOf('QUIEBRE')!==-1)return 4;
  if(r.indexOf('BAJO')!==-1)return 2;
  return null;
}

// Probabilidad de un componente reincidente de flota (pred.js,
// diagnosticoFlota() — ya exige 3+ fallas para severidad>0). severidad=0
// ("aún sin patrón claro") no entra a la matriz.
function probabilidadReincidencia(severidad){
  if(severidad>=3)return 5;
  if(severidad===2)return 3;
  return null;
}

// Umbrales de Impacto (quintiles) sobre un conjunto de valores $ heterogéneo
// (costoRef de componente, promCostoMes de equipo, precioUnit de repuesto)
// — se recalculan en cada armado de la matriz sobre los riesgos presentes,
// en vez de usar montos fijos en pesos: así el Impacto queda relativo a
// "cuánto pesa este riesgo frente a los demás riesgos de HOY", útil para
// priorizar, y portable a cualquier cliente sin retocar umbrales en $ que
// no tendrían sentido en otra escala de costos.
function umbralesImpacto(valores){
  var nums=(valores||[]).filter(function(v){return typeof v==='number'&&isFinite(v)&&v>0;}).sort(function(a,b){return a-b;});
  // Mínimo 5 valores — mismo criterio de sample size que el resto de logic.js
  // (aceiteOutliers, correlacionAceiteFallas, ajusteWeibull: todos exigen ≥5
  // antes de calcular algo). Bug real encontrado el 2026-09-14 (auditoría,
  // el mismo día del fix anterior): con <5 valores, ceil(p*n)-1 devuelve el
  // ÍNDICE DEL ÚLTIMO ELEMENTO para el percentil 80 en todo n<5 — el mismo
  // defecto que el fix de "ceil, no floor" creyó haber resuelto, solo que
  // sobrevivía exactamente en el rango más común (pocos riesgos activos el
  // día que se arma la matriz), no en el caso de prueba (n=5). Con n=1 esto
  // forzaba Impacto=1 al ÚNICO riesgo del día sin importar su costo real.
  // Por debajo de 5, no se inventan quintiles: impactoDeValor() ya sabe
  // devolver Impacto 3 (neutral) cuando umbrales es null — mismo camino que
  // "sin dato de costo", honesto en vez de fingir precisión sin muestra.
  if(nums.length<5)return null;
  // ceil(p*n)-1, no floor(p*n): con floor, el percentil 80 de un set chico cae
  // exactamente en el ÚLTIMO elemento (su propio índice), así que el valor más
  // alto del conjunto nunca podía superar su propio umbral y quedaba atrapado
  // en Impacto 4 en vez de 5 — encontrado escribiendo el test de este archivo.
  function pct(p){var idx=Math.min(nums.length-1,Math.max(0,Math.ceil(p*nums.length)-1));return nums[idx];}
  return [pct(0.2),pct(0.4),pct(0.6),pct(0.8)];
}

// Impacto (1-5) de un valor $ contra los umbrales de umbralesImpacto().
// Sin valor (null/0/sin dato de costo) -> 3: ni oculta el riesgo ni lo
// sobre/sub-pondera por falta de dato.
// pisoAbsoluto (opcional, en pesos — ej. 1% del presupuesto mensual
// configurado): bug real encontrado el 2026-09-14 — como el Impacto es
// puramente RELATIVO a los riesgos presentes hoy, un día con solo fallas
// baratas (ej. una manguera de $50.000) igual entrega Impacto 5 al más
// caro de los baratos, porque gana el quintil sin importar la escala real.
// Con un piso absoluto, un valor por debajo de ese piso queda topado en
// Impacto 2 sin importar qué quintil gane — no puede pesar como "alto/
// extremo" en términos absolutos si en plata real es menor. Sin piso
// (undefined/0 — sin presupuesto configurado), se comporta exactamente
// igual que antes: puramente relativo.
function impactoDeValor(valor,umbrales,pisoAbsoluto){
  if(valor==null||!isFinite(valor)||valor<=0||!umbrales)return 3;
  var bin = valor<=umbrales[0]?1:valor<=umbrales[1]?2:valor<=umbrales[2]?3:valor<=umbrales[3]?4:5;
  if(pisoAbsoluto>0&&valor<pisoAbsoluto)bin=Math.min(bin,2);
  return bin;
}

// Nivel de riesgo Probabilidad×Impacto (PxI, rango 1-25), con las 4 bandas
// clásicas de una matriz de riesgo 5×5 (Bajo/Moderado/Alto/Extremo).
function nivelRiesgoPxI(probabilidad,impacto){
  var pxi=(probabilidad||0)*(impacto||0);
  var nivel = pxi<=4?'Bajo':pxi<=9?'Moderado':pxi<=15?'Alto':'Extremo';
  var color = pxi<=4?'var(--ok)':pxi<=9?'var(--warn)':pxi<=15?'#f97316':'var(--danger)';
  return {pxi:pxi,nivel:nivel,color:color};
}

// ═══ MATRIZ DE CRITICIDAD DINÁMICA (2026-09-16) ═══
// Cuarto ítem del orden de prioridad elegido por el usuario. La Matriz de
// Riesgo de arriba es una FOTO: la Probabilidad de cada componente sale de
// riesgoNivel (comp.js), un campo que solo cambia cuando alguien vuelve a
// evaluar ese equipo A MANO. No hay forma de que esa matriz "sepa" que un
// tipo de componente lleva meses fallando cada vez más seguido, salvo que
// alguien lo note y actualice riesgoNivel manualmente. Crow-AMSAA (arriba)
// SÍ mide esa tendencia real, a nivel de categoría de componente en toda
// la flota — acá se usa para ajustar dinámicamente la Probabilidad de
// cada instancia de ese tipo de componente, en vez de dejarla fija hasta
// la próxima revisión manual. No es una matriz nueva ni un score
// inventado: reusa tal cual probabilidadComponente/umbralesImpacto/
// impactoDeValor/nivelRiesgoPxI de arriba, con un único ajuste real
// encima (la tendencia medida).
//
// +1 nivel de Probabilidad si la tendencia real de ESE tipo de componente
// (toda la flota) es 'empeorando' (tope en 5), -1 si es 'mejorando' (piso
// en 1), sin cambio si 'sin_certeza' o sin dato de tendencia — nunca se
// ajusta sin evidencia real de la dirección.
function criticidadDinamicaComponente(probEstatica,tendencia){
  if(probEstatica==null)return null;
  if(tendencia==='empeorando')return Math.min(5,probEstatica+1);
  if(tendencia==='mejorando')return Math.max(1,probEstatica-1);
  return probEstatica;
}

// Arma la matriz completa: una fila por cada instancia de componente mayor
// (equipo+tipo) con Índice de Riesgo real (mismo filtro de
// probabilidadComponente que ya usa la Matriz de Riesgo estática), con su
// Probabilidad estática Y dinámica, Impacto (mismos umbralesImpacto/
// impactoDeValor de la matriz estática, sobre costoRef, sin piso
// absoluto — mismo criterio simple que el resto de esta función), y los 2
// niveles PxI resultantes. 'cambioNivel' marca solo las filas donde la
// tendencia real efectivamente CAMBIA la banda de riesgo (Bajo/Moderado/
// Alto/Extremo) — el caso que más importa mostrar primero: un componente
// que la matriz estática no marcaría como urgente, pero que la tendencia
// real dice que sí (o al revés). 'crowPorComponente' = salida de
// crowAMSAAPorComponente (arriba) — no se recalcula acá, se reusa tal
// cual, matcheada por el mismo nombre de componente ('comp' en
// componentes_mayores).
function matrizCriticidadDinamica(compMayores,crowPorComponente){
  var tendenciaPorTipo={};
  (crowPorComponente||[]).forEach(function(g){
    if(g&&g.componente&&g.crow)tendenciaPorTipo[g.componente]=g.crow.tendencia;
  });
  var items=[];
  (compMayores||[]).forEach(function(c){
    if(!c)return;
    var p=probabilidadComponente(c.riesgoNivel);
    if(p==null)return;
    var tendencia=tendenciaPorTipo[c.comp]||null;
    items.push({
      sigla:c.sigla||'',
      comp:c.comp||'—',
      probEstatica:p,
      tendencia:tendencia,
      probDinamica:criticidadDinamicaComponente(p,tendencia),
      valorImpacto:c.costoRef||null,
      detalle:c.riesgoTip||'',
      etiqueta:c.riesgoNivel||''
    });
  });
  var umbrales=umbralesImpacto(items.map(function(r){return r.valorImpacto;}));
  items.forEach(function(r){
    r.impacto=impactoDeValor(r.valorImpacto,umbrales,null);
    var nvEstatico=nivelRiesgoPxI(r.probEstatica,r.impacto);
    var nvDinamico=nivelRiesgoPxI(r.probDinamica,r.impacto);
    r.pxiEstatico=nvEstatico.pxi;r.nivelEstatico=nvEstatico.nivel;
    r.pxiDinamico=nvDinamico.pxi;r.nivelDinamico=nvDinamico.nivel;r.colorDinamico=nvDinamico.color;
    r.cambioNivel=nvDinamico.nivel!==nvEstatico.nivel?(nvDinamico.pxi>nvEstatico.pxi?'escalada':'desescalada'):null;
  });
  items.sort(function(a,b){return b.pxiDinamico-a.pxiDinamico;});
  return items;
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

// equiposConSaludFlota (2026-09-02): Score de Salud de TODA la flota de una vez,
// extraído desde el Dashboard (era un bloque inline en dash.js) para que la pestaña
// "Torre de Control" y el resumen compacto del Dashboard usen EXACTAMENTE el mismo
// número por equipo, en vez de dos copias del mismo cálculo que con el tiempo
// terminarían divergiendo — mismo criterio que ya se aplicó con otras fuentes únicas
// de este archivo (regEsATiempo, contarFallasMes, dispEquipoMes, etc.). Recibe los
// arreglos ya cargados por quien llama (eq, compMayores, neu, aceite con _sigla ya
// resuelto, otConHist con el historial de WhatsApp incluido) y arma los índices por
// sigla acá adentro — el llamador no necesita saber cómo, solo pasar los datos.
function equiposConSaludFlota(eq,compMayores,neu,aceite,otConHist){
  var compPorSigla={};
  (compMayores||[]).forEach(function(c){if(c&&c.sigla)(compPorSigla[c.sigla]=compPorSigla[c.sigla]||[]).push(c);});
  var neuOpPorSigla={};
  (neu||[]).forEach(function(n){if(n&&n.sigla&&n.estado==='Operativo')(neuOpPorSigla[n.sigla]=neuOpPorSigla[n.sigla]||[]).push(n);});
  var aceUltimaPorSiglaComp={};
  (aceite||[]).forEach(function(m){
    if(!m||!m._sigla||!m.fecha)return;
    var k=m._sigla+'|'+(m.componente||'?');
    if(!aceUltimaPorSiglaComp[k]||m.fecha>aceUltimaPorSiglaComp[k].fecha)aceUltimaPorSiglaComp[k]=m;
  });
  var aceUltimasPorSigla={};
  Object.keys(aceUltimaPorSiglaComp).forEach(function(k){
    var sigla=k.slice(0,k.lastIndexOf('|'));
    (aceUltimasPorSigla[sigla]=aceUltimasPorSigla[sigla]||[]).push(aceUltimaPorSiglaComp[k]);
  });
  var otFallasPorSigla={};
  (otConHist||[]).forEach(function(o){if(o&&o.sigla&&esFallaMTBF(o)&&o.horom>0)(otFallasPorSigla[o.sigla]=otFallasPorSigla[o.sigla]||[]).push(o.horom);});
  var medsPorSerie=(typeof _neuMedPorSerie==='function')?_neuMedPorSerie():null;
  var eqPorSigla=(typeof _eqPorSigla==='function')?_eqPorSigla():null;
  return (eq||[]).map(function(e){
    var compsConDato=(compPorSigla[e.sigla]||[]).map(function(c){return compEstado(c,e.horomActual,e.hrsDia);}).filter(function(s){return s.conDato;});
    var componentesPct=compsConDato.length?Math.round(compsConDato.filter(function(s){return s.hrsRest>1000;}).length/compsConDato.length*1000)/10:null;
    var neuOp=neuOpPorSigla[e.sigla]||[];
    var neumaticosPct=neuOp.length&&typeof neuDebeCambiar==='function'?Math.round(neuOp.filter(function(n){return!neuDebeCambiar(n,medsPorSerie,eqPorSigla);}).length/neuOp.length*1000)/10:null;
    var aceUlt=aceUltimasPorSigla[e.sigla]||[];
    var aceitePct=aceUlt.length?Math.round(aceUlt.filter(function(m){return m.estado==='NORMAL';}).length/aceUlt.length*1000)/10:null;
    var mtbfE=C.mtbfReal(otFallasPorSigla[e.sigla]||[]);
    var confiabilidadPct=confiabilidadReal(mtbfE,(e.hrsDia||12)*30);
    var score=scoreSaludEquipo({componentesPct:componentesPct,neumaticosPct:neumaticosPct,aceitePct:aceitePct,confiabilidadPct:confiabilidadPct});
    // weibull (2026-09-11, pedido del usuario: el Score de Salud/Confiabilidad
    // de arriba asume tasa de falla constante — acá se ajusta la forma REAL de
    // falla de este equipo específico con sus propios intervalos entre fallas,
    // cuando hay historial suficiente (ajusteWeibull exige ≥5 intervalos, más
    // que el mínimo de 2 que ya exige mtbfReal — con pocos puntos no hay forma
    // real que ajustar). null cuando no alcanza, nunca una forma inventada.
    var weibull=ajusteWeibull(otFallasPorSigla[e.sigla]||[]);
    // edadVirtual (2026-09-16, pedido del usuario: "¿las reparaciones dejan el
    // equipo como nuevo, o solo tapan el síntoma?" — Kijima simplificado, ver
    // edadVirtualEquipo en logic.js). Mismo horómetro de fallas que ya usa
    // weibull arriba, ningún dato nuevo — exige más historial (7 fallas vs 6
    // de Weibull) porque acá se parte la muestra en dos mitades.
    var edadVirtual=edadVirtualEquipo(otFallasPorSigla[e.sigla]||[]);
    // kijima (2026-09-17, tercer lote "más ambicioso" — task #84): versión
    // rigurosa de edadVirtual, con el factor q real estimado por máxima
    // verosimilitud (Tipo I/II, ver kijimaEquipo) en vez de la comparación
    // de medianas de dos mitades. Mismo horómetro de fallas de arriba, sin
    // dato nuevo — exige el mismo mínimo de 5 intervalos que Weibull
    // censurado (del que depende internamente para β/η).
    var kijima=kijimaEquipo(otFallasPorSigla[e.sigla]||[],e.horomActual);
    // horomActual/hrsDia (2026-09-11, pedido del usuario: más contexto en el
    // drawer de Torre de Control) — campos aditivos, ningún llamador existente
    // se rompe por no usarlos.
    return{sigla:e.sigla,tipo:e.tipo,modelo:e.modelo,score:score,horomActual:e.horomActual,unidad:e.unidad,hrsDia:e.hrsDia,weibull:weibull,edadVirtual:edadVirtual,kijima:kijima};
  });
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

// Las N dimensiones más bajas del Score de Salud (2026-09-11, pedido del
// usuario: el drawer de Torre de Control solo mostraba el número, sin decir
// "por qué" — quería el detalle de las 1-2 dimensiones que más lo arrastran,
// no solo la peor sola como ya hacía motivoPrincipalSalud). Mismo criterio
// de "con dato" que esa función; ordena ascendente (peor primero) y corta en
// max. No inventa causas nuevas — son las mismas 4 dimensiones que ya
// calcula equiposConSaludFlota.
function peoresDimensionesSalud(detalle,max){
  var conDato=(detalle||[]).filter(function(c){return c&&typeof c.valor==='number'&&isFinite(c.valor);});
  return conDato.slice().sort(function(a,b){return a.valor-b.valor;}).slice(0,max||2);
}

// Recomendación de acción por dimensión (2026-09-11, mismo pedido) — texto
// FIJO por dimensión, no un diagnóstico inventado por equipo: el sistema no
// tiene telemetría/sensores para decir "presión de aceite baja" o similar,
// solo sabe QUÉ dimensión está mal (a partir de datos ya cargados: análisis
// de aceite, vida útil de componentes, neumáticos, historial de fallas). El
// texto dice dónde mirar, no inventa una causa raíz que el sistema no puede
// conocer.
var RECOMENDACION_DIMENSION_SALUD={
  'Componentes':'Revisar los componentes mayores con menos vida útil restante — ficha del equipo → Componentes.',
  'Neumáticos':'Revisar los neumáticos marcados para cambio — ficha del equipo → Neumáticos.',
  'Aceite':'Revisar los últimos análisis de aceite fuera de NORMAL — ficha del equipo → Análisis Aceite.',
  'Confiabilidad':'Equipo con historial de fallas frecuente (MTBF bajo) — evaluar una intervención preventiva antes de la próxima falla.'
};
function recomendacionDimensionSalud(nombre){
  return RECOMENDACION_DIMENSION_SALUD[nombre]||null;
}

// Atajos de fecha para el selector del Dashboard ("Hoy"/"Ayer"/"Año pasado",
// 2026-09-11 — pedido del usuario: "cualquiera querrá saber qué mes/año/día
// es... como vamos hoy, como nos fue ayer, comparado con el año pasado del
// mismo día"). Puras — 'hoyISO' siempre se pasa desde afuera (nunca
// 'new Date()' acá adentro) para poder testear la aritmética de fechas sin
// depender del reloj real. setDate/setFullYear "ruedan" al día siguiente
// válido cuando la fecha resultante no existe (ej. 29-feb de año bisiesto
// menos un año cae en 1-mar) — comportamiento estándar de Date, no un bug.
function fechaAyer(hoyISO){
  var d=new Date(hoyISO+'T00:00:00');
  d.setDate(d.getDate()-1);
  return d.toISOString().slice(0,10);
}
function fechaMismoDiaAnioPasado(hoyISO){
  var d=new Date(hoyISO+'T00:00:00');
  d.setFullYear(d.getFullYear()-1);
  return d.toISOString().slice(0,10);
}

// Prorratea un presupuesto mensual fijo por días transcurridos — SOLO cuando
// 'mes' (YYYY-MM) es el mes en curso de 'hoyISO'; un mes ya cerrado devuelve
// el presupuesto completo sin tocar (auditoría 2026-09: Presupuesto vs Real
// comparaba el gasto real de los primeros días del mes contra el presupuesto
// COMPLETO, mostrando "bajo presupuesto" en verde de forma engañosa casi
// todo el mes, sin importar el ritmo de gasto real). new Date(año,mesJs,0)
// devuelve el último día del mes anterior a 'mesJs' (0-based +1 = mes actual
// 1-based), truco estándar para "días en este mes".
function presupuestoProrrateado(presupuestoMensual,mes,hoyISO){
  if(!presupuestoMensual||!mes||!hoyISO)return presupuestoMensual||0;
  if(mes!==hoyISO.slice(0,7))return presupuestoMensual;
  var partes=mes.split('-');
  var anio=parseInt(partes[0],10),mesJs=parseInt(partes[1],10);
  var diasEnMes=new Date(anio,mesJs,0).getDate();
  var diaHoy=parseInt(hoyISO.slice(8,10),10);
  var diasTranscurridos=Math.min(Math.max(diaHoy,1),diasEnMes);
  return presupuestoMensual*diasTranscurridos/diasEnMes;
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

// ═══ CADENA DE MARKOV DE ESTADOS DE SALUD (2026-09-20) ═══
// Kijima/GRP/Weibull modelan la confiabilidad de forma CONTINUA a partir
// del tiempo entre fallas. Esto es distinto: usa el historial real de
// Score de Salud por equipo que el Dashboard ya guarda día a día
// (registrarSnapshotSalud, arriba, hasta SALUD_HIST_DIAS_MAX días), cuenta
// TRANSICIONES REALES observadas entre estados discretos y arma una
// cadena de Markov empírica — útil justo donde Weibull no aplica bien
// (salud que sube y baja por carga operacional variable, no un reloj de
// desgaste monótono). No es una curva ajustada: es la frecuencia real con
// que la flota completa pasó de un estado a otro.
// Estados = mismos umbrales que ya usa el Dashboard para avisar "cruce"
// (70) y colorear (55) — no se inventan umbrales nuevos.
var ESTADOS_SALUD=['Sano','Alerta','Crítico'];
function _estadoSalud(valor){
  if(valor>=70)return'Sano';
  if(valor>=55)return'Alerta';
  return'Crítico';
}
// Pares de snapshots con separación real de 4-10 días (misma ventana de
// tolerancia que tendenciaSaludSemanal para "una semana"), pooled entre
// TODA la flota — un equipo solo no tiene suficientes transiciones, la
// flota completa sí. Por cada fecha de inicio se cuenta solo la PRIMERA
// pareja válida (evita contar la misma transición semanal más de una vez
// si hay snapshots de días intermedios). minPorFila (default 5, mismo
// umbral que minPorGrupo de anovaUnFactor): un estado de origen con menos
// transiciones reales observadas no tiene una fila confiable — se
// descarta la matriz completa (nunca se inventa una probabilidad de
// transición).
function matrizTransicionSalud(historicosPorEquipo,minPorFila){
  var min=minPorFila||5;
  var conteos={};
  ESTADOS_SALUD.forEach(function(e1){conteos[e1]={};ESTADOS_SALUD.forEach(function(e2){conteos[e1][e2]=0;});});
  var total=0;
  Object.keys(historicosPorEquipo||{}).forEach(function(sigla){
    var hist=historicosPorEquipo[sigla]||{};
    var fechas=Object.keys(hist).sort();
    for(var i=0;i<fechas.length;i++){
      for(var j=i+1;j<fechas.length;j++){
        var dias=_diasEntreISO(fechas[i],fechas[j]);
        if(dias<4)continue;
        if(dias>10)break;
        var e1=_estadoSalud(hist[fechas[i]]),e2=_estadoSalud(hist[fechas[j]]);
        conteos[e1][e2]++;total++;
        break;
      }
    }
  });
  var filasOk=ESTADOS_SALUD.every(function(e1){
    return ESTADOS_SALUD.reduce(function(s,e2){return s+conteos[e1][e2];},0)>=min;
  });
  if(!filasOk)return null;
  var matriz={};
  ESTADOS_SALUD.forEach(function(e1){
    var totalFila=ESTADOS_SALUD.reduce(function(s,e2){return s+conteos[e1][e2];},0);
    matriz[e1]={};
    ESTADOS_SALUD.forEach(function(e2){matriz[e1][e2]=Math.round((conteos[e1][e2]/totalFila)*1000)/1000;});
  });
  return{matriz:matriz,conteos:conteos,totalTransiciones:total};
}
// Ecuación de Chapman-Kolmogorov (P(n)=Pⁿ): probabilidad de estar en cada
// estado dentro de N semanas, partiendo del estado actual — multiplica el
// vector de estado por la matriz de transición N veces.
function proyeccionSaludNSemanas(resultadoMatriz,estadoActual,nSemanas){
  if(!resultadoMatriz||!resultadoMatriz.matriz)return null;
  if(ESTADOS_SALUD.indexOf(estadoActual)===-1)return null;
  if(!(nSemanas>=1))return null;
  var m=resultadoMatriz.matriz;
  var vector={};
  ESTADOS_SALUD.forEach(function(e){vector[e]=e===estadoActual?1:0;});
  for(var paso=0;paso<nSemanas;paso++){
    var siguiente={};
    ESTADOS_SALUD.forEach(function(e2){
      siguiente[e2]=ESTADOS_SALUD.reduce(function(s,e1){return s+vector[e1]*(m[e1][e2]||0);},0);
    });
    vector=siguiente;
  }
  var out={};
  ESTADOS_SALUD.forEach(function(e){out[e]=Math.round(vector[e]*1000)/1000;});
  return out;
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

// ═══ AGRUPACIÓN OPORTUNISTA DE OT (2026-09-13) ═══
// Origen real: repasando ideas de mantenimiento avanzado para minería, el
// usuario preguntó cuáles eran reales para este sistema (no requerían
// telemetría de sensores que no existe acá). Esta sí: cuando un equipo
// entra al taller por un correctivo IMPREVISTO, conviene revisar si su
// próximo PM programado está lo bastante cerca como para hacerlo en la
// misma detención — evita una segunda parada innecesaria pocos días/horas
// después, sin agregar ningún dato nuevo: solo cruza dos cosas que el
// sistema YA calcula por separado (diasParaPM/hrsRestantes/tipoPM, ver
// C.recalc arriba) en el momento exacto en que más sirve saberlo — al
// crear la OT de correctivo, no en un reporte aparte que nadie mira a
// tiempo. Es una SUGERENCIA para que decida una persona, nunca agenda ni
// modifica nada por su cuenta.
function sugerenciaAgruparPM(equipo,umbralDias,umbralHoras){
  if(!equipo)return null;
  var uDias=umbralDias>0?umbralDias:7;
  var uHoras=umbralHoras>0?umbralHoras:48;
  var dias=equipo.diasParaPM;
  var horas=equipo.hrsRestantes;
  var cercaPorDias=dias!=null&&dias<=uDias;
  var cercaPorHoras=horas!=null&&horas<=uHoras;
  if(!cercaPorDias&&!cercaPorHoras)return null;
  return{
    tipoPM:equipo.tipoPM||'PM',
    diasParaPM:dias!=null?dias:null,
    hrsRestantes:horas!=null?horas:null,
    fechaProxPM:equipo.fechaProxPM||null,
    vencido:(dias!=null&&dias<0)||(horas!=null&&horas<0)
  };
}

// ═══ MONTE CARLO DE DISPONIBILIDAD DE FLOTA — proyección a 30/60/90 días
// (2026-09-13) ═══
// Origen real: la segunda idea real (junto con la agrupación oportunista de
// arriba) del mismo repaso de mantenimiento avanzado para minería que el
// usuario pidió evaluar. Todo lo demás de esa lista se descartó por
// requerir datos que este sistema no tiene (sensores, telemetría, datos de
// planta) — esta SÍ es aplicable: en vez de un solo número de MTBF/MTTR
// "promedio" (que no dice nada sobre qué tan seguido las cosas salen peor
// que el promedio), se remuestrea (bootstrap) el historial REAL de
// intervalos entre fallas y duraciones de reparación de TODA la flota miles
// de veces, simulando escenarios futuros posibles — el resultado es un
// RANGO honesto (P10-P90), no una falsa certeza de un solo número.
//
// Deliberadamente NO se modela el PM (mantención programada): a diferencia
// de un correctivo, el momento del próximo PM de cada equipo ya se conoce
// con certeza (diasParaPM/hrsRestantes, ver C.recalc) — no hay nada
// aleatorio que remuestrear ahí, simularlo solo agregaría ruido a un dato
// que ya es determinístico. El Monte Carlo se enfoca en lo único que
// realmente es incierto: CUÁNDO va a fallar algo y CUÁNTO va a tardar en
// repararse.

// Agrupa TODAS las fallas reales (esFallaMTBF) de TODA la flota en una sola
// línea de tiempo (no por equipo — acá interesa "cada cuántos días falla
// ALGO en la flota", el proceso de llegada agregado) y devuelve los
// intervalos en DÍAS CALENDARIO entre fallas sucesivas — a diferencia de
// ajusteWeibull/mtbfFlotaReal (que usan horómetro, horas de uso), acá
// necesitamos tiempo de calendario porque la proyección es "de aquí a 30/60/
// 90 días corridos", no "de aquí a que el equipo acumule tantas horas".
// Gaps en días calendario entre fechas YA ordenadas — núcleo compartido por
// intervalosFallaFlotaDias y tasaFallaPorUbicacion (misma cuenta, distinto
// subconjunto de fechas de entrada).
function _gapsDiasDeFechasOrdenadas(fechasOrdenadas){
  var gaps=[];
  for(var i=1;i<fechasOrdenadas.length;i++){
    var d1=new Date(fechasOrdenadas[i-1]+'T00:00:00'),d2=new Date(fechasOrdenadas[i]+'T00:00:00');
    var dias=Math.round((d2-d1)/86400000);
    if(dias>0)gaps.push(dias);
  }
  return gaps;
}

function intervalosFallaFlotaDias(ot){
  var fechas=(ot||[]).filter(esFallaMTBF).map(function(o){return o.fecha||o.fechaEntrada;}).filter(Boolean).sort();
  return _gapsDiasDeFechasOrdenadas(fechas);
}

// ═══ TASA DE FALLA POR UBICACIÓN — versión simplificada y honesta de lo que en
// ingeniería de confiabilidad se llama un modelo de riesgos proporcionales (Cox):
// compara el intervalo entre fallas SEGÚN la ubicación registrada en el
// correctivo (o.ubicacion — "Pit, Rampa, Planta...", ver ot.js), la única
// covariable de operación real que el sistema ya registra sin sensores.
// NO es una regresión de Cox real: no hay tiempo de exposición por ubicación
// (sabemos DÓNDE ocurrió cada falla, no cuántas horas trabajó cada equipo en
// cada lugar), así que no se calcula un hazard ratio ajustado — se compara la
// MEDIANA de días entre fallas de cada ubicación contra el resto de la flota,
// con el límite honesto que eso implica: equipos más viejos o con más uso
// pueden concentrarse en una ubicación y sesgar la comparación, esto muestra
// una asociación, no una causa probada. Mínimo 5 fallas por ubicación (mismo
// umbral que umbralesImpacto) para no comparar con muestras chicas. Devuelve
// razon = medianaDiasGrupo/medianaDiasResto — menor a 1 significa que esa
// ubicación falla MÁS seguido que el resto de la flota.
function tasaFallaPorUbicacion(ot, minFallasPorGrupo){
  var min=minFallasPorGrupo||5;
  var reales=(ot||[]).filter(esFallaMTBF).filter(function(o){return o.ubicacion&&String(o.ubicacion).trim();});
  var porUbicacion={};
  reales.forEach(function(o){
    var u=String(o.ubicacion).trim();
    if(!porUbicacion[u])porUbicacion[u]=[];
    porUbicacion[u].push(o.fecha||o.fechaEntrada);
  });
  var resultado=[];
  Object.keys(porUbicacion).forEach(function(u){
    var fechasGrupo=porUbicacion[u].filter(Boolean).sort();
    if(fechasGrupo.length<min)return;
    var fechasResto=reales.filter(function(o){return String(o.ubicacion).trim()!==u;}).map(function(o){return o.fecha||o.fechaEntrada;}).filter(Boolean).sort();
    var gapsGrupo=_gapsDiasDeFechasOrdenadas(fechasGrupo);
    var gapsResto=_gapsDiasDeFechasOrdenadas(fechasResto);
    var medGrupo=medianaPositiva(gapsGrupo);
    var medResto=medianaPositiva(gapsResto);
    if(medGrupo==null||medResto==null)return;
    resultado.push({
      ubicacion:u, nFallas:fechasGrupo.length,
      medianaDiasGrupo:medGrupo, medianaDiasResto:medResto,
      razon:Math.round((medGrupo/medResto)*100)/100
    });
  });
  return resultado.sort(function(a,b){return a.razon-b.razon;});
}

// ═══ DETECCIÓN DE ESTACIONALIDAD / PATRONES OCULTOS DE FALLA (2026-09-16) ═══
// Quinto y último ítem del segundo lote de algoritmos "nivel siguiente".
// tasaFallaPorUbicacion (arriba) ya compara ubicaciones entre sí, pero solo
// con una razón de medianas — nunca dice si la diferencia observada podría
// ser puro ruido de muestra chica o es un patrón real. Acá se agrega un
// test estadístico simple y genérico (chi-cuadrado de bondad de ajuste,
// el estándar para "¿la distribución observada entre categorías se aleja
// de lo esperado más de lo que explicaría el azar?") aplicado a 2 ejes
// nuevos que el sistema no había comparado nunca: MES calendario (para
// estacionalidad — ¿hay meses con más fallas de lo esperable?) y TURNO
// (Día/Noche, campo real de correctivos).
//
// Tabla de valores críticos de chi-cuadrado (α=0.05, la misma referencia
// que usan los t-críticos de Weibull en este archivo — valores de tabla
// estándar, no inventados; verificados con la función gamma incompleta
// regularizada antes de escribirlos acá, no copiados de memoria sin
// chequear).
var _CHI2_CRITICO_95={1:3.841,2:5.991,3:7.815,4:9.488,5:11.070,6:12.592,7:14.067,8:15.507,9:16.919,10:18.307,11:19.675,12:21.026};

// Test genérico: 'observado' = {categoria:conteo real}, 'exposicion' =
// {categoria:peso relativo de exposición real} (ej. días del mes; 1 para
// todas si se asume exposición pareja, una asunción que cada llamador debe
// justificar explícitamente, nunca inventada en silencio). χ²=Σ(O-E)²/E,
// con E=total_observado×(exposición_categoría/exposición_total). Si χ²
// supera el valor crítico de la tabla (gl=k-1 categorías), la diferencia
// observada es más grande de lo que el azar explicaría solo — hay un
// patrón real, no ruido. 'indice' por categoría = observado/esperado (>1
// = falla más de lo esperado ahí, &lt;1 = menos).
function testChiCuadradoUniforme(observado,exposicion){
  var categorias=Object.keys(observado||{});
  var k=categorias.length;
  if(k<2)return null;
  var totalObs=categorias.reduce(function(s,c){return s+(observado[c]||0);},0);
  var totalExp=categorias.reduce(function(s,c){return s+((exposicion&&exposicion[c])||1);},0);
  if(totalObs<5||!(totalExp>0))return null;
  var chi2=0;
  var detalle=categorias.map(function(c){
    var pesoExp=(exposicion&&exposicion[c])||1;
    var esperado=totalObs*(pesoExp/totalExp);
    var obs=observado[c]||0;
    if(esperado>0)chi2+=Math.pow(obs-esperado,2)/esperado;
    return{categoria:c,observado:obs,esperado:Math.round(esperado*10)/10,
      indice:esperado>0?Math.round((obs/esperado)*100)/100:null};
  });
  var gl=k-1;
  var critico=_CHI2_CRITICO_95[gl]!=null?_CHI2_CRITICO_95[gl]:null;
  return{
    chi2:Math.round(chi2*100)/100,gl:gl,critico:critico,
    significativo:critico!=null?chi2>critico:null,
    n:totalObs,
    detalle:detalle.sort(function(a,b){return(b.indice||0)-(a.indice||0);})
  };
}

var _DIAS_POR_MES={'01':31,'02':28.25,'03':31,'04':30,'05':31,'06':30,'07':31,'08':31,'09':30,'10':31,'11':30,'12':31};

// Aplica el test a MES-DEL-AÑO (todas las fallas reales de todos los años
// juntas, agrupadas por Enero..Diciembre — la pregunta es estacionalidad
// real, no "qué mes tuvo más actividad este año en particular") y a TURNO.
// Exposición de MES = días reales de ese mes (28.25 aproxima el año
// bisiesto en febrero, sin inventar un calendario específico). Exposición
// de TURNO = pareja entre los turnos reales presentes — asunción explícita
// razonable en una operación 24/7 con turnos de igual duración (el mismo
// equipo opera ambos turnos por diseño), no un dato medido. UBICACIÓN
// queda fuera a propósito: ya la cubre tasaFallaPorUbicacion con un
// enfoque distinto (mediana de intervalos) que no necesita asumir una
// exposición pareja que ahí sería mucho menos defendible (Pit/Rampa/Planta
// no tienen por qué repartirse el tiempo por igual).
function patronesOcultosFalla(ot){
  var reales=(ot||[]).filter(esFallaMTBF);
  var porMes={};
  reales.forEach(function(o){
    var f=o.fecha||o.fechaEntrada;
    if(!f)return;
    var mm=String(f).slice(5,7);
    if(!_DIAS_POR_MES[mm])return;
    porMes[mm]=(porMes[mm]||0)+1;
  });
  var porTurno={};
  reales.forEach(function(o){
    if(!o.turno)return;
    var t=String(o.turno).trim();
    if(!t)return;
    porTurno[t]=(porTurno[t]||0)+1;
  });
  var expTurno={};
  Object.keys(porTurno).forEach(function(t){expTurno[t]=1;});
  return{
    mes:testChiCuadradoUniforme(porMes,_DIAS_POR_MES),
    turno:testChiCuadradoUniforme(porTurno,expTurno)
  };
}

// ═══ CAUSAS LATENTES REPETIDAS (2026-09-24) ═══
// Pedido real del usuario, conectado con la pregunta que lo trae desde el
// principio de esta conversación: por qué el mismo problema vuelve, aunque
// el equipo "salga andando" cada vez. El campo de causa raíz de Correctivos
// era texto libre — cada persona lo redacta distinto, nunca se podía
// agregar de verdad. Se agregó `tipoCausa` (Física/Humana/Latente, marco
// estándar de análisis causa raíz: qué se rompió / qué se hizo o dejó de
// hacer / qué lo permitió — sistema, procedimiento o decisión).
//
// causasLatentesRepetidas agrupa por COMPONENTE, no por equipo: una causa
// latente es, por definición, del SISTEMA de mantenimiento, no de una
// máquina en particular — si se repite en equipos DISTINTOS es la prueba
// más dura de que el problema es de proceso, no un caso aislado. Con 2
// eventos ya alcanza para marcarla (mismo umbral que ya usa la señal de
// retrabajo en comp.js) porque acá lo relevante no es "cuántas fallas tuvo
// un equipo" sino "¿el sistema dejó pasar lo mismo más de una vez?" — con
// 2 ya es una repetición real, no ruido estadístico.
function causasLatentesRepetidas(correctivos){
  var eventos=(correctivos||[]).filter(function(c){
    return c&&c.tipoCausa==='Latente'&&c.componente&&c.sigla&&c.fecha;
  });
  if(!eventos.length)return[];
  var porComponente={};
  eventos.forEach(function(c){
    (porComponente[c.componente]=porComponente[c.componente]||[]).push(c);
  });
  return Object.keys(porComponente).filter(function(comp){
    return porComponente[comp].length>=2;
  }).map(function(comp){
    var evs=porComponente[comp].slice().sort(function(a,b){return a.fecha<b.fecha?-1:(a.fecha>b.fecha?1:0);});
    var equipos=[];
    evs.forEach(function(e){if(equipos.indexOf(e.sigla)===-1)equipos.push(e.sigla);});
    return{
      componente:comp,
      nEventos:evs.length,
      equipos:equipos,
      nEquipos:equipos.length,
      eventos:evs.map(function(e){return{sigla:e.sigla,fecha:e.fecha,causaRaiz:e.causaRaiz||'',solucion:e.solucion||''};})
    };
  }).sort(function(a,b){return b.nEventos-a.nEventos;});
}

// ═══ TEST DE INDEPENDENCIA CHI-CUADRADO — TABLA DE CONTINGENCIA (2026-09-20) ═══
// testChiCuadradoUniforme (arriba) responde una pregunta de UNA sola
// dimensión: "¿las fallas se reparten parejo entre estas categorías, o hay
// un patrón?" (mes, turno). tasaFallaPorUbicacion responde otra pregunta
// relacionada pero distinta: "¿qué ubicación tiene, en general, más
// fallas?". Ninguna de las dos contesta la pregunta real de causa raíz:
// "¿ESTE componente en particular falla desproporcionadamente en ESTA
// ubicación, o es solo que esa ubicación tiene más fallas de TODO por
// igual?" — eso es un test de independencia de DOS variables categóricas
// (tabla de contingencia r×c), matemática distinta a la bondad de ajuste
// de una sola dimensión.
//
// χ² = Σ (O_ij − E_ij)² / E_ij, con E_ij = (total fila i × total columna
// j) / total general. gl = (filas−1) × (columnas−1) — reusa la misma
// tabla _CHI2_CRITICO_95 ya existente (nunca se inventa un umbral nuevo);
// si gl excede el rango verificado de la tabla (>12), devuelve null en vez
// de comparar contra un umbral no verificado.
//
// Exige que TODAS las celdas esperadas sean ≥5 (regla estándar de Cochran
// para que el chi-cuadrado sea una aproximación confiable — versión
// conservadora: la app siempre prefiere devolver null a una asociación con
// un p-value poco confiable).
//
// Verificado contra scipy.stats.chi2_contingency con una tabla sintética
// 3×3 (3 componentes × 3 ubicaciones) con una asociación real inyectada:
// χ²=12.485, gl=4, coincide a 3 decimales con la implementación de scipy;
// _CHI2_CRITICO_95[1..12] coincide exactamente con
// scipy.stats.chi2.ppf(0.95, gl) en todo el rango de la tabla.
function testIndependenciaChi2(tabla){
  var filas=Object.keys(tabla||{});
  if(filas.length<2)return null;
  var columnas=[];
  filas.forEach(function(f){
    Object.keys(tabla[f]||{}).forEach(function(c){if(columnas.indexOf(c)<0)columnas.push(c);});
  });
  if(columnas.length<2)return null;
  var totalFila={},totalCol={},total=0;
  filas.forEach(function(f){
    totalFila[f]=0;
    columnas.forEach(function(c){
      var v=(tabla[f]&&tabla[f][c])||0;
      totalFila[f]+=v;
      totalCol[c]=(totalCol[c]||0)+v;
      total+=v;
    });
  });
  if(!(total>0))return null;
  var gl=(filas.length-1)*(columnas.length-1);
  var critico=_CHI2_CRITICO_95[gl];
  if(critico==null)return null;
  var chi2=0,minEsperado=Infinity,celdas=[];
  filas.forEach(function(f){
    columnas.forEach(function(c){
      var esperado=(totalFila[f]*totalCol[c])/total;
      var obs=(tabla[f]&&tabla[f][c])||0;
      if(esperado<minEsperado)minEsperado=esperado;
      if(esperado>0)chi2+=Math.pow(obs-esperado,2)/esperado;
      celdas.push({fila:f,columna:c,observado:obs,esperado:Math.round(esperado*10)/10,
        indice:esperado>0?Math.round((obs/esperado)*100)/100:null});
    });
  });
  if(minEsperado<5)return null;
  return{
    chi2:Math.round(chi2*100)/100,gl:gl,critico:critico,
    significativo:chi2>critico,
    filas:filas,columnas:columnas,celdas:celdas
  };
}

// Arma la tabla de contingencia componente × ubicación desde las fallas
// reales (mismo filtro esFallaMTBF que ya usa tasaFallaPorUbicacion y
// patronesOcultosFalla) y aplica testIndependenciaChi2.
function independenciaComponenteUbicacion(ot){
  var reales=(ot||[]).filter(esFallaMTBF).filter(function(o){return o.componente&&o.ubicacion;});
  var tabla={};
  reales.forEach(function(o){
    var comp=String(o.componente).trim();
    var ubi=String(o.ubicacion).trim();
    if(!comp||!ubi)return;
    (tabla[comp]=tabla[comp]||{})[ubi]=(tabla[comp][ubi]||0)+1;
  });
  return testIndependenciaChi2(tabla);
}

// Duraciones reales de reparación (horas) de TODA la flota — mismo parseo
// "Xh" de o.duracion que ya usa MTTR/analisisMTTRLogNormal (mismo criterio
// de "duración real registrada", no un supuesto).
function duracionesReparacionFlotaHoras(ot){
  var horas=[];
  (ot||[]).filter(esFallaMTBF).forEach(function(o){
    if(!o.duracion||o.duracion==='—')return;
    var m=String(o.duracion).match(/(\d+)h/);
    if(m)horas.push(parseInt(m[1],10));
  });
  return horas;
}

// Núcleo de la simulación: remuestrea (con reemplazo, bootstrap clásico) los
// intervalos y duraciones REALES para construir miles de historias futuras
// posibles de la flota durante horizonteDias, y resume la disponibilidad
// resultante de cada una. horasFlotaDiarias = horas de operación programadas
// de TODA la flota por día (suma de hrsDia de cada equipo activo — el
// "presupuesto" de horas que la disponibilidad puede perder). rngOpcional
// permite inyectar un generador determinístico en las pruebas — en
// producción se usa Math.random. Mínimo 8 intervalos y 5 duraciones (menos
// que eso y el remuestreo repite tan poca variedad real que el resultado es
// más ruido que señal) — null si no alcanza, nunca se inventa una muestra.
function simulacionMonteCarloDisponibilidad(intervalosDias,duracionesHoras,horizonteDias,horasFlotaDiarias,nSimulaciones,rngOpcional){
  var iv=(intervalosDias||[]).filter(function(x){return x>0;});
  var du=(duracionesHoras||[]).filter(function(x){return x>0;});
  if(iv.length<8||du.length<5)return null;
  if(!(horizonteDias>0)||!(horasFlotaDiarias>0))return null;
  var n=nSimulaciones>0?Math.round(nSimulaciones):1000;
  var rng=rngOpcional||Math.random;
  var horasTotales=horizonteDias*horasFlotaDiarias;
  var disponibilidades=[];
  var fallasPorSim=[];
  for(var s=0;s<n;s++){
    var t=0,downtime=0,fallas=0;
    while(true){
      t+=iv[Math.floor(rng()*iv.length)];
      if(t>=horizonteDias)break;
      fallas++;
      downtime+=du[Math.floor(rng()*du.length)];
    }
    disponibilidades.push(Math.max(0,1-downtime/horasTotales));
    fallasPorSim.push(fallas);
  }
  disponibilidades.sort(function(a,b){return a-b;});
  function pct(p){
    var idx=Math.min(disponibilidades.length-1,Math.max(0,Math.floor(p*(disponibilidades.length-1))));
    return disponibilidades[idx];
  }
  var sumFallas=fallasPorSim.reduce(function(a,b){return a+b;},0);
  return{
    horizonteDias:horizonteDias,
    nSimulaciones:n,
    dispP10:Math.round(pct(0.10)*1000)/10,
    dispP50:Math.round(pct(0.50)*1000)/10,
    dispP90:Math.round(pct(0.90)*1000)/10,
    fallasEsperadas:Math.round(sumFallas/n*10)/10,
    muestraIntervalos:iv.length,
    muestraDuraciones:du.length
  };
}

// ═══ SIMULADOR WHAT-IF DE POLÍTICAS DE MANTENIMIENTO (2026-09-17) ═══
// Cuarto ítem del tercer lote. simulacionMonteCarloDisponibilidad (arriba)
// ya remuestrea (bootstrap) los intervalos y duraciones REALES de la flota
// para proyectar disponibilidad futura — acá se agrega la posibilidad de
// probar un escenario hipotético ("¿y si...?") escalando esa MISMA
// distribución empírica por un factor que elige quien pregunta, nunca un
// valor que el sistema inventa: factorIntervalo (>1 = fallas más
// espaciadas — ej. "¿y si mejoramos la confiabilidad un 20%?" →
// factorIntervalo=1.2) y factorDuracion (<1 = reparaciones más rápidas —
// ej. "¿y si con más stock reparamos 30% más rápido?" → factorDuracion=
// 0.7). Es análisis de sensibilidad sobre datos reales (técnica estándar
// de simulación — escalar una distribución empírica para probar un
// supuesto), no una predicción nueva. Con factores=1 el resultado debe
// coincidir EXACTO con simulacionMonteCarloDisponibilidad para la misma
// muestra/semilla — verificado en tests.
function simulacionWhatIf(intervalosDias,duracionesHoras,horizonteDias,horasFlotaDiarias,nSimulaciones,factorIntervalo,factorDuracion,rngOpcional){
  var fi=factorIntervalo>0?factorIntervalo:1;
  var fd=factorDuracion>0?factorDuracion:1;
  var ivEsc=(intervalosDias||[]).map(function(x){return x*fi;});
  var durEsc=(duracionesHoras||[]).map(function(x){return x*fd;});
  var r=simulacionMonteCarloDisponibilidad(ivEsc,durEsc,horizonteDias,horasFlotaDiarias,nSimulaciones,rngOpcional);
  if(!r)return null;
  return Object.assign({factorIntervalo:fi,factorDuracion:fd},r);
}

// Compara el escenario base (datos reales, sin escalar) contra el
// what-if, con la MISMA muestra e igual cantidad de simulaciones — el
// delta es lo que importa para decidir si la política hipotética vale la
// pena evaluar en la realidad. null si cualquiera de los dos escenarios no
// tiene muestra suficiente (mismo mínimo que el núcleo, nunca se compara
// contra un escenario sin datos reales de respaldo).
function compararEscenariosMantenimiento(intervalosDias,duracionesHoras,horizonteDias,horasFlotaDiarias,nSimulaciones,factorIntervalo,factorDuracion,rngOpcional){
  var base=simulacionMonteCarloDisponibilidad(intervalosDias,duracionesHoras,horizonteDias,horasFlotaDiarias,nSimulaciones,rngOpcional);
  if(!base)return null;
  var escenario=simulacionWhatIf(intervalosDias,duracionesHoras,horizonteDias,horasFlotaDiarias,nSimulaciones,factorIntervalo,factorDuracion,rngOpcional);
  if(!escenario)return null;
  return{
    base:base,
    escenario:escenario,
    deltaDispP50:Math.round((escenario.dispP50-base.dispP50)*10)/10,
    deltaFallasEsperadas:Math.round((escenario.fallasEsperadas-base.fallasEsperadas)*10)/10
  };
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
    // Denominador (auditoría 2026-09-16, hallazgo real): antes se dividía por la
    // CANTIDAD de meses con compra (ultimos.length) — correcto para un ítem de compra
    // mensual, pero para uno de compra esporádica (ej. cada 6 meses) eso calculaba
    // "unidades por EVENTO de compra", no "unidades por mes real", inflando el gasto
    // proyectado hasta 5-6x (repuesto comprado 2 veces al año, ultimos.length=2 →
    // promedio = 1 unidad/mes en vez de ~0.17 real). Ahora se divide por los meses
    // CALENDARIO reales entre el primer y último de esos eventos (_contarMesesEntre,
    // mismo criterio ya usado en analisisDemandaRepuestos) — para compra mensual
    // consecutiva da el mismo resultado de siempre (span=cantidad de meses), y solo
    // cambia cuando los eventos están espaciados en el tiempo real.
    var totalUltimos=ultimos.reduce(function(s,m){return s+porMes[m];},0);
    var mesesSpan=_contarMesesEntre(ultimos[0],ultimos[ultimos.length-1])||1;
    var promMovil=totalUltimos/mesesSpan;
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
// filas). Cuarta pasada (mismo día, nueva lista de términos a revisar: foco,
// ampolleta, engrase, relleno, código activo, orbitrol, plumilla, afex,
// combustible): 'plumilla' tiene CERO ocurrencias reales — no se agrega.
// 'foco'/'ampolleta'/'engrase'/'relleno' ya estaban cubiertas por pasadas
// anteriores (verificado, no hacía falta nada), salvo "foco" sin especificar
// posición ("foco central derecho", "focos trasero"), que se amplió a
// palabra sola. 'código activo' se confirma correctamente sin categoría (un
// código de falla no dice a qué sistema pertenece sin más contexto — no es
// un hueco). Con evidencia real sí se agregan: 'orbitrol' (parte de
// dirección hidráulica, 3 filas) a Cilindro de Dirección, categoría nueva
// "Sistema AFEX" (extinción de incendios, 4 filas), categoría nueva
// "Estanque/Tapa de Combustible" (7 filas, distinto de filtro/bomba/
// inyectores) y plural 'filtros de combustible' a Filtro de Combustible.
// Cobertura real medida: 61.1% (760/1243). Quinta pasada (mismo día,
// respuesta del usuario a la cuarta: confirma que orbitrol es del
// subsistema de dirección — correcto, ya estaba así — y agrega una lista
// nueva de términos): 'carrilera', 'fusible' y 'reflectores'/'cinta
// reflectores' tienen CERO ocurrencias reales — no se agregan. 'válvula
// corta/larga de neumático' tampoco aparece con esa redacción exacta en
// ningún correctivo real — no se agrega (si en el futuro aparece con otra
// redacción, se revisa con evidencia en ese momento). 'acumulador' ya
// quedaba cubierto por 'freno' en el 100% de los casos reales (siempre es
// "acumulador de freno" en esta flota). Con evidencia real sí se agregan:
// 'antena' a Radio/Comunicaciones (2 filas sin "radio base" cerca);
// categoría nueva "Sistema Anticolisión/Fatiga (ADAS)" uniendo somnolencia +
// anticolisión (11 filas — es tecnología de asistencia al conductor, no un
// componente mecánico); 'entrecalza'/'entrecalzas' a GET/Cuchillas (16
// filas — son los separadores entre segmentos de cuchilla, misma familia
// GET); categoría nueva "Correas" para correas de accesorios que no
// mencionan alternador (5 filas — colocada DESPUÉS de Alternador a
// propósito para no cambiar la clasificación ya correcta de "correa
// alternador"); y 'kick dawn'/'pick dawn' a Transmisión (grafía real del
// kickdown). Cobertura real medida: 63.6% (791/1243). Sexta pasada (mismo
// día, continuando la revisión del siguiente tramo de síntomas sin
// categoría): 'ripper'/'riper' a GET/Cuchillas (9 filas — misma familia de
// herramienta de corte), 'sproket' (typo sin "c") a Tren de Rodaje (4
// filas), categoría nueva "Joystick/Palanca de Mando" (3 filas — distinto
// de la "palanca" genérica, que se mantiene sin clasificar por ambigua) y
// 'posicion 1/3 baja presion' a Neumáticos como FRASES exactas, no la
// palabra "presión" sola (porque "código baja presión de FRENOS" es un
// caso real distinto que ya clasificaba bien por "freno" — una palabra
// suelta lo habría roto). Cobertura real medida: 64.9% (807/1243). Séptima
// pasada (mismo día — el usuario definió 6 términos que no se lograban
// interpretar solo con el texto, todos confirmados por él como experto del
// dominio antes de agregarlos): 'reel' (sensores de motor) a Motor;
// 'canillera'/'canilleras' (protecciones de desgaste del balde/pala) a
// GET/Cuchillas; 'garra maestar'/'garra maestra' (conexión maestra de
// cadena de oruga) a Tren de Rodaje; 'f&s' (abreviación real de "Fatiga y
// Somnolencia") a Sistema Anticolisión/Fatiga; 'check point'/'check  point'
// (testigo de torque en pernos de rueda) a Neumáticos; 'viscoso' (embrague
// viscoso del ventilador) a Radiador/Enfriamiento. Cobertura real medida:
// 65.6% (816/1243). Octava pasada (mismo día): 'conversor' a Sistema
// Eléctrico y categoría nueva "Parabrisas/Vidrios" (2 filas cada una — las
// últimas dos con 2+ ocurrencias reales que quedaban sin categoría). De
// acá en adelante lo que resta son, de los 1.243 correctivos reales, ~145
// filas genuinamente sin componente (mantenimiento preventivo, chequeo
// preventivo, cierre de backlog, partida de equipo, código activo,
// mantención diaria/semanal, equipo empantanado) y el resto ya es una cola
// de síntomas ÚNICOS (n=1 cada uno) — seguir ampliando el diccionario ahí
// exige revisar caso a caso con quien conoce el taller, no con evidencia
// estadística sola. Cobertura real medida: 66.0% (821/1243). Novena pasada
// (mismo día — el usuario preguntó "¿se puede o no?" seguir sumando):
// esta vez, en vez de solo leer la lista ordenada por frecuencia, se contó
// la frecuencia de CADA PALABRA suelta a través de las filas restantes
// (excluyendo las ya conocidas como "no es componente") — encontró grupos
// reales que la lectura manual anterior no había juntado: tolva (9 filas,
// categoría nueva "Tolva/Dumper"), puerta (4, categoría nueva "Puertas"),
// espejo (4, categoría nueva "Espejos"), baliza+pértiga (6, categoría
// nueva "Baliza/Pértiga", van juntas porque un caso real las menciona en
// la misma falla), cámara de retroceso (distinta de la cámara ADAS, que
// ya tenía categoría propia), 'arranque' (sinónimo real de "motor de
// partida"), 'luces' sin "baja/alta" cerca, 'calefaccion' (la otra mitad
// de climatización junto a Aire Acondicionado), 'ptt' sin "falla" cerca,
// 'filtro de cabina' (junto a Filtro de Aire) y el typo 'anticolicion'.
// 'pala' (motoniveladora) apareció con volumen real pero en esta pasada se
// descartó agregarla como SUBSTRING suelto: "pala" es tan corta que calza
// como PREFIJO de "palanca" ("palanca" empieza con "pala") — agregarla así
// habría clasificado mal cada mención de "palanca" (que se mantiene sin
// categoría a propósito, por ambigua). CORRECCIÓN POSTERIOR (mismo día): el
// usuario confirmó el término con ejemplo real ("se cambia elemento de pala
// de moto") y se agregó de forma segura extendiendo _componenteDeSintoma
// para aceptar también RegExp (no solo strings) y usando /\bpala\b/
// (coincidencia de PALABRA COMPLETA, no substring) — ver categoría "Pala
// (Motoniveladora)" más abajo. Verificado: matchea las 11 filas reales de
// pala de motoniveladora y sigue sin matchear 'palanca'. Cobertura real
// medida: 69.9% (869/1243). El resto
// son mayormente
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
  // 'arranque' agregada (2026-08-28, novena pasada): sinónimo real de
  // "motor de partida" en el vocabulario de esta flota (5 filas reales
  // adicionales: "sin arranque", "equipo no da arranque", etc.).
  ['Motor de Partida',['motor de partida','motor partida','arranque']],
  // 'orbitrol' agregada (2026-08-28, cuarta pasada): la válvula orbitrol es
  // parte del sistema de dirección hidráulica (3 filas reales, todas
  // claramente de dirección: "falla en orbitrol", "fuga orbitrol",
  // "manguera de orbitrol").
  ['Cilindro de Dirección',['cilindro direccion','cilindro de direccion','cilindro dirección','cilindro de dirección','cilindro volante','orbitrol']],
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
  // 'posicion 1 baja presion'/'posicion 3 baja presion' agregadas (2026-08-28,
  // sexta pasada) como FRASES exactas, no la palabra "presion" sola —
  // "codigo baja presion de frenos" (otro caso real) es de Frenos, no de
  // neumáticos, así que una palabra suelta habría generado un falso
  // positivo ahí.
  // 'check  point'/'check point' agregadas (2026-08-28, séptima pasada, el
  // usuario confirmó el término): es el testigo/indicador de torque que se
  // instala en los pernos de rueda del neumático.
  ['Neumáticos',['neumatico','neumático','neumaticos','neumáticos','despresuriz','desprezuriz','presuriz','posicion 1 baja presion','posicion 3 baja presion','check  point','check point']],
  ['Frenos',['freno']],
  // 'kick dawn'/'pick dawn' agregadas (2026-08-28, quinta pasada): grafía
  // real encontrada en los datos para "kickdown" (el mecanismo de la
  // palanca/pedal que fuerza el cambio a marcha inferior).
  ['Transmisión',['transmision','transmisión','kick dawn','pick dawn']],
  ['Diferencial',['diferencial','diferecial']],
  ['Mandos Finales',['mandos finales','mando final']],
  ['Turbo',['turbo']],
  ['Alternador',['alternador']],
  // Nueva (2026-08-28, quinta pasada): correas de accesorios (alternador,
  // compresor de A/C, ventilador) — se pone DESPUÉS de Alternador a
  // propósito, para que "correa alternador" siga ganando como Alternador
  // (ya lo hacía) y esta categoría solo atrape el resto ("correa
  // compresor", "correa del ventilador", 5 filas reales que no
  // mencionaban ningún sistema más específico).
  ['Correas',['correa']],
  ['Bomba de Agua',['bomba de agua','bomba agua']],
  // 'enfriador'/'enfriadores'/'refrigeracion' agregadas (2026-08-28): mismo
  // concepto que 'radiador'/'refrigerante' con otra familia de palabras
  // ("limpieza de enfriadores", "cañería de refrigeración rota") que no
  // calzaba con ninguna de las dos.
  // 'viscoso' agregada (2026-08-28, séptima pasada, el usuario confirmó el
  // término): es el embrague viscoso del ventilador de enfriamiento del
  // motor.
  ['Radiador/Enfriamiento',['radiador','refrigerante','enfriador','enfriadores','refrigeracion','viscoso']],
  // 'suspencion' agregada (2026-08-28, tercera pasada): typo real muy
  // frecuente (20 filas) — "suspensión" escrita con "c" en vez de "s". El
  // único caso ambiguo real ("cable de suspensión neumática de ASIENTO")
  // igual clasifica bien porque "Asiento" está antes en esta lista y gana
  // primero.
  ['Suspensión',['suspension','suspensión','suspencion']],
  ['Inyectores',['inyector','inyectores']],
  // 'filtro decombustible' agregada (2026-08-28): typo real sin espacio
  // ("se reemplaza filtro decombustible y se puraga sistema", 2 filas).
  // 'filtros de combustible'/'filtros combustible' agregadas (2026-08-28,
  // cuarta pasada): plural real ("se realiza cambio de filtros de
  // combustible") que no calzaba con el singular.
  ['Filtro de Combustible',['filtro de combustible','filtro combustible','filtro decombustible','filtros de combustible','filtros combustible']],
  // 'filtro de cabina'/'filtro cabina' agregadas (2026-08-28, novena
  // pasada): el filtro de aire de la cabina (ventilación/climatización),
  // misma familia funcional que el filtro de aire del motor.
  ['Filtro de Aire',['filtro de aire','filtro aire','filtro de cabina','filtro cabina']],
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
  // 'foco'/'focos' agregadas como palabra sola (2026-08-28, cuarta pasada):
  // las frases específicas ('foco delantero', etc.) no atrapaban variantes
  // reales como "foco central derecho", "focos trasero", "falla en foco,
  // se cambia foco bajo derecho" — revisados todos los casos reales que
  // contienen "foco" sin categoría, los 3 son de focos del equipo.
  // 'luces' agregada (2026-08-28, novena pasada): variantes reales sin
  // "baja"/"alta" cerca ("luces trasera quemadas", "luces niblineras").
  ['Foco/Ampolleta',['ampolleta','ampoleta','alpolleta','amplolleta','foco delantero','foco trasero','foco frontal','foco faenero','focos faeneros','faenero','luz baja','luz alta','foco','focos','luces']],
  ['Sistema Hidráulico',['hidraulico','hidráulico']],
  // 'eléctrica'/'electrica' (2026-08-28, forma femenina — "falla eléctrica" no
  // calzaba con el keyword 'eléctrico' por la concordancia de género, 15
  // filas reales perdidas por esto solo) y 'bocina' (accesorio eléctrico)
  // agregadas.
  // 'conversor' agregada (2026-08-28, octava pasada): convertidor de
  // voltaje/alimentación eléctrica (2 filas reales, ambas de naturaleza
  // eléctrica pese a alimentar sistemas distintos — cableado general y
  // radio musical).
  ['Sistema Eléctrico',['electrico','eléctrico','elÃ©ctrico','eléctrica','electrica','bocina','conversor']],
  // 'se carga ac'/'chequeo a/c'/'bajo flujo de a/c'/'sistema de ac'
  // agregadas (2026-08-28): variantes reales de "a/c" sin el espacio
  // requerido a ambos lados por el keyword ' a/c ' — se agregan como
  // frases completas, no la sigla sola ("ac"), porque "ac" de 2 letras
  // aparece dentro de otras palabras sin relación (ej. "AdBlue" escrito
  // "acblue" en un síntoma real) y generaría falsos positivos.
  // 'calefaccion' agregada (2026-08-28, novena pasada): la otra mitad del
  // sistema de climatización (calefacción, no solo enfriamiento).
  ['Aire Acondicionado',['aire acondicionado',' a/c ','a/c.','condensador','se carga ac','chequeo a/c','bajo flujo de a/c','sistema de ac','calefaccion']],
  // 'entrecalza'/'entrecalzas' agregadas (2026-08-28, quinta pasada): son
  // los separadores/adaptadores entre segmentos de cuchilla — parte de la
  // misma familia GET (Ground Engaging Tools), 16 filas reales sin
  // categoría hasta ahora.
  // 'ripper'/'riper' agregadas (2026-08-28, sexta pasada): el ripper (diente
  // desgarrador de bulldozer) es la misma familia de herramienta de corte
  // que cuchillas/GET (9 filas reales).
  // 'canillera'/'canilleras' agregadas (2026-08-28, séptima pasada, el
  // usuario confirmó el término): protecciones de desgaste del balde/pala,
  // misma familia que el resto de GET/Cuchillas.
  // 'cuchillo'/'cuchillos' agregadas (2026-09-23, décima pasada): variante
  // en masculino de 'cuchilla' que usan varios técnicos en el síntoma libre
  // ("se cambia cuchillo", "CAMBIO DE CUCHILLOS") — misma pieza física, sin
  // categoría hasta ahora (4 filas reales verificadas, todas motoniveladora,
  // cero relación con otro objeto llamado "cuchillo" en el resto de la base).
  ['GET / Cuchillas',['cuchilla','cuchillo','cuchillos','entrediente','gets','entrecalza','entrecalzas','ripper','riper','canillera','canilleras']],
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
  // 'sproket' agregada (2026-08-28, sexta pasada): typo real muy consistente
  // (4 filas, todas sin la "c") — "sprocket" ya estaba, faltaba esta grafía.
  // 'garra maestar'/'garra maestra' agregadas (2026-08-28, séptima pasada,
  // el usuario confirmó el término): las conexiones maestras de la cadena
  // de oruga del bulldozer.
  ['Tren de Rodaje',['oruga','cadena','sprocket','sproket','zapata','rodillo','rueda tensora','rueda motriz','garra maestar','garra maestra']],
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
  // 'antena' agregada (2026-08-28, quinta pasada): variantes reales sin
  // "radio base" cerca ("falla cable antena", "se cambia cable de antena
  // principal").
  // 'ptt' agregada como palabra sola (2026-08-28, novena pasada): variante
  // real sin "falla" cerca ("ptt de radio en mal estado,se cambia").
  ['Radio/Comunicaciones',['radio base','falla ptt','antena','ptt']],
  // Nueva (2026-08-28, quinta pasada): sistema anticolisión y de detección
  // de fatiga/somnolencia (cámara DMS) — tecnología de asistencia al
  // conductor, categoría de seguridad propia, no un componente mecánico
  // más (11 filas reales combinadas).
  // 'f&s' agregada (2026-08-28, séptima pasada, el usuario confirmó el
  // término): abreviación real de "Fatiga y Somnolencia", el mismo sistema.
  // 'anticolicion' agregada (2026-08-28, novena pasada): typo real
  // ("anticolicion" con "c", en vez de "anticolision"/"anticolisión").
  ['Sistema Anticolisión/Fatiga (ADAS)',['somnolencia','anticolision','anticolisión','anticolicion','f&s']],
  // Nueva (2026-08-28, tercera pasada, término sugerido por el usuario): la
  // tornamesa es el mecanismo de giro de la superestructura (cargador
  // frontal/excavadora) — sin categoría hasta ahora (2 filas reales).
  ['Tornamesa/Giro',['tornamesa','torna mesa']],
  // Nueva (2026-08-28, sexta pasada): el joystick de control de implementos
  // es un componente físico propio, distinto de la "palanca" genérica (que
  // se dejó sin clasificar por cruzar demasiados sistemas) — 3 filas
  // reales, todas claramente sobre el joystick.
  ['Joystick/Palanca de Mando',['joystick','joytick','joitick']],
  // Nueva (2026-08-28, octava pasada): parabrisas/vidrios — 2 filas reales,
  // sin categoría hasta ahora.
  ['Parabrisas/Vidrios',['parabrisas']],
  // Nuevas (2026-08-28, novena pasada), todas con evidencia real revisada
  // una por una:
  ['Tolva/Dumper',['tolva']], // 9 filas — la caja/batea de volteo
  ['Puertas',['puerta']], // 4 filas
  ['Espejos',['espejo']], // 4 filas
  // Baliza (luz giratoria) y pértiga (el mástil que la sostiene) van
  // juntas — un caso real las menciona en la misma falla ("pertica y
  // baliza no funcional").
  ['Baliza/Pértiga (Señalización)',['baliza','pertiga','pertica']],
  // Cámara de retroceso simple (reversa) — distinta de la cámara del
  // sistema ADAS (fatiga/anticolisión), que ya tiene su propia categoría.
  ['Cámara de Retroceso',['camara de retroceso','camara retroceso']],
  // Nueva (2026-08-28, cuarta pasada, término sugerido por el usuario): AFEX
  // es el sistema automático de extinción de incendios del equipo — una
  // falla ahí es de seguridad, no un componente mecánico más (4 filas
  // reales: "se normaliza sistema afex", "sistema afex...codigo activo").
  ['Sistema AFEX (Extinción de Incendios)',['afex']],
  // Nueva (2026-08-28, cuarta pasada): estanque y tapa de combustible — un
  // problema físicamente distinto de filtro/bomba/inyectores de combustible
  // (7 filas reales: "estanque combustible", "falta de tapa combustible",
  // "se cambia tapa de llenado de combustible").
  ['Estanque/Tapa de Combustible',['estanque combustible','estanque de combustible','tapa combustible','tapa de combustible','tapa de llenado de combustible']],
  // Nueva (2026-08-28, novena pasada, corrección posterior): 'pala' es la
  // hoja/cuchilla de la motoniveladora (el usuario lo confirmó con ejemplo
  // real: "se cambia elemento de pala de moto"). En la novena pasada se
  // había descartado a propósito como palabra suelta porque 'pala' es
  // prefijo literal de 'palanca' (término deliberadamente sin categoría,
  // ambiguo entre subsistemas) — agregarla como substring habría
  // clasificado mal cada mención de 'palanca'. Solución: se extendió
  // _componenteDeSintoma para aceptar también RegExp además de strings, y
  // aquí se usa /\bpala\b/ (coincidencia de palabra completa) en vez de
  // substring. Verificado contra las 889 filas reales distintas: matchea
  // exactamente 11 filas limpias de pala de motoniveladora ("se reemplaza
  // barra tensora pala", "cilindro direccion pala", "cambio
  // dedeslizdera de pala", etc.) y NO matchea 'palanca accionamiento' ni
  // 'se instala palanca control' (se probó explícitamente con
  // re.test(...)===false en ambos casos). Se ubica cerca del final para
  // que categorías más específicas que también podrían mencionar "pala"
  // en otro sentido (p.ej. Cilindro de Dirección) sigan ganando primero.
  ['Pala (Motoniveladora)',[/\bpala\b/]],
  // 'reel' agregada (2026-08-28, séptima pasada, el usuario confirmó el
  // término): son sensores del motor.
  ['Motor',['motor','reel']] // genérico — al final para que las categorías específicas de arriba (Motor de Partida, Bomba de Agua, etc.) ganen primero
];
// Deriva una categoría de componente desde el texto libre de "síntoma" cuando el
// campo estructurado viene vacío (que es casi siempre, ver nota arriba).
function _componenteDeSintoma(sintoma){
  if(!sintoma)return '';
  var t=sintoma.toLowerCase();
  for(var i=0;i<_CATEGORIAS_COMPONENTE.length;i++){
    var cat=_CATEGORIAS_COMPONENTE[i][0],keys=_CATEGORIAS_COMPONENTE[i][1];
    for(var j=0;j<keys.length;j++){var k=keys[j];if(k instanceof RegExp ? k.test(t) : t.indexOf(k)>=0)return cat;}
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
  window.equiposConSaludFlota = equiposConSaludFlota;
  window.motivoPrincipalSalud = motivoPrincipalSalud;
  window.peoresDimensionesSalud = peoresDimensionesSalud;
  window.recomendacionDimensionSalud = recomendacionDimensionSalud;
  window.registrarSnapshotSalud = registrarSnapshotSalud;
  window.tendenciaSaludSemanal = tendenciaSaludSemanal;
  window.equiposFueraDeServicioAhora = equiposFueraDeServicioAhora;
  window.validarMotivoPmPendiente = validarMotivoPmPendiente;
  window.mtbfFlotaReal = mtbfFlotaReal;
  window.esFallaMTBF = esFallaMTBF;
  window._otHistComoOt = _otHistComoOt;
  window._informesFallaComoOt = _informesFallaComoOt;
  window.contarFallasMes = contarFallasMes;
  window.ratioPreventivo = ratioPreventivo;
  window.equiposSinCriticidad = equiposSinCriticidad;
  window.fechaAyer = fechaAyer;
  window.fechaMismoDiaAnioPasado = fechaMismoDiaAnioPasado;
  window.presupuestoProrrateado = presupuestoProrrateado;
  window.probabilidadFallaDesdeEventos = probabilidadFallaDesdeEventos;
  window.paretoAcumulado = paretoAcumulado;
  window.confiabilidadReal = confiabilidadReal;
  window.ajusteWeibull = ajusteWeibull;
  window.ajusteWeibullVidas = ajusteWeibullVidas;
  window.analisisVidaUtilPorGrupo = analisisVidaUtilPorGrupo;
  window.analisisVidaUtilCorrectivosPorComponente = analisisVidaUtilCorrectivosPorComponente;
  window.kaplanMeier = kaplanMeier;
  window.kaplanMeierCorrectivosPorComponente = kaplanMeierCorrectivosPorComponente;
  window.mcf = mcf;
  window.mcfCorrectivosPorComponente = mcfCorrectivosPorComponente;
  window.crowAMSAA = crowAMSAA;
  window.crowAMSAAPorComponente = crowAMSAAPorComponente;
  window.interpretacionCrowAMSAA = interpretacionCrowAMSAA;
  window.confiabilidadWeibull = confiabilidadWeibull;
  window.interpretacionFormaWeibull = interpretacionFormaWeibull;
  window.regEsATiempo = regEsATiempo;
  window._gastoProyectadoCategoria = _gastoProyectadoCategoria;
  window.agruparPeriodo = agruparPeriodo;
  window._CATEGORIAS_COMPONENTE = _CATEGORIAS_COMPONENTE;
  window._componenteDeSintoma = _componenteDeSintoma;
  window.probabilidadComponente = probabilidadComponente;
  window.probabilidadEquipoSeveridad = probabilidadEquipoSeveridad;
  window.probabilidadStockQuiebre = probabilidadStockQuiebre;
  window.probabilidadReincidencia = probabilidadReincidencia;
  window.umbralesImpacto = umbralesImpacto;
  window.impactoDeValor = impactoDeValor;
  window.nivelRiesgoPxI = nivelRiesgoPxI;
  window.criticidadDinamicaComponente = criticidadDinamicaComponente;
  window.matrizCriticidadDinamica = matrizCriticidadDinamica;
  window.dispIntrinsecaEquipoMes = dispIntrinsecaEquipoMes;
  window.tasaFallaPorUbicacion = tasaFallaPorUbicacion;
  window.edadVirtualEquipo = edadVirtualEquipo;
  window.costoRelativoMantenimiento = costoRelativoMantenimiento;
  window.costoRelativoMantenimientoFlota = costoRelativoMantenimientoFlota;
  window.costoSugeridoPorCruce = costoSugeridoPorCruce;
  window.senalUnificadaReemplazo = senalUnificadaReemplazo;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    C, fd, fn, escapeHtml, csvCeldaSegura,
    _tokensMaterial, _scoreMaterial, precioMaterial,
    esLubricante, vencReglaDefault, vencCalcProximo, vencEstado,
    fechaEsPlausible, fechaEsAnterior, duracionHM, medianaPositiva, hhPlanEstimator,
    LUB_REEMPLAZO, lubVigente, lubEsObsoleto, construirLecturaHistorial,
    predFromOrdenes, ordenesSinOutliers, aceiteOutliers, outliersMultivariadosAceite, cusumAceite, cusumAceitePorComponente, analisisDemandaRepuestos, proyeccionElementosDesgaste, modeloColasMMC, bayesEmpiricoGammaPoisson, probabilidadQuiebreLeadTime, probabilidadQuiebreABanda, criticidadEquipoABanda, matrizCriticidadRepuestos, analisisABCXYZRepuestos, puntoReordenSeguridad, puntosReordenRepuestos, analisisMTTRLogNormal, stockEstado, compEstado, tasaDiariaReal, horomEnFecha, rangoDias, dispDownMap, dispEquipoMes, dispIntrinsecaEquipoMes, pagSlice, hayConflictoIds, costoRelativoMantenimiento, costoRelativoMantenimientoFlota, _concentracionMaximaOC, costoSugeridoPorCruce, senalUnificadaReemplazo,
    validarSaltoHorometro, resolverDestrabePorOC, verificarIntegridad,
    indiceSaludFlota, scoreSaludEquipo, equiposConSaludFlota, motivoPrincipalSalud, peoresDimensionesSalud, recomendacionDimensionSalud, registrarSnapshotSalud, tendenciaSaludSemanal, matrizTransicionSalud, proyeccionSaludNSemanas,
    equiposFueraDeServicioAhora, validarMotivoPmPendiente, sugerenciaAgruparPM, intervalosFallaFlotaDias, duracionesReparacionFlotaHoras, simulacionMonteCarloDisponibilidad, simulacionWhatIf, compararEscenariosMantenimiento, mtbfFlotaReal, confiabilidadReal, intervaloConfianzaMTBF, errorEstandarMTTR, wilsonIC95, mannKendallTendencia, r2RegresionLineal, cartaControlIMR, cartaControlEWMA, mannWhitneyU, anovaUnFactor, kruskalWallis, levenePruebaVarianzas, ajusteWeibull, ajusteWeibullVidas, analisisVidaUtilPorGrupo, analisisVidaUtilCorrectivosPorComponente, ajusteWeibullCensurado, ajusteWeibullEquipoCensurado, analisisVidaUtilPorGrupoCensurado, ajusteWeibullCorrectivosPorComponenteCensurado, kijimaEquipo, simulacionTrayectoriasGRP, simulacionTrayectoriasGRPDesdeKijima, kaplanMeier, logRankTest, coxPHBinario, kaplanMeierCorrectivosPorComponente, competingRisks, competingRisksPorEquipo, mcf, mcfCorrectivosPorComponente, crowAMSAA, crowAMSAAPorComponente, interpretacionCrowAMSAA, indiceEfectividadMantenimiento, interpretacionEfectividadMantenimiento, rulWeibull, rulHibridoComponente, rulHibridoPorComponente, oportunidadMantenimiento, oportunidadesMantenimientoFlota, confiabilidadWeibull, confiabilidadSistemaEquipo, interpretacionFormaWeibull, correlacionAceiteFallas, regEsATiempo, esFallaMTBF, tasaFallaPorUbicacion, testChiCuadradoUniforme, patronesOcultosFalla, causasLatentesRepetidas, testIndependenciaChi2, independenciaComponenteUbicacion, edadVirtualEquipo,
    probabilidadFallaDesdeEventos, paretoAcumulado, _otHistComoOt, _informesFallaComoOt, contarFallasMes, ratioPreventivo,
    _gastoProyectadoCategoria, agruparPeriodo, equiposSinCriticidad, fechaAyer, fechaMismoDiaAnioPasado, presupuestoProrrateado,
    _CATEGORIAS_COMPONENTE, _componenteDeSintoma, _SUBPIEZAS_DESGASTE, _subpiezasDeSintoma,
    probabilidadComponente, probabilidadEquipoSeveridad, probabilidadStockQuiebre, probabilidadReincidencia,
    umbralesImpacto, impactoDeValor, nivelRiesgoPxI, criticidadDinamicaComponente, matrizCriticidadDinamica
  };
}
