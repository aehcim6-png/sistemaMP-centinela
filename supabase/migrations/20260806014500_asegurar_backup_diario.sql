-- Corrige un hallazgo real de seguridad (auditoría 2026-08-06): la Edge
-- Function backup-diario solo exigía que el header X-Resend-Key viniera NO
-- VACÍO — no comparaba su valor contra nada. Como verify_jwt=true acepta
-- cualquier JWT válido de Supabase, y el anon key (público, visible en el
-- HTML servido) ES un JWT válido, cualquiera con conexión a internet podía
-- invocar la función directamente con SU PROPIA clave de Resend y un
-- X-Backup-To de su elección, y recibir por email un volcado completo de
-- las 41 tablas (incluida user_roles) usando el SERVICE_ROLE_KEY de la
-- función para saltarse RLS. Grave: exfiltración total de datos, sin dejar
-- rastro en el Resend del proyecto (el atacante usa el suyo propio).
--
-- Arreglo: la función ya NO confía en nada que mande quien la invoca (ni la
-- clave de Resend, ni el destinatario). Verifica un secreto propio contra
-- Vault vía una función restringida (solo service_role puede ejecutarla —
-- ni siquiera un usuario autenticado normal), y si es válido, busca ELLA
-- MISMA la clave real de Resend en Vault — nunca la que vino en el header.
-- El destinatario queda fijo en el código, ya no se puede sobreescribir
-- desde afuera.
create or replace function public.verificar_secreto_cron(nombre_secreto text, valor_recibido text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from vault.decrypted_secrets
    where name = nombre_secreto and decrypted_secret = valor_recibido
  );
$$;
revoke execute on function public.verificar_secreto_cron(text,text) from public, anon, authenticated;
grant execute on function public.verificar_secreto_cron(text,text) to service_role;

create or replace function public.obtener_secreto_para_cron(nombre_secreto text)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select decrypted_secret from vault.decrypted_secrets where name = nombre_secreto;
$$;
revoke execute on function public.obtener_secreto_para_cron(text) from public, anon, authenticated;
grant execute on function public.obtener_secreto_para_cron(text) to service_role;

-- Reprograma el cron job: ahora manda X-Cron-Secret (el secreto nuevo,
-- leído de Vault igual que antes) en vez de X-Resend-Key — la función ya
-- no necesita recibir la clave de Resend por header, la busca ella misma.
select cron.unschedule('backup-diario-centinela');
select cron.schedule(
  'backup-diario-centinela',
  '0 12 * * *',
  $$
  select net.http_post(
    url := 'https://jyhpfwivhwzylkzxrsbt.supabase.co/functions/v1/backup-diario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5aHBmd2l2aHd6eWxrenhyc2J0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyODk3NDksImV4cCI6MjA5Njg2NTc0OX0.aefKMNuJ265RkDhH2KlDz929aM1l6FyMwcRgVXM0CX4',
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'backup_diario_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) as request_id;
  $$
);
