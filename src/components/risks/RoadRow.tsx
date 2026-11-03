/**
 * BN9-c4b (decyzja właściciela 02.11, 22:32 — decyzja 89) — wspólny wiersz drogi: Drogi PL / SE i Drogi LT / LV / EE / FI.
 * Pole drogi albo kraju, tytuł po polsku, wpływ (kolory `rk-alert`), czas; pod spodem (komputer) opis albo „Tłumaczenie w toku”
 * i „Pokaż oryginał”, gdy dane mają oryginał (Drogi SE: `corridor_conditions`; LT/LV/EE/FI: `detail.oryginal`).
 * Bez oryginału — bez pustych pól.
 */
import type { ReactNode } from 'react';
import type { Locale } from '../../types';
import type { RoadImpact } from '../../lib/p6Route';
import { rt } from '../../i18n/p6';

/** Liczba nie odrywa się od jednostki w tekście ze źródła („50 km/h”, „2 h”, „12 t”) — spacja nierozdzielająca (jak `keepUnits` w HelpPanel). */
const keepUnits = (x: string): string =>
  x.replace(/(\d) (?=(?:km|m|h|min|t|dni|%)(?![\p{L}\p{N}]))/gu, '$1\u00a0');

export interface RoadRowProps {
  locale: Locale;
  phone: boolean;
  /** atrybuty wiersza (`data-road`, `data-baltic-road` …) */
  attrs: Record<string, string | undefined>;
  className?: string;
  /** pole po lewej: numer drogi albo kod kraju */
  box: string;
  title: ReactNode;
  /** pełny tytuł w podpowiedzi (długie tytuły ze źródła) */
  titleTip?: string;
  impact: RoadImpact;
  when: string | null;
  note: string | null;
  /** rodzaj opisu w `data-road-note` (SE: „pl”, LT/LV/EE/FI: „baltic”) */
  noteKind: string;
  original: string | null;
  pending: boolean;
  /** dopisek przy przetłumaczonym tytule („przetłumaczone ze szwedzkiego”) */
  translated: string;
  /** dodatkowa linia pod wpływem (limit masy — „Sprawdź zezwolenie / trasę.”) */
  extra?: ReactNode;
}

export function RoadRow({
  locale, phone, attrs, className = 'rk-road', box, title, titleTip, impact, when, note, noteKind, original, pending, translated, extra,
}: RoadRowProps) {
  return (
    <li className={className} {...attrs}>
      <span className="rk-box">{box}</span>
      <span className="rk-road-tx">
        <span className="rk-road-t" title={titleTip}>{typeof title === 'string' ? keepUnits(title) : title}</span>
        <span className="rk-road-s">
          <span className={`rk-alert ${impact === 'VERY_HIGH' ? 'is-red' : impact === 'HIGH' ? 'is-amber' : 'is-plain'}`}>
            {rt(locale, `p6_imp_${impact}`)}
          </span>
          {when ? ` · ${when}` : ''}
          {original && !pending ? ` · ${translated}` : ''}
        </span>
        {extra}
        {pending && !phone ? <span className="rk-road-n" data-road-note="pending">{rt(locale, 'p6_road_pending')}</span>
          : note && !phone ? <span className="rk-road-n" data-road-note={noteKind}>{keepUnits(note)}</span> : null}
        {original && !phone ? (
          <details className="rk-orig">
            <summary>{rt(locale, 'p6_road_original')}</summary>
            <span data-original="road">{original}</span>
          </details>
        ) : null}
      </span>
    </li>
  );
}
