import { assertEquals, assert } from "jsr:@std/assert@1";
import { TABLAS, PASO, traerTodasLasFilas } from "./index.ts";

// ---- TABLAS ----
// Lista manual a propósito (mismo criterio que TABLA_REAL en
// modules/store.js) — este test no puede verificar que coincide con la
// base real (eso requeriría credenciales), pero sí guarda contra los
// errores mecánicos que ya causaron el "grave" de la auditoría 2026-09-07
// (tablas nuevas nunca sumadas acá, backup incompleto en silencio):
// duplicados, entradas vacías, y un cambio de tamaño no intencional.

Deno.test("TABLAS: no tiene duplicados", () => {
  assertEquals(new Set(TABLAS).size, TABLAS.length);
});

Deno.test("TABLAS: ninguna entrada vacía ni con espacios", () => {
  for (const t of TABLAS) {
    assert(t.length > 0, `entrada vacía en TABLAS`);
    assertEquals(t, t.trim());
  }
});

Deno.test("TABLAS: incluye las tablas que la auditoría 2026-09-07 encontró faltando", () => {
  // Estas 7 se agregaron después de crearse la tabla original y quedaron
  // fuera del respaldo diario en silencio hasta esa auditoría — regresión
  // real, no hipotética.
  const criticas = [
    "historial_componentes", "historial_neumaticos", "salud_flota_historico",
    "correctivos_historico", "gestion_compras", "compromisos", "uso_pestanas",
  ];
  for (const t of criticas) assert(TABLAS.includes(t), `falta ${t} en TABLAS`);
});

Deno.test("TABLAS: tamaño esperado (49) — cambiar a propósito si se agrega una tabla real nueva", () => {
  assertEquals(TABLAS.length, 49);
});

// ---- traerTodasLasFilas ----
// Cliente Supabase falso: simula .from(tabla).select('*').range(a,b) sin
// tocar ninguna red, para probar la lógica real de paginación (PASO=500,
// sigue pidiendo hasta una página incompleta).

function fakeSupabase(filas: unknown[], onRange?: (desde: number, hasta: number) => void) {
  return {
    from(_tabla: string) {
      return {
        select(_cols: string) {
          return {
            range(desde: number, hasta: number) {
              onRange?.(desde, hasta);
              return Promise.resolve({ data: filas.slice(desde, hasta + 1), error: null });
            },
          };
        },
      };
    },
  };
}

Deno.test("traerTodasLasFilas: una sola página cuando hay menos filas que PASO", async () => {
  const filas = Array.from({ length: 10 }, (_, i) => ({ id: i }));
  let llamadas = 0;
  const supabase = fakeSupabase(filas, () => llamadas++);
  const resultado = await traerTodasLasFilas(supabase, "equipos");
  assertEquals(resultado.length, 10);
  assertEquals(llamadas, 1);
});

Deno.test("traerTodasLasFilas: sigue pidiendo páginas hasta una incompleta", async () => {
  const filas = Array.from({ length: PASO * 2 + 200 }, (_, i) => ({ id: i })); // 1200 filas
  let llamadas = 0;
  const supabase = fakeSupabase(filas, () => llamadas++);
  const resultado = await traerTodasLasFilas(supabase, "correctivos");
  assertEquals(resultado.length, PASO * 2 + 200);
  assertEquals(llamadas, 3); // 500 + 500 + 200(incompleta, corta el loop)
});

Deno.test("traerTodasLasFilas: exactamente un múltiplo de PASO pide una página extra vacía para confirmar el corte", async () => {
  const filas = Array.from({ length: PASO }, (_, i) => ({ id: i })); // exactamente 500
  let llamadas = 0;
  const supabase = fakeSupabase(filas, () => llamadas++);
  const resultado = await traerTodasLasFilas(supabase, "cambios");
  assertEquals(resultado.length, PASO);
  assertEquals(llamadas, 2);
});

Deno.test("traerTodasLasFilas: tabla vacía da arreglo vacío en una sola llamada", async () => {
  let llamadas = 0;
  const supabase = fakeSupabase([], () => llamadas++);
  const resultado = await traerTodasLasFilas(supabase, "papelera");
  assertEquals(resultado, []);
  assertEquals(llamadas, 1);
});

Deno.test("traerTodasLasFilas: un error de Postgrest se propaga con el nombre de la tabla", async () => {
  const supabase = {
    from(_tabla: string) {
      return { select: (_c: string) => ({ range: (_a: number, _b: number) => Promise.resolve({ data: null, error: { message: "permiso denegado" } }) }) };
    },
  };
  let error: Error | null = null;
  try {
    await traerTodasLasFilas(supabase, "user_roles");
  } catch (e) {
    error = e as Error;
  }
  assert(error);
  assert(error!.message.includes("user_roles"));
  assert(error!.message.includes("permiso denegado"));
});
