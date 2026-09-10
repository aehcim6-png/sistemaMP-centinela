import { assertEquals } from "jsr:@std/assert@1";
import {
  normalizarMotivo,
  marcaDedupSalud,
  formatearMotivoTxt,
  formatearCausaTxt,
} from "./index.ts";

Deno.test("normalizarMotivo: acepta 'caida' tal cual", () => {
  assertEquals(normalizarMotivo("caida"), "caida");
});

Deno.test("normalizarMotivo: cualquier otra cosa cae a 'cruce'", () => {
  assertEquals(normalizarMotivo("cruce"), "cruce");
  assertEquals(normalizarMotivo("otra-cosa"), "cruce");
  assertEquals(normalizarMotivo(undefined), "cruce");
  assertEquals(normalizarMotivo(null), "cruce");
});

Deno.test("marcaDedupSalud: arma la clave sigla|fecha| exacta que usa el dedup", () => {
  assertEquals(marcaDedupSalud("CN-9500", "2026-09-10"), "CN-9500|2026-09-10|");
});

Deno.test("formatearMotivoTxt: cruce", () => {
  assertEquals(formatearMotivoTxt("cruce", null), "cruzó a Salud Baja (bajo 70%)");
});

Deno.test("formatearMotivoTxt: caida usa el valor absoluto del delta", () => {
  assertEquals(formatearMotivoTxt("caida", -18), "bajó 18 puntos en la última semana");
  assertEquals(formatearMotivoTxt("caida", 18), "bajó 18 puntos en la última semana");
});

Deno.test("formatearMotivoTxt: caida sin delta no revienta (usa 0)", () => {
  assertEquals(formatearMotivoTxt("caida", null), "bajó 0 puntos en la última semana");
});

Deno.test("formatearCausaTxt: vacío si no hay causa", () => {
  assertEquals(formatearCausaTxt(null, null), "");
});

Deno.test("formatearCausaTxt: con nombre y valor", () => {
  assertEquals(formatearCausaTxt("Análisis de aceite", 42), " La señal más afectada es Análisis de aceite (42%).");
});

Deno.test("formatearCausaTxt: con nombre sin valor", () => {
  assertEquals(formatearCausaTxt("Retrabajo reciente", null), " La señal más afectada es Retrabajo reciente.");
});
