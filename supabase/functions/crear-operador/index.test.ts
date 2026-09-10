// Tests de las funciones puras de crear-operador. Ver
// supabase/functions/registrar-intento-acceso/index.test.ts para el patrón
// (import.meta.main evita levantar un servidor real al importar el
// archivo).
import { assertEquals } from "jsr:@std/assert@1";
import { randomPassword, rolValido } from "./index.ts";

// ---- rolValido ----

Deno.test("rolValido: acepta los 3 roles reales", () => {
  assertEquals(rolValido("admin"), true);
  assertEquals(rolValido("operador"), true);
  assertEquals(rolValido("lector"), true);
});

Deno.test("rolValido: rechaza cualquier otro valor", () => {
  assertEquals(rolValido("superadmin"), false);
  assertEquals(rolValido(""), false);
  assertEquals(rolValido(null), false);
  assertEquals(rolValido(undefined), false);
  assertEquals(rolValido(123), false);
});

// ---- randomPassword ----
// Política de Supabase Auth configurada hoy: 14+ caracteres,
// minúscula+mayúscula+dígito+símbolo.

Deno.test("randomPassword: cumple la política (largo + las 4 clases de carácter)", () => {
  for (let i = 0; i < 50; i++) {
    const p = randomPassword();
    if (p.length < 14) throw new Error(`password muy corta: ${p.length}`);
    if (!/[a-z]/.test(p)) throw new Error("falta minúscula: " + p);
    if (!/[A-Z]/.test(p)) throw new Error("falta mayúscula: " + p);
    if (!/[0-9]/.test(p)) throw new Error("falta dígito: " + p);
    if (!/[!@#$%^&*\-_=+?]/.test(p)) throw new Error("falta símbolo: " + p);
  }
});

Deno.test("randomPassword: nunca repite (aleatoriedad real, no un patrón fijo)", () => {
  const vistas = new Set<string>();
  for (let i = 0; i < 100; i++) vistas.add(randomPassword());
  assertEquals(vistas.size, 100);
});

Deno.test("randomPassword: respeta el largo pedido", () => {
  assertEquals(randomPassword(20).length, 20);
  assertEquals(randomPassword(14).length, 14);
});
