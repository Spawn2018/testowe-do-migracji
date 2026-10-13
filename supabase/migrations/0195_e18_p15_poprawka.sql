-- 0195 — P2-poprawki (D-20261013-1400-01 Q2): 13 otwartych ROAD_SE.
-- Fałszywy „Zakaz ruchu ciężarówek” był robotami drogowymi. Tytuły stałe z roadSeRepairTitle
-- (plSeLocation + formatListDateTime, rok odniesienia 2026). resolved_at, severity i title_key bez zmian.
-- Więcej niż 13 spraw w zakresie = wyjątek. Brak wiersza (baza testowa albo sprawa zamknięta) = 0 dla tego id.

create or replace function public.e18_p15_poprawka() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_scope int;
  n int;
begin
  select count(*) into v_scope
    from risk_signals r
   where r.resolved_at is null
     and r.kind = 'ROAD_SE'
     and r.title like 'Zakaz ruchu ciężarówek w Szwecji%'
     and exists (
       select 1 from audit_log a
        where a.action = 'E18_P15_KOPIA'
          and a.entity = 'risk_signals'
          and a.entity_id = r.id::text
     );
  if v_scope > 13 then
    raise exception 'E18 P15 poprawka: za szerokie dopasowanie (% spraw)', v_scope;
  end if;

  update risk_signals r
     set title = v.new_title
    from (values
    ('0f692878-7193-40f1-88c7-1bd395e8bd7b'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: od Trafikplats Piteå S do Trafikplats Bergsviken i riktning mot Sundsvall w regionie Norrbottens (BD)', 'Warunki drogowe E4: roboty drogowe, od węzła Piteå S do węzła Bergsviken, w kierunku Sundsvall, region Norrbotten, od 18.08, 06:51 do 31.12, 16:00'),
    ('11178710-936a-4467-8094-aed82675c164'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: vid Söderköpings kommun  w regionie Östergötlands (E)', 'Warunki drogowe E4: roboty drogowe, gmina Söderköping, region Östergötland, od 08.09, 07:14 do 31.12.2028, 16:00'),
    ('2025b772-fd9b-4982-9943-712a8cb17756'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: od Dockstabaren do Skule oba kierunki w regionie Västernorrlands (Y)', 'Warunki drogowe E4: roboty drogowe, od Dockstabaren do Skule, oba kierunki, region Västernorrland, od 22.09, 07:00 do 15.11, 16:00'),
    ('5429c408-a801-4475-a62d-e233743c15c2'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: od Trafikplats Stöcksjö do Söderslättsrondellen oba kierunki w regionie Västerbottens (AC)', 'Warunki drogowe E4: roboty drogowe, od węzła Stöcksjö do Söderslättsrondellen, oba kierunki, region Västerbotten, od 04.10, 18:00 do 31.12, 16:00'),
    ('56900281-409c-4410-8121-7a4d1edee0b1'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: E 4 vid Trafikplats Torsboda II (236), i riktning mot Härnösand.', 'Warunki drogowe E4: roboty drogowe, przy węźle Torsboda II (236), w kierunku Härnösand, od 10.08, 19:00 do 30.11, 16:00'),
    ('6dbc5cc9-2d64-4d20-9471-7cf822a4576b'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: od Trafikplats Levar do Håknäs oba kierunki w regionie Västerbottens (AC)', 'Warunki drogowe E4: roboty drogowe, od węzła Levar do Håknäs, oba kierunki, region Västerbotten, od 07.06, 18:00 do 31.12.2027, 16:00'),
    ('6dbe6576-bf5a-48b0-8393-ff499dbedb03'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: od Nydalarondellen do Gimonäsrondellen oba kierunki w regionie Västerbottens (AC)', 'Warunki drogowe E4: roboty drogowe, od Nydalarondellen do Gimonäsrondellen, oba kierunki, region Västerbotten, od 22.09, 07:59 do 30.11, 16:00'),
    ('794e5723-71e1-4a1d-b7d6-2f2eace62069'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: E22 od Trafikplats Karlshamn Ö (53) do Trafikplats Karlshamn V (51) oba kierunki w regionie Blekinge (K)', 'Warunki drogowe E22: roboty drogowe, od węzła Karlshamn Ö (53) do węzła Karlshamn V (51), oba kierunki, region Blekinge, od 09.06, 06:00 do 01.11, 16:00'),
    ('956266ad-13b0-4a0d-b5b0-884b64e40540'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: od Örnsköldsvik Lasarettsgatan do Örnsköldsviks brandstn oba kierunki w regionie Västernorrlands (Y)', 'Warunki drogowe E4: roboty drogowe, od Örnsköldsvik Lasarettsgatan do Örnsköldsviks brandstn, oba kierunki, region Västernorrland, od 20.09, 18:00 do 31.01.2027, 06:00'),
    ('a5283700-b2aa-4527-9443-4a90c31f988d'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: od Backen do Gärde oba kierunki w regionie Gävleborgs (X)', 'Warunki drogowe E4: roboty drogowe, od Backen do Gärde, oba kierunki, region Gävleborg, od 22.04, 06:57 do 01.12, 16:00'),
    ('a6f75610-59a5-4fce-bd08-50ff71fb83bd'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: od Hörnefors do Stöcksjö oba kierunki w regionie Västerbottens (AC)', 'Warunki drogowe E4: roboty drogowe, od Hörnefors do Stöcksjö, oba kierunki, region Västerbotten, od 05.05, 05:41 do 15.10, 16:00'),
    ('c51aac20-f2c3-4eb9-8a31-b3ab54ff123d'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: E 4 mellan Vattrång och Harmånger, i båda riktningar.', 'Warunki drogowe E4: roboty drogowe, między Vattrång a Harmånger, oba kierunki, od 22.04, 06:55 do 01.12, 16:00'),
    ('eb51a481-ba12-4c38-a10c-cbde4b6c3234'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: od Länsgr. Västerbottens/Norrbottens län vid Kinnbäck do Trafikplats Björkhammar oba kierunki w regionie Västerbottens (AC)', 'Warunki drogowe E4: roboty drogowe, od granicy regionów Västerbotten/Norrbotten przy Kinnbäck do węzła Björkhammar, oba kierunki, region Västerbotten, od 03.08, 00:00 do 31.12, 16:00')
    ) as v(id, old_title, new_title)
   where r.id = v.id
     and r.title = v.old_title
     and r.resolved_at is null
     and r.kind = 'ROAD_SE';
  get diagnostics n = row_count;

  insert into audit_log (action, entity, entity_id, old_value, new_value, source)
  select 'E18_P15_POPRAWKA', 'risk_signals', v.id::text,
         jsonb_build_object('title', v.old_title),
         jsonb_build_object('title', v.new_title),
         'e18-p15-poprawka'
    from (values
    ('0f692878-7193-40f1-88c7-1bd395e8bd7b'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: od Trafikplats Piteå S do Trafikplats Bergsviken i riktning mot Sundsvall w regionie Norrbottens (BD)', 'Warunki drogowe E4: roboty drogowe, od węzła Piteå S do węzła Bergsviken, w kierunku Sundsvall, region Norrbotten, od 18.08, 06:51 do 31.12, 16:00'),
    ('11178710-936a-4467-8094-aed82675c164'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: vid Söderköpings kommun  w regionie Östergötlands (E)', 'Warunki drogowe E4: roboty drogowe, gmina Söderköping, region Östergötland, od 08.09, 07:14 do 31.12.2028, 16:00'),
    ('2025b772-fd9b-4982-9943-712a8cb17756'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: od Dockstabaren do Skule oba kierunki w regionie Västernorrlands (Y)', 'Warunki drogowe E4: roboty drogowe, od Dockstabaren do Skule, oba kierunki, region Västernorrland, od 22.09, 07:00 do 15.11, 16:00'),
    ('5429c408-a801-4475-a62d-e233743c15c2'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: od Trafikplats Stöcksjö do Söderslättsrondellen oba kierunki w regionie Västerbottens (AC)', 'Warunki drogowe E4: roboty drogowe, od węzła Stöcksjö do Söderslättsrondellen, oba kierunki, region Västerbotten, od 04.10, 18:00 do 31.12, 16:00'),
    ('56900281-409c-4410-8121-7a4d1edee0b1'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: E 4 vid Trafikplats Torsboda II (236), i riktning mot Härnösand.', 'Warunki drogowe E4: roboty drogowe, przy węźle Torsboda II (236), w kierunku Härnösand, od 10.08, 19:00 do 30.11, 16:00'),
    ('6dbc5cc9-2d64-4d20-9471-7cf822a4576b'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: od Trafikplats Levar do Håknäs oba kierunki w regionie Västerbottens (AC)', 'Warunki drogowe E4: roboty drogowe, od węzła Levar do Håknäs, oba kierunki, region Västerbotten, od 07.06, 18:00 do 31.12.2027, 16:00'),
    ('6dbe6576-bf5a-48b0-8393-ff499dbedb03'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: od Nydalarondellen do Gimonäsrondellen oba kierunki w regionie Västerbottens (AC)', 'Warunki drogowe E4: roboty drogowe, od Nydalarondellen do Gimonäsrondellen, oba kierunki, region Västerbotten, od 22.09, 07:59 do 30.11, 16:00'),
    ('794e5723-71e1-4a1d-b7d6-2f2eace62069'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: E22 od Trafikplats Karlshamn Ö (53) do Trafikplats Karlshamn V (51) oba kierunki w regionie Blekinge (K)', 'Warunki drogowe E22: roboty drogowe, od węzła Karlshamn Ö (53) do węzła Karlshamn V (51), oba kierunki, region Blekinge, od 09.06, 06:00 do 01.11, 16:00'),
    ('956266ad-13b0-4a0d-b5b0-884b64e40540'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: od Örnsköldsvik Lasarettsgatan do Örnsköldsviks brandstn oba kierunki w regionie Västernorrlands (Y)', 'Warunki drogowe E4: roboty drogowe, od Örnsköldsvik Lasarettsgatan do Örnsköldsviks brandstn, oba kierunki, region Västernorrland, od 20.09, 18:00 do 31.01.2027, 06:00'),
    ('a5283700-b2aa-4527-9443-4a90c31f988d'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: od Backen do Gärde oba kierunki w regionie Gävleborgs (X)', 'Warunki drogowe E4: roboty drogowe, od Backen do Gärde, oba kierunki, region Gävleborg, od 22.04, 06:57 do 01.12, 16:00'),
    ('a6f75610-59a5-4fce-bd08-50ff71fb83bd'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: od Hörnefors do Stöcksjö oba kierunki w regionie Västerbottens (AC)', 'Warunki drogowe E4: roboty drogowe, od Hörnefors do Stöcksjö, oba kierunki, region Västerbotten, od 05.05, 05:41 do 15.10, 16:00'),
    ('c51aac20-f2c3-4eb9-8a31-b3ab54ff123d'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: E 4 mellan Vattrång och Harmånger, i båda riktningar.', 'Warunki drogowe E4: roboty drogowe, między Vattrång a Harmånger, oba kierunki, od 22.04, 06:55 do 01.12, 16:00'),
    ('eb51a481-ba12-4c38-a10c-cbde4b6c3234'::uuid, 'Zakaz ruchu ciężarówek w Szwecji: E4: od Länsgr. Västerbottens/Norrbottens län vid Kinnbäck do Trafikplats Björkhammar oba kierunki w regionie Västerbottens (AC)', 'Warunki drogowe E4: roboty drogowe, od granicy regionów Västerbotten/Norrbotten przy Kinnbäck do węzła Björkhammar, oba kierunki, region Västerbotten, od 03.08, 00:00 do 31.12, 16:00')
    ) as v(id, old_title, new_title)
    join risk_signals r on r.id = v.id and r.title = v.new_title
   where not exists (
     select 1 from audit_log a
      where a.action = 'E18_P15_POPRAWKA'
        and a.entity = 'risk_signals'
        and a.entity_id = v.id::text
        and a.new_value->>'title' = v.new_title
   );

  if n > 13 then
    raise exception 'E18 P15 poprawka: zmieniono % wierszy', n;
  end if;
  return n;
end $$;
revoke all on function public.e18_p15_poprawka() from public, anon, authenticated;

select public.e18_p15_poprawka();
