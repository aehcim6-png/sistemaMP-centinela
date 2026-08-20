// CLI de una sola línea para el canal de correo por Gmail (2026-08-18): la
// Rutina programada que revisa aehcim6+correctivos@gmail.com no corre en
// Deno (no es una Edge Function), así que no puede importar
// supabase/functions/_shared/parseCorrectivo.ts directo — este wrapper lo
// hace desde Node (--experimental-strip-types, mismo mecanismo usado para
// probar ese archivo esta sesión) para que el correo use EXACTAMENTE el
// mismo criterio que whatsapp-webhook/email-webhook, en vez de que la
// Rutina reimplemente las reglas "a ojo" cada vez que corre (eso sí
// arriesgaría que el correo clasifique distinto que WhatsApp con el
// tiempo). Uso: node --experimental-strip-types parsear-correctivo-cli.mjs "texto del mensaje"
// Salida: el objeto ReporteFalla en JSON por stdout, o "null".
import { parsearReporteFalla } from '../supabase/functions/_shared/parseCorrectivo.ts';

const texto = process.argv.slice(2).join(' ');
console.log(JSON.stringify(parsearReporteFalla(texto)));
