# I-2A — generator weryfikacji produkcyjnej (TRANSAKCJA WYCOFANA): macierz null-guard-calls.txt × konta nieaktywne + brak app_users,
# kontrola pozytywna (Sebastian, HHL_ADMIN) i podgląd importu. Użycie: python3 scripts/i2/nullguard-prod.py && psql "$SUPABASE_DB_POOLER_URL" -f /tmp/ng/prodverify.sql
# Wymaga /tmp/rel/rows.json (wiersze RPC z public/KSH_HARMONOGRAM.xlsx). Na końcu ROLLBACK — nic nie zostaje w bazie.
import re
calls=[]
for l in open('tests/db/null-guard-calls.txt'):
    if not l.strip() or l.lstrip().startswith('#'): continue
    n,k,s,e=[x.strip() for x in l.split(' | ')]
    calls.append((n,k,s,e))
def q(s): return "'"+s.replace("'","''")+"'"
vals=",\n".join(f"({q(n)},{q(k)},{q(s)},{q(e)})" for n,k,s,e in calls)
sql=r"""\set rows `cat /tmp/rel/rows.json`
\set ON_ERROR_STOP on
begin;
create temp table ng_calls(name text, kind text, sql text, exp text) on commit drop;
insert into ng_calls values
""" + vals + r""";
create temp table ng_res(acc text, name text, kind text, good boolean, got text) on commit drop;
grant all on ng_calls, ng_res to authenticated;
do $$
declare
  p uuid := (select id from projects where code='STEGRA_BODEN');
  car uuid := (select id from organizations where kind='CARRIER' limit 1);
  hid uuid := (select id from app_users where role='HHL_OPS' limit 1);
  kid uuid := (select id from app_users where role='CLIENT_USER' limit 1);
  l1 uuid; inv uuid; doc uuid; notif bigint; permit uuid;
  a record; c record; s text; v text; ok boolean;
begin
  -- dane pomocnicze WYŁĄCZNIE w tej transakcji (wycofanej na końcu)
  insert into loads (project_id, carrier_org_id, order_no) values (p, car, 'NG-TEST') returning id into l1;
  insert into documents (project_id, load_id, category, storage_path, file_name, mime_type, size_bytes, uploaded_by)
    values (p, l1, 'CMR', 'dokumenty/ng/ng.pdf', 'ng.pdf', 'application/pdf', 100, hid) returning id into doc;
  insert into notifications (channel, recipient, user_id, template) values ('IN_APP', 'ng', hid, 'TEST') returning id into notif;
  insert into permits (project_id, country, permit_no, valid_from, valid_until) values (p, 'SE', 'NG', current_date-1, current_date+30) returning id into permit;
  inv := gen_random_uuid();
  for a in select * from (values
      ('HHL_OPS (nieaktywny)', (select auth_id::text from app_users where role='HHL_OPS' limit 1)),
      ('CLIENT_USER/KSH (nieaktywny)', (select auth_id::text from app_users where role='CLIENT_USER' limit 1)),
      ('CARRIER_DISPATCH/SCX (nieaktywny)', (select auth_id::text from app_users where role='CARRIER_DISPATCH' limit 1)),
      ('BRAK_APP_USERS', gen_random_uuid()::text),
      ('POZYTYWNA: Sebastian HHL_ADMIN', (select auth_id::text from app_users where lower(email::text)='sebastian@log-mar.pl'))) t(acc, sub) loop
    for c in select * from ng_calls where kind <> 'PURE' loop
      if a.acc like 'POZYTYWNA%' and c.kind <> 'GUARD' then continue; end if;
      s := replace(replace(replace(replace(replace(replace(replace(replace(replace(c.sql,
        '$KSHID', kid::text), '$L1', l1::text), '$L2', l1::text), '$PERMIT', permit::text), '$P', p::text), '$INV', inv::text),
        '$DOCOBJ', 'ng/ng.pdf'), '$DOC', doc::text), '$NOTIF', notif::text);
      begin
        perform set_config('request.jwt.claims', json_build_object('sub', a.sub, 'role', 'authenticated')::text, true);
        perform set_config('request.jwt.claim.sub', a.sub, true);
        perform set_config('role', 'authenticated', true);
        execute s into v;
        perform set_config('role', 'postgres', true);
        ok := case when a.acc like 'POZYTYWNA%' then true when c.kind = 'EMPTY' then replace(replace(coalesce(v, ''), 'false', 'f'), 'true', 't') = c.exp else false end;
        raise exception 'ng_rollback' using errcode = 'ZNG01';   -- cofnij skutki wywołania
      exception
        when sqlstate 'ZNG01' then insert into ng_res values (a.acc, c.name, c.kind, ok, left(coalesce(v, 'NULL'), 80));
        when others then
          ok := case when a.acc like 'POZYTYWNA%' then not (sqlerrm ~ c.exp) else c.kind in ('GUARD','TOKEN') and sqlerrm ~ c.exp end;
          insert into ng_res values (a.acc, c.name, c.kind, ok, left(sqlerrm, 80));
      end;
    end loop;
  end loop;
end $$;
select 'wynik', acc, count(*) filter (where good), count(*) from ng_res group by acc order by acc;
select 'zle', acc, name, got from ng_res where not good;
select 'poz', name, got from ng_res where acc like 'POZ%';
select 'helpery_brak_konta', (select is_hhl() is false and can_see_margin() is false from (select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true)) x);
-- Sebastian@log-mar.pl (aktywny HHL_ADMIN): is_hhl i podgląd importu pełnego harmonogramu
select set_config('request.jwt.claims', json_build_object('sub', (select auth_id from app_users where lower(email::text)='sebastian@log-mar.pl'), 'role', 'authenticated')::text, true);
select set_config('request.jwt.claim.sub', (select auth_id::text from app_users where lower(email::text)='sebastian@log-mar.pl'), true);
set local role authenticated;
select 'sebastian', current_app_role(), is_hhl(), can_see_margin();
select 'podglad', r->>'rows', jsonb_array_length(r->'added') as nowe, jsonb_array_length(r->'changed') as zmienione, r->>'unchanged', r->>'carrier', r->>'ms', coalesce(r->>'version','-')
  from (select import_schedule((select id from projects where code='STEGRA_BODEN'), :'rows'::jsonb, '{}', '{"name":"KSH_HARMONOGRAM.xlsx"}', true) r) s;
reset role;
rollback;
select 'po_rollback', (select count(*) from loads), (select count(*) from shipment_items), (select count(*) from schedule_imports), (select count(*) from documents), (select count(*) from permits), (select count(*) from notifications), (select count(*) from app_users where active);
"""
import os; os.makedirs('/tmp/ng', exist_ok=True); open('/tmp/ng/prodverify.sql','w').write(sql)
