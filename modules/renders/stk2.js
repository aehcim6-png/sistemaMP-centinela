// Pestaña Stock & Insumos (contenedor con sub-pestañas: Stock Filtros /
// Lubricantes / Costos & Stock) — extraída a su propio archivo (Fase 2 de
// modularización). Script plano (NO módulo ES), mismo scope global de
// siempre. Solo despacha a renders.stk/lub/cstk, que siguen viviendo en
// index.html por ahora — se extraen por separado en otra sesión.
window.renderStk2 = function () {
  const sub = window._stk2Sub || 'stk';
  $('s-stk2').innerHTML = `
    <div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="10,2 17,6 10,10 3,6"/><line x1="3" y1="6" x2="3" y2="13"/><line x1="17" y1="6" x2="17" y2="13"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="3" y1="13" x2="10" y2="18"/><line x1="17" y1="13" x2="10" y2="18"/></svg> Stock & Insumos</div>
      <div class="sec-s">Filtros, lubricantes y costos de materiales</div></div></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn ${sub === 'stk' ? '' : 'btn-o'}" onclick="stk2Sub('stk')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="10,2 17,6 10,10 3,6"/><line x1="3" y1="6" x2="3" y2="13"/><line x1="17" y1="6" x2="17" y2="13"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="3" y1="13" x2="10" y2="18"/><line x1="17" y1="13" x2="10" y2="18"/></svg> Stock Filtros</button>
      <button class="btn ${sub === 'lub' ? '' : 'btn-o'}" onclick="stk2Sub('lub')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="5" y="3" width="10" height="14" rx="2"/><line x1="5" y1="7" x2="15" y2="7"/><line x1="5" y1="13" x2="15" y2="13"/></svg>️ Lubricantes</button>
      <button class="btn ${sub === 'cstk' ? '' : 'btn-o'}" onclick="stk2Sub('cstk')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="8"/><text x="10" y="14" font-size="9" text-anchor="middle" fill="currentColor" stroke="none" font-family="sans-serif">$</text></svg> Costos & Stock</button>
    </div>
    <div id="s-stk" class="${sub === 'stk' ? '' : 'hidden'}"></div>
    <div id="s-lub" class="${sub === 'lub' ? '' : 'hidden'}"></div>
    <div id="s-cstk" class="${sub === 'cstk' ? '' : 'hidden'}"></div>
  `;
  if (sub === 'stk') renders.stk();
  else if (sub === 'lub') renders.lub();
  else if (sub === 'cstk') renders.cstk();
  setTimeout(() => aplicarOrdenUniversal('s-stk2'), 60);
};
window.stk2Sub = function (s) { window._stk2Sub = s; renders.stk2(); };
