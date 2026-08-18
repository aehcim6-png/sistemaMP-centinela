-- Ingesta automática de correctivos por WhatsApp (Twilio) y correo (Resend
-- inbound), a pedido del usuario (2026-08-18): un técnico reporta una falla
-- por WhatsApp o correo y el mensaje se parsea e inserta solo en
-- correctivos_historico, sin que un jefe de taller tenga que copiar el chat
-- a mano cada cierto tiempo (como se hizo para cargar el histórico inicial).
--
-- Igual que 'alertaEmails'/'alertaWhatsApp' (que dicen a QUIÉN mandarle la
-- alerta diaria), estas 2 columnas dicen DE QUIÉN aceptar un reporte
-- entrante — sin esto, cualquiera que le escriba al número/correo de
-- Twilio/Resend podría insertar datos falsos en la flota. Mismo patrón:
-- texto libre separado por coma, editable desde Configuración sin tocar
-- Supabase directamente. Vacío = no se acepta ningún reporte automático
-- todavía (hay que cargar al menos un remitente para activar el canal).
alter table public.configuracion add column "whatsappRemitentesPermitidos" text;
alter table public.configuracion add column "correoRemitentesPermitidos" text;
