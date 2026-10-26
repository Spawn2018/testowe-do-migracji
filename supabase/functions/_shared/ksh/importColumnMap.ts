/** Mapowanie kolumn importu KSH — szablon zapisywany po pierwszym imporcie (D15: bez zależności).
 *  A6 / E38: 21 kolumn pliku SharePoint; bez Lp.; bez starego „Nr zlecenia” (orderNo). */
export const COLUMN_MAP_DEFAULT = {
  shipmentCode: 'Wysyłka',
  itemType: 'Typ',
  dimensions: 'Rozmiar L x W x H',
  unitWeight: 'Waga elementu',
  qty: 'Ilość elementów',
  totalWeight: 'Waga transport [t]',
  loadDate: 'Data załadunku',
  loadDay: 'Dzień (załadunek)',
  carrier: 'Przewoźnik',
  loadTime: 'Godzina (załadunek)',
  driverName: 'Imię i nazwisko kierowcy',
  driverPhone: 'Nr tel. kierowcy',
  tractorPlate: 'Nr rej. ciągnika',
  trailerPlate: 'Nr rej. naczepy',
  scxOrderNo: 'Nr zlecenia HHL-Scan',
  deliveryDate: 'Data dostawy na budowę',
  delivDay: 'Dzień (rozładunek)',
  deliveryTime: 'Godzina (rozładunek)',
  hhlOrderNo: 'Nr zlecenia HHL-KSH',
  comment: 'Komentarz',
  /** Opcjonalne — w pliku SharePoint 08.10 nie ma; stare szablony mogą mieć. */
  assemblySeq: 'Kolejność montażu',
} as const;
