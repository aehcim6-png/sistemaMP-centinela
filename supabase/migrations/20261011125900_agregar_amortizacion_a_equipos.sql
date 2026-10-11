-- Capital por hora del equipo para el costo total de propiedad (2026-10-11): amortización contable por hora (listado "Horas a Amortizar", columna Valor_Hora) y vida contable
-- en horas (Saldo_Horas_Real). Aditivas y nullables: null = se usa valor de compra ÷ vida contable de referencia por clase. Aplicadas en ambas bases.
alter table public.equipos add column if not exists "valorHoraAmort" numeric;
alter table public.equipos add column if not exists "vidaContableH" numeric;
