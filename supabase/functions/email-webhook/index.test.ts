import { assertEquals } from "jsr:@std/assert@1";
import { verificarFirmaResend, htmlATexto } from "./index.ts";

// ---- verificarFirmaResend ----
// Firma real HMAC-SHA256 estilo Svix: se calcula la firma esperada con el
// mismo mecanismo (WebCrypto) que usa la función bajo test, para no
// depender de un valor mágico precalculado a mano.
async function firmarSvix(secretoB64SinPrefijo: string, contenidoFirmado: string): Promise<string> {
  const secretoBytes = Uint8Array.from(atob(secretoB64SinPrefijo), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", secretoBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(contenidoFirmado));
  return btoa(String.fromCharCode(...new Uint8Array(firma)));
}

const SECRETO_B64 = btoa("un-secreto-de-prueba-cualquiera");
const SECRETO = "whsec_" + SECRETO_B64;

Deno.test("verificarFirmaResend: firma válida calculada con el mismo secreto pasa", async () => {
  const svixId = "msg_1";
  const svixTimestamp = "1700000000";
  const cuerpo = '{"type":"email.received"}';
  const firmaB64 = await firmarSvix(SECRETO_B64, `${svixId}.${svixTimestamp}.${cuerpo}`);
  const ok = await verificarFirmaResend(SECRETO, svixId, svixTimestamp, cuerpo, `v1,${firmaB64}`);
  assertEquals(ok, true);
});

Deno.test("verificarFirmaResend: firma con secreto distinto no pasa", async () => {
  const svixId = "msg_1";
  const svixTimestamp = "1700000000";
  const cuerpo = '{"type":"email.received"}';
  const firmaB64 = await firmarSvix(btoa("otro-secreto-completamente-distinto"), `${svixId}.${svixTimestamp}.${cuerpo}`);
  const ok = await verificarFirmaResend(SECRETO, svixId, svixTimestamp, cuerpo, `v1,${firmaB64}`);
  assertEquals(ok, false);
});

Deno.test("verificarFirmaResend: cuerpo alterado no pasa (protege integridad, no solo autenticidad)", async () => {
  const svixId = "msg_1";
  const svixTimestamp = "1700000000";
  const firmaB64 = await firmarSvix(SECRETO_B64, `${svixId}.${svixTimestamp}.{"type":"email.received"}`);
  const ok = await verificarFirmaResend(SECRETO, svixId, svixTimestamp, '{"type":"algo distinto"}', `v1,${firmaB64}`);
  assertEquals(ok, false);
});

Deno.test("verificarFirmaResend: acepta rotación de secreto (varias firmas separadas por espacio, basta una)", async () => {
  const svixId = "msg_1";
  const svixTimestamp = "1700000000";
  const cuerpo = "{}";
  const firmaValida = await firmarSvix(SECRETO_B64, `${svixId}.${svixTimestamp}.${cuerpo}`);
  const firmaBasura = "AAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
  const ok = await verificarFirmaResend(SECRETO, svixId, svixTimestamp, cuerpo, `v1,${firmaBasura} v1,${firmaValida}`);
  assertEquals(ok, true);
});

// ---- htmlATexto ----

Deno.test("htmlATexto: quita tags y colapsa espacios", () => {
  assertEquals(htmlATexto("<p>CN-9500 <b>fuera de servicio</b></p>"), "CN-9500 fuera de servicio");
});

Deno.test("htmlATexto: convierte &nbsp; a espacio normal", () => {
  assertEquals(htmlATexto("CN-9500&nbsp;fuera&nbsp;de&nbsp;servicio"), "CN-9500 fuera de servicio");
});

Deno.test("htmlATexto: colapsa múltiples espacios/saltos de línea en uno", () => {
  assertEquals(htmlATexto("CN-9500\n\n  fuera   de servicio"), "CN-9500 fuera de servicio");
});
