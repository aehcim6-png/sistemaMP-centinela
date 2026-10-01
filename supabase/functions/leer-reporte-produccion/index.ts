// ============================================================
// leer-reporte-produccion — SistemaMP Centinela
// Cuarta hermana de leer-pauta-pm / leer-informe-correctivo /
// leer-chequeo-neumaticos, para el "Reporte de Producción" por turno
// (Día/Noche) de Besalco — foto de una planilla Excel impresa/exportada.
//
// v1 (acotado a propósito, ver docs/arquitectura.md): solo procesa las 2
// secciones que alimentan Rendimiento/OEE real — Producción CAEX y Pérdida
// por Indisponibilidad. Carguío, Apoyo y Pérdida por Petróleo quedan para
// una vuelta futura (el esquema de la tabla ya las contempla, ver migración
// 20260930210000_crear_tablas_produccion_turno.sql).
//
// "Equipo" en la columna CAEX del papel (ej. "CAEX-85") es un apodo
// operacional, NUNCA el tipo real del sistema ('Camion'/'Camion Aljibe') —
// por eso el esquema lo llama equipoNombre, no tipo, para que ni el modelo
// ni el código downstream lo confundan. Cuando el papel dice "fuera de
// servicio"/"stand by" en vez de horas, totalHoras queda null y
// estadoTexto captura el texto tal cual — nunca se inventa un número.
//
// Mismas reglas que las otras tres: NUNCA se escribe directo a producción
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

const MODELO = "gemini-3.6-flash";

const ESQUEMA_EQUIPO_CAEX = {
  type: "OBJECT",
  properties: {
    sigla: { type: "STRING", nullable: true, description: "Sigla real del equipo (columna 'Sigla'), ej. 'CN-9503'." },
    equipoNombre: { type: "STRING", nullable: true, description: "Apodo operacional de la columna 'Equipo' (ej. 'CAEX-85') — NO es el tipo real del sistema, solo un nombre informativo." },
    horometroInicial: { type: "NUMBER", nullable: true, description: "Horómetro inicial del turno." },
    horometroFinal: { type: "NUMBER", nullable: true, description: "Horómetro final del turno." },
    totalHoras: { type: "NUMBER", nullable: true, description: "Total de horas trabajadas. Si la celda dice 'fuera de servicio' o 'stand by' en vez de un número, deja esto en null (nunca inventes un número) y usa estadoTexto." },
    estadoTexto: { type: "STRING", nullable: true, description: "Si la columna de horas dice texto en vez de un número (ej. 'fuera de servicio', 'stand by'), el texto tal cual. null si la celda tiene un número normal." },
    vueltas: { type: "NUMBER", nullable: true, description: "Columna 'Vueltas'." },
    rendimientoVueltasHr: { type: "NUMBER", nullable: true, description: "Columna 'Rendimiento [Vueltas/Hr]'." },
    tiempoCicloMin: { type: "NUMBER", nullable: true, description: "Columna 'Tiempo de Ciclo [min/vuelta]'." },
    operador: { type: "STRING", nullable: true, description: "Columna 'Nombre Operador'." },
    tonVuelta: { type: "NUMBER", nullable: true, description: "Columna 'Ton/Vuelta' (valor fijo por equipo, ej. 90)." },
    totalTon: { type: "NUMBER", nullable: true, description: "Columna 'Total Ton Equipo'." },
    incierto: { type: "BOOLEAN", description: "true si algún valor de esta fila es ambiguo o dudoso de leer, false si se lee con confianza." },
  },
  required: ["incierto"],
};

const ESQUEMA_PERDIDA_INDISPONIBILIDAD = {
  type: "OBJECT",
  properties: {
    sigla: { type: "STRING", nullable: true, description: "Sigla real del equipo en la tabla 'Pérdida estimada asociada a Indisponibilidad'." },
    horometroInicial: { type: "NUMBER", nullable: true },
    horometroFinal: { type: "NUMBER", nullable: true },
    totalHoras: { type: "NUMBER", nullable: true, description: "Horas de indisponibilidad de esta fila." },
    tonAsociado: { type: "NUMBER", nullable: true, description: "Columna 'Tonelaje Asociado' — toneladas de producción perdidas por esta indisponibilidad." },
    incierto: { type: "BOOLEAN", description: "true si algún valor de esta fila es ambiguo o dudoso de leer, false si se lee con confianza." },
  },
  required: ["incierto"],
};

const ESQUEMA_RESPUESTA = {
  type: "OBJECT",
  properties: {
    fecha: { type: "STRING", nullable: true, description: "Fecha del turno, formato YYYY-MM-DD. Lee los dígitos tal como están escritos — no asumas un año 'típico' de memoria." },
    turno: { type: "STRING", nullable: true, enum: ["dia", "noche"], description: "'dia' o 'noche' según el encabezado ('PRODUCCIÓN TURNO DÍA' / 'PRODUCCIÓN TURNO NOCHE')." },
    supervisor: { type: "STRING", nullable: true },
    contrato: { type: "STRING", nullable: true, description: "N° de Contrato." },
    franjaDescarga: { type: "STRING", nullable: true, description: "Campo 'Franja en descarga'." },
    moduloDescarga: { type: "STRING", nullable: true, description: "Campo 'Módulo en descarga'." },
    distanciaModulos: { type: "NUMBER", nullable: true, description: "Campo 'Distancia módulos'." },
    observacionesDistancia: { type: "STRING", nullable: true, description: "Observaciones sobre distancia óptima, si las hay." },
    totalToneladas: { type: "NUMBER", nullable: true, description: "Total Toneladas del turno, de la sección de Totales." },
    rendimientoTransporteTonHr: { type: "NUMBER", nullable: true, description: "Rendimiento Transporte [Ton/hr] de la sección de Totales." },
    totalVueltas: { type: "NUMBER", nullable: true, description: "Total Vueltas de la sección de Totales." },
    observaciones: { type: "STRING", nullable: true, description: "Texto libre de la sección Observaciones/Comentarios." },
    caex: {
      type: "ARRAY",
      description: "Una entrada por cada fila de la tabla 'Producción Equipos CAEX' que tenga al menos un dato escrito.",
      items: ESQUEMA_EQUIPO_CAEX,
    },
    perdidaIndisponibilidad: {
      type: "ARRAY",
      description: "Una entrada por cada fila de la tabla 'Pérdida estimada asociada a Indisponibilidad' que tenga al menos un dato escrito.",
      items: ESQUEMA_PERDIDA_INDISPONIBILIDAD,
    },
    camposInciertos: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "Nombres de los campos de CABECERA (ej. 'fecha', 'supervisor') cuya letra o valor es ambiguo o dudoso.",
    },
  },
  required: ["caex", "perdidaIndisponibilidad", "camposInciertos"],
};

const PROMPT = `Esta es una foto de un "Reporte de Producción" por turno (Día o Noche) de una faena minera, formato planilla Excel impresa/exportada. Cada foto es UN reporte completo de UN turno.

La hoja tiene un encabezado (N° Contrato, Supervisor, Fecha, Turno, Franja en descarga, Módulo en descarga, Distancia módulos), varias tablas por categoría de equipo, y una sección de Totales del turno y Observaciones.

Para esta pasada, extrae SOLO:
1. Los datos del encabezado.
2. La tabla "Producción Equipos CAEX" (camiones mineros) — columnas Sigla, Equipo, Horómetro inicial, Horómetro final, Total Horas (o "fuera de servicio"/"stand by" como texto), Vueltas, Rendimiento [Vueltas/Hr], Tiempo de Ciclo [min/vuelta], Nombre Operador, Ton/Vuelta, Total Ton Equipo.
3. La tabla "Pérdida estimada asociada a Indisponibilidad" — columnas Sigla, Horómetro inicial/final, Total Horas, Tonelaje Asociado.
4. Los Totales del turno y Observaciones.

Ignora las tablas de Equipos de Carguío, Equipos de Apoyo y Pérdida estimada asociada a Petróleo — no forman parte de esta extracción.

Para cada fila de las 2 tablas que sí extraes, inclúyela SOLO si tiene al menos un dato escrito — no incluyas filas completamente en blanco. Si un campo no aparece en la foto, está en blanco, o es ilegible, déjalo en null — nunca inventes un valor. Si un valor SÍ está escrito pero es ambiguo, da tu mejor intento de todas formas pero marca esa fila con incierto:true, o agrega el campo de cabecera a camposInciertos.`;

export const TOPE_IMAGEN_BASE64 = 11_000_000;

export function validarImagenBase64(body: { imagenBase64?: string }): string | null {
  if (!body?.imagenBase64) return "Falta imagenBase64.";
  if (body.imagenBase64.length > TOPE_IMAGEN_BASE64) return "La imagen es muy grande, inténtalo con una foto más liviana.";
  return null;
}

if (import.meta.main) {
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) return json({ error: "Falta configurar GEMINI_API_KEY en los secretos del proyecto." }, 500);

    const body = await req.json();
    const imagenBase64: string | undefined = body?.imagenBase64;
    const mimeType: string = body?.mimeType || "image/jpeg";
    const errorValidacion = validarImagenBase64(body);
    if (errorValidacion) return json({ error: errorValidacion }, 400);

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
      console.error("leer-reporte-produccion: Gemini respondió", resp.status, detalle);
      return json({ error: "El modelo no pudo procesar la imagen (código " + resp.status + ")." }, 502);
    }

    const data = await resp.json();
    const textoJSON = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textoJSON) {
      console.error("leer-reporte-produccion: respuesta sin contenido", JSON.stringify(data).slice(0, 500));
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
    console.error("leer-reporte-produccion: error", e);
    return json({ error: String(e) }, 500);
  }
});
}
