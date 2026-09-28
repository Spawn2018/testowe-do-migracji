import type { ExceptionItem } from '../../types';
import { ROLE_META } from '../../lib/permissions';
import { useTowerStore } from '../../store/useTowerStore';
import { riskText, tp } from '../../i18n/messages';
import { clickableRow } from '../../lib/clickableRow';

/** Format age like Claude: 40m / 2h / 1d */
export function formatExqAge(ageHours: number): string {
  if (ageHours < 1) {
    const m = Math.max(1, Math.round(ageHours * 60));
    return `${m}m`;
  }
  if (ageHours >= 24) {
    return `${Math.round(ageHours / 24)}d`;
  }
  return `${Math.round(ageHours)}h`;
}

export function ExceptionRow({
  item,
  onClick,
}: {
  item: ExceptionItem;
  onClick?: () => void;
}) {
  const locale = useTowerStore((s) => s.locale);
  const ref = item.code ?? null;
  /* A6-T1 — tytuł i opis w aktywnym języku (klucz słownika + parametry), bez klucza tekst zapisany */
  const title = riskText(locale, item.title, item.titleKey, item.titleParams);
  const titleHasCode = ref ? title.includes(ref) : false;
  const meta =
    riskText(locale, item.meta, item.metaKey, item.metaParams) ||
    tp(locale, 'risk_meta_owner', { name: ROLE_META[item.owner]?.name ?? item.owner });

  return (
    <li
      data-sev={item.severity}
      /* III-12: bez role="button" — <ul> zawiera wyłącznie pozycje listy (WCAG 1.3.1); klawiatura: Tab + Enter/Spacja */
      {...clickableRow(() => onClick?.())}
    >
      <span className="gut" />
      <span className="txt">
        <span className="t">
          {item.tag ? (
            <>
              <span className="pill p-amber" data-risk-tag>{item.tag}</span>{' '}
            </>
          ) : null}
          {ref && !titleHasCode ? (
            <>
              <span className="code" data-content>{ref}</span>
              {' · '}
            </>
          ) : null}
          <span data-content>{title}</span>
        </span>
        <span className="m" data-content>{meta}</span>
      </span>
      <span className="age">{formatExqAge(item.ageHours)}</span>
    </li>
  );
}
