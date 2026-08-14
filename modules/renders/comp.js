// Pestaña Componentes Mayores (sub-pestaña de Componentes) — extraída a su
// propio archivo (Fase 2 de modularización). Script plano (NO módulo ES),
// mismo scope global de siempre. horomEnFecha/compEstado viven en logic.js;
// nuevoInforme() viene de modules/renders/informes.js (botón "Generar
// informe de falla/cambio" de cada fila).
window.renderComp=function(){
  var eq=S.g('eq')||[];
  var compData=S.g('compMayores')||[];
  var fEquipo=$('fCompEq')?.value||'';

  // Auto-generate defaults if empty
  // Auto-sync: remove components for deleted equipos, add for new ones
  var eqSiglas=eq.map(function(e){return e.sigla});
  compData=compData.filter(function(c){return eqSiglas.indexOf(c.sigla)>=0});
  var compSiglas=[...new Set(compData.map(function(c){return c.sigla}))];
  var newEqs=eq.filter(function(e){return compSiglas.indexOf(e.sigla)<0});
  // compDataAntes/comparación al final: sin equipos (ej. empresa recién
  // reseteada), el bloque de abajo quedaba en un array vacío y volvía a
  // guardar S.s('compMayores',[]) en cada refresco de pantalla para siempre
  // (mismo bug ya arreglado en metas.js/prg.js: guardado incondicional sin
  // comparar antes/después).
  var compDataAntes=JSON.stringify(compData);
  // (2026-08) Turbo/Cilindro de Dirección/Suspensión Delantera/Soporte de
  // Cabina/Tolva se agregaron a la lista de componentes mayores porque
  // aparecen seguido en el historial real de cambios de la flota (revisado
  // con el usuario). vidaUtil/costoRef son ESTIMACIONES genéricas de
  // industria minera, no datos reales de Besalco — cada fila queda marcada
  // así en su 'obs' hasta que se validen/ajusten equipo por equipo.
  // (2026-08b) Asiento se agrega aparte: acá el costoRef SÍ es dato real
  // (promedio de 37 compras reales de asiento en ordenes_compra_historico,
  // $18.164.749 en total — ver auditoría). El vidaUtil (6.000h) sigue siendo
  // una referencia de "cuánto debería durar" para poder comparar contra el
  // patrón real encontrado, que es muchísimo más corto (9-12 cambios de
  // asiento por equipo en ~2 años, calzando con el gasto real) — sugiere un
  // problema de calidad/proveedor, no desgaste normal.
  // (2026-08c) Batería/Alternador/Motor de Partida se agregan por el mismo
  // motivo (pedido explícito del usuario: "alternadores, motores de partida,
  // son tantas cosas relevantes") — costoRef SÍ es dato real (promedio real de
  // ordenes_compra_historico: Batería $435.570/56 compras, Alternador
  // $399.924/46 compras, Motor de Partida $365.938/4 compras). vidaUtil sigue
  // siendo estimación de referencia. Historial de cambios reales (varias
  // fechas/horómetros por equipo) queda en historial_componentes — ver
  // hallazgo real: CN-4656 cambió motor de partida 5 veces en menos de 1 año
  // (19.014h→22.540h), patrón que apunta a falla de origen, no desgaste normal.
  // (2026-08d) Bomba de Combustible se agrega igual (costoRef real: $1.316.032
  // promedio/9 compras) — 4 equipos con instalación real confirmada. Inyectores
  // NO se agregó pese a tener costo real (7 compras, $643.084 promedio): solo se
  // encontró 1 evento real de cambio en correctivos y sin horómetro capturado
  // (equipo fuera de servicio), insuficiente para trackear "cuánto dura". Bomba
  // de Agua tampoco: el único hallazgo real (MN-6112, alza de temperatura/falla
  // bomba de agua) es un diagnóstico, no confirma que se haya cambiado.
  if(newEqs.length){
    var defaultComps=[{comp:'Motor',vidaUtil:15000,costoRef:45000000},{comp:'Transmisión',vidaUtil:12000,costoRef:35000000},{comp:'Diferencial',vidaUtil:12000,costoRef:25000000},{comp:'Convertidor',vidaUtil:10000,costoRef:20000000},{comp:'Mandos Finales',vidaUtil:10000,costoRef:18000000},{comp:'Bomba Hidráulica',vidaUtil:8000,costoRef:15000000},{comp:'Turbo',vidaUtil:12000,costoRef:8000000},{comp:'Cilindro de Dirección',vidaUtil:15000,costoRef:6000000},{comp:'Suspensión Delantera',vidaUtil:15000,costoRef:10000000},{comp:'Soporte de Cabina',vidaUtil:20000,costoRef:4000000},{comp:'Tolva',vidaUtil:25000,costoRef:15000000},{comp:'Asiento',vidaUtil:6000,costoRef:491000},{comp:'Batería',vidaUtil:4000,costoRef:435570},{comp:'Alternador',vidaUtil:6000,costoRef:399924},{comp:'Motor de Partida',vidaUtil:5000,costoRef:365938},{comp:'Bomba de Combustible',vidaUtil:8000,costoRef:1316032}];
    newEqs.forEach(function(e){defaultComps.forEach(function(dc){compData.push({sigla:e.sigla,tipo:e.tipo,modelo:e.modelo,comp:dc.comp,horomComp:null,vidaUtil:dc.vidaUtil,costoRef:dc.costoRef,fechaInst:null,obs:'',estado:''});});});
  }
  if(!compData.length){
    var defaultComps=[
      {comp:'Motor',vidaUtil:15000,costoRef:45000000},
      {comp:'Transmisión',vidaUtil:12000,costoRef:35000000},
      {comp:'Diferencial',vidaUtil:12000,costoRef:25000000},
      {comp:'Convertidor',vidaUtil:10000,costoRef:20000000},
      {comp:'Mandos Finales',vidaUtil:10000,costoRef:18000000},
      {comp:'Bomba Hidráulica',vidaUtil:8000,costoRef:15000000},
      {comp:'Turbo',vidaUtil:12000,costoRef:8000000},
      {comp:'Cilindro de Dirección',vidaUtil:15000,costoRef:6000000},
      {comp:'Suspensión Delantera',vidaUtil:15000,costoRef:10000000},
      {comp:'Soporte de Cabina',vidaUtil:20000,costoRef:4000000},
      {comp:'Tolva',vidaUtil:25000,costoRef:15000000},
      {comp:'Asiento',vidaUtil:6000,costoRef:491000},
      {comp:'Batería',vidaUtil:4000,costoRef:435570},
      {comp:'Alternador',vidaUtil:6000,costoRef:399924},
      {comp:'Motor de Partida',vidaUtil:5000,costoRef:365938},
      {comp:'Bomba de Combustible',vidaUtil:8000,costoRef:1316032}
    ];
    eq.forEach(function(e){
      defaultComps.forEach(function(dc){
        compData.push({sigla:e.sigla,tipo:e.tipo,modelo:e.modelo,comp:dc.comp,
          horomComp:null,vidaUtil:dc.vidaUtil,costoRef:dc.costoRef,
          fechaInst:null,obs:'',estado:''});
      });
    });
  }
  if(JSON.stringify(compData)!==compDataAntes)S.s('compMayores',compData);

  var fil=fEquipo?compData.filter(function(c){return c.sigla===fEquipo}):compData;
  var siglas=[...new Set(compData.map(function(c){return c.sigla}))];

  // Índice de lecturas reales por equipo (para estimar el horómetro de instalación).
  var histComp=S.g('hist')||[];
  var lecturasPorSigla={};
  histComp.forEach(function(h){
    if(!h||!h.sigla||!h.fecha)return;
    var val=(h.horomFin!=null?h.horomFin:h.horom);
    if(val==null)return;
    (lecturasPorSigla[h.sigla]=lecturasPorSigla[h.sigla]||[]).push({fecha:h.fecha,horom:val});
  });
  var HOY_COMP=new Date().toISOString().slice(0,10);

  // Estado de vida útil — fuente única compEstado (logic.js). Sin fecha de instalación
  // NO se inventa un % ni un "OK": el componente queda como "falta instalación". Si hay
  // fecha pero NO horómetro de instalación medido, se ESTIMA el horómetro a esa fecha
  // desde la tasa real del equipo (horomEnFecha) y se marca como estimado (≈).
  fil.forEach(function(c){
    var eqObj=eq.find(function(e){return e.sigla===c.sigla});
    var horomActual=eqObj?eqObj.horomActual:0;
    var hrsDia=eqObj?eqObj.hrsDia:12;
    var inicio=eqObj?eqObj.inicioOper:null;
    var horomComp=c.horomComp;
    c._estimado=false;c._metodoEst='';
    // Original → horas usadas = horómetro completo, no se estima. Si no es original y
    // hay fecha pero no horómetro medido, se estima anclando en la puesta en marcha.
    if(!c.esOriginal&&(horomComp==null||horomComp===''||isNaN(horomComp))&&c.fechaInst){
      var e=horomEnFecha(lecturasPorSigla[c.sigla]||[],c.fechaInst,horomActual,HOY_COMP,hrsDia,inicio);
      horomComp=e.horom;c._estimado=true;c._metodoEst=e.metodo;
    }
    c._horomEff=horomComp;
    var st=compEstado({esOriginal:c.esOriginal,fechaInst:c.fechaInst,horomComp:horomComp,vidaUtil:c.vidaUtil},horomActual,hrsDia);
    c._st=st;
    c.hrsUsadas=st.hrsUsadas;c.hrsRest=st.hrsRest;c.pctVida=st.pctVida;
    c.diasRest=st.diasRest;c.estadoCalc=st.estado;
  });

  var sinDato=fil.filter(function(c){return !c._st.conDato}).length;
  var criticos=fil.filter(function(c){return c._st.conDato&&c.hrsRest<=1000}).length;
  var costoTotal=fil.filter(function(c){return c._st.conDato&&c.hrsRest<=2000}).reduce(function(s,c){return s+(c.costoRef||0)},0);

  $('s-comp').innerHTML=
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><polygon points="10,2.5 16,6 16,13 10,16.5 4,13 4,6"/><circle cx="10" cy="9.5" r="2.3"/></svg> Control de Componentes Mayores</div>'+
    '<div class="sec-s">'+compData.length+' componentes · '+eq.length+' equipos · Vida útil y proyección de cambio</div></div>'+
    '<div style="display:flex;gap:8px">'+
    '<button class="btn" onclick="addComp()">+ Agregar</button>'+
    '<button class="btn btn-o" onclick="exportCSV(\'comp\')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> CSV</button>'+
    '<button class="btn btn-o" onclick="importCompCSV()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar</button>'+
    '</div></div>'+
    '<div class="toolbar"><select id="fCompEq" onchange="renders.comp()"><option value="">Todos los equipos</option>'+
    siglas.map(function(s){return'<option'+(fEquipo===s?' selected':'')+'>'+s+'</option>'}).join('')+'</select></div>'+
    '<div class="cards">'+
    '<div class="card"><div class="card-t">Componentes</div><div class="card-v">'+fil.length+'</div></div>'+
    '<div class="card"><div class="card-t">🔴 Críticos (&lt;1000h)</div><div class="card-v" style="color:var(--danger)">'+criticos+'</div></div>'+
    '<div class="card"><div class="card-t">Costo Próximos Cambios</div><div class="card-v" style="color:var(--ac)">$'+Math.round(costoTotal).toLocaleString()+'</div><div class="card-s">Componentes &lt;2000h restantes</div></div>'+
    '<div class="card"><div class="card-t">⚪ Falta instalación</div><div class="card-v" style="color:var(--tx3)">'+sinDato+'</div><div class="card-s">Sin proyección hasta ingresar el dato</div></div>'+
    '</div>'+
    (sinDato?'<div style="background:rgba(148,163,184,.10);border:1px solid var(--bd);border-left:3px solid var(--w);border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:var(--tx2)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> <b>'+sinDato+' de '+fil.length+' componentes</b> sin datos para proyectar. Dos formas de completarlo: <b>(1)</b> si es el <b>original</b> del equipo (instalado nuevo), marca la casilla "Orig." → sus horas usadas = el horómetro completo. <b>(2)</b> si se cambió, ingresa la <b>fecha de instalación</b> y el sistema <b>estima el horómetro a esa fecha</b> anclando en la puesta en marcha del equipo (aparece con "≈"). <b>Ojo:</b> si el equipo ya acumuló más horas que la vida útil del componente, ese componente ya no es el original — usa la fecha del <b>último cambio</b>.</div>':'')+
    '<div class="tbl-wrap"><table>'+
    '<tr><th>Equipo</th><th>Componente</th><th title="Instalado con el equipo nuevo">Orig.</th><th>Horóm. Inst.</th><th>Fecha Inst.</th><th>Vida Útil</th><th>Hrs Usadas</th><th>% Vida</th><th>Hrs Rest</th><th>Días Rest</th><th>Costo Ref ($)</th><th>Estado</th><th>Obs</th><th></th></tr>'+
    fil.map(function(c,idx){
      var realIdx=compData.indexOf(c);
      var st=c._st;var cd=st.conDato;var dash='<span style="color:var(--tx3)">—</span>';var orig=!!c.esOriginal;
      return'<tr style="'+(cd&&c.hrsRest<=0?'background:rgba(239,68,68,.06)':(cd?'':'opacity:.72'))+'">'+
        '<td class="mono" style="color:var(--ac)">'+escapeHtml(c.sigla)+'</td>'+
        '<td class="ed" contenteditable onblur="edComp('+realIdx+',\'comp\',this.innerText.trim())" style="font-weight:600">'+c.comp+'</td>'+
        '<td style="text-align:center"><input type="checkbox" '+(orig?'checked':'')+' onchange="edComp('+realIdx+',\'esOriginal\',this.checked)" title="Componente original del equipo (instalado nuevo). Sus horas usadas = horómetro completo."></td>'+
        '<td class="mono">'+(orig?'<span style="color:var(--tx3);font-size:10px">nuevo</span>':('<span class="ed" contenteditable onblur="edComp('+realIdx+',\'horomComp\',this.innerText.trim()===\'\'?null:(parseFloat(this.innerText.replace(/[^0-9.]/g,\'\'))||null))" style="display:inline-block;min-width:36px">'+((c.horomComp==null||c.horomComp==='')?'':c.horomComp)+'</span>'+(c._estimado?' <span style="color:var(--tx3);font-size:10px" title="Horómetro estimado a la fecha de instalación anclando en la puesta en marcha del equipo ('+c._metodoEst+'). Ingresa el valor medido si lo tienes.">≈'+Number(c._horomEff).toLocaleString()+'</span>':'')))+'</td>'+
        '<td>'+(orig?dash:'<input type="date" value="'+(c.fechaInst||'')+'" onchange="edComp('+realIdx+',\'fechaInst\',this.value||null)" style="background:var(--bg3);color:var(--tx);border:1px solid var(--bd);border-radius:4px;padding:2px;font-size:10px">')+'</td>'+
        '<td class="mono ed" contenteditable onblur="edComp('+realIdx+',\'vidaUtil\',parseFloat(this.innerText)||0)">'+c.vidaUtil+'</td>'+
        '<td class="mono">'+(cd?c.hrsUsadas:dash)+'</td>'+
        '<td>'+(cd?'<div style="display:flex;align-items:center;gap:4px"><div style="background:color-mix(in srgb,'+st.barCol+' 18%,var(--bg4));border-radius:3px;height:8px;width:60px;overflow:hidden"><div style="background:'+st.barCol+';height:100%;width:'+Math.min(c.pctVida,100)+'%"></div></div><span style="font-size:10px">'+c.pctVida+'%</span></div>':dash)+'</td>'+
        '<td class="mono" style="color:'+(cd?(c.hrsRest<=0?'var(--danger)':c.hrsRest<1000?'var(--w)':'var(--ok)'):'var(--tx3)')+';font-weight:700">'+(cd?c.hrsRest:dash)+'</td>'+
        '<td class="mono">'+(cd?c.diasRest:dash)+'</td>'+
        '<td class="mono ed" contenteditable onblur="edComp('+realIdx+',\'costoRef\',parseFloat(this.innerText.replace(/[$.]/g,\'\'))||0)">$'+Math.round(c.costoRef||0).toLocaleString()+'</td>'+
        '<td style="font-size:11px">'+c.estadoCalc+'</td>'+
        '<td class="ed" contenteditable onblur="edComp('+realIdx+',\'obs\',this.innerText.trim())" style="font-size:10px;max-width:150px">'+escapeHtml(c.obs)+'</td>'+
        '<td><button class="btn-x" onclick="nuevoInforme(\''+escapeHtml(c.sigla)+'\','+realIdx+')" title="Generar informe de falla/cambio" style="margin-right:4px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="5,2 12,2 15,5 15,18 5,18"/><polyline points="12,2 12,5 15,5"/><line x1="7" y1="10" x2="13" y2="10"/><line x1="7" y1="13" x2="13" y2="13"/></svg></button><button class="btn-x" onclick="delComp('+realIdx+')" title="Eliminar"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg></button></td></tr>';
    }).join('')+
    '</table></div>';
};
window.edComp=function(idx,key,val){
  var d=S.g('compMayores')||[];
  _edCampo('compMayores',d,idx,key,val);
  refreshAll();
};
window.addComp=function(){
  var eq=S.g('eq')||[];
  if(!eq.length)return toast('⚠️ No hay equipos cargados');
  sm('<h3><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><polygon points="10,2.5 16,6 16,13 10,16.5 4,13 4,6"/><circle cx="10" cy="9.5" r="2.3"/></svg> Agregar Componente</h3>'+
    '<div class="form-row"><div class="fg"><label>Equipo</label><select id="cpEq">'+
    eq.map(function(e){return'<option>'+escapeHtml(e.sigla)+'</option>'}).join('')+'</select></div>'+
    '<div class="fg"><label>Componente</label><input id="cpNombre" value="Nuevo Componente"></div></div>'+
    '<br><button class="btn" onclick="saveNuevoComp()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
};
// addComp() pide equipo real por dropdown antes de crear la fila — antes creaba
// directo una fila con sigla:'NUEVO', que syncEquipos() (corre en cada
// refreshAll(), es decir después de CUALQUIER edición en CUALQUIER pestaña)
// borraba de inmediato por no reconocerla como equipo real, y la tabla no tiene
// celda editable de "Equipo" para corregirla — el botón "+ Agregar" parecía no
// hacer nada.
window.saveNuevoComp=function(){
  var sigla=$('cpEq').value;
  var nombre=($('cpNombre').value||'').trim()||'Nuevo Componente';
  var eq=S.g('eq')||[];
  var e=eq.find(function(x){return x.sigla===sigla});
  var d=S.g('compMayores')||[];
  d.push({sigla:sigla,tipo:e?e.tipo:'',modelo:e?e.modelo:'',comp:nombre,horomComp:0,vidaUtil:10000,costoRef:0,fechaInst:'',obs:'',estado:''});
  S.s('compMayores',d);cm();refreshAll();
};
window.delComp=function(idx){
  var d=S.g('compMayores')||[];
  if(confirm('¿Eliminar componente '+d[idx].comp+' de '+d[idx].sigla+'?')){
    _moverAPapelera('compMayores',d[idx]);
    d.splice(idx,1);S.s('compMayores',d);refreshAll();
  }
};
window.importCompCSV=function(){
  var inp=document.createElement('input');inp.type='file';inp.accept='.csv,.json';
  inp.onchange=function(ev){
    var f=ev.target.files[0];if(!f)return;
    var r=new FileReader();r.onload=function(e){
      try{
        if(f.name.endsWith('.json')){S.s('compMayores',JSON.parse(e.target.result));}
        else{
          var lines=e.target.result.split('\n');var d=S.g('compMayores')||[];
          for(var i=1;i<lines.length;i++){
            var c=lines[i].split(',');if(c.length<4)continue;
            d.push({sigla:c[0].trim(),comp:c[1].trim(),horomComp:parseFloat(c[2])||0,vidaUtil:parseFloat(c[3])||10000,costoRef:parseFloat(c[4])||0,tipo:'',modelo:'',obs:c[5]||'',fechaInst:'',estado:''});
          }
          S.s('compMayores',d);
        }
        refreshAll();alert('✅ Componentes importados');
      }catch(er){alert('❌ Error: '+er.message)}
    };r.readAsText(f);
  };inp.click();
};
