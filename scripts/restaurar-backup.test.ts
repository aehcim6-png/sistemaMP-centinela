import { assertEquals, assert } from "jsr:@std/assert@1";
import {
  ordenarTablasParaRestaurar,
  construirMapaDeIds,
  remapearUserRoles,
  enLotes,
  ejecutarRestauracion,
  type BackupCompleto,
  type ClienteAdminRestauracion,
} from "./restaurar-backup.ts";

// ---- ordenarTablasParaRestaurar ----
// Única FK real de las 49 tablas: destrabe.idOrdenCompra -> ordenes_compra.id.
// ordenes_compra debe insertarse antes, destrabe después; el resto no importa.

Deno.test("ordenarTablasParaRestaurar: ordenes_compra queda antes, destrabe queda después", () => {
  const orden = ordenarTablasParaRestaurar(["destrabe", "equipos", "ordenes_compra", "pautas"]);
  assertEquals(orden, ["ordenes_compra", "equipos", "pautas", "destrabe"]);
});

Deno.test("ordenarTablasParaRestaurar: sin destrabe ni ordenes_compra no cambia el orden relativo del resto", () => {
  const orden = ordenarTablasParaRestaurar(["equipos", "pautas", "correctivos"]);
  assertEquals(orden, ["equipos", "pautas", "correctivos"]);
});

Deno.test("ordenarTablasParaRestaurar: mantiene todas las tablas (ninguna se pierde ni se duplica)", () => {
  const entrada = ["kv", "destrabe", "user_roles", "ordenes_compra", "equipos"];
  const orden = ordenarTablasParaRestaurar(entrada);
  assertEquals(new Set(orden), new Set(entrada));
  assertEquals(orden.length, entrada.length);
});

// ---- construirMapaDeIds ----
// Empareja por email (nunca por id viejo, que no sobrevive a recrear la cuenta).

Deno.test("construirMapaDeIds: empareja usuarios del backup con los del destino por email", () => {
  const mapa = construirMapaDeIds(
    [{ id: "viejo-1", email: "admin@test.com" }, { id: "viejo-2", email: "op@test.com" }],
    [{ id: "nuevo-1", email: "admin@test.com" }, { id: "nuevo-2", email: "op@test.com" }]
  );
  assertEquals(mapa.get("viejo-1"), "nuevo-1");
  assertEquals(mapa.get("viejo-2"), "nuevo-2");
});

Deno.test("construirMapaDeIds: compara emails sin distinguir mayúsculas/minúsculas", () => {
  const mapa = construirMapaDeIds(
    [{ id: "viejo-1", email: "Admin@Test.com" }],
    [{ id: "nuevo-1", email: "admin@test.com" }]
  );
  assertEquals(mapa.get("viejo-1"), "nuevo-1");
});

Deno.test("construirMapaDeIds: usuario sin email en el backup se ignora, no revienta", () => {
  const mapa = construirMapaDeIds(
    [{ id: "viejo-1", email: null }],
    [{ id: "nuevo-1", email: "admin@test.com" }]
  );
  assertEquals(mapa.size, 0);
});

Deno.test("construirMapaDeIds: usuario del backup sin contraparte en el destino queda sin mapear", () => {
  const mapa = construirMapaDeIds(
    [{ id: "viejo-1", email: "fantasma@test.com" }],
    [{ id: "nuevo-1", email: "admin@test.com" }]
  );
  assertEquals(mapa.has("viejo-1"), false);
});

// ---- remapearUserRoles ----

Deno.test("remapearUserRoles: remapea user_id y descarta el id autoincremental viejo", () => {
  const mapa = new Map([["viejo-1", "nuevo-1"]]);
  const { remapeadas, sinMapear } = remapearUserRoles(
    [{ id: 7, user_id: "viejo-1", role: "admin", activo: true }],
    mapa
  );
  assertEquals(sinMapear.length, 0);
  assertEquals(remapeadas, [{ user_id: "nuevo-1", role: "admin", activo: true }]);
  assertEquals(Object.keys(remapeadas[0]).includes("id"), false);
});

Deno.test("remapearUserRoles: fila cuyo usuario no se pudo recrear va a sinMapear, no se pierde en silencio", () => {
  const mapa = new Map<string, string>();
  const { remapeadas, sinMapear } = remapearUserRoles(
    [{ id: 1, user_id: "viejo-fantasma", role: "lector", activo: true }],
    mapa
  );
  assertEquals(remapeadas.length, 0);
  assertEquals(sinMapear.length, 1);
});

Deno.test("remapearUserRoles: user_id null va a sinMapear en vez de romper", () => {
  const mapa = new Map([["viejo-1", "nuevo-1"]]);
  const { remapeadas, sinMapear } = remapearUserRoles(
    [{ id: 2, user_id: null, role: "admin", activo: true }],
    mapa
  );
  assertEquals(remapeadas.length, 0);
  assertEquals(sinMapear.length, 1);
});

// ---- enLotes ----

Deno.test("enLotes: arreglo más chico que el tamaño de lote da un solo lote", () => {
  const lotes = enLotes([1, 2, 3], 500);
  assertEquals(lotes, [[1, 2, 3]]);
});

Deno.test("enLotes: parte en lotes exactos cuando es múltiplo del tamaño", () => {
  const arr = Array.from({ length: 1000 }, (_, i) => i);
  const lotes = enLotes(arr, 500);
  assertEquals(lotes.length, 2);
  assertEquals(lotes[0].length, 500);
  assertEquals(lotes[1].length, 500);
});

Deno.test("enLotes: último lote incompleto conserva el resto", () => {
  const arr = Array.from({ length: 1200 }, (_, i) => i);
  const lotes = enLotes(arr, 500);
  assertEquals(lotes.length, 3);
  assertEquals(lotes[2].length, 200);
});

Deno.test("enLotes: arreglo vacío da cero lotes", () => {
  assertEquals(enLotes([], 500), []);
});

Deno.test("enLotes: usa 500 como tamaño por defecto", () => {
  const arr = Array.from({ length: 600 }, (_, i) => i);
  const lotes = enLotes(arr);
  assertEquals(lotes.length, 2);
  assertEquals(lotes[0].length, 500);
  assertEquals(lotes[1].length, 100);
});

// ---- ejecutarRestauracion (flujo completo, cliente admin falso) ----
// No hay credenciales reales de un proyecto Supabase disponibles en este
// entorno para probar contra infraestructura real — este test ejercita el
// flujo ENTERO (no solo las funciones puras de arriba) contra un cliente
// admin falso que imita fielmente la forma de supabase-js
// (auth.admin.listUsers/createUser, from().insert()), cubriendo cada rama:
// usuario que ya existe (no se recrea), usuario que falta (se recrea con
// contraseña temporal), user_roles remapeado por email, orden FK-safe
// (ordenes_compra antes de destrabe), y un error de insert que no corta el
// resto de las tablas.

function fakeAdmin(usuariosExistentes: { id: string; email: string }[]) {
  const usuarios = [...usuariosExistentes];
  let contadorNuevos = 0;
  const insertsPorTabla: Record<string, unknown[][]> = {};
  const admin: ClienteAdminRestauracion & { _usuarios: typeof usuarios; _inserts: typeof insertsPorTabla } = {
    _usuarios: usuarios,
    _inserts: insertsPorTabla,
    auth: {
      admin: {
        listUsers({ page, perPage }: { page: number; perPage: number }) {
          const desde = (page - 1) * perPage;
          const pagina = usuarios.slice(desde, desde + perPage);
          return Promise.resolve({ data: { users: pagina }, error: null });
        },
        createUser(o: { email: string }) {
          contadorNuevos++;
          usuarios.push({ id: `nuevo-${contadorNuevos}`, email: o.email });
          return Promise.resolve({ data: {}, error: null });
        },
      },
    },
    from(tabla: string) {
      return {
        insert(filas: unknown[]) {
          if (tabla === "tabla_rota") {
            return Promise.resolve({ error: { message: "columna inexistente" } });
          }
          (insertsPorTabla[tabla] ||= []).push(filas);
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return admin;
}

Deno.test("ejecutarRestauracion: usuario ya presente en el destino NO se recrea", async () => {
  const admin = fakeAdmin([{ id: "existente-1", email: "admin@test.com" }]);
  const backup: BackupCompleto = {
    fecha: "2026-09-11",
    tablas: {},
    usuariosAuth: [{ id: "viejo-1", email: "admin@test.com", created_at: "2026-01-01", banned_until: null, user_metadata: {}, mfaFactorTypes: [] }],
  };
  const { recreados } = await ejecutarRestauracion(admin, backup);
  assertEquals(recreados.length, 0);
  assertEquals(admin._usuarios.length, 1);
});

Deno.test("ejecutarRestauracion: usuario faltante se recrea con contraseña temporal y avisa si tenía MFA", async () => {
  const admin = fakeAdmin([]);
  const backup: BackupCompleto = {
    fecha: "2026-09-11",
    tablas: {},
    usuariosAuth: [{ id: "viejo-1", email: "op@test.com", created_at: "2026-01-01", banned_until: null, user_metadata: {}, mfaFactorTypes: ["totp"] }],
  };
  const { recreados } = await ejecutarRestauracion(admin, backup);
  assertEquals(recreados.length, 1);
  assertEquals(recreados[0].email, "op@test.com");
  assertEquals(recreados[0].teniaMfa, true);
  assert(recreados[0].tempPassword.length >= 8);
});

Deno.test("ejecutarRestauracion: remapea user_roles por email a los IDs nuevos y restaura las demás tablas en orden FK-safe", async () => {
  const admin = fakeAdmin([{ id: "existente-1", email: "admin@test.com" }]);
  const backup: BackupCompleto = {
    fecha: "2026-09-11",
    tablas: {
      destrabe: [{ id: "d1", idOrdenCompra: "oc1" }],
      ordenes_compra: [{ id: "oc1", monto: 1000 }],
      user_roles: [{ id: 1, user_id: "viejo-1", role: "admin", activo: true }],
    },
    usuariosAuth: [{ id: "viejo-1", email: "admin@test.com", created_at: "2026-01-01", banned_until: null, user_metadata: {}, mfaFactorTypes: [] }],
  };
  const { resumen } = await ejecutarRestauracion(admin, backup);

  assertEquals(admin._inserts["user_roles"][0], [{ user_id: "existente-1", role: "admin", activo: true }]);

  const ordenTablas = resumen.map((r) => r.split(":")[0]);
  const idxOC = ordenTablas.indexOf("ordenes_compra");
  const idxDestrabe = ordenTablas.indexOf("destrabe");
  assert(idxOC < idxDestrabe, "ordenes_compra debe restaurarse antes que destrabe");
});

Deno.test("ejecutarRestauracion: fila de user_roles sin usuario recreable se omite pero no rompe la restauración", async () => {
  const admin = fakeAdmin([]);
  const backup: BackupCompleto = {
    fecha: "2026-09-11",
    tablas: { user_roles: [{ id: 1, user_id: "fantasma", role: "admin", activo: true }] },
    usuariosAuth: [],
  };
  const { resumen } = await ejecutarRestauracion(admin, backup);
  assertEquals(admin._inserts["user_roles"], undefined);
  assert(resumen[0].startsWith("user_roles: 0 fila"));
});

Deno.test("ejecutarRestauracion: un error de insert en una tabla no corta la restauración del resto", async () => {
  const admin = fakeAdmin([]);
  const backup: BackupCompleto = {
    fecha: "2026-09-11",
    tablas: { tabla_rota: [{ x: 1 }], equipos: [{ sigla: "TI-1" }] },
    usuariosAuth: [],
  };
  const { resumen } = await ejecutarRestauracion(admin, backup);
  const resumenTablaRota = resumen.find((r) => r.startsWith("tabla_rota"))!;
  assert(resumenTablaRota.includes("error"));
  assertEquals(admin._inserts["equipos"][0], [{ sigla: "TI-1" }]);
});
