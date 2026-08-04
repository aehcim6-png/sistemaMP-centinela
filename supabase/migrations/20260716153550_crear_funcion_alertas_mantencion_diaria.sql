create or replace function public.enviar_alertas_mantencion()
returns void
language plpgsql
security definer
set search_path = public, vault, extensions
as $$
declare
  v_api_key text;
  v_html text;
  v_filas text;
  v_count int;
begin
  select decrypted_secret into v_api_key from vault.decrypted_secrets where name = 'resend_api_key';
  if v_api_key is null then
    raise notice 'No se encontro la clave de Resend en Vault';
    return;
  end if;

  with calc as (
    select
      sigla, tipo, modelo, "horomActual", "hrsDia",
      ceil("horomActual" / nullif("frecPM",0)) * coalesce("frecPM",250) as horom_prox_pm
    from equipos
  ), urgentes as (
    select sigla, tipo, modelo, "horomActual",
      case when "hrsDia" > 0 then round((horom_prox_pm - "horomActual")/"hrsDia") else 999 end as dias_para_pm
    from calc
  )
  select count(*), coalesce(string_agg(
    format('<tr><td style="padding:6px 10px;border-bottom:1px solid #333">%s</td><td style="padding:6px 10px;border-bottom:1px solid #333">%s %s</td><td style="padding:6px 10px;border-bottom:1px solid #333;text-align:right">%s h</td><td style="padding:6px 10px;border-bottom:1px solid #333;text-align:right">%s</td></tr>',
      sigla, coalesce(tipo,''), coalesce(modelo,''), "horomActual", dias_para_pm),
    '' order by dias_para_pm asc), '')
  into v_count, v_filas
  from urgentes
  where dias_para_pm <= 7;

  if v_count > 0 then
    v_html := format('<h2>Equipos que requieren mantencion URGENTE (%s)</h2><table style="border-collapse:collapse;font-family:sans-serif;font-size:14px"><tr><th style="text-align:left;padding:6px 10px">Equipo</th><th style="text-align:left;padding:6px 10px">Tipo/Modelo</th><th style="text-align:right;padding:6px 10px">Horometro</th><th style="text-align:right;padding:6px 10px">Dias</th></tr>%s</table><p style="color:#888;font-size:12px">SistemaMP Centinela - alerta automatica diaria</p>', v_count, v_filas);
  else
    v_html := '<h2>Sin equipos urgentes hoy</h2><p style="color:#888;font-size:12px">SistemaMP Centinela - alerta automatica diaria</p>';
  end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_api_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', 'SistemaMP Centinela <onboarding@resend.dev>',
      'to', jsonb_build_array('aehcim6@gmail.com'),
      'subject', case when v_count > 0 then format('%s equipo(s) urgente(s) - SistemaMP Centinela', v_count) else 'Sin urgencias - SistemaMP Centinela' end,
      'html', v_html
    )
  );
end;
$$;
