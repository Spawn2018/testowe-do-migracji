# Audyt Claude — decyzje właściciela 07–08.10.2026 (folder nadrzędny)

Ten folder zawiera wynik audytu Watch Tower (07–08.10.2026), decyzje właściciela (Sebastian Bożek), rozstrzygnięcia luk i zlecenia paczek.

## Zasada nadrzędna
- Właściciel, 08.10.2026 13:26: „Najświeższe ustalenia poczynione w tym czacie od samego początku są obowiązujące i nadpisują wszelkie starsze decyzje i rozwiązania.”
- Właściciel, 14:43: „nasze postanowienia i plik audyt watch tower są nadrzędne. Wszystko co jest starsze jest nieaktualne i nie może obowiązywać.”

**Kolejność przy sprzeczności:** konstytucja (ze zmianami 08.10) → ten folder → `docs/handover/PLAN.md` → rejestr decyzji → reszta. W tym folderze: decyzje → `ROZSTRZYGNIECIA_LUK.md` → etap → makieta.

## Co czytać
1. `DECYZJE_08_10.md` — decyzje z 08.10 (12:14, 12:50, 12:58, 13:26) i z 09.10 (10:34–11:19, 12:33, 13:09). Decyzje z 07.10 są w plikach etapów i w polach „Twoje decyzje” w `raport/index.html`.
2. `ROZSTRZYGNIECIA_LUK.md` — **wiążące** rozstrzygnięcia 156 luk (niejasności, sprzeczności między etapami, treści sprzed decyzji, brakujące teksty i wartości). Nie pytasz o nie ponownie.
3. `etapy/E<nr>.md` — co zbudować i jak sprawdzić (sekcje „Rozwiązanie / Propozycja / Do wykonania” i „Test”). Każdy plik ma na górze stan na 08.10; linie „Stan: do akceptacji” są historyczne.
4. `makiety_html/E<nr>/` — źródła makiet (wzór wyglądu); `raport/img/` — te same makiety jako obrazy; `raport/index.html` — raport (otwórz w przeglądarce). **W raporcie i w `plan_audytu.html` numery paczek P0–P10 są historyczne — obowiązuje `PLAN.md`.** Makieta E4b (faktoring) jest w `makiety_html/E4b/`.
5. `paczki/` — zlecenia paczek, które wymagają szczegółów poza etapami:
   - `P0a_WGRANIE.md`, `P0a_przeniesienia.sh`, `P0a_lista_archiwum.txt` — wgranie tego kompletu;
   - `P1_E18.md` — porządki danych (sprawdzone na produkcji 08.10).
6. `UZGODNIENIE_08_10.md` — co zastąpiono w rejestrze i starym PLAN, dane właściciela z 13:26, etapy E46–E48 (pkt 5). **Pkt 6 (kolejność paczek) jest historyczny — obowiązuje `PLAN.md`.**
7. `PLAN_OTWARTE_08_10.md` — inwentarz 110 pozycji starego PLAN (historia przypisań).
8. `WYMIARY_PILOT_ZEZWOLENIA.md` — wymiary zestawów, piloci, rodzaj zezwolenia (dane właściciela, 07.10).
9. `plan_audytu.html` — tabela etapów ze statusami: kopia artefaktu „plan audytu” (stan 08.10 po 16:05), **dokument historyczny** (tytuł „aktualny plan pracy Groka” i numery paczek P0–P10 nieaktualne; obowiązuje `PLAN.md`).

## Stan na 08.10.2026
- Etapy E1–E45 zdecydowane; E36 zamknięty w E9; E44 czeka na linki podwykonawców (`PLAN.md` §5 W14; po ich dostarczeniu wchodzi jako uzupełnienie — `ROZSTRZYGNIECIA_LUK.md` L55). *[09.10.2026: nieaktualne — link RIO jest, E44 w P4; niżej „Zmiana 09.10.2026, 14:11”]*
- E46–E48 (wydajność, błędy aplikacji, OWASP) — zlecone przez właściciela 13:26; progi według `UZGODNIENIE_08_10.md` pkt 5.
- Czekają na dane od właściciela (nie są odłożone jego decyzją): dostęp do pliku SharePoint od działu IT KSH (W13), linki podwykonawców (W14 — *zamknięte 09.10*), oficjalne API emtrack (W15) — `PLAN.md` §5.
- **Zmiana 09.10.2026, 01:20 (audyt kompletu):** przywrócone decyzje właściciela w rozstrzygnięciach, termin liczony od startu pracy, brama niedzielna — `ROZSTRZYGNIECIA_LUK.md` (nagłówek) i `PLAN.md` §8.
- **Zmiana 09.10.2026, 14:11 (decyzje właściciela 09.10: 10:34–11:19, 12:33, 13:09):**
  - E44 (link RIO) do realizacji w P4 po E27 — `etapy/E44.md`, `ROZSTRZYGNIECIA_LUK.md` G-24;
  - piloci: wpisuje SCX w awizacji, pola numer rejestracyjny oraz imię i nazwisko, tylko przy „PL + SE”; konwój KR — ci sami piloci (`../dopiski/D-20261009-1233-01.md`, G-23);
  - aktualizacje 1–5 z 13:09: powiadomienia HHL i SCX o zmianie dat z pliku (G-18), grupowanie aut w jednej lokalizacji (G-19), daty zmienia tylko KSH i plik, synchronizacja w obie strony po W13 (G-20), polisy raz (G-21), dopłaty — decyzja HHL i SCX (G-22) — `../dopiski/D-20261009-1309-01.md`;
  - W20 zamknięte (zgody armatorów są), W22 rozstrzygnięte (usunięcie z odpięciem — P1), nowe pytania W26–W31 (`PLAN.md` §5);
  - zmienione pliki: `DECYZJE_08_10.md` (sekcje 09.10), `ROZSTRZYGNIECIA_LUK.md` (E9-2, E9-6, E18-1, L19, L29, L41, L55, G-18–G-24), `UZGODNIENIE_08_10.md` (D-30, D-33, D-42, pkt o kontach „+tower-*”, W14 w pkt 6), `PLAN_OTWARTE_08_10.md` (TELM-2, D-18, D-TELM-ETA), etapy E9, E11 (w `E1-E6_E11-E14.md`), E27, E31, E32, E33, E37, E38, E44, E45, `WYMIARY_PILOT_ZEZWOLENIA.md`, `paczki/P1_E18.md`, `paczki/P0a_WGRANIE.md`, makiety `makiety_html/E32/panel.html`, `E33/ceny.html`, `E38/plik.html`, `E45/mapa.html` (i ich obrazy w `raport/img/`), `raport/index.html` (sekcja „Zmiany 09.10” i E44);
  - zasada: najświeższe postanowienia są nadrzędne (08.10 13:26, 14:43).
- Pliki poufne (polisy, zezwolenia, plik KSH, cenniki) nie są w repozytorium — tylko ich dane w `UZGODNIENIE_08_10.md`.
