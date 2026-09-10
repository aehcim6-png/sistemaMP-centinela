// Tests de las funciones puras/testeables de esta Edge Function.
//
// Cómo correrlos (requiere Deno instalado — NO se agrega como dependencia
// del proyecto npm; ver docs/arquitectura.md sección "Tests Deno"):
//   deno test --allow-net --allow-env --no-check --config deno.json \
//     supabase/functions/registrar-intento-acceso/index.test.ts
//
// El archivo bajo test hace `Deno.serve(...)` a nivel de módulo, pero
// envuelto en `if (import.meta.main)` — al importarlo desde acá (un
// módulo distinto) esa condición es false, así que NO se levanta un
// servidor HTTP real como efecto secundario de este import.
import { assertEquals } from "jsr:@std/assert@1";
import type { createClient } from "npm:@supabase/supabase-js@2";
import {
  recortar,
  cruzaUmbralRafaga,
  verificarTurnstile,
  buscarUserIdPorEmail,
} from "./index.ts";

// ---- recortar ----

Deno.test("recortar: corta al máximo indicado", () => {
  assertEquals(recortar("holaMundo", 4), "hola");
});

Deno.test("recortar: no toca strings más cortos que el máximo", () => {
  assertEquals(recortar("hola", 100), "hola");
});

Deno.test("recortar: valores no confiables (null/undefined/objeto) nunca rompen, caen a string", () => {
  assertEquals(recortar(null, 10), "");
  assertEquals(recortar(undefined, 10), "");
  assertEquals(recortar(123, 10), "123");
});

// ---- cruzaUmbralRafaga ----
// Regla exacta: dispara SOLO al cruzar el umbral (===), nunca antes ni
// en los intentos siguientes — si disparara con >=, cada intento nuevo
// después del quinto volvería a avisar/bloquear innecesariamente.

Deno.test("cruzaUmbralRafaga: false antes de llegar al umbral", () => {
  assertEquals(cruzaUmbralRafaga(0), false);
  assertEquals(cruzaUmbralRafaga(4), false);
});

Deno.test("cruzaUmbralRafaga: true justo al cruzar el umbral (5)", () => {
  assertEquals(cruzaUmbralRafaga(5), true);
});

Deno.test("cruzaUmbralRafaga: false en intentos posteriores al umbral (no repite la alerta)", () => {
  assertEquals(cruzaUmbralRafaga(6), false);
  assertEquals(cruzaUmbralRafaga(50), false);
});

// ---- verificarTurnstile ----

Deno.test("verificarTurnstile: token válido devuelve true", async () => {
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }))) as typeof fetch;
  try {
    const ok = await verificarTurnstile("secret", "token-valido", "1.2.3.4");
    assertEquals(ok, true);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

Deno.test("verificarTurnstile: token inválido (success:false) devuelve false", async () => {
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.resolve(new Response(JSON.stringify({ success: false }), { status: 200 }))) as typeof fetch;
  try {
    const ok = await verificarTurnstile("secret", "token-malo", null);
    assertEquals(ok, false);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

Deno.test("verificarTurnstile: respuesta HTTP no-ok de Cloudflare devuelve false", async () => {
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = (() => Promise.resolve(new Response("error", { status: 500 }))) as typeof fetch;
  try {
    const ok = await verificarTurnstile("secret", "token", null);
    assertEquals(ok, false);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

Deno.test("verificarTurnstile: si fetch lanza excepción (red caída), devuelve false y no propaga", async () => {
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = (() => Promise.reject(new Error("network down"))) as typeof fetch;
  try {
    const ok = await verificarTurnstile("secret", "token", null);
    assertEquals(ok, false);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

// ---- buscarUserIdPorEmail ----
// Stub mínimo del cliente admin de Supabase — solo implementa
// auth.admin.listUsers, que es lo único que usa esta función.
function stubAdmin(paginas: Array<Array<{ id: string; email: string }>>) {
  return {
    auth: {
      admin: {
        listUsers: ({ page }: { page: number; perPage: number }) => {
          const users = paginas[page - 1] || [];
          return Promise.resolve({ data: { users }, error: null });
        },
      },
    },
  } as unknown as ReturnType<typeof createClient>;
}

Deno.test("buscarUserIdPorEmail: encuentra el id en la primera página", async () => {
  const admin = stubAdmin([[{ id: "abc-1", email: "admin@test.com" }]]);
  const id = await buscarUserIdPorEmail(admin, "admin@test.com");
  assertEquals(id, "abc-1");
});

Deno.test("buscarUserIdPorEmail: la comparación de email no distingue mayúsculas/minúsculas", async () => {
  const admin = stubAdmin([[{ id: "abc-1", email: "Admin@Test.com" }]]);
  const id = await buscarUserIdPorEmail(admin, "admin@test.com");
  assertEquals(id, "abc-1");
});

Deno.test("buscarUserIdPorEmail: sigue paginando hasta encontrar el email", async () => {
  const paginaLlena = Array.from({ length: 200 }, (_, i) => ({ id: `pagina1-${i}`, email: `u${i}@test.com` }));
  const admin = stubAdmin([paginaLlena, [{ id: "en-pagina-2", email: "buscado@test.com" }]]);
  const id = await buscarUserIdPorEmail(admin, "buscado@test.com");
  assertEquals(id, "en-pagina-2");
});

Deno.test("buscarUserIdPorEmail: devuelve null si el email no corresponde a ninguna cuenta", async () => {
  const admin = stubAdmin([[{ id: "abc-1", email: "otro@test.com" }]]);
  const id = await buscarUserIdPorEmail(admin, "inexistente@test.com");
  assertEquals(id, null);
});

Deno.test("buscarUserIdPorEmail: nunca pasa de 10 páginas (tope defensivo)", async () => {
  let llamadas = 0;
  const admin = {
    auth: {
      admin: {
        listUsers: () => {
          llamadas++;
          const paginaLlena = Array.from({ length: 200 }, (_, i) => ({ id: `x${i}`, email: `x${i}@test.com` }));
          return Promise.resolve({ data: { users: paginaLlena }, error: null });
        },
      },
    },
  } as unknown as ReturnType<typeof createClient>;
  const id = await buscarUserIdPorEmail(admin, "no-existe@test.com");
  assertEquals(id, null);
  assertEquals(llamadas, 10);
});
