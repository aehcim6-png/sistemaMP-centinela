
CREATE TABLE public.sensores_neumaticos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "numSensor" text,
  marca text,
  sigla text,
  posicion text,
  "neuSerie" text,
  estado text DEFAULT 'Operativo',
  "fechaInst" date,
  obs text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sensores_neumaticos ENABLE ROW LEVEL SECURITY;

CREATE POLICY operacional_rw ON public.sensores_neumaticos
  FOR ALL
  USING (privado.es_usuario_activo())
  WITH CHECK (privado.es_usuario_activo());

CREATE TRIGGER actualizar_updated_at
  BEFORE UPDATE ON public.sensores_neumaticos
  FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

-- Backfill: un sensor por cada neumático que ya tiene numSensor cargado
INSERT INTO public.sensores_neumaticos ("numSensor", marca, sigla, posicion, "neuSerie", estado, "fechaInst")
SELECT "numSensor", marca, sigla, posicion, serie, 'Operativo', "fechaInst"
FROM public.neumaticos
WHERE "numSensor" IS NOT NULL AND "numSensor" <> '';
