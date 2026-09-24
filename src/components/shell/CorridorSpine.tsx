import { useTowerStore } from '../../store/useTowerStore';
import { STAGE_ORDER } from '../../lib/status';
import { countLoadsByStage } from '../../lib/corridorKpis';
import { t } from '../../i18n/messages';
import type { CorridorStage } from '../../types';

function stageDomain(stage: CorridorStage): 'sea' | 'site' | 'pre' | '' {
  // Claude v2.0: only SEA / SITE|DONE / PRE — Gdańsk has no domain tint
  if (stage === 'FERRY') return 'sea';
  if (stage === 'SITE' || stage === 'DELIVERED') return 'site';
  if (stage === 'PLAN') return 'pre';
  return '';
}

export function CorridorSpine() {
  const loads = useTowerStore((s) => s.loads);
  const stageFilter = useTowerStore((s) => s.stageFilter);
  const navigateTo = useTowerStore((s) => s.navigateTo);
  const setStageFilter = useTowerStore((s) => s.setStageFilter);
  const locale = useTowerStore((s) => s.locale);

  const counts = countLoadsByStage(loads);

  const max = Math.max(1, ...STAGE_ORDER.map((s) => counts[s]));

  return (
    <div className="corridor">
      <div className="corridor-inner" id="corridor">
        {STAGE_ORDER.map((stage, i) => {
          const n = counts[stage];
          const pressed = stageFilter === stage;
          const fill = Math.round((n / max) * 100);
          const domain = stageDomain(stage);
          return (
            <button
              key={stage}
              type="button"
              aria-pressed={pressed}
              title={
                pressed
                  ? 'Kliknij ponownie, aby wyczyścić filtr'
                  : `Filtruj: ${t(locale, `stage_${stage}`)}`
              }
              onClick={() => {
                if (stageFilter === stage) {
                  setStageFilter(null);
                  navigateTo({ stage: null });
                } else {
                  navigateTo({ view: 'map', stage });
                }
              }}
              className={`stage${domain ? ` ${domain}` : ''}`}
            >
              <span className="kb">{i + 1}</span>
              <div className={`n${n === 0 ? ' zero' : ''}`}>{n}</div>
              <div className="l">{t(locale, `stage_${stage}`)}</div>
              <div className="bar">
                <i style={{ width: n ? `${fill}%` : 0 }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
