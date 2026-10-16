/**
 * wyglad/P3-c — model menu Opcji (E11: 6 grup z menu bocznym; E12 pkt 1 i 7; G-11 nazwy ekranów).
 * Tylko wygląd: kto widzi który ekran ustala widok (OptionsView / SettingsView) według prawa konta,
 * a dane ekranów podłącza wykonawca (dopisek do PR wyglad/P3-c).
 */
import type { ReactNode } from 'react';

export type OptGroupId = 'people' | 'notify' | 'money' | 'rules' | 'system' | 'forme';

export type OptScreenId =
  | 'users' | 'logins'
  | 'who' | 'texts' | 'zones' | 'bcast'
  | 'rates' | 'surch' | 'fuel' | 'terms' | 'fact'
  | 'thr' | 'permits'
  | 'status' | 'flags' | 'hist' | 'export'
  | 'account' | 'forme' | 'look' | 'device';

/** Kto zmienia ekran — napis po prawej w nagłówku ekranu (obraz E6: „ZMIENIA TYLKO ADMINISTRATOR HHL”). */
export type OptRight = 'admin' | 'read' | 'own' | 'download' | null;

export type OptTone = 'muted' | 'alert';

export type OptScreen = {
  id: OptScreenId;
  /** Krótki stan przy pozycji menu (obraz E11: „12 aktywnych”, „Boden: brak” na czerwono). Tylko z danych. */
  meta?: string;
  metaTone?: OptTone;
  right?: OptRight;
  /** Oznaczenie danych przykładowych w nagłówku ekranu (tryb demo). */
  mark?: ReactNode;
  body: ReactNode;
};

export type OptGroup = {
  id: OptGroupId;
  /** Stan grupy na kafelku telefonu (obraz E12 „Telefon”: „15 kont · 0 z 2FA”). Bez danych — nazwy ekranów. */
  summary?: string;
  summaryTone?: OptTone;
  screens: OptScreen[];
};

export const GROUP_KEY: Record<OptGroupId, string> = {
  people: 'p3c_g_people',
  notify: 'p3c_g_notify',
  money: 'p3c_g_money',
  rules: 'p3c_g_rules',
  system: 'p3c_g_system',
  forme: 'p3c_g_forme',
};

export const SCREEN_KEY: Record<OptScreenId, string> = {
  users: 'p3c_s_users',
  logins: 'p3c_s_logins',
  who: 'p3c_s_who',
  texts: 'p3c_s_texts',
  zones: 'p3c_s_zones',
  bcast: 'p3c_s_bcast',
  rates: 'p3c_s_rates',
  surch: 'p3c_s_surch',
  fuel: 'p3c_s_fuel',
  terms: 'p3c_s_terms',
  fact: 'p3c_s_fact',
  thr: 'p3c_s_thr',
  permits: 'p3c_s_permits',
  status: 'p3c_s_status',
  flags: 'p3c_s_flags',
  hist: 'p3c_s_hist',
  export: 'p3c_s_export',
  account: 'p3c_s_account',
  forme: 'p3c_s_forme',
  look: 'p3c_s_look',
  device: 'p3c_s_device',
};

export const DESC_KEY: Record<OptScreenId, string> = Object.fromEntries(
  Object.keys(SCREEN_KEY).map((id) => [id, `p3c_d_${SCREEN_KEY[id as OptScreenId].slice('p3c_s_'.length)}`]),
) as Record<OptScreenId, string>;

export const RIGHT_KEY: Record<Exclude<OptRight, null>, string> = {
  admin: 'p3c_r_admin',
  read: 'p3c_r_read',
  own: 'p3c_r_own',
  download: 'p3c_r_download',
};

/** Kolejność 5 rodzajów kont w tabelach (E9, E11). */
export const ACCOUNT_KINDS = ['HHL_ADMIN', 'HHL_OPS', 'CLIENT_USER', 'CARRIER_DISPATCH', 'CARRIER_USER'] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];
