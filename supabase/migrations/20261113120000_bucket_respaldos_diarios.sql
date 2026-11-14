-- Segunda copia del respaldo diario (backup-diario guarda aquí el .json.gz además de mandarlo por correo).
-- Bucket PRIVADO: no se crea ninguna política en storage.objects, así que solo el service_role (la propia función) puede leer
-- y escribir; ni la clave anon ni un usuario logueado ven estos archivos. Tope de 100 MB por archivo y solo gzip.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('respaldos-diarios', 'respaldos-diarios', false, 104857600, array['application/gzip'])
on conflict (id) do nothing;
