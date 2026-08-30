// Pestaña Stock & Insumos (contenedor con 5 sub-pestañas directas: Stock
// Filtros / Lubricantes / Costos / Consumos / Repuestos) — extraída a su
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
export function renderStk2() {
  const sub = window._stk2Sub || 'stk';
  $('s-stk2').innerHTML = `
    <div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="10,2 17,6 10,10 3,6"/><line x1="3" y1="6" x2="3" y2="13"/><line x1="17" y1="6" x2="17" y2="13"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="3" y1="13" x2="10" y2="18"/><line x1="17" y1="13" x2="10" y2="18"/></svg> Stock & Insumos</div>
      <div class="sec-s">Filtros, lubricantes, costos, consumos y repuestos</div></div></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn ${sub === 'stk' ? '' : 'btn-o'}" onclick="stk2Sub('stk')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="10,2 17,6 10,10 3,6"/><line x1="3" y1="6" x2="3" y2="13"/><line x1="17" y1="6" x2="17" y2="13"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="3" y1="13" x2="10" y2="18"/><line x1="17" y1="13" x2="10" y2="18"/></svg> Stock Filtros</button>
      <button class="btn ${sub === 'lub' ? '' : 'btn-o'}" onclick="stk2Sub('lub')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="5" y="3" width="10" height="14" rx="2"/><line x1="5" y1="7" x2="15" y2="7"/><line x1="5" y1="13" x2="15" y2="13"/></svg>️ Lubricantes</button>
      <button class="btn ${sub === 'cos' ? '' : 'btn-o'}" onclick="stk2Sub('cos')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="8"/><text x="10" y="14" font-size="9" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">$</text></svg> Costos</button>
      <button class="btn ${sub === 'mov' ? '' : 'btn-o'}" onclick="stk2Sub('mov')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Consumos</button>
      <button class="btn ${sub === 'rep' ? '' : 'btn-o'}" onclick="stk2Sub('rep')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="10,2 17,6 10,10 3,6"/><line x1="3" y1="6" x2="3" y2="13"/><line x1="17" y1="6" x2="17" y2="13"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="3" y1="13" x2="10" y2="18"/><line x1="17" y1="13" x2="10" y2="18"/></svg> Repuestos</button>
    </div>
    <div id="s-stk" class="${sub === 'stk' ? '' : 'hidden'}"></div>
    <div id="s-lub" class="${sub === 'lub' ? '' : 'hidden'}"></div>
    <div id="s-cos" class="${sub === 'cos' ? '' : 'hidden'}"></div>
    <div id="s-mov" class="${sub === 'mov' ? '' : 'hidden'}"></div>
    <div id="s-rep" class="${sub === 'rep' ? '' : 'hidden'}"></div>
  `;
  if (sub === 'stk') renders.stk();
  else if (sub === 'lub') renders.lub();
  else if (sub === 'cos') renders.cos();
  else if (sub === 'mov') renders.mov();
  else if (sub === 'rep') renders.rep();
  setTimeout(() => aplicarOrdenUniversal('s-stk2'), 60);
}
export function stk2Sub(s) { window._stk2Sub = s; if (typeof _logUsoPestana === 'function') _logUsoPestana('stk2.' + s); renders.stk2(); }

// Puente window/renders — ver nota en mov.js (mismo grupo de migración).
window.renderStk2 = renderStk2;
window.stk2Sub = stk2Sub;
renders.stk2 = renderStk2;
