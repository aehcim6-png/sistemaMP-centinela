// ============================================================
// restaurar-backup.ts — SistemaMP Centinela
//
// Script MANUAL de recuperación ante desastre — no es una Edge Function, no
// se despliega, no corre solo. Se ejecuta a mano (con Deno instalado
// aparte, ver docs/arquitectura.md) apuntando al PROYECTO SUPABASE NUEVO
// que reemplaza a uno perdido, usando su service_role key real.
//
// Nace de una investigación real (2026-09-11): "¿el respaldo diario
// (backup-diario) sirve para algo si el proyecto Supabase se pierde por
// completo?" — la respuesta era NO, por dos motivos que este script
// resuelve:
//   1. 8 de las 49 tablas nunca tuvieron CREATE TABLE en las migraciones
//      (se crearon a mano en el dashboard) — ver migración
//      20260911120000_formaliza_tablas_creadas_a_mano.sql, que cierra esto.
//   2. El respaldo nunca incluía las cuentas de Supabase Auth — restaurar
//      las 49 tablas perfecto dejaba el sistema sin ningún login posible.
//      backup-diario ahora también junta `usuariosAuth` (ver su código) —
//      este script es el que sabe qué hacer con eso.
//
// Qué SÍ hace:
//   - Recrea cada cuenta de Auth que falte en el proyecto nuevo (por email —
//     nunca por el user_id viejo, que ya no existe), con una contraseña
//     temporal (mismo generador que crear-operador) y
//     user_metadata.must_change_password=true (mismo patrón que el alta
//     normal de un operador).
//   - Reconstruye el mapeo user_id-viejo → user_id-nuevo y lo usa para
//     remapear `user_roles` antes de insertarla (nunca inserta el `id`
//     autoincremental original de user_roles — nada más en el sistema
//     referencia ese id, solo user_id, así que dejarlo autogenerar es más
//     simple y evita pelear con la secuencia).
//   - Inserta el resto de las 49 tablas tal cual, en un orden que respeta la
//     ÚNICA foreign key real de todo el esquema (destrabe → ordenes_compra).
//
// Qué NO puede hacer (y por qué):
//   - Recuperar contraseñas o secretos de MFA — la Admin API de Supabase
//     nunca los expone, ni al service_role. Cada persona debe cambiar su
//     contraseña temporal y volver a activar la verificación en dos pasos
//     si la tenía (el resumen final de este script dice a quién avisarle).
//
// Uso:
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=xxxx \
//   deno run --allow-net --allow-env --allow-read scripts/restaurar-backup.ts \
//     sistemamp-backup-2026-09-11.json.gz
//
// El archivo puede ser el .json.gz tal cual llega por correo, o el .json ya
// descomprimido — se detecta solo por la extensión.
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { randomPassword } from "../supabase/functions/crear-operador/index.ts";

export interface UsuarioAuthBackup {
  id: string;
  email: string | null;
  created_at: string;
  banned_until: string | null;
  user_metadata: Record<string, unknown>;
  mfaFactorTypes: string[];
}

export interface BackupCompleto {
  fecha: string;
  tablas: Record<string, Record<string, unknown>[]>;
  usuariosAuth: UsuarioAuthBackup[];
}

// Única foreign key real de las 49 tablas (confirmado por introspección de
// information_schema, 2026-09-11): destrabe.idOrdenCompra → ordenes_compra.id.
// Todo lo demás en este sistema usa referencias sueltas por texto (sigla),
// no FKs de verdad — por eso el orden de restauración del resto no importa.
export function ordenarTablasParaRestaurar(nombresTablas: string[]): string[] {
  const antes: string[] = [];
  const despues: string[] = [];
  const resto: string[] = [];
  for (const t of nombresTablas) {
    if (t === "ordenes_compra") antes.push(t);
    else if (t === "destrabe") despues.push(t);
    else resto.push(t);
  }
  return [...antes, ...resto, ...despues];
}

// Empareja por email (nunca por id — el id viejo no sobrevive a recrear la
// cuenta). minúsculas para no fallar por un email con mayúsculas distintas
// entre el respaldo y el estado real, mismo criterio que
// buscarUserIdPorEmail en registrar-intento-acceso.
export function construirMapaDeIds(
  usuariosBackup: { id: string; email: string | null }[],
  usuariosDestino: { id: string; email: string | null }[]
): Map<string, string> {
  const porEmailDestino = new Map<string, string>();
  for (const u of usuariosDestino) {
    if (u.email) porEmailDestino.set(u.email.toLowerCase(), u.id);
  }
  const mapa = new Map<string, string>();
  for (const u of usuariosBackup) {
    if (!u.email) continue;
    const nuevoId = porEmailDestino.get(u.email.toLowerCase());
    if (nuevoId) mapa.set(u.id, nuevoId);
  }
  return mapa;
}

// Remapea user_roles.user_id del id viejo (que ya no existe) al nuevo,
// y descarta el `id` autoincremental original — nada en el sistema
// referencia user_roles.id, solo user_roles.user_id, así que dejarlo
// autogenerar de nuevo es más simple que pelear con la secuencia.
export function remapearUserRoles(
  filas: Record<string, unknown>[],
  mapaIds: Map<string, string>
): { remapeadas: Record<string, unknown>[]; sinMapear: Record<string, unknown>[] } {
  const remapeadas: Record<string, unknown>[] = [];
  const sinMapear: Record<string, unknown>[] = [];
  for (const fila of filas) {
    const idViejo = fila.user_id as string | null;
    const idNuevo = idViejo ? mapaIds.get(idViejo) : undefined;
    if (!idNuevo) {
      sinMapear.push(fila);
      continue;
    }
    const { id: _id, ...resto } = fila;
    remapeadas.push({ ...resto, user_id: idNuevo });
  }
  return { remapeadas, sinMapear };
}

const TAMANO_LOTE = 500;
export function enLotes<T>(arr: T[], tamano: number = TAMANO_LOTE): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < arr.length; i += tamano) lotes.push(arr.slice(i, i + tamano));
  return lotes;
}

async function traerTodosLosUsuariosDestino(admin: ReturnType<typeof createClient>): Promise<{ id: string; email: string | null }[]> {
  const todos: { id: string; email: string | null }[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`No se pudo listar usuarios del proyecto destino: ${error.message}`);
    const usuarios = data?.users || [];
    todos.push(...usuarios.map((u) => ({ id: u.id, email: u.email ?? null })));
    if (usuarios.length < 200) break;
  }
  return todos;
}

async function leerBackup(ruta: string): Promise<BackupCompleto> {
  const bytes = await Deno.readFile(ruta);
  let jsonBytes = bytes;
  if (ruta.endsWith(".gz")) {
    const ds = new DecompressionStream("gzip");
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    jsonBytes = new Uint8Array(await new Response(ds.readable).arrayBuffer());
  }
  return JSON.parse(new TextDecoder().decode(jsonBytes));
}

export type ClienteAdminRestauracion = {
  auth: { admin: { listUsers: (o: { page: number; perPage: number }) => Promise<any>; createUser: (o: any) => Promise<any> } };
  from: (tabla: string) => { insert: (filas: unknown[]) => Promise<{ error: { message: string } | null }> };
};

// Orquesta la restauración completa contra un cliente admin ya conectado —
// separado de main() para poder probar TODO el flujo (no solo las funciones
// puras de arriba) contra un cliente falso, sin tocar ningún proyecto real.
export async function ejecutarRestauracion(
  admin: ClienteAdminRestauracion,
  backup: BackupCompleto
): Promise<{ resumen: string[]; recreados: { email: string; tempPassword: string; teniaMfa: boolean }[] }> {
  // ---- 1. Recrear cuentas de Auth que falten (por email) ----
  const usuariosDestinoAntes = await traerTodosLosUsuariosDestino(admin as any);
  const emailsDestino = new Set(usuariosDestinoAntes.map((u) => u.email?.toLowerCase()).filter(Boolean));
  const porRecrear = (backup.usuariosAuth || []).filter((u) => u.email && !emailsDestino.has(u.email.toLowerCase()));

  console.log(`Usuarios ya presentes en el destino: ${usuariosDestinoAntes.length}. A recrear: ${porRecrear.length}.`);
  const recreados: { email: string; tempPassword: string; teniaMfa: boolean }[] = [];
  for (const u of porRecrear) {
    const tempPassword = randomPassword();
    const { error } = await admin.auth.admin.createUser({
      email: u.email!,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { ...u.user_metadata, must_change_password: true, restaurado_desde_backup: backup.fecha },
    });
    if (error) {
      console.error(`  ERROR creando ${u.email}: ${error.message}`);
      continue;
    }
    recreados.push({ email: u.email!, tempPassword, teniaMfa: (u.mfaFactorTypes || []).length > 0 });
  }

  const usuariosDestinoDespues = await traerTodosLosUsuariosDestino(admin as any);
  const mapaIds = construirMapaDeIds(backup.usuariosAuth || [], usuariosDestinoDespues);

  // ---- 2. Restaurar las tablas, en el orden seguro ----
  const resumen: string[] = [];
  const nombresTablas = ordenarTablasParaRestaurar(Object.keys(backup.tablas));
  for (const tabla of nombresTablas) {
    let filas = backup.tablas[tabla];
    if (!filas || filas.length === 0) {
      resumen.push(`${tabla}: 0 filas (sin datos en el respaldo)`);
      continue;
    }
    if (tabla === "user_roles") {
      const { remapeadas, sinMapear } = remapearUserRoles(filas, mapaIds);
      if (sinMapear.length > 0) {
        console.warn(`  ${tabla}: ${sinMapear.length} fila(s) sin poder remapear (el usuario no se pudo recrear) — se omiten.`);
      }
      filas = remapeadas;
    }
    let insertadas = 0;
    let errores = 0;
    for (const lote of enLotes(filas)) {
      const { error } = await admin.from(tabla).insert(lote);
      if (error) {
        errores++;
        console.error(`  ERROR insertando en ${tabla}: ${error.message}`);
      } else {
        insertadas += lote.length;
      }
    }
    resumen.push(`${tabla}: ${insertadas} fila(s) restaurada(s)${errores ? ` (${errores} lote(s) con error)` : ""}`);
  }

  return { resumen, recreados };
}

async function main() {
  const ruta = Deno.args[0];
  if (!ruta) {
    console.error("Uso: deno run --allow-net --allow-env --allow-read scripts/restaurar-backup.ts <archivo-backup.json[.gz]>");
    Deno.exit(1);
  }
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY del proyecto DESTINO (el nuevo, no el perdido) como variables de entorno.");
    Deno.exit(1);
  }

  console.log(`Leyendo ${ruta}...`);
  const backup = await leerBackup(ruta);
  console.log(`Respaldo del ${backup.fecha}: ${Object.keys(backup.tablas).length} tablas, ${backup.usuariosAuth?.length ?? 0} usuarios.`);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { resumen, recreados } = await ejecutarRestauracion(admin as unknown as ClienteAdminRestauracion, backup);

  console.log("\n=== Resumen de la restauración ===");
  resumen.forEach((r) => console.log("  " + r));

  console.log("\n=== Cuentas recreadas (avisarles esto directamente, no queda en ningún log) ===");
  if (recreados.length === 0) {
    console.log("  (ninguna — todos los emails del respaldo ya existían en el destino)");
  }
  for (const r of recreados) {
    console.log(`  ${r.email} — contraseña temporal: ${r.tempPassword}${r.teniaMfa ? "  [ATENCIÓN: tenía 2FA activo, debe volver a activarlo]" : ""}`);
  }
  console.log("\nListo. Cada persona recreada debe cambiar su contraseña en el primer login (ya queda forzado) y, si tenía 2FA, volver a activarlo desde Configuración.");
}

if (import.meta.main) {
  main();
}
