-- Estado de la pieza instalada en el Historial de Componentes (29-oct-2026): Nuevo, Reparado o Usado. Es distinto de «origen» (marca: Komatsu, alternativo…):
-- una pieza puede ser Komatsu y reparada. Alimenta «Reparar vs comprar» (vida de lo reparado contra lo nuevo). Texto libre corto; null = sin anotar.
-- No es una tabla ni función nueva: no requiere GRANT.
alter table public.historial_componentes add column if not exists "estadoPieza" text;
comment on column public.historial_componentes."estadoPieza" is 'Estado de lo instalado: Nuevo, Reparado o Usado. null = sin anotar (las filas viejas lo traen escrito al inicio de la observación).';
