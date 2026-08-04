// Pestaña Gestión de Destrabe (sub-pestaña de Componentes) — extraída a su
// propio archivo (Fase 2 de modularización). Script plano (NO módulo ES),
// mismo scope global de siempre.
window.renderDestrabe = function () {
  var items = S.g('destrabe') || [];
  var activos = items.filter(function (i) { return i.estado !== 'Resuelto' });
  $('s-destrabe').innerHTML =
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9 V6 a3 3 0 0 1 6 0" fill="none"/></svg> Gestión de Destrabe</div>' +
    '<div class="sec-s">' + items.length + ' registros · ' + activos.length + ' activos</div></div>' +
    '<div style="display:flex;gap:8px"><button class="btn" onclick="addDestrabe()">+ Nuevo</button>' +
    '<button class="btn btn-o" onclick="exportCSV(\'destrabe\')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> CSV</button></div></div>' +
    '<div class="cards">' +
    '<div class="card"><div class="card-t">🔴 Críticos (&gt;14 días)</div><div class="card-v" style="color:var(--danger)">' + items.filter(function (i) { return i.dias > 14 && i.estado !== 'Resuelto' }).length + '</div></div>' +
    '<div class="card"><div class="card-t">🟡 Urgentes (&gt;7 días)</div><div class="card-v" style="color:var(--w)">' + items.filter(function (i) { return i.dias > 7 && i.dias <= 14 && i.estado !== 'Resuelto' }).length + '</div></div>' +
    '<div class="card"><div class="card-t"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><polyline points="6.5,10.3 9,13 14,7.5"/></svg> Resueltos</div><div class="card-v" style="color:var(--ok)">' + items.filter(function (i) { return i.estado === 'Resuelto' }).length + '</div></div>' +
    '</div>' +
    '<div class="tbl-wrap"><table>' +
    '<tr><th>Equipo</th><th>Trabajo</th><th>Tipo</th><th>F.Solicitud</th><th>Días</th><th>Motivo Bloqueo</th><th>Acción</th><th>Responsable</th><th>F.Compromiso</th><th>Estado</th><th>Prioridad</th><th></th></tr>' +
    items.map(function (it, i) {
      it.dias = it.fechaSol ? Math.round((Date.now() - new Date(it.fechaSol).getTime()) / 86400000) : 0;
      var prio = it.dias > 14 ? '🔴 CRÍTICO' : it.dias > 7 ? '🟡 URGENTE' : '<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Normal';
      return '<tr>' +
        '<td class="mono ed" style="color:var(--ac)" contenteditable onblur="edDestrabe(' + i + ',\'equipo\',this.innerText.trim())">' + escapeHtml(it.equipo) + '</td>' +
        '<td class="ed" contenteditable onblur="edDestrabe(' + i + ',\'trabajo\',this.innerText.trim())" style="font-size:11px">' + escapeHtml(it.trabajo) + '</td>' +
        '<td class="ed" contenteditable onblur="edDestrabe(' + i + ',\'tipo\',this.innerText.trim())" style="font-size:10px">' + escapeHtml(it.tipo) + '</td>' +
        '<td class="ed mono" contenteditable onblur="edDestrabe(' + i + ',\'fechaSol\',this.innerText.trim())" style="font-size:10px">' + it.fechaSol + '</td>' +
        '<td class="mono" style="color:' + (it.dias > 14 ? 'var(--danger)' : it.dias > 7 ? 'var(--w)' : 'var(--tx3)') + '">' + it.dias + '</td>' +
        '<td class="ed" contenteditable onblur="edDestrabe(' + i + ',\'motivo\',this.innerText.trim())" style="font-size:10px;max-width:150px">' + escapeHtml(it.motivo) + '</td>' +
        '<td class="ed" contenteditable onblur="edDestrabe(' + i + ',\'accion\',this.innerText.trim())" style="font-size:10px;max-width:150px">' + escapeHtml(it.accion) + '</td>' +
        '<td class="ed" contenteditable onblur="edDestrabe(' + i + ',\'responsable\',this.innerText.trim())" style="font-size:10px">' + escapeHtml(it.responsable) + '</td>' +
        '<td class="ed mono" contenteditable onblur="edDestrabe(' + i + ',\'fechaComp\',this.innerText.trim())" style="font-size:10px">' + it.fechaComp + '</td>' +
        '<td><select onchange="edDestrabe(' + i + ',\'estado\',this.value)" style="font-size:9px;background:var(--bg3);color:var(--tx);border:1px solid var(--bd);border-radius:3px">' +
        ['Bloqueado', 'En Gestión', 'Resuelto'].map(function (s) { return '<option' + (it.estado === s ? ' selected' : '') + '>' + s + '</option>' }).join('') + '</select></td>' +
        '<td style="font-size:10px">' + prio + '</td>' +
        '<td><button class="btn-x" onclick="delDestrabe(' + i + ')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg></button></td></tr>';
    }).join('') +
    '</table></div>';
};
window.edDestrabe = function (i, k, v) { var d = S.g('destrabe') || []; if (i < d.length) { d[i][k] = v; S.s('destrabe', d); } refreshAll(); };
window.addDestrabe = function () { var d = S.g('destrabe') || []; d.push({ equipo: '', trabajo: '', tipo: 'PM', fechaSol: new Date().toISOString().slice(0, 10), motivo: '', accion: '', responsable: '', fechaComp: '', estado: 'Bloqueado', dias: 0 }); S.s('destrabe', d); refreshAll(); };
window.delDestrabe = function (i) { var d = S.g('destrabe') || []; if (confirm('¿Eliminar?')) { d.splice(i, 1); S.s('destrabe', d); refreshAll(); } };
