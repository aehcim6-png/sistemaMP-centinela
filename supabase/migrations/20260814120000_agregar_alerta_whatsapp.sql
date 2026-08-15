-- Destinatarios de WhatsApp para el resumen diario de alerta-pm (Edge Function),
-- mismo patrón que 'alertaEmails': texto libre con números en formato E.164
-- separados por coma (ej. "+56912345678, +56987654321"), editable por un admin
-- desde Configuración sin necesitar acceso a Supabase. Si queda vacío, alerta-pm
-- usa la env var ALERTA_PM_WHATSAPP_DESTINATARIOS como respaldo, o simplemente
-- no manda WhatsApp si tampoco hay Twilio configurado (best-effort, el correo
-- por Resend sigue siendo el canal obligatorio).
alter table public.configuracion add column "alertaWhatsApp" text;
