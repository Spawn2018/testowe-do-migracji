-- =====================================================================
-- TOWER — Migracja 0010: dane v2 pieniędzy (M2)
--
-- Problem (G3): widoki v_load_* miały security_invoker = true, a tabele
-- load_cost / load_revenue są odebrane rolom API (0001: revoke — celowo,
-- „jedyna droga do danych finansowych to widoki"). Skutek: permission denied
-- dla wszystkich, także HHL.
--
-- Rozwiązanie: widoki wykonywane z prawami właściciela (security_invoker =
-- false) z JAWNYM filtrem wierszy w WHERE — ta sama reguła co polityki
-- cost_read / revenue_read (0001) — oraz security_barrier (filtr liczony
-- przed funkcjami użytkownika). Tabele bazowe zostają zamknięte.
--
-- Dane v2 (MECHANIZM_PIENIEDZY §4–§5): poziom wyceny, OBIE wartości
-- (wyliczona i fakturowana — Z1: faktura nie kasuje wyliczenia), migawka
-- mnożnika z datą, migawka kursu z numerem tabeli. EUR jest źródłem (Z3):
-- marża liczona w EUR z wartości efektywnej (faktura, jeśli jest).
--
-- IDEMPOTENTNA, niedestrukcyjna: drop/create wyłącznie widoków (bez danych).
-- =====================================================================

drop view if exists v_load_financials_hhl;
drop view if exists v_load_price_carrier;
drop view if exists v_load_price_client;

-- Wartość efektywna strony: faktura nadrzędna, inaczej wyliczenie mechanizmem;
-- dla starszych wierszy bez computed_total_eur — total_amount (base + baf + extras).
create or replace function money_effective_eur(p_invoiced numeric, p_computed numeric, p_total numeric)
returns numeric language sql immutable as $$
  select coalesce(p_invoiced, p_computed, p_total)
$$;

-- Poziom transportu = poziom mniej pewnej strony.
create or replace function money_least_tier(a text, b text) returns text
language sql immutable as $$
  select case
    when a is null then b when b is null then a
    when 'PROGNOZA' in (a, b) then 'PROGNOZA'
    when 'REALIZACJA' in (a, b) then 'REALIZACJA'
    else 'FAKTURA' end
$$;

-- 1. HHL (administrator) — obie strony i marża w EUR ----------------------
create view v_load_financials_hhl with (security_invoker = false, security_barrier = true) as
select
  l.id as load_id, l.project_id, l.order_no, l.hhl_order_no, l.carrier_order_no, l.status,
  money_least_tier(c.pricing_tier, r.pricing_tier) as pricing_tier,
  'EUR'::char(3) as currency,
  c.pricing_tier as cost_tier,
  c.computed_total_eur as cost_computed_eur,
  c.invoiced_total_eur as cost_invoiced_eur,
  money_effective_eur(c.invoiced_total_eur, c.computed_total_eur, c.total_amount) as cost_effective_eur,
  r.pricing_tier as rev_tier,
  r.computed_total_eur as rev_computed_eur,
  r.invoiced_total_eur as rev_invoiced_eur,
  money_effective_eur(r.invoiced_total_eur, r.computed_total_eur, r.total_amount) as rev_effective_eur,
  money_effective_eur(r.invoiced_total_eur, r.computed_total_eur, r.total_amount)
    - money_effective_eur(c.invoiced_total_eur, c.computed_total_eur, c.total_amount) as margin_eur,
  case when coalesce(money_effective_eur(r.invoiced_total_eur, r.computed_total_eur, r.total_amount), 0) = 0 then null
       else round((money_effective_eur(r.invoiced_total_eur, r.computed_total_eur, r.total_amount)
                   - money_effective_eur(c.invoiced_total_eur, c.computed_total_eur, c.total_amount))
                  / money_effective_eur(r.invoiced_total_eur, r.computed_total_eur, r.total_amount) * 100, 2) end as margin_pct,
  coalesce(c.fuel_ref_date, r.fuel_ref_date) as fuel_ref_date,
  c.fuel_applied_mult as cost_fuel_mult, r.fuel_applied_mult as rev_fuel_mult,
  c.fx_table_no as cost_fx_table_no, c.fx_effective_date as cost_fx_date, c.fx_rate_pln as cost_fx_mid, c.fx_provisional as cost_fx_provisional,
  r.fx_table_no as rev_fx_table_no,  r.fx_effective_date as rev_fx_date,  r.fx_rate_pln as rev_fx_mid,  r.fx_provisional as rev_fx_provisional
from loads l
left join load_cost    c on c.load_id = l.id
left join load_revenue r on r.load_id = l.id
where can_see_margin();

-- 2. Koszt — HHL i przewoźnik-właściciel (dyspozytor); KSH nigdy ------------
create view v_load_price_carrier with (security_invoker = false, security_barrier = true) as
select l.id as load_id, l.project_id, l.order_no, l.hhl_order_no, l.carrier_order_no,
       c.currency, c.pricing_tier,
       c.base_amount, c.baf_pct, c.baf_amount, c.extras, c.extras_amount, c.total_amount,
       c.computed_total_eur, c.invoiced_total_eur,
       money_effective_eur(c.invoiced_total_eur, c.computed_total_eur, c.total_amount) as effective_total_eur,
       c.fuel_ref_date, c.fuel_mult_sek, c.fuel_mult_pln, c.fuel_applied_mult,
       c.fx_table_no, c.fx_effective_date, c.fx_rate_pln, c.fx_provisional
from loads l join load_cost c on c.load_id = l.id
where is_hhl()
   or (current_org_kind() = 'CARRIER'
       and l.carrier_org_id = current_org_id()
       and current_app_role() = 'CARRIER_DISPATCH');

-- 3. Przychód — HHL i klient projektu; przewoźnik nigdy ----------------------
create view v_load_price_client with (security_invoker = false, security_barrier = true) as
select l.id as load_id, l.project_id, l.order_no, l.hhl_order_no, l.carrier_order_no,
       r.currency, r.pricing_tier,
       r.base_amount, r.baf_pct, r.baf_amount, r.extras, r.extras_amount, r.total_amount,
       r.computed_total_eur, r.invoiced_total_eur,
       money_effective_eur(r.invoiced_total_eur, r.computed_total_eur, r.total_amount) as effective_total_eur,
       r.fuel_ref_date, r.fuel_mult_sek, r.fuel_mult_pln, r.fuel_applied_mult,
       r.fx_table_no, r.fx_effective_date, r.fx_rate_pln, r.fx_provisional
from loads l join load_revenue r on r.load_id = l.id
join projects p on p.id = l.project_id
where is_hhl()
   or (current_org_kind() = 'CLIENT' and p.client_org_id = current_org_id());

revoke all on v_load_financials_hhl, v_load_price_carrier, v_load_price_client from anon;
grant select on v_load_financials_hhl, v_load_price_carrier, v_load_price_client to authenticated;

-- 4. Z1 w bazie: wyliczenie mechanizmem nie jest nadpisywane fakturą --------
-- Zmiana computed_total_eur, gdy invoiced_total_eur jest ustawione, jest odrzucana
-- (faktura nie „przepisuje" wyliczenia — obie wartości zostają).
create or replace function guard_money_z1() returns trigger
language plpgsql as $$
begin
  if old.invoiced_total_eur is not null
     and new.computed_total_eur is distinct from old.computed_total_eur then
    raise exception 'Z1: wyliczenie po zafakturowaniu jest niezmienne (faktura nie nadpisuje wyliczonej wartości)';
  end if;
  if new.invoiced_total_eur is not null and new.pricing_tier <> 'FAKTURA' then
    new.pricing_tier := 'FAKTURA';
  end if;
  return new;
end $$;

drop trigger if exists trg_load_cost_z1 on load_cost;
create trigger trg_load_cost_z1 before update on load_cost
  for each row execute function guard_money_z1();
drop trigger if exists trg_load_revenue_z1 on load_revenue;
create trigger trg_load_revenue_z1 before update on load_revenue
  for each row execute function guard_money_z1();
