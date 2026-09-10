import { assertEquals } from "jsr:@std/assert@1";
import { iso, pctDelta, moneda } from "./index.ts";

Deno.test("iso: formatea YYYY-MM-DD", () => {
  assertEquals(iso(new Date("2026-09-10T15:30:00Z")), "2026-09-10");
});

Deno.test("pctDelta: sin cambio cuando ambos son 0", () => {
  assertEquals(pctDelta(0, 0), "(sin cambio)");
});

Deno.test("pctDelta: anterior 0 pero actual > 0 muestra '(antes: 0)' sin dividir por cero", () => {
  assertEquals(pctDelta(5, 0), "(antes: 0)");
});

Deno.test("pctDelta: sube un porcentaje calculado, con signo +", () => {
  assertEquals(pctDelta(15, 10), "(semana anterior: 10, +50%)");
});

Deno.test("pctDelta: baja un porcentaje calculado, con signo -", () => {
  assertEquals(pctDelta(5, 10), "(semana anterior: 10, -50%)");
});

Deno.test("moneda: formatea con separador de miles chileno y redondea", () => {
  assertEquals(moneda(1234567.8), "$1.234.568");
});

Deno.test("moneda: cero", () => {
  assertEquals(moneda(0), "$0");
});
