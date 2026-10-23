import { assertEquals } from "jsr:@std/assert@1";
import { esUsuarioAutenticado } from "./sesionAutenticada.ts";

const jwt = (payload: Record<string, unknown>) => "h." + btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") + ".f";

Deno.test("esUsuarioAutenticado: solo el rol authenticated; la llave anon, el service_role y lo ilegible no pasan", () => {
  assertEquals(esUsuarioAutenticado("Bearer " + jwt({ role: "authenticated", sub: "u1" })), true);
  assertEquals(esUsuarioAutenticado("Bearer " + jwt({ role: "anon" })), false);
  assertEquals(esUsuarioAutenticado("Bearer " + jwt({ role: "service_role" })), false);
  assertEquals(esUsuarioAutenticado("Bearer basura"), false);
  assertEquals(esUsuarioAutenticado(""), false);
  assertEquals(esUsuarioAutenticado(null), false);
});
