// Pestaña Stock & Insumos (contenedor con 4 sub-pestañas directas: Stock
// Filtros / Lubricantes / Repuestos / Consumos; Costos pasó a ser pestaña propia el 2026-10-16) — extraída a su
// propio archivo (Fase 2 de modularización). Módulo ES real (Fase 3,
// 2026-08-30, primera tanda: Stock & Insumos) — ver nota de migración en
// mov.js (mismo grupo). Solo despacha a renders.stk/lub/cos/mov/rep vía el
// registro 'renders' (búsqueda en tiempo de ejecución, no import — sigue
// funcionando igual sin importar si cos.js/rep.js ya son módulos o no).
//
// Antes existía un nivel intermedio ("Costos & Stock", cstk.js) que agrupaba
// Costos/Consumos/Repuestos como sub-sub-pestañas — dos clics adentro de
// "Stock & Insumos", con un nombre que compartía la palabra "Stock" y
// confundía si eran o no la misma sección. Se aplanó a un solo nivel
// (auditoría 2026-08); cstk.js se eliminó por completo, no quedó nada
// enrutando ahí.
export async function renderStk2() {
  // 'cos' (Costos) ya no vive acá: si quedó guardada como sub-pestaña, se abre Stock Filtros.
  const sub = (window._stk2Sub && window._stk2Sub !== 'cos') ? window._stk2Sub : 'stk';
  $('s-stk2').innerHTML = `
    <div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="10,2 17,6 10,10 3,6"/><line x1="3" y1="6" x2="3" y2="13"/><line x1="17" y1="6" x2="17" y2="13"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="3" y1="13" x2="10" y2="18"/><line x1="17" y1="13" x2="10" y2="18"/></svg> Stock & Insumos</div>
      <div class="sec-s">Filtros, lubricantes, repuestos y consumos</div></div>
      <button class="btn btn-o" onclick="queComprar()">🛒 Qué comprar</button></div>
    <div class="subtabs" role="tablist">
      <button class="subtab ${sub === 'stk' ? 'on' : ''}" role="tab" onclick="stk2Sub('stk')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="10,2 17,6 10,10 3,6"/><line x1="3" y1="6" x2="3" y2="13"/><line x1="17" y1="6" x2="17" y2="13"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="3" y1="13" x2="10" y2="18"/><line x1="17" y1="13" x2="10" y2="18"/></svg> Stock Filtros</button>
      <button class="subtab ${sub === 'lub' ? 'on' : ''}" role="tab" onclick="stk2Sub('lub')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="5" y="3" width="10" height="14" rx="2"/><line x1="5" y1="7" x2="15" y2="7"/><line x1="5" y1="13" x2="15" y2="13"/></svg>️ Lubricantes</button>
      <button class="subtab ${sub === 'rep' ? 'on' : ''}" role="tab" onclick="stk2Sub('rep')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="10,2 17,6 10,10 3,6"/><line x1="3" y1="6" x2="3" y2="13"/><line x1="17" y1="6" x2="17" y2="13"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="3" y1="13" x2="10" y2="18"/><line x1="17" y1="13" x2="10" y2="18"/></svg> Repuestos</button>
      <button class="subtab ${sub === 'mov' ? 'on' : ''}" role="tab" onclick="stk2Sub('mov')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Consumos</button>
    </div>
    <div id="s-stk" class="${sub === 'stk' ? '' : 'hidden'}"></div>
    <div id="s-lub" class="${sub === 'lub' ? '' : 'hidden'}"></div>
    <div id="s-mov" class="${sub === 'mov' ? '' : 'hidden'}"></div>
    <div id="s-rep" class="${sub === 'rep' ? '' : 'hidden'}"></div>
  `;
  // Carga perezosa (2026-09-10): stk/lub/cos/mov/rep son de las 32 pestañas
  // sin dependencias cruzadas conocidas, así que pueden no estar cargadas
  // todavía — ver _LAZY_VERS/_cargarModuloLazy en index.html.
  if (typeof _LAZY_VERS !== 'undefined' && _LAZY_VERS[sub]) await _cargarModuloLazy(sub);
  if (sub === 'stk') renders.stk();
  else if (sub === 'lub') renders.lub();
  else if (sub === 'mov') renders.mov();
  else if (sub === 'rep') renders.rep();
  setTimeout(() => aplicarOrdenUniversal('s-stk2'), 60);
}
export function stk2Sub(s) { window._stk2Sub = s; if (typeof _logUsoPestana === 'function') _logUsoPestana('stk2.' + s); renders.stk2(); }


// ── QUÉ COMPRAR (2026-10-24) ─────────────────────────────────────────────────────────────────────────────
// Una sola vista de lo que hay que comprar el próximo mes, semestre y año: filtros, lubricantes, neumáticos y elementos de desgaste, restando lo que ya hay. El cálculo está en
// planCompras (logic.js) con su comentario de fuentes y límites; acá solo se arma la entrada desde el store y se dibuja, avisos de datos viejos incluidos.
function _queComprarEntrada() {
  const eq = S.g('eq') || [], stk = S.g('stk') || [], lub = S.g('lub') || [];
  const demanda = demandaPlanificadaPM(eq, getPautasConsumo, stk, lub, S.g('mapaRep') || [], new Date(), 365);
  const neuTodos = S.g('neu') || [], meds = _neuMedPorSerie(), eqs = _eqPorSigla();
  const items = []; let estimados = 0, ultimaGlobal = '';
  neuTodos.filter(n => !n.estado || n.estado === 'Operativo').forEach(n => {
    const p = neuProyeccion(n, meds, eqs);
    if (!p) return;
    const ms = meds[n.serie] || [], ult = ms.length ? ms[ms.length - 1].fecha : (n.ultimaMedicion || null);
    if (ult && ult > ultimaGlobal) ultimaGlobal = ult;
    if (p.confianza === 'Estimado') { estimados++; return; }   // sin mediciones: la fecha sería inventada
    items.push({ sigla: n.sigla, posicion: n.posicion, medida: n.medida, base: ult, dias: p.diasRestantes, precio: (neuPrecio(n) || {}).precio || 0 });
  });
  const stock = neuTodos.filter(n => n.estado === 'Stock').map(n => ({ medida: n.medida }));
  return { demanda, stk, lub, equipos: eq, neu: { items, stock, estimados, ultimaGlobal }, desgaste: proyeccionElementosDesgaste(S.g('ot') || [], eq) };
}
export function queComprar() {
  const fn2 = v => fn(Math.round(Number(v) || 0));
  const r = planCompras(_queComprarEntrada());
  const H = r.horizontes;
  const cabH = '<th>' + H.map(h => h.etiqueta.replace('Próximo ', '')).join('</th><th>') + '</th>';
  const celdas = (obj, resaltar) => H.map(h => {
    const v = obj[h.clave];
    return '<td style="text-align:center;' + (resaltar && v > 0 ? 'font-weight:700;color:var(--ac)' : 'color:var(--tx3)') + '">' + (v == null ? '—' : fn2(v)) + '</td>';
  }).join('');
  const tabla = (titulo, nota, cab, filas) =>
    '<b style="font-size:13px">' + titulo + '</b><div style="font-size:10px;color:var(--tx3);margin:2px 0 6px">' + nota + '</div>' +
    (filas.length ? '<div class="tbl-wrap" style="max-height:260px;overflow:auto;margin-bottom:14px"><table style="width:100%;font-size:11px"><tr style="background:var(--bg3)">' + cab + '</tr>' + filas.join('') + '</table></div>'
      : '<div style="padding:10px;color:var(--tx3);font-size:12px;margin-bottom:14px">Sin datos para proyectar.</div>');
  const baseTxt = b => b.anio === 'plan' ? 'PM programados' : b.anio === 'historico' ? 'consumo histórico' : '—';
  const filaIns = x => '<tr style="border-bottom:1px solid var(--bd)"><td style="padding:5px"><b>' + escapeHtml(x.nombre) + '</b>' + (x.nParte ? ' <span style="font-size:10px;color:var(--tx3)">' + escapeHtml(x.nParte) + '</span>' : '') +
    '</td><td style="text-align:center">' + fn2(x.posicion) + (x.unidad && x.unidad !== 'un' ? ' ' + escapeHtml(x.unidad) : '') + '</td>' + celdas(x.comprar, true) +
    '<td style="font-size:10px;color:var(--tx3)">' + baseTxt(x.base) + '</td></tr>';
  const cabIns = '<th style="padding:5px;text-align:left">Ítem</th><th>Hay hoy</th>' + cabH + '<th>Según</th>';
  const filaNeu = x => '<tr style="border-bottom:1px solid var(--bd)"><td style="padding:5px"><b>' + escapeHtml(x.medida) + '</b>' + (x.vencidos ? ' <span style="font-size:10px;color:var(--danger)">' + x.vencidos + ' vencido(s)</span>' : '') +
    '</td><td style="text-align:center">' + x.existencias + '</td>' + celdas(x.necesidad, false) + celdas(x.comprar, true) + '</tr>';
  const cabNeu = '<th style="padding:5px;text-align:left">Medida</th><th>En existencias</th><th colspan="3">Se cambian</th><th colspan="3">Comprar</th>';
  const filaDes = x => '<tr style="border-bottom:1px solid var(--bd)"><td style="padding:5px"><b>' + escapeHtml(x.pieza) + '</b> <span style="font-size:10px;color:var(--tx3)">' + escapeHtml(x.tipo) + '</span></td><td style="text-align:center">' + x.nEventos + ' en ' + x.nMeses + ' m</td>' +
    celdas({ mes: x.mes, semestre: x.semestre, anio: x.anio }, true) + '</tr>';
  const kpi = h => { const t = r.totales[h.clave]; return '<div style="background:var(--bg3);border-radius:8px;padding:10px;text-align:center"><div style="font-size:9px;color:var(--tx3)">' + h.etiqueta + '</div><b style="font-size:18px">$' + fn2(t.costo) + '</b><div style="font-size:9px;color:var(--tx3)">' + 'filtros ' + t.filtros + ' · lubricantes ' + t.lubricantes + ' · neumáticos ' + t.neumaticos + (t.sinPrecio ? ' · ' + t.sinPrecio + ' sin precio' : '') + '</div></div>'; };
  const avisos = r.avisos.length ? '<div style="padding:8px 10px;margin-bottom:12px;border-radius:6px;background:rgba(234,179,8,.12);font-size:11px;color:var(--warn)"><b>Antes de comprar, ojo con estos datos:</b><ul style="margin:4px 0 0 16px;padding:0">' + r.avisos.map(a => '<li>' + escapeHtml(a.texto) + '</li>').join('') + '</ul></div>' : '';
  sm('<div style="max-width:960px"><h3 style="margin:0 0 6px">🛒 Qué comprar — próximo mes, semestre y año</h3>' +
    '<div style="font-size:11px;color:var(--tx3);margin-bottom:10px">Cantidades <b>a comprar</b> ya descontando lo que hay en bodega (y lo pendiente de llegar). No considera plazos de entrega: para saber <i>cuándo pedir</i> usa el plan de reposición de Stock Filtros. Costo = solo ítems con precio cargado (precio de lista en neumáticos, no cotización).</div>' +
    avisos +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-bottom:14px">' + H.map(kpi).join('') + '</div>' +
    tabla('Filtros', 'Lo mayor entre lo que consumen los PM programados de la flota y el consumo histórico del ítem; no se suman porque el histórico ya incluye PM pasados.', cabIns, r.filtros.map(filaIns)) +
    tabla('Lubricantes', 'Mismo criterio que los filtros; las cantidades van en la unidad del lubricante.', cabIns, r.lubricantes.map(filaIns)) +
    tabla('Neumáticos', 'Los que la proyección de desgaste da por cambiados en cada plazo (los vencidos entran en los tres) menos los de esa medida en Existencias. No incluye el segundo cambio de un mismo neumático dentro del año.', cabNeu, r.neumaticos.map(filaNeu)) +
    tabla('Elementos de desgaste (zapatas, rodillos, uñas…)', 'Son <b>cambios registrados por período</b> según el historial de correctivos, no unidades de bodega: no hay existencias vinculadas, por eso no se resta nada. Úsalo como orden de magnitud para el presupuesto.', '<th style="padding:5px;text-align:left">Elemento</th><th>Historial</th>' + cabH, r.desgaste.map(filaDes)) +
    '<button class="btn btn-o" onclick="cm()">Cerrar</button></div>');
}

// Puente window/renders — ver nota en mov.js (mismo grupo de migración).
window.renderStk2 = renderStk2;
window.stk2Sub = stk2Sub;
window.queComprar = queComprar;
renders.stk2 = renderStk2;
