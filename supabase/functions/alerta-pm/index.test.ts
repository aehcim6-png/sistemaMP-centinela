import { assertEquals } from "jsr:@std/assert@1";
import { calcStockEstado, calcVencEstado, componenteDeSintoma, diasEntreISO, CATEGORIAS_VALIDAS } from "./index.ts";
import { CATEGORIAS_VALIDAS as CATEGORIAS_COMPARTIDAS } from "../_shared/parseCorrectivo.ts";

// Guardarraíl contra drift: esta función porta a mano la MISMA lista de
// categorías que _shared/parseCorrectivo.ts (comentario del archivo: "Deno
// no puede importar logic.js directamente... hay que volver a sincronizar
// a mano"). Si un día se agrega una categoría en un solo lado, este test
// lo detecta antes de que el correo diario clasifique distinto de lo que
// clasificaría el parser de WhatsApp/correo para el mismo síntoma.
Deno.test("CATEGORIAS_VALIDAS: coincide con _shared/parseCorrectivo.ts", () => {
  assertEquals(CATEGORIAS_VALIDAS, CATEGORIAS_COMPARTIDAS);
});

// ---- calcStockEstado ----
// Misma fórmula que stockEstado() en logic.js (sincronía con el Dashboard).

Deno.test("calcStockEstado: sin consumo mensual, siempre OK (no hay con qué dividir)", () => {
  assertEquals(calcStockEstado(0, 0, null), { nivel: "OK", meses: null });
  assertEquals(calcStockEstado(100, 0, null), { nivel: "OK", meses: null });
});

Deno.test("calcStockEstado: stock en 0 con consumo real es COMPRAR", () => {
  const r = calcStockEstado(0, 10, null);
  assertEquals(r.nivel, "COMPRAR");
  assertEquals(r.meses, 0);
});

Deno.test("calcStockEstado: menos que el lead time es COMPRAR", () => {
  // lead por defecto 34 días (~1.13 meses); 5 unidades / 10 por mes = 0.5 meses < lead.
  const r = calcStockEstado(5, 10, null);
  assertEquals(r.nivel, "COMPRAR");
});

Deno.test("calcStockEstado: cubre el lead pero menos de 2 meses es BAJO", () => {
  // 15 / 10 = 1.5 meses: por sobre el lead (~1.13) pero bajo 2.
  const r = calcStockEstado(15, 10, null);
  assertEquals(r.nivel, "BAJO");
});

Deno.test("calcStockEstado: 2+ meses de cobertura es OK", () => {
  const r = calcStockEstado(30, 10, null);
  assertEquals(r.nivel, "OK");
});

Deno.test("calcStockEstado: respeta un lead time explícito distinto del default", () => {
  // lead 60 días = 2 meses; 15/10 = 1.5 meses < 2 -> COMPRAR (con lead default de 34d sería BAJO).
  const r = calcStockEstado(15, 10, 60);
  assertEquals(r.nivel, "COMPRAR");
});

// ---- calcVencEstado ----

Deno.test("calcVencEstado: sin fecha próxima pero con regla configurada, requiere atención", () => {
  assertEquals(calcVencEstado(null, true), { dias: null, requiereAtencion: true, vencido: false });
});

Deno.test("calcVencEstado: sin fecha próxima y sin regla, no requiere atención", () => {
  assertEquals(calcVencEstado(null, false), { dias: null, requiereAtencion: false, vencido: false });
});

Deno.test("calcVencEstado: fecha pasada está vencido", () => {
  const ayer = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const r = calcVencEstado(ayer, true);
  assertEquals(r.vencido, true);
  assertEquals(r.requiereAtencion, true);
});

Deno.test("calcVencEstado: dentro de 30 días requiere atención pero no está vencido", () => {
  const en10dias = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const r = calcVencEstado(en10dias, true);
  assertEquals(r.requiereAtencion, true);
  assertEquals(r.vencido, false);
});

Deno.test("calcVencEstado: a más de 30 días no requiere atención", () => {
  const en90dias = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const r = calcVencEstado(en90dias, true);
  assertEquals(r.requiereAtencion, false);
});

// ---- componenteDeSintoma ----

Deno.test("componenteDeSintoma: null/vacío da vacío, nunca revienta", () => {
  assertEquals(componenteDeSintoma(null), "");
  assertEquals(componenteDeSintoma(""), "");
});

Deno.test("componenteDeSintoma: reconoce por palabra clave", () => {
  assertEquals(componenteDeSintoma("se rompió el turbo"), "Turbo");
});

// ---- diasEntreISO ----

Deno.test("diasEntreISO: calcula la diferencia real en días", () => {
  assertEquals(diasEntreISO("2026-09-01", "2026-09-08"), 7);
});

Deno.test("diasEntreISO: null en cualquiera de las dos fechas da el centinela 9999 (nunca cuenta como reingreso)", () => {
  assertEquals(diasEntreISO(null, "2026-09-08"), 9999);
  assertEquals(diasEntreISO("2026-09-01", null), 9999);
});
