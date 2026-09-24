> **ZASTĄPIONE PRZEZ `MECHANIZM_PIENIEDZY.md`** tam, gdzie się pokrywają.
> Zostawione do historii decyzji.

# D7 — DECYZJA WŁAŚCICIELA I CO Z NIEJ WYNIKA

## Decyzja

Dla każdej ze stron stosowany jest **dokładnie ten sam mechanizm opłaty
paliwowej**. Zasada, źródło cen hurtowych i cały mechanizm są opisane
w plikach projektu.

To zamyka D7 jako pytanie biznesowe. `hybrid_min` jest zamierzony
i działa identycznie po stronie kosztu i przychodu.

Nie mam dostępu do tych plików, więc **nie weryfikuję ich treści sam**.
Zgodność kodu z dokumentem sprawdzasz Ty, ja weryfikuję dowody,
które przyniesiesz.

---

# CO TERAZ JEST DO ZROBIENIA

D7 zmienia się z „decyzja biznesowa" w **„zgodność kodu z dokumentem"**.

## 1. Wskaż dokumenty

Dokładne ścieżki plików, które opisują mechanizm. Jeżeli jest ich kilka
i mówią co innego — napisz to. Dokument obowiązujący jest jeden.

## 2. Tabela zgodności

W `03_PARAMETRY_BIZNESOWE.md`:

| Reguła z dokumentu | Cytat, plik, sekcja | Kod: plik, linia | Zgodne? |
|---|---|---|---|

Obejmij co najmniej: źródło cen hurtowych po stronie polskiej i szwedzkiej,
częstotliwość odczytu, sposób budowy tablic SEFS_SEK i SEFS_PLN, regułę
wyboru `Math.min`, zakres zastosowania wyłącznie do stawki drogowej,
zaokrąglenie, progi, minimum i maksimum.

**Każda niezgodność to osobna pozycja do naprawy**, nie komentarz.

## 3. Ten sam mechanizm to także ten sam moment

To jest miejsce, w którym „ten sam mechanizm" najczęściej psuje się
w praktyce — **nie we wzorze, tylko w dacie, z której bierze się indeks.**

Przewoźnik fakturuje tygodniowo. Klient może być fakturowany w innym
cyklu. Jeżeli mnożnik dla kosztu liczony jest z notowania z dnia faktury
przewoźnika, a mnożnik dla przychodu z dnia faktury do klienta — to są
**dwa różne mnożniki dla tego samego transportu**, mimo identycznego wzoru.
Marża zaczyna dryfować z każdą zmianą cen paliwa i nikt nie wie dlaczego.

Odpowiedz: **z której daty pobierany jest mnożnik** — załadunku, dostawy,
wystawienia faktury? Czy obie strony używają tej samej? Czy mnożnik jest
**zapamiętywany przy transporcie**, czy liczony na nowo przy każdym odczycie?

Prawidłowo: mnożnik ustalany raz dla transportu, z jednej daty, zapisany
jako migawka i używany po obu stronach. Jeżeli jest inaczej — to jest
pozycja do naprawy w fali 3.

## 4. Test niezmiennika

Decyzja właściciela daje coś, co da się **sprawdzić automatycznie**.
Skoro mechanizm jest ten sam po obu stronach, to dla każdego transportu:

- **mnożnik zastosowany po stronie kosztu jest równy mnożnikowi po stronie
  przychodu**
- **procentowy przyrost stawki drogowej jest identyczny po obu stronach**

Test jednostkowy: losowe notowania, losowe stawki, kilka transportów,
różne daty. Jeżeli kiedykolwiek mnożniki się rozejdą, test pęka.

To jest ważniejsze niż wygląda. Za pół roku ktoś dopisze wyjątek
„dla tego klienta inaczej" albo zmieni datę odczytu po jednej stronie.
Bez tego testu nikt tego nie zauważy do pierwszego sporu o fakturę.

**Uwaga do zapisu:** marża **procentowa** całego transportu nie jest stała
przy zmianie cen paliwa, bo mnożnik obejmuje tylko stawkę drogową, a prom
i pilotaż nie. To jest poprawne i wynika z mechanizmu. Niezmiennikiem jest
równość mnożników, nie stałość marży całkowitej. Nie testuj złej rzeczy.

## 5. Pola w ekranie Opcje

Które z pól faktycznie zasilają `computeSefs`: cena bazowa, cena bieżąca,
udział paliwa, próg, krok zaokrąglenia, minimum, maksimum, źródło, adres.

Pola, które nie zasilają niczego, są fasadą — **szczególnie niebezpieczną
w tym miejscu**, bo użytkownik zmieni wartość, zobaczy zapis i uzna,
że zmienił wycenę. Trafiają do D25: podłączyć albo usunąć z ekranu.

---

# BEZ ZMIAN

Pozostałe warunki z `FALA2_PRZEGLAD.md` obowiązują: wyjaśnienie zera
zmian w widoku Ryzyka, próg bezwzględny, zielony stylelint, przydział
pozycji L do fal. D7 nie blokuje już startu fali 3 — punkty 2–5 powyżej
możesz robić równolegle.
