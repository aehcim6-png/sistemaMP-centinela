-- Detector de salud del sistema — Capa 1 (ver también
-- 20260914080000_crear_tabla_salud_crons.sql y
-- _shared/registrarSaludCron.ts). Programa la Edge Function
-- vigilar-salud-sistema vía pg_cron + pg_net, todos los días a las 13:00
-- UTC — una hora después de backup-diario (0 12 * * *), para que ya haya
-- alcanzado a registrar su resultado del día en salud_crons antes de
-- evaluarlo.
--
-- Mismo patrón de seguridad que backup-diario/alerta-pm/resumen-semanal: el
-- secreto vive cifrado en Supabase Vault ('vigilar_salud_cron_secret',
-- creado a mano vía MCP, un valor aleatorio de 32 bytes) y se lee recién
-- acá, dentro de Postgres, al armar el request — nunca queda en texto
-- plano en este archivo. El anon key de abajo es la MISMA clave pública
-- que ya usa el frontend (_SB_DEFAULT_KEY en modules/store.js) — no es un
-- secreto, solo identifica el proyecto ante Supabase (verify_jwt=true
-- exige un JWT válido, y el anon key lo es).
select cron.schedule(
  'vigilar-salud-sistema-diario',
  '0 13 * * *',
  $$
  select net.http_post(
    url := 'https://jyhpfwivhwzylkzxrsbt.supabase.co/functions/v1/vigilar-salud-sistema',
    headers := jsonb_build_object(
      'apikey', 'sb_publishable_mI_CTe7yV23tllXXkdp-Aw_2UZCtwbi',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'vigilar_salud_cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) as request_id;
  $$
);
