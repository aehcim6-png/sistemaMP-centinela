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

// % Correctivo Reactivo (por HORAS, no por cantidad de intervenciones) — a
// diferencia de ratioPreventivo (que cuenta intervenciones), este mide el
// tiempo real dedicado a cada tipo: un mes con pocas OT correctivas pero muy
// largas sigue siendo mayormente reactivo en horas aunque el preventivo gane
// en cantidad. horasCorrectivas = suma de las duraciones "Xh" de o.duracion
// en las fallas reales (mismo parseo que C.mttrReal); horasPreventivas = suma
// de r.duracionH en 'reg'. null si no hubo ninguna hora registrada de ningún
// tipo — mismo criterio de ratioPreventivo, nunca se inventa 0%/100%.
function porcentajeCorrectivoReactivo(horasCorrectivas,horasPreventivas){
  var total=(horasCorrectivas||0)+(horasPreventivas||0);
  return total?Math.round(horasCorrectivas/total*100):null;
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
  // R² de la recta de probabilidad Weibull (2026-10-06) — responde "¿los
  // puntos siguen la recta?": con modos de falla mezclados los puntos se
  // curvan y R² baja. Se evalúa con los MISMOS puntos de la regresión de
  // arriba (no repite el ajuste). Ver interpretacionAjusteWeibull.
  var reg=r2RegresionLineal(xs.map(function(x,i){return{x:x,y:ys[i]};}));
  if(reg)r.r2=reg.r2;
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
  // Excluye líneas de OC cuyo costo coincide EXACTO con el valorCompra del
  // equipo (2026-09-30, caso real: CA-10505/CA-10506 — dos camionetas de
  // apoyo cuya propia compra quedó registrada como una línea más de OC
  // ("Camioneta", costo == valorCompra). Si entrara al cálculo, comparar el
  // equipo contra sí mismo da un Costo Relativo de ~92% que en realidad es 0
  // — fue la compra inicial del activo, nunca un repuesto/mantención.
  var conFecha=(ocEquipo||[]).filter(function(o){return o&&o.fecha&&o.costo!==valorCompra;});
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
// número no quede suelto sin explicación de qué significa. 2026-10-06: cada
// régimen suma además QUÉ HACER (flujo "Cómo usar Weibull" de Predictiva21):
// con β<1 reemplazar por edad empeora el problema (se cambian piezas que
// todavía estaban en su mejor momento y cada instalación nueva reabre el
// riesgo de falla temprana); con β≈1 la edad no predice la falla, así que
// reemplazar por edad no cambia nada y lo útil es monitorear por condición;
// con β>1 sí vale evaluar el reemplazo preventivo por edad. No se calcula
// una "vida óptima por costos" (haría falta costo preventivo y de falla por
// componente, que hoy no están completos) — solo se orienta la decisión.
function interpretacionFormaWeibull(beta){
  if(beta==null)return null;
  if(beta<0.9)return 'Fallas tempranas — la tasa de falla BAJA con el uso (posible problema de instalación/rodaje). Revisar montaje, arranque y calidad del repuesto; reemplazar por edad empeora el problema';
  if(beta<=1.1)return 'Fallas aleatorias — tasa de falla estable, no depende de la edad del componente. Reemplazar por edad no cambia nada: conviene monitoreo por condición';
  return 'Desgaste — la tasa de falla SUBE con el uso (esperable). Evaluar el reemplazo preventivo por edad';
}

// Bondad de ajuste de la recta de probabilidad Weibull (2026-10-06) — paso
// "¿los puntos siguen la recta?" del flujo "Cómo usar Weibull": si los
// intervalos reales NO se alinean, lo más común es que haya MODOS DE FALLA
// DISTINTOS mezclados en el mismo análisis (cada modo tiene su propio β, y
// juntos curvan la recta) — o un valor atípico (un intervalo muy distinto
// del resto). Entonces el β/η ajustado describe un promedio que no
// representa a ninguno de los modos. r2 viene de _ajusteWeibullDeMuestra
// (solo ajustes por regresión de rangos medianos; los de máxima
// verosimilitud con censura no tienen recta que evaluar). Bandas 0.9 / 0.8:
// criterio práctico para dar contexto de un vistazo, igual que prioridadNPR
// — NO un umbral de norma certificada. LÍMITE: detecta mezclas marcadas
// (probado: dos modos muy separados dan R²≈0.73-0.77), no mezclas sutiles
// (dos grupos de vida cercanos pueden dar ≈0.81, "aceptable"). null si no
// hay r2.
function interpretacionAjusteWeibull(r2){
  if(r2==null)return null;
  if(r2>=0.9)return{nivel:'bueno',texto:'los puntos siguen bien la recta'};
  if(r2>=0.8)return{nivel:'aceptable',texto:'los puntos siguen la recta con algo de dispersión'};
  return{nivel:'debil',texto:'los puntos NO siguen bien la recta — posible mezcla de modos de falla distintos o valores atípicos: separar por componente/modo y volver a ajustar'};
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

// ═══ PRODUCCIÓN PERDIDA POR DETENCIÓN (2026-09-25) ═══ — pedido real del
// usuario: el contrato real con Centinela se paga por m3 (no por hora de
// arriendo), así que "el equipo estuvo detenido 40 horas" no es el
// argumento que mueve a un gerente — "esas 40 horas eran ~520 m3 que no se
// entregaron" sí lo es, porque habla el mismo idioma del contrato.
//
// rendimiento_modelos (Supabase, nueva tabla) guarda, por MODELO real de
// equipo (no por unidad — todos los de un mismo modelo rinden igual en
// teoría), los parámetros de la fórmula de rendimiento del fabricante. Cada
// tipo de equipo usa una fórmula distinta (cargador: Q×LF×E×60/Cm; camión:
// necesita además distancia/velocidades/tiempos; motoniveladora: ancho de
// hoja/velocidad/pasadas; etc.) — por eso 'parametros' es JSONB libre en
// vez de columnas fijas, y por eso HOY solo está implementada la fórmula de
// Cargador Frontal (la única con los 4 datos completos verificados: Q real
// de ficha técnica Komatsu + LF/E/Cm reales de terreno). Las otras 4
// familias (Camión Minero, Motoniveladora, Bulldozer, Camión Aljibe) tienen
// su capacidad real cargada como referencia, pero sin fórmula activa
// todavía — se agregan cuando terreno aporte el resto de sus parámetros
// reales, nunca con valores inventados.
//
// _normalizarModelo existe porque el mismo modelo real aparece escrito de
// más de una forma en Equipos (ej. "HD785-7" vs "HD-785-7", verificado
// contra la base real) — normaliza a solo letras/números en minúscula para
// que ese tipo de inconsistencia de tipeo no rompa el cruce.
function _normalizarModelo(s){
  return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
}
// R = Q×LF×E×60/Cm (m3/h) — misma fórmula publicada (Cosrec R&H) que el
// usuario compartió y verificó contra su propio ejemplo práctico (Q=1,30
// LF=0,85 E=0,75 Cm=1,00 → R=49,73 m3/h). Nunca inventa un parámetro
// faltante: si Q, LF, E o Cm no son números > 0, devuelve null.
function rendimientoTeoricoCargadorFrontal(params){
  if(!params)return null;
  var q=params.q, lf=params.lf, e=params.e, cm=params.cm;
  if(!(q>0)||!(lf>0)||!(e>0)||!(cm>0))return null;
  return q*lf*e*60/cm;
}
// Cruza cada equipo Cargador Frontal cuyo modelo tenga los 4 parámetros
// reales cargados, contra sus horas reales de detención (downMap, mismo
// formato que arma dispDownMap: {sigla:{fecha:horas}}) — nunca inventa
// horas ni rendimiento: un equipo sin horas reales de detención registradas
// o cuyo modelo no tenga los 4 parámetros completos, simplemente no
// aparece en el resultado.
function produccionPerdidaPorDetencion(equipos, rendModelos, downMap){
  var porModeloNorm={};
  (rendModelos||[]).forEach(function(r){
    if(!r||!r.modelo)return;
    porModeloNorm[_normalizarModelo(r.modelo)]=r;
  });
  var out=[];
  (equipos||[]).forEach(function(eqp){
    if(!eqp||!eqp.sigla||!eqp.modelo)return;
    var rm=porModeloNorm[_normalizarModelo(eqp.modelo)];
    if(!rm||rm.tipo!=='Cargador Frontal')return;
    var r=rendimientoTeoricoCargadorFrontal(rm.parametros||{});
    if(r==null)return;
    var dias=(downMap&&downMap[eqp.sigla])||{};
    var horasDet=0;
    Object.keys(dias).forEach(function(d){horasDet+=dias[d]||0;});
    if(!(horasDet>0))return;
    out.push({
      sigla:eqp.sigla,
      tipo:eqp.tipo||'',
      modelo:eqp.modelo,
      rendimientoTeorico:Math.round(r*100)/100,
      horasDetenidas:Math.round(horasDet*10)/10,
      m3Perdidos:Math.round(horasDet*r)
    });
  });
  return out.sort(function(a,b){return b.m3Perdidos-a.m3Perdidos;});
}

// ═══ RENDIMIENTO REAL / PÉRDIDA POR INDISPONIBILIDAD (2026-09-30) ═══ —
// v1 del plan de ingesta de Reportes de Turno (produccion_turno/
// produccion_turno_equipos, ver migración 20260930210000). Separadas a
// propósito de equiposConSaludFlota: esa función combina 4 dimensiones de
// SALUD/confiabilidad (Componentes, Neumáticos, Aceite, Confiabilidad) —
// Rendimiento es una pregunta de EFICIENCIA OPERATIVA, no de salud, y la
// mayoría de los equipos de la flota no van a tener reportes de turno
// cargados (solo los que aparecen en el papel de Producción) — mezclarlo
// ahí ensuciaría con null una función que hoy tiene alta cobertura real.
//
// rendimientoRealEquipoMes: exige mínimo 3 turnos reales con vueltas Y
// totalHoras>0 ese mes (mismo espíritu que mtbfReal exige ≥2 fallas,
// ajusteWeibull ≥5 — un mínimo de muestra real, nunca arbitrario a cero).
// El "valor" es vueltas totales / horas totales del mes (promedio
// ponderado por horas reales de cada turno), no el promedio simple de los
// rendimientoVueltasHr de cada turno — un turno de 10h y uno de 2h no
// deben pesar igual en el promedio.
function rendimientoRealEquipoMes(sigla, mes, prodTurnoEq, prodTurno){
  var fechaPorTurnoId={};
  (prodTurno||[]).forEach(function(t){if(t&&t.id)fechaPorTurnoId[t.id]=t.fecha;});
  var filas=(prodTurnoEq||[]).filter(function(e){
    if(!e||e.categoria!=='CAEX'||e.sigla!==sigla)return false;
    if(!(e.vueltas>0)||!(e.totalHoras>0))return false;
    var fecha=fechaPorTurnoId[e.turnoId];
    return !!fecha&&fecha.slice(0,7)===mes;
  });
  if(filas.length<3)return null;
  var totalVueltas=0,totalHoras=0;
  filas.forEach(function(f){totalVueltas+=f.vueltas;totalHoras+=f.totalHoras;});
  return{valor:Math.round((totalVueltas/totalHoras)*100)/100,n:filas.length,unidad:'vueltas/hr'};
}

// Rendimiento teórico por Tiempo de Ciclo REAL (2026-10-05) — tiempoCicloMin
// se captura por turno+equipo en produccion_turno_equipos (OCR del reporte)
// desde que existe este módulo, pero hasta ahora quedaba guardado sin que
// ningún cálculo lo usara. A diferencia de rendimientoTeoricoCargadorFrontal
// (parámetros FIJOS de catálogo Q/LF/E/Cm, cargados una vez por modelo), esto
// usa la MEDIANA del tiempo de ciclo real medido turno a turno ese mes — más
// representativo de las condiciones reales (distancia, pendiente, tránsito)
// que un parámetro de catálogo, y sirve para CUALQUIER equipo que reporte
// ciclo (CAEX o Carguío/cargador frontal), no solo cargadores con los 4
// parámetros cargados. Mediana y no promedio: mismo criterio que el resto
// del sistema — un ciclo atípico (ej. una espera larga) no debe mover el
// número representativo del mes. Exige ≥3 turnos con tiempoCicloMin>0 ese
// mes — mismo mínimo de muestra que rendimientoRealEquipoMes, nunca se
// inventa un rendimiento con 1-2 datos. tonHrTeorico solo se calcula si hay
// tonVuelta cargado (también mediana) — null si no, no se inventa un
// tonelaje por vuelta.
function rendimientoPorCicloEquipoMes(sigla, mes, prodTurnoEq, prodTurno){
  var fechaPorTurnoId={};
  (prodTurno||[]).forEach(function(t){if(t&&t.id)fechaPorTurnoId[t.id]=t.fecha;});
  var filas=(prodTurnoEq||[]).filter(function(e){
    if(!e||e.sigla!==sigla)return false;
    if(!(e.tiempoCicloMin>0))return false;
    var fecha=fechaPorTurnoId[e.turnoId];
    return !!fecha&&fecha.slice(0,7)===mes;
  });
  if(filas.length<3)return null;
  var ciclos=filas.map(function(f){return f.tiempoCicloMin;});
  var cicloMedianoMin=medianaPositiva(ciclos);
  var vueltasHrTeorico=Math.round((60/cicloMedianoMin)*100)/100;
  var tonVueltas=filas.map(function(f){return f.tonVuelta;}).filter(function(v){return v>0;});
  var tonVueltaMediano=tonVueltas.length?medianaPositiva(tonVueltas):null;
  var tonHrTeorico=tonVueltaMediano?Math.round(vueltasHrTeorico*tonVueltaMediano*100)/100:null;
  return{cicloMedianoMin:cicloMedianoMin,vueltasHrTeorico:vueltasHrTeorico,tonHrTeorico:tonHrTeorico,n:filas.length,cvPct:coeficienteVariacion(ciclos)};
}

// Coeficiente de Variación del tiempo de ciclo (2026-10-05) — σ/x̄ en %,
// medida de DISPERSIÓN (qué tan erráticos son los ciclos ese mes), no de
// nivel (eso ya lo da cicloMedianoMin arriba). Dos equipos pueden tener el
// mismo ciclo mediano y rendimientos teóricos iguales, pero uno con ciclos
// consistentes (CV bajo, proceso estable) y otro con ciclos muy dispersos
// (CV alto — señal de algo operativo: tránsito irregular, esperas
// intermitentes, operador distinto por turno) que el promedio/mediana solos
// no muestran. Desviación estándar MUESTRAL (n-1, no poblacional) porque la
// muestra mínima es chica (3 turnos) — con n-1 no se subestima la dispersión
// real. null si la media da 0 (no debería pasar con tiempoCicloMin>0, pero
// nunca se divide por cero).
function coeficienteVariacion(valores){
  if(!valores||valores.length<2)return null;
  var media=valores.reduce(function(s,v){return s+v;},0)/valores.length;
  if(!(media>0))return null;
  var sumaCuadrados=valores.reduce(function(s,v){return s+Math.pow(v-media,2);},0);
  var desviacionEstandar=Math.sqrt(sumaCuadrados/(valores.length-1));
  return Math.round((desviacionEstandar/media)*10000)/100;
}

// Banda el Coeficiente de Variación del ciclo en 3 niveles de lectura
// rápida para la UI — igual que prioridadNPR: agrupación relativa propia
// para dar contexto de un vistazo, no un umbral de norma certificada. null
// si cvPct es null (no hay suficiente muestra).
function interpretacionCV(cvPct){
  if(cvPct==null)return null;
  if(cvPct<=15)return 'Estable';
  if(cvPct<=30)return 'Variable';
  return 'Errático';
}

// Brecha entre lo que el tiempo de ciclo real permitiría sin pausas
// (rendimientoPorCicloEquipoMes.vueltasHrTeorico) y lo que de verdad se
// logró ese mes (rendimientoRealEquipoMes.valor, vueltas reales/hora real)
// — positiva = se pierde producción en esperas/colas que no quedan
// registradas como horas de detención formal (el equipo "anda" pero no
// rinde). Puede dar negativa (el real superó la mediana teórica) si una
// parte del mes tuvo ciclos más cortos que la mediana — es un dato real,
// no un error. null si falta cualquiera de los dos cálculos de origen.
function brechaRendimientoCiclo(real,teorico){
  if(!real||!teorico||!(teorico.vueltasHrTeorico>0))return null;
  return Math.round((1-real.valor/teorico.vueltasHrTeorico)*100);
}

// Tonelaje real perdido por Indisponibilidad de UN equipo en UN mes —
// cruza directo con lo que ya calcula dispDownMap/dispEquipoMes (disp.js),
// mismo mes, misma sigla. Es una SUMA de lo que el supervisor de terreno ya
// calculó en el papel, no una tasa — un solo turno real ya es un dato
// válido para reportar, no exige mínimo de muestra como el rendimiento.
function tonPerdidaIndisponibilidadMes(sigla, mes, prodTurnoEq, prodTurno){
  var fechaPorTurnoId={};
  (prodTurno||[]).forEach(function(t){if(t&&t.id)fechaPorTurnoId[t.id]=t.fecha;});
  var filas=(prodTurnoEq||[]).filter(function(e){
    if(!e||e.categoria!=='PerdidaIndisponibilidad'||e.sigla!==sigla)return false;
    var fecha=fechaPorTurnoId[e.turnoId];
    return !!fecha&&fecha.slice(0,7)===mes;
  });
  if(!filas.length)return null;
  var totalTon=0,totalHoras=0;
  filas.forEach(function(f){totalTon+=f.tonAsociadoPerdida||0;totalHoras+=f.totalHoras||0;});
  return{totalTon:Math.round(totalTon*10)/10,totalHoras:Math.round(totalHoras*10)/10};
}

// Costo financiero real del tiempo parado = toneladas perdidas por
// indisponibilidad (tonPerdidaIndisponibilidadMes, arriba) × margen por
// tonelada (cfg.margenPorTon, campo opcional en Configuración > Tarifas y
// Metas — ninguna empresa lo trae cargado por defecto). Sin ese margen
// configurado, null: nunca se inventa un costo de downtime con un valor de
// tonelada supuesto, mismo criterio que ya usa desviacionPresupuesto (cos.js)
// sin presupuestoMensual. toneladasPerdidas=0 SÍ devuelve $0 (dato real de
// que ese mes no hubo pérdida), distinto de null (sin dato de ningún tipo).
function costoDowntimeMes(toneladasPerdidas,margenPorTon){
  if(toneladasPerdidas==null||!(margenPorTon>0))return null;
  return Math.round(toneladasPerdidas*margenPorTon);
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
//
// Fix real (2026-09-30, encontrado construyendo Intervalo de Inspección
// P-F — ver esa sección en arquitectura.md): el cruce con 'cusumPorGrupo'
// comparaba 'e.componente' (correctivos, como lo elige la persona —
// "Transmisión") contra 'g.componente' (analisis_aceite, guardado en
// MAYÚSCULAS sin tilde — "TRANSMISION") con una clave de string exacta.
// Nunca cruzaban, aun siendo el mismo componente real — el ajuste del RUL
// por aceleración real de aceite no estaba disparando nunca en la
// práctica. _normalizarComponente (ver intervalosPF, más abajo) resuelve
// esto en la CLAVE de cusumPorGrupo — el valor mostrado en el resultado
// sigue siendo 'g.componente' tal como lo eligió la persona, no se toca.
// Alcance real verificado contra los datos (2026-09-30): esto arregla el
// cruce cuando la ÚNICA diferencia es mayúsculas/tilde (MOTOR↔Motor,
// TRANSMISION↔Transmisión, DIFERENCIAL↔Diferencial — 149 de ~236 muestras
// reales de aceite). NO arregla diferencias de vocabulario (FRENO↔Frenos,
// MANDO FINAL IZQ↔"Mandos Finales", HIDRAULICO↔"Bomba hidráulica") — eso
// exigiría una tabla de equivalencias entre ambas taxonomías, deliberadamente
// fuera de esta pasada (no se inventa un mapeo sin confirmarlo).
function rulHibridoPorComponente(eventos,eq,ace){
  var ajustePorComponente={};
  analisisVidaUtilCorrectivosPorComponente(eventos).forEach(function(g){
    ajustePorComponente[g.grupo]=g.ajuste;
  });
  var cusumPorGrupo={};
  cusumAceitePorComponente(ace).forEach(function(g){
    cusumPorGrupo[g.sigla+'|'+_normalizarComponente(g.componente)]=g.porMetal;
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
    var cusumKey=g.sigla+'|'+_normalizarComponente(g.componente);
    var rul=rulHibridoComponente(ajuste,edadActual,cusumPorGrupo[cusumKey]);
    if(rul.b10==null)return;
    resultado.push(Object.assign({sigla:g.sigla,componente:g.componente,edadActual:edadActual},rul));
  });
  return resultado.sort(function(a,b){return(a.b10Ajustado!=null?a.b10Ajustado:a.b10)-(b.b10Ajustado!=null?b.b10Ajustado:b.b10);});
}

// ═══ INTERVALO P-F REAL Y RECOMENDACIÓN DE INSPECCIÓN (2026-09-30) ═══ —
// a partir de un diagrama sobre la curva P-F (RCM): el intervalo P-F es el
// tiempo entre que una falla se vuelve DETECTABLE ("Potencial") y el
// momento en que el equipo deja de cumplir ("Funcional"). El criterio
// técnico clásico dice: inspeccionar con un intervalo ≤ mitad del P-F, para
// tener al menos 2 oportunidades de detectarla antes de que se vuelva
// funcional — pero la literatura usa un P-F de TABLA por modo de falla
// (genérico, no de esta flota). Acá se mide el P-F REAL: 'P' es la fecha de
// alerta CUSUM de aceite (cusumAceitePorComponente, ya existente — el
// primer indicio real de aceleración de desgaste) y 'F' es la fecha del
// primer correctivo real de ESE componente en ESE equipo ocurrido después
// de esa alerta — nunca un valor de tabla. Se agrupa por tipo de
// componente (no por equipo — muy pocos eventos por equipo) porque el P-F
// es una propiedad del modo de falla, no del equipo puntual. Sin al menos
// 1 caso real con ambos extremos (alerta + correctivo posterior dentro de
// 'ventanaMaxDias'), ese componente simplemente no tiene P-F medible.
//
// _normalizarComponente: 'analisis_aceite' guarda el componente en
// mayúsculas y sin tilde ("TRANSMISION"), mientras que 'correctivos' lo
// guarda como lo eligió la persona en el selector ("Transmisión") — sin
// normalizar, una comparación exacta nunca cruza ninguno de los dos, aun
// siendo el mismo componente real.
function _normalizarComponente(s){
  return String(s||'').trim().toUpperCase()
    .replace(/Á/g,'A').replace(/É/g,'E').replace(/Í/g,'I').replace(/Ó/g,'O').replace(/Ú/g,'U').replace(/Ñ/g,'N');
}
function intervalosPF(gruposCusum,otConHist,ventanaMaxDias){
  ventanaMaxDias=ventanaMaxDias>0?ventanaMaxDias:365;
  var porComponente={};
  (gruposCusum||[]).forEach(function(g){
    if(!g||!g.sigla||!g.componente)return;
    var compNorm=_normalizarComponente(g.componente);
    var correctivosEquipo=(otConHist||[]).filter(function(o){return o&&o.sigla===g.sigla&&o.fecha&&_normalizarComponente(o.componente)===compNorm;});
    Object.keys(g.porMetal||{}).forEach(function(met){
      var r=g.porMetal[met];
      if(!r||!r.detectado||!r.fechaAlerta)return;
      var siguiente=correctivosEquipo
        .filter(function(o){return o.fecha>=r.fechaAlerta;})
        .sort(function(a,b){return a.fecha<b.fecha?-1:a.fecha>b.fecha?1:0;})[0];
      if(!siguiente)return;
      var dias=_diasEntreISO(r.fechaAlerta,siguiente.fecha);
      if(dias<=0||dias>ventanaMaxDias)return;
      (porComponente[g.componente]=porComponente[g.componente]||[]).push(dias);
    });
  });
  return Object.keys(porComponente).map(function(comp){
    var dias=porComponente[comp];
    var mediana=medianaPositiva(dias);
    var total=dias.reduce(function(a,b){return a+b;},0);
    return{
      componente:comp,
      nEventos:dias.length,
      pfPromedio:Math.round(total/dias.length),
      pfMediana:Math.round(mediana),
      intervaloInspeccionRecomendado:Math.round(mediana/2)
    };
  }).sort(function(a,b){return a.intervaloInspeccionRecomendado-b.intervaloInspeccionRecomendado;});
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
function puntosReordenRepuestos(itemsABCXYZ,stk,nivelServicio,nivelServicioPorNParte){
  var stockPorNParte={},leadPorNParte={};
  (stk||[]).forEach(function(s){
    if(!s||!s.nParte)return;
    stockPorNParte[s.nParte]=(s.stockBodega||0)+(s.pendiente||0);
    leadPorNParte[s.nParte]=s.leadTime>0?s.leadTime:34;
  });
  return(itemsABCXYZ||[]).map(function(it){
    var lead=leadPorNParte[it.nParte]||34;
    var r=puntoReordenSeguridad(it.consumoMensualProm,it.cv,lead,(nivelServicioPorNParte&&nivelServicioPorNParte[it.nParte])||nivelServicio);
    if(!r)return null;
    var stockActual=stockPorNParte[it.nParte]||0;
    return Object.assign({nParte:it.nParte,claseABC:it.claseABC,claseXYZ:it.claseXYZ,
      stockActual:stockActual,leadDias:lead,bajoReorden:stockActual<r.rop},r);
  }).filter(Boolean);
}

// ═══ LOTE ECONÓMICO DE PEDIDO (EOQ) Y POLÍTICA (s,S) (2026-10-10) ═══
// El Punto de Reorden (arriba) dice CUÁNDO pedir (stock ≤ s). Esto dice CUÁNTO. Modelo de Harris/Wilson: la demanda anual D se
// reparte en pedidos de tamaño Q; cada pedido cuesta K (administrar, transportar) y mantener una unidad en bodega cuesta h = i·precio
// al año (capital inmovilizado, seguro, merma). Costo anual relevante TRC(Q) = (D/Q)·K + (Q/2)·h, mínimo en Q* = √(2·D·K / h).
// Como el costo es muy plano cerca del óptimo, el entero más cercano se elige comparando TRC (no redondeando a ojo), y el lote se
// topa a `maxMeses` de demanda (no tiene sentido pedir más de un año de un repuesto). La razón TRC(k·Q*)/TRC* = (k+1/k)/2 muestra
// cuánto cuesta equivocarse de lote. K e i son SUPUESTOS del usuario (el programa no los mide).
// Política (s,S): s = punto de reorden; S = s + Q es el nivel al que se repone. Con stock (bodega + pendiente) por debajo de s (mismo criterio que "bajo reorden") se pide S − stock.
// Supuestos: demanda estable en el año, un solo proveedor, sin descuentos por volumen ni vencimiento; si el repuesto se consume de a
// 1 y el pedido es caro, la política (s,S) real óptima puede diferir levemente (Silver/Pyke/Peterson, cap. 7).
function loteEconomicoPedido(demandaAnual,precioUnit,costoPedido,tasaMantencion,opts){
  var o=opts||{},D=demandaAnual,p=precioUnit,K=costoPedido,i=tasaMantencion;
  if(!(D>0)||!(p>0)||!(K>0)||!(i>0))return null;
  var h=i*p,trc=function(q){return D/q*K+q/2*h;};
  var qCont=Math.sqrt(2*D*K/h),tope=Math.max(1,Math.floor(D*((o.maxMeses>0?o.maxMeses:12)/12)));
  var a=Math.max(1,Math.floor(qCont)),b=Math.max(1,Math.ceil(qCont)),q=trc(a)<=trc(b)?a:b,topado=false;
  if(q>tope){q=tope;topado=true;}
  var costo=trc(q),pedidos=D/q;
  return{qOptimo:qCont,q:q,topado:topado,costoAnual:costo,costoPedidos:pedidos*K,costoMantencion:q/2*h,pedidosAnio:pedidos,cicloDias:365/pedidos,
    costoUnoAUno:trc(1),ahorroVsUnoAUno:trc(1)-costo,costoMinimo:trc(qCont),sobrecostoVsOptimo:costo/trc(qCont)-1,h:h};
}
// Razón de costo al equivocarse de lote por un factor k (k=2 → pedir el doble o la mitad): (k+1/k)/2.
function eoqRazonCosto(k){return k>0?(k+1/k)/2:null;}
// Aplica EOQ + (s,S) a la lista de ABC-XYZ y puntos de reorden. cfg: {costoPedido, tasaMantencion, maxMeses}. precio de stk.precioUnit.
// `planPorNParte` (opcional): {nParte: demandaMensualPlanificada} del programa de PM (planReposicionAuto). Si el plan supera al consumo histórico se usa el plan para el
// punto de reorden y el lote (el histórico puede estar subestimando lo que ya está calendarizado); si no, queda el histórico. Cada fila dice cuál se usó.
function politicasReposicionRepuestos(itemsABCXYZ,stk,cfg,nivelServicio,planPorNParte,nivelServicioPorNParte){
  var c=cfg||{},precio={};
  if(planPorNParte){
    itemsABCXYZ=(itemsABCXYZ||[]).map(function(it){
      var pl=planPorNParte[it.nParte];
      if(pl>it.consumoMensualProm)return Object.assign({},it,{consumoMensualProm:Math.round(pl*100)/100,_consumoHist:it.consumoMensualProm,_usaPlan:true});
      return Object.assign({},it,{_consumoHist:it.consumoMensualProm,_usaPlan:false});
    });
  }
  (stk||[]).forEach(function(s){if(s&&s.nParte&&s.precioUnit>0)precio[s.nParte]=s.precioUnit;});
  var rop={};
  puntosReordenRepuestos(itemsABCXYZ,stk,nivelServicio,nivelServicioPorNParte).forEach(function(r){rop[r.nParte]=r;});
  return(itemsABCXYZ||[]).map(function(it){
    var r=rop[it.nParte],p=precio[it.nParte];if(!r||!p)return null;
    var l=loteEconomicoPedido(it.consumoMensualProm*12,p,c.costoPedido,c.tasaMantencion,{maxMeses:c.maxMeses});
    if(!l)return null;
    var s=r.rop,S=s+l.q,pedir=r.bajoReorden?S-r.stockActual:0;
    return Object.assign({nParte:it.nParte,claseABC:it.claseABC,claseXYZ:it.claseXYZ,consumoMensualProm:it.consumoMensualProm,consumoHist:it._consumoHist!=null?it._consumoHist:it.consumoMensualProm,usaPlan:!!it._usaPlan,
      planMensual:planPorNParte&&planPorNParte[it.nParte]!=null?planPorNParte[it.nParte]:null,precioUnit:p,stockActual:r.stockActual,
      s:s,S:S,pedirAhora:pedir,valorPedido:pedir*p},l);
  }).filter(Boolean);
}


// ═══ PRONÓSTICO DE DEMANDA CON TENDENCIA Y ESTACIONALIDAD (2026-10-10) ═══
// Responde "¿cuánto voy a necesitar el próximo año?". En vez de ASUMIR que hay tendencia o estacionalidad, compite un conjunto de
// modelos de suavizamiento exponencial contra el promedio simple con un backtest de origen móvil (se pronostica hacia adelante desde
// cada fecha pasada y se compara con lo que realmente pasó) y se queda con el de menor error absoluto medio (MAE). Un modelo más
// complejo solo gana si supera al promedio por al menos MEJORA_MIN: con series ruidosas lo habitual es que el promedio no se supere,
// y el programa lo dice en vez de dibujar una tendencia que no existe.
// Modelos (Hyndman & Athanasopoulos, "Forecasting: Principles and Practice"; Croston 1972; Syntetos & Boylan 2005):
//   media    promedio de todo el historial           media12  promedio de los últimos 12 meses
//   ses      suavizamiento exponencial simple (nivel)          holt   nivel + tendencia amortiguada (φ<1: la tendencia se apaga)
//   estacional  nivel + índice estacional aditivo (12 meses)   hw     nivel + tendencia amortiguada + estacional (Holt-Winters)
//   croston  demanda intermitente (muchos meses en cero): suaviza por separado el tamaño y el intervalo entre demandas (corrección SBA)
// Los parámetros (α, β, γ, φ) se eligen por grilla minimizando el error de 1 paso dentro de los datos de entrenamiento.
// Los modelos estacionales exigen ≥ 24 meses de historia. Los valores atípicos (compras únicas enormes) se pueden recortar a
// mediana + k·MAD para que una sola compra no domine el pronóstico (se informa cuántos y cuánto).
var PRON_MEJORA_MIN=0.05;
function _pronMediana(a){
  var v=a.slice().sort(function(x,y){return x-y;}),n=v.length;
  return !n?0:n%2?v[(n-1)/2]:(v[n/2-1]+v[n/2])/2;
}
function _pronMedia(a){return a.length?a.reduce(function(s,x){return s+x;},0)/a.length:0;}
// Recorta valores por encima de mediana + k·1,4826·MAD. Si el MAD es 0 (serie casi toda en cero) no recorta.
function pronRecortarAtipicos(serie,k){
  var kk=k>0?k:3.5,med=_pronMediana(serie),mad=_pronMediana(serie.map(function(x){return Math.abs(x-med);}))*1.4826;
  if(!(mad>0))return{serie:serie.slice(),n:0,umbral:null,montoRecortado:0};
  var u=med+kk*mad,n=0,m=0;
  var s=serie.map(function(x){if(x>u){n++;m+=x-u;return u;}return x;});
  return{serie:s,n:n,umbral:u,montoRecortado:m};
}
// Cada modelo recibe (entrenamiento, h) y devuelve h pronósticos (≥0). Los parámetros se afinan con el propio entrenamiento.
function _pronSES(y,a){var l=y[0];for(var t=1;t<y.length;t++)l=a*y[t]+(1-a)*l;return l;}
function _pronSSE_SES(y,a){var l=y[0],e=0;for(var t=1;t<y.length;t++){var d=y[t]-l;e+=d*d;l=a*y[t]+(1-a)*l;}return e;}
function _pronModeloSES(y,h){
  var mejor=null,ba=0.3;
  [0.05,0.1,0.2,0.3,0.4,0.5,0.7,0.9].forEach(function(a){var e=_pronSSE_SES(y,a);if(mejor===null||e<mejor){mejor=e;ba=a;}});
  var l=_pronSES(y,ba);return{f:Array.apply(null,Array(h)).map(function(){return Math.max(0,l);}),par:{alfa:ba}};
}
// Holt amortiguado: l_t=α·y+(1-α)(l+φb), b_t=β(l_t-l_{t-1})+(1-β)φb; pronóstico h pasos = l+Σφ^i·b
function _pronHoltPaso(y,a,b,phi){
  var l=y[0],tr=y.length>1?(y[Math.min(y.length-1,3)]-y[0])/Math.min(y.length-1,3):0,e=0;
  for(var t=1;t<y.length;t++){
    var pred=l+phi*tr,d=y[t]-pred;e+=d*d;
    var ln=a*y[t]+(1-a)*(l+phi*tr);tr=b*(ln-l)+(1-b)*phi*tr;l=ln;
  }
  return{e:e,l:l,b:tr};
}
function _pronModeloHolt(y,h){
  var mejor=null,bp=null;
  [0.1,0.3,0.5,0.7].forEach(function(a){[0.05,0.1,0.2,0.3].forEach(function(b){[0.8,0.9,0.98].forEach(function(phi){
    var r=_pronHoltPaso(y,a,b,phi);if(mejor===null||r.e<mejor){mejor=r.e;bp={a:a,b:b,phi:phi,l:r.l,tr:r.b};}
  });});});
  var f=[],acum=0,pot=1;
  for(var i=1;i<=h;i++){pot*=bp.phi;acum+=pot;f.push(Math.max(0,bp.l+acum*bp.tr));}
  return{f:f,par:{alfa:bp.a,beta:bp.b,phi:bp.phi}};
}
// Holt-Winters aditivo, período m. conTend=false → solo nivel + estacional. Inicialización: nivel = media de la 1ª temporada,
// tendencia = diferencia de medias entre la 1ª y 2ª temporada ÷ m, índices = desvío de la 1ª temporada respecto de su media.
function _pronHWPaso(y,m,a,b,g,phi,conTend){
  var n=y.length,m1=_pronMedia(y.slice(0,m)),m2=_pronMedia(y.slice(m,2*m));
  var l=m1,tr=conTend?(m2-m1)/m:0,s=[];
  for(var i=0;i<m;i++)s.push(y[i]-m1);
  var e=0;
  for(var t=m;t<n;t++){
    var pred=l+phi*tr+s[t%m],d=y[t]-pred;e+=d*d;
    var ln=a*(y[t]-s[t%m])+(1-a)*(l+phi*tr);
    tr=conTend?b*(ln-l)+(1-b)*phi*tr:0;
    s[t%m]=g*(y[t]-ln)+(1-g)*s[t%m];l=ln;
  }
  return{e:e,l:l,b:tr,s:s,n:n};
}
function _pronModeloHW(y,h,m,conTend){
  if(y.length<2*m)return null;
  var mejor=null,bp=null;
  [0.1,0.3,0.5].forEach(function(a){(conTend?[0.05,0.15]:[0]).forEach(function(b){[0.1,0.3,0.5].forEach(function(g){
    (conTend?[0.9,0.98]:[1]).forEach(function(phi){var r=_pronHWPaso(y,m,a,b,g,phi,conTend);if(mejor===null||r.e<mejor){mejor=r.e;bp={a:a,b:b,g:g,phi:phi,r:r};}});
  });});});
  var r=bp.r,f=[],acum=0,pot=1;
  for(var i=1;i<=h;i++){pot*=bp.phi;acum+=pot;f.push(Math.max(0,r.l+(conTend?acum*r.b:0)+r.s[(r.n+i-1)%m]));}
  return{f:f,par:{alfa:bp.a,beta:bp.b,gamma:bp.g,phi:bp.phi},estacional:r.s.slice(),indiceDesde:r.n%m};
}
// Croston con corrección de Syntetos-Boylan: z = tamaño medio suavizado de las demandas ≠ 0, p = intervalo medio suavizado entre ellas;
// pronóstico = (1-α/2)·z/p por período. Pide al menos 2 demandas distintas de cero.
function _pronModeloCroston(y,h){
  var a=0.15,z=null,p=null,q=1,nz=0;
  for(var t=0;t<y.length;t++){
    if(y[t]>0){nz++;if(z===null){z=y[t];p=q;}else{z=a*y[t]+(1-a)*z;p=a*q+(1-a)*p;}q=1;}else q++;
  }
  var v=(nz>=2&&p>0)?(1-a/2)*z/p:(nz===1?z/y.length:0);
  return{f:Array.apply(null,Array(h)).map(function(){return Math.max(0,v);}),par:{alfa:a}};
}
var PRON_MODELOS={
  media:{nombre:'Promedio de todo el historial',f:function(y,h){var m=_pronMedia(y);return{f:Array.apply(null,Array(h)).map(function(){return m;}),par:{}};}},
  media12:{nombre:'Promedio de los últimos 12 meses',f:function(y,h){var m=_pronMedia(y.slice(-12));return{f:Array.apply(null,Array(h)).map(function(){return m;}),par:{}};}},
  ses:{nombre:'Suavizamiento exponencial simple',f:_pronModeloSES},
  holt:{nombre:'Tendencia amortiguada (Holt)',f:_pronModeloHolt},
  estacional:{nombre:'Estacional (nivel + mes del año)',f:function(y,h){return _pronModeloHW(y,h,12,false);},minN:24},
  hw:{nombre:'Tendencia + estacional (Holt-Winters)',f:function(y,h){return _pronModeloHW(y,h,12,true);},minN:24},
  croston:{nombre:'Demanda intermitente (Croston-SBA)',f:_pronModeloCroston}
};
// Pronostica los próximos `h` períodos de `serie` (mensual) eligiendo el modelo por backtest de origen móvil.
// opts: {h:12, hBack:6, recortar:true, k:3.5, saltar:0}. `saltar` = períodos que hay entre el último dato y el primero que interesa
// (ej. se descartaron meses incompletos): se pronostica h+saltar y se devuelven solo los h últimos. Devuelve null si hay menos de 12 datos.
function pronosticarSerie(serie,opts){
  var o=opts||{},h=o.h>0?o.h:12,hB=o.hBack>0?o.hBack:6,sk=o.saltar>0?Math.floor(o.saltar):0;
  var y0=(serie||[]).map(function(x){return Number(x)>0?Number(x):0;});
  if(y0.length<12)return null;
  var rec=o.recortar===false?{serie:y0.slice(),n:0,umbral:null,montoRecortado:0}:pronRecortarAtipicos(y0,o.k);
  var y=rec.serie,n=y.length;
  var T0=n>=36?24:Math.max(12,Math.ceil(n/2)),hasBack=(n-T0)>=hB;
  var ceros=y.filter(function(x){return x===0;}).length/n;
  var cand=Object.keys(PRON_MODELOS).filter(function(k){
    var d=PRON_MODELOS[k];
    if(d.minN&&!(hasBack&&T0>=d.minN))return false;
    if(k==='croston'&&ceros<0.3)return false;
    return true;
  });
  var rank=[],errPaso={};
  cand.forEach(function(k){
    var sumAbs=0,cnt=0,pasoSq=[],pasoN=[];
    for(var i=0;i<hB;i++){pasoSq.push(0);pasoN.push(0);}
    if(hasBack){
      for(var origen=T0;origen+hB<=n;origen++){
        var r=PRON_MODELOS[k].f(y.slice(0,origen),hB);if(!r)continue;
        for(var j=0;j<hB;j++){var e=y[origen+j]-r.f[j];sumAbs+=Math.abs(e);cnt++;pasoSq[j]+=e*e;pasoN[j]++;}
      }
    }
    if(cnt){rank.push({modelo:k,nombre:PRON_MODELOS[k].nombre,mae:sumAbs/cnt});
      errPaso[k]=pasoSq.map(function(s,j){return pasoN[j]?Math.sqrt(s/pasoN[j]):0;});}
  });
  rank.sort(function(a,b){return a.mae-b.mae;});
  var maeMedia=(rank.filter(function(r){return r.modelo==='media';})[0]||{}).mae;
  rank.forEach(function(r){r.mejoraVsMedia=maeMedia>0?1-r.mae/maeMedia:0;});
  var elegido='media',nota=null;
  if(!hasBack){nota='Historia corta ('+n+' meses): no alcanza para validar modelos; se usa el promedio.';}
  else{
    var top=rank[0];
    if(top&&top.modelo!=='media'&&top.mejoraVsMedia>=PRON_MEJORA_MIN)elegido=top.modelo;
    else if(top&&top.modelo==='media')nota='El promedio simple es el que mejor predice en el backtest: no hay tendencia ni estacionalidad que aprovechar.';
    else if(top)nota='Ningún modelo con tendencia o estacionalidad supera con claridad (≥'+Math.round(PRON_MEJORA_MIN*100)+'%) al promedio: la serie es demasiado irregular; se usa el promedio.';
  }
  var fit=PRON_MODELOS[elegido].f(y,h+sk);
  var sd=errPaso[elegido]||errPaso.media||[0],sdh=[];
  for(var i2=sk;i2<h+sk;i2++)sdh.push(i2<sd.length?sd[i2]:sd[sd.length-1]*Math.sqrt((i2+1)/sd.length));
  fit.f=fit.f.slice(sk);
  var total=fit.f.reduce(function(s,x){return s+x;},0),sdTot=Math.sqrt(sdh.reduce(function(s,x){return s+x*x;},0)),z=1.2816;
  var base12=_pronMedia(y0.slice(-12))*12;
  return{n:n,modelo:elegido,nombre:PRON_MODELOS[elegido].nombre,par:fit.par,pronostico:fit.f,total:total,totalLo:Math.max(0,total-z*sdTot),totalHi:total+z*sdTot,
    sdPaso:sdh,base12:base12,cambioVsBase:base12>0?total/base12-1:null,ranking:rank,nota:nota,recorte:rec,
    estacional:fit.estacional?{indices:fit.estacional,desde:fit.indiceDesde}:null,hayBacktest:hasBack,origenInicial:T0};
}
// Suma de `valor` por mes (YYYY-MM) entre el primer y el último mes con dato, rellenando con 0 los meses sin movimiento.
// items: [{fecha:'YYYY-MM-DD', valor}]. Devuelve {meses:[YYYY-MM...], serie:[...], lineas:[nº de líneas por mes]}.
function serieMensualDe(items){
  var g={},c={};
  (items||[]).forEach(function(it){
    var m=String(it&&it.fecha||'').slice(0,7);if(!/^\d{4}-\d{2}$/.test(m))return;
    var v=Number(it.valor)||0;g[m]=(g[m]||0)+v;c[m]=(c[m]||0)+1;
  });
  var ks=Object.keys(g).sort();if(!ks.length)return{meses:[],serie:[],lineas:[]};
  var meses=_mesesEntreLista(ks[0],ks[ks.length-1]);
  return{meses:meses,serie:meses.map(function(m){return g[m]||0;}),lineas:meses.map(function(m){return c[m]||0;})};
}
// Los últimos meses de una carga atrasada traen pocas líneas y bajarían el pronóstico sin que el gasto real haya bajado. Quita del final
// los meses cuyo nº de líneas sea < `umbral` (40%) de la mediana de las líneas de los 12 meses previos. Devuelve cuántos quitó.
function mesesFinalesIncompletos(lineas,umbral){
  var u=umbral>0?umbral:0.4,n=lineas.length,quita=0;
  while(n-quita>13){
    var i=n-quita-1,prev=lineas.slice(Math.max(0,i-12),i),med=_pronMediana(prev);
    if(med>0&&lineas[i]<u*med)quita++;else break;
  }
  return quita;
}
// Meses siguientes a 'YYYY-MM' (n meses).
function mesesSiguientes(mes,n){
  var p=String(mes).split('-').map(Number),y=p[0],m=p[1],out=[];
  for(var i=0;i<n;i++){m++;if(m>12){m=1;y++;}out.push(y+'-'+(m<10?'0'+m:m));}
  return out;
}


// ═══ FICHA DE COMPONENTE (2026-10-11) ═══
// Antes cada pantalla calculaba por su lado el riesgo, el costo y la decisión de un mismo componente (TBO, Predictivo, reposición, costos). La ficha
// junta lo que se sabe de CADA componente de un equipo en un solo objeto y es lo que lee el Buscador Maestro; sus números salen de las mismas funciones
// que la pestaña TBO (tboEstadoFlota, tboPlanCompras, tboVidaPorOrigen, tboReemplazoOptimo), así que ambas pantallas dicen lo mismo.
// Costo de una hora detenida: dato del usuario (2026-10-11), US$135 por hora para todos los equipos; en pesos con la tasa USD→CLP del programa. Si el
// usuario escribe otro valor en pesos (pestaña TBO → Reemplazo óptimo) ese valor manda sobre el predeterminado.
var TBO_COSTO_HORA_DET_USD=135;
// Supuestos de costo compartidos por la pestaña TBO y la ficha. `lee(clave)` devuelve el texto guardado (localStorage.getItem) o null.
// `usdCfg` = Configuración → costo de hora detenida (US$/h, `cfg.costoHoraDetUSD`): es la fuente principal y la edita el usuario cuando quiera. Si no hay, vale un valor en
// pesos guardado antes en este navegador (`tboCostoDet`) y, si tampoco, el predeterminado de US$135/h.
// `tasaCfg` = Configuración → tasa USD→CLP (`cfg.tasaUSD`, la misma para todos los usuarios); si no hay, la que se guardó antes en este navegador (`tboTasaUSD`) y, si tampoco, 910.
// `modelosCfg` = Configuración → costo de hora detenida por modelo ({modeloNormalizado: US$/h}, `cfg.costoHoraDetModelos`): cada modelo con valor propio lo usa en vez del general.
function tboAjustesCosto(lee,mttrFlotaHoras,tarifaHH,usdCfg,modelosCfg,tasaCfg){
  var num=function(k){var v=parseFloat(lee(k));return v>=0?v:null;};
  var tasa=tasaCfg>0?Number(tasaCfg):num('tboTasaUSD');if(!(tasa>0))tasa=910;
  var cd=num('tboCostoDet'),hh=num('tboHHCambio'),hp=num('tboHorasProg'),hf=num('tboHorasFalla'),ap=lee('tboAplic');
  var porModelo={},porModeloUSD={};
  Object.keys(modelosCfg||{}).forEach(function(k){var v=Number(modelosCfg[k]);if(v>0){porModelo[k]=Math.round(v*tasa);porModeloUSD[k]=v;}});
  return{porModelo:porModelo,porModeloUSD:porModeloUSD,tasa:tasa,aplic:(TBO_APLICACION[ap]?ap:'normal'),tarifaHH:tarifaHH>0?tarifaHH:25000,
    costoHoraDet:usdCfg>0?Math.round(usdCfg*tasa):cd!=null?cd:Math.round(TBO_COSTO_HORA_DET_USD*tasa),costoDetPorDefecto:!(usdCfg>0)&&cd==null,
    costoHoraDetUSD:usdCfg>0?usdCfg:(cd!=null&&tasa>0?Math.round(cd/tasa*100)/100:TBO_COSTO_HORA_DET_USD),costoDetOrigen:usdCfg>0?'configuracion':cd!=null?'local':'predeterminado',
    hhCambio:hh!=null?hh:16,horasProg:hp!=null?hp:8,horasFalla:hf!=null?hf:(mttrFlotaHoras>0?Math.round(mttrFlotaHoras):24)};
}
// Costo de hora detenida (CLP/h) que corresponde a un modelo de equipo: el propio si Configuración lo define, y si no el general. `aj` = resultado de tboAjustesCosto (o un objeto con
// costoHoraDet y porModelo). El modelo se compara normalizado (HD785-7 = HD-785-7).
function costoHoraDetDe(modelo,aj){
  var a=aj||{},k=_normalizarModelo(modelo),pm=a.porModelo||a.costoHoraDetPorModelo||{};
  return pm[k]>0?pm[k]:(Number(a.costoHoraDet)||0);
}
function costoHoraDetPropio(modelo,aj){var a=aj||{},pm=a.porModelo||a.costoHoraDetPorModelo||{};return pm[_normalizarModelo(modelo)]>0;}
// Decisión sobre un componente, con su motivo. Combina tres señales para no contradecirse dentro de la misma ficha: la probabilidad de falla en el horizonte
// (≥35% cambiar ya, ≥15% planificar, ≥5% vigilar), el plan del fabricante (vencido por TBO) y la política económica (RCM). Pasar el TBO no obliga a parar:
// si el costo de fallar casi no supera al de cambiar (estrategia "dejar correr / oportunista", "por condición" o "investigar"), un ítem vencido pasa a
// "planificar" (cambiarlo en la próxima parada) en vez de "cambiar ya".
function tboDecisionFicha(pFalla,nivel,decisionCompra,estrategia){
  var pct=function(x){return Math.round(x*100);};
  if(pFalla>=0.35)return{codigo:'cambiar_ya',motivo:'riesgo de '+pct(pFalla)+'% de falla en el horizonte'};
  if(nivel==='vencido'){
    var porEdad=!estrategia||/^Cambio por edad/.test(estrategia);
    return porEdad?{codigo:'cambiar_ya',motivo:'pasó el TBO del fabricante'+(estrategia?' y la política económica recomienda cambiar por edad':'')}
      :{codigo:'planificar',motivo:'pasó el TBO del fabricante, pero la política económica ("'+estrategia+'") no justifica parar: cambiar en la próxima parada'};
  }
  if(pFalla>=0.15)return{codigo:'planificar',motivo:'riesgo de '+pct(pFalla)+'% de falla en el horizonte'};
  if(decisionCompra==='pedir_ya'||decisionCompra==='planificar')return{codigo:'planificar',motivo:'hay que pedir el repuesto con el plazo de entrega actual'};
  if(pFalla>=0.05)return{codigo:'vigilar',motivo:'riesgo de '+pct(pFalla)+'% de falla en el horizonte'};
  return{codigo:'al_dia',motivo:'riesgo bajo y dentro del TBO'};
}
// d: {equipos, compHist, compMayores, compras (ya unidas con tboUnirCompras), comprasDetalle, stk, repuestos, ordenes, hoy}
// o: ajustes de tboAjustesCosto + {horizonte (h, 500), incluirTeorico}. Devuelve null si el equipo no tiene plan TBO.
function tboFichasEquipo(sigla,d,o){
  var op=o||{},H=op.horizonte>0?op.horizonte:500;
  var eq=(d.equipos||[]).filter(function(e){return e&&e.sigla===sigla;})[0];
  if(!eq||!tboClaseModelo(eq.modelo))return null;
  var hoy=d.hoy||new Date(),estado=tboEstadoFlota([eq],d.compHist||[],d.compMayores||[],hoy,op.aplic||'normal');
  var plan=tboPlanCompras(estado,{hoy:hoy,equipos:d.equipos,compras:d.compras||[],comprasDetalle:d.comprasDetalle||[],stk:d.stk||[],repuestos:d.repuestos||[],ordenes:d.ordenes||[],tasa:op.tasa,
    leadF:d.leadF,stockF:d.stockF,pedF:d.pedF},{incluirTeorico:!!op.incluirTeorico,horizonteExtra:1e9,tasa:op.tasa});
  var vida=d.vida||tboVidaPorOrigen(d.compHist||[],d.compras||[]);
  var cd=costoHoraDetDe(eq.modelo,op),th=op.tarifaHH||0,hh=op.hhCambio||0,hp=op.horasProg||0,hf=op.horasFalla||0;
  var usaDet=cd>0&&hf>hp,crit=typeof criticidadEquipoABanda==='function'?criticidadEquipoABanda(eq.criticidad):null;
  var fichas=plan.filas.map(function(f){
    var pFalla=tboRiesgoHorizonte(f.desdeH,f.tbo,H);
    // vida medida de este componente en la flota, del origen del último cambio (o el de más cambios si no se sabe)
    var grupos=vida.filter(function(v){var mm=tboCompMap(v.comp);return mm&&mm[1].test(f.item);});
    var g=grupos.filter(function(v){return v.origen===f.origenUlt;})[0]||grupos.slice().sort(function(a,b){return b.n-a.n;})[0]||null;
    var par=g?tboParametrosVida(g):null;
    if(!par)par={beta:TBO_BETA,eta:f.tbo/Math.pow(-Math.log(0.95),1/TBO_BETA),fuente:'modelo del fabricante (TBO = 5% de fallas)'};
    var pr=f.precios||{},precio=f.precio||null,costoRep=f.costoEst||null;
    var Cp=costoRep!=null?costoRep+hh*th+hp*cd:null,Cf=costoRep!=null?costoRep+hh*th+hf*cd:null;
    var opt=(Cp>0&&Cf>0)?tboReemplazoOptimo(par.beta,par.eta,Cp,Cf):null;
    var consecuencia=usaDet?(hf-hp)*cd:costoRep;
    var estr=(Cp>0&&Cf>0)?tboEstrategiaRCM(par.beta,Cf/Cp):null,dec=tboDecisionFicha(pFalla,f.nivel,f.decision,estr?estr.estrategia:null);
    return{sigla:sigla,item:f.item,fam:f.fam,conDato:f.conDato,fuente:f.fuente,origenUlt:f.origenUlt,fechaUlt:f.fechaUlt,
      desdeH:f.desdeH,tbo:f.tbo,tboFab:f.tboFab,restantesH:f.restantesH,dias:f.dias,fechaProx:f.fechaProx,nivel:f.nivel,
      riesgo:f.riesgo,pFalla:pFalla,horizonte:H,prob:f.prob,
      vida:g?{origen:g.origen,n:g.n,mediana:g.mediana,min:g.min,max:g.max}:null,parametros:par,
      precio:precio,costoRep:costoRep,cant:f.cant,precios:{original:(pr.original||{}).mediana||null,otros:(pr.otros||{}).mediana||null,referencia:pr.clpRef||null},
      Cp:Cp,Cf:Cf,ratio:(Cp>0&&Cf>0)?Cf/Cp:null,opt:opt,estrategia:estr,
      consecuencia:consecuencia,perdidaEsperada:consecuencia>0?pFalla*consecuencia:null,usaDetencion:usaDet,
      criticidad:crit,stock:f.stock,pedidos:f.pedidos,lead:f.lead,probATiempo:f.probATiempo,decisionCompra:f.decision,diasParaPedir:f.diasParaPedir,pedirAntesDe:f.pedirAntesDe,
      decision:dec.codigo,motivoDecision:dec.motivo};
  });
  var rango={cambiar_ya:0,planificar:1,vigilar:2,al_dia:3};
  fichas.sort(function(a,b){return rango[a.decision]-rango[b.decision]||b.pFalla-a.pFalla||(a.restantesH-b.restantesH);});
  var conDato=fichas.filter(function(x){return x.conDato;});
  return{sigla:sigla,modelo:eq.modelo,clase:tboClaseModelo(eq.modelo).clase,horometro:eq.horomActual,fichas:fichas,omitidosTeoricos:plan.omitidosTeoricos,
    resumen:{conDato:conDato.length,enRiesgo:conDato.filter(function(x){return x.decision==='cambiar_ya'||x.pFalla>=0.15;}).length, // mismo criterio que tboPctSano (Score de Salud)
      
      cambiarYa:conDato.filter(function(x){return x.decision==='cambiar_ya';}).length,perdidaEsperada:conDato.reduce(function(s,x){return s+(x.perdidaEsperada||0);},0)}};
}

// % de componentes con cambio registrado que NO están en riesgo (decisión distinta de "cambiar ya" y riesgo < 15% en el horizonte); null si no hay ninguno.
function tboPctSano(res){
  if(!res||!res.resumen||!res.resumen.conDato)return null;
  var con=res.fichas.filter(function(f){return f.conDato;});
  var sanos=con.filter(function(f){return!(f.decision==='cambiar_ya'||f.pFalla>=0.15);}).length;
  return Math.round(sanos/con.length*1000)/10;
}
// Fichas de TODOS los equipos con plan TBO en una pasada, compartiendo lo que no depende del equipo (vida por origen, plazos, stock, pedidos abiertos).
// Devuelve {sigla: {pct, conDato, enRiesgo, cambiarYa, perdidaEsperada}} (el insumo del Score de Salud del equipo).
function tboFichasFlota(d,o,siglas){
  var out={},compras=d.compras||[];
  var comun=Object.assign({},d,{vida:tboVidaPorOrigen(d.compHist||[],compras),leadF:tboLeadTimeFn(d.comprasDetalle||[]),stockF:tboStockFn(d.stk||[],d.repuestos||[]),
    pedF:tboPedidosAbiertosFn(d.comprasDetalle||[],d.ordenes||[],d.hoy||new Date())});
  (d.equipos||[]).forEach(function(e){
    if(!e||!e.sigla||(siglas&&siglas.indexOf(e.sigla)<0))return;
    var r=tboFichasEquipo(e.sigla,comun,o);if(!r)return;
    var pct=tboPctSano(r);
    out[e.sigla]={pct:pct,conDato:r.resumen.conDato,enRiesgo:r.resumen.enRiesgo,cambiarYa:r.resumen.cambiarYa,perdidaEsperada:r.resumen.perdidaEsperada};
  });
  return out;
}
// Versión para las pantallas: lee los datos del store y los supuestos guardados, y recuerda el resultado unos segundos (el Dashboard, la Torre y el Buscador
// lo piden en la misma pasada). Devuelve {} si no hay store o algo falla: el Score se calcula entonces como antes, sin esta señal.
var _tboSaludCache={clave:null,ts:0,val:{}};
function tboSaludFlotaAuto(){
  try{
    if(typeof S==='undefined'||typeof tboUnirCompras!=='function')return{};
    var lee=function(k){try{return localStorage.getItem(k);}catch(e){return null;}};
    var eqs=S.g('eq')||[],compHist=S.g('compHist')||[],compMay=S.g('compMayores')||[],oc=S.g('ocHist')||[],cd=S.g('comprasDetalle')||[],stk=S.g('stk')||[];
    var horoms=eqs.reduce(function(a,e){return a+(Number(e&&e.horomActual)||0);},0);
    var mttr=(typeof duracionesReparacionFlotaHoras==='function'&&typeof medianaPositiva==='function')?medianaPositiva(duracionesReparacionFlotaHoras(S.g('ot')||[])):null;
    var aj=tboAjustesCosto(lee,mttr,S.g('hh'),(S.g('cfg')||{}).costoHoraDetUSD,(S.g('cfg')||{}).costoHoraDetModelos,(S.g('cfg')||{}).tasaUSD);
    var clave=[JSON.stringify(aj.porModelo),eqs.length,horoms,compHist.length,compMay.length,oc.length,cd.length,stk.length,aj.tasa,aj.aplic,aj.costoHoraDet,aj.horasFalla,aj.hhCambio,aj.horasProg,aj.tarifaHH].join('|');
    var ahora=Date.now();
    if(_tboSaludCache.clave===clave&&ahora-_tboSaludCache.ts<5000)return _tboSaludCache.val;
    var val=tboFichasFlota({equipos:eqs,compHist:compHist,compMayores:compMay,compras:tboUnirCompras(oc,cd),comprasDetalle:cd,stk:stk,repuestos:S.g('repuestos')||[],ordenes:S.g('ordenes')||[],hoy:new Date()},
      Object.assign({},aj,{horizonte:500}));
    _tboSaludCache={clave:clave,ts:ahora,val:val};
    return val;
  }catch(e){return{};}
}


// ═══ CALIBRACIÓN DEL MODELO DE RIESGO (2026-10-11) ═══
// El riesgo que muestran el Buscador, la Torre y TBO viene de una Weibull del fabricante (β=3, TBO = 5% de fallas). Es una HIPÓTESIS. Esto la contrasta con lo que
// pasó de verdad en la flota: cada tramo entre dos cambios registrados de un componente es una vida observada, y el tramo abierto desde el último cambio hasta hoy
// es una observación censurada (sigue vivo). Limitación de los datos: el Historial de Componentes no dice si el cambio fue por falla o preventivo, así que lo que
// se contrasta es el "tiempo hasta el cambio", que es justo lo que el riesgo del programa quiere anticipar.
// Método (puntos de control): para cada componente se recorre su vida cada 500 h; en cada punto el modelo predice p = P(cambio en las próximas H h | edad), y se anota
// si el cambio ocurrió en esa ventana (y=1) o no (y=0; los puntos cuya ventana aún no termina en un tramo abierto se descartan). Se compara lo predicho con lo observado
// por tramos de riesgo, la razón observado/esperado (O/E) con intervalo por bootstrap por componente (las filas de un mismo componente no son independientes), el
// puntaje de Brier contra una tasa constante y contra un modelo ajustado con el resto de la flota (dejando un equipo afuera), y una prueba de uniformidad de F(vida).
// Dos cambios del mismo componente en el mismo equipo con menos de 24 h de horómetro entre sí se toman como UN solo cambio registrado dos veces (ej.: los dos turbos de un camión
// anotados con 2 h de diferencia, o el mismo cambio cargado desde dos fuentes): no es una vida de 2 horas. Hallazgo con el historial real (2026-10-11): sin esta regla aparecían vidas de 1 y 2 h.
var TBO_VIDA_MIN_H=24;
function tboVidasObservadas(compHist,equipos,compras,aplic,hoy){
  var fa=TBO_APLICACION[aplic]||1,eqPor={};(equipos||[]).forEach(function(e){if(e&&e.sigla)eqPor[e.sigla]=e;});
  var grupos={},out=[],omitidos=0;
  (compHist||[]).forEach(function(r){
    if(!r||!r.sigla||!r.comp)return;var h=parseFloat(r.horomInstalacion);if(isNaN(h))return;
    (grupos[r.sigla+'|'+r.comp]=grupos[r.sigla+'|'+r.comp]||[]).push({r:r,h:h});
  });
  Object.keys(grupos).forEach(function(k){
    var arr=grupos[k].sort(function(a,b){return a.h-b.h;}),sigla=arr[0].r.sigla,comp=arr[0].r.comp,e=eqPor[sigla],m=tboCompMap(comp),cl=e?tboClaseModelo(e.modelo):null;
    if(!e||!m||!cl)return;
    var tbos=[];(TBO_ITEMS[cl.clase]||[]).forEach(function(it){if(m[1].test(it[1])){var t=Math.round(it[2]*fa);if(tbos.indexOf(t)<0)tbos.push(t);}});
    if(tbos.length!==1){if(tbos.length>1)omitidos++;return;}
    var tbo=tbos[0];
    for(var i=0;i<arr.length;i++){
      var ev=arr[i].r,origen=tboClasificarOrigen(ev.origen);if(!origen)origen=tboOrigenPorCompra(sigla,ev.fechaInst,m[2],compras)||'';
      var fin=i<arr.length-1?arr[i+1].h:Number(e.horomActual)||0,L=fin-arr[i].h,cens=i===arr.length-1;
      if(!(L>=TBO_VIDA_MIN_H))continue;
      out.push({sigla:sigla,comp:comp,fam:m[2],tbo:tbo,origen:origen||'sin dato',L:L,censurado:cens});
    }
  });
  return{vidas:out,omitidos:omitidos};
}
// Probabilidad de que el componente falle/cambie en (t, t+H] dado que llegó a t, modelo Weibull(β, η) o del fabricante si no se pasan.
function _calibP(t,H,tbo,beta,eta){
  if(beta&&eta){var s0=Math.exp(-Math.pow(t/eta,beta)),s1=Math.exp(-Math.pow((t+H)/eta,beta));return s0>0?1-s1/s0:1;}
  return tboRiesgoHorizonte(t,tbo,H);
}
function _calibFilas(vidas,H,paso,modeloFn){
  var filas=[];
  vidas.forEach(function(v,idx){
    for(var t=0;t<v.L;t+=paso){
      var completo=!v.censurado;
      if(!completo&&t+H>v.L)break;                       // ventana todavía abierta: no se sabe qué pasó
      filas.push({i:idx,sigla:v.sigla,p:modeloFn?modeloFn(v,t):_calibP(t,H,v.tbo),y:(completo&&v.L<=t+H)?1:0});
    }
  });
  return filas;
}
// Intervalo de Wilson al 95% como fracciones [lo, hi] (wilsonIC95 devuelve porcentajes en un objeto).
function _wilsonFrac(x,n){
  if(!(n>0))return null;var z=1.96,p=x/n,den=1+z*z/n,c=(p+z*z/(2*n))/den,m=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;
  return[Math.max(0,c-m),Math.min(1,c+m)];
}
function _ksUniformeP(d,n){
  if(!(n>0))return null;var l=(Math.sqrt(n)+0.12+0.11/Math.sqrt(n))*d,s=0;
  if(l<0.27)return 1;
  for(var k=1;k<=100;k++){var tm=2*(k%2?1:-1)*Math.exp(-2*k*k*l*l);s+=tm;if(Math.abs(tm)<1e-12)break;}
  return Math.min(1,Math.max(0,s));
}
// Calibra un conjunto de vidas. opts: {H:500, paso:500, B:400, semilla:7, minTramos:8, loo:true}
function tboCalibrarGrupo(vidas,opts){
  var o=opts||{},H=o.H>0?o.H:500,paso=o.paso>0?o.paso:500,B=o.B>0?o.B:400,minT=o.minTramos>0?o.minTramos:8;
  var nComp=vidas.filter(function(v){return!v.censurado;}).length,nCens=vidas.length-nComp;
  var r={nTramos:vidas.length,nCompletos:nComp,nCensurados:nCens,veredicto:null};
  var filas=_calibFilas(vidas,H,paso);r.nFilas=filas.length;
  if(vidas.length<minT||!filas.length){r.veredicto={codigo:'sin_datos',texto:'Pocos tramos de vida observados ('+vidas.length+'; hacen falta al menos '+minT+') para contrastar el modelo.'};return r;}
  var sumY=0,sumP=0,brier=0;filas.forEach(function(f){sumY+=f.y;sumP+=f.p;brier+=(f.p-f.y)*(f.p-f.y);});
  var n=filas.length,pm=sumY/n,brierClim=filas.reduce(function(s,f){return s+(pm-f.y)*(pm-f.y);},0)/n;
  r.esperado=sumP;r.observado=sumY;r.OE=sumP>0?sumY/sumP:null;r.brier=brier/n;r.brierClim=brierClim;r.skill=brierClim>0?1-(brier/n)/brierClim:null;
  // O/E con bootstrap por tramo (cada tramo de vida es una unidad)
  var por={};filas.forEach(function(f){var a=por[f.i]||(por[f.i]={y:0,p:0});a.y+=f.y;a.p+=f.p;});
  var ids=Object.keys(por),rng=_rngSemilla(o.semilla==null?7:o.semilla),oes=[];
  for(var b=0;b<B;b++){var sy=0,sp=0;for(var j=0;j<ids.length;j++){var q=por[ids[Math.floor(rng()*ids.length)]];sy+=q.y;sp+=q.p;}if(sp>0)oes.push(sy/sp);}
  oes.sort(function(a,b){return a-b;});
  r.OEic=oes.length>20?[oes[Math.floor(oes.length*0.025)],oes[Math.floor(oes.length*0.975)]]:null;
  // Tramos de riesgo predicho
  var cortes=[0,0.02,0.05,0.10,0.20,1.0001];
  r.bins=[];
  for(var c=0;c<cortes.length-1;c++){
    var fb=filas.filter(function(f){return f.p>=cortes[c]&&f.p<cortes[c+1];});
    if(!fb.length){r.bins.push({lo:cortes[c],hi:Math.min(cortes[c+1],1),n:0});continue;}
    var by=fb.reduce(function(s,f){return s+f.y;},0),bp=fb.reduce(function(s,f){return s+f.p;},0)/fb.length;
    r.bins.push({lo:cortes[c],hi:Math.min(cortes[c+1],1),n:fb.length,tramos:Object.keys(fb.reduce(function(a,f){a[f.i]=1;return a;},{})).length,pred:bp,obs:by/fb.length,ic:_wilsonFrac(by,fb.length)});
  }
  // Uniformidad de F(vida) en los tramos completos (si el modelo es correcto, U=F(L) ~ Uniforme(0,1)); fracción que no llega al TBO (esperado 5%)
  var us=vidas.filter(function(v){return!v.censurado;}).map(function(v){return 1-Math.pow(0.95,Math.pow(v.L/v.tbo,TBO_BETA));}).sort(function(a,b){return a-b;});
  if(us.length>=5){
    var d=0;us.forEach(function(u,i){d=Math.max(d,(i+1)/us.length-u,u-i/us.length);});
    r.ks={D:d,p:_ksUniformeP(d,us.length),n:us.length};
    var antes=vidas.filter(function(v){return!v.censurado&&v.L<v.tbo;}).length;
    r.antesTBO={x:antes,n:us.length,frac:antes/us.length,ic:_wilsonFrac(antes,us.length),esperado:0.05};
    var xs=vidas.filter(function(v){return!v.censurado;}).map(function(v){return v.L/v.tbo;}).sort(function(a,b){return a-b;}),nx=xs.length;
    r.medianaVidaTBO=nx%2?xs[(nx-1)/2]:(xs[nx/2-1]+xs[nx/2])/2;r.medianaModelo=Math.pow(Math.log(0.5)/Math.log(0.95),1/TBO_BETA);
  }
  // Modelo ajustado con el resto de la flota (se deja un equipo afuera cada vez): ¿predice mejor que el del fabricante?
  if(o.loo!==false){
    var sig=Object.keys(vidas.reduce(function(a,v){a[v.sigla]=1;return a;},{})),brierLoo=0,nLoo=0,ok=sig.length>=2;
    for(var s=0;s<sig.length&&ok;s++){
      var resto=vidas.filter(function(v){return v.sigla!==sig[s];}).map(function(v){return{tiempo:v.L/v.tbo,censurado:v.censurado};});
      var aj=ajusteWeibullCensurado(resto);
      if(!aj){ok=false;break;}
      var fo=_calibFilas(vidas.filter(function(v){return v.sigla===sig[s];}),H,paso,function(v,t){return _calibP(t/v.tbo,H/v.tbo,1,aj.beta,aj.eta);});
      fo.forEach(function(f){brierLoo+=(f.p-f.y)*(f.p-f.y);nLoo++;});
    }
    if(ok&&nLoo){var bl=brierLoo/nLoo;r.brierFlota=bl;
      // misma base de filas: el Brier del fabricante sobre las mismas filas que el de la flota (las filas son las mismas por construcción)
      r.mejorFlotaQueFabricante=bl<r.brier;}
  }
  var lo=r.OEic?r.OEic[0]:null,hi=r.OEic?r.OEic[1]:null,oe=r.OE;
  var cod,txt;
  if(lo!=null&&lo>1){cod='subestima';txt='Los componentes se cambian o fallan ANTES de lo que el modelo del fabricante espera (ocurre '+(Math.round(oe*10)/10+'').replace('.',',')+' veces lo esperado).';}
  else if(hi!=null&&hi<1){cod='sobreestima';txt='Los componentes duran MÁS de lo que el modelo del fabricante espera (ocurre '+(Math.round(oe*100)/100+'').replace('.',',')+' veces lo esperado): el modelo es más pesimista que la flota.';}
  else{cod='compatible';txt='No hay evidencia de que el modelo del fabricante falle en esta flota'+(r.skill!=null&&r.skill<=0?', pero tampoco predice mejor que una tasa constante':'')+'. Con tan pocos tramos la prueba tiene poca potencia.';}
  r.veredicto={codigo:cod,texto:txt};
  return r;
}
// Calibración de toda la flota: todos los componentes juntos, por origen y por componente (los que tengan tramos suficientes).
function tboCalibracionFlota(d,o){
  var op=o||{},v=tboVidasObservadas(d.compHist||[],d.equipos||[],d.compras||[],op.aplic||'normal',d.hoy),vidas=v.vidas;
  var nombre={original:'Original (Komatsu)',alternativo:'Alternativo / reparado','sin dato':'Origen sin registrar'};
  var out={omitidos:v.omitidos,nVidas:vidas.length,todos:tboCalibrarGrupo(vidas,op),porOrigen:[],porComponente:[]};
  ['original','alternativo','sin dato'].forEach(function(og){
    var sub=vidas.filter(function(x){return x.origen===og;});
    if(sub.length)out.porOrigen.push({clave:og,nombre:nombre[og],r:tboCalibrarGrupo(sub,op)});
  });
  var porComp={};vidas.forEach(function(x){(porComp[x.fam]=porComp[x.fam]||[]).push(x);});
  Object.keys(porComp).forEach(function(f){if(porComp[f].length>=(op.minTramos||8))out.porComponente.push({fam:f,comps:Object.keys(porComp[f].reduce(function(a,x){a[x.comp]=1;return a;},{})),r:tboCalibrarGrupo(porComp[f],op)});});
  out.porComponente.sort(function(a,b){return b.r.nTramos-a.r.nTramos;});
  return out;
}

// Versión para las pantallas: lee el store y recuerda el resultado 5 s (el Buscador la pide por cada ficha que se abre).
var _tboCalibCache={clave:null,ts:0,val:null};
function tboCalibracionAuto(){
  try{
    if(typeof S==='undefined'||typeof tboUnirCompras!=='function')return null;
    var eqs=S.g('eq')||[],ch=S.g('compHist')||[],oc=S.g('ocHist')||[],cd=S.g('comprasDetalle')||[];
    var ap=null;try{ap=localStorage.getItem('tboAplic');}catch(e){}
    ap=TBO_APLICACION[ap]?ap:'normal';
    var clave=[eqs.length,eqs.reduce(function(a,e){return a+(Number(e&&e.horomActual)||0);},0),ch.length,oc.length,cd.length,ap].join('|'),ahora=Date.now();
    if(_tboCalibCache.clave===clave&&ahora-_tboCalibCache.ts<5000)return _tboCalibCache.val;
    var val=tboCalibracionFlota({compHist:ch,equipos:eqs,compras:tboUnirCompras(oc,cd),hoy:new Date()},{aplic:ap});
    _tboCalibCache={clave:clave,ts:ahora,val:val};
    return val;
  }catch(e){return null;}
}


// ═══ REPOSICIÓN ALIMENTADA POR EL PROGRAMA DE PM (2026-10-11) ═══
// stockEstado/punto de reorden miran el consumo PASADO (o un "consumo/mes" tipeado a mano). Pero buena parte de lo que se consume no es azar: cada PM tiene una pauta
// con los filtros y lubricantes que gasta, y el próximo PM de cada equipo ya está calendarizado por horómetro. Con eso la demanda de los próximos meses se puede calcular
// (no estimar): se recorren los PM que vienen de cada equipo hasta el horizonte, se suman las pautas de cada PM por repuesto y se compara con el stock + lo pendiente.
// Supuestos: el ritmo diario es el declarado del equipo (hrsDia); el PM se hace en su hito; el consumo no planificado (fallas) no está acá, por eso se muestra junto al
// histórico. Todo es puro: la pauta de cada PM la entrega quien llama (getPautasConsumo, index.html).
// PM calendarizados de un equipo hasta `horizonteDias`: [{pm, horom, dias, fecha}].
function pmProgramadosEquipo(e,hoy,horizonteDias){
  var out=[];
  if(!e||!e.sigla)return out;
  var frec=Number(e.frecPM)>0?Number(e.frecPM):250,ritmo=Number(e.hrsDia)>0?Number(e.hrsDia):0,h0=Number(e.horomActual)||0;
  if(!(ritmo>0))return out;
  var base=hoy instanceof Date?hoy:new Date(hoy||Date.now());
  var p=Number(e.horomProxPM)>h0?Number(e.horomProxPM):C.proxPM(h0,frec);
  for(var i=0;i<80;i++,p+=frec){
    var dias=(p-h0)/ritmo;if(dias>horizonteDias)break;
    out.push({pm:C.tipoPM(p,frec),horom:p,dias:Math.max(0,Math.round(dias)),fecha:new Date(base.getTime()+Math.max(0,Math.round(dias))*86400000).toISOString().slice(0,10)});
  }
  return out;
}
// Mismo criterio de vinculación que descontarStock (index.html) para saber a qué ítem de Stock o Lubricantes corresponde una línea de pauta: primero el caché
// de mapaRep, luego N° de parte (principal o alternativo) y por último palabras de la descripción; para lubricantes, puntaje por palabras y números.
// Devuelve {tipo:'filtro'|'lubricante', idx} o null. No modifica nada.
function pautaResolverStock(c,stk,lub,mapaRep){
  var rep=String((c&&(c.rep||c.repuesto||c.nombre))||'').trim();if(!rep)return null;
  var repLow=rep.toLowerCase();
  var cache=c._id?(mapaRep||[]).filter(function(m){return m.pautaId===c._id;})[0]:null;
  if(cache){
    if(cache.tipo==='filtro'){var f0=(stk||[]).findIndex(function(s){return s._id===cache.refId;});if(f0>=0)return{tipo:'filtro',idx:f0};}
    else if(cache.tipo==='lubricante'){var l0=(lub||[]).findIndex(function(l){return l._id===cache.refId;});if(l0>=0)return{tipo:'lubricante',idx:l0};}
  }
  var partNums=repLow.match(/[a-z]?\d{2,}[-\d]+[a-z]*/gi)||[],fi=-1;
  if(partNums.length>0){
    fi=(stk||[]).findIndex(function(s){
      var np=(s.nParte||'').toLowerCase(),ca=(s.codAlt||'').toLowerCase();
      return partNums.some(function(pn){var p=pn.toLowerCase();if(p.length<4)return false;
        return(np&&(np.indexOf(p)>=0||p.indexOf(np)>=0))||(ca&&(ca.indexOf(p)>=0||(p.length>=5&&p.indexOf(ca)>=0&&ca.length>=5)));});
    });
  }
  if(fi<0){
    fi=(stk||[]).findIndex(function(s){
      var desc=(s.descripcion||'').toLowerCase(),words=repLow.split(/\s+/).filter(function(w){return w.length>4;});
      return words.length>0&&words.filter(function(w){return desc.indexOf(w)>=0;}).length>=Math.min(2,words.length);
    });
  }
  if(fi>=0)return{tipo:'filtro',idx:fi};
  var li=-1,best=0;
  (lub||[]).forEach(function(l,idx){
    var ln=(l.nombre||'').toLowerCase().replace(/[-_%]/g,' ');if(ln.length<4)return;
    var rn=repLow.replace(/[-_%]/g,' '),rt=rn.split(/\s+/).filter(function(w){return w.length>1;}),lt=ln.split(/\s+/).filter(function(w){return w.length>1;}),score=0;
    rt.forEach(function(r){if(lt.some(function(x){return x===r||x.indexOf(r)>=0||r.indexOf(x)>=0;}))score++;});
    var nums=rn.match(/\d+\w*/g)||[],lnums=ln.match(/\d+\w*/g)||[];
    nums.forEach(function(n){var nc=n.replace(/w$/i,'');if(lnums.some(function(x){return x.replace(/w$/i,'')===nc;}))score+=2;});
    var numMatch=nums.filter(function(n){var nc=n.replace(/w$/i,'');return lnums.some(function(x){return x.replace(/w$/i,'')===nc;});}).length;
    if(score>=3&&numMatch>=1&&score>best){best=score;li=idx;}
    if(li<0){var rnc=rn.replace(/\s+/g,''),lnc=ln.replace(/\s+/g,'');if(lnc.length>8&&rnc.indexOf(lnc)>=0){li=idx;best=99;}}
  });
  return li>=0?{tipo:'lubricante',idx:li}:null;
}
// Demanda planificada por ítem de Stock/Lubricantes según los PM calendarizados de la flota.
// consumosFn(sigla, tipoPM) → líneas de pauta [{rep, can, _id}]. Devuelve {items:{'filtro:3':{tipo,idx,eventos:[{dias,cant,sigla,pm}]}}, sinStock:{rep:veces}, pmContados, sinRitmo:[siglas]}.
function demandaPlanificadaPM(equipos,consumosFn,stk,lub,mapaRep,hoy,horizonteDias){
  var items={},sinStock={},pmN=0,sinRitmo=[],cacheRes={};
  (equipos||[]).forEach(function(e){
    if(!e||!e.sigla)return;
    var pms=pmProgramadosEquipo(e,hoy,horizonteDias);
    if(!pms.length){if(!(Number(e.hrsDia)>0))sinRitmo.push(e.sigla);return;}
    pms.forEach(function(pm){
      pmN++;
      (consumosFn(e.sigla,pm.pm)||[]).forEach(function(c){
        var cant=Number(c.can||c.cant)||0;if(cant<=0)return;
        var k=(c._id||'')+'|'+(c.rep||c.repuesto||c.nombre||''),r=cacheRes[k]!==undefined?cacheRes[k]:(cacheRes[k]=pautaResolverStock(c,stk,lub,mapaRep));
        if(!r){var nm=String(c.rep||c.repuesto||c.nombre||'').trim();if(nm)sinStock[nm]=(sinStock[nm]||0)+1;return;}
        var key=r.tipo+':'+r.idx,it=items[key]||(items[key]={tipo:r.tipo,idx:r.idx,eventos:[]});
        it.eventos.push({dias:pm.dias,cant:cant,sigla:e.sigla,pm:pm.pm});
      });
    });
  });
  return{items:items,sinStock:sinStock,pmContados:pmN,sinRitmo:sinRitmo};
}
// Plan de reposición: cruza la demanda planificada con el stock (+ pendiente) y el plazo de entrega de cada ítem.
// opts: {cobertura:30 días a cubrir después de que llegue el pedido, horizonte:120}. Estados: 'pedir_ya' (el quiebre llega antes que el pedido), 'planificar' (el quiebre
// está a menos de 30 días de poder pedirse tarde), 'cubierto' (alcanza todo el horizonte) y 'sin_plan' (ningún PM lo consume).
function planReposicionPM(demanda,stk,lub,opts){
  var o=opts||{},cob=o.cobertura>=0?o.cobertura:30,out=[];
  Object.keys(demanda.items||{}).forEach(function(k){
    var d=demanda.items[k],row=d.tipo==='filtro'?(stk||[])[d.idx]:(lub||[])[d.idx];if(!row)return;
    var pos=d.tipo==='filtro'?(Number(row.stockBodega)||0)+(Number(row.pendiente)||0):(Number(row.stock)||0);
    var lead=Number(row.leadTime)>0?Number(row.leadTime):34,ev=d.eventos.slice().sort(function(a,b){return a.dias-b.dias;});
    var acum=0,quiebre=null;
    for(var i=0;i<ev.length;i++){acum+=ev[i].cant;if(quiebre==null&&acum>pos){quiebre=ev[i].dias;}}
    var suma=function(h){return ev.filter(function(x){return x.dias<=h;}).reduce(function(s,x){return s+x.cant;},0);};
    var necesidad=suma(lead+cob),faltante=Math.max(0,necesidad-pos),holgura=quiebre==null?null:quiebre-lead;
    var estado=quiebre==null?'cubierto':holgura<=0?'pedir_ya':holgura<=30?'planificar':'cubierto';
    var hist=Number(row.consumoMes)||Number(row.proyMes)||0,plan30=suma(30);
    out.push({tipo:d.tipo,idx:d.idx,nombre:d.tipo==='filtro'?(row.descripcion||''):(row.nombre||''),nParte:d.tipo==='filtro'?(row.nParte||''):'',equipoModelo:row.equipoModelo||'',
      posicion:pos,stockBodega:d.tipo==='filtro'?(Number(row.stockBodega)||0):pos,pendiente:d.tipo==='filtro'?(Number(row.pendiente)||0):0,lead:lead,leadPropio:Number(row.leadTime)>0,
      necesidad:necesidad,faltante:faltante,pedir:Math.max(0,Math.ceil(faltante-1e-9)),quiebreDias:quiebre,pedirAntesDias:holgura,estado:estado,
      plan30:plan30,plan90:suma(90),historicoMes:hist,razonPlanHist:hist>0?plan30/hist:null,total:acum,eventos:ev});
  });
  var rango={pedir_ya:0,planificar:1,cubierto:2};
  out.sort(function(a,b){return rango[a.estado]-rango[b.estado]||(a.pedirAntesDias==null?9999:a.pedirAntesDias)-(b.pedirAntesDias==null?9999:b.pedirAntesDias)||b.faltante-a.faltante;});
  return out;
}

// Plan de reposición por PM leyendo el store (lo usan Stock Filtros y ABC-XYZ). null si faltan getPautasConsumo o el store. Devuelve {plan, dem}.
function planReposicionAuto(cobertura){
  try{
    if(typeof S==='undefined'||typeof getPautasConsumo!=='function')return null;
    var stk=S.g('stk')||[],lub=S.g('lub')||[],dem=demandaPlanificadaPM(S.g('eq')||[],getPautasConsumo,stk,lub,S.g('mapaRep')||[],new Date(),150);
    return{dem:dem,plan:planReposicionPM(dem,stk,lub,{cobertura:cobertura>=0?cobertura:30})};
  }catch(e){return null;}
}
// {nParte: unidades/mes} con lo calendarizado en los próximos 150 días (5 meses) — solo filtros (los lubricantes no se manejan por N° de parte).
function demandaMensualPlanPorNParte(plan){
  var out={};
  (plan||[]).forEach(function(r){if(r.tipo==='filtro'&&r.nParte&&r.total>0)out[r.nParte]=r.total/5;});
  return out;
}


// ═══ COSTO TOTAL DE PROPIEDAD (TCO) POR EQUIPO (2026-10-11) ═══
// Cuánto cuesta TENER un equipo por hora de operación: capital + mantención + detención. Sirve para ver si un equipo ya cuesta más de lo que vale mantenerlo (y cuándo evaluar
// renovarlo). Componentes, todos medidos en la misma ventana de datos (desde la primera compra registrada del equipo hasta el último mes completo):
//  · Capital por hora: la amortización contable por hora del equipo (`valorHoraAmort`, del listado "Horas a Amortizar"); si no está, valor de compra ÷ vida contable en horas
//    (`vidaContableH` del equipo o la de referencia por clase de ese mismo listado: camión 26.000 h, cargador 18.000 h, bulldozer 17.000 h). Sin ninguno, el TCO se muestra sin capital.
//  · Mantención: gasto real en repuestos y servicios (órdenes de compra, tboUnirCompras), sin la línea que coincide exacto con el valor de compra. NO incluye mano de obra propia: el
//    costo de los correctivos sigue vacío (mismo criterio y límite que costoRelativoMantenimiento).
//  · Detención: horas detenidas por FALLA (dispDownMap sin PM) × costo de hora detenida (Configuración). Las salidas de servicio sin duración registrada cuentan 8 h (supuesto del propio dispDownMap).
// Las horas de la ventana salen del historial de horómetros; sin él, de las horas/día declaradas (se avisa). Indicador de renovación: mientras el costo VARIABLE por hora
// (mantención + detención) sea menor que el capital por hora de una unidad nueva del mismo modelo, renovar no conviene aunque la unidad nueva no gastara nada en mantención; sobre
// ese umbral podría convenir y depende de cuánto costaría mantener la nueva. Es una cota, no un veredicto.
var TCO_VIDA_CONTABLE_H={camion:26000,cargador:18000,bulldozer:17000};
function _tcoIso(d){return(d instanceof Date?d:new Date(d||Date.now())).toISOString().slice(0,10);}
function _tcoDias(a,b){return Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000);}
function _tcoVidaH(e){
  if(Number(e.vidaContableH)>0)return{h:Number(e.vidaContableH),fuente:'vida contable del equipo'};
  var cl=tboClaseModelo(e.modelo);
  if(cl&&TCO_VIDA_CONTABLE_H[cl.clase])return{h:TCO_VIDA_CONTABLE_H[cl.clase],fuente:'vida contable de referencia ('+cl.clase+')'};
  return null;
}
// Capital por hora de un equipo: {porHora, fuente} o null.
function tcoCapitalPorHora(e){
  if(Number(e.valorHoraAmort)>0)return{porHora:Number(e.valorHoraAmort),fuente:'amortización contable por hora'};
  var v=Number(e.valorCompra)||0,vida=_tcoVidaH(e);
  if(v>0&&vida)return{porHora:v/vida.h,fuente:'valor de compra ÷ '+vida.fuente};
  return null;
}
// d: {compras, downMap, hist, hoy, hasta} · o: {costoHoraDet, minDias}. Devuelve null si no hay mantención registrada o la ventana es corta.
function tcoEquipo(e,d,o){
  var op=o||{},minDias=op.minDias>0?op.minDias:90;
  if(!e||!e.sigla)return null;
  var cd=costoHoraDetDe(e.modelo,op);
  var hoy=_tcoIso(d.hoy),hasta=d.hasta||hoy;
  var lineas=(d.compras||[]).filter(function(c){return c&&c.sigla===e.sigla&&c.fecha&&(Number(c.costo)||0)>0&&Number(c.costo)!==Number(e.valorCompra)&&c.fecha<=hasta;});
  if(!lineas.length)return null;
  var desde=lineas.map(function(c){return String(c.fecha).slice(0,10);}).sort()[0],dias=_tcoDias(desde,hasta);
  if(dias<minDias)return null;
  var anios=dias/365;
  // horas operadas en la ventana
  var hA=C.horomHistorico(d.hist||[],e.sigla,hasta),hD=C.horomHistorico(d.hist||[],e.sigla,desde),horas=null,fuenteHoras='';
  if(hA==null&&hasta===hoy&&Number(e.horomActual)>0)hA=Number(e.horomActual);
  if(hA!=null&&hD!=null&&hA>hD){horas=hA-hD;fuenteHoras='historial de horómetros';}
  else if(Number(e.hrsDia)>0){horas=Math.min(Number(e.hrsDia)*dias,Number(e.horomActual)||Infinity);fuenteHoras='horas/día declaradas (estimado)';}
  if(!(horas>0))return null;
  var mat=lineas.reduce(function(s,c){return s+(Number(c.costo)||0);},0);
  var dm=(d.downMap&&d.downMap[e.sigla])||{},horasDet=0;
  Object.keys(dm).forEach(function(f){if(f>=desde&&f<=hasta)horasDet+=dm[f];});
  var det=horasDet*cd,cap=tcoCapitalPorHora(e),capTotal=cap?cap.porHora*horas:null;
  var matH=mat/horas,detH=det/horas,varH=matH+detH;
  var r={sigla:e.sigla,modelo:e.modelo,tipo:e.tipo,costoHoraDet:cd,costoDetPropio:costoHoraDetPropio(e.modelo,op),desde:desde,hasta:hasta,dias:dias,anios:anios,horas:horas,horasAnio:horas/anios,fuenteHoras:fuenteHoras,
    mat:mat,matAnual:mat/anios,matPorHora:matH,horasDet:horasDet,det:det,detAnual:det/anios,detPorHora:detH,
    capital:cap,capitalPorHora:cap?cap.porHora:null,capitalAnual:cap?cap.porHora*horas/anios:null,
    variablePorHora:varH,tcoPorHora:cap?varH+cap.porHora:null,tcoAnual:cap?(mat+det+capTotal)/anios:null,
    pctMat:null,porAnio:[]};
  var tot=mat+det+(capTotal||0);r.pctMat=tot>0?mat/tot:null;
  // evolución por año calendario: mantención y detención por hora de ese año (necesita horómetros en los bordes del año)
  var a0=Number(desde.slice(0,4)),a1=Number(hasta.slice(0,4));
  for(var a=a0;a<=a1;a++){
    var ini=a===a0?desde:a+'-01-01',fin=a===a1?hasta:a+'-12-31';
    var h0=C.horomHistorico(d.hist||[],e.sigla,ini),h1=C.horomHistorico(d.hist||[],e.sigla,fin);
    var m=lineas.filter(function(c){var f=String(c.fecha).slice(0,10);return f>=ini&&f<=fin;}).reduce(function(s,c){return s+(Number(c.costo)||0);},0);
    var hd=0;Object.keys(dm).forEach(function(f){if(f>=ini&&f<=fin)hd+=dm[f];});
    var hh=(h0!=null&&h1!=null&&h1>h0)?h1-h0:null;
    r.porAnio.push({anio:a,dias:_tcoDias(ini,fin)+1,mat:m,horasDet:hd,horas:hh,matPorHora:hh?m/hh:null,detPorHora:hh?hd*cd/hh:null,variablePorHora:hh?(m+hd*cd)/hh:null});
  }
  return r;
}
// TCO de toda la flota: calcula una vez lo que no depende del equipo (compras, mapa de detenciones, fin de ventana sin los meses finales con carga atrasada) y compara cada
// equipo contra la mediana de su modelo (si hay ≥3 unidades) y contra el capital por hora de la unidad más nueva del mismo modelo.
function tcoFlota(equipos,d,o){
  var op=o||{},hoy=_tcoIso(d.hoy),compras=d.compras||[];
  var sm=serieMensualDe(compras.filter(function(c){return c&&c.fecha&&(Number(c.costo)||0)>0;}).map(function(c){return{fecha:c.fecha,valor:Number(c.costo)||0};}));
  var quita=mesesFinalesIncompletos(sm.lineas),hasta=hoy,mesesQuitados=[];
  if(quita>0){var ultimo=sm.meses[sm.meses.length-quita-1];var p=ultimo.split('-');hasta=new Date(Date.UTC(Number(p[0]),Number(p[1]),0)).toISOString().slice(0,10);mesesQuitados=sm.meses.slice(sm.meses.length-quita);}
  var downMap=d.downMap||dispDownMap(d.reg||[],d.ot||[],hasta,{incluirPM:false});
  var dd=Object.assign({},d,{hasta:hasta,downMap:downMap,hoy:hoy}),res=[];
  (equipos||[]).forEach(function(e){var r=tcoEquipo(e,dd,op);if(r)res.push(r);});
  var porModelo={};res.forEach(function(r){var k=_normalizarModelo(r.modelo);(porModelo[k]=porModelo[k]||[]).push(r);});
  var med=function(a){a=a.slice().sort(function(x,y){return x-y;});var n=a.length;return n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2;};
  var eqPor={};(equipos||[]).forEach(function(e){eqPor[e.sigla]=e;});
  res.forEach(function(r){
    var g=porModelo[_normalizarModelo(r.modelo)],n=g.length;
    r.modeloN=n;r.medianaModelo=n>=3?med(g.map(function(x){return x.variablePorHora;})):null;
    r.indiceVsModelo=r.medianaModelo>0?r.variablePorHora/r.medianaModelo:null;
    // unidad más nueva del mismo modelo (año de fabricación o menor horómetro) como referencia de capital de reemplazo
    var mismos=(equipos||[]).filter(function(e){return _normalizarModelo(e.modelo)===_normalizarModelo(r.modelo)&&tcoCapitalPorHora(e);});
    mismos.sort(function(a,b){return(Number(b.anioFab)||0)-(Number(a.anioFab)||0)||(Number(a.horomActual)||0)-(Number(b.horomActual)||0);});
    var nuevo=mismos[0]||null,capN=nuevo?tcoCapitalPorHora(nuevo):null;
    r.capitalNuevoPorHora=capN?capN.porHora:null;r.refNuevo=nuevo?nuevo.sigla:null;
    r.razonVariableCapitalNuevo=capN&&capN.porHora>0?r.variablePorHora/capN.porHora:null;
  });
  res.sort(function(a,b){return(b.tcoPorHora!=null?b.tcoPorHora:b.variablePorHora)-(a.tcoPorHora!=null?a.tcoPorHora:a.variablePorHora);});
  return{equipos:res,hasta:hasta,mesesQuitados:mesesQuitados,costoHoraDet:Number(op.costoHoraDet)||0};
}

// Lee las filas del listado "Horas a Amortizar" (hoja HorasaAmortizar: Sigla, Saldo_Horas_Real, Valor_Hora…) y arma qué equipos del programa se actualizan con su amortización por
// hora y su vida contable en horas. Puro: no escribe nada. Devuelve {actualizar:[{sigla,valorHoraAmort,vidaContableH,faena}], sinEquipo:[siglas], sinValor:[siglas], repetidas:[siglas]}.
function parsearHorasAmortizar(filas,equipos){
  var siglas={};(equipos||[]).forEach(function(e){if(e&&e.sigla)siglas[String(e.sigla).trim().toUpperCase()]=e.sigla;});
  var num=function(x){var n=typeof x==='number'?x:parseFloat(String(x==null?'':x).replace(/\./g,'').replace(',','.'));return isFinite(n)?n:null;};
  var por={},sinEquipo=[],sinValor=[],repetidas=[];
  (filas||[]).forEach(function(f){
    var sg=String(f.Sigla!=null?f.Sigla:f.sigla!=null?f.sigla:'').trim().toUpperCase();if(!sg)return;
    var vh=num(f.Valor_Hora!=null?f.Valor_Hora:f.valorHora),vida=num(f.Saldo_Horas_Real!=null?f.Saldo_Horas_Real:f.saldoHoras);
    if(!siglas[sg]){if(sinEquipo.indexOf(sg)<0)sinEquipo.push(sg);return;}
    if(!(vh>0)){if(sinValor.indexOf(sg)<0)sinValor.push(sg);return;}
    if(por[sg]){if(repetidas.indexOf(sg)<0)repetidas.push(sg);return;}   // si una sigla aparece dos veces se queda con la primera con valor
    por[sg]={sigla:siglas[sg],valorHoraAmort:Math.round(vh),vidaContableH:vida>0?Math.round(vida):null,faena:String(f.Faena||'').trim()};
  });
  return{actualizar:Object.keys(por).map(function(k){return por[k];}),sinEquipo:sinEquipo,sinValor:sinValor,repetidas:repetidas};
}

// Conciliación del valor contable contra el valor de compra cargado (2026-10-11). Amortización por hora × vida contable = valor que la contabilidad reparte en horas; debería parecerse al
// `valorCompra` del equipo. Si difiere, el capital por hora del TCO cambia según la fuente (contable vs valorCompra ÷ vida) y hay que revisar cuál dato está desactualizado o incluye otros
// conceptos (neumáticos, tolva, flete, instalación). Solo compara equipos con amortización y vida conocida. umbral = diferencia relativa desde la cual se pide revisar (15 % por defecto).
// Devuelve {filas (mayor diferencia primero), revisar, sinValorCompra}.
function tcoConciliarValor(equipos,umbral){
  var um=umbral>0?umbral:0.15,filas=[],sinVC=[];
  (equipos||[]).forEach(function(e){
    if(!e||!(Number(e.valorHoraAmort)>0))return;
    var vida=_tcoVidaH(e);if(!vida)return;
    var vh=Number(e.valorHoraAmort),imp=vh*vida.h,vc=Number(e.valorCompra)||0;
    if(!(vc>0)){sinVC.push(e.sigla);return;}
    var dif=imp/vc-1;
    filas.push({sigla:e.sigla,modelo:e.modelo||'',valorHora:vh,vidaH:vida.h,vidaFuente:vida.fuente,valorImplicito:Math.round(imp),valorCompra:vc,ratio:imp/vc,difPct:dif,
      capitalContable:vh,capitalCompra:vc/vida.h,nivel:Math.abs(dif)>um?'revisar':'ok'});
  });
  filas.sort(function(a,b){return Math.abs(b.difPct)-Math.abs(a.difPct);});
  return{filas:filas,revisar:filas.filter(function(f){return f.nivel==='revisar';}).length,sinValorCompra:sinVC,umbral:um};
}

// Versión para las pantallas: lee el store y recuerda el resultado 5 s (Costos y Buscador lo piden en la misma pasada). {res, aj} o null.
var _tcoCache={clave:null,ts:0,val:null};
function tcoFlotaAuto(){
  try{
    if(typeof S==='undefined'||typeof tboUnirCompras!=='function')return null;
    var lee=function(k){try{return localStorage.getItem(k);}catch(e){return null;}};
    var eqs=S.g('eq')||[],oc=S.g('ocHist')||[],cd=S.g('comprasDetalle')||[],hist=S.g('hist')||[],reg=S.g('reg')||[],ot=S.g('ot')||[];
    var otAll=ot.concat(typeof _otHistComoOt==='function'?_otHistComoOt(S.g('otHist')||[]):[]);
    var mttr=(typeof duracionesReparacionFlotaHoras==='function'&&typeof medianaPositiva==='function')?medianaPositiva(duracionesReparacionFlotaHoras(ot)):null;
    var aj=tboAjustesCosto(lee,mttr,S.g('hh'),(S.g('cfg')||{}).costoHoraDetUSD,(S.g('cfg')||{}).costoHoraDetModelos,(S.g('cfg')||{}).tasaUSD);
    var amort=eqs.reduce(function(a,e){return a+(Number(e&&e.valorHoraAmort)||0)+(Number(e&&e.vidaContableH)||0)+(Number(e&&e.valorCompra)||0);},0);
    var clave=[JSON.stringify(aj.porModelo),eqs.length,eqs.reduce(function(a,e){return a+(Number(e&&e.horomActual)||0);},0),amort,oc.length,cd.length,hist.length,reg.length,otAll.length,aj.costoHoraDet].join('|'),ahora=Date.now();
    if(_tcoCache.clave===clave&&ahora-_tcoCache.ts<5000)return _tcoCache.val;
    var res=tcoFlota(eqs,{compras:tboUnirCompras(oc,cd),hist:hist,reg:reg,ot:otAll,hoy:new Date()},{costoHoraDet:aj.costoHoraDet,costoHoraDetPorModelo:aj.porModelo});
    var val={res:res,aj:aj};_tcoCache={clave:clave,ts:ahora,val:val};
    return val;
  }catch(e){return null;}
}

// ═══ DIAGRAMAS DE SANKEY: DE DÓNDE VIENEN LAS HORAS Y EL COSTO (2026-10-13) ═══
// Un Sankey dibuja flujos con un ancho proporcional a la cantidad: sirve para ver de un vistazo cómo se reparte el total (horas de reparación o costo anual) entre ramas sucesivas. Aquí hay dos:
//  - costo anual (TCO): Concepto (capital, mantención, detención) → Tipo de equipo → Equipo. Usa el costo ANUALIZADO de cada equipo de tcoFlota (cada uno con su propia ventana de compras), sin mano de obra propia.
//  - horas de reparación registradas en los últimos 12 meses: Tipo de equipo → Equipo → Componente. Solo cuentan las reparaciones con duración registrada (sin duración no se inventa).
// Una rama pequeña no se dibuja sola: los equipos o componentes que quedan fuera del top se agrupan en "Otros". Funciones puras: calculan el flujo y la posición de cada nodo y cada cinta; el dibujo está en la pantalla.
function _sankeyTopN(mapa,n,etiquetaOtros){
  var ks=Object.keys(mapa).sort(function(a,b){return mapa[b]-mapa[a]||(a<b?-1:1);}),dest={},otros=0;
  ks.forEach(function(k,i){if(i<n)dest[k]=k;else{dest[k]=etiquetaOtros;otros++;}});
  return{dest:dest,otros:otros};
}
// res: tcoFlota().equipos · o: {topEquipos (10)} → {links:[{origen,destino,valor}], columnas:{id:0|1|2}, meta}
function sankeyCostoTCO(res,o){
  var op=o||{},top=op.topEquipos>0?op.topEquipos:10,filas=[],sinCapital=0;
  (res||[]).forEach(function(r){
    var cap=r.capitalAnual>0?r.capitalAnual:0,mat=r.matAnual>0?r.matAnual:0,det=r.detAnual>0?r.detAnual:0,tot=cap+mat+det;
    if(!(tot>0))return;
    if(!(r.capitalAnual>0))sinCapital++;
    filas.push({sigla:r.sigla,tipo:r.tipo||'Sin tipo',cap:cap,mat:mat,det:det,tot:tot});
  });
  var porEq={};filas.forEach(function(f){porEq[f.sigla]=f.tot;});
  var tn=_sankeyTopN(porEq,top,'Otros equipos'),conc={Capital:'Capital (amortización)',Mantencion:'Mantención (repuestos y servicios)',Detencion:'Detención por falla'};
  var acc={};
  var add=function(a,b,v){if(!(v>0))return;var k=a+'\u0001'+b;acc[k]=(acc[k]||0)+v;};
  var columnas={};
  filas.forEach(function(f){
    var eqn=tn.dest[f.sigla];
    add(conc.Capital,f.tipo,f.cap);add(conc.Mantencion,f.tipo,f.mat);add(conc.Detencion,f.tipo,f.det);
    add(f.tipo,eqn,f.tot);
    columnas[conc.Capital]=0;columnas[conc.Mantencion]=0;columnas[conc.Detencion]=0;columnas[f.tipo]=1;columnas[eqn]=2;
  });
  var links=Object.keys(acc).map(function(k){var p=k.split('\u0001');return{origen:p[0],destino:p[1],valor:acc[k]};});
  return{links:links,columnas:columnas,meta:{total:filas.reduce(function(a,f){return a+f.tot;},0),equipos:filas.length,sinCapital:sinCapital,otros:tn.otros}};
}
// eventos: [{sigla, fecha, durH, componente}] · equipos: [{sigla,tipo}] · o: {desde,hasta,topEquipos (10),topComponentes (8)}
function sankeyHorasReparacion(eventos,equipos,o){
  var op=o||{},top=op.topEquipos>0?op.topEquipos:10,topC=op.topComponentes>0?op.topComponentes:8,tipoDe={};
  (equipos||[]).forEach(function(e){if(e&&e.sigla)tipoDe[e.sigla]=e.tipo||'Sin tipo';});
  var ev=(eventos||[]).filter(function(x){return x&&x.sigla&&typeof x.durH==='number'&&x.durH>0&&(!op.desde||x.fecha>=op.desde)&&(!op.hasta||x.fecha<=op.hasta);});
  var sinDur=(eventos||[]).filter(function(x){return x&&x.sigla&&!(typeof x.durH==='number'&&x.durH>0)&&(!op.desde||x.fecha>=op.desde)&&(!op.hasta||x.fecha<=op.hasta);}).length;
  var porEq={},porComp={};
  ev.forEach(function(x){porEq[x.sigla]=(porEq[x.sigla]||0)+x.durH;var c=(x.componente||'').trim()||'Sin componente registrado';porComp[c]=(porComp[c]||0)+x.durH;});
  var te=_sankeyTopN(porEq,top,'Otros equipos'),tc=_sankeyTopN(porComp,topC,'Otros componentes');
  // "Sin componente registrado" nunca se esconde dentro de "Otros": es un dato de calidad que se quiere ver
  if(porComp['Sin componente registrado']!=null)tc.dest['Sin componente registrado']='Sin componente registrado';
  var acc={},columnas={},add=function(a,b,v){var k=a+'\u0001'+b;acc[k]=(acc[k]||0)+v;};
  ev.forEach(function(x){
    var tipo=tipoDe[x.sigla]||'Sin tipo',eqn=te.dest[x.sigla],c=(x.componente||'').trim()||'Sin componente registrado',cn=tc.dest[c];
    add(tipo,eqn,x.durH);add(eqn,cn,x.durH);columnas[tipo]=0;columnas[eqn]=1;columnas[cn]=2;
  });
  var links=Object.keys(acc).map(function(k){var p=k.split('\u0001');return{origen:p[0],destino:p[1],valor:acc[k]};});
  return{links:links,columnas:columnas,meta:{total:ev.reduce(function(a,x){return a+x.durH;},0),reparaciones:ev.length,sinDuracion:sinDur,otrosEquipos:te.otros,otrosComponentes:tc.otros}};
}
// Posiciones del diagrama. links: [{origen,destino,valor}] · columnas: {nodo: 0..k} · o: {ancho, alto, anchoNodo, separacion}
// Cada nodo mide lo que fluye por él (el mayor entre lo que entra y lo que sale); todas las columnas usan la misma escala vertical, así que un mismo ancho es la misma cantidad en todo el diagrama.
// Dentro de cada columna los nodos se ordenan por el promedio de la posición de sus orígenes (para cruzar menos cintas); las cintas se apilan en cada nodo por el orden del nodo del otro extremo.
function sankeyLayout(links,columnas,o){
  var op=o||{},W=op.ancho||640,H=op.alto||360,nw=op.anchoNodo||14,sep=op.separacion||8;
  var lk=(links||[]).filter(function(l){return l&&l.valor>0&&columnas[l.origen]!=null&&columnas[l.destino]!=null;});
  if(!lk.length)return{nodos:[],cintas:[],ky:0,ancho:W,alto:H};
  var nodos={};
  var nodo=function(id){return nodos[id]||(nodos[id]={id:id,col:columnas[id],entra:0,sale:0,valor:0,y:0,h:0,x:0,orden:0});};
  lk.forEach(function(l){nodo(l.origen).sale+=l.valor;nodo(l.destino).entra+=l.valor;});
  var lista=Object.keys(nodos).map(function(k){var n=nodos[k];n.valor=Math.max(n.entra,n.sale);return n;});
  var nCol=Math.max.apply(null,lista.map(function(n){return n.col;}))+1,cols=[];
  for(var c=0;c<nCol;c++)cols.push(lista.filter(function(n){return n.col===c;}).sort(function(a,b){return b.valor-a.valor||(a.id<b.id?-1:1);}));
  var ky=Infinity;
  cols.forEach(function(g){if(!g.length)return;var tot=g.reduce(function(a,n){return a+n.valor;},0);ky=Math.min(ky,(H-(g.length-1)*sep)/tot);});
  if(!isFinite(ky)||ky<=0)ky=0;
  var xDe=function(c){return nCol===1?0:c*(W-nw)/(nCol-1);};
  // orden por baricentro de los orígenes (2 pasadas), luego posición vertical
  var pos=function(){cols.forEach(function(g){var y=0;g.forEach(function(n){n.y=y;n.h=n.valor*ky;y+=n.h+sep;});var usado=y-sep,off=Math.max(0,(H-usado)/2);g.forEach(function(n){n.y+=off;});});};
  pos();
  for(var it=0;it<2;it++){
    for(var c2=1;c2<nCol;c2++){
      cols[c2].forEach(function(n){
        var ps=lk.filter(function(l){return l.destino===n.id;}),sw=ps.reduce(function(a,l){return a+l.valor;},0);
        n.bari=sw>0?ps.reduce(function(a,l){return a+(nodos[l.origen].y+nodos[l.origen].h/2)*l.valor;},0)/sw:n.y;
      });
      cols[c2].sort(function(a,b){return a.bari-b.bari||b.valor-a.valor;});
    }
    pos();
  }
  lista.forEach(function(n){n.x=xDe(n.col);});
  var salida={},entrada={};lista.forEach(function(n){salida[n.id]=0;entrada[n.id]=0;});
  var ordSal=function(id){return lk.filter(function(l){return l.origen===id;}).sort(function(a,b){return nodos[a.destino].y-nodos[b.destino].y;});};
  var ordEnt=function(id){return lk.filter(function(l){return l.destino===id;}).sort(function(a,b){return nodos[a.origen].y-nodos[b.origen].y;});};
  var y0={},y1={};
  lista.forEach(function(n){var a=n.y;ordSal(n.id).forEach(function(l){y0[l.origen+'\u0001'+l.destino]=a;a+=l.valor*ky;});var b=n.y;ordEnt(n.id).forEach(function(l){y1[l.origen+'\u0001'+l.destino]=b;b+=l.valor*ky;});});
  var cintas=lk.map(function(l){var k=l.origen+'\u0001'+l.destino;return{origen:l.origen,destino:l.destino,valor:l.valor,w:l.valor*ky,x0:nodos[l.origen].x+nw,x1:nodos[l.destino].x,y0:y0[k],y1:y1[k]};});
  return{nodos:lista.sort(function(a,b){return a.col-b.col||a.y-b.y;}),cintas:cintas,ky:ky,ancho:W,alto:H,anchoNodo:nw,columnas:nCol};
}

// ═══ ARRIENDO VS COMPRA (2026-10-13) ═══
// Compara, por hora de operación y por modelo de equipo, tres caminos: arrendar SECO (tú pones operador, combustible, mantención y neumáticos), arrendar HÚMEDO (todo incluido, con disponibilidad garantizada) y COMPRAR.
// Todo se expresa en UF por hora. Cada modelo suma sus costos propios (operador, mecánicos, combustible, neumáticos, repuestos y servicios) a la tarifa seca, y compara contra la tarifa húmeda.
//  - Operador y mecánicos: personas × costo mensual ÷ horas de operación al mes. Combustible: litros por carga ÷ horas entre cargas × precio neto del litro. Neumáticos y repuestos: los mide el propio sistema.
//  - Seco más barato por = húmedo − seco total (positivo: conviene el seco). Se muestra el rango (mínimo contra máximo de las tarifas) y el punto medio.
//  - Por hora PRODUCTIVA: tarifa ÷ disponibilidad. Disponibilidad de equilibrio = la disponibilidad del seco bajo la cual el húmedo sale más barato (supone la garantía del húmedo).
//  - Comprar: capital por hora (valor de compra × (1 − valor residual) ÷ vida contable) + costos propios. No incluye financiamiento ni cambios mayores. Chequeo: cuánto pagarías en seco durante todo el contrato, en veces el valor de compra.
// Nunca inventa un dato: lo que falta se lista en `faltan` y ese componente queda fuera del total (la fila se marca incompleta). Los valores que no puso el usuario pero tienen una sugerencia se listan en `sugeridos`.
// Las tarifas de arriendo, el consumo y la dotación NO los mide el sistema: los define el usuario (o se sugieren y se marcan como sugeridos).
var ARRIENDO_GENERAL_DEFECTO={diesel:300,operador:1600000,mecanico:1500000,diasMes:30.4,meses:48,dispHumedo:0.875,dispSeco:0.875,horasCarga:12,residual:0};
// Sugerencias por modelo (tabla de tarifas estimada para contrato a 4 años y capacidad de estanque de listados de concesionarios): son un punto de partida, no un dato medido.
function arriendoDefectoModelo(modelo){
  var m=String(modelo||'').toUpperCase();
  if(/HD[- ]?785/.test(m))return{litrosCarga:1308,secaMin:3.2,secaMax:4.0,humMin:8.0,humMax:10.0,fuente:'HD785-7: estanque de listado de concesionario; tarifas de la propuesta (estimación sin fuente)'};
  if(/WA ?900/.test(m))return{litrosCarga:1555,secaMin:4.2,secaMax:5.0,humMin:9.5,humMax:11.5,fuente:'WA900-8R: estanque de listado de concesionario; tarifas de la propuesta (estimación sin fuente)'};
  if(/D ?375A/.test(m))return{litrosCarga:1050,secaMin:4.5,secaMax:5.2,humMin:10.0,humMax:12.0,fuente:'D375A-6: estanque de listado de concesionario; tarifas de la propuesta (estimación sin fuente)'};
  return null;
}
function _arrNum(v){var n=Number(v);return v!==null&&v!==undefined&&v!==''&&isFinite(n)?n:null;}
// grupos: [{clave,nombre,nEquipos,horasDia,valorCompra,vidaContableH,repuestosPorHora,neumaticosPorHora}] (null = el sistema no tiene el dato) · sup: {uf, ...general, modelos:{clave:{operadores,mecanicos,litrosCarga,secaMin,secaMax,humMin,humMax}}}
function arriendoVsCompra(grupos,sup){
  var s=sup||{},uf=_arrNum(s.uf);
  if(!(uf>0))return{ok:false,motivo:'falta el valor de la UF (en pesos) para convertir a UF por hora',filas:[]};
  var gen={},sugGen=[];
  Object.keys(ARRIENDO_GENERAL_DEFECTO).forEach(function(k){var v=_arrNum(s[k]);if(v==null){v=ARRIENDO_GENERAL_DEFECTO[k];sugGen.push(k);}gen[k]=v;});
  var filas=(grupos||[]).map(function(g){
    var u=(s.modelos&&s.modelos[g.clave])||{},def=arriendoDefectoModelo(g.nombre),faltan=[],sug=[];
    var tomar=function(campo,calc){var v=_arrNum(u[campo]);if(v!=null)return v;var d=calc!=null?calc:(def&&def[campo]!=null?def[campo]:null);if(d!=null)sug.push(campo);return d;};
    var hd=_arrNum(g.horasDia),hm=hd>0?hd*gen.diasMes:null;
    var dotDef=hd>0?2*Math.ceil(hd/12):null;
    var operadores=tomar('operadores',dotDef),mecanicos=tomar('mecanicos',dotDef),litros=tomar('litrosCarga'),
      secaMin=tomar('secaMin'),secaMax=tomar('secaMax'),humMin=tomar('humMin'),humMax=tomar('humMax');
    if(!(hm>0))faltan.push('horas de operación por día');
    var c={operador:null,mecanico:null,combustible:null,neumaticos:null,repuestos:null};
    if(hm>0&&operadores!=null)c.operador=operadores*gen.operador/hm;else if(hm>0)faltan.push('operadores por equipo');
    if(hm>0&&mecanicos!=null)c.mecanico=mecanicos*gen.mecanico/hm;else if(hm>0)faltan.push('mecánicos por equipo');
    if(litros!=null&&gen.horasCarga>0)c.combustible=litros/gen.horasCarga*gen.diesel;else faltan.push('litros por carga');
    var rep=_arrNum(g.repuestosPorHora),neu=_arrNum(g.neumaticosPorHora);
    if(rep!=null)c.repuestos=rep;else faltan.push('repuestos y servicios (se necesitan 90 días de compras con horas de operación)');
    c.neumaticos=neu!=null?neu:0;   // sin neumáticos registrados (por ejemplo un bulldozer de orugas) cuenta 0
    var propiosCLP=0;Object.keys(c).forEach(function(k){if(c[k]!=null)propiosCLP+=c[k];});
    var propiosUF=propiosCLP/uf;
    var r={clave:g.clave,nombre:g.nombre,nEquipos:g.nEquipos,horasMes:hm,horasContrato:hm>0?hm*gen.meses:null,costosCLP:c,propiosCLP:propiosCLP,propiosUF:propiosUF,
      seco:null,humedo:null,diferencia:null,productivo:null,equilibrio:null,compra:null,chequeo:null,faltan:faltan,sugeridos:sug,fuenteSugerida:def?def.fuente:null,
      entradas:{operadores:operadores,mecanicos:mecanicos,litrosCarga:litros,secaMin:secaMin,secaMax:secaMax,humMin:humMin,humMax:humMax}};
    var tarSeco=secaMin!=null&&secaMax!=null,tarHum=humMin!=null&&humMax!=null;
    if(tarSeco)r.seco={min:secaMin+propiosUF,max:secaMax+propiosUF,medio:(secaMin+secaMax)/2+propiosUF};else faltan.push('tarifa seca (mínima y máxima)');
    if(tarHum)r.humedo={min:humMin,max:humMax,medio:(humMin+humMax)/2};else faltan.push('tarifa húmeda (mínima y máxima)');
    if(r.seco&&r.humedo){
      r.diferencia={min:r.humedo.min-r.seco.max,max:r.humedo.max-r.seco.min,medio:r.humedo.medio-r.seco.medio};
      r.diferencia.medioCLP=r.diferencia.medio*uf;
      if(gen.dispSeco>0&&gen.dispHumedo>0){
        r.productivo={seco:r.seco.medio/gen.dispSeco,humedo:r.humedo.medio/gen.dispHumedo};
        r.productivo.ahorroPct=1-r.productivo.seco/r.productivo.humedo;
        r.equilibrio=r.seco.medio/r.productivo.humedo;
      }
    }
    var vc=_arrNum(g.valorCompra),vida=_arrNum(g.vidaContableH);
    if(vc>0&&vida>0){var cap=vc*(1-gen.residual)/vida/uf;r.compra={capitalUF:cap,totalUF:cap+propiosUF};}else faltan.push('valor de compra y vida contable');
    if(vc>0&&tarSeco&&r.horasContrato>0){var pago=(secaMin+secaMax)/2*r.horasContrato*uf;r.chequeo={pagoSeco:pago,valorCompra:vc,veces:pago/vc};}
    r.completo=faltan.length===0;
    return r;
  });
  return{ok:true,uf:uf,general:gen,generalSugerido:sugGen,filas:filas};
}

// ═══ M4 (ABC × VED) Y M6 (PRIORIDAD DE OT) QUE USAN LA CRITICIDAD DE EQUIPOS (2026-10-13) ═══
// Banda 1-5 de un equipo para decisiones de otros módulos: el PEOR CASO entre el nivel calculado (M2: Alta 5, Media 3, Baja 1) y la etiqueta manual (Crítico 5, Esencial 3, General 1), igual que ya hace la criticidad de
// repuestos ("nunca se minimiza una señal real con la otra"): la etiqueta puede contener juicio que los datos no miden (seguridad, rol en la producción). Devuelve {banda, fuente: 'calculada'|'manual'|'ambas'} o null sin ninguna de las dos.
function bandaCriticidadEquipo(nivelCalc,criticidadManual){
  var bc=nivelCalc==='Alta'?5:nivelCalc==='Media'?3:nivelCalc==='Baja'?1:null,bm=criticidadEquipoABanda(criticidadManual);
  if(bc==null&&bm==null)return null;
  var b=Math.max(bc||0,bm||0);
  return{banda:b,fuente:bc==null?'manual':bm==null?'calculada':bc===bm?'ambas':bc>bm?'calculada':'manual'};
}
// El campo "equipoModelo" de los repuestos es texto libre ("HD785-7/WA900/D375", "BD-10139 Bulldozer", "AROCS", "Cargador Frontal", y a veces una marca de filtro como "Fleetguard"). Se separa en palabras y cada una se busca en el
// modelo, la sigla o el tipo del equipo (como palabra completa), sin distinguir mayúsculas ni símbolos. Una palabra de menos de 3 caracteres o genérica ("filtro", "aceite") no cuenta. Si nada calza, el repuesto queda "sin equipo asociado": no se inventa.
var _VED_PALABRAS_GENERICAS={filtro:1,filtros:1,aceite:1,repuesto:1,repuestos:1,para:1,del:1,equipo:1,equipos:1,generico:1};
function _normTxt(s){return String(s==null?'':s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,'');}
function equiposDeRepuesto(equipoModelo,equipos){
  var palabras=String(equipoModelo||'').split(/[\/,;\s]+/).map(_normTxt).filter(function(w){return w.length>=3&&!_VED_PALABRAS_GENERICAS[w];});
  if(!palabras.length)return[];
  var lista=(equipos||[]).filter(function(e){return e&&e.sigla;});
  // Si el texto nombra una sigla concreta ("BD-10139 Bulldozer"), manda esa: no se extiende a todos los equipos del mismo tipo.
  var porSigla=lista.filter(function(e){return palabras.indexOf(_normTxt(e.sigla))>=0;});
  if(porSigla.length)return porSigla.map(function(e){return e.sigla;});
  return lista.filter(function(e){
    var mod=_normTxt(e.modelo),tipoW=String(e.tipo||'').split(/\s+/).map(_normTxt);
    return palabras.some(function(w){return(mod&&mod.indexOf(w)>=0)||tipoW.indexOf(w)>=0;});
  }).map(function(e){return e.sigla;});
}
// ABC × VED: ABC (gasto anual, de ABC-XYZ) cruzado con VED = Vital / Esencial / Deseable, según la criticidad del equipo MÁS crítico que usa el repuesto (banda 5 = Vital, 3-4 = Esencial, 1-2 = Deseable).
// Categoría de control (matriz clásica): I = AV, AE, BV (control estricto) · II = AD, BE, CV (moderado) · III = BD, CE, CD (simple). El VED también fija el nivel de servicio del stock de seguridad (Vital 99 %, Esencial 95 %, Deseable 90 %: los niveles que admite el cálculo de stock de seguridad).
var VED_NIVEL_SERVICIO={V:0.99,E:0.95,D:0.90};
var VED_ETIQUETA={V:'Vital',E:'Esencial',D:'Deseable'};
var ABCVED_CATEGORIA={AV:'I',AE:'I',BV:'I',AD:'II',BE:'II',CV:'II',BD:'III',CE:'III',CD:'III'};
var ABCVED_POLITICA={
  I:'Control estricto: stock de seguridad alto, revisión frecuente, proveedor alterno si se puede.',
  II:'Control moderado: punto de reorden con revisión periódica.',
  III:'Control simple: pedido por lote económico, sin stock de seguridad extra.'};
function vedDeBanda(b){return b==null?null:b>=5?'V':b>=3?'E':'D';}
// items: [{nParte, claseABC, equipoModelo}] · equipos: [{sigla,modelo,tipo}] · bandaPorSigla: {sigla: banda 1-5}
function vedRepuestos(items,equipos,bandaPorSigla){
  return(items||[]).map(function(it){
    var sig=equiposDeRepuesto(it.equipoModelo,equipos),bandas=sig.map(function(x){return bandaPorSigla&&bandaPorSigla[x];}).filter(function(b){return b!=null;});
    var banda=bandas.length?Math.max.apply(null,bandas):null,ved=vedDeBanda(banda);
    return Object.assign({},it,{equiposAsociados:sig,banda:banda,ved:ved,categoria:ved&&it.claseABC?ABCVED_CATEGORIA[it.claseABC+ved]||null:null,nivelServicio:ved?VED_NIVEL_SERVICIO[ved]:null});
  });
}
function matrizABCVED(itemsConVed){
  var celdas={A:{V:[],E:[],D:[]},B:{V:[],E:[],D:[]},C:{V:[],E:[],D:[]}},sinDato=[],resumen={I:0,II:0,III:0,sinDato:0};
  (itemsConVed||[]).forEach(function(it){
    if(!it.ved||!celdas[it.claseABC]){sinDato.push(it);resumen.sinDato++;return;}
    celdas[it.claseABC][it.ved].push(it);resumen[it.categoria]++;
  });
  return{celdas:celdas,sinDato:sinDato,resumen:resumen};
}
// M6 — prioridad de una OT pendiente = Urgencia × Impacto (1-5 cada una, 1-25 en total). Impacto: banda de criticidad del equipo (arriba); sin ninguna criticidad se usa 3 (neutro) y se avisa; un equipo fuera de servicio ahora cuenta como
// mínimo 4. Urgencia: días pendiente (hasta 1 día = 1, hasta 3 = 2, hasta 7 = 3, hasta 14 = 4, más = 5); un PM vencido cuenta como mínimo 3 y un equipo fuera de servicio como mínimo 4. Niveles: ≥15 P1 resolver hoy, 8-14 P2 esta semana, 4-7 P3 programar, <4 P4 puede esperar.
// items: [{sigla, dias, origen, fueraDeServicio}] · bandaPorSigla: {sigla: {banda, fuente}}
function urgenciaPorDias(d){return d<=1?1:d<=3?2:d<=7?3:d<=14?4:5;}
function prioridadOT(items,bandaPorSigla){
  return(items||[]).map(function(it){
    var b=bandaPorSigla&&bandaPorSigla[it.sigla],imp=b?b.banda:3,fuente=b?b.fuente:'sin criticidad (se usa 3, neutro)';
    if(it.fueraDeServicio&&imp<4){imp=4;fuente='equipo fuera de servicio';}
    var urg=urgenciaPorDias(Math.max(0,Number(it.dias)||0));
    if(it.origen==='Preventivo'&&urg<3)urg=3;
    if(it.fueraDeServicio&&urg<4)urg=4;
    var pt=urg*imp,nivel=pt>=15?'P1':pt>=8?'P2':pt>=4?'P3':'P4';
    return Object.assign({},it,{impacto:imp,impactoFuente:fuente,urgencia:urg,puntaje:pt,nivel:nivel,accion:nivel==='P1'?'Resolver hoy':nivel==='P2'?'Esta semana':nivel==='P3'?'Programar':'Puede esperar'});
  }).sort(function(a,b){return b.puntaje-a.puntaje||(b.dias||0)-(a.dias||0);});
}

// ═══ CRITICIDAD DE EQUIPOS MULTICRITERIO — matriz M2 (2026-10-13) ═══
// Hasta hoy la criticidad de un equipo era una etiqueta manual de 3 niveles (Crítico / Esencial / General). Esta matriz la calcula con datos y la compara con esa etiqueta, sin reemplazarla: Criticidad = Frecuencia × Consecuencia, cada una
// en una escala de 1 a 5, 5×5 como la matriz de riesgo. Escalas RELATIVAS a la propia flota (percentil, igual que las medianas del Jack-Knife), no umbrales fijos.
//  - Frecuencia: fallas por 1.000 h de operación en los últimos 12 meses (horas del horómetro; si no hay lecturas suficientes, las horas/día declaradas). Cero fallas = 1.
//  - Consecuencia: promedio ponderado de hasta tres criterios con su puntaje 1-5: duración típica de la reparación (mediana de sus reparaciones, 35 %), valor de la hora detenida del modelo (Configuración, 35 %) e importancia operacional (la etiqueta manual, 30 %).
//    Un criterio sin variación en la flota (por ejemplo todos los modelos con el mismo costo de hora detenida) no discrimina y se excluye, y los pesos se reparten entre los que quedan. Hacen falta al menos 2 criterios por equipo.
//  - Nivel: Frecuencia × Consecuencia ≥ 15 = Alta, 8 a 14 = Media, menos de 8 = Baja.
// Lo que NO mide: seguridad y ambiente (no hay datos registrados) ni producción por tipo de equipo (solo el costo de hora detenida del modelo la representa). Un equipo sin horas de operación confiables o sin criterios suficientes se excluye con su motivo.
// equipos: [{sigla,tipo,modelo,criticidad,hrsDia,unidad}] · d: {eventos [{sigla,fecha,durH}], hist, hoy, costoHoraDe: function(modelo)} · o: {desde,hasta}
var CRIT_PESOS={mttr:0.35,costoHora:0.35,importancia:0.30};
var CRIT_IMPORTANCIA={'Crítico':3,'Critico':3,'Esencial':2,'General':1};
var CRIT_NIVEL_MANUAL={'Crítico':'Alta','Critico':'Alta','Esencial':'Media','General':'Baja'};
function _critMediana(a){var v=a.slice().sort(function(x,y){return x-y;}),m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2;}   // mediana: un registro viejo sin cerrar (por ejemplo 300 h) no debe definir la consecuencia de un equipo
function _critPuntaje(valor,todos){var n=todos.length,m=0;for(var i=0;i<n;i++)if(todos[i]<valor)m++;return Math.min(5,1+Math.floor(5*m/n));}
function criticidadEquiposMulticriterio(equipos,d,o){
  var op=o||{},hoy=_tcoIso(d.hoy),hasta=op.hasta||hoy,desde=op.desde||_fechaMas(hasta,-365),dias=Math.max(1,_tcoDias(desde,hasta)),base=[],excl=[];
  (equipos||[]).forEach(function(e){
    if(!e||!e.sigla||e.unidad==='km')return;
    var lec=C.lecturasValidas(d.hist||[],e.sigla).filter(function(r){return r.fecha>=desde&&r.fecha<=hasta;}),val=function(r){return r.horomFin!=null?r.horomFin:r.horom;};
    var horas=null,origen='';
    if(lec.length>=2){var a=lec[0],b=lec[lec.length-1],dd=_tcoDias(a.fecha,b.fecha),hh=val(b)-val(a);if(dd>=60&&hh>=0&&hh/dd<=24){horas=hh/dd*dias;origen='horómetro';}}
    if(horas==null&&e.hrsDia>=1&&e.hrsDia<=24){horas=e.hrsDia*dias;origen='horas/día declaradas';}
    if(!(horas>=100)){excl.push({sigla:e.sigla,motivo:'sin horas de operación confiables en los últimos 12 meses'});return;}
    var ev=(d.eventos||[]).filter(function(x){return x.sigla===e.sigla&&x.fecha>=desde&&x.fecha<=hasta;});
    var dur=ev.map(function(x){return x.durH;}).filter(function(x){return typeof x==='number'&&x>=0;});
    var ch=typeof d.costoHoraDe==='function'?Number(d.costoHoraDe(e.modelo))||null:null;
    base.push({sigla:e.sigla,tipo:e.tipo||'',modelo:e.modelo||'',fallas:ev.length,horas:Math.round(horas),horasOrigen:origen,fallas1000:ev.length/horas*1000,
      mttr:dur.length?_critMediana(dur):null,nDur:dur.length,costoHora:ch,importancia:CRIT_IMPORTANCIA[e.criticidad]||null,criticidadManual:e.criticidad||null});
  });
  if(base.length<5)return{ok:false,motivo:'hay '+base.length+' equipos con datos y se necesitan al menos 5 para que la escala relativa tenga sentido',filas:[],excluidos:excl};
  var claves=['mttr','costoHora','importancia'],usados=[],sinVar=[],pk={};
  claves.forEach(function(k){
    var vs=base.map(function(f){return f[k];}).filter(function(v){return v!=null;});
    if(vs.length<3)return;
    var mn=Math.min.apply(null,vs),mx=Math.max.apply(null,vs);
    if(mn===mx){sinVar.push(k);return;}
    usados.push(k);pk[k]=vs;
  });
  var todosF=base.map(function(f){return f.fallas1000;});
  var filas=[];
  base.forEach(function(f){
    var F=_critPuntaje(f.fallas1000,todosF),sw=0,sc=0,punt={};
    usados.forEach(function(k){if(f[k]!=null){punt[k]=_critPuntaje(f[k],pk[k]);sc+=CRIT_PESOS[k]*punt[k];sw+=CRIT_PESOS[k];}});
    if(Object.keys(punt).length<2){excl.push({sigla:f.sigla,motivo:'menos de 2 criterios de consecuencia con dato (duración de reparación, costo de hora detenida, importancia)'});return;}
    var Cc=Math.round(sc/sw*10)/10,pt=Math.round(F*Cc*10)/10,nivel=pt>=15?'Alta':pt>=8?'Media':'Baja',man=CRIT_NIVEL_MANUAL[f.criticidadManual]||null;
    var ord={Baja:1,Media:2,Alta:3},comp=man?(ord[nivel]>ord[man]?'mas_alta':ord[nivel]<ord[man]?'mas_baja':'coincide'):'sin_etiqueta';
    filas.push({sigla:f.sigla,tipo:f.tipo,modelo:f.modelo,fallas:f.fallas,horas:f.horas,horasOrigen:f.horasOrigen,fallas1000:f.fallas1000,mttr:f.mttr,nDur:f.nDur,costoHora:f.costoHora,importancia:f.importancia,
      puntajes:punt,F:F,C:Cc,puntaje:pt,nivel:nivel,criticidadManual:f.criticidadManual,nivelManual:man,comparacion:comp});
  });
  filas.sort(function(x,y){return y.puntaje-x.puntaje||y.fallas1000-x.fallas1000;});
  var matriz=[];for(var i=0;i<5;i++){matriz.push([]);for(var j=0;j<5;j++)matriz[i].push([]);}
  filas.forEach(function(f){matriz[f.F-1][Math.min(5,Math.max(1,Math.round(f.C)))-1].push(f.sigla);});   // matriz[F-1][C-1]
  var resumen={Alta:0,Media:0,Baja:0},disc={mas_alta:0,mas_baja:0,coincide:0,sin_etiqueta:0};
  filas.forEach(function(f){resumen[f.nivel]++;disc[f.comparacion]++;});
  var sw=usados.reduce(function(a,k){return a+CRIT_PESOS[k];},0),pesos={};usados.forEach(function(k){pesos[k]=Math.round(CRIT_PESOS[k]/sw*100);});
  return{ok:filas.length>=5,motivo:filas.length>=5?null:'quedaron menos de 5 equipos con criterios suficientes',ventana:{desde:desde,hasta:hasta,dias:dias},filas:filas,excluidos:excl,criteriosUsados:usados,criteriosSinVariacion:sinVar,pesos:pesos,matriz:matriz,resumen:resumen,comparacion:disc};
}

// ═══ POTENCIA DE LAS PRUEBAS: AVISO DE MUESTRA CHICA (2026-10-13) ═══
// Un resultado "no significativo" no prueba que no haya diferencia: con pocos datos la prueba solo detecta diferencias muy grandes (poca potencia, error tipo II). Con α=5 % (dos colas) y potencia 80 %, la diferencia
// mínima detectable entre dos grupos de n datos cada uno es d = (1,96 + 0,84)·√(2/n) desviaciones típicas (aproximación normal); para la comparación de curvas de supervivencia (Log-Rank), con d1 y d2 fallas por grupo,
// el cociente de riesgos mínimo detectable es exp((1,96 + 0,84)·√(1/d1 + 1/d2)) (Schoenfeld). Son aproximaciones orientativas: el aviso solo se muestra cuando el resultado NO es significativo y lo detectable es "grande".
var _POT_Z=1.959964+0.841621;
function efectoMinimoDetectable(nPorGrupo){return nPorGrupo>=2?_POT_Z*Math.sqrt(2/nPorGrupo):null;}
function hrMinimoDetectable(fallasA,fallasB){return fallasA>0&&fallasB>0?Math.exp(_POT_Z*Math.sqrt(1/fallasA+1/fallasB)):null;}
// significativo: resultado de la prueba · nMin: datos del grupo más chico · devuelve null si no corresponde avisar
function avisoMuestraChica(significativo,nMin){
  if(significativo||!(nMin>=2))return null;
  var d=efectoMinimoDetectable(nMin);
  return d>=0.8?{tipo:'efecto',n:nMin,d:Math.round(d*100)/100}:null;
}
function avisoMuestraChicaSupervivencia(significativo,fallasA,fallasB){
  if(significativo)return null;
  var hr=hrMinimoDetectable(fallasA,fallasB);
  return hr!=null&&hr>=2?{tipo:'hr',fallasMin:Math.min(fallasA,fallasB),hr:Math.round(hr*10)/10}:null;
}

// ═══ PROGRAMA DE CAMBIO DE NEUMÁTICOS PROYECTADO (2026-10-12) ═══
// No existía un programa de cambios por semana / mes / semestre / año ni una curva S. La fecha de cambio de cada neumático ya la calcula neuProyeccion (regresión de desgaste sobre sus mediciones, o límite de
// horas en delanteros); acá solo se AGRUPA por período, sin re-estimar nada. Punto delicado: esa proyección cuenta los días "desde ahora", pero las horas que le quedan son las de la ÚLTIMA MEDICIÓN; si
// la medición tiene 2 meses, la fecha real de cambio es 2 meses antes. Por eso la fecha se ancla en la fecha de la última medición (base) y los que ya pasaron su fecha se informan aparte como "vencidos".
// items: [{sigla, posicion, serie, base (ISO de la última medición, o null), dias (días restantes contados desde esa base), precio, motivo, confianza}] · reales: fechas ISO de cambios ya hechos
// o: {hoy, periodo: 'semana'|'mes'|'semestre'|'anio', ref (fecha dentro del período)}.
// Curva S = avance real (cambios hechos en el período, hasta hoy) + proyección (vencidos a cambiar ya + los que vencen de hoy a fin del período). No hay un plan congelado contra el cual medir cumplimiento: la
// proyección se recalcula con cada medición y un neumático ya cambiado sale del programa; por eso la curva muestra avance + lo que falta, no un porcentaje de cumplimiento.
function neuProgramaCambios(items,reales,o){
  var op=o||{},hoy=_tcoIso(op.hoy),tipo=op.periodo||'mes',rg=periodoRango(tipo,op.ref||hoy),desde=rg.desde,hasta=rg.hasta;
  var enr=(items||[]).filter(function(it){return it&&isFinite(it.dias);}).map(function(it){
    var base=it.base||hoy,dias=Math.max(0,Math.round(it.dias)),f=_fechaMas(base,dias),edad=it.base?Math.max(0,_tcoDias(it.base,hoy)):null;
    return{sigla:it.sigla,posicion:it.posicion,serie:it.serie,base:it.base||null,precio:Number(it.precio)||0,motivo:it.motivo||'',confianza:it.confianza||'',fechaCambio:f,vencido:f<hoy,diasMedicion:edad,medicionVieja:edad!=null&&edad>45};
  });
  var incluyeHoy=hoy>=desde&&hoy<=hasta,futuro=desde>hoy;
  var vencidos=enr.filter(function(x){return x.vencido;}).sort(function(a,b){return a.fechaCambio<b.fechaCambio?-1:1;});
  var arrastre=futuro?enr.filter(function(x){return x.fechaCambio<desde;}).length:0;
  var ini=incluyeHoy?hoy:desde,pend=hasta<hoy?[]:enr.filter(function(x){return x.fechaCambio>=ini&&x.fechaCambio<=hasta;}).sort(function(a,b){return a.fechaCambio<b.fechaCambio?-1:a.fechaCambio>b.fechaCambio?1:a.sigla<b.sigla?-1:1;});
  var rr=(reales||[]).filter(function(f){return f&&f>=desde&&f<=hasta&&f<=hoy;});
  var suma=function(a){return a.reduce(function(t,x){return t+x.precio;},0);};
  // sub-períodos (la tabla): semana→días, mes→semanas, semestre/año→meses
  var subs=[],corto=function(iso){return parseInt(iso.slice(8,10),10)+'-'+_PER_MESES[parseInt(iso.slice(5,7),10)-1];};
  var cur=desde;
  while(cur<=hasta){
    var sd,sh,et;
    if(tipo==='semana'){sd=cur;sh=cur;et=corto(cur);}
    else if(tipo==='mes'){var w=periodoRango('semana',cur);sd=w.desde<desde?desde:w.desde;sh=w.hasta>hasta?hasta:w.hasta;et=corto(sd)+' al '+corto(sh);}
    else{var m=periodoRango('mes',cur);sd=m.desde;sh=m.hasta;et=periodoEtiqueta('mes',m.desde,m.hasta);}
    var delPer=pend.filter(function(x){return x.fechaCambio>=sd&&x.fechaCambio<=sh;});
    subs.push({desde:sd,hasta:sh,etiqueta:et,proyectados:delPer.length,costo:suma(delPer),reales:sd<=hoy?rr.filter(function(f){return f>=sd&&f<=sh;}).length:null,actual:hoy>=sd&&hoy<=sh,items:delPer});
    cur=_fechaMas(sh,1);
  }
  // curva S diaria
  var n=_tcoDias(desde,hasta)+1,dias=[],realAc=null,vcnt=incluyeHoy?vencidos.length:0,i;
  for(i=0;i<n;i++){
    var f=_fechaMas(desde,i),r=f<=hoy?rr.filter(function(x){return x<=f;}).length:null;
    var py=null;
    if(f>=ini&&hasta>=hoy||futuro){var base0=incluyeHoy?rr.length+vcnt:0;py=base0+pend.filter(function(x){return x.fechaCambio<=f;}).length;}
    dias.push({fecha:f,real:r,proyeccion:py});
  }
  var totalProy=(incluyeHoy?rr.length+vcnt:futuro?0:rr.length)+pend.length;
  return{rango:{tipo:tipo,desde:desde,hasta:hasta,etiqueta:periodoEtiqueta(tipo,desde,hasta)},incluyeHoy:incluyeHoy,futuro:futuro,
    totales:{reales:rr.length,vencidos:vencidos.length,pendientes:pend.length,proyectadoTotal:totalProy,costoPendiente:suma(pend),costoVencidos:suma(vencidos),arrastre:arrastre},
    subperiodos:subs,vencidos:vencidos,pendientes:pend,curva:dias};
}
// Cambios ya hechos, de neuHist [{sigla,posicion,fecha}] (historial de neumáticos: cada fila es un retiro/cambio en un equipo y posición). La posición viene escrita de muchas formas ("1", "Posicion 1", "Posición 1", "Pos. 1"):
// se compara por su número. Cargas repetidas del mismo equipo + posición + fecha cuentan una vez; las filas sin posición no se pueden deduplicar y cuentan cada una.
function neuCambiosRealizados(neuHist){
  var vistos={},out=[];
  (neuHist||[]).forEach(function(r){
    if(!r||!r.sigla||!r.fecha)return;
    var f=String(r.fecha).slice(0,10),m=String(r.posicion==null?'':r.posicion).match(/(\d+)/);
    if(m){var k=r.sigla+'|'+parseInt(m[1],10)+'|'+f;if(vistos[k])return;vistos[k]=1;}
    out.push(f);
  });
  return out.sort();
}

// ═══ ANÁLISIS DE COMPONENTES PRINCIPALES (PCA) DE LA FLOTA (2026-10-11) ═══
// PCA resume varios indicadores correlacionados de cada equipo (fallas por 1.000 h, horas por reparación, % de días fuera de servicio, uso diario, horómetro) en 2 o 3 ejes y permite ver qué
// equipos se alejan del grupo. Pasos: estandarizar cada variable (media 0, desviación 1: así ninguna manda por su unidad), matriz de correlación, valores y vectores propios (Jacobi), puntajes = datos
// estandarizados × vectores. IMPORTANTE para no engañarse: con pocos equipos los ejes son inestables (se mide con "dejar uno afuera"), si se mezclan tipos de equipo el primer eje solo separa los tipos, y un
// equipo "atípico" muchas veces es un dato malo (por eso se descartan antes los horómetros imposibles). Solo con filas completas; se pide n ≥ 8 y al menos 3 variables con variación.
function _eigenSimetrica(A){
  var n=A.length,a=A.map(function(r){return r.slice();}),V=[];
  for(var i=0;i<n;i++){V.push([]);for(var j=0;j<n;j++)V[i].push(i===j?1:0);}
  for(var sw=0;sw<100;sw++){
    var p=0,q=1,mx=0;
    for(i=0;i<n;i++)for(j=i+1;j<n;j++)if(Math.abs(a[i][j])>mx){mx=Math.abs(a[i][j]);p=i;q=j;}
    if(mx<1e-13)break;
    var th=(a[q][q]-a[p][p])/(2*a[p][q]),t=(th>=0?1:-1)/(Math.abs(th)+Math.sqrt(th*th+1)),c=1/Math.sqrt(t*t+1),s=t*c;
    for(var k=0;k<n;k++){var akp=a[k][p],akq=a[k][q];a[k][p]=c*akp-s*akq;a[k][q]=s*akp+c*akq;}
    for(k=0;k<n;k++){var apk=a[p][k],aqk=a[q][k];a[p][k]=c*apk-s*aqk;a[q][k]=s*apk+c*aqk;}
    for(k=0;k<n;k++){var vkp=V[k][p],vkq=V[k][q];V[k][p]=c*vkp-s*vkq;V[k][q]=s*vkp+c*vkq;}
  }
  var vals=a.map(function(r,i){return r[i];}),ord=vals.map(function(v,i){return i;}).sort(function(x,y){return vals[y]-vals[x];});
  return{valores:ord.map(function(i){return Math.max(0,vals[i]);}),vectores:ord.map(function(i){return V.map(function(r){return r[i];});})};   // vectores[k] = k-ésimo vector propio
}
var _PCA_CHI2_95={1:3.841,2:5.991,3:7.815,4:9.488,5:11.07};
// X: filas (equipos) × columnas (variables), con null donde falta el dato · nombres: de las variables · o: {minFilas (8), minVars (3)}
function pcaAnalisis(X,nombres,o){
  var op=o||{},minF=op.minFilas>0?op.minFilas:8,minV=op.minVars>0?op.minVars:3;
  var idx=[],excl=[];
  (X||[]).forEach(function(r,i){if(r&&r.length&&r.every(function(v){return typeof v==='number'&&isFinite(v);}))idx.push(i);else excl.push(i);});
  var p0=(nombres||[]).length,n=idx.length;
  if(n<minF||p0<minV)return{ok:false,motivo:n<minF?'hay '+n+' equipos con todos los datos y se necesitan al menos '+minF:'se necesitan al menos '+minV+' variables',filas:idx,excluidas:excl};
  var media=[],sd=[],constantes=[],cols=[];
  for(var j=0;j<p0;j++){
    var m=0;idx.forEach(function(i){m+=X[i][j];});m/=n;
    var v=0;idx.forEach(function(i){v+=(X[i][j]-m)*(X[i][j]-m);});v=Math.sqrt(v/(n-1));
    if(v>1e-12){cols.push(j);media.push(m);sd.push(v);}else constantes.push(nombres[j]);
  }
  var p=cols.length;
  if(p<minV)return{ok:false,motivo:'solo '+p+' variables con variación (se necesitan '+minV+')',filas:idx,excluidas:excl,constantes:constantes};
  var Z=idx.map(function(i){return cols.map(function(j,k){return(X[i][j]-media[k])/sd[k];});});
  var R=[];for(var a=0;a<p;a++){R.push([]);for(var b=0;b<p;b++){var s=0;for(var r=0;r<n;r++)s+=Z[r][a]*Z[r][b];R[a].push(s/(n-1));}}
  var E=_eigenSimetrica(R);
  // signo determinista: la suma de las cargas de cada componente es positiva
  E.vectores.forEach(function(vec){var sm=vec.reduce(function(x,y){return x+y;},0);if(sm<0)for(var k=0;k<vec.length;k++)vec[k]=-vec[k];});
  var tot=E.valores.reduce(function(x,y){return x+y;},0),acum=0;
  var varianza=E.valores.map(function(l){acum+=l/tot;return{valor:l,pct:l/tot,acumulado:acum};});
  var nombresV=cols.map(function(j){return nombres[j];});
  var cargas=E.vectores.map(function(vec,k){return vec.map(function(x){return x*Math.sqrt(E.valores[k]);});});   // cargas[k][j] = correlación de la variable j con el componente k
  var puntajes=Z.map(function(z){return E.vectores.map(function(vec){var s=0;for(var k=0;k<p;k++)s+=z[k]*vec[k];return s;});});
  var nRet=Math.max(1,Math.min(5,E.valores.filter(function(l){return l>1;}).length));      // criterio de Kaiser (autovalor > 1), máximo 5
  var chi=_PCA_CHI2_95[Math.min(nRet,5)];
  var t2=puntajes.map(function(sc){var t=0;for(var k=0;k<nRet;k++)t+=sc[k]*sc[k]/Math.max(E.valores[k],1e-12);return t;});
  // estabilidad: ¿el primer eje cambia si se deja un equipo afuera? (coseno mínimo entre el PC1 completo y el de cada subconjunto)
  var cosMin=1,peor=-1;
  for(var d=0;d<n;d++){
    var Zs=Z.filter(function(_,i){return i!==d;}),ms=[],ss=[];
    for(var jj=0;jj<p;jj++){var mm=0;Zs.forEach(function(z){mm+=z[jj];});mm/=n-1;var vv=0;Zs.forEach(function(z){vv+=(z[jj]-mm)*(z[jj]-mm);});ms.push(mm);ss.push(Math.sqrt(vv/(n-2))||1);}
    var Rs=[];for(var a2=0;a2<p;a2++){Rs.push([]);for(var b2=0;b2<p;b2++){var s2=0;Zs.forEach(function(z){s2+=(z[a2]-ms[a2])*(z[b2]-ms[b2]);});Rs[a2].push(s2/(n-2)/(ss[a2]*ss[b2]));}}
    var v1=_eigenSimetrica(Rs).vectores[0],dot=0;for(var k2=0;k2<p;k2++)dot+=v1[k2]*E.vectores[0][k2];
    if(Math.abs(dot)<cosMin){cosMin=Math.abs(dot);peor=idx[d];}
  }
  // qué variable explica más el alejamiento de cada equipo (mayor |z|)
  var porFila=idx.map(function(i,r){var mj=0;for(var k=1;k<p;k++)if(Math.abs(Z[r][k])>Math.abs(Z[r][mj]))mj=k;return{fila:i,puntajes:puntajes[r],t2:t2[r],lejos:t2[r]>chi,variableMayor:nombresV[mj],zMayor:Z[r][mj],z:Z[r]};});
  return{ok:true,n:n,p:p,filas:idx,excluidas:excl,constantes:constantes,variables:nombresV,media:media,sd:sd,varianza:varianza,cargas:cargas,vectores:E.vectores,nRetenidos:nRet,umbralT2:chi,
    equipos:porFila,estabilidadPC1:{cosenoMinimo:cosMin,equipoQueMasLoMueve:peor,estable:cosMin>=0.95}};
}
// Variables por equipo para el PCA. d: {equipos, eventos [{sigla,fecha,durH|null}], hist, reportab, hoy} · o: {desde, hasta}. Devuelve {filas:[{sigla,tipo,modelo,vars:{...}|null,motivo}], variables:[...]}.
// Un equipo queda fuera (con el motivo) si el horómetro es imposible (más de 24 h/día de uso), si hay menos de 60 días o 200 h de lectura, o si le faltan datos.
function pcaVariablesEquipos(d,o){
  var op=o||{},hoy=_tcoIso(d.hoy),hasta=op.hasta||hoy,desde=op.desde||_fechaMas(hasta,-365),out=[];
  var nombres=['Fallas por 1.000 h','Horas por reparación','% días fuera de servicio','Uso (h/día)','Horómetro (h)'];
  (d.equipos||[]).forEach(function(e){
    if(!e||!e.sigla||e.unidad==='km')return;
    var lec=C.lecturasValidas(d.hist||[],e.sigla).filter(function(r){return r.fecha>=desde&&r.fecha<=hasta;});
    var val=function(r){return r.horomFin!=null?r.horomFin:r.horom;};
    var fila={sigla:e.sigla,tipo:e.tipo||'',modelo:e.modelo||'',vars:null,motivo:''};
    if(lec.length<2){fila.motivo='sin lecturas de horómetro en el período';out.push(fila);return;}
    var a=lec[0],b=lec[lec.length-1],dias=_tcoDias(a.fecha,b.fecha),horas=val(b)-val(a);
    if(dias<60){fila.motivo='menos de 60 días de lecturas';out.push(fila);return;}
    var uso=horas/dias;
    if(uso>24||horas<0){fila.motivo='horómetro dudoso ('+Math.round(uso)+' h/día: una lectura mala en el historial)';out.push(fila);return;}
    if(horas<200){fila.motivo='menos de 200 h de uso en el período';out.push(fila);return;}
    var ev=(d.eventos||[]).filter(function(x){return x.sigla===e.sigla&&x.fecha>=a.fecha&&x.fecha<=b.fecha;});
    var dur=ev.map(function(x){return x.durH;}).filter(function(x){return typeof x==='number'&&x>=0;});
    var rep=(d.reportab||[]).filter(function(r){return r.sigla===e.sigla&&r.fecha>=desde&&r.fecha<=hasta;});
    if(dur.length<3){fila.motivo='menos de 3 reparaciones con duración registrada';out.push(fila);return;}
    if(rep.length<10){fila.motivo='menos de 10 días con reporte del cliente';out.push(fila);return;}
    fila.vars={fallas1000:ev.length/horas*1000,mttr:dur.reduce(function(x,y){return x+y;},0)/dur.length,fsPct:rep.filter(function(r){return r.estatus==='FS';}).length/rep.length*100,uso:uso,horom:Number(e.horomActual)||val(b)};
    out.push(fila);
  });
  return{filas:out,variables:nombres,claves:['fallas1000','mttr','fsPct','uso','horom']};
}
// Comparación con pares: z robusto (mediana y MAD; si MAD=0, desviación media absoluta) de cada variable dentro del grupo; |z| ≥ 2,5 = fuera de lo normal del grupo. Requiere ≥ 4 equipos con la variable.
function paresZRobusto(valores,claves){
  var med=function(a){var v=a.slice().sort(function(x,y){return x-y;}),m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2;};
  var out={};claves.forEach(function(k){
    var xs=valores.map(function(v){return v[k];}).filter(function(x){return typeof x==='number'&&isFinite(x);});
    if(xs.length<4){out[k]=null;return;}
    var m=med(xs),dev=xs.map(function(x){return Math.abs(x-m);}),mad=med(dev)*1.4826;
    if(!(mad>1e-12))mad=dev.reduce(function(a,b){return a+b;},0)/dev.length*1.2533;   // si más de la mitad coincide con la mediana (MAD=0), se usa la desviación media absoluta para no esconder al que se aleja
    out[k]={mediana:m,mad:mad,z:function(x){return mad>1e-12?(x-m)/mad:0;}};
  });
  return out;
}

// ═══ REPORTABILIDAD DIARIA DEL CLIENTE (2026-10-11) ═══
// El cliente (Centinela) pide cada día un reporte con el estatus de TODOS los equipos de la faena: OP (operativo) o FS (fuera de servicio) con detalle, fecha de detención, fecha de proyección de
// reparación, OC y observación. Es la fuente contractual de la disponibilidad. Se guarda una fila por equipo y día en `reportabilidad_diaria` (clave natural fecha+sigla): cargar de nuevo un día lo
// ACTUALIZA, no lo duplica, y se puede cargar cualquier fecha en cualquier orden (datos antiguos que aparezcan después). Hay dos formatos de Excel: (a) un archivo por día, columnas "Equipo, Marca - Modelo,
// Estatus (OP/FS), Ubicación, Detalle, Detencion, Dias F/S, Proyeccion, Orden de Compra, Observacion, Mantenedor" con la sigla del programa; y (b) un libro con una hoja por día (nombre dd-mm), columnas "Sigla,
// [Sigla CEN], Marca - Modelo, Estatus (1=FS, 2=OP), Ubicación, Detalle, Fecha Detencion, Dias F/S, Fecha Proyección, Orden de Compra, Observación" con la sigla del cliente (CE-85) y, desde octubre, la del programa.
// Las funciones son puras: reciben las hojas ya leídas como arreglos de filas (el lector de Excel está en la pantalla). Fechas: Date, número serial de Excel o texto dd-mm-aaaa / aaaa-mm-dd.
var REPORTAB_MAPA_SIGLAS={'CE-85':'CN-9503','CE-86':'CN-9501','CE-87':'CN-9500','CE-88':'CN-9502','CE-89':'CN-9507','CE-155':'CN-10155','CE-159':'CN-10159','CE-160':'CN-10160','CF-769':'CF-8769','CF-510':'CF-9510',
  'CF-162':'CF-10162','BD-533':'BD-9533','BD-509':'BD-9509','BD-139':'BD-10139','MN-12':'MN-6112','MN-26':'MN-5926'};
function _repNorm(s){return String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function _repFechaISO(v){
  if(v==null||v==='')return null;
  if(v instanceof Date){if(isNaN(v))return null;return v.getFullYear()+'-'+('0'+(v.getMonth()+1)).slice(-2)+'-'+('0'+v.getDate()).slice(-2);}
  if(typeof v==='number'){if(!(v>20000&&v<80000))return null;return new Date(Math.round((v-25569)*86400000)).toISOString().slice(0,10);}
  var s=String(v).trim(),m;
  if((m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)))return m[1]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[3]).slice(-2);
  if((m=s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/))){var y=m[3].length===2?'20'+m[3]:m[3];return y+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[1]).slice(-2);}
  return null;
}
function _repEstatus(v){var s=String(v==null?'':v).trim().toUpperCase().replace(/[\/\.\s]/g,'');return(s==='FS'||s==='1')?'FS':(s==='OP'||s==='2')?'OP':'';}
// Fecha que dice el nombre (hoja "26-08", archivo "24-07-2026_Reportabilidad…"): {iso, conAnio}. `anio` completa los nombres sin año.
function reportabilidadFechaDeNombre(nombre,anio){
  var m=String(nombre||'').match(/(?:^|[^0-9])(\d{1,2})[-\/.](\d{1,2})(?:[-\/.](\d{4}|\d{2}))?(?![0-9])/);
  if(!m)return null;
  var d=parseInt(m[1],10),mo=parseInt(m[2],10);if(!(d>=1&&d<=31&&mo>=1&&mo<=12))return null;
  var y=m[3]?(m[3].length===2?2000+parseInt(m[3],10):parseInt(m[3],10)):anio;if(!y)return null;
  return{iso:y+'-'+('0'+mo).slice(-2)+'-'+('0'+d).slice(-2),conAnio:!!m[3]};
}
// Una hoja: {nombre, filas: arreglo de filas (arreglo de celdas)} · ctx: {anio, archivo, mapa}. Devuelve {formato, fecha, fechaCabecera, filas, avisos, sinEstatus} o null si no parece una hoja de reportabilidad.
function reportabilidadParsearHoja(hoja,ctx){
  var c=ctx||{},filas=hoja.filas||[],hi=-1,cols={};
  for(var i=0;i<Math.min(filas.length,10)&&hi<0;i++){
    var nr=(filas[i]||[]).map(_repNorm);
    if(nr.indexOf('sigla')>=0||nr.indexOf('equipo')>=0){hi=i;nr.forEach(function(x,j){if(x&&cols[x]===undefined)cols[x]=j;});}
  }
  if(hi<0)return null;
  var col=function(){for(var k=0;k<arguments.length;k++)if(cols[arguments[k]]!==undefined)return cols[arguments[k]];return -1;};
  var cSig=col('sigla','equipo'),cCen=col('sigla cen'),cMod=col('marca modelo'),cEst=col('estatus'),cUb=col('ubicacion'),cDet=col('detalle'),cFd=col('fecha detencion','detencion'),cPr=col('fecha proyeccion','proyeccion'),
    cOc=col('orden de compra'),cOb=col('observacion'),cMa=col('mantenedor');
  if(cSig<0||cEst<0)return null;
  var cabecera=null;for(var h=0;h<hi+1&&!cabecera;h++)(filas[h]||[]).forEach(function(x){if(!cabecera){var f=_repFechaISO(x);if(f&&/^20\d\d-/.test(f)&&(x instanceof Date||typeof x==='number'))cabecera=f;}});
  var anio=(cabecera?parseInt(cabecera.slice(0,4),10):null)||c.anio||null;
  var fn=reportabilidadFechaDeNombre(hoja.nombre,anio),fa=reportabilidadFechaDeNombre(c.archivo,anio);
  // el nombre manda (la celda de fecha del encabezado suele quedar sin actualizar al copiar la hoja); si la hoja no trae fecha en el nombre se usa la del archivo
  var fecha=(fn&&fn.iso)||(fa&&fa.iso)||cabecera;
  var avisos=[];
  if(!fecha)return{formato:cCen>=0?'libro':'diario',fecha:null,fechaCabecera:cabecera,filas:[],avisos:['no se pudo determinar la fecha de la hoja'],sinEstatus:0};
  if(cabecera&&cabecera!==fecha)avisos.push('la fecha de la cabecera ('+cabecera+') no coincide con la del nombre ('+fecha+'): se usó la del nombre');
  var mapa=c.mapa||{},out=[],sinEstatus=0,g=function(r,j){return j>=0?r[j]:null;};
  filas.slice(hi+1).forEach(function(r){
    if(!r)return;var sg=String(g(r,cSig)==null?'':g(r,cSig)).trim();
    if(!sg||/^total/i.test(sg)||/^\d+$/.test(sg))return;
    var est=_repEstatus(g(r,cEst));if(!est){sinEstatus++;return;}
    var cen=String(g(r,cCen)==null?'':g(r,cCen)).trim();
    var sigla=cen||mapa[sg]||REPORTAB_MAPA_SIGLAS[sg]||sg;
    var tx=function(j){var v=g(r,j);return v==null?'':String(v).replace(/\s+/g,' ').trim();};
    out.push({fecha:fecha,sigla:sigla,siglaCliente:sg!==sigla?sg:'',estatus:est,ubicacion:tx(cUb),detalle:est==='FS'?tx(cDet):'',fechaDetencion:est==='FS'?_repFechaISO(g(r,cFd)):null,
      proyeccion:est==='FS'?_repFechaISO(g(r,cPr)):null,ordenCompra:tx(cOc),observacion:tx(cOb),mantenedor:tx(cMa),modelo:tx(cMod)});
  });
  return{formato:cCen>=0||cols['fecha detencion']!==undefined?'libro':'diario',fecha:fecha,fechaCabecera:cabecera,filas:out,avisos:avisos,sinEstatus:sinEstatus};
}
// Varias hojas (de uno o más archivos): [{nombre, archivo, filas}] · o: {anio, siglasPrograma:[], siglasRetiradas:[], excluir:[]}.
// Une todo en filas únicas por fecha+sigla. Si dos hojas traen el mismo día gana la que tiene más equipos (el libro del cliente sobre un archivo parcial) y se informa el conflicto.
// Una hoja con la misma información que otra de otro día y con la fecha de cabecera distinta a la de su nombre es probablemente una copia sin actualizar: se descarta (`posibleCopia`).
function reportabilidadArmarLote(hojas,o){
  var op=o||{},mapa={},parsed=[],ignoradas=[],duplicadas=0;
  // aprender cruces sigla-cliente → sigla-programa de las hojas que traen ambas columnas
  (hojas||[]).forEach(function(h){
    var fl=h.filas||[];for(var i=0;i<Math.min(fl.length,10);i++){var nr=(fl[i]||[]).map(_repNorm),a=nr.indexOf('sigla'),b=nr.indexOf('sigla cen');
      if(a>=0&&b>=0){fl.slice(i+1).forEach(function(r){if(r&&r[a]&&r[b]){var k=String(r[a]).trim(),v=String(r[b]).trim();if(k&&v&&k!==v)mapa[k]=v;}});break;}}
  });
  (hojas||[]).forEach(function(h){
    var p=reportabilidadParsearHoja(h,{anio:op.anio,archivo:h.archivo,mapa:mapa});
    if(!p){ignoradas.push(h.nombre);return;}
    p.nombre=h.nombre;p.archivo=h.archivo||'';parsed.push(p);
  });
  var firma=function(p){return p.filas.map(function(x){return x.sigla+':'+x.estatus+':'+(x.fechaDetencion||'')+':'+x.detalle;}).sort().join('|');};
  parsed.forEach(function(p){
    p.posibleCopia=false;
    if(!p.fecha||!p.filas.length)return;
    var f=firma(p);
    parsed.forEach(function(q){if(q!==p&&q.fecha&&q.fecha!==p.fecha&&firma(q)===f&&p.fechaCabecera&&p.fechaCabecera!==p.fecha&&p.fechaCabecera===q.fecha)p.posibleCopia=true;});
  });
  var porDia={},conflictos=[];
  parsed.filter(function(p){return p.fecha&&!p.posibleCopia;}).forEach(function(p){(porDia[p.fecha]=porDia[p.fecha]||[]).push(p);});
  var finales={},hojasInfo=[];
  Object.keys(porDia).sort().forEach(function(f){
    var lst=porDia[f].slice().sort(function(a,b){return b.filas.length-a.filas.length;}),ganadora=lst[0];
    lst.slice(1).forEach(function(q){
      var dif=0,mg={};ganadora.filas.forEach(function(x){mg[x.sigla]=x.estatus+'|'+(x.fechaDetencion||'')+'|'+x.detalle;});q.filas.forEach(function(x){if(mg[x.sigla]!==undefined&&mg[x.sigla]!==x.estatus+'|'+(x.fechaDetencion||'')+'|'+x.detalle)dif++;});
      if(dif>0)conflictos.push({fecha:f,usada:ganadora.archivo+' / '+ganadora.nombre,descartada:q.archivo+' / '+q.nombre,equiposConEstatusDistinto:dif});else duplicadas++;
      q.descartada=true;
    });
    ganadora.filas.forEach(function(x){finales[f+'|'+x.sigla]=x;});
  });
  var prog=op.siglasPrograma||null,ret=op.siglasRetiradas||[],excl=op.excluir||[],desconocidas={},filas=[];
  Object.keys(finales).sort().forEach(function(k){
    var x=finales[k];
    if(excl.indexOf(x.sigla)>=0)return;
    if(prog&&prog.indexOf(x.sigla)<0&&ret.indexOf(x.sigla)<0){desconocidas[x.sigla]=(desconocidas[x.sigla]||0)+1;return;}
    filas.push(x);
  });
  parsed.forEach(function(p){hojasInfo.push({nombre:p.nombre,archivo:p.archivo,formato:p.formato,fecha:p.fecha,equipos:p.filas.length,fs:p.filas.filter(function(x){return x.estatus==='FS';}).length,
    sinEstatus:p.sinEstatus,avisos:p.avisos,posibleCopia:!!p.posibleCopia,descartada:!!p.descartada});});
  return{filas:filas,hojas:hojasInfo,conflictos:conflictos,duplicadasIdenticas:duplicadas,desconocidas:desconocidas,ignoradas:ignoradas};
}
// Compara las filas nuevas con las ya guardadas (clave fecha+sigla, ids = existentes[i]._id): {insertar, actualizar:[{_id, fila}], iguales}. Cargar de nuevo lo mismo no cambia nada.
function reportabilidadFusionar(existentes,nuevas){
  var ix={};(existentes||[]).forEach(function(e){ix[e.fecha+'|'+e.sigla]=e;});
  var campos=['siglaCliente','estatus','ubicacion','detalle','fechaDetencion','proyeccion','ordenCompra','observacion','mantenedor'];
  var ins=[],act=[],ig=0;
  (nuevas||[]).forEach(function(n){
    var e=ix[n.fecha+'|'+n.sigla];
    if(!e){ins.push(n);return;}
    var distinto=campos.some(function(k){return String(e[k]==null?'':e[k])!==String(n[k]==null?'':n[k]);});
    if(distinto)act.push({_id:e._id,fila:n});else ig++;
  });
  return{insertar:ins,actualizar:act,iguales:ig};
}
// Disponibilidad por día en [desde,hasta] (ISO) a partir de las filas guardadas. o: {excluir:[siglas], hoy}. Disponibilidad del día = OP ÷ (OP+FS) de los equipos reportados ese día.
function reportabilidadDisponibilidad(filas,desde,hasta,o){
  var op=o||{},excl=op.excluir||[],por={};
  (filas||[]).forEach(function(r){
    if(!r||r.fecha<desde||r.fecha>hasta||excl.indexOf(r.sigla)>=0)return;
    var d=por[r.fecha]||(por[r.fecha]={fecha:r.fecha,op:0,fs:0,fsSiglas:[]});
    if(r.estatus==='FS'){d.fs++;d.fsSiglas.push(r.sigla);}else if(r.estatus==='OP')d.op++;
  });
  var dias=Object.keys(por).sort().map(function(f){var d=por[f],t=d.op+d.fs;d.total=t;d.disp=t>0?d.op/t:null;d.fsSiglas.sort();return d;});
  var conDato=dias.filter(function(d){return d.disp!=null;});
  var prom=conDato.length?conDato.reduce(function(a,d){return a+d.disp;},0)/conDato.length:null;
  var hoy=op.hoy||hasta,fin=hasta<hoy?hasta:hoy,nDias=desde>fin?0:Math.round((new Date(fin+'T12:00:00')-new Date(desde+'T12:00:00'))/86400000)+1;
  var fsDias={};dias.forEach(function(d){d.fsSiglas.forEach(function(s){fsDias[s]=(fsDias[s]||0)+1;});});
  var ranking=Object.keys(fsDias).map(function(s){return{sigla:s,dias:fsDias[s]};}).sort(function(a,b){return b.dias-a.dias||a.sigla.localeCompare(b.sigla);});
  return{dias:dias,diasConDato:conDato.length,diasPeriodo:nDias,cobertura:nDias>0?conDato.length/nDias:null,promedio:prom,
    minimo:conDato.length?conDato.reduce(function(a,d){return d.disp<a.disp?d:a;}):null,maximo:conDato.length?conDato.reduce(function(a,d){return d.disp>a.disp?d:a;}):null,ranking:ranking};
}
// Episodios de FS por equipo: filas consecutivas FS con la misma fecha de detención. Para cada uno: primera y última vez visto, detalle, proyecciones en orden (cada cambio es una reprogramación),
// si terminó (hay un OP posterior del equipo; la fecha de término real está entre la última vez FS y ese primer OP) y si cumplió su última proyección. `hoy` = último día con datos.
function reportabilidadEpisodios(filas){
  var por={},ultimoDato='';
  (filas||[]).forEach(function(r){if(!r)return;(por[r.sigla]=por[r.sigla]||[]).push(r);if(r.fecha>ultimoDato)ultimoDato=r.fecha;});
  var out=[];
  Object.keys(por).forEach(function(s){
    var l=por[s].slice().sort(function(a,b){return a.fecha<b.fecha?-1:1;}),cur=null;
    l.forEach(function(r,i){
      if(r.estatus==='FS'){
        if(cur&&cur.fechaDetencion===(r.fechaDetencion||null)&&r.fechaDetencion){cur.ultimaVez=r.fecha;cur.diasVistos++;if(r.detalle)cur.detalle=r.detalle;if(r.observacion)cur.observacion=r.observacion;if(r.ordenCompra)cur.ordenCompra=r.ordenCompra;
          if(r.proyeccion&&cur.proyecciones[cur.proyecciones.length-1]!==r.proyeccion)cur.proyecciones.push(r.proyeccion);}
        else{cur={sigla:s,fechaDetencion:r.fechaDetencion||null,primeraVez:r.fecha,ultimaVez:r.fecha,diasVistos:1,detalle:r.detalle||'',observacion:r.observacion||'',ordenCompra:r.ordenCompra||'',proyecciones:r.proyeccion?[r.proyeccion]:[],_i:i};out.push(cur);}
      }else cur=null;
    });
  });
  out.forEach(function(e){
    var l=por[e.sigla].slice().sort(function(a,b){return a.fecha<b.fecha?-1:1;});
    var op=l.filter(function(r){return r.estatus==='OP'&&r.fecha>e.ultimaVez;})[0];
    e.cerrado=!!op;e.primerOP=op?op.fecha:null;e.reprogramaciones=Math.max(0,e.proyecciones.length-1);
    e.proyeccionFinal=e.proyecciones.length?e.proyecciones[e.proyecciones.length-1]:null;
    if(e.proyeccionFinal){
      if(e.cerrado)e.cumplioProyeccion=e.primerOP<=e.proyeccionFinal||e.ultimaVez<=e.proyeccionFinal&&e.primerOP<=addDiasISO_(e.proyeccionFinal,2);
      else e.cumplioProyeccion=e.proyeccionFinal>=ultimoDato?null:false;      // abierto: null = aún dentro de plazo; false = proyección vencida
      e.diasVencida=(!e.cerrado&&e.proyeccionFinal<ultimoDato)?Math.round((new Date(ultimoDato+'T12:00:00')-new Date(e.proyeccionFinal+'T12:00:00'))/86400000):0;
    }else{e.cumplioProyeccion=null;e.diasVencida=0;}
    delete e._i;
  });
  return out.sort(function(a,b){return a.primeraVez<b.primeraVez?1:a.primeraVez>b.primeraVez?-1:a.sigla.localeCompare(b.sigla);});
}
function addDiasISO_(iso,n){return new Date(new Date(iso+'T12:00:00').getTime()+n*86400000).toISOString().slice(0,10);}

// ═══ CURVA S DE PM Y CUMPLIMIENTO DEL PROGRAMA (2026-10-11) ═══
// Compara, día a día y de forma ACUMULADA, el trabajo de PM planificado contra el ejecutado, ponderado por HORAS: un PM4 pesa 12 h y un PM1 3 h (duraciones estándar del usuario, editables en
// Configuración → cfg.duracionPMHoras), no "1 PM = 1". El plan sale del propio calendario de PM: los hitos de horómetro (múltiplos de la frecuencia de cada equipo, con el tipo que corresponde a
// cada hito, ver C.tipoPM) que el equipo cruza dentro del mes. Para meses pasados el horómetro sale de historial_horometros (hist); para lo que falta del mes en curso y los meses futuros, de
// horomActual + horas/día declaradas. Lo real son los registros de PM (reg) del mes. Los tipos antiguos PM5–PM9 se cuentan como el PM equivalente (PM_EQUIVALENCIA). NO incluye el arrastre
// de PM vencidos de meses anteriores (si se hacen tarde cuentan como ejecutados cuando se hacen) ni el tiempo de cada tarea. Un equipo sin horómetro al inicio del mes queda fuera (sinBase).
var PM_DURACION_ESTANDAR_H={PM1:3,PM2:5,PM3:8,PM4:12};
var PM_EQUIVALENCIA={PM5:'PM1',PM6:'PM2',PM7:'PM1',PM8:'PM4',PM9:'PM1'};
function pmTipoEfectivo(t){var k=String(t==null?'':t).toUpperCase().trim();if(PM_DURACION_ESTANDAR_H[k])return k;if(PM_EQUIVALENCIA[k])return PM_EQUIVALENCIA[k];return null;}
function pmDuracionesEstandar(cfgDur){var o={};Object.keys(PM_DURACION_ESTANDAR_H).forEach(function(k){var v=Number(cfgDur&&cfgDur[k]);o[k]=v>0?v:PM_DURACION_ESTANDAR_H[k];});return o;}
function _fechaMas(iso,n){return new Date(new Date(iso+'T12:00:00').getTime()+n*86400000).toISOString().slice(0,10);}
// Rango [desde,hasta] (ISO, inclusivo) del período que contiene la fecha `ref`: 'semana' (lunes a domingo), 'mes', 'semestre' (ene–jun / jul–dic) o 'anio'.
function periodoRango(tipo,ref){
  var f=_tcoIso(ref),y=parseInt(f.slice(0,4),10),m=parseInt(f.slice(5,7),10);
  var fin=function(yy,mm){return yy+'-'+('0'+mm).slice(-2)+'-'+('0'+new Date(yy,mm,0).getDate()).slice(-2);};
  if(tipo==='semana'){var dow=(new Date(f+'T12:00:00').getDay()+6)%7,lunes=_fechaMas(f,-dow);return{tipo:tipo,desde:lunes,hasta:_fechaMas(lunes,6)};}
  if(tipo==='semestre'){var s1=m<=6;return{tipo:tipo,desde:y+(s1?'-01-01':'-07-01'),hasta:s1?y+'-06-30':y+'-12-31'};}
  if(tipo==='anio')return{tipo:tipo,desde:y+'-01-01',hasta:y+'-12-31'};
  return{tipo:'mes',desde:f.slice(0,7)+'-01',hasta:fin(y,m)};
}
var _PER_MESES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function periodoEtiqueta(tipo,desde,hasta){
  var f=function(iso){return parseInt(iso.slice(8,10),10)+'-'+_PER_MESES[parseInt(iso.slice(5,7),10)-1];};
  if(tipo==='semana')return'Semana del '+f(desde)+' al '+f(hasta)+' de '+hasta.slice(0,4);
  if(tipo==='semestre')return(desde.slice(5,7)==='01'?'1.er':'2.º')+' semestre '+desde.slice(0,4);
  if(tipo==='anio')return'Año '+desde.slice(0,4);
  return _PER_MESES[parseInt(desde.slice(5,7),10)-1]+' '+desde.slice(0,4);
}
// Períodos elegibles de cada tipo para un selector: el siguiente, el actual y los anteriores ([{v: fecha de inicio, label}]).
function periodoOpciones(tipo,hoy){
  var cant=tipo==='semana'?26:tipo==='mes'?24:tipo==='semestre'?6:4,out=[],cur=periodoRango(tipo,hoy),sig=periodoRango(tipo,_fechaMas(cur.hasta,1));
  out.push({v:sig.desde,label:periodoEtiqueta(tipo,sig.desde,sig.hasta)+' (próximo)'});
  for(var i=0;i<cant;i++){out.push({v:cur.desde,label:periodoEtiqueta(tipo,cur.desde,cur.hasta)+(i===0?' (actual)':'')});cur=periodoRango(tipo,_fechaMas(cur.desde,-1));}
  return out;
}
// d: {reg, hist, hoy (ISO)} · o: {periodo: 'semana'|'mes'|'semestre'|'anio' + ref (fecha ISO dentro del período), o bien desde/hasta, o bien mes 'YYYY-MM'; duraciones ({PM1..PM4}: horas)}
function curvaSPM(equipos,d,o){
  var op=o||{},dur=pmDuracionesEstandar(op.duraciones),hoy=_tcoIso(d.hoy);
  var rg=op.desde&&op.hasta?{tipo:op.periodo||'mes',desde:op.desde,hasta:op.hasta}:op.periodo?periodoRango(op.periodo,op.ref||hoy):periodoRango('mes',(op.mes||hoy.slice(0,7))+'-01');
  var inicio=rg.desde,fin=rg.hasta,previo=_fechaMas(inicio,-1),dias=_tcoDias(previo,fin),mes=inicio.slice(0,7);
  var diaCorte=hoy<inicio?0:hoy>fin?dias:_tcoDias(previo,hoy);
  var activos=(equipos||[]).filter(function(e){return e&&e.sigla&&e.unidad!=='km';});
  var plan=[],sinBase=[],estimados=[],sinRitmo=[],anomalos=[];
  var tDia=function(f){return _tcoDias(previo,f);};   // día 0 = víspera del mes
  activos.forEach(function(e){
    var ritmo=Number(e.hrsDia)>0?Number(e.hrsDia):0,frec=Number(e.frecPM)>0?Number(e.frecPM):0;
    if(!(ritmo>0&&frec>0)){sinRitmo.push(e.sigla);return;}
    var hActual=Number(e.horomActual)||0,h0=null,t0=0;
    if(previo<=hoy)h0=C.horomHistorico(d.hist||[],e.sigla,previo);
    else h0=hActual+ritmo*_tcoDias(hoy,previo);
    if(h0==null){
      // sin lectura antes del mes: se ancla en la primera lectura válida de los primeros 7 días; si no hay, el equipo queda fuera (estimar con horas/día inventaría PM de un equipo que pudo estar detenido)
      var prim=inicio<=hoy?C.lecturasValidas(d.hist||[],e.sigla).filter(function(r){return r.fecha>=inicio&&r.fecha<=_fechaMas(inicio,7);})[0]:null;
      if(!prim){sinBase.push(e.sigla);return;}
      h0=prim.horomFin!=null?prim.horomFin:prim.horom;t0=tDia(prim.fecha);estimados.push(e.sigla);
    }
    var hHoy=null;if(hoy>=inicio&&hoy<=fin){hHoy=C.horomHistorico(d.hist||[],e.sigla,hoy);if(hHoy==null||hHoy<h0)hHoy=hActual>=h0?hActual:null;}
    var hFin;
    if(fin<=hoy){hFin=C.horomHistorico(d.hist||[],e.sigla,fin);if(hFin==null)hFin=h0;}
    else if(hHoy!=null)hFin=hHoy+ritmo*_tcoDias(hoy,fin);
    else hFin=h0+ritmo*dias;
    if(hFin<h0)hFin=h0;
    if(hFin-h0>ritmo*(dias-t0)*1.5+frec){anomalos.push(e.sigla);return;}     // más horas que las posibles en el mes: lectura mala en el historial, no se inventa un plan
    var knots=[[t0,h0]];if(hHoy!=null&&hoy>=inicio&&hoy<fin)knots.push([tDia(hoy),hHoy]);knots.push([dias,hFin]);
    var inv=function(p){for(var i=0;i<knots.length-1;i++){var a=knots[i],b=knots[i+1];if(p>a[1]&&p<=b[1]){return b[1]>a[1]?a[0]+(p-a[1])/(b[1]-a[1])*(b[0]-a[0]):b[0];}}return null;};
    for(var p=(Math.floor(h0/frec)+1)*frec;p<=hFin+1e-9;p+=frec){
      var t=inv(p);if(t==null)continue;
      var tipo=C.tipoPM(Math.round(p),frec);
      plan.push({sigla:e.sigla,dia:Math.min(dias,Math.max(1,Math.ceil(t-1e-9))),tipo:tipo,horas:dur[tipo]});
    }
  });
  var siglas={};activos.forEach(function(e){siglas[e.sigla]=true;});
  var real=[],sinTipo=0;
  (d.reg||[]).forEach(function(r){
    if(!r||!siglas[r.equipo])return;
    var f=String(r.fechaEntrada||r.fechaEjec||'').slice(0,10);if(f<inicio||f>fin||f>hoy)return;
    var tipo=pmTipoEfectivo(r.tipoPM);if(!tipo){sinTipo++;return;}
    real.push({sigla:r.equipo,dia:_tcoDias(previo,f),tipo:tipo,horas:dur[tipo],tipoOriginal:String(r.tipoPM||'').toUpperCase()});
  });
  var serie=[],pH=0,pN=0,rH=0,rN=0;
  for(var dd=0;dd<=dias;dd++){
    plan.forEach(function(x){if(x.dia===dd){pH+=x.horas;pN++;}});
    real.forEach(function(x){if(x.dia===dd){rH+=x.horas;rN++;}});
    serie.push({dia:dd,fecha:_fechaMas(previo,dd),planH:pH,planN:pN,realH:dd<=diaCorte?rH:null,realN:dd<=diaCorte?rN:null});
  }
  var planTotalH=pH,planTotalN=pN,planCorteH=serie[diaCorte].planH,planCorteN=serie[diaCorte].planN,realCorteH=diaCorte>0?serie[diaCorte].realH:0,realCorteN=diaCorte>0?serie[diaCorte].realN:0;
  var cumpl=planCorteH>0?realCorteH/planCorteH:null;
  // por equipo
  var por={};
  plan.forEach(function(x){var q=por[x.sigla]||(por[x.sigla]={sigla:x.sigla,planH:0,planN:0,planCorteH:0,planCorteN:0,realH:0,realN:0});q.planH+=x.horas;q.planN++;if(x.dia<=diaCorte){q.planCorteH+=x.horas;q.planCorteN++;}});
  real.forEach(function(x){var q=por[x.sigla]||(por[x.sigla]={sigla:x.sigla,planH:0,planN:0,planCorteH:0,planCorteN:0,realH:0,realN:0});q.realH+=x.horas;q.realN++;});
  var equiposRes=Object.keys(por).map(function(k){var q=por[k];q.atrasoH=Math.max(0,q.planCorteH-q.realH);q.cumplimiento=q.planCorteH>0?q.realH/q.planCorteH:null;return q;}).sort(function(a,b){return b.atrasoH-a.atrasoH||a.sigla.localeCompare(b.sigla);});
  var tipos={};Object.keys(dur).forEach(function(t){tipos[t]={plan:0,planCorte:0,real:0,horas:dur[t]};});
  plan.forEach(function(x){tipos[x.tipo].plan++;if(x.dia<=diaCorte)tipos[x.tipo].planCorte++;});real.forEach(function(x){tipos[x.tipo].real++;});
  var proyH=diaCorte>=dias?realCorteH:(cumpl!=null?realCorteH+Math.max(0,planTotalH-planCorteH)*Math.min(cumpl,1.5):null);
  return{mes:mes,periodo:rg.tipo,desde:inicio,hasta:fin,dias:dias,diaCorte:diaCorte,hoy:hoy,duraciones:dur,serie:serie,
    totales:{planH:planTotalH,planN:planTotalN,planCorteH:planCorteH,planCorteN:planCorteN,realH:realCorteH,realN:realCorteN},
    cumplimiento:cumpl,cumplimientoN:planCorteN>0?realCorteN/planCorteN:null,brechaH:planCorteH-realCorteH,
    proyeccionCierreH:proyH,proyeccionCierrePct:(proyH!=null&&planTotalH>0)?proyH/planTotalH:null,
    equipos:equiposRes,tipos:tipos,conBase:activos.length-sinBase.length-sinRitmo.length-anomalos.length,elegibles:activos.length,sinBase:sinBase,estimados:estimados,anomalos:anomalos,sinRitmo:sinRitmo,sinTipo:sinTipo,
    realTiposAntiguos:real.filter(function(x){return x.tipoOriginal!==x.tipo;}).length};
}
// Cumplimiento del programa por períodos [{desde,hasta,periodo,etiqueta}] (solo períodos con base en ≥50 % de los equipos y con plan a la fecha): [{etiqueta, desde, hasta, planH, realH, cumplimiento, planN, realN, parcial}]
function cumplimientoProgramaPeriodos(equipos,d,periodos,o){
  var hoy=_tcoIso(d.hoy),out=[];
  (periodos||[]).forEach(function(pr){
    if(pr.desde>hoy)return;
    var c=curvaSPM(equipos,d,Object.assign({},o,{desde:pr.desde,hasta:pr.hasta,periodo:pr.periodo}));
    if(!c.elegibles||c.conBase<0.5*c.elegibles||!(c.totales.planCorteH>0))return;
    out.push({etiqueta:pr.etiqueta||pr.desde,desde:pr.desde,hasta:pr.hasta,mes:pr.desde.slice(0,7),planH:c.totales.planCorteH,realH:c.totales.realH,planN:c.totales.planCorteN,realN:c.totales.realN,cumplimiento:c.cumplimiento,parcial:c.diaCorte<c.dias,conBase:c.conBase,elegibles:c.elegibles});
  });
  return out;
}
// Mes a mes: meses = ['YYYY-MM', …]
function cumplimientoProgramaMeses(equipos,d,meses,o){
  return cumplimientoProgramaPeriodos(equipos,d,(meses||[]).map(function(m){var r=periodoRango('mes',m+'-01');return{desde:r.desde,hasta:r.hasta,periodo:'mes',etiqueta:m};}),o);
}

// ═══ PRONÓSTICO DE DISPONIBILIDAD POR EQUIPO (2026-10-11) ═══
// La proyección Monte Carlo de la pestaña Disponibilidad mezcla toda la flota en una sola bolsa de fallas. Esta mira equipo por equipo y suma lo que sí se sabe: (1) los PM calendarizados
// (pmProgramadosEquipo × la duración real de sus PM), (2) las fallas esperadas de CADA equipo con su propio historial (tasa Gamma-Poisson estabilizada con bayesEmpiricoGammaPoisson, por lo
// que un equipo con poca historia se acerca al promedio de la flota) y (3) los equipos que hoy están fuera de servicio (lo que les falta). Se simula 2.000 veces y se entrega el rango
// P10–P90, la probabilidad de cumplir la meta y qué equipos más restan. El backtest (backtestPronosticoDisponibilidad) repite el pronóstico desde meses pasados y dice si el rango acertó.
// Límites: las fallas son las registradas (lo no registrado no existe para el modelo); los intervalos entre fallas se tratan como aleatorios, sin la edad de los componentes; una falla de varios
// días seguidos cuenta como un solo evento. `disponibilidad` = horas operables no perdidas ÷ horas operables (hrsDia × días), igual que dispEquipoMes.
function _rngNormal(rng){var u=0;while(u===0)u=rng();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*rng());}
function _rngGamma(shape,rng){
  if(shape<1){var u0=rng();while(u0===0)u0=rng();return _rngGamma(shape+1,rng)*Math.pow(u0,1/shape);}
  var d=shape-1/3,c=1/Math.sqrt(9*d);
  for(;;){var x,v;do{x=_rngNormal(rng);v=1+c*x;}while(v<=0);v=v*v*v;var u=rng();
    if(u<1-0.0331*x*x*x*x)return d*v;if(Math.log(u)<0.5*x*x+d*(1-v+Math.log(v)))return d*v;}
}
function _rngPoisson(mu,rng){
  if(!(mu>0))return 0;
  if(mu<30){var L=Math.exp(-mu),k=0,p=1;do{k++;p*=rng();}while(p>L);return k-1;}
  return Math.max(0,Math.round(mu+Math.sqrt(mu)*_rngNormal(rng)));
}
function _dispPct(arr,p){var i=Math.min(arr.length-1,Math.max(0,Math.floor(p*(arr.length-1))));return arr[i];}
// Eventos de falla de un equipo en [desde,hasta]: días consecutivos con detención = un evento. Cada evento: {h: horas operables perdidas (tope hrsDia por día), d: días, fin: último día}.
function _dispEventosFalla(mapaSigla,desde,hasta,hrsDia){
  var dias=Object.keys(mapaSigla||{}).filter(function(d){return d>=desde&&d<=hasta&&mapaSigla[d]>0;}).sort();
  var ev=[],prev=null,cur=null;
  dias.forEach(function(d){
    var h=Math.min(mapaSigla[d],hrsDia);
    if(prev!==null&&_tcoDias(prev,d)===1){cur.h+=h;cur.d++;cur.fin=d;}else{if(cur)ev.push(cur);cur={h:h,d:1,fin:d};}
    prev=d;
  });
  if(cur)ev.push(cur);
  return ev;
}
// Riesgo de componentes por equipo en el horizonte (2026-10-11). La tasa de fallas de cada equipo sale de su historial y NO sabe la edad de sus componentes: un camión con turbos nuevos y otro con
// turbos pasados de vida figuran igual. Acá se corrige solo ese desvío: para cada componente con cambio registrado y VIDA MEDIDA en la flota (≥5 vidas completas del mismo componente y origen, con la
// Weibull ajustada por máxima verosimilitud incluyendo los componentes que siguen funcionando), se calcula cuántas fallas se esperan en el horizonte dada su edad (aumento del riesgo acumulado de la
// Weibull entre t y t+H) y se resta lo que se espera en promedio para un componente de edad cualquiera (H/MTTF), que es lo que el historial del equipo ya contiene. La diferencia (puede ser negativa si
// el componente es nuevo) se suma a las fallas esperadas del equipo: nunca baja de la mitad de la tasa base ni sube más de 3 fallas por equipo. Sin ≥5 vidas medidas no se ajusta (el TBO del fabricante
// es una política de cambio, no una tasa de falla). Devuelve {sigla:{exceso, comps:[{item,desdeH,beta,eta,mu,prom,exceso,grupo}]}} y el resumen de qué grupos se pudieron modelar.
function _dispRiesgoComponentes(equipos,d,H,hoyDate,aplic){
  var out={},grupos={},usados={};
  if(!(d.compHist&&d.compHist.length))return{porEquipo:out,grupos:grupos};
  var estado=tboEstadoFlota(equipos,d.compHist,d.compMayores||[],hoyDate,aplic||'normal');
  var vidas=tboVidasObservadas(d.compHist,equipos,d.compras||[],aplic||'normal',hoyDate).vidas;
  var ajusta=function(fam,origen){
    var k=fam+'|'+origen;if(usados[k]!==undefined)return usados[k];
    var sub=vidas.filter(function(v){return v.fam===fam&&v.origen===origen;}),mezcla=false;
    var f=ajusteWeibullCensurado(sub.map(function(v){return{tiempo:v.L,censurado:v.censurado};}));
    if(!f){sub=vidas.filter(function(v){return v.fam===fam;});mezcla=true;f=ajusteWeibullCensurado(sub.map(function(v){return{tiempo:v.L,censurado:v.censurado};}));}
    usados[k]=f?{beta:f.beta,eta:f.eta,n:f.n,nFallas:f.nFallas,mezcla:mezcla,mttf:tboMTTFWeibull(f.beta,f.eta)}:null;
    if(f)grupos[k]={fam:fam,origen:origen,beta:f.beta,eta:f.eta,vidas:f.n,completas:f.nFallas,mezclaOrigenes:mezcla};
    return usados[k];
  };
  var hd={};(equipos||[]).forEach(function(e){hd[e.sigla]=e.hrsDia>0?Number(e.hrsDia):12;});
  estado.forEach(function(it){
    if(!it.conDato||!it.fam)return;
    var par=ajusta(it.fam,it.origenUlt||'sin dato');if(!par)return;
    var Hh=H*hd[it.sigla],t=Math.max(0,it.desdeH),mu=Math.pow((t+Hh)/par.eta,par.beta)-Math.pow(t/par.eta,par.beta),prom=Hh/par.mttf;
    var o=out[it.sigla]||(out[it.sigla]={exceso:0,comps:[]});
    o.exceso+=mu-prom;o.comps.push({item:it.item,desdeH:Math.round(t),beta:par.beta,eta:par.eta,mu:Math.round(mu*1000)/1000,prom:Math.round(prom*1000)/1000,exceso:Math.round((mu-prom)*1000)/1000,mezcla:par.mezcla});
  });
  Object.keys(out).forEach(function(k){out[k].exceso=Math.min(3,out[k].exceso);out[k].comps.sort(function(a,b){return b.exceso-a.exceso;});});
  return{porEquipo:out,grupos:grupos};
}
// equipos: lista de equipos · d: {reg, ot, hoy (ISO), compHist, compMayores, compras (opcionales: activan el ajuste por edad de componentes)} · o: {horizonteDias=30, meta=85, nSim=2000, ventanaDias=365, rng, pmReal ({sigla:horas}, solo backtest), duracionesPM ({PM1..PM4}: horas, por defecto las estándar), componentes (false = sin ajuste por edad)}
// Devuelve null si no hay historial para estimar (menos de 5 eventos de falla o menos de 60 días de datos).
// Dos cuidados con los datos: (1) si el último registro es más viejo que 14 días, la historia se corta ahí (no se cuentan como "sin fallas" los días sin carga); (2) un "Fuera de Servicio" sin fecha de
// término es un evento ABIERTO: no entra a las duraciones (todavía no terminó) y, si lleva más días que el 90 % de las detenciones cerradas, se asume que sigue fuera todo el horizonte (así lo cuenta
// la Disponibilidad del programa) y se lista en `prolongados`, junto con la cifra que saldría si esos registros se cierran (`flota.sinProlongados`).
function pronosticoDisponibilidadEquipos(equipos,d,o){
  var op=o||{},H=op.horizonteDias>0?Math.round(op.horizonteDias):30,meta=op.meta>0?op.meta:85,nSim=op.nSim>0?Math.round(op.nSim):2000,rng=op.rng||Math.random;
  var hoyReal=_tcoIso(d.hoy),hoy=hoyReal,ventana=op.ventanaDias>0?op.ventanaDias:365;
  var activos=(equipos||[]).filter(function(e){return e&&e.sigla&&e.unidad!=='km';});
  if(!activos.length)return null;
  var downF=dispDownMap(d.reg||[],d.ot||[],hoyReal,{incluirPM:false}),downPM=dispDownMap(d.reg||[],[],hoyReal,{incluirPM:true}); // downPM = solo PM (sin ot)
  var fechas=[];Object.keys(downF).forEach(function(s){fechas=fechas.concat(Object.keys(downF[s]));});(d.reg||[]).forEach(function(r){var f=r.fechaEntrada||r.fechaEjec;if(f)fechas.push(f);});
  fechas=fechas.filter(function(f){return f&&f<=hoyReal;}).sort();
  if(!fechas.length)return null;
  var datosHasta=fechas[fechas.length-1];
  if(_tcoDias(datosHasta,hoyReal)>14)hoy=datosHasta;       // sin carga reciente: la historia termina en el último registro
  var desdeVentana=new Date(new Date(hoy+'T00:00:00').getTime()-ventana*86400000).toISOString().slice(0,10);
  var desde=fechas[0]>desdeVentana?fechas[0]:desdeVentana,T=_tcoDias(desde,hoy)+1;
  if(T<60)return null;
  var hd=function(e){return e.hrsDia>0?Number(e.hrsDia):12;};
  // equipos fuera de servicio sin fecha de término (eventos abiertos)
  var enCurso={};(d.ot||[]).forEach(function(r){if(r&&r.sigla&&(r.estatusEq==='Fuera de Servicio'||r.estadoEq==='Fuera de Servicio')&&r.fechaEntrada&&!r.fechaSalida&&r.fechaEntrada<=hoyReal){if(!enCurso[r.sigla]||r.fechaEntrada<enCurso[r.sigla])enCurso[r.sigla]=r.fechaEntrada;}});
  var info=activos.map(function(e){var h=hd(e),ev=_dispEventosFalla(downF[e.sigla],desde,hoy,h);ev.forEach(function(x){x.abierto=!!(enCurso[e.sigla]&&x.fin>=enCurso[e.sigla]);});return{e:e,h:h,ev:ev};});
  var cerr=[],cerrDias=[];info.forEach(function(x){x.ev.forEach(function(v){if(!v.abierto){cerr.push(v.h);cerrDias.push(v.d);}});});
  var pool=cerr.filter(function(v){return v>0;});
  if(pool.length<5)return null;
  var cd=cerrDias.slice().sort(function(a,b){return a-b;}),umbralDias=Math.max(2,cd.length?cd[Math.min(cd.length-1,Math.floor(0.9*(cd.length-1)))]:2);
  var bayes=bayesEmpiricoGammaPoisson(info.map(function(x){return{id:x.e.sigla,n:x.ev.length,exposicion:T};}));
  var nEv=0;info.forEach(function(x){nEv+=x.ev.length;});
  var mu=nEv/(T*info.length),prior=(bayes&&bayes.alpha>0&&bayes.beta>0)?{a:bayes.alpha,b:bayes.beta,fuente:'estabilizada con la flota (Gamma-Poisson)'}:{a:Math.max(mu,1e-9)*T,b:T,fuente:'prior débil (menos de 5 equipos con historia o sin variación entre ellos)'};
  var durPM=pmDuracionesEstandar(op.duracionesPM);   // horas de detención por tipo de PM (estándar del usuario, Configuración)
  var medPool=medianaPositiva(pool)||0;
  var fechaHoy=new Date(hoyReal+'T12:00:00'),prolongados=[];
  var rc=(op.componentes!==false)?_dispRiesgoComponentes(activos,d,H,fechaHoy,op.aplic):{porEquipo:{},grupos:{}};
  var eq=info.map(function(x){
    var pms=pmProgramadosEquipo(x.e,fechaHoy,H),pmH=op.pmReal&&op.pmReal[x.e.sigla]!=null?op.pmReal[x.e.sigla]:pms.reduce(function(a,q){return a+(durPM[pmTipoEfectivo(q.pm)||'PM1']);},0);
    var cerE=x.ev.filter(function(v){return !v.abierto&&v.h>0;}).map(function(v){return v.h;});
    var propia=cerE.length>=4?cerE:pool;
    var trans=enCurso[x.e.sigla]?_tcoDias(enCurso[x.e.sigla],hoyReal):null,prolong=trans!=null&&trans>umbralDias;
    var resta=trans==null?0:prolong?x.h*H:Math.max(0,(medianaPositiva(cerE)||medPool)-trans*x.h);
    if(prolong)prolongados.push({sigla:x.e.sigla,desde:enCurso[x.e.sigla],dias:trans});
    return{sigla:x.e.sigla,modelo:x.e.modelo||'',h:x.h,n:x.ev.length,shape:prior.a+x.ev.length,rate:prior.b+T,pm:pms.length,pmH:Math.min(pmH,x.h*H),dur:propia,durPropia:cerE.length>=4,resta:Math.min(resta,x.h*H),prolong:prolong,enCurso:enCurso[x.e.sigla]!=null,cap:x.h*H,sumO:[],sumI:[],sumO0:[],fallas:0,fallas0:0,exceso:(rc.porEquipo[x.e.sigla]||{}).exceso||0,comps:(rc.porEquipo[x.e.sigla]||{}).comps||[]};
  });
  // el ajuste por edad nunca quita más de la mitad de la tasa base de ese equipo
  eq.forEach(function(q){var base=q.shape/q.rate*H;if(q.exceso<-0.5*base)q.exceso=-0.5*base;});
  var flO=[],flI=[],flS=[],flO0=[];
  for(var s=0;s<nSim;s++){
    var sO=0,sI=0,sS=0,sO0=0;
    eq.forEach(function(q){
      var lam=_rngGamma(q.shape,rng)/q.rate,k0=_rngPoisson(lam*H,rng),durs=[];
      for(var j=0;j<k0;j++)durs.push(q.dur[Math.floor(rng()*q.dur.length)]);
      var perd0=q.resta;durs.forEach(function(v){perd0+=v;});
      var k=k0,perd=perd0;
      if(q.exceso>0){var ex=_rngPoisson(q.exceso,rng);for(var e2=0;e2<ex;e2++)perd+=q.dur[Math.floor(rng()*q.dur.length)];k=k0+ex;}
      else if(q.exceso<0&&k0>0){var pq=-q.exceso/(lam*H>0?lam*H:1),quita=0;perd=q.resta;for(var j2=0;j2<k0;j2++){if(rng()<pq)quita++;else perd+=durs[j2];}k=k0-quita;}
      var pI=Math.min(perd,q.cap),pO=Math.min(perd+q.pmH,q.cap),pO0=Math.min(perd0+q.pmH,q.cap);
      q.fallas+=k;q.fallas0+=k0;q.sumO.push(1-pO/q.cap);q.sumI.push(1-pI/q.cap);q.sumO0.push(1-pO0/q.cap);sO+=1-pO/q.cap;sI+=1-pI/q.cap;sO0+=1-pO0/q.cap;
      sS+=q.prolong?1-Math.min(perd-q.resta+q.pmH,q.cap)/q.cap:1-pO/q.cap;
    });
    flO.push(sO/eq.length);flI.push(sI/eq.length);flS.push(sS/eq.length);flO0.push(sO0/eq.length);
  }
  var ordO=flO.slice().sort(function(a,b){return a-b;}),ordI=flI.slice().sort(function(a,b){return a-b;}),ordS=flS.slice().sort(function(a,b){return a-b;}),ordO0=flO0.slice().sort(function(a,b){return a-b;});
  var r1=function(x){return Math.round(x*1000)/10;};
  var salida=eq.map(function(q){var ord=q.sumO.slice().sort(function(a,b){return a-b;}),med=q.sumO.reduce(function(a,b){return a+b;},0)/q.sumO.length;
    return{sigla:q.sigla,modelo:q.modelo,fallasHist:q.n,fallasEsperadas:Math.round(q.fallas/nSim*100)/100,pmProgramados:q.pm,pmHoras:Math.round(q.pmH*10)/10,enCurso:q.enCurso,prolongado:q.prolong,durPropia:q.durPropia,ajusteComponentes:Math.round(q.exceso*1000)/1000,componentes:q.comps.slice(0,3),
      dispP10:r1(_dispPct(ord,0.10)),dispP50:r1(_dispPct(ord,0.50)),dispMedia:r1(med),perdidaPuntosFlota:Math.round((1-med)/eq.length*1000)/10};}).sort(function(a,b){return b.perdidaPuntosFlota-a.perdidaPuntosFlota;});
  return{horizonteDias:H,nSim:nSim,meta:meta,nEquipos:eq.length,desde:desde,datosHasta:datosHasta,diasSinCarga:_tcoDias(datosHasta,hoyReal),diasHistoria:T,eventosHist:nEv,prior:prior.fuente,prolongados:prolongados,
    componentes:{gruposModelados:Object.keys(rc.grupos).map(function(k){return rc.grupos[k];}),equiposAjustados:eq.filter(function(q){return q.comps.length;}).length,
      sinAjuste:{p10:r1(_dispPct(ordO0,0.10)),p50:r1(_dispPct(ordO0,0.50)),p90:r1(_dispPct(ordO0,0.90))},fallasExtra:Math.round(eq.reduce(function(a,q){return a+(q.fallas-q.fallas0)/nSim;},0)*100)/100},
    flota:{p10:r1(_dispPct(ordO,0.10)),p50:r1(_dispPct(ordO,0.50)),p90:r1(_dispPct(ordO,0.90)),probMeta:Math.round(flO.filter(function(v){return v*100>=meta;}).length/nSim*1000)/10,
      intrinseca:{p10:r1(_dispPct(ordI,0.10)),p50:r1(_dispPct(ordI,0.50)),p90:r1(_dispPct(ordI,0.90))},
      sinProlongados:prolongados.length?{p10:r1(_dispPct(ordS,0.10)),p50:r1(_dispPct(ordS,0.50)),p90:r1(_dispPct(ordS,0.90)),probMeta:Math.round(flS.filter(function(v){return v*100>=meta;}).length/nSim*1000)/10}:null},
    equipos:salida};
}
// Repite el pronóstico desde `k` fechas de origen pasadas (una cada `horizonteDias`) usando SOLO lo que se sabía entonces y compara con la disponibilidad realmente ocurrida.
// El PM se toma como el realmente hecho (se asume que el plan se cumple): lo que se evalúa es el pronóstico de fallas. Pocos orígenes = evidencia anecdótica: `cobertura` es el % de veces
// que lo real cayó dentro del rango P10–P90 (se esperaría ~80 %).
function backtestPronosticoDisponibilidad(equipos,d,o){
  var op=o||{},H=op.horizonteDias>0?Math.round(op.horizonteDias):30,K=op.origenes>0?Math.round(op.origenes):6,hoy=_tcoIso(d.hoy);
  var activos=(equipos||[]).filter(function(e){return e&&e.sigla&&e.unidad!=='km';});
  var downFull=dispDownMap(d.reg||[],d.ot||[],hoy,{incluirPM:false}),downFullPM=dispDownMap(d.reg||[],[],hoy,{incluirPM:true});
  var out=[];
  for(var k=K;k>=1;k--){
    var origen=new Date(new Date(hoy+'T12:00:00').getTime()-k*H*86400000).toISOString().slice(0,10),fin=new Date(new Date(origen+'T12:00:00').getTime()+H*86400000).toISOString().slice(0,10);
    if(fin>hoy)continue;
    var regC=(d.reg||[]).filter(function(r){var f=r.fechaEntrada||r.fechaEjec||'';return f&&f<=origen;});
    var otC=(d.ot||[]).filter(function(r){var f=r.fechaEntrada||r.fecha||'';return f&&f<=origen;}).map(function(r){return(r.fechaSalida&&r.fechaSalida>origen)?Object.assign({},r,{fechaSalida:''}):r;});
    var pmReal={},real=0,n=0;
    activos.forEach(function(e){
      var h=e.hrsDia>0?Number(e.hrsDia):12,perd=0,pm=0;
      for(var i=1;i<=H;i++){var dd=new Date(new Date(origen+'T12:00:00').getTime()+i*86400000).toISOString().slice(0,10);
        var f=Math.min((downFull[e.sigla]&&downFull[e.sigla][dd])||0,h),t=Math.min((downFullPM[e.sigla]&&downFullPM[e.sigla][dd])||0,h);perd+=Math.min(t+f,h);pm+=Math.max(0,Math.min(t,h));}
      pmReal[e.sigla]=pm;real+=1-perd/(h*H);n++;
    });
    // componentes: con d.compHist y d.hist se reconstruye el estado al origen (cambios ya hechos y horómetro de ese día); sin ellos el ajuste por edad queda desactivado
    var conComp=!!(d.compHist&&d.hist),eqO=activos,dO={reg:regC,ot:otC,hoy:origen};
    if(conComp){
      eqO=activos.map(function(e){var hh=C.horomHistorico(d.hist,e.sigla,origen);return hh!=null?Object.assign({},e,{horomActual:hh}):e;});
      dO.compHist=(d.compHist||[]).filter(function(r){return r&&(r.fechaInst||'')&&r.fechaInst<=origen;});dO.compMayores=d.compMayores||[];dO.compras=d.compras||[];
    }
    var p=pronosticoDisponibilidadEquipos(eqO,dO,{horizonteDias:H,meta:op.meta,nSim:op.nSim||1000,rng:op.rng,pmReal:pmReal,componentes:conComp});
    if(!p)continue;
    var r=Math.round(real/n*1000)/10,sin=conComp?p.componentes.sinAjuste:p.flota;
    out.push({origen:origen,fin:fin,p10:p.flota.p10,p50:p.flota.p50,p90:p.flota.p90,real:r,dentro:r>=p.flota.p10&&r<=p.flota.p90,error:Math.round((p.flota.p50-r)*10)/10,
      sinComp:{p10:sin.p10,p50:sin.p50,p90:sin.p90,dentro:r>=sin.p10&&r<=sin.p90,error:Math.round((sin.p50-r)*10)/10},ajusteComp:Math.round((p.flota.p50-sin.p50)*10)/10});
  }
  if(!out.length)return null;
  var cob=function(f){return Math.round(out.filter(f).length/out.length*1000)/10;},eab=function(f){return Math.round(out.reduce(function(a,x){return a+Math.abs(f(x));},0)/out.length*10)/10;};
  return{horizonteDias:H,origenes:out,cobertura:cob(function(x){return x.dentro;}),errorMedioAbs:eab(function(x){return x.error;}),sesgo:Math.round(out.reduce(function(a,x){return a+x.error;},0)/out.length*10)/10,
    componentes:!!(d.compHist&&d.hist),sinComponentes:{cobertura:cob(function(x){return x.sinComp.dentro;}),errorMedioAbs:eab(function(x){return x.sinComp.error;})}};
}

// ═══ ROTACIÓN Y OBSOLESCENCIA DE STOCK (2026-10-02) ═══
// Acotado a Filtros y Lubricantes a propósito: son los dos únicos tipos de
// movimientos_stock con fecha real de consumo (investigación 2026-10-02) —
// 'Repuestos' (tabla 'repuestos') solo tiene fecha de ÚLTIMA COMPRA
// (ultCompra) y un stock vivo sin historial de salidas, así que no hay con
// qué calcular rotación/obsolescencia real para esa categoría sin inventar
// un dato que el sistema no tiene. Items recibidos ya normalizados por quien
// llama: [{clave,stockActual,precioUnit,consumoPeriodo,ultimoConsumoISO}].

// Rotación anual = valor consumido (anualizado) ÷ valor del inventario
// actual. No hay snapshot histórico de inventario PROMEDIO (solo el stock
// vigente), así que se usa el valor actual como aproximación — mismo
// criterio que usan la mayoría de los CMMS cuando no llevan ese historial;
// queda documentado acá, no se finge que es un promedio real. mesesHistorial
// = ventana real cubierta por los movimientos de 'consumoPeriodo' (si el
// historial real son 3 meses, se anualiza ×12/3, no se usa tal cual).
function rotacionInventarioMRO(items,mesesHistorial){
  if(!mesesHistorial||mesesHistorial<=0)return null;
  var valorInventario=0,valorConsumidoAnualizado=0;
  (items||[]).forEach(function(it){
    var valor=(it.stockActual||0)*(it.precioUnit||0);
    valorInventario+=valor;
    valorConsumidoAnualizado+=(it.consumoPeriodo||0)*(it.precioUnit||0)*(12/mesesHistorial);
  });
  if(!valorInventario)return null;
  return{rotacionAnual:Math.round(valorConsumidoAnualizado/valorInventario*100)/100,
    valorInventario:Math.round(valorInventario),valorConsumidoAnualizado:Math.round(valorConsumidoAnualizado)};
}

// % de ítems (y % de VALOR, más relevante financieramente) con stock >0 pero
// SIN consumo real en los últimos 'mesesUmbral' (12 por defecto) — usa la
// fecha de ÚLTIMO CONSUMO (movimientos_stock), no la fecha de compra. Un
// ítem con stock >0 que JAMÁS registró un consumo (ultimoConsumoISO null)
// cuenta como obsoleto igual (peor caso: nunca se movió). Ítems sin stock no
// entran al cálculo — "obsoleto" describe capital inmovilizado sin uso, no
// aplica a algo que ya no se tiene.
function obsolescenciaStockMRO(items,hoyISO,mesesUmbral){
  var umbralDias=(mesesUmbral||12)*30;
  var conStock=(items||[]).filter(function(it){return it&&(it.stockActual||0)>0;});
  if(!conStock.length)return null;
  var valorTotal=0,valorObsoleto=0,nObsoletos=0;
  var detalle=conStock.map(function(it){
    var valor=(it.stockActual||0)*(it.precioUnit||0);
    valorTotal+=valor;
    var dias=it.ultimoConsumoISO?_diasEntreISO(it.ultimoConsumoISO,hoyISO):null;
    var obsoleto=dias==null||dias>umbralDias;
    if(obsoleto){valorObsoleto+=valor;nObsoletos++;}
    return{clave:it.clave,stockActual:it.stockActual,valor:Math.round(valor),diasSinMovimiento:dias,obsoleto:obsoleto};
  });
  return{
    porcentajeItems:Math.round(nObsoletos/conStock.length*100),
    porcentajeValor:valorTotal?Math.round(valorObsoleto/valorTotal*100):null,
    nObsoletos:nObsoletos,nTotal:conStock.length,
    valorObsoleto:Math.round(valorObsoleto),valorTotal:Math.round(valorTotal),
    detalle:detalle
  };
}

// ═══ FMEA — NPR REAL (Severidad × Ocurrencia × Detección, 2026-10-02) ═══
// El checklist _CAUSAS_TIPICAS_FMEA (pred.js) ya lista las causas típicas de
// cada tipo de componente, pero es solo informativo — no prioriza cuál causa
// atacar primero. NPR formaliza esa priorización: 3 escalas de 1 a 10 que
// califica un técnico en terreno para CADA causa de un componente real
// (Severidad = qué tan grave es si ocurre, Ocurrencia = qué tan seguido
// pasa, Detección = qué tan fácil es detectarla ANTES de que falle — 10 =
// casi imposible de detectar a tiempo). Rango resultante 1-1000. null si
// falta alguna de las 3 calificaciones o está fuera de 1-10 — nunca se
// inventa un NPR con datos a medio calificar.
function calcularNPR(severidad,ocurrencia,deteccion){
  var vals=[severidad,ocurrencia,deteccion];
  if(vals.some(function(v){return v==null||!Number.isFinite(v)||v<1||v>10;}))return null;
  return severidad*ocurrencia*deteccion;
}

// Banda de prioridad simple sobre el NPR (rango real 1-1000) — NO es un
// umbral certificado de ninguna norma (NPR no tiene un corte estándar
// universal, varía mucho por industria/empresa), es una agrupación relativa
// documentada acá mismo para ordenar visualmente qué causa atacar primero.
function prioridadNPR(npr){
  if(npr==null)return null;
  if(npr>=200)return'critica';
  if(npr>=100)return'alta';
  if(npr>=50)return'media';
  return'baja';
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

// ═══ MATRIZ JACK-KNIFE (MTBF vs MTTR, 2026-10-02) ═══
// Cruza confiabilidad (MTBF) y mantenibilidad (MTTR) por equipo para ubicar a
// cada uno en 1 de 4 cuadrantes — identifica de un vistazo si el problema de
// un equipo es que falla seguido, que tarda mucho en repararse, o ambas cosas
// a la vez. La línea divisoria de cada eje es la MEDIANA de la flota (no el
// promedio: un solo equipo con un MTTR altísimo lo distorsiona, mismo motivo
// por el que medianaPositiva ya se usa en el resto del sistema), así que los
// cuadrantes son siempre relativos a la propia flota, no a un umbral fijo de
// libro. Recibe [{sigla,mtbf,mttr}] ya filtrados por quien llama a los que
// tienen AMBOS datos válidos (MTBF de ≥2 fallas vía C.mtbfReal, MTTR de
// reparaciones con duración vía C.mttrReal) — null con menos de 3 equipos con
// ambos datos (con 1-2 la mediana es un valor degenerado que no separa nada
// de verdad, igual de estricto que el resto de los métodos de la flota).
// Empates exactos en la mediana cuentan como "alto" en ambos ejes (criterio
// simple y documentado, no afecta el caso típico de flotas con >3 equipos).
//  - mundial: MTBF alto (falla poco) + MTTR bajo (se arregla rápido) — mejor caso
//  - cronico: MTBF bajo (falla seguido) + MTTR bajo (pero rápido de arreglar)
//  - agudo:   MTBF alto (falla poco) + MTTR alto (cuando falla, tarda mucho)
//  - complejo: MTBF bajo + MTTR alto — el peor cuadrante, prioridad máxima
// Qué hacer en cada cuadrante (misma lectura del diagrama Jack-Knife clásico): la solución depende de dónde cae el equipo.
var JK_ACCIONES={
  complejo:'Prioridad uno: falla seguido Y tarda mucho; aquí se va la disponibilidad. Atacar causa raíz y mantenibilidad a la vez.',
  agudo:'Falla poco pero para mucho: atacar por mantenibilidad (repuesto en bodega, acceso, procedimiento, herramienta) antes que por confiabilidad.',
  cronico:'Falla seguido pero se arregla rápido: análisis de causa raíz o rediseño; arreglarlo más rápido no soluciona el problema.',
  mundial:'Aceptable: déjalo en el plan; gastar más análisis aquí es gastar de más.'
};
// equipos: [{sigla, mtbf, mttr, hrsAnio (opcional: horas de operación por año del equipo)}]. Con hrsAnio se estima, por equipo, fallas por año = hrsAnio ÷ MTBF y horas perdidas por año = fallas × MTTR
// (el gráfico de Costos usa esas horas para dibujar las líneas de igual pérdida). Sin hrsAnio, esos dos datos quedan en null: no se inventan.
function matrizJackKnife(equipos){
  var datos=(equipos||[]).filter(function(e){return e&&e.mtbf>0&&e.mttr>0;});
  if(datos.length<3)return null;
  var medianaMtbf=medianaPositiva(datos.map(function(e){return e.mtbf;}));
  var medianaMttr=medianaPositiva(datos.map(function(e){return e.mttr;}));
  var puntos=datos.map(function(e){
    var mtbfAlto=e.mtbf>=medianaMtbf, mttrAlto=e.mttr>=medianaMttr;
    var cuadrante=mtbfAlto?(mttrAlto?'agudo':'mundial'):(mttrAlto?'complejo':'cronico');
    var h=e.hrsAnio>0?e.hrsAnio:null,fa=h?h/e.mtbf:null;
    return {sigla:e.sigla,mtbf:e.mtbf,mttr:e.mttr,cuadrante:cuadrante,hrsAnio:h,fallasAnio:fa,horasPerdidasAnio:fa!=null?fa*e.mttr:null};
  });
  var resumen={mundial:0,cronico:0,agudo:0,complejo:0};
  puntos.forEach(function(p){resumen[p.cuadrante]++;});
  var conHoras=puntos.filter(function(p){return p.horasPerdidasAnio!=null;});
  var perdidasPorCuadrante={mundial:0,cronico:0,agudo:0,complejo:0};
  conHoras.forEach(function(p){perdidasPorCuadrante[p.cuadrante]+=p.horasPerdidasAnio;});
  return {medianaMtbf:medianaMtbf,medianaMttr:medianaMttr,puntos:puntos,resumen:resumen,acciones:JK_ACCIONES,
    hrsAnioRef:conHoras.length?medianaPositiva(conHoras.map(function(p){return p.hrsAnio;})):null,
    horasPerdidasAnio:conHoras.reduce(function(t,p){return t+p.horasPerdidasAnio;},0),
    horasPerdidasPorCuadrante:perdidasPorCuadrante,
    nConHoras:conHoras.length};
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
  // 5ª señal (2026-10-11, etapa 3 de la ficha de componente): % de los componentes con cambio registrado que NO están en riesgo según la ficha
  // (tboPctSano). Solo entra cuando el equipo tiene plan TBO y al menos un componente con dato; si no, el Score se calcula exactamente como antes.
  if(typeof d.tboPct==='number'&&isFinite(d.tboPct))dimensiones.push({nombre:'Riesgo TBO',valor:d.tboPct});
  var usadas=dimensiones.filter(function(c){return c.valor!=null;});
  if(!usadas.length)return {valor:null,n:0,total:dimensiones.length,detalle:dimensiones};
  var suma=usadas.reduce(function(s,c){return s+c.valor;},0);
  var valor=Math.round((suma/usadas.length)*10)/10;
  return {valor:valor,n:usadas.length,total:dimensiones.length,detalle:dimensiones};
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
function equiposConSaludFlota(eq,compMayores,neu,aceite,otConHist,tboPorSigla){
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
    var tboE=(tboPorSigla&&tboPorSigla[e.sigla])||null;
    var score=scoreSaludEquipo({componentesPct:componentesPct,neumaticosPct:neumaticosPct,aceitePct:aceitePct,confiabilidadPct:confiabilidadPct,tboPct:tboE?tboE.pct:null});
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
    return{sigla:e.sigla,tipo:e.tipo,modelo:e.modelo,score:score,tbo:tboE,horomActual:e.horomActual,unidad:e.unidad,hrsDia:e.hrsDia,weibull:weibull,edadVirtual:edadVirtual,kijima:kijima};
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
  'Confiabilidad':'Equipo con historial de fallas frecuente (MTBF bajo) — evaluar una intervención preventiva antes de la próxima falla.',
  'Riesgo TBO':'Hay componentes con riesgo alto de falla según el plan del fabricante — ficha del equipo en Buscar → Componentes (decisión, costo y plazo del repuesto).'
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
// `desdeISO` (opcional): ignora los snapshots anteriores a esa fecha. Se usa cuando cambia la fórmula del Score de un EQUIPO (SALUD_EQUIPO_METODO_DESDE):
// comparar el valor nuevo contra uno calculado con otra fórmula inventaría una caída o un cruce que no existen (y dispararía avisos reales por correo y
// WhatsApp). Hasta que haya un snapshot de la fórmula nueva en la ventana, no hay tendencia.
var SALUD_EQUIPO_METODO_DESDE='2026-10-12';
function valorPrevioSalud(historico,hoyISO,desdeISO){
  var fechas=Object.keys(historico||{}).filter(function(f){return f<hoyISO&&(!desdeISO||f>=desdeISO);}).sort();
  return fechas.length?historico[fechas[fechas.length-1]]:null;
}
function tendenciaSaludSemanal(historico,hoyISO,desdeISO){
  var h=historico||{};
  if(desdeISO){h=Object.keys(h).reduce(function(o,f){if(f>=desdeISO)o[f]=h[f];return o;},{});}
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
    var t=repararMojibake(String(o.turno)).trim();
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

// ═══ ANÁLISIS MTTR POR CATEGORÍA (2026-09-27) ═══
// Pedido real del usuario a partir de un diagrama de espina de pescado de
// Predyc sobre los factores que afectan la Mantenibilidad: el tiempo de
// reparación (MTTR) se pierde en 4 categorías — Acceso (izaje, ergonomía,
// accesibilidad), Diseño (intercambiabilidad, estandarización, modularidad),
// Información (diagnóstico, documentación, identificación) e Intervención
// (aislamiento, herramienta, repuesto y kit). Se agregó `categoriaMTTR` a
// Correctivos — mismo patrón ya usado con `tipoCausa`: una clasificación
// manual al cerrar la OT, nunca inferida ni inventada — para poder
// contestar con datos reales de la flota "¿en qué categoría se nos va más
// tiempo de reparación?" en vez de intuición.
//
// Reusa el mismo parseo de 'duracion' ("Xh...") que ya usa
// duracionesReparacionFlotaHoras/MTTR — mismo criterio de "duración real
// registrada" en todo el sistema, nunca se estima.
var _CATEGORIAS_MTTR=['Acceso','Diseño','Información','Intervención'];
function analisisMTTRPorCategoria(correctivos){
  var porCategoria={};
  (correctivos||[]).forEach(function(c){
    if(!c||_CATEGORIAS_MTTR.indexOf(c.categoriaMTTR)<0)return;
    if(!c.duracion||c.duracion==='—')return;
    var m=String(c.duracion).match(/(\d+)h/);
    if(!m)return;
    var horas=parseInt(m[1],10);
    (porCategoria[c.categoriaMTTR]=porCategoria[c.categoriaMTTR]||[]).push(horas);
  });
  return Object.keys(porCategoria).map(function(cat){
    var horas=porCategoria[cat];
    var total=horas.reduce(function(a,b){return a+b;},0);
    return{
      categoria:cat,
      nEventos:horas.length,
      horasTotales:total,
      horasPromedio:Math.round((total/horas.length)*10)/10
    };
  }).sort(function(a,b){return b.horasTotales-a.horasTotales;});
}

// ═══ CAPEX vs OPEX (2026-09-30) ═══ — a partir de un árbol de costos CAPEX/
// OPEX visto por el usuario. La clasificación contable de un gasto (si se
// capitaliza o se lleva a resultados) NO se puede inferir del texto libre
// de un correctivo — es un criterio de la empresa, no un dato técnico. Por
// eso 'clasificacionCosto' es un campo manual (mismo patrón que
// 'categoriaMTTR'/'tipoCausa'): se elige al cargar/editar la OT, nunca se
// asume. Sin clasificación cargada, el correctivo simplemente no entra al
// análisis — nunca se reparte a ciegas entre CAPEX/OPEX.
var _CLASIFICACIONES_COSTO=['CAPEX','OPEX'];
function analisisCapexOpex(correctivos){
  var porClase={};
  (correctivos||[]).forEach(function(c){
    if(!c||_CLASIFICACIONES_COSTO.indexOf(c.clasificacionCosto)<0)return;
    if(!(c.costo>0))return;
    (porClase[c.clasificacionCosto]=porClase[c.clasificacionCosto]||[]).push(c.costo);
  });
  var totalGeneral=Object.keys(porClase).reduce(function(s,k){return s+porClase[k].reduce(function(a,b){return a+b;},0);},0);
  return Object.keys(porClase).map(function(clase){
    var costos=porClase[clase];
    var total=costos.reduce(function(a,b){return a+b;},0);
    return{
      clasificacion:clase,
      nEventos:costos.length,
      costoTotal:Math.round(total),
      costoPromedio:Math.round(total/costos.length),
      pctDelTotal:totalGeneral?Math.round((total/totalGeneral)*1000)/10:0
    };
  }).sort(function(a,b){return b.costoTotal-a.costoTotal;});
}

// ═══ TRAZABILIDAD AVISO → ORDEN (2026-09-30) ═══ — a partir de un diagrama
// de terminología SAP (Aviso de Mantenimiento = el reporte de un problema;
// Orden de Mantenimiento = el trabajo real para resolverlo). En SistemaMP,
// 'informesFalla' (Informe de Falla Catastrófica / Cambio Componente Mayor)
// es el Aviso — el reporte de que algo pasó, hecho por quien está al lado
// del equipo. 'ot'/'otHist' (Correctivos) es la Orden — el registro real de
// la intervención de taller. HOY no existe ningún campo que los vincule:
// esta función busca, para cada Aviso, si hay una Orden real (mismo sigla,
// fecha dentro de 'ventanaDias') — NO usa _informesFallaComoOt (el puente
// que el resto del sistema usa para que un Aviso cuente como falla real en
// MTBF/Weibull/Pareto), porque acá la pregunta es la opuesta: si ese puente
// fuera la única "Orden" encontrada, todo Aviso se auto-vincularía consigo
// mismo y el análisis nunca detectaría nada. 'otReal' debe ser SOLO ot +
// _otHistComoOt(otHist), la Orden de verdad.
function trazabilidadAvisoOrden(informesFalla,otReal,ventanaDias){
  ventanaDias=ventanaDias>0?ventanaDias:3;
  var ventanaMs=ventanaDias*86400000;
  var ordenes=(otReal||[]).filter(function(o){return o&&o.sigla&&o.fecha;});
  return (informesFalla||[]).filter(function(i){return i&&i.sigla&&i.fecha;}).map(function(i){
    var tAviso=new Date(i.fecha).getTime();
    var vinculada=ordenes.some(function(o){
      if(o.sigla!==i.sigla)return false;
      var tOrden=new Date(o.fecha).getTime();
      return Math.abs(tOrden-tAviso)<=ventanaMs;
    });
    return{
      id:i.id,sigla:i.sigla,fecha:i.fecha,tipoEvento:i.tipoEvento,
      descripcion:i.descripcion,costoEstimado:i.costoEstimado||0,
      vinculada:vinculada
    };
  });
}

// Resumen agregado de trazabilidadAvisoOrden — cuántos Avisos quedaron sin
// ninguna Orden real detrás (reportados, pero nunca se cargó el trabajo que
// los resolvió). listaSinVincular ordenada por fecha más reciente primero.
function resumenTrazabilidadAvisoOrden(trazabilidad){
  var lista=trazabilidad||[];
  var sinVincular=lista.filter(function(t){return !t.vinculada;});
  return{
    total:lista.length,
    vinculados:lista.length-sinVincular.length,
    sinVincular:sinVincular.length,
    pctSinVincular:lista.length?Math.round((sinVincular.length/lista.length)*1000)/10:null,
    listaSinVincular:sinVincular.slice().sort(function(a,b){return (b.fecha||'').localeCompare(a.fecha||'');})
  };
}

// ═══ TIEMPO DE RESPUESTA POR PROVEEDOR + PEDIDOS POTENCIALMENTE TRABADOS
// (2026-09-30) ═══ — pedido real del usuario tras importar 8.628 líneas
// reales de Compras (despacho.xlsx + OC.xlsx, 2021-2026): "podemos sacar
// mucha información, ejemplo tiempo de respuesta, costo, proveedores,
// consumo". El campo 'Tiempo' (columna 'tiempoRespuesta') significa algo
// distinto según 'estado': en 'Recepcion Bodega' es un ciclo YA CERRADO
// (Pedido → llegó a bodega) — sirve para medir tiempo de respuesta real.
// En 'OC Firmada'/'OC por Firmar' es tiempo transcurrido HASTA AHORA, de un
// pedido que sigue abierto — no sirve para promediar tiempo de respuesta
// (sesgaría a la baja: los pedidos lentos que siguen abiertos no están
// "terminados" todavía), pero sí sirve para detectar cuáles ya llevan más
// tiempo del normal y probablemente están trabados.
//
// _parsearTiempoRespuestaDias: el texto real tiene formato "X dias Yh Zm"
// (cualquier parte puede faltar, ej. "1 dia 1h 0m"). Se convierte todo a
// días (horas/24 + minutos/1440) para que el resultado sea comparable —
// estos plazos se miden en días, no en horas como el MTTR de taller.
function _parsearTiempoRespuestaDias(texto){
  if(!texto)return null;
  var s=String(texto);
  var mD=s.match(/(\d+)\s*d[ií]as?/i);
  var mH=s.match(/(\d+)\s*h/i);
  var mM=s.match(/(\d+)\s*m(?!es)/i);
  if(!mD&&!mH&&!mM)return null;
  var dias=mD?parseInt(mD[1],10):0;
  var horas=mH?parseInt(mH[1],10):0;
  var min=mM?parseInt(mM[1],10):0;
  return Math.round((dias+horas/24+min/1440)*10)/10;
}

// Tiempo de respuesta real por proveedor: SOLO 'Recepcion Bodega' (ciclo
// cerrado) — nunca mezcla pedidos todavía abiertos, que sesgarían el
// promedio a la baja. Por proveedor: nPedidos, diasPromedio, diasMediana
// (más robusta a un pedido excepcionalmente lento/rápido) y costoTotal
// (misma tanda de datos, responde también la pregunta de costo por
// proveedor). Ordenado de mayor a menor diasPromedio — el proveedor más
// lento primero, el más accionable para una conversación real.
function tiempoRespuestaPorProveedor(comprasDetalle){
  var porProveedor={};
  (comprasDetalle||[]).forEach(function(c){
    if(!c||c.estado!=='Recepcion Bodega'||!c.proveedor)return;
    var dias=_parsearTiempoRespuestaDias(c.tiempoRespuesta);
    if(dias==null)return;
    var g=(porProveedor[c.proveedor]=porProveedor[c.proveedor]||{dias:[],costo:0});
    g.dias.push(dias);
    g.costo+=(c.costo>0?c.costo:0);
  });
  return Object.keys(porProveedor).map(function(prov){
    var g=porProveedor[prov];
    var total=g.dias.reduce(function(a,b){return a+b;},0);
    return{
      proveedor:prov,
      nPedidos:g.dias.length,
      diasPromedio:Math.round((total/g.dias.length)*10)/10,
      diasMediana:medianaPositiva(g.dias),
      costoTotal:Math.round(g.costo)
    };
  }).sort(function(a,b){return b.diasPromedio-a.diasPromedio;});
}

// Pedidos potencialmente trabados: de los todavía ABIERTOS ('OC Firmada'/
// 'OC por Firmar'), cuáles ya llevan más días transcurridos que lo normal
// para ESE proveedor (mediana real de sus pedidos ya cerrados, calculada
// arriba) — con mínimo de 'minMuestraProveedor' pedidos cerrados de
// referencia; si el proveedor no tiene esa mínima muestra propia, usa la
// mediana global de TODOS los proveedores como respaldo (mismo patrón que
// hhPlanEstimator: equipo+tipo primero, flota como respaldo). Un pedido se
// marca trabado si sus días transcurridos superan la referencia ×
// factorAlerta (default 1.5 — 50% más lento que lo típico de ese
// proveedor). Nunca inventa una referencia sin al menos 1 dato real.
function pedidosPotencialmenteTrabados(comprasDetalle,factorAlerta,minMuestraProveedor){
  factorAlerta=factorAlerta>0?factorAlerta:1.5;
  minMuestraProveedor=minMuestraProveedor>0?minMuestraProveedor:3;
  var lista=comprasDetalle||[];
  var porProveedorDias={};
  var todasDias=[];
  lista.forEach(function(c){
    if(!c||c.estado!=='Recepcion Bodega')return;
    var dias=_parsearTiempoRespuestaDias(c.tiempoRespuesta);
    if(dias==null)return;
    todasDias.push(dias);
    if(c.proveedor)(porProveedorDias[c.proveedor]=porProveedorDias[c.proveedor]||[]).push(dias);
  });
  var medianaGlobal=medianaPositiva(todasDias);
  var abiertos=lista.filter(function(c){return c&&(c.estado==='OC Firmada'||c.estado==='OC por Firmar');});
  var resultado=abiertos.map(function(c){
    var diasTranscurridos=_parsearTiempoRespuestaDias(c.tiempoRespuesta);
    if(diasTranscurridos==null)return null;
    var historicoProveedor=porProveedorDias[c.proveedor]||[];
    var usaRespaldo=historicoProveedor.length<minMuestraProveedor;
    var referencia=usaRespaldo?medianaGlobal:medianaPositiva(historicoProveedor);
    if(referencia==null)return null;
    return{
      pedido:c.pedido,sigla:c.sigla,proveedor:c.proveedor,estado:c.estado,
      detalle:c.detalle,diasTranscurridos:diasTranscurridos,
      diasReferencia:referencia,usaRespaldoGlobal:usaRespaldo,
      trabado:diasTranscurridos>referencia*factorAlerta
    };
  }).filter(Boolean);
  return resultado.filter(function(r){return r.trabado;})
    .sort(function(a,b){return(b.diasTranscurridos-b.diasReferencia)-(a.diasTranscurridos-a.diasReferencia);});
}

// ═══ TIEMPO DE APROBACIÓN INTERNA DE OC (2026-09-30) ═══ — el usuario
// aclaró un dato clave: la OC se envía al proveedor AUTOMÁTICAMENTE el
// mismo día en que se aprueba/firma — no hay una demora propia de "envío"
// separada de la aprobación. Eso significa que 'fechaEstado' de un pedido
// que está HOY en estado 'OC Firmada' SÍ es la fecha real de envío al
// proveedor, y 'fecha' es la fecha del Pedido/solicitud interna — la resta
// entre ambas es el tiempo INTERNO real (Pedido → aprobación/envío), la
// parte del ciclo que la empresa controla y que afecta la capacidad de
// respuesta para reparaciones, sin mezclar el tiempo que después demora
// el proveedor en despachar.
//
// Limitación real, no resuelta: esto solo es reconstruible para pedidos
// que HOY siguen en 'OC Firmada' (fechaEstado = su fecha de aprobación).
// Para un pedido que YA llegó a 'Recepcion Bodega', el dato exportado es
// un único snapshot del estado actual — la fecha en que se firmó la OC ya
// no está en ese registro (se perdió al pasar de estado), así que no se
// puede reconstruir el tiempo interno histórico de pedidos ya cerrados
// con los datos de hoy. Se agrupa por 'comprador' (bien poblado en estos
// datos, a diferencia de 'tipo'/Clasificación) porque el tiempo interno
// depende de quién gestiona la compra, no del proveedor.
function tiempoAprobacionOC(comprasDetalle){
  var porComprador={};
  (comprasDetalle||[]).forEach(function(c){
    if(!c||c.estado!=='OC Firmada'||!c.fecha||!c.fechaEstado)return;
    var dias=_diasEntreISO(c.fecha,c.fechaEstado);
    if(dias<0)return;
    var comprador=c.comprador||'Sin asignar';
    (porComprador[comprador]=porComprador[comprador]||[]).push(dias);
  });
  return Object.keys(porComprador).map(function(comprador){
    var dias=porComprador[comprador];
    var total=dias.reduce(function(a,b){return a+b;},0);
    return{
      comprador:comprador,
      nPedidos:dias.length,
      diasPromedio:Math.round((total/dias.length)*10)/10,
      diasMediana:medianaPositiva(dias)
    };
  }).sort(function(a,b){return b.diasPromedio-a.diasPromedio;});
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
  window.porcentajeCorrectivoReactivo = porcentajeCorrectivoReactivo;
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
  window.matrizJackKnife = matrizJackKnife;
  window.dispIntrinsecaEquipoMes = dispIntrinsecaEquipoMes;
  window.tasaFallaPorUbicacion = tasaFallaPorUbicacion;
  window.edadVirtualEquipo = edadVirtualEquipo;
  window.costoRelativoMantenimiento = costoRelativoMantenimiento;
  window.costoRelativoMantenimientoFlota = costoRelativoMantenimientoFlota;
  window.costoSugeridoPorCruce = costoSugeridoPorCruce;
  window.senalUnificadaReemplazo = senalUnificadaReemplazo;
}
// ═══ CALIDAD DE EJECUCIÓN: RE-TRABAJO DEL MISMO SISTEMA TRAS UN PM (2026-10-09) ═══
// Pregunta: después de un PM, ¿falla DE NUEVO el mismo sistema que ese PM cubría, más de
// lo normal para ESE equipo? Es DESCRIPTIVO: no corrige ninguna curva ni evalúa personas.
// Reglas del dominio (ver arquitectura.md, "Reglas del dominio que no hay que volver a
// deducir"): las pautas son ACUMULATIVAS (un PM2 hace lo de PM1 + PM2...) y varios
// equipos comparten pauta (GRUPO_PAUTAS, que llega por parámetro: vive en index.html).
// Método (el mismo que se validó contra los datos reales con SQL):
//  - "Cubierto": el sistema aparece (por palabras clave) en las actividades de la pauta
//    acumulada de ese equipo y tipo de PM.
//  - Evento: una falla real (esFallaMTBF) del MISMO equipo y MISMO sistema entre 1 y H
//    días DESPUÉS de la salida del PM — el mismo día no cuenta (es la misma visita).
//  - Esperado: la fracción de días de ese equipo y sistema que normalmente tienen una
//    falla en los H días siguientes (su propia línea base), así un equipo que falla
//    mucho no se confunde con un PM mal hecho.
//  - Los PM de los últimos H días antes de la última falla cargada se excluyen: su
//    ventana todavía no está completa y subestimarían el re-trabajo (censura).
// LÍMITE a la hora de interpretar: que un sistema falle más tras un PM no prueba mala
// ejecución — el PM también puede destapar fallas que se corrigen en los días siguientes.
var PM_ACUMULADOS={PM1:['PM1'],PM2:['PM1','PM2'],PM3:['PM1','PM2','PM3'],PM4:['PM1','PM2','PM3','PM4'],
  PM5:['PM1','PM2','PM3','PM4'],PM6:['PM1','PM2','PM3','PM4'],PM7:['PM1','PM2','PM3','PM4'],
  PM8:['PM1','PM2','PM3','PM4'],PM9:['PM1','PM2','PM3','PM4']};
var SISTEMAS_PM=[
  {id:'motor',nombre:'Motor',re:/motor|combustible|refriger|ventilador|radiador|turbo|aire/},
  {id:'hidraulico',nombre:'Hidráulico',re:/hidr/},
  {id:'frenos',nombre:'Frenos',re:/freno|zapata|tambor|chicharra/},
  {id:'neumatico',nombre:'Neumáticos',re:/neum|rueda|llanta/},
  {id:'electrico',nombre:'Eléctrico',re:/bater|alternador|luces|ctrico|bornes|cable/},
  {id:'transmision',nombre:'Transmisión',re:/transmis|diferencial|\bejes?\b|cardan|mando final/}
];
function _normTextoSistema(t){
  return String(t==null?'':t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
}
// Texto libre (actividad de pauta o campo "sistema" de un correctivo) → ids de sistema.
// Aproximado por palabras clave; tolera texto mal codificado ("ElÃ©ctrico") porque las
// palabras clave evitan las letras con tilde.
function sistemasDeTexto(txt){
  var t=_normTextoSistema(txt);
  if(!t.trim())return [];
  return SISTEMAS_PM.filter(function(s){return s.re.test(t);}).map(function(s){return s.id;});
}
// Sistemas que cubre un PM de ese tipo para ese equipo, con la pauta acumulativa.
// hayPauta=false → el equipo no tiene ninguna fila de pauta (no se puede evaluar).
function sistemasCubiertosPorPM(pautas,sigla,tipoPM,grupoPautas){
  var grupo=grupoPautas||{};
  var ref=grupo[sigla]||sigla;
  var tipo=String(tipoPM||'').toUpperCase().trim();
  var lista=PM_ACUMULADOS[tipo]||[tipo];
  var set={},hay=false;
  (pautas||[]).forEach(function(p){
    var pref=grupo[p.sigla]||p.sigla;
    if(pref!==ref&&p.sigla!==ref)return;
    hay=true;
    if(lista.indexOf(p.pm)<0)return;
    sistemasDeTexto((p.act||'')+' '+(p.rep||'')).forEach(function(id){set[id]=1;});
  });
  return{sistemas:Object.keys(set),hayPauta:hay};
}
function _diaNumCE(f){
  var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(f||''));
  if(!m)return null;
  var d=Date.UTC(+m[1],+m[2]-1,+m[3]);
  return isNaN(d)?null:Math.round(d/86400000);
}
function _diaAFechaCE(n){return new Date(n*86400000).toISOString().slice(0,10);}
function _franjaHoraCE(hora){
  var m=/^(\d{1,2}):/.exec(String(hora||''));
  if(!m)return 'sin_hora';
  var h=+m[1];
  return h<6?'00-06':h<12?'06-12':h<18?'12-18':'18-24';
}
// Razón observado/esperado con rango de confianza 95% (más exigente que el 90% del resto del sistema: acá se comparan muchos grupos a la vez y con 90% saldrían señales por casualidad) (aproximación log-normal de un
// conteo de Poisson). Con menos de 10 eventos observados NO se calcula rango ni se
// emite lectura: sería ruido con apariencia de dato.
function _lecturaRazonCE(obs,esp,z){
  var out={obs:obs,esp:Math.round(esp*10)/10,razon:null,ic95:null,senal:'insuficiente'};
  if(!(esp>0))return out;
  out.razon=Math.round(obs/esp*100)/100;
  if(obs<10)return out;
  var f=Math.exp((z||1.96)/Math.sqrt(obs));
  var r=obs/esp;
  out.ic95=[Math.round(r/f*100)/100,Math.round(r*f*100)/100];
  out.senal=out.ic95[0]>1?'sobre':out.ic95[1]<1?'bajo':'no_concluyente';
  return out;
}
// Un grupo contra "todo lo demás" de su misma dimensión (ej. madrugada vs el resto del día).
function _relativoCE(g,resto){
  var o={razon:null,ic95:null,senal:'insuficiente'};
  if(!(g.esp>0)||!(resto.esp>0)||g.obs<10||resto.obs<10)return o;
  var r=(g.obs/g.esp)/(resto.obs/resto.esp);
  var f=Math.exp(1.96*Math.sqrt(1/g.obs+1/resto.obs));
  o.razon=Math.round(r*100)/100;
  o.ic95=[Math.round(r/f*100)/100,Math.round(r*f*100)/100];
  o.senal=o.ic95[0]>1?'sobre':o.ic95[1]<1?'bajo':'no_concluyente';
  return o;
}
// Cuántos días de [d0,dEnd] tienen al menos una falla en los H días siguientes: unión de
// los intervalos [f-H, f-1] recortada al período (así no se recorre día por día).
function _fraccionDiasConFallaCE(fechas,d0,dEnd,H){
  var total=dEnd-d0+1;
  if(total<=0||!fechas||!fechas.length)return 0;
  var iv=fechas.map(function(f){return[Math.max(f-H,d0),Math.min(f-1,dEnd)];})
    .filter(function(x){return x[0]<=x[1];}).sort(function(a,b){return a[0]-b[0];});
  var cubiertos=0,ini=null,fin=null;
  iv.forEach(function(x){
    if(ini===null){ini=x[0];fin=x[1];}
    else if(x[0]<=fin+1){if(x[1]>fin)fin=x[1];}
    else{cubiertos+=fin-ini+1;ini=x[0];fin=x[1];}
  });
  if(ini!==null)cubiertos+=fin-ini+1;
  return cubiertos/total;
}
function calidadEjecucionPM(registros,correctivos,pautas,opts){
  opts=opts||{};
  var H=opts.horizonteDias||7;
  var grupo=opts.grupoPautas||{};
  // 1) Fallas reales por equipo+sistema, y la última falla cargada (para la censura).
  var fallas={},maxDia=null;
  (correctivos||[]).forEach(function(o){
    if(!esFallaMTBF(o))return;
    var d=_diaNumCE(o.fechaEntrada||o.fecha);
    if(d==null)return;
    if(maxDia===null||d>maxDia)maxDia=d;
    sistemasDeTexto(o.sistema).forEach(function(id){
      var k=o.sigla+'|'+id;
      (fallas[k]=fallas[k]||[]).push(d);
    });
  });
  var pms=[];
  (registros||[]).forEach(function(r){
    var tipo=String(r.tipoPM||'').toUpperCase().trim();
    if(!/^PM[1-9]$/.test(tipo))return;
    var dEnt=_diaNumCE(r.fechaEntrada);
    if(dEnt==null)return;
    var dPM=_diaNumCE(r.fechaSalida);
    pms.push({r:r,tipo:tipo,dEnt:dEnt,dPM:dPM==null?dEnt:dPM});
  });
  if(maxDia===null||!pms.length)return{sinDatos:true};
  var corte=maxDia-H;
  var d0=pms.reduce(function(m,p){return Math.min(m,p.dEnt);},Infinity);
  var baseCache={};
  function base(sigla,id){
    var k=sigla+'|'+id;
    if(!(k in baseCache))baseCache[k]=_fraccionDiasConFallaCE(fallas[k],d0,corte,H);
    return baseCache[k];
  }
  function hayFalla(sigla,id,desde,hasta){
    var arr=fallas[sigla+'|'+id];
    if(!arr)return false;
    for(var i=0;i<arr.length;i++)if(arr[i]>=desde&&arr[i]<=hasta)return true;
    return false;
  }
  var dims={franja:{},tipo:{},pauta:{}};
  var total={pm:{},obs:0,esp:0};
  function acum(dim,clave,pmId,obs,esp){
    var g=dims[dim][clave]=dims[dim][clave]||{pm:{},obs:0,esp:0};
    g.pm[pmId]=1;g.obs+=obs;g.esp+=esp;
  }
  var nPM=0,sinPauta=0,idx=0;
  pms.forEach(function(p){
    if(p.dEnt>corte)return;           // ventana incompleta (censura)
    nPM++;
    var cov=sistemasCubiertosPorPM(pautas,p.r.equipo,p.tipo,grupo);
    if(!cov.hayPauta){sinPauta++;return;}
    if(!cov.sistemas.length)return;
    var id=idx++;
    var franja=_franjaHoraCE(p.r.horaEntrada);
    var tipoGrupo='PM'+Math.min(+p.tipo.slice(2),4);
    var pautaGrupo=estadoPMCompleto(p.r).estado;
    cov.sistemas.forEach(function(s){
      var obs=hayFalla(p.r.equipo,s,p.dPM+1,p.dPM+H)?1:0;
      var esp=base(p.r.equipo,s);
      total.pm[id]=1;total.obs+=obs;total.esp+=esp;
      acum('franja',franja,id,obs,esp);
      acum('tipo',tipoGrupo,id,obs,esp);
      acum('pauta',pautaGrupo,id,obs,esp);
    });
  });
  function armar(dim,orden){
    var claves=orden.filter(function(k){return dims[dim][k];});
    return claves.map(function(k){
      var g=dims[dim][k];
      var resto={obs:0,esp:0};
      claves.forEach(function(k2){if(k2!==k){resto.obs+=dims[dim][k2].obs;resto.esp+=dims[dim][k2].esp;}});
      var l=_lecturaRazonCE(g.obs,g.esp);
      l.clave=k;l.nPM=Object.keys(g.pm).length;
      l.vsResto=_relativoCE(g,resto);
      return l;
    });
  }
  var tl=_lecturaRazonCE(total.obs,total.esp);
  tl.nPM=Object.keys(total.pm).length;
  return{
    sinDatos:false,horizonteDias:H,corteFecha:_diaAFechaCE(corte),
    nPM:nPM,nPMSinPauta:sinPauta,total:tl,
    porFranja:armar('franja',['00-06','06-12','12-18','18-24','sin_hora']),
    porTipoPM:armar('tipo',['PM1','PM2','PM3','PM4']),
    porPautaCompleta:armar('pauta',['completo','incompleto','sin_dato'])
  };
}

// ═══ CLASIFICACIÓN PENDIENTE DE OT (2026-10-09, paso 3 de Calidad de Ejecución) ═══
// Dos datos que casi ninguna OT tiene y que el análisis de calidad necesita: el Tipo de Causa
// (Física/Humana/Latente — vacío en el 100% de los correctivos reales) y el Sistema (vacío en
// ~23%: los caminos rápidos —Registro Rápido, correctivo desde un PM, fuera de servicio— crean
// la OT con sistema '' y la tabla no tenía dónde completarlo después). Mismo universo que la
// tarjeta "Cerradas sin solución": correctivos y fallas operacionales cerradas.
function _otEnUniversoClasificacion(o){
  return !!o&&(!o.estadoOT||o.estadoOT==='Cerrada')&&(o.tipo==='Correctivo'||o.tipo==='Falla Operacional');
}
function clasificacionPendienteOT(o){
  if(!_otEnUniversoClasificacion(o))return{enUniverso:false,sinSistema:false,sinTipoCausa:false};
  return{enUniverso:true,sinSistema:!String(o.sistema||'').trim(),sinTipoCausa:!String(o.tipoCausa||'').trim()};
}
function resumenClasificacionOT(ot){
  var r={cerradas:0,sinSistema:0,sinTipoCausa:0,pendientes:0};
  (ot||[]).forEach(function(o){
    var c=clasificacionPendienteOT(o);
    if(!c.enUniverso)return;
    r.cerradas++;
    if(c.sinSistema)r.sinSistema++;
    if(c.sinTipoCausa)r.sinTipoCausa++;
    if(c.sinSistema||c.sinTipoCausa)r.pendientes++;
  });
  r.pctSinSistema=r.cerradas?Math.round(r.sinSistema/r.cerradas*100):0;
  r.pctSinTipoCausa=r.cerradas?Math.round(r.sinTipoCausa/r.cerradas*100):0;
  return r;
}
// Texto guardado con la codificación equivocada ("DÃ­a" en vez de "Día", "ElÃ©ctrico"): UTF-8
// leído como Latin-1. Se corrigió en la base (migración reparar_codificacion_correctivos); esto
// es la red de seguridad para que una futura importación mal codificada no parta un grupo en
// dos (ej. el chi-cuadrado por turno contaba "Día" y "DÃ­a" como turnos distintos).
function repararMojibake(txt){
  var t=String(txt==null?'':txt);
  if(!/[ÂÃ][\u0080-¿]/.test(t))return t;
  try{
    var bytes=[];
    for(var i=0;i<t.length;i++){var c=t.charCodeAt(i);if(c>255)return t;bytes.push(c);}
    var dec=new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(bytes));
    return /Ã/.test(dec)?t:dec;
  }catch(e){return t;}
}

// ═══ ¿PM COMPLETO SEGÚN PAUTA? (2026-10-09) ═══
// Propuesta de "Calidad de Ejecución": la pauta dice lo que DEBERÍA hacerse en un PM,
// pero el registro nunca guardó si se hizo todo (ni qué faltó, ej. un filtro secundario
// por quiebre de stock). Dos campos opcionales en registros_pm: pmCompleto (true/false/
// null) y queFalto (texto). null = registro anterior a este campo → "sin dato", NUNCA se
// cuenta como completo ni como incompleto: contarlo como completo inflaría la calidad.
function validarPMCompleto(completo,queFalto){
  if(completo===false&&!String(queFalto||'').trim())return 'Indica qué faltó de la pauta (o marca "Sí" si se hizo todo)';
  return null;
}
function estadoPMCompleto(r){
  var c=r?r.pmCompleto:null;
  if(c===true)return{estado:'completo',faltante:''};
  if(c===false)return{estado:'incompleto',faltante:String(r.queFalto||'').trim()};
  return{estado:'sin_dato',faltante:''};
}

// ═══ TBO KOMATSU (TBO_Besalco_Mineria_jun_24.xlsm) ═══
// Plan de cambio por horas del fabricante (TBO = Time Between Overhaul) para los modelos
// Komatsu de Besalco Centinela, cruzado contra las compras reales. DATOS: hojas Camiones/Cargadores/
// Bulldozers (TBO de aplicación 'Normal') y 'Sugerido' (27 repuestos HD785-7, precios en USD).
// IMPORTANTE: los 'N° de cambios' del Excel son TEÓRICOS (horómetro ÷ TBO), no hay historial real de
// cambios en ese archivo — acá se recalculan con el horómetro vivo de cada equipo.
const TBO_FAMILIAS=[["correas", "Correas (V-BELT)"], ["alternador", "Alternador"], ["partida", "Motor de partida"], ["turbo", "Turbo"], ["inyeccion", "Inyectores / bomba de inyección"], ["combustible", "Bomba y estanque de combustible"], ["agua", "Bomba de agua"], ["aire", "Aire acondicionado / compresor"], ["cilindros", "Cilindros hidráulicos"], ["valvulas", "Válvulas / acumuladores / mandos"], ["mangueras", "Mangueras y cañerías"], ["enfriamiento", "Radiador / enfriamiento"], ["bombas", "Bombas hidráulicas"], ["frenos", "Frenos"], ["tren", "Tren de fuerza (transmisión, diferencial, mandos finales)"], ["motor", "Motor (partes) y amortiguador"], ["suspension", "Suspensión y dirección"], ["cabina", "Cabina y asiento"], ["electrico", "Sistema eléctrico / electrónico"], ["estructura", "Estructura (tolva, bastidor, pasadores)"], ["engrase", "Sistema de engrase"], ["aro", "Aros y llantas"]];
const TBO_FUERA=[["rodado", "Tren de rodado (cadenas, zapatas, rodillos)"], ["desgaste", "Desgaste de balde / hoja (dientes, planchas)"], ["lubricantes", "Filtros, aceites y lubricantes"], ["menores", "Sellos, rodamientos y fijaciones (pernos, tuercas)"], ["servicios", "Servicios (montaje, desmontaje, reparación)"], ["otros", "Otros (sin clasificar)"]];
// [familia, ítem (inglés, como en el Excel), TBO de aplicación en horas] por clase de equipo
const TBO_ITEMS={"camion":[["correas","V-BELT",2000],["alternador","ALTERNATOR",8000],["inyeccion","FUEL INJECTOR",8000],["inyeccion","FUEL PIPING CLAMP & CAP",8000],["mangueras","SAFETY RELATED HOSES- 30%",8000],["partida","STARTING MOTOR",8000],["turbo","TURBOCHARGER (L)",8000],["turbo","TURBOCHARGER (R)",8000],["agua","WATER PUMP",8000],["aire","AIR CONDITIONING SYSTEM",8000],["mangueras","SAFETY RELATED HOSES- 100%",12000],["mangueras","ACCUMULATOR PIPING",12000],["mangueras","AUTO SUSPENSION PIPING",12000],["mangueras","BRAKE COOLING OIL LINE",12000],["mangueras","BRAKE PIPING",12000],["mangueras","BRAKE PIPING (ABS)",12000],["mangueras","HYD TANK & VALVE & PIPING",12000],["bombas","PUMP ASSY- BRAKE COOLING FRONT",12000],["bombas","PUMP ASSY- BRAKE COOLING REAR",12000],["bombas","PUMP- STEERING",12000],["cabina","CABIN & INTERNAL",16000],["valvulas","CONTROL-PEDAL,LINKAGE",16000],["enfriamiento","COOLING SYS-RADIATOR, ETC",16000],["enfriamiento","COOLING SYSTEM",16000],["mangueras","COOLING SYSTEM PIPING",16000],["motor","DAMPER",16000],["estructura","DUMP BODY",16000],["electrico","ELECTRICAL SYSTEM",16000],["combustible","FUEL PUMP ASSY (L-R)",16000],["motor","ENGINE ASSY",16000],["motor","ENGINE RELATED PARTS",16000],["tren","FINAL DRIVE ASSY-REAR",16000],["frenos","FRONT AXLE BRAKE (L)",16000],["frenos","FRONT AXLE BRAKE (R)",16000],["tren","FRONT DRIVE SHAFT",16000],["suspension","FRONT SUSPENSION ASSY (L)",16000],["suspension","FRONT SUSPENSION ASSY (R)",16000],["combustible","FUEL TANK & RELATED PARTS",16000],["cilindros","HOIST CYLINDER",16000],["bombas","HYD PUMP- EMERGENCY S/T",16000],["bombas","HYD PUMP-T/C & T/M",16000],["estructura","MAIN FRAME & HITCH FRAME",16000],["bombas","PUMP ASSY-BRAKE COOLING",16000],["mangueras","RADIATOR PIPING",16000],["tren","REAR AXLE HOUSING",16000],["tren","REAR DIFFERENTIAL",16000],["tren","REAR DRIVE SHAFT",16000],["frenos","REAR FINAL BRAKE",16000],["frenos","REAR FINAL BRAKE (ABS)",16000],["aro","RIM- FRONT",16000],["aro","RIM- REAR",16000],["suspension","STEERING COLUMN",16000],["cilindros","STEERING CYLINDER",16000],["suspension","SUSPENSION ASSY-REAR",16000],["tren","TORQUE CONVERTER",16000],["tren","TRANSMISSION ASSY",16000],["valvulas","WHEEL RIMS- FRONT LARGE VALVE",16000],["valvulas","WHEEL RIMS- REAR LARGE VALVE",16000]],"cargador":[["correas","V-BELT",2000],["alternador","ALTERNATOR-75A",8000],["inyeccion","FUEL INJECTOR",8000],["inyeccion","FUEL PIPING CLAMP & CAP",8000],["mangueras","RADIATOR PIPING",8000],["mangueras","SAFETY RELATED HOSES 30%",8000],["partida","STARTING MOTOR-11KW",8000],["turbo","TURBOCHARGER",8000],["agua","WATER PUMP",8000],["aire","AIR CONDITIONING SYSTEM",8000],["tren","AXLE FINAL DRIVE-REAR",16000],["bombas","BRAKE COOLING PUMP",16000],["tren","DIFFERENTIAL-FRONT",16000],["tren","DIFFERENTIAL-REAR",16000],["tren","DRIVE SHAFT",16000],["tren","FINAL DRIVE ASSY-FRONT",16000],["bombas","HYD COOLING PUMP",16000],["tren","REAR AXLE SUPPORT",16000],["estructura","SAFETY CRITICAL PARTS- NO4",16000],["enfriamiento","FAN MOTOR",16000],["frenos","TRANSFER & PARKING BREAKE",16000],["enfriamiento","FAN PUMP",16000],["valvulas","ACCUMULATOR- BRAKE",16000],["estructura","BOOM- BELLCRANK",16000],["valvulas","BRAKE CONTROL",16000],["frenos","BRAKE COOLING SYSTEM",16000],["cilindros","BUCKET CYLINDER",16000],["enfriamiento","COOLING SYSTEM",16000],["electrico","ELECTRICAL SYSTEM",16000],["frenos","EMERGENCY P BRAKE- COOLING",16000],["frenos","EMERGENCY PARKING BRAKE",16000],["suspension","EMERGENCY STEERING",16000],["motor","ENGINE ASSY",16000],["motor","ENGINE RELATED PARTS",16000],["tren","TORQUE CONVERTER",16000],["tren","TRANSMISSION ASSY",16000],["estructura","FRAME-FRONT-REAR",16000],["inyeccion","FUEL INJECTION PUMP",16000],["combustible","FUEL TANK & PIPING",16000],["estructura","HINGE PIN",16000],["mangueras","HOSE & PIPES-COOLING",16000],["mangueras","HOSE & PIPES-EMER. STG",16000],["mangueras","HOSE & PIPES-PUMP DRAIN",16000],["mangueras","HOSE & PIPES-PUMP SUCTION",16000],["mangueras","HOSE & PIPES-STEERING",16000],["valvulas","HYD CONTROL VALVE- 3SPOOL",16000],["mangueras","HYD TANK & PIPING",16000],["valvulas","JOY STICK- STEERING SYSTEM",16000],["cilindros","LIFT CYLINDER (L)",16000],["cilindros","LIFT CYLINDER (R)",16000],["valvulas","MAIN VALVE- 2SPOOL",16000],["mangueras","PIPING- ACCUMULATOR",16000],["cilindros","PIPING- BUCKET CYLINDER",16000],["mangueras","PIPING- DELIVERY (3SPOOL)",16000],["mangueras","PIPING- DELIVERY (COOLING)",16000],["cilindros","PIPING- LIFT CYLINDER",16000],["mangueras","PIPING- PPC LINE (3SPOOL)",16000],["mangueras","PIPING- RETURN",16000],["mangueras","PIPING-FAN DRIVE",16000],["mangueras","PIPING-PPC LINE",16000],["bombas","PPC PUMP",16000],["bombas","PPC PUMP- BRAKE COOLING",16000],["bombas","PUMP-EMERGENCY STEERING",16000],["bombas","PUMP-LOADER",16000],["bombas","PUMP-STEERING",16000],["enfriamiento","RADIATOR",16000],["engrase","REMOTE GREASE SYSTEM",16000],["valvulas","S/T & T/M CONTROL",16000],["cilindros","STEERING CYLINDERS (L)",16000],["cilindros","STEERING CYLINDERS (R)",16000],["aro","WHEEL RIM",16000]],"bulldozer":[["correas","V-BELT",2000],["alternador","ALTERNATOR-75A",8000],["inyeccion","FUEL PIPING CLAMP & CAP",8000],["partida","STARTING MOTOR-11KW",8000],["turbo","TURBOCHARGER",8000],["agua","WATER PUMP",8000],["inyeccion","FUEL INJECTOR",8000],["aire","AIR CONDITIONING SYSTEM",8000],["mangueras","SAFETY RELATED HOSES- 30%",8000],["cilindros","BLADE LIFT CYLINDER",16000],["cilindros","BLADE TILT CYLINDER",16000],["cilindros","RIPPER LIFT CYLINDER",16000],["cilindros","RIPPER PIN PULLER CYLINDER",16000],["cilindros","RIPPER TILT CYLINDER",16000],["valvulas","CONTROL VALVE",16000],["cilindros","CYLINDER YOKE",16000],["electrico","ELECTRICAL SYSTEM",16000],["suspension","EQUALIZER BAR",16000],["enfriamiento","FAN MOTOR",16000],["enfriamiento","FAN PUMP",16000],["inyeccion","FUEL INJECTION PUMP",16000],["mangueras","SAFETY RELATED HOSES- 100%",16000],["enfriamiento","COOLING SYSTEM",16000],["mangueras","COOLING SYSTEM PIPING",16000],["combustible","FUEL TANK PIPING",16000],["enfriamiento","RADIATOR",16000],["mangueras","RADIATOR PIPING",16000],["bombas","HSS PUMP ASSY",16000],["bombas","HST MOTOR",16000],["mangueras","HYD PIPING- BLADE TILT (DUAL)",16000],["mangueras","HYD PIPING- FAN DRIVE",16000],["mangueras","HYD PIPING-BLADE LIFT",16000],["mangueras","HYD PIPING-BLADE TILT",16000],["mangueras","HYD PIPING-DELIVERY",16000],["mangueras","HYD PIPING-DRAIN",16000],["mangueras","HYD PIPING-PIN PULLER GR",16000],["mangueras","HYD PIPING-PIN PULLER MR",16000],["mangueras","HYD PIPING-RIPPER",16000],["mangueras","HYD PIPING-SUCTION",16000],["estructura","HYDRAULIC TANK",16000],["estructura","MAIN FRAME",16000],["cabina","OPERATOR CAB",16000],["estructura","PIVOT SHAFT",16000],["mangueras","POWER LINE PIPING",16000],["mangueras","POWER LINE PIPING-CONCENTRRATED",16000],["bombas","PUMP ASSY-POWER LINE",16000],["bombas","PUMP ASSY-SCAVENGING",16000],["motor","DAMPER",16000],["motor","ENGINE",16000],["motor","ENGINE MOUNT",16000],["tren","FINAL DRIVE (L)",16000],["tren","FINAL DRIVE (R)",16000],["tren","POWER TAKE OFF",16000],["suspension","STEERING SYSTEM",16000],["tren","TORQUE CONVERTER",16000],["tren","TRANSMISSION",16000],["tren","UNIVERSAL JOINT",16000]]};
// Reglas de clasificación de una línea de compra (orden = prioridad, gana la primera que calce)
const TBO_REGLAS_COMPRA=[["rodado", "cadena|zapata|rodillo|rueda gu|sprocket|idle?a?r|eslab[oó]n|tensora|rueda motriz"], ["desgaste", "entrediente|diente|segmento|cuchilla|cant[oó]n|half arrow|labio|plancha|perno cuch|u[ñn]a "], ["lubricantes", "filtro|delvac|litros?($|[^a-z])|grasa|lubric|refrigerante|coolant"], ["correas", "correa"], ["alternador", "alternador"], ["partida", "motor.{0,6}partida|motor de arranque|starter"], ["turbo", "turbo"], ["inyeccion", "inyector|bomba.{0,6}inyec"], ["combustible", "bomba.{0,6}combust|(estanque|tanque).{0,6}combust"], ["agua", "bomba.{0,6}agua"], ["aire", "compresor|condensador|evaporador|blower|secador|a/c|aire acond"], ["cilindros", "cilindro|v[aá]stago|vastago"], ["valvulas", "v[aá]lvula|valve|orbitrol|acumulador|joystick"], ["mangueras", "flexible|manguera|hose|ca[ñn]er[ií]a|tuber[ií]a|acople|racor"], ["enfriamiento", "radiador|aftercooler|intercooler|oil cooler|enfriador|termostato|ventilador"], ["bombas", "bomba"], ["frenos", "freno|brake"], ["tren", "transmis|convertidor|diferencial|mando final|reductor|corona|pe[ñn][oó]n|card[aá]n|cruceta|junta universal"], ["motor", "culata|pist[oó]n|camisa|cigue[ñn]al|empaquet|cojinete|biela de motor|polea|tensor|motor diesel|damper|amortiguador de"], ["suspension", "suspensi|amortigu|barra estab|r[oó]tula|terminal de direcc|direcci[oó]n"], ["cabina", "cabina|asiento|puerta|vidrio|parabrisas|espejo"], ["electrico", "bater[ií]a|sensor|arn[eé]s|rel[eé]|fusible|foco|alarma|radio|antena|gps|c[aá]mara|interruptor|cable"], ["estructura", "tolva|balde|bastidor|chasis|pasador|buje|bocina|bisagra"], ["engrase", "engrase|grasera"], ["aro", "(^|[^a-z])aros?($|[^a-z])|llanta|(^|[^a-z])rim($|[^a-z])"], ["menores", "rodamiento|sello|perno|tuerca|golilla|codo|guia bronce|retenedor|o-?ring|abrazadera|punta ripper|protecci[oó]n|seat belt"], ["lubricantes", "aceite"], ["servicios", "servicio|montaje|desmontaje|reparaci|perforaci|traslado|instalaci"]];
// [N° de parte, descripción, grupo, cantidad por equipo, precio unitario neto USD] — hoja 'Sugerido' (HD785-7)
const TBO_SUGERIDO=[["04120-21951", "Correa Alternador", "Motor", 2, 57.4], ["6215-61-3690", "Correas ventilador", "Motor", 2, 402.31], ["04121-21748", "Correa A/C", "AC", 2, 84.32], ["56E-07-21133", "Condensador", "AC", 1, 1084.96], ["423-S62-4330", "Compresor AC", "AC", 1, 787.2], ["707-00-0G704", "Cilindro dirección", "Cilindro", 2, 8672.37], ["721-32-10C50", "Acumuladores freno", "Hidráulico", 3, 5508.26], ["709-91-12600", "Válvula levante", "Hidráulico", 1, 5482.02], ["721-32-10C40", "Acumuladores freno", "Hidráulico", 4, 5690.56], ["702-21-01502", "Válvula dirección", "Hidráulico", 1, 6048.41], ["561-40-84301", "Orbitrol", "Hidráulico", 1, 7731.19], ["AN51532-41240", "Termostato", "Motor", 5, 101.52], ["6245-11-3100", "Inyectores", "Motor", 6, 848.66], ["6240-61-1106", "Bomba de agua", "Motor", 1, 1675.34], ["6240-51-1100", "Bomba de aceite", "Motor", 1, 1424.49], ["600-861-9122", "Alternador", "Motor", 1, 2192.14], ["6219-51-1000", "Bomba de aceite", "Motor", 1, 2040.93], ["600-813-9911", "Motor de partida", "Motor", 2, 3667.43], ["6505-67-5040", "Turbo LH", "Motor", 1, 8002.71], ["6505-67-5030", "Turbo RH", "Motor", 1, 8002.71], ["6219-71-1101", "Bomba combustible LH", "Motor", 1, 6944.37], ["6219-71-1201", "Bomba combustible RH", "Motor", 1, 6944.37], ["561-03-81280", "Oil cooler (dirección y levante)", "Radiador", 1, 1715.89], ["561-03-81654", "Radiador core", "Radiador", 1, 4869.55], ["561-03-81634", "Radiador core", "Radiador", 2, 6028.47], ["561-03-81644", "Radiador core", "Radiador", 1, 6010.18], ["561-03-81660", "Aftercooler", "Radiador", 2, 9681.43]];
// Tipo de aplicación (macro Calculadora() del Excel): TBO de aplicación = TBO de fábrica × 120% (ligera) / 100% (normal) /
// 80% (severa). El Excel de Komatsu viene calculado en 'Normal'.
const TBO_APLICACION={ligera:1.2,normal:1,severa:0.8};
// Guía de aplicación (hoja oculta 'Application Guide'): cuándo un trabajo es ligero / normal / severo, por tipo de máquina.
const TBO_GUIA_APLICACION={
  bulldozer:['BULLDOZER',['Máquina en movimiento sin carga. Granos, semillas, tierra ligera.','Materiales normales. Limpieza de terrenos.','Desgarrar o romper. Materiales pesados, rocas duras. Demolición.']],
  cargador:['CARGADOR FRONTAL (WHEEL LOADER)',['Máquina en movimiento sin carga. Movimiento de material ligero.','Trabajo en caminos. Carga de camiones. Stockpiling de material.','Excavación de bancos. Carga constante. Carga y movimiento. Demolición.']],
  camion:['CAMIÓN RÍGIDO (RIGID DUMP TRUCK)',['Tiempo de carga y espera mayor al tiempo de transporte. Terrenos con baja resistencia a la rodadura y/o poca pendiente (<4%).','Tiempo de carga y espera similar al de transporte. Resistencia normal a la rodadura y pendientes de 4% a 10%.','Tiempos de traslado largos (mayores al de carga y espera). Terrenos con poca mantención. Pendientes superiores al 10%.']]
};
// Riesgo Weibull de la hoja oculta 'Weibull' (macro Calculadora2): la tabla es una Weibull con β=3 cuyo B5 (5% de fallas) es
// justo el TBO — verificado contra las 18×600 celdas (redondeadas a 500 h): B50/B5 = (ln0.5/ln0.95)^(1/3) = 2,38. Acá se usa la
// fórmula continua en vez de buscar la fila más cercana de la tabla.
const TBO_BETA=3;
var _TBO_RX=null;
function _tboRegex(){
  if(!_TBO_RX)_TBO_RX=TBO_REGLAS_COMPRA.map(function(r){return{id:r[0],rx:new RegExp(r[1],'i')};});
  return _TBO_RX;
}
// Normaliza un N° de parte para compararlo: sin guiones/espacios/puntos, en mayúsculas.
function tboNormalizarPN(s){return String(s==null?'':s).toUpperCase().replace(/[^A-Z0-9]/g,'');}
// Clase de equipo del plan TBO según el modelo. exacto=false cuando el modelo del Excel es el más cercano
// pero no idéntico (ej. D65EX-18E0 de la flota vs D65EX-16 del Excel). null = sin plan TBO (ej. Doosan, Ford, GD-705).
function tboClaseModelo(modelo){
  var m=String(modelo||'').toUpperCase();
  if(/HD[- ]?785/.test(m))return{clase:'camion',modeloExcel:'HD785-7',exacto:true};
  if(/WA ?900/.test(m))return{clase:'cargador',modeloExcel:'WA900-8R',exacto:true};
  if(/D ?375A/.test(m))return{clase:'bulldozer',modeloExcel:'D375A-6R',exacto:true};
  if(/D ?65EX/.test(m))return{clase:'bulldozer',modeloExcel:'D65EX-16',exacto:/D ?65EX-?16(?![0-9A-Z])/.test(m)};
  return null;
}
// Familia de una línea de compra. enTBO=false → gasto que el plan del fabricante no cubre (desgaste, rodado,
// lubricantes, fijaciones, servicios…). Primera regla que calce gana; sin calce: 'servicios' si el tipo es
// Servicio, si no 'otros'.
function tboFamiliaDeCompra(detalle,tipo){
  var t=String(detalle==null?'':detalle),rs=_tboRegex();
  for(var i=0;i<rs.length;i++){if(rs[i].rx.test(t)){var id=rs[i].id;return{id:id,enTBO:!TBO_FUERA.some(function(f){return f[0]===id;})};}}
  return{id:String(tipo||'')==='Servicio'?'servicios':'otros',enTBO:false};
}
function _tboProvOriginal(p){return /^\s*komatsu/i.test(String(p||''));}
// Une ordenes_compra_historico (tiene 'tipo') con compras_detalle (no lo tiene) SIN duplicar: casi todo el
// histórico está en las dos tablas (clave pedido+sigla+detalle+costo, gana el histórico). De compras_detalle
// solo cuentan las OC ya firmadas o recibidas (las 'por firmar' todavía no son gasto). Filtra costo>0 y, si
// hay tipo, solo Repuesto/Servicio.
function tboUnirCompras(ocHist,comprasDetalle){
  var vistas={},out=[];
  function k(o){return [o.pedido,o.sigla,o.detalle,Number(o.costo)||0].join('|');}
  (ocHist||[]).forEach(function(o){if(!o)return;vistas[k(o)]=1;out.push(o);});
  (comprasDetalle||[]).forEach(function(o){
    if(!o||vistas[k(o)])return;
    var st=String(o.estado||'');
    if(st!=='OC Firmada'&&st!=='Recepcion Bodega')return;
    out.push(o);
  });
  return out.filter(function(o){
    if(!((Number(o.costo)||0)>0))return false;
    return !o.tipo||o.tipo==='Repuesto'||o.tipo==='Servicio';
  });
}
// Cruza compras con el plan TBO. equipos: [{sigla,modelo,...}]; solo cuenta compras de esas siglas (y de
// 'siglas' si se pasa, para filtrar por equipo). Devuelve gasto por familia (total / original Komatsu / otros
// proveedores / por equipo) y el total fuera del plan.
function tboCruzarCompras(compras,equipos,siglas){
  var sigSet={};(equipos||[]).forEach(function(e){if(e&&e.sigla&&(!siglas||siglas.indexOf(e.sigla)>=0))sigSet[e.sigla]=1;});
  var fam={},tot={lineas:0,gasto:0,gastoTBO:0,gastoOriginal:0};
  (compras||[]).forEach(function(o){
    if(!o||!sigSet[o.sigla])return;
    var costo=Number(o.costo)||0;if(!(costo>0))return;
    var f=tboFamiliaDeCompra(o.detalle,o.tipo),orig=_tboProvOriginal(o.proveedor);
    var r=fam[f.id]||(fam[f.id]={id:f.id,enTBO:f.enTBO,lineas:0,gasto:0,gastoOriginal:0,gastoOtros:0,porEquipo:{},proveedores:{}});
    r.lineas++;r.gasto+=costo;if(orig)r.gastoOriginal+=costo;else r.gastoOtros+=costo;
    r.porEquipo[o.sigla]=(r.porEquipo[o.sigla]||0)+costo;
    var pv=String(o.proveedor||'(sin proveedor)').trim();r.proveedores[pv]=(r.proveedores[pv]||0)+costo;
    tot.lineas++;tot.gasto+=costo;if(f.enTBO)tot.gastoTBO+=costo;if(orig)tot.gastoOriginal+=costo;
  });
  return{familias:fam,totales:tot};
}
// TBO de referencia (horas) de una familia para una clase de equipo: {min,max,items:[[item,tbo],..]} o null.
function tboFamiliaDeClase(clase,famId){
  var its=(TBO_ITEMS[clase]||[]).filter(function(r){return r[0]===famId;});
  if(!its.length)return null;
  var ts=its.map(function(r){return r[2];});
  return{min:Math.min.apply(null,ts),max:Math.max.apply(null,ts),items:its.map(function(r){return[r[1],r[2]];})};
}
// Plan TBO de un equipo con su horómetro vivo: por ítem, cuántos cambios "debería" llevar (piso(h/TBO)),
// horómetro y horas hasta el próximo, y fecha estimada (con hrsDia del equipo; sin dato, 10 h/día = 300 h/mes
// como el Excel). TEÓRICO: no sabe si el cambio se hizo.
function tboPlanEquipo(eq,hoy,aplic){
  var cl=tboClaseModelo(eq&&eq.modelo);if(!cl)return null;
  var h=Number(eq.horomActual)||0,hd=Number(eq.hrsDia)>0?Number(eq.hrsDia):10;
  var base=hoy instanceof Date?hoy:new Date(hoy||Date.now());
  var fa=TBO_APLICACION[aplic]||1;
  var items=(TBO_ITEMS[cl.clase]||[]).map(function(r){
    var tbo=Math.round(r[2]*fa),n=Math.floor(h/tbo),prox=(n+1)*tbo,rest=prox-h;
    var f=new Date(base.getTime()+Math.round(rest/hd)*86400000);
    return{fam:r[0],item:r[1],tbo:tbo,tboFab:r[2],cambiosTeoricos:n,proximoH:prox,restantesH:rest,fechaProx:f.toISOString().slice(0,10)};
  });
  return{clase:cl.clase,modeloExcel:cl.modeloExcel,exacto:cl.exacto,horometro:h,hrsDia:hd,aplicacion:TBO_APLICACION[aplic]?aplic:'normal',factor:fa,items:items};
}
// Precios del listado "Sugerido" (USD) frente a lo realmente pagado: por N° de parte, última compra (por
// N° completo, o por los primeros 9 caracteres cuando el texto del pedido viene cortado a ~25) y cuántas hay.
function tboCruzarSugerido(compras,tasa){
  var rate=Number(tasa)>0?Number(tasa):0;
  var norm=(compras||[]).map(function(o){return{d:tboNormalizarPN(o.detalle),o:o};});
  return TBO_SUGERIDO.map(function(s){
    var pn=tboNormalizarPN(s[0]),pre=pn.slice(0,9),ex=[],pa=[];
    norm.forEach(function(x){
      if(x.d.indexOf(pn)>=0)ex.push(x.o);else if(pre.length>=9&&x.d.indexOf(pre)>=0)pa.push(x.o);
    });
    var usa=ex.length?ex:pa,exacto=ex.length>0;
    usa=usa.slice().sort(function(a,b){return String(a.fecha||'')<String(b.fecha||'')?-1:1;});
    var ult=usa.length?usa[usa.length-1]:null;
    var pus=usa.map(function(o){return Number(o.precioUnit)||((Number(o.costo)||0)/(Number(o.cant)||1));}).filter(function(v){return v>1;}).sort(function(a,b){return a-b;});
    return{pn:s[0],desc:s[1],grupo:s[2],cant:s[3],usd:s[4],clpRef:rate?Math.round(s[4]*rate):null,
      nCompras:usa.length,exacto:exacto,ultFecha:ult?ult.fecha:null,ultPrecio:ult?(Number(ult.precioUnit)||null):null,ultProveedor:ult?ult.proveedor:null,
      medianaClp:pus.length?pus[Math.floor(pus.length/2)]:null};
  });
}


// ── TBO: cambios reales, tiempo que falta, vida por origen y precios por ítem ──
// Nombre de componente del Historial/Componentes Mayores → [ítem del TBO (regex, en inglés), familia de compra].
// Solo los que se corresponden 1 a 1 (un "Alternador" del historial ES el ítem ALTERNATOR del plan).
const TBO_COMP_MAP=[
  [/^turbo/i,/^TURBOCHARGER/,'turbo'],[/^alternador/i,/^ALTERNATOR/,'alternador'],[/motor de partida/i,/^STARTING MOTOR/,'partida'],
  [/bomba de combustible/i,/^FUEL (INJECTION )?PUMP/,'combustible'],[/aire acondicionado/i,/^AIR CONDITIONING/,'aire'],
  [/^correas?/i,/^V-BELT/,'correas'],[/cilindro de direcci/i,/STEERING CYLINDER/,'cilindros'],
  [/diferencial/i,/DIFFERENTIAL/,'tren'],[/transmisi/i,/^TRANSMISSION/,'tren'],[/convertidor/i,/TORQUE CONVERTER/,'tren'],
  [/mandos? finales?/i,/FINAL DRIVE/,'tren'],[/^motor$/i,/^ENGINE( ASSY)?$/,'motor'],[/suspensi[oó]n/i,/SUSPENSION ASSY/,'suspension'],
  [/^radiador/i,/^RADIATOR$/,'enfriamiento'],[/^tolva$/i,/^DUMP BODY/,'estructura'],[/engrase/i,/GREASE/,'engrase']
];
function tboCompMap(comp){var c=String(comp||'');for(var i=0;i<TBO_COMP_MAP.length;i++){if(TBO_COMP_MAP[i][0].test(c))return TBO_COMP_MAP[i];}return null;}
// Origen del repuesto: 'original' (Komatsu / nuevo de fábrica), 'alternativo' (alternativo, reparado, reacondicionado,
// usado, o un taller/proveedor distinto de Komatsu) o '' (sin dato).
function tboClasificarOrigen(o){
  var t=String(o==null?'':o).trim();if(!t)return'';
  if(/komatsu|original/i.test(t))return'original';
  return'alternativo';
}
// Origen inferido por la compra: proveedor Komatsu = original, otro = alternativo. Busca la compra de esa familia
// del MISMO equipo más cercana a la fecha del cambio (45 días antes a 15 después).
function tboOrigenPorCompra(sigla,fechaInst,famCompra,compras){
  if(!sigla||!fechaInst||!famCompra)return'';
  var t=Date.parse(fechaInst);if(isNaN(t))return'';
  var mejor=null,dm=Infinity;
  (compras||[]).forEach(function(o){
    if(!o||o.sigla!==sigla)return;
    var tf=Date.parse(o.fecha);if(isNaN(tf))return;
    var d=(tf-t)/86400000;if(d<-45||d>15)return;
    if(tboFamiliaDeCompra(o.detalle,o.tipo).id!==famCompra)return;
    if(Math.abs(d)<dm){dm=Math.abs(d);mejor=o;}
  });
  return mejor?(_tboProvOriginal(mejor.proveedor)?'original':'alternativo'):'';
}
// Último cambio conocido de cada ítem del plan para un equipo, desde el Historial de Componentes (eventos reales con
// horómetro) y Componentes Mayores (instalación actual / "original de fábrica"). Devuelve función item→{horom,fecha,
// origen,fuente} o null si no hay dato.
function tboUltimoCambioFn(sigla,horomActual,compHist,compMayores){
  var evs=[];
  (compHist||[]).forEach(function(r){
    if(!r||r.sigla!==sigla)return;var m=tboCompMap(r.comp);if(!m)return;
    var h=parseFloat(r.horomInstalacion);if(isNaN(h)||h>horomActual)return;
    evs.push({rx:m[1],horom:h,fecha:r.fechaInst||null,origen:tboClasificarOrigen(r.origen),fuente:'cambio registrado'});
  });
  (compMayores||[]).forEach(function(c){
    if(!c||c.sigla!==sigla)return;var m=tboCompMap(c.comp);if(!m)return;
    if(c.esOriginal)evs.push({rx:m[1],horom:0,fecha:null,origen:'original',fuente:'original de fábrica'});
    else if(c.fechaInst){var h=parseFloat(c.horomComp);if(!isNaN(h)&&h<=horomActual)evs.push({rx:m[1],horom:h,fecha:c.fechaInst,origen:'',fuente:'cambio registrado'});} // sin fecha de instalación no es un cambio real (mismo criterio que compEstado)
  });
  return function(item){
    var best=null;
    evs.forEach(function(e){if(e.rx.test(item)&&(!best||e.horom>best.horom))best=e;});
    return best;
  };
}
// Estado de TODOS los ítems del plan de TODOS los equipos con plan TBO. Con último cambio conocido:
// desde = horómetro − horómetro del cambio; faltan = TBO − desde (puede ser negativo = vencido). Sin dato: se usa el
// plan teórico del Excel (próximo múltiplo del TBO) y nunca se declara "vencido" (no sabemos si se hizo).
// nivel: vencido / planificar (<1.000 h; teórico: <500) / monitorear (<2.000; teórico: <1.000) / ok.
function tboEstadoFlota(equipos,compHist,compMayores,hoy,aplic){
  var out=[];
  (equipos||[]).forEach(function(e){
    var plan=tboPlanEquipo(e,hoy,aplic);if(!plan)return;
    var ult=tboUltimoCambioFn(e.sigla,plan.horometro,compHist,compMayores);
    var hd=Number(e.hrsDia)>0?Number(e.hrsDia):12;
    var base=hoy instanceof Date?hoy:new Date(hoy||Date.now());
    plan.items.forEach(function(it){
      var u=ult(it.item),conDato=!!u,rest,desde,fuente,origen='',fecha=null,refH=null;
      if(conDato){refH=u.horom;desde=plan.horometro-u.horom;rest=it.tbo-desde;fuente=u.fuente;origen=u.origen;fecha=u.fecha;}
      else{desde=plan.horometro-(it.proximoH-it.tbo);rest=it.restantesH;fuente='plan teórico';}
      var nivel=conDato?(rest<=0?'vencido':rest<1000?'planificar':rest<2000?'monitorear':'ok'):(rest<500?'planificar':rest<1000?'monitorear':'ok');
      var dias=Math.round(rest/hd),desdeC=Math.max(desde,0),riesgo=tboRiesgoWeibull(desdeC,it.tbo);
      out.push({sigla:e.sigla,modelo:e.modelo,clase:plan.clase,fam:it.fam,item:it.item,tbo:it.tbo,tboFab:it.tboFab,riesgo:riesgo,riesgo500:tboRiesgoHorizonte(desdeC,it.tbo,500),prob:tboProbNivel(riesgo),horometro:plan.horometro,refH:refH,desdeH:Math.max(desde,0),
        restantesH:rest,dias:dias,fechaProx:new Date(base.getTime()+dias*86400000).toISOString().slice(0,10),fuente:fuente,conDato:conDato,origenUlt:origen,fechaUlt:fecha,nivel:nivel});
    });
  });
  return out;
}
function tboResumenAlertas(estado){
  var r={vencidos:0,planificar:0,monitorear:0,total:(estado||[]).length,conDato:0};
  (estado||[]).forEach(function(x){if(x.conDato)r.conDato++;if(x.nivel==='vencido')r.vencidos++;else if(x.nivel==='planificar')r.planificar++;else if(x.nivel==='monitorear')r.monitorear++;});
  return r;
}
// Cuánto duró cada instalación REAL (horas de horómetro hasta el siguiente cambio del mismo componente en el mismo
// equipo), agrupado por componente y origen (original / alternativo / sin dato), comparado con el TBO de Komatsu.
// El origen sale del campo 'origen' del historial; si está vacío se infiere por la compra del mismo equipo (proveedor).
function tboVidaPorOrigen(compHist,compras){
  var porClave={};
  (compHist||[]).forEach(function(r){
    if(!r||!r.sigla||!r.comp)return;var h=parseFloat(r.horomInstalacion);if(isNaN(h))return;
    (porClave[r.sigla+'|'+r.comp]=porClave[r.sigla+'|'+r.comp]||[]).push({r:r,h:h});
  });
  var grupos={};
  Object.keys(porClave).forEach(function(k){
    var arr=porClave[k].sort(function(a,b){return a.h-b.h;});
    for(var i=0;i<arr.length-1;i++){
      var dur=arr[i+1].h-arr[i].h;if(!(dur>=TBO_VIDA_MIN_H))continue;
      var ev=arr[i].r,m=tboCompMap(ev.comp),origen=tboClasificarOrigen(ev.origen),inferido=false;
      if(!origen&&m){origen=tboOrigenPorCompra(ev.sigla,ev.fechaInst,m[2],compras);inferido=!!origen;}
      var g=(grupos[ev.comp+'|'+(origen||'sin dato')]=grupos[ev.comp+'|'+(origen||'sin dato')]||{comp:ev.comp,origen:origen||'sin dato',vals:[],inferidos:0});
      g.vals.push(dur);if(inferido)g.inferidos++;
    }
  });
  return Object.keys(grupos).map(function(k){
    var g=grupos[k],v=g.vals.slice().sort(function(a,b){return a-b;}),n=v.length;
    var med=n%2?v[(n-1)/2]:(v[n/2-1]+v[n/2])/2,m=tboCompMap(g.comp),tbos=[];
    if(m){['camion','cargador','bulldozer'].forEach(function(c){(TBO_ITEMS[c]||[]).forEach(function(it){if(m[1].test(it[1])&&tbos.indexOf(it[2])<0)tbos.push(it[2]);});});}
    var tbo=tbos.length?{min:Math.min.apply(null,tbos),max:Math.max.apply(null,tbos)}:null;
    // Beta–Bernoulli: cada cambio medido es un ensayo (éxito = duró al menos el TBO); solo con un TBO único para ese componente.
    var bern=tbo&&tbo.min===tbo.max?betaBernoulliPosterior(v.filter(function(x){return x>=tbo.min;}).length,n):null;
    return{comp:g.comp,origen:g.origen,n:n,mediana:Math.round(med),promedio:Math.round(v.reduce(function(s,x){return s+x;},0)/n),min:v[0],max:v[n-1],inferidos:g.inferidos,vals:v,
      tbo:tbo,pctTBO:tbo&&tbo.min===tbo.max?Math.round(100*med/tbo.min):null,bern:bern};
  }).sort(function(a,b){return a.comp<b.comp?-1:a.comp>b.comp?1:(a.origen<b.origen?-1:1);});
}
// Para cada componente con cambios de los dos orígenes y TBO: probabilidad de que el ORIGINAL llegue al TBO con más probabilidad que el
// alternativo, comparando los dos posteriores Beta (P(θ_original > θ_alternativo)). Con pocos cambios por origen es un indicio: los
// intervalos creíbles de cada fila muestran cuánta incertidumbre queda.
function tboComparaOrigen(filas){
  var por={};
  (filas||[]).forEach(function(v){if(v.bern&&(v.origen==='original'||v.origen==='alternativo'))(por[v.comp]=por[v.comp]||{})[v.origen]=v;});
  return Object.keys(por).filter(function(c){return por[c].original&&por[c].alternativo;}).map(function(c){
    var o=por[c].original,a=por[c].alternativo;
    return{comp:c,pOriginalMejor:probabilidadMayorBeta(o.bern.a,o.bern.b,a.bern.a,a.bern.b),nOriginal:o.n,nAlternativo:a.n,
      mediaOriginal:o.bern.media,mediaAlternativo:a.bern.media};
  });
}
// Qué buscar en las compras para ponerle precio a cada ítem del plan (regex del ítem en inglés → regex de la descripción).
const TBO_PRECIO_RX=[
  [/^V-BELT/,/correa/],[/^ALTERNATOR/,/alternador/],[/^STARTING MOTOR/,/motor.{0,6}partida|motor de arranque/],[/^TURBOCHARGER/,/turbo/],
  [/FUEL INJECTOR/,/inyector/],[/FUEL (INJECTION )?PUMP/,/bomba.{0,6}(combust|inyec)/],[/^WATER PUMP/,/bomba.{0,6}agua/],
  [/^AIR CONDITIONING/,/compresor|condensador|evaporador|blower/],[/^RADIATOR$|COOLING SYS-RADIATOR|^COOLING SYSTEM$/,/radiador|aftercooler/],
  [/STEERING CYLINDER/,/cilindro.{0,10}direcc/],[/LIFT CYLINDER|HOIST CYLINDER/,/cilindro.{0,10}(levante|elevac|izaje|volteo)/],
  [/BUCKET CYLINDER|TILT CYLINDER/,/cilindro.{0,10}(balde|volteo|inclin)/],[/TORQUE CONVERTER/,/convertidor/],[/^TRANSMISSION/,/transmisi/],
  [/DIFFERENTIAL/,/diferencial/],[/FINAL DRIVE/,/mando final/],[/^ENGINE ASSY$|^ENGINE$/,/motor diesel|motor complet|ensamble motor/],
  [/^DUMP BODY/,/tolva/],[/WHEEL RIM|^RIM-/,/(^|[^a-z])aros?($|[^a-z])|llanta/],[/ACCUMULATOR- BRAKE/,/acumulador/],
  [/CONTROL VALVE|MAIN VALVE/,/v[aá]lvula/],[/JOY ?STICK/,/joystick/],[/FAN MOTOR/,/motor.{0,6}ventilador/],
  [/SUSPENSION ASSY/,/suspensi/],[/EQUALIZER BAR/,/barra.{0,6}(equalizadora|ecualizadora)/],[/HINGE PIN|PIVOT SHAFT/,/pasador/],
  [/^DAMPER/,/damper|amortiguador de/],[/PUMP-STEERING|PUMP- STEERING/,/bomba.{0,10}direcc/],
  [/HYD PUMP|PUMP-LOADER|PPC PUMP|BRAKE COOLING PUMP|PUMP ASSY/,/bomba.{0,10}(hidr|freno|levante|ventilador|pilot)/],
  [/SAFETY RELATED HOSES/,/flexible|manguera/]
];
// Listado "Sugerido" (USD): ítem del plan (camión HD785-7) → N° de parte del repuesto principal.
const TBO_SUG_PN=[[/^V-BELT/,'6215-61-3690'],[/^ALTERNATOR/,'600-861-9122'],[/^STARTING MOTOR/,'600-813-9911'],[/^TURBOCHARGER \(L\)/,'6505-67-5040'],
  [/^TURBOCHARGER \(R\)/,'6505-67-5030'],[/FUEL INJECTOR/,'6245-11-3100'],[/^WATER PUMP/,'6240-61-1106'],[/^AIR CONDITIONING/,'423-S62-4330'],
  [/^FUEL PUMP ASSY/,'6219-71-1101'],[/STEERING CYLINDER/,'707-00-0G704'],[/COOLING SYS-RADIATOR/,'561-03-81654']];
// Precio por ítem: (a) listado Sugerido en USD (solo camión HD785-7), (b) lo realmente pagado por repuestos de ese tipo en
// los equipos de la misma clase, separado en original (Komatsu) y otros proveedores (alternativos/reparados). Un ítem sin
// regla o sin compras queda con n=0 — se muestra igual, "sin precio".
function tboPrecioItem(item,clase,compras,siglasClase,tasa){
  var out={usd:null,usdPN:null,clpRef:null,n:0,mediana:null,ultimo:null,fechaUlt:null,original:{n:0,mediana:null},otros:{n:0,mediana:null}};
  if(clase==='camion'){
    for(var i=0;i<TBO_SUG_PN.length;i++){if(TBO_SUG_PN[i][0].test(item)){
      var s=TBO_SUGERIDO.filter(function(x){return x[0]===TBO_SUG_PN[i][1];})[0];
      if(s){out.usd=s[4];out.usdPN=s[0];out.clpRef=Number(tasa)>0?Math.round(s[4]*Number(tasa)):null;}break;}}
  }
  var rx=null;for(var j=0;j<TBO_PRECIO_RX.length;j++){if(TBO_PRECIO_RX[j][0].test(item)){rx=new RegExp(TBO_PRECIO_RX[j][1].source,'i');break;}}
  if(!rx)return out;
  var sig={};(siglasClase||[]).forEach(function(s){sig[s]=1;});
  var pus=[],po=[],pt=[],ult=null;
  (compras||[]).forEach(function(o){
    if(!o||!sig[o.sigla]||o.tipo==='Servicio'||!rx.test(String(o.detalle||'')))return;
    if(tboFamiliaDeCompra(o.detalle,o.tipo).enTBO===false)return;
    var pu=Number(o.precioUnit)||((Number(o.costo)||0)/(Number(o.cant)||1));if(!(pu>1000))return;
    pus.push(pu);(_tboProvOriginal(o.proveedor)?po:pt).push(pu);
    if(!ult||String(o.fecha||'')>String(ult.fecha||''))ult={fecha:o.fecha,pu:pu};
  });
  function med(a){if(!a.length)return null;a=a.slice().sort(function(x,y){return x-y;});var n=a.length;return Math.round(n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2);}
  out.n=pus.length;out.mediana=med(pus);out.original={n:po.length,mediana:med(po)};out.otros={n:pt.length,mediana:med(pt)};
  if(ult){out.ultimo=Math.round(ult.pu);out.fechaUlt=ult.fecha;}
  return out;
}


// Probabilidad acumulada de falla de un componente con t horas desde su último cambio (o desde cero si es original):
// F(t)=1−0,95^((t/TBO)^β). Con t=TBO da 5% (el TBO es el B5 de la tabla Weibull del Excel). Es el "riesgo actual" de la
// macro; el Excel muestra 5% fijo mientras no se cumple el TBO — acá se muestra el valor real (menor a 5%).
function tboRiesgoWeibull(t,tbo,beta){
  if(!(tbo>0)||!(t>0))return 0;
  return 1-Math.pow(0.95,Math.pow(t/tbo,beta||TBO_BETA));
}
// Probabilidad de que falle dentro de las próximas h horas dado que ya lleva t sin fallar: 1−S(t+h)/S(t).
function tboRiesgoHorizonte(t,tbo,h,beta){
  if(!(tbo>0)||!(h>0))return 0;
  var b=beta||TBO_BETA,t0=Math.max(t||0,0);
  return 1-Math.pow(0.95,Math.pow((t0+h)/tbo,b)-Math.pow(t0/tbo,b));
}
// Probabilidad 1–5 para la Matriz de Riesgo (misma escala que probabilidadComponente): cortes a los B5/B10/B20/B35 de la tabla.
function tboProbNivel(riesgo){
  var r=riesgo||0;
  return r<=0.05+1e-9?1:r<0.10?2:r<0.20?3:r<0.35?4:5;
}
// Matriz de Riesgo (Probabilidad × Impacto) de los cambios con último cambio conocido (los teóricos no entran: por
// construcción están dentro del TBO). Probabilidad = tboProbNivel del riesgo Weibull; Impacto = quintil del precio del
// componente (mismas umbralesImpacto/impactoDeValor/nivelRiesgoPxI de la Matriz de Riesgo de Predictivo). precioFn(x)→CLP o null
// (sin precio → impacto neutro 3).
function tboMatrizRiesgo(estado,precioFn){
  var items=(estado||[]).filter(function(x){return x.conDato;}).map(function(x){return{x:x,valor:precioFn?precioFn(x):null};});
  var umbrales=umbralesImpacto(items.map(function(i){return i.valor;}).filter(function(v){return v>0;}));
  var celdas={};
  var out=items.map(function(i){
    var imp=impactoDeValor(i.valor,umbrales),pr=i.x.prob,niv=nivelRiesgoPxI(pr,imp);
    var k=pr+'|'+imp;celdas[k]=(celdas[k]||0)+1;
    return Object.assign({},i.x,{valor:i.valor,impacto:imp,pxi:niv.pxi,nivelPxI:niv.nivel,colorPxI:niv.color});
  }).sort(function(a,b){return b.pxi-a.pxi||b.riesgo-a.riesgo;});
  return{items:out,celdas:celdas,umbrales:umbrales,conPrecio:items.filter(function(i){return i.valor>0;}).length};
}
// Costo por hora de operación de cada componente: precio típico ÷ horas que duró (mediana real), por origen. Compara el costo
// por hora del repuesto original contra el alternativo/reparado; con TBO, también cuánto sería a la vida del fabricante.
// precio: original → mediana pagada a Komatsu (si no hay, lista USD×tasa); alternativo → mediana pagada a otros; sin dato → mediana.
function tboCostoPorHora(vida,compras,equipos,tasa){
  var sigPorClase={camion:[],cargador:[],bulldozer:[]};
  (equipos||[]).forEach(function(e){var c=tboClaseModelo(e&&e.modelo);if(c)sigPorClase[c.clase].push(e.sigla);});
  return (vida||[]).map(function(v){
    var m=tboCompMap(v.comp),precio=null,fuente='',item=null,clase=null,p=null;
    if(m){
      ['camion','cargador','bulldozer'].forEach(function(c){if(item)return;var it=(TBO_ITEMS[c]||[]).filter(function(r){return m[1].test(r[1]);})[0];if(it){item=it[1];clase=c;}});
      if(item){
        p=tboPrecioItem(item,clase,compras,sigPorClase[clase],tasa);
        if(v.origen==='original'){precio=p.original.mediana;fuente=precio?'pagado a Komatsu':'';if(!precio&&p.clpRef){precio=p.clpRef;fuente='lista Komatsu (USD)';}}
        else if(v.origen==='alternativo'){precio=p.otros.mediana;fuente=precio?'pagado a otros':'';}
        else{precio=p.mediana;fuente=precio?'pagado (todos)':'';}
      }
    }
    var tboRef=v.tbo&&v.tbo.min===v.tbo.max?v.tbo.min:null;
    return Object.assign({},v,{item:item,precio:precio,fuentePrecio:fuente,costoHora:precio&&v.mediana>0?Math.round(precio/v.mediana):null,
      costoHoraTBO:precio&&tboRef?Math.round(precio/tboRef):null});
  });
}


// ── TBO × Stock × Compras: ¿alcanzamos a comprar antes del cambio? ──
// Regex en español (sobre la descripción de la compra/stock) del ítem del plan, o null si no hay forma confiable de reconocerlo.
function _tboRxItem(item){
  for(var j=0;j<TBO_PRECIO_RX.length;j++){if(TBO_PRECIO_RX[j][0].test(item))return new RegExp(TBO_PRECIO_RX[j][1].source,'i');}
  return null;
}
function _tboPNItem(item){for(var i=0;i<TBO_SUG_PN.length;i++){if(TBO_SUG_PN[i][0].test(item))return TBO_SUG_PN[i][1];}return null;}
// Cantidad de unidades por cambio: la del listado Sugerido (ej. 6 inyectores por equipo) o 1.
function tboCantidadItem(item){var pn=_tboPNItem(item);if(!pn)return 1;var s=TBO_SUGERIDO.filter(function(x){return x[0]===pn;})[0];return s?s[3]:1;}
// Tiempo de entrega (días) de un repuesto: mediana de lo que tardaron los pedidos YA RECIBIDOS de ese tipo (tiempoRespuesta de
// compras_detalle); con menos de 3 pedidos usa la mediana de todos los pedidos recibidos; sin datos, 34 días (el default de
// stockEstado). Se arma una vez (pedidos recibidos con sus días) y devuelve una función ítem→{dias,n,fuente}.
function tboLeadTimeFn(comprasDetalle){
  var cerrados=[],todos=[];
  (comprasDetalle||[]).forEach(function(c){
    if(!c||c.estado!=='Recepcion Bodega')return;
    var d=_parsearTiempoRespuestaDias(c.tiempoRespuesta);if(d==null||!(d>0))return;
    cerrados.push({det:String(c.detalle||''),d:d});todos.push(d);
  });
  var global=medianaPositiva(todos),cache={};
  return function(item){
    if(cache[item])return cache[item];
    var rx=_tboRxItem(item),r;
    var ds=rx?cerrados.filter(function(c){return rx.test(c.det);}).map(function(c){return c.d;}):[];
    if(ds.length>=3)r={dias:Math.round(medianaPositiva(ds)),n:ds.length,fuente:'mediana de '+ds.length+' pedidos de este repuesto'};
    else if(global!=null)r={dias:Math.round(global),n:todos.length,fuente:'mediana de todos los pedidos ('+todos.length+')'};
    else r={dias:34,n:0,fuente:'sin historial: 34 días por defecto'};
    // Los tiempos de entrega son positivos y asimétricos (casi siempre cortos, a veces muy largos): se ajustan con una Gamma (máxima verosimilitud; con 987 pedidos reales dio 0,3% de error en el p90, contra 12% de los momentos) —
    // de este repuesto si hay ≥5 pedidos, si no de todos— para tener la probabilidad de llegar a tiempo y el percentil 90.
    var fit=ajusteGammaMLE(ds.length>=5?ds:todos)||ajusteGammaMomentos(ds.length>=5?ds:todos);
    r.gamma=fit?{k:fit.k,theta:fit.theta,n:(ds.length>=5?ds:todos).length}:null;
    r.p90=fit?Math.ceil(gammaCuantil(0.9,fit.k,fit.theta)):null;
    return(cache[item]=r);
  };
}
// Tiempos de entrega reales (días) de los pedidos ya recibidos: base de la bondad de ajuste de la distribución de entregas.
function tboTiemposEntrega(comprasDetalle){
  var out=[];
  (comprasDetalle||[]).forEach(function(c){
    if(!c||c.estado!=='Recepcion Bodega')return;
    var d=_parsearTiempoRespuestaDias(c.tiempoRespuesta);if(d!=null&&d>0)out.push(d);
  });
  return out;
}
// Probabilidad de que el repuesto llegue en `dias` días o menos (CDF de la Gamma ajustada al tiempo de entrega); null si no hay ajuste.
function tboProbLlegaAntes(lead,dias){
  if(!lead||!lead.gamma)return null;
  return gammaCDF(Math.max(dias,0),lead.gamma.k,lead.gamma.theta);
}
// Stock disponible de un ítem para un equipo: busca por N° de parte del listado Sugerido y, si no, por la descripción, en
// Stock (stock_filtros) y Repuestos Críticos. Cuenta lo que sirve a ese equipo (su sigla, su modelo o sin equipo). Devuelve el
// MAYOR de las dos fuentes (pueden ser el mismo repuesto cargado en ambas: no se suman para no dar por cubierto de más).
function tboStockFn(stk,repuestos){
  var S1=(stk||[]).map(function(s){return{pn:tboNormalizarPN(s.nParte),txt:String(s.descripcion||''),eq:String(s.equipoModelo||''),u:(Number(s.stockBodega)||0),pend:(Number(s.pendiente)||0)};});
  var R1=(repuestos||[]).map(function(r){return{pn:tboNormalizarPN(r.nParte),txt:String(r.componente||''),eq:String(r.equipo||''),u:(Number(r.stockActual)||0),pend:0};});
  return function(item,sigla,modelo){
    var pn=_tboPNItem(item),rx=_tboRxItem(item),pnN=pn?tboNormalizarPN(pn):null;
    var mod=String(modelo||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    function sirve(eq){var e=String(eq||'').toUpperCase();if(!e.trim())return true;if(e.indexOf(String(sigla||'').toUpperCase())>=0)return true;var m=e.replace(/[^A-Z0-9]/g,'');return mod&&(m.indexOf(mod)>=0||mod.indexOf(m)>=0&&m.length>=4);}
    function suma(L){var u=0,pe=0,n=0;L.forEach(function(x){
      var calza=(pnN&&x.pn&&x.pn.indexOf(pnN)>=0)||(!pnN&&rx&&rx.test(x.txt))||(pnN&&!x.pn&&rx&&rx.test(x.txt));
      if(calza&&sirve(x.eq)){u+=x.u;pe+=x.pend;n++;}});return{u:u,pend:pe,n:n};}
    var a=suma(S1),b=suma(R1);
    return{unidades:Math.max(a.u,b.u),pendiente:a.pend,enStock:a.u,enCriticos:b.u,filas:a.n+b.n,porPN:!!pnN};
  };
}
// Pedidos todavía abiertos ('OC por Firmar' / 'OC Firmada' en compras_detalle; 'Pendiente' en las OC creadas en la app) de ese ítem para
// ese equipo o para equipos de su misma clase. Devuelve función (ítem,sigla,siglasClase)→[{fecha,proveedor,estado,dias,sigla}].
function tboPedidosAbiertosFn(comprasDetalle,ordenes,hoy){
  var base=hoy instanceof Date?hoy:new Date(hoy||Date.now());
  var ab=(comprasDetalle||[]).filter(function(c){return c&&(c.estado==='OC por Firmar'||c.estado==='OC Firmada');}).map(function(c){
    var t=Date.parse(c.fecha);return{det:String(c.detalle||''),sigla:c.sigla,fecha:c.fecha,proveedor:c.proveedor,estado:c.estado,dias:isNaN(t)?null:Math.max(0,Math.round((base.getTime()-t)/86400000)),origen:'compras'};});
  var op=(ordenes||[]).filter(function(o){return o&&o.estado==='Pendiente';}).map(function(o){
    var t=Date.parse(o.fecha);return{det:String(o.componente||''),sigla:o.equipo,fecha:o.fecha,proveedor:o.proveedor,estado:'OC creada (Pendiente)',dias:isNaN(t)?null:Math.max(0,Math.round((base.getTime()-t)/86400000)),origen:'ordenes'};});
  var todos=ab.concat(op);
  return function(item,sigla,siglasClase){
    var rx=_tboRxItem(item);if(!rx)return[];
    var set={};(siglasClase||[]).forEach(function(s){set[s]=1;});set[sigla]=1;
    return todos.filter(function(p){return rx.test(p.det)&&(!p.sigla||set[p.sigla]);});
  };
}
// Decisión de compra: dias = días hasta el cambio (≤0 = ya); lead = días que tarda en llegar; margen = colchón (7 d).
//  cubierto (hay stock) · en_camino (hay pedido abierto) · pedir_ya (dias ≤ lead+margen) · planificar (hasta 45 d más) · no_urgente.
// pedirAntesDe = fecha del cambio − (lead+margen).
function tboDecisionCompra(o){
  // Con ajuste Gamma el colchón es estadístico: se pide cuando la probabilidad de llegar a tiempo baja del 90% (percentil 90 del tiempo de
  // entrega, leadP90). Sin ajuste (pocos datos) se usa la mediana + 7 días.
  var dias=o.dias,lead=o.lead,mg=o.margen==null?7:o.margen,tope=o.leadP90>0?o.leadP90:lead+mg,r;
  if((o.stock||0)>0)r='cubierto';
  else if(o.pedidos&&o.pedidos>0)r='en_camino';
  else if(dias<=tope)r='pedir_ya';
  else if(dias<=tope+45)r='planificar';
  else r='no_urgente';
  var base=o.fechaProx?new Date(o.fechaProx+'T12:00:00Z'):null;
  var pedir=base?new Date(base.getTime()-tope*86400000).toISOString().slice(0,10):null;
  return{decision:r,pedirAntesDe:pedir,diasParaPedir:dias-tope,tope:tope,criterio:o.leadP90>0?'p90':'mediana+margen'};
}
// Plan de compras del TBO: por cada cambio próximo de `estado` (tboEstadoFlota), cruza tiempo de entrega, stock, pedidos abiertos y
// precio. opts: {horizonteExtra:90 (días más allá de lead+margen), incluirTeorico:false, tasa}. Devuelve filas ordenadas por urgencia
// y totales (presupuesto de lo que hay que pedir ya / planificar).
function tboPlanCompras(estado,ctx,opts){
  var o=opts||{},ex=o.horizonteExtra==null?90:o.horizonteExtra;
  // leadF/stockF/pedF opcionales: quien arma varios equipos seguidos (tboFichasFlota) los calcula una sola vez.
  var leadF=ctx.leadF||tboLeadTimeFn(ctx.comprasDetalle),stockF=ctx.stockF||tboStockFn(ctx.stk,ctx.repuestos),pedF=ctx.pedF||tboPedidosAbiertosFn(ctx.comprasDetalle,ctx.ordenes,ctx.hoy);
  var compras=ctx.compras||[],eqs=ctx.equipos||[],cachePrecio={},sigClase={};
  eqs.forEach(function(e){var c=tboClaseModelo(e&&e.modelo);if(c)(sigClase[c.clase]=sigClase[c.clase]||[]).push(e.sigla);});
  var modeloDe={};eqs.forEach(function(e){modeloDe[e.sigla]=e.modelo;});
  var filas=[],omitidosTeoricos=0;
  (estado||[]).forEach(function(x){
    var lead=leadF(x.item);
    if(x.dias>(lead.p90>0?lead.p90:lead.dias+7)+ex)return;
    if(!x.conDato&&!o.incluirTeorico){omitidosTeoricos++;return;}
    var k=x.item+'|'+x.clase;
    var pr=cachePrecio[k]||(cachePrecio[k]=tboPrecioItem(x.item,x.clase,compras,sigClase[x.clase]||[],o.tasa!=null?o.tasa:ctx.tasa));
    var precio=pr.original.mediana||pr.mediana||pr.clpRef||null,cant=tboCantidadItem(x.item);
    var st=stockF(x.item,x.sigla,modeloDe[x.sigla]),pd=pedF(x.item,x.sigla,sigClase[x.clase]||[]);
    var dec=tboDecisionCompra({dias:Math.max(x.dias,0),lead:lead.dias,leadP90:lead.p90,stock:st.unidades,pedidos:pd.length,fechaProx:x.fechaProx});
    filas.push(Object.assign({},x,{probATiempo:tboProbLlegaAntes(lead,Math.max(x.dias,0)),lead:lead,stock:st,pedidos:pd,cant:cant,precio:precio,costoEst:precio?precio*cant:null,precios:pr,pn:_tboPNItem(x.item)},dec));
  });
  var orden={pedir_ya:0,planificar:1,en_camino:2,cubierto:3,no_urgente:4};
  filas.sort(function(a,b){return orden[a.decision]-orden[b.decision]||a.diasParaPedir-b.diasParaPedir;});
  var t={pedir_ya:0,planificar:0,en_camino:0,cubierto:0,no_urgente:0,presupuestoPedirYa:0,presupuestoPlanificar:0,sinPrecio:0};
  filas.forEach(function(f){t[f.decision]++;
    if(f.decision==='pedir_ya'||f.decision==='planificar'){if(f.costoEst){t[f.decision==='pedir_ya'?'presupuestoPedirYa':'presupuestoPlanificar']+=f.costoEst;}else t.sinPrecio++;}});
  return{filas:filas,totales:t,omitidosTeoricos:omitidosTeoricos};
}


// ── Distribuciones Beta / Bernoulli / Gamma aplicadas al TBO ──
// Gamma incompleta regularizada P(a,x) (Numerical Recipes: serie si x<a+1, fracción continua de Lentz si no). Es la CDF de una Gamma(a,1).
function _gammaIncRegularizada(a,x){
  if(!(a>0)||x<0)return null;
  if(x===0)return 0;
  var gln=_logGamma(a),EPS=3e-12,FPMIN=1e-300;
  if(x<a+1){
    var ap=a,sum=1/a,del=sum;
    for(var n=0;n<500;n++){ap+=1;del*=x/ap;sum+=del;if(Math.abs(del)<Math.abs(sum)*EPS)break;}
    return sum*Math.exp(-x+a*Math.log(x)-gln);
  }
  var b=x+1-a,c=1/FPMIN,d=1/b,h=d;
  for(var i=1;i<=500;i++){
    var an=-i*(i-a);b+=2;d=an*d+b;if(Math.abs(d)<FPMIN)d=FPMIN;c=b+an/c;if(Math.abs(c)<FPMIN)c=FPMIN;d=1/d;
    var dl=d*c;h*=dl;if(Math.abs(dl-1)<EPS)break;
  }
  return 1-Math.exp(-x+a*Math.log(x)-gln)*h;
}
// CDF de Gamma(forma k, escala theta) en x.
function gammaCDF(x,k,theta){return x<=0?0:_gammaIncRegularizada(k,x/theta);}
// Cuantil p de Gamma(k,theta) por bisección sobre la CDF (monótona).
function gammaCuantil(p,k,theta){
  if(!(p>0&&p<1))return null;
  var lo=0,hi=Math.max(k*theta*2,theta);
  while(gammaCDF(hi,k,theta)<p&&hi<1e12)hi*=2;
  for(var i=0;i<200;i++){var m=(lo+hi)/2;if(gammaCDF(m,k,theta)<p)lo=m;else hi=m;if(hi-lo<1e-9*Math.max(1,hi))break;}
  return (lo+hi)/2;
}
// Ajuste Gamma por método de momentos: forma k = media²/varianza, escala θ = varianza/media (varianza muestral). Pide ≥5 datos > 0 y
// varianza > 0; si no, null. Sirve para valores positivos y asimétricos (tiempos de entrega, costos).
function ajusteGammaMomentos(xs){
  var v=(xs||[]).filter(function(x){return typeof x==='number'&&isFinite(x)&&x>0;});
  if(v.length<5)return null;
  var n=v.length,m=v.reduce(function(s,x){return s+x;},0)/n;
  var va=v.reduce(function(s,x){return s+(x-m)*(x-m);},0)/(n-1);
  if(!(va>0))return null;
  return{k:m*m/va,theta:va/m,media:m,n:n};
}
function betaCuantil(p,a,b){
  if(!(p>0&&p<1))return null;
  var lo=0,hi=1;
  for(var i=0;i<100;i++){var m=(lo+hi)/2;if(_betaIncompletaRegularizada(m,a,b)<p)lo=m;else hi=m;if(hi-lo<1e-10)break;}
  return (lo+hi)/2;
}
function betaPDF(x,a,b){
  if(x<=0||x>=1)return 0;
  return Math.exp(_logGamma(a+b)-_logGamma(a)-_logGamma(b)+(a-1)*Math.log(x)+(b-1)*Math.log(1-x));
}
// Beta–Bernoulli: cada cambio es un ensayo Bernoulli (éxito = el componente llegó a su TBO). Con prior Beta(a0,b0) (por defecto
// uniforme, 1 y 1) y `exitos` de `n` ensayos, la probabilidad real de éxito θ tiene posterior Beta(a0+exitos, b0+n−exitos). Funciona con
// muestras chicas (donde la proporción cruda 2/3 engaña) y da un intervalo creíble del 90%.
function betaBernoulliPosterior(exitos,n,a0,b0){
  var A=(a0==null?1:a0)+exitos,B=(b0==null?1:b0)+(n-exitos);
  return{a:A,b:B,media:A/(A+B),ic90:[betaCuantil(0.05,A,B),betaCuantil(0.95,A,B)],exitos:exitos,n:n};
}
// P(X1 > X2) para X1~Beta(a1,b1), X2~Beta(a2,b2): ∫ pdf2(x)·(1−CDF1(x)) dx por regla de Simpson (2000 intervalos).
function probabilidadMayorBeta(a1,b1,a2,b2){
  var N=2000,h=1/N,s=0;
  for(var i=0;i<=N;i++){
    var x=i*h,xe=Math.min(Math.max(x,1e-12),1-1e-12);
    var f=betaPDF(xe,a2,b2)*(1-_betaIncompletaRegularizada(xe,a1,b1));
    s+=(i===0||i===N?1:i%2?4:2)*f;
  }
  return s*h/3;
}


// ── Reemplazo óptimo por costo (política de reemplazo por edad) y matriz de estrategia (RCM) ──
// Modelo clásico: un componente con vida Weibull(β,η) se cambia de forma programada al llegar a la edad T (cuesta Cp) o, si falla antes,
// de forma no programada (cuesta Cf). Costo por hora esperado: C(T) = [Cp·R(T) + Cf·(1−R(T))] / ∫₀ᵀ R(t)dt, con R(t)=exp(−(t/η)^β).
// Si cambiar antes de la falla cuesta menos que dejarla ocurrir (Cf>Cp) y el componente se desgasta (β>1), existe un T* que minimiza C(T).
function _weibullR(t,beta,eta){return t<=0?1:Math.exp(-Math.pow(t/eta,beta));}
// ∫₀ᵀ R(t)dt por Simpson con n subintervalos (par).
function tboIntegralR(T,beta,eta,n){
  var N=n||800;if(N%2)N++;
  if(!(T>0))return 0;
  var h=T/N,s=_weibullR(0,beta,eta)+_weibullR(T,beta,eta);
  for(var i=1;i<N;i++)s+=(i%2?4:2)*_weibullR(i*h,beta,eta);
  return s*h/3;
}
function tboMTTFWeibull(beta,eta){return eta*Math.exp(_logGamma(1+1/beta));}
function tboCostoPoliticaEdad(T,beta,eta,Cp,Cf){
  var I=tboIntegralR(T,beta,eta);if(!(I>0))return null;
  var R=_weibullR(T,beta,eta);
  return (Cp*R+Cf*(1-R))/I;
}
// Edad óptima de cambio T* y su costo por hora, comparado con "dejar correr hasta la falla" (T→∞: Cf/MTTF). existe=false si no hay
// óptimo interior (β≤1, o Cf≤Cp, o el mínimo no mejora a dejar fallar).
function tboReemplazoOptimo(beta,eta,Cp,Cf){
  var mttf=tboMTTFWeibull(beta,eta),crtf=Cf/mttf;
  var r={existe:false,T:null,costoHora:null,costoHoraRTF:crtf,mttf:mttf,motivo:''};
  if(!(beta>1)){r.motivo='la forma β≤1 indica fallas al azar o tempranas: no hay desgaste que justifique cambiar por edad';return r;}
  if(!(Cf>Cp)){r.motivo='una falla no cuesta más que un cambio programado: no conviene cambiar antes';return r;}
  var lo=0.02*eta,hi=4*eta,N=800,mejorT=null,mejorC=Infinity,i,T,c;
  for(i=0;i<=N;i++){T=lo+(hi-lo)*i/N;c=tboCostoPoliticaEdad(T,beta,eta,Cp,Cf);if(c!=null&&c<mejorC){mejorC=c;mejorT=T;}}
  if(mejorT==null){r.motivo='no se pudo calcular';return r;}
  // refinamiento por sección áurea alrededor del mínimo de la grilla
  var a=Math.max(lo,mejorT-(hi-lo)/N),b=Math.min(hi,mejorT+(hi-lo)/N),g=(Math.sqrt(5)-1)/2;
  var x1=b-g*(b-a),x2=a+g*(b-a),f1=tboCostoPoliticaEdad(x1,beta,eta,Cp,Cf),f2=tboCostoPoliticaEdad(x2,beta,eta,Cp,Cf);
  for(i=0;i<80;i++){
    if(f1<f2){b=x2;x2=x1;f2=f1;x1=b-g*(b-a);f1=tboCostoPoliticaEdad(x1,beta,eta,Cp,Cf);}
    else{a=x1;x1=x2;f1=f2;x2=a+g*(b-a);f2=tboCostoPoliticaEdad(x2,beta,eta,Cp,Cf);}
  }
  mejorT=(a+b)/2;mejorC=tboCostoPoliticaEdad(mejorT,beta,eta,Cp,Cf);
  if(mejorT>=hi*0.99||!(mejorC<crtf*(1-1e-6))){r.motivo='el costo por hora casi no mejora cambiando antes: conviene dejar correr hasta la falla';return r;}
  r.existe=true;r.T=mejorT;r.costoHora=mejorC;r.ahorroVsRTF=1-mejorC/crtf;
  return r;
}
// Matriz de estrategia de mantenimiento (RCM): forma de la falla (β) × consecuencia (cuánto más cuesta fallar que cambiar, Cf/Cp).
function tboClaseForma(beta){return beta<0.9?'temprana':beta<1.2?'azar':'desgaste';}
function tboClaseConsecuencia(ratio){return ratio<2?'bajo':ratio<5?'medio':'alto';}
const TBO_RCM_MATRIZ={
  filas:[['temprana','Fallas tempranas (β<0,9)'],['azar','Al azar (β≈1)'],['desgaste','Por desgaste (β≥1,2)']],
  columnas:[['bajo','Consecuencia baja (Cf/Cp<2)'],['medio','Media (2–5)'],['alto','Alta (>5)']],
  celdas:{
    'temprana|bajo':['Investigar la causa','Revisar instalación y calidad del repuesto: cambiar por edad no ayuda'],
    'temprana|medio':['Investigar la causa','Revisar instalación y calidad del repuesto: cambiar por edad no ayuda'],
    'temprana|alto':['Investigar + vigilar','Investigar la causa y vigilar por condición; cambiar por edad no ayuda'],
    'azar|bajo':['Dejar correr hasta la falla','Tener el repuesto disponible; cambio oportunista en una parada'],
    'azar|medio':['Por condición','Inspección o aceite; si no se puede detectar, dejar fallar con repuesto en stock'],
    'azar|alto':['Por condición','Inspección periódica: cambiar por edad no mejora el costo'],
    'desgaste|bajo':['Dejar correr / oportunista','Cambiar al aprovechar una parada; no justifica parar por esto'],
    'desgaste|medio':['Cambio por edad (con holgura)','Cambiar cerca de T*, o por condición si se puede detectar'],
    'desgaste|alto':['Cambio por edad a T*','Conviene claramente cambiar a la edad óptima']
  }
};
function tboEstrategiaRCM(beta,ratio){
  var f=tboClaseForma(beta),c=tboClaseConsecuencia(ratio),cel=TBO_RCM_MATRIZ.celdas[f+'|'+c];
  return{forma:f,consecuencia:c,celda:f+'|'+c,estrategia:cel[0],detalle:cel[1]};
}
// Parámetros de vida (β, η) de un grupo componente+origen para el modelo. Con ≥5 cambios medidos se ajusta Weibull; con 1–4 se usa
// β=3 (el supuesto de desgaste del fabricante) y η tal que la mediana observada coincida; el original sin datos usa el modelo del TBO
// (β=3, TBO = B5); el alternativo sin datos no se estima. Nunca se mezclan orígenes para estimar β (mezclar sesga β hacia abajo).
function tboParametrosVida(fila){
  var v=(fila&&fila.vals)||[];
  if(v.length>=5){var aj=ajusteWeibullVidas(v);if(aj&&aj.beta>0&&aj.eta>0)return{beta:aj.beta,eta:aj.eta,fuente:'Weibull ajustado con '+v.length+' cambios'};}
  if(v.length>=1){var s=v.slice().sort(function(a,b){return a-b;}),n=s.length,med=n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2;
    return{beta:TBO_BETA,eta:med/Math.pow(Math.LN2,1/TBO_BETA),fuente:'β=3 supuesto del fabricante; η con '+n+' cambio'+(n>1?'s':'')+' medido'+(n>1?'s':'')};}
  if(fila&&fila.origen==='original'&&fila.tbo&&fila.tbo.min===fila.tbo.max)
    return{beta:TBO_BETA,eta:fila.tbo.min/Math.pow(-Math.log(0.95),1/TBO_BETA),fuente:'modelo del fabricante (TBO = 5% de fallas)'};
  return null;
}
// Política óptima para cada fila componente+origen de tboCostoPorHora (necesita precio). ctx: {tarifaHH, hhCambio, horasProg, horasFalla,
// costoHoraDet}. Cp = repuesto + mano de obra + parada programada; Cf = repuesto + mano de obra + parada por falla.
function tboPoliticaOptimaFilas(filas,ctx){
  var c=ctx||{},th=c.tarifaHH||0,hh=c.hhCambio||0,hp=c.horasProg||0,hf=c.horasFalla||0,cd=c.costoHoraDet||0;
  return (filas||[]).map(function(f){
    var base=Object.assign({},f,{param:null,Cp:null,Cf:null,ratio:null,opt:null,estrategia:null,costoHoraTBOPol:null});
    if(!f.precio)return base;
    var p=tboParametrosVida(f);if(!p)return base;
    var Cp=f.precio+hh*th+hp*cd,Cf=f.precio+hh*th+hf*cd,ratio=Cp>0?Cf/Cp:null;
    var opt=tboReemplazoOptimo(p.beta,p.eta,Cp,Cf);
    var tboRef=f.tbo&&f.tbo.min===f.tbo.max?f.tbo.min:null;
    return Object.assign(base,{param:p,Cp:Cp,Cf:Cf,ratio:ratio,opt:opt,estrategia:ratio?tboEstrategiaRCM(p.beta,ratio):null,
      costoHoraTBOPol:tboRef?tboCostoPoliticaEdad(tboRef,p.beta,p.eta,Cp,Cf):null,
      ahorroVsTBO:(opt.existe&&tboRef)?1-opt.costoHora/tboCostoPoliticaEdad(tboRef,p.beta,p.eta,Cp,Cf):null});
  });
}


// ── Bondad de ajuste y comparación de modelos de vida/tiempo (Weibull, log-normal, Gamma, exponencial) ──
// Responde "¿estamos usando la distribución correcta?": ajusta cada modelo por máxima verosimilitud, los ordena por AICc (AIC con corrección
// de muestra chica; menor es mejor), mide la distancia de Kolmogorov-Smirnov, el error en los percentiles 90 y 99 (lo que de verdad usan las
// decisiones) y, si se pide, un p-valor por bootstrap paramétrico (la KS clásica no sirve cuando los parámetros se estiman de los mismos datos).
function _digamma(x){
  var r=0;while(x<6){r-=1/x;x+=1;}
  var f=1/(x*x);
  return r+Math.log(x)-0.5/x-f*(1/12-f*(1/120-f*(1/252-f*(1/240-f/132))));
}
function _trigamma(x){
  var r=0;while(x<6){r+=1/(x*x);x+=1;}
  var x2=x*x,x3=x2*x,x5=x3*x2,x7=x5*x2,x9=x7*x2;
  return r+1/x+1/(2*x2)+1/(6*x3)-1/(30*x5)+1/(42*x7)-1/(30*x9);
}
function _normCDF(z){var p=_gammaIncRegularizada(0.5,z*z/2);return z>=0?0.5*(1+p):0.5*(1-p);}
function _positivos(xs){return (xs||[]).filter(function(x){return typeof x==='number'&&isFinite(x)&&x>0;});}
function ajusteExponencialMLE(xs){var v=_positivos(xs);if(v.length<5)return null;return{theta:v.reduce(function(s,x){return s+x;},0)/v.length};}
function ajusteLogNormalMLE(xs){
  var v=_positivos(xs);if(v.length<5)return null;var n=v.length;
  var l=v.map(Math.log),mu=l.reduce(function(s,x){return s+x;},0)/n;
  var s2=l.reduce(function(s,x){return s+(x-mu)*(x-mu);},0)/n;
  return s2>0?{mu:mu,sigma:Math.sqrt(s2)}:null;
}
function ajusteGammaMLE(xs){
  var v=_positivos(xs);if(v.length<5)return null;var n=v.length;
  var m=v.reduce(function(s,x){return s+x;},0)/n,ml=v.reduce(function(s,x){return s+Math.log(x);},0)/n,s=Math.log(m)-ml;
  if(!(s>1e-12))return null;
  var k=(3-s+Math.sqrt((3-s)*(3-s)+24*s))/(12*s);
  for(var i=0;i<60;i++){
    var f=Math.log(k)-_digamma(k)-s,fp=1/k-_trigamma(k),kn=k-f/fp;
    if(!(kn>0))kn=k/2;
    if(Math.abs(kn-k)<1e-11*Math.max(1,k)){k=kn;break;}
    k=kn;
  }
  return isFinite(k)&&k>0?{k:k,theta:m/k}:null;
}
// Weibull sin censura por máxima verosimilitud (bisección sobre β; sin redondeos, a diferencia de ajusteWeibullCensurado).
function ajusteWeibullMLE(xs){
  var v=_positivos(xs);if(v.length<5)return null;var n=v.length;
  var ml=v.reduce(function(s,x){return s+Math.log(x);},0)/n;
  function g(b){var s1=0,s2=0;for(var i=0;i<n;i++){var p=Math.pow(v[i],b);s1+=p;s2+=p*Math.log(v[i]);}return s2/s1-1/b-ml;}
  var lo=0.02,hi=60;
  if(!(g(lo)<0&&g(hi)>0))return null;
  for(var i=0;i<200;i++){var mid=(lo+hi)/2;if(g(mid)<0)lo=mid;else hi=mid;if(hi-lo<1e-12)break;}
  var b=(lo+hi)/2,s1=0;for(var j=0;j<n;j++)s1+=Math.pow(v[j],b);
  return{beta:b,eta:Math.pow(s1/n,1/b)};
}
var TBO_MODELOS_VIDA=['weibull','lognormal','gamma','exponencial'];
function _ajusteModelo(m,xs){
  return m==='weibull'?ajusteWeibullMLE(xs):m==='lognormal'?ajusteLogNormalMLE(xs):m==='gamma'?ajusteGammaMLE(xs):ajusteExponencialMLE(xs);
}
function _cdfModelo(m,p,x){
  if(!(x>0))return 0;
  if(m==='weibull')return 1-Math.exp(-Math.pow(x/p.eta,p.beta));
  if(m==='lognormal')return _normCDF((Math.log(x)-p.mu)/p.sigma);
  if(m==='gamma')return gammaCDF(x,p.k,p.theta);
  return 1-Math.exp(-x/p.theta);
}
function _cuantilModelo(m,p,q){
  if(m==='weibull')return p.eta*Math.pow(-Math.log(1-q),1/p.beta);
  if(m==='lognormal')return Math.exp(p.mu+p.sigma*_normInv(q));
  if(m==='gamma')return gammaCuantil(q,p.k,p.theta);
  return -p.theta*Math.log(1-q);
}
function _logVerosimilitudModelo(m,p,xs){
  var n=xs.length,i,s=0;
  if(m==='weibull'){for(i=0;i<n;i++)s+=Math.log(p.beta/p.eta)+(p.beta-1)*Math.log(xs[i]/p.eta)-Math.pow(xs[i]/p.eta,p.beta);return s;}
  if(m==='lognormal'){for(i=0;i<n;i++){var l=Math.log(xs[i]);s+=-l-Math.log(p.sigma)-0.5*Math.log(2*Math.PI)-(l-p.mu)*(l-p.mu)/(2*p.sigma*p.sigma);}return s;}
  if(m==='gamma'){var lg=_logGamma(p.k);for(i=0;i<n;i++)s+=(p.k-1)*Math.log(xs[i])-xs[i]/p.theta-p.k*Math.log(p.theta)-lg;return s;}
  for(i=0;i<n;i++)s+=-Math.log(p.theta)-xs[i]/p.theta;return s;
}
function _ksD(sorted,cdf){
  var n=sorted.length,d=0;
  for(var i=0;i<n;i++){var F=cdf(sorted[i]);d=Math.max(d,(i+1)/n-F,F-i/n);}
  return d;
}
function _cuantilEmpirico(sorted,q){var n=sorted.length,h=(n-1)*q,lo=Math.floor(h),hi=Math.ceil(h);return sorted[lo]+(sorted[hi]-sorted[lo])*(h-lo);}
// Generador pseudoaleatorio con semilla (mulberry32): mismos resultados en cada corrida.
function _rngSemilla(seed){var a=seed>>>0;return function(){a=(a+0x6D2B79F5)>>>0;var t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function _normalAleatoria(rng){var u=Math.max(rng(),1e-12),v=rng();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
function _gammaAleatoria(rng,k){ // Marsaglia–Tsang; k<1 por el truco de elevar k+1
  if(k<1)return _gammaAleatoria(rng,k+1)*Math.pow(Math.max(rng(),1e-12),1/k);
  var d=k-1/3,c=1/Math.sqrt(9*d);
  for(var it=0;it<1000;it++){
    var x=_normalAleatoria(rng),v=1+c*x;if(v<=0)continue;v=v*v*v;
    var u=rng();if(Math.log(Math.max(u,1e-300))<0.5*x*x+d-d*v+d*Math.log(v))return d*v;
  }
  return d;
}
function _muestraModelo(m,p,n,rng){
  var out=new Array(n),i;
  for(i=0;i<n;i++){
    if(m==='weibull')out[i]=p.eta*Math.pow(-Math.log(Math.max(rng(),1e-300)),1/p.beta);
    else if(m==='lognormal')out[i]=Math.exp(p.mu+p.sigma*_normalAleatoria(rng));
    else if(m==='gamma')out[i]=_gammaAleatoria(rng,p.k)*p.theta;
    else out[i]=-p.theta*Math.log(Math.max(rng(),1e-300));
  }
  return out;
}
// Compara los 4 modelos sobre una muestra (≥8 datos > 0). opts.B = réplicas de bootstrap paramétrico para el p-valor de KS (0 = no se calcula;
// con n grande es lento), opts.semilla. Devuelve los modelos ordenados por AICc, con ΔAICc respecto del mejor.
function compararModelosVida(xs,opts){
  var o=opts||{},v=_positivos(xs);
  if(v.length<8)return null;
  var n=v.length,sorted=v.slice().sort(function(a,b){return a-b;});
  var e90=_cuantilEmpirico(sorted,0.9),e99=_cuantilEmpirico(sorted,0.99);
  var filas=[];
  TBO_MODELOS_VIDA.forEach(function(m){
    var par=_ajusteModelo(m,v);if(!par)return;
    var k=m==='exponencial'?1:2,ll=_logVerosimilitudModelo(m,par,v);
    var aic=2*k-2*ll,aicc=n-k-1>0?aic+2*k*(k+1)/(n-k-1):Infinity,bic=k*Math.log(n)-2*ll;
    var D=_ksD(sorted,function(x){return _cdfModelo(m,par,x);});
    var q90=_cuantilModelo(m,par,0.9),q99=_cuantilModelo(m,par,0.99);
    var fila={modelo:m,par:par,ll:ll,aic:aic,aicc:aicc,bic:bic,D:D,p90:q90,p99:q99,errP90:(q90-e90)/e90,errP99:(q99-e99)/e99,pBoot:null};
    if(o.B>0){
      var rng=_rngSemilla((o.semilla==null?12345:o.semilla)+TBO_MODELOS_VIDA.indexOf(m)*977),mas=1,usadas=0;
      for(var b=0;b<o.B;b++){
        var sim=_muestraModelo(m,par,n,rng),pb=_ajusteModelo(m,sim);if(!pb)continue;
        var ss=sim.slice().sort(function(a,c){return a-c;});
        if(_ksD(ss,function(x){return _cdfModelo(m,pb,x);})>=D)mas++;
        usadas++;
      }
      fila.pBoot=usadas>0?mas/(usadas+1):null;
    }
    filas.push(fila);
  });
  if(!filas.length)return null;
  filas.sort(function(a,b){return a.aicc-b.aicc;});
  var mejor=filas[0].aicc;
  filas.forEach(function(f){f.dAICc=f.aicc-mejor;});
  return{n:n,modelos:filas,mejor:filas[0].modelo,emp:{p90:e90,p99:e99,media:v.reduce(function(s,x){return s+x;},0)/n}};
}


// ── Optimización con presupuesto limitado (qué cambios comprar primero) ──
// Problema de la mochila 0/1: de los repuestos por comprar, elegir los que maximizan la pérdida esperada evitada sin pasarse del presupuesto.
// Resolución exacta por programación dinámica sobre costos discretizados (los costos se redondean HACIA ARRIBA a la unidad `paso`, así que el
// resultado nunca excede el presupuesto; con 10.000 unidades el error de redondeo es <0,01% del total por ítem). Se compara con la regla simple
// "por urgencia" (comprar en el orden del plan hasta que se acabe la plata) y con el orden voraz por beneficio/costo.
// cands: [{costo>0, beneficio>=0, ...}]. Devuelve índices elegidos (sobre `cands`), totales y la frontera presupuesto→beneficio.
function tboMochila(cands,presupuesto,opts){
  var o=opts||{},items=(cands||[]).map(function(c,i){return{i:i,costo:c.costo,ben:c.beneficio};}).filter(function(x){return x.costo>0&&x.ben>=0;});
  var total=items.reduce(function(s,x){return s+x.costo;},0),cap=Math.max(presupuesto||0,0);
  var paso=o.paso>0?o.paso:Math.max(total,1)/(o.celdas||10000);
  var W=Math.floor(total/paso+1e-9),Wcap=Math.min(Math.floor(cap/paso+1e-9),W),n=items.length;
  var w=items.map(function(x){return Math.ceil(x.costo/paso-1e-9);});
  // dp[j] = mejor beneficio con capacidad ≤ j. keep[k][j]=1 si el ítem k entra en la solución óptima de capacidad j tras procesar k ítems.
  var dp=new Float64Array(W+1),keep=[];
  for(var k=0;k<n;k++){
    var row=new Uint8Array(W+1);
    for(var j=W;j>=w[k];j--){var v=dp[j-w[k]]+items[k].ben;if(v>dp[j]+1e-12){dp[j]=v;row[j]=1;}}
    keep.push(row);
  }
  var elegidos=[],j2=Wcap;
  for(var k2=n-1;k2>=0;k2--){if(keep[k2][j2]){elegidos.push(items[k2].i);j2-=w[k2];}}
  elegidos.reverse();
  var suma=function(idx,campo){return idx.reduce(function(s,i){return s+cands[i][campo];},0);};
  // Voraz por beneficio/costo (referencia) y regla "por urgencia" (en el orden dado, sin saltarse: compra mientras alcance).
  var porRatio=items.slice().sort(function(a,b){return b.ben/b.costo-a.ben/a.costo;}),gasto=0,voraz=[];
  porRatio.forEach(function(x){if(gasto+x.costo<=cap+1e-9){voraz.push(x.i);gasto+=x.costo;}});
  var g2=0,urg=[];
  items.forEach(function(x){if(g2+x.costo<=cap+1e-9){urg.push(x.i);g2+=x.costo;}});
  // Frontera: mejor beneficio alcanzable con cada presupuesto hasta comprarlo todo (10 puntos). dp[j] ya es "≤ j".
  var frontera=[];
  for(var q=1;q<10;q++){var jj=Math.floor(W*q/10);frontera.push({presupuesto:Math.round(jj*paso),beneficio:dp[jj]});}
  frontera.push({presupuesto:Math.round(total),beneficio:items.reduce(function(s2,x){return s2+x.ben;},0)});
  // El redondeo hacia arriba puede dejar al DP apenas bajo una solución voraz (que usa costos exactos): se queda con la mejor solución factible.
  var mejor=elegidos;
  if(suma(voraz,'beneficio')>suma(mejor,'beneficio'))mejor=voraz.slice().sort(function(a,b){return a-b;});
  if(cap>=total)mejor=items.map(function(x){return x.i;});
  return{elegidos:mejor,costo:suma(mejor,'costo'),beneficio:suma(mejor,'beneficio'),
    voraz:{elegidos:voraz,costo:suma(voraz,'costo'),beneficio:suma(voraz,'beneficio')},
    urgencia:{elegidos:urg,costo:suma(urg,'costo'),beneficio:suma(urg,'beneficio')},
    frontera:frontera,paso:paso,totalCosto:total,totalBeneficio:suma(items.map(function(x){return x.i;}),'beneficio')};
}
// Candidatos para la mochila desde las filas del plan de compra. Beneficio = probabilidad de que falle dentro del horizonte (Weibull
// condicional, `tboRiesgoHorizonte`) × consecuencia de una falla no programada. Consecuencia = (Cf−Cp) del modelo de reemplazo óptimo
// cuando el usuario ingresó el costo de hora detenida (horas extra de parada × costo/hora); si no, el precio del repuesto (mismo proxy de
// impacto de la Matriz de Riesgo). Solo entran filas con dato real de último cambio (los teóricos no tienen riesgo medido), con precio y que
// hay que comprar (pedir_ya / planificar). Las filas sin precio se devuelven aparte: no se pueden priorizar.
function tboCandidatosPresupuesto(filasPlan,ctx){
  // ctx.costoHoraDetDe(fila) (opcional): costo de hora detenida del equipo de cada fila (por modelo); sin él se usa ctx.costoHoraDet para todas.
  var c=ctx||{},H=c.horizonte>0?c.horizonte:500,dh=Math.max((c.horasFalla||0)-(c.horasProg||0),0);
  var cdDe=function(f){return typeof c.costoHoraDetDe==='function'?(Number(c.costoHoraDetDe(f))||0):(c.costoHoraDet||0);};
  var usaDet=false,cands=[],sinPrecio=[],sinRiesgo=0;
  (filasPlan||[]).forEach(function(f){
    if(f.decision!=='pedir_ya'&&f.decision!=='planificar')return;
    if(!f.conDato){sinRiesgo++;return;}
    if(!(f.costoEst>0)){sinPrecio.push(f);return;}
    var cdf=cdDe(f),usaF=cdf>0&&dh>0,p=tboRiesgoHorizonte(f.desdeH,f.tbo,H),cons=usaF?dh*cdf:f.costoEst;
    if(usaF)usaDet=true;
    cands.push({fila:f,costo:f.costoEst,pFalla:p,consecuencia:cons,beneficio:p*cons,usaDet:usaF});
  });
  return{cands:cands,sinPrecio:sinPrecio,sinRiesgo:sinRiesgo,usaDet:usaDet,horizonte:H};
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    tboTiemposEntrega, _digamma, _trigamma, _normCDF, ajusteExponencialMLE, ajusteLogNormalMLE, ajusteGammaMLE, ajusteWeibullMLE, TBO_MODELOS_VIDA, _rngSemilla, compararModelosVida,
    tboIntegralR, tboMTTFWeibull, tboCostoPoliticaEdad, tboReemplazoOptimo, tboClaseForma, tboClaseConsecuencia, TBO_RCM_MATRIZ, tboEstrategiaRCM, tboParametrosVida, tboPoliticaOptimaFilas, tboMochila, tboCandidatosPresupuesto,
    tboProbLlegaAntes, tboComparaOrigen, _betaIncompletaRegularizada, _gammaIncRegularizada, gammaCDF, gammaCuantil, ajusteGammaMomentos, betaCuantil, betaPDF, betaBernoulliPosterior, probabilidadMayorBeta,
    tboCantidadItem, tboLeadTimeFn, tboStockFn, tboPedidosAbiertosFn, tboDecisionCompra, tboPlanCompras,
    TBO_APLICACION, TBO_GUIA_APLICACION, TBO_BETA, tboRiesgoWeibull, tboRiesgoHorizonte, tboProbNivel, tboMatrizRiesgo, tboCostoPorHora,
    TBO_COMP_MAP, tboCompMap, tboClasificarOrigen, tboOrigenPorCompra, tboUltimoCambioFn, tboEstadoFlota, tboResumenAlertas, tboVidaPorOrigen, TBO_PRECIO_RX, tboPrecioItem,
    TBO_FAMILIAS, TBO_FUERA, TBO_ITEMS, TBO_REGLAS_COMPRA, TBO_SUGERIDO, tboNormalizarPN, tboClaseModelo, tboFamiliaDeCompra, tboUnirCompras, tboCruzarCompras, tboFamiliaDeClase, tboPlanEquipo, tboCruzarSugerido,
    clasificacionPendienteOT, resumenClasificacionOT, repararMojibake,
    sistemasDeTexto, sistemasCubiertosPorPM, calidadEjecucionPM, _lecturaRazonCE, _relativoCE, _fraccionDiasConFallaCE, validarPMCompleto, estadoPMCompleto,
    C, fd, fn, escapeHtml, csvCeldaSegura,
    _tokensMaterial, _scoreMaterial, precioMaterial,
    esLubricante, vencReglaDefault, vencCalcProximo, vencEstado,
    fechaEsPlausible, fechaEsAnterior, duracionHM, medianaPositiva, hhPlanEstimator,
    LUB_REEMPLAZO, lubVigente, lubEsObsoleto, construirLecturaHistorial,
    predFromOrdenes, ordenesSinOutliers, aceiteOutliers, outliersMultivariadosAceite, cusumAceite, cusumAceitePorComponente, analisisDemandaRepuestos, proyeccionElementosDesgaste, modeloColasMMC, bayesEmpiricoGammaPoisson, probabilidadQuiebreLeadTime, probabilidadQuiebreABanda, criticidadEquipoABanda, matrizCriticidadRepuestos, analisisABCXYZRepuestos, puntoReordenSeguridad, puntosReordenRepuestos, loteEconomicoPedido, eoqRazonCosto, politicasReposicionRepuestos, costoHoraDetDe, costoHoraDetPropio, tcoFlotaAuto, parsearHorasAmortizar, sankeyCostoTCO, sankeyHorasReparacion, sankeyLayout, arriendoVsCompra, arriendoDefectoModelo, ARRIENDO_GENERAL_DEFECTO, bandaCriticidadEquipo, equiposDeRepuesto, vedRepuestos, matrizABCVED, vedDeBanda, urgenciaPorDias, prioridadOT, VED_NIVEL_SERVICIO, ABCVED_CATEGORIA, criticidadEquiposMulticriterio, efectoMinimoDetectable, hrMinimoDetectable, avisoMuestraChica, avisoMuestraChicaSupervivencia, neuProgramaCambios, neuCambiosRealizados, pcaAnalisis, _eigenSimetrica, pcaVariablesEquipos, paresZRobusto, REPORTAB_MAPA_SIGLAS, reportabilidadFechaDeNombre, reportabilidadParsearHoja, reportabilidadArmarLote, reportabilidadFusionar, reportabilidadDisponibilidad, reportabilidadEpisodios, curvaSPM, periodoRango, periodoEtiqueta, periodoOpciones, cumplimientoProgramaPeriodos, cumplimientoProgramaMeses, pmTipoEfectivo, pmDuracionesEstandar, PM_DURACION_ESTANDAR_H, PM_EQUIVALENCIA, pronosticoDisponibilidadEquipos, backtestPronosticoDisponibilidad, tcoCapitalPorHora, tcoConciliarValor, tcoEquipo, tcoFlota, TCO_VIDA_CONTABLE_H, planReposicionAuto, demandaMensualPlanPorNParte, pmProgramadosEquipo, pautaResolverStock, demandaPlanificadaPM, planReposicionPM, tboVidasObservadas, tboCalibrarGrupo, tboCalibracionFlota, tboCalibracionAuto, _calibFilas, _ksUniformeP, tboAjustesCosto, tboDecisionFicha, tboFichasEquipo, tboPctSano, tboFichasFlota, tboSaludFlotaAuto, valorPrevioSalud, SALUD_EQUIPO_METODO_DESDE, TBO_COSTO_HORA_DET_USD, pronosticarSerie, pronRecortarAtipicos, serieMensualDe, mesesFinalesIncompletos, mesesSiguientes, PRON_MODELOS, rotacionInventarioMRO, obsolescenciaStockMRO, calcularNPR, prioridadNPR, analisisMTTRLogNormal, stockEstado, compEstado, tasaDiariaReal, horomEnFecha, rangoDias, dispDownMap, dispEquipoMes, dispIntrinsecaEquipoMes, _normalizarModelo, rendimientoTeoricoCargadorFrontal, produccionPerdidaPorDetencion, rendimientoRealEquipoMes, tonPerdidaIndisponibilidadMes, costoDowntimeMes, rendimientoPorCicloEquipoMes, brechaRendimientoCiclo, coeficienteVariacion, interpretacionCV, pagSlice, hayConflictoIds, costoRelativoMantenimiento, costoRelativoMantenimientoFlota, _concentracionMaximaOC, costoSugeridoPorCruce, senalUnificadaReemplazo,
    validarSaltoHorometro, resolverDestrabePorOC, verificarIntegridad,
    indiceSaludFlota, scoreSaludEquipo, equiposConSaludFlota, motivoPrincipalSalud, peoresDimensionesSalud, recomendacionDimensionSalud, registrarSnapshotSalud, tendenciaSaludSemanal, matrizTransicionSalud, proyeccionSaludNSemanas,
    equiposFueraDeServicioAhora, validarMotivoPmPendiente, sugerenciaAgruparPM, intervalosFallaFlotaDias, duracionesReparacionFlotaHoras, simulacionMonteCarloDisponibilidad, simulacionWhatIf, compararEscenariosMantenimiento, mtbfFlotaReal, confiabilidadReal, intervaloConfianzaMTBF, errorEstandarMTTR, wilsonIC95, mannKendallTendencia, r2RegresionLineal, cartaControlIMR, cartaControlEWMA, mannWhitneyU, anovaUnFactor, kruskalWallis, levenePruebaVarianzas, ajusteWeibull, ajusteWeibullVidas, analisisVidaUtilPorGrupo, analisisVidaUtilCorrectivosPorComponente, ajusteWeibullCensurado, ajusteWeibullEquipoCensurado, analisisVidaUtilPorGrupoCensurado, ajusteWeibullCorrectivosPorComponenteCensurado, kijimaEquipo, simulacionTrayectoriasGRP, simulacionTrayectoriasGRPDesdeKijima, kaplanMeier, logRankTest, coxPHBinario, kaplanMeierCorrectivosPorComponente, competingRisks, competingRisksPorEquipo, mcf, mcfCorrectivosPorComponente, crowAMSAA, crowAMSAAPorComponente, interpretacionCrowAMSAA, indiceEfectividadMantenimiento, interpretacionEfectividadMantenimiento, rulWeibull, rulHibridoComponente, rulHibridoPorComponente, oportunidadMantenimiento, oportunidadesMantenimientoFlota, confiabilidadWeibull, confiabilidadSistemaEquipo, interpretacionFormaWeibull, interpretacionAjusteWeibull, correlacionAceiteFallas, regEsATiempo, esFallaMTBF, tasaFallaPorUbicacion, testChiCuadradoUniforme, patronesOcultosFalla, causasLatentesRepetidas, _CATEGORIAS_MTTR, analisisMTTRPorCategoria, _CLASIFICACIONES_COSTO, analisisCapexOpex, trazabilidadAvisoOrden, resumenTrazabilidadAvisoOrden, _parsearTiempoRespuestaDias, tiempoRespuestaPorProveedor, pedidosPotencialmenteTrabados, tiempoAprobacionOC, _normalizarComponente, intervalosPF, testIndependenciaChi2, independenciaComponenteUbicacion, edadVirtualEquipo,
    probabilidadFallaDesdeEventos, paretoAcumulado, _otHistComoOt, _informesFallaComoOt, contarFallasMes, ratioPreventivo, porcentajeCorrectivoReactivo,
    _gastoProyectadoCategoria, agruparPeriodo, equiposSinCriticidad, fechaAyer, fechaMismoDiaAnioPasado, presupuestoProrrateado,
    _CATEGORIAS_COMPONENTE, _componenteDeSintoma, _SUBPIEZAS_DESGASTE, _subpiezasDeSintoma,
    probabilidadComponente, probabilidadEquipoSeveridad, probabilidadStockQuiebre, probabilidadReincidencia,
    umbralesImpacto, impactoDeValor, nivelRiesgoPxI, criticidadDinamicaComponente, matrizCriticidadDinamica, matrizJackKnife, JK_ACCIONES
  };
}
