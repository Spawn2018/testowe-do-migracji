-- AUD-01d (decyzja właściciela 06.10 16:28): kafelki HERE idą wprost z przeglądarki (klucz przeglądarkowy
-- ograniczony do domeny), więc licznik D-78 zasila przeglądarka — zbiorczo, co ≤ 60 s i przy pagehide.
-- RPC tylko dla zalogowanego, aktywnego konta; najwyżej 5000 kafelków na wywołanie i 20000 na konto na minutę
-- (zwykła mapa: 20–60 kafelków na widok). Zwraca stan budżetu (tiles_open = wydatek < 80% budżetu D-78),
-- żeby klient nie odpytywał budżetu częściej niż raz na minutę.

create table if not exists public.here_tile_reports (
  app_user_id uuid primary key,
  window_start timestamptz not null default now(),
  n integer not null default 0 check (n >= 0)
);
alter table public.here_tile_reports enable row level security;
revoke all on table public.here_tile_reports from public, anon, authenticated;
comment on table public.here_tile_reports is
  'AUD-01d: okno minutowe zgłoszeń kafelków HERE z przeglądarki (limit nadużyć licznika D-78). Dostęp tylko przez here_tiles_report.';

create or replace function public.here_tiles_report(p_n integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := public.current_app_user_id();
  v_n integer;
begin
  if v_user is null then
    raise exception 'Brak aktywnego konta' using errcode = '42501';
  end if;
  if (p_n is not null and p_n between 0 and 5000) is not true then
    raise exception 'Zła liczba kafelków' using errcode = '22023';
  end if;
  if p_n > 0 then
    insert into here_tile_reports as r (app_user_id, window_start, n)
    values (v_user, now(), p_n)
    on conflict (app_user_id) do update
      set window_start = case when r.window_start < now() - interval '60 seconds' then now() else r.window_start end,
          n = case when r.window_start < now() - interval '60 seconds' then excluded.n else r.n + excluded.n end
    returning n into v_n;
    if v_n > 20000 then
      raise exception 'Za dużo zgłoszeń kafelków' using errcode = '54000';
    end if;
    perform public.here_note_service('tiles', p_n, 0, now());
  end if;
  return jsonb_build_object('tiles_open', public.here_tiles_open(now()));
end $$;
revoke all on function public.here_tiles_report(integer) from public, anon;
grant execute on function public.here_tiles_report(integer) to authenticated;
comment on function public.here_tiles_report(integer) is
  'AUD-01d: przeglądarka zgłasza zbiorczo pobrane kafelki HERE (licznik D-78, here_usage.tiles); zwraca tiles_open.';
