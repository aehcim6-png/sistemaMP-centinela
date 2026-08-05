// Pestaña Inspecciones Diarias — extraída a su propio archivo (Fase 2 de
// modularización). Script plano (NO módulo ES), mismo scope global de
// siempre.
window.renderInsp = function () {
  var insp = S.g('insp') || [];
  var eq = S.g('eq') || [];
  var fEq = $('fInspEq')?.value || '';
  var fil = insp.filter(function (r) { return !fEq || r.sigla === fEq; }).slice().reverse();
  var hoy = new Date().toISOString().slice(0, 10);
  var hoyCount = insp.filter(function (r) { return r.fecha === hoy; }).length;
  var is = 'background:transparent;border:none;color:var(--tx);font-size:11px;width:100%';
  var pg = _pagSlice('insp', fil);
  $('s-insp').innerHTML =
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Inspecciones Diarias</div>' +
    '<div class="sec-s">' + insp.length + ' inspecciones · Hoy: ' + hoyCount + '</div></div>' +
    '<button class="btn" onclick="addInsp()">+ Nueva Inspección</button></div>' +
    '<div class="toolbar">' +
    '<select id="fInspEq" onchange="window._pag.insp=1;renders.insp()"><option value="">Todos equipos</option>' +
    eq.map(function (e) { return '<option' + (fEq === e.sigla ? ' selected' : '') + '>' + escapeHtml(e.sigla) + '</option>' }).join('') + '</select></div>' +
    _pagHTML('insp', pg) +
    '<div class="tbl-wrap"><table>' +
    '<tr><th>Fecha</th><th>Equipo</th><th>Horóm</th><th>Visual <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Niveles <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Fugas <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Luces <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Frenos <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Neumát <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Obs <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,3 17,7 7,17 3,17 3,13"/><line x1="11" y1="5" x2="15" y2="9"/></svg></th><th>Inspector</th><th>Alerta</th><th></th></tr>' +
    pg.items.map(function (r) {
      var i = insp.indexOf(r);
      var checks = ['visual', 'niveles', 'fugas', 'luces', 'frenos', 'neumaticos'];
      var alertCount = checks.filter(function (c) { return r[c] === 'NOK' || r[c] === '🔴'; }).length;
      return '<tr style="' + (alertCount > 0 ? 'background:rgba(239,68,68,.04)' : '') + '">' +
        '<td style="font-size:10px">' + r.fecha + '</td>' +
        '<td class="mono" style="color:var(--ac)">' + escapeHtml(r.sigla) + '</td>' +
        '<td class="mono" style="font-size:10px">' + (r.horom || '—') + '</td>' +
        checks.map(function (c) {
          return '<td><select onchange="edInsp(' + i + ',\'' + c + '\',this.value)" style="font-size:10px;background:' + (r[c] === 'NOK' || r[c] === '🔴' ? 'rgba(239,68,68,.2)' : 'var(--bg3)') + ';color:' + (r[c] === 'NOK' || r[c] === '🔴' ? 'var(--danger)' : 'var(--ok)') + ';border:1px solid var(--bd);border-radius:3px">' +
            '<option' + (r[c] === 'OK' || r[c] === '🟢' ? ' selected' : '') + '>OK</option>' +
            '<option value="NOK"' + (r[c] === 'NOK' || r[c] === '🔴' ? ' selected' : '') + '>NOK</option></select></td>';
        }).join('') +
        '<td><input value="' + escapeHtml(r.obs || '') + '" onchange="edInsp(' + i + ',\'obs\',this.value)" style="' + is + '" placeholder="..."></td>' +
        '<td style="font-size:10px">' + escapeHtml(r.inspector || '—') + '</td>' +
        '<td style="text-align:center">' + (alertCount > 0 ? '<span style="color:var(--danger);font-weight:700">🔴 ' + alertCount + '</span>' : '<span style="color:var(--ok)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg></span>') + '</td>' +
        '<td><button class="btn-s btn-d" onclick="delInsp(' + i + ')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg></button></td></tr>';
    }).join('') +
    '</table></div>' +
    _pagHTML('insp', pg);
};
window.edInsp = function (i, key, val) {
  var insp = S.g('insp') || [];
  if (insp[i]) {
    insp[i][key] = val; S.s('insp', insp);
    // If NOK, auto-flag for predictive
    if (val === 'NOK') {
      toast('⚠️ ' + insp[i].sigla + ': ' + key + ' NOK — revisar predictivo');
    }
    refreshAll();
  }
};
window.delInsp = function (i) {
  if (!confirm('¿Eliminar inspección?')) return;
  var insp = S.g('insp') || []; insp.splice(i, 1); S.s('insp', insp); refreshAll(); toast('🗑️ Eliminada');
};
window.addInsp = function () {
  var eq = S.g('eq') || [];
  var hoy = new Date().toISOString().slice(0, 10);
  var per = _tecnicosDisponibles();
  sm('<h3><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Nueva Inspección Diaria</h3>' +
    '<div class="form-row"><div class="fg"><label>Equipo *</label><select id="iEq">' +
    eq.map(function (e) { return '<option>' + escapeHtml(e.sigla) + '</option>' }).join('') + '</select></div>' +
    '<div class="fg"><label>Fecha</label><input type="date" id="iFec" value="' + hoy + '"></div>' +
    '<div class="fg"><label>Horómetro</label><input type="number" id="iHor"></div></div>' +
    '<div class="form-row"><div class="fg"><label>Inspector</label><select id="iInsp"><option value="">—</option>' +
    per.map(function (p) { return '<option>' + p + '</option>' }).join('') + '</select></div></div>' +
    '<div style="margin:12px 0;display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' +
    '<div class="fg"><label>Estado Visual</label><select id="iVisual"><option>OK</option><option value="NOK">NOK</option></select></div>' +
    '<div class="fg"><label>Niveles</label><select id="iNiveles"><option>OK</option><option value="NOK">NOK</option></select></div>' +
    '<div class="fg"><label>Fugas</label><select id="iFugas"><option>OK</option><option value="NOK">NOK</option></select></div>' +
    '<div class="fg"><label>Luces</label><select id="iLuces"><option>OK</option><option value="NOK">NOK</option></select></div>' +
    '<div class="fg"><label>Frenos</label><select id="iFreno"><option>OK</option><option value="NOK">NOK</option></select></div>' +
    '<div class="fg"><label>Neumáticos</label><select id="iNeu"><option>OK</option><option value="NOK">NOK</option></select></div></div>' +
    '<div class="form-row"><div class="fg" style="flex:1"><label>Observaciones</label><input id="iObs" style="width:100%" placeholder="Detalles..."></div></div>' +
    '<button class="btn" onclick="saveInsp()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
};
window.saveInsp = function () {
  var insp = S.g('insp') || [];
  var r = {
    sigla: $('iEq').value, fecha: $('iFec').value, horom: parseInt($('iHor').value) || 0,
    visual: $('iVisual').value, niveles: $('iNiveles').value, fugas: $('iFugas').value,
    luces: $('iLuces').value, frenos: $('iFreno').value, neumaticos: $('iNeu').value,
    obs: $('iObs').value, inspector: $('iInsp').value
  };
  insp.push(r); S.s('insp', insp);
  // NOK → genera OT automática
  var noks = ['visual', 'niveles', 'fugas', 'luces', 'frenos', 'neumaticos'].filter(function (c) { return r[c] === 'NOK'; });
  if (noks.length) {
    var otI = S.g('ot') || [];
    var criticoI = noks.indexOf('frenos') >= 0 || noks.indexOf('fugas') >= 0;
    otI.unshift({
      sigla: r.sigla, fecha: r.fecha, tipo: 'Correctivo',
      criticidad: criticoI ? 'Reparación Inmediata' : 'Programable',
      sintoma: 'Inspección diaria NOK: ' + noks.join(', ') + (r.obs ? ' — ' + r.obs : ''),
      sistema: 'Inspección diaria', tecnico: r.inspector || '', horom: r.horom || 0, costo: 0,
      fromInsp: true, fechaIngreso: new Date().toISOString().slice(0, 10)
    });
    S.s('ot', otI);
  }
  cm(); refreshAll();
  toast(noks.length ? '⚠️ ' + noks.length + ' NOK — ' + r.sigla + ' · OT ' + (noks.indexOf('frenos') >= 0 || noks.indexOf('fugas') >= 0 ? 'INMEDIATA' : 'programable') + ' creada' : '✅ Inspección OK — ' + r.sigla);
};
