import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useTowerStore } from '../../store/useTowerStore';
import { t, tp } from '../../i18n/messages';
import { formatOpsDateTime } from '../../lib/time';
import { trackPositionAt, type TrackPoint } from '../../lib/mapDeclutter';
import { trailForDraw } from '../../lib/map/draw';

/**
 * III-5 (SCOPE 5.13, 0088) — odtwarzanie przebiegu wybranego transportu: pozycje GPS z bazy (load_track, RLS
 * positions_read) jako linia, znacznik przesuwany w czasie (suwak + odtwórz/pauza, ok. 30 s na cały przebieg).
 * Tylko build Supabase, warstwa „Ślad” włączona i wybrany transport. Bez danych — „brak pozycji GPS”, nigdy trasa przykładowa.
 */
const STEPS = 1000;
const NO_TRACK: TrackPoint[] = [];
export default function TrackReplay({ map, loadId, code, noFix = false }: { map: L.Map; loadId: string; code: string; noFix?: boolean }) {
  const locale = useTowerStore((s) => s.locale);
  const [fetched, setTrack] = useState<TrackPoint[] | null>(null);
  /* AUD-01: transport bez żadnej pozycji GPS (wynik latest_vehicle_fixes) — bez zapytania o przebieg. */
  const track = noFix ? NO_TRACK : fetched;
  const [pos, setPos] = useState(STEPS);
  const [playing, setPlaying] = useState(false);
  const layerRef = useRef<{ line: L.Polyline; dot: L.CircleMarker } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (noFix) return () => { cancelled = true; };
    void (async () => {
      const { getSupabase } = await import('../../auth/client');
      const sb = await getSupabase();
      const r = await sb.rpc('load_track', { p_load: loadId });
      if (!cancelled) { setTrack(((r.data ?? []) as TrackPoint[]).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))); setPos(STEPS); setPlaying(false); }
    })();
    return () => { cancelled = true; };
  }, [loadId, noFix]);

  useEffect(() => {
    if (!track || track.length === 0) return;
    const drawn = trailForDraw(track);
    const line = L.polyline(drawn.line.map((p) => L.latLng(p.lat, p.lng)), { color: '#6BA8D6', weight: 3, opacity: 0.9 }).addTo(map);
    const last = track[track.length - 1];
    const dot = L.circleMarker([last.lat, last.lng], { radius: 7, color: '#080F15', weight: 2, fillColor: '#E5A544', fillOpacity: 1 }).addTo(map);
    layerRef.current = { line, dot };
    map.fitBounds(line.getBounds(), { padding: [40, 40], maxZoom: 11 });
    return () => { line.remove(); dot.remove(); layerRef.current = null; };
  }, [map, track]);

  const t0 = track && track.length ? Date.parse(track[0].ts) : 0;
  const t1 = track && track.length ? Date.parse(track[track.length - 1].ts) : 0;
  const at = t0 + ((t1 - t0) * pos) / STEPS;

  useEffect(() => {
    if (!track || !layerRef.current) return;
    const p = trackPositionAt(track, at);
    if (p) layerRef.current.dot.setLatLng([p.lat, p.lng]);
  }, [track, at]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setPos((v) => {
        if (v >= STEPS) { setPlaying(false); return STEPS; }
        return Math.min(STEPS, v + 3);
      });
    }, 90);
    return () => clearInterval(id);
  }, [playing]);

  if (track === null) return null;
  const cur = track.length ? trackPositionAt(track, at) : null;
  const speed = cur ? track[cur.idx]?.speed_kmh : null;
  return (
    <div className="mapkey" data-track-replay={track.length} data-trail-source="points" style={{ zIndex: 600, bottom: 52, flexDirection: 'column', gap: 6, minWidth: 260 }}>
      <b>{tp(locale, 'iii5_title', { code })}</b>
      {track.length === 0 ? (
        <span className="mapkey-note" data-track-empty>{t(locale, 'iii5_empty')}</span>
      ) : (
        <>
          <span className="mapkey-note">{tp(locale, 'iii5_points', { n: String(track.length), a: formatOpsDateTime(track[0].ts), b: formatOpsDateTime(track[track.length - 1].ts) })}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" className="btn ghost" data-track-play onClick={() => { if (pos >= STEPS) setPos(0); setPlaying(!playing); }}>
              {t(locale, playing ? 'iii5_pause' : 'iii5_play')}
            </button>
            <input type="range" min={0} max={STEPS} value={pos} aria-label={t(locale, 'iii5_slider')} data-track-slider
              onChange={(e) => { setPlaying(false); setPos(Number(e.target.value)); }} style={{ flex: 1 }} />
          </div>
          <span className="mono" data-track-at>{formatOpsDateTime(new Date(at).toISOString())}{speed != null ? ` · ${Math.round(Number(speed))} km/h` : ''}</span>
        </>
      )}
    </div>
  );
}
