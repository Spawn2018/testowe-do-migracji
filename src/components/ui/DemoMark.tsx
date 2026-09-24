import { useTowerStore } from '../../store/useTowerStore';
import { t } from '../../i18n/messages';

/** Panel header mark — Options `panel-mark` chrome; D3/D18 demo badges (toggle: showDemoMarks). */
export function DemoMark(props?: { title?: string; label?: string }) {
  const show = useTowerStore((s) => s.showDemoMarks);
  const locale = useTowerStore((s) => s.locale);
  if (!show) return null;
  return (
    <span
      className="panel-mark demo-mark"
      title={props?.title ?? t(locale, 'demo_mark_title')}
      data-demo-mark="1"
    >
      {props?.label ?? t(locale, 'demo_mark')}
    </span>
  );
}
