// Pestaña «Asistente» (2026-10-29): se pregunta en palabras normales y Claude responde con los datos reales del sistema.
// Reparto del trabajo: la Edge Function asistente-ia conversa con Claude (clave, límites, instrucciones); los DATOS no salen de aquí hasta que Claude pide una herramienta: el navegador la ejecuta con lo que la
// persona ya tiene cargado (asistenteEjecutar, en logic.js, con pruebas) y devuelve solo ese resultado. Ninguna herramienta escribe nada. Módulo ES lazy, mismo patrón que tareas.js.
const _asiE = t => escapeHtml(String(t == null ? '' : t));
const _ASI_RONDAS_MAX = 6;   // veces seguidas que Claude puede pedir herramientas antes de responder
const _ASI_ETIQUETAS = { estado_flota: 'estado de la flota', buscar_equipo: 'ficha del equipo', ordenes_trabajo: 'órdenes de trabajo', registros_pm: 'registros de PM', stock_criticos: 'stock crítico', tareas_pendientes: 'tareas pendientes', costos_correctivos: 'costos de correctivos' };
const _ASI_SUGERIDAS = ['¿Qué equipos tienen el PM vencido o urgente?', '¿Qué hay que comprar?', '¿Qué órdenes de trabajo están abiertas?', '¿Cuánto gastamos en correctivos este año y qué equipo cuesta más?', '¿Qué tareas están vencidas y a quién se escalan?'];
window._asistente = window._asistente || { api: [], vista: [], ocupado: false, error: '' };

// Texto de Claude → HTML seguro: negritas y listas con guion; todo lo demás se escapa.
export function asistenteTextoAHtml(texto) {
  const lineas = String(texto == null ? '' : texto).split('\n');
  let html = '', enLista = false;
  const inline = l => _asiE(l).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  lineas.forEach(l => {
    const m = l.match(/^\s*[-•*]\s+(.*)$/);
    if (m) { if (!enLista) { html += '<ul style="margin:4px 0 4px 18px;padding:0">'; enLista = true; } html += '<li>' + inline(m[1]) + '</li>'; return; }
    if (enLista) { html += '</ul>'; enLista = false; }
    if (l.trim()) html += '<div style="margin:3px 0">' + inline(l) + '</div>';
  });
  if (enLista) html += '</ul>';
  return html;
}

function _asiDatos() {
  return { eq: S.g('eq') || [], ot: S.g('ot') || [], reg: S.g('reg') || [], stk: S.g('stk') || [], tareas: S.g('tareas') || [] };
}

export function renderAsistente() {
  const el = $('s-asistente'); if (!el) return;
  const a = window._asistente;
  // El sistema puede redibujar la pestaña en segundo plano (datos que llegan): la pregunta a medio escribir y el foco se conservan.
  const previo = $('asiInput'), escrito = previo ? previo.value : '', conFoco = !!previo && document.activeElement === previo;
  const burbuja = m => m.rol === 'user'
    ? '<div style="align-self:flex-end;max-width:85%;background:var(--ac);color:#111;padding:8px 12px;border-radius:12px 12px 2px 12px;font-size:13px">' + _asiE(m.texto) + '</div>'
    : '<div style="align-self:flex-start;max-width:92%;background:var(--bg3);padding:8px 12px;border-radius:12px 12px 12px 2px;font-size:13px;line-height:1.55">' + asistenteTextoAHtml(m.texto) +
      (m.datos && m.datos.length ? '<div style="font-size:10px;color:var(--tx3);margin-top:6px">Datos consultados: ' + _asiE(m.datos.map(n => _ASI_ETIQUETAS[n] || n).filter((v, i, x) => x.indexOf(v) === i).join(', ')) + '</div>' : '') + '</div>';
  const sugeridas = !a.vista.length
    ? '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' + _ASI_SUGERIDAS.map((q, i) => '<button class="btn btn-o btn-sm" onclick="asistenteSugerida(' + i + ')">' + _asiE(q) + '</button>').join('') + '</div>' : '';
  el.innerHTML = '<div class="sec-h"><div><div class="sec-t">' + ICONS.asistente + ' Asistente</div><div class="sec-s">Pregunta en palabras normales; responde con los datos del sistema</div></div>' +
      (a.vista.length ? '<button class="btn btn-o btn-sm" onclick="asistenteNueva()">Nueva conversación</button>' : '') + '</div>' +
    '<div class="chart-box" style="margin-bottom:14px"><div style="font-size:11px;color:var(--tx2);line-height:1.6">El asistente <b>solo lee</b>: nunca cambia ni guarda nada. Para responder, consulta los datos que tú ya ves en el sistema, y esa información (más tu pregunta) se envía a Anthropic, la empresa de Claude, que la usa solo para contestar. Puede equivocarse o leer mal un dato incompleto: <b>revisa las cifras importantes</b> en su pantalla.</div></div>' +
    '<div class="chart-box"><div id="asiChat" style="display:flex;flex-direction:column;gap:10px;max-height:58vh;overflow:auto;padding:2px">' +
      (a.vista.length ? a.vista.map(burbuja).join('') : '<div style="font-size:12px;color:var(--tx3)">Escribe una pregunta o toca una de estas:</div>') +
      (a.ocupado ? '<div id="asiOcupado" style="align-self:flex-start;font-size:12px;color:var(--tx3)">Consultando los datos…</div>' : '') +
      (a.error ? '<div style="align-self:flex-start;font-size:12px;color:var(--danger)">' + _asiE(a.error) + '</div>' : '') +
    '</div>' + sugeridas +
    '<div style="display:flex;gap:8px;margin-top:12px;align-items:flex-end"><textarea id="asiInput" rows="2" maxlength="2000" placeholder="Por ejemplo: ¿qué equipos tienen el PM vencido?" style="flex:1;font-size:13px;resize:vertical"' + (a.ocupado ? ' disabled' : '') + ' onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();asistenteEnviar()}"></textarea>' +
    '<button class="btn" id="asiBtn" onclick="asistenteEnviar()"' + (a.ocupado ? ' disabled' : '') + '>Preguntar</button></div></div>';
  const chat = $('asiChat'); if (chat) chat.scrollTop = chat.scrollHeight;
  const nuevo = $('asiInput'); if (nuevo && escrito) nuevo.value = escrito; if (nuevo && conFoco && !a.ocupado) nuevo.focus();
}

export function asistenteNueva() { window._asistente = { api: [], vista: [], ocupado: false, error: '' }; renderAsistente(); }
export function asistenteSugerida(i) { const q = _ASI_SUGERIDAS[i]; if (q) asistentePreguntar(q); }
export function asistenteEnviar() { const t = $('asiInput'); if (t && t.value.trim()) asistentePreguntar(t.value.trim()); }

// Una pregunta completa: llama a la función, ejecuta aquí las herramientas que Claude pida (hasta _ASI_RONDAS_MAX veces) y muestra la respuesta final.
export async function asistentePreguntar(texto) {
  const a = window._asistente;
  if (a.ocupado) return;
  a.error = ''; a.ocupado = true;
  const api = a.api.slice();                       // si algo falla a medio camino, la conversación guardada queda como estaba
  api.push({ role: 'user', content: texto });
  a.vista.push({ rol: 'user', texto });
  renderAsistente();
  const usadas = [];
  try {
    for (let ronda = 0; ronda <= _ASI_RONDAS_MAX; ronda++) {
      const r = await _llamarFuncion('asistente-ia', { messages: api });
      if (!r || r.error || !r.content) throw new Error((r && r.error) || 'El asistente no respondió.');
      api.push({ role: 'assistant', content: r.content });
      if (r.stop_reason === 'tool_use') {
        if (ronda === _ASI_RONDAS_MAX) throw new Error('El asistente necesitó demasiadas consultas para esta pregunta. Intenta una pregunta más concreta.');
        const datos = _asiDatos(), hoy = new Date().toISOString().slice(0, 10);
        const resultados = r.content.filter(b => b.type === 'tool_use').map(b => {
          usadas.push(b.name);
          let salida;
          try { salida = asistenteEjecutar(b.name, b.input, datos, hoy); } catch (e) { salida = { error: 'La herramienta falló: ' + String(e && e.message || e).slice(0, 120) }; }
          return { type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(salida), ...(salida && salida.error ? { is_error: true } : {}) };
        });
        api.push({ role: 'user', content: resultados });
        continue;
      }
      const respuesta = r.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      if (r.stop_reason === 'refusal') throw new Error('El asistente no pudo responder a esa pregunta.');
      a.vista.push({ rol: 'asistente', texto: (respuesta || 'No tengo una respuesta para eso.') + (r.stop_reason === 'max_tokens' ? '\n\n(La respuesta quedó cortada: pide el detalle por partes.)' : ''), datos: usadas });
      a.api = api;
      break;
    }
  } catch (e) {
    a.error = String(e && e.message || e);
  } finally {
    a.ocupado = false;
    renderAsistente();
  }
}

// Puente window/renders — ver nota en mov.js (primera tanda).
window.renderAsistente = renderAsistente;
window.asistenteNueva = asistenteNueva;
window.asistenteSugerida = asistenteSugerida;
window.asistenteEnviar = asistenteEnviar;
window.asistentePreguntar = asistentePreguntar;
window.asistenteTextoAHtml = asistenteTextoAHtml;
renders.asistente = renderAsistente;
