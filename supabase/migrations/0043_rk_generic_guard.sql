-- 0043 — ANEKS 6 (27.09.2026): strażnik rk_generic. rk_generic zostaje bezpiecznikiem wyzwalacza z 0042, ale
-- żadna ścieżka w kodzie nie powinna do niego prowadzić (test tests/rk-generic.test.ts). Jeśli mimo to ryzyko
-- z rk_generic trafi do risk_signals: ryzyko HHL (JOB_FAILURE, widzi tylko HHL — zamknięte drzwi z 0020),
-- klucz rk_key_guard, jedno otwarte na projekt i rodzaj, oraz e-mail na ALERT_EMAIL_TO (Resend przez pg_net,
-- sekrety w Vault jak job_watchdog). Strażnik nigdy nie blokuje zapisu pierwotnego ryzyka.
-- Idempotentna, niedestrukcyjna.

create or replace function public.risk_key_guard() returns trigger
language plpgsql security definer set search_path = public as $function$
declare
  v_key text; v_title text; v_detail jsonb; v_id uuid; v_api text; v_from text; v_to text; v_mail text := 'BRAK_SEKRETOW';
begin
  begin
    v_key := 'rk_generic_guard:' || coalesce(new.project_id::text, '-') || ':' || new.kind::text;
    v_title := 'Ryzyko bez klucza tłumaczenia: ' || new.kind::text || ' — ' || coalesce(new.title, '');
    v_detail := jsonb_build_object('job', 'risk-key-guard', 'source_risk_id', new.id, 'source_kind', new.kind::text,
      'source_title', new.title,
      'text', 'Funkcja zapisała ryzyko bez klucza tłumaczenia — tekst w aplikacji i e-mailach tylko po polsku.',
      'next_action', 'Dodaj klucz tłumaczenia w funkcji źródłowej i zamknij to ryzyko.',
      'params', jsonb_build_object('kind', new.kind::text, 'title', coalesce(new.title, '')),
      'text_key', 'rk_key_guard_text', 'next_action_key', 'rk_key_guard_next');
    insert into risk_signals (project_id, kind, severity, title, title_key, detail, dedup_key)
    values (new.project_id, 'JOB_FAILURE', 'HIGH', v_title, 'rk_key_guard', v_detail, v_key)
    on conflict (dedup_key) where dedup_key is not null and resolved_at is null do nothing
    returning id into v_id;
    if v_id is null then return null; end if;          -- już otwarte dla tego rodzaju: bez drugiego e-maila
    if to_regclass('vault.decrypted_secrets') is not null
       and to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null then
      execute $q$select max(decrypted_secret) filter (where name = 'resend_api_key'),
                        max(decrypted_secret) filter (where name = 'mail_from'),
                        max(decrypted_secret) filter (where name = 'alert_email_to')
                   from vault.decrypted_secrets$q$ into v_api, v_from, v_to;
      if v_api is not null and v_from is not null and v_to is not null then
        execute $q$select net.http_post(url := 'https://api.resend.com/emails',
                   headers := jsonb_build_object('Authorization', 'Bearer ' || $1, 'Content-Type', 'application/json'),
                   body := jsonb_build_object('from', $2, 'to', to_jsonb(string_to_array($3, ',')),
                                              'subject', '[Watch Tower] ALARM: ' || $4,
                                              'text', $4 || E'\n' || ($5->>'text') || E'\nCo zrobić: ' || ($5->>'next_action')))$q$
          using v_api, v_from, v_to, v_title, v_detail;
        v_mail := 'WYSLANY_DO_KOLEJKI';
      end if;
    end if;
    update risk_signals set detail = detail || jsonb_build_object('mail', v_mail) where id = v_id;
  exception when others then
    raise warning 'risk_key_guard: %', sqlerrm;          -- strażnik nie może zablokować zapisu ryzyka
  end;
  return null;
end
$function$;

revoke all on function public.risk_key_guard() from public, anon, authenticated;
drop trigger if exists risk_signals_key_guard on risk_signals;
create trigger risk_signals_key_guard after insert on risk_signals
  for each row when (new.title_key = 'rk_generic')
  execute function public.risk_key_guard();
