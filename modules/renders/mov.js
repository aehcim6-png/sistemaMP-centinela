// Pestaña Consumos (Historial de Consumos, sub-pestaña de Costos & Stock) —
// extraída a su propio archivo (Fase 2 de modularización). Script plano
// (NO módulo ES), mismo scope global de siempre.
window.renderMov = function () {
  if (!$("s-mov")) return;
  const mov = S.g('mov') || [];
  const fMes = $('fMovMes')?.value || '';
  const fTipo = $('fMovTipo')?.value || '';
  const fEq = $('fMovEq')?.value || '';
  const fItem = $('fMovItem')?.value || '';
  const fPM = $('fMovPM')?.value || '';
  const fil = mov.filter(function (m) {
    if (fMes && m.mes !== fMes) return false;
    if (fTipo && m.tipo !== fTipo) return false;
    if (fEq && m.equipo !== fEq) return false;
    if (fPM && m.pm !== fPM) return false;
    if (fItem && !(m.item || '').toLowerCase().includes(fItem.toLowerCase())) return false;
    return true;
  }).slice().reverse();
  const meses = [...new Set(mov.map(m => m.mes))].sort().reverse();
  const equipos = [...new Set(mov.map(m => m.equipo))].sort();
  const items = [...new Set(mov.map(m => m.item || ''))].sort();
  const totMes = {};
  mov.forEach(function (m) {
    if (!totMes[m.mes]) totMes[m.mes] = { filtros: 0, lubricantes: 0, n: 0 };
    if (m.tipo === 'Filtro') totMes[m.mes].filtros += m.cant || 0;
    else totMes[m.mes].lubricantes += m.cant || 0;
    totMes[m.mes].n++;
  });
  // Totals for filtered view
  var tFil = 0, tLub = 0;
  fil.forEach(function (m) { if (m.tipo === 'Filtro') tFil += m.cant || 0; else tLub += m.cant || 0; });
  var pg = _pagSlice('mov', fil);
  document.getElementById('s-mov').innerHTML =
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Historial de Consumos</div>' +
    '<div class="sec-s">' + mov.length + ' total · Mostrando: ' + fil.length + ' (' + Math.round(tFil) + ' filtros, ' + Math.round(tLub) + 'L lub)</div></div>' +
    '<div><button class="btn" onclick="recalcSoloCostos()" title="Asigna consumos por pauta SIN descontar stock"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="8"/><text x="10" y="14" font-size="9" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">$</text></svg> Calcular costos</button>' +
    ' <button class="btn btn-o" onclick="recalcHistorial()" title="Asigna consumos Y descuenta stock"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 10 A6 6 0 0 1 15.5 6.5" fill="none"/><polyline points="15.5,3 15.5,6.5 12,6.5"/><path d="M16 10 A6 6 0 0 1 4.5 13.5" fill="none"/><polyline points="4.5,17 4.5,13.5 8,13.5"/></svg> Recalcular + stock</button>' +
    ' <button class="btn btn-o" onclick="clearConsumos()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg> Limpiar</button></div></div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin-bottom:12px">' +
    meses.slice(0, 6).map(function (m) {
      var t = totMes[m] || { filtros: 0, lubricantes: 0, n: 0 };
      return '<div class="card" style="padding:8px;cursor:pointer" onclick="$(\'fMovMes\').value=\'' + m + '\';renders.mov()"><b>' + m + '</b><br>' +
        '<span style="color:var(--ok);font-size:12px"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="8"/><line x1="10" y1="6" x2="10" y2="11"/><circle cx="10" cy="14" r="0.6" fill="currentColor" stroke="none"/></svg> ' + Math.round(t.filtros) + ' filtros</span> ' +
        '<span style="color:var(--w);font-size:12px"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="5" y="3" width="10" height="14" rx="2"/><line x1="5" y1="7" x2="15" y2="7"/><line x1="5" y1="13" x2="15" y2="13"/></svg> ' + Math.round(t.lubricantes) + 'L</span> ' +
        '<small style="color:var(--tx3)">' + t.n + ' mov</small></div>';
    }).join('') + '</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;align-items:end">' +
    '<div class="fg" style="min-width:90px"><label style="font-size:10px">Mes</label><select id="fMovMes" onchange="window._pag.mov=1;renders.mov()" style="font-size:11px"><option value="">Todos</option>' +
    meses.map(function (m) { return '<option' + (fMes === m ? ' selected' : '') + '>' + m + '</option>' }).join('') + '</select></div>' +
    '<div class="fg" style="min-width:80px"><label style="font-size:10px">Tipo</label><select id="fMovTipo" onchange="window._pag.mov=1;renders.mov()" style="font-size:11px"><option value="">Todos</option>' +
    '<option' + (fTipo === 'Filtro' ? ' selected' : '') + '>Filtro</option><option' + (fTipo === 'Lubricante' ? ' selected' : '') + '>Lubricante</option></select></div>' +
    '<div class="fg" style="min-width:90px"><label style="font-size:10px">Equipo</label><select id="fMovEq" onchange="window._pag.mov=1;renders.mov()" style="font-size:11px"><option value="">Todos</option>' +
    equipos.map(function (e) { return '<option' + (fEq === e ? ' selected' : '') + '>' + e + '</option>' }).join('') + '</select></div>' +
    '<div class="fg" style="min-width:80px"><label style="font-size:10px">PM</label><select id="fMovPM" onchange="window._pag.mov=1;renders.mov()" style="font-size:11px"><option value="">Todos</option>' +
    ['PM1', 'PM2', 'PM3', 'PM4'].map(function (p) { return '<option' + (fPM === p ? ' selected' : '') + '>' + p + '</option>' }).join('') + '</select></div>' +
    '<div class="fg" style="min-width:120px"><label style="font-size:10px">Buscar item</label>' +
    '<input id="fMovItem" value="' + (fItem || '') + '" placeholder="Nombre..." onchange="window._pag.mov=1;renders.mov()" style="font-size:11px"></div>' +
    '<button class="btn btn-o" style="font-size:11px;padding:4px 10px" onclick="$(\'fMovMes\').value=\'\';$(\'fMovTipo\').value=\'\';$(\'fMovEq\').value=\'\';$(\'fMovPM\').value=\'\';$(\'fMovItem\').value=\'\';window._pag.mov=1;renders.mov()">Limpiar filtros</button>' +
    '</div>' +
    _pagHTML('mov', pg) +
    '<div class="tbl-w"><table><tr><th>Fecha</th><th>Tipo</th><th>Item</th><th>N°Parte</th><th>Cant</th><th>Equipo</th><th>PM</th><th>Ant</th><th>Nuevo</th><th><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th></tr>' +
    pg.items.map(function (m) {
      var idx = mov.indexOf(m);
      return '<tr>' +
        '<td style="font-size:11px">' + m.fecha + '</td>' +
        '<td>' + (m.tipo === 'Filtro' ? '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="8"/><line x1="10" y1="6" x2="10" y2="11"/><circle cx="10" cy="14" r="0.6" fill="currentColor" stroke="none"/></svg>' : '<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="5" y="3" width="10" height="14" rx="2"/><line x1="5" y1="7" x2="15" y2="7"/><line x1="5" y1="13" x2="15" y2="13"/></svg>') + '</td>' +
        '<td style="font-size:11px;max-width:200px">' +
        '<input value="' + escapeHtml(m.item || '') + '" onchange="editMov(' + idx + ',\'item\',this.value)" style="width:100%;background:transparent;border:none;color:var(--tx);font-size:11px" title="Click para editar nombre">' +
        '</td>' +
        '<td style="font-size:10px">' + escapeHtml(m.nParte || '') + '</td>' +
        '<td><input type="number" value="' + m.cant + '" onchange="editMov(' + idx + ',\'cant\',parseFloat(this.value)||0)" style="width:45px;background:var(--bg3);border:1px solid var(--bd);color:var(--ac);font-weight:600;text-align:center;border-radius:3px;font-size:12px"></td>' +
        '<td style="font-size:11px">' + escapeHtml(m.equipo) + '</td>' +
        '<td style="font-size:11px">' + m.pm + '</td>' +
        '<td style="font-size:11px;color:var(--tx3)">' + m.ant + '</td>' +
        '<td style="font-size:11px;color:var(--tx3)">' + m.nuevo + '</td>' +
        '<td><button class="btn-s btn-d" onclick="delMov(' + idx + ')" title="Eliminar"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg></button></td></tr>';
    }).join('') +
    '</table></div>' +
    _pagHTML('mov', pg);
};
window.editMov = function (idx, key, val) {
  var mov = S.g('mov') || [];
  if (mov[idx]) { mov[idx][key] = val; S.s('mov', mov); refreshAll(); }
};
window.delMov = function (idx) {
  if (!confirm('¿Eliminar este movimiento y restaurar stock?')) return;
  var mov = S.g('mov') || [];
  var m = mov[idx];
  if (m) {
    if (m.tipo === 'Filtro') {
      var stk = S.g('stk') || [];
      var fi = stk.findIndex(function (s) { return s.descripcion === m.item || (s.nParte && s.nParte === m.nParte); });
      if (fi >= 0) { stk[fi].stockBodega = (stk[fi].stockBodega || 0) + (m.cant || 0); S.s('stk', stk); }
    } else {
      var lub = S.g('lub') || [];
      var li = lub.findIndex(function (l) { return l.nombre === m.item; });
      if (li >= 0) { lub[li].stock = (lub[li].stock || 0) + (m.cant || 0); S.s('lub', lub); }
    }
  }
  _moverAPapelera('mov', m);
  mov.splice(idx, 1);
  S.s('mov', mov);
  refreshAll();
  toast('🗑️ Eliminado — stock restaurado');
};
window.clearConsumos = function () {
  if (!confirm('¿Limpiar todo el historial de consumos? Esto restaura el stock que estos movimientos habían descontado.')) return;
  // Restaura el stock de cada movimiento antes de borrar — si no, "Recalcular + stock"
  // vuelve a descontar todo de nuevo sobre un stock que ya está descontado (doble descuento).
  var mov = S.g('mov') || [];
  var stk = S.g('stk') || [];
  var lub = S.g('lub') || [];
  mov.forEach(function (m) {
    if (m.tipo === 'Filtro') {
      var fi = stk.findIndex(function (s) { return s.descripcion === m.item || (s.nParte && s.nParte === m.nParte); });
      if (fi >= 0) stk[fi].stockBodega = (stk[fi].stockBodega || 0) + (m.cant || 0);
    } else {
      var li = lub.findIndex(function (l) { return l.nombre === m.item; });
      if (li >= 0) lub[li].stock = (lub[li].stock || 0) + (m.cant || 0);
    }
  });
  S.s('stk', stk); S.s('lub', lub);
  S.s('mov', []);
  // Reset consumosPauta in registros
  const reg = S.g('reg') || [];
  reg.forEach(r => delete r.consumosPauta);
  S.s('reg', reg);
  renders.mov();
  toast('🗑️ Historial de consumos limpiado — stock restaurado');
};

// ═══ RECALCULAR CONSUMO HISTÓRICO ═══
window.recalcHistorial = function () {
  const reg = S.g('reg') || [];
  const pau = S.g('pau') || INIT.pautas || [];
  const stk = S.g('stk') || [];
  const lub = S.g('lub') || [];
  let mov = S.g('mov') || [];

  const sinConsumo = reg.filter(r => !r.consumosPauta || r.consumosPauta.length === 0);
  if (sinConsumo.length === 0) {
    toast('ℹ️ Todos los registros ya tienen consumos cargados');
    return;
  }
  if (!confirm('¿Calcular y descontar consumo de ' + sinConsumo.length + ' mantenciones según sus pautas?')) return;

  let totalFil = 0, totalLub = 0, totalReg = 0, sinPauta = [];

  sinConsumo.forEach(r => {
    const consumos = getPautasConsumo(r.equipo, r.tipoPM);
    if (consumos.length === 0) { if (!sinPauta.includes(r.equipo)) sinPauta.push(r.equipo); return; }

    r.consumosPauta = consumos.map(c => ({ rep: c.rep || '', cant: c.can || 0 }));
    totalReg++;
    const fechaReg = r.fechaEntrada || r.fechaEjec || '2026-01-01';

    consumos.forEach(c => {
      const rep = (c.rep || '').toLowerCase().trim();
      const cant = c.can || c.cant || 0;
      if (cant <= 0 || !rep) return;
      const partNums = rep.match(/[a-z]?\d{2,}[-\d]+[a-z]*/gi) || [];

      let fi = -1;
      if (partNums.length > 0) {
        fi = stk.findIndex(s => {
          const np = (s.nParte || '').toLowerCase();
          return partNums.some(pn => np.includes(pn.toLowerCase()) || pn.toLowerCase().includes(np));
        });
      }
      if (fi >= 0) {
        const ant = stk[fi].stockBodega || 0;
        stk[fi].stockBodega = Math.max(0, ant - cant);
        const cm = stk[fi].consumoMes || 1;
        const _se = stockEstado(stk[fi].stockBodega, cm, stk[fi].leadTime);
        stk[fi].mesesCubierto = _se.meses != null ? Math.round(_se.meses * 10) / 10 : 0;
        stk[fi].estado = _se.ico + ' ' + _se.txt;
        mov.push({
          fecha: fechaReg, tipo: 'Filtro', item: stk[fi].descripcion, nParte: stk[fi].nParte,
          cant, equipo: r.equipo, pm: r.tipoPM, ant, nuevo: stk[fi].stockBodega, mes: fechaReg.slice(0, 7)
        });
        totalFil += cant;
        return;
      }

      let li = -1, bestS = 0;
      lub.forEach((l, idx) => {
        const ln = (l.nombre || '').toLowerCase().replace(/[-_%]/g, ' ');
        if (ln.length < 4) return;
        const rn = rep.replace(/[-_%]/g, ' ');
        const rt = rn.split(/\s+/).filter(w => w.length > 1);
        const lt = ln.split(/\s+/).filter(w => w.length > 1);
        let sc = 0;
        rt.forEach(r => { if (lt.some(l2 => l2 === r || l2.includes(r) || r.includes(l2))) sc++; });
        const nums = rn.match(/\d+\w*/g) || [];
        const lnums = ln.match(/\d+\w*/g) || [];
        nums.forEach(n => { if (lnums.some(ln2 => ln2 === n)) sc += 2; });
        const nm = nums.filter(n => { const nc = n.replace(/w$/i, ''); return lnums.some(l2 => l2.replace(/w$/i, '') === nc); }).length;
        if (sc >= 3 && nm >= 1 && sc > bestS) { bestS = sc; li = idx; }
        if (li < 0) { const rc = rn.replace(/\s+/g, ''); const lc = ln.replace(/\s+/g, ''); if (lc.length > 8 && rc.includes(lc)) { li = idx; bestS = 99; } }
      });
      if (li >= 0) {
        const ant = lub[li].stock || 0;
        lub[li].stock = Math.max(0, ant - cant);
        lub[li].consumoMes = Math.round(((lub[li].consumoMes || 0) + cant) / 2);
        mov.push({
          fecha: fechaReg, tipo: 'Lubricante', item: lub[li].nombre, unidad: lub[li].unidad,
          cant, equipo: r.equipo, pm: r.tipoPM, ant, nuevo: lub[li].stock, mes: fechaReg.slice(0, 7)
        });
        totalLub += cant;
      }
    });
  });

  S.s('reg', reg); S.s('stk', stk); S.s('lub', lub); S.s('mov', mov);
  refreshAll();
  toast('✅ ' + totalReg + ' mantenciones procesadas · Filtros: -' + totalFil + ' · Lubricantes: -' + Math.round(totalLub) + 'L' + (sinPauta.length ? ' · ⚠️ Sin pauta: ' + sinPauta.join(', ') : ''));
};

// Recálculo SOLO COSTOS: asigna consumos por pauta sin tocar stock ni generar movimientos de descuento
window.recalcSoloCostos = function () {
  const reg = S.g('reg') || [];
  const sinConsumo = reg.filter(r => !r.consumosPauta || r.consumosPauta.length === 0);
  if (sinConsumo.length === 0) {
    toast('ℹ️ Todos los registros ya tienen consumos cargados');
    return;
  }
  if (!confirm('Asignar consumos por pauta a ' + sinConsumo.length + ' mantenciones (SOLO costos, NO descuenta stock). ¿Continuar?')) return;

  let totalReg = 0, sinPauta = [];
  sinConsumo.forEach(r => {
    const consumos = getPautasConsumo(r.equipo, r.tipoPM);
    if (consumos.length === 0) { if (!sinPauta.includes(r.equipo)) sinPauta.push(r.equipo); return; }
    r.consumosPauta = consumos.map(c => ({ rep: c.rep || '', cant: c.can || c.cant || 0 }));
    totalReg++;
  });

  S.s('reg', reg);
  refreshAll();
  toast('✅ ' + totalReg + ' mantenciones con consumos asignados (stock intacto)' + (sinPauta.length ? ' · ⚠️ Sin pauta: ' + sinPauta.join(', ') : ''));
};
