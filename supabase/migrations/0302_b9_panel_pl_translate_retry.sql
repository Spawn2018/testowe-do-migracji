-- B9 (8A, D-20261019-1515-01, #322): panel tylko PL — DeepL zostaje.
-- 1) kopia + wszyscy locale=pl; drop user_preferences.locale (wybór EN/SV ekranów)
-- 2) deepl_usage_view: kolejka + najstarszy (alarm >15 min)
-- 3) cron translate-retry co 5 min
-- app_users.locale zostaje (powiadomienia) — wymuszone pl; driver_locale bez zmian.

begin;

-- ---------------------------------------------------------------------
-- 1. Locale panelu → pl (kopia w audit_log)
-- ---------------------------------------------------------------------
do $b9$
declare
  v_prefs int;
  v_users int;
  v_prefs_pairs jsonb;
  v_users_pairs jsonb;
begin
  select count(*)::int into v_prefs
    from user_preferences where locale is distinct from 'pl';
  select count(*)::int into v_users
    from app_users where locale is distinct from 'pl';
  select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'locale', locale) order by user_id), '[]'::jsonb)
    into v_prefs_pairs
    from user_preferences where locale is distinct from 'pl';
  select coalesce(jsonb_agg(jsonb_build_object('user_id', id, 'locale', locale) order by id), '[]'::jsonb)
    into v_users_pairs
    from app_users where locale is distinct from 'pl';

  insert into public.audit_log (user_id, action, entity, entity_id, new_value)
  values (
    null,
    'AUDYT17_B9_LOCALE',
    'user_preferences',
    'b9-0302',
    jsonb_build_object(
      'prefs_non_pl', v_prefs,
      'users_non_pl', v_users,
      'prefs_pairs', v_prefs_pairs,
      'users_pairs', v_users_pairs,
      'at', now(),
      'migration', '0302',
      'reason', 'B9 panel PL — locale → pl przed drop'
    )
  );

  update user_preferences set locale = 'pl', updated_at = now()
   where locale is distinct from 'pl';
  update app_users set locale = 'pl'
   where locale is distinct from 'pl';
end
$b9$;

alter table public.user_preferences drop column if exists locale;

comment on table public.user_preferences is
  'Ustawienia użytkownika (waluta, motyw). B9: bez locale — panel tylko PL (8A / D-20261019-1515-01).';

-- ---------------------------------------------------------------------
-- 2. Kolejka: delete dla service_role (ponowienie usuwa wpis)
-- ---------------------------------------------------------------------
grant delete on public.translation_queue to service_role;

-- ---------------------------------------------------------------------
-- 3. deepl_usage_view — kolejka + najstarszy (poza odrzucone)
-- ---------------------------------------------------------------------
create or replace function public.deepl_usage_view()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_month date;
  v_used integer;
  v_limit integer;
  v_q integer;
  v_q_stale integer;
  v_oldest timestamptz;
  v_level text;
begin
  if (is_hhl()) is not true then
    raise exception 'Zużycie tłumaczeń widzi wyłącznie HHL' using errcode = '42501';
  end if;
  v_month := (date_trunc('month', now() at time zone 'Europe/Warsaw'))::date;
  select characters, monthly_limit into v_used, v_limit
    from deepl_usage where month = v_month;
  v_used := coalesce(v_used, 0);
  v_limit := coalesce(v_limit, 1000000);
  select count(*)::integer into v_q from translation_queue;
  select count(*)::integer, min(created_at)
    into v_q_stale, v_oldest
    from translation_queue
   where reason is distinct from 'odrzucone';
  v_level := case
    when v_used >= v_limit then 'full'
    when v_used >= (v_limit * 0.8) then 'warn'
    when v_oldest is not null and v_oldest < now() - interval '15 minutes' then 'warn'
    else 'ok'
  end;
  return jsonb_build_object(
    'characters', v_used,
    'monthly_limit', v_limit,
    'queued', v_q,
    'queued_active', coalesce(v_q_stale, 0),
    'oldest_at', v_oldest,
    'oldest_age_min', case
      when v_oldest is null then null
      else round(extract(epoch from (now() - v_oldest)) / 60.0)::integer
    end,
    'level', v_level
  );
end $$;

revoke all on function public.deepl_usage_view() from public, anon;
grant execute on function public.deepl_usage_view() to authenticated;

comment on function public.deepl_usage_view() is
  'B9: DeepL usage + kolejka (queued/oldest); level=warn gdy wpis >15 min (poza odrzucone) albo ≥80% limitu.';

-- ---------------------------------------------------------------------
-- 4. Cron translate-retry co 5 min
-- ---------------------------------------------------------------------
do $m$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then

    perform cron.unschedule(jobid) from cron.job where jobname = 'tower-translate-retry';
    perform cron.schedule('tower-translate-retry', '*/5 * * * *', $c$
      select net.http_post(
        url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
                   || '/functions/v1/translate-retry',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'Content-Type', 'application/json'),
        body    := '{}'::jsonb,
        timeout_milliseconds := 55000)
    $c$);

  else
    raise notice '0302: pg_cron lub pg_net niedostępne — cron tower-translate-retry do zaplanowania ręcznie';
  end if;
end
$m$;

commit;
