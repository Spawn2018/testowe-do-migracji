-- BN6 (#716) cz.4 — cron Edge road-ee (Tark Tee DATEX, X-DATEX-API-KEY).
-- Enum ROAD_EE / corridor_conditions / audience — już w 0376.

create or replace function public.tower_cron_road_ee_invoke()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
begin
  if to_regclass('vault.decrypted_secrets') is null then
    raise notice 'tower_cron_road_ee_invoke: brak vault.decrypted_secrets';
    return;
  end if;
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    raise notice 'tower_cron_road_ee_invoke: brak net.http_post';
    return;
  end if;
  execute $q$
    select max(decrypted_secret) filter (where name = 'project_url'),
           max(decrypted_secret) filter (where name = 'service_role_key')
      from vault.decrypted_secrets
  $q$ into v_url, v_key;
  if v_url is null or v_url = '' or v_key is null or v_key = '' then
    raise notice 'tower_cron_road_ee_invoke: brak project_url/service_role_key';
    return;
  end if;
  perform net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/road-ee',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type', 'application/json'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 90000
  );
end;
$$;

revoke all on function public.tower_cron_road_ee_invoke() from public, anon, authenticated;
grant execute on function public.tower_cron_road_ee_invoke() to postgres;

do $body$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and to_regprocedure('cron.schedule(text,text,text)') is not null
  then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-road-ee';
    perform cron.schedule(
      'tower-road-ee',
      '*/15 * * * *',
      $c$select public.tower_cron_road_ee_invoke();$c$
    );
  else
    raise notice '0379: pg_cron niedostępne — tower-road-ee do zaplanowania ręcznie';
  end if;
end
$body$;
