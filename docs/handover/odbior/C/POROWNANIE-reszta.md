# wyglad/C-reszta — nazwy E41, „Dla mnie” (E9/E12), szerokości E20, pasek „Uzupełnij telefon” (E6)

Część wyglądu do „Poprawki P2–P3 (audyt 15.10)” (D-20261015-0300-01 sekcja G, C11). Punkt kontrolny pt 16.10, 20:00.

| Decyzja (artefakt) | Było | Jest |
|---|---|---|
| E41 (08.10 12:14): „Kokpit … Finanse … nazwa według firmy” | Kokpit: „na placu w Boden: SG-03”, OTIF „SG-03 …” | `transportLabel(l, role)`: HHL „SG-03 · nr HHL”, SCX „SG-03 · nr SCX”, KSH „SG-03” (także w Podglądzie) — `e41-kokpit-hhl.png` |
| E41: okno „Dopłata” | „Dopłata · SG-03”, opis postoju z kodem | nazwa według firmy w tytule i w opisie |
| E41: Finanse | lista „Marża poniżej progu”, tydzień opłaty paliwowej — kody | nazwy według firmy; podsumowanie zakresu „bez ceny: KR-08 – KR-15” zostaje zakresem kodów |
| E41: Mapa — podpis znacznika, przebieg, „Najbliższe wyjazdy” | kod | nazwa według firmy |
| E41: Faktury — pole kwoty | etykieta dostępności z kodem | z nazwą (lista już była z nazwą) |
| E9 (tabela: „Opcje › Dla mnie (zamiast »Ustawienia«)”), E12: „KSH i SCX mają tylko »Dla mnie«” | menu i strona „Ustawienia” | „Dla mnie”; okruszek bez powtórzenia („Dla mnie”, nie „Dla mnie › Dla mnie”) — `e9-dla-mnie-ksh.png` |
| E20 pkt 2: „Poniżej 1440 px konto pokazuje same inicjały … Rejsy pokazują statek, godzinę i port wyjścia. Od 1440 px pełne nazwy” | inicjały dopiero poniżej 1100 px; rejs z portem docelowym do 1240 px | 1439 px i mniej: inicjały, „Nova Star · 17:00 · Nynäshamn”; 1440 px: pełne nazwy; pasek 52 px w jednej linii przy 1280, 1366, 1440 — `e20-pasek-1440-1366-1280.png` |
| E6: „Kto nie ma telefonu, po zalogowaniu widzi pasek »Uzupełnij telefon«” (C11) | brak | pasek stanu pod paskiem górnym (jak „Podgląd”, „Działasz jako”, komunikat — E37), czerwony brak jak w liście Użytkowników; „Uzupełnij” otwiera Moje konto; warunek z `my_profile.phone` (bez E.164 → pasek), znika przy „Działaj jako”. W trybie demo nie ma profilu — zrzutu nie ma, test `tests/c-wyglad-reszta.test.ts` |

Bez zmian w tej paczce: „grupa na promie” — grupowania znaczników na promie jeszcze nie ma (E45, P9); liczby promów w Ryzykach są liczbami, bez kodów.

Sprawdzenie (lokalnie, build demo): unit 1063 + nowy `tests/c-wyglad-reszta.test.ts`; Playwright `e8-phone-gate` (69), `e2e-core`, `d-eur-t`, `etap4/5/6-ui` zielone. Tylko wygląd (F8): bez bazy, uprawnień, zapisów i nowych zapytań (pasek telefonu czyta profil już pobrany przy logowaniu).
