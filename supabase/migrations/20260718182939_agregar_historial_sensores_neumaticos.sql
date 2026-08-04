ALTER TABLE public.sensores_neumaticos ADD COLUMN IF NOT EXISTS historial jsonb NOT NULL DEFAULT '[]'::jsonb;
