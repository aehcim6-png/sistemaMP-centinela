// ============================================================
// resumen-semanal — SistemaMP Centinela
// Resumen ejecutivo SEMANAL — distinto de alerta-pm (que manda TODO lo
// urgente cada día): este correo no repite el detalle diario, compara la
// semana contra la anterior (cuántos correctivos, cuánto costaron, qué
// equipos concentraron más fallas, cuántos PM se ejecutaron) y deja solo un
// contador — sin tabla — de lo que sigue pendiente hace tiempo (backlog,
// fuera de servicio prolongado, vencimientos, stock crítico), remitiendo al
// correo diario o al Dashboard para el detalle línea por línea.
//
// Pensado para un dueño/gerente que revisa el sistema una vez por semana en
// vez de entrar todos los días — a diferencia de alerta-pm, SIEMPRE se
// manda (aunque la semana haya estado tranquila), porque es un check-in
// ejecutivo, no una alerta de urgencia.
//
// Reusa los MISMOS destinatarios que alerta-pm (columna
// 'alertaEmails'/'alertaWhatsApp' de la tabla 'configuracion', con la misma
// env var de respaldo) — es la misma audiencia, no hace falta un campo
// nuevo en Configuración. Reusa también el mismo patrón de seguridad
// (verificar_secreto_cron contra Supabase Vault) con un secreto propio
// ('resumen_semanal_cron_secret'), y las mismas credenciales de Resend y
// Twilio ya configuradas a nivel de proyecto.
//
// 'Semana actual' = últimos 7 días incluyendo hoy; 'semana anterior' = los
// 7 días antes de esos. Es una ventana móvil simple (no Lun-Dom exactos)
// para no depender de qué día caiga el cron — pensado para correr los
// lunes en la mañana, cuando la ventana móvil coincide casi siempre con la
// semana calendario anterior completa.
//
// Filtra por tipo Correctivo/Falla Operacional — mismo criterio que usan
// las secciones 6, 7 y 9 de alerta-pm (excluye PM y otros tipos de OT).
//
// Pensada para correr una vez por semana (lunes) vía pg_cron (job
// 'resumen-semanal-lunes').
// ============================================================

const EXCLUIDOS = new Set(['BD-8708', 'CA-5137', 'CA-5140', 'CN-9506']); // decomisionados

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function pctDelta(actual: number, anterior: number): string {
  if (anterior <= 0) return actual > 0 ? '(antes: 0)' : '(sin cambio)';
  const d = Math.round(((actual - anterior) / anterior) * 100);
  return `(semana anterior: ${anterior}, ${d >= 0 ? '+' : ''}${d}%)`;
}

function moneda(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CL');
}

function tabla(headers: string[], filas: string[][]) {
  return `<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;margin-bottom:8px">
    <tr style="background:#f0f0f0">${headers.map((h) => `<th style="padding:6px 10px;border:1px solid #ddd">${h}</th>`).join('')}</tr>
    ${filas.map((f) => `<tr>${f.map((c) => `<td style="padding:6px 10px;border:1px solid #ddd">${c}</td>`).join('')}</tr>`).join('')}
  </table>`;
}

function tarjeta(titulo: string, valor: string, sub: string) {
  return `<td style="padding:12px 16px;border:1px solid #ddd;vertical-align:top">
    <div style="font-size:11px;color:#888">${titulo}</div>
    <div style="font-size:20px;font-weight:700;margin:2px 0">${valor}</div>
    <div style="font-size:11px;color:#888">${sub}</div>
  </td>`;
}

Deno.serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    // Mismo patrón que alerta-pm (corregido 2026-08-06): secreto propio de
    // 32 bytes en Vault, verificado vía la función restringida a
    // service_role que ya protege backup-diario y alerta-pm.
    const secretoRecibido = req.headers.get('x-cron-secret') || '';
    const rVerif = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verificar_secreto_cron`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre_secreto: 'resumen_semanal_cron_secret', valor_recibido: secretoRecibido }),
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

    // Mismos destinatarios que alerta-pm — misma audiencia (dueño/gerente).
    const cfgRows = await get('configuracion?select=alertaEmails,alertaWhatsApp&limit=1');
    const emailsCfg = String(cfgRows[0]?.alertaEmails || '')
      .split(',').map((e: string) => e.trim()).filter(Boolean);
    const DESTINATARIOS = emailsCfg.length > 0
      ? emailsCfg
      : (Deno.env.get('ALERTA_PM_DESTINATARIOS') || 'aehcim6@gmail.com').split(',').map((e) => e.trim()).filter(Boolean);

    const whatsappCfg = String(cfgRows[0]?.alertaWhatsApp || '')
      .split(',').map((e: string) => e.trim()).filter(Boolean);
    const DESTINATARIOS_WHATSAPP = whatsappCfg.length > 0
      ? whatsappCfg
      : (Deno.env.get('ALERTA_PM_WHATSAPP_DESTINATARIOS') || '').split(',').map((e) => e.trim()).filter(Boolean);

    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const inicioActual = new Date(hoy.getTime() - 6 * 86400000); // hoy incluido = 7 días
    const inicioAnterior = new Date(hoy.getTime() - 13 * 86400000);
    const finAnteriorExcl = iso(inicioActual); // < este día = semana anterior

    // ── CORRECTIVOS: semana actual vs. anterior ──────────────────
    const corrDesdeAnterior = await get(
      `correctivos?select=sigla,fecha,costo,componente,sintoma,tipo,solucion&fecha=gte.${iso(inicioAnterior)}`
    );
    const esRelevante = (o: any) => (o.tipo === 'Correctivo' || o.tipo === 'Falla Operacional') && o.sigla && !EXCLUIDOS.has(o.sigla);
    const corrSemanaActual = corrDesdeAnterior.filter((o: any) => esRelevante(o) && o.fecha >= iso(inicioActual));
    const corrSemanaAnterior = corrDesdeAnterior.filter((o: any) => esRelevante(o) && o.fecha >= iso(inicioAnterior) && o.fecha < finAnteriorExcl);

    const costoActual = corrSemanaActual.reduce((s: number, o: any) => s + (o.costo || 0), 0);
    const costoAnterior = corrSemanaAnterior.reduce((s: number, o: any) => s + (o.costo || 0), 0);

    const conDocActual = corrSemanaActual.filter((o: any) => o.solucion && String(o.solucion).trim()).length;
    const pctDoc = corrSemanaActual.length > 0 ? Math.round((conDocActual / corrSemanaActual.length) * 100) : null;

    // Ranking de equipos con más correctivos esta semana (top 5).
    const porEquipo: Record<string, number> = {};
    corrSemanaActual.forEach((o: any) => { porEquipo[o.sigla] = (porEquipo[o.sigla] || 0) + 1; });
    const rankingEquipos = Object.entries(porEquipo)
      .map(([sigla, n]) => ({ sigla, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 5);

    // ── PM ejecutados: semana actual vs. anterior ────────────────
    // Mismo criterio de fecha que regEsATiempo() en logic.js: fechaEntrada
    // primero, fechaEjec como respaldo si falta.
    const regsDesdeAnterior = await get(
      `registros_pm?select=equipo,fechaEntrada,fechaEjec&or=(fechaEntrada.gte.${iso(inicioAnterior)},fechaEjec.gte.${iso(inicioAnterior)})`
    );
    const fechaReg = (r: any) => r.fechaEntrada || r.fechaEjec || '';
    const pmSemanaActual = regsDesdeAnterior.filter((r: any) => fechaReg(r) >= iso(inicioActual)).length;
    const pmSemanaAnterior = regsDesdeAnterior.filter((r: any) => fechaReg(r) >= iso(inicioAnterior) && fechaReg(r) < finAnteriorExcl).length;

    // ── Snapshot de pendientes de fondo (solo contador, sin tabla —
    // el detalle línea por línea ya lo manda alerta-pm todos los días) ────
    const backlog = await get('correctivos?select=sigla&estadoOT=eq.Pendiente');
    const backlogCount = backlog.filter((o: any) => o.sigla && !EXCLUIDOS.has(o.sigla)).length;

    const fueraServicio = await get(
      `correctivos?select=sigla,fechaEntrada&estatusEq=eq.${encodeURIComponent('Fuera de Servicio')}&fechaSalida=is.null`
    );
    const hoyMs = hoy.getTime();
    const fueraServicioProlongadoCount = fueraServicio
      .filter((f: any) => f.fechaEntrada && !EXCLUIDOS.has(f.sigla))
      .filter((f: any) => Math.round((hoyMs - new Date(f.fechaEntrada + 'T00:00:00').getTime()) / 86400000) >= 14)
      .length;

    const vencs = await get('vencimientos?select=proxima,periodicidadMeses');
    const vencsCriticosCount = vencs.filter((v: any) => {
      if (!v.proxima) return !!v.periodicidadMeses;
      const dias = Math.round((new Date(v.proxima + 'T00:00:00').getTime() - hoyMs) / 86400000);
      return dias <= 30;
    }).length;

    const filtros = await get('stock_filtros?select=stockBodega,consumoMes,proyMes,pendiente');
    const filtrosCriticosCount = filtros.filter((f: any) => {
      const cm = f.consumoMes || f.proyMes || 0;
      const stock = (f.stockBodega || 0) + (f.pendiente || 0);
      if (cm <= 0) return false;
      return stock <= 0 || (stock / cm) < (34 / 30);
    }).length;
    const lubs = await get('lubricantes?select=stock,consumoMes,proyMes');
    const lubsCriticosCount = lubs.filter((l: any) => {
      const cm = l.consumoMes || l.proyMes || 0;
      const stock = l.stock || 0;
      if (cm <= 0) return false;
      return stock <= 0 || (stock / cm) < (34 / 30);
    }).length;
    const stockCriticoCount = filtrosCriticosCount + lubsCriticosCount;

    // ── Armar correo ──────────────────────────────────────────────
    const rangoTexto = `${iso(inicioActual)} al ${iso(hoy)}`;
    const resumenCorto = [
      `${corrSemanaActual.length} correctivo(s) esta semana`,
      `${moneda(costoActual)} en costo`,
      `${pmSemanaActual} PM ejecutado(s)`,
      `${backlogCount} pendiente(s) en backlog`,
    ];

    const html = `
      <h2>📊 SistemaMP Centinela — Resumen Ejecutivo Semanal</h2>
      <p style="color:#888;font-size:12px">Semana del ${rangoTexto}</p>
      <table style="border-collapse:collapse;margin-bottom:16px"><tr>
        ${tarjeta('Correctivos registrados', String(corrSemanaActual.length), pctDelta(corrSemanaActual.length, corrSemanaAnterior.length))}
        ${tarjeta('Costo correctivos', moneda(costoActual), pctDelta(costoActual, costoAnterior))}
        ${tarjeta('PM ejecutados', String(pmSemanaActual), pctDelta(pmSemanaActual, pmSemanaAnterior))}
        ${tarjeta('% cierres documentados', pctDoc == null ? '—' : pctDoc + '%', pctDoc == null ? 'sin correctivos esta semana' : 'de los correctivos de esta semana')}
      </tr></table>
      ${rankingEquipos.length > 0
        ? `<h3>🔧 Equipos con más correctivos esta semana</h3>` + tabla(
            ['Equipo', 'Correctivos esta semana'],
            rankingEquipos.map((r) => [r.sigla, String(r.n)])
          )
        : `<p style="font-size:13px;color:#888">Sin correctivos registrados esta semana.</p>`}
      <h3>📋 Pendiente hace tiempo (snapshot — detalle en el correo diario o el Dashboard)</h3>
      ${tabla(
        ['Backlog (correctivos pendientes)', 'Fuera de servicio ≥14 días', 'Documentos por vencer/vencidos', 'Ítems de stock crítico'],
        [[String(backlogCount), String(fueraServicioProlongadoCount), String(vencsCriticosCount), String(stockCriticoCount)]]
      )}
      <p style="color:#888;font-size:12px;margin-top:16px">Resumen ejecutivo automático semanal de SistemaMP Centinela. Para el detalle completo del mes (semáforo de metas, tendencias, compromisos), ver la pestaña Metas & KPIs → Resumen Ejecutivo dentro del sistema.</p>`;

    const er = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: REMITENTE,
        to: DESTINATARIOS,
        subject: `📊 Resumen semanal (${rangoTexto}) — SistemaMP Centinela`,
        html,
      }),
    });

    const erData = await er.json();
    if (!er.ok) {
      return new Response(JSON.stringify({ ok: false, error: 'Resend rechazó el envío', detalle: erData }), { status: 500 });
    }

    // ── WhatsApp (Twilio) — best-effort, igual que alerta-pm ────
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_WHATSAPP_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM');
    let whatsapp: { enviado: boolean; motivo?: string; resultados?: any[] } = { enviado: false, motivo: 'No configurado' };

    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_FROM && DESTINATARIOS_WHATSAPP.length > 0) {
      const textoWhatsApp =
        `📊 *SistemaMP Centinela* — Resumen semanal (${rangoTexto})\n\n` +
        resumenCorto.map((r) => `• ${r}`).join('\n') +
        `\n\nDetalle completo en el correo o en el Dashboard.`;
      const authHeader = 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
      const resultados = await Promise.all(
        DESTINATARIOS_WHATSAPP.map(async (numero) => {
          const destino = numero.startsWith('whatsapp:') ? numero : `whatsapp:${numero}`;
          try {
            const rt = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
              method: 'POST',
              headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ From: TWILIO_WHATSAPP_FROM, To: destino, Body: textoWhatsApp }),
            });
            const rtData = await rt.json();
            return { numero, ok: rt.ok, sid: rtData?.sid, error: rt.ok ? undefined : rtData };
          } catch (e) {
            return { numero, ok: false, error: String(e) };
          }
        })
      );
      whatsapp = { enviado: resultados.some((r) => r.ok), resultados };
    }

    return new Response(
      JSON.stringify({ ok: true, enviado: true, resumen: resumenCorto, resend_id: erData.id, whatsapp }),
      { status: 200 }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
