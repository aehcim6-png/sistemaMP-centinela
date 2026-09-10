import { assertEquals } from "jsr:@std/assert@1";
import {
  horaChile,
  esDispositivoNuevo,
  esHorarioInusual,
  contarDispositivosNuevosEnVentana,
  UMBRAL_MIN_HISTORIAL_HORARIO,
  UMBRAL_DISPOSITIVOS_NUEVOS,
  type FilaHistorialLogin,
} from "./index.ts";

function fila(detalle: string, fecha: string): FilaHistorialLogin {
  return { fecha, detalle };
}

// ---- horaChile ----

Deno.test("horaChile: convierte una fecha UTC a la hora de Chile", () => {
  // 2026-01-15T15:00:00Z — enero es horario de verano en Chile (UTC-3) -> 12.
  assertEquals(horaChile("2026-01-15T15:00:00Z"), 12);
});

// ---- esDispositivoNuevo ----

Deno.test("esDispositivoNuevo: true si nunca apareció antes", () => {
  const historial = [fila("Login manual · 💻 iPhone de Juan · Mozilla", "2026-09-01T10:00:00Z")];
  assertEquals(esDispositivoNuevo(historial, "PC de Ana"), true);
});

Deno.test("esDispositivoNuevo: false si ya apareció más de una vez", () => {
  const historial = [
    fila("Login manual · 💻 PC de Ana · Mozilla", "2026-09-01T10:00:00Z"),
    fila("Login manual · 💻 PC de Ana · Mozilla", "2026-09-02T10:00:00Z"),
  ];
  assertEquals(esDispositivoNuevo(historial, "PC de Ana"), false);
});

Deno.test("esDispositivoNuevo: <=1 aparición sigue contando como nuevo (la fila de este mismo login puede no estar guardada todavía)", () => {
  const historial = [fila("Login manual · 💻 PC de Ana · Mozilla", "2026-09-01T10:00:00Z")];
  assertEquals(esDispositivoNuevo(historial, "PC de Ana"), true);
});

// ---- esHorarioInusual ----

Deno.test("esHorarioInusual: false con muy poco historial (no hay patrón que romper)", () => {
  const historial = Array.from({ length: UMBRAL_MIN_HISTORIAL_HORARIO - 1 }, (_, i) => fila("x", `2026-09-0${i + 1}T03:00:00Z`));
  const ahora = new Date("2026-09-10T20:00:00Z"); // hora bien distinta
  assertEquals(esHorarioInusual(historial, ahora), false);
});

Deno.test("esHorarioInusual: false si la hora actual calza con el patrón histórico", () => {
  // Todas las entradas a las 15:00 UTC = 12:00 Chile (verano).
  const historial = Array.from({ length: 6 }, (_, i) => fila("x", `2026-01-0${i + 1}T15:00:00Z`));
  const ahora = new Date("2026-01-10T15:00:00Z");
  assertEquals(esHorarioInusual(historial, ahora), false);
});

Deno.test("esHorarioInusual: true si la hora actual está lejos del patrón histórico", () => {
  const historial = Array.from({ length: 6 }, (_, i) => fila("x", `2026-01-0${i + 1}T15:00:00Z`)); // siempre 12:00 Chile
  const ahora = new Date("2026-01-10T06:00:00Z"); // 03:00 Chile — lejos
  assertEquals(esHorarioInusual(historial, ahora), true);
});

Deno.test("esHorarioInusual: margen de ±1 hora no cuenta como inusual", () => {
  const historial = Array.from({ length: 6 }, (_, i) => fila("x", `2026-01-0${i + 1}T15:00:00Z`)); // siempre 12:00 Chile
  const ahora = new Date("2026-01-10T16:00:00Z"); // 13:00 Chile — dentro del margen
  assertEquals(esHorarioInusual(historial, ahora), false);
});

// ---- contarDispositivosNuevosEnVentana ----

Deno.test("contarDispositivosNuevosEnVentana: cuenta solo primeras apariciones dentro de la ventana de 7 días", () => {
  const ahoraMs = new Date("2026-09-10T00:00:00Z").getTime();
  const historial = [
    fila("· 💻 Dispositivo A · UA", "2026-08-01T00:00:00Z"), // fuera de ventana
    fila("· 💻 Dispositivo B · UA", "2026-09-05T00:00:00Z"), // dentro de ventana
    fila("· 💻 Dispositivo B · UA", "2026-09-06T00:00:00Z"), // repetido, no cuenta de nuevo
    fila("· 💻 Dispositivo C · UA", "2026-09-08T00:00:00Z"), // dentro de ventana
  ];
  assertEquals(contarDispositivosNuevosEnVentana(historial, "Dispositivo C", false, ahoraMs), 2);
});

Deno.test("contarDispositivosNuevosEnVentana: suma el dispositivo actual si es nuevo y no está en el historial", () => {
  const ahoraMs = new Date("2026-09-10T00:00:00Z").getTime();
  const historial = [fila("· 💻 Dispositivo B · UA", "2026-09-05T00:00:00Z")];
  assertEquals(contarDispositivosNuevosEnVentana(historial, "Dispositivo Nuevo", true, ahoraMs), 2);
});

Deno.test("contarDispositivosNuevosEnVentana: cruza el umbral de alerta (3+) cuando corresponde", () => {
  const ahoraMs = new Date("2026-09-10T00:00:00Z").getTime();
  const historial = [
    fila("· 💻 A · UA", "2026-09-08T00:00:00Z"),
    fila("· 💻 B · UA", "2026-09-08T00:00:00Z"),
  ];
  const cuenta = contarDispositivosNuevosEnVentana(historial, "C", true, ahoraMs);
  assertEquals(cuenta >= UMBRAL_DISPOSITIVOS_NUEVOS, true);
});
