// ═══════════════════════════════════════════════════════════
// PROGRAMACIÓN DIARIA — programa de personal por bloques de 30 min (día/noche),
// importado desde el Excel "Programa Diario" que llena el supervisor de terreno.
// Es un dato distinto a Programa Anual/Gantt (esos son por EQUIPO y por MES; este
// es por PERSONA y por DÍA), así que vive en su propia sub-pestaña y tabla.
// Extraída a su propio archivo (Fase 2 de modularización). Script plano
// (NO módulo ES), mismo scope global de siempre. _progDiaResumen (y sus
// helpers ALIAS_EQUIPOS_PROGDIA/_progDiaDetectarSigla/_esBloqueNoProductivo)
// quedan en index.html porque también los usa renders.dash.
// ═══════════════════════════════════════════════════════════

// Interpreta un arreglo de filas (formato sheet_to_json {header:1}) de UNA hoja del
// Excel de programación diaria. Devuelve null si la hoja no calza con el formato
// esperado (ej. una hoja sin fila "Fecha:", como "Hoja1" en los archivos reales).
// NO asume que solo existen 2 turnos (día/noche): detecta tantos bloques "Programa
// Diario turno de <lo que sea>" como haya en la hoja — si mañana aparece un tercer
// turno (ej. "Turno Tarde"), se detecta solo con que la hoja tenga esa fila marcador,
// sin tocar código.
function _parseProgDiariaHoja(rows) {
  var fecha = null;
  var responsableGeneral = '';
  for (var i = 0; i < Math.min(rows.length, 6); i++) {
    var row = rows[i] || [];
    for (var c = 0; c < row.length; c++) {
      if (typeof row[c] === 'string' && row[c].trim().toLowerCase() === 'fecha:') {
        for (var c2 = c + 1; c2 < row.length; c2++) { if (row[c2] != null) {
          fecha = (row[c2] instanceof Date) ? row[c2].toISOString().slice(0, 10) : String(row[c2]).slice(0, 10);
          break;
        }}
      }
      if (typeof row[c] === 'string' && row[c].trim().toLowerCase().indexOf('responsable') === 0) {
        for (var c2 = c + 1; c2 < row.length; c2++) { if (row[c2] != null) { responsableGeneral = String(row[c2]).trim(); break; } }
      }
    }
  }
  if (!fecha) return null;

  // Detectar TODOS los marcadores de turno ("Programa Diario turno de X"). El primer
  // tramo (antes del primer marcador) es el turno implícito del inicio de la hoja —
  // se le llama "Día" porque así aparece siempre en los archivos reales, pero si
  // hubiera un marcador explícito también para el primero, se respeta ese nombre.
  var marcadores = []; // {idx, nombreTurno}
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i] || [];
    for (var c = 0; c < row.length; c++) {
      var v = row[c];
      if (typeof v === 'string') {
        var m = v.match(/turno\s+de\s+(.+)/i);
        if (m) { marcadores.push({ idx: i, nombreTurno: m[1].trim() }); break; }
      }
    }
  }
  if (!marcadores.length || marcadores[0].idx > 0) {
    marcadores.unshift({ idx: 0, nombreTurno: 'Día' });
  }

  function parseBloque(startIdx, endIdx) {
    var headerIdx = -1;
    for (var i = startIdx; i < endIdx; i++) {
      var row = rows[i] || [];
      if (row.some(function (v) { return typeof v === 'string' && v.trim() === 'Nombre'; })) { headerIdx = i; break; }
    }
    if (headerIdx < 0) return { personas: [], responsable: '' };
    var header = rows[headerIdx] || [];
    var idxNombre = header.findIndex(function (v) { return typeof v === 'string' && v.trim() === 'Nombre'; });
    var idxCargo = header.findIndex(function (v) { return typeof v === 'string' && v.trim() === 'Cargo'; });
    if (idxNombre < 0 || idxCargo < 0) return { personas: [], responsable: '' };
    // Columnas de bloque = todo lo que va DESPUÉS de Cargo… salvo que el Excel real
    // repite el encabezado "Cargo" (y a veces "Nombre") en varias columnas de formato.
    // Sin este filtro, esas columnas repetidas entraban como bloques de horario
    // fantasma con etiqueta "Cargo" (se veían como 2-3 columnas CARGO extra en la grilla).
    var bloqueCols = [];
    for (var c = idxCargo + 1; c < header.length; c++) {
      var hb = header[c] != null ? String(header[c]).replace(/[\r\n]+/g, ' ').trim() : '';
      var hbl = hb.toLowerCase();
      if (hb !== '' && hbl !== 'cargo' && hbl !== 'nombre') {
        bloqueCols.push({ col: c, label: hb });
      }
    }
    var responsable = '';
    var personas = [];
    for (var i = headerIdx + 1; i < endIdx; i++) {
      var row = rows[i] || [];
      for (var c = 0; c < row.length; c++) {
        if (typeof row[c] === 'string' && row[c].toLowerCase().indexOf('supervisor de reparaci') >= 0) {
          for (var c2 = c + 1; c2 < row.length; c2++) { if (row[c2] != null) { responsable = String(row[c2]).trim(); break; } }
        }
      }
      var nombreVal = row[idxNombre];
      if (nombreVal == null) continue;
      var nombreStr = String(nombreVal).trim();
      if (!nombreStr || /^supervisor/i.test(nombreStr)) continue;
      var orden = row[0] != null ? parseInt(row[0]) : null;
      var cargo = row[idxCargo] != null ? String(row[idxCargo]).trim() : '';
      var bloques = bloqueCols.map(function (bc) {
        var v = row[bc.col];
        return { rango: bc.label, actividad: v != null ? String(v).replace(/[\r\n]+/g, ' ').trim() : '' };
      });
      personas.push({ orden: isNaN(orden) ? null : orden, nombre: nombreStr, cargo: cargo, bloques: bloques });
    }
    return { personas: personas, responsable: responsable };
  }

  var turnos = []; // {nombre, personas, responsable}
  var riqueza = 0;
  marcadores.forEach(function (mk, mi) {
    var endIdx = mi + 1 < marcadores.length ? marcadores[mi + 1].idx : rows.length;
    var res = parseBloque(mk.idx, endIdx);
    res.personas.forEach(function (p) { p.bloques.forEach(function (b) { if (b.actividad) riqueza++; }); });
    turnos.push({ nombre: mk.nombreTurno, personas: res.personas, responsable: res.responsable || (mi === 0 ? responsableGeneral : '') });
  });

  return { fecha: fecha, turnos: turnos, _riqueza: riqueza };
}

// Recorre TODAS las hojas del libro y devuelve un resultado por fecha distinta
// encontrada. Si dos hojas comparten la misma fecha (ej. la hoja plantilla "PD"
// vs. la hoja archivada del día, que en la práctica traen la misma fecha), se
// queda con la que tenga más actividades reales cargadas — la plantilla vacía
// pierde contra la copia con datos.
// Excel representa "toda la mañana = Vacaciones" como UNA celda combinada que
// abarca varias columnas de bloque. sheet_to_json solo pone el texto en la
// primera celda de la combinación; el resto de las columnas fusionadas llegan
// null, así que sin esto una ausencia de jornada completa (vacaciones, licencia,
// etc.) solo quedaba marcada en 1-2 bloques en vez de todo el rango combinado.
function _expandirCombinadas(ws, rows) {
  (ws['!merges'] || []).forEach(function (m) {
    // Solo combinaciones HORIZONTALES (una fila, varias columnas) — son las que
    // representan "esta actividad ocupa todos estos bloques de horario". Una
    // combinación VERTICAL (varias filas, una columna) suele ser el nombre/cargo
    // de una persona fusionado por formato; expandirla duplicaría a la persona
    // como si fueran dos filas distintas (una por cada fila de la combinación).
    if (m.s.r !== m.e.r) return;
    var val = (rows[m.s.r] || [])[m.s.c];
    if (val == null) return;
    for (var c = m.s.c; c <= m.e.c; c++) {
      if (c === m.s.c) continue;
      if (!rows[m.s.r]) rows[m.s.r] = [];
      rows[m.s.r][c] = val;
    }
  });
}
function _parseProgDiariaLibro(workbook) {
  var porFecha = {};
  workbook.SheetNames.forEach(function (nombreHoja) {
    var ws = workbook.Sheets[nombreHoja];
    var rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    _expandirCombinadas(ws, rows);
    var r = _parseProgDiariaHoja(rows);
    if (!r) return;
    r._hoja = nombreHoja;
    if (!porFecha[r.fecha] || r._riqueza > porFecha[r.fecha]._riqueza) porFecha[r.fecha] = r;
  });
  return Object.values(porFecha);
}
window.importProgDiaXLSX = function (ev) {
  var file = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (e) {
    var resultados;
    try {
      var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
      resultados = _parseProgDiariaLibro(wb);
    } catch (err) {
      toast('❌ No se pudo leer el archivo: ' + err.message);
      return;
    }
    if (!resultados.length) return toast('⚠️ No se encontró ninguna fecha válida en el archivo (revisa que tenga una fila "Fecha:")');
    var resumen = resultados.map(function (r) {
      return r.fecha + ': ' + r.turnos.map(function (t) { return t.personas.length + ' persona(s) turno ' + t.nombre; }).join(', ');
    }).join('\n');
    if (!confirm('Se detectó lo siguiente:\n\n' + resumen + '\n\n¿Importar? Esto reemplaza cualquier programación ya cargada para esas fechas.')) return;
    var progDia = S.g('progDia') || [];
    resultados.forEach(function (r) {
      progDia = progDia.filter(function (p) { return p.fecha !== r.fecha; });
      r.turnos.forEach(function (t) {
        t.personas.forEach(function (p) {
          progDia.push({ fecha: r.fecha, turno: t.nombre, orden: p.orden, nombre: p.nombre, cargo: p.cargo, responsable: t.responsable, bloques: p.bloques });
        });
      });
    });
    S.s('progDia', progDia);
    // La fecha CRONOLÓGICAMENTE más reciente, no la última hoja procesada en el
    // orden de workbook.SheetNames (ese orden puede no coincidir con las fechas
    // si el libro trae pestañas desordenadas).
    window._progDiaFecha = resultados.map(function (r) { return r.fecha; }).sort().pop();
    window._progDiaTurno = null;
    toast('✅ Programación diaria importada: ' + resultados.map(function (r) { return r.fecha; }).join(', '));
    refreshAll();
  };
  reader.readAsArrayBuffer(file);
};

window.edProgDia = function (realIdx, key, val) {
  var d = S.g('progDia') || [];
  if (_edCampo('progDia', d, realIdx, key, val)) refreshAll();
};
window.delProgDia = function (realIdx) {
  var d = S.g('progDia') || [];
  var p = d[realIdx];
  if (!p) return;
  if (!confirm('¿Eliminar a ' + p.nombre + ' (' + p.fecha + ', turno ' + p.turno + ') de la programación diaria?')) return;
  d.splice(realIdx, 1);
  S.s('progDia', d);
  refreshAll();
};
// No usa _edCampo a propósito: _edCampo hace S.s(store,arr) asumiendo que 'arr' es
// el arreglo COMPLETO de la categoría — acá lo que se edita es un campo DENTRO de
// un arreglo anidado (bloques de una persona), así que hay que guardar 'd' entero
// (la categoría completa), no 'd[realIdx].bloques' (eso pisaría todo 'progDia' con
// solo los bloques de esa persona).
window.edProgDiaBloque = function (realIdx, bloqueIdx, val) {
  var d = S.g('progDia') || [];
  if (!d[realIdx] || !d[realIdx].bloques || !d[realIdx].bloques[bloqueIdx]) return;
  d[realIdx].bloques[bloqueIdx].actividad = val;
  S.s('progDia', d);
  refreshAll();
};

window.renderProgdia = function () {
  if (!$('s-progdia')) return;
  var todo = S.g('progDia') || [];
  var vista = window._progDiaVista || 'detalle';
  var fechas = [...new Set(todo.map(function (p) { return p.fecha; }))].sort().reverse();
  var fSel = window._progDiaFecha && fechas.indexOf(window._progDiaFecha) >= 0 ? window._progDiaFecha : (fechas[0] || '');
  // Turnos disponibles para ESTA fecha — no se asume que siempre son solo día/noche,
  // se toman los que realmente vinieron en la importación (podría haber 1, 2, 3 o más).
  var turnosFecha = [...new Set(todo.filter(function (p) { return p.fecha === fSel; }).map(function (p) { return p.turno; }))];
  var turno = window._progDiaTurno && turnosFecha.indexOf(window._progDiaTurno) >= 0 ? window._progDiaTurno : (turnosFecha[0] || '');
  var items = todo.filter(function (p) { return p.fecha === fSel && p.turno === turno; }).sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
  var responsable = items.length ? items[0].responsable : '';
  var cols = [];
  items.forEach(function (p) { if (p.bloques && p.bloques.length > cols.length) cols = p.bloques.map(function (b) { return b.rango; }); });

  var cabecera = '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11 A6 6 0 0 1 16 11" fill="none"/><line x1="2" y1="11" x2="18" y2="11"/><line x1="10" y1="5" x2="10" y2="3"/></svg> Programación Diaria</div>' +
    '<div class="sec-s">Asignación de personal por bloques de 30 min · ' + fechas.length + ' fecha(s) cargada(s)</div></div>' +
    '<div><input type="file" id="progDiaFile" accept=".xlsx" style="display:none" onchange="importProgDiaXLSX(event)">' +
    '<button class="btn" onclick="document.getElementById(\'progDiaFile\').click()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar Excel</button></div></div>' +
    (fechas.length ? '<div style="display:flex;gap:8px;margin-bottom:12px">' +
      '<button class="btn ' + (vista === 'detalle' ? '' : 'btn-o') + '" onclick="window._progDiaVista=\'detalle\';renders.progdia()"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2.5" width="12" height="15" rx="1.5"/><polyline points="6.5,7 7.5,8 9.5,6"/><line x1="11" y1="7" x2="14" y2="7"/><polyline points="6.5,11.5 7.5,12.5 9.5,10.5"/><line x1="11" y1="11.5" x2="14" y2="11.5"/></svg> Detalle</button>' +
      '<button class="btn ' + (vista === 'resumen' ? '' : 'btn-o') + '" onclick="window._progDiaVista=\'resumen\';renders.progdia()"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Resumen</button>' +
      '</div>' : '');

  if (!fechas.length) {
    $('s-progdia').innerHTML = cabecera + '<p style="color:var(--tx3)">Aún no se ha importado ninguna programación diaria. Usa "<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,8 10,12 14,8"/><line x1="10" y1="2" x2="10" y2="12"/><polyline points="3,15 3,17 17,17 17,15"/></svg> Importar Excel" para cargar la primera.</p>';
    return;
  }

  if (vista === 'resumen') {
    var r = _progDiaResumen(todo);
    var maxHoras = r.ranking.length ? r.ranking[0].horas : 0;
    var colorUtil = r.utilizacion == null ? 'var(--tx3)' : r.utilizacion < 40 ? 'var(--warn)' : r.utilizacion > 85 ? 'var(--danger)' : 'var(--ok)';
    var msgUtil = r.utilizacion == null ? 'Sin bloques para calcular' : r.utilizacion < 40 ? 'Posible exceso de dotación (baja ocupación)' : r.utilizacion > 85 ? 'Posible déficit de dotación (sobrecarga)' : 'Ocupación saludable';
    $('s-progdia').innerHTML = cabecera +
      '<div class="cards">' +
      '<div class="card"><div class="card-t">Utilización de dotación</div><div class="card-v" style="color:' + colorUtil + '">' + (r.utilizacion == null ? '—' : r.utilizacion + '%') + '</div>' +
      '<div style="font-size:10px;color:var(--tx3)">' + r.bloquesOcupados + ' de ' + r.bloquesTotales + ' bloques en trabajo productivo · ' + msgUtil + '<br><span style="font-size:9px">No cuentan charla, colación, vacaciones ni licencia. Comisión de servicio sí (logística).</span></div></div>' +
      '<div class="card"><div class="card-t">Cumplimiento vs. registro real</div><div class="card-v">' + (r.cumplimiento == null ? '—' : r.cumplimiento + '%') + '</div>' +
      '<div style="font-size:10px;color:var(--tx3)">' + r.conRegistro + ' de ' + r.programados + ' menciones de equipo con PM/correctivo real ese día</div></div>' +
      '<div class="card"><div class="card-t">Equipos con horas registradas</div><div class="card-v">' + r.ranking.length + '</div>' +
      '<div style="font-size:10px;color:var(--tx3)">detectados por sigla en el texto de las actividades</div></div>' +
      '</div>' +
      '<div class="sec-t" style="font-size:14px;margin:16px 0 8px">⏱️ Horas-hombre por equipo (todas las fechas cargadas)</div>' +
      (r.ranking.length ?
        '<div style="display:flex;flex-direction:column;gap:6px;max-width:600px">' +
        r.ranking.slice(0, 15).map(function (x) {
          var pct = maxHoras ? Math.round(x.horas / maxHoras * 100) : 0;
          return '<div style="display:flex;align-items:center;gap:8px;font-size:12px">' +
            '<span class="mono" style="width:70px;color:var(--ac)">' + escapeHtml(x.sigla) + '</span>' +
            '<div style="flex:1;background:var(--bg3);border-radius:4px;height:14px;overflow:hidden">' +
            '<div style="width:' + pct + '%;background:var(--ac);height:100%;border-radius:4px"></div></div>' +
            '<span class="mono" style="width:50px;text-align:right;color:var(--tx3)">' + x.horas + 'h</span>' +
            '</div>';
        }).join('') +
        '</div>'
        : '<p style="color:var(--tx3);font-size:12px">Ninguna actividad menciona una sigla de equipo real todavía.</p>') +
      '<p style="font-size:10px;color:var(--tx3);margin-top:12px">Detección automática: busca la sigla del equipo dentro del texto de cada actividad. Actividades genéricas (Charla, Almuerzo, Vacaciones, Licencia) no se atribuyen a ningún equipo.</p>';
    return;
  }

  $('s-progdia').innerHTML = cabecera +
    '<div class="toolbar">' +
    '<select onchange="window._progDiaFecha=this.value;window._progDiaTurno=null;renders.progdia()">' +
    fechas.map(function (f) { return '<option' + (f === fSel ? ' selected' : '') + ' value="' + escapeHtml(f) + '">' + escapeHtml(f) + '</option>'; }).join('') +
    '</select>' +
    turnosFecha.map(function (t) { return '<button class="btn ' + (turno === t ? '' : 'btn-o') + '" onclick="window._progDiaTurno=\'' + t.replace(/'/g, "\\'") + '\';renders.progdia()">' + escapeHtml(t) + '</button>'; }).join('') +
    '</div>' +
    (responsable ? '<p style="font-size:12px;color:var(--tx3)">Responsable: <b>' + escapeHtml(responsable) + '</b></p>' : '') +
    (items.length ?
      '<div class="tbl-wrap" style="overflow-x:auto"><table style="font-size:10px">' +
      '<tr><th style="min-width:110px">Nombre</th><th style="min-width:90px">Cargo</th>' +
      cols.map(function (c) { return '<th style="min-width:90px;font-size:9px">' + escapeHtml(c) + '</th>'; }).join('') + '<th></th></tr>' +
      items.map(function (p) {
        var realIdx = todo.indexOf(p);
        return '<tr><td class="ed" contenteditable onblur="edProgDia(' + realIdx + ',\'nombre\',this.innerText.trim())" style="font-weight:600">' + escapeHtml(p.nombre) + '</td>' +
          '<td class="ed" contenteditable onblur="edProgDia(' + realIdx + ',\'cargo\',this.innerText.trim())" style="font-size:9px;color:var(--tx3)">' + escapeHtml(p.cargo || '') + '</td>' +
          cols.map(function (c) {
            var bloqueIdx = (p.bloques || []).findIndex(function (x) { return x.rango === c; });
            var act = bloqueIdx >= 0 ? p.bloques[bloqueIdx].actividad : '';
            return bloqueIdx >= 0 ?
              '<td class="ed" contenteditable onblur="edProgDiaBloque(' + realIdx + ',' + bloqueIdx + ',this.innerText.trim())" style="font-size:9px' + (act ? '' : ';color:var(--tx3)') + '">' + (act ? escapeHtml(act) : '—') + '</td>' :
              '<td style="font-size:9px;color:var(--tx3)">—</td>';
          }).join('') +
          '<td><button class="btn btn-o" style="padding:2px 6px;font-size:10px" title="Eliminar esta fila" onclick="delProgDia(' + realIdx + ')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="16" y2="6"/><path d="M7.5 6 V4 h5 V6" fill="none"/><polyline points="5.5,6 6.5,17 13.5,17 14.5,6"/><line x1="8.5" y1="9" x2="8.5" y2="14"/><line x1="11.5" y1="9" x2="11.5" y2="14"/></svg></button></td></tr>';
      }).join('') +
      '</table></div>'
      : '<p style="color:var(--tx3)">Sin personal registrado para este turno en esta fecha.</p>');
};
