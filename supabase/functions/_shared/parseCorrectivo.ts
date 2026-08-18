// Parser compartido para reportes de falla entrantes (WhatsApp vía Twilio,
// correo vía Resend) — usado por whatsapp-webhook y email-webhook. Reglas
// portadas del trabajo manual de carga del histórico de WhatsApp
// (conversación 2026-08-17/18: chat "BSM_CEN - EQUIPOS", 451→425 eventos
// tras limpieza) para que un mensaje en vivo se clasifique con el MISMO
// criterio que ya se validó a mano sobre 8 meses de datos reales.
//
// A propósito NO intenta ser perfecto: cuando hay ambigüedad real
// (sigla no reconocida, mensaje parece pregunta, mensaje parece PM
// programado en vez de falla) devuelve confianza:'baja' en vez de
// adivinar — el llamador lo inserta igual pero marcado "— revisar" para
// que un humano lo confirme, nunca lo descarta en silencio ni inventa
// un dato que no tiene.

export interface ReporteFalla {
  sigla: string;
  siglaOriginal: string;
  componente: string;
  descripcion: string;
  horometro: number | null;
  confianza: 'alta' | 'baja';
  motivoBaja?: string;
}

// Mapeo de códigos viejos de equipo (como se escriben en el chat/correo real)
// al 'sigla' actual de la tabla 'equipos' — misma tabla verificada con
// evidencia real (Supabase + reportes de producción Besalco) usada para
// cargar el histórico. Se prueba en orden: la primera coincidencia gana, así
// que los patrones más específicos van primero (ej. 'CE-155' antes que
// terminaciones genéricas).
// '' como destino = ya usa la sigla actual, se acepta tal cual (sin traducir).
const MAPEO_SIGLA: [RegExp, string][] = [
  [/\bCA?EX-?85\b/i, 'CN-9503'],
  [/\bCA?EX-?86\b/i, 'CN-9501'],
  [/\bCA?EX-?87\b/i, 'CN-9500'],
  [/\bCA?EX-?88\b/i, 'CN-9502'],
  [/\bCA?EX-?89\b/i, 'CN-9507'],
  [/\bCA?EX-?155\b/i, 'CN-10155'],
  [/\bCA?EX-?159\b/i, 'CN-10159'],
  [/\bCA?EX-?160\b/i, 'CN-10160'],
  [/\bCA?EX-?56\b/i, 'CN-4656'],
  [/\bCA?EX-?113\b/i, 'CN-6113'],
  [/\b(?:CF|CE|BD)-?510\b/i, 'CF-9510'],
  [/\b(?:CF|CE)-?511\b/i, 'CF-9511'],
  [/\bCF-?769\b/i, 'CF-8769'],
  [/\bBD-?509\b/i, 'BD-9509'],
  [/\bBD-?533\b/i, 'BD-9533'],
  [/\bBD-?139\b/i, 'BD-10139'],
  [/\bMN-?12\b/i, 'MN-6112'],
  [/\bMN-?26\b/i, 'MN-5926'],
  [/\bC[AN]-?5131\b/i, 'CN-5131'],
  [/\bC[AN]-?5133\b/i, 'CN-5133'],
  // Ya usan la sigla actual tal cual (CN/CF/BD/MN-XXXX, TI-514X, GE-10019) —
  // se aceptan directo sin traducir; el patrón genérico va al final para que
  // los mapeos específicos de arriba (que también matchean CN-/CF-/BD-/MN-)
  // ganen primero.
  [/\bGE-?10019\b/i, ''],
  [/\bTI-?514[1-6]\b/i, ''],
  [/\b(CN|CF|BD|MN)-?\d{4,5}\b/i, ''],
];

function resolverSigla(texto: string): { sigla: string | null; siglaOriginal: string | null } {
  for (const [regex, destino] of MAPEO_SIGLA) {
    const m = texto.match(regex);
    if (m) {
      const original = m[0].toUpperCase().replace(/\s+/g, '');
      return { sigla: destino || original, siglaOriginal: original };
    }
  }
  return { sigla: null, siglaOriginal: null };
}

// Mismas categorías que _componenteDeSintoma (pred.js) — subconjunto de las
// más frecuentes en los reportes reales de terreno. Primera que matchea gana.
const CATEGORIAS_COMPONENTE: [string, string[]][] = [
  ['Neumáticos', ['neumatico', 'neumático']],
  ['Turbo', ['turbo']],
  ['Frenos', ['freno']],
  ['Motor de Partida', ['motor de partida', 'motor partida']],
  ['Batería', ['bateria', 'batería']],
  ['Alternador', ['alternador']],
  ['Sistema Hidráulico', ['hidraulico', 'hidráulico']],
  ['Sistema Eléctrico', ['electrico', 'eléctrico']],
  ['Mangueras/Fugas', ['manguera', 'flexible hidraulico', 'flexible hidráulico', 'fuga']],
  ['Radiador/Enfriamiento', ['radiador', 'refrigerante', 'sobrecalent']],
  ['Transmisión', ['transmision', 'transmisión']],
  ['Diferencial', ['diferencial']],
  ['Suspensión', ['suspension', 'suspensión']],
  ['Cilindro de Dirección', ['cilindro direccion', 'cilindro de dirección', 'cilindro dirección']],
  ['Foco/Ampolleta', ['ampolleta', 'ampoleta', 'foco delantero', 'foco trasero', 'foco faenero', 'faenero']],
  ['Balde/Implemento', ['balde']],
  ['Biela/Pantógrafo', ['biela', 'pantografo', 'pantógrafo']],
  ['Elemento de Desgaste', ['elemento de desgaste']],
  ['Motor', ['motor']],
];

function clasificarComponente(texto: string): string {
  const t = texto.toLowerCase();
  for (const [cat, keys] of CATEGORIAS_COMPONENTE) {
    if (keys.some((k) => t.indexOf(k) >= 0)) return cat;
  }
  return '';
}

// Excluye lo que el barrido manual del histórico (2026-08-17) encontró que
// NO son fallas nuevas: mantención programada, y mensajes que son pregunta
// ("¿sigue fuera de servicio?") en vez de reporte.
const KEYWORDS_PM = ['mantencion programada', 'mantención programada', 'lavado para pm', /\bpm[1-4]\b/i];
function pareceMantencionProgramada(texto: string): boolean {
  const t = texto.toLowerCase();
  return KEYWORDS_PM.some((k) => (typeof k === 'string' ? t.indexOf(k) >= 0 : k.test(texto)));
}
function pareceExactaPregunta(texto: string): boolean {
  return texto.indexOf('¿') >= 0 || /\?\s*$/.test(texto.trim());
}
const KEYWORDS_FALLA = ['fuera de servicio', 'se rompio', 'se rompió', 'no funciona', 'no enciende', 'no parte', 'falla de', 'con falla'];
function pareceReporteFalla(texto: string): boolean {
  const t = texto.toLowerCase();
  return KEYWORDS_FALLA.some((k) => t.indexOf(k) >= 0);
}

// Best-effort: primer número seguido de "hrs"/"horas"/"hr" cerca del texto.
// null si no aparece — nunca se inventa un horómetro.
function extraerHorometro(texto: string): number | null {
  const m = texto.match(/(\d{3,6})\s*(?:hrs?|horas?)\b/i);
  return m ? parseInt(m[1], 10) : null;
}

// Punto de entrada. Devuelve null si el mensaje claramente no es un reporte
// de falla (sin sigla reconocible Y sin ninguna palabra clave de falla) —
// eso se descarta sin insertar nada, para no llenar la tabla con ruido de
// conversación normal ("gracias", "ok", fotos sin texto, etc.).
export function parsearReporteFalla(textoOriginal: string): ReporteFalla | null {
  const texto = (textoOriginal || '').trim();
  if (!texto) return null;

  const { sigla, siglaOriginal } = resolverSigla(texto);
  const esFalla = pareceReporteFalla(texto);
  if (!sigla && !esFalla) return null; // ruido: ni equipo ni palabra de falla

  const motivos: string[] = [];
  if (!sigla) motivos.push('no se reconoció el código de equipo');
  if (!esFalla) motivos.push('no contiene palabra clave de falla reconocida');
  if (pareceMantencionProgramada(texto)) motivos.push('menciona mantención programada/PM — podría no ser correctivo');
  if (pareceExactaPregunta(texto)) motivos.push('parece una pregunta, no un reporte');

  const componente = clasificarComponente(texto);
  if (!componente) motivos.push('no se identificó el componente/sistema');

  return {
    sigla: sigla || (siglaOriginal || 'DESCONOCIDO'),
    siglaOriginal: siglaOriginal || '',
    componente: componente || texto.slice(0, 40),
    descripcion: texto.slice(0, 500),
    horometro: extraerHorometro(texto),
    confianza: motivos.length ? 'baja' : 'alta',
    motivoBaja: motivos.length ? motivos.join('; ') : undefined,
  };
}
