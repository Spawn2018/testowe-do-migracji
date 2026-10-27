\pset pager off
\echo '=== FUNCTIONS with CANCELLED ==='
select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as fn,
       l.n || ': ' || btrim(l.line) as hit
  from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace and ns.nspname = 'public'
  cross join lateral (
    select ordinality as n, line from unnest(string_to_array(p.prosrc, E'\n')) with ordinality as t(line, ordinality)
  ) l
 where p.prokind = 'f' and p.prosrc ~* 'cancelled' and l.line ~* 'cancelled'
   and l.line !~* '^\s*(--|/\*)'
 order by 1, l.n;
\echo '=== VIEWS ==='
select schemaname || '.' || viewname, regexp_replace(definition, '\s+', ' ', 'g') from pg_views where schemaname in ('public') and definition ~* 'cancelled';
\echo '=== MATVIEWS ==='
select matviewname from pg_matviews where definition ~* 'cancelled';
\echo '=== POLICIES ==='
select tablename || '.' || policyname, regexp_replace(coalesce(qual,'') || ' / ' || coalesce(with_check,''), '\s+', ' ', 'g') from pg_policies where coalesce(qual,'') || coalesce(with_check,'') ~* 'cancelled';
\echo '=== INDEXES ==='
select indexname, indexdef from pg_indexes where schemaname = 'public' and indexdef ~* 'cancelled';
\echo '=== CHECKS ==='
select conrelid::regclass::text, conname, pg_get_constraintdef(oid) from pg_constraint where pg_get_constraintdef(oid) ~* 'cancelled';
\echo '=== TRIGGERS ==='
select tgrelid::regclass::text, tgname from pg_trigger where not tgisinternal and pg_get_triggerdef(oid) ~* 'cancelled';
\echo '=== TRIGGERS ON loads ==='
select tgname, tgenabled, regexp_replace(pg_get_triggerdef(oid), '\s+', ' ', 'g') from pg_trigger where tgrelid = 'public.loads'::regclass and not tgisinternal order by tgname;
\echo '=== OTHER ENUMS WITH CANCELLED ==='
select t.typname from pg_type t join pg_enum e on e.enumtypid = t.oid where e.enumlabel = 'CANCELLED';
\echo '=== LOAD_STATUS ==='
select enumlabel, enumsortorder from pg_enum where enumtypid = 'public.load_status'::regtype order by enumsortorder;
\echo '=== guard_load_update def md5 ==='
select md5(prosrc), length(prosrc) from pg_proc where proname = 'guard_load_update';
