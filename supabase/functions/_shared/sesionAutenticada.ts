// Revisión de «sesión iniciada» para las funciones que leen fotos con IA (leer-*) y gastan la cuota de Gemini.
// El gateway (verify_jwt) ya comprobó la firma del token, pero la llave pública «anon» (que viene en el HTML de la app) también es un JWT válido: sin esta revisión, cualquiera que la
// tenga podría usar la lectura de fotos. Se exige un token de una persona con sesión iniciada (rol «authenticated»). Solo lee el rol del token; la firma no se vuelve a verificar acá.
export function esUsuarioAutenticado(authorization: string | null): boolean {
  try {
    const token = (authorization || "").replace(/^Bearer\s+/i, "");
    const payload = token.split(".")[1];
    if (!payload) return false;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "="));
    return JSON.parse(json)?.role === "authenticated";
  } catch {
    return false;
  }
}

export const MENSAJE_SIN_SESION = "Hay que iniciar sesión para leer una foto.";
