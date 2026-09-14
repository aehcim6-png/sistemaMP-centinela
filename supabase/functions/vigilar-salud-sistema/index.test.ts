import { assertEquals } from "jsr:@std/assert@1";
import { evaluarSaludCrons, type FilaSaludCron } from "./index.ts";

const AHORA = "2026-09-14T12:00:00Z";

function fila(over: Partial<FilaSaludCron>): FilaSaludCron {
  return { nombre: "backup-diario", ultimaEjecucion: "2026-09-14T06:00:00Z", exito: true, detalle: null, ...over };
}

Deno.test("evaluarSaludCrons: todo bien no reporta ningún problema", () => {
  const filas = [fila({}), fila({ nombre: "whatsapp-webhook", exito: true }), fila({ nombre: "email-webhook", exito: true })];
  assertEquals(evaluarSaludCrons(filas, AHORA), []);
});

Deno.test("evaluarSaludCrons: backup-diario sin ningún registro es un problema", () => {
  const problemas = evaluarSaludCrons([], AHORA);
  assertEquals(problemas.length, 1);
  assertEquals(problemas[0].includes("nunca se ha registrado"), true);
});

Deno.test("evaluarSaludCrons: backup-diario con exito=false es un problema, aunque sea reciente", () => {
  const filas = [fila({ exito: false, detalle: "envio_email: 502" })];
  const problemas = evaluarSaludCrons(filas, AHORA);
  assertEquals(problemas.length, 1);
  assertEquals(problemas[0].includes("falló"), true);
  assertEquals(problemas[0].includes("502"), true);
});

Deno.test("evaluarSaludCrons: backup-diario exitoso pero de hace más de 26h es un problema (staleness)", () => {
  const filas = [fila({ exito: true, ultimaEjecucion: "2026-09-12T00:00:00Z" })];
  const problemas = evaluarSaludCrons(filas, AHORA);
  assertEquals(problemas.length, 1);
  assertEquals(problemas[0].includes("no ha corrido hoy"), true);
});

Deno.test("evaluarSaludCrons: backup-diario exitoso hace menos de 26h no es problema", () => {
  const filas = [fila({ exito: true, ultimaEjecucion: "2026-09-14T00:00:00Z" })]; // 12h antes de AHORA
  assertEquals(evaluarSaludCrons(filas, AHORA), []);
});

Deno.test("evaluarSaludCrons: whatsapp-webhook sin fila registrada NO es un problema (ausencia de actividad no es falla)", () => {
  const filas = [fila({})]; // solo backup-diario, ok
  assertEquals(evaluarSaludCrons(filas, AHORA), []);
});

Deno.test("evaluarSaludCrons: whatsapp-webhook con exito=true (última vez que se usó, aunque haga tiempo) no es problema", () => {
  const filas = [fila({}), fila({ nombre: "whatsapp-webhook", exito: true, ultimaEjecucion: "2026-08-01T00:00:00Z" })];
  assertEquals(evaluarSaludCrons(filas, AHORA), []);
});

Deno.test("evaluarSaludCrons: whatsapp-webhook con fallo reciente (<24h) es un problema", () => {
  const filas = [fila({}), fila({ nombre: "whatsapp-webhook", exito: false, ultimaEjecucion: "2026-09-14T02:00:00Z", detalle: "insert falló: RLS" })];
  const problemas = evaluarSaludCrons(filas, AHORA);
  assertEquals(problemas.length, 1);
  assertEquals(problemas[0].includes("whatsapp-webhook"), true);
  assertEquals(problemas[0].includes("RLS"), true);
});

Deno.test("evaluarSaludCrons: email-webhook con fallo viejo (>24h) ya NO es un problema", () => {
  const filas = [fila({}), fila({ nombre: "email-webhook", exito: false, ultimaEjecucion: "2026-09-10T00:00:00Z" })];
  assertEquals(evaluarSaludCrons(filas, AHORA), []);
});

Deno.test("evaluarSaludCrons: acumula varios problemas a la vez", () => {
  const filas = [
    fila({ exito: false, detalle: "boom" }),
    fila({ nombre: "whatsapp-webhook", exito: false, ultimaEjecucion: "2026-09-14T10:00:00Z" }),
  ];
  const problemas = evaluarSaludCrons(filas, AHORA);
  assertEquals(problemas.length, 2);
});
