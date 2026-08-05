// Pestaña Tren de Rodaje (sub-pestaña de Componentes) — extraída a su
// propio archivo (Fase 2 de modularización). Script plano (NO módulo ES),
// mismo scope global de siempre.
//
// A diferencia de neumáticos, cada fabricante/proveedor entrega su propio valor
// nuevo y límite de desgaste (hoja técnica del componente) — no hay una tabla de
// criterios fija por marca como NEU_CRITERIOS, así que valorNuevo/limiteDesgaste
// quedan como campos editables por fila.
const CAD_COMPONENTES = ['Eslabón', 'Buje', 'Zapata', 'Sprocket', 'Rueda Guía', 'Rodillo Superior', 'Rodillo Inferior'];
const CAD_LADOS = ['Izquierdo', 'Derecho'];
// Proyección simple: tasa de desgaste entre las últimas 2 mediciones reales
// (mm perdidos / hora de equipo transcurrida) proyectada hasta el límite de
// desgaste. Con solo 1 medición o ninguna, no hay tasa que calcular — se pide
// más historial en vez de adivinar.
function cadProyeccion(c) {
  const meds = (S.g('cadMed') || []).filter(function (m) { return m.sigla === c.sigla && m.lado === c.lado && m.componente === c.componente; })
    .sort(function (a, b) { return (a.fecha || '').localeCompare(b.fecha || ''); });
  if (meds.length < 2 || c.valorNuevo == null || c.limiteDesgaste == null) return null;
  const u = meds[meds.length - 1], p = meds[meds.length - 2];
  const dHoras = u.horom - p.horom, dDesgaste = p.valorMedido - u.valorMedido;
  if (dHoras <= 0 || dDesgaste <= 0) return null;
  const tasa = dDesgaste / dHoras; // mm por hora
  const restante = u.valorMedido - c.limiteDesgaste;
  const hrsRestantes = Math.max(0, Math.round(restante / tasa));
  const eq = (S.g('eq') || []).find(function (e) { return e.sigla === c.sigla; });
  const hrsDia = eq && eq.hrsDia > 0 ? eq.hrsDia : 16;
  const diasRestantes = Math.round(hrsRestantes / hrsDia);
  return { hrsRestantes, diasRestantes, tasaMes: Math.round(tasa * hrsDia * 30 * 100) / 100 };
}
window.renderCad = function () {
  const cad = S.g('cad') || [];
  const fEq = $('fCadEq')?.value || '';
  const eqs = [...new Set(cad.map(function (c) { return c.sigla; }))].sort();
  const fil = cad.filter(function (c) { return !fEq || c.sigla === fEq; });
  const crit = fil.filter(function (c) { return c.pctRemanente != null && c.pctRemanente < 30; }).length;
  $('s-cad').innerHTML = `
    <div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M8 12 L6 14 a3 3 0 0 1 -4 -4 L4 8 a3 3 0 0 1 4 -4 L10 6" fill="none"/><path d="M12 8 L14 6 a3 3 0 0 1 4 4 L16 12 a3 3 0 0 1 -4 4 L10 14" fill="none"/></svg> Tren de Rodaje</div><div class="sec-s">${cad.length} componentes registrados en ${eqs.length} equipos · 🔴 ${crit} críticos</div></div>
      <button class="btn" onclick="addCad()">+ Agregar componente</button>
    </div>
    <div class="toolbar">
      <select id="fCadEq" onchange="renders.cad()"><option value="">Todos los equipos</option>${eqs.map(function (s) { return '<option' + (s === fEq ? ' selected' : '') + '>' + escapeHtml(s) + '</option>'; }).join('')}</select>
    </div>
    <div class="tbl-wrap"><table>
      <tr><th>Equipo</th><th>Lado</th><th>Componente</th><th>Valor Nuevo</th><th>Límite</th><th>Valor Actual</th><th>%</th><th>Vida Restante</th><th>F.Inst.</th><th>Últ. Medición</th><th>Estado</th><th></th></tr>
      ${fil.map(function (c) {
        const i = cad.indexOf(c);
        const sinDatos = c.pctRemanente == null;
        const p = c.pctRemanente || 0;
        const col = sinDatos ? 'var(--tx3)' : p < 30 ? 'var(--danger)' : p < 50 ? 'var(--warn)' : 'var(--ok)';
        const proy = cadProyeccion(c);
        return `<tr style="${sinDatos ? '' : p < 30 ? 'background:rgba(239,68,68,.05)' : p < 50 ? 'background:rgba(234,179,8,.04)' : ''}">
          <td class="mono" style="font-size:11px">${escapeHtml(c.sigla)}</td>
          <td style="font-size:11px">${escapeHtml(c.lado)}</td>
          <td style="font-size:11px">${escapeHtml(c.componente)}</td>
          ${edCell(c.valorNuevo != null ? c.valorNuevo : '', 'valorNuevo', i, 'cad', 'number')}
          ${edCell(c.limiteDesgaste != null ? c.limiteDesgaste : '', 'limiteDesgaste', i, 'cad', 'number')}
          <td class="mono" style="font-size:11px">${c.valorActual != null ? c.valorActual : '—'}</td>
          <td><div style="background:var(--bg3);border-radius:3px;height:8px;width:60px;overflow:hidden;display:inline-block;vertical-align:middle"><div style="background:${col};height:100%;width:${sinDatos ? 0 : Math.min(p, 100)}%"></div></div> <span style="color:${col};font-size:11px">${sinDatos ? '— sin datos' : p + '%'}</span></td>
          <td style="font-size:10px;color:var(--tx2)">${proy ? '≈' + proy.diasRestantes + 'd (' + fn(proy.hrsRestantes) + 'h)' : '—'}</td>
          ${edCell(c.fechaInst || '', 'fechaInst', i, 'cad', 'date')}
          <td style="font-size:11px">${c.ultimaMedicion || '—'}</td>
          ${edCell(c.estado || 'Operativo', 'estado', i, 'cad', 'select', ['Operativo', 'Cambiado', 'Fuera de servicio'])}
          <td>
            <button class="btn-s" style="background:rgba(99,102,241,.15);color:#818cf8" onclick="addMedicionCad(${i})" title="Medir"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="2" y="7" width="16" height="6" rx="1"/><line x1="5" y1="7" x2="5" y2="9.5"/><line x1="8" y1="7" x2="8" y2="9.5"/><line x1="11" y1="7" x2="11" y2="9.5"/><line x1="14" y1="7" x2="14" y2="9.5"/></svg></button>
            <button class="btn-s" style="background:rgba(16,185,129,.15);color:var(--ok)" onclick="verHistorialCad(${i})" title="Historial"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8.5" cy="8.5" r="5.5"/><line x1="12.7" y1="12.7" x2="17.5" y2="17.5"/></svg></button>
            <button class="btn-x" onclick="delCad(${i})" title="Eliminar"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg></button>
          </td>
        </tr>`;
      }).join('')}
    </table></div>`;
};
window.addCad = function () {
  const eq = S.g('eq') || [];
  sm('<h3><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M8 12 L6 14 a3 3 0 0 1 -4 -4 L4 8 a3 3 0 0 1 4 -4 L10 6" fill="none"/><path d="M12 8 L14 6 a3 3 0 0 1 4 4 L16 12 a3 3 0 0 1 -4 4 L10 14" fill="none"/></svg> Agregar componente de tren de rodaje</h3>' +
    '<div class="form-row"><div class="fg"><label>Equipo *</label><select id="cdEq"><option value="">Seleccionar...</option>' +
    eq.map(function (e) { return '<option>' + escapeHtml(e.sigla) + '</option>'; }).join('') + '</select></div>' +
    '<div class="fg"><label>Lado *</label><select id="cdLado">' + CAD_LADOS.map(function (l) { return '<option>' + l + '</option>'; }).join('') + '</select></div></div>' +
    '<div class="form-row"><div class="fg"><label>Componente *</label><select id="cdComp">' + CAD_COMPONENTES.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select></div></div>' +
    '<div class="form-row"><div class="fg"><label>Valor Nuevo (mm)</label><input type="number" id="cdNuevo"></div>' +
    '<div class="fg"><label>Límite de desgaste (mm)</label><input type="number" id="cdLimite"></div>' +
    '<div class="fg"><label>Valor actual (mm)</label><input type="number" id="cdActual"></div></div>' +
    '<div class="form-row"><div class="fg"><label>F. Instalación</label><input type="date" id="cdFecha" value="' + new Date().toISOString().slice(0, 10) + '"></div></div>' +
    '<br><button class="btn" onclick="saveCad()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
};
window.saveCad = function () {
  const sigla = $('cdEq').value;
  if (!sigla) return toast('⚠️ Selecciona equipo');
  const valorNuevo = parseFloat($('cdNuevo').value) || null;
  const limiteDesgaste = parseFloat($('cdLimite').value) || null;
  const valorActual = parseFloat($('cdActual').value) || null;
  const pct = (valorNuevo != null && limiteDesgaste != null && valorActual != null) ? Math.round(Math.max(0, (valorActual - limiteDesgaste) / (valorNuevo - limiteDesgaste) * 100)) : null;
  const cad = S.g('cad') || [];
  cad.push({
    id: _uuidV4(), sigla, lado: $('cdLado').value, componente: $('cdComp').value,
    valorNuevo, limiteDesgaste, valorActual, pctRemanente: pct,
    fechaInst: $('cdFecha').value, ultimaMedicion: null, estado: 'Operativo'
  });
  S.s('cad', cad); cm(); renders.cad(); toast('✅ Componente agregado');
};
window.addMedicionCad = function (idx) {
  const cad = S.g('cad') || []; const c = cad[idx]; if (!c) return;
  const eq = (S.g('eq') || []).find(function (e) { return e.sigla === c.sigla; });
  sm('<h3><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="2" y="7" width="16" height="6" rx="1"/><line x1="5" y1="7" x2="5" y2="9.5"/><line x1="8" y1="7" x2="8" y2="9.5"/><line x1="11" y1="7" x2="11" y2="9.5"/><line x1="14" y1="7" x2="14" y2="9.5"/></svg> Medición — ' + escapeHtml(c.sigla) + ' ' + escapeHtml(c.lado) + ' ' + escapeHtml(c.componente) + '</h3>' +
    '<div class="form-row"><div class="fg"><label>Fecha</label><input type="date" id="cmFecha" value="' + new Date().toISOString().slice(0, 10) + '"></div>' +
    '<div class="fg"><label>Horómetro equipo</label><input type="number" id="cmHorom" value="' + (eq ? eq.horomActual : 0) + '"></div></div>' +
    '<div class="form-row"><div class="fg"><label>Valor medido (mm)</label><input type="number" id="cmValor"></div></div>' +
    '<div class="fg"><label>Observación</label><input id="cmObs" style="width:100%"></div>' +
    '<br><button class="btn" onclick="saveMedicionCad(' + idx + ')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar</button> <button class="btn btn-o" onclick="cm()">Cancelar</button>');
};
window.saveMedicionCad = function (idx) {
  const cad = S.g('cad') || []; const c = cad[idx]; if (!c) return;
  const valorMedido = parseFloat($('cmValor').value);
  if (isNaN(valorMedido)) return toast('⚠️ Ingresa el valor medido');
  const med = {
    sigla: c.sigla, lado: c.lado, componente: c.componente, fecha: $('cmFecha').value,
    horom: parseFloat($('cmHorom').value) || 0, valorMedido, obs: $('cmObs').value || ''
  };
  const meds = S.g('cadMed') || []; meds.push(med); S.s('cadMed', meds);
  c.valorActual = valorMedido;
  c.ultimaMedicion = med.fecha;
  if (c.valorNuevo != null && c.limiteDesgaste != null) {
    c.pctRemanente = Math.round(Math.max(0, (valorMedido - c.limiteDesgaste) / (c.valorNuevo - c.limiteDesgaste) * 100));
  }
  S.s('cad', cad); cm(); renders.cad(); toast('✅ Medición guardada');
};
window.verHistorialCad = function (idx) {
  const cad = S.g('cad') || []; const c = cad[idx]; if (!c) return;
  const meds = (S.g('cadMed') || []).filter(function (m) { return m.sigla === c.sigla && m.lado === c.lado && m.componente === c.componente; })
    .sort(function (a, b) { return (b.fecha || '').localeCompare(a.fecha || ''); });
  sm('<h3><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8.5" cy="8.5" r="5.5"/><line x1="12.7" y1="12.7" x2="17.5" y2="17.5"/></svg> ' + escapeHtml(c.sigla) + ' — ' + escapeHtml(c.lado) + ' | ' + escapeHtml(c.componente) + '</h3>' +
    '<p style="color:var(--tx2);margin-bottom:12px">Valor nuevo: <b>' + (c.valorNuevo != null ? c.valorNuevo + 'mm' : '—') + '</b> · Límite: <b>' + (c.limiteDesgaste != null ? c.limiteDesgaste + 'mm' : '—') + '</b> · Actual: <b>' + (c.valorActual != null ? c.valorActual + 'mm' : '—') + '</b></p>' +
    '<div class="tbl-wrap"><table><tr><th>Fecha</th><th>Horómetro</th><th>Valor medido</th><th>Obs.</th></tr>' +
    meds.map(function (m) { return '<tr><td>' + escapeHtml(m.fecha || '') + '</td><td class="mono">' + fn(m.horom || 0) + 'h</td><td class="mono">' + m.valorMedido + 'mm</td><td style="font-size:11px">' + escapeHtml(m.obs || '') + '</td></tr>'; }).join('') +
    '</table></div><br><button class="btn btn-o" onclick="cm()">Cerrar</button>');
};
window.delCad = function (idx) {
  if (window._userRole && window._userRole !== 'admin') return toast('⛔ Solo un administrador puede eliminar registros');
  const cad = S.g('cad') || []; const c = cad[idx]; if (!c) return;
  if (!confirm('¿Eliminar ' + c.sigla + ' ' + c.lado + ' ' + c.componente + '?')) return;
  cad.splice(idx, 1); S.s('cad', cad); renders.cad();
};
