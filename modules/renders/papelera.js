// Pestaña Papelera (soft-delete con recuperación, retención 30 días) — mismo
// patrón que log.js: verPapelera() la abre como modal (sm() + <div id="s-papelera">
// vacío), renderPapelera() lo llena. Los helpers _moverAPapelera/_restaurarDePapelera/
// _purgarPapeleraVieja viven en index.html (compartidos por los ~18 puntos de
// eliminación que alimentan esta papelera).
const _PAPELERA_LABEL={
  reg:'Registro de Mantención',ot:'Correctivos / OT',mov:'Movimientos de Stock',
  hist:'Historial de Horómetros',pau:'Pautas',stk:'Stock de Filtros',
  lub:'Lubricantes',repuestos:'Repuestos',compMayores:'Componentes Mayores',
  insp:'Inspecciones',aceite:'Análisis de Aceite',planSem:'Plan Semanal',
  destrabe:'Destrabe',eq:'Equipos',informesFalla:'Informes de Falla',
  progDia:'Programación Diaria',cad:'Tren de Rodaje'
};
function _papeleraResumen(fila){
  if(!fila)return'—';
  var id=fila.sigla||fila.equipo||fila.nombre||fila.componente||fila.item||fila.nParte||fila.comp||'';
  var fecha=fila.fecha||fila.fechaEntrada||fila.fechaSol||fila.fechaInst||'';
  var partes=[id,fecha].filter(function(x){return x;});
  return partes.length?escapeHtml(partes.join(' · ')):'—';
}
window.verPapelera=function(){
  sm('<div style="max-width:950px"><div id="s-papelera"></div><button class="btn btn-o" style="margin-top:12px" onclick="cm()">Cerrar</button></div>');
  renders.papelera();
};
window.renderPapelera=function(){
  var pap=S.g('papelera')||[];
  var fCat=$('fPapCat')?.value||'';
  var fil=pap.filter(function(p){return!fCat||p.categoria===fCat;}).sort(function(a,b){return(b.fechaEliminacion||'').localeCompare(a.fechaEliminacion||'');});
  var categorias=[...new Set(pap.map(function(p){return p.categoria;}))].sort();
  var pg=_pagSlice('papelera',fil);
  $('s-papelera').innerHTML=
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="4,6 16,6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><path d="M5.5 6 6.5 17 13.5 17 14.5 6"/></svg> Papelera</div>'+
    '<div class="sec-s">'+pap.length+' elemento(s) · Se eliminan solos a los 30 días</div></div>'+
    (pap.length?'<button class="btn btn-o" onclick="if(confirm(\'¿Vaciar la papelera? Esto elimina TODO de forma permanente, sin poder recuperarlo.\')){S.s(\'papelera\',[]);renders.papelera();}">Vaciar papelera</button>':'')+
    '</div>'+
    '<div class="toolbar">'+
    '<select id="fPapCat" onchange="window._pag.papelera=1;renders.papelera()"><option value="">Todas las categorías</option>'+
    categorias.map(function(c){return '<option value="'+c+'"'+(fCat===c?' selected':'')+'>'+(_PAPELERA_LABEL[c]||c)+'</option>';}).join('')+'</select></div>'+
    _pagHTML('papelera',pg)+
    '<div class="tbl-wrap"><table>'+
    '<tr><th>Eliminado</th><th>Categoría</th><th>Registro</th><th>Por</th><th></th></tr>'+
    pg.items.map(function(p){
      return '<tr><td class="mono" style="font-size:10px;white-space:nowrap">'+escapeHtml((p.fechaEliminacion||'').replace('T',' ').slice(0,19))+'</td>'+
        '<td style="font-size:11px">'+escapeHtml(_PAPELERA_LABEL[p.categoria]||p.categoria)+'</td>'+
        '<td style="font-size:11px">'+_papeleraResumen(p.fila)+'</td>'+
        '<td style="font-size:11px">'+escapeHtml(p.eliminadoPor||'—')+'</td>'+
        '<td style="white-space:nowrap"><button class="btn-x" title="Restaurar" onclick="_restaurarDePapelera(\''+p._id+'\')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10 a6 6 0 1 1 1.8 4.2" fill="none"/><polyline points="4,6 4,10 8,10"/></svg></button> '+
        '<button class="btn-x" title="Eliminar definitivamente" onclick="if(confirm(\'¿Eliminar definitivamente? No se puede deshacer.\')){var pp=S.g(\'papelera\')||[];pp=pp.filter(function(x){return x._id!==\''+p._id+'\'});S.s(\'papelera\',pp);renders.papelera();}"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg></button></td></tr>';
    }).join('')+
    '</table></div>'+
    _pagHTML('papelera',pg)+
    (pap.length?'':'<p style="padding:20px;color:var(--muted)">La papelera está vacía.</p>');
};
