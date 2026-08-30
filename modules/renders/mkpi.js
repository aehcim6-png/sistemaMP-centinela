// Pestaña Metas & KPIs (contenedor con 3 sub-pestañas: Metas / Avance del
// Mes / Informes KPI) — extraída a su propio archivo (Fase 2 de
// modularización). Módulo ES real (Fase 3, 2026-08-30, cuarta tanda: Metas,
// KPIs y Reportes) — ver nota de migración en mov.js (primera tanda, mismo
// patrón). Solo despacha a renders.metas/avance/kpi vía el registro
// 'renders' (búsqueda en tiempo de ejecución, no import).
export function renderMkpi() {
  const sub = window._mkpiSub || 'metas';
  $('s-mkpi').innerHTML = `
    <div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="4.5"/><circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none"/></svg> Metas & KPIs</div>
      <div class="sec-s">Indicadores de gestión y cumplimiento</div></div></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn ${sub === 'metas' ? '' : 'btn-o'}" onclick="mkpiSub('metas')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="4.5"/><circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none"/></svg> Metas</button>
      <button class="btn ${sub === 'avance' ? '' : 'btn-o'}" onclick="mkpiSub('avance')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,15 8,10 11,13 17,4"/><polyline points="12,4 17,4 17,9"/></svg> Avance del Mes</button>
      <button class="btn ${sub === 'kpi' ? '' : 'btn-o'}" onclick="mkpiSub('kpi')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Informes KPI</button>
    </div>
    <div id="s-metas" class="${sub === 'metas' ? '' : 'hidden'}"></div>
    <div id="s-avance" class="${sub === 'avance' ? '' : 'hidden'}"></div>
    <div id="s-kpi" class="${sub === 'kpi' ? '' : 'hidden'}"></div>
  `;
  if (sub === 'metas') renders.metas();
  else if (sub === 'avance') renders.avance();
  else if (sub === 'kpi') renders.kpi();
  setTimeout(() => aplicarOrdenUniversal('s-mkpi'), 60);
}
export function mkpiSub(s) { window._mkpiSub = s; if (typeof _logUsoPestana === 'function') _logUsoPestana('mkpi.' + s); renders.mkpi(); }

// Puente window/renders — ver nota en mov.js (primera tanda).
window.renderMkpi = renderMkpi;
window.mkpiSub = mkpiSub;
renders.mkpi = renderMkpi;
