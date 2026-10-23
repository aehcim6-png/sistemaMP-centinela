import { assertEquals } from "jsr:@std/assert@1";
import { HOROMETRO_MAXIMO, normalizarLectura, TOPE_IMAGEN_BASE64, validarImagenBase64 } from "./index.ts";

Deno.test("validarImagenBase64: falta la imagen o es demasiado grande", () => {
  assertEquals(validarImagenBase64({}), "Falta imagenBase64.");
  assertEquals(validarImagenBase64({ imagenBase64: "x".repeat(TOPE_IMAGEN_BASE64 + 1) }), "La imagen es muy grande, inténtalo con una foto más liviana.");
  assertEquals(validarImagenBase64({ imagenBase64: "abc" }), null);
});

Deno.test("normalizarLectura: lectura clara con un decimal", () => {
  const r = normalizarLectura({ horometro: 12345.67, unidad: "h", tipo: "digital", legible: true, incierto: false, observacion: null });
  assertEquals(r, { horometro: 12345.7, unidad: "h", tipo: "digital", legible: true, incierto: false, observacion: null });
});

Deno.test("normalizarLectura: no legible deja el número en null aunque el modelo haya adivinado uno", () => {
  const r = normalizarLectura({ horometro: 4321, legible: false, incierto: true, observacion: "reflejo" });
  assertEquals(r.horometro, null);
  assertEquals(r.legible, false);
  assertEquals(r.incierto, true);
});

Deno.test("normalizarLectura: números imposibles o no numéricos quedan en null", () => {
  assertEquals(normalizarLectura({ horometro: -5, legible: true, incierto: false }).horometro, null);
  assertEquals(normalizarLectura({ horometro: 0, legible: true, incierto: false }).horometro, null);
  assertEquals(normalizarLectura({ horometro: HOROMETRO_MAXIMO + 1, legible: true, incierto: false }).horometro, null);
  assertEquals(normalizarLectura({ horometro: "12345", legible: true, incierto: false }).horometro, null);
  assertEquals(normalizarLectura({ horometro: NaN, legible: true, incierto: false }).horometro, null);
  const r = normalizarLectura({ horometro: HOROMETRO_MAXIMO + 1, legible: true, incierto: false });
  assertEquals(r.legible, false);
  assertEquals(r.observacion, "El número leído no es plausible para un horómetro.");
});

Deno.test("normalizarLectura: unidad y tipo desconocidos pasan a null; entrada basura no revienta", () => {
  assertEquals(normalizarLectura({ horometro: 100, unidad: "mi", tipo: "x", legible: true, incierto: false }).unidad, null);
  assertEquals(normalizarLectura(null).horometro, null);
  assertEquals(normalizarLectura("texto").legible, false);
});

Deno.test("normalizarLectura: sin 'incierto: false' explícito se asume incierto", () => {
  assertEquals(normalizarLectura({ horometro: 100, legible: true }).incierto, true);
});
