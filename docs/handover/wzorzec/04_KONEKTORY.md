# KONEKTORY I USŁUGI ZEWNĘTRZNE

> Zasada: **przed podpięciem — regulamin** (użytek komercyjny, śledzenie pojazdów,
> przechowywanie wyników, podanie źródła), potem darmowy limit i plan awaryjny.

## Infrastruktura
| Usługa | Rola | Plan | Status | Uwagi |
|---|---|---|---|---|
| Supabase `nglnnrmzmhusvxslousq` (UE, Irlandia) | baza, logowanie, funkcje Edge, pliki | Free | ✅ | jeden projekt = test i produkcja; 500 MB; usypia po 7 dniach bez ruchu → keep-alive |
| Vercel | hosting frontu | Hobby | ✅ | `tower.log-mar.pl`; podglądy za logowaniem Vercel, tylko dane demo |
| Cloudflare Pages | hosting zapasowy | Free | ✅ | `tower-hhl.pages.dev` |
| Cloudflare R2 + Workers | kopia zapasowa (`tower-backup-writer`: tylko PUT), keep-alive co 6 h | Free | ⚠️ | **kopia 29.09 zawieszona** |
| Resend | e-maile (logowanie, powiadomienia) | Free | ✅ | 100/dobę, 3 000/mies.; domena `log-mar.pl` |
| CT8 | DNS domeny | — | ✅ | CNAME do Vercel |
| GitHub | repozytorium prywatne | Free | ✅ | Actions nie ruszył (rozliczenia) — bramy działają lokalnie przed pushem |

## Dane zewnętrzne
| Źródło | Do czego | Licencja / warunki | Status |
|---|---|---|---|
| NBP API | kurs EUR/PLN, tabela A | publiczne | ✅ zadanie 10:30 i 14:30 |
| Digitraffic Marine (Fintraffic) | pozycje AIS promów (Wawel MMSI 311852000, Nova Star 311000787) | otwarte | ✅ co 10 min · **nie widzi okolic Gdańska** |
| Strona komunikatów armatora POLSCA Baltic Ferries | odwołania i zmiany rejsów | `robots.txt` dopuszcza; **za Cloudflare** — 403 przy minimalnym nagłówku | ⏳ włączyć (II-5) |
| OKQ8 — plik historii cen firmowych | SEFS, SEK — kolumna „Diesel" (cena listowa) | publiczne | ⏳ I-31 |
| Orlen — API cen hurtowych `tool.orlen.pl` | SEFS, PLN — Ekodiesel, zł/m³ ÷ 1000 | publiczne | ⏳ I-31 |
| FMI, DMI, SMHI | pogoda morska Bałtyk | CC BY 4.0 — podać źródło | ✅ II-8 (`ferry-weather`, 0124) |
| IMGW | ostrzeżenia sztormowe, Zatoka Gdańska | **użycie gospodarcze wymaga umowy** — pominięte (RAPORT_POGODA_MORSKA) | ❌ nie |
| Trafikverket | drogi SE: nawierzchnia, zdarzenia | darmowe, klucz | ⏳ klucz od właściciela |
| KPD GDDKiA | drogi PL, DATEX II | rejestracja firmy + certyfikat | ⏳ właściciel |
| OpenStreetMap | korytarz trasy dla silnika ETA | ODbL — „© OpenStreetMap contributors" | ⏳ II-7 |
| Microsoft Graph → SharePoint KSH | harmonogram w obie strony | `Sites.Selected`, zgoda IT KSH | ⏳ D-32 |
| Bramka SMS — własna aplikacja na Androidzie | **SMS tylko do KSH** (zbliżające się auto) | — | ⏳ telefon (D-4) |
| **emtrack.eu** (przewoźnik) | pozycje aut przez API | do sprawdzenia po otrzymaniu dokumentacji | ⏳ dokumentacja od właściciela |
| Linki śledzenia podwykonawców | pozycja lub podgląd | zależnie od systemu | ⏳ przykłady od właściciela |
| **Stena Line** Gdynia – Karlskrona | rozkład, komunikaty, statki | **regulamin do sprawdzenia** | ⏳ §3 zlecenia |

## Odrzucone — z powodem
| Usługa | Powód |
|---|---|
| **HERE Routing** | plan podstawowy wyklucza „Asset Management" — także samo liczenie trasy dla pojazdu; wymaga karty, nalicza po limicie |
| **Open-Meteo** | darmowe API wyłącznie do użytku niekomercyjnego |
| **AISStream** | niejasne warunki komercyjne |
| **EU Weekly Oil Bulletin** | nie jest źródłem z umowy SEFS — kod gotowy, wyłączony |
| TomTom | zastąpiony własnym silnikiem (regulaminu pod kątem śledzenia pojazdów nie sprawdzano) |

## Konektory koordynatora (Claude)
| Konektor | Użycie |
|---|---|
| Supabase | **niezależna weryfikacja produkcji** — migracje, uprawnienia, zadania, dane testowe |
| Wyszukiwanie i pobieranie stron | weryfikacja regulaminów, źródeł cen, licencji |
| Środowisko obliczeniowe | analiza plików (cenniki, harmonogram, SEFS), paczki, diagramy |
