-- DP-172 (#742): DeepL dla sytuacji drogowych LT/LV/EE/FI — źródła jak SV/EN.
-- Decyzja właściciela 89: ten sam mechanizm pamięci + kolejka + licznik.

alter table public.translation_memory
  drop constraint if exists translation_memory_source_lang_check;
alter table public.translation_memory
  add constraint translation_memory_source_lang_check
  check (source_lang in ('SV', 'EN', 'LT', 'LV', 'ET', 'FI'));

alter table public.translation_queue
  drop constraint if exists translation_queue_source_lang_check;
alter table public.translation_queue
  add constraint translation_queue_source_lang_check
  check (source_lang in ('SV', 'EN', 'LT', 'LV', 'ET', 'FI'));

comment on table public.translation_memory is
  'PL-DATA / DP-172: pamięć tłumaczeń komunikatów drogowych (SV/EN/LT/LV/ET/FI → PL).';
comment on table public.translation_queue is
  'PL-DATA / DP-172: kolejka ponowień DeepL (SV/EN/LT/LV/ET/FI).';
