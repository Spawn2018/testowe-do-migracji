import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

// implicit: link z zaproszenia (wysłany z przeglądarki admina) musi działać w przeglądarce zaproszonego.
let clientPromise: Promise<SupabaseClient> | null = null;

/** Klient Supabase ładowany leniwie — paczka demo go nie zawiera. */
export function getSupabase(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
      }),
    );
  }
  return clientPromise;
}
