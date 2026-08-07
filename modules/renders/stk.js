// Pestaña Stock Filtros (sub-pestaña de Stock & Insumos) — extraída a su
// propio archivo (Fase 2 de modularización). Script plano (NO módulo ES),
// mismo scope global de siempre. window.edI queda en index.html porque
// también lo usa renders.lub (ya extraída, comparte el mismo helper).
window.renderStk = function () {
  const stk = S.g('stk') || [];
  const mov = S.g('mov') || [];
  // Nivel en vivo (stockEstado) — no el estado guardado, para que conteo, filtro y tabla
  // usen todos el mismo criterio de quiebre-antes-del-lead-time.
  const _nivelStk = s => stockEstado((s.stockBodega || 0) + (s.pendiente || 0), s.consumoMes || s.proyMes, s.leadTime).nivel;
  const comprar = stk.filter(s => _nivelStk(s) === 'COMPRAR').length;
  const fEst = $('fStkEst')?.value || '';
  const fBusq = $('fStkBusq')?.value || '';
  // Last consumption date per item
  const lastUse = {}, totalCons = {};
  mov.forEach(function (m) {
    if (m.tipo === 'Filtro') {
      var key = m.item || '';
      if (!lastUse[key] || m.fecha > lastUse[key]) lastUse[key] = m.fecha;
      totalCons[key] = (totalCons[key] || 0) + (m.cant || 0);
    }
  });
  var filStk = stk.filter(function (s) {
    if (fEst && _nivelStk(s) !== fEst) return false;
    if (fBusq && !(s.descripcion || '').toLowerCase().includes(fBusq.toLowerCase()) && !(s.nParte || '').toLowerCase().includes(fBusq.toLowerCase())) return false;
    return true;
  });
  const pg = _pagSlice('stk', filStk);
  $('s-stk').innerHTML =
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="10,2 17,6 10,10 3,6"/><line x1="3" y1="6" x2="3" y2="13"/><line x1="17" y1="6" x2="17" y2="13"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="3" y1="13" x2="10" y2="18"/><line x1="17" y1="13" x2="10" y2="18"/></svg> Stock Filtros</div>' +
    '<div class="sec-s">' + stk.length + ' ítems · 🔴 ' + comprar + ' por comprar · <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg> Todo editable</div></div>' +
    '<button class="btn" onclick="addStock()">+ Nuevo</button> <button class="btn btn-o" onclick="importStkCSV()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar CSV</button> <button class="btn" style="background:#3ecf8e;color:#000" onclick="importarRepuestosKomatsu()"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="8"/><line x1="10" y1="6" x2="10" y2="11"/><circle cx="10" cy="14" r="0.6" fill="currentColor" stroke="none"/></svg> Repuestos Críticos Komatsu</button></div>' +
    '<div class="toolbar">' +
    '<select id="fStkEst" onchange="window._pag.stk=1;renders.stk()"><option value="">Todos</option><option' + (fEst === 'COMPRAR' ? ' selected' : '') + '>COMPRAR</option><option' + (fEst === 'BAJO' ? ' selected' : '') + '>BAJO</option><option' + (fEst === 'OK' ? ' selected' : '') + '>OK</option></select>' +
    '<input id="fStkBusq" placeholder="Buscar filtro/N°parte..." aria-label="Buscar filtro o número de parte" value="' + (fBusq || '') + '" onchange="window._pag.stk=1;renders.stk()" style="max-width:200px"></div>' +
    _pagHTML('stk', pg) +
    '<div class="tbl-wrap"><table>' +
    '<tr><th>Equipo <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Descripción <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>N°Parte <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Stock <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Consumido</th><th>Cons/Mes <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Últ.Fecha</th><th>Proy/Mes <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Meses</th><th>Estado</th><th>Precio <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th></th></tr>' +
    pg.items.map(function (s) {
      var i = stk.indexOf(s);
      var lastD = lastUse[s.descripcion] || lastUse[s.nParte] || '—';
      var acum = Math.round(totalCons[s.descripcion] || totalCons[s.nParte] || 0);
      var proy = s.proyMes || 0;
      var cm = s.consumoMes || 0;
      // Estado por lo que llegue primero al lead time (misma fuente que dashboard y
      // predictivo, ver stockEstado). El stock efectivo incluye lo pendiente de llegar.
      var se = stockEstado((s.stockBodega || 0) + (s.pendiente || 0), cm || proy, s.leadTime);
      var meses = se.meses != null ? se.meses : 0;
      var est = se.ico + ' ' + se.txt;
      var is = 'background:var(--bg3);border:1px solid var(--bd);color:var(--tx);text-align:center;border-radius:3px;font-size:11px;padding:2px';
      return '<tr>' +
        '<td><input value="' + escapeHtml(s.equipoModelo || '') + '" onchange="edI(\'stk\',' + i + ',\'equipoModelo\',this.value)" style="width:70px;background:transparent;border:none;color:var(--tx);font-size:10px"></td>' +
        '<td><input value="' + escapeHtml(s.descripcion || '') + '" onchange="edI(\'stk\',' + i + ',\'descripcion\',this.value)" style="width:100%;background:transparent;border:none;color:var(--tx);font-size:11px"></td>' +
        '<td><input value="' + escapeHtml(s.nParte || '') + '" onchange="edI(\'stk\',' + i + ',\'nParte\',this.value)" style="width:90px;background:transparent;border:none;color:var(--tx3);font-size:10px">' + (s.codAlt ? '<div style="font-size:9px;color:var(--ac);opacity:.8" title="Código alterno (ex Tabla de Precios)">' + escapeHtml(s.codAlt) + '</div>' : '') + '</td>' +
        '<td><input type="number" value="' + (s.stockBodega || 0) + '" onchange="edI(\'stk\',' + i + ',\'stockBodega\',parseInt(this.value)||0)" style="width:45px;' + is + ';color:var(--ac);font-weight:600"></td>' +
        '<td style="text-align:center;font-size:11px;color:var(--tx3)">' + acum + '</td>' +
        '<td><input type="number" value="' + cm + '" onchange="edI(\'stk\',' + i + ',\'consumoMes\',parseInt(this.value)||0)" style="width:40px;' + is + '"></td>' +
        '<td style="font-size:10px;color:var(--tx3)">' + lastD + '</td>' +
        '<td><input type="number" value="' + proy + '" onchange="edI(\'stk\',' + i + ',\'proyMes\',parseInt(this.value)||0)" style="width:40px;' + is + ';color:var(--w);font-weight:600" title="Proyección manual"></td>' +
        '<td style="text-align:center;font-weight:600;color:' + (se.nivel === 'COMPRAR' ? 'var(--danger)' : se.nivel === 'BAJO' ? 'var(--w)' : 'var(--ok)') + '" title="' + escapeHtml(se.motivo) + '">' + meses.toFixed(1) + '</td>' +
        '<td><span style="font-size:10px">' + est + '</span></td>' +
        '<td><input type="number" value="' + (s.precioUnit || 0) + '" onchange="edI(\'stk\',' + i + ',\'precioUnit\',parseInt(this.value)||0)" style="width:55px;' + is + (s.precioUnit ? '' : ';color:var(--tx3);border-style:dashed') + '" title="' + (s.precioUnit ? '' : 'Sin precio cargado (no confirmado que valga $0)') + '"></td>' +
        '<td><button class="btn-s btn-d" onclick="delRow(\'stk\',' + i + ',\'stk\')" title="Eliminar"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg></button></td></tr>';
    }).join('') +
    '</table></div>' +
    _pagHTML('stk', pg);
};
window.addStock = function () {
  sm(`<h3>Nuevo Filtro</h3>
    <div class="form-row"><div class="fg"><label>Equipo/Modelo</label><input id="sEq"></div><div class="fg"><label>Descripción</label><input id="sDesc"></div></div>
    <div class="form-row"><div class="fg"><label>N° Parte</label><input id="sParte"></div><div class="fg"><label>Stock</label><input type="number" id="sStk" value="0"></div><div class="fg"><label>Consumo/Mes</label><input type="number" id="sCon" value="1"></div></div>
    <div class="form-row"><div class="fg"><label>Precio Unit.</label><input type="number" id="sPre" value="0"></div></div>
    <button class="btn" onclick="saveStock()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button> <button type="button" class="btn btn-o" onclick="_iniciarStockPorVoz()">${ICONS.mic} Completar por voz</button>`);
};
window.saveStock = function () {
  const stk = S.g('stk') || [];
  stk.push({ equipoModelo: $('sEq').value, descripcion: $('sDesc').value, nParte: $('sParte').value, stockBodega: parseInt($('sStk').value) || 0, consumoMes: parseInt($('sCon').value) || 1, pendiente: 0, mesesCubierto: 0, precioUnit: parseInt($('sPre').value) || 0, comprar: 0, estado: '' });
  S.s('stk', stk); cm(); refreshAll(); toast('✅ Filtro agregado');
};
