import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Duración del bloqueo de login al crear una cuenta nueva: 10 años.
// (Es una capa extra de seguridad para el login mismo; el control real
// de "quién está pendiente" se hace con la columna activo en user_roles,
// que es más confiable de consultar).
const BLOQUEO_DURACION = "87600h";

// Genera una contraseña que cumple la política de Supabase Auth configurada
// hoy (mínimo 14 caracteres, minúscula+mayúscula+dígito+símbolo). Garantiza
// al menos uno de cada clase de carácter y después mezcla el resultado.
//
// randomIndex usa crypto.getRandomValues, NO Math.random (corregido en
// auditoría 2026-08-06): una contraseña temporal sigue siendo un secreto
// real que da acceso a una cuenta real, aunque de corta vida (se fuerza a
// cambiarla en el primer login) — Math.random() no es un generador
// criptográficamente seguro, sus salidas se pueden llegar a predecir a
// partir de valores anteriores del mismo proceso.
function randomIndex(max: number) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}
function randomPassword(len = 18) {
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%^&*-_=+?";
  const all = lower + upper + digits + symbols;
  const pick = (s: string) => s[randomIndex(s.length)];
  const out = [pick(lower), pick(upper), pick(digits), pick(symbols)];
  while (out.length < len) out.push(pick(all));
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join("");
}

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

    // Verificar quién llama
    const { data: callerData, error: callerErr } = await admin.auth.getUser(callerToken);
    if (callerErr || !callerData?.user) return json({ error: "Token inválido." }, 401);

    // Verificar que quien llama es admin (tabla user_roles)
    const { data: callerRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerData.user.id)
      .single();

    if (!callerRole || callerRole.role !== "admin") {
      return json({ error: "Solo un administrador puede gestionar usuarios." }, 403);
    }

    const body = await req.json();
    const action = body.action;

    // ---------- CREAR (queda bloqueado, activo=false) ----------
    if (action === "crear") {
      const { nombre, email, rol } = body;
      if (!nombre || !email || !rol) return json({ error: "Faltan datos (nombre, email, rol)." }, 400);
      if (rol !== "admin" && rol !== "operador" && rol !== "lector") return json({ error: "Rol inválido." }, 400);

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: randomPassword(),
        email_confirm: true,
        user_metadata: { must_change_password: true, nombre },
      });
      if (createErr || !created?.user) {
        return json({ error: createErr?.message || "No se pudo crear el usuario." }, 400);
      }

      // Bloquear el login a nivel de Auth (capa de seguridad extra)
      await admin.auth.admin.updateUserById(created.user.id, { ban_duration: BLOQUEO_DURACION });

      // Fuente de verdad para "pendiente de activar": activo=false en user_roles
      const { error: roleErr } = await admin.from("user_roles").insert({
        user_id: created.user.id,
        role: rol,
        nombre,
        activo: false,
      });
      if (roleErr) return json({ error: "Usuario creado pero falló asignar el rol: " + roleErr.message }, 500);

      return json({ ok: true, userId: created.user.id });
    }

    // ---------- LISTAR PENDIENTES ----------
    if (action === "listar_pendientes") {
      const { data: rolesRows, error: rolesErr } = await admin
        .from("user_roles")
        .select("user_id, role, nombre")
        .eq("activo", false);
      if (rolesErr) return json({ error: "No se pudo consultar pendientes: " + rolesErr.message }, 500);

      const pendientes = (rolesRows || []).map((r) => ({ userId: r.user_id, nombre: r.nombre, rol: r.role }));
      return json({ ok: true, pendientes });
    }

    // ---------- LISTAR ACTIVOS ----------
    if (action === "listar_activos") {
      const { data: rolesRows, error: rolesErr } = await admin
        .from("user_roles")
        .select("user_id, role, nombre")
        .eq("activo", true);
      if (rolesErr) return json({ error: "No se pudo consultar activos: " + rolesErr.message }, 500);

      // Se consulta si cada uno tiene verificación en dos pasos activada
      // (para saber si mostrarle al admin el botón de recuperación) — son
      // pocos usuarios, así que una consulta por usuario es aceptable.
      const activos = await Promise.all((rolesRows || []).map(async (r) => {
        const { data: ud } = await admin.auth.admin.getUserById(r.user_id);
        const mfaActivo = ((ud?.user?.factors) || []).some(
          (f: { factor_type: string; status: string }) => f.factor_type === "totp" && f.status === "verified"
        );
        return { userId: r.user_id, nombre: r.nombre, rol: r.role, mfaActivo };
      }));
      return json({ ok: true, activos });
    }

    // ---------- DESACTIVAR VERIFICACIÓN EN DOS PASOS DE OTRO USUARIO ----------
    // Vía de recuperación para "perdí el teléfono / cambié de teléfono": sin
    // esto, un usuario con el segundo factor activado y sin acceso a su app
    // autenticadora queda bloqueado sin ninguna forma de recuperar la cuenta
    // desde el sistema (el auto-servicio de Configuración exige la sesión ya
    // autenticada, que es precisamente lo que no puede lograr en ese caso).
    if (action === "desactivar_mfa") {
      const { userId, nombre } = body;
      if (!userId) return json({ error: "Falta userId." }, 400);

      const { data: targetData, error: targetErr } = await admin.auth.admin.getUserById(userId);
      if (targetErr || !targetData?.user) return json({ error: "Usuario no encontrado." }, 404);

      const factores = (targetData.user.factors || []).filter(
        (f: { factor_type: string }) => f.factor_type === "totp"
      );
      if (!factores.length) {
        return json({ error: "Ese usuario no tiene verificación en dos pasos activada." }, 400);
      }

      for (const f of factores as { id: string }[]) {
        const { error: delErr } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId });
        if (delErr) return json({ error: "No se pudo desactivar: " + delErr.message }, 500);
      }

      await admin.from("changelog").insert({
        fecha: new Date().toISOString(),
        usuario: callerData.user.email || callerData.user.id,
        accion: "MFA desactivado por admin",
        detalle: "Se desactivó la verificación en dos pasos de " + String(nombre ?? "").slice(0, 100) +
          " (userId " + userId + ") — usado como recuperación de cuenta bloqueada.",
      }).catch(() => {});

      return json({ ok: true });
    }

    // ---------- ACTIVAR ----------
    if (action === "activar") {
      const { userId } = body;
      if (!userId) return json({ error: "Falta userId." }, 400);

      const tempPassword = randomPassword();
      const { error: actErr } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: "none",
        password: tempPassword,
      });
      if (actErr) return json({ error: "No se pudo activar: " + actErr.message }, 500);

      const { error: activoErr } = await admin.from("user_roles").update({ activo: true }).eq("user_id", userId);
      if (activoErr) return json({ error: "Se activó el login pero no se pudo marcar activo: " + activoErr.message }, 500);

      return json({ ok: true, tempPassword });
    }

    // ---------- DESACTIVAR ----------
    if (action === "desactivar") {
      const { userId } = body;
      if (!userId) return json({ error: "Falta userId." }, 400);

      if (userId === callerData.user.id) {
        return json({ error: "No puedes desactivar tu propia cuenta." }, 400);
      }

      const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: BLOQUEO_DURACION,
      });
      if (banErr) return json({ error: "No se pudo bloquear el login: " + banErr.message }, 500);

      const { error: activoErr } = await admin.from("user_roles").update({ activo: false }).eq("user_id", userId);
      if (activoErr) return json({ error: "Se bloqueó el login pero no se pudo marcar inactivo: " + activoErr.message }, 500);

      return json({ ok: true });
    }

    return json({ error: "Acción no reconocida." }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
