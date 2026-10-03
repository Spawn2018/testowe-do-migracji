/** B-8-IMP: informacja po imporcie, nie ostrzeżenie. X = przyjęte transporty, Y = pominięte STANDARD. */
export function standardSkipMessage(imported: number, skipped: number): string {
  return `Zaimportowano ${imported} transportów. Pominięto ${skipped} wierszy typu STANDARD (ładunki NTG — poza zakresem Watch Tower).`;
}
