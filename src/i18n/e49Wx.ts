/**
 * wyglad/E49 — teksty linii wiatru i zamknięć w szczegółach ETA (pierwsze wczytanie — tylko te zdania).
 */
const pl = {
  e49_wx_WIND: 'Wiatr +{d} · porywy {g} m/s {side} · {where}, {at} · prognoza SMHI',
  e49_wx_side_CROSS: 'z boku',
  e49_wx_side_HEAD: 'z przodu',
  e49_wx_WIND_HOLD: 'Postój przez wiatr {from}–{to} · porywy {g} m/s · {where} · prognoza SMHI',
  e49_wx_SLIPPERY: 'Śliskość +{d} · {where} · Trafikverket',
  e49_wx_CLOSURE_HOLD: 'Postój: {where} zamknięty, do {to} · decyzja SCX',
  e49_wx_DETOUR: 'Objazd +{d} · {where} · decyzja SCX',
  e49_wx_attr: 'Źródło: SMHI (CC BY 4.0), dane przetworzone',
} as const;

export type E49WxKey = keyof typeof pl;

export function e49wx(key: E49WxKey, vars?: Record<string, string | number>): string {
  let s: string = pl[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export const E49_WX_PL = pl;
