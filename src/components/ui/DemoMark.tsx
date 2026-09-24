import { DEMO_MARK_PL, DEMO_MARK_TITLE_PL } from '../../lib/demoLabel';

/** Panel header mark — same chrome as Options `panel-mark`, for D3/D18 demo badges. */
export function DemoMark({
  title = DEMO_MARK_TITLE_PL,
  label = DEMO_MARK_PL,
}: {
  title?: string;
  label?: string;
}) {
  return (
    <span className="panel-mark demo-mark" title={title} data-demo-mark="1">
      {label}
    </span>
  );
}
