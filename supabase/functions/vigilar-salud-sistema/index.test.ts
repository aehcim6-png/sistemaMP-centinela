import { assertEquals } from "jsr:@std/assert@1";
import { evaluarSaludCrons, type FilaSaludCron } from "./index.ts";

const AHORA = "2026-09-14T12:00:00Z";

function fila(over: Partial<FilaSaludCron>): FilaSaludCron {
  return { nombre: "backup-diario", ultimaEjecucion: "2026-09-14T06:00:00Z", exito: true, detalle: null, ...over };
}

// Filas "todo bien" para los 3 crons con cadencia fija (backup-diario diario,
// alerta-pm diario, resumen-semanal semanal) — usadas como base en los tests
// que NO quieren ruido de estos 3, para aislar lo que sí se está probando.
function filasCadenciaOk(): FilaSaludCron[] {
  return [
    fila({}),
    fila({ nombre: "alerta-pm" }),
    fila({ nombre: "resumen-semanal", ultimaEjecucion: "2026-09-10T06:00:00Z" }), // 4 días antes, dentro del margen semanal
  ];
}

Deno.test("evaluarSaludCrons: todo bien no reporta ningún problema", () => {
  const filas = [...filasCadenciaOk(), fila({ nombre: "whatsapp-webhook", exito: true }), fila({ nombre: "email-webhook", exito: true })];
  assertEquals(evaluarSaludCrons(filas, AHORA), []);
});

Deno.test("evaluarSaludCrons: backup-diario sin ningún registro es un problema", () => {
  const filas = [fila({ nombre: "alerta-pm" }), fila({ nombre: "resumen-semanal", ultimaEjecucion: "2026-09-10T06:00:00Z" })];
  const problemas = evaluarSaludCrons(filas, AHORA);
  assertEquals(problemas.length, 1);
  assertEquals(problemas[0].includes("backup-diario"), true);
  assertEquals(problemas[0].includes("nunca se ha registrado"), true);
});

Deno.test("evaluarSaludCrons: backup-diario con exito=false es un problema, aunque sea reciente", () => {
  const filas = [fila({ exito: false, detalle: "envio_email: 502" }), fila({ nombre: "alerta-pm" }), fila({ nombre: "resumen-semanal", ultimaEjecucion: "2026-09-10T06:00:00Z" })];
  const problemas = evaluarSaludCrons(filas, AHORA);
  assertEquals(problemas.length, 1);
  assertEquals(problemas[0].includes("falló"), true);
  assertEquals(problemas[0].includes("502"), true);
});

Deno.test("evaluarSaludCrons: backup-diario exitoso pero de hace más de 26h es un problema (staleness)", () => {
  const filas = [fila({ exito: true, ultimaEjecucion: "2026-09-12T00:00:00Z" }), fila({ nombre: "alerta-pm" }), fila({ nombre: "resumen-semanal", ultimaEjecucion: "2026-09-10T06:00:00Z" })];
  const problemas = evaluarSaludCrons(filas, AHORA);
  assertEquals(problemas.length, 1);
  assertEquals(problemas[0].includes("no ha corrido a tiempo"), true);
});

Deno.test("evaluarSaludCrons: backup-diario exitoso hace menos de 26h no es problema", () => {
  const filas = [...filasCadenciaOk().map((f) => (f.nombre === "backup-diario" ? { ...f, ultimaEjecucion: "2026-09-14T00:00:00Z" } : f))]; // 12h antes de AHORA
  assertEquals(evaluarSaludCrons(filas, AHORA), []);
});

// ── alerta-pm (nuevo, 2026-09-16: corre a diario, mismo criterio que backup-diario) ──

Deno.test("evaluarSaludCrons: alerta-pm sin ningún registro es un problema", () => {
  const filas = [fila({}), fila({ nombre: "resumen-semanal", ultimaEjecucion: "2026-09-10T06:00:00Z" })];
  const problemas = evaluarSaludCrons(filas, AHORA);
  assertEquals(problemas.length, 1);
  assertEquals(problemas[0].includes("alerta-pm"), true);
  assertEquals(problemas[0].includes("nunca se ha registrado"), true);
});

Deno.test("evaluarSaludCrons: alerta-pm con exito=false es un problema", () => {
  const filas = [fila({}), fila({ nombre: "alerta-pm", exito: false, detalle: "Resend rechazó el envío" }), fila({ nombre: "resumen-semanal", ultimaEjecucion: "2026-09-10T06:00:00Z" })];
  const problemas = evaluarSaludCrons(filas, AHORA);
  assertEquals(problemas.length, 1);
  assertEquals(problemas[0].includes("alerta-pm"), true);
  assertEquals(problemas[0].includes("Resend rechazó el envío"), true);
});

Deno.test("evaluarSaludCrons: alerta-pm exitoso pero de hace más de 26h es un problema (staleness)", () => {
  const filas = [fila({}), fila({ nombre: "alerta-pm", exito: true, ultimaEjecucion: "2026-09-12T00:00:00Z" }), fila({ nombre: "resumen-semanal", ultimaEjecucion: "2026-09-10T06:00:00Z" })];
  const problemas = evaluarSaludCrons(filas, AHORA);
  assertEquals(problemas.length, 1);
  assertEquals(problemas[0].includes("alerta-pm"), true);
});

Deno.test('evaluarSaludCrons: alerta-pm exitoso con "nada urgente hoy" (sin correo enviado, pero SÍ ejecutado) no es problema', () => {
  const filas = filasCadenciaOk(); // alerta-pm exito=true, sin necesitar que haya mandado correo
  assertEquals(evaluarSaludCrons(filas, AHORA), []);
});

// ── resumen-semanal (nuevo, 2026-09-16: corre semanal, margen de staleness de 8 días) ──

Deno.test("evaluarSaludCrons: resumen-semanal sin ningún registro es un problema", () => {
  const filas = [fila({}), fila({ nombre: "alerta-pm" })];
  const problemas = evaluarSaludCrons(filas, AHORA);
  assertEquals(problemas.length, 1);
  assertEquals(problemas[0].includes("resumen-semanal"), true);
  assertEquals(problemas[0].includes("nunca se ha registrado"), true);
});

Deno.test("evaluarSaludCrons: resumen-semanal con exito=false es un problema", () => {
  const filas = [fila({}), fila({ nombre: "alerta-pm" }), fila({ nombre: "resumen-semanal", exito: false, ultimaEjecucion: "2026-09-10T06:00:00Z", detalle: "boom" })];
  const problemas = evaluarSaludCrons(filas, AHORA);
  assertEquals(problemas.length, 1);
  assertEquals(problemas[0].includes("resumen-semanal"), true);
  assertEquals(problemas[0].includes("boom"), true);
});

Deno.test("evaluarSaludCrons: resumen-semanal exitoso hace 4 días (dentro del margen semanal) no es problema", () => {
  assertEquals(evaluarSaludCrons(filasCadenciaOk(), AHORA), []);
});

Deno.test("evaluarSaludCrons: resumen-semanal exitoso hace más de 8 días es un problema (staleness)", () => {
  const filas = [fila({}), fila({ nombre: "alerta-pm" }), fila({ nombre: "resumen-semanal", exito: true, ultimaEjecucion: "2026-09-01T00:00:00Z" })];
  const problemas = evaluarSaludCrons(filas, AHORA);
  assertEquals(problemas.length, 1);
  assertEquals(problemas[0].includes("resumen-semanal"), true);
});

// ── whatsapp-webhook / email-webhook (sin cambios de comportamiento) ──

Deno.test("evaluarSaludCrons: whatsapp-webhook sin fila registrada NO es un problema (ausencia de actividad no es falla)", () => {
  assertEquals(evaluarSaludCrons(filasCadenciaOk(), AHORA), []);
});

Deno.test("evaluarSaludCrons: whatsapp-webhook con exito=true (última vez que se usó, aunque haga tiempo) no es problema", () => {
  const filas = [...filasCadenciaOk(), fila({ nombre: "whatsapp-webhook", exito: true, ultimaEjecucion: "2026-08-01T00:00:00Z" })];
  assertEquals(evaluarSaludCrons(filas, AHORA), []);
});

Deno.test("evaluarSaludCrons: whatsapp-webhook con fallo reciente (<24h) es un problema", () => {
  const filas = [...filasCadenciaOk(), fila({ nombre: "whatsapp-webhook", exito: false, ultimaEjecucion: "2026-09-14T02:00:00Z", detalle: "insert falló: RLS" })];
  const problemas = evaluarSaludCrons(filas, AHORA);
  assertEquals(problemas.length, 1);
  assertEquals(problemas[0].includes("whatsapp-webhook"), true);
  assertEquals(problemas[0].includes("RLS"), true);
});

Deno.test("evaluarSaludCrons: email-webhook con fallo viejo (>24h) ya NO es un problema", () => {
  const filas = [...filasCadenciaOk(), fila({ nombre: "email-webhook", exito: false, ultimaEjecucion: "2026-09-10T00:00:00Z" })];
  assertEquals(evaluarSaludCrons(filas, AHORA), []);
});

Deno.test("evaluarSaludCrons: acumula varios problemas a la vez, incluyendo los 2 crons nuevos", () => {
  const filas = [
    fila({ exito: false, detalle: "boom" }),
    fila({ nombre: "alerta-pm", exito: false, detalle: "Resend rechazó" }),
    fila({ nombre: "resumen-semanal", exito: false, ultimaEjecucion: "2026-09-10T06:00:00Z", detalle: "pum" }),
    fila({ nombre: "whatsapp-webhook", exito: false, ultimaEjecucion: "2026-09-14T10:00:00Z" }),
  ];
  const problemas = evaluarSaludCrons(filas, AHORA);
  assertEquals(problemas.length, 4);
});
