/** PL-DATA — pogoda FMI / DMI / SMHI: opisy i jednostki po polsku. */

const DIRS = [
  'północny',
  'północno-wschodni',
  'wschodni',
  'południowo-wschodni',
  'południowy',
  'południowo-zachodni',
  'zachodni',
  'północno-zachodni',
] as const;

export function windDirectionPl(deg: number): string {
  const n = ((deg % 360) + 360) % 360;
  return DIRS[Math.round(n / 45) % 8];
}

function num(n: number, digits: number): string {
  return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
}

export function formatWavePl(m: number): string {
  return `${num(m, 1)} m`;
}

export function formatTempPl(c: number): string {
  return `${num(c, 1)} °C`;
}

export function formatWindMsPl(ms: number): string {
  return `${num(ms, 1)} m/s`;
}

export function formatGustPl(kn: number): string {
  const ms = kn / 1.943844;
  return `${Math.round(kn)} węzłów (${num(ms, 1)} m/s)`;
}

export function formatMarinePl(s: {
  waveM?: number | null;
  gustKn?: number | null;
  windMs?: number | null;
  tempC?: number | null;
  windDeg?: number | null;
}): string {
  const bits: string[] = [];
  if (s.waveM != null) bits.push(`fala ${formatWavePl(s.waveM)}`);
  if (s.gustKn != null) bits.push(`porywy ${formatGustPl(s.gustKn)}`);
  else if (s.windMs != null) bits.push(`wiatr ${formatWindMsPl(s.windMs)}`);
  if (s.windDeg != null && Number.isFinite(s.windDeg)) bits.push(`wiatr ${windDirectionPl(s.windDeg)}`);
  if (s.tempC != null) bits.push(`temperatura ${formatTempPl(s.tempC)}`);
  return bits.join(', ');
}
