-- Corrige un hallazgo real de la auditoría propia (2026-08-06): ninguna de las
-- políticas RLS del proyecto exigía nivel de autenticación aal2 — la
-- verificación en dos pasos (MFA/TOTP) del login era, en los hechos, solo una
-- pantalla más de la interfaz. Un token aal1 (obtenido con solo email+clave,
-- por ejemplo llamando directo a /auth/v1/token sin pasar por la app) ya
-- alcanzaba para pasar cualquiera de las 153 políticas existentes, exactamente
-- lo mismo que si esa cuenta no tuviera MFA activado. Verificado: hoy nadie
-- tiene un factor MFA verificado (auth.mfa_factors vacía), así que este fix es
-- preventivo — cero impacto en accesos actuales — antes de que alguien active
-- MFA pensando que ya lo protege de verdad.
--
-- Patrón oficial recomendado por Supabase para "exigir aal2 solo si el usuario
-- se inscribió en MFA": exige aal2 en el JWT, salvo que la cuenta no tenga
-- ningún factor MFA verificado (para no romper el acceso de quien nunca
-- activó MFA). Se aplica en las dos funciones que ya protegen las ~150
-- políticas RLS de todo el proyecto — un solo cambio corrige todo a la vez,
-- sin tocar política por política.
create or replace function privado.es_usuario_activo()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists(
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.activo = true
  )
  and (
    coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
    or not exists(
      select 1 from auth.mfa_factors mf
      where mf.user_id = auth.uid() and mf.status = 'verified'
    )
  );
$$;

create or replace function privado.es_editor_activo()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists(
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.activo = true and ur.role in ('admin','operador')
  )
  and (
    coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
    or not exists(
      select 1 from auth.mfa_factors mf
      where mf.user_id = auth.uid() and mf.status = 'verified'
    )
  );
$$;
