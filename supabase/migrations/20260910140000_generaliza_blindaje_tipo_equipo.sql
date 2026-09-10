-- El trigger blindar_tipo_torres_iluminacion (20260716202505) protegía el
-- campo `tipo` de 6 equipos con las siglas de Besalco escritas a mano en el
-- SQL — solo funcionaba para ESAS siglas exactas: se rompe si se renombran
-- o dan de baja, y no protege ninguna Torre de Iluminación (ni ningún otro
-- equipo) de otro cliente. Deuda técnica encontrada en la exploración de
-- multi-tenancy de esta sesión.
--
-- Se reemplaza por un campo real en la tabla (`tipo_bloqueado`): cualquier
-- fila con esta bandera en true no puede cambiar su `tipo` vía UPDATE
-- (se revierte al valor anterior si alguien lo intenta) — generalizado a
-- cualquier equipo, no solo torres, sin ninguna sigla hardcodeada.
--
-- Se migran los 6 equipos que ya estaban protegidos por el trigger viejo
-- para que sigan exactamente igual de protegidos (cero cambio de
-- comportamiento para ellos). Hoy no hay ninguna casilla en la pantalla de
-- Equipos para tocar esta bandera — cambiarla requiere SQL directo; queda
-- como mejora aparte si hace falta exponerlo en la UI.

alter table public.equipos add column tipo_bloqueado boolean not null default false;

update public.equipos
set tipo_bloqueado = true
where sigla in ('TI-5141','TI-5142','TI-5143','TI-5144','TI-5145','TI-5146');

drop trigger if exists blindar_tipo_torres_trg on public.equipos;
drop function if exists public.blindar_tipo_torres_iluminacion();

create or replace function public.blindar_tipo_equipo_bloqueado()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if OLD.tipo_bloqueado is true and NEW.tipo is distinct from OLD.tipo then
    NEW.tipo := OLD.tipo;
  end if;
  return NEW;
end;
$function$;

create trigger blindar_tipo_equipo_bloqueado_trg
  before update on public.equipos
  for each row
  execute function public.blindar_tipo_equipo_bloqueado();
