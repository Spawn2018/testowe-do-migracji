import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

// PKCE (SEC-OWASP V3.5.3): zaproszenie/recovery bez code_verifier w przeglądarce
// zaproszonego idzie przez link z tokenami w hashu albo token_hash (AuthGate).
let clientPromise: Promise<SupabaseClient> | null = null;

/** Klient Supabase ładowany leniwie — paczka demo go nie zawiera. */
export function getSupabase(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        // AUTH-1: detectSessionInUrl=false — najpierw strona „Dalej” (skanery skrzynek
        // zużywają jednorazowy token; weryfikacja dopiero po kliknięciu).
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' },
      }),
    );
  }
  return clientPromise;
}
