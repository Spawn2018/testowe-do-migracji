import { useTowerStore } from '../../store/useTowerStore';

export function Toasts() {
  const toasts = useTowerStore((s) => s.toasts);
  const dismiss = useTowerStore((s) => s.dismissToast);
  const selectLoad = useTowerStore((s) => s.selectLoad);

  if (!toasts.length) return null;
  return (
    <div className="toasts" style={{ width: 360 }}>
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          className="toast"
          style={{
            borderRadius: 2,
            background: t.severity === 'CRITICAL' || t.severity === 'HIGH' ? 'var(--wt-banner-crit-bg)' : 'var(--wt-banner-bg)',
            borderColor:
              t.severity === 'CRITICAL' || t.severity === 'HIGH'
                ? 'var(--wt-banner-crit-edge)'
                : 'var(--wt-banner-edge)',
            borderLeftWidth: 3,
          }}
          onClick={() => {
            if (t.loadId) selectLoad(t.loadId);
            dismiss(t.id);
          }}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
