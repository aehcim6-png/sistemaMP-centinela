// Sub-pestaña «Preguntas del gerente» de Metas & KPIs (2026-10-27): las ocho preguntas que un gerente hace de verdad, cada una con su respuesta corta, la tabla que la sostiene, con qué datos se calculó y qué falta.
// El cálculo vive en logic.js (panelGerencia y las ger*, con pruebas); acá solo se arma lo que se ve. Regla de la pantalla: una pregunta sin datos suficientes lo dice, no rellena. Módulo ES lazy, mismo patrón que gestion.js.
const _gerHoy = () => new Date().toISOString().slice(0, 10);
const _gerNum = (v, d) => { if (v == null) return '—'; const k = Math.pow(10, d == null ? 1 : d); return fn(Math.round(Number(v) * k) / k); };
const _gerDias = h => h == null ? '—' : h < 48 ? _gerNum(h, 1) + ' h' : _gerNum(h / 24, 1) + ' días';
const _gerE = t => escapeHtml(String(t == null ? '' : t));
const _gerFmtMes = m => { const n = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']; return m ? n[parseInt(m.slice(5, 7), 10) - 1] + ' ' + m.slice(0, 4) : '—'; };
const _gerTh = (cols) => '<tr>' + cols.map((c, i) => '<th' + (i ? ' style="text-align:right"' : ' style="text-align:left"') + '>' + c + '</th>').join('') + '</tr>';
const _gerTd = (cells) => '<tr>' + cells.map((c, i) => '<td' + (i ? ' class="mono" style="text-align:right"' : '') + '>' + c + '</td>').join('') + '</tr>';
const _gerTabla = (cols, filas) => '<div class="tbl-wrap" style="max-height:50vh;overflow:auto"><table style="font-size:11px">' + _gerTh(cols) + filas.join('') + '</table></div>';

// pregunta + respuesta corta (color según tono: ok / warn / danger / neutro) + cuerpo + «con qué datos» + «qué falta»
function _gerCard(id, n, pregunta, tono, respuesta, cuerpo, datos, falta) {
  const col = tono === 'ok' ? 'var(--ok)' : tono === 'danger' ? 'var(--danger)' : tono === 'warn' ? 'var(--warn)' : 'var(--tx2)';
  return '<div class="chart-box" id="ger-' + id + '" style="margin-bottom:14px"><div class="chart-t">' + n + '. ' + _gerE(pregunta) + '</div>' +
    '<div style="font-size:13px;line-height:1.55;font-weight:600;margin:4px 0 10px;padding:8px 10px;border-left:3px solid ' + col + ';background:rgba(127,127,127,.07)">' + respuesta + '</div>' +
    (cuerpo || '') +
    '<div style="font-size:10.5px;color:var(--tx3);line-height:1.5;margin-top:8px"><b>Con qué datos:</b> ' + datos + '</div>' +
    (falta ? '<div style="font-size:10.5px;color:var(--warn);line-height:1.5;margin-top:3px"><b>Qué falta:</b> ' + falta + '</div>' : '') + '</div>';
}

function _gerEntradas() {
  const g = k => S.g(k) || [];
  const eq = g('eq'), ot = g('ot');
  const insumos = insumosResumen(g('ins'), g('insMov'), { hoy: _gerHoy() }).filas;
  return {
    hoy: _gerHoy(), ot, reg: g('reg'), equipos: eq, compras: g('comprasDetalle'), backlog: g('backlogPM'), planSem: g('planSem'), hist: g('hist'), progDia: g('progDia'),
    stk: g('stk'), lub: g('lub'), mapaRep: g('mapaRep'), insumos, insMov: g('insMov'),
    desgaste: proyeccionElementosDesgaste(ot, eq), consumosFn: typeof getPautasConsumo === 'function' ? getPautasConsumo : null
  };
}

function _gerFrescuraHTML(fr) {
  const viejas = fr.filter(f => f.vieja);
  const lista = fr.map(f => '<tr><td>' + _gerE(f.nombre) + '</td><td class="mono" style="text-align:right">' + (f.ultima || 'sin datos') + '</td><td class="mono" style="text-align:right;color:' + (f.vieja ? 'var(--warn)' : 'var(--ok)') + '">' + (f.dias == null ? '—' : f.dias + ' días') + '</td></tr>').join('');
  return '<div class="chart-box" style="margin-bottom:14px;border-left:3px solid ' + (viejas.length ? 'var(--warn)' : 'var(--ok)') + '"><div class="chart-t">Antes de leer: ¿qué tan al día están los datos?</div>' +
    '<div style="font-size:12px;line-height:1.55;margin-bottom:6px">' + (viejas.length ? '⚠ <b>' + viejas.length + ' de ' + fr.length + ' fuentes están desactualizadas</b>: ' + viejas.map(f => _gerE(f.nombre)).join(', ') + '. Las respuestas que dependen de ellas describen el pasado, no hoy.' : 'Todas las fuentes tienen datos recientes.') + '</div>' +
    '<details><summary style="cursor:pointer;font-size:11px;color:var(--ac)">Ver la última fecha de cada fuente</summary><div class="tbl-wrap"><table style="font-size:11px"><tr><th style="text-align:left">Fuente</th><th style="text-align:right">Último dato</th><th style="text-align:right">Antigüedad</th></tr>' + lista + '</table></div></details></div>';
}

function _gerP1(d) {
  if (!d.n) return _gerCard('dur', 1, '¿Cuánto demora una reparación?', 'warn', 'No hay correctivos cerrados con duración para calcularlo.', '', 'Órdenes de trabajo correctivas cerradas.', d.sinDuracion ? d.sinDuracion + ' correctivos cerrados no tienen duración registrada.' : '');
  const crit = d.bandas[3], bajo = d.bandas[0], tono = crit.pctHoras >= 50 ? 'danger' : crit.n ? 'warn' : 'ok';
  const resp = 'Mediana <b>' + _gerDias(d.mediana) + '</b>; 9 de cada 10 reparaciones duran menos de <b>' + _gerDias(d.p90) + '</b>. ' + bajo.pct + '% se resuelve en menos de ' + d.cortes.bajoH + ' h' +
    (crit.n ? ', pero las <b>' + crit.n + ' críticas</b> (' + crit.pct + '% de los casos) concentran el <b>' + crit.pctHoras + '% de las horas</b> detenidas' : '') + '.';
  const filas = d.bandas.map(b => _gerTd([_gerE(b.etiqueta), b.n, b.pct == null ? '—' : b.pct + '%', _gerNum(b.horas, 0), b.pctHoras == null ? '—' : b.pctHoras + '%']));
  const casos = d.bandas.filter(b => b.casos.length && (b.id === 'alto' || b.id === 'critico')).map(b => '<details style="margin-top:6px"><summary style="cursor:pointer;font-size:11px;color:var(--ac)">Los casos más largos de la banda «' + _gerE(b.etiqueta) + '»</summary>' +
    _gerTabla(['Equipo', 'Fecha', 'Duración', 'Síntoma', 'Motivo anotado'], b.casos.map(c => '<tr><td class="mono">' + _gerE(c.sigla) + '</td><td class="mono">' + _gerE(c.fecha || '—') + '</td><td class="mono" style="text-align:right">' + _gerDias(c.horas) + (c.aprox ? ' ≈' : '') + '</td><td>' + _gerE(c.sintoma) + '</td><td>' + _gerE(c.motivo || '—') + '</td></tr>')) + '</details>').join('');
  return _gerCard('dur', 1, '¿Cuánto demora una reparación?', tono, resp, _gerTabla(['Banda', 'OT', '% de las OT', 'Horas detenido', '% de las horas'], filas) + casos,
    d.n + ' correctivos cerrados con duración' + (d.aproximadas ? ' (' + d.aproximadas + ' con duración aproximada por días entre fechas, marcadas ≈)' : '') + '. Cortes: bajo &lt; ' + d.cortes.bajoH + ' h, medio hasta ' + Math.round(d.cortes.medioH / 24) + ' días, alto hasta ' + Math.round(d.cortes.altoH / 24) + ' días.',
    d.sinDuracion ? d.sinDuracion + ' correctivos cerrados no traen duración y quedan fuera.' : '');
}

function _gerP2(m) {
  const falta = 'El motivo de demora se pide desde el 27 de octubre al cerrar una OT: las OT anteriores no lo traen y no se puede reconstruir.';
  if (!m.total) return _gerCard('mot', 2, '¿Por qué demoran tanto? ¿Es nuestro, de compra o del proveedor?', 'warn', 'No hay correctivos cerrados de ' + OT_DEMORA_UMBRAL_H + ' horas o más.', '', 'Correctivos cerrados de ' + OT_DEMORA_UMBRAL_H + ' h o más.', falta);
  const bajo = m.pctInformado == null || m.pctInformado < 30;
  const filas = m.porGrupo.map(g => _gerTd([_gerE(g.etiqueta), g.n, g.pct + '%', _gerNum(g.horas, 0)]));
  const top = m.porGrupo.filter(g => g.grupo !== 'sin_informar')[0];
  const resp = bajo ? 'Todavía <b>no se puede responder</b>: solo ' + m.informadosReales + ' de ' + m.total + ' reparaciones largas (' + (m.pctInformado == null ? 0 : m.pctInformado) + '%) tienen el motivo informado.' :
    'Entre las reparaciones largas con motivo informado, la causa más frecuente es <b>' + _gerE(top ? top.etiqueta : '—') + '</b> (' + (top ? top.pct : 0) + '%). Hay motivo en el ' + m.pctInformado + '% de las ' + m.total + ' reparaciones largas.';
  return _gerCard('mot', 2, '¿Por qué demoran tanto? ¿Es nuestro, de compra o del proveedor?', bajo ? 'warn' : 'neutro', resp, bajo && !m.conMotivo ? '' : _gerTabla(['Motivo', 'OT', '% de las que tienen motivo', 'Horas detenido'], filas),
    m.conMotivo + ' de ' + m.total + ' correctivos cerrados de ' + OT_DEMORA_UMBRAL_H + ' h o más traen motivo' + (m.sinInformar ? ' (' + m.sinInformar + ' dicen «Sin informar»: se cerraron sin completarlo)' : '') + '.', bajo ? falta : (m.sinDato ? m.sinDato + ' no traen motivo (cerradas antes del cambio).' : ''));
}

function _gerP3(p) {
  if (!p) return _gerCard('prog', 3, '¿Tenemos lo suficiente para el programa de PM del mes?', 'warn', 'No se pudo calcular: faltan las pautas de consumo.', '', 'Pautas de consumo, equipos, Stock Filtros y Lubricantes.', '');
  const r = p.resumen;
  if (!r.total) return _gerCard('prog', 3, '¿Tenemos lo suficiente para el programa de PM del mes?', 'warn', 'No hay PM proyectados en los próximos ' + p.dias + ' días.', '', 'Horómetro, ritmo diario y frecuencia de cada equipo.', p.sinRitmo.length ? p.sinRitmo.length + ' equipos no tienen ritmo diario (horas/día) y no se proyectan.' : '');
  if (!r.completos && !r.conFaltantes) return _gerCard('prog', 3, '¿Tenemos lo suficiente para el programa de PM del mes?', 'warn', 'Hay <b>' + r.total + ' PM</b> en los próximos ' + p.dias + ' días, pero ninguno tiene una pauta de consumo que se pueda comparar con el stock: no se puede responder.', '',
    r.total + ' PM proyectados por horómetro y ritmo diario.', 'Las pautas de esos equipos no traen repuestos o lubricantes vinculables a Stock Filtros o Lubricantes' + (p.sinVinculo.length ? ' (sin vincular: ' + p.sinVinculo.slice(0, 4).map(_gerE).join(', ') + (p.sinVinculo.length > 4 ? '…' : '') + ')' : '') + '.');
  const tono = r.conFaltantes ? (r.completos / (r.completos + r.conFaltantes) < 0.7 ? 'danger' : 'warn') : 'ok';
  const resp = r.conFaltantes ? 'De <b>' + r.total + ' PM</b> de los próximos ' + p.dias + ' días, <b>' + r.completos + ' están completos</b> y <b>' + r.conFaltantes + ' se quedan sin algún insumo</b> si no llega nada más.' : 'Los <b>' + r.completos + ' PM</b> de los próximos ' + p.dias + ' días tienen todos sus filtros y lubricantes en bodega.';
  const fal = p.faltantes.length ? _gerTabla(['Insumo', 'Necesita', 'Hay en bodega', 'Falta', 'Ya pedido'], p.faltantes.slice(0, 20).map(a => '<tr><td>' + _gerE(a.nombre) + (a.nParte ? ' <span class="mono" style="color:var(--tx3)">' + _gerE(a.nParte) + '</span>' : '') + '</td><td class="mono" style="text-align:right">' + _gerNum(a.necesita, 1) + '</td><td class="mono" style="text-align:right">' + _gerNum(a.hay, 1) + '</td><td class="mono" style="text-align:right;color:var(--danger);font-weight:700">' + _gerNum(a.falta, 1) + '</td><td class="mono" style="text-align:right">' + (a.enCamino > 0 ? _gerNum(a.enCamino, 1) : '—') + '</td></tr>')) : '';
  const evs = p.eventos.filter(e => e.estado === 'falta').slice(0, 15);
  const ev = evs.length ? '<details style="margin-top:6px"><summary style="cursor:pointer;font-size:11px;color:var(--ac)">PM que quedan incompletos, en orden de fecha</summary>' + _gerTabla(['Equipo / PM', 'En', 'Fecha', 'Le falta'], evs.map(e => '<tr><td class="mono">' + _gerE(e.sigla) + ' ' + _gerE(e.pm) + '</td><td class="mono" style="text-align:right">' + e.dias + ' d</td><td class="mono" style="text-align:right">' + _gerE(e.fecha) + '</td><td style="text-align:right">' + e.faltan.map(f => _gerE(f.nombre) + ' (−' + _gerNum(f.falta, 1) + ')').join(', ') + '</td></tr>')) + '</details>' : '';
  const faltaTxt = [p.sinVinculo.length ? p.sinVinculo.length + ' ítem(s) de pauta no se pudieron vincular al stock y no se evaluaron (' + p.sinVinculo.slice(0, 4).map(_gerE).join(', ') + (p.sinVinculo.length > 4 ? '…' : '') + ')' : '',
    p.sinRitmo.length ? p.sinRitmo.length + ' equipo(s) sin ritmo diario no se proyectan' : '', r.sinPauta ? r.sinPauta + ' PM sin pauta de consumo' : '', 'Solo se cuenta lo que hay hoy en bodega: lo ya pedido se muestra aparte y no se descuenta como disponible'].filter(Boolean).join('. ') + '.';
  return _gerCard('prog', 3, '¿Tenemos lo suficiente para el programa de PM del mes?', tono, resp, fal + ev,
    r.total + ' PM proyectados por horómetro y ritmo diario, repartiendo el stock real de Filtros y Lubricantes en orden de fecha: lo que usa un PM ya no está para el siguiente.', faltaTxt);
}

function _gerP4(ds) {
  if (!ds.length) return _gerCard('des', 4, '¿Tenemos para cambiar los elementos de desgaste?', 'warn', 'No hay piezas con historial suficiente para proyectar su cambio.', '', 'Historial de correctivos por tipo de equipo y pieza (mínimo 3 eventos en 3 meses).', '');
  const peor = ds.filter(x => x.estado === 'no_alcanza').length, sin = ds.filter(x => x.estado === 'sin_item').length, mes = ds.filter(x => x.estado === 'alcanza_mes').length;
  const tono = peor ? 'danger' : (sin || mes) ? 'warn' : 'ok';
  const resp = '<b>' + ds.length + ' piezas</b> proyectadas: ' + (peor ? '<b>' + peor + ' no alcanzan ni para un mes</b>, ' : '') + mes + ' alcanzan solo el mes, ' + ds.filter(x => x.estado === 'alcanza_semestre').length + ' el semestre, ' + ds.filter(x => x.estado === 'alcanza_anio').length + ' el año y <b>' + sin + ' no tienen ítem en el kardex</b> para compararlas.';
  const lab = { no_alcanza: ['No alcanza', 'var(--danger)'], alcanza_mes: ['Solo el mes', 'var(--warn)'], alcanza_semestre: ['Semestre', 'var(--ok)'], alcanza_anio: ['Año', 'var(--ok)'], sin_item: ['Sin ítem en kardex', 'var(--tx3)'] };
  const orden = { no_alcanza: 0, alcanza_mes: 1, sin_item: 2, alcanza_semestre: 3, alcanza_anio: 4 };
  const filas = ds.slice().sort((a, b) => orden[a.estado] - orden[b.estado]).map(x => '<tr><td>' + _gerE(x.pieza) + ' <span style="color:var(--tx3)">(' + _gerE(x.tipo) + ')</span></td><td class="mono" style="text-align:right">' + x.cambiosMes + ' / ' + x.cambiosSemestre + ' / ' + x.cambiosAnio + '</td><td class="mono" style="text-align:right">' + (x.estado === 'sin_item' ? '—' : _gerNum(x.saldo, 1)) + '</td><td class="mono" style="text-align:right">' + (x.mesesCubiertos == null ? '—' : _gerNum(x.mesesCubiertos, 1)) + '</td><td style="text-align:right;color:' + lab[x.estado][1] + ';font-weight:700">' + lab[x.estado][0] + '</td></tr>');
  return _gerCard('des', 4, '¿Tenemos para cambiar los elementos de desgaste?', tono, resp, _gerTabla(['Pieza (tipo de equipo)', 'Cambios mes / semestre / año', 'Saldo del kardex', 'Meses cubiertos', 'Estado'], filas),
    'Cambios proyectados del historial de correctivos (promedio mensual × período) contra el saldo de los ítems activos del kardex cuyo nombre contiene la pieza.', 'Se supone <b>una unidad por cambio</b>: si un cambio usa varias piezas la necesidad real es mayor. «Sin ítem» significa que el kardex no tiene un artículo con ese nombre (puede existir con otro nombre).');
}

function _gerP5(r, hoy) {
  const recientes = r.meses.filter(m => m.correctivos > 0 || m.preventivos > 0).slice(-12);
  if (!recientes.length) return _gerCard('rea', 5, '¿Por qué trabajamos reactivo y no preventivo? ¿Estamos peor que el año pasado?', 'warn', 'No hay correctivos ni PM registrados.', '', 'OT correctivas y PM registrados.', '');
  const inter = r.interanual, atrasoOT = r.ultimoMesOT && r.ultimoMesOT < hoy.slice(0, 7);
  const peor = inter.filter(x => x.varCorrectivosPct > 0).length;
  const resp = inter.length ? 'En <b>' + inter.length + ' mes(es)</b> donde hay datos de los dos años: <b>' + peor + '</b> con más correctivos que el mismo mes del año anterior' + (inter.length ? ' (' + inter.map(x => _gerFmtMes(x.mes) + ' ' + (x.varCorrectivosPct > 0 ? '+' : '') + x.varCorrectivosPct + '%').join(', ') + ')' : '') + '.' :
    'No se puede comparar con el mismo período del año anterior: no hay meses con correctivos en los dos años.';
  const filas = recientes.map(m => _gerTd([_gerFmtMes(m.mes), m.correctivos, m.preventivos, m.pctReactivo == null ? '—' : m.pctReactivo + '%', _gerNum(m.horas, 0)]));
  const it = inter.length ? '<div style="font-size:11px;font-weight:700;margin:10px 0 4px">Mismo mes, un año antes</div>' + _gerTabla(['Mes', 'Correctivos', 'Año anterior', 'Variación', 'Horas detenido', 'Año anterior', 'Variación'],
    inter.map(x => _gerTd([_gerFmtMes(x.mes), x.correctivos, x.correctivosAnt, (x.varCorrectivosPct > 0 ? '+' : '') + x.varCorrectivosPct + '%', _gerNum(x.horas, 0), _gerNum(x.horasAnt, 0), x.varHorasPct == null ? '—' : (x.varHorasPct > 0 ? '+' : '') + x.varHorasPct + '%']))) : '';
  return _gerCard('rea', 5, '¿Por qué trabajamos reactivo y no preventivo? ¿Estamos peor que el año pasado?', inter.length && peor > inter.length / 2 ? 'danger' : 'neutro', resp,
    _gerTabla(['Mes', 'Correctivos', 'PM registrados', '% reactivo', 'Horas detenido'], filas) + it,
    '% reactivo = correctivos ÷ (correctivos + PM registrados). Últimos ' + recientes.length + ' meses con datos. Las OT correctivas llegan hasta ' + _gerFmtMes(r.ultimoMesOT) + ' y los PM hasta ' + _gerFmtMes(r.ultimoMesPM) + '.',
    (atrasoOT ? 'Las OT correctivas no se cargan desde ' + _gerFmtMes(r.ultimoMesOT) + ': el % reactivo de los meses posteriores no es real (muestra solo PM). ' : '') + 'El «por qué» de fondo (reincidencia, causa raíz) no se puede responder todavía: el componente que falló no queda guardado en cada OT.');
}

function _gerP6(p) {
  const pr = p.programa, lag = p.registro, bk = p.backlog;
  const filas = [];
  if (pr) filas.push(['Certeza del programa de PM (últimos 30 días)', pr.certeza == null ? '—' : _gerNum(pr.certeza, 0) + '%', pr.programados + ' programados, ' + pr.alcanzados + ' alcanzados, ' + pr.ejecutados + ' ejecutados']);
  if (pr) filas.push(['Cumplimiento del programa de PM', pr.cumplimiento == null ? '—' : _gerNum(pr.cumplimiento, 0) + '%', 'sobre ' + pr.equiposEvaluados + ' equipos con horómetro' + (pr.sinHorometro ? ' (' + pr.sinHorometro + ' sin horómetro)' : '')]);
  filas.push(['Correctivos registrados el mismo día de la falla', lag.n ? lag.mismoDiaPct + '%' : '—', lag.n ? lag.mismoDia + ' de ' + lag.n + ' (' + lag.unoDos + ' en 1–2 días, ' + lag.masDeDos + ' después)' : 'sin datos']);
  filas.push(['Backlog de PM abierto', String(bk.abiertos), bk.vencidos + ' con más de 30 días, ' + bk.provisorias + ' son reparaciones provisorias sin cerrar']);
  filas.push(['Plan semanal cargado', String(p.planSemanal.filas), p.planSemanal.filas ? 'filas en el plan semanal' : 'no hay plan semanal cargado']);
  filas.push(['Correctivos cerrados con motivo de demora informado', p.motivos.conMotivo ? Math.round(p.motivos.informados / p.motivos.conMotivo * 100) + '%' : '—', p.motivos.conMotivo ? p.motivos.informados + ' de ' + p.motivos.conMotivo + ' (sin informar: ' + p.motivos.sinInformar + ')' : 'ninguna OT trae el campo todavía']);
  const alertas = [];
  if (bk.vencidos) alertas.push(bk.vencidos + ' tareas de backlog llevan más de 30 días abiertas');
  if (!p.planSemanal.filas) alertas.push('el plan semanal está vacío');
  if (lag.n && lag.mismoDiaPct < 50) alertas.push('menos de la mitad de los correctivos se registra el mismo día');
  if (pr && pr.certeza != null && pr.certeza < (pr.metaCerteza || 80)) alertas.push('la certeza del programa está bajo la meta');
  const resp = alertas.length ? 'Hay señales de que la planificación <b>no está cerrando el ciclo</b>: ' + alertas.join('; ') + '.' : 'Los indicadores del proceso no muestran alertas con los datos disponibles.';
  return _gerCard('pla', 6, '¿Se planifica de verdad o solo se ingresan números?', alertas.length ? 'warn' : 'ok', resp,
    _gerTabla(['Indicador del proceso', 'Valor', 'Detalle'], filas.map(f => '<tr><td>' + _gerE(f[0]) + '</td><td class="mono" style="text-align:right;font-weight:700">' + _gerE(f[1]) + '</td><td style="text-align:right;font-size:10.5px;color:var(--tx2)">' + _gerE(f[2]) + '</td></tr>')),
    'Resultados del <b>proceso</b> (programa de PM, registro de OT, backlog, plan semanal), calculados con el mismo método del Informe de gestión. No evalúan a una persona: un indicador bajo apunta a dónde mirar, no a quién culpar.',
    'No hay forma de saber si una tarea se hizo «de verdad» más allá de lo que se registra; los indicadores muestran si el ciclo planificar → ejecutar → registrar se cierra. Quién cargó cada cosa y cuándo no se compara aquí.');
}

function _gerP7(c) {
  if (!c.tramos.length) return _gerCard('cad', 7, '¿Dónde se atasca la cadena administrativa?', 'warn', 'No hay datos suficientes para medir los tramos.', '', 'Compras (pedidos recibidos) y OT.', 'Faltan las fechas de cada aprobación.');
  const max = c.tramos.filter(t => t.masLento)[0];
  const resp = 'El tramo más lento que se puede medir es <b>' + _gerE(max.tramo) + '</b>: mediana <b>' + _gerNum(max.mediana, 1) + ' días</b> (' + max.n + ' casos).';
  const filas = c.tramos.map(t => '<tr' + (t.masLento ? ' style="background:rgba(239,68,68,.08)"' : '') + '><td>' + _gerE(t.tramo) + (t.masLento ? ' <b style="color:var(--danger)">← más lento</b>' : '') + '<div style="font-size:10px;color:var(--tx3)">' + _gerE(t.notas) + '</div></td><td class="mono" style="text-align:right">' + t.n + '</td><td class="mono" style="text-align:right">' + _gerNum(t.mediana, 1) + '</td><td class="mono" style="text-align:right">' + _gerNum(t.p90, 1) + '</td></tr>');
  const lentos = c.lentos.length ? '<details style="margin-top:6px"><summary style="cursor:pointer;font-size:11px;color:var(--ac)">Los 10 pedidos recibidos que más tardaron (último año)</summary>' +
    _gerTabla(['Pedido / equipo', 'Detalle', 'Proveedor', 'Fecha', 'Días'], c.lentos.map(l => '<tr><td class="mono">' + _gerE(l.pedido) + ' ' + _gerE(l.sigla) + '</td><td>' + _gerE(l.detalle) + '</td><td>' + _gerE(l.proveedor) + '</td><td class="mono" style="text-align:right">' + _gerE(l.fecha) + '</td><td class="mono" style="text-align:right;font-weight:700">' + l.dias + '</td></tr>')) + '</details>' : '';
  return _gerCard('cad', 7, '¿Dónde se atasca la cadena administrativa?', 'neutro', resp, _gerTabla(['Tramo', 'Casos', 'Mediana (días)', '9 de cada 10 menos de (días)'], filas) + lentos,
    'Mediana y percentil 90 de cada tramo con las fechas que trae cada pedido (pedido interno, estado actual) y cada OT.',
    '<b>Faltan las fechas de cada aprobación</b> (visto bueno del comprador, jefe de servicio, creación de la OC, aprobación por monto: subgerente hasta $1 M, gerente hasta $3 M, gerente general sobre eso): hoy solo queda la fecha del pedido y la del estado actual, así que no se puede decir cuánto tarda cada firma. Con el Excel que tiene esas fechas se puede agregar.');
}

function _gerP8(d) {
  const prom = d.dotacion.promedios;
  if (!prom.length) return _gerCard('dot', 8, '¿Tenemos suficientes mecánicos y electromecánicos?', 'warn', 'No hay programación diaria cargada para conocer la dotación.', '', 'Programación diaria (nombre y cargo por turno).', d.nota);
  const esp = ['Mecánico líder', 'Mecánico', 'Electromecánico', 'Eléctrico', 'Soldador', 'Lubricador'];
  const filas = prom.map(p => _gerTd([_gerE(p.turno), p.dias, _gerNum(p.promedioPersonas, 1), _gerNum(p.promedioMecanicos, 1)]));
  const cobertura = d.comparable ? 'La carga de mantención del mismo período es de ' + d.cargaMismoPeriodo.map(m => _gerFmtMes(m.mes) + ': ' + m.correctivos + ' correctivos, ' + _gerNum(m.horas, 0) + ' h de parada').join('; ') + '.' : '';
  const resp = 'Hoy <b>no se puede responder con datos</b>: la dotación está cargada para ' + d.dotacion.nDias + ' día(s) (' + _gerE(d.desde) + ' a ' + _gerE(d.hasta) + ')' + (d.comparable ? '.' : ', y las OT correctivas llegan hasta ' + _gerFmtMes(d.ultimoMesOT) + ': los períodos no coinciden.') + ' ' + cobertura;
  const espFilas = Object.keys(prom.reduce((o, p) => Object.assign(o, p.promedioPorEspecialidad), {})).sort((a, b) => (esp.indexOf(a) + 1 || 99) - (esp.indexOf(b) + 1 || 99)).map(e => _gerTd([_gerE(e)].concat(prom.map(p => _gerNum(p.promedioPorEspecialidad[e] || 0, 1)))));
  return _gerCard('dot', 8, '¿Tenemos suficientes mecánicos y electromecánicos?', 'warn', resp,
    _gerTabla(['Turno', 'Días cargados', 'Personas por día', 'Mecánicos por día'], filas) + (espFilas.length ? '<div style="font-size:11px;font-weight:700;margin:10px 0 4px">Promedio por día y especialidad</div>' + _gerTabla(['Especialidad'].concat(prom.map(p => _gerE(p.turno))), espFilas) : ''),
    'Programación diaria (nombre y cargo por día y turno; un cargo se agrupa en su especialidad). Las personas se cuentan una vez por día y turno.',
    _gerE(d.nota) + (d.dotacion.cargosSinClasificar.length ? ' Cargos que no se pudieron clasificar: ' + d.dotacion.cargosSinClasificar.map(_gerE).join(', ') + '.' : '') + ' Tampoco hay todavía un semestre ni un año de dotación para comparar.');
}

export function renderGer() {
  const el = $('s-ger'); if (!el) return;
  let p;
  try { p = panelGerencia(_gerEntradas()); } catch (e) { console.error('renderGer', e); el.innerHTML = '<div class="chart-box"><div class="chart-t">Preguntas del gerente</div><div style="color:var(--danger);font-size:12px">No se pudo calcular el panel: ' + _gerE(e.message) + '</div></div>'; return; }
  el.innerHTML = '<div class="chart-box" style="margin-bottom:14px"><div class="chart-t">Preguntas del gerente</div>' +
    '<div style="font-size:11px;color:var(--tx2);line-height:1.55">Las preguntas que hace una gerencia, contestadas con los datos del sistema. Cada respuesta dice con cuántos casos se calculó y qué falta; cuando no hay datos suficientes lo dice en vez de rellenar. Las cifras describen el <b>proceso</b>, no evalúan a personas.</div></div>' +
    _gerFrescuraHTML(p.frescura) + _gerP1(p.duracion) + _gerP2(p.motivos) + _gerP3(p.programa) + _gerP4(p.desgaste) + _gerP5(p.reactivo, p.hoy) + _gerP6(p.planificacion) + _gerP7(p.cadena) + _gerP8(p.dotacion);
  setTimeout(function () { if (typeof aplicarOrdenUniversal === 'function') aplicarOrdenUniversal('s-ger'); }, 60);
}

// Puente window/renders — ver nota en mov.js (primera tanda).
window.renderGer = renderGer;
renders.ger = renderGer;
