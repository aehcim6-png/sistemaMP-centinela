-- Clasificación del contenido de las órdenes de trabajo del histórico (2026-11-07).
-- Las OT del Excel marcan «Correctiva» tareas que en realidad son rutina preventiva
-- (control de neumáticos, presurizado, engrase), cambios de desgaste planificados
-- (cuchillas, entredientes) o instalaciones/mejoras (antisomnolencia, radio base).
-- No se toca "tipoInt" (queda tal como vino del Excel); se agrega "claseOT" y las
-- pantallas que cuentan fallas (MTBF, Pareto, ranking de equipos) solo suman las
-- 'correctiva'. El mismo criterio vive en logic.js (claseOTDesdeTexto); si cambias
-- uno, cambia el otro.

create or replace function public.clasificar_ot(descripcion text, tipo_int text)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case
    when tipo_int in ('Programada', 'Predictiva') then 'preventiva'
    when coalesce(descripcion, '') ~* '(instala|instalaci[oó]n|mejora|calibra|polariz|sellado de cabina|hermeticidad)'
     and coalesce(descripcion, '') ~* '(radio base|antisomnolen|somnolencia|fatiga|\yadas\y|polariz|check ?point|c[aá]mara|manos libres|gps|sellado de cabina|hermeticidad)'
     and coalesce(descripcion, '') !~* '(fuera de servicio|falla|fuga|corte|da[ñn]ad|defectuos|repara)'
      then 'instalacion'
    when coalesce(descripcion, '') ~* '(cuchilla|elementos? de desgaste|entre ?calza|entre ?diente|calzas|puntas? (del )?ripper|cantonera|reposici[oó]n de elemento|pernos? de elemento)'
      then 'desgaste'
    when coalesce(descripcion, '') ~* '(control (de )?neum|chequeo (de )?neum|presuri|inflado|torque|apernadura|retorque|normaliza pos|chequeo preventivo|mantenci[oó]n preventiva|mantenci[oó]n (semanal|diaria|programada)|chequeo diario|chequeo general|engrase|relleno (de|en) (dep[oó]sito|tanque|tk)|relleno de (grasa|aceite|refrigerante|niveles)|revisi[oó]n de niveles|limpieza (de )?filtro|sopletea|lavado)'
     and coalesce(descripcion, '') !~* '(fuera de servicio|falla|fuga|rota|roto|cambio de (motor|turbo|compresor|bomba|cilindro)|c[oó]digo)'
      then 'preventiva'
    else 'correctiva'
  end;
$$;

-- Función interna (la usa esta migración y las cargas de histórico): nadie la llama desde la app.
revoke all on function public.clasificar_ot(text, text) from public, anon, authenticated;
grant execute on function public.clasificar_ot(text, text) to service_role;

alter table public.correctivos_historico
  add column if not exists "claseOT" text;

alter table public.correctivos_historico
  drop constraint if exists correctivos_historico_claseot_chk;
alter table public.correctivos_historico
  add constraint correctivos_historico_claseot_chk
  check ("claseOT" is null or "claseOT" in ('correctiva', 'preventiva', 'desgaste', 'instalacion'));

-- Rellena solo las filas aún sin clasificar (no pisa una clasificación manual).
update public.correctivos_historico
   set "claseOT" = public.clasificar_ot(descripcion, "tipoInt")
 where "claseOT" is null;
