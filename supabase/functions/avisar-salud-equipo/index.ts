// ============================================================
// avisar-salud-equipo — SistemaMP Centinela
// Aviso PROACTIVO por correo (Resend) y WhatsApp (Twilio) cuando un equipo
// cruza a Salud Baja (Score < 70%) o cae fuerte en la semana (≥15 pts vs
// hace 7 días) — sin esperar el resumen diario de alerta-pm ni que alguien
// abra el Dashboard para notarlo.
//
// El SCORE en sí (Score de Salud del Equipo, scoreSaludEquipo en logic.js)
// NO se recalcula acá: lo manda ya calculado el Dashboard (que corre en el
// navegador, con acceso a compEstado/neuDebeCambiar/confiabilidadReal). Es
// el mismo criterio que ya usa alerta-pm (ver su comentario del
// 2026-08-01): portar ese cálculo a Deno duplicaría la lógica y arriesgaría
// un número que no coincida con lo que se ve en pantalla — acá solo se
// confía en el número que ya se mostró, y se manda el aviso.
//
// Dedup: máximo UN aviso por equipo por día calendario (cualquier motivo),
// verificado contra 'changelog' — así no importa si dos personas abren el
// Dashboard el mismo día en computadores distintos, o si el mismo equipo
// sigue con score bajo varios días seguidos: solo se avisa una vez.
//
// Reusa exactamente los mismos secrets y destinatarios que alerta-pm
// (RESEND_API_KEY, ALERTA_PM_REMITENTE, TWILIO_ACCOUNT_SID/AUTH_TOKEN/
// WHATSAPP_FROM, configuracion.alertaEmails/alertaWhatsApp) — no hace falta
// configurar nada nuevo aparte.
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
    const sigla = String(body.sigla ?? "").trim();
    const score = body.score;
    const motivo = body.motivo === "caida" ? "caida" : "cruce";
    const delta = typeof body.delta === "number" && isFinite(body.delta) ? body.delta : null;
    // Causa principal — la dimensión más afectada (motivoPrincipalSalud, ya
    // decidida en el cliente con logic.js), para poder decir "por qué" en el
    // aviso en vez de solo el número. Opcional: si no llega, el mensaje queda
    // genérico (nunca se inventa una causa acá).
    const causaNombre = body.causa && typeof body.causa.nombre === "string" ? body.causa.nombre : null;
    const causaValor = body.causa && typeof body.causa.valor === "number" && isFinite(body.causa.valor) ? body.causa.valor : null;

    if (!sigla) return json({ error: "Falta sigla." }, 400);
    if (typeof score !== "number" || !isFinite(score)) return json({ error: "Falta score válido." }, 400);

    const hoy = new Date().toISOString().slice(0, 10);
    const marcaDedup = `${sigla}|${hoy}|`;

    const dup = await admin
      .from("changelog")
      .select("id")
      .eq("accion", "Alerta salud equipo")
      .like("detalle", `${marcaDedup}%`)
      .limit(1);
    if (dup.data && dup.data.length > 0) {
      return json({ ok: true, yaAvisado: true });
    }

    const cfgR = await admin.from("configuracion").select("alertaEmails,alertaWhatsApp").limit(1);
    const cfgRow = cfgR.data?.[0] || {};
    const emails = String(cfgRow.alertaEmails || "").split(",").map((s: string) => s.trim()).filter(Boolean);
    const whatsapps = String(cfgRow.alertaWhatsApp || "").split(",").map((s: string) => s.trim()).filter(Boolean);

    const motivoTxt = motivo === "caida"
      ? `bajó ${Math.abs(delta ?? 0)} puntos en la última semana`
      : "cruzó a Salud Baja (bajo 70%)";
    // "Por qué" en lenguaje simple — la señal más afectada, si llegó del
    // cliente (causaNombre/causaValor). Sin causa, el mensaje sigue siendo
    // igual de correcto, solo más genérico.
    const causaTxt = causaNombre ? ` La señal más afectada es ${causaNombre}${causaValor != null ? ` (${causaValor}%)` : ""}.` : "";
    const asunto = `🩺 ${sigla} ${motivoTxt} — Score ${score}%`;
    const html =
      `<h2>🩺 SistemaMP Centinela — alerta de salud de equipo</h2>` +
      `<p><b>${sigla}</b> ${motivoTxt}. Score de Salud actual: <b>${score}%</b>.${causaTxt}</p>` +
      `<p>Revisa el detalle en el sistema, pestaña Buscar → ${sigla}.</p>` +
      `<p style="color:#888;font-size:12px;margin-top:16px">Alerta automática de SistemaMP Centinela.</p>`;

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

    // WhatsApp (Twilio) — best-effort, igual que en alerta-pm: si faltan
    // credenciales o destinatarios, se omite sin afectar el correo de arriba.
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");
    let whatsappResultados: { numero: string; ok: boolean }[] = [];
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_FROM && whatsapps.length > 0) {
      const textoWhatsApp =
        `🩺 *SistemaMP Centinela*\n\n${sigla} ${motivoTxt}.\nScore de Salud: ${score}%\n${causaTxt}\n\n` +
        `Detalle en el sistema, pestaña Buscar → ${sigla}.`;
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

    // Se registra SIEMPRE, incluso si ambos canales fallaron — así el dedup
    // sigue funcionando (no se reintenta en bucle todo el día si Resend/
    // Twilio están caídos; el próximo aviso real recién será mañana).
    await admin.from("changelog").insert({
      fecha: new Date().toISOString(),
      usuario: callerData.user.email || callerData.user.id,
      accion: "Alerta salud equipo",
      detalle: `${marcaDedup}motivo=${motivo}|score=${score}` + (delta != null ? `|delta=${delta}` : "") +
        (causaNombre ? `|causa=${causaNombre}` : "") +
        ` — email:${emailEnviado ? "ok" : "no"} whatsapp:${whatsappResultados.filter((r) => r.ok).length}/${whatsappResultados.length}`,
    }).catch(() => {});

    return json({ ok: true, emailEnviado, whatsapp: whatsappResultados });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
