import { assertEquals } from "jsr:@std/assert@1";
import { claimsDeToken, MAX_ITEMS, normalizarSugerencias, validarItemsAplicar, validarItemsSugerir } from "./index.ts";
import { CATEGORIAS_VALIDAS } from "../_shared/parseCorrectivo.ts";

Deno.test("normalizarSugerencias: una por id pedido, solo categorías de la lista cerrada", () => {
  const r = normalizarSugerencias(["a", "b", "c", "d"], {
    sugerencias: [
      { id: "a", componente: "Turbo", confianza: "alta", motivo: "dice turbo" },
      { id: "b", componente: "Algo inventado", confianza: "alta", motivo: "x" },
      { id: "c", componente: null, confianza: "media" },
      { id: "z", componente: "Motor", confianza: "alta" },   // un id que no se pidió se ignora
    ],
  });
  assertEquals(r.map((x) => x.id), ["a", "b", "c", "d"]);
  assertEquals(r[0], { id: "a", componente: "Turbo", confianza: "alta", motivo: "dice turbo" });
  assertEquals(r[1].componente, null);   // categoría fuera de la lista
  assertEquals(r[1].confianza, "baja");
  assertEquals(r[2].componente, null);
  assertEquals(r[3], { id: "d", componente: null, confianza: "baja", motivo: null });   // el modelo no lo devolvió
});

Deno.test("normalizarSugerencias: entrada basura no revienta", () => {
  assertEquals(normalizarSugerencias(["a"], null)[0].componente, null);
  assertEquals(normalizarSugerencias(["a"], { sugerencias: "x" })[0].componente, null);
  assertEquals(normalizarSugerencias(["a"], { sugerencias: [{ id: "a", componente: "Turbo", confianza: "rara" }] })[0].confianza, "baja");
});

Deno.test("validarItemsSugerir: pide id y texto, tope de lote y recorte del texto", () => {
  assertEquals("error" in validarItemsSugerir([]), true);
  assertEquals("error" in validarItemsSugerir(Array.from({ length: MAX_ITEMS + 1 }, (_, i) => ({ id: "x" + i, texto: "t" }))), true);
  assertEquals("error" in validarItemsSugerir([{ id: "a", texto: "   " }]), true);
  const ok = validarItemsSugerir([{ id: "a", texto: "x".repeat(900) }]);
  assertEquals("items" in ok && ok.items[0].texto.length, 400);
});

Deno.test("validarItemsAplicar: solo componentes de la lista cerrada", () => {
  assertEquals("error" in validarItemsAplicar([{ id: "a", componente: "Inventado" }]), true);
  assertEquals("error" in validarItemsAplicar([]), true);
  const ok = validarItemsAplicar([{ id: "a", componente: CATEGORIAS_VALIDAS[0] }]);
  assertEquals("items" in ok && ok.items.length, 1);
});

Deno.test("claimsDeToken: lee aal y rol; lo ilegible da vacío", () => {
  const jwt = (p: Record<string, unknown>) => "h." + btoa(JSON.stringify(p)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") + ".f";
  assertEquals(claimsDeToken("Bearer " + jwt({ role: "authenticated", aal: "aal2" })).aal, "aal2");
  assertEquals(claimsDeToken("Bearer " + jwt({ role: "authenticated", aal: "aal1" })).aal, "aal1");
  assertEquals(claimsDeToken("Bearer basura"), {});
  assertEquals(claimsDeToken(null), {});
});
