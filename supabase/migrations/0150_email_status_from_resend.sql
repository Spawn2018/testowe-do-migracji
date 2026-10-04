-- =====================================================================
-- TOWER — Migracja 0150: L-13 — „nie wyszło" obejmuje odrzucenie Resend
--
-- Status SENT powstaje tylko, gdy odpowiedź Resend ma status wysłania
-- (funkcja send-notifications). HTTP 200 i samo id nie wystarcza.
-- Stan systemu liczy SUPPRESSED i ERROR: ile nie wyszło i do kogo.
-- Limit 80/85/90 bez zmian (nadal PENDING + SENT). Nic nie wysyła.
-- =====================================================================

create or replace function public.email_budget_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_who jsonb;
  v_held int;
begin
  if (is_hhl()) is not true then
    return null;
  end if;
  select * into r from l13_email_counts(now());
  select coalesce(jsonb_agg(jsonb_build_object('recipient', recipient, 'n', n) order by recipient), '[]'::jsonb),
         coalesce(sum(n), 0)::int
    into v_who, v_held
    from (
      select recipient, count(*)::int as n
        from notifications
       where channel = 'EMAIL'
         and status in ('SUPPRESSED', 'ERROR')
         and (created_at at time zone 'Europe/Warsaw')::date = r.day
       group by recipient
    ) s;
  return jsonb_build_object(
    'day', r.day,
    'immediate_n', r.immediate_n,
    'digest_n', r.digest_n,
    'suppressed_n', coalesce(v_held, 0),
    'suppressed_to', coalesce(v_who, '[]'::jsonb),
    'level', r.level,
    'resend_limit', 100,
    'operational_limit', 90,
    'auth_reserve', 10,
    'warn_at', 80,
    'critical_only_at', 85,
    'automatic_decision_email', public.l13_automatic_decision_email()
  );
end $$;
comment on function public.email_budget_status() is
  'Stan poczty. SUPPRESSED i ERROR: ile e-maili nie wyszło i do kogo. Nie wysyła.';
revoke all on function public.email_budget_status() from public, anon;
grant execute on function public.email_budget_status() to authenticated;
