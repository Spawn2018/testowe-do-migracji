import { type ReactNode, type DragEvent, type CSSProperties } from 'react';

type Props = {
  id: string;
  title: ReactNode;
  sub?: ReactNode;
  mark?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
  /** Enable Android-home-style drag via grey header */
  draggableSection?: boolean;
  onSectionDrop?: (fromId: string, toId: string) => void;
  style?: CSSProperties;
};

/**
 * Unified section chrome = Opcje → Strefy geograficzne:
 * grey header bar + body, background grows with content (page scrolls).
 */
export function SectionCard({
  id,
  title,
  sub,
  mark,
  actions,
  children,
  className = '',
  bodyClassName = '',
  flush = false,
  draggableSection = false,
  onSectionDrop,
  style,
}: Props) {
  const onDragStart = (e: DragEvent) => {
    if (!draggableSection) return;
    e.dataTransfer.setData('text/wt-section', id);
    e.dataTransfer.effectAllowed = 'move';
    (e.currentTarget as HTMLElement).classList.add('is-dragging');
  };
  const onDragEnd = (e: DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove('is-dragging');
  };
  const onDragOver = (e: DragEvent) => {
    if (!draggableSection) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    (e.currentTarget as HTMLElement).classList.add('is-drag-over');
  };
  const onDragLeave = (e: DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove('is-drag-over');
  };
  const onDrop = (e: DragEvent) => {
    if (!draggableSection) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove('is-drag-over');
    const from = e.dataTransfer.getData('text/wt-section');
    if (from && from !== id) onSectionDrop?.(from, id);
  };

  return (
    <section
      className={`panel section-card ${className}`.trim()}
      data-section={id}
      style={style}
    >
      <header
        className={`panel-hd section-card-hd${draggableSection ? ' is-draggable' : ''}`}
        draggable={draggableSection}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        title={draggableSection ? 'Przeciągnij, aby zmienić kolejność sekcji' : undefined}
      >
        {draggableSection ? (
          <span className="section-grip" aria-hidden>
            ⋮⋮
          </span>
        ) : null}
        <h2>{title}</h2>
        {sub ? <span className="sub">{sub}</span> : null}
        {mark ? <span className="panel-mark">{mark}</span> : null}
        <div className="spacer" />
        {actions}
      </header>
      <div className={`panel-bd section-card-bd${flush ? ' flush' : ''} ${bodyClassName}`.trim()}>
        {children}
      </div>
    </section>
  );
}
