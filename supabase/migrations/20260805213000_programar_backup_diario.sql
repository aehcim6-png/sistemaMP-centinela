-- Backup diario automático: invoca la Edge Function backup-diario todos los
-- días a las 12:00 UTC (~8:00 hora de Chile continental, UTC-4) vía pg_cron
-- + pg_net. La clave real de Resend nunca queda en este archivo ni en
-- ningún otro código versionado — vive cifrada en Supabase Vault
-- (vault.create_secret, nombre 'resend_api_key', cargada a mano una vez
-- desde el dashboard/MCP) y se lee recién acá, dentro de Postgres, al
-- momento de armar el request.
--
-- El anon key de abajo es la MISMA clave pública que ya usa el frontend
-- (_SB_DEFAULT_KEY en modules/store.js) — no es un secreto, verify_jwt=true
-- de la función solo exige un JWT válido de Supabase, y el anon key lo es.
select cron.schedule(
  'backup-diario-centinela',
  '0 12 * * *',
  $$
  select net.http_post(
    url := 'https://jyhpfwivhwzylkzxrsbt.supabase.co/functions/v1/backup-diario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5aHBmd2l2aHd6eWxrenhyc2J0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyODk3NDksImV4cCI6MjA5Njg2NTc0OX0.aefKMNuJ265RkDhH2KlDz929aM1l6FyMwcRgVXM0CX4',
      'X-Resend-Key', (select decrypted_secret from vault.decrypted_secrets where name = 'resend_api_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) as request_id;
  $$
);
