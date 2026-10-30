-- #667 C: cron odświeżania geometrii pomarańczowych dróg HERE przed purge 30 d.
-- Job Edge here-roads (service role) raz na dobę; próg świeżości 21 d w kodzie.

create or replace function public.tower_cron_here_roads_invoke()
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
    raise notice 'tower_cron_here_roads_invoke: brak vault.decrypted_secrets';
    return;
  end if;
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    raise notice 'tower_cron_here_roads_invoke: brak net.http_post';
    return;
  end if;
  execute $q$
    select max(decrypted_secret) filter (where name = 'project_url'),
           max(decrypted_secret) filter (where name = 'service_role_key')
      from vault.decrypted_secrets
  $q$ into v_url, v_key;
  if v_url is null or v_url = '' or v_key is null or v_key = '' then
    raise notice 'tower_cron_here_roads_invoke: brak project_url/service_role_key';
    return;
  end if;
  perform net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/here-roads',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type', 'application/json'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;

revoke all on function public.tower_cron_here_roads_invoke() from public, anon, authenticated;
grant execute on function public.tower_cron_here_roads_invoke() to postgres;

do $body$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and to_regprocedure('cron.schedule(text,text,text)') is not null
  then
    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-here-roads';
    perform cron.schedule(
      'tower-here-roads',
      '15 4 * * *',
      $c$select public.tower_cron_here_roads_invoke();$c$
    );
  else
    raise notice '0353: pg_cron niedostępne — tower-here-roads do zaplanowania ręcznie';
  end if;
end
$body$;
