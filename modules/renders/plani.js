// Pestaña Planificación y Agenda (contenedor con 5 sub-pestañas: Plan
// Semanal/Programa Anual/Carta Gantt/Planificador/Programación Diaria) —
// extraída a su propio archivo (Fase 2 de modularización). Script plano (NO
// módulo ES), mismo scope global de siempre. Solo despacha a
// renders.sem/prg/gantt/plan/progdia.
window.renderPlani=function(){
  const sub=window._planiSub||'sem';
  $('s-plani').innerHTML=`
    <div class="sec-h"><div><div class="sec-t">🗓️ Planificación y Agenda</div>
      <div class="sec-s">Programación de mantenciones en el tiempo</div></div></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn ${sub==='sem'?'':'btn-o'}" onclick="planiSub('sem')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Plan Semanal</button>
      <button class="btn ${sub==='prg'?'':'btn-o'}" onclick="planiSub('prg')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Programa Anual</button>
      <button class="btn ${sub==='gantt'?'':'btn-o'}" onclick="planiSub('gantt')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Carta Gantt</button>
      <button class="btn ${sub==='plan'?'':'btn-o'}" onclick="planiSub('plan')">🧮 Planificador</button>
      <button class="btn ${sub==='progdia'?'':'btn-o'}" onclick="planiSub('progdia')"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11 A6 6 0 0 1 16 11" fill="none"/><line x1="2" y1="11" x2="18" y2="11"/><line x1="10" y1="5" x2="10" y2="3"/></svg> Programación Diaria</button>
    </div>
    <div id="s-sem" class="${sub==='sem'?'':'hidden'}"></div>
    <div id="s-prg" class="${sub==='prg'?'':'hidden'}"></div>
    <div id="s-gantt" class="${sub==='gantt'?'':'hidden'}"></div>
    <div id="s-plan" class="${sub==='plan'?'':'hidden'}"></div>
    <div id="s-progdia" class="${sub==='progdia'?'':'hidden'}"></div>
  `;
  if(sub==='sem')renders.sem();
  else if(sub==='prg')renders.prg();
  else if(sub==='gantt')renders.gantt();
  else if(sub==='plan')renders.plan();
  else if(sub==='progdia')renders.progdia();
  setTimeout(()=>aplicarOrdenUniversal('s-plani'),60);
};
window.planiSub=function(s){window._planiSub=s;if(typeof _logUsoPestana==='function')_logUsoPestana('plani.'+s);renders.plani();};
