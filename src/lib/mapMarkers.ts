import L from 'leaflet';
import { ferryHeadingDeg, truckArrowDir, type FerrySailing } from './ferry';

/** DivIcon HTML: colored disc + triangle arrow (up/down or rotated by COG). */
export function arrowDotHtml(opts: {
  color: string;
  dir: 'up' | 'down' | number;
  size?: number;
  ring?: string;
}): string {
  const size = opts.size ?? 18;
  const ring = opts.ring ?? '#080F15';
  let transform = 'translate(-50%,-58%)';
  if (opts.dir === 'down') transform = 'translate(-50%,-42%) rotate(180deg)';
  else if (typeof opts.dir === 'number') transform = `translate(-50%,-50%) rotate(${opts.dir}deg)`;
  return `<div class="wt-dot" style="width:${size}px;height:${size}px;background:${opts.color};border:2px solid ${ring}">
    <i class="wt-arrow" style="transform:${transform}"></i>
  </div>`;
}

export function truckDivIcon(status: string, color: string): L.DivIcon {
  const dir = truckArrowDir(status);
  return L.divIcon({
    className: 'wt-marker',
    html: arrowDotHtml({ color, dir, size: 16 }),
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export function ferryDivIcon(color: string, headingOrSailing: number | FerrySailing, stale = false): L.DivIcon {
  const heading =
    typeof headingOrSailing === 'number' ? headingOrSailing : ferryHeadingDeg(headingOrSailing);
  return L.divIcon({
    className: stale ? 'wt-marker wt-marker-ferry wt-marker-ferry-stale' : 'wt-marker wt-marker-ferry',
    html: arrowDotHtml({ color, dir: heading, size: 22, ring: '#DCE7EE' }),
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}
