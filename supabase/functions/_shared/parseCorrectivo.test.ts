import { assertEquals, assert } from "jsr:@std/assert@1";
import { parsearReporteFalla, CATEGORIAS_VALIDAS } from "./parseCorrectivo.ts";

Deno.test("parsearReporteFalla: reporte claro de falla con sigla ya actual", () => {
  const r = parsearReporteFalla("CN-9500 fuera de servicio, falla de turbo");
  assert(r);
  assertEquals(r!.sigla, "CN-9500");
  assertEquals(r!.componente, "Turbo");
  assertEquals(r!.confianza, "alta");
  assertEquals(r!.horometro, null);
});

Deno.test("parsearReporteFalla: traduce un código viejo (CAEX-87) a la sigla actual", () => {
  const r = parsearReporteFalla("CAEX-87 fuera de servicio");
  assert(r);
  assertEquals(r!.sigla, "CN-9500");
  assertEquals(r!.siglaOriginal, "CAEX-87");
});

Deno.test("parsearReporteFalla: ruido sin sigla ni palabra de falla se descarta (null)", () => {
  assertEquals(parsearReporteFalla("gracias, todo bien"), null);
  assertEquals(parsearReporteFalla(""), null);
  assertEquals(parsearReporteFalla("   "), null);
});

Deno.test("parsearReporteFalla: pregunta baja la confianza aunque tenga sigla", () => {
  const r = parsearReporteFalla("¿CN-9500 sigue fuera de servicio?");
  assert(r);
  assertEquals(r!.confianza, "baja");
  assert(r!.motivoBaja?.includes("pregunta"));
});

Deno.test("parsearReporteFalla: mantención programada baja la confianza", () => {
  const r = parsearReporteFalla("CN-9500 mantencion programada esta semana");
  assert(r);
  assertEquals(r!.confianza, "baja");
  assert(r!.motivoBaja?.includes("mantención programada"));
});

Deno.test("parsearReporteFalla: extrae el horómetro cuando viene en el texto", () => {
  const r = parsearReporteFalla("CN-9500 fuera de servicio, falla de turbo a las 12345 hrs");
  assert(r);
  assertEquals(r!.horometro, 12345);
});

Deno.test("parsearReporteFalla: componente no identificado baja la confianza y no inventa nada", () => {
  const r = parsearReporteFalla("CN-9500 fuera de servicio por algo raro que no calza con ninguna categoría");
  assert(r);
  assertEquals(r!.confianza, "baja");
  assert(r!.motivoBaja?.includes("no se identificó el componente"));
});

Deno.test("parsearReporteFalla: nunca inventa una sigla que no está en el texto", () => {
  const r = parsearReporteFalla("fuera de servicio, falla de turbo");
  assert(r);
  assertEquals(r!.sigla, "DESCONOCIDO");
  assertEquals(r!.confianza, "baja");
});

Deno.test("CATEGORIAS_VALIDAS: no tiene duplicados y no está vacía", () => {
  assert(CATEGORIAS_VALIDAS.length > 0);
  assertEquals(new Set(CATEGORIAS_VALIDAS).size, CATEGORIAS_VALIDAS.length);
});
