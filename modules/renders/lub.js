// Pestaña Lubricantes (sub-pestaña de Stock & Insumos) — extraída a su
// propio archivo (Fase 2 de modularización). Script plano (NO módulo ES),
// mismo scope global de siempre. window.edI queda en index.html porque
// también lo usa renders.stk (aún no extraída).
window.renderLub = function () {
  const lub = S.g('lub') || [];
  const mov = S.g('mov') || [];
  const hh = S.g('hh') || 25000;
  const fBusq = $('fLubBusq')?.value || '';
  const fEq = $('fLubEq')?.value || '';
  const allEq = (S.g('eq') || []).map(e => e.sigla).sort();
  // Real data from movimientos
  const lastUse = {}, totalCons = {};
  mov.forEach(function (m) {
    if (m.tipo === 'Lubricante') {
      if (!lastUse[m.item] || m.fecha > lastUse[m.item]) lastUse[m.item] = m.fecha;
      totalCons[m.item] = (totalCons[m.item] || 0) + (m.cant || 0);
    }
  });
  var pautaLubs = [];
  if (fEq) {
    var cons = getPautasConsumo(fEq, 'PM4');
    pautaLubs = cons.filter(function (c) { return esLubricante(c.rep); });
  }
  var filLub = lub.filter(function (l) {
    if (fBusq && !(l.nombre || '').toLowerCase().includes(fBusq.toLowerCase())) return false;
    return true;
  });
  const pg = _pagSlice('lub', filLub);
  $('s-lub').innerHTML =
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="5" y="3" width="10" height="14" rx="2"/><line x1="5" y1="7" x2="15" y2="7"/><line x1="5" y1="13" x2="15" y2="13"/></svg>️ Lubricantes</div>' +
    '<div class="sec-s">' + lub.length + ' productos · <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg> Todo es editable — cambios se propagan al sistema</div></div>' +
    '<button class="btn" onclick="addLub()">+ Nuevo</button> <button class="btn btn-o" onclick="importLubCSV()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,6 10,2 14,6"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar CSV</button> <button class="btn" style="background:var(--warn,#eab308);color:#000" onclick="diagVinculos()"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8.5" cy="8.5" r="5.5"/><line x1="12.7" y1="12.7" x2="17.5" y2="17.5"/></svg> Vínculos rotos</button></div>' +
    '<div class="toolbar">' +
    '<input id="fLubBusq" placeholder="Buscar..." aria-label="Buscar" value="' + (fBusq || '') + '" onchange="window._pag.lub=1;renders.lub()" style="max-width:180px">' +
    '<select id="fLubEq" onchange="window._pag.lub=1;renders.lub()"><option value="">Consumo por equipo...</option>' +
    allEq.map(function (e) { return '<option' + (e === fEq ? ' selected' : '') + '>' + escapeHtml(e) + '</option>' }).join('') + '</select>' +
    '<span style="font-size:11px;color:var(--tx3)">HH: $<input type="number" value="' + hh + '" onchange="S.s(\'hh\',parseInt(this.value));refreshAll()" style="width:70px;background:var(--bg3);border:1px solid var(--bd);color:var(--tx);padding:2px 4px;border-radius:3px;font-size:11px">/hr</span></div>' +
    (fEq && pautaLubs.length ?
      '<div class="card" style="margin-bottom:10px;border-left:3px solid var(--ac)">' +
      '<b style="color:var(--ac)"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Pauta PM4 de ' + escapeHtml(fEq) + ':</b> ' +
      pautaLubs.map(function (c) { return '<span style="display:inline-block;background:var(--bg3);border-radius:3px;padding:2px 6px;margin:2px;font-size:10px">' + escapeHtml((c.rep || '').substring(0, 50)) + ': <b>' + (c.can || 0) + '</b></span>' }).join('') +
      '</div>' : '') +
    _pagHTML('lub', pg) +
    '<div class="tbl-wrap"><table>' +
    '<tr><th>N°</th><th>Lubricante <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Und</th><th>Stock <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Consumido</th><th>Cons/Mes <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Últ.Fecha</th><th>Proy/Mes <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Meses</th><th>Precio <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th></th></tr>' +
    pg.items.map(function (l, fi) {
      var idx = lub.indexOf(l);
      var rowNum = (pg.page - 1) * _PAG_SIZE + fi + 1;
      var last = lastUse[l.nombre] || '—';
      var acum = Math.round(totalCons[l.nombre] || 0);
      var proy = l.proyMes || 0;
      var cm = l.consumoMes || 0;
      // Bug real (auditoría 2026-08): Lubricantes tenía su propia fórmula
      // ("stock ÷ consumo", el proxy de 1 mes) en vez de stockEstado — la
      // misma fuente única que ya unificó este cálculo para Stock Filtros y
      // el Dashboard, justo porque ese proxy marcaba "OK" cosas que con un
      // lead time real de 34 días (más de 1 mes) ya iban a quebrar antes de
      // que llegara el pedido. Ahora usa stockEstado igual que el resto.
      var se = stockEstado(l.stock || 0, cm || proy, l.leadTime);
      var meses = se.meses;
      var estCol = se.nivel === 'COMPRAR' ? 'var(--danger)' : se.nivel === 'BAJO' ? 'var(--w)' : 'var(--ok)';
      var is = CELL_INPUT_STYLE + ';font-size:11px;padding:2px';
      // Producto descontinuado: se avisa en la fila para no cargarle precio ni
      // stock por error — su demanda ya se pide bajo el vigente que lo reemplaza.
      var obsoleto = lubEsObsoleto(l.nombre);
      var reemplazo = obsoleto ? lubVigente(l.nombre) : '';
      return '<tr' + (obsoleto ? ' style="opacity:.55"' : '') + '>' +
        '<td class="mono">' + rowNum + '</td>' +
        '<td style="max-width:250px"><input value="' + escapeHtml(l.nombre || '') + '" onchange="edI(\'lub\',' + idx + ',\'nombre\',this.value)" style="width:100%;background:transparent;border:none;color:var(--tx);font-size:11px" title="Editar nombre">' +
        (obsoleto ? '<div style="font-size:9px;color:var(--w)" title="La demanda de este producto se pide bajo su reemplazo"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> Descontinuado → se pide como <b>' + escapeHtml(reemplazo) + '</b></div>' : '') + '</td>' +
        '<td><select onchange="edI(\'lub\',' + idx + ',\'unidad\',this.value)" style="font-size:10px;' + is + '">' +
        ['Litro', 'Kilo', 'Unidad'].map(function (u) { return '<option' + (l.unidad === u ? ' selected' : '') + '>' + u + '</option>' }).join('') + '</select></td>' +
        '<td><input type="number" value="' + (l.stock || 0) + '" onchange="edI(\'lub\',' + idx + ',\'stock\',parseFloat(this.value)||0)" style="width:55px;' + is + ';color:var(--ac);font-weight:600"></td>' +
        '<td style="text-align:center;font-size:11px;color:var(--tx3)">' + acum + '</td>' +
        '<td><input type="number" value="' + cm + '" onchange="edI(\'lub\',' + idx + ',\'consumoMes\',parseFloat(this.value)||0)" style="width:50px;' + is + '"></td>' +
        '<td style="font-size:10px;color:var(--tx3)">' + last + '</td>' +
        '<td><input type="number" value="' + proy + '" onchange="edI(\'lub\',' + idx + ',\'proyMes\',parseFloat(this.value)||0)" style="width:50px;' + is + ';color:var(--w);font-weight:600" title="Proyección mensual manual"></td>' +
        '<td style="text-align:center;font-weight:600;color:' + estCol + '" title="' + escapeHtml(se.motivo) + '">' + (meses == null ? '—' : meses.toFixed(1)) + '</td>' +
        '<td><input type="number" value="' + (l.precio || 0) + '" onchange="edI(\'lub\',' + idx + ',\'precio\',parseInt(this.value)||0)" style="width:55px;' + is + '"></td>' +
        '<td><button class="btn-s btn-d" onclick="delRow(\'lub\',' + idx + ',\'lub\')" title="Eliminar"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg></button></td></tr>';
    }).join('') +
    '</table></div>' +
    _pagHTML('lub', pg);
};
window.addLub = function () {
  sm('<h3>Nuevo Lubricante</h3>' +
    '<div class="form-row"><div class="fg" style="flex:1"><label>Nombre</label><input id="lNom" style="width:100%" placeholder="Ej: Mobil Delvac 1300 Super 15W-40"></div></div>' +
    '<div class="form-row"><div class="fg"><label>Unidad</label><select id="lUni"><option>Litro</option><option>Kilo</option></select></div>' +
    '<div class="fg"><label>Stock actual</label><input type="number" id="lStk" value="0"></div>' +
    '<div class="fg"><label>Precio</label><input type="number" id="lPre" value="0"></div></div>' +
    '<button class="btn" onclick="saveLub()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button> <button type="button" class="btn btn-o" onclick="_iniciarLubPorVoz()">' + ICONS.mic + ' Completar por voz</button>');
};
window.saveLub = function () {
  var lub = S.g('lub') || [];
  lub.push({ nombre: $('lNom').value, unidad: $('lUni').value, stock: parseFloat($('lStk').value) || 0, consumoMes: 0, precio: parseInt($('lPre').value) || 0 });
  S.s('lub', lub); cm(); refreshAll(); toast('✅ Lubricante agregado');
};
