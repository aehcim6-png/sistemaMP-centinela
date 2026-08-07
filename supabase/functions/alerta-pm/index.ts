// ============================================================
// alerta-pm — SistemaMP Centinela
// Revisa TODO lo urgente del sistema y manda un solo correo diario con
// todo junto (antes solo avisaba de PM por horómetro). Cada sección usa
// la MISMA fórmula que el resto de la app para que el correo diga
// exactamente lo mismo que se ve en pantalla — nunca un cálculo aparte
// que se pueda desincronizar con el Dashboard.
//
// Secciones (se omiten si no tienen nada urgente ese día):
//   1. Equipos con PM urgente (por horómetro) — igual que antes.
//   2. Stock crítico (filtros + lubricantes) — misma fórmula que
//      stockEstado() en logic.js (stock+pendiente vs consumo y lead time).
//   3. Documentos por vencer o vencidos (tabla 'vencimientos') — mismo
//      criterio que vencEstado() en logic.js (vencido, o ≤30 días).
//   4. Correctivos pendientes (backlog) — estadoOT='Pendiente'.
//
// (2026-08-01) Ampliada de "solo PM" a "todo lo urgente" a pedido del
// usuario. Quedan afuera por ahora Neumáticos y Componentes Mayores: su
// cálculo de vida útil es bastante más largo (criterios por marca/medida,
// tren de rodaje por lado) y portarlo mal acá generaría un número que NO
// coincide con el Dashboard, que es justo lo que este correo existe para
// evitar. Se puede sumar más adelante con más tiempo para probarlo bien.
//
// Pensada para correr una vez al día vía pg_cron (job 'alerta-pm-diaria').
// ============================================================

const EXCLUIDOS = new Set(['BD-8708', 'CA-5137', 'CA-5140', 'CN-9506']); // decomisionados

function calcStockEstado(stockBodega: number, consumoMes: number, leadDias: number | null) {
  const cm = consumoMes || 0;
  const stock = stockBodega || 0;
  const lead = leadDias && leadDias > 0 ? leadDias : 34;
  const leadMeses = lead / 30;
  if (cm <= 0) return { nivel: 'OK', meses: null as number | null };
  const meses = stock / cm;
  if (stock <= 0) return { nivel: 'COMPRAR', meses: 0 };
  if (meses < leadMeses) return { nivel: 'COMPRAR', meses };
  if (meses < 2) return { nivel: 'BAJO', meses };
  return { nivel: 'OK', meses };
}

function calcVencEstado(proximaFecha: string | null) {
  if (!proximaFecha) return { dias: null as number | null, requiereAtencion: false, vencido: false };
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const prox = new Date(proximaFecha + 'T00:00:00');
  if (isNaN(prox.getTime())) return { dias: null, requiereAtencion: false, vencido: false };
  const dias = Math.round((prox.getTime() - hoy.getTime()) / 86400000);
  if (dias < 0) return { dias, requiereAtencion: true, vencido: true };
  if (dias <= 30) return { dias, requiereAtencion: true, vencido: false };
  return { dias, requiereAtencion: false, vencido: false };
}

function tabla(headers: string[], filas: string[][]) {
  return `<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;margin-bottom:8px">
    <tr style="background:#f0f0f0">${headers.map((h) => `<th style="padding:6px 10px;border:1px solid #ddd">${h}</th>`).join('')}</tr>
    ${filas.map((f) => `<tr>${f.map((c) => `<td style="padding:6px 10px;border:1px solid #ddd">${c}</td>`).join('')}</tr>`).join('')}
  </table>`;
}

Deno.serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    // --- Seguridad (corregida 2026-08-06): antes comparaba x-cron-secret contra
    // un secreto fijo en una env var ('pm-centinela-2026' — baja entropía,
    // adivinable, y guardado en texto plano dentro de cron.job.command, visible
    // para cualquiera con acceso SQL al proyecto). Ahora reusa la misma función
    // restringida a service_role que ya protege backup-diario
    // (verificar_secreto_cron), contra un secreto aleatorio de 32 bytes guardado
    // en Supabase Vault — nunca queda en texto plano ni en el código ni en el
    // cron job.
    const secretoRecibido = req.headers.get('x-cron-secret') || '';
    const rVerif = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verificar_secreto_cron`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre_secreto: 'alerta_pm_cron_secret', valor_recibido: secretoRecibido }),
    });
    const secretoValido = rVerif.ok ? await rVerif.json() : false;
    if (!secretoValido) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }
    const REMITENTE = Deno.env.get('ALERTA_PM_REMITENTE') || 'Sistema MP Centinela <onboarding@resend.dev>';

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'Falta configurar el secret RESEND_API_KEY' }), { status: 500 });
    }

    const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
    const get = async (path: string) => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
      if (!r.ok) throw new Error(`No se pudo leer ${path}: ${r.status}`);
      const d = await r.json();
      if (!Array.isArray(d)) throw new Error(`${path} no devolvió un arreglo válido`);
      return d;
    };

    // Destinatarios: primero la lista editable desde Configuración (columna
    // 'alertaEmails' de la tabla singleton 'configuracion' — cualquier admin
    // la cambia desde la app, sin necesitar acceso a Supabase). Si queda
    // vacía o la fila todavía no existe, cae a la env var fija como respaldo
    // para no dejar de avisar por un campo en blanco.
    const cfgRows = await get('configuracion?select=alertaEmails&limit=1');
    const emailsCfg = String(cfgRows[0]?.alertaEmails || '')
      .split(',').map((e) => e.trim()).filter(Boolean);
    const DESTINATARIOS = emailsCfg.length > 0
      ? emailsCfg
      : (Deno.env.get('ALERTA_PM_DESTINATARIOS') || 'aehcim6@gmail.com').split(',').map((e) => e.trim()).filter(Boolean);

    let secciones = '';
    let totalItems = 0;
    const resumen: string[] = [];

    // ── 1. EQUIPOS con PM urgente ──────────────────────────────
    // Antes esta sección recalculaba el próximo PM con una grilla simple
    // (Math.ceil(horom/frec)*frec), que NO es lo mismo que usa el Dashboard
    // (C.proxPM en logic.js, que además mira el último PM real ejecutado
    // para no "inventar" un hito ya cubierto). Esa diferencia hacía que el
    // correo marcara casi el doble de equipos urgentes que los que
    // realmente se ven en pantalla (14 vs 8, verificado 2026-08-01).
    // Ahora se lee directo 'estado'/'diasParaPM'/'horomProxPM' de la tabla
    // 'equipos' — los mismos campos que ya calcula y guarda la app cada
    // vez que alguien la usa — así el correo NUNCA puede decir algo
    // distinto de lo que muestra el Dashboard, porque es el mismo dato.
    const equipos = await get('equipos?select=sigla,tipo,modelo,horomActual,unidad,estado,diasParaPM,horomProxPM');
    const urgentesPM = equipos
      .filter((e: any) => e?.sigla && !EXCLUIDOS.has(e.sigla))
      .filter((e: any) => (e.estado || '').includes('URGENTE') || (e.estado || '').includes('VENCIDA'))
      .map((e: any) => ({ ...e, _unidad: e.unidad === 'km' ? 'km' : 'h' }))
      .sort((a: any, b: any) => (Number(a.diasParaPM) || 0) - (Number(b.diasParaPM) || 0));

    if (urgentesPM.length > 0) {
      totalItems += urgentesPM.length;
      resumen.push(`${urgentesPM.length} equipo(s) con PM urgente`);
      secciones += `<h3>🔴 Equipos con PM urgente o vencida</h3>` + tabla(
        ['Sigla', 'Modelo', 'Horómetro actual', 'Próximo PM', 'Días restantes'],
        urgentesPM.map((e: any) => [
          e.sigla, e.modelo || e.tipo || '',
          `${Number(e.horomActual).toLocaleString('es-CL')} ${e._unidad}`,
          `${Number(e.horomProxPM).toLocaleString('es-CL')} ${e._unidad}`,
          `<b style="color:#c00">${Number(e.diasParaPM) <= 0 ? 'VENCIDA' : e.diasParaPM + ' día(s)'}</b>`,
        ])
      );
    }

    // ── 2. STOCK CRÍTICO (filtros + lubricantes) ────────────────
    const filtros = await get('stock_filtros?select=descripcion,nParte,equipoModelo,stockBodega,consumoMes,proyMes,pendiente');
    const filtrosCriticos = filtros
      .map((f: any) => ({ ...f, _e: calcStockEstado((f.stockBodega || 0) + (f.pendiente || 0), f.consumoMes || f.proyMes || 0, null) }))
      .filter((f: any) => f._e.nivel === 'COMPRAR');

    const lubs = await get('lubricantes?select=nombre,stock,consumoMes,proyMes');
    const lubsCriticos = lubs
      .map((l: any) => ({ ...l, _e: calcStockEstado(l.stock || 0, l.consumoMes || l.proyMes || 0, null) }))
      .filter((l: any) => l._e.nivel === 'COMPRAR');

    if (filtrosCriticos.length > 0 || lubsCriticos.length > 0) {
      const totalStock = filtrosCriticos.length + lubsCriticos.length;
      totalItems += totalStock;
      resumen.push(`${totalStock} ítem(s) de stock crítico`);
      secciones += `<h3>🔴 Stock crítico — sin cobertura para el tiempo de reposición</h3>`;
      if (filtrosCriticos.length > 0) {
        secciones += tabla(
          ['Filtro', 'N° Parte', 'Equipo/Modelo', 'Stock', 'Consumo/mes'],
          filtrosCriticos.map((f: any) => [f.descripcion || '', f.nParte || '', f.equipoModelo || '', String((f.stockBodega || 0) + (f.pendiente || 0)), String(f.consumoMes || f.proyMes || 0)])
        );
      }
      if (lubsCriticos.length > 0) {
        secciones += tabla(
          ['Lubricante', 'Stock', 'Consumo/mes'],
          lubsCriticos.map((l: any) => [l.nombre || '', String(l.stock || 0), String(l.consumoMes || l.proyMes || 0)])
        );
      }
    }

    // ── 3. VENCIMIENTOS (documentos/certificaciones) ────────────
    const vencs = await get('vencimientos?select=sigla,vencTipo,proxima');
    const vencsCriticos = vencs
      .map((v: any) => ({ ...v, _v: calcVencEstado(v.proxima) }))
      .filter((v: any) => v._v.requiereAtencion)
      .sort((a: any, b: any) => (a._v.dias ?? 0) - (b._v.dias ?? 0));

    if (vencsCriticos.length > 0) {
      totalItems += vencsCriticos.length;
      resumen.push(`${vencsCriticos.length} documento(s) por vencer o vencido(s)`);
      secciones += `<h3>🟡 Documentos por vencer (≤30 días) o vencidos</h3>` + tabla(
        ['Equipo', 'Documento', 'Estado'],
        vencsCriticos.map((v: any) => [
          v.sigla || '', v.vencTipo || '',
          v._v.vencido ? `<b style="color:#c00">VENCIDO (${Math.abs(v._v.dias)}d)</b>` : `Vence en ${v._v.dias}d`,
        ])
      );
    }

    // ── 4. CORRECTIVOS PENDIENTES (backlog) ─────────────────────
    const pendientes = await get('correctivos?select=sigla,sintoma,fecha,estadoOT&estadoOT=eq.Pendiente');
    if (pendientes.length > 0) {
      totalItems += pendientes.length;
      resumen.push(`${pendientes.length} correctivo(s) pendiente(s)`);
      secciones += `<h3>🟠 Correctivos pendientes (backlog)</h3>` + tabla(
        ['Equipo', 'Fecha', 'Síntoma'],
        pendientes.map((p: any) => [p.sigla || '', p.fecha || '', (p.sintoma || '').slice(0, 80)])
      );
    }

    // ── Enviar (o no, si no hay nada urgente) ───────────────────
    if (totalItems === 0) {
      return new Response(JSON.stringify({ ok: true, enviado: false, motivo: 'Nada urgente hoy' }), { status: 200 });
    }

    const html = `
      <h2>🔴 SistemaMP Centinela — resumen diario</h2>
      <p>${resumen.join(' · ')}.</p>
      ${secciones}
      <p style="color:#888;font-size:12px;margin-top:16px">Alerta automática diaria de SistemaMP Centinela. Se repite mientras siga pendiente.</p>`;

    const er = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: REMITENTE,
        to: DESTINATARIOS,
        subject: `🔴 ${totalItems} alerta(s) — SistemaMP Centinela`,
        html,
      }),
    });

    const erData = await er.json();
    if (!er.ok) {
      return new Response(JSON.stringify({ ok: false, error: 'Resend rechazó el envío', detalle: erData }), { status: 500 });
    }

    return new Response(
      JSON.stringify({ ok: true, enviado: true, resumen, resend_id: erData.id }),
      { status: 200 }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
