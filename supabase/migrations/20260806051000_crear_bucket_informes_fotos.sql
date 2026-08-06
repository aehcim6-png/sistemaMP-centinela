-- Corrige dos hallazgos reales de la auditoría propia (2026-08-06):
--
-- 1. FUNCIONAL: el bucket 'informes-fotos' (fotos de Informes de Falla, OT y
--    documentos de Vencimientos) nunca existió en este proyecto — cada intento
--    de subir una foto fallaba silenciosamente (404 de Supabase Storage,
--    capturado como "⚠️ Guardadas con N error(es)" sin explicar por qué). La
--    función de subida (_subirArchivoBucket en index.html) nunca tuvo dónde
--    escribir.
-- 2. SEGURIDAD: esa misma función autenticaba la subida con la clave anon
--    pública (mismo Authorization que apikey), es decir subía como el rol
--    anónimo, no como el usuario real logueado — ya corregido en el código
--    (index.html) para mandar el token real del usuario. Esta migración cierra
--    el otro lado: la política de INSERT en storage.objects exige un usuario
--    activo real (privado.es_usuario_activo(), la misma función que protege
--    el resto de las tablas), así que aunque alguien tuviera la clave anon
--    (pública, viene en el HTML servido) no podría subir nada sin loguearse.
--
-- Bucket público SOLO para lectura (public=true): las fotos se muestran con
-- <img src=".../object/public/..."> sin adjuntar ningún token — necesario
-- para que carguen en pantalla. La escritura queda protegida por la política
-- de abajo, independiente de si el bucket es público para lectura.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('informes-fotos', 'informes-fotos', true, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

create policy "informes_fotos_insert_usuario_activo"
on storage.objects for insert
to authenticated
with check (bucket_id = 'informes-fotos' and privado.es_usuario_activo());
