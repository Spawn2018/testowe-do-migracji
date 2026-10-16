import { useMemo, useState } from 'react';
import { useTowerStore } from '../../store/useTowerStore';
import { ORGS } from '../../data/seed';
import { getNowIso } from '../../lib/frozenNow';
import { demoCarrierRating, demoMyRatings, type RatingRange } from '../../lib/carrierRating';
import { transportLabel } from '../../lib/transportName';
import { DemoMark } from '../ui/DemoMark';
import { CarrierRatingPanel } from './CarrierRatingPanel';

/** wyglad/J4 — „Ocena przewoźników” w Kokpicie w demo: liczone z transportów demo, oceny wymyślone (G-09). */
export function CarrierRatingDemo() {
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const loads = useTowerStore((s) => s.loads);
  const [range, setRange] = useState<RatingRange>('all');
  const carrier = role === 'SCX';
  const scxId = ORGS.find((o) => o.kind === 'SCX')?.id ?? null;
  const nowIso = getNowIso();
  const rows = useMemo(() => demoCarrierRating(loads, ORGS, range, nowIso, carrier ? scxId : null), [loads, range, nowIso, carrier, scxId]);
  const mine = useMemo(() => (carrier && scxId ? demoMyRatings(loads, scxId, range, nowIso) : []), [loads, range, nowIso, carrier, scxId]);
  if (role !== 'HHL' && role !== 'SCX') return null;
  const codeOf = (id: string) => {
    const load = loads.find((l) => l.id === id);
    return load ? transportLabel(load, role) : '—';
  };
  return (
    <CarrierRatingPanel
      locale={locale}
      carrier={carrier}
      range={range}
      onRange={setRange}
      rows={rows}
      mine={mine}
      codeOf={codeOf}
      mark={<DemoMark />}
    />
  );
}
