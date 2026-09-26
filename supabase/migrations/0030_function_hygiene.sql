-- 0030 — ANEKS 5 3.2d: higiena funkcji i uprawnień. Idempotentne, niedestrukcyjne (tylko ALTER/REVOKE).
-- 1. Każda funkcja schematu public (poza należącymi do rozszerzeń) ma ustaloną ścieżkę wyszukiwania.
--    `public, extensions` — na produkcji pgcrypto/http są w `extensions`, PostGIS w `public`.
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind in ('f', 'p')
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('alter function %s set search_path = public, extensions', f);
  end loop;
end $$;

-- 2. Pomocnicze funkcje RLS nie dla anon (anon nie ma konta — nic mu nie zwracają). is_hhl / can_see_margin
--    wołają current_app_role (security invoker) — bez tego odebrania dawałyby anon błąd zamiast wyniku,
--    więc odbierane razem.
revoke execute on function public.current_app_role()    from anon;
revoke execute on function public.current_app_user_id() from anon;
revoke execute on function public.current_org_id()      from anon;
revoke execute on function public.current_org_kind()    from anon;
revoke execute on function public.is_hhl()              from anon;
revoke execute on function public.can_see_margin()      from anon;

-- 3. loaded_confirmed(uuid) — używana wyłącznie wewnętrznie (apply_geofence_status, security definer);
--    brak użycia w politykach, widokach i aplikacji → zalogowany nie odpyta o dowolny transport.
revoke execute on function public.loaded_confirmed(uuid) from authenticated, anon, public;

-- 4. spatial_ref_sys (PostGIS) — ŚWIADOMIE BEZ ZMIAN: na produkcji tabelę i uprawnienia ma supabase_admin
--    (REVOKE z roli postgres nie działa), a PostGIS czyta ją z uprawnieniami wywołującego przy przeliczeniach
--    układów (geography → ST_Buffer/ST_Transform w make_circle_fence, pozycje) — odebranie odczytu
--    authenticated groziłoby błędami geofencingu. Zawartość: publiczne definicje EPSG, bez danych firmy.
