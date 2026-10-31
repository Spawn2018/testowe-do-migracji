-- #685-a / decyzja 74 (F7 #688 r1 B4): identyfikator źródła Portnet na rejsie.
-- Bez zmian RLS. DDL — assert_not_preview nie dotyczy.
-- Prefiks: digitraffic:portcall:<portCallId>:<route> (jeden portCall → ETA + ETD).
-- #685-b: import z pliku zastępuje wiersze z source_ref like 'digitraffic:%' (RECZNIE nietykalne).

alter table public.sailings
  add column if not exists source_ref text;

comment on column public.sailings.source_ref is
  'Identyfikator źródła zewnętrznego (np. digitraffic:portcall:<id>:<route>). NULL = brak / HTML / ręczny.';

create unique index if not exists sailings_source_ref_uidx
  on public.sailings (source_ref)
  where source_ref is not null;
