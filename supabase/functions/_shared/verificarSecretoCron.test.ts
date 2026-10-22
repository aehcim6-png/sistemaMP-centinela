import { assertEquals } from "jsr:@std/assert@1";
import { detalleErrorVerificacion, verificarSecretoCron } from "./verificarSecretoCron.ts";

// fetch falso que responde la secuencia indicada (número = código HTTP con cuerpo true si 200; 'red' = excepción)
function falso(secuencia: Array<number | 'red' | 'raro'>) {
  const llamadas: string[] = [];
  const fn = ((url: string) => {
    llamadas.push(url);
    const paso = secuencia[Math.min(llamadas.length - 1, secuencia.length - 1)];
    if (paso === 'red') return Promise.reject(new Error('sin red'));
    if (paso === 'raro') return Promise.resolve(new Response('no es json', { status: 200 }));
    return Promise.resolve(new Response(JSON.stringify(paso === 200 ? true : false), { status: paso }));
  }) as unknown as typeof fetch;
  return { fn, llamadas };
}
const opts = (fn: typeof fetch) => ({ fetchFn: fn, esperaMs: 0 });

Deno.test("secreto correcto: valido, una sola llamada", async () => {
  const f = falso([200]);
  assertEquals(await verificarSecretoCron("https://x", "k", "n", "v", opts(f.fn)), { estado: "valido" });
  assertEquals(f.llamadas.length, 1);
});

Deno.test("secreto incorrecto: invalido y NO se reintenta", async () => {
  const llamadas: string[] = [];
  const fn = ((url: string) => { llamadas.push(url); return Promise.resolve(new Response('false', { status: 200 })); }) as unknown as typeof fetch;
  assertEquals(await verificarSecretoCron("https://x", "k", "n", "v", opts(fn)), { estado: "invalido" });
  assertEquals(llamadas.length, 1);
});

Deno.test("la API rechaza con 401 la primera vez y acepta la segunda: valido (el caso del 19-oct)", async () => {
  const f = falso([401, 200]);
  assertEquals(await verificarSecretoCron("https://x", "k", "n", "v", opts(f.fn)), { estado: "valido" });
  assertEquals(f.llamadas.length, 2);
});

Deno.test("la API rechaza las dos veces: error con el código, no 'invalido'", async () => {
  const f = falso([401, 401]);
  assertEquals(await verificarSecretoCron("https://x", "k", "n", "v", opts(f.fn)), { estado: "error", http: 401 });
  assertEquals(f.llamadas.length, 2);
});

Deno.test("error 503 y luego sin red: error sin código", async () => {
  const f = falso([503, "red"]);
  assertEquals(await verificarSecretoCron("https://x", "k", "n", "v", opts(f.fn)), { estado: "error", http: undefined });
});

Deno.test("sin red todas las veces: error sin código", async () => {
  const f = falso(["red"]);
  assertEquals(await verificarSecretoCron("https://x", "k", "n", "v", opts(f.fn)), { estado: "error", http: undefined });
  assertEquals(f.llamadas.length, 2);
});

Deno.test("respuesta 200 que no es JSON: se trata como secreto no válido, no como éxito", async () => {
  const f = falso(["raro"]);
  assertEquals(await verificarSecretoCron("https://x", "k", "n", "v", opts(f.fn)), { estado: "invalido" });
});

Deno.test("reintentos configurables", async () => {
  const f = falso([500]);
  await verificarSecretoCron("https://x", "k", "n", "v", { fetchFn: f.fn, esperaMs: 0, reintentos: 3 });
  assertEquals(f.llamadas.length, 4);
});

Deno.test("detalle para salud_crons", () => {
  assertEquals(detalleErrorVerificacion({ estado: "error", http: 401 }).includes("HTTP 401"), true);
  assertEquals(detalleErrorVerificacion({ estado: "error" }).includes("sin respuesta"), true);
});
