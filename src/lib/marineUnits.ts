/** II-8 — jednostki wiatru (m/s ↔ kn). 1 kn = 0,514444 m/s. */
export const MS_TO_KN = 1.943844;

export function msToKnots(ms: number): number {
  return ms * MS_TO_KN;
}

export function knotsToMs(kn: number): number {
  return kn / MS_TO_KN;
}
