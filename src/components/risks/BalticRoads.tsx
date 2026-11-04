/**
 * BN9-c4 (#573 „Ekrany po BN6”) — Ryzyka › Drogi: sekcje „Drogi LT”, „Drogi LV”, „Drogi EE”, „Drogi FI” obok „Drogi PL”
 * i „Drogi SE”, ten sam wiersz co Drogi SE (`RoadRow`, BN9-c4b: wpływ, tytuł, kiedy; opis / „Tłumaczenie w toku” i „Pokaż oryginał”).
 * Ograniczenia masy/wymiarów wyróżnione etykietą i dopiskiem „Sprawdź zezwolenie / trasę.” (bez danych ładunku spoza ryzyka).
 * Kraj bez zdarzeń — stan źródła (`corridor_conditions`): świeży odczyt ≤ 60 min → „Brak utrudnień
 * na korytarzu.”, starszy → „Brak świeżych danych ze źródła (ostatni odczyt: …)”, brak wiersza → „Źródło jeszcze niepodłączone.”.
 * DP-189 (#757): cztery sekcje zawsze (jak Drogi SE); `data-on-route` = kraj na trasie aktywnego transportu.
 * Atrybucja pod sekcją z `detail.zrodlo` ryzyk (bez wpisanych na sztywno źródeł).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { FIRST_ROADS } from '../../lib/p6Route';
import type { Locale } from '../../types';
import { attributionView, type BalticRoadRow, type BalticRoadSection } from '../../lib/bn9c4Roads';
import { formatListDateTime, formatPlNumber } from '../../lib/format';
import { riskText } from '../../i18n/messages';
import { rt, rtn, rtp } from '../../i18n/p6';
import { DemoMark } from '../ui/DemoMark';
import { keepUnits, RoadRow } from './RoadRow';

const fmtNum = (v: number) => formatPlNumber(v, Number.isInteger(v) ? 0 : 1);

/* etykieta limitu z wartością („Limit masy 12 t”); bez wartości — sama nazwa limitu.
   DP-177: liczba nie odrywa się od jednostki także w tytule (etykieta limitu) — twarda spacja jak w opisach i Drogach SE */
function limitLabel(locale: Locale, r: BalticRoadRow): string {
  if (!r.limit) return '';
  if (r.limitValue == null) return rt(locale, `bn9c4_limit_${r.limit}`);
  const key = r.limit === 'WEIGHT' ? 'bn9c4_weight' : r.limit === 'HEIGHT' ? 'bn9c4_height' : 'bn9c4_width';
  return keepUnits(rtp(locale, key, { limit: fmtNum(r.limitValue) }));
}

function rowWhen(locale: Locale, r: BalticRoadRow): string | null {
  const f = r.from ? formatListDateTime(r.from) : null;
  const to = r.to ? formatListDateTime(r.to) : null;
  if (f && to) return rtp(locale, 'bn9c4_when_range', { from: f, to });
  if (f) return rtp(locale, 'bn9c4_when_from', { from: f });
  if (to) return rtp(locale, 'bn9c4_when_to', { to });
  return null;
}

function rowLabel(locale: Locale, r: BalticRoadRow): string {
  /* F7 #780 r2: gdy jest numer drogi — riskText (droga + „obok trasy”); inaczej stary event/title. */
  const road = r.titleParams.road;
  if (r.titleKey && typeof road === 'string' && road.trim()) {
    return keepUnits(riskText(locale, r.title, r.titleKey, r.titleParams));
  }
  return keepUnits(r.event ?? r.title);
}

function Row({ r, locale, phone }: { r: BalticRoadRow; locale: Locale; phone: boolean }) {
  const tag = limitLabel(locale, r);
  const label = rowLabel(locale, r);
  /* DP-204/#781 pkt 6: nie dubluj „Limit masy 40 t” + „Ograniczenie masy 40 t”. */
  const tagDup = Boolean(tag) && /(?:Ograniczenie|Limit)\s+(?:masy|wysokości|szerokości)|sprawdź wysokość/i.test(label);
  const showTag = Boolean(tag) && !tagDup;
  return (
    <RoadRow
      locale={locale}
      phone={phone}
      className={r.limit ? 'rk-road rk-road-limit' : 'rk-road'}
      attrs={{
        'data-baltic-road': r.id,
        'data-risk-id': r.id,
        'data-limit': r.limit ?? undefined,
        'data-off-route': r.offRoute ? '1' : undefined,
      }}
      box={r.country}
      /* długi tytuł ze źródła — jedna linia z wielokropkiem, pełny tekst w podpowiedzi (React sam koduje znaki) */
      titleTip={keepUnits([showTag ? tag : null, label].filter(Boolean).join(' · '))}
      title={<>{showTag ? <span className="rk-limit-tag" data-limit-tag>{tag}</span> : null}{label}</>}
      impact={r.impact}
      when={rowWhen(locale, r)}
      note={r.note}
      noteKind="baltic"
      original={r.original}
      pending={r.pending}
      translated={rt(locale, `bn9c4_translated_${r.country}`)}
      extra={r.limit ? (
        <span className="rk-road-n rk-limit-check" data-limit-check>
          {r.loadT != null ? keepUnits(rtp(locale, 'bn9c4_check_load', { load: fmtNum(r.loadT) })) : rt(locale, 'bn9c4_check')}
        </span>
      ) : null}
    />
  );
}

const isHigh = (r: BalticRoadRow) => r.impact === 'VERY_HIGH' || r.impact === 'HIGH';

/**
 * Sekcja kraju — BN9-c4b (decyzja właściciela 02.11, 22:32 — decyzja 89): działa jak „Drogi SE”. Od razu otwarta, w nagłówku
 * licznik „Finlandia · 146 utrudnień · 0 wysokich” i stan źródła; widać pierwsze {@link FIRST_ROADS} (ta sama stała co SE)
 * o wpływie bardzo dużym / dużym / średnim — najpierw większy wpływ, potem trwające od najświeższego i najbliższe;
 * reszta, w tym niski wpływ (zawsze na końcu), po „Pokaż wszystkie N” / „Pokaż mniej”.
 */
function CountrySection({ s, locale, phone, demo, focusId }: { s: BalticRoadSection; locale: Locale; phone: boolean; demo: boolean; focusId: string | null }) {
  const [all, setAll] = useState(false);
  const lc = s.country.toLowerCase();
  const id = `rk-${lc}-h`;
  /* wiersze już posortowane (wpływ malejąco) — niski wpływ na końcu, poza pierwszymi pozycjami */
  const first = s.rows.filter((r) => r.impact !== 'LOW').slice(0, FIRST_ROADS);
  const low = s.rows.filter((r) => r.impact === 'LOW').length;
  const high = s.rows.filter(isHigh).length;
  const shown = all ? s.rows : first;
  const more = s.rows.length > first.length;
  /* link do ryzyka (riskFilter) — pozycja spoza pierwszych → „Pokaż wszystkie” */
  const focusHidden = !!focusId && s.rows.some((r) => r.id === focusId) && !first.some((r) => r.id === focusId);
  useEffect(() => {
    if (focusHidden) setAll(true);
  }, [focusHidden]);
  const empty = s.source === 'FRESH' ? rt(locale, 'bn9c4_none')
    : s.source === 'STALE' ? rtp(locale, 'bn9c4_stale', { at: formatListDateTime(s.observedAt) })
      : s.source === 'NONE' ? rt(locale, 'bn9c4_nosrc') : rt(locale, 'bn9c4_noread');
  return (
    <section
      className="rk-sec-box"
      data-panel={`road-${lc}`}
      data-baltic={s.country}
      data-on-route={s.onRoute ? '1' : '0'}
      data-all={all ? '1' : '0'}
      data-demo={demo ? 'baltic-roads' : undefined}
      aria-labelledby={id}
    >
      <div className="rk-sec-hd">
        <h3 id={id}>{rt(locale, `bn9c4_road_${s.country}`)}</h3>
        <span className="rk-sec-sub" data-baltic-sum>
          {s.rows.length
            ? `${rt(locale, `bn9c4_country_${s.country}`)} · ${rtn(locale, 'bn9c4_n', s.rows.length)} · ${rtn(locale, 'bn9c4_high', high)}`
            : rt(locale, `bn9c4_country_${s.country}`)}
          {s.slowdownPct != null ? <span data-baltic-slow>{` · ${rtp(locale, 'bn9c4_slow', { pct: s.slowdownPct })}`}</span> : null}
        </span>
        {demo ? <DemoMark /> : null}
      </div>
      {s.rows.length === 0 ? <p className="rk-muted" data-empty={`road-${lc}`} data-source-state={s.source}>{empty}</p> : (
        <>
          {shown.length ? <ul id={`rk-${lc}-list`} className="rk-roads">{shown.map((r) => <Row key={r.id} r={r} locale={locale} phone={phone} />)}</ul> : null}
          {/* same zdarzenia o niskim wpływie — od razu tylko ich liczba */}
          {!first.length && !all ? <p className="rk-muted" data-baltic-lowonly>{rtn(locale, 'bn9c4_low', low)}</p> : null}
          {more ? (
            <button
              type="button"
              className="linkbtn rk-more"
              aria-expanded={all}
              aria-controls={shown.length ? `rk-${lc}-list` : undefined}
              data-baltic-all
              onClick={() => setAll((v) => !v)}
            >
              {all ? rt(locale, 'p6_road_less') : rtp(locale, 'p6_road_all', { n: s.rows.length })}
            </button>
          ) : null}
        </>
      )}
      {/* decyzja B (F7 r1): źródło litewskie nie podaje wypadków — stały dopisek */}
      {s.country === 'LT' ? <p className="rk-muted" data-lt-note>{rt(locale, 'bn9c4_lt_noacc')}</p> : null}
      {s.sources.length ? (
        <p className="rk-muted rk-road-attr" data-attribution={`road-${lc}`}>
          {s.sources.map((src) => attributionView(src, locale))
            .map((v) => (/^(?:Źródło|Source): /.test(v) ? v : rtp(locale, 'bn9c4_attr', { src: v }))).join(' · ')}
        </p>
      ) : null}
    </section>
  );
}

/** Sekcje krajów bałtyckich (kolejność na trasie: LT, LV, EE, FI). */
export function balticRoadSectionNodes(
  { sections, locale, phone, demo, focusId = null }: { sections: readonly BalticRoadSection[]; locale: Locale; phone: boolean; demo: boolean; focusId?: string | null },
): ReactNode[] {
  return sections.map((s) => <CountrySection key={`road-${s.country}`} s={s} locale={locale} phone={phone} demo={demo} focusId={focusId} />);
}
