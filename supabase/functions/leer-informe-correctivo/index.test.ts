import { assertEquals } from "jsr:@std/assert@1";
import { validarImagenBase64, TOPE_IMAGEN_BASE64 } from "./index.ts";

Deno.test("validarImagenBase64: falta el campo", () => {
  assertEquals(validarImagenBase64({}), "Falta imagenBase64.");
});

Deno.test("validarImagenBase64: imagen dentro del tope pasa", () => {
  assertEquals(validarImagenBase64({ imagenBase64: "abc" }), null);
});

Deno.test("validarImagenBase64: imagen que excede el tope se rechaza", () => {
  const gigante = "a".repeat(TOPE_IMAGEN_BASE64 + 1);
  assertEquals(validarImagenBase64({ imagenBase64: gigante }), "La imagen es muy grande, inténtalo con una foto más liviana.");
});
