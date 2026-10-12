# Próbka cen paliw — krok A (do akceptacji właściciela)

Data zebrania: **2026-10-05** (czas warszawski). **Bez zapisu do bazy produkcyjnej.**  
Pliki surowe: `/workspace/fuel-sample-2026-10-05/` (poza gitem).  
Krok B (automat codzienny) **nie** jest budowany do pisemnej akceptacji tej próbki.

---

## 1. Orlen (PLN)

| Pole | Wartość |
|------|---------|
| Adres strony | https://www.orlen.pl/pl/dla-biznesu/hurtowe-ceny-paliw |
| Narzędzie / API strony | Endpoint produktów hurtowych strony ORLEN (odczyt JSON używany przez widok „Hurtowe ceny paliw”; w próbce: `orlen_products.json`, `orlen_ekodiesel_current.json`, `orlen_ekodiesel_byproduct.json`) |
| Nazwa produktu **jak na stronie** | **Olej Napędowy Ekodiesel** (symbol API: `ONEkodiesel`, id 43) |
| Pobrana wartość (bieżąca) | **6943,0000** |
| Jednostka / waluta | **PLN / m³** (hurt; w przeliczeniu na litr: 6,943 PLN/l) |
| Netto / brutto | **Netto** (cennik hurtowy ORLEN — bez VAT w polu `value`) |
| Data i godzina obowiązywania według źródła | `effectiveDate` / `publishFrom`: **2026-10-03T00:00:00** (lokalnie według źródła; bez strefy w JSON) |

### Odczyty z ostatnich dni (ONEkodiesel)

| Data (effectiveDate) | value (PLN/m³) |
|----------------------|----------------|
| 2026-10-03 | 6943 |
| 2026-10-02 | 7280 |
| 2026-10-01 | 7272 |
| 2026-09-30 | 7255 |
| 2026-09-29 | 7363 |
| 2026-09-26 | 7442 |
| 2026-09-25 | 7483 |
| 2026-09-24 | 7342 |
| 2026-09-23 | 7347 |
| 2026-09-22 | 7440 |

Źródło nie zwróciło osobnego wiersza na 2026-09-27/28 w tej próbce (luka weekendowa w `byproduct`).

### Porównanie z przeglądarką

- Tytuł strony w HTML próbki: **„Hurtowe ceny paliw ORLEN \| ORLEN”**.
- Lista produktów w JSON zgadza się z katalogiem na stronie (m.in. Pb95, Pb98, **ONEkodiesel**, ONArctic2, OnEkoterm).
- Surowy cytat z bieżącego odczytu: `{"productName":"ONEkodiesel","effectiveDate":"2026-10-03T00:00:00","value":6943.0000,...}`.

### Regulamin (Orlen) — cytat

Źródło: https://www.orlen.pl/… (zastrzeżenia prawne; plik `orlen_zastrzezenia-prawne.txt` w próbce).

> Wszelkie prawa do całej zawartości serwisu internetowego ORLEN S.A, są zastrzeżone. Użytkownik ma prawo do pobrania oraz drukowania całych stron lub fragmentów serwisu internetowego ORLEN S.A, pod warunkiem nienaruszania praw autorskich oraz praw z rejestracji znaków towarowych należących do ORLEN. **Żadna część serwisu nie może być w celach komercyjnych kopiowana w całości lub części, transmitowana elektronicznie lub w inny sposób, modyfikowana, linkowana lub wykorzystana bez uprzedniej pisemnej zgody ORLEN S.A.**

**Ocena pod kątem zakazu scrapingu:** w zastrzeżeniach **nie ma dosłownego zakazu automatycznego pobierania (scrapingu)**. Jest zakaz **komercyjnego kopiowania / transmitowania / wykorzystywania** treści bez pisemnej zgody. `robots.txt` Orlen: `User-agent: *` / `Disallow:` (puste — nic nie blokuje).  
**Krok B nie startuje** do decyzji właściciela (czy ta klauzula komercyjna blokuje automat Watch Tower).

---

## 2. OKQ8 (SEK)

| Pole | Wartość |
|------|---------|
| Adres strony | https://www.okq8.se/foretag/priser/ |
| Narzędzie | Strona „Priser företagskunder” + plik **Prishistorik** XLSX (`okq8_prishistorik-foretag_2026-10-02.xlsx`, pobrany z tej strony) |
| Nazwa produktu **jak na stronie / w pliku** | **Diesel** (kolumna „Diesel ”; w arkuszu także „Nettopris diesel”) |
| Pobrana wartość (ostatni dzień w historii: 2026-10-02) | **23,14 SEK/l** z VAT (strona / historia brutto); **18,512 SEK/l** netto (`Nettopris diesel`, VAT 25%: 23,14/1,25) |
| Jednostka / waluta | **SEK / litr** |
| Netto / brutto | Strona pokazuje cenę **z VAT** („23,14 kr”); arkusz ma osobno brutto i **Nettopris diesel** |
| Data według źródła | Ostatni wiersz historii w próbce: **2026-10-02**; nazwa pliku historii: `…_2026-10-02.xlsx` |

### Odczyty z ostatnich 7+ dni (Diesel)

| Data | z VAT (SEK/l) | Nettopris (SEK/l) |
|------|---------------|-------------------|
| 2026-10-02 | 23,14 | 18,512 |
| 2026-10-01 | 23,14 | 18,512 |
| 2026-09-30 | 22,09 | 17,672 |
| 2026-09-29 | 22,54 | 18,032 |
| 2026-09-28 | 22,74 | 18,192 |
| 2026-09-27 | 23,34 | 18,672 |
| 2026-09-26 | 23,34 | 18,672 |
| 2026-09-25 | 23,34 | 18,672 |

### Porównanie z przeglądarką

- Tytuł HTML: **„Priser företagskunder \| OKQ8”**.
- Na stronie w komórce Diesla: **„23,14 kr”** (zgodne z 2026-10-02 w historii).
- Link do historii: `Prishistorik` → xlsx jak wyżej.

### Regulamin (OKQ8)

- `robots.txt`: `User-agent: *` / `Disallow: /sok/` (wyszukiwarka) — **brak ogólnego zakazu** pobierania `/foretag/priser/`.
- Strona legalt (`okq8_legalt.html`): **brak ogólnego zakazu scrapingu** w przejrzanym fragmencie; brak klauzuli w stylu Orlen o komercyjnym kopiowaniu w tej próbce.

---

## 3. Pytania do właściciela (akceptacja na piśmie)

1. **Orlen:** czy produkt **Olej Napędowy Ekodiesel** (`ONEkodiesel`) i źródło hurtowe (JSON strony) są właściwe do SEFS? Czy klauzula o komercyjnym kopiowaniu **blokuje** automat (krok B), czy wystarczy User-Agent „Watch Tower” + ręczne awaryjne I-2f?
2. **OKQ8:** czy do średniej SEFS brać **cenę z VAT (23,14)** czy **Nettopris diesel (18,512)**? (Wzorzec I-31 / tydzień 28.09–04.10 = 1,14 był liczony na wartościach ~23 SEK — bliżej brutto.)
3. Po „tak” na piśmie — dopiero krok B (automat codzienny), przed R-3.

