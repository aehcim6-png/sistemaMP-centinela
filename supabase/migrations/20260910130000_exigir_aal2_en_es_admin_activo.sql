-- Cierra una inconsistencia real de seguridad: cuando se agregó el
-- requisito de reverificación MFA (aal2) tras activar 2FA
-- (20260806050000_exigir_aal2_si_mfa_activo.sql), se aplicó a
-- privado.es_usuario_activo() y privado.es_editor_activo() pero se olvidó
-- privado.es_admin_activo() — la única de las 3 que sigue sin el chequeo.
-- Resultado: hoy, si un admin tiene 2FA activado, sus acciones de
-- lectura/edición normales SÍ exigen haber completado el segundo factor
-- esta sesión, pero sus acciones admin-only (crear operador, tocar precios
-- maestros, borrar changelog) NO lo exigen — justo las de mayor impacto.
--
-- Mismo criterio ya usado (idéntico al de las otras 2 funciones): si el
-- usuario nunca activó MFA, el comportamiento no cambia en nada (el OR de
-- "no existe factor verificado" sigue cubriendo ese caso).

create or replace function privado.es_admin_activo()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists(
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.activo = true and ur.role = 'admin'
  )
  and (
    coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
    or not exists(
      select 1 from auth.mfa_factors mf
      where mf.user_id = auth.uid() and mf.status = 'verified'
    )
  );
$$;
