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

function _estFallasCombinadas(ot, otHist, informesFalla) {
  // Une las 3 fuentes en una sola lista de eventos {sigla, componente, fecha, horom, codFalla}.
  // codFalla (modo de falla: Eléctrico/Hidráulico/Mecánico/etc., ver ot.js) solo
  // existe en 'ot' — el historial cargado desde WhatsApp/Excel (otHist) no trae
  // esa clasificación, así que sus eventos quedan sin codFalla (se agrupan como
  // "Sin clasificar" en _estTablaModoFalla, nunca se inventa un valor). Lo mismo
  // aplica a 'informesFalla' (Falla Catastrófica, auditoría 2026-09: quedaba
  // invisible para este Pareto — mismo hallazgo que otHist).
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
  (informesFalla || []).forEach(function (i) {
    if (!i || !i.sigla || i.tipoEvento !== 'Falla Catastrófica') return;
    eventos.push({ sigla: i.sigla, componente: (i.componente && i.componente.trim()) || '', fecha: i.fecha, horom: i.horometroActual, codFalla: '' });
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
  var todos = Object.keys(porEq).map(function (s) {
    var d = porEq[s];
    var eqObj = eq.find(function (x) { return x.sigla === s; });
    return {
      sigla: s, modelo: eqObj ? (eqObj.modelo || '—') : '—',
      fallas: d.fallas, mtbf: d.horoms.length >= 2 ? C.mtbfReal(d.horoms) : null
    };
  });
  // paretoAcumulado ANTES de recortar a 25 (logic.js): el % del total y el
  // acumulado deben reflejar TODA la flota, no solo las 25 filas que se
  // muestran — si se calculara después del slice, un equipo #30 igual de
  // problemático quedaría invisible pero además el acumulado del resto
  // quedaría inflado, como si esos 25 fueran el 100% de las fallas.
  var lista = paretoAcumulado(todos).slice(0, 25);
  return '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px">' +
    '<div class="chart-t">🏗 Equipos con más fallas (Bad Actors) — Pareto</div>' +
    '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Combina correctivos actuales (esFallaMTBF) + historial 2022-2025 cargado desde Excel. MTBF = intervalo real entre fallas sucesivas de horómetro, solo con 2+ fallas con horómetro registrado. Los equipos marcados ⭐ son los "pocos vitales" de Pareto: juntos explican el 80% de las fallas de toda la flota — ahí es donde más rinde enfocar inspecciones o reemplazo. % y acumulado se calculan sobre TODA la flota, aunque la tabla solo muestre los primeros 25.</div>' +
    '<div class="tbl-wrap"><table><tr><th>Equipo</th><th>Modelo</th><th>Fallas</th><th>% del total</th><th>Barra</th><th>Acumulado</th><th>MTBF (h)</th></tr>' +
    (lista.length ? lista.map(function (r) {
      return '<tr style="' + (r.vital ? 'background:rgba(245,158,11,.08)' : '') + '">' +
        '<td class="mono" style="color:var(--ac);font-weight:600">' + (r.vital ? '⭐ ' : '') + escapeHtml(r.sigla) + '</td>' +
        '<td style="font-size:11px">' + escapeHtml(r.modelo) + '</td>' +
        '<td style="text-align:center;font-weight:700">' + r.fallas + '</td>' +
        '<td style="text-align:center">' + r.pct + '%</td>' +
        '<td><div style="background:color-mix(in srgb,var(--ac) 18%,var(--bg4));border-radius:4px;height:12px;width:140px;overflow:hidden"><div style="background:var(--ac);height:100%;width:' + r.barPct + '%"></div></div></td>' +
        '<td style="text-align:center;color:var(--tx3)">' + r.acumulado + '%</td>' +
        '<td style="text-align:center">' + (r.mtbf == null ? '<span style="color:var(--tx3)">—</span>' : fn(Math.round(r.mtbf))) + '</td></tr>';
    }).join('') : '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--tx3)">Sin fallas registradas todavía</td></tr>') +
    '</table></div></div>';
}

// MTBF típico por TIPO de componente (Nivel 3 de "control de gestión ↔
// confiabilidad de activos", 2026-08-31): hasta acá el único MTBF del
// sistema era el de flota completa (mtbfFlotaReal, logic.js) — un motor y un
// neumático no fallan con el mismo patrón, mezclarlos en un solo número
// esconde cuáles tipos de componente realmente están fallando más seguido.
// Mismo método que mtbfFlotaReal (promedio de MTBFs por EQUIPO, nunca un
// intervalo mezclando horómetros de máquinas distintas — no son comparables
// entre sí): acá se agrupa primero por equipo+componente (mínimo 2 fallas de
// ESE componente en ESE equipo, con horómetro real, para tener un intervalo
// que medir) y luego se promedian esos MTBFs entre todos los equipos que
// comparten el mismo tipo de componente.
function _estMtbfPorComponente(eventos) {
  var porEquipoComp = {};
  eventos.forEach(function (e) {
    if (!e.componente || !(e.horom > 0)) return;
    var k = e.sigla + '|' + e.componente;
    (porEquipoComp[k] = porEquipoComp[k] || { componente: e.componente, horoms: [] }).horoms.push(e.horom);
  });
  var porComponente = {};
  Object.keys(porEquipoComp).forEach(function (k) {
    var g = porEquipoComp[k];
    var m = C.mtbfReal(g.horoms);
    if (m == null) return;
    (porComponente[g.componente] = porComponente[g.componente] || []).push(m);
  });
  var mtbfPorComp = {};
  Object.keys(porComponente).forEach(function (c) {
    var vals = porComponente[c];
    mtbfPorComp[c] = Math.round(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length);
  });
  return mtbfPorComp;
}

function _estTablaComponente(eventos, ace, eq) {
  var porComp = {};
  eventos.forEach(function (e) {
    if (!e.componente) return;
    if (!porComp[e.componente]) porComp[e.componente] = { comp: e.componente, fallas: 0, equipos: {} };
    porComp[e.componente].fallas++;
    porComp[e.componente].equipos[e.sigla] = true;
  });
  var mtbfPorComp = _estMtbfPorComponente(eventos);
  var lista = paretoAcumulado(Object.keys(porComp).map(function (c) {
    var d = porComp[c];
    return { comp: c, fallas: d.fallas, nEquipos: Object.keys(d.equipos).length, mtbf: mtbfPorComp[c] != null ? mtbfPorComp[c] : null };
  }));
  return '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px">' +
    '<div class="chart-t">🔧 Componentes que más fallan — toda la flota (Pareto)</div>' +
    '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Combina correctivos actuales + historial 2022-2025. Componente resuelto por texto libre del síntoma cuando el campo estructurado viene vacío (casi siempre). MTBF típico = promedio del intervalo real entre fallas sucesivas (horómetro), promediado entre todos los equipos con 2+ fallas de ese componente — igual de exigente que el MTBF de flota, solo que por tipo de componente. Los componentes marcados ⭐ son los "pocos vitales" de Pareto: juntos explican el 80% de las fallas — ahí es donde más rinde revisar la pauta de PM o el proveedor del repuesto.</div>' +
    '<div class="tbl-wrap"><table><tr><th>Componente</th><th>Fallas</th><th>% del total</th><th>Barra</th><th>Acumulado</th><th>Equipos afectados</th><th>MTBF típico (h)</th></tr>' +
    (lista.length ? lista.map(function (r) {
      return '<tr style="' + (r.vital ? 'background:rgba(245,158,11,.08)' : '') + '">' +
        '<td style="font-weight:600' + (r.vital ? ';color:var(--ac)' : '') + '">' + (r.vital ? '⭐ ' : '') + escapeHtml(r.comp) + '</td>' +
        '<td style="text-align:center;font-weight:700">' + r.fallas + '</td>' +
        '<td style="text-align:center">' + r.pct + '%</td>' +
        '<td><div style="background:color-mix(in srgb,var(--ac) 18%,var(--bg4));border-radius:4px;height:12px;width:140px;overflow:hidden"><div style="background:var(--ac);height:100%;width:' + r.barPct + '%"></div></div></td>' +
        '<td style="text-align:center;color:var(--tx3)">' + r.acumulado + '%</td>' +
        '<td style="text-align:center">' + r.nEquipos + '</td>' +
        '<td style="text-align:center;color:' + (r.mtbf == null ? 'var(--tx3)' : r.mtbf > 2000 ? 'var(--ok)' : r.mtbf > 500 ? 'var(--ac)' : 'var(--danger)') + '">' + (r.mtbf == null ? '—' : fn(r.mtbf)) + '</td></tr>';
    }).join('') : '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--tx3)">Sin componentes clasificados todavía</td></tr>') +
    '</table></div>' +
    _estWeibullPorComponente(eventos) +
    _estKaplanMeierPorComponente(eventos, eq) +
    _estMcfPorComponente(eventos, eq) +
    _estCrowAmsaaPorComponente(eventos) +
    _estCompetingRisksHTML(eventos, eq) +
    _estCorrelacionAceite(eventos, ace) +
    '</div>';
}

// Weibull por componente/categoría de falla, A NIVEL FLOTA (2026-09-12,
// pedido del usuario tras el mismo análisis en neumáticos y componentes
// mayores — "¿y ahora en componentes o correctivos?"). A diferencia del
// MTBF típico de la tabla de arriba (un promedio simple de promedios por
// equipo), acá se ajusta la FORMA real de la distribución de intervalos
// pooled entre todos los equipos con ese componente (analisisVidaUtil
// CorrectivosPorComponente, logic.js) — dice si un componente falla por
// desgaste homogéneo (β&gt;1, priorizar PM preventivo) o de forma más
// aleatoria/temprana (β≈1 o β&lt;1, un cambio preventivo no ayudaría tanto
// como mejorar calidad/instalación).
function _estWeibullPorComponente(eventos) {
  var lista = (typeof analisisVidaUtilCorrectivosPorComponente === 'function') ? analisisVidaUtilCorrectivosPorComponente(eventos) : [];
  if (!lista.length) return '';
  return '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px">' +
    '<div class="chart-t">📐 Forma real de falla por componente — toda la flota (Weibull)</div>' +
    '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Intervalos reales entre fallas sucesivas del mismo componente, calculados equipo por equipo y luego juntados entre todos los equipos con ese componente (no se mezclan horómetros de equipos distintos). β cerca de 1 = fallas parejas/aleatorias en el tiempo. β&lt;1 = fallas más tempranas (revisar calidad/instalación). β&gt;1 = desgaste homogéneo (esperable, priorizar reemplazo preventivo antes de la falla) — η es la vida característica de ese componente según el ajuste real. IC90 = intervalo de confianza 90%: con pocos intervalos pooled, el β puntual puede estar lejos de la forma real.</div>' +
    '<div class="tbl-wrap"><table style="table-layout:fixed"><tr><th style="text-align:left;width:22%">Componente</th><th style="width:15%">N° intervalos</th><th style="width:13%">β (forma)</th><th style="width:18%">η (vida caract.)</th><th style="text-align:left">Interpretación</th></tr>' +
    lista.map(function (g) {
      if (!g.ajuste) return '<tr style="opacity:.55"><td style="font-weight:600">' + escapeHtml(g.grupo) + '</td><td style="text-align:center">' + g.n + '</td><td colspan="3" style="text-align:center;color:var(--tx3);font-size:10px">Sin historial suficiente aún (mínimo 5 intervalos)</td></tr>';
      var interp = typeof interpretacionFormaWeibull === 'function' ? interpretacionFormaWeibull(g.ajuste.beta) : '';
      var ic = g.ajuste.ic90;
      var icAmplio = ic && ic.betaMin < 0.9 && ic.betaMax > 1.1;
      return '<tr>' +
        '<td style="font-weight:600">' + escapeHtml(g.grupo) + '</td>' +
        '<td style="text-align:center">' + g.n + '</td>' +
        '<td style="text-align:center;font-weight:700">' + g.ajuste.beta + (ic ? '<div style="font-size:9px;font-weight:400;color:var(--tx3)">IC90 ' + ic.betaMin + '–' + ic.betaMax + '</div>' : '') + '</td>' +
        '<td style="text-align:center">' + fn(g.ajuste.eta) + 'h' + (ic ? '<div style="font-size:9px;color:var(--tx3)">IC90 ' + fn(ic.etaMin) + '–' + fn(ic.etaMax) + 'h</div>' : '') + '</td>' +
        '<td style="font-size:10px;color:var(--tx2);white-space:normal">' + escapeHtml(interp || '') + (icAmplio ? ' <span style="color:var(--warn)">— rango amplio, todavía no hay certeza sobre la forma real</span>' : '') + '</td></tr>';
    }).join('') +
    '</table></div></div>';
}

// Kaplan-Meier por componente, a nivel FLOTA (2026-09-16 — complemento a
// Weibull de arriba, no un reemplazo: Weibull AJUSTA una forma matemática
// (β/η); Kaplan-Meier calcula la supervivencia empírica directamente de los
// datos, sin asumir ninguna distribución, y SÍ aprovecha los componentes que
// siguen en servicio sin haber fallado todavía ("censurados") — información
// real que el ajuste de Weibull de este archivo descarta por completo
// (kaplanMeierCorrectivosPorComponente, logic.js).
function _estKaplanMeierPorComponente(eventos, eq) {
  var lista = (typeof kaplanMeierCorrectivosPorComponente === 'function') ? kaplanMeierCorrectivosPorComponente(eventos, eq) : [];
  if (!lista.length) return '';
  // Log-Rank Test (2026-09-20) — Kaplan-Meier de abajo muestra la curva
  // real de cada componente, pero no dice si la diferencia ENTRE dos
  // curvas es real o ruido de muestra chica (mismo hueco que ANOVA cerró
  // para promedios de MTTR, acá para curvas completas con censura, que un
  // ANOVA no puede usar). Reusa 'obs' (observaciones crudas) que
  // kaplanMeierCorrectivosPorComponente ya expone junto a la curva.
  var conDatos = lista.filter(function (g) { return g.km; });
  var compA = window._estLrCompA || (conDatos[0] && conDatos[0].componente) || '';
  var compB = window._estLrCompB || (conDatos[1] && conDatos[1].componente) || '';
  var itemA = conDatos.filter(function (g) { return g.componente === compA; })[0];
  var itemB = conDatos.filter(function (g) { return g.componente === compB; })[0];
  var logRank = (itemA && itemB && compA !== compB && typeof logRankTest === 'function') ? logRankTest(itemA.obs, itemB.obs) : null;
  // Cox PH (2026-09-20) — Log-Rank de arriba ya dice si la diferencia es
  // real o ruido; esto cuantifica CUÁNTO (hazard ratio), reusando las
  // mismas observaciones crudas. Puede dar null aunque Log-Rank haya dado
  // un resultado (separación perfecta entre grupos: la verosimilitud de
  // Cox diverge, nunca se muestra un HR inventado en ese caso).
  var coxPH = (itemA && itemB && compA !== compB && typeof coxPHBinario === 'function') ? coxPHBinario(itemA.obs, itemB.obs) : null;
  var comparacionHtml = '';
  if (conDatos.length >= 2) {
    var opciones = conDatos.map(function (g) { return g.componente; });
    comparacionHtml =
      '<div style="margin-top:12px;padding:10px 12px;background:var(--bg3);border-radius:8px">' +
      '<div style="font-size:11px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">¿Es una diferencia real, o ruido de muestra chica? (Log-Rank Test)</div>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">' +
      '<select id="estLrCompA" onchange="window._estLrCompA=this.value;renders.estadistica()" style="font-size:12px">' +
        opciones.map(function (c) { return '<option value="' + escapeHtml(c) + '"' + (c === compA ? ' selected' : '') + '>' + escapeHtml(c) + '</option>'; }).join('') +
      '</select>' +
      '<span style="font-size:11px;color:var(--tx3)">vs.</span>' +
      '<select id="estLrCompB" onchange="window._estLrCompB=this.value;renders.estadistica()" style="font-size:12px">' +
        opciones.map(function (c) { return '<option value="' + escapeHtml(c) + '"' + (c === compB ? ' selected' : '') + '>' + escapeHtml(c) + '</option>'; }).join('') +
      '</select>' +
      '</div>' +
      (compA === compB
        ? '<div style="font-size:11px;color:var(--tx3)">Elegí dos componentes distintos para comparar.</div>'
        : logRank
          ? '<div style="font-size:12px;color:var(--tx2)">χ²=' + logRank.chi2 + ' (gl=1) — <b style="color:' + (logRank.significativo ? 'var(--danger)' : 'var(--ok)') + '">' + (logRank.significativo ? 'diferencia real entre las dos curvas' : 'puede ser ruido de muestra chica') + '</b></div>' +
            '<div style="font-size:10px;color:var(--tx3);margin-top:2px">' + escapeHtml(compA) + ': ' + logRank.fallasA + ' fallas de ' + logRank.nA + ' observaciones · ' + escapeHtml(compB) + ': ' + logRank.fallasB + ' fallas de ' + logRank.nB + ' observaciones. Compara las curvas de supervivencia completas, no solo un promedio — usa también los casos censurados (todavía en servicio sin haber fallado).</div>' +
            (coxPH
              ? '<div style="font-size:12px;color:var(--tx2);margin-top:8px;padding-top:8px;border-top:1px solid var(--bd)">Hazard Ratio (' + escapeHtml(compB) + ' vs. ' + escapeHtml(compA) + '): <b style="color:' + (coxPH.hr > 1 ? 'var(--danger)' : 'var(--ok)') + '">' + coxPH.hr + 'x</b> <span style="font-size:10px;color:var(--tx3)">(IC95% ' + coxPH.hrMin + '–' + coxPH.hrMax + ')</span></div>' +
                '<div style="font-size:10px;color:var(--tx3);margin-top:2px">' + (coxPH.hr > 1 ? escapeHtml(compB) + ' falla ' + coxPH.hr + ' veces más rápido que ' + escapeHtml(compA) : escapeHtml(compA) + ' falla ' + Math.round((1 / coxPH.hr) * 100) / 100 + ' veces más rápido que ' + escapeHtml(compB)) + (coxPH.significativo ? '' : ' — el intervalo de confianza no descarta que no haya diferencia real') + '.</div>'
              : '<div style="font-size:10px;color:var(--tx3);margin-top:6px">Sin un Hazard Ratio confiable para este par (la estimación no converge — típico con muy poca superposición entre los tiempos de falla de ambos grupos).</div>')
          : '<div style="font-size:11px;color:var(--tx3)">Sin historial suficiente en alguno de los dos (mínimo 5 observaciones cada uno) para comparar con confianza.</div>') +
      '</div>';
  }
  return '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px">' +
    '<div class="chart-t">📉 Curva de supervivencia por componente — toda la flota (Kaplan-Meier)</div>' +
    '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Complemento a Weibull (arriba): no asume ninguna forma matemática, calcula la probabilidad real de que el componente siga sin fallar a cada hora, directamente de los datos. A diferencia de Weibull, SÍ usa los componentes que siguen en servicio sin haber vuelto a fallar todavía (censurados) — ellos también son información real ("sobrevivió al menos hasta acá"), no solo los que ya fallaron. Mediana de supervivencia = a esa cantidad de horas, la mitad de los casos reales ya había fallado y la mitad seguía funcionando. IC90 (Greenwood) = qué tan segura es la curva en ese tramo — con pocos datos puede ser amplio. Mínimo 5 observaciones (fallas + censurados) por componente.</div>' +
    '<div class="tbl-wrap"><table style="table-layout:fixed"><tr><th style="text-align:left;width:22%">Componente</th><th style="width:13%">Fallas</th><th style="width:15%">En servicio (censurados)</th><th style="width:20%">Mediana supervivencia</th><th style="text-align:left">Lectura</th></tr>' +
    lista.map(function (g) {
      if (!g.km) return '<tr style="opacity:.55"><td style="font-weight:600">' + escapeHtml(g.componente) + '</td><td colspan="4" style="text-align:center;color:var(--tx3);font-size:10px">Sin historial suficiente aún (mínimo 5 observaciones)</td></tr>';
      var km = g.km;
      var mediana = km.medianaSupervivencia;
      var ultimo = km.curva[km.curva.length - 1];
      var lectura = mediana != null
        ? 'A las ' + fn(mediana) + 'h, la mitad de los casos reales ya había fallado.'
        : 'Con el historial disponible, la supervivencia nunca bajó del 50% — buena señal, o falta más historial para confirmarlo.';
      return '<tr>' +
        '<td style="font-weight:600">' + escapeHtml(g.componente) + '</td>' +
        '<td style="text-align:center">' + km.nFallas + '</td>' +
        '<td style="text-align:center">' + km.nCensurados + '</td>' +
        '<td style="text-align:center;font-weight:700">' + (mediana != null ? fn(mediana) + 'h' : '—') +
          (ultimo ? '<div style="font-size:9px;font-weight:400;color:var(--tx3)">S final ' + Math.round(ultimo.supervivencia * 100) + '% (IC90 ' + Math.round(ultimo.ic90Min * 100) + '–' + Math.round(ultimo.ic90Max * 100) + '%)</div>' : '') + '</td>' +
        '<td style="font-size:10px;color:var(--tx2);white-space:normal">' + lectura + '</td></tr>';
    }).join('') +
    '</table></div>' +
    comparacionHtml +
    '</div>';
}

// MCF (Mean Cumulative Function) por componente, a nivel FLOTA (2026-09-16
// — segunda mitad del par "Kaplan-Meier + MCF". Kaplan-Meier de arriba mide
// tiempo hasta la PRIMERA falla; una vez que un equipo falló, deja de
// aportar. MCF en cambio usa la trayectoria COMPLETA de cada equipo —
// cuenta todas sus fallas recurrentes de ese componente — y estima el
// número acumulado ESPERADO de fallas por equipo según el horómetro: "¿a
// cuántas fallas de Motor debería llegar, en promedio, un equipo de este
// tipo a las X horas?" — el insumo real para presupuestar repuestos y mano
// de obra a futuro (mcfCorrectivosPorComponente, logic.js).
function _estMcfPorComponente(eventos, eq) {
  var lista = (typeof mcfCorrectivosPorComponente === 'function') ? mcfCorrectivosPorComponente(eventos, eq) : [];
  if (!lista.length) return '';
  return '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px">' +
    '<div class="chart-t">📈 Fallas acumuladas esperadas por componente — toda la flota (MCF)</div>' +
    '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Complemento a Kaplan-Meier (arriba): esa curva mide tiempo hasta la PRIMERA falla — una vez que el equipo falló, deja de aportar. Acá se usa la trayectoria completa de cada equipo (todas sus fallas recurrentes de este componente) para estimar cuántas fallas acumuladas debería esperar, en promedio, un equipo de este tipo a esta altura del horómetro — el número de referencia para presupuestar repuestos y mano de obra futura, no solo saber si va a fallar. IC90 (Nelson) = qué tan segura es la curva en ese tramo. Mínimo 5 fallas totales por componente.</div>' +
    '<div class="tbl-wrap"><table style="table-layout:fixed"><tr><th style="text-align:left;width:22%">Componente</th><th style="width:13%">Equipos</th><th style="width:13%">Fallas totales</th><th style="width:24%">Fallas acumuladas esperadas</th><th style="text-align:left">Lectura</th></tr>' +
    lista.map(function (g) {
      if (!g.mcf) return '<tr style="opacity:.55"><td style="font-weight:600">' + escapeHtml(g.componente) + '</td><td style="text-align:center">' + g.nEquipos + '</td><td colspan="3" style="text-align:center;color:var(--tx3);font-size:10px">Sin historial suficiente aún (mínimo 5 fallas)</td></tr>';
      var m = g.mcf;
      var ultimo = m.curva[m.curva.length - 1];
      var lectura = 'A las ' + fn(ultimo.tiempo) + 'h de horómetro, se acumularon en promedio ' + m.mcfFinal + ' fallas de ' + g.componente.toLowerCase() + ' por equipo.';
      return '<tr>' +
        '<td style="font-weight:600">' + escapeHtml(g.componente) + '</td>' +
        '<td style="text-align:center">' + g.nEquipos + '</td>' +
        '<td style="text-align:center">' + m.nFallas + '</td>' +
        '<td style="text-align:center;font-weight:700">' + m.mcfFinal +
          '<div style="font-size:9px;font-weight:400;color:var(--tx3)">a ' + fn(ultimo.tiempo) + 'h · IC90 ' + ultimo.ic90Min + '–' + ultimo.ic90Max + '</div></td>' +
        '<td style="font-size:10px;color:var(--tx2);white-space:normal">' + lectura + '</td></tr>';
    }).join('') +
    '</table></div></div>';
}

// Crow-AMSAA por componente, a nivel FLOTA (2026-09-16 — tercer ítem del
// orden de prioridad elegido por el usuario, tras Kaplan-Meier+MCF).
// Ninguna de las 3 tablas de arriba contesta si la confiabilidad está
// mejorando o empeorando CON EL TIEMPO CALENDARIO — todas miran una foto
// fija. Crow-AMSAA junta las fechas de falla de todos los equipos con ese
// componente en un solo proceso de llegadas y ajusta la tendencia (β&lt;1
// mejorando, β&gt;1 empeorando) — el mismo método detrás del gráfico de
// Duane (crowAMSAAPorComponente, logic.js).
function _estCrowAmsaaPorComponente(eventos) {
  var lista = (typeof crowAMSAAPorComponente === 'function') ? crowAMSAAPorComponente(eventos) : [];
  if (!lista.length) return '';
  return '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px">' +
    '<div class="chart-t">📊 Tendencia de la tasa de fallas por componente — toda la flota (Crow-AMSAA)</div>' +
    '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Complemento a las 3 tablas de arriba: ninguna mira el tiempo CALENDARIO. Junta las fechas de falla de todos los equipos con este componente en un solo proceso y ajusta si las fallas se están espaciando (mejorando) o juntando (empeorando) con el correr de los meses — el mismo método de "reliability growth" que reporta Minitab/ReliaSoft (gráfico de Duane). β&lt;1 = mejorando. β&gt;1 = empeorando, revisar causa raíz o calidad del repuesto/proveedor. Con el IC90 cruzando 1, no hay certeza todavía. Mínimo 5 fallas por componente.</div>' +
    '<div class="tbl-wrap"><table style="table-layout:fixed"><tr><th style="text-align:left;width:22%">Componente</th><th style="width:13%">Fallas</th><th style="width:20%">β (tendencia)</th><th style="width:18%">Tendencia</th><th style="text-align:left">Lectura</th></tr>' +
    lista.map(function (g) {
      if (!g.crow) return '<tr style="opacity:.55"><td style="font-weight:600">' + escapeHtml(g.componente) + '</td><td style="text-align:center">' + g.n + '</td><td colspan="3" style="text-align:center;color:var(--tx3);font-size:10px">Sin historial suficiente aún (mínimo 5 fallas)</td></tr>';
      var c = g.crow;
      var lectura = typeof interpretacionCrowAMSAA === 'function' ? interpretacionCrowAMSAA(c.tendencia) : '';
      var colorTend = c.tendencia === 'mejorando' ? 'var(--ok)' : c.tendencia === 'empeorando' ? 'var(--danger)' : 'var(--tx3)';
      var etiquetaTend = c.tendencia === 'mejorando' ? '↓ Mejorando' : c.tendencia === 'empeorando' ? '↑ Empeorando' : 'Sin certeza';
      return '<tr>' +
        '<td style="font-weight:600">' + escapeHtml(g.componente) + '</td>' +
        '<td style="text-align:center">' + c.n + '</td>' +
        '<td style="text-align:center;font-weight:700">' + c.beta + '<div style="font-size:9px;font-weight:400;color:var(--tx3)">IC90 ' + c.ic90.betaMin + '–' + c.ic90.betaMax + '</div></td>' +
        '<td style="text-align:center;font-weight:700;color:' + colorTend + '">' + etiquetaTend + '</td>' +
        '<td style="font-size:10px;color:var(--tx2);white-space:normal">' + lectura + '</td></tr>';
    }).join('') +
    '</table></div></div>';
}

// Competing Risks — qué modo de falla "gana la carrera" primero (2026-09-16,
// segundo ítem del segundo lote de algoritmos "nivel siguiente"). A
// diferencia de las 4 tablas de arriba (cada una mira UN componente a la
// vez), acá se comparan TODOS los componentes entre sí, a nivel de equipo:
// Kaplan-Meier trata las fallas de otros componentes del mismo equipo como
// si nunca hubieran pasado (sesga la probabilidad real de cada causa por
// separado) — Competing Risks sí las tiene en cuenta, dando la probabilidad
// real de que cada componente sea la PRÓXIMA falla que saque al equipo de
// servicio (competingRisksPorEquipo, logic.js — estimador de Aalen-Johansen,
// el estándar de confiabilidad para esta pregunta).
function _estCompetingRisksHTML(eventos, eq) {
  var r = (typeof competingRisksPorEquipo === 'function') ? competingRisksPorEquipo(eventos, eq) : null;
  if (!r || !r.ranking.length) return '';
  return '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px">' +
    '<div class="chart-t">🏆 ¿Qué modo de falla mata primero? — toda la flota (Competing Risks)</div>' +
    '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">A diferencia de las tablas de arriba (que miran cada componente por separado), acá se comparan TODOS los componentes entre sí a nivel de equipo — junta las fallas de cada equipo (de cualquier componente) y calcula, con el mismo criterio de censura de Kaplan-Meier, la probabilidad real de que cada componente sea el que saque al equipo de servicio primero, antes que los demás. Suma 100% junto con "sigue en servicio" (' + Math.round(r.supervivenciaFinal * 100) + '% del historial pooled). N=' + r.n + ' observaciones (' + r.nFallas + ' fallas reales, ' + r.nCensurados + ' censuradas). Mínimo 5 observaciones a nivel de toda la flota.</div>' +
    '<div class="tbl-wrap"><table style="table-layout:fixed"><tr><th style="text-align:left;width:26%">Componente</th><th style="width:20%">Probabilidad de ser la próxima falla</th><th>Barra</th></tr>' +
    r.ranking.map(function (row, i) {
      var pct = Math.round(row.cif * 1000) / 10;
      return '<tr style="' + (i === 0 ? 'background:rgba(239,68,68,.08)' : '') + '">' +
        '<td style="font-weight:600' + (i === 0 ? ';color:var(--danger)' : '') + '">' + (i === 0 ? '🥇 ' : '') + escapeHtml(row.causa) + '</td>' +
        '<td style="text-align:center;font-weight:700">' + pct + '%</td>' +
        '<td><div style="background:color-mix(in srgb,var(--ac) 18%,var(--bg4));border-radius:4px;height:12px;width:160px;overflow:hidden"><div style="background:' + (i === 0 ? 'var(--danger)' : 'var(--ac)') + ';height:100%;width:' + Math.min(100, pct) + '%"></div></div></td></tr>';
    }).join('') +
    '</table></div></div>';
}

// Correlación Aceite ↔ Fallas reales (2026-09-12, pedido del usuario: mirando
// el sistema desde los 4 roles de datos, después del IC90 y de aceiteOutliers
// quedaba la pregunta de fondo que Análisis de Aceite da por sentada sin
// haberla probado nunca — ¿un aceite en ALERTA/PRECAUCIÓN realmente anticipa
// una falla real? correlacionAceiteFallas, logic.js. lift>1 = evidencia real
// de que sí anticipa; cerca de 1 = evidencia de que hoy no anticipa nada.
function _estCorrelacionAceite(eventos, ace) {
  var lista = (typeof correlacionAceiteFallas === 'function') ? correlacionAceiteFallas(ace, eventos) : [];
  var conDatos = lista.filter(function (g) { return g.tasaAlerta != null || g.tasaNormal != null; });
  if (!conDatos.length) return '';
  return '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px">' +
    '<div class="chart-t">🧪 Correlación Aceite ↔ Fallas reales — ¿el análisis anticipa la falla?</div>' +
    '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">Por cada componente, compara qué % de las muestras en ALERTA/PRECAUCIÓN tuvieron un correctivo real del mismo equipo+componente dentro de los 60 días siguientes, contra el mismo % para las muestras NORMAL. Lift = cuántas veces más probable es que una ALERTA anticipe una falla real, comparado con una muestra NORMAL. Lift alto (&gt;2) = el análisis de aceite SÍ está anticipando fallas para ese componente. Lift cercano a 1 = hoy no está anticipando nada — la alerta y la falla no están relacionadas en los datos reales. Requiere mínimo 5 muestras de cada lado (ALERTA y NORMAL) para reportar una tasa.</div>' +
    '<div class="tbl-wrap"><table style="table-layout:fixed"><tr><th style="text-align:left;width:20%">Componente</th><th style="width:18%">% falla tras ALERTA</th><th style="width:18%">% falla tras NORMAL</th><th style="width:14%">Lift</th><th style="text-align:left">Lectura</th></tr>' +
    conDatos.map(function (g) {
      var lectura = g.lift == null ? 'Muestra insuficiente de un lado para comparar' :
        g.lift >= 2 ? 'El aceite SÍ anticipa fallas reales de este componente' :
        g.lift >= 1.2 ? 'Anticipa algo, pero con margen de error' :
        'Hoy no está anticipando fallas reales — revisar los umbrales de alerta';
      var colorLift = g.lift == null ? 'var(--tx3)' : g.lift >= 2 ? 'var(--ok)' : g.lift >= 1.2 ? 'var(--warn)' : 'var(--danger)';
      return '<tr>' +
        '<td style="font-weight:600">' + escapeHtml(g.componente) + '</td>' +
        '<td style="text-align:center">' + (g.tasaAlerta == null ? '<span style="color:var(--tx3);font-size:10px">n=' + g.alertaTotal + ', insuficiente</span>' : g.tasaAlerta + '% (n=' + g.alertaTotal + ')') + '</td>' +
        '<td style="text-align:center">' + (g.tasaNormal == null ? '<span style="color:var(--tx3);font-size:10px">n=' + g.normalTotal + ', insuficiente</span>' : g.tasaNormal + '% (n=' + g.normalTotal + ')') + '</td>' +
        '<td style="text-align:center;font-weight:700;color:' + colorLift + '">' + (g.lift == null ? '—' : g.lift + 'x') + '</td>' +
        '<td style="font-size:10px;color:var(--tx2);white-space:normal">' + lectura + '</td></tr>';
    }).join('') +
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
  // paretoAcumulado (logic.js, 2026-09-11): antes el cálculo de %/acumulado/
  // vital/barra vivía inline acá — generalizado para que Equipo y Componente
  // (más abajo) reusen exactamente el mismo tratamiento en vez de duplicarlo.
  var lista = paretoAcumulado(Object.keys(porModo).map(function (m) { return { modo: m, fallas: porModo[m] }; }));
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
  // ANOVA de un factor sobre MTTR (duración de reparación, horas) por técnico
  // (2026-09-20): la tabla de arriba nunca dijo si un técnico "más lento" es
  // una diferencia real o ruido de muestra chica — ANOVA parte la varianza en
  // ENTRE técnicos vs DENTRO de cada técnico y da un F/p-valor real (ver
  // anovaUnFactor, logic.js). Mismo parseo "Xh" de o.duracion que ya usa
  // duracionesReparacionFlotaHoras — nunca se inventa una duración.
  var porTecDuracion = {};
  (ot || []).forEach(function (o) {
    if (!(o.tipo === 'Correctivo' || o.tipo === 'Falla Operacional')) return;
    if (!o.duracion || o.duracion === '—') return;
    var m = String(o.duracion).match(/(\d+)h/);
    if (!m) return;
    var nombre = (o.tecnico || '').split('/')[0].trim();
    if (!nombre) return;
    (porTecDuracion[nombre] = porTecDuracion[nombre] || []).push(parseInt(m[1], 10));
  });
  var anovaMttr = (typeof anovaUnFactor === 'function') ? anovaUnFactor(porTecDuracion, 5) : null;
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
    '</div>' +
    _estAnovaMttrHTML(anovaMttr);
}

// Bloque ANOVA de un factor sobre MTTR por técnico — separado del resto de
// _estTablaTecnico solo para no inflar una función ya larga (2026-09-20).
function _estAnovaMttrHTML(anova) {
  if (!anova) {
    return '<div class="chart-box" style="border-left:3px solid var(--tx3);margin-bottom:16px">' +
      '<div class="chart-t">📐 ANOVA: MTTR por técnico</div>' +
      '<div style="font-size:11px;color:var(--tx3);padding:6px 0">Menos de 2 técnicos con 5+ reparaciones con duración registrada — sin muestra suficiente para comparar.</div>' +
      '</div>';
  }
  var colF = anova.significativo ? 'var(--danger)' : 'var(--tx3)';
  var veredicto = anova.significativo
    ? 'Diferencia estadísticamente significativa (p&lt;0.05) — probablemente no es solo ruido de muestra.'
    : 'No hay evidencia de diferencia real entre técnicos (p≥0.05) — lo que se ve en la tabla puede ser ruido de muestra.';
  return '<div class="chart-box" style="border-left:3px solid var(--ac);margin-bottom:16px">' +
    '<div class="chart-t">📐 ANOVA: MTTR por técnico</div>' +
    '<div style="font-size:11px;color:var(--tx3);padding:6px 0 10px">¿El tiempo de reparación (MTTR, horas) difiere REALMENTE entre técnicos, o es ruido de muestra chica? Parte la varianza en ENTRE técnicos (F alto = diferencia real) vs DENTRO de cada técnico. Solo técnicos con 5+ reparaciones con duración registrada.</div>' +
    '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px">' +
    '<div><div style="font-size:10px;color:var(--tx3)">F</div><div style="font-size:18px;font-weight:700;color:' + colF + '">' + anova.F + '</div></div>' +
    '<div><div style="font-size:10px;color:var(--tx3)">p-valor</div><div style="font-size:18px;font-weight:700;color:' + colF + '">' + (anova.pValor < 0.0001 ? anova.pValor.toExponential(2) : Math.round(anova.pValor * 10000) / 10000) + '</div></div>' +
    '<div><div style="font-size:10px;color:var(--tx3)">gl (entre, dentro)</div><div style="font-size:18px;font-weight:700">' + anova.glEntre + ', ' + anova.glDentro + '</div></div>' +
    '</div>' +
    '<div style="font-size:12px;font-weight:600;color:' + colF + ';margin-bottom:10px">' + veredicto + '</div>' +
    '<div class="tbl-wrap"><table><tr><th>Técnico</th><th>n</th><th>MTTR promedio</th><th>Desv. estándar</th></tr>' +
    anova.grupos.map(function (g) {
      return '<tr><td style="font-weight:600">' + escapeHtml(g.grupo) + '</td>' +
        '<td style="text-align:center">' + g.n + '</td>' +
        '<td style="text-align:center;font-weight:700">' + g.media + 'h</td>' +
        '<td style="text-align:center">' + g.desvEst + 'h</td></tr>';
    }).join('') +
    '</table></div>' +
    '</div>';
}

export function renderEstadistica() {
  if (!$('s-estadistica')) return;
  var vista = window._estadisticaVista || 'equipo';
  var eq = S.g('eq') || [];
  var ot = S.g('ot') || [];
  var otHist = S.g('otHist') || [];
  var informesFalla = S.g('informesFalla') || [];
  var eventos = _estFallasCombinadas(ot, otHist, informesFalla);
  var ace = S.g('aceite') || [];
  if (ace.length && typeof window._aceiteResolverSiglas === 'function') window._aceiteResolverSiglas(ace);

  var content = '';
  if (vista === 'equipo') content = _estTablaEquipo(eq, eventos);
  else if (vista === 'componente') content = _estTablaComponente(eventos, ace, eq);
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

// Puente window/renders — ver nota en mov.js (primera tanda). _estFallasCombinadas/
// _estMtbfPorComponente se puentean también (Nivel 3 de "alerta predictiva",
// 2026-09-01) para que comp.js reuse el MISMO cálculo de MTBF típico por
// componente en vez de reimplementarlo — misma fuente única de siempre.
window.renderEstadistica = renderEstadistica;
window._estFallasCombinadas = _estFallasCombinadas;
window._estMtbfPorComponente = _estMtbfPorComponente;
renders.estadistica = renderEstadistica;
