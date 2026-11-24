-- Validación del Score de Salud contra lo que pasó después (24-nov-2026). Solo lectura. Se corre en el SQL del proyecto de Supabase.
-- Para cada equipo y cada fecha T (cada 14 días) calcula las señales con lo que se sabía hasta T y mira si en los 30 días siguientes hubo una falla,
-- y si en los 60 días siguientes hubo una parada de 24 h o más. La tasa de cada grupo se compara con la tasa de todos.
-- Una señal sirve para el Score solo si sus grupos «malos» tienen una tasa claramente mayor que los «buenos» y esa diferencia se mantiene en el período reciente.
-- Parámetros: rango de T en generate_series (primera fecha ≥ inicio del historial de horómetros) y 'corte' para separar entrenamiento y prueba.
with fd as (
  select distinct sigla, fecha from (
    select sigla, fecha from public.correctivos where tipo='Correctivo' and public.clasificar_ot(coalesce(sintoma,'')||' '||coalesce(solucion,''),null)='correctiva'
    union all select sigla, fecha from public.correctivos_historico where "claseOT"='correctiva') x),
pl as (select sigla, fecha from public.correctivos where tipo='Correctivo' and public.clasificar_ot(coalesce(sintoma,'')||' '||coalesce(solucion,''),null)='correctiva' and substring(duracion from '(\d+)\s*h')::int >= 24),
pm as (select equipo sigla, coalesce("fechaEntrada","fechaEjec") f from public.registros_pm where coalesce(origen,'') not like 'Estimado desde%'),
ac as (select sigla, upper(componente) comp, fecha, case upper(estado) when 'NORMAL' then 1.0 when 'PRECAUCION' then 0.5 else 0 end cr from public.analisis_aceite),
t as (select d::date T from generate_series('2025-10-01'::date,'2026-10-15'::date,'14 days') d),
eq as (select sigla, "frecPM" frec, coalesce(nullif("hrsDia",0),12) hd from public.equipos where "frecPM">0),
obs as (
 select e.sigla, t.T, (t.T >= date '2026-04-01') reciente,
  (select count(*) from fd where fd.sigla=e.sigla and fd.fecha>t.T-90 and fd.fecha<=t.T) f90,
  (select count(*) from pl where pl.sigla=e.sigla and pl.fecha>t.T-365 and pl.fecha<=t.T) p365,
  (select avg(cr) from (select distinct on (comp) cr from ac where ac.sigla=e.sigla and ac.fecha>t.T-90 and ac.fecha<=t.T order by comp, fecha desc) z) ace,
  (select (t.T - max(f))::numeric/(e.frec/e.hd) from pm where pm.sigla=e.sigla and pm.f<=t.T) pm_ratio,
  exists (select 1 from fd where fd.sigla=e.sigla and fd.fecha>t.T and fd.fecha<=t.T+30) y30,
  exists (select 1 from pl where pl.sigla=e.sigla and pl.fecha>t.T and pl.fecha<=t.T+60) y60p
 from eq e cross join t
 where exists (select 1 from public.historial_horometros h where h.sigla=e.sigla and h.fecha<=t.T))
select 'TOTAL' senal, case when reciente then 'reciente (desde abr-2026)' else 'anterior' end periodo, 'todas' grupo, count(*) n, round(100.0*avg(y30::int),1) pct_falla_30d, round(100.0*avg(y60p::int),1) pct_parada24_60d from obs group by 2
union all select 'fallas_previas_90d', case when reciente then 'reciente (desde abr-2026)' else 'anterior' end, case when f90=0 then '0' when f90<=2 then '1-2' when f90<=5 then '3-5' else '6+' end, count(*), round(100.0*avg(y30::int),1), round(100.0*avg(y60p::int),1) from obs group by 2,3
union all select 'paradas24_previas_12m', case when reciente then 'reciente (desde abr-2026)' else 'anterior' end, case when p365=0 then '0' when p365=1 then '1' else '2+' end, count(*), round(100.0*avg(y30::int),1), round(100.0*avg(y60p::int),1) from obs group by 2,3
union all select 'aceite_90d', case when reciente then 'reciente (desde abr-2026)' else 'anterior' end, case when ace is null then 'sin muestra' when ace>=0.99 then 'normal(1)' when ace>=0.5 then 'medio(0.5-0.99)' else 'malo(<0.5)' end, count(*), round(100.0*avg(y30::int),1), round(100.0*avg(y60p::int),1) from obs group by 2,3
union all select 'pm_atraso_ratio', case when reciente then 'reciente (desde abr-2026)' else 'anterior' end, case when pm_ratio is null then 'sin PM previo' when pm_ratio<=0.75 then '<=0.75 (al dia)' when pm_ratio<=1.25 then '0.75-1.25' when pm_ratio<=2 then '1.25-2' else '>2 (muy atrasado)' end, count(*), round(100.0*avg(y30::int),1), round(100.0*avg(y60p::int),1) from obs group by 2,3
order by 1,3,2;
