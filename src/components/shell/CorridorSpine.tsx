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
  const sailings = useTowerStore((s) => s.sailings);

  const counts = countLoadsByStage(loads);

  const max = Math.max(1, ...STAGE_ORDER.map((s) => counts[s]));

  return (
    <div className="corridor">
      <div className="corridor-inner" id="corridor">
        {STAGE_ORDER.map((stage) => {
          const n = counts[stage];
          const pressed = stageFilter === stage;
          const fill = Math.round((n / max) * 100);
          const domain = stageDomain(stage);
          let ferryTip = '';
          if (stage === 'FERRY' && sailings?.length) {
            const upcoming = [...sailings]
              .filter((s) => s.departureAt && new Date(s.departureAt).getTime() > Date.now() - 3600_000)
              .sort((a, b) => new Date(a.departureAt).getTime() - new Date(b.departureAt).getTime())
              .slice(0, 2);
            if (upcoming.length) {
              ferryTip = ' · ' + upcoming.map((s) => `${s.operator ?? s.vessel ?? 'rejs'} ${new Date(s.departureAt).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`).join(' / ');
            }
          }
          return (
            <button
              key={stage}
              type="button"
              aria-pressed={pressed}
              title={
                (pressed
                  ? t(locale, 'a6_spine_clear')
                  : t(locale, 'a6_spine_filter').replace('{stage}', t(locale, `stage_${stage}`))) + ferryTip
              }
              onClick={() => {
                if (stageFilter === stage) {
                  setStageFilter(null);
                  navigateTo({ stage: null });
                } else {
                  const view = useTowerStore.getState().view;
                  navigateTo({ view: view === 'sched' ? 'sched' : 'map', stage });
                }
              }}
              className={`stage${domain ? ` ${domain}` : ''}${pressed ? ' active' : ''}`}
            >
              <div className={`n${n === 0 ? ' zero' : ''}`}>{pressed ? '×' : n}</div>
              <div className="l">{t(locale, `stage_${stage}`)}{pressed ? ' ×' : ''}</div>
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
