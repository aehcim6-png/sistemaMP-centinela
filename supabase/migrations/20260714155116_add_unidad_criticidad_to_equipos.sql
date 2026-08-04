
alter table public.equipos add column if not exists "unidad" text;
alter table public.equipos add column if not exists "criticidad" text;

update public.equipos e
set "unidad" = elem->>'unidad'
from kv, jsonb_array_elements(kv.value) elem
where kv.key='eq' and elem->>'sigla' = e.sigla and elem->>'unidad' is not null;
