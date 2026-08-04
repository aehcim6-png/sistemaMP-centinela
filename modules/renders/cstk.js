// Pestaña Costos & Stock (contenedor con sub-pestañas: Costos / Consumos /
// Repuestos) — extraída a su propio archivo (Fase 2 de modularización).
// Script plano (NO módulo ES), mismo scope global de siempre. Solo despacha
// a renders.cos/mov/rep, que siguen viviendo en index.html por ahora.
window.renderCstk = function () {
  const sub = window._cstkSub || 'cos';
  $('s-cstk').innerHTML = `
    <div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="8"/><text x="10" y="14" font-size="9" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">$</text></svg> Costos & Stock</div>
      <div class="sec-s">Gestión financiera y de materiales</div></div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn ${sub === 'cos' ? '' : 'btn-o'}" onclick="cstkSub('cos')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="8"/><text x="10" y="14" font-size="9" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">$</text></svg> Costos</button>
      <button class="btn ${sub === 'mov' ? '' : 'btn-o'}" onclick="cstkSub('mov')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Consumos</button>
      <button class="btn ${sub === 'rep' ? '' : 'btn-o'}" onclick="cstkSub('rep')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="10,2 17,6 10,10 3,6"/><line x1="3" y1="6" x2="3" y2="13"/><line x1="17" y1="6" x2="17" y2="13"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="3" y1="13" x2="10" y2="18"/><line x1="17" y1="13" x2="10" y2="18"/></svg> Repuestos</button>
    </div>
    <div id="s-cos" class="${sub === 'cos' ? '' : 'hidden'}"></div>
    <div id="s-mov" class="${sub === 'mov' ? '' : 'hidden'}"></div>
    <div id="s-rep" class="${sub === 'rep' ? '' : 'hidden'}"></div>
  `;
  // Renderizar la sub-vista activa
  if (sub === 'cos') renders.cos();
  else if (sub === 'mov') renders.mov();
  else if (sub === 'rep') renders.rep();
  setTimeout(() => aplicarOrdenUniversal('s-cstk'), 60);
};
window.cstkSub = function (s) { window._cstkSub = s; renders.cstk(); };
