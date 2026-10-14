/**
 * wyglad/P4 — pasek etapów według E28 (decyzja 07.10 20:57, img/e28-after, makieta E28/pasek.html).
 * 10 kafelków według statusów E25, na każdym tylko liczba (bez linii podpowiedzi), zero wyszarzone.
 * Kliknięcie: w Harmonogramie i na Mapie filtruje na miejscu; z każdej innej strony prowadzi na Mapę z filtrem.
 * Drugie kliknięcie, „✕” albo Escape zdejmuje filtr.
 * Komputer: pod paskiem górnym, nad każdą stroną, z grupami Przygotowanie · W trasie · Po dostawie.
 * Telefon: ten sam pasek nad Harmonogramem i Mapą, przewijany w bok (liczba nad nazwą).
 */
import { useMemo } from 'react';
import { useTowerStore } from '../../store/useTowerStore';
import { filterLoadsForRole } from '../../lib/permissions';
import { countByTile, STAGE_GROUPS, STAGE_TILES, TILE_TONE, type StageTile } from '../../lib/stageTiles';
import { t, tp } from '../../i18n/messages';

function useStageBar() {
  const loads = useTowerStore((s) => s.loads);
  const role = useTowerStore((s) => s.role);
  const stageFilter = useTowerStore((s) => s.stageFilter);
  /* E28 pkt 5: każda firma liczy tylko transporty, które widzi */
  const counts = useMemo(() => countByTile(filterLoadsForRole(loads, role)), [loads, role]);
  const toggle = (tile: StageTile) => {
    const st = useTowerStore.getState();
    if (st.stageFilter === tile) {
      st.navigateTo({ stage: null });
      return;
    }
    st.navigateTo({ view: st.view === 'sched' || st.view === 'map' ? st.view : 'map', stage: tile });
  };
  return { counts, stageFilter, toggle };
}

export function StageBar({ variant }: { variant: 'global' | 'page' }) {
  const locale = useTowerStore((s) => s.locale);
  const { counts, stageFilter, toggle } = useStageBar();
  const title = (tile: StageTile) =>
    stageFilter === tile
      ? t(locale, 'p4_bar_clear')
      : tp(locale, 'p4_bar_filter', { stage: t(locale, `p4_tile_${tile}`), n: counts[tile] });

  if (variant === 'page') {
    return (
      <div className="sbar-scroll" data-stage-bar="page" role="group" aria-label={t(locale, 'p4_bar_label')}>
        {STAGE_TILES.map((tile) => {
          const n = counts[tile];
          const on = stageFilter === tile;
          return (
            <button
              key={tile}
              type="button"
              className={`sbar-sc${n === 0 ? ' zero' : ''}${on ? ' on' : ''}`}
              data-tile={tile}
              aria-pressed={on}
              title={title(tile)}
              onClick={() => toggle(tile)}
            >
              <b>{n}</b>
              <span>
                {t(locale, `p4_tile_${tile}`)}
                {on ? <span className="sbar-x" aria-hidden> ✕</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="sbar" data-stage-bar="global">
      <div className="sbar-grp" aria-hidden>
        {STAGE_GROUPS.map((g) => (
          <span key={g.key}>{t(locale, `p4_grp_${g.key}`)}</span>
        ))}
      </div>
      <div className="sbar-row" role="group" aria-label={t(locale, 'p4_bar_label')}>
        {STAGE_TILES.map((tile) => {
          const n = counts[tile];
          const on = stageFilter === tile;
          const tone = TILE_TONE[tile];
          return (
            <button
              key={tile}
              type="button"
              className={`sbar-tile${tone ? ` ${tone}` : ''}${n === 0 ? ' zero' : ''}${on ? ' on' : ''}`}
              data-tile={tile}
              aria-pressed={on}
              title={title(tile)}
              onClick={() => toggle(tile)}
            >
              <span className="nm">
                {t(locale, `p4_tile_${tile}`)}
                {on ? <span className="sbar-x" aria-hidden>✕</span> : null}
              </span>
              <span className="n">{n}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Chip „Etap: Plac Boden ✕” nad listą Harmonogramu i Mapy (E28 pkt 2). */
export function StageChip() {
  const locale = useTowerStore((s) => s.locale);
  const stageFilter = useTowerStore((s) => s.stageFilter);
  if (!stageFilter) return null;
  return (
    <button
      type="button"
      className="chipbtn sbar-chip"
      data-stage-chip={stageFilter}
      title={t(locale, 'p4_bar_clear')}
      onClick={() => useTowerStore.getState().navigateTo({ stage: null })}
    >
      {tp(locale, 'p4_chip', { stage: t(locale, `p4_tile_${stageFilter}`) })}
    </button>
  );
}
