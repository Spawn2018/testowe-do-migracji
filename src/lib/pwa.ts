/**
 * RESP-14 — rejestracja service workera, komunikat o nowej wersji, stan sieci.
 */
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';

export function registerPwa(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  const notify = (key: 'pwa_update' | 'pwa_offline' | 'pwa_online') => {
    const locale = useTowerStore.getState().locale;
    useTowerStore.getState().pushToast(t(locale, key), key === 'pwa_offline' ? 'HIGH' : 'MEDIUM');
  };

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            notify('pwa_update');
          }
        });
      });
    }).catch(() => {});
  });

  window.addEventListener('offline', () => notify('pwa_offline'));
  window.addEventListener('online', () => notify('pwa_online'));
}

/** Użytkownik zatwierdza odświeżenie po komunikacie o nowej wersji. */
export function applyPwaUpdate(): void {
  void navigator.serviceWorker?.getRegistration().then((reg) => {
    reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  });
}
