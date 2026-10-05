-- 0161 — PL-DATA: pamięć tłumaczeń, zużycie DeepL, kolejka tekstu wolnego.
-- H1_ROUTE_CHECK i H3_CORRIDOR_OBSTACLES nie są ruszane.
-- Bez kasowania transportów. SMS ryzyka drogowego jest po polsku w każdym języku konta.

create or replace function sms_render(p_kind text, p_locale text, p jsonb) returns text
language plpgsql immutable set search_path = public as $$
declare t text; k text;
begin
  t := case p_kind || ':' || coalesce(p_locale, 'pl')
    when 'DRIVER_LINK:pl' then 'Watch Tower {nr}: link kierowcy {url} Nie udostepniaj.'
    when 'DRIVER_LINK:en' then 'Watch Tower {nr}: driver link {url} Do not share.'
    when 'DRIVER_LINK:sv' then 'Watch Tower {nr}: forarlank {url} Dela inte.'
    when 'WINDOW_CHANGE:pl' then 'Watch Tower {nr}: ZMIANA okna {okno_pl}: {dt}-{t2} (czas lokalny).'
    when 'WINDOW_CHANGE:en' then 'Watch Tower {nr}: CHANGED {okno_en} window: {dt}-{t2} (local time).'
    when 'WINDOW_CHANGE:sv' then 'Watch Tower {nr}: ANDRAT {okno_sv}: {dt}-{t2} (lokal tid).'
    when 'SAILING_CHANGE:pl' then 'Watch Tower {nr}: ZMIANA PROMU: {statek}, Gdansk {dt}, rezerwacja {ref}.'
    when 'SAILING_CHANGE:en' then 'Watch Tower {nr}: FERRY CHANGED: {statek}, Gdansk {dt}, booking {ref}.'
    when 'SAILING_CHANGE:sv' then 'Watch Tower {nr}: NY FARJA: {statek}, Gdansk {dt}, bokning {ref}.'
    when 'SAILING_CANCELLED:pl' then 'Watch Tower {nr}: PROM {statek} {dt} ODWOLANY. Czekaj na nowy rejs.'
    when 'SAILING_CANCELLED:en' then 'Watch Tower {nr}: FERRY {statek} {dt} CANCELLED. Wait for a new sailing.'
    when 'SAILING_CANCELLED:sv' then 'Watch Tower {nr}: FARJA {statek} {dt} INSTALLD. Vanta pa ny avgang.'
    when 'LOAD_CANCELLED:pl' then 'Watch Tower {nr}: TRANSPORT ANULOWANY.'
    when 'LOAD_CANCELLED:en' then 'Watch Tower {nr}: TRANSPORT CANCELLED.'
    when 'LOAD_CANCELLED:sv' then 'Watch Tower {nr}: TRANSPORT INSTALLD.'
    when 'GPS_SILENT:pl' then 'Watch Tower {nr}: brak pozycji GPS od {min} min. Otworz link i zostaw strone wlaczona.'
    when 'GPS_SILENT:en' then 'Watch Tower {nr}: no GPS position for {min} min. Open your link and keep the page open.'
    when 'GPS_SILENT:sv' then 'Watch Tower {nr}: ingen GPS-position pa {min} min. Oppna lankken och lat sidan vara oppen.'
    when 'UNLOAD_CONFIRM:pl' then 'Watch Tower {nr}: jestes na placu Stegra Boden. Po rozladunku potwierdz ROZLADOWANO w linku.'
    when 'UNLOAD_CONFIRM:en' then 'Watch Tower {nr}: you are at Stegra Boden. After unloading confirm UNLOADED in your link.'
    when 'UNLOAD_CONFIRM:sv' then 'Watch Tower {nr}: du ar pa Stegra Boden. Bekrafta LOSSAD i lankken efter lossning.'
    when 'TEST:pl' then 'Watch Tower: SMS testowy bramki.'
    when 'TEST:en' then 'Watch Tower: gateway test SMS.'
    when 'TEST:sv' then 'Watch Tower: test-SMS fran gatewayen.'
    when 'ZONE_APPROACH:pl' then '{kto}, rej. {rej}, przyjazd {eta}'
    when 'ZONE_APPROACH:en' then '{kto}, reg. {rej}, arrival {eta}'
    when 'ZONE_APPROACH:sv' then '{kto}, reg. {rej}, ankomst {eta}'
    when 'ZONE_ENTER:pl' then 'Auto {rej} z {wysylka} wjechalo na {miejsce}'
    when 'ZONE_ENTER:en' then 'Truck {rej} from {wysylka} entered {miejsce}'
    when 'ZONE_ENTER:sv' then 'Lastbil {rej} fran {wysylka} korde in pa {miejsce}'
    when 'ROAD_RISK:pl' then 'Watch Tower: warunki drogowe {droga}: {opis}.'
    when 'ROAD_RISK:en' then 'Watch Tower: warunki drogowe {droga}: {opis}.'
    when 'ROAD_RISK:sv' then 'Watch Tower: warunki drogowe {droga}: {opis}.'
  end;
  if t is null then raise exception 'Nieznany szablon SMS: % / %', p_kind, p_locale; end if;
  if p ? 'okno' then
    p := p || case p->>'okno' when 'LOAD' then '{"okno_pl":"zaladunku","okno_en":"loading","okno_sv":"lastningsfonster"}'::jsonb
                              else '{"okno_pl":"rozladunku","okno_en":"unloading","okno_sv":"lossningsfonster"}'::jsonb end;
  end if;
  for k in select jsonb_object_keys(p) loop
    t := replace(t, '{' || k || '}', coalesce(left(p->>k, 120), ''));
  end loop;
  if t ~ '\{[a-z0-9_]+\}' then raise exception 'Szablon SMS % bez wartości: %', p_kind, substring(t from '\{[a-z0-9_]+\}'); end if;
  t := sms_strip_pl(t);
  if char_length(t) > 160 then t := left(t, 160); end if;
  return t;
end $$;

comment on function public.sms_render(text, text, jsonb) is
  'PL-DATA: ROAD_RISK po polsku niezależnie od języka konta. Reszta szablonów bez zmian.';

create table if not exists public.translation_memory (
  text_hash text primary key,
  source_lang text not null check (source_lang in ('SV', 'EN')),
  source_text text not null,
  pl_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.deepl_usage (
  month date primary key,
  characters integer not null default 0 check (characters >= 0),
  monthly_limit integer not null default 1000000 check (monthly_limit > 0)
);

create table if not exists public.translation_queue (
  id bigint generated always as identity primary key,
  source_hash text not null unique,
  source_lang text not null check (source_lang in ('SV', 'EN')),
  source_text text not null,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.translation_memory enable row level security;
alter table public.deepl_usage enable row level security;
alter table public.translation_queue enable row level security;
revoke all on public.translation_memory from public, anon, authenticated;
revoke all on public.deepl_usage from public, anon, authenticated;
revoke all on public.translation_queue from public, anon, authenticated;
grant select, insert, update on public.translation_memory to service_role;
grant select, insert, update on public.deepl_usage to service_role;
grant select, insert, update on public.translation_queue to service_role;
grant usage, select on sequence public.translation_queue_id_seq to service_role;

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
  v_level := case
    when v_used >= v_limit then 'full'
    when v_used >= (v_limit * 0.8) then 'warn'
    else 'ok'
  end;
  return jsonb_build_object(
    'characters', v_used,
    'monthly_limit', v_limit,
    'queued', v_q,
    'level', v_level
  );
end $$;

revoke all on function public.deepl_usage_view() from public, anon;
grant execute on function public.deepl_usage_view() to authenticated;

comment on table public.translation_memory is
  'PL-DATA: pamięć tłumaczeń publicznych komunikatów drogowych. Ten sam tekst nie idzie do DeepL drugi raz.';
comment on table public.deepl_usage is
  'PL-DATA: znaki DeepL API Free w miesiącu (limit 1 000 000). Ostrzeżenie przy 80%.';
