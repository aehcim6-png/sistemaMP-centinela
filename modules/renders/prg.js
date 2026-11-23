// Pestaña Programación (Programa Anual PM por mes) — extraída a su propio
// archivo (Fase 2 de modularización). Módulo ES real (Fase 3, 2026-08-30,
// segunda tanda: Planificación y Agenda) — ver nota de migración en mov.js
// (primera tanda, mismo patrón).

// El programa anual de cada equipo se genera UNA vez (al aparecer el equipo) y
// queda guardado — las correcciones a proxPM/tipoPM/ritmo real no lo tocan solo.
// Este botón lo rearma completo desde el estado actual: borra las filas
// guardadas y deja que el sync de renders.prg las regenere con las fórmulas
// vigentes. Las celdas del programa no son editables, así que no se pierde nada
// manual; lo ejecutado y los meses que vienen se calculan en vivo (programaAnualVivo) y este plan guardado solo sirve de referencia.
export function regenPrg() {
  if (!confirm('¿Recalcular la proyección anual de TODOS los equipos con el horómetro y ritmo real actuales?')) return;
  C.recalcAll();
  // Los ajustes a mano (meses._manual) no se pierden al recalcular el plan guardado.
  var man = {};
  (S.g('prg') || []).forEach(function (p) { if (p.meses && p.meses._manual) man[p.sigla] = p.meses._manual; });
  S.s('prg', []);
  renders.prg();
  var nuevo = S.g('prg') || [];
  nuevo.forEach(function (p) { if (man[p.sigla]) p.meses._manual = man[p.sigla]; });
  Object.keys(man).forEach(function (sg) { if (!nuevo.some(function (p) { return p.sigla === sg; })) delete man[sg]; });
  if (Object.keys(man).length) S.s('prg', nuevo);
  renders.prg();
  toast('✅ Programa anual recalculado (los ajustes a mano se conservan)');
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
  // Programa «vivo» (23-nov-2026): lo ejecutado sale de los registros de PM (tipo y fecha reales); los meses que vienen se proyectan desde el próximo PM de cada equipo, anclado a su último PM real y a su ritmo real.
  // El plan guardado solo se usa para decir qué decía un mes pasado que no tiene registro. Ver programaAnualVivo en logic.js.
  var reg = S.g('reg') || [];
  _prgVivo = programaAnualVivo(eq, reg, S.g('prg') || [], new Date(), anioPrg, function (s, h) { return _ritmoRealEq(s, h); });
  var hayEjecAnio = _prgVivo.some(function (p) { return MS.some(function (m) { return p.meses[m].eje.length; }); });
  var nSinReg = 0, nVenc = 0, avisos = [];
  _prgVivo.forEach(function (p) {
    MS.forEach(function (m) { var c = p.meses[m]; if (c.estado === 'sin_registro') nSinReg++; if (c.estado === 'vencido') nVenc++; });
    if (p.aviso) avisos.push(p.sigla + ': ' + p.aviso);
  });
  var fch = function (f) { return f ? f.slice(8, 10) + '-' + f.slice(5, 7) + '-' + f.slice(0, 4) : ''; };
  var clsTipo = function (t) { return t === 'PM1' ? 'pg-1' : t === 'PM2' ? 'pg-2' : t === 'PM3' ? 'pg-3' : t === 'PM4' ? 'pg-4' : ''; };

  $('s-prg').innerHTML =
    '<div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Programa Anual ' + anioPrg + '</div><div class="sec-s">PM ejecutados (✓) según los registros · lo que viene, proyectado desde el último PM real de cada equipo · ' + _prgVivo.length + ' equipos</div></div>' +
    '<div><button class="btn btn-o" onclick="regenPrg()" title="Rearma el plan guardado (solo sirve de referencia para los meses pasados sin registro)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 10 A6 6 0 0 1 15.5 6.5" fill="none"/><polyline points="15.5,3 15.5,6.5 12,6.5"/><path d="M16 10 A6 6 0 0 1 4.5 13.5" fill="none"/><polyline points="4.5,17 4.5,13.5 8,13.5"/></svg> Recalcular plan guardado</button></div></div>' +
    '<div class="toolbar"><select id="fPrgAnio" onchange="renders.prg()">' +
    aniosDisp.map(function (y) { return '<option' + (parseInt(y) === anioPrg ? ' selected' : '') + '>' + y + '</option>' }).join('') + '</select>' +
    (hayEjecAnio ? '' : '<span style="font-size:11px;color:var(--tx3);margin-left:10px">Sin ejecuciones registradas en ' + anioPrg + '</span>') +
    (nVenc ? '<span style="font-size:11px;color:var(--danger);margin-left:10px">' + nVenc + ' PM vencido' + (nVenc === 1 ? '' : 's') + ' (caen hoy)</span>' : '') +
    (nSinReg ? '<span style="font-size:11px;color:var(--warn);margin-left:10px">' + nSinReg + ' mes' + (nSinReg === 1 ? '' : 'es') + ' pasado' + (nSinReg === 1 ? '' : 's') + ' con PM en el plan y sin registro</span>' : '') + '</div>' +
    '<div class="legend"><span><i style="background:var(--pm1)"></i>PM1</span><span><i style="background:var(--pm2)"></i>PM2</span><span><i style="background:var(--pm3)"></i>PM3</span><span><i style="background:var(--pm4)"></i>PM4</span><span><i style="background:#374151"></i>PM1✓ = ejecutado (registro)</span><span><i style="background:transparent;border:1px dashed var(--warn)"></i>¿PM? = el plan lo pedía y no hay registro ese mes</span><span>✎ = ajustado a mano</span></div>' +
    '<div class="prog-grid">' +
    '<div class="pg-c pg-h">EQUIPO</div>' + MS.map(function (m) { return '<div class="pg-c pg-h">' + m + '</div>' }).join('') +
    _prgVivo.map(function (p) {
      return '<div class="pg-c pg-e" title="' + escapeHtml((p.modelo || '') + (p.aviso ? ' — ' + p.aviso : '')) + '">' + escapeHtml(p.sigla) + (p.aviso ? ' <span style="color:var(--warn)">⚠</span>' : '') + '</div>' +
        MS.map(function (m) {
          var c = p.meses[m], txt = '', cls = '', sty = '', tip = [];
          if (c.eje.length) {
            txt = c.eje.map(function (x) { return (x.tipo || 'PM') + '✓'; }).join(' ');
            cls = 'pg-x';
            tip.push('Ejecutado: ' + c.eje.map(function (x) { return (x.tipo || 'PM') + ' el ' + fch(x.fecha); }).join('; '));
            if (/^PM[1-4]$/.test(c.plan) && c.eje.every(function (x) { return x.tipo !== c.plan; })) tip.push('El plan guardado decía ' + c.plan + '.');
          }
          if (c.proy.length) {
            var pt = c.proy.map(function (x) { return x.tipo + (x.vencido ? ' ⚠' : ''); }).join(' · ');
            txt = txt ? txt + ' ' + pt : pt;
            if (!c.eje.length) { cls = clsTipo(c.proy[0].tipo); if (c.estado === 'vencido') sty = 'outline:1px solid var(--danger)'; }
            tip.push((c.estado === 'vencido' ? 'VENCIDO: ' : 'Proyectado: ') + c.proy.map(function (x) { return x.tipo + ' ~' + fch(x.fecha); }).join('; ') + ' (desde su último PM real y su ritmo real).');
          }
          if (c.estado === 'sin_registro') {
            txt = '¿' + (/^PM[1-4]$/.test(c.plan) ? c.plan : 'PM') + '?'; sty = 'border:1px dashed var(--warn);color:var(--warn)';
            tip.push('El plan guardado decía ' + c.plan + ' y no hay ningún PM registrado este mes. No se afirma que no se hizo: puede faltar el registro.');
          }
          if (c.manual && !c.eje.length) {
            if (c.manual === 'NONE') { txt = 'sin PM ✎'; cls = ''; sty = 'color:var(--tx3)'; tip.push('Ajustado a mano: este mes no toca PM.'); }
            else { txt += ' ✎'; tip.push('Ajustado a mano a ' + c.manual + (c.auto.length ? ' (el cálculo automático decía ' + c.auto.map(function (x) { return x.tipo + ' ~' + fch(x.fecha); }).join('; ') + ')' : '') + '.'); }
          }
          if (!c.eje.length) tip.push('Toca para ajustar a mano.');
          return '<div class="pg-c ' + cls + '" title="' + escapeHtml(tip.join(' ')) + '" style="' + sty + '" onclick="cyclePrg(\'' + escapeHtml(p.sigla) + '\',\'' + m + '\')">' + (txt || '·') + '</div>';
        }).join('');
    }).join('') +
    '</div>' +
    (avisos.length ? '<div style="font-size:11px;color:var(--tx3);margin-top:10px"><b style="color:var(--warn)">⚠ Equipos sin proyección confiable</b> (no se inventa un mes): ' + avisos.map(escapeHtml).join(' · ') + '</div>' : '') +
    '<div style="font-size:11px;color:var(--tx3);margin-top:8px">Un PM se hace por horas o km, no por calendario: el mes proyectado se corre solo cuando se registra un PM o cambia el ritmo del equipo. <b>Toca una celda sin ejecutar para ajustarla a mano</b> (cada toque pasa a PM1 → PM2 → PM3 → PM4 → sin PM → automático); lo ajustado manda sobre el cálculo, se guarda y lo usan Gantt y Qué comprar. Las celdas ejecutadas salen de Registro PM.</div>';
}
// Ajuste a mano de una celda (23-nov-2026): el programa se calcula solo, pero el planificador puede fijar el PM de un mes. Se guarda en el plan guardado (meses._manual, clave 'aaaa-mm') y manda sobre el cálculo.
// Cada toque pasa a PM1 → PM2 → PM3 → PM4 → «sin PM» → automático. Un mes ya ejecutado sale de Registro PM y no se ajusta aquí.
var _prgVivo = [];
export function cyclePrg(sigla, mes) {
  var MS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  var p = _prgVivo.filter(function (x) { return x.sigla === sigla; })[0];
  var c = p && p.meses[mes];
  if (!c) return;
  var fch = function (f) { return f ? f.slice(8, 10) + '-' + f.slice(5, 7) + '-' + f.slice(0, 4) : ''; };
  if (c.eje.length) {
    toast('ℹ️ ' + sigla + ' · ' + mes + ': ejecutado ' + c.eje.map(function (x) { return (x.tipo || 'PM') + ' el ' + fch(x.fecha); }).join('; ') + '. Para corregirlo, edita el registro en Registro PM.');
    return;
  }
  var anio = parseInt($('fPrgAnio')?.value) || new Date().getFullYear();
  var prg = S.g('prg') || [];
  var fila = prg.filter(function (x) { return x.sigla === sigla; })[0];
  if (!fila) { fila = { sigla: sigla, tipo: p.tipo, modelo: p.modelo, meses: {} }; MS.forEach(function (m) { fila.meses[m] = ''; }); prg.push(fila); }
  if (typeof fila.meses === 'string') { try { fila.meses = JSON.parse(fila.meses); } catch (e) { fila.meses = {}; } }
  var man = fila.meses._manual || {}, clave = anio + '-' + ('0' + (MS.indexOf(mes) + 1)).slice(-2);
  var ciclo = ['', 'PM1', 'PM2', 'PM3', 'PM4', 'NONE'];
  var sig = ciclo[(ciclo.indexOf(man[clave] || '') + 1) % ciclo.length];
  if (sig) man[clave] = sig; else delete man[clave];
  if (Object.keys(man).length) fila.meses._manual = man; else delete fila.meses._manual;
  S.s('prg', prg);
  renderPrg();
  toast('✎ ' + sigla + ' · ' + mes + ': ' + (sig === 'NONE' ? 'sin PM este mes (a mano)' : sig ? sig + ' (a mano)' : 'vuelve al cálculo automático' + (c.auto.length ? ': ' + c.auto.map(function (x) { return x.tipo + ' ~' + fch(x.fecha); }).join('; ') : '')));
}

// Puente window/renders — ver nota en mov.js (primera tanda).
window.regenPrg = regenPrg;
window.renderPrg = renderPrg;
window.cyclePrg = cyclePrg;
renders.prg = renderPrg;
