#!/usr/bin/env node
/**
 * Ustawia szablony e-mail Auth (nadawca / tematy / treść) na „Watch Tower”
 * przez Management API. NIE wysyła wiadomości.
 * Wymaga SUPABASE_ACCESS_TOKEN w .env.local; ref = produkcja.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const PROD = 'nglnnrmzmhusvxslousq';
function loadEnv() {
  const map = {};
  for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    let v = line.slice(i + 1);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    map[line.slice(0, i).trim()] = v;
  }
  return map;
}
const env = loadEnv();
const token = env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('Brak SUPABASE_ACCESS_TOKEN');
  process.exit(2);
}

const body = {
  mailer_subjects_confirmation: 'Watch Tower — potwierdź adres e-mail',
  mailer_subjects_invite: 'Watch Tower — zaproszenie',
  mailer_subjects_magic_link: 'Watch Tower — link logowania',
  mailer_subjects_recovery: 'Watch Tower — reset hasła',
  mailer_subjects_email_change: 'Watch Tower — zmiana e-maila',
  mailer_templates_confirmation_content:
    '<h2>Watch Tower</h2><p>Potwierdź adres e-mail:</p><p><a href="{{ .ConfirmationURL }}">Potwierdź</a></p>',
  mailer_templates_invite_content:
    '<h2>Watch Tower</h2><p>Zaproszenie do systemu:</p><p><a href="{{ .ConfirmationURL }}">Dołącz</a></p>',
  mailer_templates_magic_link_content:
    '<h2>Watch Tower</h2><p>Link logowania:</p><p><a href="{{ .ConfirmationURL }}">Zaloguj</a></p>',
  mailer_templates_recovery_content:
    '<h2>Watch Tower</h2><p>Reset hasła:</p><p><a href="{{ .ConfirmationURL }}">Ustaw hasło</a></p>',
  mailer_templates_email_change_content:
    '<h2>Watch Tower</h2><p>Potwierdź zmianę e-maila:</p><p><a href="{{ .ConfirmationURL }}">Potwierdź</a></p>',
};

const url = `https://api.supabase.com/v1/projects/${PROD}/config/auth`;
const res = await fetch(url, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});
const text = await res.text();
if (!res.ok) {
  console.error('FAIL', res.status, text.slice(0, 800));
  process.exit(1);
}
// verify read-back subjects only (no secrets)
const get = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
const cfg = await get.json();
const keys = Object.keys(cfg).filter((k) => /mailer_subjects|mailer_templates.*_content/.test(k));
console.log('OK status', res.status);
for (const k of Object.keys(body)) {
  const v = cfg[k];
  const ok = typeof v === 'string' && v.includes('Watch Tower');
  console.log(ok ? 'OK' : 'MISS', k, typeof v === 'string' ? v.slice(0, 60).replace(/\n/g, ' ') : v);
}
process.exit(0);
