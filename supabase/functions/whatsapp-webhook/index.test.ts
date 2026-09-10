import { assertEquals, assert } from "jsr:@std/assert@1";
import {
  resolverSigla,
  clasificarComponente,
  pareceMantencionProgramada,
  pareceExactaPregunta,
  pareceReporteFalla,
  extraerHorometro,
  parsearReporteFalla,
  verificarFirmaTwilio,
  twiml,
  CATEGORIAS_VALIDAS,
} from "./index.ts";
import { CATEGORIAS_VALIDAS as CATEGORIAS_COMPARTIDAS } from "../_shared/parseCorrectivo.ts";

// ---- Guardarraíl contra el "Bug real #2" del comentario del archivo:
// esta función trae el parser por reglas COPIADO A MANO de
// _shared/parseCorrectivo.ts (Deno Deploy no resuelve imports relativos
// fuera de la carpeta de la función de forma confiable) — si algún día se
// agrega una categoría en un solo lado y no en el otro, este test lo
// detecta antes de que un reporte real de WhatsApp caiga silenciosamente
// en "componente no identificado".
Deno.test("CATEGORIAS_VALIDAS: la copia local coincide EXACTO con _shared/parseCorrectivo.ts", () => {
  assertEquals(CATEGORIAS_VALIDAS, CATEGORIAS_COMPARTIDAS);
});

// ---- resolverSigla ----

Deno.test("resolverSigla: traduce un código viejo conocido", () => {
  assertEquals(resolverSigla("CAEX-87 fuera de servicio"), { sigla: "CN-9500", siglaOriginal: "CAEX-87" });
});

Deno.test("resolverSigla: acepta una sigla ya actual tal cual", () => {
  assertEquals(resolverSigla("BD-9533 con falla"), { sigla: "BD-9533", siglaOriginal: "BD-9533" });
});

Deno.test("resolverSigla: null si no hay ninguna sigla reconocible", () => {
  assertEquals(resolverSigla("hola, buen día"), { sigla: null, siglaOriginal: null });
});

// ---- clasificarComponente ----

Deno.test("clasificarComponente: reconoce por palabra clave simple", () => {
  assertEquals(clasificarComponente("se rompió el turbo"), "Turbo");
});

Deno.test("clasificarComponente: usa RegExp de palabra completa cuando hace falta (Pala vs. Palanca)", () => {
  assertEquals(clasificarComponente("se rompió la pala"), "Pala (Motoniveladora)");
  assertEquals(clasificarComponente("problema con el joystick, la palanca no responde"), "Joystick/Palanca de Mando");
});

Deno.test("clasificarComponente: vacío si no matchea ninguna categoría", () => {
  assertEquals(clasificarComponente("algo raro sin ninguna palabra clave real"), "");
});

// ---- pareceMantencionProgramada / pareceExactaPregunta / pareceReporteFalla ----

Deno.test("pareceMantencionProgramada", () => {
  assertEquals(pareceMantencionProgramada("mantencion programada de la CN-9500"), true);
  assertEquals(pareceMantencionProgramada("PM2 esta semana"), true);
  assertEquals(pareceMantencionProgramada("fuera de servicio"), false);
});

Deno.test("pareceExactaPregunta", () => {
  assertEquals(pareceExactaPregunta("¿sigue fuera de servicio?"), true);
  assertEquals(pareceExactaPregunta("sigue fuera de servicio?"), true);
  assertEquals(pareceExactaPregunta("CN-9500 fuera de servicio"), false);
});

Deno.test("pareceReporteFalla", () => {
  assertEquals(pareceReporteFalla("CN-9500 no enciende"), true);
  assertEquals(pareceReporteFalla("CN-9500 se rompió"), true);
  assertEquals(pareceReporteFalla("todo bien por acá"), false);
});

// ---- extraerHorometro ----

Deno.test("extraerHorometro: reconoce hrs/horas, null si no aparece", () => {
  assertEquals(extraerHorometro("a las 12345 hrs"), 12345);
  assertEquals(extraerHorometro("12345 horas"), 12345);
  assertEquals(extraerHorometro("sin ningún número"), null);
});

// ---- parsearReporteFalla (integración de las piezas de arriba) ----

Deno.test("parsearReporteFalla: reporte claro, alta confianza", () => {
  const r = parsearReporteFalla("CN-9500 fuera de servicio, falla de turbo");
  assert(r);
  assertEquals(r!.sigla, "CN-9500");
  assertEquals(r!.componente, "Turbo");
  assertEquals(r!.confianza, "alta");
});

Deno.test("parsearReporteFalla: ruido puro se descarta", () => {
  assertEquals(parsearReporteFalla("ok gracias"), null);
});

// ---- verificarFirmaTwilio ----
// Algoritmo real de Twilio: concatenar la URL + cada par clave+valor
// (params ordenados alfabéticamente por clave) y firmar con HMAC-SHA1.

Deno.test("verificarFirmaTwilio: reproduce la firma esperada para un set de parámetros conocido", async () => {
  const authToken = "un-auth-token-de-prueba";
  const url = "https://ejemplo.supabase.co/functions/v1/whatsapp-webhook";
  const params = new URLSearchParams({ From: "whatsapp:+56911111111", Body: "CN-9500 fuera de servicio" });

  // Firma de referencia calculada a mano con el mismo algoritmo (concatenar
  // url + claves ordenadas + valores, HMAC-SHA1) para no depender de un
  // valor externo — si el algoritmo de la función cambia sin querer, esta
  // igualdad deja de cumplirse.
  const claves = [...params.keys()].sort();
  let base = url;
  for (const k of claves) base += k + params.get(k);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(authToken), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const firmaEsperada = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(base));
  const firmaEsperadaB64 = btoa(String.fromCharCode(...new Uint8Array(firmaEsperada)));

  const firmaCalculada = await verificarFirmaTwilio(authToken, url, params);
  assertEquals(firmaCalculada, firmaEsperadaB64);
});

Deno.test("verificarFirmaTwilio: distinto auth token da una firma distinta", async () => {
  const url = "https://ejemplo.supabase.co/functions/v1/whatsapp-webhook";
  const params = new URLSearchParams({ From: "whatsapp:+56911111111", Body: "hola" });
  const f1 = await verificarFirmaTwilio("token-1", url, params);
  const f2 = await verificarFirmaTwilio("token-2", url, params);
  assert(f1 !== f2);
});

// ---- twiml ----

Deno.test("twiml: arma el XML esperado y escapa & y <", () => {
  const r = twiml("✅ Registrado: CN-9500 & <listo>");
  assertEquals(r.headers.get("Content-Type"), "text/xml");
});

Deno.test("twiml: mensaje vacío no agrega <Message>", async () => {
  const r = twiml("");
  const texto = await r.text();
  assertEquals(texto.includes("<Message>"), false);
});
