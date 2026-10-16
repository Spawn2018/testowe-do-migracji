# wyglad/P7-b — Przegląd › „Zestaw z ładunkiem” › „Zmień” (E32 pkt 7) — 15.10.2026, 21:25

| Element E32 (`img/e32-after`) | P7-a | P7-b |
|---|---|---|
| „21,69 × 2,45 × 3,75 m [Zmień]” | wartość bez przycisku | „Zmień” obok wartości (tylko HHL — E9 / D-83) |
| Formularz | — | 3 pola w metrach, „Zapisz”, „Anuluj”, „Przywróć z tabeli (SG)” przy własnych wymiarach; Escape zamyka formularz; fokus wraca do „Zmień” |
| Komunikaty | — | zły zapis: „Podaj trzy wymiary w metrach, np. 21,69 × 2,45 × 3,75.”; zakres: „Długość 5–40 m, szerokość i wysokość 1,5–6 m.”; po zapisie: „Zapisano. Zmiana jest w zakładce Historia.” |
| Historia | — | „Zasoby: zestaw z ładunkiem” |

Sprawdzone (demo SG-15; HHL 1440 / 390 px, jasny i ciemny; SCX i KSH bez przycisku): fokus w pierwszym polu po „Zmień”, błąd z `role=alert` i `aria-describedby`, zapis, powrót fokusu, Escape bez zamykania panelu, przewijanie w poziomie 0, tekst < 12 px 0. axe: tylko uwagi znane z P7-a (zakładki, pasek śledzenia — poprawione w #225).

Zrzuty: `p7b-form-1440-hhl-light.webp`, `p7b-form-390-hhl-dark.webp`.
