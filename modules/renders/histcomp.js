// Pestaña Historial de Componentes (sub-pestaña de Componentes) — a
// diferencia de Componentes Mayores (que solo guarda la instalación
// ACTUAL, una fila por sigla+componente, y se pisa cada vez que se
// encuentra un cambio más reciente), acá queda CADA reemplazo real
// como su propia fila en 'historial_componentes'. Con eso se puede
// responder "cada cuántas horas se cambia el asiento" — dato que antes
// se perdía cada vez que se actualizaba compMayores al cambio más nuevo.
// Script plano (NO módulo ES), mismo scope global de siempre.
window.renderHistComp = function () {
  var h = S.g('compHist') || [];
  var fComp = $('fHistComp') ? $('fHistComp').value : '';

  // Agrupar por sigla+comp, ordenado por horómetro, para calcular cuánto
  // duró cada instalación (horas hasta el siguiente cambio del MISMO
  // componente en el MISMO equipo).
  var porClave = {};
  h.forEach(function (r) {
    var k = r.sigla + '|' + r.comp;
    (porClave[k] = porClave[k] || []).push(r);
  });
  Object.keys(porClave).forEach(function (k) {
    porClave[k].sort(function (a, b) { return (parseFloat(a.horomInstalacion) || 0) - (parseFloat(b.horomInstalacion) || 0); });
  });

  var filas = [];
  Object.keys(porClave).forEach(function (k) {
    var arr = porClave[k];
    arr.forEach(function (r, i) {
      var horasVida = null;
      if (i > 0) {
        var hAnt = parseFloat(arr[i - 1].horomInstalacion), hAct = parseFloat(r.horomInstalacion);
        if (!isNaN(hAnt) && !isNaN(hAct) && hAct > hAnt) horasVida = Math.round(hAct - hAnt);
      }
      filas.push({ ref: r, idx: h.indexOf(r), horasVida: horasVida, esActual: i === arr.length - 1 });
    });
  });

  // Resumen flota: promedio/mín/máx de horas-de-vida por tipo de componente
  // (solo cuenta instalaciones que ya fueron reemplazadas — la última de
  // cada equipo sigue en uso y no tiene "duración" todavía).
  var statsPorComp = {};
  filas.forEach(function (f) {
    if (f.horasVida == null) return;
    (statsPorComp[f.ref.comp] = statsPorComp[f.ref.comp] || []).push(f.horasVida);
  });
  var resumen = Object.keys(statsPorComp).map(function (c) {
    var arr = statsPorComp[c];
    var prom = Math.round(arr.reduce(function (s, v) { return s + v; }, 0) / arr.length);
    return { comp: c, n: arr.length, prom: prom, min: Math.min.apply(null, arr), max: Math.max.apply(null, arr) };
  }).sort(function (a, b) { return a.comp.localeCompare(b.comp); });

  var comps = [...new Set(h.map(function (r) { return r.comp; }))].sort();
  var filFilas = (fComp ? filas.filter(function (f) { return f.ref.comp === fComp; }) : filas)
    .sort(function (a, b) { return (b.ref.fechaInst || '').localeCompare(a.ref.fechaInst || ''); });

  $('s-histcomp').innerHTML = `
    <div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5.5 V10 l3 2" fill="none"/><circle cx="10" cy="10" r="7.5"/></svg> Historial de Componentes</div>
      <div class="sec-s">${h.length} eventos registrados · cuánto duró cada instalación (horas de horómetro hasta el siguiente cambio)</div></div>
      <button class="btn" onclick="addHistComp()">+ Agregar evento</button>
    </div>
    ${resumen.length ? `<div class="tbl-wrap" style="margin-bottom:16px"><table>
      <tr><th>Componente</th><th>N° cambios medidos</th><th>Promedio (h)</th><th>Mínimo (h)</th><th>Máximo (h)</th></tr>
      ${resumen.map(function (r) {
        var alerta = r.min < r.prom * 0.5;
        return `<tr${alerta ? ' style="background:rgba(239,68,68,.05)"' : ''}>
          <td style="font-weight:600">${escapeHtml(r.comp)}</td>
          <td class="mono">${r.n}</td>
          <td class="mono">${r.prom.toLocaleString()}</td>
          <td class="mono" style="${alerta ? 'color:var(--danger);font-weight:700' : ''}">${r.min.toLocaleString()}${alerta ? ' ⚠️' : ''}</td>
          <td class="mono">${r.max.toLocaleString()}</td>
        </tr>`;
      }).join('')}
    </table></div>
    <div style="font-size:11px;color:var(--tx2);margin-bottom:16px">⚠️ = algún cambio duró menos de la mitad del promedio de su tipo — candidato a revisar garantía o calidad del repuesto/proveedor.</div>` : ''}
    <div class="toolbar">
      <select id="fHistComp" onchange="renders.histcomp()"><option value="">Todos los componentes</option>${comps.map(function (c) { return '<option' + (c === fComp ? ' selected' : '') + '>' + escapeHtml(c) + '</option>'; }).join('')}</select>
    </div>
    <div class="tbl-wrap"><table>
      <tr><th>Equipo</th><th>Componente</th><th>Fecha Inst.</th><th>Horómetro</th><th>Duró (h)</th><th>Fuente</th><th>Obs</th><th></th></tr>
      ${filFilas.map(function (f) {
        var r = f.ref;
        return `<tr>
          <td class="mono" style="color:var(--ac)">${escapeHtml(r.sigla)}</td>
          <td style="font-weight:600">${escapeHtml(r.comp)}</td>
          <td>${escapeHtml(r.fechaInst || '')}</td>
          <td class="mono">${r.horomInstalacion != null ? r.horomInstalacion : '—'}</td>
          <td class="mono" style="font-weight:700">${f.horasVida != null ? f.horasVida.toLocaleString() : (f.esActual ? '<span style="color:var(--tx3);font-size:10px">en uso</span>' : '—')}</td>
          <td style="font-size:10px;color:var(--tx2)">${escapeHtml(r.fuente || '')}</td>
          <td class="ed" contenteditable onblur="edHistComp(${f.idx},'obs',this.innerText.trim())" style="font-size:10px;max-width:200px">${escapeHtml(r.obs || '')}</td>
          <td><button class="btn-x" onclick="delHistComp(${f.idx})" title="Eliminar"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg></button></td>
        </tr>`;
      }).join('')}
    </table></div>`;
};
window.edHistComp = function (idx, key, val) {
  var d = S.g('compHist') || [];
  if (!d[idx]) return;
  d[idx][key] = val;
  S.s('compHist', d);
  refreshAll();
  toast('✅ Guardado');
};
window.delHistComp = function (idx) {
  var d = S.g('compHist') || [];
  if (!d[idx]) return;
  if (confirm('¿Eliminar este evento de ' + d[idx].comp + ' en ' + d[idx].sigla + '?')) {
    d.splice(idx, 1);
    S.s('compHist', d);
    refreshAll();
    toast('✅ Eliminado');
  }
};
window.addHistComp = function () {
  var eq = S.g('eq') || [];
  var compData = S.g('compMayores') || [];
  var comps = [...new Set(compData.map(function (c) { return c.comp; }))].sort();
  sm('<h3><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5.5 V10 l3 2" fill="none"/><circle cx="10" cy="10" r="7.5"/></svg> Agregar evento de historial</h3>' +
    '<div class="form-row"><div class="fg"><label>Equipo *</label><select id="hcEq"><option value="">Seleccionar...</option>' +
    eq.map(function (e) { return '<option>' + escapeHtml(e.sigla) + '</option>'; }).join('') + '</select></div>' +
    '<div class="fg"><label>Componente *</label><input id="hcComp" list="hcCompList" placeholder="Ej: Asiento">' +
    '<datalist id="hcCompList">' + comps.map(function (c) { return '<option value="' + escapeHtml(c) + '">'; }).join('') + '</datalist></div></div>' +
    '<div class="form-row"><div class="fg"><label>Fecha instalación</label><input type="date" id="hcFecha" value="' + new Date().toISOString().slice(0, 10) + '"></div>' +
    '<div class="fg"><label>Horómetro</label><input type="number" id="hcHorom"></div></div>' +
    '<div class="form-row"><div class="fg"><label>Obs</label><input id="hcObs" placeholder="Detalle del cambio"></div></div>' +
    '<br><button class="btn" onclick="saveHistComp()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
};
window.saveHistComp = function () {
  var sigla = $('hcEq').value;
  var comp = ($('hcComp').value || '').trim();
  if (!sigla) return toast('⚠️ Selecciona equipo');
  if (!comp) return toast('⚠️ Ingresa el componente');
  var d = S.g('compHist') || [];
  d.push({
    id: _uuidV4(), sigla: sigla, comp: comp,
    fechaInst: $('hcFecha').value || null,
    horomInstalacion: parseFloat($('hcHorom').value) || null,
    fuente: 'Registro manual', obs: ($('hcObs').value || '').trim()
  });
  S.s('compHist', d); cm(); renders.histcomp(); toast('✅ Evento agregado');
};
