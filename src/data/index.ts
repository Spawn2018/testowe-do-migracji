/** BK3 — publiczny interfejs warstwy danych (SupabaseProvider: import leniwy z `./supabaseProvider`). */
export type { DataMutation, DataProvider, DataSnapshot, ProviderKind } from './provider';
export { DATA_SNAPSHOT_KEYS, emptySnapshot } from './provider';
export { demoProvider, buildDemoSnapshot } from './demoProvider';
export { writeThrough, registerRemoteSink, hasRemoteSink, isServerId } from './registry';
