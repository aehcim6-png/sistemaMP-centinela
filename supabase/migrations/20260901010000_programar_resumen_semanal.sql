-- Resumen ejecutivo semanal (Edge Function resumen-semanal): programa el
-- envío vía pg_cron + pg_net, los lunes a las 11:00 UTC (~7-8 hora de Chile
-- continental, el mismo horario en que ya llega el correo diario de
-- alerta-pm). Mismo patrón de seguridad ya usado por alerta-pm y
-- backup-diario: el secreto vive cifrado en Supabase Vault
-- ('resumen_semanal_cron_secret', creado a mano vía MCP) y se lee recién
-- acá, dentro de Postgres, al armar el request — nunca queda en texto
-- plano en este archivo ni en cron.job.command.
select cron.schedule(
  'resumen-semanal-lunes',
  '0 11 * * 1',
  $$
  select net.http_post(
    url := 'https://jyhpfwivhwzylkzxrsbt.supabase.co/functions/v1/resumen-semanal',
    headers := jsonb_build_object(
      'apikey', 'sb_publishable_mI_CTe7yV23tllXXkdp-Aw_2UZCtwbi',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'resumen_semanal_cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) as request_id;
  $$
);
