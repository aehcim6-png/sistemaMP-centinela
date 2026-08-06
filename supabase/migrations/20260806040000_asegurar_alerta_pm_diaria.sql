-- Corrige un hallazgo real de la auditoría propia (2026-08-06): la Edge
-- Function alerta-pm comparaba su header x-cron-secret contra un secreto FIJO
-- y de baja entropía ('pm-centinela-2026', literalmente el nombre del proyecto
-- + el año) — guardado además en texto plano dentro de cron.job.command,
-- visible para cualquiera con acceso SQL al proyecto. Impacto real limitado
-- (la función solo devuelve conteos agregados al llamador, nunca datos crudos,
-- y el destinatario del email queda fijo por env var, no lo controla quien
-- invoca), pero es el mismo patrón débil que ya se corrigió en backup-diario.
--
-- Arreglo: reusa verificar_secreto_cron() (ya creada para backup-diario, ver
-- 20260806014500_asegurar_backup_diario.sql — restringida a service_role) con
-- un secreto propio de 32 bytes en Vault, nombre 'alerta_pm_cron_secret'. El
-- cron ya no embebe el secreto como literal: lo lee de Vault en cada disparo.
select cron.unschedule('alerta-pm-diaria');
select cron.schedule(
  'alerta-pm-diaria',
  '0 11 * * *',
  $$
  select net.http_post(
    url := 'https://jyhpfwivhwzylkzxrsbt.supabase.co/functions/v1/alerta-pm',
    headers := jsonb_build_object(
      'apikey', 'sb_publishable_mI_CTe7yV23tllXXkdp-Aw_2UZCtwbi',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'alerta_pm_cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) as request_id;
  $$
);
