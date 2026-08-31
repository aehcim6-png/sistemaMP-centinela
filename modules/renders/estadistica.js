// Pestaña Estadística (sub-pestaña de Componentes, 2026-08) — comparativas de
// flota en un solo lugar permanente: por Equipo, por Componente, por Técnico
// y por Modelo. A pedido del usuario ("i.a nuestro programa tiene predictivo,
// probabilidad y destrabe, pero estadística no lo tiene").
//
// Reusa el mismo cálculo que originalmente vivía disperso en ventanas
// emergentes de Correctivos (analisisFallas/analisisDocumentacion/
// analisisReingresos en ot.js) en vez de duplicarlo — con dos mejoras:
//   1. Equipo/Componente usan esFallaMTBF() (logic.js) como filtro, la
//      misma fuente única que ya usa MTBF/Confiabilidad/% Flota sin falla
//      (el popup analisisFallas de ot.js usaba un criterio más suelto).
//   2. Equipo/Componente/Modelo suman 'otHist' (historial 2022-2025 cargado
//      desde Excel, ver conversación 2026-08-15) para más muestra — Técnico
//      no, porque ese historial no trae quién hizo el trabajo.
// La comparativa por Modelo es enteramente nueva: no existía en ningún lado.
// Consolidación 2026-08-30: el botón "Análisis de Fallas (MTBF)" de
// Correctivos (ot.js) enlazaba a un popup propio que recalculaba lo mismo
// que Por Equipo/Por Componente acá, con una versión peor (sin esFallaMTBF
// ni otHist). Ese popup se eliminó — ahora el botón de Correctivos enlaza
// directo a esta pestaña. Documentación por Técnico y Reingresos Tempranos
// siguen viviendo también como popups en ot.js (no se tocaron en esta
// consolidación): esa lógica está anclada por
// tests/sincroniaReglasCorrectivos.test.js, que la compara contra la Edge
// Function del correo diario (alerta-pm/index.ts) — fusionarla con la
// vista Por Técnico de acá implicaría reescribir ese guardarrail.
// Módulo ES real (Fase 3, 2026-08-30, octava tanda: Grupo 3 — depende de
// ot.js, ya migrado en la séptima tanda) — ver nota de migración en mov.js
// (primera tanda, mismo patrón).

function _estFallasCombinadas(ot, otHist) {
  // Une ambas fuentes en una sola lista de eventos {sigla, componente, fecha, horom, codFalla}.
  // codFalla (modo de falla: Eléctrico/Hidráulico/Mecánico/etc., ver ot.js) solo
  // existe en 'ot' — el historial cargado desde WhatsApp/Excel (otHist) no trae
  // esa clasificación, así que sus eventos quedan sin codFalla (se agrupan como
  // "Sin clasificar" en _estTablaModoFalla, nunca se inventa un valor).
  var eventos = [];
  (ot || []).forEach(function (o) {
    if (!o || !o.sigla || !esFallaMTBF(o)) return;
    var comp = (o.componente && o.componente.trim()) || _componenteDeSintoma(o.sintoma);
    eventos.push({ sigla: o.sigla, componente: comp || '', fecha: o.fecha, horom: o.horom, codFalla: o.codFalla || '' });
  });
  (otHist || []).forEach(function (o) {
    if (!o || !o.sigla) return;
    eventos.push({ sigla: o.sigla, componente: o.sistema || '', fecha: o.fecha, horom: o.horometro, codFalla: '' });
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
        '<td style="text-align:center">' + (r.mtbf == null ? '<span style="color:var(--tx3)">—</span>' : fn(Math.round(r.mtbf))) + '</td></tr>';
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

// Pareto de modos de falla (2026-08-31, propuesta de "control de gestión ↔
// confiabilidad de activos" de esta sesión): la herramienta más básica de RCM
// (Reliability Centered Maintenance) — de todos los modos de falla, ¿cuáles
// pocos explican la mayoría de las fallas? Antes esto era imposible: "Causa
// Raíz" es texto libre (cada quien escribe distinto, nunca agrupa). codFalla
// (Código Falla) ya existía como campo estructurado en el formulario de OT
// pero recién quedó visible/editable en la tabla de Correctivos — ver el
// arreglo de columnas de esa tabla, mismo día.
function _estTablaModoFalla(eventos) {
  var porModo = {};
  eventos.forEach(function (e) {
    var m = e.codFalla || 'Sin clasificar';
    porModo[m] = (porModo[m] || 0) + 1;
  });
  var total = eventos.length;
  var lista = Object.keys(porModo).map(function (m) { return { modo: m, fallas: porModo[m] }; })
    .sort(function (a, b) { return b.fallas - a.fallas; });
  var maxFallas = lista.length ? lista[0].fallas : 0;
  var acumPrev = 0;
  lista.forEach(function (r) {
    r.pct = total ? Math.round(r.fallas / total * 1000) / 10 : 0;
    // "Pocos vitales" de Pareto: si el acumulado ANTES de esta fila ya llegó al
    // 80%, esta fila ya no es vital. La fila que recién cruza el 80% (ej. de 72%
    // a 91%) sí cuenta — es la que empuja el total sobre el umbral.
    r.vital = acumPrev < 80;
    acumPrev += r.pct;
    r.acumulado = Math.round(acumPrev * 10) / 10;
    r.barPct = maxFallas ? Math.round(r.fallas / maxFallas * 100) : 0;
  });
  var sinClasificar = porModo['Sin clasificar'] || 0;
  return '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px">' +
    '<div class="chart-t">📊 Pareto de Modos de Falla — toda la flota</div>' +
    '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Combina correctivos actuales + historial 2022-2025 (el historial no trae modo de falla clasificado, cae en "Sin clasificar"). Los modos marcados ⭐ son los "pocos vitales" de Pareto: juntos explican el 80% de las fallas — ahí es donde más rinde enfocar un plan de confiabilidad.' +
    (sinClasificar ? ' ' + sinClasificar + ' de ' + total + ' fallas (' + Math.round(sinClasificar / total * 100) + '%) todavía no tienen modo de falla clasificado — clasifícalas en Correctivos (columna "Cód.Falla") para que este análisis sea más completo.' : '') +
    '</div>' +
    '<div class="tbl-wrap"><table><tr><th>Modo de Falla</th><th>Fallas</th><th>% del total</th><th>Barra</th><th>Acumulado</th></tr>' +
    (total ? lista.map(function (r) {
      return '<tr style="' + (r.vital ? 'background:rgba(245,158,11,.08)' : '') + '">' +
        '<td style="font-weight:600' + (r.vital ? ';color:var(--ac)' : '') + '">' + (r.vital ? '⭐ ' : '') + escapeHtml(r.modo) + '</td>' +
        '<td style="text-align:center;font-weight:700">' + r.fallas + '</td>' +
        '<td style="text-align:center">' + r.pct + '%</td>' +
        '<td><div style="background:color-mix(in srgb,var(--ac) 18%,var(--bg4));border-radius:4px;height:12px;width:140px;overflow:hidden"><div style="background:var(--ac);height:100%;width:' + r.barPct + '%"></div></div></td>' +
        '<td style="text-align:center;color:var(--tx3)">' + r.acumulado + '%</td></tr>';
    }).join('') : '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--tx3)">Sin fallas registradas todavía</td></tr>') +
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

export function renderEstadistica() {
  if (!$('s-estadistica')) return;
  var vista = window._estadisticaVista || 'equipo';
  var eq = S.g('eq') || [];
  var ot = S.g('ot') || [];
  var otHist = S.g('otHist') || [];
  var eventos = _estFallasCombinadas(ot, otHist);

  var content = '';
  if (vista === 'equipo') content = _estTablaEquipo(eq, eventos);
  else if (vista === 'componente') content = _estTablaComponente(eventos);
  else if (vista === 'modo') content = _estTablaModoFalla(eventos);
  else if (vista === 'modelo') content = _estTablaModelo(eq, eventos);
  else if (vista === 'tecnico') content = _estTablaTecnico(ot);

  $('s-estadistica').innerHTML =
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="12" width="3" height="5"/><rect x="8.5" y="8" width="3" height="9"/><rect x="14" y="4" width="3" height="13"/></svg> Estadística</div>' +
    '<div class="sec-s">Comparativas de flota — equipo, componente, técnico y modelo</div></div></div>' +
    '<select id="fEstadisticaVista" onchange="window._estadisticaVista=this.value;renders.estadistica()" style="margin-bottom:16px;font-weight:600">' +
    '<option value="equipo"' + (vista === 'equipo' ? ' selected' : '') + '>🏗 Por Equipo</option>' +
    '<option value="componente"' + (vista === 'componente' ? ' selected' : '') + '>🔧 Por Componente</option>' +
    '<option value="modo"' + (vista === 'modo' ? ' selected' : '') + '>📊 Pareto de Modo de Falla</option>' +
    '<option value="modelo"' + (vista === 'modelo' ? ' selected' : '') + '>🚜 Por Modelo</option>' +
    '<option value="tecnico"' + (vista === 'tecnico' ? ' selected' : '') + '>👷 Por Técnico</option>' +
    '</select>' +
    content;
}

// Puente window/renders — ver nota en mov.js (primera tanda).
window.renderEstadistica = renderEstadistica;
renders.estadistica = renderEstadistica;
