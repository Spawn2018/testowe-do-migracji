# PUNKT 6 — Opcje + Automatyzacje

## Zakres

- HHL-only `Opcje` w railu, po `Strefy`, z ikoną SVG w stylu Claude v2.
- `OptionsView` po polsku: preferencje motywu/języka, oferta factoringu, parametry BAF/SEFS, stawki bazowe, aktywacja geostref, preferencje powiadomień i skrót do automatyzacji.
- Wszystkie edycje zapisują się w istniejącym Zustand store (`persist`), a zmiany stref i workflow są od razu widoczne w aplikacji.
- `Automatyzacje → Nowa reguła` otwiera modal w v2 chrome. Formularz zapisuje nazwę, trigger, warunek, akcje i status do `workflows`; nowa pozycja pojawia się na liście i ma działające `Uruchom`.
- Bez React Flow i bez zakresu P7–P11.

## QA

- `npm run build` — PASS
- Screenshot Opcje: `/tmp/wt-p6-opcje.png`
- Screenshot kreatora: `/tmp/wt-p6-wf-create.png`
