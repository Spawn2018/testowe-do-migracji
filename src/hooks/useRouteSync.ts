/**
 * D14 — synchronizacja adres ↔ sklep.
 * URL → sklep: przy zmianie ścieżki (wejście z linku, wstecz/dalej) ustawia widok (jeśli rola go ma)
 * i otwiera/zamyka szufladę transportu po kodzie. Sklep → URL: zmiana widoku lub szuflady dopisuje
 * wpis historii (zachowuje query, np. `?now=`). Nieznane ścieżki (np. fragment powrotu z logowania)
 * nie są przepisywane.
 *
 * HashRouter RR7 domyślnie owija setState lokacji w startTransition; przy ciężkim renderze szuflady
 * (mapa) useLocation bywa spóźnione względem window.location.hash — wtedy „wstecz” zmienia adres,
 * a selectedLoadId zostaje. Dlatego URL → sklep czyta też hashchange z okna (oraz useLayoutEffect).
 */
import { useEffect, useLayoutEffect, useRef, type MutableRefObject } from 'react';
import { useLocation, useNavigate, type Location } from 'react-router-dom';
import { useTowerStore } from '../store/useTowerStore';
import { navForRole } from '../lib/permissions';
import { buildRoute, parseRoute } from '../lib/routes';
import { composeFromSearch, setChatCompose } from '../lib/chatCompose';

/**
 * Parametry jednorazowe linku do transportu (zakładka, odpowiedź na czacie) — po przejściu do innego widoku albo transportu
 * nie przechodzą dalej (właściciel 21.10.2026, 16:27: link z dzwonka „?zakladka=status” otwierał każdy kolejny transport na Statusie).
 */
const ONE_SHOT = ['zakladka', 'odpowiedz', 'tekst'];
export function carrySearch(search: string): string {
  const q = new URLSearchParams(search);
  let changed = false;
  for (const k of ONE_SHOT) if (q.has(k)) { q.delete(k); changed = true; }
  if (!changed) return search;
  const s = q.toString();
  return s ? `?${s}` : '';
}

function readWindowHash(): Pick<Location, 'pathname' | 'search'> {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const q = raw.indexOf('?');
  if (q < 0) return { pathname: raw || '/', search: '' };
  return { pathname: raw.slice(0, q) || '/', search: raw.slice(q) };
}

function applyUrlToStore(
  pathname: string,
  search: string,
  pendingCode: MutableRefObject<string | null>,
) {
  const r = parseRoute(pathname);
  const st = useTowerStore.getState();
  const tab = new URLSearchParams(search).get('zakladka');
  const tabMap: Record<string, string> = {
    status: 'timeline', dokumenty: 'docs', ceny: 'pricing', ustalenia: 'chat', czat: 'chat', historia: 'history', awizacja: 'overview',
    'awizacja-pilot': 'overview', 'numer-hhl': 'overview', 'numer-przewoznika': 'overview',
  };
  if (r.kind !== 'sms' && st.smsEntry) st.setSmsEntry(null);
  if (r.kind !== 'workflow' && st.workflowFocus) st.setWorkflowFocus(null);
  if (r.kind === 'view') {
    if (navForRole(st.role).includes(r.view) && st.view !== r.view) st.setView(r.view);
    if (st.selectedLoadId) st.selectLoad(null);
    pendingCode.current = null;
  } else if (r.kind === 'transport') {
    const l = st.loads.find((x) => x.code.toUpperCase() === r.code);
    if (l) {
      pendingCode.current = null;
      if (st.selectedLoadId !== l.id) st.selectLoad(l.id);
      if (tab && tabMap[tab]) st.setDrawerTab(tabMap[tab]);
      /* wyglad/P6-e (Cz18, Cz23): z powiadomienia — kursor w polu wiadomości albo tekst niewysłanej odpowiedzi */
      const compose = tabMap[tab ?? ''] === 'chat' ? composeFromSearch(search) : null;
      if (compose) setChatCompose(l.id, compose);
    } else if (st.loads.length) {
      pendingCode.current = null;
      st.setAccessMessage('Brak dostępu');
    } else {
      pendingCode.current = r.code;
    }
  } else if (r.kind === 'decision') {
    if (st.view !== 'risk') st.setView('risk');
    st.setOpenDecisionId(r.id);
  } else if (r.kind === 'invoice') {
    if (navForRole(st.role).includes('inv')) st.setView('inv');
    else st.setAccessMessage('Brak dostępu');
    st.setOpenInvoiceId(r.id);
  } else if (r.kind === 'system' || r.kind === 'options') {
    if (navForRole(st.role).includes('options')) st.setView('options');
    else st.setAccessMessage('Brak dostępu');
  } else if (r.kind === 'denied') {
    st.setAccessMessage('Brak dostępu');
  } else if (r.kind === 'entry') {
    st.setEntryOpen(true);
    st.setSmsEntry(null);
    st.setWorkflowFocus(null);
  } else if (r.kind === 'sms') {
    st.setEntryOpen(false);
    st.setWorkflowFocus(null);
    if (st.role !== 'HHL') {
      st.setSmsEntry(null);
      st.setAccessMessage('Brak dostępu');
    } else {
      const q = new URLSearchParams(search);
      if (st.view !== 'options') st.setView('options');
      st.setSmsEntry({
        id: r.id,
        status: q.get('status') ?? '',
        recipient: q.get('odbiorca') ?? '',
        email: q.get('email') ?? '',
        transport: q.get('transport') ?? '',
      });
    }
  } else if (r.kind === 'workflow') {
    st.setEntryOpen(false);
    st.setSmsEntry(null);
    if (!navForRole(st.role).includes('wf')) {
      st.setWorkflowFocus(null);
      st.setAccessMessage('Brak dostępu');
    } else {
      if (st.view !== 'wf') st.setView('wf');
      st.setWorkflowFocus(r.id);
    }
  } else {
    st.setSmsEntry(null);
    st.setWorkflowFocus(null);
  }
}

export function useRouteSync() {
  const location = useLocation();
  const navigate = useNavigate();
  const view = useTowerStore((s) => s.view);
  const selectedLoadId = useTowerStore((s) => s.selectedLoadId);
  const loads = useTowerStore((s) => s.loads);
  const openInvoiceId = useTowerStore((s) => s.openInvoiceId);
  const pendingCode = useRef<string | null>(null);
  const loc = useRef(location);

  // URL → sklep: synchronicznie przy commitcie lokacji RR (gdy startTransition zdąży).
  useLayoutEffect(() => {
    loc.current = location;
    applyUrlToStore(location.pathname, location.search, pendingCode);
  }, [location.pathname, location.search]);

  // Gdy przeglądarka już zmieniła hash (wstecz/dalej), a RR jeszcze trzyma starą lokację w transition.
  useEffect(() => {
    const onHash = () => {
      const w = readWindowHash();
      loc.current = { ...loc.current, pathname: w.pathname, search: w.search };
      applyUrlToStore(w.pathname, w.search, pendingCode);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Sklep → URL (także gdy dojadą transporty dla linku wprowadzonego przed ich wczytaniem).
  useEffect(() => {
    const st = useTowerStore.getState();
    const cur = loc.current;
    const r = parseRoute(cur.pathname);
    /* A4 (wyglad/W-faktura-termin, F7): link do faktury zostaje w adresie, dopóki Faktury go nie odczytają; potem adres widoku
       (z ?now= i konto) — przeładowanie nie otwiera faktury drugi raz, a ponowne kliknięcie tego samego linku znów działa */
    if (r.kind === 'invoice') {
      if (st.openInvoiceId && st.view === 'inv') return;
      /* F7 (2. runda): przejście z menu, zanim Faktury odczytały link (albo konto bez faktur) — link przepada, adres widoku */
      if (st.openInvoiceId) st.setOpenInvoiceId(null);
      const open = st.selectedLoadId ? st.loads.find((x) => x.id === st.selectedLoadId) : null;
      const target = buildRoute(st.view, open?.code ?? null);
      if (target !== cur.pathname) navigate({ pathname: target, search: cur.search }, { replace: true });
      return;
    }
    if (r.kind === 'unknown' || r.kind === 'decision' || r.kind === 'system' || r.kind === 'options' || r.kind === 'denied' || r.kind === 'entry' || r.kind === 'sms' || r.kind === 'workflow') return;
    let replace = r.kind === 'root' || (r.kind === 'view' && !navForRole(st.role).includes(r.view));
    if (pendingCode.current) {
      const l = st.loads.find((x) => x.code.toUpperCase() === pendingCode.current);
      if (l) {
        pendingCode.current = null;
        st.selectLoad(l.id);
        return;
      }
      if (!st.loads.length) return; // dane jeszcze się wczytują
      pendingCode.current = null;
      st.setAccessMessage('Brak dostępu');
      return;
    }
    const sel = st.selectedLoadId ? st.loads.find((x) => x.id === st.selectedLoadId) : null;
    const target = buildRoute(st.view, sel?.code ?? null);
    if (target === cur.pathname) return;
    navigate({ pathname: target, search: carrySearch(cur.search) }, { replace });
  }, [view, selectedLoadId, loads, openInvoiceId, navigate]);
}
