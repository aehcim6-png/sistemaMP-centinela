// Pestaña Estadística (sub-pestaña de Componentes, 2026-08) — comparativas de
// flota en un solo lugar permanente: por Equipo, por Componente, por Técnico
// y por Modelo. A pedido del usuario ("i.a nuestro programa tiene predictivo,
// probabilidad y destrabe, pero estadística no lo tiene").
//
// Reusa el mismo cálculo que ya existía disperso en ventanas emergentes de
// Correctivos (analisisFallas/analisisDocumentacion/analisisReingresos en
// ot.js) en vez de duplicarlo — con dos mejoras al traerlo acá:
//   1. Equipo/Componente ahora usan esFallaMTBF() (logic.js) como filtro,
//      la misma fuente única que ya usa MTBF/Confiabilidad/% Flota sin falla
//      (analisisFallas en ot.js todavía usa un criterio más suelto/antiguo).
//   2. Equipo/Componente/Modelo suman 'otHist' (historial 2022-2025 cargado
//      desde Excel, ver conversación 2026-08-15) para más muestra — Técnico
//      no, porque ese historial no trae quién hizo el trabajo.
// La comparativa por Modelo es enteramente nueva: no existía en ningún lado.
// Script plano (NO módulo ES), mismo scope global de siempre.

function _estFallasCombinadas(ot, otHist) {
  // Une ambas fuentes en una sola lista de eventos {sigla, componente, fecha, horom}.
  var eventos = [];
  (ot || []).forEach(function (o) {
    if (!o || !o.sigla || !esFallaMTBF(o)) return;
    var comp = (o.componente && o.componente.trim()) || _componenteDeSintoma(o.sintoma);
    eventos.push({ sigla: o.sigla, componente: comp || '', fecha: o.fecha, horom: o.horom });
  });
  (otHist || []).forEach(function (o) {
    if (!o || !o.sigla) return;
    eventos.push({ sigla: o.sigla, componente: o.sistema || '', fecha: o.fechaInst, horom: o.horometro });
  });
  return eventos;
}

function _estTablaEquipo(eq, eventos) {
  var porEq = {};
  eventos.forEach(function (e) {
    if (!porEq[e.sigla]) porEq[e.sigla] = { sigla: e.sigla, fallas: 0, horoms: [] };
    porEq[e.sigla].fallas++;
    if (e.horom > 0) porEq[e.sigla].horoms.push(e.horom);
  });
  var lista = Object.keys(porEq).map(function (s) {
    var d = porEq[s];
    var eqObj = eq.find(function (x) { return x.sigla === s; });
    return {
      sigla: s, modelo: eqObj ? (eqObj.modelo || '—') : '—',
      fallas: d.fallas, mtbf: d.horoms.length >= 2 ? C.mtbfReal(d.horoms) : null
    };
  }).sort(function (a, b) { return b.fallas - a.fallas; }).slice(0, 25);
  return '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px">' +
    '<div class="chart-t">🏗 Equipos con más fallas (Bad Actors)</div>' +
    '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Combina correctivos actuales (esFallaMTBF) + historial 2022-2025 cargado desde Excel. MTBF = intervalo real entre fallas sucesivas de horómetro, solo con 2+ fallas con horómetro registrado.</div>' +
    '<div class="tbl-wrap"><table><tr><th>Equipo</th><th>Modelo</th><th>Fallas</th><th>MTBF (h)</th></tr>' +
    (lista.length ? lista.map(function (r) {
      return '<tr><td class="mono" style="color:var(--ac);font-weight:600">' + escapeHtml(r.sigla) + '</td>' +
        '<td style="font-size:11px">' + escapeHtml(r.modelo) + '</td>' +
        '<td style="text-align:center;font-weight:700">' + r.fallas + '</td>' +
        '<td style="text-align:center">' + (r.mtbf == null ? '<span style="color:var(--tx3)">—</span>' : Math.round(r.mtbf).toLocaleString()) + '</td></tr>';
    }).join('') : '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--tx3)">Sin fallas registradas todavía</td></tr>') +
    '</table></div></div>';
}

function _estTablaComponente(eventos) {
  var porComp = {};
  eventos.forEach(function (e) {
    if (!e.componente) return;
    if (!porComp[e.componente]) porComp[e.componente] = { comp: e.componente, fallas: 0, equipos: {} };
    porComp[e.componente].fallas++;
    porComp[e.componente].equipos[e.sigla] = true;
  });
  var lista = Object.keys(porComp).map(function (c) {
    var d = porComp[c];
    return { comp: c, fallas: d.fallas, nEquipos: Object.keys(d.equipos).length };
  }).sort(function (a, b) { return b.fallas - a.fallas; });
  return '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px">' +
    '<div class="chart-t">🔧 Componentes que más fallan — toda la flota</div>' +
    '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Combina correctivos actuales + historial 2022-2025. Componente resuelto por texto libre del síntoma cuando el campo estructurado viene vacío (casi siempre).</div>' +
    '<div class="tbl-wrap"><table><tr><th>Componente</th><th>Fallas</th><th>Equipos afectados</th></tr>' +
    (lista.length ? lista.map(function (r) {
      return '<tr><td style="font-weight:600">' + escapeHtml(r.comp) + '</td>' +
        '<td style="text-align:center;font-weight:700">' + r.fallas + '</td>' +
        '<td style="text-align:center">' + r.nEquipos + '</td></tr>';
    }).join('') : '<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--tx3)">Sin componentes clasificados todavía</td></tr>') +
    '</table></div></div>';
}

function _estTablaModelo(eq, eventos) {
  var modeloDeEquipo = {};
  eq.forEach(function (e) { modeloDeEquipo[e.sigla] = e.modelo || 'Sin modelo'; });
  var equiposPorModelo = {};
  eq.forEach(function (e) {
    var m = e.modelo || 'Sin modelo';
    (equiposPorModelo[m] = equiposPorModelo[m] || {}).add = 1; // marca de existencia
    equiposPorModelo[m][e.sigla] = true;
  });
  var porModelo = {};
  eventos.forEach(function (e) {
    var modelo = modeloDeEquipo[e.sigla];
    if (!modelo) return;
    if (!porModelo[modelo]) porModelo[modelo] = { modelo: modelo, fallas: 0 };
    porModelo[modelo].fallas++;
  });
  var lista = Object.keys(porModelo).map(function (m) {
    var d = porModelo[m];
    var nEquipos = Object.keys(equiposPorModelo[m] || {}).filter(function (k) { return k !== 'add'; }).length || 1;
    return { modelo: m, fallas: d.fallas, nEquipos: nEquipos, fallasPorEquipo: Math.round(d.fallas / nEquipos * 10) / 10 };
  }).filter(function (r) { return r.nEquipos >= 2; }) // 1 solo equipo no es "comparar modelos", es comparar ese equipo
    .sort(function (a, b) { return b.fallasPorEquipo - a.fallasPorEquipo; });
  return '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px">' +
    '<div class="chart-t">🚜 Comparativa por Modelo de Equipo</div>' +
    '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Fallas por equipo PROMEDIO de cada modelo (no el total, que favorecería a los modelos con más unidades) — combina correctivos actuales + historial. Solo modelos con 2+ equipos, para que sea una comparación real entre modelos y no solo entre 2 equipos individuales.</div>' +
    '<div class="tbl-wrap"><table><tr><th>Modelo</th><th>Equipos</th><th>Fallas totales</th><th>Fallas / equipo</th></tr>' +
    (lista.length ? lista.map(function (r) {
      var col = r.fallasPorEquipo >= 20 ? 'var(--danger)' : r.fallasPorEquipo >= 8 ? 'var(--w)' : 'var(--ok)';
      return '<tr><td style="font-weight:600">' + escapeHtml(r.modelo) + '</td>' +
        '<td style="text-align:center">' + r.nEquipos + '</td>' +
        '<td style="text-align:center">' + r.fallas + '</td>' +
        '<td style="text-align:center;font-weight:700;color:' + col + '">' + r.fallasPorEquipo + '</td></tr>';
    }).join('') : '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--tx3)">Se necesitan al menos 2 equipos del mismo modelo con fallas registradas</td></tr>') +
    '</table></div></div>';
}

function _estTablaTecnico(ot) {
  // Documentación: mismo cálculo que analisisDocumentacion() (ot.js).
  var porTecDoc = {};
  (ot || []).forEach(function (o) {
    if (!(o.tipo === 'Correctivo' || o.tipo === 'Falla Operacional')) return;
    if (!(!o.estadoOT || o.estadoOT === 'Cerrada')) return;
    var nombre = (o.tecnico || '').split('/')[0].trim();
    if (!nombre) return;
    if (!porTecDoc[nombre]) porTecDoc[nombre] = { nombre: nombre, total: 0, conSolucion: 0 };
    porTecDoc[nombre].total++;
    if (o.solucion && o.solucion.trim()) porTecDoc[nombre].conSolucion++;
  });
  // Reingresos tempranos: mismo cálculo que analisisReingresos() (ot.js).
  var EXCLUIR = ['Neumáticos', 'GET / Cuchillas', 'Elemento de Desgaste', 'Filtro de Aire', 'Filtro de Combustible', 'Foco/Ampolleta'];
  var porGrupo = {};
  (ot || []).forEach(function (o) {
    if (!(o.tipo === 'Correctivo' || o.tipo === 'Falla Operacional')) return;
    if (!o.sigla || !o.fechaEntrada) return;
    var comp = (o.componente || '').trim() || _componenteDeSintoma(o.sintoma);
    if (!comp || EXCLUIR.indexOf(comp) >= 0) return;
    var nombre = (o.tecnico || '').split('/')[0].trim();
    if (!nombre) return;
    var k = o.sigla + '|' + comp;
    (porGrupo[k] = porGrupo[k] || []).push({ entrada: o.fechaEntrada, salida: o.fechaSalida, tecnico: nombre });
  });
  var porTecReing = {};
  Object.keys(porGrupo).forEach(function (k) {
    var lista = porGrupo[k].slice().sort(function (a, b) { return a.entrada < b.entrada ? -1 : a.entrada > b.entrada ? 1 : 0; });
    lista.forEach(function (actual, i) {
      if (!actual.salida) return;
      if (!porTecReing[actual.tecnico]) porTecReing[actual.tecnico] = { total: 0, reingresos: 0 };
      porTecReing[actual.tecnico].total++;
      var siguiente = lista[i + 1];
      if (siguiente) {
        var dias = _diasEntreISO(actual.salida, siguiente.entrada);
        if (dias >= 0 && dias <= 7) porTecReing[actual.tecnico].reingresos++;
      }
    });
  });
  var nombres = Object.keys(porTecDoc);
  var lista = nombres.map(function (n) {
    var doc = porTecDoc[n];
    var reing = porTecReing[n];
    return {
      nombre: n, total: doc.total,
      pctDoc: Math.round(doc.conSolucion / doc.total * 100),
      pctReing: reing && reing.total >= 15 ? Math.round(reing.reingresos / reing.total * 100) : null
    };
  }).filter(function (t) { return t.total >= 15; })
    .sort(function (a, b) { return a.pctDoc - b.pctDoc; });
  return '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px">' +
    '<div class="chart-t">👷 Comparativa por Técnico</div>' +
    '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Solo correctivos actuales (el historial de Excel no trae quién hizo el trabajo). % documentado = OT cerradas con "Solución" registrada. % reingreso = mismo equipo+componente vuelve a fallar dentro de 7 días (excluye consumibles de desgaste esperado). Solo técnicos con 15+ OT — con menos, el % no significa nada.</div>' +
    '<div class="tbl-wrap"><table><tr><th>Técnico</th><th>OT cerradas</th><th>% documentado</th><th>% reingreso ≤7d</th></tr>' +
    (lista.length ? lista.map(function (t) {
      var colDoc = t.pctDoc < 50 ? 'var(--danger)' : t.pctDoc < 80 ? 'var(--w)' : 'var(--ok)';
      var colReing = t.pctReing == null ? 'var(--tx3)' : t.pctReing >= 15 ? 'var(--danger)' : 'var(--ok)';
      return '<tr><td style="font-weight:600">' + escapeHtml(t.nombre) + '</td>' +
        '<td style="text-align:center">' + t.total + '</td>' +
        '<td style="text-align:center;font-weight:700;color:' + colDoc + '">' + t.pctDoc + '%</td>' +
        '<td style="text-align:center;font-weight:700;color:' + colReing + '">' + (t.pctReing == null ? '—' : t.pctReing + '%') + '</td></tr>';
    }).join('') : '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--tx3)">Sin técnicos con 15+ OT cerradas todavía</td></tr>') +
    '</table></div>' +
    '<div style="font-size:10px;color:var(--tx3);margin-top:8px">No mide calidad del trabajo, solo constancia escrita y si la reparación aguantó. Un % bajo amerita conversación de terreno, no una conclusión directa.</div>' +
    '</div>';
}

window.renderEstadistica = function () {
  if (!$('s-estadistica')) return;
  var vista = window._estadisticaVista || 'equipo';
  var eq = S.g('eq') || [];
  var ot = S.g('ot') || [];
  var otHist = S.g('otHist') || [];
  var eventos = _estFallasCombinadas(ot, otHist);

  var content = '';
  if (vista === 'equipo') content = _estTablaEquipo(eq, eventos);
  else if (vista === 'componente') content = _estTablaComponente(eventos);
  else if (vista === 'modelo') content = _estTablaModelo(eq, eventos);
  else if (vista === 'tecnico') content = _estTablaTecnico(ot);

  $('s-estadistica').innerHTML =
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="12" width="3" height="5"/><rect x="8.5" y="8" width="3" height="9"/><rect x="14" y="4" width="3" height="13"/></svg> Estadística</div>' +
    '<div class="sec-s">Comparativas de flota — equipo, componente, técnico y modelo</div></div></div>' +
    '<select id="fEstadisticaVista" onchange="window._estadisticaVista=this.value;renders.estadistica()" style="margin-bottom:16px;font-weight:600">' +
    '<option value="equipo"' + (vista === 'equipo' ? ' selected' : '') + '>🏗 Por Equipo</option>' +
    '<option value="componente"' + (vista === 'componente' ? ' selected' : '') + '>🔧 Por Componente</option>' +
    '<option value="modelo"' + (vista === 'modelo' ? ' selected' : '') + '>🚜 Por Modelo</option>' +
    '<option value="tecnico"' + (vista === 'tecnico' ? ' selected' : '') + '>👷 Por Técnico</option>' +
    '</select>' +
    content;
};
