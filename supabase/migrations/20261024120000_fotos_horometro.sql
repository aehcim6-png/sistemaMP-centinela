-- Foto del horómetro como evidencia (2026-10-24).
-- La foto con que se leyó un horómetro (pestaña Horómetro → Registrar → Tomar/Subir foto) se guarda para poder revisar después de dónde salió el número.
--
-- Bucket PRIVADO (a diferencia de 'informes-fotos', que es público para lectura): una foto de horómetro no tiene por qué ser accesible con una URL. Subir exige un usuario activo
-- real (privado.es_usuario_activo(), la misma función que protege el resto de las tablas y la subida de 'informes-fotos'); VER la foto exige un administrador activo
-- (privado.es_admin_activo(), que pide además verificación en dos pasos). La app pide un enlace firmado de 5 minutos para mostrarla.
-- Límite de 2 MB por foto y solo JPEG (la app ya la reduce a ~100 KB antes de subirla).
--
-- La fila de historial_horometros guarda la ruta del archivo en la columna nueva 'foto' (texto, vacía si la lectura no vino de una foto). La tabla ya tiene sus permisos y su
-- RLS: agregar una columna no cambia ninguno de los dos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-horometro', 'fotos-horometro', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

create policy "fotos_horometro_insert_usuario_activo"
on storage.objects for insert
to authenticated
with check (bucket_id = 'fotos-horometro' and privado.es_usuario_activo());

create policy "fotos_horometro_select_admin"
on storage.objects for select
to authenticated
using (bucket_id = 'fotos-horometro' and privado.es_admin_activo());

alter table public.historial_horometros add column if not exists foto text;
