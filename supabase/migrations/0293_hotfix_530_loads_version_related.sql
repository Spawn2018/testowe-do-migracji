-- #530 / F7 #529 — loadsVersion: podbicie loads.updated_at przy zmianie
-- tabel powiązanych widocznych w panelu (priorytet: piloci, rejs).
-- Po 0292 (#528). Numer 0293.
-- ETA (eta_*) i stan RIO bez zmian — bump tylko z child tabel, nie z refresh_load_eta.
-- RODO (tower.audit_source='rodo'): bez bumpa (jak #492).
-- F7 #532: tower.bump_ctx — strażnik przepuszcza wyłącznie updated_at
-- (SCX operator_notice na wspólnym rejsie); sailings nie podbija CANCELLED.

create or replace function public.bump_load_updated_at(p_load uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_load is null then
    return;
  end if;
  if nullif(btrim(current_setting('tower.audit_source', true)), '') = 'rodo' then
    return;
  end if;
  perform set_config('tower.bump_ctx', 'on', true);
  begin
    update public.loads
       set updated_at = now()
     where id = p_load;
  exception when others then
    perform set_config('tower.bump_ctx', '', true);
    raise;
  end;
  perform set_config('tower.bump_ctx', '', true);
end;
$$;

comment on function public.bump_load_updated_at(uuid) is
  '#530: podbicie loads.updated_at (loadsVersion); bump_ctx; bez bumpa przy audit_source=rodo.';

revoke all on function public.bump_load_updated_at(uuid)
  from public, anon, authenticated;

-- ── piloci (load_escorts) ───────────────────────────────────────────────────
create or replace function public.trg_load_escorts_bump_load()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.bump_load_updated_at(coalesce(new.load_id, old.load_id));
  return coalesce(new, old);
end;
$$;

comment on function public.trg_load_escorts_bump_load() is
  '#530: INSERT/UPDATE/DELETE load_escorts → bump loads.updated_at (bump_ctx).';

drop trigger if exists trg_load_escorts_bump_load on public.load_escorts;
create trigger trg_load_escorts_bump_load
  after insert or update or delete on public.load_escorts
  for each row
  execute function public.trg_load_escorts_bump_load();

revoke all on function public.trg_load_escorts_bump_load()
  from public, anon, authenticated;

-- ── rejs (sailings — opóźnienie i stan promu) ───────────────────────────────
create or replace function public.trg_sailings_bump_loads()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(btrim(current_setting('tower.audit_source', true)), '') = 'rodo' then
    return new;
  end if;
  if tg_op = 'UPDATE' and not (
       new.status is distinct from old.status
    or new.departure_at is distinct from old.departure_at
    or new.arrival_at is distinct from old.arrival_at
    or new.delayed_departure_at is distinct from old.delayed_departure_at
    or new.delayed_arrival_at is distinct from old.delayed_arrival_at
    or new.actual_departure_at is distinct from old.actual_departure_at
    or new.actual_arrival_at is distinct from old.actual_arrival_at
    or new.vessel_id is distinct from old.vessel_id
  ) then
    return new;
  end if;
  perform set_config('tower.bump_ctx', 'on', true);
  begin
    update public.loads
       set updated_at = now()
     where sailing_id = new.id
       and status is distinct from 'CANCELLED';
  exception when others then
    perform set_config('tower.bump_ctx', '', true);
    raise;
  end;
  perform set_config('tower.bump_ctx', '', true);
  return new;
end;
$$;

comment on function public.trg_sailings_bump_loads() is
  '#530: zmiana statusu/opóźnienia/actual/vessel na sailings → bump loads.updated_at (bez CANCELLED; bump_ctx).';

drop trigger if exists trg_sailings_bump_loads on public.sailings;
create trigger trg_sailings_bump_loads
  after update of status, departure_at, arrival_at,
    delayed_departure_at, delayed_arrival_at,
    actual_departure_at, actual_arrival_at, vessel_id
  on public.sailings
  for each row
  execute function public.trg_sailings_bump_loads();

revoke all on function public.trg_sailings_bump_loads()
  from public, anon, authenticated;

-- ── guard: bump_ctx = tylko updated_at (jak eta_ctx) ─────────────────────────
do $patch$
declare
  def text := pg_get_functiondef('public.guard_load_update()'::regprocedure);
  needle text := $n$begin
  if current_setting('tower.eta_ctx', true) = 'on' then$n$;
  insert_block text := $i$begin
  /* #530 F7: podbicie updated_at z child (sailings/escorts) — wyłącznie updated_at. */
  if current_setting('tower.bump_ctx', true) = 'on' then
    select coalesce(array_agg(n.key), '{}') into v_changed
      from jsonb_each(to_jsonb(new)) n
     where n.value is distinct from (to_jsonb(old) -> n.key);
    if (v_changed <@ array['updated_at']::text[]) is not true then
      raise exception 'Podbicie wersji może zmienić wyłącznie updated_at (zmienione: %)',
        array_to_string(v_changed, ', ');
    end if;
    return new;
  end if;

  if current_setting('tower.eta_ctx', true) = 'on' then$i$;
begin
  if def like '%tower.bump_ctx%' then
    raise notice '0293: guard_load_update już ma bump_ctx';
    return;
  end if;
  if position(needle in def) = 0 then
    raise exception '0293: nie znaleziono miejsca na bump_ctx w guard_load_update';
  end if;
  execute replace(def, needle, insert_block);
end;
$patch$;
