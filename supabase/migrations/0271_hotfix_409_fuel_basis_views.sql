-- 0271 — #409 / D-20261021-2030-01: fuel_basis w v_load_price_carrier / v_load_price_client.
-- Komentarz do #409 (21.10): zamiast osobnej fuel_publications — te same pubs/avg/n
-- z load_cost.fuel_basis / load_revenue.fuel_basis, z regułami widoczności widoków.
-- F7 (#458): SCX/KSH dostają tylko dozwolone klucze (bez owner_note / owner_override /
-- params_version / params_valid_from i innych wewnętrznych HHL).
-- Funkcja fuel_publications z pierwszej wersji zgłoszenia nie jest potrzebna.

drop view if exists v_load_price_carrier;
drop view if exists v_load_price_client;

-- Publiczna część fuel_basis dla SCX/KSH (allowlista — nowe klucze HHL same nie wyciekają).
create or replace function public.fuel_basis_public(p jsonb)
returns jsonb
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select case
    when p is null then null
    else jsonb_strip_nulls(jsonb_build_object(
      'status', p->'status',
      'cycle', p->'cycle',
      'final', p->'final',
      'prognoza', p->'prognoza',
      'avg_sek', p->'avg_sek',
      'avg_pln', p->'avg_pln',
      'n_sek', p->'n_sek',
      'n_pln', p->'n_pln',
      'pubs_sek', p->'pubs_sek',
      'pubs_pln', p->'pubs_pln',
      'days_sek', p->'days_sek',
      'load_week_start', p->'load_week_start',
      'load_week_end', p->'load_week_end',
      'prev_week_start', p->'prev_week_start',
      'prev_week_end', p->'prev_week_end',
      'applied_mult', p->'applied_mult'
    ))
  end;
$$;

revoke all on function public.fuel_basis_public(jsonb) from public, anon;
grant execute on function public.fuel_basis_public(jsonb) to authenticated;

create view v_load_price_carrier with (security_invoker = true, security_barrier = true) as
select l.id as load_id, l.project_id,
       c.currency, c.pricing_tier,
       c.base_amount, c.baf_pct, c.baf_amount, c.extras, c.extras_amount, c.total_amount,
       c.computed_total_eur, c.invoiced_total_eur,
       money_effective_eur(c.invoiced_total_eur, c.computed_total_eur, c.total_amount) as effective_total_eur,
       c.fuel_ref_date, c.fuel_mult_sek, c.fuel_mult_pln, c.fuel_applied_mult,
       c.fx_table_no, c.fx_effective_date, c.fx_rate_pln, c.fx_provisional,
       c.fuel_status,
       case when is_hhl() then c.fuel_basis
            else fuel_basis_public(c.fuel_basis)
       end as fuel_basis
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
       r.fuel_status,
       case when is_hhl() then r.fuel_basis
            else fuel_basis_public(r.fuel_basis)
       end as fuel_basis
from loads l join load_revenue r on r.load_id = l.id
join projects p on p.id = l.project_id
where is_hhl()
   or (current_org_kind() = 'CLIENT' and p.client_org_id = current_org_id());

revoke all on v_load_price_carrier, v_load_price_client from public, anon;
grant select on v_load_price_carrier, v_load_price_client to authenticated;
revoke insert, update, delete on v_load_price_carrier, v_load_price_client from authenticated;

comment on function public.fuel_basis_public(jsonb) is
  '#409 F7: allowlista kluczy fuel_basis dla SCX/KSH (bez notatek właściciela i parametrów wewnętrznych).';
comment on view v_load_price_carrier is
  'E39/#409: koszt przewoźnika + fuel_basis (avg/n/pubs; SCX bez kluczy HHL) dla HHL i SCX własnego transportu.';
comment on view v_load_price_client is
  'E39/#409: przychód klienta + fuel_basis (avg/n/pubs; KSH bez kluczy HHL) dla HHL i KSH własnego projektu.';
