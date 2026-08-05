// ═══════════════════════════════════════════════════════════════════════
// MOTOR DE SINCRONIZACIÓN — capa de datos (S.g/S.s) + Supabase
// ═══════════════════════════════════════════════════════════════════════
// Última pieza de la Fase 2 de modularización, y la de mayor riesgo:
// TODO el resto de la app (634 llamadas repartidas en los 39 módulos de
// renders/) depende de que S.g/S.s se comporten exactamente igual que
// antes de este movimiento — cero cambio de lógica, solo de ubicación.
//
// Bloque 100% contiguo en el archivo original (a diferencia de kpi/neu/cfg,
// que estaban dispersos) — se movió tal cual, sin tocar una sola línea de
// código, verificado línea por línea contra el original antes de mover.
//
// Contiene: K (prefijo de localStorage), SB_HEAVY, _sbCache (cache en
// memoria), _sbReady, _sbSingletonUpdatedAt, credenciales por defecto
// (_SB_DEFAULT_URL/_SB_DEFAULT_KEY — también usadas por el login/MFA/
// gestión de usuarios en index.html y por crearUsuarioUI en cfg.js, todas
// referencias cross-script a este mismo const, igual que ya hacían con S
// antes de este movimiento), _sbCfg/_sbOk/_sbHeaders, TABLA_REAL/
// TABLA_SINGLETON (mapeo de cada categoría a su tabla real de Postgres),
// _uuidV4 (usado también por neu.js/cad.js), el paginador de PostgREST
// (_fetchPaginado/_fetchPaginadoSecuencial — esquiva el tope de ~1000
// filas por request), los "_refetch*" (traen el estado fresco de una
// categoría/vencimientos/singleton), el motor de sync propiamente tal
// (_syncTablaGenerica/_syncVencimientos/_syncSingleton + su chequeo de
// edición concurrente _chequearConflicto/_chained), _sbWrite (fallback
// genérico vía la tabla kv, ya casi sin uso), _recorteParaLocal (tope de
// filas guardadas en localStorage para las categorías que crecen sin
// límite — el historial completo siempre vive en Supabase), y finalmente
// el objeto S mismo (S.g/S.s/S.init).
//
// K/SB_HEAVY/_sbCache/_sbOk/_uuidV4/_SB_DEFAULT_URL/_SB_DEFAULT_KEY/
// _TOPE_FILAS_LOCAL siguen siendo referenciados por código que queda en
// index.html (_cargarFallbackLocal, el bootstrap de login/MFA, la
// migración de neuMed, etc.) — funciona igual que cualquier otro módulo
// ya extraído: son const/function de nivel superior, compartidos entre
// TODOS los <script> clásicos de la página (no son módulos ES), así que
// siguen siendo el mismo global sin importar en qué archivo estén.
// ═══════════════════════════════════════════════════════════════════════

const K='smp10_';
// ═══ CLAVES PESADAS EN SUPABASE (ot, reg, hist, mov) ═══
// ARQUITECTURA OFFLINE-FIRST: _sbCache (memoria) + localStorage (offline) + Supabase (nube)
// Todas las claves siguen este patrón — no solo las 4 pesadas anteriores.
const SB_HEAVY=['ot','reg','hist','mov']; // mantenido por compatibilidad
const _sbCache={};  // cache en memoria para TODAS las claves
let _sbReady=false; // true cuando Supabase cargó exitosamente
// updated_at de cada singleton (config, tarifa_hh, metas, etc.) tal como esta pestaña
// lo vio la última vez — usado por _syncSingleton para detectar si alguien más lo
// cambió mientras tanto (un singleton no tiene ids que comparar, solo esta fila).
const _sbSingletonUpdatedAt={};

// Credenciales por defecto — permiten que Vercel conecte sin configuración manual
const _SB_DEFAULT_URL='https://jyhpfwivhwzylkzxrsbt.supabase.co';
const _SB_DEFAULT_KEY='sb_publishable_mI_CTe7yV23tllXXkdp-Aw_2UZCtwbi';
function _sbCfg(){
  try{const c=JSON.parse(localStorage.getItem(K+'cfg'))||{};
    return{url:(c.sbUrl||_SB_DEFAULT_URL).replace(/\/+$/,''),key:c.sbKey||_SB_DEFAULT_KEY};}
  catch{return{url:_SB_DEFAULT_URL,key:_SB_DEFAULT_KEY};}
}
function _sbOk(){const c=_sbCfg();return c.url.startsWith('https://')&&c.key.length>10;}
function _sbHeaders(){
  const c=_sbCfg();
  const userToken=localStorage.getItem('smp_access_token');
  return{'apikey':c.key,'Authorization':'Bearer '+(userToken||c.key),'Content-Type':'application/json'};
}

// ══════════════════════════════════════════════════════════════════
// FASE B — mapeo de cada clave vieja de kv a su tabla real nueva.
// clave: nombre del campo en el objeto JS que identifica la fila.
//   '_id'  = campo oculto sintético (uuid generado acá, no lo usa el resto del código).
//   otro   = clave natural que YA existe en el objeto (ej. 'sigla', 'id').
// claveDb: nombre real de esa columna en la tabla de Postgres.
// ══════════════════════════════════════════════════════════════════
const TABLA_REAL={
  reg:{tabla:'registros_pm',clave:'_id',claveDb:'id',cols:['equipo','tipoPM','fechaEntrada','horaEntrada','fechaSalida','horaSalida','duracion','duracionH','horomReal','estado','tecnico','obs','estatusEq','lugar','sintoma','nReg','fechaEjec']},
  ot:{tabla:'correctivos',clave:'_id',claveDb:'id',cols:['sigla','tipo','fecha','horom','turno','sintoma','sistema','tecnico','codFalla','duracion','estadoOT','operador','solucion','causaRaiz','estatusEq','ubicacion','componente','criticidad','folioExcel','horaEntrada','fechaEntrada','horaSalida','fechaSalida','fechaIngreso','autorizadoPor','costo','ast','loto']},
  mov:{tabla:'movimientos_stock',clave:'_id',claveDb:'id',cols:['equipo','tipo','item','nParte','cant','ant','nuevo','fecha','mes','pm']},
  hist:{tabla:'historial_horometros',clave:'_id',claveDb:'id',cols:['sigla','fecha','horomIni','horomFin','horom','origen']},
  neuMed:{tabla:'neumaticos_mediciones',clave:'_id',claveDb:'id',cols:['neuId','sigla','serie','posicion','fecha','horom','motivo','remExt','remInt','remProm','sensor']},
  pau:{tabla:'pautas',clave:'_id',claveDb:'id',cols:['sigla','hoja','pm','cat','act','hrs','rep','can']},
  stk:{tabla:'stock_filtros',clave:'_id',claveDb:'id',cols:['nParte','descripcion','equipoModelo','stockBodega','consumoMes','proyMes','mesesCubierto','pendiente','comprar','precioUnit','codAlt','estado']},
  lub:{tabla:'lubricantes',clave:'_id',claveDb:'id',cols:['nombre','unidad','stock','consumoMes','proyMes','precio']},
  repuestos:{tabla:'repuestos',clave:'_id',claveDb:'id',cols:['componente','nParte','equipo','stockActual','stockMinimo','leadTime','precioUnit','proveedor']},
  prg:{tabla:'programa',clave:'_id',claveDb:'id',cols:['sigla','tipo','modelo','hrsDia','horomActual','meses']},
  compMayores:{tabla:'componentes_mayores',clave:'_id',claveDb:'id',cols:['sigla','tipo','modelo','comp','horomComp','vidaUtil','costoRef','fechaInst','estado','obs','esOriginal']},
  insp:{tabla:'inspecciones',clave:'_id',claveDb:'id',cols:['equipo','fecha','horometro','visual','niveles','fugas','luces','frenos','neumaticos','obs','inspector']},
  aceite:{tabla:'analisis_aceite',clave:'_id',claveDb:'id',cols:['sigla','equipo','fecha','nMuestra','hrsComp','hrsLub','lubricante','componente','descriptor','hierro','cobre','plomo','aluminio','silicio','cromo','sodio','visc40','visc100','pq','tbn','tan','isoCode','espEst1','espEst2','espEst3','demulsibilidad','estado','comentario']},
  ordenes:{tabla:'ordenes_compra',clave:'_id',claveDb:'id',cols:['componente','nParte','cantidad','costoEstimado','proveedor','fecha','estado','equipo','obs','fechaEntrega']},
  planSem:{tabla:'plan_semanal',clave:'_id',claveDb:'id',cols:['sigla','semana','datos']},
  planSemHist:{tabla:'plan_semanal_historico',clave:'_id',claveDb:'id',cols:['sigla','semana','datos']},
  gantt:{tabla:'gantt',clave:'_id',claveDb:'id',cols:['sigla','actividad','inicio','fin','datos']},
  destrabe:{tabla:'destrabe',clave:'_id',claveDb:'id',cols:['sigla','motivo','datos']},
  changelog:{tabla:'changelog',clave:'_id',claveDb:'id',cols:['fecha','usuario','accion','detalle']},
  fil:{tabla:'tabla_precios_maestro',clave:'_id',claveDb:'id',cols:['nParte','precio']},
  al:{tabla:'alertas',clave:'_id',claveDb:'id',cols:['sigla','repuestos']},
  // Cache de matches repuesto↔stock ya resueltos (una vez por línea de pauta) — ver
  // descontarStock(). Tabla operacional (cualquier usuario activo puede escribirla),
  // separada de 'pau' porque esta es de solo-admin y el match se resuelve durante
  // el registro normal de un PM, que hace cualquier operador.
  mapaRep:{tabla:'mapeo_repuestos',clave:'_id',claveDb:'id',cols:['pautaId','tipo','refId']},
  // Clave natural: el propio campo ya identifica la fila, tanto en JS como en la tabla.
  eq:{tabla:'equipos',clave:'sigla',claveDb:'sigla',cols:['sigla','tipo','modelo','frecPM','hrsDia','horomActual','fechaHorom','estado','tipoPM','horomProxPM','hrsRestantes','diasParaPM','fechaProxPM','numSerie','anioFab','vin','proveedor','valorCompra','fechaCompra','garantiaHasta','contrato','unidad','criticidad','inicioOper']},
  neu:{tabla:'neumaticos',clave:'id',claveDb:'id',cols:['id','sigla','tipo','marca','serie','medida','posicion','numPos','estado','tipoEquipo','vidaUtil','remNuevo','remanente','pctRemanente','alerta','fechaInst','ultimaMedicion','horasAcum','horomActual','horomInstalacion','horasBase','numSensor','obs']},
  informesFalla:{tabla:'informes_falla',clave:'id',claveDb:'id',cols:['id','sigla','tipo','modelo','componente','tipoEvento','descripcion','causaProbable','costoEstimado','horometroActual','generadoPor','fecha','fechaCreacion','fotos']},
  // Histórico real de órdenes de compra (jun-2022 a jun-2026). Solo lectura: nada en la
  // app llama S.s('ocHist', ...), así que nunca dispara el sync genérico (upsert/delete)
  // sobre esta tabla — evita que un guardado accidental borre datos financieros reales.
  ocHist:{tabla:'ordenes_compra_historico',clave:'_id',claveDb:'id',cols:['pedido','fecha','sigla','detalle','oc','cant','precioUnit','costo','rut','proveedor','tipo']},
  progDia:{tabla:'programacion_diaria',clave:'_id',claveDb:'id',cols:['fecha','turno','orden','nombre','cargo','responsable','bloques']},
  // Sensor de neumático como entidad propia (2026-07) — antes 'numSensor' era solo
  // un campo de texto dentro de 'neu', sin vida propia: si el sensor físico se
  // reutilizaba en OTRO neumático (no el mismo par rueda+sensor de siempre), no
  // había forma de seguirle la pista por separado. 'neuSerie' enlaza al
  // neumático actual por N° de serie (igual que neuMed ya hace con las mediciones).
  sen:{tabla:'sensores_neumaticos',clave:'_id',claveDb:'id',cols:['numSensor','marca','sigla','posicion','neuSerie','estado','fechaInst','obs','historial']},
  // Tren de rodaje (cadena) de bulldozers — una fila por lado+componente (eslabón,
  // buje, zapata, sprocket, rueda guía, rodillo superior/inferior), mismo patrón que
  // 'neu' pero sin criterio fijo por marca: cada equipo/proveedor trae su propio
  // valor nuevo y límite de desgaste (dato de la hoja técnica del fabricante), así
  // que quedan como campos editables en vez de una tabla de constantes como
  // NEU_CRITERIOS.
  cad:{tabla:'tren_rodaje',clave:'id',claveDb:'id',cols:['id','sigla','lado','componente','valorNuevo','limiteDesgaste','valorActual','pctRemanente','fechaInst','ultimaMedicion','horomInstalacion','estado','obs']},
  cadMed:{tabla:'tren_rodaje_mediciones',clave:'_id',claveDb:'id',cols:['sigla','lado','componente','fecha','horom','valorMedido','obs']}
};
// Singletons: una sola fila fija por tabla (id boolean primary key default true).
const TABLA_SINGLETON={
  cfg:{tabla:'configuracion',modo:'objeto',cols:['empresa','faena','meta','pass','sbUrl','sbKey','sbAuto','neuTargetHrs','neuProyMes']},
  hh:{tabla:'tarifa_hh',modo:'valor'},
  dispMeta:{tabla:'meta_disponibilidad',modo:'valor'},
  metas:{tabla:'metas',modo:'datos'},
  dispCalc:{tabla:'disponibilidad_calculada',modo:'datos'},
  avanceData:{tabla:'avance_data',modo:'datos'}
};

function _uuidV4(){
  if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(ch){var r=Math.random()*16|0,v=ch==='x'?r:(r&0x3|0x8);return v.toString(16);});
}

// Reintenta una carga async hasta 3 veces (con espera corta entre intentos) antes de
// rendirse — bug real encontrado: con ~31 categorías cargando en paralelo al arrancar,
// un solo intento que falla (blip de red, timeout transitorio) dejaba la categoría
// entera SIN refrescar, silenciosamente, para toda la sesión (ver _sbLoadHeavy).
async function _conReintento(fn,intentos){
  intentos=intentos||3;
  for(let i=0;i<intentos;i++){
    const r=await fn();
    if(r!==null)return r;
    if(i<intentos-1)await new Promise(function(res){setTimeout(res,300*(i+1));});
  }
  return null;
}

// Trae TODAS las filas de una URL base de PostgREST, paginando de a PASO filas.
// Bug real encontrado: Supabase impone un tope de filas por request ("Max Rows" en
// Settings > API, ronda los ~1000-1060 en este proyecto) que el propio PostgREST
// aplica SIEMPRE, sin importar qué tan grande sea el "limit" que mandemos nosotros
// — no da error, simplemente devuelve las primeras N filas y corta el resto en
// silencio. Con order=created_at.asc, eso significa que las filas MÁS RECIENTES
// (justo las que se acaban de cargar/importar) son las que se pierden. Encontrado
// con datos reales: los neumáticos CCK0099T7B y ZCP0206S3A (posiciones 1038-1053 y
// 1343-1366 en orden de creación, de 1830 filas totales en neumaticos_mediciones)
// quedaban afuera de cualquier request de una sola página, mostrando "0d/24.266h"
// en vez de su historial real — y esto solo iba a empeorar a medida que la tabla
// siguiera creciendo. Pedir de a PASO filas (bien por debajo del tope real) y seguir
// pidiendo la página siguiente hasta que venga una página incompleta esquiva el
// tope sin depender de conocer su valor exacto.
// IMPORTANTE: el order= que traiga urlBase tiene que ser ÚNICO (sin empates) o esta
// paginación por offset/limit deja de ser confiable — encontrado con datos reales:
// 1.053 filas de neumaticos_mediciones comparten el MISMO created_at (la migración
// masiva inicial insertó todo en un solo instante), así que "order=created_at.asc"
// solo no alcanza para ordenar de forma estable entre consultas separadas — Postgres
// puede devolver esos empates en distinto orden relativo cada vez, así que una fila
// puede quedar del lado equivocado del corte de página en una carga sí y en la
// siguiente no (el mismo neumático se veía bien en una recarga y mal en la próxima).
// Por eso cada llamador agrega ",id.asc" (o su equivalente único) al order.
const _PASO_PAGINA=500;
// Fallback secuencial (el original): una página tras otra, esperando cada una antes de
// pedir la siguiente. Se usa solo si el camino rápido de abajo no puede determinar el
// total de filas de antemano (ej. el header Content-Range no vino en la respuesta).
async function _fetchPaginadoSecuencial(urlBase){
  let todas=[],desde=0;
  while(true){
    const sep=urlBase.includes('?')?'&':'?';
    const rt=await fetch(`${urlBase}${sep}offset=${desde}&limit=${_PASO_PAGINA}`,{headers:_sbHeaders()});
    if(!rt.ok)return null;
    const filas=await rt.json();
    if(!Array.isArray(filas))return null;
    todas=todas.concat(filas);
    if(filas.length<_PASO_PAGINA)break;
    desde+=_PASO_PAGINA;
    if(desde>2000000)break; // salvavidas contra loop infinito
  }
  return todas;
}
// Trae TODAS las filas de una tabla, paginando de a _PASO_PAGINA (el límite real de
// PostgREST — subirlo de golpe reintroduce el truncado silencioso que motivó la
// paginación). La primera página pide el conteo exacto (header Prefer: count=exact ->
// Content-Range: "0-499/3372") para saber cuántas páginas hacen falta en total y pedir
// TODAS LAS DEMÁS EN PARALELO, en vez de una tras otra. Antes, una tabla grande (ej.
// historial_horometros con miles de filas) hacía 7+ vueltas SECUENCIALES solo para esa
// categoría — y como el arranque de la app espera a la categoría más lenta de las ~24
// que se cargan en paralelo, esa cadena secuencial era justo lo que hacía sentir lento
// el ingreso al programa a medida que las tablas fueron creciendo esta sesión.
async function _fetchPaginado(urlBase){
  const sep=urlBase.includes('?')?'&':'?';
  try{
    const r0=await fetch(`${urlBase}${sep}offset=0&limit=${_PASO_PAGINA}`,{
      headers:Object.assign({},_sbHeaders(),{'Prefer':'count=exact'})
    });
    if(!r0.ok)return _fetchPaginadoSecuencial(urlBase);
    const filas0=await r0.json();
    if(!Array.isArray(filas0))return _fetchPaginadoSecuencial(urlBase);
    if(filas0.length<_PASO_PAGINA)return filas0; // cupo entero en la primera página
    const cr=r0.headers.get('content-range')||''; // "0-499/3372"
    const total=parseInt(cr.split('/')[1],10);
    if(!total||isNaN(total))return _fetchPaginadoSecuencial(urlBase); // sin conteo -> no se puede paralelizar seguro
    const totalPaginas=Math.ceil(total/_PASO_PAGINA);
    if(totalPaginas<=1)return filas0;
    const pedidos=[];
    for(let p=1;p<totalPaginas;p++){
      const desde=p*_PASO_PAGINA;
      pedidos.push(fetch(`${urlBase}${sep}offset=${desde}&limit=${_PASO_PAGINA}`,{headers:_sbHeaders()})
        .then(function(rt){if(!rt.ok)throw new Error('página '+p+' falló');return rt.json();}));
    }
    const resto=await Promise.all(pedidos);
    let todas=filas0.slice();
    for(const filas of resto){if(!Array.isArray(filas))return _fetchPaginadoSecuencial(urlBase);todas=todas.concat(filas);}
    return todas;
  }catch(e){
    return _fetchPaginadoSecuencial(urlBase);
  }
}

// Trae el estado actual y completo de UNA categoría de TABLA_REAL desde Supabase.
// Reusado por la carga inicial (_sbLoadHeavy) y por el chequeo de conflicto de
// _syncTablaGenerica (ver más abajo) — mismo shape de fila en ambos casos.
async function _refetchTablaReal(k){
  return _conReintento(function(){return _refetchTablaRealUnIntento(k);});
}
async function _refetchTablaRealUnIntento(k){
  if(!_sbOk())return null;
  const cfg=TABLA_REAL[k];
  if(!cfg)return null;
  try{
    const c=_sbCfg();
    const cols=(cfg.clave==='_id'?['id']:[]).concat(cfg.cols).join(',');
    const filas=await _fetchPaginado(`${c.url}/rest/v1/${cfg.tabla}?select=${cols}&order=created_at.asc,${cfg.claveDb}.asc`);
    if(!filas)return null;
    return filas.map(function(f){
      const obj={};
      cfg.cols.forEach(function(col){obj[col]=f[col];});
      if(cfg.clave==='_id')obj._id=f.id;else obj[cfg.clave]=f[cfg.claveDb];
      return obj;
    });
  }catch(e){return null;}
}

// Trae el objeto anidado sigla->vencTipo->{...} completo desde Supabase. Reusado por
// la carga inicial y por el chequeo de conflicto de _syncVencimientos.
async function _refetchVencimientos(){
  return _conReintento(_refetchVencimientosUnIntento);
}
async function _refetchVencimientosUnIntento(){
  if(!_sbOk())return null;
  try{
    const c=_sbCfg();
    const filas=await _fetchPaginado(`${c.url}/rest/v1/vencimientos?select=sigla,vencTipo,obs,ultima,proxima,periodicidadMeses&order=sigla.asc,vencTipo.asc`);
    if(!filas)return null;
    const obj={};
    filas.forEach(function(f){
      if(!obj[f.sigla])obj[f.sigla]={};
      obj[f.sigla][f.vencTipo]={obs:f.obs,ultima:f.ultima,proxima:f.proxima,periodicidadMeses:f.periodicidadMeses};
    });
    return obj;
  }catch(e){return null;}
}

// Trae el valor actual de UN singleton (config, tarifa_hh, metas, etc.) más su
// updated_at — este último es lo que usa el chequeo de conflicto de _syncSingleton,
// ya que un singleton siempre tiene una sola fila (no hay ids que comparar).
async function _refetchSingleton(k){
  return _conReintento(function(){return _refetchSingletonUnIntento(k);});
}
async function _refetchSingletonUnIntento(k){
  if(!_sbOk())return null;
  const cfgS=TABLA_SINGLETON[k];
  if(!cfgS)return null;
  try{
    const c=_sbCfg();
    const rs=await fetch(`${c.url}/rest/v1/${cfgS.tabla}?select=*&limit=1`,{headers:_sbHeaders()});
    if(!rs.ok)return null;
    const filas=await rs.json();
    if(!Array.isArray(filas)||!filas.length)return null;
    const f=filas[0];
    let valor;
    if(cfgS.modo==='objeto'){valor={};cfgS.cols.forEach(function(col){valor[col]=f[col];});}
    else if(cfgS.modo==='valor')valor=f.valor;
    else valor=f.datos;
    return{valor:valor,updatedAt:f.updated_at||null};
  }catch(e){return null;}
}

// Carga TODAS las claves desde Supabase al arrancar
window._sbLoadHeavy=async function(){
  if(!_sbOk())return false;
  try{
    const c=_sbCfg();
    // 1. kv: todavía sostiene las claves internas (banderas de migración, etc.)
    const r=await fetch(`${c.url}/rest/v1/kv?select=key,value&limit=200`,{headers:_sbHeaders()});
    if(!r.ok)return false;
    const rows=await r.json();
    if(!Array.isArray(rows))return false;
    rows.forEach(row=>{try{_sbCache[row.key]=row.value;}catch{}});
    _sbReady=true;

    // 2-4. Tablas reales, vencimientos y singletons: todo en paralelo (no en serie),
    // para no sumar segundos de espera al arranque por cada tabla nueva.
    const tareas=[];
    // Categorías que, pese a los 3 reintentos de _conReintento, no lograron traer datos
    // frescos — en ese caso _sbCache[kk] queda con lo que haya quedado del paso 1 (kv),
    // que para categorías ya migradas a tabla real puede ser una foto vieja congelada
    // (bug real encontrado: kv.neuMed tenía 1053 filas viejas contra 1830 reales en
    // neumaticos_mediciones — sin este aviso, la app mostraba esa foto vieja sin ningún
    // indicio de que el refresco había fallado).
    const _categoriasSinRefrescar=[];

    for(const k in TABLA_REAL){
      tareas.push((async function(kk){
        try{
          const filas=await _refetchTablaReal(kk);
          if(filas)_sbCache[kk]=filas;else _categoriasSinRefrescar.push(kk);
        }catch(e){_categoriasSinRefrescar.push(kk);}
      })(k));
    }

    tareas.push((async function(){
      try{
        const obj=await _refetchVencimientos();
        if(obj)_sbCache['venc']=obj;else _categoriasSinRefrescar.push('venc');
      }catch(e){_categoriasSinRefrescar.push('venc');}
    })());

    for(const k in TABLA_SINGLETON){
      tareas.push((async function(kk){
        try{
          const r=await _refetchSingleton(kk);
          if(r){_sbCache[kk]=r.valor;_sbSingletonUpdatedAt[kk]=r.updatedAt;}else _categoriasSinRefrescar.push(kk);
        }catch(e){_categoriasSinRefrescar.push(kk);}
      })(k));
    }

    await Promise.all(tareas);
    if(_categoriasSinRefrescar.length&&typeof toast==='function'){
      toast('⚠️ No se pudo refrescar: '+_categoriasSinRefrescar.join(', ')+'. Datos posiblemente desactualizados — recarga de nuevo.');
    }
    if(_categoriasSinRefrescar.length)console.warn('_sbLoadHeavy: categorías no refrescadas tras reintentos, usando datos previos (posiblemente viejos):',_categoriasSinRefrescar);
    return true;
  }catch{return false;}
};

// Cola por categoría: si esta misma pestaña dispara dos guardados casi juntos
// (dos onchange seguidos), el segundo espera a que el primero termine su chequeo
// de conflicto + escritura antes de arrancar el suyo. Sin esto, el chequeo de
// conflicto de abajo podía dispararse en falso contra el propio guardado anterior
// de la misma pestaña, todavía en vuelo.
const _syncChain={};
function _chained(key,fn){
  const prev=_syncChain[key]||Promise.resolve();
  const next=prev.then(fn).catch(function(){});
  _syncChain[key]=next;
  return next;
}

// Chequeo de edición concurrente compartido por las 3 formas de guardar que hay
// (tabla con arreglo de filas, vencimientos con clave compuesta, singleton con una
// sola fila) — antes cada una tenía su propia copia de este mismo mecanismo, y la
// duplicación se desincronizó de verdad (2 de las 3 copias no persistían en
// localStorage al refrescar, y solo 1 de las 3 sabía saltarse el chequeo cuando
// nunca se conoció una línea base). Compara `huellaAntes` (lo que esta pestaña
// creía que había antes de este guardado) contra `huellaActual()` (una consulta
// liviana al servidor, ahora mismo) usando `sonIguales`. Si difieren: refresca la
// categoría con `refrescar()`, avisa, refresca pantalla, y devuelve true — el
// llamador debe abortar el guardado sin escribir nada. huellaAntes===undefined
// (nunca se cargó esta categoría todavía) no bloquea: sin línea base real no hay
// nada que comparar, y tratarlo como "vacío antes" dispararía un falso conflicto
// contra cualquier categoría que ya tenga datos en el servidor.
async function _chequearConflicto(huellaAntes,huellaActual,sonIguales,refrescar,mensaje){
  if(huellaAntes===undefined)return false;
  try{
    const actual=await huellaActual();
    if(actual===undefined)return false; // el chequeo en sí falló, no bloquear
    if(sonIguales(huellaAntes,actual))return false;
    await refrescar();
    if(typeof toast==='function')toast(mensaje);
    if(typeof refreshAll==='function')refreshAll();
    return true;
  }catch(e){return false;}
}
const _sonIgualesIds=function(a,b){return !hayConflictoIds(a,b);};

function _syncTablaGenerica(cfg,arrNuevo,arrAnterior,catKey){
  return _chained(catKey,function(){return _syncTablaGenericaInner(cfg,arrNuevo,arrAnterior,catKey);});
}

// Sincroniza un arreglo completo contra una tabla real: un solo upsert (INSERT/UPDATE
// por conflicto de clave) más un DELETE por cada fila que ya no está en el arreglo nuevo.
// El upsert por conflicto SÍ dispara el trigger BEFORE UPDATE (a diferencia de "borrar
// todo y reinsertar"), que es lo que hace que el candado de columnas protegidas funcione.
async function _syncTablaGenericaInner(cfg,arrNuevo,arrAnterior,catKey){
  if(!_sbOk())return;
  const c=_sbCfg();

  const conflicto=await _chequearConflicto(
    catKey&&arrAnterior?new Set(arrAnterior.map(function(o){return o&&o[cfg.clave];}).filter(function(v){return v!=null;})):undefined,
    async function(){
      // Paginado por la misma razón que _refetchTablaReal: sin esto, en una tabla que
      // ya pasó el tope de filas de Supabase esta consulta siempre traía MENOS ids de
      // los que realmente existen, y hayConflictoIds() lo marcaba como "conflicto" en
      // cualquier guardado — un falso positivo constante para tablas grandes.
      const filasServidor=await _fetchPaginado(`${c.url}/rest/v1/${cfg.tabla}?select=${cfg.claveDb}&order=${cfg.claveDb}.asc`);
      if(!filasServidor)return undefined;
      return new Set(filasServidor.map(function(f){return f[cfg.claveDb];}));
    },
    _sonIgualesIds,
    async function(){
      const fresco=await _refetchTablaReal(catKey);
      if(fresco){
        _sbCache[catKey]=fresco;
        try{localStorage.setItem(K+catKey,JSON.stringify(_recorteParaLocal(catKey,fresco)));}catch(e){}
      }
    },
    '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> Otra persona modificó estos datos mientras trabajabas — se actualizó la pantalla con lo más reciente. Tu cambio NO se guardó, revísalo y vuelve a intentar.'
  );
  if(conflicto)return;

  const idsAnteriores=new Set((arrAnterior||[]).map(function(o){return o&&o[cfg.clave];}).filter(function(v){return v!=null;}));
  const idsNuevos=new Set();
  const filas=[];
  for(const obj of (arrNuevo||[])){
    // Autogenerar la clave cuando la columna real es un id generado (no una clave
    // natural como 'sigla' en equipos) y el objeto todavía no la trae — bug real
    // encontrado hoy: saveNeu() nunca ponía 'id' en los neumáticos nuevos, así que
    // caían en el 'continue' de abajo y nunca llegaban a la base, sin ningún aviso
    // ni error visible (parecía guardado en pantalla, nunca se sincronizaba).
    if(cfg.claveDb==='id'&&obj[cfg.clave]==null)obj[cfg.clave]=_uuidV4();
    const claveVal=obj[cfg.clave];
    if(claveVal==null){console.error('_syncTablaGenericaInner: fila sin clave, se saltó sin guardar',cfg.tabla,obj);continue;}
    idsNuevos.add(claveVal);
    // '' -> null: Postgres rechaza "" para columnas de fecha/número (400 "invalid
    // input syntax"), y muchos equipos/registros reales traen fechaCompra, etc. en
    // blanco. Antes fallaba en silencio (ver fix de _avisarErrorGuardado); ahora
    // que se avisa el error, hay que evitarlo de raíz.
    const fila={};cfg.cols.forEach(function(col){var v=obj[col];fila[col]=(v===''?null:v)??null;});
    fila[cfg.claveDb]=claveVal;
    filas.push(fila);
  }
  if(filas.length){
    await fetch(`${c.url}/rest/v1/${cfg.tabla}?on_conflict=${cfg.claveDb}`,{
      method:'POST',headers:Object.assign(_sbHeaders(),{'Prefer':'resolution=merge-duplicates'}),body:JSON.stringify(filas)
    }).then(async function(res){
      if(!res.ok)_avisarErrorGuardado(cfg.tabla,await res.text().catch(function(){return''}));
    }).catch(function(){_avisarErrorGuardado(cfg.tabla,'')});
  }
  for(const idViejo of idsAnteriores){
    if(!idsNuevos.has(idViejo)){
      await fetch(`${c.url}/rest/v1/${cfg.tabla}?${cfg.claveDb}=eq.${encodeURIComponent(idViejo)}`,{method:'DELETE',headers:_sbHeaders()})
        .then(async function(res){if(!res.ok)_avisarErrorGuardado(cfg.tabla,await res.text().catch(function(){return''}));})
        .catch(function(){_avisarErrorGuardado(cfg.tabla,'')});
    }
  }
}
// El fetch a Supabase "tiene éxito" (no lanza excepción) aunque RLS o un trigger
// rechacen la operación con 4xx/5xx — sin esto, el usuario ve "✅ Guardado" en
// pantalla aunque el cambio nunca haya llegado a la base real.
function _avisarErrorGuardado(tabla,detalleServidor){
  var msg='⚠️ No se pudo guardar en la nube ('+tabla+')';
  if(/admin/i.test(detalleServidor))msg='<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="8"/><line x1="4.5" y1="15.5" x2="15.5" y2="4.5"/></svg> Ese cambio requiere permisos de administrador — no se guardó';
  if(typeof toast==='function')toast(msg);
  console.error('Error guardando en Supabase:',tabla,detalleServidor);
  // "row-level security policy" (sin mención a admin) casi siempre es sesión vencida,
  // no un problema de permisos por rol — un toast de 2.5s se pierde fácil si el
  // usuario sigue trabajando, y cada guardado siguiente vuelve a fallar en silencio
  // hasta que se da cuenta mucho después (ver caso real: neumático que nunca llegó
  // a la base y se reintentó varias veces sin que nada quedara guardado). Se intenta
  // refrescar la sesión sola; si tampoco funciona, se fuerza el login para no seguir
  // trabajando contra una sesión muerta.
  if(/row-level security/i.test(detalleServidor)&&!/admin/i.test(detalleServidor)){
    _sbAuthRefresh().then(function(ok){
      if(!ok&&typeof _mostrarLoginOverlay==='function'){
        _mostrarLoginOverlay('Tu sesión venció y los últimos cambios no se guardaron. Vuelve a iniciar sesión.');
      }
    });
  }
}

// Vencimientos: aplana el objeto anidado y hace upsert por (sigla,vencTipo).
function _idsVenc(obj){
  const ids=[];
  for(const sigla in (obj||{})){for(const vencTipo in obj[sigla]){ids.push(sigla+'|'+vencTipo);}}
  return ids;
}
function _syncVencimientos(obj,objAnterior){
  return _chained('venc',function(){return _syncVencimientosInner(obj,objAnterior);});
}
async function _syncVencimientosInner(obj,objAnterior){
  if(!_sbOk())return;
  const c=_sbCfg();

  const conflicto=await _chequearConflicto(
    objAnterior!==undefined?_idsVenc(objAnterior):undefined,
    async function(){
      const rc=await fetch(`${c.url}/rest/v1/vencimientos?select=sigla,vencTipo`,{headers:_sbHeaders()});
      if(!rc.ok)return undefined;
      const filasServidor=await rc.json();
      if(!Array.isArray(filasServidor))return undefined;
      return filasServidor.map(function(f){return f.sigla+'|'+f.vencTipo;});
    },
    _sonIgualesIds,
    async function(){
      const fresco=await _refetchVencimientos();
      if(fresco){
        _sbCache['venc']=fresco;
        try{localStorage.setItem(K+'venc',JSON.stringify(_recorteParaLocal('venc',fresco)));}catch(e){}
      }
    },
    '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> Otra persona modificó vencimientos mientras trabajabas — se actualizó la pantalla con lo más reciente. Tu cambio NO se guardó, revísalo y vuelve a intentar.'
  );
  if(conflicto)return;

  const filas=[];
  for(const sigla in (obj||{})){
    for(const vencTipo in obj[sigla]){
      const d=obj[sigla][vencTipo]||{};
      filas.push({sigla:sigla,vencTipo:vencTipo,obs:d.obs??null,ultima:d.ultima||null,proxima:d.proxima||null,periodicidadMeses:d.periodicidadMeses??null});
    }
  }
  if(!filas.length)return;
  await fetch(`${c.url}/rest/v1/vencimientos?on_conflict=sigla,vencTipo`,{
    method:'POST',headers:Object.assign(_sbHeaders(),{'Prefer':'resolution=merge-duplicates'}),body:JSON.stringify(filas)
  }).then(async function(res){
    if(!res.ok)_avisarErrorGuardado('vencimientos',await res.text().catch(function(){return''}));
  }).catch(function(){_avisarErrorGuardado('vencimientos','')});
}

// Singleton: siempre la misma fila (id=true). No hay ids que comparar (una sola
// fila), así que el chequeo de conflicto usa updated_at en vez de un set de ids.
function _syncSingleton(cfgS,v,catKey){
  return _chained(catKey,function(){return _syncSingletonInner(cfgS,v,catKey);});
}
async function _syncSingletonInner(cfgS,v,catKey){
  if(!_sbOk())return;
  const c=_sbCfg();

  const conflicto=await _chequearConflicto(
    catKey?_sbSingletonUpdatedAt[catKey]:undefined,
    async function(){
      const rc=await fetch(`${c.url}/rest/v1/${cfgS.tabla}?select=updated_at&limit=1`,{headers:_sbHeaders()});
      if(!rc.ok)return undefined;
      const filasServidor=await rc.json();
      // Fila ausente (alguien la borró a mano en Supabase, fuera de la app —
      // nunca pasa por flujo normal) -> undefined a propósito, no null: null
      // dispararía "conflicto", _refetchSingleton también devolvería null (no
      // hay fila que traer), y _sbSingletonUpdatedAt nunca se actualizaría —
      // todo guardado futuro quedaría bloqueado en el mismo conflicto sin
      // forma de salir desde la propia app. undefined deja que el guardado
      // normal siga, recreando la fila vía upsert (auto-reparación).
      return Array.isArray(filasServidor)&&filasServidor.length?(filasServidor[0].updated_at||null):undefined;
    },
    function(a,b){return a===b;},
    async function(){
      const fresco=await _refetchSingleton(catKey);
      if(fresco){
        _sbCache[catKey]=fresco.valor;
        _sbSingletonUpdatedAt[catKey]=fresco.updatedAt;
        try{localStorage.setItem(K+catKey,JSON.stringify(fresco.valor));}catch(e){}
      }
    },
    '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> Otra persona modificó esta configuración mientras trabajabas — se actualizó la pantalla con lo más reciente. Tu cambio NO se guardó, revísalo y vuelve a intentar.'
  );
  if(conflicto)return;

  let body;
  if(cfgS.modo==='objeto'){body={id:true};cfgS.cols.forEach(function(col){var cv=v&&v[col];body[col]=(cv===''?null:cv)??null;});}
  else if(cfgS.modo==='valor')body={id:true,valor:v};
  else body={id:true,datos:v};
  await fetch(`${c.url}/rest/v1/${cfgS.tabla}?on_conflict=id`,{
    method:'POST',headers:Object.assign(_sbHeaders(),{'Prefer':'resolution=merge-duplicates,return=representation'}),body:JSON.stringify([body])
  }).then(async function(res){
    if(!res.ok){_avisarErrorGuardado(cfgS.tabla,await res.text().catch(function(){return''}));return;}
    if(!catKey)return;
    // Guardado propio aceptado: el updated_at nuevo sale de la MISMA respuesta del
    // POST (return=representation), no de una consulta separada después — así no
    // hay ventana entre "escribí" y "pregunto qué quedó" donde otra pestaña pueda
    // escribir en el medio y que esta pestaña adopte por error un updated_at ajeno
    // (eso haría que su propio próximo guardado pase el chequeo y pise ese cambio).
    try{
      const filas=await res.json();
      if(Array.isArray(filas)&&filas.length)_sbSingletonUpdatedAt[catKey]=filas[0].updated_at||null;
    }catch(e){}
  }).catch(function(){_avisarErrorGuardado(cfgS.tabla,'')});
}

// Escribe una clave en Supabase (fire-and-forget)
// Si no hay internet: el valor ya está en localStorage, se marca pendiente para sync
function _sbWrite(k,v){
  if(!_sbOk())return;
  const c=_sbCfg();
  const now=new Date().toISOString();
  fetch(`${c.url}/rest/v1/kv?on_conflict=key`,{
    method:'POST',
    headers:Object.assign(_sbHeaders(),{'Prefer':'resolution=merge-duplicates'}),
    body:JSON.stringify([{key:k,value:v,updated_at:now}])
  }).then(async function(res){
    if(!res.ok)_avisarErrorGuardado('kv/'+k,await res.text().catch(function(){return''}));
  }).catch(()=>{
    try{
      const pending=JSON.parse(localStorage.getItem(K+'_pending')||'[]');
      if(!pending.includes(k))pending.push(k);
      localStorage.setItem(K+'_pending',JSON.stringify(pending));
    }catch{}
  });
}

// Sincroniza claves pendientes cuando vuelve la conexión
window._sbSyncPending=async function(){
  if(!_sbOk())return;
  try{
    const pending=JSON.parse(localStorage.getItem(K+'_pending')||'[]');
    if(!pending.length)return;
    for(const k of pending){const v=_sbCache[k];if(v!==undefined)_sbWrite(k,v);}
    localStorage.removeItem(K+'_pending');
  }catch{}
};
window.addEventListener('online',function(){setTimeout(window._sbSyncPending,2000);});

// Sincroniza esta pestaña cuando OTRA pestaña/ventana del mismo navegador
// modifica localStorage (el evento 'storage' nunca llega a la pestaña que
// hizo el cambio, solo a las demás — por eso no genera un loop).
window.addEventListener('storage',function(e){
  if(!e.key||e.key.indexOf(K)!==0)return;
  var k=e.key.slice(K.length);
  if(k==='_pending')return;
  try{_sbCache[k]=e.newValue!=null?JSON.parse(e.newValue):null;}catch{}
  if(typeof refreshAll==='function')refreshAll();
});

// Categorías que crecen sin límite con el uso normal del sistema (se alimentan solas
// en cada PM/correctivo/medición) y sí tienen un campo de fecha para ordenar por
// antigüedad. El resto (equipos, pautas, stock, config...) no crece así, no hace
// falta recortarlo. Guardamos como máximo las N filas más recientes en localStorage
// — Supabase siempre tiene el historial completo real; esto es solo el respaldo
// offline del navegador, así que perder las filas más viejas ahí no pierde nada.
const _CATEGORIAS_CRECIENTES={hist:'fecha',ot:'fecha',reg:'fechaEntrada',mov:'fecha',
  neuMed:'fecha',aceite:'fecha',insp:'fecha',informesFalla:'fecha',progDia:'fecha'};
const _TOPE_FILAS_LOCAL=1200;
function _recorteParaLocal(k,v){
  var campo=_CATEGORIAS_CRECIENTES[k];
  if(!campo||!Array.isArray(v)||v.length<=_TOPE_FILAS_LOCAL)return v;
  return v.slice().sort(function(a,b){return(b[campo]||'').localeCompare(a[campo]||'');}).slice(0,_TOPE_FILAS_LOCAL);
}

const S={
  g(k){
    // 1. Cache en memoria (más rápido, siempre actualizado en runtime)
    // Copia superficial del ARREGLO (no de cada fila) — bug real encontrado hoy:
    // devolver la misma referencia que _sbCache[k] hacía que el patrón normalísimo
    // "const arr=S.g(k); arr.push(nuevo); S.s(k,arr);" mutara _sbCache[k] en el
    // PUSH, antes de llegar a S.s(). Ahí, S.s() captura `_anterior=_sbCache[k]`
    // para el chequeo de edición concurrente — pero como ya estaba mutado, huellaAntes
    // terminaba teniendo la fila nueva incluida, un elemento MÁS que lo que de verdad
    // había en el servidor. hayConflictoIds() compara tamaños de conjunto de ids y
    // por eso SIEMPRE detectaba "conflicto" al agregar cualquier fila nueva a
    // cualquier categoría — no era una sesión vencida ni otra persona editando, era
    // este mismo guardado comparándose contra una copia de sí mismo ya modificada.
    // La copia es superficial a propósito: los objetos-fila siguen siendo las MISMAS
    // referencias, así que "S.g(k)[i].campo=x; S.s(k,arr);" (edición in-place) sigue
    // funcionando exactamente igual que antes.
    // 'venc' es el mismo bug de arriba pero en un objeto anidado (sigla -> vencTipo ->
    // {...}), no un arreglo, así que Array.isArray(v) nunca lo capturaba. Bug real
    // reportado: registrar la PRIMERA fecha de un vencimiento nunca antes guardado
    // (ej. Sistema AFEX de un Cargador) mutaba _sbCache['venc'] en el momento mismo de
    // edVenc() crear 'venc[sigla]={}' o 'venc[sigla][vencTipo]={}' — antes de llegar a
    // S.s(), que captura _anterior=_sbCache['venc'] para el chequeo de conflicto. Con
    // el combo nuevo ya "presente" en _anterior pero todavía sin guardar en el
    // servidor, el chequeo comparaba el conjunto de ids contra sí mismo adulterado y
    // SIEMPRE veía "otra persona modificó esto" — sin que nadie más hubiera tocado
    // nada. Copia de 2 niveles (contenedor + por-equipo) para que crear un sigla o un
    // vencTipo nuevos no toque el objeto cacheado hasta que S.s() lo confirme.
    if(k in _sbCache){
      const v=_sbCache[k];
      if(Array.isArray(v))return v.slice();
      if(k==='venc'&&v&&typeof v==='object'){
        const copia={};
        for(const sigla in v)copia[sigla]=Object.assign({},v[sigla]);
        return copia;
      }
      return v;
    }
    // 2. Fallback offline: localStorage
    try{const v=JSON.parse(localStorage.getItem(K+k));if(v!==null)return v;}catch{}
    // 3. Defaults para claves conocidas
    if(k==='pau')return INIT.pautas;
    if(['hist','ot','mov','planSem','planSemHist'].includes(k))return[];
    return null;
  },
  s(k,v){
    // Fase B: si esta clave ya vive en una tabla real (o venc/singleton), se
    // necesita el estado anterior (capturado ANTES de sobreescribir la cache) para
    // poder diferenciar filas nuevas/editadas/borradas al sincronizar, y para el
    // chequeo de edición concurrente de cada sync (ver _syncTablaGenericaInner).
    const _anterior=(TABLA_REAL[k]||k==='venc'||TABLA_SINGLETON[k])?_sbCache[k]:null;
    // 1. Cache en memoria (sincrónico) — SIEMPRE completa, nunca recortada. Todo lo
    // que ve/usa la app en la sesión sale de acá, no de localStorage.
    _sbCache[k]=v;
    // 2. localStorage como cache offline — recortada para las categorías que crecen
    // sin límite (ver _recorteParaLocal). Supabase (paso 3, más abajo) siempre recibe
    // el arreglo 'v' COMPLETO tal cual — este recorte es solo para no pegarle al tope
    // de ~5MB del navegador; el historial completo real vive en la nube, nunca acá.
    try{localStorage.setItem(K+k,JSON.stringify(_recorteParaLocal(k,v)));}catch(e){
      if(e.name==='QuotaExceededError'||e.code===22||e.code===1014){
        try{['gantt','avanceData','metas','changelog'].forEach(ck=>{if(ck!==k)localStorage.removeItem(K+ck);});localStorage.setItem(K+k,JSON.stringify(v));}
        catch{console.warn('localStorage lleno, clave',k,'solo en memoria y Supabase');}
      }else{console.error('Error guardando en localStorage',k,e);}
    }
    // 3. Supabase (asíncrono, no bloquea la UI)
    if(TABLA_REAL[k]){
      _syncTablaGenerica(TABLA_REAL[k],v,_anterior,k);
      _logChangeGenerico(k,_anterior,v);
    }else if(k==='venc'){
      _syncVencimientos(v,_anterior);
    }else if(TABLA_SINGLETON[k]){
      _syncSingleton(TABLA_SINGLETON[k],v,k);
    }else{
      _sbWrite(k,v);
    }
    if(window._autoSaveMark)window._autoSaveMark();
    return true;
  },
  init(){if(!this.g('eq')){this.s('eq',INIT.equipos);this.s('reg',INIT.registros);this.s('lub',INIT.lubricantes);this.s('fil',INIT.filtrosMaestro);this.s('stk',INIT.stockFiltros);this.s('al',INIT.alertas);/* pautas in INIT */
this.s('prg',INIT.programa);this.s('hh',INIT.tarifaHH);this.s('hist',[]);}
  if((this.g('reg')||[]).length<INIT.registros.length||!this.g('reg_v2')){{this.s('reg',INIT.registros);this.s('reg_v2',true);}
  if(!this.g('eq_v8')){this.s('eq',INIT.equipos);this.s('eq_v8',true);}
  if(!this.g('eq_v9')){
    // Actualizar horómetros reales de camionetas y bus (julio 2026)
    var eqAct=this.g('eq')||[];
    var hUpd={'CA-9927':67305,'CA-6146':55581,'CA-5979':114681,'CA-10505':2500,'CA-10506':2560,'BS-5752':409000};
    var changed=false;
    eqAct.forEach(function(e){if(hUpd[e.sigla]!==undefined&&e.horomActual!==hUpd[e.sigla]){e.horomActual=hUpd[e.sigla];e.fechaHorom='2026-07-07';changed=true;}});
    if(changed)this.s('eq',eqAct);
    this.s('eq_v9',true);
  }
  if(INIT.historial&&!this.g('hist_v6')){this.s('hist',INIT.historial);this.s('hist_v6',true);}}
  if(!this.g('ot'))this.s('ot',[]);
  if(!this.g('neu'))this.s('neu',INIT.neumaticos||[]);
  if(!this.g('planSem'))this.s('planSem',[]);
  if(!this.g('compMayores'))this.s('compMayores',[]);
  if(!this.g('dispCalc'))this.s('dispCalc',{});
  if(!this.g('dispMeta'))this.s('dispMeta',85);
  if(!this.g('avanceData'))this.s('avanceData',{});
  if(!this.g('metas'))this.s('metas',{});
  if(!this.g('gantt'))this.s('gantt',[]);
  if(!this.g('destrabe'))this.s('destrabe',[]);
  if(!this.g('changelog'))this.s('changelog',[]);
  if(!this.g('aceite'))this.s('aceite',[]);
  if(!this.g('insp'))this.s('insp',[]);
  if(!this.g('repuestos'))this.s('repuestos',[]);
  if(!this.g('ordenes'))this.s('ordenes',[]);
  if(!this.g('cfg'))this.s('cfg',{empresa:'Besalco Minería S.A',faena:'Centinela Ripios OXE',meta:85});
  }
};
