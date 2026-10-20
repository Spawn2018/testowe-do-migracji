# W-faktura-edycja — edycja faktury (A4, D-20261020-0115-01)

Decyzja właściciela 20.10.2026, 01:13: SCX poprawia swoją fakturę do akceptacji przez HHL, HHL swoją do akceptacji przez KSH, po akceptacji tylko Administrator HHL; KSH tylko akceptuje.

- `szczegoly.png` — szczegóły faktury SCX → HHL w widoku Administratora HHL (demo): przycisk „Edytuj fakturę” nad „Sporna / Akceptuj”.
- `edycja.png` — okno edycji: wszystkie pola faktury i pozycje, VAT i brutto liczy system, „Nowy PDF (opcjonalnie)”, „Powód zmiany”, dopisek o skutku zapisu.

Na produkcji przycisk jest ukryty (`INVOICE_EDIT: false`), dopóki wykonawca nie wdroży `update_invoice` (#346); wtedy przestawia klucz w `src/lib/serverRules.ts`.
