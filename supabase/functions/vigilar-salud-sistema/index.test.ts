import { assertEquals } from "jsr:@std/assert@1";
import { detectarLecturasAtipicas, evaluarCalidadDatos, evaluarSaludCrons, type DatosCalidad, type FilaSaludCron } from "./index.ts";

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

// ── Calidad de los datos (2026-11-02) ──

const HOY = "2026-11-02T13:00:00Z";
const lec = (sigla: string, fecha: string, horomFin: number) => ({ sigla, fecha, horomFin });
function datosSanos(over: Partial<DatosCalidad> = {}): DatosCalidad {
  return {
    equipos: [{ sigla: "TI-5141", horomActual: 23100, fechaHorom: "2026-11-01" }],
    lecturas: [lec("TI-5141", "2026-10-30", 23076), lec("TI-5141", "2026-10-31", 23088), lec("TI-5141", "2026-11-01", 23100)],
    otAbiertas: [],
    tablasTemporales: [],
    ...over,
  };
}

Deno.test("calidad: datos sanos no reportan nada", () => {
  assertEquals(evaluarCalidadDatos(datosSanos(), HOY), []);
});

Deno.test("calidad: un cero de más entre dos lecturas normales se detecta como salto imposible", () => {
  const l = [lec("TI-5144", "2026-10-26", 17833), lec("TI-5144", "2026-10-27", 178845), lec("TI-5144", "2026-10-28", 17855)];
  const a = detectarLecturasAtipicas(l, HOY);
  assertEquals(a.length, 1);
  assertEquals(a[0].includes("TI-5144 2026-10-27: 178845 entre 17833 y 17855"), true);
});

Deno.test("calidad: un retroceso que se recupera (2264 entre 255 y 264) se detecta; uno chico de redondeo no", () => {
  const l = [lec("CN-10155", "2026-10-20", 3000), lec("CN-10155", "2026-10-21", 1000), lec("CN-10155", "2026-10-22", 3010)];
  assertEquals(detectarLecturasAtipicas(l, HOY).length, 1);
  const redondeo = [lec("CF-9511", "2026-10-20", 13141), lec("CF-9511", "2026-10-21", 13132), lec("CF-9511", "2026-10-22", 13159)];
  assertEquals(detectarLecturasAtipicas(redondeo, HOY), []);
});

Deno.test("calidad: un cambio sostenido (cambio de horómetro) no es un dedazo", () => {
  const l = [lec("BD-10139", "2026-10-20", 1212), lec("BD-10139", "2026-10-21", 1755), lec("BD-10139", "2026-10-22", 1760)];
  assertEquals(detectarLecturasAtipicas(l, HOY), []);
});

Deno.test("calidad: la última lectura con salto imposible se avisa aunque no haya siguiente", () => {
  const l = [lec("GE-10019", "2026-10-30", 15000), lec("GE-10019", "2026-11-01", 150000)];
  const a = detectarLecturasAtipicas(l, HOY);
  assertEquals(a.length, 1);
  assertEquals(a[0].includes("sin lectura posterior"), true);
});

Deno.test("calidad: lecturas con 0 (sin lectura) se ignoran y lo muy viejo (>45 días) no se vuelve a avisar", () => {
  const ceros = [lec("CN-5131", "2026-10-30", 12000), lec("CN-5131", "2026-10-31", 0), lec("CN-5131", "2026-11-01", 12010)];
  assertEquals(detectarLecturasAtipicas(ceros, HOY), []);
  const viejo = [lec("TI-5144", "2026-08-01", 17833), lec("TI-5144", "2026-08-02", 178845), lec("TI-5144", "2026-08-03", 17855)];
  assertEquals(detectarLecturasAtipicas(viejo, HOY), []);
});

Deno.test("calidad: horómetro actual del equipo por debajo de su última lectura", () => {
  const d = datosSanos({ equipos: [{ sigla: "TI-5141", horomActual: 22000, fechaHorom: "2026-11-01" }] });
  const p = evaluarCalidadDatos(d, HOY);
  assertEquals(p.length, 1);
  assertEquals(p[0].includes("TI-5141 (equipo 22000 < lectura 23100"), true);
});

Deno.test("calidad: equipos sin lectura hace más de 7 días o sin ninguna", () => {
  const d = datosSanos({ equipos: [
    { sigla: "TI-5141", horomActual: 23100, fechaHorom: "2026-11-01" },
    { sigla: "CN-9500", horomActual: 18950, fechaHorom: "2026-08-19" },
    { sigla: "MC-4922", horomActual: null, fechaHorom: null },
  ] });
  const p = evaluarCalidadDatos(d, HOY);
  assertEquals(p.length, 1);
  assertEquals(p[0].includes("CN-9500 (75 días)"), true);
  assertEquals(p[0].includes("MC-4922 (sin ninguna lectura)"), true);
  assertEquals(p[0].includes("TI-5141"), false);
});

Deno.test("calidad: OT abiertas hace más de 30 días (las recientes no)", () => {
  const d = datosSanos({ otAbiertas: [
    { sigla: "TI-5146", fechaEntrada: "2026-08-12", estadoOT: "Abierta" },
    { sigla: "CF-9510", fechaEntrada: "2026-10-25", estadoOT: "Abierta" },
  ] });
  const p = evaluarCalidadDatos(d, HOY);
  assertEquals(p.length, 1);
  assertEquals(p[0].includes("TI-5146 (82 días"), true);
  assertEquals(p[0].includes("CF-9510"), false);
});

Deno.test("calidad: tablas temporales olvidadas", () => {
  const p = evaluarCalidadDatos(datosSanos({ tablasTemporales: ["tmp_horom_chat", "respaldo_ot_fs_cierre_20261024"] }), HOY);
  assertEquals(p.length, 1);
  assertEquals(p[0].includes("tmp_horom_chat"), true);
});

Deno.test("calidad: con muchos hallazgos la lista se resume", () => {
  const equipos = Array.from({ length: 12 }, (_, i) => ({ sigla: `EQ-${i}`, horomActual: 100, fechaHorom: "2026-09-01" }));
  const p = evaluarCalidadDatos(datosSanos({ equipos }), HOY);
  assertEquals(p[0].includes("…y 4 más"), true);
});
