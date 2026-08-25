// ============================================================
// leer-informe-correctivo — SistemaMP Centinela
// Hermana de leer-pauta-pm, pero para el otro papel: "INFORME MANTENIMIENTO
// EN TALLER" (correctivos), que trae narrativa libre en "Reparación
// Efectuada" en vez de un checklist — por eso el esquema y el prompt son
// distintos, aunque el mecanismo (Gemini + JSON estructurado) es el mismo.
//
// Mismas reglas que leer-pauta-pm: NUNCA se escribe directo a producción
// desde acá — solo prellena el formulario de Registrar PM (tipo
// "Correctivo"), la persona sigue apretando Guardar. camposInciertos marca
// qué campo conviene revisar con más cuidado.
//
// verify_jwt=true ya exige un usuario logueado real — no hace falta validar
// el token acá.
// ============================================================

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

// Mismo modelo que leer-pauta-pm (gemini-2.5-flash quedó deprecado para
// llaves nuevas, probado en vivo 2026-08-25).
const MODELO = "gemini-3.6-flash";

const ESQUEMA_RESPUESTA = {
  type: "OBJECT",
  properties: {
    sigla: { type: "STRING", nullable: true, description: "Sigla del equipo (campo 'Número del Equipo'), ej. CE-87, CF-510. Tal cual está escrita, sin normalizar." },
    horometro: { type: "NUMBER", nullable: true, description: "Valor del campo Horómetro." },
    fecha: { type: "STRING", nullable: true, description: "Fecha del campo Fecha (arriba, no las de Entrega/Recepción), convertida a formato YYYY-MM-DD. Lee los dígitos del año tal como están escritos a mano, uno por uno — no asumas un año 'típico' de memoria, muchas pautas son de 2026 en adelante." },
    numeroOT: { type: "STRING", nullable: true, description: "Campo 'N° de OT', si tiene algo escrito." },
    incidente: { type: "STRING", enum: ["Sí", "No"], nullable: true, description: "Cuál casillero de 'Incidente' (Sí/No) tiene la marca." },
    mantenimientoAprobado: { type: "STRING", enum: ["Sí", "No"], nullable: true, description: "Cuál casillero de 'Mantenimiento Aprobado' (Sí/No) tiene la marca." },
    reparacionEfectuada: { type: "STRING", nullable: true, description: "Texto manuscrito completo de la sección '2.- Reparación Efectuada' — la narrativa de qué se hizo, tal cual está escrita." },
    observacionesDetectadas: { type: "STRING", nullable: true, description: "Texto de la sección '3.- Observaciones Detectadas', si tiene algo escrito." },
    accionASeguir: { type: "STRING", nullable: true, description: "Texto de la sección '4.- Acción a Seguir', si tiene algo escrito." },
    fechaEntrega: { type: "STRING", nullable: true, description: "Fecha de Entrega del Equipo (sección Conformidad de Servicios), formato YYYY-MM-DD." },
    horaEntrega: { type: "STRING", nullable: true, description: "Hora de Entrega del Equipo, formato HH:MM (24h)." },
    fechaRecepcion: { type: "STRING", nullable: true, description: "Fecha de Recepción del Equipo, formato YYYY-MM-DD." },
    horaRecepcion: { type: "STRING", nullable: true, description: "Hora de Recepción del Equipo, formato HH:MM (24h)." },
    mantenedor: { type: "STRING", nullable: true, description: "Nombre(s) del campo 'Identificación del Mantenedor' — puede venir más de un nombre separados por '/', cópialos tal cual." },
    camposInciertos: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "Nombres de los campos de arriba (ej. 'horometro', 'sigla') cuya letra manuscrita es ambigua o dudosa — igual da su mejor intento en el campo, pero lo marca acá para que la persona lo revise con más cuidado antes de guardar. Prefiere marcar de más antes que devolver algo con total confianza si tienes cualquier duda real al leerlo.",
    },
  },
  required: ["camposInciertos"],
};

const PROMPT = `Esta es una foto de un "INFORME MANTENIMIENTO EN TALLER" de una faena minera, con datos escritos a mano: Fecha, Horómetro, N° de OT, Número del Equipo, casilleros de Incidente (Sí/No) y Mantenimiento Aprobado (Sí/No), una sección narrativa "2.- Reparación Efectuada" con el detalle de lo que se hizo, secciones opcionales "3.- Observaciones Detectadas" y "4.- Acción a Seguir", una sección "Conformidad de Servicios y Equipos" con Fecha/Hora de Entrega del Equipo y Fecha/Hora de Recepción del Equipo, y el nombre de quien mantuvo el equipo ("Identificación del Mantenedor").

Lee todos esos campos. Si un campo no aparece en la foto, está en blanco, o es ilegible, déjalo en null — nunca inventes un valor ni completes la narrativa de tu cuenta. Para "Reparación Efectuada" y las demás secciones narrativas, transcribe el texto manuscrito tal cual está, sin resumir ni corregir. Si un campo SÍ tiene un valor pero la letra es ambigua (un dígito que podría ser 1 o 7, un dígito del año que no se ve con total claridad, una palabra difícil de leer), da tu mejor intento de todas formas pero agrega el nombre de ese campo a camposInciertos.`;

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
      console.error("leer-informe-correctivo: Gemini respondió", resp.status, detalle);
      return json({ error: "El modelo no pudo procesar la imagen (código " + resp.status + ")." }, 502);
    }

    const data = await resp.json();
    const textoJSON = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textoJSON) {
      console.error("leer-informe-correctivo: respuesta sin contenido", JSON.stringify(data).slice(0, 500));
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
    console.error("leer-informe-correctivo: error", e);
    return json({ error: String(e) }, 500);
  }
});
