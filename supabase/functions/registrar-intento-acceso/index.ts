// ============================================================
// registrar-intento-acceso — SistemaMP Centinela
// Deja constancia en 'changelog' de un intento de LOGIN QUE NO PROSPERÓ
// (contraseña incorrecta o cuenta bloqueada/desactivada) — caso real
// (auditoría 2026-08): un operador desactivado (Héctor) podía volver a
// intentar entrar y, si fallaba, no quedaba ningún rastro — el sistema
// solo registraba logins exitosos.
//
// Se llama SIN sesión (por definición: el login falló, no hay token de
// usuario) — por eso necesita su propia Edge Function con clave de
// servicio en vez de insertar directo a 'changelog' desde el cliente
// (esa tabla exige 'to authenticated' + es_usuario_activo() en su RLS,
// ver rls_changelog_y_mixtas.sql — no acepta anon).
//
// Deliberadamente NO distingue "contraseña incorrecta" de "cuenta
// bloqueada": Supabase Auth devuelve el mismo error genérico para ambos
// casos (para no filtrarle a un atacante si una cuenta existe/está
// bloqueada), así que tampoco se puede distinguir acá. Se registra el
// intento tal cual, sin inventar el motivo.
//
// Nivel 4 de la propuesta de ciberseguridad (2026-09-02, endurecido 2026-09-04)
// — señal "ráfaga de intentos fallidos": tras registrar el intento, cuenta
// cuántos intentos bloqueados lleva ESTA cuenta en los últimos 15 minutos: si
// justo llega a 5, (a) avisa por correo/WhatsApp (mismos canales que
// avisar-dispositivo-nuevo) Y (b) bloquea la cuenta de verdad en Supabase Auth
// por 15 minutos (ban_duration, misma API que ya usa crear-operador para
// desactivar usuarios — acá temporal, se autolevanta solo, nadie tiene que
// entrar a desbloquear nada). Antes (2026-09-02) solo se avisaba; un atacante
// con tiempo podía seguir probando contraseñas indefinidamente mientras el
// admin recibía notificaciones. Se dispara solo la vez que se CRUZA el
// umbral (count === UMBRAL), no en cada intento posterior — mismo criterio
// que ya usaba el aviso, ahora también para el bloqueo.
//
// Este endpoint es público a propósito (ver arriba, sin sesión) — alguien
// podría en teoría spamear este umbral con requests directos usando el email
// de un admin conocido, sin saber su clave, y lograr que quede bloqueado 15
// minutos (antes esto solo generaba alertas de más; ahora sí bloquea el
// acceso real, es un costo mayor). Se acepta el riesgo porque: (1) el
// bloqueo es corto y se autolevanta, el peor caso es una molestia de minutos,
// no una cuenta perdida; (2) dispara la MISMA alerta al admin en el momento,
// así que nunca queda bloqueado en silencio sin enterarse; y (3) la
// alternativa — no bloquear nunca — deja una fuerza bruta real completamente
// sin freno, que es el riesgo más grave de los dos. Sin CAPTCHA (fuera de
// alcance de este nivel) no hay forma de distinguir "ataque simulado contra
// el endpoint" de "ataque real contra la cuenta", así que ambos casos
// reciben el mismo tratamiento.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const BLOQUEO_TEMPORAL_DURACION = "15m";

// Busca el user_id de Supabase Auth por email — no hay tabla propia con ese
// mapeo (user_roles no guarda email, ver 20260827.../user_roles.sql), así
// que se recorre auth.users vía el Admin API paginado. Aceptable a esta
// escala (equipo de mantención, no miles de usuarios); tope defensivo de 10
// páginas para nunca quedar en un loop si algo raro pasa con la paginación.
async function buscarUserIdPorEmail(admin: ReturnType<typeof createClient>, email: string): Promise<string | null> {
  const emailLower = email.toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) break;
    const found = data.users.find((u) => (u.email || "").toLowerCase() === emailLower);
    if (found) return found.id;
    if (data.users.length < 200) break; // última página
  }
  return null;
}

async function bloquearCuentaTemporalmente(admin: ReturnType<typeof createClient>, email: string) {
  const userId = await buscarUserIdPorEmail(admin, email);
  if (!userId) return; // email no corresponde a ninguna cuenta real — nada que bloquear
  await admin.auth.admin.updateUserById(userId, { ban_duration: BLOQUEO_TEMPORAL_DURACION }).catch(() => {});
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

// Recorte defensivo — esto lo llena cualquiera que llegue a la pantalla de
// login (sin autenticar todavía), así que el texto es 100% no confiable.
function recortar(v: unknown, max: number): string {
  return String(v ?? "").slice(0, max);
}

const UMBRAL_RAFAGA = 5;
const VENTANA_RAFAGA_MS = 15 * 60 * 1000;

async function avisarRafaga(admin: ReturnType<typeof createClient>, email: string, intentos: number) {
  const cfgR = await admin.from("configuracion").select("alertaEmails,alertaWhatsApp").limit(1);
  const cfgRow = cfgR.data?.[0] || {};
  const emails = String(cfgRow.alertaEmails || "").split(",").map((s: string) => s.trim()).filter(Boolean);
  const whatsapps = String(cfgRow.alertaWhatsApp || "").split(",").map((s: string) => s.trim()).filter(Boolean);

  const fechaTxt = new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" });
  const asunto = `🚨 Posible fuerza bruta — ${email}`;
  const resumen = `${intentos} intentos de acceso fallidos en los últimos 15 minutos para la cuenta ${email}. La cuenta quedó bloqueada automáticamente por 15 minutos.`;
  const html =
    `<h2>🚨 SistemaMP Centinela — posible fuerza bruta</h2>` +
    `<p>${resumen}</p>` +
    `<p>Fecha: ${fechaTxt} (hora Chile)</p>` +
    `<p style="color:#888;font-size:12px;margin-top:16px">El bloqueo se levanta solo en 15 minutos — no hace falta que hagas nada. Si el ataque sigue después de eso, se vuelve a bloquear. Si no reconoces esta actividad, avísale al dueño de la cuenta que cambie su contraseña, o desactívala desde Configuración → Usuarios si quieres cortarlo de raíz.</p>`;

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const REMITENTE = Deno.env.get("ALERTA_PM_REMITENTE") || "Sistema MP Centinela <onboarding@resend.dev>";
  if (RESEND_API_KEY && emails.length > 0) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: REMITENTE, to: emails, subject: asunto, html }),
    }).catch(() => {});
  }

  const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
  const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
  const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_FROM && whatsapps.length > 0) {
    const textoWhatsApp = `🚨 *SistemaMP Centinela* — posible fuerza bruta\n\n${resumen}\n${fechaTxt} (hora Chile)`;
    const authHeaderTwilio = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    await Promise.all(
      whatsapps.map((numero: string) => {
        const destino = numero.startsWith("whatsapp:") ? numero : `whatsapp:${numero}`;
        return fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
          method: "POST",
          headers: { Authorization: authHeaderTwilio, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ From: TWILIO_WHATSAPP_FROM, To: destino, Body: textoWhatsApp }),
        }).catch(() => {});
      })
    );
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const email = recortar(body.email, 150) || "(sin email)";
    const dispositivo = recortar(body.dispositivo, 80);
    const userAgent = recortar(body.userAgent, 150);

    const { error } = await admin.from("changelog").insert({
      fecha: new Date().toISOString(),
      usuario: email,
      accion: "Login bloqueado",
      detalle: "Intento de acceso rechazado (clave incorrecta, cuenta desactivada, o sesión vencida sin poder renovarse) · 💻 " + dispositivo + " · " + userAgent,
    });
    if (error) return json({ error: "No se pudo registrar: " + error.message }, 500);

    if (email !== "(sin email)") {
      const conteoR = await admin
        .from("changelog")
        .select("id", { count: "exact", head: true })
        .eq("accion", "Login bloqueado")
        .eq("usuario", email)
        .gte("fecha", new Date(Date.now() - VENTANA_RAFAGA_MS).toISOString());
      const intentosRecientes = conteoR.count ?? 0;
      if (intentosRecientes === UMBRAL_RAFAGA) {
        await Promise.all([
          avisarRafaga(admin, email, intentosRecientes).catch(() => {}),
          bloquearCuentaTemporalmente(admin, email).catch(() => {}),
        ]);
      }
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
