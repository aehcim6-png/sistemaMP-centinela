// Pestaña Metas & KPIs (contenedor con 6 sub-pestañas, primero las de uso diario y al final los informes: Metas / Avance del
// Mes / Preguntas del gerente / Informes KPI / Informe de gestión / Resumen Ejecutivo; Tareas pasó a ser pestaña propia el 2026-10-29) — extraída a su propio archivo
// (Fase 2 de modularización). Módulo ES real (Fase 3, 2026-08-30, cuarta
// tanda: Metas, KPIs y Reportes) — ver nota de migración en mov.js (primera
// tanda, mismo patrón). Solo despacha a renders.metas/avance/kpi/resumen vía
// el registro 'renders' (búsqueda en tiempo de ejecución, no import).
export async function renderMkpi() {
  const sub = window._mkpiSub || 'metas';
  $('s-mkpi').innerHTML = `
    <div class="sec-h"><div><div class="sec-t"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="4.5"/><circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none"/></svg> Metas & KPIs</div>
      <div class="sec-s">Indicadores de gestión y cumplimiento</div></div></div>
    <div class="subtabs" role="tablist">
      <button class="subtab ${sub === 'metas' ? 'on' : ''}" role="tab" onclick="mkpiSub('metas')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="4.5"/><circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none"/></svg> Metas</button>
      <button class="subtab ${sub === 'avance' ? 'on' : ''}" role="tab" onclick="mkpiSub('avance')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,15 8,10 11,13 17,4"/><polyline points="12,4 17,4 17,9"/></svg> Avance del Mes</button>
      <button class="subtab ${sub === 'ger' ? 'on' : ''}" role="tab" onclick="mkpiSub('ger')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h12v9H9l-4 3.5V13H4z"/><line x1="10" y1="7" x2="10" y2="9"/><line x1="10" y1="10.8" x2="10" y2="10.9"/></svg> Preguntas del gerente</button>
      <button class="subtab ${sub === 'kpi' ? 'on' : ''}" role="tab" onclick="mkpiSub('kpi')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Informes KPI</button>
      <button class="subtab ${sub === 'gestion' ? 'on' : ''}" role="tab" onclick="mkpiSub('gestion')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="3.5" width="11" height="14" rx="1.5"/><line x1="7.5" y1="8" x2="12.5" y2="8"/><line x1="7.5" y1="11" x2="12.5" y2="11"/><line x1="7.5" y1="14" x2="10.5" y2="14"/></svg> Informe de gestión</button>
      <button class="subtab ${sub === 'resumen' ? 'on' : ''}" role="tab" onclick="mkpiSub('resumen')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17V9l4-4 3 3 4-5 3 3v11z"/></svg> Resumen Ejecutivo</button>
    </div>
    <div id="s-metas" class="${sub === 'metas' ? '' : 'hidden'}"></div>
    <div id="s-avance" class="${sub === 'avance' ? '' : 'hidden'}"></div>
    <div id="s-kpi" class="${sub === 'kpi' ? '' : 'hidden'}"></div>
    <div id="s-resumen" class="${sub === 'resumen' ? '' : 'hidden'}"></div>
    <div id="s-gestion" class="${sub === 'gestion' ? '' : 'hidden'}"></div>
    <div id="s-ger" class="${sub === 'ger' ? '' : 'hidden'}"></div>
  `;
  // Carga perezosa (2026-09-10) — solo avance/kpi son de las 32 sin
  // dependencias cruzadas; metas/resumen siguen estáticas (ver _LAZY_VERS
  // en index.html), _cargarModuloLazy no se llama para esas.
  if (typeof _LAZY_VERS !== 'undefined' && _LAZY_VERS[sub]) await _cargarModuloLazy(sub);
  if (sub === 'metas') renders.metas();
  else if (sub === 'avance') renders.avance();
  else if (sub === 'kpi') renders.kpi();
  else if (sub === 'resumen') renders.resumen();
  else if (sub === 'gestion') renders.gestion();
  else if (sub === 'ger') renders.ger();
  setTimeout(() => aplicarOrdenUniversal('s-mkpi'), 60);
}
export function mkpiSub(s) { window._mkpiSub = s; if (typeof _logUsoPestana === 'function') _logUsoPestana('mkpi.' + s); renders.mkpi(); }

// Puente window/renders — ver nota en mov.js (primera tanda).
window.renderMkpi = renderMkpi;
window.mkpiSub = mkpiSub;
renders.mkpi = renderMkpi;
