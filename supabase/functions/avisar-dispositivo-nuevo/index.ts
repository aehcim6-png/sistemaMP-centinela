// ============================================================
// avisar-dispositivo-nuevo — SistemaMP Centinela
// Aviso PROACTIVO por correo/WhatsApp tras un login exitoso, cuando alguna
// de estas señales se cumple — mismo espíritu que la alerta de "actividad
// inusual" de un banco:
//  1. Dispositivo nuevo — la cuenta nunca había iniciado sesión desde este
//     dispositivo (Nivel 1, 2026-09-01).
//  2. Horario inusual — la cuenta entra a una hora fuera de su patrón
//     histórico de acceso (Nivel 4, 2026-09-02).
//  3. Varios dispositivos nuevos en poco tiempo — no un dispositivo nuevo
//     aislado (eso ya es la señal 1), sino 3 o más dispositivos DISTINTOS
//     que aparecieron por primera vez en los últimos 7 días para la misma
//     cuenta — indicio de que la clave se compartió o se filtró
//     (Nivel 4, 2026-09-02).
// No crea infraestructura nueva de rastreo: las 3 señales se calculan sobre
// el mismo historial que ya existe en 'changelog' (accion='Login'), donde
// cada login ya guarda una etiqueta de dispositivo (_getDeviceLabel(), ver
// index.html) dentro de 'detalle'.
//
// Disparada por el propio navegador justo después de un login exitoso (no
// por cron) — el llamador manda su propio token, la función verifica que
// sea real con auth.getUser() antes de hacer nada. Best-effort: si esto
// falla, nunca debe bloquear ni demorar el login (el cliente la llama sin
// esperar la respuesta).
//
// Simplificación consciente (2026-09-01, sigue aplicando a las 3 señales):
// el historial se filtra por 'usuario' = el email de la cuenta, no por un
// id estable — 'changelog.usuario' guarda a veces el email y a veces el
// nombre visible (según en qué momento del login se escribió, ver
// _registrarLogin en index.html), así que la base histórica de cada señal
// puede quedar más chica de lo real si hay apariciones previas guardadas
// con el nombre en vez del email. Prefiere avisar de más (o no reconocer
// del todo un patrón histórico débil) a quedarse callado — el costo de un
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

// Ventana de historial que se trae para calcular las 3 señales — acota el
// costo de la consulta sin perder patrón útil (60 días de logins de una
// misma cuenta es de sobra para "hora habitual" y "dispositivos nuevos
// recientes", que solo mira los últimos 7).
const DIAS_HISTORIAL = 60;
const UMBRAL_MIN_HISTORIAL_HORARIO = 5;
const UMBRAL_DISPOSITIVOS_NUEVOS = 3;
const VENTANA_DISPOSITIVOS_NUEVOS_MS = 7 * 24 * 60 * 60 * 1000;

// Hora (0-23) de una fecha en huso de Chile. hour12:false puede devolver
// "24" para la medianoche en vez de "00" (comportamiento real de
// Intl.DateTimeFormat en algunos motores) — el módulo 24 lo normaliza.
function horaChile(fecha: string | Date): number {
  const s = new Date(fecha).toLocaleString("en-US", { timeZone: "America/Santiago", hour: "numeric", hour12: false });
  return Number(s) % 24;
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

    // Un solo fetch del historial (fecha + detalle) sirve para las 3 señales
    // — evita 3 consultas separadas para lo mismo.
    const desde = new Date(Date.now() - DIAS_HISTORIAL * 24 * 60 * 60 * 1000).toISOString();
    const histR = await admin
      .from("changelog")
      .select("fecha,detalle")
      .eq("accion", "Login")
      .eq("usuario", email)
      .gte("fecha", desde)
      .order("fecha", { ascending: true });
    const historial: { fecha: string; detalle: string | null }[] = histR.data || [];

    // --- Señal 1: dispositivo nuevo ---
    // 'detalle' guarda "<origen> · 💻 <dispositivo> · <userAgent>" (ver
    // _registrarLogin en index.html) — el emoji queda como parte del patrón
    // para no calzar por accidente con otro texto que solo contenga el
    // nombre del dispositivo suelto.
    const marca = `💻 ${dispositivo} ·`;
    const aparicionesEsteDispositivo = historial.filter((f) => (f.detalle || "").includes(marca)).length;
    // <=1 en vez de ===0: la fila del login que disparó esta misma llamada
    // puede o no haber terminado de guardarse todavía (ambas llamadas son
    // best-effort, sin garantía de orden) — si ya está, cuenta como 1 y
    // sigue siendo "nuevo".
    const dispositivoNuevo = aparicionesEsteDispositivo <= 1;

    // --- Señal 2: horario inusual ---
    // Con muy poco historial cualquier hora es "normal" (no hay patrón
    // todavía que romper) — se exige un mínimo de logins previos antes de
    // evaluar esta señal, para no marcar como rara la hora de una cuenta
    // recién creada.
    let horarioInusual = false;
    if (historial.length >= UMBRAL_MIN_HISTORIAL_HORARIO) {
      const horasHistoricas = new Set(historial.map((f) => horaChile(f.fecha)));
      const horaActual = horaChile(new Date());
      // ±1 hora de margen: no marcar por un login 20 minutos antes o
      // después de lo habitual como si fuera un patrón distinto.
      const dentroDeLoHabitual = [horaActual, (horaActual + 1) % 24, (horaActual + 23) % 24].some((h) => horasHistoricas.has(h));
      horarioInusual = !dentroDeLoHabitual;
    }

    // --- Señal 3: varios dispositivos nuevos en poco tiempo ---
    // Recorre el historial en orden cronológico y marca, por cada
    // dispositivo distinto, la fecha de su PRIMERA aparición — luego cuenta
    // cuántas de esas primeras apariciones caen dentro de la ventana
    // reciente (incluye el dispositivo actual si es nuevo: su primera
    // aparición es ahora mismo).
    let dispositivosNuevosEnVentana = 0;
    {
      const vistos = new Set<string>();
      const corte = Date.now() - VENTANA_DISPOSITIVOS_NUEVOS_MS;
      for (const fila of historial) {
        const m = /💻 (.+?) ·/.exec(fila.detalle || "");
        if (!m) continue;
        const disp = m[1];
        if (!vistos.has(disp)) {
          vistos.add(disp);
          if (new Date(fila.fecha).getTime() >= corte) dispositivosNuevosEnVentana++;
        }
      }
      if (dispositivoNuevo && !vistos.has(dispositivo)) dispositivosNuevosEnVentana++;
    }
    const muchosDispositivosNuevos = dispositivosNuevosEnVentana >= UMBRAL_DISPOSITIVOS_NUEVOS;

    if (!dispositivoNuevo && !horarioInusual && !muchosDispositivosNuevos) {
      return json({ ok: true, nuevo: false });
    }

    const cfgR = await admin.from("configuracion").select("alertaEmails,alertaWhatsApp").limit(1);
    const cfgRow = cfgR.data?.[0] || {};
    const emails = String(cfgRow.alertaEmails || "").split(",").map((s: string) => s.trim()).filter(Boolean);
    const whatsapps = String(cfgRow.alertaWhatsApp || "").split(",").map((s: string) => s.trim()).filter(Boolean);

    const nombreVisible = email;
    const ahora = new Date();
    const fechaTxt = ahora.toLocaleString("es-CL", { timeZone: "America/Santiago" });

    // Lista de motivos, en texto — arma tanto el asunto como el cuerpo a
    // partir de las mismas señales, para no repetir la lógica de "qué pasó".
    const motivos: string[] = [];
    if (dispositivoNuevo) motivos.push(`Dispositivo nuevo: <b>${dispositivo}</b>`);
    if (horarioInusual) motivos.push(`Horario fuera de lo habitual para esta cuenta`);
    if (muchosDispositivosNuevos) motivos.push(`${dispositivosNuevosEnVentana} dispositivos nuevos distintos en los últimos 7 días`);

    const asunto = `🔐 Actividad inusual — ${nombreVisible} (${dispositivo})`;
    const html =
      `<h2>🔐 SistemaMP Centinela — actividad inusual</h2>` +
      `<p><b>${nombreVisible}</b> inició sesión y se detectó lo siguiente:</p>` +
      `<ul>${motivos.map((m) => `<li>${m}</li>`).join("")}</ul>` +
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
      const motivosTexto = motivos.map((m) => "- " + m.replace(/<[^>]+>/g, "")).join("\n");
      const textoWhatsApp =
        `🔐 *SistemaMP Centinela* — actividad inusual\n\n${nombreVisible} inició sesión desde ${dispositivo}.\n${motivosTexto}\n${fechaTxt} (hora Chile)\n\n` +
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

    return json({
      ok: true,
      nuevo: dispositivoNuevo,
      horarioInusual,
      muchosDispositivosNuevos,
      emailEnviado,
      whatsapp: whatsappResultados,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
