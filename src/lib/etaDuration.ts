/**
 * D-071 (zeszyt 8.8, decyzja właściciela 02.10; audyt 17.10 §3.1 pkt 3): czasy przy ETA —
 * „X d Y h Z min” powyżej 24 h, „Y h Z min” poniżej; części równe zero pomijane („1 d 4 h”, „2 h”, „35 min”).
 * Jedno miejsce dla bloku ETA, pigułki opóźnienia, Mapy i Harmonogramu (E21: jeden moduł formatów).
 */
export function etaDuration(minutes: number): string {
  const all = Math.max(0, Math.round(minutes));
  const d = Math.floor(all / 1440);
  const h = Math.floor((all % 1440) / 60);
  const m = all % 60;
  const parts = [d ? `${d} d` : '', h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean);
  return parts.length ? parts.join(' ') : '0 min';
}
