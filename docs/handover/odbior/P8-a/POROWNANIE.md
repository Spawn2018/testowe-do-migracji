# wyglad/P8-a — Opcje › Powiadomienia › Treści wiadomości (E43) — 15.10.2026, 22:35

| Element E43 (`img/e43-after`) | Przed | P8-a |
|---|---|---|
| Ekran w Opcjach | brak (treści w kodzie i w bazie) | Opcje › Powiadomienia › „Treści wiadomości” (po „Kto co dostaje”), napis „ZMIENIA TYLKO ADMINISTRATOR HHL”, odnośnik „Kto co dostaje — Powiadomienia › Kto co dostaje (E11)” |
| Lista | — | grupy: SMS do Śremu i Boden (E42), Ryzyka i decyzje, Transport, Faktury, System, Logowanie; 4 SMS + 28 rodzajów e-maili i wpisów w dzwonku (rodzaje z `notifyTemplates.ts`, L53) + 2 e-maile paczki do księgowości (E40 pkt 7) + 5 e-maili logowania; przy pozycji „domyślna” / „zmieniono [data]” / „niezapisane zmiany”; znacznik SMS / E-MAIL |
| Edytor | — | tytuł, kanał, „Do: …”, „Treść tylko po polsku … (decyzja 22:42)”; e-mail: Temat (= tytuł w dzwonku) i Treść; klocki danych w polu (Backspace usuwa cały klocek, kursor nie wchodzi do klocka) |
| „Wstaw dane” | — | przyciski klocków tej wiadomości; telefon: „Wstaw dane (przewiń w bok)”, pasek przewijany w bok |
| Licznik SMS | — | „✓ 79 / 160 znaków” + „Polskie litery zostaną zamienione…”; dodatkowo: długość przy najdłuższych danych i znaki spoza alfabetu SMS — wtedy zapis zablokowany (E43 „Powyżej 160 znaków zapisu nie ma”) |
| Podgląd | — | „Podgląd na prawdziwym transporcie” z wyborem transportu; brak danej → „—”; kod w e-mailu jak w E41 (HHL z nr zlecenia), w SMS sam kod; przycisk e-maila logowania jako przycisk |
| Przyciski | — | „Zapisz”, „Wyślij próbny SMS na mój numer” / „… e-mail na mój adres”, „Przywróć domyślną treść”, „Zmiana trafia do Historii zmian (kto, kiedy, było → jest)” |
| E-maile logowania | — | przycisk z linkiem w treści, nie do usunięcia (Backspace, Delete, wycinanie); bez niego zapis zablokowany |
| Prawa | — | Administrator HHL zmienia; Operacje HHL — „Tylko podgląd · zmienia Administrator HHL”; KSH i SCX ekranu nie mają |
| Telefon | — | lista → ekran wiadomości z „‹” (nagłówek Opcji chowa się), „Zapisz” + „Próbny SMS”, cele ≥ 44 px, pola 16 px |

Sprawdzone (demo, HHL 1440 / 390 px, jasny i ciemny): axe WCAG 2 A/AA — 0 uwag na ekranie (lista, SMS, e-mail logowania, e-mail o ryzyku); tekst < 12 px — 0; przewijanie strony w bok — 0; brama E8 telefonu (360 / 390 / 430) z otwartą wiadomością — 0 (pasek „Wstaw dane” dopisany do `e8-strips.txt`); klawiatura: jedna pozycja listy w kolejności Tab, strzałki / Home / End po liście, Tab do pola, Enter na „+ …” wstawia klocek i wraca do pola; telefon: po otwarciu fokus na „‹”, po powrocie na pozycji listy; zapis, błąd na właściwym polu (`aria-invalid`, `aria-describedby`), „Przywróć domyślną treść” z fokusem w treści, szkic przy przejściu do innej wiadomości; KSH i SCX — ekranu brak. Produkcja: źródło `null` → treści domyślne tylko do odczytu z napisem „Zmiana treści włączy się po aktualizacji serwera (P8)”.

Odstępstwa od obrazu (świadome): na liście jest każda wiadomość osobno (obraz łączy kilka w jednej linii: „Do decyzji · Decyzja krytyczna”); ekran podaje pełną listę, bo każdą treść edytuje się osobno. Paczki do księgowości (E40 pkt 7) dopisane do grupy Faktury.

Zrzuty: `p8a-sms-1440-light.webp`, `p8a-risk-1440-dark.webp`, `p8a-phone-390.webp` (lista, SMS C, e-mail zaproszenia w ciemnym motywie).
