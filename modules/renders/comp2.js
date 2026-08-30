// Pestaña Componentes (contenedor con 7 sub-pestañas: Componentes Mayores /
// Predictivo / Destrabe / Informes de Falla / Tren de Rodaje / Historial de
// Componentes / Estadística) — extraída a su propio archivo (Fase 2 de
// modularización). Módulo ES real (Fase 3, 2026-08-30, tercera tanda:
// Componentes/Costos) — ver nota de migración en mov.js (primera tanda,
// mismo patrón). Solo despacha a renders.comp/pred/destrabe/informes/cad
// vía el registro 'renders' (búsqueda en tiempo de ejecución, no import).
export function renderComp2() {
  const sub = window._comp2Sub || 'comp';
  $('s-comp2').innerHTML = `
    <div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><polygon points="10,2.5 16,6 16,13 10,16.5 4,13 4,6"/><circle cx="10" cy="9.5" r="2.3"/></svg> Componentes</div>
      <div class="sec-s">Componentes mayores, análisis predictivo y gestión de destrabe</div></div></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn ${sub === 'comp' ? '' : 'btn-o'}" onclick="comp2Sub('comp')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><polygon points="10,2.5 16,6 16,13 10,16.5 4,13 4,6"/><circle cx="10" cy="9.5" r="2.3"/></svg> Componentes Mayores</button>
      <button class="btn ${sub === 'pred' ? '' : 'btn-o'}" onclick="comp2Sub('pred')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,15 8,10 11,13 17,4"/><polyline points="12,4 17,4 17,9"/></svg> Predictivo</button>
      <button class="btn ${sub === 'destrabe' ? '' : 'btn-o'}" onclick="comp2Sub('destrabe')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="9" width="10" height="8" rx="1"/><path d="M7 9 V6 a3 3 0 0 1 6 0" fill="none"/></svg> Destrabe</button>
      <button class="btn ${sub === 'informes' ? '' : 'btn-o'}" onclick="comp2Sub('informes')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="5,2 12,2 15,5 15,18 5,18"/><polyline points="12,2 12,5 15,5"/><line x1="7" y1="10" x2="13" y2="10"/><line x1="7" y1="13" x2="13" y2="13"/></svg> Informes de Falla</button>
      <button class="btn ${sub === 'cad' ? '' : 'btn-o'}" onclick="comp2Sub('cad')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M8 12 L6 14 a3 3 0 0 1 -4 -4 L4 8 a3 3 0 0 1 4 -4 L10 6" fill="none"/><path d="M12 8 L14 6 a3 3 0 0 1 4 4 L16 12 a3 3 0 0 1 -4 4 L10 14" fill="none"/></svg> Tren de Rodaje</button>
      <button class="btn ${sub === 'histcomp' ? '' : 'btn-o'}" onclick="comp2Sub('histcomp')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5.5 V10 l3 2" fill="none"/><circle cx="10" cy="10" r="7.5"/></svg> Historial de Componentes</button>
      <button class="btn ${sub === 'estadistica' ? '' : 'btn-o'}" onclick="comp2Sub('estadistica')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="12" width="3" height="5"/><rect x="8.5" y="8" width="3" height="9"/><rect x="14" y="4" width="3" height="13"/></svg> Estadística</button>
    </div>
    <div id="s-comp" class="${sub === 'comp' ? '' : 'hidden'}"></div>
    <div id="s-pred" class="${sub === 'pred' ? '' : 'hidden'}"></div>
    <div id="s-destrabe" class="${sub === 'destrabe' ? '' : 'hidden'}"></div>
    <div id="s-informes" class="${sub === 'informes' ? '' : 'hidden'}"></div>
    <div id="s-cad" class="${sub === 'cad' ? '' : 'hidden'}"></div>
    <div id="s-histcomp" class="${sub === 'histcomp' ? '' : 'hidden'}"></div>
    <div id="s-estadistica" class="${sub === 'estadistica' ? '' : 'hidden'}"></div>
  `;
  if (sub === 'comp') renders.comp();
  else if (sub === 'pred') renders.pred();
  else if (sub === 'destrabe') renders.destrabe();
  else if (sub === 'informes') renders.informes();
  else if (sub === 'cad') renders.cad();
  else if (sub === 'histcomp') renders.histcomp();
  else if (sub === 'estadistica') renders.estadistica();
  setTimeout(() => aplicarOrdenUniversal('s-comp2'), 60);
}
export function comp2Sub(s) { window._comp2Sub = s; if (typeof _logUsoPestana === 'function') _logUsoPestana('comp2.' + s); renders.comp2(); }

// Puente window/renders — ver nota en mov.js (primera tanda).
window.renderComp2 = renderComp2;
window.comp2Sub = comp2Sub;
renders.comp2 = renderComp2;
