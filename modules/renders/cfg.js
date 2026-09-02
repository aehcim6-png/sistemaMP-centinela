// ═══════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN — Administración del Sistema
// ═══════════════════════════════════════════════════════════════════════
// window.renderCfg + toda la UI exclusiva de esta pestaña: códigos QR por
// equipo, refresco de estado MFA + activación/desactivación de verificación
// en dos pasos, reset de datos (resetAll/resetEmpresa/processResetEmpresa),
// plantilla limpia para otra empresa, acciones de la tarjeta de sync en la
// nube (probar conexión/guardar config — cloudPush/cloudPull/el motor de
// sync automático quedan compartidos, ver abajo), parámetros de neumáticos,
// export de movimientos a CSV, backup manual (exportAllJSON/importAllJSON),
// el Reporte Ejecutivo Excel, accesos recientes y la gestión de usuarios
// (crear/activar/desactivar, vía la Edge Function crear-operador).
//
// Quedan COMPARTIDOS en index.html a propósito, todo por estar entrelazado
// con infraestructura global que corre sin importar qué pestaña esté abierta:
// - applyTheme (el arranque del sistema también lo llama para aplicar el
//   tema guardado), exportTabla/imprimirTab (barra de exportación de TODAS
//   las pestañas), computePred/_cadenaPMEnHorizonte (Predictivo/Plan Semanal),
//   diagVinculos/aplicarFixVinculo (compartido con Lubricantes/Planificador),
//   mesesAutomaticos (Avance/Gantt/Programación Diaria), _logChange/
//   _logChangeGenerico, FOTOS_BUCKET/comprimirImagen/_subirArchivoBucket
//   (Informes de Falla/Vencimientos/Correctivos), syncEquipos/_syncSiCambio.
// - El motor de autoguardado a carpeta local (conectarCarpeta/
//   desconectarCarpeta/_asWrite/_autoSaveMark/AUTOSAVE_KEYS) — conectarCarpeta
//   /desconectarCarpeta tocan una variable de módulo (_asHandle) compartida
//   por closure con _asWrite y el listener beforeunload; separarlas de ese
//   motor requeriría exponerla como global, mayor riesgo que beneficio.
// - El motor de sync a la nube (cloudPush/cloudPull/_clCfg/_clOk/_clStatus/
//   _clHeaders y el IIFE _clInit) — cloudPush corre automático en cada
//   guardado (enganchado a _autoSaveMark con debounce de 8s) y cloudPull se
//   ofrece solo al abrir el sistema (_clInit), no solo desde el botón de
//   Configuración — es el motor de sincronización real, mismo que el plan
//   deja para el final junto con S/_sbCache.
// - Los helpers de bajo nivel de MFA (_mfaEnroll/_mfaChallenge/_mfaVerify/
//   _mfaUnenroll) — _mfaChallenge/_mfaVerify también los usa el challenge de
//   LOGIN (_mostrarMfaChallengeUI), no solo la activación desde Configuración.
// - Todo el bootstrap de sesión/login/logout/refresh de token y el registro
//   de accesos (_getDeviceLabel, usado también por _registrarLogin en cada
//   login) — corre en el arranque del sistema, antes de que exista ninguna
//   pestaña abierta.
//
// Módulo ES real (Fase 3, 2026-08-30, novena tanda: Grupo 4 — cfg.js↔log.js,
// el único par con una referencia cruzada real: cfg.js llama verLogCambios()
// de log.js, sin equivalente en sentido contrario). El "ciclo" no es un
// problema de orden de carga: la llamada corre dentro de un onclick, en
// tiempo de ejecución (después de que TODOS los módulos ya se registraron
// en window/renders), no en tiempo de parseo — mismo razonamiento que el
// resto de los cruces entre pestañas en esta migración. Ver nota de
// migración en mov.js (primera tanda, mismo patrón).
// ═══════════════════════════════════════════════════════════════════════

// ---- CÓDIGOS QR POR EQUIPO ----
export function verCodigosQR(){
  var eq=(S.g('eq')||[]).slice().sort(function(a,b){return (a.sigla||'').localeCompare(b.sigla||'');});
  if(!eq.length)return toast('⚠️ No hay equipos cargados');
  if(typeof QRCode==='undefined')return toast('❌ No se pudo cargar el generador de QR (revisa conexión a internet)');
  var baseUrl=location.origin+location.pathname;
  sm('<div style="max-width:720px">'+
    '<h3>🔲 Códigos QR por Equipo</h3>'+
    '<p style="font-size:11px;color:var(--tx3);margin-bottom:12px">Escanéalo con el celular y abre directo la ficha de ese equipo, sin buscarlo a mano. Descárgalos e imprímelos para pegar en cada máquina.</p>'+
    '<div id="qrGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:14px;max-height:60vh;overflow-y:auto;padding:4px">'+
    eq.map(function(e){
      return '<div style="text-align:center;border:1px solid var(--bor);border-radius:8px;padding:10px">'+
        '<div id="qr-'+escapeHtml(e.sigla)+'" style="display:flex;justify-content:center;margin-bottom:6px"></div>'+
        '<div style="font-size:11px;font-weight:600;margin-bottom:4px">'+escapeHtml(e.sigla)+'</div>'+
        '<a href="#" style="font-size:10px;color:var(--ac)" onclick="event.preventDefault();_descargarQR(\''+escapeHtml(e.sigla)+'\')">⬇️ Descargar</a>'+
      '</div>';
    }).join('')+
    '</div>'+
    '<br><button class="btn btn-o" onclick="cm()">Cerrar</button>'+
  '</div>');
  setTimeout(function(){
    eq.forEach(function(e){
      var el=document.getElementById('qr-'+e.sigla);
      if(!el)return;
      el.innerHTML='';
      new QRCode(el,{text:baseUrl+'?eq='+encodeURIComponent(e.sigla),width:110,height:110,colorDark:'#000000',colorLight:'#ffffff'});
    });
  },50);
};
export function _descargarQR(sigla){
  var el=document.getElementById('qr-'+sigla);
  var canvas=el&&el.querySelector('canvas');
  if(!canvas)return toast('❌ QR no generado todavía, espera un segundo e intenta de nuevo');
  var a=document.createElement('a');
  a.href=canvas.toDataURL('image/png');
  a.download='QR_'+sigla+'.png';
  a.click();
};

// ═══ Uso de espacio local (localStorage) — una sola fuente para el medidor
// de "Mantenimiento de datos" de más abajo y la tarjeta resumen de arriba,
// en vez de calcular lo mismo dos veces en el mismo render (2026-08-28).
function _medirUsoLocal(){
  var totalBytes=0;for(var k in localStorage){if(localStorage.hasOwnProperty(k))totalBytes+=(localStorage[k].length||0)*2;}
  var limite=5*1024*1024;
  var pct=Math.min(100,totalBytes/limite*100);
  var col=pct>80?'var(--danger)':pct>50?'var(--ac)':'var(--ok)';
  return{totalBytes:totalBytes,pct:pct,col:col};
}

export function renderCfg(){
  const cfg=S.g('cfg')||{};
  $('s-cfg').innerHTML=
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="3.2"/><line x1="10" y1="2" x2="10" y2="4.2"/><line x1="10" y1="15.8" x2="10" y2="18"/><line x1="2" y1="10" x2="4.2" y2="10"/><line x1="15.8" y1="10" x2="18" y2="10"/><line x1="4.8" y1="4.8" x2="6.3" y2="6.3"/><line x1="13.7" y1="13.7" x2="15.2" y2="15.2"/><line x1="4.8" y1="15.2" x2="6.3" y2="13.7"/><line x1="13.7" y1="6.3" x2="15.2" y2="4.8"/></svg> Configuración</div>'+
    '<div class="sec-s">Administración del sistema</div></div></div>'+

    // ═══ RESUMEN DE ESTADO — todo lo de abajo, de un vistazo (2026-08-28,
    // pedido del usuario). Solo datos reales, sintéticos con lo ya cargado
    // en memoria y sin agregar ninguna llamada de red nueva — a propósito
    // NO incluye "Uso del sistema" (esa tabla vive solo en Supabase, se trae
    // on-demand para no descargarla en cada apertura de esta pestaña) ni un
    // conteo de "tests pasando" (eso no es algo que el navegador en
    // producción pueda saber realmente).
    (function(){
      var papelera=(S.g('papelera')||[]).length;
      var dataInt={eq:S.g('eq')||[],reg:S.g('reg')||[],hist:S.g('hist')||[],stk:S.g('stk')||[],repuestos:S.g('repuestos')||[],lub:S.g('lub')||[],ordenes:S.g('ordenes')||[],compMayores:S.g('compMayores')||[],dispCalc:S.g('dispCalc')||{}};
      var hallazgos=verificarIntegridad(dataInt);
      var altaCount=hallazgos.filter(function(h){return h.severidad==='alta';}).length;
      var intCol=altaCount?'var(--danger)':hallazgos.length?'var(--warn)':'var(--ok)';
      var intVal=altaCount?altaCount+' alta(s)':hallazgos.length?hallazgos.length+' media':'Sin hallazgos';
      var uso=_medirUsoLocal();
      return '<div class="cards" style="margin-bottom:16px">'+
        '<div class="card" style="border-left:4px solid '+intCol+'"><div class="card-t">🔍 Integridad</div><div class="card-v" style="font-size:16px;color:'+intCol+'">'+intVal+'</div><div class="card-s">'+hallazgos.length+' hallazgo(s) en total</div></div>'+
        '<div class="card" style="border-left:4px solid '+(papelera?'var(--ac)':'var(--ok)')+'"><div class="card-t">🗑️ Papelera</div><div class="card-v">'+papelera+'</div><div class="card-s">elemento(s), 30 días</div></div>'+
        '<div class="card" style="border-left:4px solid '+uso.col+'"><div class="card-t">💾 Datos locales</div><div class="card-v" style="font-size:16px;color:'+uso.col+'">'+uso.pct.toFixed(1)+'%</div><div class="card-s">'+(uso.totalBytes/1048576).toFixed(2)+' MB de 5 MB</div></div>'+
        '<div class="card" style="border-left:4px solid '+(window._clStatusColor||'var(--tx3)')+'"><div class="card-t">☁️ Sync nube</div><div class="card-v" style="font-size:13px">'+(window._clStatusTxt||'⚪ Sin configurar')+'</div><div class="card-s">Supabase</div></div>'+
        '<div class="card" style="border-left:4px solid '+(window._asStatusColor||'var(--tx3)')+'"><div class="card-t">📂 Backup local</div><div class="card-v" style="font-size:13px">'+(window._asStatusTxt||'⚪ Sin carpeta conectada')+'</div><div class="card-s">Carpeta autoguardado</div></div>'+
      '</div>';
    })()+

    // ACCESOS (quién entró, cuándo, desde qué navegador/equipo)
    '<div class="card" style="max-width:900px;margin-bottom:16px;border-left:3px solid #a78bfa">'+
    '<b style="font-size:14px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2 10 A9 5 0 0 1 18 10 A9 5 0 0 1 2 10 Z" fill="none"/><circle cx="10" cy="10" r="2.3"/></svg> Accesos al sistema</b>'+
    '<p style="font-size:11px;color:var(--tx3);margin:8px 0">Registro de cada inicio de sesión — útil para saber quién entró y cuándo si algo no se guardó en un computador.</p>'+
    '<button class="btn btn-o" onclick="verAccesos()">Ver accesos recientes</button>'+
    '</div>'+

    // LOG DE CAMBIOS (auditoría completa — todas las acciones, no solo login)
    '<div class="card" style="max-width:900px;margin-bottom:16px;border-left:3px solid #a78bfa">'+
    '<b style="font-size:14px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="10" height="15" rx="1.5"/><rect x="7.5" y="2" width="5" height="2.5" rx="0.8"/><line x1="7" y1="9" x2="13" y2="9"/><line x1="7" y1="12" x2="13" y2="12"/><line x1="7" y1="15" x2="11" y2="15"/></svg> Log de Cambios</b>'+
    '<p style="font-size:11px;color:var(--tx3);margin:8px 0">Auditoría completa del sistema — cada edición, creación o eliminación, no solo los inicios de sesión.</p>'+
    '<button class="btn btn-o" onclick="verLogCambios()">Ver log de cambios</button>'+
    '</div>'+

    // USO DEL SISTEMA (telemetría — qué pestañas se abren de verdad)
    '<div class="card" style="max-width:900px;margin-bottom:16px;border-left:3px solid #a78bfa">'+
    '<b style="font-size:14px">📊 Uso del sistema</b>'+
    '<p style="font-size:11px;color:var(--tx3);margin:8px 0">Cuántas veces se abrió cada pestaña/sub-pestaña en los últimos 7/30/90 días — para saber qué se usa de verdad antes de seguir agregando funciones nuevas. Registrado desde el 2026-08-17.</p>'+
    '<button class="btn btn-o" onclick="verUsoPestanas()">Ver uso del sistema</button>'+
    '</div>'+

    // VERIFICADOR DE INTEGRIDAD (control de gestión — datos físicamente imposibles)
    '<div class="card" style="max-width:900px;margin-bottom:16px;border-left:3px solid #14b8a6">'+
    '<b style="font-size:14px">🔍 Verificador de Integridad</b>'+
    '<p style="font-size:11px;color:var(--tx3);margin:8px 0">Revisa los datos ya guardados buscando cosas físicamente imposibles — horómetros que retroceden, stock o precios negativos, fechas invertidas, siglas duplicadas, estados desincronizados con su propio horómetro. No es un juicio de negocio ("esto me parece raro"), solo detecta errores de dato objetivos.</p>'+
    '<button class="btn" onclick="ejecutarVerificacionIntegridad()">🔍 Ejecutar verificación</button>'+
    '<div id="integridadResultado" style="margin-top:12px"></div>'+
    '</div>'+

    // PAPELERA (soft-delete con recuperación)
    '<div class="card" style="max-width:900px;margin-bottom:16px;border-left:3px solid #a78bfa">'+
    '<b style="font-size:14px">🗑️ Papelera</b>'+
    '<p style="font-size:11px;color:var(--tx3);margin:8px 0">Todo lo que se elimina en el sistema queda acá 30 días antes de borrarse para siempre — se puede recuperar en cualquier momento.</p>'+
    '<button class="btn btn-o" onclick="verPapelera()">Ver papelera</button>'+
    '</div>'+

    // MI CONTRASEÑA (vencimiento/rotación periódica, ver DIAS_VENCE_CLAVE en
    // index.html) — muestra hace cuánto no se cambia y deja cambiarla
    // voluntariamente en cualquier momento, sin tener que esperar a que el
    // sistema la obligue.
    (function(){
      var dias=(typeof _diasDesdeCambioClave==='function')?_diasDesdeCambioClave(_currentUser):null;
      var estado=dias==null
        ? 'Cámbiala periódicamente por seguridad — se pide renovarla cada '+DIAS_VENCE_CLAVE+' días.'
        : dias>=DIAS_VENCE_CLAVE
          ? '🔴 Vencida — llevas '+dias+' días con la misma contraseña.'
          : dias>=DIAS_AVISO_CLAVE
            ? '🟡 Vence pronto — llevas '+dias+' días con la misma contraseña, se renueva a los '+DIAS_VENCE_CLAVE+'.'
            : '🟢 Al día — la cambiaste hace '+dias+' día'+(dias===1?'':'s')+'.';
      return '<div class="card" style="max-width:900px;margin-bottom:16px;border-left:3px solid var(--danger)">'+
      '<b style="font-size:14px">🔑 Mi contraseña</b>'+
      '<p style="font-size:11px;color:var(--tx3);margin:8px 0">'+estado+'</p>'+
      '<button class="btn btn-o" onclick="_mostrarCambioClaveOverlay(\'voluntario\')">Cambiar mi contraseña</button>'+
      '</div>';
    })()+

    // VERIFICACIÓN EN DOS PASOS (MFA/TOTP) — estado se carga aparte, es async
    '<div class="card" style="max-width:900px;margin-bottom:16px;border-left:3px solid var(--danger)" id="mfaCard">'+
    '<b style="font-size:14px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9 V6 a3 3 0 0 1 6 0 V9" fill="none"/></svg> Verificación en dos pasos</b>'+
    '<p style="font-size:11px;color:var(--tx3);margin:8px 0">Además del usuario y la clave, pide un código de 6 dígitos que cambia cada 30 segundos (app tipo Google Authenticator). Así aunque alguien consiga tu clave, no puede entrar sin tu teléfono.</p>'+
    '<div id="mfaEstadoBox" style="font-size:12px;color:var(--tx3)">Revisando estado…</div>'+
    '</div>'+

    // AUTOGUARDADO EN LÍNEA (siempre visible)
    '<div class="card" style="max-width:900px;margin-bottom:16px;border-left:3px solid var(--ac)">'+
    '<b style="font-size:14px">☁️ Respaldo automático (en línea)</b>'+
    '<p style="font-size:11px;color:var(--tx3);margin:8px 0">Los datos viven en este navegador. Conecta una carpeta y el sistema guardará <b>SistemaMP_Datos.json</b> automáticamente a los 5 segundos de cada cambio. Si eliges una carpeta de <b>OneDrive</b> o <b>Google Drive escritorio</b>, el respaldo sube a la nube solo. Requiere Chrome o Edge.</p>'+
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'+
    '<button class="btn" onclick="conectarCarpeta()">📂 Conectar carpeta</button>'+
    '<button class="btn btn-o" onclick="desconectarCarpeta()">Desconectar</button>'+
    '<button class="btn btn-o" onclick="exportAllJSON()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Backup manual</button>'+
    '<button class="btn btn-o" onclick="importAllJSON()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Restaurar backup</button>'+
    '<span id="asStatus" style="font-size:11px;color:'+(window._asStatusColor||'var(--tx3)')+'">'+(window._asStatusTxt||'⚪ Sin carpeta conectada')+'</span>'+
    '</div></div>'+

    // PARÁMETROS NEUMÁTICOS
    (function(){const c=S.g('cfg')||{};return ''+
    '<div class="card" style="max-width:900px;margin-bottom:16px;border-left:3px solid var(--ac)">'+
    '<b style="font-size:14px"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="3"/></svg> Parámetros de Neumáticos (CAEX 27.00R49)</b>'+
    '<p style="font-size:11px;color:var(--tx3);margin:8px 0">Estos valores ajustan las proyecciones de vida y fechas de cambio. La vida útil es variable según TKPH, rutas y proveedor — ajústala a tu campaña real.</p>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">'+
    '<div><label style="font-size:10px;color:var(--tx3)">Vida útil objetivo (horas)</label><input type="number" id="neuTarget" value="'+(c.neuTargetHrs||9000)+'" style="width:100%;padding:6px;background:var(--bg3);border:1px solid var(--bd);border-radius:4px;color:var(--tx);font-size:12px"></div>'+
    '<div><label style="font-size:10px;color:var(--tx3)">Proyección mensual (horas/mes)</label><input type="number" id="neuProyMes" value="'+(c.neuProyMes||450)+'" style="width:100%;padding:6px;background:var(--bg3);border:1px solid var(--bd);border-radius:4px;color:var(--tx);font-size:12px"></div>'+
    '</div>'+
    '<div style="font-size:11px;color:var(--tx3);margin-bottom:8px"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Reglas activas: Delanteros (P1-P2) → cambio a 60mm <b>o</b> 2.000h (alerta) / 2.600h (límite), lo primero. Traseros (P3-P6) → solo remanente, retiro a 10mm o daño.</div>'+
    '<button class="btn" onclick="guardarNeuParams()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar parámetros</button>'+
    '</div>';})()+
    // ALERTAS POR CORREO — lista de destinatarios del resumen diario que ya
    // envía sola la Edge Function alerta-pm (PM urgente, stock crítico,
    // vencimientos, backlog). Antes solo se podía cambiar desde el dashboard
    // de Supabase (env var ALERTA_PM_DESTINATARIOS); ahora cualquier admin la
    // edita acá. Si queda vacío, alerta-pm sigue usando esa env var de respaldo.
    (window._userRole==='admin'?(function(){const c=S.g('cfg')||{};return ''+
    '<div class="card" style="max-width:900px;margin-bottom:16px;border-left:3px solid var(--ac)">'+
    '<b style="font-size:14px">📧 Alertas por Correo</b>'+
    '<p style="font-size:11px;color:var(--tx3);margin:8px 0">Correos que reciben el resumen diario automático (PM urgente, stock crítico, vencimientos y backlog pendiente). Separar varios con coma.</p>'+
    '<input id="cfgAlertaEmails" type="text" value="'+escapeHtml(c.alertaEmails||'')+'" placeholder="correo1@empresa.com, correo2@empresa.com" style="width:100%;padding:6px;background:var(--bg3);border:1px solid var(--bd);border-radius:4px;color:var(--tx);font-size:12px;box-sizing:border-box;margin-bottom:8px">'+
    '<button class="btn" onclick="guardarAlertaEmails()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar destinatarios</button>'+
    '</div>';})():'')+
    // ALERTAS POR WHATSAPP — mismo patrón que Alertas por Correo, pero el
    // mensaje que manda alerta-pm es un resumen corto (una línea por sección
    // con algo urgente, ej. "3 equipo(s) con PM urgente"), no las tablas
    // completas del correo — WhatsApp no es el canal para eso. Requiere que
    // la Edge Function tenga configurados los secrets de Twilio
    // (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_WHATSAPP_FROM); si no
    // están, simplemente no manda WhatsApp — el correo sigue funcionando
    // igual (no es un canal obligatorio, es adicional).
    (window._userRole==='admin'?(function(){const c=S.g('cfg')||{};return ''+
    '<div class="card" style="max-width:900px;margin-bottom:16px;border-left:3px solid #25D366">'+
    '<b style="font-size:14px">💬 Alertas por WhatsApp</b>'+
    '<p style="font-size:11px;color:var(--tx3);margin:8px 0">Números que reciben un resumen corto del mismo aviso diario (cuántos equipos con PM urgente, ítems de stock crítico, etc. — sin el detalle completo, para eso está el correo). Formato internacional con "+", separar varios con coma. Necesita Twilio configurado en Supabase (Account SID/Auth Token/número WhatsApp) — si no está, este campo no hace nada todavía.</p>'+
    '<input id="cfgAlertaWhatsApp" type="text" value="'+escapeHtml(c.alertaWhatsApp||'')+'" placeholder="+56912345678, +56987654321" style="width:100%;padding:6px;background:var(--bg3);border:1px solid var(--bd);border-radius:4px;color:var(--tx);font-size:12px;box-sizing:border-box;margin-bottom:8px">'+
    '<button class="btn" onclick="guardarAlertaWhatsApp()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar destinatarios</button>'+
    '</div>';})():'')+
    // REPORTE DE FALLAS POR WHATSAPP/CORREO (2026-08-18, a pedido del usuario) —
    // canal de ENTRADA, al revés de las 2 tarjetas de arriba (que son de salida).
    // Un técnico le escribe al número de Twilio o al correo configurado en
    // Resend ("CN-9500 fuera de servicio, falla de turbo") y las Edge Functions
    // whatsapp-webhook/email-webhook lo insertan en correctivos_historico
    // automáticamente. Esta lista es el candado de seguridad: sin un remitente
    // acá, ese canal simplemente ignora el mensaje (no inserta nada) — así
    // cualquiera que le escriba al número/correo público de Twilio/Resend no
    // puede inyectar datos falsos en la flota. Los reportes que no logran
    // identificar el equipo con confianza quedan con fuente "— revisar" y
    // aparecen en Auditoría de Datos para revisión manual, nunca se descartan
    // en silencio ni se inventa un equipo/componente.
    (window._userRole==='admin'?(function(){const c=S.g('cfg')||{};return ''+
    '<div class="card" style="max-width:900px;margin-bottom:16px;border-left:3px solid #06b6d4">'+
    '<b style="font-size:14px">📥 Reporte de Fallas por WhatsApp/Correo</b>'+
    '<p style="font-size:11px;color:var(--tx3);margin:8px 0">Quiénes pueden reportar una falla escribiéndole al número de WhatsApp o al correo del sistema (se suma directo a correctivos_historico). Sin al menos un remitente cargado acá, ese canal no acepta nada — evita que un mensaje de un número/correo desconocido termine como dato real de la flota. Formato internacional "+" para WhatsApp, separar varios con coma.</p>'+
    '<label style="font-size:10px;color:var(--tx3)">Números de WhatsApp autorizados</label>'+
    '<input id="cfgWhatsappRemitentes" type="text" value="'+escapeHtml(c.whatsappRemitentesPermitidos||'')+'" placeholder="+56912345678, +56987654321" style="width:100%;padding:6px;background:var(--bg3);border:1px solid var(--bd);border-radius:4px;color:var(--tx);font-size:12px;box-sizing:border-box;margin-bottom:8px">'+
    '<label style="font-size:10px;color:var(--tx3)">Correos autorizados</label>'+
    '<input id="cfgCorreoRemitentes" type="text" value="'+escapeHtml(c.correoRemitentesPermitidos||'')+'" placeholder="jefe.taller@besalco.cl, supervisor@besalco.cl" style="width:100%;padding:6px;background:var(--bg3);border:1px solid var(--bd);border-radius:4px;color:var(--tx);font-size:12px;box-sizing:border-box;margin-bottom:8px">'+
    '<button class="btn" onclick="guardarRemitentesPermitidos()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar remitentes</button>'+
    '</div>';})():'')+
    (function(){const c=S.g('cfg')||{};return ''+
    '<div class="card" style="max-width:900px;margin-bottom:16px;border-left:3px solid #3ecf8e">'+
    '<b style="font-size:14px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="10" cy="10" r="8"/><ellipse cx="10" cy="10" rx="3.5" ry="8"/><line x1="2" y1="10" x2="18" y2="10"/></svg> Sincronización en la nube (Supabase)</b>'+
    '<p style="font-size:11px;color:var(--tx3);margin:8px 0">Backend real: tus datos viven en una base Postgres gratuita y se sincronizan desde cualquier PC con internet. Sube automático 8s después de cada cambio; al abrir, ofrece bajar si la nube tiene datos más nuevos. <b>Guía de instalación (5 min) en la pestaña ❓ Ayuda.</b></p>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">'+
    '<div><label style="font-size:10px;color:var(--tx3)">URL del proyecto</label><input id="sbUrl" value="'+(c.sbUrl||'')+'" placeholder="https://xxxx.supabase.co" style="width:100%;padding:6px;background:var(--bg3);border:1px solid var(--bd);border-radius:4px;color:var(--tx);font-size:11px"></div>'+
    '<div><label style="font-size:10px;color:var(--tx3)">Clave anon (public)</label><input id="sbKey" type="password" value="'+(c.sbKey||'')+'" placeholder="sb_publishable_..." style="width:100%;padding:6px;background:var(--bg3);border:1px solid var(--bd);border-radius:4px;color:var(--tx);font-size:11px"></div>'+
    '</div>'+
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'+
    '<label style="font-size:11px;color:var(--tx)"><input type="checkbox" id="sbAuto" '+(c.sbAuto?'checked':'')+' onchange="cloudGuardarCfg()"> Sync automático</label>'+
    '<button class="btn btn-o" onclick="cloudGuardarCfg()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar config</button>'+
    '<button class="btn btn-o" onclick="cloudProbar()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="8" width="8" height="6" rx="1"/><line x1="8" y1="8" x2="8" y2="4"/><line x1="12" y1="8" x2="12" y2="4"/><line x1="10" y1="14" x2="10" y2="17"/></svg> Probar conexión</button>'+
    '<button class="btn" onclick="cloudPush(false)">⬆️ Subir todo</button>'+
    '<button class="btn btn-o" onclick="cloudPull(true)">⬇️ Bajar de la nube</button>'+
    '<span id="clStatus" style="font-size:11px;color:'+(window._clStatusColor||'var(--tx3)')+'">'+(window._clStatusTxt||'⚪ Sin configurar')+'</span>'+
    '</div></div>';})()+

    // MANTENIMIENTO DE DATOS (medidor localStorage — ya no hay botón de borrado real)
    (function(){
      var uso=_medirUsoLocal();
      var totalBytes=uso.totalBytes,pct=uso.pct,col=uso.col;
      return ''+
      '<div class="card" style="max-width:900px;margin-bottom:16px;border-left:3px solid '+col+'">'+
      '<b style="font-size:14px">🗄️ Mantenimiento de datos</b>'+
      '<p style="font-size:11px;color:var(--tx3);margin:8px 0">El navegador solo guarda localmente las últimas '+_TOPE_FILAS_LOCAL+' filas de las categorías que más crecen (historial de horómetros, correctivos, registros PM, movimientos de stock, mediciones de neumáticos, análisis de aceite, inspecciones, informes de falla) — es automático, no requiere ninguna acción tuya. <b>El historial completo real siempre está en Supabase, nunca se borra</b>: esto solo limita cuánto se guarda como respaldo offline en este navegador.</p>'+
      '<div style="margin:10px 0"><div style="font-size:11px;color:var(--tx2);margin-bottom:4px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Uso local: <b style="color:'+col+'">'+pct.toFixed(1)+'%</b> ('+(totalBytes/1048576).toFixed(2)+' MB de 5 MB)</div>'+
      '<div style="width:100%;background:color-mix(in srgb,'+col+' 18%,var(--bg4));height:14px;border-radius:7px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+col+';transition:width .3s"></div></div></div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">'+
      '<button class="btn btn-o" onclick="exportarMovCSV()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Exportar movimientos a CSV (respaldo, no borra nada)</button>'+
      '<button class="btn btn-o" onclick="renders.cfg()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 10 A6 6 0 0 1 15.5 6.5" fill="none"/><polyline points="15.5,3 15.5,6.5 12,6.5"/><path d="M16 10 A6 6 0 0 1 4.5 13.5" fill="none"/><polyline points="4.5,17 4.5,13.5 8,13.5"/></svg> Refrescar</button>'+
      '</div>'+
      '<div id="mtoInfo" style="margin-top:8px;font-size:11px;color:var(--tx3)"></div>'+
      '</div>';
    })()+

    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:900px">'+

      // TEMAS Y APARIENCIA
      '<div class="card"><b style="font-size:14px">🎨 Tema y Apariencia</b><br><br>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">'+
      '<button class="btn" onclick="applyTheme(\'dark\');toast(\'🌙 Tema oscuro aplicado\')" style="background:#1a1a2e;color:#fff">🌙 Oscuro</button>'+
      '<button class="btn" onclick="applyTheme(\'light\');toast(\'☀️ Tema claro aplicado\')" style="background:#f8f9fa;color:#333">☀️ Claro</button>'+
      '<button class="btn" onclick="applyTheme(\'blue\');toast(\'💎 Tema azul aplicado\')" style="background:#0a1628;color:#64b5f6">💎 Azul Minero</button>'+
      '<button class="btn" onclick="applyTheme(\'ejecutiva\');toast(\'👔 Tema Ejecutivo aplicado\')" style="background:#F8FAFC;color:#0D1B2A;border:1px solid #D1D5DB">👔 Ejecutivo</button></div>'+
      '<div style="margin-bottom:8px"><label style="font-size:11px;color:var(--tx3)">Tamaño de letra</label><br>'+
      '<select onchange="document.documentElement.style.fontSize=this.value;var c=S.g(\'cfg\')||{};c.fontSize=this.value;S.s(\'cfg\',c)" style="padding:4px;background:var(--bg3);color:var(--tx);border:1px solid var(--bd);border-radius:4px">'+
      '<option value="13px">Normal</option><option value="12px">Pequeña</option><option value="14px">Grande</option><option value="15px">Extra Grande</option></select></div>'+
      '<div style="margin-bottom:8px"><label style="font-size:11px;color:var(--tx3)">Fuente</label><br>'+
      '<select onchange="document.body.style.fontFamily=this.value;var c=S.g(\'cfg\')||{};c.fontFamily=this.value;S.s(\'cfg\',c)" style="padding:4px;background:var(--bg3);color:var(--tx);border:1px solid var(--bd);border-radius:4px">'+
      '<option value="system-ui,sans-serif">System (default)</option><option value="Arial,sans-serif">Arial</option><option value="Verdana,sans-serif">Verdana</option><option value="Courier New,monospace">Monospace</option></select></div>'+
      '<div><label style="font-size:11px;color:var(--tx3)">Color de acento</label><br>'+
      '<div style="display:flex;gap:6px;margin-top:4px">'+
      ['var(--ac)','var(--info)','var(--ok)','var(--danger)','#8b5cf6','#ec4899','#06b6d4'].map(function(c){
        return'<div onclick="document.documentElement.style.setProperty(\'--ac\',\''+c+'\');var cfg=S.g(\'cfg\')||{};cfg.colorAc=\''+c+'\';S.s(\'cfg\',cfg);toast(\'✅ Color guardado\')" style="width:24px;height:24px;border-radius:50%;background:'+c+';cursor:pointer;border:2px solid var(--bd)"></div>';
      }).join('')+'</div></div>'+
      '</div>'+

      // DATOS Y BACKUP
      '<div class="card"><b style="font-size:14px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Datos y Backup</b><br><br>'+
      '<button class="btn btn-o" style="width:100%;margin-bottom:8px" onclick="exportAllJSON()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Exportar JSON (backup completo)</button>'+
      '<button class="btn btn-o" style="width:100%;margin-bottom:8px" onclick="importAllJSON()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar JSON (restaurar backup)</button>'+
      '<hr style="border-color:var(--bd);margin:12px 0">'+
      // Reporte Ejecutivo Excel: se fusionó con el de Metas & KPIs →
      // Informes (2026-08-30) — antes había dos reportes distintos con el
      // mismo nombre, y "Urgentes" salía con un número distinto en cada
      // uno. Ver nota de consolidación en kpi.js.
      '<button class="btn btn-o" style="width:100%;margin-bottom:8px;color:var(--w)" onclick="resetAll()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 10 A6 6 0 0 1 15.5 6.5" fill="none"/><polyline points="15.5,3 15.5,6.5 12,6.5"/><path d="M16 10 A6 6 0 0 1 4.5 13.5" fill="none"/><polyline points="4.5,17 4.5,13.5 8,13.5"/></svg> Restaurar datos iniciales</button>'+
      '<button class="btn btn-o" style="width:100%;margin-bottom:8px;color:var(--danger)" onclick="resetEmpresa()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><rect x="4" y="2" width="12" height="16"/><rect x="6.3" y="4.5" width="1.8" height="1.8"/><rect x="9.1" y="4.5" width="1.8" height="1.8"/><rect x="11.9" y="4.5" width="1.8" height="1.8"/><rect x="6.3" y="8" width="1.8" height="1.8"/><rect x="9.1" y="8" width="1.8" height="1.8"/><rect x="11.9" y="8" width="1.8" height="1.8"/><rect x="8.5" y="13" width="3" height="5"/></svg> Configurar Nueva Empresa</button>'+
      '<button class="btn btn-o" style="width:100%;margin-bottom:8px;color:var(--ac)" onclick="descargarPlantillaLimpia()"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Descargar Plantilla Limpia (paso parcial — ver docs/nuevo-cliente.md)</button>'+
      '<div style="font-size:10px;color:var(--tx3)">Nueva Empresa: borra TODO y permite cargar nuevos equipos y pautas</div>'+
      '</div>'+

      // TARIFA Y METAS
      '<div class="card"><b style="font-size:14px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="8"/><text x="10" y="14" font-size="9" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">$</text></svg> Tarifas y Metas</b><br><br>'+
      '<div style="margin-bottom:8px"><label style="font-size:11px;color:var(--tx3)">Tarifa HH ($/hora)</label><br>'+
      '<input type="number" value="'+(S.g('hh')||25000)+'" onchange="S.s(\'hh\',parseInt(this.value));refreshAll()" style="padding:6px;width:150px;background:var(--bg3);color:var(--tx);border:1px solid var(--bd);border-radius:4px"></div>'+
      '<div style="margin-bottom:8px"><label style="font-size:11px;color:var(--tx3)">Meta Disponibilidad (%)</label><br>'+
      '<input type="number" value="'+(S.g('dispMeta')||85)+'" onchange="S.s(\'dispMeta\',parseInt(this.value));refreshAll()" style="padding:6px;width:150px;background:var(--bg3);color:var(--tx);border:1px solid var(--bd);border-radius:4px"></div>'+
      '<div><label style="font-size:11px;color:var(--tx3)">Presupuesto Mensual ($)</label><br>'+
      '<input type="number" value="'+((S.g('cfg')||{}).presupuestoMensual||'')+'" placeholder="Ej: 25000000" onchange="var c=S.g(\'cfg\')||{};c.presupuestoMensual=parseInt(this.value)||0;S.s(\'cfg\',c);refreshAll()" style="padding:6px;width:150px;background:var(--bg3);color:var(--tx);border:1px solid var(--bd);border-radius:4px"></div>'+
      '</div>'+

      // CREAR USUARIO (solo admin real via Supabase Auth)
      (window._userRole==='admin'?
      '<div class="card"><b style="font-size:14px">👤 Crear Usuario del Sistema</b><br><br>'+
      '<div style="margin-bottom:8px"><label style="font-size:11px;color:var(--tx3)">Nombre</label><br>'+
      '<input id="nuNombre" placeholder="Héctor Ortiz" style="padding:6px;width:100%;box-sizing:border-box;background:var(--bg3);color:var(--tx);border:1px solid var(--bd);border-radius:4px"></div>'+
      '<div style="margin-bottom:8px"><label style="font-size:11px;color:var(--tx3)">Email</label><br>'+
      '<input id="nuEmail" type="email" placeholder="correo@ejemplo.com" style="padding:6px;width:100%;box-sizing:border-box;background:var(--bg3);color:var(--tx);border:1px solid var(--bd);border-radius:4px"></div>'+
      '<div style="margin-bottom:8px"><label style="font-size:11px;color:var(--tx3)">Rol</label><br>'+
      '<select id="nuRol" style="padding:6px;width:100%;box-sizing:border-box;background:var(--bg3);color:var(--tx);border:1px solid var(--bd);border-radius:4px"><option value="operador">Operador</option><option value="admin">Admin</option><option value="lector">Lector (solo lectura)</option></select></div>'+
      '<button class="btn" style="width:100%" onclick="crearUsuarioUI()">➕ Crear usuario (queda bloqueado)</button>'+
      '<div id="nuResultado" style="margin-top:10px;font-size:12px"></div>'+
      '<div style="font-size:10px;color:var(--tx3);margin-top:8px">La cuenta queda creada pero bloqueada — no puede iniciar sesión hasta que tú la actives abajo.</div>'+
      '<hr style="border-color:var(--bd);margin:14px 0">'+
      '<b style="font-size:13px">⏳ Pendientes de activar</b>'+
      '<div id="nuPendientes" style="margin-top:8px;font-size:12px;color:var(--tx3)">Cargando...</div>'+
      '<hr style="border-color:var(--bd);margin:14px 0">'+
      '<b style="font-size:13px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> Usuarios activos</b>'+
      '<div id="nuActivos" style="margin-top:8px;font-size:12px;color:var(--tx3)">Cargando...</div>'+
      '</div>'
      :'')+

      // DOCUMENTACIÓN (solo admin)
      (window._userRole==='admin'?
      '<div class="card"><b style="font-size:14px">📐 Documentación del Sistema</b><br><br>'+
      '<p style="font-size:11px;color:var(--tx3);margin-bottom:10px">Plano de conexión, explicación de la arquitectura, y los manuales de usuario y administrador — versionados junto al código en la carpeta docs/.</p>'+
      '<div style="display:flex;flex-direction:column;gap:6px">'+
      '<button class="btn btn-o" onclick="window.open(\'docs/plano-sistema.html\',\'_blank\')">📐 Ver plano del sistema</button>'+
      '<button class="btn btn-o" onclick="window.open(\'docs/arquitectura.html\',\'_blank\')">🏗️ Ver arquitectura</button>'+
      '<button class="btn btn-o" onclick="window.open(\'docs/manual-usuario.html\',\'_blank\')">📖 Ver manual de usuario</button>'+
      '<button class="btn btn-o" onclick="window.open(\'docs/manual-admin.html\',\'_blank\')">🔧 Ver manual de administrador</button>'+
      '</div></div>'
      :'')+

      // MONITOREO DE ERRORES (Sentry) — solo admin
      (window._userRole==='admin'?
      '<div class="card" style="max-width:900px;margin-bottom:16px;border-left:3px solid #a78bfa">'+
      '<b style="font-size:14px">🐞 Monitoreo de errores</b>'+
      '<p style="font-size:11px;color:var(--tx3);margin:8px 0">Cada error real que le pase a un usuario (no solo a vos probando) queda registrado en Sentry, con el nombre de quién lo vio y qué estaba haciendo. Este botón manda un error de prueba para confirmar que la conexión funciona — deberías verlo en sentry.io en menos de un minuto.</p>'+
      '<button class="btn btn-o" onclick="if(window.Sentry){Sentry.captureException(new Error(\'Prueba manual desde Configuración — \'+new Date().toLocaleString()));toast(\'🐞 Error de prueba enviado a Sentry\');}else{toast(\'⚠️ Sentry no está cargado en esta página\');}">Enviar error de prueba</button>'+
      '</div>'
      :'')+

      // INFO SISTEMA
      '<div class="card"><b style="font-size:14px">🔲 Códigos QR por Equipo</b><br><br>'+
      '<p style="font-size:11px;color:var(--tx3);margin-bottom:10px">Genera un QR único por equipo. Al escanearlo abre directo su ficha en Equipos — sin buscarlo a mano. Descárgalos para imprimir y pegar en cada máquina.</p>'+
      '<button class="btn" onclick="verCodigosQR()">🔲 Ver / Descargar QR</button>'+
      '</div>'+

      '<div class="card"><b style="font-size:14px">ℹ️ Info del Sistema</b><br><br>'+
      '<div style="font-size:12px;line-height:2">'+
      'Versión: <b>v15</b><br>'+
      'Equipos: <b>'+(S.g('eq')||[]).length+'</b><br>'+
      'Pautas: <b>'+INIT.pautas.length+'</b><br>'+
      'Registros PM: <b>'+(S.g('reg')||[]).length+'</b><br>'+
      'Correctivos: <b>'+(S.g('ot')||[]).length+'</b><br>'+
      'Pestañas: <b>'+Object.keys(renders).length+'</b><br>'+
      'Archivo: <b>'+Math.round(document.documentElement.outerHTML.length/1024)+'KB</b><br>'+
      'localStorage: <b>'+Math.round(JSON.stringify(localStorage).length/1024)+'KB</b>'+
      '</div></div>'+

      '</div>'
    ;
  if(window._userRole==='admin'){setTimeout(cargarPendientesUI,50);setTimeout(cargarActivosUI,50);}
  _refrescarEstadoMFA();
}

async function _refrescarEstadoMFA(){
  var box=document.getElementById('mfaEstadoBox');
  if(!box)return;
  var f=await window._mfaEstado().catch(function(){return null;});
  if(f){
    box.innerHTML='<div style="color:var(--ok);margin-bottom:8px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> Activada</div>'+
      '<button class="btn btn-d" onclick="desactivarMFA()">Desactivar</button>';
  }else{
    box.innerHTML='<div style="color:var(--w);margin-bottom:8px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> No está activada</div>'+
      '<button class="btn" onclick="activarMFA()">Activar verificación en dos pasos</button>';
  }
}

// ---- VERIFICADOR DE INTEGRIDAD ----
var SEV_LABEL={alta:'🔴 Alta — dato imposible en sí mismo',media:'🟡 Media — inconsistencia entre campos, revisar'};
var SEV_COLOR={alta:'var(--danger)',media:'var(--warn)'};
export function ejecutarVerificacionIntegridad(){
  var box=$('integridadResultado');
  if(box)box.innerHTML='<span style="font-size:11px;color:var(--tx3)">Verificando…</span>';
  var data={
    eq:S.g('eq')||[], reg:S.g('reg')||[], hist:S.g('hist')||[],
    stk:S.g('stk')||[], repuestos:S.g('repuestos')||[], lub:S.g('lub')||[],
    ordenes:S.g('ordenes')||[], compMayores:S.g('compMayores')||[],
    dispCalc:S.g('dispCalc')||{}
  };
  var hallazgos=verificarIntegridad(data);
  if(!box)return;
  if(!hallazgos.length){
    box.innerHTML='<div style="color:var(--ok);font-size:12px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> Sin hallazgos — no se detectaron datos físicamente imposibles.</div>';
    toast('✅ Verificación de integridad: sin hallazgos');
    return;
  }
  var porSev={};
  hallazgos.forEach(function(h){(porSev[h.severidad]=porSev[h.severidad]||[]).push(h);});
  var html='';
  ['alta','media'].forEach(function(sev){
    var arr=porSev[sev];if(!arr||!arr.length)return;
    html+='<div style="margin-bottom:10px">'+
      '<b style="font-size:12px;color:'+SEV_COLOR[sev]+'">'+SEV_LABEL[sev]+' ('+arr.length+')</b>'+
      '<ul style="margin:6px 0 0 18px;padding:0;font-size:11px;color:var(--tx2)">'+
      arr.map(function(h){return '<li style="margin-bottom:3px">'+escapeHtml(h.msg)+'</li>';}).join('')+
      '</ul></div>';
  });
  box.innerHTML=html;
  toast('⚠️ Verificación de integridad: '+hallazgos.length+' hallazgo(s)');
};

export function resetAll(){
  if(!confirm('⚠️ ¿Restaurar TODOS los datos a valores iniciales? Se perderán cambios.'))return;
  // Clear EVERYTHING with smp10_ prefix
  Object.keys(localStorage).filter(function(k){return k.startsWith('smp10_')}).forEach(function(k){localStorage.removeItem(k)});
  localStorage.removeItem('smp10_v14fix');
  location.reload();
};

// Corrección real (2026-09-01, propuesta "clonar la arquitectura para un
// cliente nuevo", Nivel 1): este botón SOLO reemplaza el objeto INIT que
// vive en index.html — nunca tocó, y no puede tocar desde el navegador,
// modules/store.js (archivo aparte, cargado por su cuenta), donde viven
// _SB_DEFAULT_URL/_SB_DEFAULT_KEY (el proyecto Supabase real de Besalco,
// codificados a mano). Si alguien descargaba esto pensando que ya tenía un
// "sistema nuevo" listo para otra empresa, en realidad el login, el
// storage y las Edge Functions de ese archivo seguían apuntando al backend
// real de Besalco — solo la semilla local de equipos/pautas cambiaba. El
// aviso ahora lo dice explícitamente, y remite a la guía real del proceso
// completo (docs/nuevo-cliente.md) en vez de dar a entender que esto solo
// alcanza.
export function descargarPlantillaLimpia(){
  if(!confirm('Este archivo NO trae un backend propio: index.html queda con los equipos/pautas vacíos, pero modules/store.js (archivo aparte) sigue apuntando al proyecto Supabase real de Besalco a menos que lo edites a mano antes de desplegar.\n\nEsto NO es "lista para otra empresa" por sí solo — es un paso dentro de un proceso más largo (proyecto Supabase nuevo, migraciones, Edge Functions, y recién ahí cambiar _SB_DEFAULT_URL/_SB_DEFAULT_KEY en modules/store.js). Ver docs/nuevo-cliente.md para la guía completa.\n\nTu archivo actual NO se modifica — quedas con todos tus datos intactos.\n\n¿Continuar de todas formas?'))return;
  const INIT_LIMPIO={empresa:'',faena:'',equipos:[],pautas:[],registros:[],neumaticos:[],neuMed:[],stockFiltros:[],lubricantes:[],filtrosMaestro:[],alertas:[],mov:[],ot:[],insp:[],aceite:[],repuestos:[]};
  fetch(location.href).then(r=>r.text()).then(html=>{
    const finalHtml=html.replace(/const INIT=\{.*?\};\n/s,'const INIT='+JSON.stringify(INIT_LIMPIO)+';\n');
    const blob=new Blob([finalHtml],{type:'text/html'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download='SistemaMP_PLANTILLA_LIMPIA.html';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('✅ Plantilla limpia descargada — recuerda que igual necesitas un proyecto Supabase propio antes de usarla (ver docs/nuevo-cliente.md).');
  }).catch(e=>{toast('⚠️ No se pudo leer el archivo. Usa Configurar Nueva Empresa como alternativa.');});
};
export function resetEmpresa(){
  sm('<h3><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><rect x="4" y="2" width="12" height="16"/><rect x="6.3" y="4.5" width="1.8" height="1.8"/><rect x="9.1" y="4.5" width="1.8" height="1.8"/><rect x="11.9" y="4.5" width="1.8" height="1.8"/><rect x="6.3" y="8" width="1.8" height="1.8"/><rect x="9.1" y="8" width="1.8" height="1.8"/><rect x="11.9" y="8" width="1.8" height="1.8"/><rect x="8.5" y="13" width="3" height="5"/></svg> Configurar Nueva Empresa</h3>'+
    '<p style="font-size:12px;color:var(--tx3)">Esto borra TODOS los datos actuales y reconfigura el sistema para una nueva empresa.<br>'+
    'Sube un archivo JSON con la estructura:<br><br>'+
    '<code style="background:var(--bg3);padding:4px 8px;border-radius:4px;font-size:11px">{ "empresa": "...", "faena": "...", "equipos": [...], "pautas": [...] }</code><br><br>'+
    'O sube un CSV de equipos con columnas: sigla, tipo, modelo, marca, serie, frecPM, horomActual, hrsDia</p>'+
    '<div style="margin:12px 0">'+
    '<div class="fg" style="margin-bottom:8px"><label>Nombre Empresa</label><input id="neEmpresa" placeholder="Ej: Minera Los Andes S.A."></div>'+
    '<div class="fg" style="margin-bottom:8px"><label>Faena / Sitio</label><input id="neFaena" placeholder="Ej: Planta Concentradora Norte"></div>'+
    '</div>'+
    '<div style="margin:12px 0">'+
    '<div class="fg" style="margin-bottom:8px"><label>Archivo de equipos (JSON o CSV)</label><input type="file" id="neFile" accept=".json,.csv"></div>'+
    '</div>'+
    '<div style="margin:12px 0">'+
    '<div class="fg" style="margin-bottom:8px"><label>Archivo de pautas (JSON o CSV, opcional)</label><input type="file" id="nePauFile" accept=".json,.csv"></div>'+
    '</div>'+
    '<div style="background:rgba(239,68,68,.1);border-radius:6px;padding:10px;margin:12px 0">'+
    '<b style="color:var(--danger)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> ATENCIÓN:</b> Esto borra TODOS los datos operacionales actuales de la nube — equipos, registros de PM, OTs, stock, neumáticos, Gantt, Papelera, changelog, historial de horómetros, análisis de aceite, todo. Puede tardar varios minutos. Exporta un backup JSON primero desde Configuración si quieres guardarlos — es irreversible.'+
    '</div>'+
    '<button class="btn" style="background:var(--danger)" onclick="processResetEmpresa()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 10 A6 6 0 0 1 15.5 6.5" fill="none"/><polyline points="15.5,3 15.5,6.5 12,6.5"/><path d="M16 10 A6 6 0 0 1 4.5 13.5" fill="none"/><polyline points="4.5,17 4.5,13.5 8,13.5"/></svg> Resetear y Configurar</button> '+
    '<button class="btn btn-o" onclick="cm()">Cancelar</button>');
};

// Espera a que TODOS los borrados/guardados en cola de _syncChain terminen de
// verdad (uno por fila, por tabla, corriendo en paralelo entre tablas) antes de
// recargar — sin esto, "Nueva Empresa" podía recargar la página con la mitad de
// los borrados de eq/pau todavía en camino.
async function _esperarYRecargarNuevaEmpresa(){
  await Promise.all(Object.values(_syncChain));
  toast('✅ Nueva empresa configurada. Recargando...');
  setTimeout(function(){location.reload();},1200);
}
export async function processResetEmpresa(){
  if(!confirm('⚠️ ¿Estás seguro? Esto borra TODOS los datos operacionales actuales de la nube — equipos, PM, correctivos, stock, neumáticos, Gantt, Papelera, historial, todo — no solo equipos y pautas.'))return;
  if(!confirm('⚠️ ÚLTIMA CONFIRMACIÓN: ¿Exportaste un backup JSON? Esto es irreversible y puede tardar varios minutos en terminar — no cierres esta pestaña mientras corre.'))return;

  var empresa=$('neEmpresa')?.value||'Nueva Empresa';
  var faena=$('neFaena')?.value||'Nueva Faena';
  var eqFile=$('neFile')?.files[0];
  var pauFile=$('nePauFile')?.files[0];

  cm();
  toast('⏳ Borrando datos actuales de la nube — puede tardar varios minutos...');

  // Borra de verdad las ~29 categorías reales que NO son eq/pau (ver
  // _resetearDatosEmpresa en store.js) — eq/pau se manejan acá abajo porque
  // dependen del archivo que suba el usuario (o quedan vacías si no sube nada).
  try{
    await _resetearDatosEmpresa();
  }catch(err){
    toast('❌ Error borrando datos de la nube: '+err.message);
    return;
  }

  localStorage.removeItem('smp10_v14fix');

  // Set new config
  S.s('cfg',{empresa:empresa,faena:faena,tema:'dark'});

  // Trae el estado fresco de eq/pau desde el servidor antes de vaciarlas — mismo
  // motivo que _resetearDatosEmpresa: si esta pestaña no tenía cacheadas TODAS
  // las filas reales, el borrado por diff se quedaría corto.
  var eqFresco=await _refetchTablaReal('eq');
  if(eqFresco)_sbCache.eq=eqFresco;

  if(!eqFile){
    // No file - create empty system
    INIT.equipos=[];INIT.pautas=[];
    S.s('eq',[]);
    var pauFrescoVacio=await _refetchTablaReal('pau');
    if(pauFrescoVacio)_sbCache.pau=pauFrescoVacio;
    S.s('pau',[]);
    _esperarYRecargarNuevaEmpresa();
    return;
  }

  var reader=new FileReader();
  reader.onload=async function(e){
    try{
      var txt=e.target.result;
      var newEq=[];
      var newPau=[];

      if(eqFile.name.endsWith('.json')){
        var data=JSON.parse(txt);
        if(data.equipos)newEq=data.equipos;
        else if(Array.isArray(data))newEq=data;
        if(data.pautas)newPau=data.pautas;
      } else {
        // CSV
        var lines=txt.split('\n').filter(function(l){return l.trim();});
        var headers=lines[0].split(/[,;\t]/).map(function(h){return h.trim().replace(/"/g,'');});
        for(var i=1;i<lines.length;i++){
          var vals=lines[i].split(/[,;\t]/).map(function(v){return v.trim().replace(/"/g,'');});
          var row={};
          headers.forEach(function(h,j){row[h]=vals[j]||'';});
          newEq.push({
            sigla:row.sigla||row.equipo||'EQ-'+i,
            tipo:row.tipo||'Equipo',
            modelo:row.modelo||'',
            marca:row.marca||'',
            serie:row.serie||'',
            frecPM:parseInt(row.frecPM||row.frecuencia)||250,
            horomActual:parseInt(row.horomActual||row.horometro)||0,
            hrsDia:parseFloat(row.hrsDia||row.horas_dia)||12,
            fechaHorom:new Date().toISOString().slice(0,10)
          });
        }
      }

      // Apply C.recalc to each equipment
      newEq.forEach(function(eq){
        eq.horomProxPM=eq.horomActual+eq.frecPM-(eq.horomActual%eq.frecPM);
        eq.tipoPM='PM1';
        eq.estado='AL DÍA';
        eq.diasParaPM=Math.round((eq.horomProxPM-eq.horomActual)/eq.hrsDia);
      });

      INIT.equipos=newEq;
      INIT.pautas=newPau;
      S.s('eq',newEq);

      // Process pautas file if provided
      if(pauFile){
        var reader2=new FileReader();
        reader2.onload=async function(e2){
          try{
            var txt2=e2.target.result;
            if(pauFile.name.endsWith('.json')){
              newPau=JSON.parse(txt2);
            } else {
              var lines2=txt2.split('\n').filter(function(l){return l.trim();});
              var h2=lines2[0].split(/[,;\t]/).map(function(h){return h.trim().replace(/"/g,'');});
              for(var j=1;j<lines2.length;j++){
                var v2=lines2[j].split(/[,;\t]/).map(function(v){return v.trim().replace(/"/g,'');});
                var r2={};h2.forEach(function(h,k){r2[h]=v2[k]||'';});
                newPau.push({
                  sigla:r2.sigla||r2.equipo||'',hoja:r2.hoja||r2.sigla||'',
                  pm:r2.pm||'PM1',cat:r2.cat||r2.categoria||'',
                  act:r2.act||r2.actividad||'',hrs:parseFloat(r2.hrs||r2.horas)||0,
                  rep:r2.rep||r2.repuesto||'',can:parseFloat(r2.can||r2.cantidad)||0
                });
              }
            }
            INIT.pautas=newPau;
            var pauFresco=await _refetchTablaReal('pau');
            if(pauFresco)_sbCache.pau=pauFresco;
            S.s('pau',newPau);
          }catch(err2){console.error(err2);}
          _esperarYRecargarNuevaEmpresa();
        };
        reader2.readAsText(pauFile);
      } else {
        INIT.pautas=[];
        var pauFrescoSinArchivo=await _refetchTablaReal('pau');
        if(pauFrescoSinArchivo)_sbCache.pau=pauFrescoSinArchivo;
        S.s('pau',[]);
        _esperarYRecargarNuevaEmpresa();
      }
    }catch(err){
      toast('❌ Error: '+err.message);
    }
  };
  reader.readAsText(eqFile);
};

export async function cloudProbar(){
  if(!_clOk()){toast('⚠️ Pega la URL y la clave anon primero');return;}
  try{
    const c=_clCfg();
    const r=await fetch(c.url+'/rest/v1/kv?select=key&limit=1',{headers:_clHeaders()});
    if(r.ok){toast('✅ Conexión OK — tabla kv encontrada');_clStatus('🟢 Conectado','var(--ok)');}
    else if(r.status===404){toast('⚠️ Conecta OK pero falta la tabla kv. Corre el SQL en Supabase.');_clStatus('🟡 Falta tabla kv','var(--warn)');}
    else toast('❌ HTTP '+r.status+' — revisa URL/clave');
  }catch(e){toast('❌ No se pudo conectar: '+e.message);}
};

export function guardarNeuParams(){
  const c=S.g('cfg')||{};
  c.neuTargetHrs=parseInt($('neuTarget').value)||9000;
  c.neuProyMes=parseInt($('neuProyMes').value)||450;
  S.s('cfg',c);
  toast('✅ Parámetros de neumáticos guardados');
  if(currentTab==='cfg')renders.cfg();
};
export function guardarAlertaEmails(){
  const c=S.g('cfg')||{};
  c.alertaEmails=($('cfgAlertaEmails').value||'').trim();
  S.s('cfg',c);
  toast('✅ Destinatarios de alerta guardados');
  if(currentTab==='cfg')renders.cfg();
};
export function guardarAlertaWhatsApp(){
  const c=S.g('cfg')||{};
  c.alertaWhatsApp=($('cfgAlertaWhatsApp').value||'').trim();
  S.s('cfg',c);
  toast('✅ Destinatarios de WhatsApp guardados');
  if(currentTab==='cfg')renders.cfg();
};
export function guardarRemitentesPermitidos(){
  const c=S.g('cfg')||{};
  c.whatsappRemitentesPermitidos=($('cfgWhatsappRemitentes').value||'').trim();
  c.correoRemitentesPermitidos=($('cfgCorreoRemitentes').value||'').trim();
  S.s('cfg',c);
  toast('✅ Remitentes autorizados guardados');
  if(currentTab==='cfg')renders.cfg();
};
// Reemplaza a la vieja limpiarMovAntiguos(), que hacia S.s('mov', recientes) -- con
// 'mov' ya sincronizado a Supabase (movimientos_stock), eso NO limpiaba localStorage:
// borraba de verdad los movimientos viejos de la base de datos real de produccion,
// aunque el boton y el texto de alrededor lo presentaban como una limpieza local
// inofensiva por el limite de 5MB del navegador. Ya no hace falta borrar nada -- el
// recorte de localStorage ahora es automatico (ver _recorteParaLocal) y nunca toca
// la base real. Esta funcion solo exporta a CSV, no borra ni localmente ni en la nube.
export function exportarMovCSV(){
  var mov=S.g('mov')||[];
  var info=$('mtoInfo');
  if(!mov.length){if(info)info.innerHTML='ℹ️ No hay movimientos en el sistema.';return;}
  var esc=function(v){v=(v==null?'':String(v));return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
  var csv='Fecha,Equipo,Item,Cantidad,Tipo,PM,Origen\n';
  mov.forEach(function(m){
    csv+=[esc(m.fecha),esc(m.equipo),esc(m.item),esc(m.cant),esc(m.tipo),esc(m.pm),esc(m.origen)].join(',')+'\n';
  });
  var blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.download='movimientos_'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(url);},1000);
  toast('✅ '+mov.length+' movimientos exportados a CSV');
  if(info)info.innerHTML='<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> Exportados '+mov.length+' movimientos a CSV. No se borro nada -- ni local ni en la nube.';
};
export function cloudGuardarCfg(){
  const c=S.g('cfg')||{};
  c.sbUrl=($('sbUrl')?.value||'').trim();
  c.sbKey=($('sbKey')?.value||'').trim();
  c.sbAuto=$('sbAuto')?.checked||false;
  S.s('cfg',c);
  toast('✅ Configuración de nube guardada');
};

export function exportAllJSON(){
  var data={};
  // Mismas claves que el respaldo automático en carpeta (_asWrite/AUTOSAVE_KEYS en
  // index.html) — antes esta lista estaba duplicada y desactualizada, sin Destrabe,
  // Gantt, Pautas, Alertas, Informes de Falla, Programación Diaria, Sensores/
  // Mediciones de Neumáticos, Metas ni Avance Mensual.
  AUTOSAVE_KEYS.forEach(function(k){data[k]=S.g(k);});
  var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='SistemaMP_backup_'+new Date().toISOString().slice(0,10)+'.json';a.click();
  toast('✅ Backup descargado');
};
export function importAllJSON(){
  var inp=document.createElement('input');inp.type='file';inp.accept='.json';
  inp.onchange=function(ev){
    var f=ev.target.files[0];if(!f)return;
    var r=new FileReader();r.onload=function(e){
      try{
        var data=JSON.parse(e.target.result);
        Object.keys(data).forEach(function(k){if(k!=='_meta')S.s(k,data[k]);});
        toast('✅ Backup restaurado');location.reload();
      }catch(err){toast('❌ Error: '+err.message);}
    };r.readAsText(f);
  };inp.click();
};

// reporteEjecutivoExcel() se eliminó (2026-08-30): existía un segundo
// "Reporte Ejecutivo" acá, con su propio motor HTML→Excel y sin la fuente
// única correcta de MTBF (mtbfFlotaReal, logic.js) que ya tenía la versión
// de Metas & KPIs → Informes. Peor: "Urgentes" salía distinto en cada uno.
// Se fusionaron en uno solo — ver rptEjecutivo/_getEjecutivoData en kpi.js,
// que ahora incluye también la tabla de estado de flota y neumáticos en
// alerta que traía esta versión.

// Activar / desactivar — se maneja desde Configuración, con la sesión ya
// completa (aal1 o aal2, da igual: enrolar exige el código igual que
// cualquier challenge, así que no hay forma de activarlo sin probar que
// realmente funciona el código antes de dejarlo activo).
export async function _mfaEstado(){
  var token=localStorage.getItem('smp_access_token');
  var u=await _sbAuthSession();
  var factores=(u&&u.factors)||[];
  return factores.find(function(f){return f.factor_type==='totp'&&f.status==='verified';})||null;
};
// Supabase entrega el QR como 'data:image/svg+xml;utf8,<svg ...>' con el SVG
// SIN codificar — además de romper el atributo HTML si tiene comillas (ya
// arreglado con escapeHtml más abajo), un '#' literal dentro del SVG (ej.
// fill="#000000", el color normal de cualquier QR en blanco y negro) se
// interpreta como el separador de FRAGMENTO de la URL y trunca la imagen
// justo ahí — bug real, encontrado con una segunda captura de pantalla: el
// atributo ya no se rompía, pero quedaba un cuadro blanco vacío (la imagen
// nunca cargaba). Se re-arma como URL de datos correctamente codificada
// (encodeURIComponent) en vez de insertar el SVG crudo.
function _qrComoDataUrl(qrCrudo){
  if(!qrCrudo)return '';
  var marcaSvg='data:image/svg+xml;utf8,';
  var svgTxt=qrCrudo.indexOf(marcaSvg)===0?qrCrudo.slice(marcaSvg.length):qrCrudo;
  if(svgTxt.indexOf('<svg')===-1)return qrCrudo; // no es el formato esperado — se deja tal cual
  return 'data:image/svg+xml,'+encodeURIComponent(svgTxt);
}
export async function activarMFA(){
  var token=localStorage.getItem('smp_access_token');
  var en=await _mfaEnroll(token);
  if(en.error||!en.id){toast('❌ No se pudo iniciar la activación: '+(en.error?.message||en.msg||'error desconocido'));return;}
  var factorId=en.id;
  var qr=_qrComoDataUrl(en.totp?.qr_code||'');
  var secreto=en.totp?.secret||'';
  sm('<div style="max-width:360px">'+
    '<h3><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9 V6 a3 3 0 0 1 6 0 V9" fill="none"/></svg> Activar verificación en dos pasos</h3>'+
    '<p style="font-size:12px;color:var(--tx3);margin-bottom:12px">1. Abre Google Authenticator (o similar) en tu teléfono y escanea este código:</p>'+
    (qr?'<div style="text-align:center;margin-bottom:12px"><img src="'+escapeHtml(qr)+'" style="width:180px;height:180px;background:#fff;padding:8px;border-radius:8px"></div>':'')+
    (secreto?'<p style="font-size:10px;color:var(--tx3);text-align:center;margin-bottom:12px">¿No puedes escanear? Ingresa este código manualmente:<br><b style="font-size:12px;color:var(--tx);letter-spacing:1px">'+escapeHtml(secreto)+'</b></p>':'')+
    '<p style="font-size:12px;color:var(--tx3);margin-bottom:8px">2. Escribe el código de 6 dígitos que te muestra la app para confirmar:</p>'+
    '<input id="mfaEnrollCode" type="text" inputmode="numeric" maxlength="6" placeholder="000000" style="width:100%;padding:10px;border-radius:6px;border:1px solid var(--bd);background:var(--bg);color:var(--tx);font-size:20px;letter-spacing:6px;text-align:center;box-sizing:border-box;margin-bottom:12px">'+
    '<div id="mfaEnrollErr" style="display:none;color:var(--danger);font-size:11px;margin-bottom:8px"></div>'+
    '<button class="btn" onclick="_confirmarActivarMFA(\''+factorId+'\')">Confirmar y activar</button> '+
    '<button class="btn btn-o" onclick="_cancelarActivarMFA(\''+factorId+'\')">Cancelar</button>'+
    '</div>');
};
export async function _confirmarActivarMFA(factorId){
  var token=localStorage.getItem('smp_access_token');
  var code=(document.getElementById('mfaEnrollCode')?.value||'').trim();
  var err=document.getElementById('mfaEnrollErr');
  if(!/^\d{6}$/.test(code)){if(err){err.textContent='El código debe tener 6 dígitos.';err.style.display='block';}return;}
  var ch=await _mfaChallenge(token,factorId);
  if(ch.error||!ch.id){if(err){err.textContent='No se pudo verificar. Intenta de nuevo.';err.style.display='block';}return;}
  var v=await _mfaVerify(token,factorId,ch.id,code);
  if(v.error||!v.access_token){if(err){err.textContent='Código incorrecto — revisa la hora de tu teléfono y vuelve a intentar.';err.style.display='block';}return;}
  // La verificación exitosa entrega una sesión aal2 nueva — se reemplaza la
  // guardada para no quedar con un token viejo.
  localStorage.setItem('smp_access_token',v.access_token);
  localStorage.setItem('smp_refresh_token',v.refresh_token||'');
  _programarRefreshToken(v.access_token);
  cm();
  toast('✅ Verificación en dos pasos activada');
  if(currentTab==='cfg')renders.cfg();
};
export async function _cancelarActivarMFA(factorId){
  var token=localStorage.getItem('smp_access_token');
  // El factor recién creado con activarMFA() queda "unverified" hasta
  // confirmarse con un código — si el usuario cancela, se borra para no
  // dejar un factor a medio activar dando vueltas en la cuenta.
  await _mfaUnenroll(token,factorId).catch(function(){});
  cm();
};
export async function desactivarMFA(){
  if(!confirm('¿Desactivar la verificación en dos pasos? Con eso basta el usuario y la contraseña para entrar.'))return;
  var token=localStorage.getItem('smp_access_token');
  var f=await window._mfaEstado();
  if(!f){toast('No hay verificación en dos pasos activa');return;}
  var r=await _mfaUnenroll(token,f.id);
  if(r.error){toast('❌ No se pudo desactivar: '+(r.error?.message||''));return;}
  toast('✅ Verificación en dos pasos desactivada');
  if(currentTab==='cfg')renders.cfg();
};

export function nombrarEquipo(){
  var actual=_getDeviceLabel();
  var nuevo=prompt('Nombre para identificar ESTE computador en los accesos (ej. "PC Taller", "Notebook Juan"):',actual);
  if(nuevo&&nuevo.trim()){localStorage.setItem('smp_device_label',nuevo.trim());toast('✅ Este equipo ahora se llama "'+nuevo.trim()+'"');}
  if(typeof verAccesos==='function')verAccesos();
};

export function verAccesos(){
  // Incluye tanto logins exitosos como intentos rechazados (clave incorrecta,
  // cuenta desactivada, o sesión que no pudo renovarse) — antes solo se veían
  // los exitosos, así que un usuario bloqueado que insistía en entrar no
  // dejaba ningún rastro visible acá (ver _registrarIntentoBloqueado).
  const todos=S.g('changelog')||[];
  // Marca "🆕 dispositivo nuevo": reproduce en el cliente, sobre el
  // historial COMPLETO (no solo las 60 filas que se muestran), la misma
  // definición de "nuevo" que usa la función avisar-dispositivo-nuevo en
  // el servidor — la primera vez que aparece la combinación usuario+
  // dispositivo en el historial de logins de esa cuenta. Se recorre en
  // orden ascendente y se marca por REFERENCIA de fila (S.g devuelve una
  // copia superficial del arreglo pero las mismas filas — ver comentario
  // en S.g arriba), así que la marca calza con las mismas filas que
  // 'logs' abajo aunque vengan de una llamada distinta a S.g.
  const primeraAparicion=new Set();
  const vistos=new Set();
  todos.filter(function(c){return c.accion==='Login';}).slice().sort(function(a,b){return (a.fecha||'').localeCompare(b.fecha||'');}).forEach(function(c){
    const m=/💻 (.+?) ·/.exec(c.detalle||'');
    if(!m)return;
    const clave=(c.usuario||'')+'|'+m[1];
    if(!vistos.has(clave)){vistos.add(clave);primeraAparicion.add(c);}
  });
  const logs=todos.filter(function(c){return c.accion==='Login'||c.accion==='Login bloqueado';}).slice().sort(function(a,b){return (b.fecha||'').localeCompare(a.fecha||'');}).slice(0,60);
  const rows=logs.map(function(c){
    const d=new Date(c.fecha);
    const fechaStr=isNaN(d)?(c.fecha||'—'):d.toLocaleString('es-CL');
    const bloqueado=c.accion==='Login bloqueado';
    const nuevo=!bloqueado&&primeraAparicion.has(c);
    const marcaNuevo=nuevo?'<span title="Dispositivo nunca antes visto para esta cuenta" style="color:var(--ac);font-weight:600">🆕 </span>':'';
    return `<tr>${bloqueado?'<td style="padding:4px;font-size:11px;color:var(--danger)">🚫 '+fechaStr+'</td>':'<td style="padding:4px;font-size:11px">'+marcaNuevo+fechaStr+'</td>'}<td style="font-size:11px;color:${bloqueado?'var(--danger)':'inherit'}">${escapeHtml(c.usuario||'—')}</td><td style="font-size:10px;color:var(--tx3)">${escapeHtml(c.detalle||'')}</td></tr>`;
  }).join('');
  sm(`<div style="max-width:700px"><h3><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2 10 A9 5 0 0 1 18 10 A9 5 0 0 1 2 10 Z" fill="none"/><circle cx="10" cy="10" r="2.3"/></svg> Accesos recientes</h3>
    <p style="font-size:11px;color:var(--tx3);margin-bottom:8px">Este computador se identifica como: <b style="color:var(--tx)">💻 ${escapeHtml(_getDeviceLabel())}</b> — <a href="javascript:void(0)" onclick="nombrarEquipo()" style="color:var(--ac)">cambiar nombre</a></p>
    <p style="font-size:11px;color:var(--tx3);margin-bottom:8px">🆕 = dispositivo que nunca había iniciado sesión antes en esa cuenta.</p>
    <div style="overflow-x:auto;max-height:420px;overflow-y:auto"><table style="width:100%">
    <tr style="background:var(--bg3);position:sticky;top:0"><th style="padding:4px;text-align:left">Fecha/hora</th><th style="text-align:left">Usuario</th><th style="text-align:left">Detalle</th></tr>
    ${rows||'<tr><td colspan="3" style="padding:12px;text-align:center;color:var(--tx3)">Sin accesos registrados todavía</td></tr>'}
    </table></div>
    <button class="btn btn-o" style="margin-top:12px" onclick="cm()">Cerrar</button></div>`);
};

// ============ CREAR / ACTIVAR USUARIOS (admin) ============
async function _accionUsuarios(payload){
  var token=localStorage.getItem('smp_access_token');
  var r=await fetch(_SB_DEFAULT_URL+'/functions/v1/crear-operador',{
    method:'POST',
    headers:{'apikey':_SB_DEFAULT_KEY,'Authorization':'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  });
  if(r.status===401){
    var refrescado = await _sbAuthRefresh();
    if(refrescado){
      token=localStorage.getItem('smp_access_token');
      r=await fetch(_SB_DEFAULT_URL+'/functions/v1/crear-operador',{
        method:'POST',
        headers:{'apikey':_SB_DEFAULT_KEY,'Authorization':'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      });
    }
  }
  return r.json();
}

export async function crearUsuarioUI(){
  var nombre=(document.getElementById('nuNombre')?.value||'').trim();
  var email=(document.getElementById('nuEmail')?.value||'').trim();
  var rol=document.getElementById('nuRol')?.value||'operador';
  var out=document.getElementById('nuResultado');
  if(!out)return;
  if(!nombre||!email){out.innerHTML='<span style="color:var(--danger)">Completa nombre y email.</span>';return;}
  out.innerHTML='Creando...';
  try{
    var res=await _accionUsuarios({action:'crear',nombre:nombre,email:email,rol:rol});
    if(res.error){out.innerHTML='<span style="color:var(--danger)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10" cy="10" r="8"/><line x1="7" y1="7" x2="13" y2="13"/><line x1="13" y1="7" x2="7" y2="13"/></svg> '+escapeHtml(res.error)+'</span>';return;}
    out.innerHTML='<div style="background:var(--bg3);border:1px solid var(--ac);border-radius:6px;padding:10px;margin-top:6px">'+
      '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> Cuenta de '+escapeHtml(nombre)+' creada y bloqueada. Aparece abajo en "Pendientes de activar" — la activas cuando tú digas.</div>';
    document.getElementById('nuNombre').value='';
    document.getElementById('nuEmail').value='';
    cargarPendientesUI();
  }catch(e){out.innerHTML='<span style="color:var(--danger)">Error de conexión.</span>';}
};

export async function cargarPendientesUI(){
  var cont=document.getElementById('nuPendientes');
  if(!cont)return;
  cont.innerHTML='Cargando...';
  try{
    var res=await _accionUsuarios({action:'listar_pendientes'});
    if(res.error){cont.innerHTML='<span style="color:var(--danger)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10" cy="10" r="8"/><line x1="7" y1="7" x2="13" y2="13"/><line x1="13" y1="7" x2="7" y2="13"/></svg> '+escapeHtml(res.error)+'</span>';return;}
    var pend=res.pendientes||[];
    if(!pend.length){cont.innerHTML='<span style="color:var(--tx3)">No hay usuarios pendientes.</span>';return;}
    cont.innerHTML=pend.map(function(u){
      return '<div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg3);border-radius:6px;padding:8px 10px;margin-bottom:6px">'+
        '<span>'+escapeHtml(u.nombre)+' <span style="color:var(--tx3);font-size:10px">('+escapeHtml(u.rol)+')</span></span>'+
        '<button class="btn btn-o" style="padding:4px 10px;font-size:11px" onclick="activarUsuarioUI(\''+u.userId+'\',\''+escapeHtml(u.nombre)+'\')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9 V6 a3 3 0 0 1 6 0" fill="none"/></svg> Activar</button>'+
        '</div>';
    }).join('');
  }catch(e){cont.innerHTML='<span style="color:var(--danger)">Error de conexión.</span>';}
};

export async function activarUsuarioUI(userId,nombre){
  var out=document.getElementById('nuResultado');
  if(out)out.innerHTML='Activando...';
  try{
    var res=await _accionUsuarios({action:'activar',userId:userId});
    if(res.error){if(out)out.innerHTML='<span style="color:var(--danger)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10" cy="10" r="8"/><line x1="7" y1="7" x2="13" y2="13"/><line x1="13" y1="7" x2="7" y2="13"/></svg> '+escapeHtml(res.error)+'</span>';return;}
    if(out)out.innerHTML='<div style="background:var(--bg3);border:1px solid var(--ac);border-radius:6px;padding:10px;margin-top:6px">'+
      '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> '+escapeHtml(nombre)+' activado.<br>Clave temporal: <b style="font-size:14px;letter-spacing:1px">'+escapeHtml(res.tempPassword)+'</b><br>'+
      '<span style="color:var(--tx3);font-size:10px">Compártela ahora. Deberá cambiarla al ingresar por primera vez.</span></div>';
    cargarPendientesUI();
  }catch(e){if(out)out.innerHTML='<span style="color:var(--danger)">Error de conexión.</span>';}
};

export async function cargarActivosUI(){
  var cont=document.getElementById('nuActivos');
  if(!cont)return;
  cont.innerHTML='Cargando...';
  try{
    var res=await _accionUsuarios({action:'listar_activos'});
    if(res.error){cont.innerHTML='<span style="color:var(--danger)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10" cy="10" r="8"/><line x1="7" y1="7" x2="13" y2="13"/><line x1="13" y1="7" x2="7" y2="13"/></svg> '+escapeHtml(res.error)+'</span>';return;}
    var act=res.activos||[];
    if(!act.length){cont.innerHTML='<span style="color:var(--tx3)">No hay usuarios activos.</span>';return;}
    cont.innerHTML=act.map(function(u){
      var esYo=u.userId===_currentUser?.id;
      var botonMfa=u.mfaActivo?'<button class="btn-o btn-s" style="margin-right:6px" onclick="desactivarMfaUsuarioUI(\''+u.userId+'\',\''+escapeHtml(u.nombre)+'\')" title="Usar si perdió el teléfono/app autenticadora y quedó sin poder entrar"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9 V6 a3 3 0 0 1 6 0 V9" fill="none"/></svg> Quitar 2FA</button>':'';
      return '<div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg3);border-radius:6px;padding:8px 10px;margin-bottom:6px">'+
        '<span>'+escapeHtml(u.nombre)+' <span style="color:var(--tx3);font-size:10px">('+escapeHtml(u.rol)+')</span>'+(u.mfaActivo?' <span style="color:var(--ac);font-size:10px" title="Tiene verificación en dos pasos activada">🔐</span>':'')+'</span>'+
        (esYo?'<span style="color:var(--tx3);font-size:10px">(tú)</span>':
        '<span>'+botonMfa+'<button class="btn-o btn-s" style="color:var(--danger);border-color:var(--danger)" onclick="desactivarUsuarioUI(\''+u.userId+'\',\''+escapeHtml(u.nombre)+'\')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9 V6 a3 3 0 0 1 6 0 V9" fill="none"/></svg> Desactivar</button></span>')+
        '</div>';
    }).join('');
  }catch(e){cont.innerHTML='<span style="color:var(--danger)">Error de conexión.</span>';}
};

export async function desactivarMfaUsuarioUI(userId,nombre){
  if(!confirm('¿Quitar la verificación en dos pasos de '+nombre+'?\n\nÚsalo solo si perdió el teléfono o la app autenticadora y quedó sin poder entrar — vuelve a bastarle su clave normal para entrar. Puede volver a activarla cuando quiera desde su cuenta.'))return;
  var out=document.getElementById('nuResultado');
  if(out)out.innerHTML='Desactivando verificación en dos pasos...';
  try{
    var res=await _accionUsuarios({action:'desactivar_mfa',userId:userId,nombre:nombre});
    if(res.error){if(out)out.innerHTML='<span style="color:var(--danger)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10" cy="10" r="8"/><line x1="7" y1="7" x2="13" y2="13"/><line x1="13" y1="7" x2="7" y2="13"/></svg> '+escapeHtml(res.error)+'</span>';return;}
    if(out)out.innerHTML='<div style="background:var(--bg3);border:1px solid var(--ac);border-radius:6px;padding:10px;margin-top:6px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> Verificación en dos pasos de '+escapeHtml(nombre)+' desactivada. Ya puede entrar solo con su clave.</div>';
    cargarActivosUI();
  }catch(e){if(out)out.innerHTML='<span style="color:var(--danger)">Error de conexión.</span>';}
};

export async function desactivarUsuarioUI(userId,nombre){
  if(!confirm('¿Desactivar a '+nombre+'? Perderá acceso al sistema de inmediato.'))return;
  var out=document.getElementById('nuResultado');
  if(out)out.innerHTML='Desactivando...';
  try{
    var res=await _accionUsuarios({action:'desactivar',userId:userId});
    if(res.error){if(out)out.innerHTML='<span style="color:var(--danger)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10" cy="10" r="8"/><line x1="7" y1="7" x2="13" y2="13"/><line x1="13" y1="7" x2="7" y2="13"/></svg> '+escapeHtml(res.error)+'</span>';return;}
    if(out)out.innerHTML='<div style="background:var(--bg3);border:1px solid var(--danger);border-radius:6px;padding:10px;margin-top:6px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9 V6 a3 3 0 0 1 6 0 V9" fill="none"/></svg> '+escapeHtml(nombre)+' desactivado.</div>';
    cargarActivosUI();
  }catch(e){if(out)out.innerHTML='<span style="color:var(--danger)">Error de conexión.</span>';}
}

// Puente window/renders — ver nota en mov.js (primera tanda).
window.verCodigosQR = verCodigosQR;
window._descargarQR = _descargarQR;
window.renderCfg = renderCfg;
window.ejecutarVerificacionIntegridad = ejecutarVerificacionIntegridad;
window.resetAll = resetAll;
window.descargarPlantillaLimpia = descargarPlantillaLimpia;
window.resetEmpresa = resetEmpresa;
window.processResetEmpresa = processResetEmpresa;
window.cloudProbar = cloudProbar;
window.guardarNeuParams = guardarNeuParams;
window.guardarAlertaEmails = guardarAlertaEmails;
window.guardarAlertaWhatsApp = guardarAlertaWhatsApp;
window.guardarRemitentesPermitidos = guardarRemitentesPermitidos;
window.exportarMovCSV = exportarMovCSV;
window.cloudGuardarCfg = cloudGuardarCfg;
window.exportAllJSON = exportAllJSON;
window.importAllJSON = importAllJSON;
window._mfaEstado = _mfaEstado;
window.activarMFA = activarMFA;
window._confirmarActivarMFA = _confirmarActivarMFA;
window._cancelarActivarMFA = _cancelarActivarMFA;
window.desactivarMFA = desactivarMFA;
window.nombrarEquipo = nombrarEquipo;
window.verAccesos = verAccesos;
window.crearUsuarioUI = crearUsuarioUI;
window.cargarPendientesUI = cargarPendientesUI;
window.activarUsuarioUI = activarUsuarioUI;
window.cargarActivosUI = cargarActivosUI;
window.desactivarMfaUsuarioUI = desactivarMfaUsuarioUI;
window.desactivarUsuarioUI = desactivarUsuarioUI;
renders.cfg = renderCfg;
