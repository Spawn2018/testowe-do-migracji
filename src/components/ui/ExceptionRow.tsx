import type { ExceptionItem } from '../../types';
import { ROLE_META } from '../../lib/permissions';

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
  const ref = item.code ?? null;
  const titleHasCode = ref ? item.title.includes(ref) : false;
  const meta =
    item.meta ||
    `Odpowiada: ${ROLE_META[item.owner]?.name ?? item.owner}`;

  return (
    <li
      data-sev={item.severity}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      role="button"
      tabIndex={0}
    >
      <span className="gut" />
      <span className="txt">
        <span className="t">
          {ref && !titleHasCode ? (
            <>
              <span className="code">{ref}</span>
              {' · '}
            </>
          ) : null}
          {item.title}
        </span>
        <span className="m">{meta}</span>
      </span>
      <span className="age">{formatExqAge(item.ageHours)}</span>
    </li>
  );
}
