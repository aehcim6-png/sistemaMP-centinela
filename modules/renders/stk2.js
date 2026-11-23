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
      <div class="sec-s">Filtros, lubricantes, repuestos, insumos y consumos</div></div>
      <button class="btn btn-o" onclick="queComprar()">🛒 Qué comprar</button></div>
    <div class="subtabs" role="tablist">
      <button class="subtab ${sub === 'stk' ? 'on' : ''}" role="tab" onclick="stk2Sub('stk')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="10,2 17,6 10,10 3,6"/><line x1="3" y1="6" x2="3" y2="13"/><line x1="17" y1="6" x2="17" y2="13"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="3" y1="13" x2="10" y2="18"/><line x1="17" y1="13" x2="10" y2="18"/></svg> Stock Filtros</button>
      <button class="subtab ${sub === 'lub' ? 'on' : ''}" role="tab" onclick="stk2Sub('lub')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="5" y="3" width="10" height="14" rx="2"/><line x1="5" y1="7" x2="15" y2="7"/><line x1="5" y1="13" x2="15" y2="13"/></svg>️ Lubricantes</button>
      <button class="subtab ${sub === 'ins' ? 'on' : ''}" role="tab" onclick="stk2Sub('ins')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="3" y="5" width="14" height="11" rx="1.5"/><line x1="3" y1="9" x2="17" y2="9"/><line x1="8" y1="5" x2="8" y2="2.5"/><line x1="12" y1="5" x2="12" y2="2.5"/></svg> Insumos</button>
      <button class="subtab ${sub === 'rep' ? 'on' : ''}" role="tab" onclick="stk2Sub('rep')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="10,2 17,6 10,10 3,6"/><line x1="3" y1="6" x2="3" y2="13"/><line x1="17" y1="6" x2="17" y2="13"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="3" y1="13" x2="10" y2="18"/><line x1="17" y1="13" x2="10" y2="18"/></svg> Repuestos</button>
      <button class="subtab ${sub === 'mov' ? 'on' : ''}" role="tab" onclick="stk2Sub('mov')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Consumos</button>
    </div>
    <div id="s-stk" class="${sub === 'stk' ? '' : 'hidden'}"></div>
    <div id="s-lub" class="${sub === 'lub' ? '' : 'hidden'}"></div>
    <div id="s-ins" class="${sub === 'ins' ? '' : 'hidden'}"></div>
    <div id="s-mov" class="${sub === 'mov' ? '' : 'hidden'}"></div>
    <div id="s-rep" class="${sub === 'rep' ? '' : 'hidden'}"></div>
  `;
  // Carga perezosa (2026-09-10): stk/lub/cos/mov/rep son de las 32 pestañas
  // sin dependencias cruzadas conocidas, así que pueden no estar cargadas
  // todavía — ver _LAZY_VERS/_cargarModuloLazy en index.html.
  if (typeof _LAZY_VERS !== 'undefined' && _LAZY_VERS[sub]) await _cargarModuloLazy(sub);
  if (sub === 'stk') renders.stk();
  else if (sub === 'lub') renders.lub();
  else if (sub === 'ins') renders.ins();
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
    const ms = neuHistPorClave(n, meds), ult = ms.length ? ms[ms.length - 1].fecha : (n.ultimaMedicion || null);
    if (ult && ult > ultimaGlobal) ultimaGlobal = ult;
    if (p.confianza === 'Estimado') { estimados++; return; }   // sin mediciones: la fecha sería inventada
    items.push({ sigla: n.sigla, posicion: n.posicion, medida: n.medida, base: ult, dias: p.diasRestantes, precio: (neuPrecio(n) || {}).precio || 0 });
  });
  const stock = neuTodos.filter(n => n.estado === 'Stock').map(n => ({ medida: n.medida }));
  const pe = plazoEntregaCompras(S.g('comprasDetalle') || []);
  const insumos = insumosResumen(S.g('ins') || [], S.g('insMov') || [], { hoy: new Date() }).filas;
  const getsC = getsUnir(S.g('getsCambios') || [], getsEventosDesdeOT(S.g('otHist') || [], S.g('ot') || []));
  const piezas = desgastePedirAntes({ cambios: getsC, hoy: new Date(), plazoFn: pe.n ? pe.para : null, equipos: eq, repuestos: S.g('repuestos') || [], compras: S.g('comprasDetalle') || [] });
  const mapaR = S.g('mapaRep') || [];
  const lubPrograma = demandaProgramaMes(S.g('prg') || [], getPautasConsumo, stk, lub, mapaR, new Date());
  const textosOT = (S.g('otHist') || []).map(o => ({ fecha: o.fecha, sigla: o.sigla, texto: (o.descripcion || '') + ' | ' + (o.observacion || '') }))
    .concat((S.g('ot') || []).map(o => ({ fecha: o.fecha, sigla: o.sigla, texto: (o.sintoma || '') + ' | ' + (o.solucion || '') })));
  const lubFallas = { w12: lubricanteNoPlanificado(textosOT, new Date(), 12), w36: lubricanteNoPlanificado(textosOT, new Date(), 36), ultimoTexto: textosOT.reduce((m, x) => (x.fecha && String(x.fecha) > m && lubricanteCantidadesDeTexto(x.texto).length ? String(x.fecha).slice(0, 10) : m), '') };
  return { plazoFn: pe.n ? pe.para : null, insumos, demanda, stk, lub, equipos: eq, neu: { items, stock, estimados, ultimaGlobal }, desgaste: proyeccionElementosDesgaste(S.g('ot') || [], eq), piezasDesgaste: piezas, lubPrograma, lubFallas };
}
export function queComprar() {
  const fn2 = v => fn(Math.round(Number(v) || 0));
  const ent = _queComprarEntrada();
  const r = planCompras(ent);
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
  const fch = iso => iso ? iso.slice(8, 10) + '-' + iso.slice(5, 7) : '';
  const antesCel = x => {
    const a = x.pedirAntes, pz = x.plazo;
    if (!a) return '<td style="text-align:center;color:var(--tx3)" title="Ningún quiebre dentro de lo proyectado">—</td>';
    const tip = 'Plazo de entrega típico ' + pz.dias + ' d' + (pz.peor ? ' · peor caso razonable ' + pz.peor + ' d' : '') + ' — ' + pz.fuente;
    const peor = a.peorDias == null ? '' : '<div style="font-size:10px;color:' + (a.peorYa && !a.ya ? 'var(--w)' : 'var(--tx3)') + '">peor caso: ' + (a.peorYa ? 'ya' : fch(a.peorFecha)) + '</div>';
    return '<td style="text-align:center;white-space:nowrap" title="' + escapeHtml(tip) + '">' + (a.ya ? '<span style="color:var(--danger);font-weight:600">ya</span>' : fch(a.fecha)) + (pz.supuesto ? ' <span style="font-size:10px;color:var(--w)">(supuesto)</span>' : '') + peor + '</td>';
  };
  const baseTxt = b => b.anio === 'plan' ? 'PM programados' : b.anio === 'historico' ? 'consumo histórico' : '—';
  const filaIns = x => '<tr style="border-bottom:1px solid var(--bd)"><td style="padding:5px"><b>' + escapeHtml(x.nombre) + '</b>' + (x.nParte ? ' <span style="font-size:10px;color:var(--tx3)">' + escapeHtml(x.nParte) + '</span>' : '') +
    '</td><td style="text-align:center">' + fn2(x.posicion) + (x.unidad && x.unidad !== 'un' ? ' ' + escapeHtml(x.unidad) : '') + '</td>' + celdas(x.comprar, true) +
    antesCel(x) + '<td style="font-size:10px;color:var(--tx3)">' + baseTxt(x.base) + '</td></tr>';
  const cabIns = '<th style="padding:5px;text-align:left">Ítem</th><th>Hay hoy</th>' + cabH + '<th>Pedir antes de</th><th>Según</th>';
  const filaInsumo = x => '<tr style="border-bottom:1px solid var(--bd)"><td style="padding:5px"><b>' + escapeHtml(x.nombre) + '</b> <span style="font-size:10px;color:var(--tx3)">' + escapeHtml(x.categoria) + '</span>' +
    '<div style="font-size:10px;color:var(--tx3)">' + (x.consumoMes > 0 ? 'consumo ' + fn(Math.round(x.consumoMes * 10) / 10) + '/mes' + (x.pocaHistoria ? ' ⚠ poca historia' : '') : 'solo stock crítico') + '</div></td><td style="text-align:center">' + fn2(x.posicion) + ' ' + escapeHtml(x.unidad) +
    (x.stockCritico > 0 ? '<div style="font-size:10px;color:var(--tx3)">crítico ' + fn2(x.stockCritico) + '</div>' : '') + '</td>' + celdas(x.comprar, true) + antesCel(x) + '</tr>';
  const cabIns2 = '<th style="padding:5px;text-align:left">Insumo</th><th>Hay hoy</th>' + cabH + '<th>Pedir antes de</th>';
  const filaNeu = x => '<tr style="border-bottom:1px solid var(--bd)"><td style="padding:5px"><b>' + escapeHtml(x.medida) + '</b>' + (x.vencidos ? ' <span style="font-size:10px;color:var(--danger)">' + x.vencidos + ' vencido(s)</span>' : '') +
    '</td><td style="text-align:center">' + x.existencias + '</td>' + celdas(x.necesidad, false) + celdas(x.comprar, true) + antesCel(x) + '</tr>';
  const cabNeu = '<th style="padding:5px;text-align:left">Medida</th><th>En existencias</th><th colspan="3">Se cambian</th><th colspan="3">Comprar</th><th>Pedir antes de</th>';
  const filaDes = x => '<tr style="border-bottom:1px solid var(--bd)"><td style="padding:5px"><b>' + escapeHtml(x.pieza) + '</b> <span style="font-size:10px;color:var(--tx3)">' + escapeHtml(x.tipo) + '</span></td><td style="text-align:center">' + x.nEventos + ' en ' + x.nMeses + ' m</td>' +
    celdas({ mes: x.mes, semestre: x.semestre, anio: x.anio }, true) + '</tr>';
  const r2 = ent.piezasDesgaste || { filas: [], sinFecha: [], avisos: [] };
  const fch2 = iso => iso ? iso.slice(8, 10) + '-' + iso.slice(5, 7) + '-' + iso.slice(2, 4) : '';
  const filaPza = x => {
    const col = x.ya ? 'var(--danger)' : x.riesgoDemora ? 'var(--w)' : 'var(--tx)';
    const stk = x.stock == null ? '<span style="color:var(--tx3)" title="No hay stock cargado en Repuestos para este modelo y pieza">sin stock cargado</span>' : fn2(x.stock) + (x.stockMinimo != null ? '<div style="font-size:10px;color:var(--tx3)">mínimo ' + fn2(x.stockMinimo) + '</div>' : '');
    const uc = x.ultimaCompra ? fn2(x.ultimaCompra.cant) + ' un<div style="font-size:10px;color:var(--tx3)">' + fch2(x.ultimaCompra.fecha) + '</div>' : '<span style="color:var(--tx3)">—</span>';
    const tip = 'Plazo ' + x.plazo.dias + ' d' + (x.plazo.peor ? ' · peor caso razonable ' + x.plazo.peor + ' d' : '') + ' — ' + x.plazo.fuente;
    return '<tr style="border-bottom:1px solid var(--bd)"><td style="padding:5px"><b>' + escapeHtml(x.sigla) + '</b> <span style="font-size:10px;color:var(--tx3)">' + escapeHtml(x.modelo || '') + '</span></td><td>' + escapeHtml(x.pieza) + '</td>' +
      '<td style="text-align:center">' + fch2(x.ultimoCambio) + '<div style="font-size:10px;color:var(--tx3)">cada ' + x.intervaloDias + ' d · ' + x.nCambios + ' cambios</div></td>' +
      '<td style="text-align:center">' + fch2(x.proximoCambio) + (x.atrasoDias ? '<div style="font-size:10px;color:var(--w)" title="Si ya se cambió y no se anotó, registra el cambio en Elementos de desgaste y esta fila se corrige sola">pasó hace ' + x.atrasoDias + ' d: ¿se anotó el último cambio?</div>' : '') + '</td>' +
      '<td style="text-align:center;white-space:nowrap;color:' + col + '" title="' + escapeHtml(tip) + '">' + (x.ya ? '<b>ya</b> (era ' + fch2(x.pedirAntes) + ')' : fch2(x.pedirAntes)) + (x.pedirAntesPeor ? '<div style="font-size:10px;color:' + (x.riesgoDemora ? 'var(--w)' : 'var(--tx3)') + '">peor caso: ' + fch2(x.pedirAntesPeor) + '</div>' : '') + '</td>' +
      '<td style="text-align:center" title="' + escapeHtml(x.detalleUnidades || '') + '">' + (x.unidadesPorCambio != null ? x.unidadesPorCambio + ' un' + (x.detalleUnidades ? '<div style="font-size:10px;color:var(--tx3)">' + escapeHtml(x.detalleUnidades) + '</div>' : '') : '<span style="color:var(--tx3)">—</span>') + '</td>' +
      '<td style="text-align:center">' + stk + (x.alcanza === true ? '<div style="font-size:10px;color:var(--ok)">alcanza para 1 cambio</div>' : x.alcanza === false ? '<div style="font-size:10px;color:var(--danger)">faltan ' + fn2(x.faltan) + ' para 1 cambio</div>' : '') + '</td><td style="text-align:center">' + uc + '</td></tr>';
  };
  const cabDesg = '<th style="padding:5px;text-align:left">Equipo</th><th style="text-align:left">Pieza</th><th>Último cambio</th><th>Próximo cambio</th><th>Pedir antes de</th><th>Lleva (cambio completo)</th><th>Stock del modelo</th><th>Última compra</th>';
  const mesNom = { ENE: 'Ene', FEB: 'Feb', MAR: 'Mar', ABR: 'Abr', MAY: 'May', JUN: 'Jun', JUL: 'Jul', AGO: 'Ago', SEP: 'Sep', OCT: 'Oct', NOV: 'Nov', DIC: 'Dic' };
  const lubL = S.g('lub') || [];
  const mesesPrg = ent.lubPrograma.meses;
  const cabLubPrg = '<th style="padding:5px;text-align:left">Lubricante</th><th>Stock</th>' + mesesPrg.map(m => '<th>' + mesNom[m.etiqueta] + '</th>').join('') + '<th>Total</th>';
  const idxs = Array.from(new Set([].concat.apply([], mesesPrg.map(m => Object.keys(m.lubricantes))))).sort((a, b) => (lubL[a] ? lubL[a].nombre : '').localeCompare(lubL[b] ? lubL[b].nombre : ''));
  const filaPm = ['PM1', 'PM2', 'PM3', 'PM4'].map(pm => '<tr style="background:var(--bg3)"><td style="padding:5px"><b>' + pm + ' programados</b></td><td></td>' + mesesPrg.map(m => '<td style="text-align:center">' + m.pm[pm] + '</td>').join('') + '<td style="text-align:center">' + mesesPrg.reduce((t, m) => t + m.pm[pm], 0) + '</td></tr>');
  const filasLubPrg = filaPm.concat(idxs.map(i => {
    const l = lubL[i] || {}, tot = mesesPrg.reduce((t, m) => t + (m.lubricantes[i] || 0), 0), stk0 = Number(l.stock) || 0;
    return '<tr style="border-bottom:1px solid var(--bd)"><td style="padding:5px"><b>' + escapeHtml(l.nombre || '(sin nombre)') + '</b> <span style="font-size:10px;color:var(--tx3)">' + escapeHtml(l.unidad || '') + '</span></td>' +
      '<td style="text-align:center">' + (stk0 > 0 ? fn2(stk0) : '<span style="color:var(--danger)" title="El stock está en 0 o sin cargar">0</span>') + '</td>' +
      mesesPrg.map(m => '<td style="text-align:center">' + (m.lubricantes[i] ? fn2(m.lubricantes[i]) : '<span style="color:var(--tx3)">—</span>') + '</td>').join('') +
      '<td style="text-align:center;font-weight:700;color:var(--ac)">' + fn2(tot) + '</td></tr>';
  }));
  const sv = {};
  mesesPrg.forEach(m => Object.keys(m.sinVincular).forEach(k => { sv[k] = (sv[k] || 0) + m.sinVincular[k]; }));
  if (Object.keys(sv).length) filasLubPrg.push('<tr><td colspan="' + (mesesPrg.length + 3) + '" style="padding:6px;font-size:10px;color:var(--w)">Sin vincular a un lubricante de la bodega (no se suman arriba): ' + Object.keys(sv).map(k => escapeHtml(k) + ' (' + fn2(sv[k]) + ')').join(' · ') + '</td></tr>');
  const f12 = {}, f36 = {};
  ent.lubFallas.w12.filas.forEach(r => { f12[r.clase] = r; }); ent.lubFallas.w36.filas.forEach(r => { f36[r.clase] = r; });
  const filasFallas = Array.from(new Set(Object.keys(f12).concat(Object.keys(f36)))).sort((a, b) => ((f36[b] || {}).total || 0) - ((f36[a] || {}).total || 0)).map(k => {
    const a = f12[k], b = f36[k], u = (a || b).unidad;
    return '<tr style="border-bottom:1px solid var(--bd)"><td style="padding:5px"><b>' + escapeHtml(k) + '</b> <span style="font-size:10px;color:var(--tx3)">' + u + '</span></td><td style="text-align:center">' + (a ? a.eventos : 0) + '</td><td style="text-align:center">' + (a ? fn2(a.total) : 0) + '</td><td style="text-align:center;font-weight:700;color:var(--ac)">' + (a ? fn(Math.round(a.promedioMensual * 10) / 10) : 0) + '</td><td style="text-align:center">' + (b ? fn2(b.total) : 0) + '</td><td style="text-align:center">' + (b ? fn(Math.round(b.promedioMensual * 10) / 10) : 0) + '</td></tr>';
  });
  const kpi = h => { const t = r.totales[h.clave]; return '<div style="background:var(--bg3);border-radius:8px;padding:10px;text-align:center"><div style="font-size:9px;color:var(--tx3)">' + h.etiqueta + '</div><b style="font-size:18px">$' + fn2(t.costo) + '</b><div style="font-size:9px;color:var(--tx3)">' + 'filtros ' + t.filtros + ' · lubricantes ' + t.lubricantes + ' · neumáticos ' + t.neumaticos + ' · insumos ' + t.insumos + (t.sinPrecio ? ' · ' + t.sinPrecio + ' sin precio' : '') + '</div></div>'; };
  const avisosPz = (ent.piezasDesgaste && ent.piezasDesgaste.avisos) || [];
  r.avisos = r.avisos.concat(avisosPz.map(t => ({ texto: t })));
  const avisos = r.avisos.length ? '<div style="padding:8px 10px;margin-bottom:12px;border-radius:6px;background:rgba(234,179,8,.12);font-size:11px;color:var(--warn)"><b>Antes de comprar, ojo con estos datos:</b><ul style="margin:4px 0 0 16px;padding:0">' + r.avisos.map(a => '<li>' + escapeHtml(a.texto) + '</li>').join('') + '</ul></div>' : '';
  sm('<div style="max-width:960px"><h3 style="margin:0 0 6px">🛒 Qué comprar — próximo mes, semestre y año</h3>' +
    '<div style="font-size:11px;color:var(--tx3);margin-bottom:10px">Cantidades <b>a comprar</b> ya descontando lo que hay en bodega (y lo pendiente de llegar). <b>Pedir antes de</b> = primer quiebre de stock menos el plazo de entrega <b>real</b> de las compras ya recibidas (según el monto de la compra; con el peor caso razonable debajo). Costo = solo ítems con precio cargado (precio de lista en neumáticos, no cotización).</div>' +
    avisos +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-bottom:14px">' + H.map(kpi).join('') + '</div>' +
    tabla('Filtros', 'Lo mayor entre lo que consumen los PM programados de la flota y el consumo histórico del ítem; no se suman porque el histórico ya incluye PM pasados.', cabIns, r.filtros.map(filaIns)) +
    tabla('Lubricantes', 'Mismo criterio que los filtros; las cantidades van en la unidad del lubricante.', cabIns, r.lubricantes.map(filaIns)) +
    tabla('Lubricantes según el programa de PM (mes a mes)', 'Del programa anual: qué PM toca a cada equipo cada mes × lo que lleva la pauta de ese PM. Es consumo planificado, no una estimación. El día exacto no está en el programa (se usa mitad de mes). ' + (ent.lubPrograma.atrasados.length ? '<b>Ojo:</b> hay ' + ent.lubPrograma.atrasados.length + ' PM de meses pasados que el programa no marca como ejecutados; no se cuentan (podrían estar hechos sin marcar).' : ''), cabLubPrg, filasLubPrg) +
    tabla('Rellenos por fallas y fugas (de los textos de las OT)', 'Lo que NO trae el programa: relleno de aceite hidráulico tras cortes de flexible, aceite de motor, grasa del depósito, etc., con la cantidad que dice cada OT. Solo cuenta lo que trae número y unidad; las OT sin cantidad no suman. Las OT con cantidades más recientes son del ' + (ent.lubFallas.ultimoTexto ? fch2(ent.lubFallas.ultimoTexto) : '—') + '.', '<th style="padding:5px;text-align:left">Lubricante</th><th>Eventos 12 m</th><th>Total 12 m</th><th>Prom./mes 12 m</th><th>Total 36 m</th><th>Prom./mes 36 m</th>', filasFallas) +
    tabla('Neumáticos', 'Los que la proyección de desgaste da por cambiados en cada plazo (los vencidos entran en los tres) menos los de esa medida en Existencias. No incluye el segundo cambio de un mismo neumático dentro del año.', cabNeu, r.neumaticos.map(filaNeu)) +
    tabla('Insumos generales (EPP, librería, limpieza, desgaste, baterías…)', 'Del stock de insumos con kardex: el consumo de los últimos 90 días proyectado a cada plazo, más el stock crítico, menos el saldo' + (r.insumosCubiertos ? ' (' + r.insumosCubiertos + ' ya cubiertos para todo el año)' : '') + '. Con el kardex vacío no hay consumo y no se puede proyectar.', cabIns2, r.insumos.map(filaInsumo)) +
    tabla('Piezas de desgaste por equipo (cuchillas, entredientes, calzas, puntas de ripper, cantoneras)', 'Del registro de Elementos de desgaste (planilla, chat y OT): <b>pedir antes de</b> = próximo cambio estimado − plazo de entrega real. El <b>stock</b> es el del modelo del equipo en Repuestos (no por equipo). <b>Lleva</b> es la cantidad de piezas de un cambio completo según el modelo (dato del taller); en la práctica a veces se cambian solo algunas. La <b>última compra</b> es referencia de lo que se pidió.', cabDesg, (r2.filas || []).map(filaPza)) +
    (r2.sinFecha && r2.sinFecha.length ? '<div style="font-size:11px;color:var(--tx3);margin:-8px 0 14px"><b>Sin fecha proyectada</b> (último cambio registrado muy antiguo o pocos cambios): ' + r2.sinFecha.map(x => escapeHtml(x.sigla) + ' ' + escapeHtml(x.pieza) + (x.ultimoCambio ? ' (último ' + fch2(x.ultimoCambio) + ')' : '')).join(' · ') + '.</div>' : '') +
    tabla('Elementos de desgaste (zapatas, rodillos, uñas…)', 'Son <b>cambios registrados por período</b> según el historial de correctivos, no unidades de bodega: no hay existencias vinculadas, por eso no se resta nada. Úsalo como orden de magnitud para el presupuesto.', '<th style="padding:5px;text-align:left">Elemento</th><th>Historial</th>' + cabH, r.desgaste.map(filaDes)) +
    '<button class="btn btn-o" onclick="cm()">Cerrar</button></div>');
}

// Puente window/renders — ver nota en mov.js (mismo grupo de migración).
window.renderStk2 = renderStk2;
window.stk2Sub = stk2Sub;
window.queComprar = queComprar;
renders.stk2 = renderStk2;
