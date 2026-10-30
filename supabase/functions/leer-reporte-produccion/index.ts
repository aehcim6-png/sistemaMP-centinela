// ============================================================
// leer-reporte-produccion — SistemaMP Centinela
// Cuarta hermana de leer-pauta-pm / leer-informe-correctivo /
// leer-chequeo-neumaticos, para el "Reporte de Producción" por turno
// (Día/Noche) de Besalco — foto de una planilla Excel impresa/exportada.
//
// v2 (30-oct-2026, «reporte completo»): lee TODO el reporte — CAEX, Carguío,
// Apoyo, Pérdida por Petróleo, Pérdida por Indisponibilidad, los totales de
// transporte y de carguío, la lista de disponibilidad y la bitácora de eventos
// del turno. La v1 solo leía CAEX + Indisponibilidad (ver docs/arquitectura.md).
// Los cálculos de Rendimiento/OEE siguen mirando solo las categorías que ya
// usaban; las filas nuevas quedan guardadas para consulta y para lo que venga.
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

import { esUsuarioAutenticado, MENSAJE_SIN_SESION } from "../_shared/sesionAutenticada.ts";

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
    sigla: { type: "STRING", nullable: true, description: "Sigla real del equipo (columna 'Sigla'), ej. 'CN-9503'. null si la tabla no trae columna Sigla (solo 'Equipos')." },
    equipoNombre: { type: "STRING", nullable: true, description: "Nombre corto de la columna 'Equipo'/'Equipos' (ej. 'CAEX-85') — NO es el tipo real del sistema, solo un nombre informativo." },
    horometroInicial: { type: "NUMBER", nullable: true, description: "Horómetro inicial del turno." },
    horometroFinal: { type: "NUMBER", nullable: true, description: "Horómetro final del turno." },
    totalHoras: { type: "NUMBER", nullable: true, description: "Total de horas trabajadas. Si la fila está marcada 'fuera de servicio', 'standby' o 'mantención programada' (la celda de horas o la del operador), deja esto en null cuando no hay un número real (nunca inventes uno) y usa estadoTexto." },
    estadoTexto: { type: "STRING", nullable: true, description: "Si la fila está marcada 'fuera de servicio', 'standby', 'mantención programada' o 'sin operador' (en la celda de horas o en la del operador), el texto tal cual. null si la fila trabajó normal." },
    vueltas: { type: "NUMBER", nullable: true, description: "Columna 'Vueltas'." },
    rendimientoVueltasHr: { type: "NUMBER", nullable: true, description: "Columna 'Rendimiento [Vueltas/Hr]'." },
    tiempoCicloMin: { type: "NUMBER", nullable: true, description: "Columna 'Tiempo de Ciclo [min/vuelta]'." },
    operador: { type: "STRING", nullable: true, description: "Columna 'Nombre Operador' (si hay dos nombres separados por '/', ambos tal cual). null si la fila dice fuera de servicio, standby o mantención." },
    tonVuelta: { type: "NUMBER", nullable: true, description: "Columna 'Ton/Vuelta' (valor fijo por equipo, ej. 90)." },
    totalTon: { type: "NUMBER", nullable: true, description: "Columna 'Total Ton Equipo'." },
    incierto: { type: "BOOLEAN", description: "true si algún valor de esta fila es ambiguo o dudoso de leer, false si se lee con confianza." },
  },
  required: ["incierto"],
};

const ESQUEMA_PERDIDA_INDISPONIBILIDAD = {
  type: "OBJECT",
  properties: {
    sigla: { type: "STRING", nullable: true, description: "Sigla real del equipo en la tabla 'Pérdida estimada asociada a Indisponibilidad' (si la tabla solo trae el nombre corto, ej. 'CAEX-85', ponlo aquí tal cual)." },
    horometroInicial: { type: "NUMBER", nullable: true },
    horometroFinal: { type: "NUMBER", nullable: true },
    totalHoras: { type: "NUMBER", nullable: true, description: "Horas de indisponibilidad de esta fila." },
    tonAsociado: { type: "NUMBER", nullable: true, description: "Columna 'Tonelaje Asociado' — toneladas de producción perdidas por esta indisponibilidad." },
    incierto: { type: "BOOLEAN", description: "true si algún valor de esta fila es ambiguo o dudoso de leer, false si se lee con confianza." },
  },
  required: ["incierto"],
};

const ESQUEMA_CARGUIO = {
  type: "OBJECT",
  properties: {
    sigla: { type: "STRING", nullable: true, description: "Sigla real del equipo de carguío (columna 'Sigla'), ej. 'CF-9510'." },
    equipoNombre: { type: "STRING", nullable: true, description: "Columna 'Equipo' (ej. 'CF-510') — apodo operacional, no el tipo del sistema." },
    horometroInicial: { type: "NUMBER", nullable: true },
    horometroFinal: { type: "NUMBER", nullable: true },
    totalHoras: { type: "NUMBER", nullable: true, description: "Total de horas trabajadas." },
    estadoTexto: { type: "STRING", nullable: true, description: "'fuera de servicio' / 'stand by' tal cual si la fila está marcada así (aunque el texto esté en la columna del operador). null si la fila trabajó normal." },
    tonelaje: { type: "NUMBER", nullable: true, description: "Columna 'Tonelaje' cargado por el equipo en el turno." },
    rendimientoTonHr: { type: "NUMBER", nullable: true, description: "Columna 'Rendimiento [Ton/Hr]'." },
    operador: { type: "STRING", nullable: true, description: "Columna 'Nombre Operador'. null si la fila dice fuera de servicio." },
    postura: { type: "STRING", nullable: true, description: "Columna 'Postura' (ej. 'F11 M6')." },
    incierto: { type: "BOOLEAN", description: "true si algún valor de esta fila es ambiguo o dudoso de leer." },
  },
  required: ["incierto"],
};

const ESQUEMA_APOYO = {
  type: "OBJECT",
  properties: {
    sigla: { type: "STRING", nullable: true, description: "Sigla real del equipo de apoyo (columna 'Sigla'), ej. 'BD-9509'." },
    equipoNombre: { type: "STRING", nullable: true, description: "Columna 'Equipo' (ej. 'BD-509')." },
    horometroInicial: { type: "NUMBER", nullable: true },
    horometroFinal: { type: "NUMBER", nullable: true },
    totalHoras: { type: "NUMBER", nullable: true },
    estadoTexto: { type: "STRING", nullable: true, description: "'fuera de servicio' tal cual si la fila está marcada así. null si trabajó normal." },
    operador: { type: "STRING", nullable: true, description: "Columna 'Nombre Op.'. null si la fila dice fuera de servicio." },
    areaTrabajo: { type: "STRING", nullable: true, description: "Columna 'Área de trabajo' (ej. 'B2', 'CIRCUITO PLANTA')." },
    incierto: { type: "BOOLEAN", description: "true si algún valor de esta fila es ambiguo o dudoso de leer." },
  },
  required: ["incierto"],
};

const ESQUEMA_PERDIDA_PETROLEO = {
  type: "OBJECT",
  properties: {
    equipoNombre: { type: "STRING", nullable: true, description: "Columna 'Equipo' de la tabla 'Pérdida estimada asociada a Petróleo' (ej. 'CAEX-86'). Esta tabla no trae sigla." },
    horaInicio: { type: "STRING", nullable: true, description: "Columna 'H. Inicial': es una HORA del reloj (ej. '10:25'), formato HH:MM de 24 horas. null si está en blanco." },
    horaFin: { type: "STRING", nullable: true, description: "Columna 'H. Final': hora del reloj, formato HH:MM de 24 horas. null si está en blanco." },
    totalHoras: { type: "NUMBER", nullable: true, description: "Columna 'Total Horas' (horas perdidas por falta de combustible)." },
    tonAsociado: { type: "NUMBER", nullable: true, description: "Columna 'Tonelaje Asociado'." },
    incierto: { type: "BOOLEAN", description: "true si algún valor de esta fila es ambiguo o dudoso de leer." },
  },
  required: ["incierto"],
};

export const ESQUEMA_RESPUESTA = {
  type: "OBJECT",
  properties: {
    fecha: { type: "STRING", nullable: true, description: "Fecha del turno, formato YYYY-MM-DD. Lee los dígitos tal como están escritos — no asumas un año 'típico' de memoria." },
    turno: { type: "STRING", nullable: true, enum: ["dia", "noche"], description: "'dia' o 'noche' según el encabezado ('PRODUCCIÓN TURNO DÍA' / 'PRODUCCIÓN TURNO NOCHE')." },
    grupoTurno: { type: "STRING", nullable: true, description: "Grupo del turno que aparece junto a 'Turno' (ej. 'G1'). null si no hay." },
    supervisor: { type: "STRING", nullable: true },
    contrato: { type: "STRING", nullable: true, description: "N° de Contrato." },
    franjaDescarga: { type: "STRING", nullable: true, description: "Campo 'Franja en descarga'." },
    moduloDescarga: { type: "STRING", nullable: true, description: "Campo 'Módulo en descarga'." },
    distanciaModulos: { type: "NUMBER", nullable: true, description: "Campo 'Distancia módulos'." },
    observacionesDistancia: { type: "STRING", nullable: true, description: "Observaciones sobre distancia óptima, si las hay." },
    totalToneladas: { type: "NUMBER", nullable: true, description: "Total Toneladas del turno, de la sección de Totales." },
    rendimientoTransporteTonHr: { type: "NUMBER", nullable: true, description: "Rendimiento Transporte [Ton/hr] de la sección de Totales." },
    totalVueltas: { type: "NUMBER", nullable: true, description: "Total Vueltas de la sección de Totales." },
    vueltasAljibe: { type: "NUMBER", nullable: true, description: "'Vueltas aljibe' del cuadro 'Producción Centinela 2026' (a la derecha o al pie de la hoja), si existe." },
    primerCargado: { type: "STRING", nullable: true, description: "'Primer cargado' (hora HH:MM) del cuadro 'Producción Centinela 2026', si existe." },
    ultimoCargado: { type: "STRING", nullable: true, description: "'Último cargado' (hora HH:MM) del cuadro 'Producción Centinela 2026', si existe." },
    tiempoMedioCicloMin: { type: "NUMBER", nullable: true, description: "'Tiempo medio de ciclo' [min/vuelta] de los totales de CAEX." },
    totalHorasCaex: { type: "NUMBER", nullable: true, description: "'Total horas CAEX'." },
    rendimientoCaexVueltasHr: { type: "NUMBER", nullable: true, description: "'Rendimiento equipo CAEX' [vueltas/Hr]." },
    vueltasCF: { type: "NUMBER", nullable: true, description: "'Vueltas C.F.' (CAEX cargados) de los totales de carguío." },
    totalTonCF: { type: "NUMBER", nullable: true, description: "'Total Ton CF'." },
    totalHorasCF: { type: "NUMBER", nullable: true, description: "'Total horas C.F.'." },
    rendimientoCFTonHr: { type: "NUMBER", nullable: true, description: "'Rendimiento efectivo C.F.' en [Ton/Hr]." },
    rendimientoCFCargasHr: { type: "NUMBER", nullable: true, description: "'Rendimiento efectivo C.F.' en [Cargas/Hr]." },
    disponibilidadEquipos: { type: "STRING", nullable: true, description: "La lista bajo 'DISPONIBILIDAD DE EQUIPOS' (ej. '1 CF', '4 CAEX', '1 BULLDOZER EN BOTADERO'…), un elemento por línea, tal cual está escrito." },
    bitacora: { type: "STRING", nullable: true, description: "Las líneas con hora de la sección Observaciones/Comentarios (ej. '08:00 - 08:30 HRS - CHARLA INICIO TURNO', '10:25 - 12:20 CAEX-86 FUERA DE SERVICIO POR FALTA DE COMBUSTIBLE'), una por línea y tal cual, en el orden escrito." },
    observaciones: { type: "STRING", nullable: true, description: "Texto libre de Observaciones/Comentarios que NO es una línea con hora ni parte de la lista de disponibilidad (ej. 'REVISION DE EQUIPOS Y DISPOSITIVOS DE FATIGA Y SOMNOLENCIA'). null si no hay." },
    caex: {
      type: "ARRAY",
      description: "Una entrada por cada fila de la tabla 'Producción Equipos CAEX' que tenga al menos un dato escrito.",
      items: ESQUEMA_EQUIPO_CAEX,
    },
    carguio: {
      type: "ARRAY",
      description: "Una entrada por cada fila de la tabla 'Equipos de Carguío' que tenga al menos un dato escrito.",
      items: ESQUEMA_CARGUIO,
    },
    apoyo: {
      type: "ARRAY",
      description: "Una entrada por cada fila de la tabla 'Equipos de Apoyo' que tenga al menos un dato escrito.",
      items: ESQUEMA_APOYO,
    },
    perdidaPetroleo: {
      type: "ARRAY",
      description: "Una entrada por cada fila de la tabla 'Pérdida estimada asociada a Petróleo' que tenga al menos una hora, horas u tonelaje escrito (distinto de 0). Omite las filas con todo en blanco o en 0,00.",
      items: ESQUEMA_PERDIDA_PETROLEO,
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
  required: ["caex", "carguio", "apoyo", "perdidaPetroleo", "perdidaIndisponibilidad", "camposInciertos"],
};

export const PROMPT = `Esta es una foto de un "Reporte de Producción" por turno (Día o Noche) de una faena minera, formato planilla Excel impresa/exportada. Cada foto es UN reporte completo de UN turno.

Extrae TODO el reporte:
1. El encabezado: N° Contrato, Supervisor, Fecha, Turno (Día/Noche) y el grupo que aparece a su lado (ej. G1), Franja en descarga, Módulo en descarga, Distancia módulos y sus observaciones. La fecha viene escrita día/mes/año (formato chileno, ej. 10/08/2026 = 10 de agosto de 2026): devuélvela como YYYY-MM-DD.
2. "Producción Equipos CAEX" (camiones) — Sigla, Equipo, Horómetro inicial/final, Total Horas, Vueltas, Rendimiento, Tiempo de Ciclo, Nombre Operador, Ton/Vuelta, Total Ton Equipo — y sus totales (Tiempo medio de ciclo, Total horas CAEX, Total vueltas CAEX, Rendimiento equipo CAEX, Total Toneladas, Rendimiento Transporte [Ton/hr]).
3. "Equipos de Carguío" — Sigla, Equipo, Horómetro inicial/final, Total Horas, Tonelaje, Rendimiento [Ton/Hr], Nombre Operador, Postura — y sus totales (Vueltas C.F., Total Ton CF, Total horas C.F., Rendimiento efectivo C.F. en Ton/Hr y en Cargas/Hr).
4. "Equipos de Apoyo" — Sigla, Equipo, Horómetro inicial/final, Total Horas, Nombre Op., Área de trabajo.
5. "Pérdida estimada asociada a Petróleo" — Equipo, H. Inicial y H. Final (horas del reloj, HH:MM de 24 horas), Total Horas, Tonelaje Asociado. Incluye solo las filas que tengan hora, horas o tonelaje distinto de cero.
6. "Pérdida estimada asociada a Indisponibilidad" — Sigla/Equipo, Horómetro inicial/final si los hay, Total Horas, Tonelaje Asociado.
7. La sección Observaciones/Comentarios: la lista "Disponibilidad de equipos" (un elemento por línea), la bitácora (todas las líneas con hora, una por línea y tal cual) y cualquier otro comentario.

Las filas pintadas de rojo o marcadas "FUERA DE SERVICIO" (aunque el texto esté en la columna del operador) son equipos fuera de servicio: devuélvelas con estadoTexto = "fuera de servicio", totalHoras null si no hay un número real, y el operador en null. No saltes esas filas: el dato de que estuvieron paradas es importante.

Formatos que aparecen (todos son el mismo reporte):
- Las tablas pueden traer solo la columna "Equipos"/"Equipo" (ej. CAEX-85, CF-510, BD-533) sin columna Sigla: en ese caso déjalo en equipoNombre y deja sigla en null. Si hay columna Sigla (ej. CN-9503), ponla en sigla.
- Estados por color: rojo = "FUERA DE SERVICIO", verde = "STANDBY", amarillo = "MANTENCIÓN PROGRAMADA": cópialos en estadoTexto tal cual y deja horas y operador en null.
- Varias hojas incluyen a la derecha o al pie un cuadro resumen "PRODUCCIÓN CENTINELA 2026" que repite la tabla CAEX: NO lo cuentes como filas nuevas; de ese cuadro solo toma Vueltas aljibe, Primer cargado y Último cargado.
- La foto puede ser solo una parte de la hoja (por ejemplo, solo las pérdidas y las observaciones): devuelve lo que se ve y deja el resto vacío.
- En Pérdida por Petróleo las horas vienen como h:mm:ss (ej. 18:00:00): devuélvelas como HH:MM. "0:00:00" y "0,00" son relleno, no una pérdida.
- La tabla de Pérdida por Indisponibilidad también lista equipos de apoyo y carguío (BD-533, CN-5133, MN-26, CF-769…): inclúyelos como filas de esa tabla si tienen horas escritas.
- Si una celda muestra un error de Excel (#¡VALOR!, #REF!) o un número negativo de horas, déjala en null y marca la fila con incierto:true.
- Si Tonelaje y Rendimiento [Ton/Hr] de carguío están en blanco o en 0,0, déjalos en null: no se registraron ese turno.
- Algunas fechas vienen con año de 2 dígitos (26-02-26): devuélvelas como 2026-02-26.

Para cada tabla, incluye una fila SOLO si tiene al menos un dato escrito — no incluyas filas completamente en blanco. Si un campo no aparece en la foto, está en blanco, o es ilegible, déjalo en null — nunca inventes un valor ni lo calcules tú: copia lo que está escrito. Si un valor SÍ está escrito pero es ambiguo, da tu mejor intento de todas formas pero marca esa fila con incierto:true, o agrega el campo de cabecera a camposInciertos.`;

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
  if (!esUsuarioAutenticado(req.headers.get("authorization"))) return json({ error: MENSAJE_SIN_SESION }, 401);

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
