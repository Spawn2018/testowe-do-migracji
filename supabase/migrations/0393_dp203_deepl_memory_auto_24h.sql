-- DP-203 / F7 #780 r3: deepl_usage_view + licznik nowych zwrotów w pamięci / 24 h
-- (właściciel 03.11 23:34 — bez RESOURCE_MISSING:TV_CODE dla HHL; auto DeepL → translation_memory).

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
  v_mem_24h integer;
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
  select count(*)::integer into v_mem_24h
    from translation_memory
   where created_at >= now() - interval '24 hours';
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
    'memory_auto_24h', coalesce(v_mem_24h, 0),
    'level', v_level
  );
end $$;

revoke all on function public.deepl_usage_view() from public, anon;
grant execute on function public.deepl_usage_view() to authenticated;

comment on function public.deepl_usage_view() is
  'B9 + F7 #780 r3: DeepL usage + kolejka + memory_auto_24h (nowe zwroty dopisane automatycznie).';
