
CREATE OR REPLACE FUNCTION public.blindar_tipo_torres_iluminacion()
RETURNS trigger AS $$
BEGIN
  IF NEW.sigla IN ('TI-5141','TI-5142','TI-5143','TI-5144','TI-5145','TI-5146') AND NEW.tipo IS DISTINCT FROM 'Torre Iluminacion' THEN
    NEW.tipo := 'Torre Iluminacion';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS blindar_tipo_torres_trg ON public.equipos;
CREATE TRIGGER blindar_tipo_torres_trg
  BEFORE INSERT OR UPDATE ON public.equipos
  FOR EACH ROW
  EXECUTE FUNCTION public.blindar_tipo_torres_iluminacion();
