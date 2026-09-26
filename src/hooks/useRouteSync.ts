/**
 * D14 — synchronizacja adres ↔ sklep.
 * URL → sklep: przy zmianie ścieżki (wejście z linku, wstecz/dalej) ustawia widok (jeśli rola go ma)
 * i otwiera/zamyka szufladę transportu po kodzie. Sklep → URL: zmiana widoku lub szuflady dopisuje
 * wpis historii (zachowuje query, np. `?now=`). Nieznane ścieżki (np. fragment powrotu z logowania)
 * nie są przepisywane.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTowerStore } from '../store/useTowerStore';
import { navForRole } from '../lib/permissions';
import { buildRoute, parseRoute } from '../lib/routes';

export function useRouteSync() {
  const location = useLocation();
  const navigate = useNavigate();
  const view = useTowerStore((s) => s.view);
  const selectedLoadId = useTowerStore((s) => s.selectedLoadId);
  const loads = useTowerStore((s) => s.loads);
  const pendingCode = useRef<string | null>(null);
  const loc = useRef(location);
  useLayoutEffect(() => {
    loc.current = location;
  }, [location]);

  // URL → sklep (tylko przy zmianie ścieżki).
  useEffect(() => {
    const r = parseRoute(location.pathname);
    const st = useTowerStore.getState();
    if (r.kind === 'view') {
      if (navForRole(st.role).includes(r.view) && st.view !== r.view) st.setView(r.view);
      if (st.selectedLoadId) st.selectLoad(null);
      pendingCode.current = null;
    } else if (r.kind === 'transport') {
      const l = st.loads.find((x) => x.code.toUpperCase() === r.code);
      if (l) {
        pendingCode.current = null;
        if (st.selectedLoadId !== l.id) st.selectLoad(l.id);
      } else {
        pendingCode.current = r.code;
      }
    }
  }, [location.pathname]);

  // Sklep → URL (także gdy dojadą transporty dla linku wprowadzonego przed ich wczytaniem).
  useEffect(() => {
    const st = useTowerStore.getState();
    const cur = loc.current;
    const r = parseRoute(cur.pathname);
    if (r.kind === 'unknown') return;
    let replace = r.kind === 'root' || (r.kind === 'view' && !navForRole(st.role).includes(r.view));
    if (pendingCode.current) {
      const l = st.loads.find((x) => x.code.toUpperCase() === pendingCode.current);
      if (l) {
        pendingCode.current = null;
        st.selectLoad(l.id);
        return;
      }
      if (!st.loads.length) return; // dane jeszcze się wczytują
      pendingCode.current = null; // kod nieznany — wracamy do ścieżki widoku
      replace = true;
    }
    const sel = st.selectedLoadId ? st.loads.find((x) => x.id === st.selectedLoadId) : null;
    const target = buildRoute(st.view, sel?.code ?? null);
    if (target === cur.pathname) return;
    navigate({ pathname: target, search: cur.search }, { replace });
  }, [view, selectedLoadId, loads, navigate]);
}
