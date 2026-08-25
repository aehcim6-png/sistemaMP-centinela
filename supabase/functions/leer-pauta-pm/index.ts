// ============================================================
// leer-pauta-pm — SistemaMP Centinela
// Lee la foto de una pauta de mantención preventiva firmada (el papel que
// firma el Jefe de Taller — "MANTENCION PREVENTIVA PROGRAMADA A EJECUTAR")
// y devuelve los campos que "Registrar PM" necesita, para que la persona
// solo tenga que revisar y confirmar en vez de tipear todo de nuevo.
//
// Motivado por una tarea real de esta sesión: 7 pautas firmadas en PDF que
// tuve que leer y tipear a mano, una por una — incluyendo un caso real de
// letra ambigua (CF-510: horómetro que podía leerse "15711" con un dígito
// dudoso). Por eso NUNCA se escribe directo a producción desde acá: esto
// solo prellena el formulario de Registrar PM, la persona sigue apretando
// Guardar. camposInciertos existe justo para marcar en el formulario qué
// campo conviene revisar con más cuidado antes de confirmar.
//
// verify_jwt=true (configurado al desplegar) ya exige un usuario logueado
// real antes de que este código corra — no hace falta volver a validar el
// token acá, a diferencia de crear-operador (que además necesita saber SI
// es admin, acá cualquier usuario que puede usar "Registrar PM" puede usar
// esto).
//
// GEMINI_API_KEY: cuenta separada de la de Claude.ai del usuario (API de
// desarrolladores de Google AI Studio, con su propio nivel gratuito) — se
// eligió Gemini para este flujo específicamente porque no requería medio
// de pago para partir.
// ============================================================

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const MODELO = "gemini-3.6-flash";

const ESQUEMA_RESPUESTA = {
  type: "OBJECT",
  properties: {
    sigla: { type: "STRING", nullable: true, description: "Sigla del equipo (campo 'N° Interno Equipo'), ej. MN-26, CF-510, CE-159. Tal cual está escrita, sin normalizar." },
    tipoPM: { type: "STRING", enum: ["PM1", "PM2", "PM3", "PM4"], nullable: true, description: "Cuál casillero de Tipo PM tiene la marca/X." },
    horometro: { type: "NUMBER", nullable: true, description: "Valor del campo Horómetro." },
    fecha: { type: "STRING", nullable: true, description: "Fecha del campo Fecha, convertida a formato YYYY-MM-DD (el papel suele traerla DD-MM-AA o DD/MM/AAAA). Lee los dígitos del año tal como están escritos a mano, uno por uno — no asumas un año 'típico' de memoria, muchas pautas son de 2026 en adelante." },
    horaInicio: { type: "STRING", nullable: true, description: "Hora Inicio en formato HH:MM (24h)." },
    horaTermino: { type: "STRING", nullable: true, description: "Hora Término en formato HH:MM (24h)." },
    tecnico1: { type: "STRING", nullable: true, description: "Nombre del campo Mecánico 1." },
    tecnico2: { type: "STRING", nullable: true, description: "Nombre del campo Mecánico 2, si está." },
    supervisor: { type: "STRING", nullable: true, description: "Nombre del campo Supervisor." },
    camposInciertos: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "Nombres de los campos de arriba (ej. 'horometro', 'sigla') cuya letra manuscrita es ambigua o dudosa — igual da su mejor intento en el campo, pero lo marca acá para que la persona lo revise con más cuidado antes de guardar.",
    },
  },
  required: ["camposInciertos"],
};

const PROMPT = `Esta es una foto de una pauta de mantención preventiva de una faena minera ("MANTENCION PREVENTIVA PROGRAMADA A EJECUTAR"), con datos escritos a mano en la cabecera del formulario: N° Interno Equipo, Horómetro, Fecha, Hora Inicio, Hora Término, Mecánico 1, Mecánico 2, Supervisor, y una fila "Tipo PM" con 4 casilleros (PM1/PM2/PM3/PM4) donde uno tiene una marca o X.

Lee solo esos datos de cabecera (ignora la tabla larga de actividades/checklist de abajo). Si un campo no aparece en la foto o es ilegible, déjalo en null — nunca inventes un valor. Si un campo SÍ tiene un valor pero la letra es ambigua (por ejemplo un dígito que podría ser 1 o 7, o un dígito del año que no se ve con total claridad), da tu mejor intento de todas formas pero agrega el nombre de ese campo a camposInciertos — prefiere marcar un campo como incierto de más antes que devolverlo con total confianza si tienes cualquier duda real al leerlo.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) return json({ error: "Falta configurar GEMINI_API_KEY en los secretos del proyecto." }, 500);

    const body = await req.json();
    const imagenBase64: string | undefined = body?.imagenBase64;
    const mimeType: string = body?.mimeType || "image/jpeg";
    if (!imagenBase64) return json({ error: "Falta imagenBase64." }, 400);
    // Tope generoso (~8MB en base64) — la app ya comprime la foto a máx.
    // 1600px/JPEG 0.75 antes de mandarla (ver comprimirImagen en
    // index.html), esto es solo un resguardo contra un payload gigante.
    if (imagenBase64.length > 11_000_000) return json({ error: "La imagen es muy grande, inténtalo con una foto más liviana." }, 400);

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mimeType, data: imagenBase64 } },
            ],
          }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: ESQUEMA_RESPUESTA,
            temperature: 0,
          },
        }),
      }
    );

    if (!resp.ok) {
      const detalle = await resp.text();
      console.error("leer-pauta-pm: Gemini respondió", resp.status, detalle);
      return json({ error: "El modelo no pudo procesar la imagen (código " + resp.status + ")." }, 502);
    }

    const data = await resp.json();
    const textoJSON = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textoJSON) {
      console.error("leer-pauta-pm: respuesta sin contenido", JSON.stringify(data).slice(0, 500));
      return json({ error: "El modelo no devolvió ningún dato — probablemente la foto no se ve clara." }, 502);
    }

    let extraido;
    try {
      extraido = JSON.parse(textoJSON);
    } catch {
      return json({ error: "El modelo devolvió una respuesta que no se pudo interpretar." }, 502);
    }

    return json({ ok: true, datos: extraido });
  } catch (e) {
    console.error("leer-pauta-pm: error", e);
    return json({ error: String(e) }, 500);
  }
});
