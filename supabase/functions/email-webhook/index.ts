// ============================================================
// email-webhook — SistemaMP Centinela
// Mismo propósito que whatsapp-webhook (canal de ENTRADA para reportar
// fallas), vía correo en vez de WhatsApp: alguien manda un correo
// ("CN-9500 fuera de servicio, falla de turbo") a la dirección de recepción
// configurada en Resend y esto lo parsea e inserta en correctivos_historico.
//
// Requiere en el dashboard de Resend (paso manual, fuera de este código):
// 1. Configurar un dominio con recepción de correo (inbound) y una ruta que
//    apunte a la URL de este endpoint.
// 2. Copiar el "Signing Secret" que Resend genera para ese webhook y
//    guardarlo como el secret RESEND_WEBHOOK_SECRET en este proyecto —
//    es el ÚNICO secret nuevo que hace falta (RESEND_API_KEY ya existe,
//    lo usa alerta-pm para el correo saliente).
//
// Seguridad en 2 capas, igual que whatsapp-webhook:
//  1. Firma del webhook (formato Svix: svix-id/svix-timestamp/svix-signature,
//     HMAC-SHA256 con RESEND_WEBHOOK_SECRET) — confirma que vino de Resend.
//  2. Lista de remitentes autorizados (configuracion.correoRemitentesPermitidos,
//     editable desde Configuración → Reporte de Fallas).
//
// Mismo criterio que WhatsApp: nunca descarta en silencio ni inventa un
// dato — lo que no se puede clasificar con confianza igual se inserta, pero
// marcado fuente='Correo (auto) — revisar' para revisión en Auditoría de Datos.
// ============================================================

import { parsearReporteFalla } from '../_shared/parseCorrectivo.ts';

async function verificarFirmaResend(secretoConPrefijo: string, svixId: string, svixTimestamp: string, cuerpo: string, svixSignature: string): Promise<boolean> {
  const secretoB64 = secretoConPrefijo.replace(/^whsec_/, '');
  const secretoBytes = Uint8Array.from(atob(secretoB64), (c) => c.charCodeAt(0));
  const contenidoFirmado = `${svixId}.${svixTimestamp}.${cuerpo}`;
  const key = await crypto.subtle.importKey('raw', secretoBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const firma = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(contenidoFirmado));
  const firmaB64 = btoa(String.fromCharCode(...new Uint8Array(firma)));
  // svix-signature puede traer varias firmas separadas por espacio (rotación
  // de secreto), cada una con prefijo "v1,": basta con que UNA coincida.
  return svixSignature.split(' ').some((f) => f.replace(/^v1,/, '') === firmaB64);
}

// Texto plano desde HTML simple, cuando el correo no trae 'text' (solo
// 'html') — best-effort, no un parser HTML completo: basta para extraer
// palabras clave/sigla del cuerpo del mensaje.
function htmlATexto(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

Deno.serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const RESEND_WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET');
    if (!RESEND_WEBHOOK_SECRET) return new Response('Falta configurar RESEND_WEBHOOK_SECRET', { status: 500 });

    const cuerpo = await req.text();
    const svixId = req.headers.get('svix-id') || '';
    const svixTimestamp = req.headers.get('svix-timestamp') || '';
    const svixSignature = req.headers.get('svix-signature') || '';
    const firmaOk = await verificarFirmaResend(RESEND_WEBHOOK_SECRET, svixId, svixTimestamp, cuerpo, svixSignature);
    if (!firmaOk) {
      return new Response(JSON.stringify({ error: 'Firma de Resend inválida' }), { status: 401 });
    }

    const evento = JSON.parse(cuerpo);
    if (evento?.type !== 'email.received') {
      return new Response(JSON.stringify({ ok: true, ignorado: 'no es email.received' }), { status: 200 });
    }
    const data = evento.data || {};
    const desde = String(data.from || '').trim().toLowerCase();
    const texto = String(data.text || '').trim() || htmlATexto(String(data.html || ''));

    const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

    const cfgR = await fetch(`${SUPABASE_URL}/rest/v1/configuracion?select=correoRemitentesPermitidos&limit=1`, { headers });
    const cfgRows = cfgR.ok ? await cfgR.json() : [];
    const permitidos = String(cfgRows[0]?.correoRemitentesPermitidos || '').split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
    if (permitidos.length === 0 || !permitidos.includes(desde)) {
      return new Response(JSON.stringify({ ok: true, ignorado: 'remitente no autorizado' }), { status: 200 });
    }

    const reporte = parsearReporteFalla(`${data.subject || ''} ${texto}`);

    async function responderCorreo(destinatario: string, asunto: string, mensaje: string) {
      if (!RESEND_API_KEY) return;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'Sistema MP Centinela <onboarding@resend.dev>', to: [destinatario], subject: asunto, html: `<p>${mensaje}</p>` }),
      });
    }

    if (!reporte) {
      await responderCorreo(desde, 'No se registró tu reporte', 'No reconocí esto como un reporte de falla (falta el código de equipo o una palabra como "fuera de servicio"). Si es una falla real, responde indicando el equipo, ej: "CN-9500 fuera de servicio, falla de turbo".');
      return new Response(JSON.stringify({ ok: true, insertado: false, motivo: 'no parece reporte de falla' }), { status: 200 });
    }

    const hoy = new Date().toISOString().slice(0, 10);
    const dupR = await fetch(
      `${SUPABASE_URL}/rest/v1/correctivos_historico?select=id&sigla=eq.${encodeURIComponent(reporte.sigla)}&fecha=eq.${hoy}&sistema=eq.${encodeURIComponent(reporte.componente)}&limit=1`,
      { headers }
    );
    const dupRows = dupR.ok ? await dupR.json() : [];
    if (Array.isArray(dupRows) && dupRows.length > 0) {
      await responderCorreo(desde, 'Reporte ya registrado', `Ya hay un reporte de ${reporte.sigla} — ${reporte.componente} registrado hoy, no se duplicó.`);
      return new Response(JSON.stringify({ ok: true, insertado: false, motivo: 'duplicado' }), { status: 200 });
    }

    const fuente = reporte.confianza === 'alta' ? 'Correo (auto)' : 'Correo (auto) — revisar';
    const insR = await fetch(`${SUPABASE_URL}/rest/v1/correctivos_historico`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({
        sigla: reporte.sigla,
        siglaOriginal: reporte.siglaOriginal || null,
        fecha: hoy,
        horometro: reporte.horometro,
        sistema: reporte.componente,
        descripcion: `${desde}: ${reporte.descripcion}`,
        tipoInt: 'Correctivo',
        fuente,
      }),
    });
    if (!insR.ok) {
      console.error('email-webhook: insert falló', await insR.text());
      await responderCorreo(desde, 'Error al registrar tu reporte', 'Hubo un error guardando el reporte, avisa al administrador del sistema.');
      return new Response(JSON.stringify({ ok: false, error: 'insert falló' }), { status: 500 });
    }

    const asunto = reporte.confianza === 'alta' ? '✅ Reporte registrado' : '⚠️ Reporte registrado con dudas';
    const mensaje = reporte.confianza === 'alta'
      ? `Registrado: <b>${reporte.sigla} — ${reporte.componente}</b>.`
      : `Registrado con dudas (${reporte.motivoBaja}) — un admin lo revisará en Auditoría de Datos: <b>${reporte.sigla} — ${reporte.componente}</b>.`;
    await responderCorreo(desde, asunto, mensaje);

    return new Response(JSON.stringify({ ok: true, insertado: true, confianza: reporte.confianza }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
