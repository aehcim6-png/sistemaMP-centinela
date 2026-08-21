// ============================================================
// whatsapp-webhook — SistemaMP Centinela
// Canal de ENTRADA (a diferencia de alerta-pm, que es de salida): un técnico
// le escribe al número de WhatsApp Business de Twilio ("CN-9500 fuera de
// servicio, falla de turbo") y este webhook lo parsea e inserta directo en
// correctivos_historico — automatiza lo que hasta ahora se hacía a mano
// (exportar el chat completo y pegarlo para que se procese por lotes, ver
// conversación 2026-08-17/18).
//
// Requiere en Twilio Console (paso manual, fuera de este código): configurar
// la URL de este endpoint como el webhook "When a message comes in" del
// número de WhatsApp Business ya usado para las alertas salientes de
// alerta-pm — mismos secrets (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN), no hace
// falta ninguno nuevo.
//
// Seguridad en 2 capas:
//  1. Firma de Twilio (X-Twilio-Signature, HMAC-SHA1 con el Auth Token) —
//     confirma que la petición vino realmente de Twilio, no de un tercero
//     que adivinó la URL.
//  2. Lista de remitentes autorizados (configuracion.whatsappRemitentesPermitidos,
//     editable desde Configuración → Reporte de Fallas) — confirma que quien
//     escribió es alguien del equipo, no cualquiera que le escriba al número
//     público de Twilio. Sin remitentes cargados, el canal no acepta nada.
//
// Nunca inventa un dato: si no reconoce el equipo o el mensaje es ambiguo
// (pregunta, posible PM programado), igual lo inserta pero con
// fuente='WhatsApp Twilio (auto) — revisar' para que quede visible en
// Auditoría de Datos en vez de perderse o insertarse como si fuera certero.
// ============================================================

import { parsearReporteFalla } from '../_shared/parseCorrectivo.ts';

async function verificarFirmaTwilio(authToken: string, url: string, params: URLSearchParams): Promise<string> {
  // Algoritmo documentado por Twilio: URL completa + cada parámetro POST
  // ordenado alfabéticamente por nombre, concatenado como "clave"+"valor"
  // sin separador — luego HMAC-SHA1 con el Auth Token, codificado en base64.
  const claves = [...params.keys()].sort();
  let base = url;
  for (const k of claves) base += k + params.get(k);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(authToken), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const firma = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(base));
  return btoa(String.fromCharCode(...new Uint8Array(firma)));
}

function twiml(mensaje: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response>${mensaje ? `<Message>${mensaje.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</Message>` : ''}</Response>`;
  return new Response(xml, { status: 200, headers: { 'Content-Type': 'text/xml' } });
}

Deno.serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    if (!TWILIO_AUTH_TOKEN) return new Response('Falta configurar TWILIO_AUTH_TOKEN', { status: 500 });

    const bodyTexto = await req.text();
    const params = new URLSearchParams(bodyTexto);

    // 1. Verificar que la petición vino de verdad de Twilio.
    const firmaEsperada = req.headers.get('X-Twilio-Signature') || '';
    const firmaCalculada = await verificarFirmaTwilio(TWILIO_AUTH_TOKEN, req.url, params);
    if (firmaCalculada !== firmaEsperada) {
      console.error('whatsapp-webhook: firma invalida', JSON.stringify({ reqUrl: req.url, firmaEsperada, firmaCalculada }));
      return new Response(JSON.stringify({ error: 'Firma de Twilio inválida' }), { status: 401 });
    }

    const desde = (params.get('From') || '').replace(/^whatsapp:/, '').trim();
    const texto = params.get('Body') || '';

    const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

    // 2. Verificar que quien escribió está en la lista de remitentes
    // autorizados (Configuración → Reporte de Fallas por WhatsApp/Correo).
    const cfgR = await fetch(`${SUPABASE_URL}/rest/v1/configuracion?select=whatsappRemitentesPermitidos&limit=1`, { headers });
    const cfgRows = cfgR.ok ? await cfgR.json() : [];
    const permitidos = String(cfgRows[0]?.whatsappRemitentesPermitidos || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    if (permitidos.length === 0 || !permitidos.includes(desde)) {
      // Silencioso a propósito: no confirma ni niega nada por WhatsApp a un
      // número no autorizado (no dar pistas de qué números SÍ funcionan).
      return twiml('');
    }

    const reporte = parsearReporteFalla(texto);
    if (!reporte) {
      // No parece un reporte de falla en absoluto (sin sigla ni palabra
      // clave) — no se inserta nada, pero sí se avisa para que la persona
      // sepa que no se registró (evita el silencio que hace pensar "ya
      // quedó guardado" cuando en realidad no pasó nada).
      return twiml('No reconocí esto como un reporte de falla (falta el código de equipo o una palabra como "fuera de servicio"). Si es una falla real, intenta de nuevo indicando el equipo, ej: "CN-9500 fuera de servicio, falla de turbo".');
    }

    // 3. Dedup: mismo equipo + mismo componente + mismo día ya reportado hoy
    // — evita duplicar si alguien reenvía o corrige el mismo mensaje.
    const hoy = new Date().toISOString().slice(0, 10);
    const dupR = await fetch(
      `${SUPABASE_URL}/rest/v1/correctivos_historico?select=id&sigla=eq.${encodeURIComponent(reporte.sigla)}&fecha=eq.${hoy}&sistema=eq.${encodeURIComponent(reporte.componente)}&limit=1`,
      { headers }
    );
    const dupRows = dupR.ok ? await dupR.json() : [];
    if (Array.isArray(dupRows) && dupRows.length > 0) {
      return twiml(`Ya hay un reporte de ${reporte.sigla} — ${reporte.componente} registrado hoy, no se duplicó.`);
    }

    const fuente = reporte.confianza === 'alta' ? 'WhatsApp Twilio (auto)' : 'WhatsApp Twilio (auto) — revisar';
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
      console.error('whatsapp-webhook: insert falló', await insR.text());
      return twiml('Hubo un error guardando el reporte, avisa al administrador del sistema.');
    }

    if (reporte.confianza === 'alta') {
      return twiml(`✅ Registrado: ${reporte.sigla} — ${reporte.componente}`);
    }
    return twiml(`⚠️ Registrado con dudas (${reporte.motivoBaja}) — un admin lo revisará en Auditoría de Datos: ${reporte.sigla} — ${reporte.componente}`);
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
