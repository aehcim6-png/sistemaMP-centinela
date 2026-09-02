// ============================================================
// avisar-dispositivo-nuevo — SistemaMP Centinela
// Aviso PROACTIVO por correo/WhatsApp cuando una cuenta inicia sesión desde
// un dispositivo que nunca se había visto antes para ESA cuenta — mismo
// espíritu que la alerta de "nuevo dispositivo" de un banco. No crea
// infraestructura nueva de rastreo: reusa el registro que YA existe en
// 'changelog' (accion='Login'), donde cada login ya guarda una etiqueta de
// dispositivo (_getDeviceLabel(), ver index.html) dentro de 'detalle'.
//
// "Nuevo" = la primera vez que esa etiqueta de dispositivo aparece en el
// historial de logins de esa cuenta (se cuenta cuántas filas hay con esa
// combinación; si es la única — la que se acaba de insertar al loguearse —
// es nueva). No hace falta una marca de dedup aparte: por definición, una
// vez que un dispositivo ya apareció una vez, nunca vuelve a contar como 1.
//
// Disparada por el propio navegador justo después de un login exitoso (no
// por cron) — el llamador manda su propio token, la función verifica que
// sea real con auth.getUser() antes de hacer nada. Best-effort: si esto
// falla, nunca debe bloquear ni demorar el login (el cliente la llama sin
// esperar la respuesta).
//
// Simplificación consciente (2026-09-01): el historial se filtra por
// 'usuario' = el email de la cuenta, no por un id estable — 'changelog.usuario'
// guarda a veces el email y a veces el nombre visible (según en qué momento
// del login se escribió, ver _registrarLogin en index.html), así que un
// dispositivo ya visto podría, en un caso raro, volver a contar como
// "nuevo" si sus apariciones previas quedaron todas con el nombre en vez
// del email. Prefiere avisar de más a quedarse callado — el costo de un
// falso positivo acá es un correo de más, no un riesgo de seguridad.
// ============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const callerToken = authHeader.replace("Bearer ", "");
    if (!callerToken) return json({ error: "No autorizado." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: callerData, error: callerErr } = await admin.auth.getUser(callerToken);
    if (callerErr || !callerData?.user) return json({ error: "Token inválido." }, 401);

    const body = await req.json().catch(() => ({}));
    const dispositivo = String(body.dispositivo ?? "").trim();
    if (!dispositivo) return json({ error: "Falta dispositivo." }, 400);

    const email = callerData.user.email || "";
    if (!email) return json({ ok: true, nuevo: false, motivo: "sin email en la cuenta" });

    // Cuenta cuántas veces aparece EXACTAMENTE esta combinación email+dispositivo
    // en el historial de logins — el emoji del ícono queda como parte del
    // patrón para no calzar por accidente con otro texto que solo contenga
    // el nombre del dispositivo suelto.
    // 'detalle' es jsonb (guarda el string entero como escalar JSON, ver
    // migración 20260713231212), no text — .like() normal contra esa
    // columna falla en Postgres ("operator does not exist: jsonb ~~
    // unknown"), verificado en vivo contra datos reales antes de
    // desplegar esto. Se castea a texto en el propio nombre de columna
    // del filtro (sintaxis que PostgREST soporta), la única forma de
    // hacer LIKE sobre una columna jsonb sin cambiar el esquema.
    const marca = `💻 ${dispositivo} ·`;
    const hist = await admin
      .from("changelog")
      .select("id", { count: "exact", head: true })
      .eq("accion", "Login")
      .eq("usuario", email)
      .filter("detalle::text", "like", `%${marca}%`);

    const apariciones = hist.count ?? 0;
    // 0 podría pasar si el registro del login mismo todavía no terminó de
    // guardarse cuando esta función corrió (ambas llamadas son best-effort,
    // sin garantía de orden) — se trata igual como "nuevo", nunca como
    // "no avisar", para no arriesgar quedarse callado por una carrera.
    const esNuevo = apariciones <= 1;
    if (!esNuevo) return json({ ok: true, nuevo: false });

    const cfgR = await admin.from("configuracion").select("alertaEmails,alertaWhatsApp").limit(1);
    const cfgRow = cfgR.data?.[0] || {};
    const emails = String(cfgRow.alertaEmails || "").split(",").map((s: string) => s.trim()).filter(Boolean);
    const whatsapps = String(cfgRow.alertaWhatsApp || "").split(",").map((s: string) => s.trim()).filter(Boolean);

    const nombreVisible = email;
    const ahora = new Date();
    const fechaTxt = ahora.toLocaleString("es-CL", { timeZone: "America/Santiago" });
    const asunto = `🔐 Dispositivo nuevo — ${nombreVisible} (${dispositivo})`;
    const html =
      `<h2>🔐 SistemaMP Centinela — dispositivo nuevo</h2>` +
      `<p><b>${nombreVisible}</b> inició sesión desde un dispositivo que no se había visto antes en esta cuenta.</p>` +
      `<p>Dispositivo: <b>${dispositivo}</b><br>Fecha: ${fechaTxt} (hora Chile)</p>` +
      `<p style="color:#888;font-size:12px;margin-top:16px">Si reconoces este acceso, no necesitas hacer nada. Si no, revisa Configuración → Accesos recientes y considera cambiar la contraseña de esa cuenta.</p>`;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const REMITENTE = Deno.env.get("ALERTA_PM_REMITENTE") || "Sistema MP Centinela <onboarding@resend.dev>";
    let emailEnviado = false;
    if (RESEND_API_KEY && emails.length > 0) {
      const er = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: REMITENTE, to: emails, subject: asunto, html }),
      });
      emailEnviado = er.ok;
    }

    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");
    let whatsappResultados: { numero: string; ok: boolean }[] = [];
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_FROM && whatsapps.length > 0) {
      const textoWhatsApp =
        `🔐 *SistemaMP Centinela* — dispositivo nuevo\n\n${nombreVisible} inició sesión desde ${dispositivo}.\n${fechaTxt} (hora Chile)\n\n` +
        `Si no reconoces este acceso, revisa Accesos recientes en el sistema.`;
      const authHeaderTwilio = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
      whatsappResultados = await Promise.all(
        whatsapps.map(async (numero: string) => {
          const destino = numero.startsWith("whatsapp:") ? numero : `whatsapp:${numero}`;
          try {
            const rt = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
              method: "POST",
              headers: { Authorization: authHeaderTwilio, "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({ From: TWILIO_WHATSAPP_FROM, To: destino, Body: textoWhatsApp }),
            });
            return { numero, ok: rt.ok };
          } catch {
            return { numero, ok: false };
          }
        })
      );
    }

    return json({ ok: true, nuevo: true, emailEnviado, whatsapp: whatsappResultados });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
