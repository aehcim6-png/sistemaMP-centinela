// Pestaña Alertas PM4 (overhaul) — primera extracción de la Fase 2 de
// modularización. Script plano (NO módulo ES): sigue viviendo en el mismo
// scope global de siempre (S, C, $, escapeHtml, fn, fd, cm, toast, renders),
// igual que logic.js. Se carga antes del script principal, que solo hace
// `renders.al = renderAl;` para enchufarlo — nada más cambia.
window.renderAl = function () {
  const eq = S.g('eq') || [], al = S.g('al') || [];
  const data = eq.map(e => {
    const f = e.frecPM || 250, unidad = e.unidad === 'km' ? 'km' : 'h';
    const p4 = C.proxPM(e.horomActual, f * 8);
    const h = p4 - e.horomActual, d = e.hrsDia > 0 ? Math.round(h / e.hrsDia) : 999;
    const orig = al.find(a => a.sigla === e.sigla);
    return { ...e, proxPM4: p4, hrsP4: h, diasP4: d, unidad, fechaP4: new Date(Date.now() + d * 864e5).toISOString().slice(0, 10), alerta: C.alertaPM4(h, f, unidad), rep: orig?.repuestos || '' }
  }).sort((a, b) => a.hrsP4 - b.hrsP4);
  $('s-al').innerHTML = `
    <div class="sec-h"><div><div class="sec-t">🔴 Alertas PM4 — Overhaul (8× frecPM propio de cada equipo)</div><div class="sec-s">Click en repuestos para editar</div></div></div>
    <div class="tbl-wrap"><table>
      <tr><th>Sigla</th><th>Tipo</th><th>Horóm.</th><th>Próx PM4</th><th>Restante</th><th>Días</th><th>Fecha Est.</th><th>Alerta</th><th>Repuestos Clave</th></tr>
      ${data.map((e, i) => `<tr>
        <td class="mono" style="color:var(--ac)">${escapeHtml(e.sigla)}</td><td>${escapeHtml(e.tipo)}</td>
        <td class="mono">${fn(e.horomActual)}${e.unidad}</td><td class="mono">${fn(e.proxPM4)}${e.unidad}</td>
        <td class="mono" style="color:${e.hrsP4 < (e.frecPM || 250) * 2 ? 'var(--danger)' : 'var(--tx)'};font-weight:700">${fn(e.hrsP4)}${e.unidad}</td>
        <td class="mono">${e.diasP4}</td><td class="mono">${fd(e.fechaP4)}</td>
        <td><span class="badge ${e.alerta.c}">${e.alerta.t}</span></td>
        <td style="font-size:10px;max-width:300px;white-space:normal;cursor:pointer" onclick="editAlRep('${escapeHtml(e.sigla)}')">${e.rep ? escapeHtml(e.rep) : '<span style=color:var(--tx3)>Click para agregar</span>'}</td>
      </tr>`).join('')}
    </table></div>`;
};
window.editAlRep = function (sigla) {
  const al = S.g('al') || [], a = al.find(x => x.sigla === sigla) || { sigla, repuestos: '' };
  sm(`<h3>Repuestos PM4 — ${escapeHtml(sigla)}</h3>
    <div class="fg"><label>Repuestos Clave (separar con |)</label><textarea id="aRep">${escapeHtml(a.repuestos || '')}</textarea></div><br>
    <button class="btn" onclick="saveAlRep('${sigla}')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 3 h9 l4 4 v10 h-13 z"/><rect x="6.5" y="3" width="6" height="5"/><rect x="6" y="12" width="8" height="5"/></svg> Guardar</button>`);
};
window.saveAlRep = function (sigla) {
  const al = S.g('al') || [], a = al.find(x => x.sigla === sigla);
  if (a) a.repuestos = $('aRep').value; else al.push({ sigla, repuestos: $('aRep').value });
  S.s('al', al); cm(); renders.al(); toast('✅ Repuestos actualizados');
};
