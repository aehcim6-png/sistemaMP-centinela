// Pestaña Planificador de Materiales y Costos (sub-pestaña de Planificación
// y Agenda) — extraída a su propio archivo (Fase 2 de modularización).
// Módulo ES real (Fase 3, 2026-08-30, segunda tanda: Planificación y
// Agenda) — ver nota de migración en mov.js (primera tanda, mismo patrón).
// GRUPO_PAUTAS/lubVigente/precioMaterial/computePred/_cadenaPMEnHorizonte/
// diagVinculos quedan en index.html — infraestructura compartida con
// Predictivo, Plan Semanal y otras pestañas.
export function renderPlan(){
  const eq=S.g('eq')||[];
  const pau=S.g('pau')||INIT.pautas||[];
  const lub=S.g('lub')||[];
  const stk=S.g('stk')||[];
  const cfg=S.g('cfg')||{};
  const vista=window._planVista||'equipo';   // equipo | periodo | material
  const periodo=window._planPeriodo||'mes';   // semana | mes | semestre | anio
  const fn2=v=>fn(Math.round(v||0));

  // Días del periodo (rolling) o ventana de mes calendario específico
  const hoy=new Date();
  let ventInicio=null,limite;
  if(periodo==='calendario'){
    const mesCal=(window._planMesCal!=null?window._planMesCal:hoy.getMonth()+1);
    const anioCal=(window._planAnioCal!=null?window._planAnioCal:hoy.getFullYear());
    ventInicio=new Date(anioCal,mesCal-1,1);
    limite=new Date(anioCal,mesCal,0,23,59,59);
  } else {
    const diasP={semana:7,mes:30,semestre:180,anio:365}[periodo];
    limite=new Date(hoy.getTime()+diasP*86400000);
  }

  // pmH: qué PM incluye cada nivel
  const pmH={'PM1':['PM1'],'PM2':['PM1','PM2'],'PM3':['PM1','PM2','PM3'],'PM4':['PM1','PM2','PM3','PM4'],'PM5':['PM1','PM2','PM3','PM4'],'PM6':['PM1','PM2','PM3','PM4'],'PM7':['PM1','PM2','PM3','PM4'],'PM8':['PM1','PM2','PM3','PM4'],'PM9':['PM1','PM2','PM3','PM4']};
  const GRUPO=(typeof GRUPO_PAUTAS!=='undefined')?GRUPO_PAUTAS:{};

  // Clasificar material por nombre del repuesto
  function clasificar(rep){
    const r=(rep||'').toLowerCase();
    if(r.includes('filtro')||r.includes('filter'))return 'Filtro';
    if(r.includes('grease')||r.includes('grasa')||r.includes('mobilgrease'))return 'Grasa';
    if(r.includes('aceite')||r.includes('mobiltrans')||r.includes('delvac')||r.includes('oil')||r.includes('15w40')||r.includes('50w'))return 'Aceite';
    return 'Otro';
  }
  // Precio de un repuesto (busca en stock filtros o lubricantes)
  // Matching robusto por tokens significativos (marca/tipo/viscosidad),
  // tolera diferencias de orden, códigos de parte, unidades "208 L" y mayúsculas.
  // Precio de un material: usa la fuente única de verdad (window.precioMaterial)
  function precioRep(rep){return window.precioMaterial(rep,lub,stk);}

  // Materiales de un equipo para un tipo de PM dado (no siempre el próximo: en un
  // semestre el mismo equipo pasa por PM1, PM2, PM4… y cada uno pide lo suyo).
  function materialesEquipo(e,tipoPM){
    const siglaRef=GRUPO[e.sigla]||e.sigla;
    const pmList=pmH[tipoPM]||[tipoPM];
    const pautas=pau.filter(p=>{
      const pRef=GRUPO[p.sigla]||p.sigla;
      return (p.sigla===siglaRef||pRef===siglaRef)&&pmList.includes(p.pm)&&p.rep&&p.can>0;
    });
    const mats={};
    pautas.forEach(p=>{
      const tipo=clasificar(p.rep);
      // Un lubricante descontinuado se acumula bajo el producto vigente que lo
      // reemplaza — si no, la demanda queda partida entre los dos nombres y
      // ninguna de las dos cifras sirve para pedir.
      const vig=lubVigente(p.rep);
      const rep=(vig!==String(p.rep||'').toUpperCase().replace(/\s+/g,' ').trim())?vig:p.rep;
      const key=rep;
      if(!mats[key])mats[key]={rep,tipo,cantidad:0,precio:precioRep(rep),pm:p.pm};
      mats[key].cantidad+=p.can;
    });
    return Object.values(mats);
  }

  // Cada PM que cae en el periodo, no cada EQUIPO. Antes se filtraba por
  // fechaProxPM, o sea el PRÓXIMO PM de cada equipo y nada más: en un mes un
  // camión a 16 h/día alcanza a hacer 2 PM, y en un semestre ~12 — el pedido de
  // materiales quedaba corto por un múltiplo. Se usa la misma cadena de hitos
  // del Plan Semanal y del Predictivo, así los tres piden para el mismo
  // calendario. Cada hito trae SU tipo de PM según el horómetro donde cae.
  const horizDias=Math.ceil((limite-hoy)/86400000);
  const _iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const isoIni=ventInicio?_iso(ventInicio):null;
  const isoFin=_iso(limite),isoHoy=_iso(hoy);
  const pmsEnPeriodo=[];
  eq.forEach(e=>{
    _cadenaPMEnHorizonte(e,horizDias).forEach(h=>{
      if(isoIni&&h.fecha<isoIni)return;
      if(h.fecha<isoHoy)return;   // lo ya vivido lo aportan las PM ejecutadas
      pmsEnPeriodo.push({e:e,sigla:e.sigla,tipoPM:h.tipoPM,fecha:h.fecha,dias:h.dias});
    });
  });
  // PM YA EJECUTADAS dentro de la ventana. El consumo de mantención se carga
  // desde lo que indica la pauta de cada PM realizado — NO desde las órdenes de
  // compra: una compra no necesariamente va a la máquina que consume el
  // material (puede entrar a bodega para la flota), así que atribuirla por
  // equipo sería inventar. Así, un periodo pasado muestra lo que efectivamente
  // se consumió en mantención, y uno futuro lo proyectado; un periodo a caballo
  // (el mes en curso) muestra ambos, cada PM en su fecha.
  (S.g('reg')||[]).forEach(r=>{
    const f=r.fechaEjec||r.fechaSalida||r.fechaEntrada||'';
    if(!f||f>isoFin||f>isoHoy)return;
    if(isoIni&&f<isoIni)return;
    if(!isoIni&&f<isoHoy)return;   // periodos rolling miran hacia adelante
    const e=eq.find(x=>x.sigla===r.equipo);
    if(!e)return;
    pmsEnPeriodo.push({e:e,sigla:r.equipo,tipoPM:r.tipoPM||e.tipoPM,fecha:f,
      dias:Math.round((new Date(f+'T00:00:00')-hoy)/86400000),ejecutado:true});
  });
  pmsEnPeriodo.sort((a,b)=>a.fecha<b.fecha?-1:a.fecha>b.fecha?1:0);

  // Botones de vista y periodo
  const btnVista=['equipo','periodo','material'].map(v=>`<button class="btn ${vista===v?'':'btn-o'}" onclick="planVista('${v}')">${v==='equipo'?'<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="4" width="6" height="6"/><line x1="9" y1="10" x2="4" y2="10"/><line x1="4" y1="10" x2="4" y2="13"/><circle cx="5.5" cy="15" r="2.5"/><circle cx="14" cy="15" r="3.5"/><line x1="15" y1="10" x2="15" y2="4"/></svg> Por Equipo':v==='periodo'?'<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Por Periodo':'<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="10,2 17,6 10,10 3,6"/><line x1="3" y1="6" x2="3" y2="13"/><line x1="17" y1="6" x2="17" y2="13"/><line x1="10" y1="10" x2="10" y2="18"/><line x1="3" y1="13" x2="10" y2="18"/><line x1="17" y1="13" x2="10" y2="18"/></svg> Por Material'}</button>`).join(' ');
  const btnPer=[['semana','Semana'],['mes','Mes'],['semestre','Semestre'],['anio','Año']].map(([k,l])=>`<button class="btn ${periodo===k?'':'btn-o'}" onclick="planPeriodo('${k}')">${l}</button>`).join(' ')+
    ` <button class="btn ${periodo==='calendario'?'':'btn-o'}" onclick="planPeriodo('calendario')"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="14" height="13" rx="1.5"/><line x1="3" y1="8" x2="17" y2="8"/><line x1="6.5" y1="2.5" x2="6.5" y2="5.5"/><line x1="13.5" y1="2.5" x2="13.5" y2="5.5"/></svg> Mes específico</button>`+
    (periodo==='calendario'?
      ` <select id="planMesCalSel" onchange="planMesCal()" style="background:var(--bg3);border:1px solid var(--bd);color:var(--tx);border-radius:4px;padding:4px;font-size:11px">`+
      ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((m,i)=>`<option value="${i+1}" ${((window._planMesCal||(hoy.getMonth()+1))==(i+1))?'selected':''}>${m}</option>`).join('')+
      `</select> <select id="planAnioCalSel" onchange="planMesCal()" style="background:var(--bg3);border:1px solid var(--bd);color:var(--tx);border-radius:4px;padding:4px;font-size:11px">`+
      [hoy.getFullYear()-1,hoy.getFullYear(),hoy.getFullYear()+1].map(y=>`<option value="${y}" ${((window._planAnioCal||hoy.getFullYear())==y)?'selected':''}>${y}</option>`).join('')+
      `</select>`
    :'');

  // Un periodo YA VIVIDO no tiene PM que proyectar, así que la tabla salía
  // vacía sin explicar por qué (caso real: "Mes específico" en junio hacia
  // atrás). Lo consumido de verdad en esas fechas no se recalcula acá — ya vive
  // en "<svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="5,2 12,2 15,5 15,18 5,18"/><polyline points="12,2 12,5 15,5"/><line x1="7" y1="10" x2="13" y2="10"/><line x1="7" y1="13" x2="13" y2="13"/></svg> Histórico consumido", que lo lee de las órdenes de compra reales;
  // duplicarlo acá daría dos cifras para lo mismo. Se avisa y se deriva.
  const esPeriodoPasado=limite<hoy;
  let contenido='';
  // Totales generales
  let totFiltros=0,totAceite=0,totGrasa=0,totCosto=0;
  pmsEnPeriodo.forEach(x=>{
    materialesEquipo(x.e,x.tipoPM).forEach(m=>{
      if(m.tipo==='Filtro')totFiltros+=m.cantidad;
      else if(m.tipo==='Aceite')totAceite+=m.cantidad;
      else if(m.tipo==='Grasa')totGrasa+=m.cantidad;
      totCosto+=m.cantidad*m.precio;
    });
  });

  if(vista==='equipo'){
    contenido=pmsEnPeriodo.map(x=>{
      const e=x.e;
      const mats=materialesEquipo(e,x.tipoPM);
      const costoEq=mats.reduce((s,m)=>s+m.cantidad*m.precio,0);
      const dias=x.dias;
      return `<div style="background:var(--bg2);border:1px solid var(--bd);border-radius:8px;padding:12px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div><b style="font-size:14px">${escapeHtml(e.sigla)}</b> <span class="badge ${x.tipoPM==='PM4'?'b-r':x.tipoPM==='PM3'?'b-y':'b-g'}">${x.tipoPM}</span>
            <span style="font-size:11px;color:var(--tx3)"> · ${x.fecha} (${dias>0?'en '+dias+'d':'VENCIDA'})</span></div>
          <b style="color:var(--ac)">$${fn2(costoEq)}</b>
        </div>
        ${mats.length?`<table style="width:100%;font-size:11px">
          <tr style="background:var(--bg3)"><th style="padding:3px;text-align:left">Material</th><th>Tipo</th><th>Cant.</th><th>Precio U.</th><th>Subtotal</th></tr>
          ${mats.map(m=>`<tr style="border-bottom:1px solid var(--bd)">
            <td style="padding:3px">${escapeHtml(m.rep)}</td>
            <td style="text-align:center"><span class="badge ${m.tipo==='Filtro'?'b-y':m.tipo==='Aceite'?'b-g':'b-r'}">${escapeHtml(m.tipo)}</span></td>
            <td style="text-align:center">${m.cantidad}</td>
            <td style="text-align:right">${m.precio?'$'+fn2(m.precio):'—'}</td>
            <td style="text-align:right"><b>${m.precio?'$'+fn2(m.cantidad*m.precio):'—'}</b></td>
          </tr>`).join('')}
        </table>`:'<p style="font-size:11px;color:var(--tx3)">Sin pautas con repuestos para este PM</p>'}
      </div>`;
    }).join('')||'<p style="color:var(--tx3);text-align:center;padding:30px">No hay PM programadas en este periodo</p>';
  }

  else if(vista==='material'){
    // Agregar todos los materiales del periodo
    const matAgg={};
    pmsEnPeriodo.forEach(x=>{
      materialesEquipo(x.e,x.tipoPM).forEach(m=>{
        if(!matAgg[m.rep])matAgg[m.rep]={rep:m.rep,tipo:m.tipo,cantidad:0,precio:m.precio,equipos:[]};
        matAgg[m.rep].cantidad+=m.cantidad;
        if(!matAgg[m.rep].equipos.includes(x.sigla))matAgg[m.rep].equipos.push(x.sigla);
      });
    });
    const mats=Object.values(matAgg);
    const ordenTipo=['Aceite','Filtro','Grasa','Otro'];
    let granTotal=0,filasHtml='';
    ordenTipo.forEach(function(tipoG){
      const grupo=mats.filter(m=>m.tipo===tipoG).sort((a,b)=>b.cantidad*b.precio-a.cantidad*a.precio);
      if(!grupo.length)return;
      let subtotal=0;
      filasHtml+=grupo.map(m=>{
        const costo=m.cantidad*m.precio;subtotal+=costo;
        return `<tr style="border-bottom:1px solid var(--bd)">
        <td style="padding:6px">${escapeHtml(m.rep)}</td>
        <td style="text-align:center"><span class="badge ${m.tipo==='Filtro'?'b-y':m.tipo==='Aceite'?'b-g':'b-r'}">${escapeHtml(m.tipo)}</span></td>
        <td style="text-align:center"><b>${m.cantidad}</b></td>
        <td style="text-align:center" title="${m.equipos.map(escapeHtml).join(', ')}">${m.equipos.length} eq.</td>
        <td style="text-align:right">${m.precio?'$'+fn2(m.precio):'—'}</td>
        <td style="text-align:right"><b style="color:var(--ac)">${m.precio?'$'+fn2(costo):'—'}</b></td>
      </tr>`;
      }).join('');
      granTotal+=subtotal;
      filasHtml+=`<tr style="background:var(--bg3);font-weight:bold">
        <td colspan="5" style="padding:6px;text-align:right">Subtotal ${tipoG}</td>
        <td style="text-align:right;color:var(--ac)">$${fn2(subtotal)}</td>
      </tr>`;
    });
    contenido=`<table style="width:100%;font-size:11px">
      <tr style="background:var(--bg3)"><th style="padding:6px;text-align:left">Material</th><th>Tipo</th><th>Cant. total</th><th>Equipos</th><th>Precio U.</th><th>Costo total</th></tr>
      ${filasHtml||'<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--tx3)">Sin materiales en este periodo</td></tr>'}
      ${mats.length?`<tr style="background:var(--ac);color:#000">
        <td colspan="5" style="padding:8px;text-align:right;font-size:13px"><b>TOTAL GENERAL</b></td>
        <td style="text-align:right;font-size:13px"><b>$${fn2(granTotal)}</b></td>
      </tr>`:''}
    </table>`;
  }

  else { // periodo: resumen por tipo PM
    const porPM={};
    pmsEnPeriodo.forEach(x=>{
      if(!porPM[x.tipoPM])porPM[x.tipoPM]={pm:x.tipoPM,equipos:0,filtros:0,aceite:0,grasa:0,costo:0};
      const p=porPM[x.tipoPM];p.equipos++;
      materialesEquipo(x.e,x.tipoPM).forEach(m=>{
        if(m.tipo==='Filtro')p.filtros+=m.cantidad;
        else if(m.tipo==='Aceite')p.aceite+=m.cantidad;
        else if(m.tipo==='Grasa')p.grasa+=m.cantidad;
        p.costo+=m.cantidad*m.precio;
      });
    });
    const pms=Object.values(porPM).sort((a,b)=>a.pm.localeCompare(b.pm));
    contenido=`<table style="width:100%;font-size:12px">
      <tr style="background:var(--bg3)"><th style="padding:8px;text-align:left">Tipo PM</th><th>Equipos</th><th>Filtros</th><th>Aceite (L)</th><th>Grasa</th><th>Costo total</th></tr>
      ${pms.map(p=>`<tr style="border-bottom:1px solid var(--bd)">
        <td style="padding:8px"><span class="badge ${p.pm==='PM4'?'b-r':p.pm==='PM3'?'b-y':'b-g'}">${p.pm}</span></td>
        <td style="text-align:center">${p.equipos}</td>
        <td style="text-align:center">${p.filtros}</td>
        <td style="text-align:center">${fn2(p.aceite)}</td>
        <td style="text-align:center">${p.grasa}</td>
        <td style="text-align:right"><b style="color:var(--ac)">$${fn2(p.costo)}</b></td>
      </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--tx3)">Sin PM en este periodo</td></tr>'}
    </table>`;
  }

  // ═══ FLUJO DE CAJA DE MANTENCIÓN — 6 MESES ═══ (siempre fijo, independiente
  // del selector de vista/periodo de arriba — un resumen estable cada vez que
  // se abre esta pestaña). Junta dos proyecciones que hasta ahora vivían
  // separadas: los materiales de PM programado (lo que esta misma pestaña ya
  // calcula) y el costo de Componentes Mayores por vencer
  // (proyeccionCostoComponentesMayores, compartida con el "Calendario de
  // Reemplazos" de Componentes Mayores — mismo criterio, mismo número).
  const pmPorMesFC={};
  for(let _mFC=0;_mFC<6;_mFC++){
    const _dFC=new Date(hoy.getFullYear(),hoy.getMonth()+_mFC,1);
    pmPorMesFC[_dFC.getFullYear()+'-'+String(_dFC.getMonth()+1).padStart(2,'0')]=0;
  }
  eq.forEach(e=>{
    _cadenaPMEnHorizonte(e,183).forEach(h=>{
      if(h.fecha<isoHoy)return;
      const kFC=h.fecha.slice(0,7);
      if(!(kFC in pmPorMesFC))return;
      materialesEquipo(e,h.tipoPM).forEach(m=>{pmPorMesFC[kFC]+=m.cantidad*m.precio;});
    });
  });
  const compFC=(typeof proyeccionCostoComponentesMayores==='function')?proyeccionCostoComponentesMayores(6):{porMes:{},labels:{},vencido:0};
  const mesesFC=Object.keys(pmPorMesFC).sort();
  let totalFC=compFC.vencido||0;
  const flujoHtml=`<div class="chart-box" style="margin-bottom:16px"><div class="chart-t">💰 Flujo de Caja de Mantención — Próximos 6 Meses</div>
    <div style="font-size:11px;color:var(--tx3);margin-bottom:8px">Combina lo programado (PM: filtros/aceite/grasa según la pauta de cada equipo) con lo proyectado por desgaste (Componentes Mayores: motor, transmisión, etc. — mismo criterio que su Calendario de Reemplazos).</div>
    <div class="tbl-wrap"><table style="font-size:11px"><tr><th>Mes</th><th>Materiales PM</th><th>Componentes Mayores</th><th>Total</th></tr>
    ${mesesFC.map(k=>{
      const pmCosto=pmPorMesFC[k]||0,compCosto=compFC.porMes[k]||0,tot=pmCosto+compCosto;
      totalFC+=tot;
      return `<tr><td style="font-weight:700">${compFC.labels[k]||k}</td><td class="mono">$${fn2(pmCosto)}</td><td class="mono">$${fn2(compCosto)}</td><td class="mono" style="color:var(--ac);font-weight:700">$${fn2(tot)}</td></tr>`;
    }).join('')}
    ${compFC.vencido?`<tr style="background:rgba(239,68,68,.06)"><td style="font-weight:700">🔴 Componentes ya vencidos</td><td class="mono">—</td><td class="mono" style="color:var(--danger)">$${fn2(compFC.vencido)}</td><td class="mono" style="color:var(--danger);font-weight:700">$${fn2(compFC.vencido)}</td></tr>`:''}
    <tr style="background:var(--ac);color:#000"><td colspan="3" style="text-align:right;padding:8px"><b>TOTAL 6 MESES</b></td><td style="text-align:right;padding:8px"><b>$${fn2(totalFC)}</b></td></tr>
    </table></div></div>`;

  $('s-plan').innerHTML=`
    <div class="sec-h"><div><div class="sec-t">🗓️ Planificador de Materiales y Costos</div>
      <div class="sec-s">Proyección de filtros, aceite, lubricantes y costo · ${pmsEnPeriodo.length} PM en ${periodo==='calendario'?['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][(window._planMesCal||(hoy.getMonth()+1))-1]+' '+(window._planAnioCal||hoy.getFullYear()):periodo}</div></div>
      <button class="btn btn-o" onclick="planHistorico()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="5,2 12,2 15,5 15,18 5,18"/><polyline points="12,2 12,5 15,5"/><line x1="7" y1="10" x2="13" y2="10"/><line x1="7" y1="13" x2="13" y2="13"/></svg> Histórico consumido</button>
      <button class="btn" style="background:var(--warn,var(--warn));color:#000" onclick="diagVinculos()"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8.5" cy="8.5" r="5.5"/><line x1="12.7" y1="12.7" x2="17.5" y2="17.5"/></svg> Vínculos rotos</button>
    </div>
    ${flujoHtml}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">${btnVista}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px"><span style="font-size:11px;color:var(--tx3);align-self:center">Periodo:</span> ${btnPer}</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">
      <div style="background:var(--bg3);border-radius:8px;padding:12px;text-align:center"><div style="font-size:10px;color:var(--tx3)">PM programadas</div><b style="font-size:22px">${pmsEnPeriodo.length}</b></div>
      <div style="background:var(--bg3);border-radius:8px;padding:12px;text-align:center"><div style="font-size:10px;color:var(--tx3)">Filtros</div><b style="font-size:22px;color:var(--warn)">${totFiltros}</b></div>
      <div style="background:var(--bg3);border-radius:8px;padding:12px;text-align:center"><div style="font-size:10px;color:var(--tx3)">Aceite (L)</div><b style="font-size:22px;color:var(--ok)">${fn2(totAceite)}</b></div>
      <div style="background:var(--bg3);border-radius:8px;padding:12px;text-align:center"><div style="font-size:10px;color:var(--tx3)">Costo total</div><b style="font-size:16px;color:var(--ac)">$${fn2(totCosto)}</b></div>
    </div>
    ${esPeriodoPasado&&!pmsEnPeriodo.length?
      `<div class="card" style="border-left:3px solid var(--ac);padding:16px">
        <div style="font-weight:700;margin-bottom:6px">Sin PM ejecutadas en ese periodo</div>
        <div style="font-size:12px;color:var(--tx2);line-height:1.6">
          Para un periodo ya vivido, esta pestaña carga los materiales de las <b>PM efectivamente ejecutadas</b> según su pauta,
          y no hay ninguna registrada en esas fechas.<br>
          Si buscas lo <b>comprado</b> en ese periodo (que no siempre coincide: una orden de compra puede entrar a bodega
          para la flota y no para una máquina puntual), está en <b><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="5,2 12,2 15,5 15,18 5,18"/><polyline points="12,2 12,5 15,5"/><line x1="7" y1="10" x2="13" y2="10"/><line x1="7" y1="13" x2="13" y2="13"/></svg> Histórico consumido</b>.
        </div>
        <button class="btn" style="margin-top:10px" onclick="planHistorico()"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="5,2 12,2 15,5 15,18 5,18"/><polyline points="12,2 12,5 15,5"/><line x1="7" y1="10" x2="13" y2="10"/><line x1="7" y1="13" x2="13" y2="13"/></svg> Ver compras del periodo</button>
      </div>`
      :contenido}`;
}

export function planVista(v){window._planVista=v;renders.plan();}
export function planPeriodo(p){window._planPeriodo=p;renders.plan();}
export function planMesCal(){
  const m=$('planMesCalSel'),a=$('planAnioCalSel');
  if(m)window._planMesCal=parseInt(m.value);
  if(a)window._planAnioCal=parseInt(a.value);
  renders.plan();
}

export function planHistorico(){
  var fn2=v=>fn(Math.round(v||0));
  var PR=computePred();
  var ordenesCrudo=S.g('ocHist')||[];
  var mov=S.g('mov')||[];
  var lub=S.g('lub')||[];
  var stk=S.g('stk')||[];
  var eq=S.g('eq')||[];
  var usaOC=ordenesCrudo.length>0; // ocHist es la fuente real (siempre cargada desde Supabase); si por algo no llegó, cae a mov
  // Separa líneas con precio unitario muy fuera de lo normal para su propio
  // ítem (ver ordenesSinOutliers en logic.js) — no se borran, solo no entran
  // al cálculo mientras se confirma el valor real con el proveedor.
  var sepOC=ordenesSinOutliers(ordenesCrudo);
  var ordenes=sepOC.limpias;
  var outliersOC=sepOC.outliers;

  // Filtros activos (persisten entre re-renders del mismo modal)
  var f=window._histFiltro||{desde:'',hasta:'',tipo:'',equipo:''};
  window._histFiltro=f;

  function clasificar(item,tipoDato){
    if(tipoDato)return tipoDato; // ya viene clasificado en el dato real
    var r=(item||'').toLowerCase();
    if(r.includes('filtro'))return 'Filtro';
    if(r.includes('grease')||r.includes('grasa'))return 'Grasa';
    if(r.includes('aceite')||r.includes('mobiltrans')||r.includes('delvac')||r.includes('oil'))return 'Aceite';
    return 'Repuesto';
  }

  var fuente=usaOC?ordenes:mov;
  var filtrados=fuente.filter(function(m){
    var fecha=usaOC?m.fecha:m.fecha;
    var equipo=usaOC?m.sigla:m.equipo;
    var item=usaOC?m.detalle:m.item;
    var tipo=clasificar(item,m.tipo);
    if(f.desde&&fecha<f.desde)return false;
    if(f.hasta&&fecha>f.hasta)return false;
    if(f.tipo&&tipo!==f.tipo)return false;
    if(f.equipo&&equipo!==f.equipo)return false;
    return true;
  });

  // Agregar por material. Si es OC real, el costo ya viene calculado (más confiable);
  // si es mov, se calcula con el motor único de precios.
  var agg={};
  filtrados.forEach(function(m){
    var item=usaOC?m.detalle:m.item;
    var equipo=usaOC?m.sigla:m.equipo;
    var tipo=clasificar(item,m.tipo);
    var key=item||'(sin nombre)';
    if(!agg[key])agg[key]={item:key,tipo:tipo,cant:0,equipos:{},costo:0,sinPrecio:false};
    agg[key].cant+=(m.cant||0);
    agg[key].equipos[equipo]=true;
    if(usaOC){
      agg[key].costo+=(m.costo||0);
    }
  });
  var lista=Object.values(agg).map(function(a){
    if(!usaOC){
      var precio=window.precioMaterial?window.precioMaterial(a.item,lub,stk):0;
      a.costo=a.cant*precio;
      a.sinPrecio=precio<=0;
    }
    a.nEq=Object.keys(a.equipos).length;
    return a;
  }).sort(function(x,y){return y.costo-x.costo;});
  var totalCosto=lista.reduce(function(s,a){return s+a.costo;},0);
  var totalSinPrecio=lista.filter(function(a){return a.sinPrecio;}).length;

  var siglas=eq.map(function(e){return e.sigla;}).sort();
  var tipos=usaOC?['Filtro','Aceite','Grasa','Repuesto','Servicio','Neumático']:['Filtro','Aceite','Grasa','Repuesto'];
  var fMin=fuente.length?fuente.reduce((a,m)=>(usaOC?m.fecha:m.fecha)<a?(usaOC?m.fecha:m.fecha):a,'9999'):'—';
  var fMax=fuente.length?fuente.reduce((a,m)=>(usaOC?m.fecha:m.fecha)>a?(usaOC?m.fecha:m.fecha):a,''):'—';

  sm(`<div style="max-width:760px">
    <h3><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="5,2 12,2 15,5 15,18 5,18"/><polyline points="12,2 12,5 15,5"/><line x1="7" y1="10" x2="13" y2="10"/><line x1="7" y1="13" x2="13" y2="13"/></svg> Histórico de Consumo Real</h3>
    <p style="font-size:12px;color:var(--tx3)">Fuente: <b>${usaOC?'Órdenes de Compra reales':'Movimientos de bodega (mov)'}</b> · datos desde ${fMin} hasta ${fMax}${usaOC?'':' · carga el CSV de OC en Costos & Stock para datos más completos y actuales'}</p>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;padding:10px;background:var(--bg3);border-radius:8px">
      <div><label style="font-size:10px;color:var(--tx3);display:block">Desde</label><input type="date" id="histDesde" value="${f.desde}" style="font-size:11px"></div>
      <div><label style="font-size:10px;color:var(--tx3);display:block">Hasta</label><input type="date" id="histHasta" value="${f.hasta}" style="font-size:11px"></div>
      <div><label style="font-size:10px;color:var(--tx3);display:block">Tipo material</label><select id="histTipo" style="font-size:11px"><option value="">Todos</option>${tipos.map(t=>`<option ${f.tipo===t?'selected':''}>${t}</option>`).join('')}</select></div>
      <div><label style="font-size:10px;color:var(--tx3);display:block">Equipo</label><select id="histEquipo" style="font-size:11px"><option value="">Todos</option>${siglas.map(s=>`<option ${f.equipo===s?'selected':''}>${escapeHtml(s)}</option>`).join('')}</select></div>
      <div style="align-self:flex-end"><button class="btn-s" onclick="planHistoricoFiltrar()"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8.5" cy="8.5" r="5.5"/><line x1="12.7" y1="12.7" x2="17.5" y2="17.5"/></svg> Filtrar</button> <button class="btn-s btn-o" onclick="planHistoricoLimpiar()">✕ Limpiar</button></div>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:10px">
      <div style="flex:1;background:var(--bg3);border-radius:8px;padding:8px;text-align:center"><div style="font-size:10px;color:var(--tx3)">Movimientos</div><b style="font-size:18px">${filtrados.length}</b></div>
      <div style="flex:1;background:var(--bg3);border-radius:8px;padding:8px;text-align:center"><div style="font-size:10px;color:var(--tx3)">Materiales distintos</div><b style="font-size:18px">${lista.length}</b></div>
      <div style="flex:1;background:var(--bg3);border-radius:8px;padding:8px;text-align:center"><div style="font-size:10px;color:var(--tx3)">Costo total</div><b style="font-size:18px;color:var(--ac)">$${fn2(totalCosto)}</b></div>
    </div>
    ${totalSinPrecio?`<p style="font-size:11px;color:var(--warn)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> ${totalSinPrecio} material(es) sin precio encontrado — revisa "<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8.5" cy="8.5" r="5.5"/><line x1="12.7" y1="12.7" x2="17.5" y2="17.5"/></svg> Vínculos rotos" para esos.</p>`:''}
    ${usaOC&&outliersOC.length?`<p style="font-size:11px;color:var(--warn)"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,2.5 18,17 2,17"/><line x1="10" y1="8" x2="10" y2="12.5"/><circle cx="10" cy="15" r="0.6" fill="currentColor" stroke="none"/></svg> ${outliersOC.length} línea(s) de compra excluida(s) del cálculo — precio unitario muy fuera de lo normal para ese ítem (posible error de digitación), $${fn2(outliersOC.reduce(function(s,o){return s+(o.costo||0);},0))} no contados. No se borró el dato original, solo no se cuenta mientras se confirma con el proveedor.</p>`:''}

    <div style="max-height:320px;overflow:auto">
    <table style="width:100%;font-size:11px">
      <tr style="background:var(--bg3)"><th style="padding:6px;text-align:left">Material</th><th>Tipo</th><th>Cant.</th><th>Equipos</th><th>Costo</th></tr>
      ${lista.map(a=>`<tr style="border-bottom:1px solid var(--bd)">
        <td style="padding:6px">${escapeHtml(a.item)}</td>
        <td style="text-align:center"><span class="badge ${a.tipo==='Filtro'?'b-y':a.tipo==='Aceite'?'b-g':'b-r'}">${escapeHtml(a.tipo)}</span></td>
        <td style="text-align:center"><b>${fn2(a.cant)}</b></td>
        <td style="text-align:center">${a.nEq} eq.</td>
        <td style="text-align:right">${a.sinPrecio?'—':'$'+fn2(a.costo)}</td>
      </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--tx3)">Sin movimientos con estos filtros</td></tr>'}
    </table>
    </div>

    <details style="margin-top:14px;border-top:1px solid var(--bd);padding-top:10px">
      <summary style="cursor:pointer;font-size:12px;color:var(--tx3)"><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="16" x2="4" y2="10"/><line x1="10" y1="16" x2="10" y2="6"/><line x1="16" y1="16" x2="16" y2="12"/></svg> Ver panorama histórico completo (desde ${PR.resumen.totalPedidos?PR.resumen.rangoDesde:'—'})</summary>
      ${PR.resumen.totalPedidos?`
      <p style="font-size:11px;color:var(--tx3);margin-top:8px">Resumen agregado de órdenes de compra históricas — no es filtrable por tipo/equipo a este nivel, es el total general.</p>
      <div style="display:flex;gap:8px;margin:8px 0">
        <div style="flex:1;background:var(--bg3);border-radius:8px;padding:8px;text-align:center"><div style="font-size:10px;color:var(--tx3)">Pedidos totales</div><b>${fn(PR.resumen.totalPedidos)}</b></div>
        <div style="flex:1;background:var(--bg3);border-radius:8px;padding:8px;text-align:center"><div style="font-size:10px;color:var(--tx3)">Costo total histórico</div><b style="color:var(--ac)">$${fn2(PR.resumen.totalCosto)}</b></div>
        <div style="flex:1;background:var(--bg3);border-radius:8px;padding:8px;text-align:center"><div style="font-size:10px;color:var(--tx3)">Promedio mensual</div><b>$${fn2(PR.resumen.promedioMensual)}</b></div>
      </div>
      <table style="width:100%;font-size:11px">
        <tr style="background:var(--bg3)"><th style="padding:4px;text-align:left">Mes</th><th>Costo</th></tr>
        ${(PR.costoMes||[]).slice(-12).reverse().map(c=>`<tr><td style="padding:4px">${c.m}</td><td style="text-align:right">$${fn2(c.c)}</td></tr>`).join('')}
      </table>`:'<p style="font-size:11px;color:var(--tx3)">No disponible.</p>'}
    </details>

    <button class="btn btn-o" style="margin-top:12px" onclick="cm()">Cerrar</button>
  </div>`);
}
export function planHistoricoFiltrar(){
  window._histFiltro={
    desde:$('histDesde')?.value||'',
    hasta:$('histHasta')?.value||'',
    tipo:$('histTipo')?.value||'',
    equipo:$('histEquipo')?.value||''
  };
  planHistorico();
}
export function planHistoricoLimpiar(){
  window._histFiltro={desde:'',hasta:'',tipo:'',equipo:''};
  planHistorico();
}

// Puente window/renders — ver nota en mov.js (primera tanda).
window.renderPlan = renderPlan;
window.planVista = planVista;
window.planPeriodo = planPeriodo;
window.planMesCal = planMesCal;
window.planHistorico = planHistorico;
window.planHistoricoFiltrar = planHistoricoFiltrar;
window.planHistoricoLimpiar = planHistoricoLimpiar;
renders.plan = renderPlan;
