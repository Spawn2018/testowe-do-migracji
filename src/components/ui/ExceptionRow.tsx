import type { ExceptionItem } from '../../types';
import { ROLE_META } from '../../lib/permissions';
import { useTowerStore } from '../../store/useTowerStore';
import { riskText, tp } from '../../i18n/messages';
import { clickableRow } from '../../lib/clickableRow';
import { isTechnicalRoadNotice } from '../../lib/format';
import { transportCaseTitle } from '../../lib/transportName';

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
  const role = useTowerStore((s) => s.role);
  const loads = useTowerStore((s) => s.loads);
  const ref = item.code ?? null;
  /* A6-T1 — tytuł i opis w aktywnym języku (klucz słownika + parametry), bez klucza tekst zapisany */
  const title = riskText(locale, item.title, item.titleKey, item.titleParams);
  if (isTechnicalRoadNotice(title) || isTechnicalRoadNotice(item.title)) return null;
  const load = item.loadId ? loads.find((l) => l.id === item.loadId) : undefined;
  /* E41 (P2): nazwa z jednej funkcji, potem pauza i tytuł. */
  const line = (load || ref)
    ? transportCaseTitle(load ?? { code: ref ?? '', hhlOrderNo: null, carrierOrderNo: null }, role, title)
    : title;
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
          <span className="code" data-content>{line}</span>
        </span>
        <span className="m" data-content>{meta}</span>
      </span>
      <span className="age">{formatExqAge(item.ageHours)}</span>
    </li>
  );
}
