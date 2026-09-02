// Interpretación con IA (Claude) de un reporte de falla en lenguaje libre —
// respaldo del parser por reglas (parseCorrectivo.ts) para los mensajes que
// éste no logra resolver con confianza (lenguaje informal, sinónimos, jerga
// no anticipada). Se usa SOLO como segunda pasada, nunca como primera
// opción: el parser por reglas ya está validado a mano sobre 8 meses de
// historial real y resuelve bien la mayoría de los mensajes sin pagar el
// costo/latencia de una llamada a una API externa — la IA entra recién
// cuando el parser por reglas ya dijo "no estoy seguro".
//
// Nunca se confía ciegamente en lo que devuelve el modelo: la sigla y el
// componente que entrega se VALIDAN acá contra las listas reales que se le
// dieron como contexto (equipos existentes, categorías de componente ya
// definidas) — si el modelo inventa algo que no está en esas listas, se
// descarta como si no hubiera reconocido nada, igual que haría el parser
// por reglas. El llamador (whatsapp-webhook) además solo sube la confianza
// a "alta" si la IA resolvió TANTO sigla como componente — si falta
// cualquiera de los dos, el mensaje sigue quedando "— revisar" como hoy.
export interface InterpretacionIA {
  esFalla: boolean;
  sigla: string | null;
  componente: string | null;
  horometro: number | null;
  resumen: string;
}

// Haiku, no Sonnet/Opus: esta es una clasificación acotada (elegir de 2
// listas cerradas + extraer un número), no una tarea que necesite el
// modelo más grande — y corre en cada mensaje entrante, así que el costo
// por llamada importa.
const MODELO = "claude-haiku-4-5-20251001";

export async function interpretarConIA(
  texto: string,
  siglasValidas: string[],
  categoriasValidas: string[]
): Promise<InterpretacionIA | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey || !texto.trim() || siglasValidas.length === 0) return null;

  const herramienta = {
    name: "clasificar_reporte",
    description: "Clasifica un mensaje de WhatsApp como reporte de falla de un equipo minero, o no.",
    input_schema: {
      type: "object",
      properties: {
        es_reporte_falla: {
          type: "boolean",
          description:
            "true SOLO si el mensaje reporta claramente una falla/problema real de un equipo. false si es una pregunta, un aviso de mantención programada, un saludo, una confirmación, o cualquier otra cosa que no sea reportar una falla nueva.",
        },
        sigla: {
          type: "string",
          description: "La sigla EXACTA del equipo, tal como aparece en la lista de siglas válidas entregada. Omite este campo por completo si no puedes determinarla con confianza — nunca inventes una.",
        },
        componente: {
          type: "string",
          description: "La categoría EXACTA del componente/sistema afectado, tal como aparece en la lista de categorías válidas entregada. Omite este campo si no está claro — nunca inventes una.",
        },
        horometro: {
          type: "number",
          description: "Horómetro en horas, SOLO si el mensaje lo menciona explícitamente. Omite este campo si no aparece.",
        },
        resumen: {
          type: "string",
          description: "Resumen breve (máximo 25 palabras) de la falla, en español, listo para guardar como descripción.",
        },
      },
      required: ["es_reporte_falla", "resumen"],
    },
  };

  const sistema =
    `Eres un asistente que clasifica reportes de falla de equipos mineros escritos por técnicos por WhatsApp, ` +
    `a veces con errores de tipeo, jerga local o lenguaje indirecto.\n\n` +
    `Siglas de equipo VÁLIDAS (usa exactamente una de esta lista si identificas de cuál equipo se trata; si no estás razonablemente seguro, omite el campo):\n${siglasValidas.join(", ")}\n\n` +
    `Categorías de componente VÁLIDAS (usa exactamente una de esta lista; si no está claro, omite el campo):\n${categoriasValidas.join(", ")}\n\n` +
    `Nunca inventes una sigla ni una categoría que no esté en estas listas exactas.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 300,
        system: sistema,
        messages: [{ role: "user", content: texto.slice(0, 1000) }],
        tools: [herramienta],
        tool_choice: { type: "tool", name: "clasificar_reporte" },
      }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const bloque = (data.content || []).find((b: { type: string }) => b.type === "tool_use");
    if (!bloque || !bloque.input) return null;
    const input = bloque.input as Record<string, unknown>;

    const sigla = typeof input.sigla === "string" && siglasValidas.includes(input.sigla) ? input.sigla : null;
    const componente = typeof input.componente === "string" && categoriasValidas.includes(input.componente) ? input.componente : null;
    const horometro = typeof input.horometro === "number" && Number.isFinite(input.horometro) ? input.horometro : null;

    return {
      esFalla: input.es_reporte_falla === true,
      sigla,
      componente,
      horometro,
      resumen: typeof input.resumen === "string" ? input.resumen.slice(0, 500) : texto.slice(0, 500),
    };
  } catch {
    return null;
  }
}
