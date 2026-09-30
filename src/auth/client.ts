import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

// implicit: link z zaproszenia (wysłany z przeglądarki admina) musi działać w przeglądarce zaproszonego.
let clientPromise: Promise<SupabaseClient> | null = null;

/** Klient Supabase ładowany leniwie — paczka demo go nie zawiera. */
export function getSupabase(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        // AUTH-1: detectSessionInUrl=false — najpierw strona „Dalej” (skanery skrzynek
        // zużywają jednorazowy token z hasha; weryfikacja dopiero po kliknięciu).
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'implicit' },
      }),
    );
  }
  return clientPromise;
}
