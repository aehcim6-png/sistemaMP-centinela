// ============================================================
// whatsapp-webhook — SistemaMP Centinela (autocontenida, sin imports
// cruzados — mismo criterio que el resto de las Edge Functions de este
// proyecto, ver alerta-pm/resumen-semanal/avisar-dispositivo-nuevo/etc.)
//
// Canal de ENTRADA (a diferencia de alerta-pm, que es de salida): un técnico
// le escribe al número de WhatsApp Business de Twilio ("CN-9500 fuera de
// servicio, falla de turbo") y este webhook lo parsea e inserta directo en
// correctivos_historico — automatiza lo que hasta ahora se hacía a mano
// (exportar el chat completo y pegarlo para que se procese por lotes, ver
// conversación 2026-08-17/18).
//
// Requiere en Twilio Console (paso manual, fuera de este código): configurar
// la URL de este endpoint como el webhook "When a message comes in" del
// número de WhatsApp Business ya usado para las alertas salientes de
// alerta-pm — mismos secrets (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN), no hace
// falta ninguno nuevo. La segunda pasada con IA (ver más abajo) sí necesita
// un secret nuevo: ANTHROPIC_API_KEY.
//
// Seguridad en 2 capas:
//  1. Firma de Twilio (X-Twilio-Signature, HMAC-SHA1 con el Auth Token) —
//     confirma que la petición vino realmente de Twilio, no de un tercero
//     que adivinó la URL.
//  2. Lista de remitentes autorizados (configuracion.whatsappRemitentesPermitidos,
//     editable desde Configuración → Reporte de Fallas) — confirma que quien
//     escribió es alguien del equipo, no cualquiera que le escriba al número
//     público de Twilio. Sin remitentes cargados, el canal no acepta nada.
//
// Nunca inventa un dato: si no reconoce el equipo o el mensaje es ambiguo
// (pregunta, posible PM programado), igual lo inserta pero con
// fuente='WhatsApp Twilio (auto) — revisar' para que quede visible en
// Auditoría de Datos en vez de perderse o insertarse como si fuera certero.
//
// Bug real (2026-08-21): la verificación de firma usaba req.url tal cual lo
// entrega el runtime de Supabase, pero ese valor es una URL INTERNA
// ("http://…/whatsapp-webhook", sin "/functions/v1") distinta de la URL
// PÚBLICA que Twilio realmente usó para firmar ("https://…/functions/v1/
// whatsapp-webhook", la configurada en el Sandbox de Twilio) — la firma
// nunca podía coincidir, sin importar qué tan correcto fuera el Auth Token.
// Se fija la URL pública real como constante en vez de confiar en req.url.
//
// Bug real #2 (encontrado 2026-09-02, al agregar la segunda pasada con IA
// de más abajo): la versión previamente desplegada de esta función traía el
// parser de reglas COPIADO A MANO y desactualizado — 19 categorías de
// componente en vez de las 46 que ya tiene _shared/parseCorrectivo.ts
// (usado por email-webhook, que sí estaba al día). Cualquier reporte de
// WhatsApp que mencionara una de esas 27 categorías faltantes (Inyectores,
// Correas, GET/Cuchillas, etc.) caía siempre en "componente no identificado"
// aunque el texto fuera perfectamente claro. Esta versión trae el parser
// completo y al día, inlineado a mano — Deno Deploy no resuelve imports
// relativos fuera de la carpeta de la función de forma confiable, así que
// (siguiendo el mismo criterio que ya usan alerta-pm/resumen-semanal/etc.)
// se mantiene todo en un solo archivo en vez de depender de '../_shared/'.
// Si se agrega una categoría nueva en logic.js o en _shared/parseCorrectivo.ts,
// hay que copiarla también acá a mano.
//
// Segunda pasada con IA (2026-09-02): cuando el parser por reglas no
// reconoce el mensaje o queda con confianza "baja" (lenguaje informal que no
// matchea ninguna palabra clave ni sigla), se le pasa el texto a Claude
// (Haiku, por costo) como último intento antes de marcarlo "revisar" o
// descartarlo del todo. La IA NUNCA inventa una sigla o categoría: solo
// puede elegir una de las listas reales que se le entregan como contexto
// (equipos existentes, categorías de componente válidas) — si el modelo
// devuelve algo que no está en esas listas, se descarta igual que si no
// hubiera reconocido nada. Requiere el secret ANTHROPIC_API_KEY — si no
// está configurado, la IA no se llama y el comportamiento queda idéntico
// al de solo-reglas (nunca hace peor lo que el parser por reglas ya
// resolvió bien).
// ============================================================

const URL_PUBLICA_WEBHOOK = 'https://jyhpfwivhwzylkzxrsbt.supabase.co/functions/v1/whatsapp-webhook';

interface ReporteFalla {
  sigla: string;
  siglaOriginal: string;
  componente: string;
  descripcion: string;
  horometro: number | null;
  confianza: 'alta' | 'baja';
  motivoBaja?: string;
}

// ============ PARSER POR REGLAS (copia sincronizada de _shared/parseCorrectivo.ts, ver comentario arriba) ============

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

type Keyword = string | RegExp;
const CATEGORIAS_COMPONENTE: [string, Keyword[]][] = [
  ['Asiento', ['asiento']],
  ['Batería', ['bateria', 'batería', 'baterias', 'baterías']],
  ['Motor de Partida', ['motor de partida', 'motor partida', 'arranque']],
  ['Cilindro de Dirección', ['cilindro direccion', 'cilindro de direccion', 'cilindro dirección', 'cilindro de dirección', 'cilindro volante', 'orbitrol']],
  ['Neumáticos', ['neumatico', 'neumático', 'neumaticos', 'neumáticos', 'despresuriz', 'desprezuriz', 'presuriz', 'posicion 1 baja presion', 'posicion 3 baja presion', 'check  point', 'check point']],
  ['Frenos', ['freno']],
  ['Transmisión', ['transmision', 'transmisión', 'kick dawn', 'pick dawn']],
  ['Diferencial', ['diferencial', 'diferecial']],
  ['Mandos Finales', ['mandos finales', 'mando final']],
  ['Turbo', ['turbo']],
  ['Alternador', ['alternador']],
  ['Correas', ['correa']],
  ['Bomba de Agua', ['bomba de agua', 'bomba agua']],
  ['Radiador/Enfriamiento', ['radiador', 'refrigerante', 'enfriador', 'enfriadores', 'refrigeracion', 'viscoso']],
  ['Suspensión', ['suspension', 'suspensión', 'suspencion']],
  ['Inyectores', ['inyector', 'inyectores']],
  ['Filtro de Combustible', ['filtro de combustible', 'filtro combustible', 'filtro decombustible', 'filtros de combustible', 'filtros combustible']],
  ['Filtro de Aire', ['filtro de aire', 'filtro aire', 'filtro de cabina', 'filtro cabina']],
  ['Bomba de Combustible', ['bomba de combustible', 'bomba combustible', 'bomba inyectora', 'bomba de inyeccion', 'bomba inyeccion']],
  ['Crucetas/Cardán', ['cruceta', 'crucetas', 'cardan', 'cardán']],
  ['Soporte de Cabina', ['soporte de cabina', 'soporte cabina', 'soportes de cabina']],
  ['Conectores/Cableado', ['conector', 'conectores', 'arnes', 'arnés']],
  ['Mangueras/Fugas', ['manguera', 'mangueras', 'flexible', 'cañeria', 'cañería', 'caneria']],
  ['Elemento de Desgaste', ['elemento de desgaste', 'elementos de desgaste', 'elementos desgaste']],
  ['Foco/Ampolleta', ['ampolleta', 'ampoleta', 'alpolleta', 'amplolleta', 'foco delantero', 'foco trasero', 'foco frontal', 'foco faenero', 'focos faeneros', 'faenero', 'luz baja', 'luz alta', 'foco', 'focos', 'luces']],
  ['Sistema Hidráulico', ['hidraulico', 'hidráulico']],
  ['Sistema Eléctrico', ['electrico', 'eléctrico', 'elÃ©ctrico', 'eléctrica', 'electrica', 'bocina', 'conversor']],
  ['Aire Acondicionado', ['aire acondicionado', ' a/c ', 'a/c.', 'condensador', 'se carga ac', 'chequeo a/c', 'bajo flujo de a/c', 'sistema de ac', 'calefaccion']],
  ['GET / Cuchillas', ['cuchilla', 'entrediente', 'gets', 'entrecalza', 'entrecalzas', 'ripper', 'riper', 'canillera', 'canilleras']],
  ['Balde/Implemento', ['pasador del balde', 'pasador de balde', 'pasador balde', 'cambio de balde', 'desgaste del balde', 'balde nuevo', 'balde por rotura']],
  ['Biela/Pantógrafo', ['biela', 'pantografo', 'pantógrafo']],
  ['Tren de Rodaje', ['oruga', 'cadena', 'sprocket', 'sproket', 'zapata', 'rodillo', 'rueda tensora', 'rueda motriz', 'garra maestar', 'garra maestra']],
  ['Engrase/Lubricación', ['engrase', 'relleno de grasa', 'carga de grasa', 'tk de grasa', 'tk grasa', 'nivel de grasa', 'nivel grasa']],
  ['Fuga de Aceite', ['fuga de aceite', 'fuga aceite']],
  ['Radio/Comunicaciones', ['radio base', 'falla ptt', 'antena', 'ptt']],
  ['Sistema Anticolisión/Fatiga (ADAS)', ['somnolencia', 'anticolision', 'anticolisión', 'anticolicion', 'f&s']],
  ['Tornamesa/Giro', ['tornamesa', 'torna mesa']],
  ['Joystick/Palanca de Mando', ['joystick', 'joytick', 'joitick']],
  ['Parabrisas/Vidrios', ['parabrisas']],
  ['Tolva/Dumper', ['tolva']],
  ['Puertas', ['puerta']],
  ['Espejos', ['espejo']],
  ['Baliza/Pértiga (Señalización)', ['baliza', 'pertiga', 'pertica']],
  ['Cámara de Retroceso', ['camara de retroceso', 'camara retroceso']],
  ['Sistema AFEX (Extinción de Incendios)', ['afex']],
  ['Estanque/Tapa de Combustible', ['estanque combustible', 'estanque de combustible', 'tapa combustible', 'tapa de combustible', 'tapa de llenado de combustible']],
  ['Pala (Motoniveladora)', [/\bpala\b/]],
  ['Motor', ['motor', 'reel']],
];
const CATEGORIAS_VALIDAS: string[] = CATEGORIAS_COMPONENTE.map(([nombre]) => nombre);

function clasificarComponente(texto: string): string {
  const t = texto.toLowerCase();
  for (const [cat, keys] of CATEGORIAS_COMPONENTE) {
    if (keys.some((k) => (k instanceof RegExp ? k.test(t) : t.indexOf(k) >= 0))) return cat;
  }
  return '';
}

const KEYWORDS_PM = ['mantencion programada', 'mantención programada', 'lavado para pm', /\bpm[1-4]\b/i];
function pareceMantencionProgramada(texto: string): boolean {
  const t = texto.toLowerCase();
  return KEYWORDS_PM.some((k) => (typeof k === 'string' ? t.indexOf(k) >= 0 : (k as RegExp).test(texto)));
}
function pareceExactaPregunta(texto: string): boolean {
  return texto.indexOf('¿') >= 0 || /\?\s*$/.test(texto.trim());
}
const KEYWORDS_FALLA = ['fuera de servicio', 'se rompio', 'se rompió', 'no funciona', 'no enciende', 'no parte', 'falla de', 'con falla'];
function pareceReporteFalla(texto: string): boolean {
  const t = texto.toLowerCase();
  return KEYWORDS_FALLA.some((k) => t.indexOf(k) >= 0);
}

function extraerHorometro(texto: string): number | null {
  const m = texto.match(/(\d{3,6})\s*(?:hrs?|horas?)\b/i);
  return m ? parseInt(m[1], 10) : null;
}

function parsearReporteFalla(textoOriginal: string): ReporteFalla | null {
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

// ============ SEGUNDA PASADA CON IA (copia sincronizada de _shared/interpretarConIA.ts) ============

interface InterpretacionIA {
  esFalla: boolean;
  sigla: string | null;
  componente: string | null;
  horometro: number | null;
  resumen: string;
}

const MODELO_IA = 'claude-haiku-4-5-20251001';

async function interpretarConIA(texto: string, siglasValidas: string[], categoriasValidas: string[]): Promise<InterpretacionIA | null> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey || !texto.trim() || siglasValidas.length === 0) return null;

  const herramienta = {
    name: 'clasificar_reporte',
    description: 'Clasifica un mensaje de WhatsApp como reporte de falla de un equipo minero, o no.',
    input_schema: {
      type: 'object',
      properties: {
        es_reporte_falla: {
          type: 'boolean',
          description:
            'true SOLO si el mensaje reporta claramente una falla/problema real de un equipo. false si es una pregunta, un aviso de mantención programada, un saludo, una confirmación, o cualquier otra cosa que no sea reportar una falla nueva.',
        },
        sigla: {
          type: 'string',
          description: 'La sigla EXACTA del equipo, tal como aparece en la lista de siglas válidas entregada. Omite este campo por completo si no puedes determinarla con confianza — nunca inventes una.',
        },
        componente: {
          type: 'string',
          description: 'La categoría EXACTA del componente/sistema afectado, tal como aparece en la lista de categorías válidas entregada. Omite este campo si no está claro — nunca inventes una.',
        },
        horometro: {
          type: 'number',
          description: 'Horómetro en horas, SOLO si el mensaje lo menciona explícitamente. Omite este campo si no aparece.',
        },
        resumen: {
          type: 'string',
          description: 'Resumen breve (máximo 25 palabras) de la falla, en español, listo para guardar como descripción.',
        },
      },
      required: ['es_reporte_falla', 'resumen'],
    },
  };

  const sistema =
    `Eres un asistente que clasifica reportes de falla de equipos mineros escritos por técnicos por WhatsApp, ` +
    `a veces con errores de tipeo, jerga local o lenguaje indirecto.\n\n` +
    `Siglas de equipo VÁLIDAS (usa exactamente una de esta lista si identificas de cuál equipo se trata; si no estás razonablemente seguro, omite el campo):\n${siglasValidas.join(', ')}\n\n` +
    `Categorías de componente VÁLIDAS (usa exactamente una de esta lista; si no está claro, omite el campo):\n${categoriasValidas.join(', ')}\n\n` +
    `Nunca inventes una sigla ni una categoría que no esté en estas listas exactas.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODELO_IA,
        max_tokens: 300,
        system: sistema,
        messages: [{ role: 'user', content: texto.slice(0, 1000) }],
        tools: [herramienta],
        tool_choice: { type: 'tool', name: 'clasificar_reporte' },
      }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const bloque = (data.content || []).find((b: { type: string }) => b.type === 'tool_use');
    if (!bloque || !bloque.input) return null;
    const input = bloque.input as Record<string, unknown>;

    const sigla = typeof input.sigla === 'string' && siglasValidas.includes(input.sigla) ? input.sigla : null;
    const componente = typeof input.componente === 'string' && categoriasValidas.includes(input.componente) ? input.componente : null;
    const horometro = typeof input.horometro === 'number' && Number.isFinite(input.horometro) ? input.horometro : null;

    return {
      esFalla: input.es_reporte_falla === true,
      sigla,
      componente,
      horometro,
      resumen: typeof input.resumen === 'string' ? input.resumen.slice(0, 500) : texto.slice(0, 500),
    };
  } catch {
    return null;
  }
}

// ============ WEBHOOK ============

async function verificarFirmaTwilio(authToken: string, url: string, params: URLSearchParams): Promise<string> {
  const claves = [...params.keys()].sort();
  let base = url;
  for (const k of claves) base += k + params.get(k);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(authToken), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const firma = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(base));
  return btoa(String.fromCharCode(...new Uint8Array(firma)));
}

function twiml(mensaje: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response>${mensaje ? `<Message>${mensaje.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</Message>` : ''}</Response>`;
  return new Response(xml, { status: 200, headers: { 'Content-Type': 'text/xml' } });
}

Deno.serve(async (req: Request) => {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    if (!TWILIO_AUTH_TOKEN) return new Response('Falta configurar TWILIO_AUTH_TOKEN', { status: 500 });

    const bodyTexto = await req.text();
    const params = new URLSearchParams(bodyTexto);

    // 1. Verificar que la petición vino de verdad de Twilio. Se usa la URL
    // PÚBLICA fija (ver comentario arriba), no req.url — Supabase entrega ahí
    // una URL interna distinta de la que Twilio realmente firmó.
    const firmaEsperada = req.headers.get('X-Twilio-Signature') || '';
    const firmaCalculada = await verificarFirmaTwilio(TWILIO_AUTH_TOKEN, URL_PUBLICA_WEBHOOK, params);
    if (firmaCalculada !== firmaEsperada) {
      return new Response(JSON.stringify({ error: 'Firma de Twilio inválida' }), { status: 401 });
    }

    const desde = (params.get('From') || '').replace(/^whatsapp:/, '').trim();
    const texto = params.get('Body') || '';

    const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

    // 2. Verificar que quien escribió está en la lista de remitentes
    // autorizados (Configuración → Reporte de Fallas por WhatsApp/Correo).
    const cfgR = await fetch(`${SUPABASE_URL}/rest/v1/configuracion?select=whatsappRemitentesPermitidos&limit=1`, { headers });
    const cfgRows = cfgR.ok ? await cfgR.json() : [];
    const permitidos = String(cfgRows[0]?.whatsappRemitentesPermitidos || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    if (permitidos.length === 0 || !permitidos.includes(desde)) {
      // Silencioso a propósito: no confirma ni niega nada por WhatsApp a un
      // número no autorizado (no dar pistas de qué números SÍ funcionan).
      return twiml('');
    }

    let reporte: ReporteFalla | null = parsearReporteFalla(texto);
    let viaIA = false;

    // Segunda pasada con IA — solo cuando el parser por reglas no logró
    // resolverlo solo (no reconoció nada, o quedó "baja"). Si la IA no está
    // configurada (sin ANTHROPIC_API_KEY) o tampoco logra resolver sigla Y
    // componente con confianza, 'reporte' queda exactamente como lo dejó el
    // parser por reglas — la IA solo puede MEJORAR el resultado, nunca
    // empeorarlo.
    if (!reporte || reporte.confianza === 'baja') {
      try {
        const eqR = await fetch(`${SUPABASE_URL}/rest/v1/equipos?select=sigla`, { headers });
        const equiposRows = eqR.ok ? await eqR.json() : [];
        const siglasValidas = (equiposRows as { sigla: string }[]).map((e) => e.sigla).filter(Boolean);
        const ia = await interpretarConIA(texto, siglasValidas, CATEGORIAS_VALIDAS);
        if (ia && ia.esFalla && ia.sigla && ia.componente) {
          reporte = {
            sigla: ia.sigla,
            siglaOriginal: ia.sigla,
            componente: ia.componente,
            descripcion: ia.resumen || texto.slice(0, 500),
            horometro: ia.horometro,
            confianza: 'alta',
          };
          viaIA = true;
        }
      } catch {
        // best-effort: si la IA falla por cualquier motivo, se sigue con lo
        // que ya haya resuelto el parser por reglas (o nada).
      }
    }

    if (!reporte) {
      // No parece un reporte de falla en absoluto (sin sigla ni palabra
      // clave, y la IA tampoco lo resolvió) — no se inserta nada, pero sí se
      // avisa para que la persona sepa que no se registró (evita el
      // silencio que hace pensar "ya quedó guardado" cuando en realidad no
      // pasó nada).
      return twiml('No reconocí esto como un reporte de falla (falta el código de equipo o una palabra como "fuera de servicio"). Si es una falla real, intenta de nuevo indicando el equipo, ej: "CN-9500 fuera de servicio, falla de turbo".');
    }

    // 3. Dedup: mismo equipo + mismo componente + mismo día ya reportado hoy
    // — evita duplicar si alguien reenvía o corrige el mismo mensaje.
    const hoy = new Date().toISOString().slice(0, 10);
    const dupR = await fetch(
      `${SUPABASE_URL}/rest/v1/correctivos_historico?select=id&sigla=eq.${encodeURIComponent(reporte.sigla)}&fecha=eq.${hoy}&sistema=eq.${encodeURIComponent(reporte.componente)}&limit=1`,
      { headers }
    );
    const dupRows = dupR.ok ? await dupR.json() : [];
    if (Array.isArray(dupRows) && dupRows.length > 0) {
      return twiml(`Ya hay un reporte de ${reporte.sigla} — ${reporte.componente} registrado hoy, no se duplicó.`);
    }

    // 'fuente' queda distinto cuando la clasificación vino de la IA — así
    // Auditoría de Datos puede distinguir "regla determinística" de "IA
    // validada contra las listas reales" sin tener que adivinar.
    const fuente = viaIA
      ? 'WhatsApp Twilio (auto, IA)'
      : reporte.confianza === 'alta'
      ? 'WhatsApp Twilio (auto)'
      : 'WhatsApp Twilio (auto) — revisar';
    const insR = await fetch(`${SUPABASE_URL}/rest/v1/correctivos_historico`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({
        sigla: reporte.sigla,
        siglaOriginal: reporte.siglaOriginal || null,
        fecha: hoy,
        horometro: reporte.horometro,
        sistema: reporte.componente,
        descripcion: `${desde}: ${reporte.descripcion}`,
        tipoInt: 'Correctivo',
        fuente,
      }),
    });
    if (!insR.ok) {
      console.error('whatsapp-webhook: insert falló', await insR.text());
      return twiml('Hubo un error guardando el reporte, avisa al administrador del sistema.');
    }

    if (reporte.confianza === 'alta') {
      return twiml(`✅ Registrado: ${reporte.sigla} — ${reporte.componente}`);
    }
    return twiml(`⚠️ Registrado con dudas (${reporte.motivoBaja}) — un admin lo revisará en Auditoría de Datos: ${reporte.sigla} — ${reporte.componente}`);
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
