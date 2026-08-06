-- Endurecimiento menor (auditoría 2026-08-06): blindar_tipo_torres_iluminacion no
-- tenía search_path fijo. Riesgo real ya era bajo (no es SECURITY DEFINER, no llama
-- funciones ni tipos sin calificar — solo lee/escribe NEW.sigla/NEW.tipo), pero
-- fijarlo es gratis y cierra el warning del linter de seguridad de Supabase.
create or replace function public.blindar_tipo_torres_iluminacion()
returns trigger
language plpgsql
set search_path = public
as $function$
BEGIN
  IF NEW.sigla IN ('TI-5141','TI-5142','TI-5143','TI-5144','TI-5145','TI-5146') AND NEW.tipo IS DISTINCT FROM 'Torre Iluminacion' THEN
    NEW.tipo := 'Torre Iluminacion';
  END IF;
  RETURN NEW;
END;
$function$;
