import { type ReactNode, useMemo } from 'react';
import { useSectionOrder } from '../../hooks/useSectionOrder';
import { SectionCard } from './SectionCard';

type Section = {
  id: string;
  title: ReactNode;
  sub?: ReactNode;
  mark?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
  className?: string;
  body?: ReactNode;
  children?: ReactNode;
};

/** Reorderable section stack (Android home-screen style via grey header). */
export function PageSections({
  pageKey,
  sections,
  className = '',
}: {
  pageKey: string;
  sections: Section[];
  className?: string;
}) {
  const defaultOrder = useMemo(() => sections.map((s) => s.id), [sections]);
  const { order, move } = useSectionOrder(pageKey, defaultOrder);
  const byId = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);
  const ordered = order.map((id) => byId.get(id)).filter(Boolean) as Section[];

  return (
    <div className={`page-sections ${className}`.trim()}>
      {ordered.map((s) => (
        <SectionCard
          key={s.id}
          id={s.id}
          title={s.title}
          sub={s.sub}
          mark={s.mark}
          actions={s.actions}
          flush={s.flush}
          className={s.className}
          draggableSection
          onSectionDrop={move}
        >
          {s.body ?? s.children}
        </SectionCard>
      ))}
    </div>
  );
}
