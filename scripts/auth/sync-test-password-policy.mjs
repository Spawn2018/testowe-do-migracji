#!/usr/bin/env node
/**
 * P1 D-20261013-0345-01 L3: ustawienia hasła na TEST = produkcja (tylko odczyt prod, PATCH TEST).
 * Wymaga SUPABASE_ACCESS_TOKEN w .env.local. Nie zapisuje tokenu.
 */
import { loadEnvLocal, PROD_REF, TEST_REF } from './env.mjs';

const env = loadEnvLocal();
const token = env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('Brak SUPABASE_ACCESS_TOKEN w .env.local');

async function authConfig(ref) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await r.json();
  if (!r.ok) throw new Error(`config/auth ${ref} HTTP ${r.status}`);
  return {
    password_min_length: body.password_min_length,
    password_required_characters: body.password_required_characters ?? '',
  };
}

async function patchAuth(ref, patch) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`PATCH config/auth ${ref} HTTP ${r.status} ${JSON.stringify(body).slice(0, 200)}`);
  return body;
}

const prod = await authConfig(PROD_REF);
console.log('PRODUKCJA:', JSON.stringify(prod));
if (prod.password_min_length < 12) {
  console.error('STOP: password_min_length na produkcji < 12 — bez zmiany testu i produkcji');
  process.exit(2);
}

const testBefore = await authConfig(TEST_REF);
console.log('TEST przed:', JSON.stringify(testBefore));

const needPatch =
  testBefore.password_min_length !== prod.password_min_length
  || testBefore.password_required_characters !== prod.password_required_characters;

if (needPatch) {
  await patchAuth(TEST_REF, {
    password_min_length: prod.password_min_length,
    password_required_characters: prod.password_required_characters,
  });
  const testAfter = await authConfig(TEST_REF);
  console.log('TEST po:', JSON.stringify(testAfter));
} else {
  console.log('TEST: już zgodne z produkcją — bez PATCH');
}
