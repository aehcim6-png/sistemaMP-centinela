-- Registro de accesos del SERVIDOR + alerta de accesos sospechosos (2026-10-22).
--
-- Por qué: hasta hoy los inicios de sesión se anotaban desde el navegador (tabla `changelog`: tiene un tope de 500 filas, un botón
-- «Limpiar» y un admin puede editarla o borrarla), y las alertas de dispositivo nuevo / intentos fallidos también las dispara el navegador.
-- Quien entrara directo a la API con una clave robada no dejaba rastro en esos controles, y Supabase solo deja consultar sus propios
-- registros de autenticación 24 h hacia atrás. Esto copia cada sesión nueva de `auth.sessions` (lo que el propio servidor creó al
-- iniciar sesión, pase o no por la app) a una tabla de SOLO AGREGAR.
--
-- Qué crea:
--   · public.accesos_servidor — una fila por sesión: cuenta, IP, navegador, nivel de autenticación (MFA), motivos y nivel
--     (base / normal / ambar / rojo). Solo un admin con MFA puede leerla. Nadie la edita ni la borra (lo impide un trigger),
--     salvo tres columnas de seguimiento que solo escribe el propio proceso: aal_final, motivos, nivel y avisado.
--   · privado.capturar_accesos()            — cada minuto. La primera vez deja las sesiones que YA existen como «base» (sin alertar).
--   · privado.avisar_accesos_sospechosos()  — cada 5 minutos. Manda UN correo (Resend, clave del Vault) con lo que esté en rojo y no se haya avisado.
--
-- Reglas (todas sobre la cuenta que inició la sesión):
--   rojo  → cuenta bloqueada, cuenta sin rol activo, IP y navegador nunca vistos juntos, o «mfa_incompleto» (la cuenta tiene MFA y la
--           sesión no lo completó en 5 minutos: alguien sabe la clave pero no tiene el segundo factor).
--   ámbar → IP nueva sola, navegador nuevo solo, o primer acceso de una cuenta (solo se ve en la tarjeta de Configuración, no manda correo).
--   Una IP nueva sola NO alerta: con datos móviles la IP cambia seguido y llenaría el correo de falsas alarmas.
--
-- Límites conocidos: una sesión que entre y salga en menos de un minuto puede no alcanzar a copiarse (la hora del último ingreso de la
-- cuenta sigue en auth.users). El correo sale por net.http_post (asíncrono): se marca «avisado» al encolarlo, no al confirmarse la entrega.

create table if not exists public.accesos_servidor (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid not null unique,
  usuario_id uuid not null,
  usuario_email text,
  ip text,
  navegador text,
  aal_inicial text,
  aal_final text,
  sesion_creada timestamptz not null,
  detectado_en timestamptz not null default now(),
  base boolean not null default false,
  motivos text[] not null default '{}',
  nivel text not null default 'normal' check (nivel in ('base', 'normal', 'ambar', 'rojo')),
  avisado boolean not null default false
);
create index if not exists idx_accesos_servidor_creada on public.accesos_servidor (sesion_creada desc);
create index if not exists idx_accesos_servidor_usuario on public.accesos_servidor (usuario_id, sesion_creada desc);
create index if not exists idx_accesos_servidor_pendientes on public.accesos_servidor (nivel) where nivel = 'rojo' and not avisado;

alter table public.accesos_servidor enable row level security;
-- privado.es_admin_activo() ya exige MFA completo (aal2) y rol admin activo.
create policy "accesos_servidor_select" on public.accesos_servidor for select to authenticated using (privado.es_admin_activo());
-- Sin políticas de INSERT/UPDATE/DELETE para usuarios: escriben solo las funciones de abajo (security definer).
grant select on table public.accesos_servidor to authenticated;
grant select, insert, update on table public.accesos_servidor to service_role;

-- De solo agregar: solo se pueden actualizar las columnas de seguimiento; ninguna fila se borra y la tabla no se vacía.
create or replace function privado.accesos_servidor_proteger() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if (new.id, new.sesion_id, new.usuario_id, new.usuario_email, new.ip, new.navegador, new.aal_inicial, new.sesion_creada, new.detectado_en, new.base)
       is distinct from
       (old.id, old.sesion_id, old.usuario_id, old.usuario_email, old.ip, old.navegador, old.aal_inicial, old.sesion_creada, old.detectado_en, old.base) then
      raise exception 'accesos_servidor es de solo agregar: solo se actualizan aal_final, motivos, nivel y avisado';
    end if;
    return new;
  end if;
  raise exception 'accesos_servidor es de solo agregar: no se puede borrar ni vaciar';
end $$;
create trigger accesos_servidor_solo_agregar before update or delete on public.accesos_servidor
  for each row execute function privado.accesos_servidor_proteger();
create trigger accesos_servidor_sin_truncate before truncate on public.accesos_servidor
  for each statement execute function privado.accesos_servidor_proteger();

-- Los textos de navegador/correo los controla quien inicia sesión: se escapan antes de ir a un correo HTML.
create or replace function privado.escapar_html(t text) returns text
language sql immutable set search_path = '' as $$
  select replace(replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;')
$$;

create or replace function privado.texto_motivo_acceso(m text) returns text
language sql immutable set search_path = '' as $$
  select case m
    when 'cuenta_bloqueada' then 'la cuenta está bloqueada'
    when 'cuenta_sin_acceso' then 'la cuenta no tiene un rol activo en el sistema'
    when 'ip_y_navegador_nuevos' then 'IP y navegador nunca vistos en esta cuenta'
    when 'mfa_incompleto' then 'la cuenta tiene verificación en dos pasos y esta sesión no la completó'
    when 'ip_nueva' then 'IP nueva para esta cuenta'
    when 'navegador_nuevo' then 'navegador nuevo para esta cuenta'
    when 'primer_acceso' then 'primer acceso de esta cuenta'
    else m
  end
$$;

create or replace function privado.capturar_accesos() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_primera boolean;
  s record;
  v_motivos text[];
  v_nivel text;
  v_ip_nueva boolean;
  v_nav_nuevo boolean;
  v_previas integer;
  v_n integer := 0;
begin
  v_primera := not exists (select 1 from public.accesos_servidor);

  for s in
    select se.id, se.user_id, se.created_at, host(se.ip) as ip, se.user_agent, se.aal::text as aal, u.email, u.banned_until
    from auth.sessions se
    left join auth.users u on u.id = se.user_id
    where not exists (select 1 from public.accesos_servidor a where a.sesion_id = se.id)
    order by se.created_at
  loop
    v_motivos := '{}';
    if v_primera then
      v_nivel := 'base';
    else
      select count(*) into v_previas from public.accesos_servidor a where a.usuario_id = s.user_id;
      v_ip_nueva := not exists (select 1 from public.accesos_servidor a where a.usuario_id = s.user_id and a.ip is not distinct from s.ip);
      v_nav_nuevo := not exists (select 1 from public.accesos_servidor a where a.usuario_id = s.user_id and a.navegador is not distinct from s.user_agent);
      v_nivel := 'normal';
      if s.banned_until is not null and s.banned_until > now() then
        v_motivos := v_motivos || 'cuenta_bloqueada'::text;
        v_nivel := 'rojo';
      end if;
      if not exists (select 1 from public.user_roles ur where ur.user_id = s.user_id and ur.activo = true) then
        v_motivos := v_motivos || 'cuenta_sin_acceso'::text;
        v_nivel := 'rojo';
      end if;
      if v_previas = 0 then
        v_motivos := v_motivos || 'primer_acceso'::text;
        if v_nivel <> 'rojo' then v_nivel := 'ambar'; end if;
      elsif v_ip_nueva and v_nav_nuevo then
        v_motivos := v_motivos || 'ip_y_navegador_nuevos'::text;
        v_nivel := 'rojo';
      elsif v_ip_nueva then
        v_motivos := v_motivos || 'ip_nueva'::text;
        if v_nivel <> 'rojo' then v_nivel := 'ambar'; end if;
      elsif v_nav_nuevo then
        v_motivos := v_motivos || 'navegador_nuevo'::text;
        if v_nivel <> 'rojo' then v_nivel := 'ambar'; end if;
      end if;
    end if;

    insert into public.accesos_servidor (sesion_id, usuario_id, usuario_email, ip, navegador, aal_inicial, aal_final, sesion_creada, base, motivos, nivel)
    values (s.id, s.user_id, s.email, s.ip, s.user_agent, s.aal, s.aal, s.created_at, v_primera, v_motivos, v_nivel)
    on conflict (sesion_id) do nothing;
    v_n := v_n + 1;
  end loop;

  -- Nivel de autenticación que fue alcanzando cada sesión reciente (el MFA se completa después de la clave, en la misma sesión).
  update public.accesos_servidor a set aal_final = se.aal::text
  from auth.sessions se
  where se.id = a.sesion_id and a.detectado_en > now() - interval '3 days' and a.aal_final is distinct from se.aal::text;

  -- La cuenta tiene MFA y a los 5 minutos la sesión no llegó a aal2: la clave se conoce, el segundo factor no.
  update public.accesos_servidor a set motivos = a.motivos || 'mfa_incompleto'::text, nivel = 'rojo'
  where not a.base
    and a.detectado_en > now() - interval '3 days'
    and a.detectado_en < now() - interval '5 minutes'
    and coalesce(a.aal_final, a.aal_inicial) is distinct from 'aal2'
    and not ('mfa_incompleto' = any (a.motivos))
    and exists (select 1 from auth.mfa_factors f where f.user_id = a.usuario_id and f.status = 'verified');

  return v_n;
end $$;

create or replace function privado.avisar_accesos_sospechosos() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  f record;
  v_items text := '';
  v_ids uuid[] := '{}';
  v_key text;
begin
  for f in
    select id, usuario_email, ip, navegador, aal_final, sesion_creada, motivos
    from public.accesos_servidor
    where nivel = 'rojo' and not avisado
    order by sesion_creada
  loop
    v_items := v_items || '<li><b>' || privado.escapar_html(coalesce(f.usuario_email, 'cuenta desconocida')) || '</b> — '
      || to_char(f.sesion_creada at time zone 'America/Santiago', 'DD-MM-YYYY HH24:MI') || ' (hora de Chile)<br>'
      || 'IP ' || privado.escapar_html(f.ip) || ' · ' || privado.escapar_html(f.navegador) || '<br>'
      || 'Motivo: ' || privado.escapar_html((select string_agg(privado.texto_motivo_acceso(m), '; ') from unnest(f.motivos) m)) || '</li>';
    v_ids := v_ids || f.id;
  end loop;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return 0;
  end if;

  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'resend_api_key';
  if v_key is null then
    raise exception 'No hay resend_api_key en el Vault: los accesos en rojo quedan sin avisar y se reintenta en 5 minutos';
  end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', 'Sistema MP Centinela <onboarding@resend.dev>',
      'to', jsonb_build_array('aehcim6@gmail.com'),
      'subject', '🔴 Acceso sospechoso — SistemaMP Centinela',
      'html', '<h2>🔴 SistemaMP Centinela — acceso sospechoso</h2><p>El servidor registró ' || array_length(v_ids, 1)
        || ' inicio(s) de sesión que conviene revisar:</p><ul>' || v_items
        || '</ul><p style="color:#888;font-size:12px">Revisa Configuración → Usuarios y accesos → Accesos del servidor. Si no reconoces el acceso, bloquea la cuenta desde Supabase → Authentication → Users y cambia la clave.</p>'
    )
  );
  update public.accesos_servidor set avisado = true where id = any (v_ids);
  return array_length(v_ids, 1);
end $$;

-- Solo el propio servidor (cron / postgres) las ejecuta; ni la API ni los usuarios.
revoke all on function privado.capturar_accesos() from public, anon, authenticated;
revoke all on function privado.avisar_accesos_sospechosos() from public, anon, authenticated;

-- Foto inicial: las sesiones que ya existen quedan como «base» (no se evalúan ni avisan).
select privado.capturar_accesos();

select cron.schedule('capturar-accesos', '* * * * *', $$select privado.capturar_accesos();$$);
select cron.schedule('avisar-accesos-sospechosos', '*/5 * * * *', $$select privado.avisar_accesos_sospechosos();$$);
