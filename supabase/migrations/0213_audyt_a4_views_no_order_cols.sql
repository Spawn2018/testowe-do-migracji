-- TOWER — 0213: A4 (D-20261015-0300-01) — widoki finansowe bez kolumn numerów zleceń.
-- Po REVOKE SELECT (hhl_order_no, carrier_order_no, order_no) z authenticated (0209)
-- widoki security_invoker=true padały: permission denied for table loads.
-- Numery tylko przez load_order_numbers() (E41); aplikacja już tak łączy (supabaseProvider).

drop view if exists v_load_financials_hhl;
drop view if exists v_load_price_carrier;
drop view if exists v_load_price_client;

create view v_load_financials_hhl with (security_invoker = true, security_barrier = true) as
select
  l.id as load_id, l.project_id, l.status,
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

create view v_load_price_carrier with (security_invoker = true, security_barrier = true) as
select l.id as load_id, l.project_id,
       c.currency, c.pricing_tier,
       c.base_amount, c.baf_pct, c.baf_amount, c.extras, c.extras_amount, c.total_amount,
       c.computed_total_eur, c.invoiced_total_eur,
       money_effective_eur(c.invoiced_total_eur, c.computed_total_eur, c.total_amount) as effective_total_eur,
       c.fuel_ref_date, c.fuel_mult_sek, c.fuel_mult_pln, c.fuel_applied_mult,
       c.fx_table_no, c.fx_effective_date, c.fx_rate_pln, c.fx_provisional,
       c.fuel_status
from loads l join load_cost c on c.load_id = l.id
where is_hhl()
   or (current_org_kind() = 'CARRIER'
       and l.carrier_org_id = current_org_id()
       and current_app_role() in ('CARRIER_DISPATCH', 'CARRIER_USER'));

create view v_load_price_client with (security_invoker = true, security_barrier = true) as
select l.id as load_id, l.project_id,
       r.currency, r.pricing_tier,
       r.base_amount, r.baf_pct, r.baf_amount, r.extras, r.extras_amount, r.total_amount,
       r.computed_total_eur, r.invoiced_total_eur,
       money_effective_eur(r.invoiced_total_eur, r.computed_total_eur, r.total_amount) as effective_total_eur,
       r.fuel_ref_date, r.fuel_mult_sek, r.fuel_mult_pln, r.fuel_applied_mult,
       r.fx_table_no, r.fx_effective_date, r.fx_rate_pln, r.fx_provisional,
       r.fuel_status
from loads l join load_revenue r on r.load_id = l.id
join projects p on p.id = l.project_id
where is_hhl()
   or (current_org_kind() = 'CLIENT' and p.client_org_id = current_org_id());

revoke all on v_load_financials_hhl, v_load_price_carrier, v_load_price_client from public, anon;
grant select on v_load_financials_hhl, v_load_price_carrier, v_load_price_client to authenticated;
revoke insert, update, delete on v_load_financials_hhl, v_load_price_carrier, v_load_price_client from authenticated;
