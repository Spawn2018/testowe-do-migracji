/** Mapowanie kolumn importu KSH — szablon zapisywany po pierwszym imporcie (D15: bez zależności). */
export const COLUMN_MAP_DEFAULT = {
  shipmentCode: 'Wysyłka',
  itemType: 'Typ',
  dimensions: 'Rozmiar L x W x H',
  unitWeight: 'Waga elementu',
  qty: 'Ilość elementów',
  totalWeight: 'Waga transport [t]',
  loadDate: 'Data załadunku',
  loadTime: 'Godzina (załadunek)',
  driverName: 'Imię i nazwisko kierowcy',
  driverPhone: 'Nr tel. kierowcy',
  orderNo: 'Nr zlecenia',
  deliveryDate: 'Data dostawy na budowę',
  deliveryTime: 'Godzina (rozładunek)',
  // pola, których KSH dziś nie ma — dodane po naszej stronie
  assemblySeq: 'Kolejność montażu',
} as const;
