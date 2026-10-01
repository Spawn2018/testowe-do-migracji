import { useTowerStore } from '../../store/useTowerStore';
import { t } from '../../i18n/messages';
import { applyPwaUpdate } from '../../lib/pwa';

export function Toasts() {
  const toasts = useTowerStore((s) => s.toasts);
  const dismiss = useTowerStore((s) => s.dismissToast);
  const selectLoad = useTowerStore((s) => s.selectLoad);
  const locale = useTowerStore((s) => s.locale);

  if (!toasts.length) return null;
  return (
    <div className="toasts" style={{ width: 360 }}>
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className="toast"
          style={{
            borderRadius: 2,
            background: toast.severity === 'CRITICAL' || toast.severity === 'HIGH' ? 'var(--wt-banner-crit-bg)' : 'var(--wt-banner-bg)',
            borderColor:
              toast.severity === 'CRITICAL' || toast.severity === 'HIGH'
                ? 'var(--wt-banner-crit-edge)'
                : 'var(--wt-banner-edge)',
            borderLeftWidth: 3,
          }}
          onClick={() => {
            if (toast.message === t(locale, 'pwa_update')) {
              applyPwaUpdate();
              return;
            }
            if (toast.loadId) selectLoad(toast.loadId);
            dismiss(toast.id);
          }}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
