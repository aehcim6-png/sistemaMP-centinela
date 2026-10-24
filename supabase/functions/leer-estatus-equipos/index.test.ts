import { assertEquals } from "jsr:@std/assert@1";
import { MAX_FILAS, normalizarLectura, TOPE_IMAGEN_BASE64, validarImagenBase64 } from "./index.ts";

Deno.test("validarImagenBase64: falta la imagen o es demasiado grande", () => {
  assertEquals(validarImagenBase64({}), "Falta imagenBase64.");
  assertEquals(validarImagenBase64({ imagenBase64: "x".repeat(TOPE_IMAGEN_BASE64 + 1) }), "La imagen es muy grande, inténtalo con una captura más liviana.");
  assertEquals(validarImagenBase64({ imagenBase64: "abc" }), null);
});

Deno.test("normalizarLectura: tabla clara con OP y FS", () => {
  const r = normalizarLectura({
    legible: true, formato: "estatus", fecha: "24-09-2026", supervisor: "CARLOS TRIGO", observacion: null,
    filas: [
      { sigla: "CF-9510", estatus: "OP", fechaFS: null, comentario: null, incierto: false },
      { sigla: "CF-8769", estatus: "fs", fechaFS: "12-09-2026", comentario: "ESPERA DE ENFRIADORES Y ALTERNADOR 140AMP", incierto: false },
    ],
  });
  assertEquals(r.legible, true);
  assertEquals(r.formato, "estatus");
  assertEquals(r.fecha, "24-09-2026");
  assertEquals(r.filas.length, 2);
  assertEquals(r.filas[1].estatus, "FS");
  assertEquals(r.filas[1].fechaFS, "12-09-2026");
  assertEquals(r.filas[0].incierto, false);
});

Deno.test("normalizarLectura: estatus desconocido queda null y la fila se marca incierta; sin código se descarta", () => {
  const r = normalizarLectura({ legible: true, filas: [{ sigla: "CN-9500", estatus: "Fuera", incierto: false }, { sigla: "  ", estatus: "OP", incierto: false }, { estatus: "OP" }] });
  assertEquals(r.filas.length, 1);
  assertEquals(r.filas[0].estatus, null);
  assertEquals(r.filas[0].incierto, true);
});

Deno.test("normalizarLectura: sin 'incierto: false' explícito se asume incierta", () => {
  assertEquals(normalizarLectura({ legible: true, filas: [{ sigla: "TI-5142", estatus: "OP" }] }).filas[0].incierto, true);
});

Deno.test("normalizarLectura: no legible o sin filas no devuelve filas aunque el modelo haya inventado algunas", () => {
  assertEquals(normalizarLectura({ legible: false, filas: [{ sigla: "CN-1", estatus: "OP", incierto: false }], observacion: "borrosa" }).filas, []);
  const vacia = normalizarLectura({ legible: true, filas: [] });
  assertEquals(vacia.legible, false);
  assertEquals(vacia.observacion, "No se encontró ninguna fila de equipos en la imagen.");
});

Deno.test("normalizarLectura: acota textos y cantidad de filas; entrada basura no revienta", () => {
  const muchas = Array.from({ length: MAX_FILAS + 30 }, (_, i) => ({ sigla: "EQ-" + i, estatus: "OP", incierto: false }));
  assertEquals(normalizarLectura({ legible: true, filas: muchas }).filas.length, MAX_FILAS);
  assertEquals(normalizarLectura({ legible: true, filas: [{ sigla: "A-1", estatus: "FS", comentario: "x".repeat(900), incierto: false }] }).filas[0].comentario?.length, 400);
  assertEquals(normalizarLectura(null).legible, false);
  assertEquals(normalizarLectura("texto").filas, []);
  assertEquals(normalizarLectura({ legible: true, filas: "no" }).legible, false);
});
