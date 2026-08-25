// ============================================================
// leer-chequeo-neumaticos — SistemaMP Centinela
// Tercera hermana de leer-pauta-pm / leer-informe-correctivo, para el papel
// "Chequeo Diario De Neumáticos" — que trae hasta 4 equipos por hoja, cada
// uno con su propia tabla de hasta 10 neumáticos (uno por posición). Por eso
// la respuesta es un ARRAY de "paneles" en vez de un solo objeto plano.
//
// Cada fila con datos se prellena como una Medición Remanente para el
// neumático YA REGISTRADO en ese Equipo+Posición — no crea neumáticos
// nuevos. El frontend (neu.js) es el que hace ese emparejamiento y muestra
// todo para revisar antes de guardar; acá solo se extrae lo que dice el
// papel, tal cual.
//
// Mismas reglas que las otras dos: NUNCA se escribe directo a producción
// desde acá, y "incierto"/camposInciertos existen para que la persona sepa
// qué mirar con más cuidado antes de confirmar.
// ============================================================

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

// Mismo modelo que las otras dos funciones OCR (gemini-2.5-flash quedó
// deprecado para llaves nuevas, probado en vivo 2026-08-25).
const MODELO = "gemini-3.6-flash";

const ESQUEMA_NEUMATICO = {
  type: "OBJECT",
  properties: {
    posicion: { type: "NUMBER", description: "Número de la fila (columna 'Pos.'), del 1 al 10." },
    serie: { type: "STRING", nullable: true, description: "N° de serie del neumático en esa posición, si está escrito en la columna 'Neumáticos/Serie'." },
    presion: { type: "NUMBER", nullable: true, description: "Valor de la columna Psi 'ACT' (presión actual en PSI)." },
    temperatura: { type: "NUMBER", nullable: true, description: "Valor de la columna Psi 'T°' (temperatura)." },
    remExt: { type: "NUMBER", nullable: true, description: "Valor de la columna EXT.INT 'Hi:' (remanente exterior en mm)." },
    remInt: { type: "NUMBER", nullable: true, description: "Valor de la columna EXT.INT 'HT:' (remanente interior en mm)." },
    comentarios: { type: "STRING", nullable: true, description: "Texto de la columna Comentarios para esa fila, si tiene algo escrito." },
    incierto: { type: "BOOLEAN", description: "true si algún valor de esta fila es ambiguo o dudoso de leer (igual da tu mejor intento), false si se lee con confianza." },
  },
  required: ["posicion", "incierto"],
};

const ESQUEMA_PANEL = {
  type: "OBJECT",
  properties: {
    equipo: { type: "STRING", nullable: true, description: "Sigla del campo 'Equipo' de este panel, tal cual está escrita, sin normalizar." },
    lugar: { type: "STRING", nullable: true, description: "Texto del campo 'Lugar'." },
    fecha: { type: "STRING", nullable: true, description: "Campo 'Fecha' del panel, convertida a formato YYYY-MM-DD. Lee los dígitos del año tal como están escritos a mano, uno por uno — no asumas un año 'típico' de memoria." },
    horometro: { type: "NUMBER", nullable: true, description: "Valor del campo 'Horometro' de este panel (puede venir con unidad como 'km' o 'hrs' al lado, ignora la unidad y deja solo el número)." },
    verificacionEnergiaCero: { type: "STRING", nullable: true, description: "Lo que esté escrito en el campo 'Verificación energía cero' (ej. '0%'), tal cual." },
    neumaticos: {
      type: "ARRAY",
      description: "Una entrada por cada fila de la tabla de este panel que tenga AL MENOS un dato escrito (Psi, EXT.INT o Serie) — omite las filas completamente en blanco.",
      items: ESQUEMA_NEUMATICO,
    },
    camposInciertos: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "Nombres de los campos de este panel (ej. 'horometro', 'equipo', 'fecha') cuya letra manuscrita es ambigua o dudosa.",
    },
  },
  required: ["neumaticos", "camposInciertos"],
};

const ESQUEMA_RESPUESTA = {
  type: "OBJECT",
  properties: {
    paneles: {
      type: "ARRAY",
      description: "Un elemento por cada panel/tabla 'Chequeo Diario De Neumáticos' que aparezca en la foto — la hoja normalmente trae 4 paneles (uno por equipo), pero puede venir menos si la foto solo muestra parte de la hoja.",
      items: ESQUEMA_PANEL,
    },
  },
  required: ["paneles"],
};

const PROMPT = `Esta es una foto de una hoja "Chequeo Diario De Neumáticos" de una faena minera. La hoja normalmente trae varios paneles (hasta 4), cada uno para un equipo distinto, con su propia tabla de neumáticos.

Cada panel tiene: Equipo, Lugar, Fecha, Horometro, Verificación energía cero, y una tabla con columnas Pos. (1 a 10), Neumáticos/Serie, y bajo "Psi" dos subcolumnas ACT (presión actual) y T° (temperatura), y bajo "EXT. INT." dos subcolumnas Hi: (remanente exterior en mm) y HT: (remanente interior en mm), y Comentarios.

Identifica cada panel por separado y su tabla de neumáticos. Para cada fila de cada tabla, inclúyela en el resultado SOLO si tiene al menos un dato escrito (Psi, EXT.INT o Serie) — no incluyas filas completamente en blanco. Si un campo no aparece en la foto, está en blanco, o es ilegible, déjalo en null — nunca inventes un valor. Si un valor SÍ está escrito pero la letra es ambigua, da tu mejor intento de todas formas pero marca esa fila con incierto:true (a nivel de fila) o agrega el campo del panel a camposInciertos (a nivel de panel).`;

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
      console.error("leer-chequeo-neumaticos: Gemini respondió", resp.status, detalle);
      return json({ error: "El modelo no pudo procesar la imagen (código " + resp.status + ")." }, 502);
    }

    const data = await resp.json();
    const textoJSON = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textoJSON) {
      console.error("leer-chequeo-neumaticos: respuesta sin contenido", JSON.stringify(data).slice(0, 500));
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
    console.error("leer-chequeo-neumaticos: error", e);
    return json({ error: String(e) }, 500);
  }
});
