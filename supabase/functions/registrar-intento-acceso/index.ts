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
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
