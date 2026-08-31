// Pestaña Programación (Programa Anual PM por mes) — extraída a su propio
// archivo (Fase 2 de modularización). Módulo ES real (Fase 3, 2026-08-30,
// segunda tanda: Planificación y Agenda) — ver nota de migración en mov.js
// (primera tanda, mismo patrón).

// El programa anual de cada equipo se genera UNA vez (al aparecer el equipo) y
// queda guardado — las correcciones a proxPM/tipoPM/ritmo real no lo tocan solo.
// Este botón lo rearma completo desde el estado actual: borra las filas
// guardadas y deja que el sync de renders.prg las regenere con las fórmulas
// vigentes. Las celdas del programa no son editables, así que no se pierde nada
// manual; las marcas EJEC se calculan en vivo desde registros_pm y no se tocan.
export function regenPrg() {
  if (!confirm('¿Recalcular la proyección anual de TODOS los equipos con el horómetro y ritmo real actuales?')) return;
  C.recalcAll();
  S.s('prg', []);
  renders.prg();
  toast('✅ Programa anual recalculado');
}
export function renderPrg() {
  if (!$("s-prg")) return;
  var eq = S.g('eq') || [];
  var prg = S.g('prg') || [];
  var aniosDisp = mesesAutomaticos().map(function (m) { return m.slice(0, 4) }).filter(function (v, i, a) { return a.indexOf(v) === i });
  var anioPrg = parseInt($('fPrgAnio')?.value) || new Date().getFullYear();
  var MS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

  // Auto-sync programa with current equipos
  // Salvaguarda: si 'eq' llega vacío (carga a medias, misma clase de bug que syncEquipos),
  // no filtrar/guardar — evita borrar todo el programa real por una carrera de arranque.
  if (eq.length) {
    var prgAntes = JSON.stringify(prg);
    var eqSiglas = eq.map(function (e) { return e.sigla });
    // Remove deleted equipos from prg
    prg = prg.filter(function (p) { return eqSiglas.indexOf(p.sigla) >= 0 });
    // Add new equipos to prg
    var prgSiglas = prg.map(function (p) { return p.sigla });
    eq.forEach(function (e) {
      if (prgSiglas.indexOf(e.sigla) < 0) {
        var meses = {}; MS.forEach(function (x) { meses[x] = ''; });
        var horom = e.horomActual || 0; var freq = e.frecPM || 250;
        // Ritmo real del equipo para proyectar cada cuánto cae un PM (fallback al nominal).
        var ritmo = _ritmoRealEq(e.sigla, e.hrsDia || 12); if (!(ritmo > 0)) ritmo = e.hrsDia || 12;
        // El tipo de PM NO es un round-robin PM1→PM2→PM3→PM4: sigue el ciclo real según
        // el horómetro (PM4 cada 8×freq, PM3 cada 4×, PM2 cada 2×, PM1 el resto). Antes se
        // asignaba secuencialmente y el plan mostraba PM equivocados en cada mes.
        var proxHorom = C.proxPM(horom, freq);
        var diasRest = ritmo > 0 ? Math.round((proxHorom - horom) / ritmo) : 30;
        var mesAct = new Date().getMonth();
        for (var mi = mesAct; mi < 12; mi++) {
          diasRest -= new Date(anioPrg, mi + 1, 0).getDate();
          if (diasRest <= 0) {
            meses[MS[mi]] = C.tipoPM(proxHorom, freq);   // tipo real de ESE PM
            proxHorom += freq;                          // siguiente punto de PM
            diasRest += Math.round(freq / ritmo);         // acumula el remanente (no resetea)
          }
        }
        prg.push({ sigla: e.sigla, tipo: e.tipo, modelo: e.modelo, meses: meses });
      }
    });
    if (JSON.stringify(prg) !== prgAntes) S.s('prg', prg);
  }
  // Auto-mark EJEC del AÑO seleccionado — calculado en vivo, sin pisar el plan base guardado
  var reg = S.g('reg') || [];
  var MSmap = { '01': 'ENE', '02': 'FEB', '03': 'MAR', '04': 'ABR', '05': 'MAY', '06': 'JUN', '07': 'JUL', '08': 'AGO', '09': 'SEP', '10': 'OCT', '11': 'NOV', '12': 'DIC' };
  // ejecPorEq[sigla] = {ENE:'PM1',...} — guarda el tipoPM realmente ejecutado ese mes
  // (antes solo guardaba true/false, así que un PM1 marcaba "ejecutado" un mes que
  // tenía planificado un PM3, escondiendo que se hizo el PM equivocado).
  var ejecPorEq = {};
  reg.forEach(function (r) {
    var fecha = r.fechaEntrada || r.fechaEjec || '';
    if (fecha.slice(0, 4) !== '' + anioPrg) return;
    var mesNom = MSmap[fecha.slice(5, 7)]; if (!mesNom) return;
    if (!ejecPorEq[r.equipo]) ejecPorEq[r.equipo] = {};
    ejecPorEq[r.equipo][mesNom] = r.tipoPM || true;
  });
  var hayEjecAnio = Object.keys(ejecPorEq).length > 0;

  $('s-prg').innerHTML =
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Programa Anual ' + anioPrg + '</div><div class="sec-s">Plan PM por mes · EJEC se marca solo desde registros · ' + prg.length + ' equipos</div></div>' +
    '<div><button class="btn btn-o" onclick="regenPrg()" title="Rearma la proyección de todos los equipos con el horómetro, ritmo real y fórmulas actuales"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 10 A6 6 0 0 1 15.5 6.5" fill="none"/><polyline points="15.5,3 15.5,6.5 12,6.5"/><path d="M16 10 A6 6 0 0 1 4.5 13.5" fill="none"/><polyline points="4.5,17 4.5,13.5 8,13.5"/></svg> Recalcular proyección</button></div></div>' +
    '<div class="toolbar"><select id="fPrgAnio" onchange="renders.prg()">' +
    aniosDisp.map(function (y) { return '<option' + (parseInt(y) === anioPrg ? ' selected' : '') + '>' + y + '</option>' }).join('') + '</select>' +
    (hayEjecAnio ? '' : '<span style="font-size:11px;color:var(--tx3);margin-left:10px">Sin ejecuciones registradas en ' + anioPrg + '</span>') + '</div>' +
    '<div class="legend"><span><i style="background:var(--pm1)"></i>PM1</span><span><i style="background:var(--pm2)"></i>PM2</span><span><i style="background:var(--pm3)"></i>PM3</span><span><i style="background:var(--pm4)"></i>PM4</span><span><i style="background:#374151"></i>EJEC</span></div>' +
    '<div class="prog-grid">' +
    '<div class="pg-c pg-h">EQUIPO</div>' + MS.map(function (m) { return '<div class="pg-c pg-h">' + m + '</div>' }).join('') +
    prg.map(function (p, pi) {
      return '<div class="pg-c pg-e" title="' + escapeHtml(p.modelo) + '">' + escapeHtml(p.sigla) + '</div>' +
        MS.map(function (m) {
          var ejecTipo = ejecPorEq[p.sigla] && ejecPorEq[p.sigla][m];
          var base = p.meses[m] || '';
          var coincide = !ejecTipo || !base || ejecTipo === true || ejecTipo === base;
          var v = ejecTipo ? (coincide ? 'EJEC' : 'EJEC≠' + ejecTipo) : base;
          var cls = v === 'PM1' ? 'pg-1' : v === 'PM2' ? 'pg-2' : v === 'PM3' ? 'pg-3' : v === 'PM4' ? 'pg-4' : v === 'EJEC' ? 'pg-x' : (v.indexOf('EJEC≠') === 0 ? 'pg-x' : '');
          var tip = ejecTipo ? (coincide ? 'EJEC (auto, desde registros). Click para corregir el plan base de esta celda' : '⚠️ Se ejecutó ' + ejecTipo + ' pero estaba planificado ' + base + '. Click para corregir')
            : 'Click para cambiar PM';
          return '<div class="pg-c ' + cls + '" title="' + escapeHtml(tip) + '" style="' + (!coincide ? 'color:var(--ac)' : '') + '" onclick="cyclePrg(' + pi + ',\'' + m + '\',' + (ejecTipo ? 'true' : 'false') + ')">' + (v || '·') + '</div>';
        }).join('');
    }).join('') +
    '</div>';
}
export function cyclePrg(pi, mes, esEjecAuto) {
  var prg = S.g('prg') || [];
  if (pi >= prg.length) return;
  if (esEjecAuto) {
    toast('ℹ️ Ese EJEC viene de un registro PM real. Para quitarlo, corrige/elimina el registro en Registro PM. Aquí solo se edita el PLAN.');
  }
  var cycle = ['', 'PM1', 'PM2', 'PM3', 'PM4'];
  var cur = prg[pi].meses[mes] || '';
  var idx = cycle.indexOf(cur); if (idx < 0) idx = 0;
  prg[pi].meses[mes] = cycle[(idx + 1) % cycle.length];
  S.s('prg', prg); refreshAll();
}

// Puente window/renders — ver nota en mov.js (primera tanda).
window.regenPrg = regenPrg;
window.renderPrg = renderPrg;
window.cyclePrg = cyclePrg;
renders.prg = renderPrg;
