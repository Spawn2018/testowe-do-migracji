/** Ścieżka obiektu Storage z RPC — odrzuca wyjście z katalogu (../). */
const BUCKETS = new Set(['dokumenty', 'zdjecia', 'faktury', 'harmonogramy']);

export function safeStorageTarget(bucket: string, objectPath: string): { bucket: string; objectPath: string } {
  if (!BUCKETS.has(bucket) || bucket.includes('..')) {
    throw new Error('Niedozwolony zasobnik');
  }
  if (
    typeof objectPath !== 'string'
    || objectPath.length === 0
    || objectPath.length > 512
    || objectPath.includes('..')
    || objectPath.includes('\\')
    || objectPath.startsWith('/')
  ) {
    throw new Error('Niedozwolona ścieżka pliku');
  }
  return { bucket, objectPath };
}
