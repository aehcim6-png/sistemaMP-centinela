import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import { ESQUEMA_RESPUESTA, PROMPT, TOPE_IMAGEN_BASE64, validarImagenBase64 } from "./index.ts";

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

Deno.test("esquema: lee el reporte completo (carguío, apoyo, pérdida por petróleo, totales, disponibilidad y bitácora)", () => {
  const props = Object.keys(ESQUEMA_RESPUESTA.properties);
  for (const k of ["caex", "carguio", "apoyo", "perdidaPetroleo", "perdidaIndisponibilidad", "grupoTurno", "tiempoMedioCicloMin", "totalHorasCaex", "rendimientoCaexVueltasHr", "vueltasCF", "totalTonCF", "totalHorasCF", "rendimientoCFTonHr", "rendimientoCFCargasHr", "disponibilidadEquipos", "bitacora"]) {
    assert(props.includes(k), "falta " + k);
  }
  for (const k of ["caex", "carguio", "apoyo", "perdidaPetroleo", "perdidaIndisponibilidad"]) {
    assert(ESQUEMA_RESPUESTA.required.includes(k), k + " debe ser obligatorio (aunque venga vacío)");
  }
});

Deno.test("esquema: las columnas de carguío y apoyo coinciden con las de la tabla", () => {
  const carguio = Object.keys(ESQUEMA_RESPUESTA.properties.carguio.items.properties);
  for (const k of ["sigla", "tonelaje", "rendimientoTonHr", "postura", "operador", "estadoTexto"]) assert(carguio.includes(k), "carguio sin " + k);
  const apoyo = Object.keys(ESQUEMA_RESPUESTA.properties.apoyo.items.properties);
  for (const k of ["sigla", "areaTrabajo", "operador", "estadoTexto"]) assert(apoyo.includes(k), "apoyo sin " + k);
  const petroleo = Object.keys(ESQUEMA_RESPUESTA.properties.perdidaPetroleo.items.properties);
  for (const k of ["equipoNombre", "horaInicio", "horaFin", "totalHoras", "tonAsociado"]) assert(petroleo.includes(k), "petroleo sin " + k);
});

Deno.test("prompt: ya no manda ignorar tablas y pide fecha día/mes/año y filas fuera de servicio", () => {
  assertFalse(/ignora/i.test(PROMPT));
  assert(PROMPT.includes("día/mes/año"));
  assert(PROMPT.includes("fuera de servicio"));
});
