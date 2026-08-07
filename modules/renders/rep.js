// Pestaña Control de Repuestos (sub-pestaña de Costos & Stock) —
// extraída a su propio archivo (Fase 2 de modularización). Script plano
// (NO módulo ES), mismo scope global de siempre.
window.renderRep = function () {
  if (!$("s-rep")) return;
  var rep = S.g('repuestos') || [];
  var mov = S.g('mov') || [];
  var stk = S.g('stk') || [];
  var lub = S.g('lub') || [];
  var eq = S.g('eq') || [];
  var fEst = $('fRepEst')?.value || '';
  var fEq = $('fRepEq')?.value || '';
  var fBusq = $('fRepBusq')?.value || '';
  var allEq = eq.map(function (e) { return e.sigla }).sort();

  // Auto-generate from stock+lub if empty — si stk/lub TAMBIÉN están vacíos
  // (ej. empresa recién reseteada), rep quedaba en [] y este bloque volvía a
  // guardar S.s('repuestos',[]) en cada refresco de pantalla para siempre
  // (mismo bug ya arreglado en metas.js/prg.js: guardado incondicional sin
  // comparar antes/después).
  var repAntes = JSON.stringify(rep);
  if (rep.length === 0) {
    stk.forEach(function (s) {
      rep.push({
        componente: s.descripcion || '', nParte: s.nParte || '', equipo: s.equipoModelo || '', tipo: 'Filtro',
        stockActual: s.stockBodega || 0, stockMinimo: Math.max(Math.round((s.consumoMes || 1) * 1.5), 2),
        leadTime: 34, precioUnit: s.precioUnit || 0, proveedor: '', ultCompra: '',
        estado: ''
      });
    });
    lub.forEach(function (l) {
      rep.push({
        componente: l.nombre || '', nParte: '', equipo: 'Varios', tipo: 'Lubricante',
        stockActual: l.stock || 0, stockMinimo: Math.round((l.consumoMes || l.proyMes || 10) * 1.5),
        leadTime: 15, precioUnit: l.precio || 0, proveedor: '', ultCompra: '',
        estado: ''
      });
    });
  }
  if (JSON.stringify(rep) !== repAntes) S.s('repuestos', rep);

  // Calculate estado for each
  rep.forEach(function (r) {
    var ratio = (r.stockActual || 0) / (r.stockMinimo || 1);
    var leadMeses = (r.leadTime || 34) / 30;
    var consMes = r.stockMinimo / 1.5 || 1;
    var mesesStock = consMes > 0 ? (r.stockActual || 0) / consMes : 99;
    if (r.stockActual <= 0) r.estado = '🔴 SIN STOCK';
    else if (mesesStock < leadMeses) r.estado = '🔴 PEDIR YA';
    else if (ratio < 1) r.estado = '🟡 STOCK BAJO';
    else r.estado = '🟢 OK';
  });

  var fil = rep.filter(function (r) {
    if (fEst === 'rojo' && !r.estado.includes('🔴')) return false;
    if (fEst === 'amarillo' && !r.estado.includes('🟡')) return false;
    if (fEst === 'verde' && !r.estado.includes('🟢')) return false;
    if (fEq && r.equipo !== fEq && !r.equipo.includes(fEq)) return false;
    if (fBusq && !(r.componente || '').toLowerCase().includes(fBusq.toLowerCase()) && !(r.nParte || '').toLowerCase().includes(fBusq.toLowerCase())) return false;
    return true;
  });

  var rojos = rep.filter(function (r) { return r.estado.includes('🔴') }).length;
  var amarillos = rep.filter(function (r) { return r.estado.includes('🟡') }).length;
  var verdes = rep.filter(function (r) { return r.estado.includes('🟢') }).length;

  var pg = _pagSlice('rep', fil);
  var is = 'background:var(--bg3);border:1px solid var(--bd);color:var(--tx);text-align:center;border-radius:3px;font-size:11px;padding:2px';

  $('s-rep').innerHTML =
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="10,2 17,6 10,10 3,6"/><line x1="3" y1="6" x2="3" y2="13"/><line x1="17" y1="6" x2="17" y2="13"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="3" y1="13" x2="10" y2="18"/><line x1="17" y1="13" x2="10" y2="18"/></svg> Control de Repuestos</div>' +
    '<div class="sec-s">' + rep.length + ' componentes · Conectado con Predictivo</div></div>' +
    '<div><button class="btn" onclick="addRep()">+ Nuevo</button> <button class="btn btn-o" onclick="syncRepStock()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 10 A6 6 0 0 1 15.5 6.5" fill="none"/><polyline points="15.5,3 15.5,6.5 12,6.5"/><path d="M16 10 A6 6 0 0 1 4.5 13.5" fill="none"/><polyline points="4.5,17 4.5,13.5 8,13.5"/></svg> Sync Stock</button> <button class="btn btn-o" onclick="verOrdenesCompra()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,3 4,3 6,12 15,12 17,6 5,6"/><circle cx="7" cy="16" r="1.3"/><circle cx="14" cy="16" r="1.3"/></svg> Órdenes de Compra</button> <button class="btn btn-o" onclick="importRepCSV()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar Pedidos CSV</button></div></div>' +

    // Semáforo resumen
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">' +
    '<div class="card" style="cursor:pointer;border-left:3px solid #ef4444" onclick="$(\'fRepEst\').value=\'rojo\';window._pag.rep=1;renders.rep()"><div class="card-t">🔴 Sin Stock / Pedir</div><div class="card-v" style="color:#ef4444">' + rojos + '</div><div class="card-s">Acción inmediata</div></div>' +
    '<div class="card" style="cursor:pointer;border-left:3px solid #f59e0b" onclick="$(\'fRepEst\').value=\'amarillo\';window._pag.rep=1;renders.rep()"><div class="card-t">🟡 Stock Bajo</div><div class="card-v" style="color:#f59e0b">' + amarillos + '</div><div class="card-s">Planificar compra</div></div>' +
    '<div class="card" style="cursor:pointer;border-left:3px solid #22c55e" onclick="$(\'fRepEst\').value=\'verde\';window._pag.rep=1;renders.rep()"><div class="card-t">🟢 Stock OK</div><div class="card-v" style="color:#22c55e">' + verdes + '</div><div class="card-s">Sin acción</div></div>' +
    '<div class="card" style="cursor:pointer;border-left:3px solid var(--ac)" onclick="$(\'fRepEst\').value=\'\';window._pag.rep=1;renders.rep()"><div class="card-t">Total</div><div class="card-v">' + rep.length + '</div><div class="card-s">Todos</div></div>' +
    '</div>' +

    // Filtros
    '<div class="toolbar">' +
    '<select id="fRepEst" onchange="window._pag.rep=1;renders.rep()"><option value="">Todos</option>' +
    '<option value="rojo"' + (fEst === 'rojo' ? ' selected' : '') + '>🔴 Críticos</option>' +
    '<option value="amarillo"' + (fEst === 'amarillo' ? ' selected' : '') + '>🟡 Bajo</option>' +
    '<option value="verde"' + (fEst === 'verde' ? ' selected' : '') + '>🟢 OK</option></select>' +
    '<select id="fRepEq" onchange="window._pag.rep=1;renders.rep()"><option value="">Todos equipos</option>' +
    allEq.map(function (e) { return '<option' + (fEq === e ? ' selected' : '') + '>' + e + '</option>' }).join('') +
    '<option' + (fEq === 'Varios' ? ' selected' : '') + '>Varios</option></select>' +
    '<input id="fRepBusq" placeholder="Buscar componente/N°parte..." value="' + (fBusq || '') + '" onchange="window._pag.rep=1;renders.rep()" style="max-width:200px">' +
    '<button class="btn btn-o" style="font-size:11px" onclick="$(\'fRepEst\').value=\'\';$(\'fRepEq\').value=\'\';$(\'fRepBusq\').value=\'\';window._pag.rep=1;renders.rep()">Limpiar</button>' +
    '</div>' +
    _pagHTML('rep', pg) +

    // Tabla
    '<div class="tbl-wrap"><table>' +
    '<tr><th>Estado</th><th>Componente <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>N°Parte <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Equipo <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Tipo</th><th>Stock <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Mínimo <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Lead Time <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Precio <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Proveedor <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Acción</th><th></th></tr>' +
    pg.items.map(function (r) {
      var i = rep.indexOf(r);
      var bg = r.estado.includes('🔴') ? 'rgba(239,68,68,.06)' : r.estado.includes('🟡') ? 'rgba(245,158,11,.04)' : '';
      var accion = '';
      if (r.estado.includes('SIN STOCK')) accion = '<button class="btn-s" style="background:var(--danger);color:white;font-size:10px" onclick="crearOC(' + i + ')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,3 4,3 6,12 15,12 17,6 5,6"/><circle cx="7" cy="16" r="1.3"/><circle cx="14" cy="16" r="1.3"/></svg> Comprar</button>';
      else if (r.estado.includes('PEDIR')) accion = '<button class="btn-s" style="background:var(--danger);color:white;font-size:10px" onclick="crearOC(' + i + ')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,3 4,3 6,12 15,12 17,6 5,6"/><circle cx="7" cy="16" r="1.3"/><circle cx="14" cy="16" r="1.3"/></svg> Comprar</button>';
      else if (r.estado.includes('BAJO')) accion = '<button class="btn-s" style="background:var(--w);color:black;font-size:10px" onclick="crearOC(' + i + ')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Planificar</button>';
      else accion = '<span style="font-size:10px;color:var(--ok)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> OK</span>';

      return '<tr style="background:' + bg + '">' +
        '<td style="font-size:11px;white-space:nowrap">' + r.estado + '</td>' +
        '<td><input value="' + escapeHtml(r.componente || '') + '" onchange="edRep(' + i + ',\'componente\',this.value)" style="width:100%;background:transparent;border:none;color:var(--tx);font-size:11px"></td>' +
        '<td><input value="' + escapeHtml(r.nParte || '') + '" onchange="edRep(' + i + ',\'nParte\',this.value)" style="width:80px;background:transparent;border:none;color:var(--tx3);font-size:10px"></td>' +
        '<td><input value="' + escapeHtml(r.equipo || '') + '" onchange="edRep(' + i + ',\'equipo\',this.value)" style="width:70px;background:transparent;border:none;color:var(--tx);font-size:10px"></td>' +
        '<td style="font-size:10px">' + (r.tipo || '') + '</td>' +
        '<td><input type="number" value="' + (r.stockActual || 0) + '" onchange="edRep(' + i + ',\'stockActual\',parseInt(this.value)||0)" style="width:45px;' + is + ';color:var(--ac);font-weight:600"></td>' +
        '<td><input type="number" value="' + (r.stockMinimo || 0) + '" onchange="edRep(' + i + ',\'stockMinimo\',parseInt(this.value)||0)" style="width:45px;' + is + '"></td>' +
        '<td><input type="number" value="' + (r.leadTime || 34) + '" onchange="edRep(' + i + ',\'leadTime\',parseInt(this.value)||0)" style="width:40px;' + is + '"><span style="font-size:9px;color:var(--tx3)">d</span></td>' +
        '<td><input type="number" value="' + (r.precioUnit || 0) + '" onchange="edRep(' + i + ',\'precioUnit\',parseInt(this.value)||0)" style="width:55px;' + is + '"></td>' +
        '<td><input value="' + escapeHtml(r.proveedor || '') + '" onchange="edRep(' + i + ',\'proveedor\',this.value)" style="width:90px;background:transparent;border:none;color:var(--tx);font-size:10px" placeholder="Proveedor..."></td>' +
        '<td>' + accion + '</td>' +
        '<td><button class="btn-s btn-d" onclick="delRep(' + i + ')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg></button></td></tr>';
    }).join('') +
    '</table></div>' +
    _pagHTML('rep', pg);
};

window.edRep = function (i, key, val) {
  var rep = S.g('repuestos') || [];
  if (_edCampo('repuestos', rep, i, key, val)) { refreshAll(); toast('✅ Guardado'); }
};
window.delRep = function (i) {
  if (!confirm('¿Eliminar?')) return;
  var rep = S.g('repuestos') || []; _moverAPapelera('repuestos', rep[i]); rep.splice(i, 1); S.s('repuestos', rep); refreshAll();
  toast('🗑️ Eliminado');
};
window.addRep = function () {
  var eq = S.g('eq') || [];
  sm('<h3><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="10,2 17,6 10,10 3,6"/><line x1="3" y1="6" x2="3" y2="13"/><line x1="17" y1="6" x2="17" y2="13"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="3" y1="13" x2="10" y2="18"/><line x1="17" y1="13" x2="10" y2="18"/></svg> Nuevo Repuesto</h3>' +
    '<div class="form-row"><div class="fg" style="flex:2"><label>Componente</label><input id="rComp" style="width:100%"></div>' +
    '<div class="fg"><label>N°Parte</label><input id="rNP"></div></div>' +
    '<div class="form-row"><div class="fg"><label>Equipo</label><select id="rEqR"><option>Varios</option>' +
    eq.map(function (e) { return '<option>' + escapeHtml(e.sigla) + '</option>' }).join('') + '</select></div>' +
    '<div class="fg"><label>Tipo</label><select id="rTipoR"><option>Filtro</option><option>Lubricante</option><option>Repuesto</option><option>Neumático</option><option>Correa</option><option>Otro</option></select></div></div>' +
    '<div class="form-row"><div class="fg"><label>Stock actual</label><input type="number" id="rStkA" value="0"></div>' +
    '<div class="fg"><label>Stock mínimo</label><input type="number" id="rStkM" value="2"></div>' +
    '<div class="fg"><label>Lead time (días)</label><input type="number" id="rLT" value="34"></div>' +
    '<div class="fg"><label>Precio unit.</label><input type="number" id="rPU" value="0"></div></div>' +
    '<div class="form-row"><div class="fg" style="flex:1"><label>Proveedor</label><input id="rProv" style="width:100%"></div></div>' +
    '<button class="btn" onclick="saveRep()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
};
window.saveRep = function () {
  var rep = S.g('repuestos') || [];
  rep.push({
    componente: $('rComp').value, nParte: $('rNP').value, equipo: $('rEqR').value, tipo: $('rTipoR').value,
    stockActual: parseInt($('rStkA').value) || 0, stockMinimo: parseInt($('rStkM').value) || 2,
    leadTime: parseInt($('rLT').value) || 34, precioUnit: parseInt($('rPU').value) || 0,
    proveedor: $('rProv').value, ultCompra: '', estado: ''
  });
  S.s('repuestos', rep); cm(); refreshAll(); toast('✅ Repuesto agregado');
};
window.crearOC = function (i) {
  var rep = S.g('repuestos') || []; var r = rep[i];
  if (!r) return;
  var cantPedir = Math.max((r.stockMinimo || 2) - (r.stockActual || 0), 1);
  var costoEst = cantPedir * (r.precioUnit || 0);
  sm('<h3><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,3 4,3 6,12 15,12 17,6 5,6"/><circle cx="7" cy="16" r="1.3"/><circle cx="14" cy="16" r="1.3"/></svg> Orden de Compra</h3>' +
    '<div class="card" style="margin-bottom:12px;border-left:3px solid var(--ac)">' +
    '<b>' + escapeHtml(r.componente) + '</b> (' + escapeHtml(r.nParte || 'sin N°parte') + ')<br>' +
    'Equipo: ' + escapeHtml(r.equipo) + ' · Lead time: ' + r.leadTime + ' días<br>' +
    'Stock actual: <b style="color:var(--danger)">' + (r.stockActual || 0) + '</b> · Mínimo: ' + r.stockMinimo +
    '</div>' +
    '<div class="form-row"><div class="fg"><label>Cantidad a pedir</label><input type="number" id="ocCant" value="' + cantPedir + '"></div>' +
    '<div class="fg"><label>Costo estimado</label><input type="number" id="ocCosto" value="' + costoEst + '" readonly style="opacity:.7"></div></div>' +
    '<div class="form-row"><div class="fg"><label>Proveedor</label><input id="ocProv" value="' + escapeHtml(r.proveedor || '') + '"></div>' +
    '<div class="fg"><label>Fecha pedido</label><input type="date" id="ocFecha" value="' + new Date().toISOString().slice(0, 10) + '"></div></div>' +
    '<div class="form-row"><div class="fg" style="flex:1"><label>Observaciones</label><input id="ocObs" style="width:100%"></div></div>' +
    '<button class="btn" onclick="confirmarOC(' + i + ')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> Confirmar Pedido</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
};
window.confirmarOC = function (i) {
  var rep = S.g('repuestos') || []; var r = rep[i];
  var oc = S.g('ordenes') || [];
  oc.push({
    fecha: $('ocFecha').value, componente: r.componente, nParte: r.nParte, equipo: r.equipo,
    cantidad: parseInt($('ocCant').value) || 1, costoEstimado: parseInt($('ocCosto').value) || 0,
    proveedor: $('ocProv').value, obs: $('ocObs').value,
    estado: 'Pendiente', fechaEntrega: ''
  });
  r.ultCompra = $('ocFecha').value;
  r.proveedor = $('ocProv').value;
  S.s('ordenes', oc); S.s('repuestos', rep);
  cm(); refreshAll();
  toast('🛒 OC creada — ' + r.componente + ' x' + $('ocCant').value);
};
// Panel de Órdenes de Compra — hasta ahora 'ordenes' se creaba desde crearOC()
// pero no existía ninguna pantalla para verlas ni marcarlas como recibidas, así
// que quedaban "Pendiente" para siempre sin que nada avisara cuando llegaban.
window.verOrdenesCompra = function () {
  var oc = S.g('ordenes') || [];
  var lista = oc.slice().sort(function (a, b) { return (b.fecha || '').localeCompare(a.fecha || '') });
  sm('<h3><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,3 4,3 6,12 15,12 17,6 5,6"/><circle cx="7" cy="16" r="1.3"/><circle cx="14" cy="16" r="1.3"/></svg> Órdenes de Compra</h3>' +
    '<div class="tbl-wrap" style="max-height:420px;overflow:auto"><table>' +
    '<tr><th>Fecha</th><th>Componente</th><th>Equipo</th><th>Cant.</th><th>Proveedor</th><th>Estado</th><th></th></tr>' +
    (lista.length ? lista.map(function (o) {
      var i = oc.indexOf(o);
      var estadoHtml = o.estado === 'Recibida'
        ? '<span style="font-size:11px;color:var(--ok)">✅ Recibida' + (o.fechaEntrega ? ' ' + o.fechaEntrega : '') + '</span>'
        : '<span style="font-size:11px;color:var(--w)">🛒 Pendiente</span>';
      var accionHtml = o.estado === 'Recibida' ? '' : '<button class="btn-s" onclick="recibirOC(' + i + ')">Marcar Recibida</button>';
      return '<tr>' +
        '<td class="mono" style="font-size:10px">' + (o.fecha || '') + '</td>' +
        '<td style="font-size:11px">' + escapeHtml(o.componente || '') + '</td>' +
        '<td style="font-size:10px">' + escapeHtml(o.equipo || '') + '</td>' +
        '<td style="text-align:center">' + (o.cantidad || 0) + '</td>' +
        '<td style="font-size:10px">' + escapeHtml(o.proveedor || '') + '</td>' +
        '<td>' + estadoHtml + '</td><td>' + accionHtml + '</td></tr>';
    }).join('') : '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--tx3)">Sin órdenes de compra</td></tr>') +
    '</table></div>' +
    '<button class="btn btn-o" onclick="cm()" style="margin-top:10px">Cerrar</button>');
};
// Marca una OC como recibida y, si tenía filas de Gestión de Destrabe bloqueadas
// esperándola (destrabe.idOrdenCompra), las resuelve solas (resolverDestrabePorOC
// en logic.js) — no toca el estadoOT del correctivo, eso lo confirma el técnico.
window.recibirOC = function (i) {
  var oc = S.g('ordenes') || []; var o = oc[i];
  if (!o) return;
  var hoy = new Date().toISOString().slice(0, 10);
  o.estado = 'Recibida'; o.fechaEntrega = hoy;
  S.s('ordenes', oc);
  var destrabe = S.g('destrabe') || [];
  var nPendientes = destrabe.filter(function (d) { return d.idOrdenCompra === o._id && d.estado !== 'Resuelto' }).length;
  if (nPendientes > 0) {
    S.s('destrabe', resolverDestrabePorOC(destrabe, o._id, hoy));
  }
  refreshAll(); verOrdenesCompra();
  toast('✅ OC marcada como recibida' + (nPendientes ? ' — ' + nPendientes + ' bloqueo(s) de Destrabe resuelto(s)' : ''));
};
window.syncRepStock = function () {
  var rep = S.g('repuestos') || [];
  var stk = S.g('stk') || [];
  var lub = S.g('lub') || [];
  var updated = 0;
  rep.forEach(function (r) {
    if (r.tipo === 'Filtro') {
      var f = stk.find(function (s) { return s.descripcion === r.componente || s.nParte === r.nParte });
      if (f) { r.stockActual = f.stockBodega || 0; updated++; }
    } else if (r.tipo === 'Lubricante') {
      var l = lub.find(function (lb) { return lb.nombre === r.componente });
      if (l) { r.stockActual = l.stock || 0; updated++; }
    }
  });
  S.s('repuestos', rep); refreshAll();
  toast('🔄 ' + updated + ' items sincronizados con Stock/Lubricantes');
};


window.importRepCSV = function () {
  sm('<h3><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar Pedidos (CSV)</h3>' +
    '<p style="font-size:12px;color:var(--tx3)">Sube el CSV de pedidos con columnas:<br>' +
    'nPI, fecha, sigla, cantidad, detalle, tiempo, fechaEstado, OC, cantAprobada, precioUnit, costo, rutProv, proveedor<br><br>' +
    'El sistema extraerá cada item único, calculará stock mínimo, lead time promedio y último precio.</p>' +
    '<input type="file" id="repFile" accept=".csv" style="margin:12px 0"><br>' +
    '<div style="margin:8px 0"><label><input type="checkbox" id="repMerge" checked> Fusionar con repuestos existentes (si no, reemplaza todo)</label></div>' +
    '<button class="btn" onclick="processRepCSV()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Procesar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
};
window.processRepCSV = function () {
  var file = $('repFile')?.files[0];
  if (!file) return toast('⚠️ Selecciona un archivo CSV');
  var merge = $('repMerge')?.checked !== false;
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var lines = e.target.result.split('\n').filter(function (l) { return l.trim(); });
      var headers = lines[0].split(',').map(function (h) { return h.trim().replace(/"/g, ''); });

      // Parse all rows and aggregate by item
      var items = {};
      var targetEq = ['CN-9507', 'CN-9503', 'CN-9500', 'CN-9501', 'CN-9502', 'CN-9506', 'CN-4656', 'CN-6113', 'CN-10155',
        'CF-9510', 'CF-8769', 'CF-9511', 'CF-9513', 'BD-9533', 'BD-9509', 'BD-10139',
        'MN-6112', 'MN-5926', 'RE-8726', 'TI-5141', 'TI-5142', 'TI-5143', 'TI-5144', 'TI-5145', 'TI-5146',
        'CA-5139', 'CA-5138', 'CN-5133', 'CN-5131', 'CN-3475', 'CN-3465', 'MC-4922'];

      for (var i = 1; i < lines.length; i++) {
        // Smart CSV split (handle commas in quotes)
        var vals = lines[i].match(/(".*?"|[^,]+)/g) || [];
        vals = vals.map(function (v) { return v.replace(/^"|"$/g, '').trim(); });

        var row = {};
        headers.forEach(function (h, j) { row[h] = vals[j] || ''; });

        var sigla = row.sigla || '';
        var detalle = row.detalle || '';
        var precio = parseFloat(row.precioUnit) || 0;
        var cant = parseFloat(row.cantidad) || 1;
        var tiempo = row.tiempo || '';
        var fecha = row.fecha || '';
        var proveedor = row.proveedor || '';

        if (!sigla || !detalle) continue;
        if (targetEq.indexOf(sigla) < 0) continue;

        var key = detalle.substring(0, 50);
        if (!items[key]) {
          items[key] = {
            componente: detalle, equipos: {}, totalPedidos: 0, totalCant: 0,
            precioUlt: 0, leadDays: [], ultFecha: '', proveedor: '', meses: {}
          };
        }
        items[key].equipos[sigla] = true;
        items[key].totalPedidos++;
        items[key].totalCant += cant;
        if (precio > 0) items[key].precioUlt = precio;
        if (proveedor) items[key].proveedor = proveedor;
        if (fecha > items[key].ultFecha) items[key].ultFecha = fecha;

        // Lead time
        if (tiempo.indexOf('dias') >= 0) {
          var d = parseInt(tiempo);
          if (d > 0 && d < 500) items[key].leadDays.push(d);
        }
        // Month tracking
        var mes = fecha.substring(0, 7);
        if (mes) items[key].meses[mes] = (items[key].meses[mes] || 0) + cant;
      }

      // Build repuestos array
      var rep = merge ? (S.g('repuestos') || []) : [];
      var existingNames = rep.map(function (r) { return (r.componente || '').toLowerCase(); });
      var added = 0;

      Object.keys(items).sort(function (a, b) { return items[b].totalPedidos - items[a].totalPedidos; }).forEach(function (key) {
        var it = items[key];
        // Skip if already exists (merge mode)
        if (merge && existingNames.indexOf(it.componente.toLowerCase().substring(0, 50)) >= 0) return;

        var eqList = Object.keys(it.equipos);
        var nMeses = Object.keys(it.meses).length || 1;
        var promMes = Math.round(it.totalCant / nMeses * 10) / 10;
        var avgLead = it.leadDays.length > 0 ? Math.round(it.leadDays.reduce(function (a, b) { return a + b }, 0) / it.leadDays.length) : 34;

        // Determine type
        var det = it.componente.toLowerCase();
        var tipo = 'Repuesto';
        if (det.indexOf('filtro') >= 0) tipo = 'Filtro';
        else if (det.indexOf('aceite') >= 0 || det.indexOf('mobil') >= 0 || det.indexOf('grasa') >= 0 || det.indexOf('lubri') >= 0) tipo = 'Lubricante';
        else if (det.indexOf('neumatico') >= 0 || det.indexOf('neumático') >= 0) tipo = 'Neumático';
        else if (det.indexOf('correa') >= 0) tipo = 'Correa';

        rep.push({
          componente: it.componente,
          nParte: '',
          equipo: eqList.length <= 3 ? eqList.join(', ') : 'Varios (' + eqList.length + ')',
          tipo: tipo,
          stockActual: 0,
          stockMinimo: Math.max(Math.round(promMes * 1.5), 1),
          leadTime: avgLead,
          precioUnit: it.precioUlt,
          proveedor: it.proveedor,
          ultCompra: it.ultFecha,
          totalHistorico: it.totalPedidos,
          promMes: promMes,
          estado: ''
        });
        added++;
      });

      S.s('repuestos', rep);
      cm(); refreshAll();
      toast('✅ ' + added + ' items importados desde ' + lines.length + ' pedidos');
    } catch (err) {
      toast('❌ Error: ' + err.message);
      console.error(err);
    }
  };
  reader.readAsText(file);
};
