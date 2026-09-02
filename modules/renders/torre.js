// ═══════════════════════════════════════════════════════════════
// TORRE DE CONTROL — tablero visual de Score de Salud de toda la flota
// (2026-09-02, pedido del usuario). Nace como consolidación del antiguo
// "🗺️ Mapa de Salud de la Flota" del Dashboard: el usuario confirmó que
// ambos "cumplen las mismas funciones", así que el Dashboard se redujo a un
// resumen de conteos (ver dash.js) y el tablero completo, agrupado por tipo
// de equipo con siluetas SVG y detalle por equipo, vive solo acá. Ambas
// pestañas comparten la misma fuente de datos — equiposConSaludFlota
// (logic.js) — ningún cálculo se duplica, solo la forma de mirarlo cambia.
// Módulo ES (mismo patrón que dash.js/mov.js): sin imports, todo vía el
// realm global compartido con logic.js/store.js/index.html.
// ═══════════════════════════════════════════════════════════════

// Siluetas técnicas por tipo de equipo — mismo lenguaje visual que la marca
// de agua del login (_LOGIN_FARO_ICON, index.html) y que la maqueta de diseño
// aprobada por el usuario, ahora sobre datos reales en vez de valores de
// ejemplo. viewBox 0 0 240 130 fijo para las 10; un tipo sin ícono dedicado
// cae al de 'Camion' (fallback visual, nunca deja el tile vacío).
var _TORRE_ICONS={
  'Camion':'<path d="M70 96 L70 52 L90 40 L205 34 L222 50 L222 96 Z"/><path d="M70 52 L34 58"/><line x1="34" y1="58" x2="34" y2="66"/><path d="M16 96 V76 Q16 70 22 70 L46 70 Q52 70 52 76 V96"/><line x1="24" y1="70" x2="24" y2="82"/><circle cx="34" cy="100" r="18"/><circle cx="34" cy="100" r="6"/><circle cx="180" cy="100" r="26"/><circle cx="180" cy="100" r="9"/><line x1="54" y1="96" x2="151" y2="96"/>',
  'Camión Aljibe':'<circle cx="35" cy="100" r="16"/><circle cx="35" cy="100" r="5"/><circle cx="160" cy="100" r="16"/><circle cx="160" cy="100" r="5"/><circle cx="192" cy="100" r="16"/><circle cx="192" cy="100" r="5"/><path d="M18 90 L18 58 L44 54 L56 66 L56 90 Z"/><line x1="30" y1="54" x2="30" y2="66"/><rect x="62" y="56" width="146" height="36" rx="18"/><rect x="128" y="44" width="10" height="12" rx="2"/><line x1="56" y1="90" x2="62" y2="90"/>',
  'Bulldozer':'<rect x="18" y="92" width="188" height="24" rx="12"/><line x1="34" y1="112" x2="34" y2="96"/><line x1="58" y1="112" x2="58" y2="96"/><line x1="82" y1="112" x2="82" y2="96"/><line x1="106" y1="112" x2="106" y2="96"/><line x1="130" y1="112" x2="130" y2="96"/><path d="M6 72 L6 104 L22 104 L28 80 Z"/><path d="M40 92 L40 66 L150 60 L165 66 L165 92 Z"/><path d="M100 60 L100 34 L140 34 L150 44 L150 60 Z"/><line x1="112" y1="42" x2="112" y2="60"/><line x1="95" y1="34" x2="95" y2="18"/><circle cx="95" cy="16" r="4"/>',
  'Cargador Frontal':'<circle cx="182" cy="100" r="24"/><circle cx="182" cy="100" r="8"/><circle cx="60" cy="100" r="24"/><circle cx="60" cy="100" r="8"/><path d="M96 96 L96 50 L170 50 L182 64 L182 96 Z"/><line x1="112" y1="50" x2="112" y2="76"/><path d="M96 70 L40 40"/><path d="M96 88 L50 80 L40 60"/><path d="M40 40 L18 34 L16 54 L44 58 Z"/>',
  'Motoniveladora':'<circle cx="40" cy="104" r="14"/><circle cx="40" cy="104" r="5"/><circle cx="170" cy="104" r="18"/><circle cx="170" cy="104" r="6"/><circle cx="202" cy="104" r="18"/><circle cx="202" cy="104" r="6"/><line x1="54" y1="86" x2="200" y2="70"/><path d="M90 100 L132 100 L138 86 L96 84 Z"/><path d="M150 70 L150 44 L188 44 L196 54 L196 70 Z"/><line x1="162" y1="44" x2="162" y2="70"/>',
  'Camioneta':'<circle cx="176" cy="100" r="18"/><circle cx="176" cy="100" r="6"/><circle cx="64" cy="100" r="18"/><circle cx="64" cy="100" r="6"/><path d="M110 90 L110 60 L180 60 L180 90 Z"/><path d="M40 90 L40 58 L64 40 L106 40 L110 60 L110 90 Z"/><line x1="64" y1="40" x2="64" y2="60"/><line x1="82" y1="44" x2="82" y2="60"/>',
  'Torre Iluminacion':'<circle cx="60" cy="104" r="12"/><circle cx="60" cy="104" r="4"/><path d="M20 96 L20 88 L100 88 L100 96 Z"/><line x1="20" y1="92" x2="6" y2="92"/><path d="M52 88 L52 70 L90 70 L90 88 Z"/><line x1="70" y1="70" x2="70" y2="20"/><line x1="70" y1="20" x2="40" y2="8"/><rect x="32" y="2" width="16" height="8" rx="1"/><line x1="70" y1="20" x2="58" y2="4"/><rect x="50" y="0" width="16" height="8" rx="1"/><line x1="70" y1="20" x2="82" y2="4"/><rect x="74" y="0" width="16" height="8" rx="1"/><line x1="70" y1="20" x2="100" y2="8"/><rect x="92" y="2" width="16" height="8" rx="1"/>',
  'Generador':'<line x1="18" y1="104" x2="212" y2="104"/><path d="M30 100 L30 50 L200 50 L200 100 Z"/><rect x="45" y="68" width="26" height="22" rx="2"/><line x1="150" y1="62" x2="176" y2="72"/><line x1="150" y1="72" x2="176" y2="82"/><line x1="150" y1="82" x2="176" y2="92"/><line x1="186" y1="50" x2="186" y2="28"/><rect x="180" y="22" width="12" height="8" rx="1"/>',
  'Bus':'<circle cx="170" cy="100" r="17"/><circle cx="170" cy="100" r="6"/><circle cx="55" cy="100" r="17"/><circle cx="55" cy="100" r="6"/><path d="M20 90 L20 50 Q20 40 30 40 L190 40 Q200 40 200 50 L200 90 Z"/><rect x="34" y="48" width="22" height="16" rx="2"/><rect x="64" y="48" width="22" height="16" rx="2"/><rect x="94" y="48" width="22" height="16" rx="2"/><rect x="124" y="48" width="22" height="16" rx="2"/><rect x="154" y="48" width="22" height="16" rx="2"/><line x1="40" y1="64" x2="40" y2="90"/>',
  'Minicargador':'<circle cx="185" cy="100" r="20"/><circle cx="185" cy="100" r="7"/><circle cx="75" cy="100" r="20"/><circle cx="75" cy="100" r="7"/><path d="M55 95 L55 62 L165 62 L165 95 Z"/><line x1="80" y1="62" x2="80" y2="34"/><line x1="140" y1="62" x2="140" y2="34"/><line x1="80" y1="34" x2="140" y2="34"/><path d="M165 66 L206 56 L200 84 L165 90"/><path d="M40 76 L18 70 L16 92 L44 96 Z"/>'
};
function _torreIconSvg(tipo,extra){
  return '<svg viewBox="0 0 240 130" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" '+(extra||'')+'>'+(_TORRE_ICONS[tipo]||_TORRE_ICONS['Camion'])+'</svg>';
}
// Orden de despliegue de los grupos — camiones/aljibes primero (el grueso de
// la flota de acarreo), equipos de apoyo/servicio al final. Un tipo real que
// no esté en esta lista igual se muestra (al final, orden alfabético) — nunca
// se pierde un equipo por tener un tipo no contemplado acá.
var _TORRE_ORDEN_TIPOS=['Camion','Camión Aljibe','Cargador Frontal','Bulldozer','Motoniveladora','Camioneta','Bus','Minicargador','Torre Iluminacion','Generador'];

function _asegurarEstiloTorre(){
  if(document.getElementById('torreEstilo'))return;
  var css='@keyframes torreSweep{0%{background-position:220% 0}100%{background-position:-40% 0}}'+
    '@keyframes torreFaroBarrido{to{transform:rotate(360deg)}}'+
    '@keyframes torreFaroPulso{0%,100%{opacity:.14;transform:scale(1)}50%{opacity:.34;transform:scale(1.4)}}'+
    '@keyframes torrePulseCrit{0%,100%{box-shadow:0 0 0 rgba(239,68,68,0);border-color:var(--bd)}50%{box-shadow:0 0 14px rgba(239,68,68,.35);border-color:rgba(239,68,68,.55)}}'+
    '#s-torre{position:relative}'+
    '.torre-bg{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;border-radius:12px}'+
    '.torre-bg-grid{position:absolute;inset:0;background-image:linear-gradient(var(--bd) 1px,transparent 1px),linear-gradient(90deg,var(--bd) 1px,transparent 1px);background-size:46px 46px;opacity:.25;-webkit-mask-image:radial-gradient(ellipse 90% 70% at 50% 0%,black 40%,transparent 85%);mask-image:radial-gradient(ellipse 90% 70% at 50% 0%,black 40%,transparent 85%)}'+
    '.torre-bg-sweep{position:absolute;inset:0;background:linear-gradient(100deg,transparent 42%,rgba(245,165,36,.05) 50%,transparent 58%);background-size:280% 100%;animation:torreSweep 9s linear infinite}'+
    '.torre-faro-beam{transform-origin:30px 14px;animation:torreFaroBarrido 4.5s linear infinite}'+
    '.torre-faro-pulse{transform-origin:30px 14px;animation:torreFaroPulso 3s ease-in-out infinite}'+
    '.torre-tile{width:104px;background:var(--bg2);border:1px solid var(--bd);border-radius:10px;padding:9px 7px 8px;text-align:center;cursor:pointer;transition:transform .12s ease,border-color .12s ease,box-shadow .12s ease}'+
    '.torre-tile:hover{transform:translateY(-2px);border-color:var(--ac)}'+
    '.torre-tile .ti-icon{width:100%;height:46px;display:flex;align-items:center;justify-content:center;margin-bottom:5px}'+
    '.torre-tile svg{width:100%;height:100%;overflow:visible}'+
    '.torre-tile .ti-sigla{font-weight:700;font-size:11px;letter-spacing:.01em;color:var(--tx)}'+
    '.torre-tile .ti-score{font-size:10px;margin-top:1px}'+
    '.torre-tile[data-st="ok"] svg{color:var(--ok)} .torre-tile[data-st="ok"] .ti-score{color:var(--ok)}'+
    '.torre-tile[data-st="warn"] svg{color:var(--ac)} .torre-tile[data-st="warn"] .ti-score{color:var(--ac)}'+
    '.torre-tile[data-st="crit"] svg{color:var(--danger)} .torre-tile[data-st="crit"] .ti-score{color:var(--danger)}'+
    '.torre-tile[data-st="crit"]{animation:torrePulseCrit 2.6s ease-in-out infinite}'+
    '.torre-tile[data-st="none"] svg{color:var(--tx3)} .torre-tile[data-st="none"] .ti-score{color:var(--tx3)}'+
    '.torre-drawer{position:fixed;right:0;top:0;bottom:0;width:min(360px,92vw);z-index:400;background:var(--bg2);border-left:1px solid var(--bd);box-shadow:-14px 0 40px rgba(0,0,0,.5);transform:translateX(100%);transition:transform .22s ease;padding:22px;overflow-y:auto}'+
    '.torre-drawer.on{transform:translateX(0)}'+
    '.torre-scrim{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:399;opacity:0;pointer-events:none;transition:opacity .2s ease}'+
    '.torre-scrim.on{opacity:1;pointer-events:auto}'+
    '@media (prefers-reduced-motion: reduce){.torre-bg-sweep,.torre-faro-beam,.torre-faro-pulse,.torre-tile[data-st="crit"]{animation:none!important}}';
  var st=document.createElement('style');
  st.id='torreEstilo';
  st.textContent=css;
  document.head.appendChild(st);
}

function _torreStatus(v){
  if(v==null)return 'none';
  if(v>=80)return 'ok';
  if(v>=55)return 'warn';
  return 'crit';
}

export function renderTorre(){
  _asegurarEstiloTorre();
  var eq=C.recalcAll();
  var compMayores=S.g('compMayores')||[];
  var neu=S.g('neu')||[];
  var aceite=S.g('aceite')||[];
  if(aceite.length&&typeof window._aceiteResolverSiglas==='function')window._aceiteResolverSiglas(aceite);
  var ot=S.g('ot')||[];
  var otHist=S.g('otHist')||[];
  var otConHist=ot.concat(typeof _otHistComoOt==='function'?_otHistComoOt(otHist):[]);
  var equipos=equiposConSaludFlota(eq,compMayores,neu,aceite,otConHist);
  var histSalud=S.g('saludEquipoHist')||{};
  var hoyISO=new Date().toISOString().slice(0,10);

  var cOk=0,cWarn=0,cCrit=0,cNone=0;
  equipos.forEach(function(r){
    var st=_torreStatus(r.score.valor);
    if(st==='ok')cOk++;else if(st==='warn')cWarn++;else if(st==='crit')cCrit++;else cNone++;
  });

  var porTipo={};
  equipos.forEach(function(r){(porTipo[r.tipo||'Otro']=porTipo[r.tipo||'Otro']||[]).push(r);});
  var tiposConDatos=Object.keys(porTipo);
  var tiposOrden=_TORRE_ORDEN_TIPOS.filter(function(t){return tiposConDatos.indexOf(t)>=0;})
    .concat(tiposConDatos.filter(function(t){return _TORRE_ORDEN_TIPOS.indexOf(t)<0;}).sort());

  var html='<div class="torre-bg"><div class="torre-bg-grid"></div><div class="torre-bg-sweep"></div></div>'+
    '<div style="position:relative;z-index:1">'+
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">'+
    '<svg viewBox="0 0 60 60" width="36" height="36" style="color:var(--ac);flex:none" xmlns="http://www.w3.org/2000/svg">'+
    '<path d="M23 55 L37 55 L34 41 L26 41 Z" fill="currentColor"/>'+
    '<line x1="30" y1="41" x2="30" y2="15" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'+
    '<circle class="torre-faro-pulse" cx="30" cy="14" r="9" fill="currentColor" opacity=".18"/>'+
    '<g class="torre-faro-beam"><path d="M30 14 L41 9 L41 19 Z" fill="currentColor" opacity=".45"/></g>'+
    '<circle cx="30" cy="14" r="5.5" fill="currentColor"/></svg>'+
    '<div><div style="font-weight:700;font-size:19px">Torre de Control</div><div style="font-size:11px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">SistemaMP Centinela · Score de Salud en vivo</div></div>'+
    '</div>';

  html+='<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px">'+
    '<div style="flex:1;min-width:110px;background:var(--bg2);border:1px solid var(--bd);border-left:3px solid var(--ok);border-radius:10px;padding:12px 14px"><div style="font-size:26px;font-weight:700;color:var(--ok)">'+cOk+'</div><div style="font-size:11px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">Operativos</div></div>'+
    '<div style="flex:1;min-width:110px;background:var(--bg2);border:1px solid var(--bd);border-left:3px solid var(--ac);border-radius:10px;padding:12px 14px"><div style="font-size:26px;font-weight:700;color:var(--ac)">'+cWarn+'</div><div style="font-size:11px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">Atención próxima</div></div>'+
    '<div style="flex:1;min-width:110px;background:var(--bg2);border:1px solid var(--bd);border-left:3px solid var(--danger);border-radius:10px;padding:12px 14px"><div style="font-size:26px;font-weight:700;color:var(--danger)">'+cCrit+'</div><div style="font-size:11px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">Intervenir ahora</div></div>'+
    '<div style="flex:1;min-width:110px;background:var(--bg2);border:1px solid var(--bd);border-left:3px solid var(--tx3);border-radius:10px;padding:12px 14px"><div style="font-size:26px;font-weight:700;color:var(--tx3)">'+cNone+'</div><div style="font-size:11px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em">Sin datos</div></div>'+
    '</div>';

  html+='<div style="font-size:11px;color:var(--tx3);margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--bd)">🟢 ≥80% · 🟡 55-79% · 🔴 &lt;55% · ⚪ sin datos suficientes — clic en un equipo para ver el detalle.</div>';

  if(!equipos.length){
    html+='<div style="color:var(--tx3);padding:20px;text-align:center">Sin equipos cargados.</div>';
  }else{
    html+=tiposOrden.map(function(tipo){
      var lista=porTipo[tipo].slice().sort(function(a,b){
        var av=a.score.valor==null?999:a.score.valor,bv=b.score.valor==null?999:b.score.valor;
        return av-bv;
      });
      var tipoLabel=tipo==='Torre Iluminacion'?'Torre de Iluminación':tipo;
      return '<div style="margin-bottom:22px">'+
        '<div style="font-weight:600;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--tx3);margin-bottom:10px;display:flex;align-items:center;gap:8px">'+escapeHtml(tipoLabel)+
        '<span style="font-size:11px;color:var(--tx);background:var(--bg3);border-radius:20px;padding:1px 9px">'+lista.length+'</span></div>'+
        '<div style="display:flex;flex-wrap:wrap;gap:10px">'+
        lista.map(function(r,i){
          var v=r.score.valor;
          var st=_torreStatus(v);
          return '<div class="torre-tile" data-st="'+st+'" title="'+escapeHtml(r.sigla)+' — '+(v==null?'sin datos suficientes':'Score '+v+'%')+'" onclick="_torreAbrirDrawer(\''+escapeHtml(r.sigla)+'\')">'+
            '<div class="ti-icon">'+_torreIconSvg(r.tipo)+'</div>'+
            '<div class="ti-sigla">'+escapeHtml(r.sigla)+'</div>'+
            '<div class="ti-score">'+(v==null?'sin datos':v+'%')+'</div>'+
            '</div>';
        }).join('')+
        '</div></div>';
    }).join('');
  }

  html+='</div>'+
    '<div class="torre-scrim" id="torreScrim" onclick="_torreCerrarDrawer()"></div>'+
    '<div class="torre-drawer" id="torreDrawer">'+
    '<button onclick="_torreCerrarDrawer()" style="float:right;background:none;border:1px solid var(--bd);color:var(--tx3);border-radius:6px;width:28px;height:28px;cursor:pointer;font-size:14px">✕</button>'+
    '<div id="torreDIcon" style="width:100%;height:100px;display:flex;align-items:center;justify-content:center;margin:6px 0 12px"></div>'+
    '<div id="torreDSigla" style="font-weight:700;font-size:20px;margin-bottom:2px">—</div>'+
    '<div id="torreDModelo" style="color:var(--tx3);font-size:12px;margin-bottom:14px">—</div>'+
    '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:16px">'+
    '<span id="torreDScore" style="font-weight:700;font-size:32px">—</span>'+
    '<span style="font-size:10px;color:var(--tx3);text-transform:uppercase">Score de<br>salud</span>'+
    '</div>'+
    '<div id="torreDDims"></div>'+
    '<div id="torreDTend" style="font-size:11px;color:var(--tx3);margin-top:10px"></div>'+
    '<button class="btn-s btn-o" style="width:100%;margin-top:16px" id="torreDCta">Ver ficha completa en Buscar →</button>'+
    '</div>';

  document.getElementById('s-torre').innerHTML=html;

  window._torreDatos={};
  equipos.forEach(function(r){window._torreDatos[r.sigla]=r;});
  window._torreHistSalud=histSalud;
  window._torreHoyISO=hoyISO;
}

// Drawer de detalle — reutiliza directamente r.score.detalle (ya calculado por
// equiposConSaludFlota, misma fuente que Buscar) y tendenciaSaludSemanal
// (logic.js, ya usada por el propio Dashboard) — ningún cálculo nuevo, solo
// una vista rápida antes de saltar a la ficha completa si hace falta.
window._torreAbrirDrawer=function(sigla){
  var r=(window._torreDatos||{})[sigla];
  if(!r)return;
  var v=r.score.valor;
  var st=_torreStatus(v);
  var colorVar=st==='ok'?'var(--ok)':st==='warn'?'var(--ac)':st==='crit'?'var(--danger)':'var(--tx3)';
  document.getElementById('torreDIcon').innerHTML=_torreIconSvg(r.tipo,'style="color:'+colorVar+'"');
  document.getElementById('torreDSigla').textContent=r.sigla;
  document.getElementById('torreDModelo').textContent=r.modelo||'—';
  var scoreEl=document.getElementById('torreDScore');
  scoreEl.textContent=v==null?'—':v+'%';
  scoreEl.style.color=colorVar;
  var dimsHtml='';
  (r.score.detalle||[]).forEach(function(d){
    dimsHtml+='<div style="display:flex;justify-content:space-between;font-size:12px;padding:7px 0;border-bottom:1px solid var(--bd)">'+
      '<span style="color:var(--tx3)">'+escapeHtml(d.nombre)+'</span>'+
      '<span style="font-weight:600">'+(d.valor==null?'—':d.valor+'%')+'</span></div>';
  });
  document.getElementById('torreDDims').innerHTML=dimsHtml;
  var tend=(typeof tendenciaSaludSemanal==='function')?tendenciaSaludSemanal((window._torreHistSalud||{})[r.sigla]||{},window._torreHoyISO):null;
  var tendEl=document.getElementById('torreDTend');
  if(tend&&tend.delta!=null){
    var col=tend.delta>0?'var(--ok)':tend.delta<0?'var(--danger)':'var(--tx3)';
    var flecha=tend.delta>0?'▲':tend.delta<0?'▼':'→';
    tendEl.innerHTML='Tendencia 7 días: <span style="color:'+col+';font-weight:600">'+flecha+' '+Math.abs(tend.delta)+' pts</span>';
  }else{
    tendEl.textContent='Tendencia 7 días: sin dato suficiente todavía.';
  }
  document.getElementById('torreDCta').onclick=function(){
    _torreCerrarDrawer();
    go('buscar');
    setTimeout(function(){var s=document.getElementById('fBuscarEq');if(s){s.value=sigla;renders.buscar();}},50);
  };
  document.getElementById('torreDrawer').classList.add('on');
  document.getElementById('torreScrim').classList.add('on');
};
window._torreCerrarDrawer=function(){
  var d=document.getElementById('torreDrawer'),s=document.getElementById('torreScrim');
  if(d)d.classList.remove('on');
  if(s)s.classList.remove('on');
};

// Puente window/renders — ver nota en mov.js (primera tanda).
window.renderTorre = renderTorre;
renders.torre = renderTorre;
