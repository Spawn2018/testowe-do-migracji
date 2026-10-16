import { useEffect, useState } from 'react';
import { getSupabase } from './client';
import { authErrorPl } from './config';
import { useTowerStore } from '../store/useTowerStore';
import { transportLabel } from '../lib/transportName';
import { getNowIso } from '../lib/frozenNow';
import { inRatingRange, rangeDays, type CarrierRatingRow, type CustomRange, type MyRating, type RatingRange } from '../lib/carrierRating';
import { CarrierRatingPanel } from '../components/dash/CarrierRatingPanel';

/**
 * wyglad/J4 — „Ocena przewoźników” w Kokpicie na produkcji (E9). Odczyt jak dotąd w karcie III-9 / D-23
 * (`carrier_scorecard` — HHL wszystkich, przewoźnik swój wiersz; `carrier_ratings` — oceny swoich transportów
 * dla przewoźnika, bez notatki HHL). Tylko build Supabase (chunk leniwy). Przeniesione z Opcji i Ustawień
 * (E11/E12: „ocena przewoźnika to raport, nie ustawienie → Kokpit”).
 */
type ScoreRow = { carrier_org_id: string; carrier_name: string; delivered: number; on_time: number; late_carrier: number; avg_late_min: number | null; avg_score: number | null; ratings: number };

export default function CarrierRatingLive() {
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const loads = useTowerStore((s) => s.loads);
  const [range, setRange] = useState<RatingRange>('all');
  const [custom, setCustom] = useState<CustomRange>({ from: '', to: '' });
  const [rows, setRows] = useState<CarrierRatingRow[] | null>(null);
  const [mine, setMine] = useState<MyRating[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const carrier = role === 'SCX';

  useEffect(() => {
    if (role !== 'HHL' && role !== 'SCX') return;
    let cancelled = false;
    void (async () => {
      const sb = await getSupabase();
      const { from, to } = rangeDays(range, getNowIso(), custom);
      const r = await sb.rpc('carrier_scorecard', { p_from: from, p_to: to });
      if (cancelled) return;
      if (r.error) {
        setErr(authErrorPl(r.error.message));
        setRows([]);
      } else {
        setErr(null);
        setRows(((r.data ?? []) as ScoreRow[]).map((x) => ({
          carrierId: x.carrier_org_id,
          name: x.carrier_name,
          delivered: x.delivered,
          onTime: x.on_time,
          lateCarrier: x.late_carrier,
          avgLateMin: x.avg_late_min,
          avgScore: x.avg_score == null ? null : Number(x.avg_score),
          ratings: x.ratings,
        })));
      }
      if (role === 'SCX') {
        /* okres liczony po dniu rozładunku transportu (jak wiersz karty), nie po dacie oceny — filtr niżej (F7) */
        const m = await sb.from('carrier_ratings').select('load_id,score,rated_at').order('rated_at', { ascending: false }).limit(500);
        if (!cancelled) setMine(((m.data ?? []) as { load_id: string; score: number; rated_at: string }[]).map((x) => ({ loadId: x.load_id, score: x.score, ratedAt: x.rated_at })));
      }
    })();
    return () => { cancelled = true; };
  }, [role, range, custom]);

  if ((role !== 'HHL' && role !== 'SCX') || rows === null) return null;
  const nowIso = getNowIso();
  const mineInRange = mine.filter((m) => inRatingRange(loads.find((l) => l.id === m.loadId), range, nowIso, custom));
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
      custom={custom}
      onCustom={setCustom}
      rows={rows}
      mine={mineInRange}
      codeOf={codeOf}
      error={err}
    />
  );
}
