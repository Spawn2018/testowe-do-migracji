/** B-8-IMP: informacja po imporcie, nie ostrzeżenie. X = przyjęte transporty, Y = pominięte STANDARD. */
import { plPlural } from './plPlural';

export function standardSkipMessage(imported: number, skipped: number): string {
  const transports = plPlural(imported, 'transport', 'transporty', 'transportów');
  const rows = plPlural(skipped, 'wiersz', 'wiersze', 'wierszy');
  return `Zaimportowano ${imported} ${transports}. Pominięto ${skipped} ${rows} typu STANDARD (ładunki NTG — poza zakresem Watch Tower).`;
}
