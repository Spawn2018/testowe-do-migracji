/**
 * Minimalny enkoder Flexible Polyline (HERE) — tylko 2D, precision 5.
 * Algorytm: @here/flexpolyline (MIT).
 */
const TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const VERSION = 1;

function encodeUnsigned(val: number): string {
  let num = Math.trunc(val);
  let res = '';
  while (num > 0x1f) {
    res += TABLE[(num & 0x1f) | 0x20];
    num >>= 5;
  }
  return res + TABLE[num];
}

function encodeScaled(value: number): string {
  let num = Math.trunc(value);
  const neg = num < 0;
  num <<= 1;
  if (neg) num = ~num;
  return encodeUnsigned(num);
}

/** Punkty [lat, lon] → ciąg Flexible Polyline (precision 5). */
export function encodeFlexiblePolyline(points: readonly [number, number][], precision = 5): string {
  if (precision < 0 || precision > 15) throw new Error('precision out of range');
  const factor = 10 ** precision;
  const header = encodeUnsigned(VERSION) + encodeUnsigned(precision); // thirdDim=0
  let lastLat = 0;
  let lastLng = 0;
  let body = '';
  for (const [lat, lon] of points) {
    const ilat = Math.round(lat * factor);
    const ilon = Math.round(lon * factor);
    body += encodeScaled(ilat - lastLat) + encodeScaled(ilon - lastLng);
    lastLat = ilat;
    lastLng = ilon;
  }
  return header + body;
}
