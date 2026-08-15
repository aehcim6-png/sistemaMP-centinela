// ═══════════════════════════════════════════════════════════════
// PREDICTIVO & CONFIABILIDAD
// El motor de interpretación automática (categorización de componentes,
// causa raíz, diagnóstico integral, stock/lubricantes vs. próximos PM,
// diagnóstico de flota) vivía disperso, intercalado con computePred y
// _cadenaPMEnHorizonte — esos dos SÍ quedan compartidos en index.html
// porque también los usa Plan Semanal / Planificador de Materiales
// (ya extraídos). Todo lo demás de este motor es exclusivo de esta
// pestaña y se junta acá.
// ═══════════════════════════════════════════════════════════════
// ═══ MOTOR DE INTERPRETACIÓN AUTOMÁTICA ═══
// El campo "componente" de correctivos está vacío en el 100% de los registros
// reales (verificado 2026-07 — nadie lo llena en terreno); la descripción real
// vive como texto libre en "síntoma", sin formato consistente ("Asiento",
// "ASIENTO NO FUNCIONAL", "asiento con falla en respaldar", etc.). Sin esto,
// toda detección de "falla recurrente en el mismo componente" (acá y en
// generarDiagnostico) queda ciega — nunca encuentra nada que agrupar.
var _CATEGORIAS_COMPONENTE=[
  ['Asiento',['asiento']],
  ['Batería',['bateria','batería','baterias','baterías']],
  ['Motor de Partida',['motor de partida','motor partida']],
  ['Cilindro de Dirección',['cilindro direccion','cilindro de direccion','cilindro dirección','cilindro de dirección','cilindro volante']],
  ['Neumáticos',['neumatico','neumático','neumaticos','neumáticos']],
  ['Frenos',['freno']],
  ['Transmisión',['transmision','transmisión']],
  ['Diferencial',['diferencial','diferecial']],
  ['Mandos Finales',['mandos finales','mando final']],
  ['Turbo',['turbo']],
  ['Alternador',['alternador']],
  ['Bomba de Agua',['bomba de agua','bomba agua']],
  ['Radiador/Enfriamiento',['radiador','refrigerante']],
  ['Suspensión',['suspension','suspensión']],
  ['Inyectores',['inyector','inyectores']],
  ['Filtro de Combustible',['filtro de combustible','filtro combustible']],
  ['Filtro de Aire',['filtro de aire','filtro aire']],
  ['Bomba de Combustible',['bomba de combustible','bomba combustible','bomba inyectora']],
  ['Crucetas',['cruceta','crucetas']],
  ['Soporte de Cabina',['soporte de cabina','soporte cabina']],
  ['Conectores/Cableado',['conector','conectores','arnes','arnés']],
  ['Mangueras/Fugas',['manguera','mangueras','flexible hidraulico','flexible hidráulico']],
  ['Elemento de Desgaste',['elemento de desgaste','elementos de desgaste']],
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
  ['Sistema Eléctrico',['electrico','eléctrico','elÃ©ctrico']],
  ['Aire Acondicionado',['aire acondicionado',' a/c ','a/c.','condensador']],
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
// Palabras clave de causa raíz típicas en minería — compartido entre predecirCausa
// (por equipo) y diagnosticoFlota (toda la flota, ver más abajo).
var _DICC_CAUSA_RAIZ=['desgaste','fatiga','contaminación','contaminacion','sobrecarga','corrosión','corrosion',
  'vibración','vibracion','temperatura','sobrecalentamiento','lubricación','lubricacion','falta de aceite',
  'fuga','filtración','filtracion','rotura','fractura','grieta','impacto','golpe','corte',
  'obstrucción','obstruccion','suciedad','barro','polvo','humedad','óxido','oxido',
  'desalineación','desalineacion','holgura','desbalance','fisura','desgarro','presión','presion',
  'eléctrica','electrica','cortocircuito','sensor','conexión','conexion','cable','fusible',
  'defecto fábrica','defecto fabrica','mal montaje','instalación','instalacion','operación','operacion'];
function _normalizarCausa(kw){
  return kw.replace('contaminacion','contaminación').replace('vibracion','vibración')
    .replace('lubricacion','lubricación').replace('corrosion','corrosión')
    .replace('presion','presión').replace('operacion','operación');
}
// Cuenta frecuencia de palabras clave de _DICC_CAUSA_RAIZ dentro de un arreglo de
// textos (normalmente causaRaiz de varios correctivos) y devuelve la más frecuente.
function _frecuenciaCausas(textos){
  var frec={};
  textos.forEach(function(txt){
    txt=(txt||'').toLowerCase();
    _DICC_CAUSA_RAIZ.forEach(function(kw){
      if(txt.indexOf(kw)>=0){
        var key=_normalizarCausa(kw);
        frec[key]=(frec[key]||0)+1;
      }
    });
  });
  var keys=Object.keys(frec);
  if(!keys.length)return null;
  var top=keys.reduce(function(a,b){return frec[a]>=frec[b]?a:b;});
  return{causa:top,n:frec[top]};
}
// ═══ ANALÍTICA DE CAUSA RAÍZ (Mejora 2) ═══
function predecirCausa(sigla, componente){
  var ot=S.g('ot')||[];
  // Filtrar fallas previas del mismo equipo (y componente si se indica)
  var fallasAnteriores=ot.filter(function(o){
    if(o.sigla!==sigla)return false;
    if(componente&&o.componente&&o.componente!==componente)return false;
    return o.causaRaiz&&o.causaRaiz.trim().length>0;
  });
  if(fallasAnteriores.length===0)return null;
  var top=_frecuenciaCausas(fallasAnteriores.map(function(f){return f.causaRaiz;}));
  if(!top)return {texto:'Hay '+fallasAnteriores.length+' falla(s) previa(s) pero sin patrón de causa claro. Revisar historial detallado.',n:fallasAnteriores.length};
  return {texto:'Según '+fallasAnteriores.length+' incidente(s) previo(s), la causa raíz más probable es: '+top.causa.toUpperCase()+' ('+top.n+' veces)',n:fallasAnteriores.length,causa:top.causa};
}


function generarDiagnostico(sigla){
  var eq=S.g('eq')||[];
  var ot=S.g('ot')||[];
  var insp=S.g('insp')||[];
  var aceite=S.g('aceite')||[];
  var stk=S.g('stk')||[];
  var lub=S.g('lub')||[];
  var rep=S.g('repuestos')||[];
  var e=eq.find(function(x){return x.sigla===sigla;});
  if(!e)return null;
  var P=computePred();
  var eqData=P.equipos[sigla]||null;

  var d={sigla:sigla,modelo:e.modelo,tipo:e.tipo,secciones:[]};

  // 1. ¿QUÉ ESTÁ PASANDO?
  var quePasa=[];
  var estadoPM=e.estado||'';
  if(estadoPM.includes('URGENTE')||estadoPM.includes('VENCIDA'))quePasa.push('PM '+e.tipoPM+' vencida ('+Math.abs(e.diasParaPM)+' días atrasado)');
  if(estadoPM.includes('PRÓXIMA'))quePasa.push('PM '+e.tipoPM+' próxima en '+e.diasParaPM+' días');

  // OTs pendientes
  var otPend=ot.filter(function(o){return o.sigla===sigla&&o.estadoOT==='Pendiente';});
  if(otPend.length)quePasa.push(otPend.length+' OT pendiente'+(otPend.length>1?'s':'')+': '+otPend.map(function(o){return o.sintoma||o.tipo;}).join(', ').substring(0,80));

  // Inspecciones NOK
  var inspRecent=insp.filter(function(r){return r.sigla===sigla;}).slice(-3);
  var noks=[];
  inspRecent.forEach(function(r){
    ['visual','niveles','fugas','luces','frenos','neumaticos'].forEach(function(c){
      if(r[c]==='NOK')noks.push(c);
    });
  });
  if(noks.length)quePasa.push('Inspección con NOK en: '+[...new Set(noks)].join(', '));

  // Oil alerts
  var aceMuestras=aceite.filter(function(m){
    if(m.equipo)return m.equipo===sigla;
    return (m.componente||'').includes(sigla.replace('CN-','CE-').replace('CF-','CF-').replace('BD-','BD-'));
  });
  var aceAlertas=aceMuestras.filter(function(m){return m.estado==='ALERTA';});
  var acePrec=aceMuestras.filter(function(m){return m.estado==='PRECAUCION';});
  if(aceAlertas.length){
    aceAlertas.forEach(function(a){
      var metals=[];
      if(parseFloat(a.hierro)>50)metals.push('Fe:'+a.hierro);
      if(parseFloat(a.cobre)>30)metals.push('Cu:'+a.cobre);
      if(parseFloat(a.plomo)>20)metals.push('Pb:'+a.plomo);
      if(parseFloat(a.silicio)>25)metals.push('Si:'+a.silicio);
      quePasa.push('Aceite ALERTA en '+(a.descriptor||a.componente)+(metals.length?' ('+metals.join(', ')+')':''));
    });
  }

  if(!quePasa.length)quePasa.push('Equipo en condición normal de operación');
  d.secciones.push({titulo:'🔴 ¿Qué está pasando?',items:quePasa,color:quePasa[0].includes('normal')?'var(--ok)':'var(--danger)'});

  // 2. ¿POR QUÉ?
  var porQue=[];
  if(aceAlertas.length)porQue.push('Desgaste interno detectado por análisis de aceite');
  if(noks.length)porQue.push('Anomalías detectadas en inspección visual');
  var compFallas={};
  ot.filter(function(o){return o.sigla===sigla;}).forEach(function(o){
    var comp=(o.componente||'').trim()||_componenteDeSintoma(o.sintoma);
    if(comp)compFallas[comp]=(compFallas[comp]||0)+1;
  });
  Object.entries(compFallas).forEach(function(cf){if(cf[1]>=2)porQue.push('Falla recurrente en '+cf[0]+' ('+cf[1]+' veces)');});
  if(estadoPM.includes('URGENTE'))porQue.push('Horas de operación superan intervalo de mantención');
  if(eqData&&eqData.promCostoMes>5e6)porQue.push('Costo mensual alto: $'+eqData.promCostoMes.toLocaleString()+'/mes');
  if(!porQue.length)porQue.push('Sin causas identificadas — operación dentro de parámetros');
  d.secciones.push({titulo:'⚠️ ¿Por qué está pasando?',items:porQue,color:'var(--w)'});

  // 3. ¿QUÉ VA A PASAR?
  var queViene=[];
  if(estadoPM.includes('URGENTE'))queViene.push('Riesgo de falla por PM vencida — intervenir antes de '+Math.max(Math.abs(e.diasParaPM)*2,7)+' días');
  else if(e.diasParaPM<=14)queViene.push('PM '+e.tipoPM+' estimada en '+e.diasParaPM+' días');
  if(aceAlertas.length)queViene.push('Tendencia de desgaste en '+(aceAlertas[0].descriptor||'componente')+' — riesgo de falla progresiva');
  if(eqData){
    queViene.push('Proyección: ~'+Math.round(eqData.promPedMes)+' pedidos y $'+eqData.promCostoMes.toLocaleString()+' próximo mes');
  }
  if(otPend.length)queViene.push(otPend.length+' trabajo(s) pendiente(s) pueden escalar');
  if(!queViene.length)queViene.push('Sin riesgos proyectados a corto plazo');
  // Mejora 2: predicción de causa raíz basada en histórico
  var predCausa=predecirCausa(sigla,null);
  if(predCausa)queViene.push('🔍 '+predCausa.texto);
  d.secciones.push({titulo:'🔮 ¿Qué va a pasar?',items:queViene,color:'var(--info)'});

  // 4. ¿QUÉ DEBO HACER?
  var hacer=[];
  if(estadoPM.includes('URGENTE'))hacer.push('🔧 Programar '+e.tipoPM+' INMEDIATO');
  else if(e.diasParaPM<=7)hacer.push('🔧 Programar '+e.tipoPM+' esta semana');
  if(aceAlertas.length)hacer.push('🔧 Intervenir '+aceAlertas[0].descriptor+' — cambio de aceite/inspección interna');
  if(otPend.length)hacer.push('📋 Resolver '+otPend.length+' OT pendiente(s)');
  if(noks.length)hacer.push('👁️ Re-inspeccionar: '+[...new Set(noks)].join(', '));
  Object.entries(compFallas).forEach(function(cf){if(cf[1]>=3)hacer.push('🔄 Evaluar reemplazo de '+cf[0]+' ('+cf[1]+' fallas)');});
  if(!hacer.length)hacer.push('✅ Mantener plan de mantención vigente');
  d.secciones.push({titulo:'🔧 ¿Qué debo hacer?',items:hacer,color:'var(--ac)'});

  // 5. ¿QUÉ PASA SI NO LO HAGO?
  var impacto=[];
  if(estadoPM.includes('URGENTE'))impacto.push('Detención no programada — costo estimado $'+(eqData?Math.round(eqData.promCostoMes*0.5).toLocaleString():'N/D'));
  if(aceAlertas.length)impacto.push('Falla catastrófica en '+(aceAlertas[0].descriptor||'componente')+' — daño mayor');
  if(otPend.length>2)impacto.push('Acumulación de backlog — riesgo operacional');
  Object.entries(compFallas).forEach(function(cf){if(cf[1]>=3)impacto.push('Falla repetitiva en '+cf[0]+' puede escalar a daño mayor');});
  if(!impacto.length)impacto.push('Riesgo bajo si se mantiene plan actual');
  d.secciones.push({titulo:'💰 ¿Qué pasa si no lo hago?',items:impacto,color:'var(--danger)'});

  // 6. ¿TENGO CÓMO HACERLO?
  var recursos=[];
  // Check if repuestos for this equipment exist and have stock
  var repEq=rep.filter(function(r){return (r.equipo||'').includes(sigla)||r.equipo==='Varios';});
  var sinStock=repEq.filter(function(r){return (r.stockActual||0)<=0&&r.estado&&r.estado.includes('🔴');});
  if(sinStock.length)recursos.push('🔴 '+sinStock.length+' repuesto(s) sin stock — requiere compra (lead time ~34 días)');
  var stockBajo=repEq.filter(function(r){return r.estado&&r.estado.includes('🟡');});
  if(stockBajo.length)recursos.push('🟡 '+stockBajo.length+' repuesto(s) con stock bajo — planificar reposición');
  if(!sinStock.length&&!stockBajo.length)recursos.push('✅ Stock disponible para intervención');
  recursos.push('👷 Verificar disponibilidad de técnicos para intervención');
  d.secciones.push({titulo:'📦 ¿Tengo cómo hacerlo?',items:recursos,color:'var(--info)'});

  // 7. ¿A DÓNDE VAMOS?
  var vision=[];
  if(eqData){
    var trend=eqData.trend||[];
    if(trend.length>=3){
      var last3=trend.slice(-3).reduce(function(s,t){return s+t.c;},0);
      var prev3=trend.slice(-6,-3).reduce(function(s,t){return s+t.c;},0);
      if(prev3>0){
        var cambio=Math.round((last3/prev3-1)*100);
        vision.push('Tendencia de costos: '+(cambio>0?'📈 +':'📉 ')+cambio+'% vs trimestre anterior');
      }
    }
  }
  var eqUrgentes=eq.filter(function(x){return (x.estado||'').includes('URGENTE');}).length;
  if(eqUrgentes>3)vision.push('⚠️ '+eqUrgentes+' equipos urgentes en la flota — carga alta');
  var pm2sem=eq.filter(function(x){return x.diasParaPM<=14;}).length;
  vision.push('📅 '+pm2sem+' intervenciones proyectadas próximas 2 semanas');
  d.secciones.push({titulo:'🚀 ¿A dónde vamos?',items:vision,color:'var(--ok)'});

  // Build interpretation text
  var interp=quePasa.filter(function(q){return !q.includes('normal');}).join('. ');
  if(porQue.length&&!porQue[0].includes('Sin causas'))interp+=' Causa: '+porQue[0]+'.';
  if(queViene.length&&!queViene[0].includes('Sin riesgos'))interp+=' '+queViene[0]+'.';
  if(hacer.length)interp+=' Acción: '+hacer[0]+'.';
  if(recursos[0].includes('sin stock'))interp+=' '+recursos[0]+'.';
  d.interpretacion=interp||'Equipo en condición normal de operación.';

  return d;
}

// Cruza un patrón de falla (componente + equipo donde más se repite) con otras
// señales del MISMO equipo — aceite, neumáticos, cumplimiento de PM — como haría
// un mecánico que revisa varias pestañas antes de concluir: una fuga repetida en
// el cilindro de dirección junto con neumáticos desgastados de forma dispareja
// apunta a geometría de dirección, no a "cambiar la manguera de nuevo". Son reglas
// de conocimiento mecánico general, no específicas de un fabricante.
function _cruceSistemas(sigla,categoria){
  if(!sigla)return[];
  var obs=[];
  var eq=S.g('eq')||[];
  var e=eq.find(function(x){return x.sigla===sigla;});

  // Aceite: alerta de metales/desgaste en sistemas lubricados coincidiendo con la falla
  var SISTEMAS_LUBRICADOS=['Motor','Transmisión','Diferencial','Mandos Finales','Sistema Hidráulico','Turbo','Bomba de Agua'];
  if(SISTEMAS_LUBRICADOS.indexOf(categoria)>=0){
    var aceite=S.g('aceite')||[];
    var aceEq=aceite.filter(function(m){return m.equipo===sigla||(m._sigla||'').indexOf(sigla)>=0;});
    var aceAlerta=aceEq.filter(function(m){return m.estado==='ALERTA';});
    if(aceAlerta.length)obs.push('🛢️ Hay muestra(s) de aceite en ALERTA en este equipo — la falla repetida en '+categoria+' puede ser desgaste interno progresivo (ej. metales en suspensión), no solo la reparación puntual que se hace cada vez.');
  }

  // Neumáticos/dirección/suspensión: desgaste disparejo sugiere geometría, no solo la pieza
  if(categoria==='Cilindro de Dirección'||categoria==='Neumáticos'||categoria==='Suspensión'){
    var neu=(S.g('neu')||[]).filter(function(n){return n.sigla===sigla||n.equipo===sigla;});
    var conDesgaste=neu.filter(function(n){var p=neuPct(n);return p!=null&&p<30;});
    if(neu.length>=2&&conDesgaste.length>=2)obs.push('🛞 Varios neumáticos con desgaste avanzado en este mismo equipo — revisar geometría/alineación de dirección además de la pieza puntual.');
  }

  // Batería + Motor de Partida + Alternador repitiéndose juntos = sistema de carga, no la batería sola
  if(categoria==='Batería'||categoria==='Motor de Partida'||categoria==='Alternador'){
    var ot=S.g('ot')||[];
    var otEq=ot.filter(function(o){return o.sigla===sigla;});
    var cats={};
    otEq.forEach(function(o){var c=(o.componente||'').trim()||_componenteDeSintoma(o.sintoma);if(c)cats[c]=(cats[c]||0)+1;});
    var relacionados=['Batería','Motor de Partida','Alternador'].filter(function(c){return c!==categoria&&cats[c]>0;});
    if(relacionados.length)obs.push('⚡ Este equipo también tuvo fallas en '+relacionados.join(' y ')+' — junto con '+categoria+', apunta al sistema de carga completo (alternador/correa/regulador), no solo a cambiar la pieza aislada cada vez.');
  }

  // PM vencida en el mismo equipo donde se repite la falla
  if(e&&(e.estado||'').includes('URGENTE'))obs.push('📅 Este equipo además tiene PM vencida — operar fuera de la mantención programada puede estar acelerando el desgaste que origina la falla.');

  return obs;
}

// Causas típicas documentadas en la industria (metodología FMEA — Failure Mode
// and Effects Analysis) para cada tipo de componente. IMPORTANTE: esto NO es un
// diagnóstico de lo que le pasa a ESTE equipo — es la lista de sospechosos
// habituales que la ingeniería de confiabilidad documenta para ese tipo de
// componente en general. Un CMMS real (ClickMaint, Tractian, etc.) hace lo mismo:
// detecta el patrón y dispara una tarea de Análisis de Causa Raíz para que un
// mecánico la confirme en terreno — no inventa la conclusión por sí solo. Por
// eso esto se muestra como checklist a descartar, nunca como afirmación.
var _CAUSAS_TIPICAS_FMEA={
  'Batería':['Consumo parásito (fuga de corriente) con el equipo apagado','Corrosión en terminales / mala conexión a tierra','Alta resistencia interna (batería al final de su vida)','Alternador no cargando lo suficiente'],
  'Alternador':['Correa floja, desgastada o mal tensada','Regulador de voltaje defectuoso','Sobrecarga eléctrica por consumo adicional no contemplado','Rodamientos desgastados por vibración'],
  'Motor de Partida':['Arranques repetidos en frío','Piñón o corona de arranque desgastados','Batería con carga insuficiente forzando el motor','Conexiones eléctricas sueltas u oxidadas'],
  'Cilindro de Dirección':['Desgaste o fuga de sellos internos por contaminación del aceite hidráulico','Presión de sistema fuera de rango','Desalineación de la geometría de dirección'],
  'Neumáticos':['Desalineación / geometría de dirección','Presión de inflado incorrecta','Sobrecarga del equipo'],
  'Frenos':['Uso excesivo del freno de servicio (poco uso de freno motor/retardador en pendientes)','Contaminación o desgaste desparejo','Desalineación'],
  'Motor':['Sobrecalentamiento recurrente','Filtro de aire obstruido','Calidad de combustible','Lubricación insuficiente'],
  'Transmisión':['Contaminación del aceite','Cambio de aceite atrasado respecto al plan','Sobrecarga u operación fuera de especificación'],
  'Diferencial':['Contaminación del aceite','Cambio de aceite atrasado respecto al plan'],
  'Mandos Finales':['Contaminación del aceite','Cambio de aceite atrasado respecto al plan'],
  'Turbo':['Apagar el equipo caliente sin dejarlo enfriar (falta de lubricación al detener)','Filtro de aire en mal estado','Fuga de aceite en sellos']
};

// ═══ STOCK vs. PRÓXIMOS PM (demanda proyectada real) ═══
// "Stock & Insumos" ya muestra cuántos meses cubre el CONSUMO PROMEDIO histórico,
// pero eso no responde "¿me va a faltar este filtro específico antes del PM que
// lo necesita?" — para eso hay que cruzar Pautas (qué repuesto/cantidad usa cada
// tipo de PM) con el calendario real de próximos PM por equipo (diasParaPM/tipoPM,
// ya calculados en 'eq') y el stock actual. Reutiliza la MISMA heurística de match
// texto-repuesto→item-de-stock que ya usa descontarStock() al registrar un PM real
// (cache en 'mapaRep' primero, luego N° de parte, luego palabras de la
// descripción) — sin ella, dos lugares del sistema podrían decidir de forma
// distinta a qué item de stock se refiere la misma línea de pauta.
function _matchStockDePauta(c,stk,mapaRep){
  var rep=(c.rep||'').trim();
  if(!rep)return null;
  var repLow=rep.toLowerCase();
  var cache=c._id?mapaRep.find(function(m){return m.pautaId===c._id;}):null;
  if(cache&&cache.tipo==='filtro'){
    var si=stk.findIndex(function(s){return s._id===cache.refId;});
    if(si>=0)return stk[si];
  }
  var partNums=repLow.match(/[a-z]?\d{2,}[-\d]+[a-z]*/gi)||[];
  var fi=-1;
  if(partNums.length>0){
    fi=stk.findIndex(function(s){
      var np=(s.nParte||'').toLowerCase();
      return partNums.some(function(pn){return np.includes(pn.toLowerCase())||pn.toLowerCase().includes(np);});
    });
  }
  if(fi<0){
    fi=stk.findIndex(function(s){
      var desc=(s.descripcion||'').toLowerCase();
      var words=repLow.split(/\s+/).filter(function(w){return w.length>4;});
      return words.length>0&&words.filter(function(w){return desc.includes(w);}).length>=Math.min(2,words.length);
    });
  }
  return fi>=0?stk[fi]:null;
}

// Líneas de pauta con repuesto para un equipo y tipo de PM. Resuelve la sigla
// de referencia del grupo (GRUPO_PAUTAS) — antes un equipo cuyas pautas viven
// bajo la sigla del grupo aportaba demanda CERO — y aplica la jerarquía real:
// un PM4 ejecuta también las tareas de PM1/PM2/PM3, no solo las propias.
function _lineasPautaRep(sigla,tipoPM,pau){
  var ref=GRUPO_PAUTAS[sigla]||sigla;
  var pmH={'PM1':['PM1'],'PM2':['PM1','PM2'],'PM3':['PM1','PM2','PM3'],'PM4':['PM1','PM2','PM3','PM4'],'PM5':['PM1','PM2','PM3','PM4'],'PM6':['PM1','PM2','PM3','PM4'],'PM7':['PM1','PM2','PM3','PM4'],'PM8':['PM1','PM2','PM3','PM4'],'PM9':['PM1','PM2','PM3','PM4']};
  var lista=pmH[tipoPM]||[tipoPM];
  return (pau||[]).filter(function(p){
    if(!p.rep)return false;
    var pRef=GRUPO_PAUTAS[p.sigla]||p.sigla;
    return (p.sigla===ref||pRef===ref)&&lista.includes(p.pm);
  });
}
// Selector de horizonte para las vistas de demanda de materiales: el pedido
// mensual y el semestral se arman con la misma proyección, solo cambia hasta
// dónde se mira. Compartido entre Stock vs PM y Lubricantes vs PM.
function _selHorizontePred(hz){
  return '<div style="margin-bottom:10px"><select onchange="window._predHorizonte=this.value;renders.pred()" style="background:var(--bg3);border:1px solid var(--border);color:var(--tx);padding:5px 8px;border-radius:4px;font-size:12px">'+
    [[30,'<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Mensual — 30 días'],[90,'<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Trimestral — 90 días'],[180,'<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Semestral — 180 días']].map(function(o){
      return '<option value="'+o[0]+'"'+(hz===o[0]?' selected':'')+'>'+o[1]+'</option>';
    }).join('')+'</select></div>';
}
function stockVsProximosPM(horizonteDias){
  horizonteDias=horizonteDias||90;
  var eq=S.g('eq')||[];
  var pau=S.g('pau')||[];
  var stk=S.g('stk')||[];
  var mapaRep=S.g('mapaRep')||[];
  var demandaPorItem={};
  eq.forEach(function(e){
    _cadenaPMEnHorizonte(e,horizonteDias).forEach(function(h){
      _lineasPautaRep(e.sigla,h.tipoPM,pau).forEach(function(p){
        var item=_matchStockDePauta(p,stk,mapaRep);
        if(!item)return;
        var key=item._id||item.nParte;
        if(!demandaPorItem[key])demandaPorItem[key]={item:item,demandaTotal:0,equipos:[]};
        var cant=p.can||1;
        demandaPorItem[key].demandaTotal+=cant;
        demandaPorItem[key].equipos.push({sigla:e.sigla,fecha:h.fecha,dias:h.dias,cant:cant});
      });
    });
  });
  return Object.keys(demandaPorItem).map(function(k){
    var d=demandaPorItem[k];
    d.equipos.sort(function(a,b){return a.dias-b.dias;});
    var stockActual=d.item.stockBodega||0;
    var deficit=d.demandaTotal-stockActual;
    return{
      nParte:d.item.nParte,descripcion:d.item.descripcion,
      stockActual:stockActual,demandaTotal:d.demandaTotal,deficit:deficit,
      equipos:d.equipos,
      severidad:deficit<=0?0:(d.equipos[0].dias<=14?3:2)
    };
  }).filter(function(a){return a.deficit>0;})
    .sort(function(a,b){return b.severidad-a.severidad||a.equipos[0].dias-b.equipos[0].dias;});
}

// Mismo cruce que stockVsProximosPM pero para Lubricantes — separado porque el
// match es distinto (por nombre de producto, no N° de parte) y usa esLubricante()
// (logic.js) para no confundir una línea de pauta de lubricante con un filtro.
function _matchLubDePauta(p,lub){
  var rep=(p.rep||'').trim();
  if(!rep||!esLubricante(rep))return null;
  var repLow=rep.toLowerCase();
  var li=lub.findIndex(function(l){
    var nom=(l.nombre||'').toLowerCase();
    return nom&&(repLow.indexOf(nom)>=0||nom.indexOf(repLow)>=0);
  });
  if(li<0){
    var words=repLow.split(/\s+/).filter(function(w){return w.length>3;});
    li=lub.findIndex(function(l){
      var nom=(l.nombre||'').toLowerCase();
      return words.some(function(w){return nom.indexOf(w)>=0;});
    });
  }
  if(li<0)return null;
  // Si la pauta nombra un producto descontinuado, la demanda se consolida en el
  // vigente que lo reemplaza: comprar el viejo no es opción, y repartir entre
  // ambos escondería cuánto hay que pedir en total del que sí se consigue.
  var item=lub[li];
  var vig=lubVigente(item.nombre);
  if(vig!==String(item.nombre||'').toUpperCase().replace(/\s+/g,' ').trim()){
    var reemp=lub.find(function(l){return String(l.nombre||'').toUpperCase().replace(/\s+/g,' ').trim()===vig;});
    if(reemp)return reemp;
  }
  return item;
}
function lubVsProximosPM(horizonteDias){
  horizonteDias=horizonteDias||90;
  var eq=S.g('eq')||[];
  var pau=S.g('pau')||[];
  var lub=S.g('lub')||[];
  var demandaPorItem={};
  eq.forEach(function(e){
    _cadenaPMEnHorizonte(e,horizonteDias).forEach(function(h){
      _lineasPautaRep(e.sigla,h.tipoPM,pau).forEach(function(p){
        var item=_matchLubDePauta(p,lub);
        if(!item)return;
        var key=item._id||item.nombre;
        if(!demandaPorItem[key])demandaPorItem[key]={item:item,demandaTotal:0,equipos:[]};
        var cant=p.can||0;
        demandaPorItem[key].demandaTotal+=cant;
        demandaPorItem[key].equipos.push({sigla:e.sigla,fecha:h.fecha,dias:h.dias,cant:cant});
      });
    });
  });
  return Object.keys(demandaPorItem).map(function(k){
    var d=demandaPorItem[k];
    d.equipos.sort(function(a,b){return a.dias-b.dias;});
    var stockActual=d.item.stock||0;
    var deficit=d.demandaTotal-stockActual;
    return{
      nombre:d.item.nombre,unidad:d.item.unidad||'L',
      stockActual:stockActual,demandaTotal:d.demandaTotal,deficit:deficit,
      equipos:d.equipos,
      severidad:deficit<=0?0:(d.equipos[0].dias<=14?3:2)
    };
  }).filter(function(a){return a.deficit>0;})
    .sort(function(a,b){return b.severidad-a.severidad||a.equipos[0].dias-b.equipos[0].dias;});
}

// ═══ DIAGNÓSTICO A NIVEL DE FLOTA ═══
// generarDiagnostico() responde "qué pasa" para UN equipo ya elegido. Esto responde
// la pregunta anterior: de los 35 equipos, ¿qué componente falla más seguido y en
// cuántos de ellos? — para saber DÓNDE mirar antes de entrar al detalle por equipo.
function diagnosticoFlota(){
  var ot=S.g('ot')||[];
  var porComp={};
  ot.forEach(function(o){
    var k=(o.componente||'').trim()||_componenteDeSintoma(o.sintoma);
    if(!k)return;
    if(!porComp[k])porComp[k]={componente:k,total:0,equipos:{},equipoFechas:{},sinCausa:0,sinSolucion:0,pendientes:0,costoTotal:0,fechas:[],causasTexto:[]};
    var c=porComp[k];
    c.total++;
    c.equipos[o.sigla]=(c.equipos[o.sigla]||0)+1;
    if(!o.causaRaiz||!o.causaRaiz.trim())c.sinCausa++;
    else c.causasTexto.push(o.causaRaiz);
    if(!o.solucion||!o.solucion.trim())c.sinSolucion++;
    if(o.estadoOT&&o.estadoOT!=='Cerrada'&&o.estadoOT!=='Cerrado')c.pendientes++;
    c.costoTotal+=Number(o.costo)||0;
    if(o.fecha){
      c.fechas.push(o.fecha);
      if(!c.equipoFechas[o.sigla])c.equipoFechas[o.sigla]=[];
      c.equipoFechas[o.sigla].push(o.fecha);
    }
  });
  var lista=Object.keys(porComp).map(function(k){
    var c=porComp[k];
    var siglasAfectadas=Object.keys(c.equipos);
    c.fechas.sort();
    c.nEquipos=siglasAfectadas.length;
    c.equipoMasRepetido=siglasAfectadas.reduce(function(a,b){return c.equipos[a]>=c.equipos[b]?a:b;},siglasAfectadas[0]);
    c.vecesEnEsePeor=c.equipos[c.equipoMasRepetido];
    // Días entre una falla y la siguiente del MISMO componente en el equipo donde
    // más se repite — a diferencia de "total de fallas", esto responde directo a
    // "¿la reparación no está durando?": un intervalo corto (semanas) entre una
    // reparación y la siguiente falla del mismo tipo es una fecha contra otra
    // fecha, no una opinión — apunta a repuesto de baja calidad o reparación mal
    // hecha, no a desgaste normal por uso.
    c.reincidenciaDias=null;
    c.tendencia=null;
    // Dedup de fechas iguales consecutivas — varias líneas cargadas el mismo día
    // (una sola visita a terreno con múltiples ítems) generaban un gap de 0 días,
    // arrastrando el promedio hacia abajo sin que sea una reincidencia real.
    var fechasPeorCrudo=(c.equipoFechas[c.equipoMasRepetido]||[]).slice().sort();
    var fechasPeor=fechasPeorCrudo.filter(function(f,fi){return fi===0||f!==fechasPeorCrudo[fi-1];});
    if(fechasPeor.length>=2){
      var gaps=[];
      for(var gi=1;gi<fechasPeor.length;gi++)gaps.push(Math.round((new Date(fechasPeor[gi])-new Date(fechasPeor[gi-1]))/864e5));
      c.reincidenciaDias=Math.round(gaps.reduce(function(a,b){return a+b;},0)/gaps.length);
      // Tendencia: no solo el promedio — ¿el intervalo entre fallas se está
      // ACORTANDO (empeora, cada vez falla más rápido) o es estable? Compara el
      // último intervalo contra el primero, no solo el promedio general, que
      // puede esconder una aceleración reciente.
      if(gaps.length>=2){
        var primerGap=gaps[0],ultimoGap=gaps[gaps.length-1];
        if(ultimoGap<primerGap*0.7)c.tendencia='empeora';
        else if(ultimoGap>primerGap*1.3)c.tendencia='mejora';
        else c.tendencia='estable';
      }
    }
    delete c.equipoFechas;
    c.ultimaFecha=c.fechas[c.fechas.length-1]||'';
    c.diasDesdeUltima=c.ultimaFecha?Math.round((Date.now()-new Date(c.ultimaFecha).getTime())/864e5):null;
    // Heurística de sugerencia: sin esto son solo números, con esto es una lectura accionable
    var atendido=c.total?Math.round((1-c.sinSolucion/c.total)*100):0;
    // Concentración en un GRUPO de equipos (no solo el peor): antes, si el equipo
    // más repetido ya cruzaba el umbral de "se repite" (>=3), el mensaje solo
    // hablaba de ESE equipo — aunque otros 5 tuvieran el mismo problema por su
    // cuenta, quedaban invisibles (caso real encontrado 2026-08: Neumáticos
    // mostraba solo "CN-9501, 11 veces" cuando en realidad eran 6 camiones del
    // mismo modelo, cada uno con reincidencia propia — un patrón de flota, no
    // "un camión con mala suerte"). Se revisa esto ANTES que el caso de un solo
    // equipo, para que el patrón de grupo no quede escondido detrás del peor.
    var equiposConVariasFallas=siglasAfectadas.filter(function(s){return c.equipos[s]>=3;});
    c.equiposConcentrados=equiposConVariasFallas;
    var sugerencia,severidad;
    if(c.total>=3&&equiposConVariasFallas.length>=2){
      sugerencia='Se repite 3+ veces cada uno en '+equiposConVariasFallas.length+' equipos distintos ('+equiposConVariasFallas.slice(0,6).join(', ')+(equiposConVariasFallas.length>6?'...':'')+') — no es un equipo con mala suerte, es un patrón de flota: revisar especificación del repuesto/proveedor, o si aplica solo a un modelo en particular.';
      severidad=3;
    }else if(c.total>=3&&c.vecesEnEsePeor>=3){
      sugerencia='Se repite '+c.vecesEnEsePeor+' veces en el MISMO equipo ('+c.equipoMasRepetido+') — evaluar reemplazo del componente o del equipo, no solo repararlo de nuevo.';
      severidad=3;
    }else if(c.total>=3&&c.nEquipos>=3){
      sugerencia='Se repite en '+c.nEquipos+' equipos distintos — probable problema de especificación del repuesto/proveedor, no de un equipo en particular.';
      severidad=2;
    }else if(c.total>=3){
      sugerencia='Fallas repetidas concentradas en pocos equipos — revisar si la PM está cubriendo este componente.';
      severidad=2;
    }else{
      sugerencia='Aún sin patrón claro (pocas fallas registradas).';
      severidad=0;
    }
    if(c.sinCausa/c.total>0.5)sugerencia+=' ⚠️ Más de la mitad sin causa raíz registrada en terreno — mejorar el registro antes de confiar en el diagnóstico.';
    c.sugerencia=sugerencia;
    c.severidad=severidad;
    // Igual que dispara un CMMS real (ej. "≥3 correctivos en 60 días" activa una
    // tarea de Análisis de Causa Raíz): esto NO concluye la causa, solo marca que
    // el patrón amerita que un mecánico la investigue, y le entrega el checklist
    // FMEA estándar de ese tipo de componente como punto de partida.
    c.requiereRCA=c.total>=3;
    c.causasFMEA=_CAUSAS_TIPICAS_FMEA[c.componente]||null;
    // ¿Este componente aparece en ALGUNA línea de pauta preventiva de los equipos
    // donde falla? No es una opinión — se busca de verdad en las pautas reales de
    // esos equipos. Si nunca aparece, nadie lo está revisando antes de que se
    // rompa (falla siempre vía correctivo, nunca detectado en un PM programado).
    c.cubiertoPorPM=null;
    var catKeywords=null;
    for(var ci=0;ci<_CATEGORIAS_COMPONENTE.length;ci++){if(_CATEGORIAS_COMPONENTE[ci][0]===c.componente){catKeywords=_CATEGORIAS_COMPONENTE[ci][1];break;}}
    if(catKeywords){
      var pauEq=(S.g('pau')||[]).filter(function(p){return siglasAfectadas.indexOf(p.sigla)>=0;});
      c.cubiertoPorPM=pauEq.some(function(p){
        var txt=((p.act||'')+' '+(p.cat||'')).toLowerCase();
        return catKeywords.some(function(kw){return txt.indexOf(kw)>=0;});
      });
    }
    c.pctAtendido=atendido;
    var topCausa=_frecuenciaCausas(c.causasTexto);
    c.causaTop=topCausa?topCausa.causa:null;
    c.causaTopN=topCausa?topCausa.n:0;
    delete c.causasTexto;
    c.cruce=_cruceSistemas(c.equipoMasRepetido,c.componente);
    return c;
  }).filter(function(c){return c.total>=2;})
    .sort(function(a,b){return b.severidad-a.severidad||b.total-a.total;});
  return lista;
}

window.renderPred=function(){
  var P=computePred();
  var R=P.resumen;
  var stk=S.g('stk')||[];
  var lub=S.g('lub')||[];
  var eq=S.g('eq')||[];
  var ot=S.g('ot')||[];
  var reg=S.g('reg')||[];
  var insp=S.g('insp')||[];
  var mov=S.g('mov')||[];
  var fVista=$('fPredVista')?.value||'general';
  var fEq=$('fPredEq')?.value||'';

  // Índices por sigla, construidos UNA vez — alertaCruzada() se llama por cada
  // equipo (dos veces: para el resumen y para la tabla completa) y filtraba insp/ot/
  // eq COMPLETOS cada vez; con cientos de equipos y miles de inspecciones/correctivos
  // eso era O(equipos × filas) en la vista "general", la que se ve primero al abrir
  // esta pestaña. 'aceite' queda sin indexar a propósito: su match es por substring
  // (m._sigla||m.componente).includes(sigla), no una clave exacta agrupable.
  var inspPorSiglaPred={},otPorSiglaPred={},eqPorSiglaPred={};
  insp.forEach(function(r){if(r&&r.sigla)(inspPorSiglaPred[r.sigla]=inspPorSiglaPred[r.sigla]||[]).push(r);});
  ot.forEach(function(o){if(o&&o.sigla)(otPorSiglaPred[o.sigla]=otPorSiglaPred[o.sigla]||[]).push(o);});
  eq.forEach(function(e){if(e&&e.sigla)eqPorSiglaPred[e.sigla]=e;});

  // ═══ INTELLIGENCE ENGINE ═══
  // 1. Confidence level per equipment
  function calcConfianza(sigla){
    var eqData=P.equipos[sigla];
    if(!eqData)return{nivel:'Baja',score:1,motivo:'Sin historial'};
    var score=0;var motivos=[];
    if(eqData.meses>=24){score+=3;motivos.push('24+ meses datos');}
    else if(eqData.meses>=12){score+=2;motivos.push('12+ meses datos');}
    else{score+=1;motivos.push('< 12 meses datos');}
    if(eqData.totalPedidos>=100){score+=2;motivos.push('100+ pedidos');}
    else if(eqData.totalPedidos>=30){score+=1;motivos.push('30+ pedidos');}
    // Check if trend is stable
    var trend=eqData.trend||[];
    if(trend.length>=6){
      var vals=trend.map(function(t){return t.n;});
      var avg=vals.reduce(function(a,b){return a+b;},0)/vals.length;
      var variance=vals.reduce(function(a,b){return a+Math.pow(b-avg,2);},0)/vals.length;
      if(variance<avg*2){score+=2;motivos.push('Tendencia estable');}
      else{score+=1;motivos.push('Tendencia variable');}
    }
    var nivel=score>=6?'Alta':score>=4?'Media':'Baja';
    return{nivel:nivel,score:score,motivo:motivos.join(' · ')};
  }

  // 2. Cross-alert: combine inspection + consumption + failures
  function alertaCruzada(sigla){
    var alertas=[];var severity=0;
    // Check inspections NOK
    var inspRecent=(inspPorSiglaPred[sigla]||[]).slice(-5);
    var noks=0;
    inspRecent.forEach(function(r){
      ['visual','niveles','fugas','luces','frenos','neumaticos'].forEach(function(c){
        if(r[c]==='NOK')noks++;
      });
    });
    if(noks>=2){alertas.push('Inspección: '+noks+' NOK recientes');severity+=2;}
    // Check repeated failures (same component)
    var compFallas={};
    (otPorSiglaPred[sigla]||[]).forEach(function(o){
      var comp=(o.componente||'').trim()||_componenteDeSintoma(o.sintoma);
      if(comp)compFallas[comp]=(compFallas[comp]||0)+1;
    });
    // Antes esta lista casi nunca tenía contenido (componente venía vacío en el
    // 100% de los correctivos reales); ahora que _componenteDeSintoma() encuentra
    // patrones de verdad, un equipo puede tener 6-8 componentes con >=2 fallas —
    // mostrarlos todos desborda la celda de la tabla. Se limita a los 3 más
    // repetidos y se resume el resto en "+N más".
    var compOrdenados=Object.entries(compFallas).sort(function(a,b){return b[1]-a[1];});
    compOrdenados.forEach(function(cf){if(cf[1]>=3)severity+=3;else if(cf[1]>=2)severity+=1;});
    compOrdenados.slice(0,3).forEach(function(cf){if(cf[1]>=2)alertas.push(cf[0]+': '+cf[1]+' fallas');});
    var restantes=compOrdenados.slice(3).filter(function(cf){return cf[1]>=2;});
    if(restantes.length)alertas.push('+'+restantes.length+' componente(s) más con fallas repetidas');
    // Check consumption trend (increasing)
    var eqData=P.equipos[sigla];
    if(eqData&&eqData.trend.length>=4){
      var recent=eqData.trend.slice(-3).reduce(function(s,t){return s+t.c;},0)/3;
      var older=eqData.trend.slice(-6,-3).reduce(function(s,t){return s+t.c;},0)/3;
      if(recent>older*1.3&&older>0){alertas.push('Costos +'+Math.round((recent/older-1)*100)+'% tendencia');severity+=2;}
    }
    // Equipment status
    var eqInfo=eqPorSiglaPred[sigla];
    if(eqInfo&&(eqInfo.estado||'').includes('URGENTE')){alertas.push('PM vencida/urgente');severity+=2;}
    var total=severity;
    var estado=total>=5?'🔴':total>=2?'🟡':'🟢';
    // Check oil samples
    var aceite=S.g('aceite')||[];
    var aceMuestras=aceite.filter(function(m){return (m._sigla||m.componente||'').includes(sigla);});
    var aceAlertas=aceMuestras.filter(function(m){return m.estado==='ALERTA';}).length;
    var acePrec=aceMuestras.filter(function(m){return m.estado==='PRECAUCION';}).length;
    if(aceAlertas>=1){alertas.push('Aceite: '+aceAlertas+' ALERTA');severity+=3;}
    else if(acePrec>=2){alertas.push('Aceite: '+acePrec+' precaución');severity+=1;}
    return{estado:estado,severity:total,alertas:alertas};
  }

  // 3. Stock break risk
  // Riesgo de quiebre unificado con stockEstado (misma fuente que Stock y Dashboard) —
  // antes esta función tenía su propia copia de la fórmula (34/30, <2…) que podía
  // desincronizarse del resto del sistema.
  function riesgoQuiebre(){
    var risks=[];
    stk.forEach(function(s){
      var cm=s.consumoMes||s.proyMes||0;if(cm<=0)return;
      var se=stockEstado((s.stockBodega||0)+(s.pendiente||0),cm,s.leadTime);
      if(se.nivel==='OK')return;
      var riesgo=se.nivel==='COMPRAR'?((s.stockBodega||0)<=0?'🔴 SIN STOCK':'🔴 QUIEBRE'):'🟡 BAJO';
      risks.push({item:s.descripcion,nParte:s.nParte,stock:s.stockBodega||0,consMes:cm,lead:s.leadTime||34,riesgo:riesgo,accion:se.motivo});
    });
    lub.forEach(function(l){
      var cm=l.consumoMes||l.proyMes||0;if(cm<=0)return;
      var se=stockEstado(l.stock||0,cm,15);
      if(se.nivel==='OK')return;
      var riesgo=se.nivel==='COMPRAR'?((l.stock||0)<=0?'🔴 SIN STOCK':'🔴 QUIEBRE'):'🟡 BAJO';
      risks.push({item:l.nombre,nParte:'',stock:l.stock||0,consMes:cm,lead:15,riesgo:riesgo,accion:se.motivo});
    });
    return risks.sort(function(a,b){return a.riesgo>b.riesgo?1:-1;});
  }

  // 4. Workload projection
  function proyeccionCarga(){
    var prox2sem=[];
    eq.forEach(function(e){
      if(e.diasParaPM<=14){prox2sem.push({sigla:e.sigla,tipo:e.tipoPM,dias:e.diasParaPM,modelo:e.modelo});}
    });
    var otPend=ot.filter(function(o){return o.estadoOT==='Pendiente';}).length;
    var otEjec=ot.filter(function(o){return o.estadoOT==='En Ejecución';}).length;
    var comprasCrit=riesgoQuiebre().filter(function(r){return r.riesgo.includes('🔴');}).length;
    return{pm:prox2sem,otPend:otPend,otEjec:otEjec,compras:comprasCrit};
  }

  // 5. Avoided failures (predictive hits)
  var predAciertos=ot.filter(function(o){return o.predCumplida==='Sí';}).length;
  var predTotal=ot.filter(function(o){return o.predCumplida;}).length;

  // ═══ BUILD VIEWS ═══
  var content='';
  var pc=['#3b82f6','#ef4444','#22c55e','#f59e0b','#06b6d4','#8b5cf6','#ec4899','#f97316','#84cc16','#14b8a6'];

  if(fVista==='general'){
    var carga=proyeccionCarga();
    var quiebres=riesgoQuiebre();
    var maxC=Math.max.apply(null,P.costoMes.map(function(m){return m.c;}))||1;
    // Datos accionables para la Zona 1
    var reinc=(typeof diagnosticoFlota==='function')?diagnosticoFlota():[];
    var reincEmpeora=reinc.filter(function(c){return c.tendencia==='empeora';}).length;
    var alertEq=eq.map(function(e){return alertaCruzada(e.sigla);});
    var eqCrit=alertEq.filter(function(a){return a.severity>=5;}).length;
    var eqVigilar=alertEq.filter(function(a){return a.severity>=2&&a.severity<5;}).length;
    var quiebresCrit=quiebres.filter(function(r){return r.riesgo.includes('🔴');}).length;

    content=
      // ── ZONA 1: NECESITA ATENCIÓN (accionable) ──
      '<div style="display:flex;align-items:baseline;gap:12px;border-bottom:1px solid var(--bd);padding-bottom:8px;margin-bottom:14px"><div style="font-size:15px;font-weight:700;position:relative;padding-left:16px"><span style="position:absolute;left:0;top:5px;width:8px;height:8px;border-radius:50%;background:var(--ac);box-shadow:0 0 0 4px color-mix(in srgb,var(--ac) 22%,transparent)"></span>Necesita atención</div><div style="font-size:11px;color:var(--tx3)">sale de datos reales — fallas, inspecciones, aceite y stock</div></div>'+
      '<div class="cards">'+
      '<div class="card" style="border-left:3px solid var(--danger)"><div class="card-t">🔁 Componentes reincidentes</div><div class="card-v" style="color:var(--danger)">'+reinc.length+'</div><div class="card-s">'+(reincEmpeora?reincEmpeora+' empeorando':'fallan repetido')+'</div></div>'+
      '<div class="card" style="border-left:3px solid var(--danger)"><div class="card-t">🚦 Equipos en alerta cruzada</div><div class="card-v" style="color:var(--danger)">'+eqCrit+'</div><div class="card-s">'+eqVigilar+' a vigilar</div></div>'+
      '<div class="card" style="border-left:3px solid var(--w)"><div class="card-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="10,2 17,6 10,10 3,6"/><line x1="3" y1="6" x2="3" y2="13"/><line x1="17" y1="6" x2="17" y2="13"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="3" y1="13" x2="10" y2="18"/><line x1="17" y1="13" x2="10" y2="18"/></svg> Riesgo de quiebre</div><div class="card-v" style="color:var(--w)">'+quiebresCrit+'</div><div class="card-s">quiebran antes del lead time</div></div>'+
      '<div class="card" style="border-left:3px solid var(--ac)"><div class="card-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="8"/><line x1="10" y1="6" x2="10" y2="11"/><circle cx="10" cy="14" r="0.6" fill="currentColor" stroke="none"/></svg> Carga próximas 2 sem.</div><div class="card-v" style="color:var(--ac)">'+carga.pm.length+'</div><div class="card-s">PM · '+carga.otPend+' OT pendientes</div></div>'+
      '</div>'+
      // Reincidencia de fallas (resumen — detalle completo en la solapa "Flota")
      '<div class="chart-box" style="margin:16px 0;border-left:3px solid var(--danger)"><div class="chart-t">🔁 Reincidencia de fallas <span style="font-size:11px;color:var(--tx3);font-weight:400">— componentes que vuelven al taller</span></div>'+
      (reinc.length?
        '<div class="tbl-wrap"><table><tr><th>Componente</th><th>Dónde se repite</th><th>Veces</th><th>Tendencia</th><th>Lectura accionable</th></tr>'+
        reinc.slice(0,6).map(function(c){
          var tend=c.tendencia==='empeora'?'<span style="color:var(--danger);font-weight:700">▲ empeora</span>':c.tendencia==='mejora'?'<span style="color:var(--ok)">▼ mejora</span>':'<span style="color:var(--tx3)">— estable</span>';
          var donde=(c.vecesEnEsePeor>=3)?'<span class="mono" style="color:var(--ac)">'+escapeHtml(c.equipoMasRepetido||'')+'</span> <span style="color:var(--tx3);font-size:10px">mismo equipo</span>':c.nEquipos+' equipos';
          return'<tr style="'+(c.severidad>=3?'background:rgba(239,68,68,.04)':'')+'">'+
            '<td style="font-weight:600">'+escapeHtml(c.componente)+'</td>'+
            '<td style="font-size:11px">'+donde+'</td>'+
            '<td style="text-align:center;font-weight:600">'+c.total+'</td>'+
            '<td style="font-size:11px">'+tend+'</td>'+
            '<td style="font-size:11px;color:var(--tx2);max-width:340px;white-space:normal;line-height:1.45">'+escapeHtml(c.sugerencia)+(c.cubiertoPorPM===false?' <span class="badge b-y">no está en PM</span>':'')+'</td></tr>';
        }).join('')+'</table></div>'+
        (reinc.length>6?'<div style="text-align:center;padding:7px"><span onclick="$(\'fPredVista\').value=\'flota\';renders.pred()" style="color:var(--ac);cursor:pointer;font-size:11px">Ver los '+reinc.length+' con causa raíz y FMEA →</span></div>':'')
        :'<div style="padding:16px;text-align:center;color:var(--tx3);font-size:12px">Sin reincidencias detectadas todavía (se necesitan ≥2 fallas del mismo componente registradas).</div>')+
      '</div>'+

      // RECOMENDACIONES AUTOMÁTICAS
      '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px"><div class="chart-t">🧠 Recomendaciones del Sistema</div>'+
      '<div style="display:flex;flex-direction:column;gap:6px;padding:8px">'+
      (carga.pm.length?carga.pm.slice(0,5).map(function(p){
        return'<div style="display:flex;align-items:center;gap:8px;padding:4px 8px;background:var(--bg3);border-radius:4px;font-size:12px">'+
          '<span style="color:var(--danger);font-weight:700">➡️</span>'+
          '<span><b>'+escapeHtml(p.sigla)+'</b> — '+escapeHtml(p.tipo)+' en <b>'+p.dias+' días</b></span>'+
          '<span style="margin-left:auto;color:var(--w);font-size:11px">Programar intervención</span></div>';
      }).join(''):'<div style="font-size:12px;color:var(--ok)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> Sin PM urgentes próximas 2 semanas</div>')+
      (quiebres.filter(function(r){return r.riesgo.includes('🔴');}).length?
        quiebres.filter(function(r){return r.riesgo.includes('🔴');}).slice(0,5).map(function(q){
          return'<div style="display:flex;align-items:center;gap:8px;padding:4px 8px;background:rgba(239,68,68,.06);border-radius:4px;font-size:12px">'+
            '<span style="color:var(--danger);font-weight:700"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,3 4,3 6,12 15,12 17,6 5,6"/><circle cx="7" cy="16" r="1.3"/><circle cx="14" cy="16" r="1.3"/></svg></span>'+
            '<span><b>'+escapeHtml(q.item.substring(0,40))+'</b> — Stock: '+q.stock+'</span>'+
            '<span style="margin-left:auto;color:var(--danger);font-size:11px;font-weight:600">'+q.accion+'</span></div>';
        }).join(''):'')+
      '</div></div>'+

      // Cross-alert per equipment
      '<div class="chart-box" style="margin-bottom:16px"><div class="chart-t">🚦 Alerta Cruzada por Equipo (Inspección + Fallas + Consumo + PM)</div>'+
      '<div class="tbl-wrap"><table>'+
      '<tr><th>Equipo</th><th>Modelo</th><th>Estado</th><th>Confianza</th><th>Próx PM</th><th>Alertas Cruzadas</th><th>Recomendación</th></tr>'+
      eq.map(function(e){
        var ac=alertaCruzada(e.sigla);
        var conf=calcConfianza(e.sigla);
        var confCol=conf.nivel==='Alta'?'var(--ok)':conf.nivel==='Media'?'var(--w)':'var(--tx3)';
        var recom=ac.severity>=5?'Intervenir inmediato':ac.severity>=2?'Monitorear/planificar':'Sin acción';
        var recomCol=ac.severity>=5?'var(--danger)':ac.severity>=2?'var(--w)':'var(--ok)';
        return'<tr style="'+(ac.severity>=5?'background:rgba(239,68,68,.04)':'')+'">'+
          '<td class="mono" style="color:var(--ac)">'+escapeHtml(e.sigla)+'</td>'+
          '<td style="font-size:10px">'+escapeHtml(e.modelo)+'</td>'+
          '<td style="font-size:14px;text-align:center">'+ac.estado+'</td>'+
          '<td style="text-align:center"><span style="color:'+confCol+';font-weight:600;font-size:11px">'+conf.nivel+'</span></td>'+
          '<td style="font-size:11px">'+(e.tipoPM||'—')+' en '+(e.diasParaPM||'—')+'d</td>'+
          '<td style="font-size:10px;max-width:200px;white-space:normal;word-break:break-word;line-height:1.5">'+(ac.alertas.length?ac.alertas.map(escapeHtml).join(', '):'<span style="color:var(--ok)">Sin alertas</span>')+'</td>'+
          '<td style="font-size:11px;font-weight:600;color:'+recomCol+'">'+recom+'</td></tr>';
      }).join('')+
      '</table></div></div>'+

      // Riesgo de quiebre (accionable) — mismo criterio unificado que Stock y Dashboard
      '<div class="chart-box" style="margin-bottom:22px;border-left:3px solid var(--w)"><div class="chart-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="10,2 17,6 10,10 3,6"/><line x1="3" y1="6" x2="3" y2="13"/><line x1="17" y1="6" x2="17" y2="13"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="3" y1="13" x2="10" y2="18"/><line x1="17" y1="13" x2="10" y2="18"/></svg> Riesgo de quiebre de stock <span style="font-size:11px;color:var(--tx3);font-weight:400">— mismo criterio que Stock y Dashboard (quiebre antes del lead time)</span></div>'+
      (quiebres.length?
        '<div class="tbl-wrap"><table><tr><th>Ítem</th><th>N° parte</th><th>Stock</th><th>Estado</th><th>Acción</th></tr>'+
        quiebres.slice(0,15).map(function(q){
          return'<tr><td style="font-size:11px">'+escapeHtml(q.item.substring(0,42))+'</td><td class="mono" style="font-size:10px;color:var(--tx3)">'+escapeHtml(q.nParte||'—')+'</td><td style="text-align:center">'+q.stock+'</td><td style="font-size:11px;font-weight:600">'+q.riesgo+'</td><td style="font-size:11px;color:var(--tx2)">'+escapeHtml(q.accion||'')+'</td></tr>';
        }).join('')+'</table></div>'
        :'<div style="color:var(--ok);text-align:center;padding:20px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> Sin riesgo de quiebre</div>')+
      '</div>'+

      // ── ZONA 2: HISTÓRICO DE COMPRAS (reporte, mira para atrás) ──
      '<div style="display:flex;align-items:baseline;gap:12px;border-bottom:1px solid var(--bd);padding-bottom:8px;margin:6px 0 14px"><div style="font-size:15px;font-weight:700;color:var(--tx2);position:relative;padding-left:16px"><span style="position:absolute;left:0;top:6px;width:8px;height:8px;border-radius:2px;background:var(--tx3)"></span>Gasto y compras — histórico</div><div style="font-size:11px;color:var(--tx3)">reporte: mira para atrás, no predice</div></div>'+
      '<div class="cards">'+
      '<div class="card"><div class="card-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Pedidos históricos</div><div class="card-v">'+R.totalPedidos.toLocaleString()+'</div><div class="card-s">'+R.rangoDesde+' a '+R.rangoHasta+'</div></div>'+
      '<div class="card"><div class="card-t"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="8"/><text x="10" y="14" font-size="9" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">$</text></svg> Gasto acumulado</div><div class="card-v" style="font-size:22px">$'+(R.totalCosto/1e6).toFixed(0)+'M</div><div class="card-s">~$'+(R.promedioMensual/1e6).toFixed(1)+'M / mes</div></div>'+
      '<div class="card"><div class="card-t">⏱ Lead time promedio</div><div class="card-v">'+R.leadTimeGlobal+'<span style="font-size:14px;color:var(--tx3)">d</span></div><div class="card-s">supuesto (histórico sin fecha de entrega)</div></div>'+
      '<div class="card"><div class="card-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><polygon points="10,2.5 16,6 16,13 10,16.5 4,13 4,6"/><circle cx="10" cy="9.5" r="2.3"/></svg> Ítem más pedido</div><div class="card-v" style="font-size:14px;font-weight:650;padding:7px 0">'+escapeHtml((P.topItems[0]?P.topItems[0].item:'—').substring(0,22))+'</div><div class="card-s">'+(P.topItems[0]?P.topItems[0].total+' pedidos':'sin datos')+'</div></div>'+
      '</div>'+
      '<div class="chart-box" style="margin-top:14px"><div class="chart-t"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="8"/><text x="10" y="14" font-size="9" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">$</text></svg> Gasto mensual en compras <span style="font-size:11px;color:var(--tx3);font-weight:400">— últimos meses</span></div>'+
      '<div class="bars">'+P.costoMes.map(function(m){
        var tipTxt=m.m+': $'+fn(Math.round(m.c));
        return'<div class="bar-c"><div class="bar-v" style="font-size:9px">$'+(m.c/1e6).toFixed(1)+'M</div><div class="bar" style="height:'+Math.max(m.c/maxC*100,3)+'%;background:#7b83c9;cursor:default" onmouseenter="vizTip(event,\''+tipTxt+'\')" onmousemove="vizTipMove(event)" onmouseleave="vizTipHide()"></div><div class="bar-l">'+m.m.slice(5)+'</div></div>';
      }).join('')+'</div></div>';

  } else if(fVista==='equipo' && fEq && P.equipos[fEq]){
    var E=P.equipos[fEq];
    var conf=calcConfianza(fEq);
    var ac=alertaCruzada(fEq);
    var maxN=Math.max.apply(null,E.trend.map(function(t){return t.n;}))||1;
    var maxC2=Math.max.apply(null,E.trend.map(function(t){return t.c;}))||1;
    var eqItems=P.topItems.filter(function(it){return it.equipos.includes(fEq);}).slice(0,15);
    var confCol=conf.nivel==='Alta'?'var(--ok)':conf.nivel==='Media'?'var(--w)':'var(--tx3)';
    var recom=ac.severity>=5?'🔴 Intervenir inmediato':ac.severity>=2?'🟡 Monitorear':'🟢 Sin acción';

    content=
      '<div class="cards">'+
      '<div class="card"><div class="card-t">Pedidos</div><div class="card-v">'+E.totalPedidos+'</div><div class="card-s">en '+E.meses+' meses</div></div>'+
      '<div class="card"><div class="card-t">Prom/Mes</div><div class="card-v" style="color:var(--ac)">'+E.promPedMes+'</div></div>'+
      '<div class="card"><div class="card-t">Costo/Mes</div><div class="card-v" style="font-size:16px">$'+E.promCostoMes.toLocaleString()+'</div></div>'+
      '<div class="card"><div class="card-t">Lead Time</div><div class="card-v">'+E.leadTimeProm+'d</div></div>'+
      '<div class="card"><div class="card-t">Confianza</div><div class="card-v" style="color:'+confCol+'">'+conf.nivel+'</div><div class="card-s">Score: '+conf.score+'/7</div></div>'+
      '<div class="card" style="border-left:3px solid '+(ac.severity>=5?'var(--danger)':ac.severity>=2?'var(--w)':'var(--ok)')+'"><div class="card-t">Estado</div><div class="card-v">'+ac.estado+'</div><div class="card-s">'+recom+'</div></div>'+
      '</div>'+
      (ac.alertas.length?'<div class="card" style="margin-bottom:12px;border-left:3px solid var(--danger)"><b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> Alertas:</b> '+ac.alertas.map(escapeHtml).join(' · ')+'</div>':'')+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">'+
      '<div class="chart-box"><div class="chart-t">Pedidos/Mes</div><div class="bars">'+E.trend.map(function(t){
        var tipTxt=t.m+': '+t.n+' pedidos';
        return'<div class="bar-c"><div class="bar-v">'+(t.n||'')+'</div><div class="bar" style="height:'+Math.max(t.n/maxN*100,3)+'%;background:#3b82f6;cursor:default" onmouseenter="vizTip(event,\''+tipTxt+'\')" onmousemove="vizTipMove(event)" onmouseleave="vizTipHide()"></div><div class="bar-l">'+t.m.slice(5)+'</div></div>';
      }).join('')+'</div></div>'+
      '<div class="chart-box"><div class="chart-t">Costo/Mes</div><div class="bars">'+E.trend.map(function(t){
        var tipTxt=t.m+': $'+fn(Math.round(t.c));
        return'<div class="bar-c"><div class="bar-v" style="font-size:8px">'+(t.c>0?'$'+(t.c/1e6).toFixed(1)+'M':'')+'</div><div class="bar" style="height:'+Math.max(t.c/maxC2*100,3)+'%;background:var(--ac);cursor:default" onmouseenter="vizTip(event,\''+tipTxt+'\')" onmousemove="vizTipMove(event)" onmouseleave="vizTipHide()"></div><div class="bar-l">'+t.m.slice(5)+'</div></div>';
      }).join('')+'</div></div></div>'+
      '<div class="chart-box"><div class="chart-t">Top Items — '+escapeHtml(fEq)+'</div>'+
      '<div class="tbl-wrap"><table><tr><th>Item</th><th>Pedidos</th><th>Prom/Mes</th><th>Lead</th><th>Costo</th></tr>'+
      eqItems.map(function(it){
        return'<tr><td style="font-size:11px">'+escapeHtml(it.item)+'</td><td style="text-align:center;font-weight:600">'+it.total+'</td>'+
          '<td style="text-align:center">'+it.promMes+'</td><td style="text-align:center">'+it.leadTime+'d</td>'+
          '<td style="text-align:right;font-size:11px">$'+it.costoTotal.toLocaleString()+'</td></tr>';
      }).join('')+'</table></div></div>';

  } else if(fVista==='backlog'){
    // BACKLOG INTELIGENTE
    var backlog=[];
    // From OTs pending
    ot.forEach(function(o,i){
      if(o.estadoOT==='Pendiente'||o.estadoOT==='En Ejecución'){
        var diasPend=Math.round((Date.now()-new Date(o.fechaEntrada||o.fecha).getTime())/864e5);
        var motivo=o.motivoPendiente||'';
        // Impacto = qué tan grave es que este trabajo siga pendiente. No solo el flag
        // "Fuera de Servicio": también pesa la criticidad del equipo (un equipo crítico
        // parado importa más que uno de apoyo). Antes era binario y solo miraba el flag.
        var eqInfoB=eq.find(function(x){return x.sigla===o.sigla;});
        var esCritEq=eqInfoB&&(eqInfoB.criticidad==='Crítico'||eqInfoB.criticidad==='Alta');
        var impacto=(o.estatusEq==='Fuera de Servicio'||esCritEq)?'Alto':'Medio';
        var prioridad=diasPend>7&&impacto==='Alto'?'🔴 Crítico':diasPend>3?'🟡 Atrasado':'🟢 Normal';
        backlog.push({idx:i,sigla:o.sigla,trabajo:o.sintoma||o.tipo,origen:'Correctivo',dias:diasPend,
          motivo:motivo,impacto:impacto,prioridad:prioridad,estadoOT:o.estadoOT,componente:o.componente||''});
      }
    });
    // From predictive alerts
    eq.forEach(function(e){
      if((e.estado||'').includes('URGENTE')&&e.diasParaPM<=0){
        backlog.push({idx:-1,sigla:e.sigla,trabajo:e.tipoPM+' vencida',origen:'Preventivo',dias:Math.abs(e.diasParaPM),
          motivo:'PM vencida',impacto:'Alto',prioridad:'🔴 Crítico',estadoOT:'Pendiente',componente:'',predCumplida:''});
      }
    });
    backlog.sort(function(a,b){return b.dias-a.dias;});

    var is=CELL_INPUT_STYLE+';font-size:11px;padding:2px';

    content=
      '<div class="cards">'+
      '<div class="card" style="border-left:3px solid var(--danger)"><div class="card-t">🔴 Críticos</div><div class="card-v" style="color:var(--danger)">'+backlog.filter(function(b){return b.prioridad.includes('🔴');}).length+'</div></div>'+
      '<div class="card" style="border-left:3px solid var(--w)"><div class="card-t">🟡 Atrasados</div><div class="card-v" style="color:var(--w)">'+backlog.filter(function(b){return b.prioridad.includes('🟡');}).length+'</div></div>'+
      '<div class="card"><div class="card-t">🟢 Normal</div><div class="card-v">'+backlog.filter(function(b){return b.prioridad.includes('🟢');}).length+'</div></div>'+
      '<div class="card"><div class="card-t">Total Backlog</div><div class="card-v">'+backlog.length+'</div></div>'+
      '</div>'+
      '<div class="tbl-wrap"><table>'+
      '<tr><th>Prioridad</th><th>Equipo</th><th>Trabajo</th><th>Origen</th><th>Días</th><th>Motivo <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Impacto</th><th>Componente</th><th>Acción</th></tr>'+
      backlog.map(function(b){
        var bg=b.prioridad.includes('🔴')?'background:rgba(239,68,68,.06)':b.prioridad.includes('🟡')?'background:rgba(245,158,11,.04)':'';
        return'<tr style="'+bg+'">'+
          '<td style="font-size:12px">'+b.prioridad+'</td>'+
          '<td class="mono" style="color:var(--ac)">'+escapeHtml(b.sigla)+'</td>'+
          '<td style="font-size:11px;max-width:150px">'+escapeHtml(b.trabajo)+'</td>'+
          '<td style="font-size:10px"><span class="badge '+(b.origen==='Correctivo'?'b-r':'b-y')+'">'+b.origen+'</span></td>'+
          '<td style="text-align:center;font-weight:600;color:'+(b.dias>7?'var(--danger)':'var(--w)')+'">'+b.dias+'d</td>'+
          '<td>'+(b.idx>=0?'<input value="'+escapeHtml(b.motivo||'')+'" data-ot="'+b.idx+'" data-key="motivoPendiente" onchange="edOT(parseInt(this.dataset.ot),this.dataset.key,this.value)" style="width:90px;'+is+'" placeholder="Motivo...">':'<span style="font-size:10px">'+escapeHtml(b.motivo)+'</span>')+'</td>'+
          '<td style="font-size:11px;font-weight:600;color:'+(b.impacto==='Alto'?'var(--danger)':'var(--w)')+'">'+b.impacto+'</td>'+
          '<td style="font-size:10px">'+escapeHtml(b.componente||'—')+'</td>'+
          '<td>'+(b.prioridad.includes('🔴')?'<span style="font-size:10px;color:var(--danger);font-weight:600">Resolver hoy</span>':
            b.prioridad.includes('🟡')?'<span style="font-size:10px;color:var(--w)">Programar</span>':
            '<span style="font-size:10px;color:var(--ok)">Puede esperar</span>')+'</td></tr>';
      }).join('')+
      '</table></div>';

  } else if(fVista==='items'){
    var items=P.topItems.slice(0,40);
    content=
      '<div class="chart-box"><div class="chart-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="8"/><line x1="10" y1="6" x2="10" y2="11"/><circle cx="10" cy="14" r="0.6" fill="currentColor" stroke="none"/></svg> Top 40 Items</div>'+
      '<div class="tbl-wrap"><table><tr><th>Item</th><th>Pedidos</th><th>Prom/Mes</th><th>Lead</th><th>Equipos</th><th>Costo</th></tr>'+
      items.map(function(it){
        return'<tr><td style="font-size:11px">'+escapeHtml(it.item)+'</td><td style="text-align:center;font-weight:600;color:var(--ac)">'+it.total+'</td>'+
          '<td style="text-align:center">'+it.promMes+'</td><td style="text-align:center">'+it.leadTime+'d</td>'+
          '<td style="font-size:10px">'+it.equipos.join(', ')+'</td>'+
          '<td style="text-align:right;font-size:11px">$'+it.costoTotal.toLocaleString()+'</td></tr>';
      }).join('')+'</table></div></div>';
  } else if(fVista==='flota'){
    var df=diagnosticoFlota();
    content=
      '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px"><div class="chart-t">🏭 Componentes con fallas repetitivas — toda la flota</div>'+
      '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Agrupa TODOS los correctivos por componente, sin importar el equipo. Ordenado por severidad: primero lo que se repite en el mismo equipo o en varios equipos a la vez.</div>'+
      (df.length?
        df.map(function(c){
          var borde=c.severidad>=3?'var(--danger)':c.severidad>=2?'var(--w)':'var(--bd)';
          return'<div class="card" style="margin-bottom:10px;border-left:3px solid '+borde+'">'+
            '<div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:6px">'+
            '<div style="font-weight:700;font-size:14px">'+escapeHtml(c.componente)+'</div>'+
            '<div style="font-size:11px;color:var(--tx3)">'+c.total+' fallas · '+c.nEquipos+' equipo(s) · última hace '+(c.diasDesdeUltima==null?'—':c.diasDesdeUltima+'d')+'</div>'+
            '</div>'+
            '<div style="font-size:12px;margin:6px 0;line-height:1.5"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="8" r="5"/><line x1="8" y1="16" x2="12" y2="16"/><line x1="8.5" y1="13" x2="8.5" y2="16"/><line x1="11.5" y1="13" x2="11.5" y2="16"/></svg> '+escapeHtml(c.sugerencia)+'</div>'+
            (c.causaTop?'<div style="font-size:11px;color:var(--tx2);margin-bottom:4px"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8.5" cy="8.5" r="5.5"/><line x1="12.7" y1="12.7" x2="17.5" y2="17.5"/></svg> Causa más mencionada en el registro: <b>'+escapeHtml(c.causaTop.toUpperCase())+'</b> ('+c.causaTopN+' veces)</div>':'')+
            (c.reincidenciaDias!=null?'<div style="font-size:11px;margin-bottom:4px;color:'+(c.reincidenciaDias<30?'var(--danger)':c.reincidenciaDias<90?'var(--w)':'var(--tx2)')+'">⏱️ En '+escapeHtml(c.equipoMasRepetido)+', vuelve a fallar en promedio cada <b>'+c.reincidenciaDias+' día(s)</b>'+(c.reincidenciaDias<30?' — intervalo corto: revisar calidad del repuesto o de la reparación, no parece desgaste normal':c.reincidenciaDias<90?' — intervalo moderado, vale la pena revisar':'')+
              (c.tendencia==='empeora'?' · <b style="color:var(--danger)"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,5 8,10 11,7 17,16"/><polyline points="12,16 17,16 17,11"/></svg> empeorando</b> (el intervalo entre fallas se acortó vs. las primeras veces)':c.tendencia==='mejora'?' · <b style="color:var(--ok)"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,15 8,10 11,13 17,4"/><polyline points="12,4 17,4 17,9"/></svg> mejorando</b> (el intervalo se alargó)':'')+
              '</div>':'')+
            (c.cubiertoPorPM===false?'<div style="font-size:11px;color:var(--w);margin-bottom:4px"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Este componente NO aparece en ninguna pauta de mantención preventiva de estos equipos — siempre se detecta por correctivo, nunca por revisión programada.</div>':'')+
            (c.cruce&&c.cruce.length?c.cruce.map(function(o){return'<div style="font-size:11px;color:var(--tx2);margin-bottom:4px">'+escapeHtml(o)+'</div>';}).join(''):'')+
            (c.requiereRCA?'<div style="font-size:11px;background:rgba(99,102,241,.08);border-radius:6px;padding:6px 8px;margin:6px 0;color:var(--tx2)">'+
              '<b style="color:#818cf8">🔬 Amerita Análisis de Causa Raíz</b> ('+c.total+' fallas — igual que activaría un CMMS real ante ≥3 correctivos del mismo tipo).'+
              (c.causasFMEA?' Esto NO es un diagnóstico, es el checklist estándar de la industria (FMEA) para descartar en terreno:<ul style="margin:4px 0 0 16px;padding:0">'+c.causasFMEA.map(function(h){return'<li>'+escapeHtml(h)+'</li>';}).join('')+'</ul>'
                :' Sin checklist FMEA cargado todavía para "'+escapeHtml(c.componente)+'" — requiere revisión manual de un técnico.')+
              '</div>':'')+
            '<div style="font-size:10px;color:var(--tx3)">Equipo más repetido: <b class="mono" style="color:var(--ac)">'+escapeHtml(c.equipoMasRepetido||'—')+'</b> ('+(c.vecesEnEsePeor||0)+' veces) · '+c.pctAtendido+'% con solución registrada'+(c.pendientes?' · <span style="color:var(--danger)">'+c.pendientes+' aún pendiente(s)</span>':'')+(c.costoTotal?' · $'+Math.round(c.costoTotal).toLocaleString()+' acumulado':'')+'</div>'+
            '</div>';
        }).join('')
      :'<div style="padding:20px;text-align:center;color:var(--tx3)">Aún no hay suficientes correctivos con "componente" registrado para detectar patrones. Se necesitan al menos 2 fallas del mismo componente.</div>')+
      '</div>';
  } else if(fVista==='probabilidad'){
    // Combina 'ot' (correctivos actuales, filtrados por esFallaMTBF — misma fuente
    // única que MTBF/Confiabilidad) con 'otHist' (historial 2022-2025 cargado desde
    // Excel, ver conversación 2026-08-15) en una sola lista de eventos {sigla,
    // componente, fecha}, y de ahí probabilidadFallaDesdeEventos (logic.js) calcula
    // MTBF empírico y probabilidad de falla en 30 días por equipo+componente.
    var otHistProb=S.g('otHist')||[];
    var eventosProb=[];
    ot.forEach(function(o){
      if(!esFallaMTBF(o))return;
      var comp=(o.componente&&o.componente.trim())||_componenteDeSintoma(o.sintoma);
      if(comp)eventosProb.push({sigla:o.sigla,componente:comp,fecha:o.fecha});
    });
    otHistProb.forEach(function(o){
      if(o&&o.sigla&&o.sistema)eventosProb.push({sigla:o.sigla,componente:o.sistema,fecha:o.fecha});
    });
    var probs=probabilidadFallaDesdeEventos(eventosProb).slice(0,40);
    content=
      '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px"><div class="chart-t">🎲 Probabilidad de falla en los próximos 30 días</div>'+
      '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Estimación estadística (no una predicción exacta): usa el intervalo promedio real entre fallas pasadas del mismo equipo+componente — combina los correctivos actuales con el historial 2022-2025 cargado desde Excel ('+otHistProb.length+' eventos históricos) para tener más muestra. Solo se muestra donde hay 3+ fallas registradas; con menos, el número no sería confiable.</div>'+
      (probs.length?
        '<div class="tbl-wrap"><table><tr><th>Equipo</th><th>Componente</th><th>N° fallas</th><th>MTBF (días)</th><th>Prob. falla 30 días</th><th>Última falla</th></tr>'+
        probs.map(function(p){
          var col=p.prob30dPct>=60?'var(--danger)':p.prob30dPct>=30?'var(--w)':'var(--ok)';
          return'<tr><td class="mono" style="font-weight:600">'+escapeHtml(p.sigla)+'</td>'+
            '<td style="font-size:11px">'+escapeHtml(p.componente)+'</td>'+
            '<td style="text-align:center">'+p.nEventos+'</td>'+
            '<td style="text-align:center">'+p.mtbfDias+'</td>'+
            '<td style="text-align:center;font-weight:700;color:'+col+'">'+p.prob30dPct+'%</td>'+
            '<td style="font-size:10px;color:var(--tx3)">'+escapeHtml(p.ultimaFecha||'—')+'</td></tr>';
        }).join('')+
        '</table></div>'
      :'<div style="padding:20px;text-align:center;color:var(--tx3)">Aún no hay suficiente historial (se necesitan 3+ fallas del mismo equipo+componente) para calcular una probabilidad confiable.</div>')+
      '</div>';
  } else if(fVista==='stockpm'){
    var hz=parseInt(window._predHorizonte)||90;
    var sp=stockVsProximosPM(hz);
    content=
      '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px"><div class="chart-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="10,2 17,6 10,10 3,6"/><line x1="3" y1="6" x2="3" y2="13"/><line x1="17" y1="6" x2="17" y2="13"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="3" y1="13" x2="10" y2="18"/><line x1="17" y1="13" x2="10" y2="18"/></svg> Stock vs. Próximos PM ('+hz+' días)</div>'+
      _selHorizontePred(hz)+
      '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">"Stock &amp; Insumos" muestra cuántos meses cubre el consumo promedio histórico. Esto es distinto: cruza qué repuesto pide la pauta de cada PM que ya viene en el calendario (por horómetro proyectado) contra el stock de HOY — para avisar si falta antes de que llegue ese PM puntual, no en promedio.</div>'+
      (sp.length?
        sp.map(function(a){
          var borde=a.severidad>=3?'var(--danger)':'var(--w)';
          var primero=a.equipos[0];
          return'<div class="card" style="margin-bottom:10px;border-left:3px solid '+borde+'">'+
            '<div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:6px">'+
            '<div style="font-weight:700;font-size:13px">'+escapeHtml(a.descripcion||a.nParte)+'</div>'+
            '<div style="font-size:10px;color:var(--tx3)" class="mono">'+escapeHtml(a.nParte||'')+'</div>'+
            '</div>'+
            '<div style="font-size:12px;margin:6px 0;color:'+(a.severidad>=3?'var(--danger)':'var(--w)')+'"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> Stock actual: <b>'+a.stockActual+'</b> · Se necesitan <b>'+a.demandaTotal+'</b> para los PM que vienen en '+hz+' días · Faltan <b>'+a.deficit+'</b></div>'+
            '<div style="font-size:11px;color:var(--tx2)">Primero lo necesita <b class="mono" style="color:var(--ac)">'+escapeHtml(primero.sigla)+'</b> en <b>'+primero.dias+' día(s)</b>'+(primero.fecha?' ('+escapeHtml(primero.fecha)+')':'')+'</div>'+
            (a.equipos.length>1?'<div style="font-size:10px;color:var(--tx3);margin-top:2px">También lo necesitan: '+a.equipos.slice(1).map(function(e){return escapeHtml(e.sigla)+' ('+e.dias+'d)';}).join(', ')+'</div>':'')+
            '</div>';
        }).join('')
      :'<div style="padding:20px;text-align:center;color:var(--ok)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> El stock actual alcanza para todos los PM proyectados en los próximos '+hz+' días (según lo que la pauta indica para cada uno).</div>')+
      '</div>';
  } else if(fVista==='lubpm'){
    var hz=parseInt(window._predHorizonte)||90;
    var lp=lubVsProximosPM(hz);
    content=
      '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px"><div class="chart-t"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="5" y="3" width="10" height="14" rx="2"/><line x1="5" y1="7" x2="15" y2="7"/><line x1="5" y1="13" x2="15" y2="13"/></svg>️ Lubricantes vs. Próximos PM ('+hz+' días)</div>'+
      _selHorizontePred(hz)+
      '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Mismo cruce que Stock vs. Próximos PM, pero para aceites/grasas/refrigerante: cuánto pide la pauta de cada PM que ya viene en el calendario, contra el stock de lubricantes de HOY.</div>'+
      (lp.length?
        lp.map(function(a){
          var borde=a.severidad>=3?'var(--danger)':'var(--w)';
          var primero=a.equipos[0];
          return'<div class="card" style="margin-bottom:10px;border-left:3px solid '+borde+'">'+
            '<div style="font-weight:700;font-size:13px">'+escapeHtml(a.nombre)+'</div>'+
            '<div style="font-size:12px;margin:6px 0;color:'+(a.severidad>=3?'var(--danger)':'var(--w)')+'"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> Stock actual: <b>'+a.stockActual+a.unidad+'</b> · Se necesitan <b>'+a.demandaTotal+a.unidad+'</b> para los PM que vienen en '+hz+' días · Faltan <b>'+a.deficit+a.unidad+'</b></div>'+
            '<div style="font-size:11px;color:var(--tx2)">Primero lo necesita <b class="mono" style="color:var(--ac)">'+escapeHtml(primero.sigla)+'</b> en <b>'+primero.dias+' día(s)</b>'+(primero.fecha?' ('+escapeHtml(primero.fecha)+')':'')+'</div>'+
            (a.equipos.length>1?'<div style="font-size:10px;color:var(--tx3);margin-top:2px">También lo necesitan: '+a.equipos.slice(1).map(function(e){return escapeHtml(e.sigla)+' ('+e.dias+'d)';}).join(', ')+'</div>':'')+
            '</div>';
        }).join('')
      :'<div style="padding:20px;text-align:center;color:var(--ok)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> El stock de lubricantes alcanza para todos los PM proyectados en los próximos '+hz+' días.</div>')+
      '</div>';
  }


  if(fVista==='diag'){
    var diagEq=fEq||eq[0]?.sigla||'';
    var d=diagEq?generarDiagnostico(diagEq):null;
    content=
      (diagEq?'':'<div class="card" style="padding:20px;text-align:center;color:var(--tx3)">Selecciona un equipo arriba para ver diagnóstico integral</div>')+
      (!d?'':
      '<div class="card" style="margin-bottom:16px;border-left:4px solid var(--ac);padding:16px">'+
      '<div style="font-size:18px;font-weight:700;margin-bottom:4px">'+escapeHtml(d.sigla)+' — '+escapeHtml(d.modelo)+'</div>'+
      '<div style="font-size:11px;color:var(--tx3)">'+escapeHtml(d.tipo)+'</div></div>'+

      '<div class="card" style="margin-bottom:16px;background:var(--bg3);padding:14px;border-radius:8px">'+
      '<div style="font-size:12px;font-weight:600;color:var(--ac);margin-bottom:6px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="8" r="5"/><line x1="8" y1="16" x2="12" y2="16"/><line x1="8.5" y1="13" x2="8.5" y2="16"/><line x1="11.5" y1="13" x2="11.5" y2="16"/></svg> INTERPRETACIÓN AUTOMÁTICA:</div>'+
      '<div style="font-size:13px;line-height:1.6">'+escapeHtml(d.interpretacion)+'</div></div>'+

      d.secciones.map(function(s){
        return'<div class="card" style="margin-bottom:10px;border-left:3px solid '+s.color+'">'+
          '<div style="font-weight:700;margin-bottom:6px">'+s.titulo+'</div>'+
          s.items.map(function(item){
            return'<div style="font-size:12px;padding:3px 0;border-bottom:1px solid var(--bd)">'+escapeHtml(item)+'</div>';
          }).join('')+'</div>';
      }).join(''));
  }

$('s-pred').innerHTML=
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,15 8,10 11,13 17,4"/><polyline points="12,4 17,4 17,9"/></svg> Predictivo &amp; Confiabilidad</div>'+
    '<div class="sec-s">Arriba lo accionable (qué anticipar) · abajo el histórico de compras · todo desde datos reales</div></div></div>'+
    '<div class="toolbar">'+
    '<select id="fPredVista" onchange="renders.pred()" style="font-weight:600">'+
    '<option value="general"'+(fVista==='general'?' selected':'')+'>🟢 Necesita atención + histórico</option>'+
    '<option value="equipo"'+(fVista==='equipo'||fVista==='diag'?' selected':'')+'>🏗 Por Equipo</option>'+
    '<option value="backlog"'+(fVista==='backlog'?' selected':'')+'><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Backlog Inteligente</option>'+
    '<option value="items"'+(fVista==='items'?' selected':'')+'><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="8"/><line x1="10" y1="6" x2="10" y2="11"/><circle cx="10" cy="14" r="0.6" fill="currentColor" stroke="none"/></svg> Top Items</option>'+
    '<option value="diag"'+(fVista==='diag'?' selected':'')+'>🧠 Diagnóstico Integral</option>'+
    '<option value="flota"'+(fVista==='flota'?' selected':'')+'>🏭 Fallas Repetitivas (Flota)</option>'+
    '<option value="probabilidad"'+(fVista==='probabilidad'?' selected':'')+'>🎲 Probabilidad de Falla</option>'+
    '<option value="stockpm"'+(fVista==='stockpm'?' selected':'')+'><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="10,2 17,6 10,10 3,6"/><line x1="3" y1="6" x2="3" y2="13"/><line x1="17" y1="6" x2="17" y2="13"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="3" y1="13" x2="10" y2="18"/><line x1="17" y1="13" x2="10" y2="18"/></svg> Stock vs. Próximos PM</option>'+
    '<option value="lubpm"'+(fVista==='lubpm'?' selected':'')+'><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="5" y="3" width="10" height="14" rx="2"/><line x1="5" y1="7" x2="15" y2="7"/><line x1="5" y1="13" x2="15" y2="13"/></svg>️ Lubricantes vs. Próximos PM</option></select>'+
    (fVista==='equipo'||fVista==='diag'?
      '<select id="fPredEq" onchange="renders.pred()"><option value="">Seleccionar equipo...</option>'+
      eq.map(function(e){return'<option'+(fEq===e.sigla?' selected':'')+'>'+escapeHtml(e.sigla)+'</option>'}).join('')+'</select>':'')+
    '</div>'+content;
}
