-- 0037 — W3 (ŚREDNIA): wiadomości i pozycje harmonogramu widoczne wg transportu/projektu, nie wg rodzaju firmy.
-- Dziś bez skutków (1 klient, 1 przewoźnik) — przy drugim przewoźniku byłby wyciek. Idempotentna.
-- load_messages: dodatkowo transport musi być widoczny (loads RLS), jak positions/load_events.
drop policy if exists msgs_read on public.load_messages;
create policy msgs_read on public.load_messages for select to authenticated using (
  public.is_hhl()
  or (public.current_org_kind() = any (load_messages.visible_to)
      and exists (select 1 from public.loads l where l.id = load_messages.load_id))
);
-- shipment_items: klient — pozycje projektów, których jest klientem; przewoźnik — tylko pozycje na swoich
-- (widocznych) transportach; pozycje bez transportu widzi HHL i klient projektu.
drop policy if exists items_read on public.shipment_items;
create policy items_read on public.shipment_items for select to authenticated using (
  public.is_hhl()
  or (public.current_org_kind() = 'CLIENT'
      and exists (select 1 from public.projects p where p.id = shipment_items.project_id
                   and p.client_org_id = public.current_org_id()))
  or (public.current_org_kind() = 'CARRIER'
      and shipment_items.load_id is not null
      and exists (select 1 from public.loads l where l.id = shipment_items.load_id
                   and l.carrier_org_id = public.current_org_id()))
);
