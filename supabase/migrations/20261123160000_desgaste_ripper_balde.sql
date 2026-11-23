-- Todo lo que se consume por desgaste cuenta como desgaste (2026-11-23, a pedido del usuario): cuchillas y cuchillos, ripper y sus puntas, puntas, canilleras, planchas de desgaste y el cambio o reparación del balde.
-- «ripper» o «balde» solos no bastan: una falla hidráulica del ripper sigue siendo falla. Es exactamente lo que genera scripts/generar_componente_sql.js desde logic.js (solo cambia clasificar_ot).
create or replace function public.clasificar_ot(descripcion text, tipo_int text)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case
    when tipo_int in ('Programada', 'Predictiva') then 'preventiva'
    when coalesce(descripcion, '') ~* '(empantan|enterrad|desenterr|remolque|siniestr|falta (de )?combustible|sin combustible|autonom[ií]a|turno noche|sistema siga|helipuer|revisi[oó]n t[eé]cnica|acreditaci|cotizaci[oó]n)' then 'operacional'
    when coalesce(descripcion, '') ~* '(fuera de servicio|f\/s)[^.]{0,30}(por pm|\ypm ?0?[1-4]\y|mantenci[oó]n programada|mantencicion programada|mantenimiento preventivo)' then 'preventiva'
    when coalesce(descripcion, '') ~* '(instala|instalaci[oó]n|mejora|calibra|polariz|sellado de cabina|hermeticidad)'
     and coalesce(descripcion, '') ~* '(radio base|antisomnolen|somnolencia|fatiga|\yadas\y|polariz|check ?point|c[aá]mara|manos libres|gps|sellado de cabina|hermeticidad)'
     and coalesce(descripcion, '') !~* '(fuera de servicio|falla|fuga|corte|da[ñn]ad|defectuos|repara)'
      then 'instalacion'
    when coalesce(descripcion, '') ~* '(rodado|cuchill|elementos? de desgaste|entre ?calza|entre ?diente|calzas|puntas? (del? )?(ripper|riper|reaper|ripeer)|(ripper|riper|reaper|ripeer)[^.;]{0,25}(puntas?|cuchill|desgaste)|(cambio|reposici[oó]n|reemplazo|instalaci[oó]n|montaje)s?[^.;]{0,15}puntas?\y|(cambio|reposici[oó]n|reemplazo|instalaci[oó]n|montaje)s?[^.;]{0,25}(ripper|riper|reaper|ripeer)\y|cantonera|canillera|planchas? de desgaste|reposici[oó]n de elemento|pernos? de elemento|(cambio|reposici[oó]n|reemplazo|instalaci[oó]n|montaje|reparaci[oó]n|soldadura|refuerzo)s?[^.;]{0,15}(de|del) balde\y)' then 'desgaste'
    when coalesce(descripcion, '') ~* '(adblue|ad.blue|ab.blue|ablue|mantenimiento (preventivo|programado)|sopleteo|chequeo de niveles|chequeo visual|inp?ecci[oó]n visual|inspecci[oó]n visual|prueba de herm|rellena con petr[oó]leo|calibraci[oó]n|\ypm ?0?[1-4]\y|mantenci[oó]n prreventiva|mantenci[oó]n en terreno|chequeo semanal|inspecci[oó]n (diaria|general)|control (de )?neum|chequeo (de )?neum|presuri|inflado|torque|apernadura|retorque|normaliza pos|chequeo preventivo|mantenci[oó]n preventiva|mantenci[oó]n (semanal|diaria|programada)|chequeo diario|chequeo general|engrase|relleno (de|en) (dep[oó]sito|tanque|tk)|relleno de (grasa|aceite|refrigerante|niveles)|revisi[oó]n de niveles|limpieza (de )?filtro|sopletea|lavado)'
     and coalesce(descripcion, '') !~* '(fuera de servicio|falla|fuga|rota|roto|cambio de (motor|turbo|compresor|bomba|cilindro)|c[oó]digo)'
      then 'preventiva'
    else 'correctiva'
  end;
$$;

revoke all on function public.clasificar_ot(text, text) from public, anon, authenticated;
grant execute on function public.clasificar_ot(text, text) to service_role;
