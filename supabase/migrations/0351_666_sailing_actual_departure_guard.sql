-- #666 F7: guard_load_update — rejs z actual_departure_at uznany za wypłynięty
-- (nie tylko planowa/opóźniona godzina). SCX / HHL_OPS nie przypiszą takiego rejsu.
-- Patch jak 0293 (bez pełnego przepisywania funkcji).

do $patch$
declare
  def text := pg_get_functiondef('public.guard_load_update()'::regprocedure);
  old_sel text := $o$select s.status::text, coalesce(s.delayed_departure_at, s.departure_at)
          into v_sail_st, v_dep
          from public.sailings s where s.id = old.sailing_id;$o$;
  new_sel_old text := $n$select s.status::text,
                 coalesce(s.actual_departure_at, s.delayed_departure_at, s.departure_at)
          into v_sail_st, v_dep
          from public.sailings s where s.id = old.sailing_id;$n$;
  old_sel_new text := $o$select s.status::text, coalesce(s.delayed_departure_at, s.departure_at)
        into v_sail_st, v_dep
        from public.sailings s where s.id = new.sailing_id;$o$;
  new_sel_new text := $n$select s.status::text,
               coalesce(s.actual_departure_at, s.delayed_departure_at, s.departure_at)
        into v_sail_st, v_dep
        from public.sailings s where s.id = new.sailing_id;$n$;
begin
  if def like '%coalesce(s.actual_departure_at, s.delayed_departure_at, s.departure_at)%' then
    raise notice '0351: guard_load_update juz uwzglednia actual_departure_at';
    return;
  end if;
  if position(old_sel in def) = 0 or position(old_sel_new in def) = 0 then
    raise exception '0351: nie znaleziono selectow sailing_id w guard_load_update';
  end if;
  def := replace(def, old_sel, new_sel_old);
  def := replace(def, old_sel_new, new_sel_new);
  execute def;
end;
$patch$;

comment on function public.guard_load_update() is
  'Strażnik UPDATE loads. #666/0351: wypłynięcie także po actual_departure_at (nie tylko plan/opóźnienie).';
