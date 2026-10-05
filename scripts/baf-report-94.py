#!/usr/bin/env python3
"""Raport 94 transportów (BAF 0187) z wyjścia `node scripts/m0187-migrate.mjs report-prod` (JSON w ostatniej linii)."""
import json, sys, datetime
src, out = sys.argv[1], sys.argv[2]
line = [l for l in open(src, encoding='utf-8').read().splitlines() if l.startswith('[{')][-1]
rows = json.loads(line)
def d(v):
    if not v: return '—'
    # pg zwraca date jako północ Europe/Warsaw w UTC (…T22:00Z / T23:00Z) → data lokalna
    t = datetime.datetime.fromisoformat(v.replace('Z', '+00:00'))
    return (t + datetime.timedelta(hours=3)).date().isoformat()
def n(v, k=2):
    return '—' if v in (None, '') else f"{float(v):,.{k}f}".replace(',', ' ').replace('.', ',')
priced = [r for r in rows if r['cost_total']]
L = ['# Raport BAF 0187 — 94 transporty: stawka, mnożnik, koszt, przychód', '',
     f'Źródło: produkcja `nglnnrmzmhusvxslousq` po migracji 0187 (`scripts/m0187-migrate.mjs report-prod`), czas Europe/Warsaw.', '',
     '- Mnożnik tygodnia **40** (załadunki 28.09–04.10, średnia z publikacji 21–27.09): **1,14** (SEK 23,04 → 1,14; PLN 7,41 → 1,17)',
     '- Mnożnik tygodnia **41** (załadunki 05–11.10, średnia z publikacji 28.09–04.10): **1,13** (SEK 22,63 → 1,13; PLN 7,22 → 1,15)',
     '- Dopłata = stawka drogowa × (mnożnik − 1); bez dopłaty na anulowaniu i postojach. Stawka z wymiarów **ładunku** (shipment_items).',
     '- OSTATECZNY = tydzień poprzedni zamknięty (migawka); WSTEPNY = szacunek z ostatniej publikacji, przeliczany co 6 h do zamknięcia tygodnia.', '',
     f'Wycenione: **{len(priced)}/{len(rows)}**; koszt razem **{n(sum(float(r["cost_total"]) for r in priced))} EUR**, przychód razem **{n(sum(float(r["rev_total"]) for r in priced))} EUR**.', '',
     '| # | Zlecenie | Wysyłka | Wymiary ładunku L×W×H m / t | Załadunek | Symbol | Stawka koszt | Stawka przychód | Mnożnik | Status | Koszt (z BAF) | Przychód (z BAF) | Uwagi |',
     '|---|---|---|---|---|---|---|---|---|---|---|---|---|']
for i, r in enumerate(rows, 1):
    note = []
    if r.get('height_adopted') == 'true': note.append('wys. przyjęta 2,45 (decyzja właściciela)')
    if r.get('convoy'): note.append(f"konwój KR {r['convoy']}")
    if not r['cost_total']:
        note.append({'NO_CONVOY': 'wycena wstrzymana: KR bez daty załadunku → brak liczby konwoju (stawka 1/2/3 auta)'}.get(r['reason'], r['reason'] or 'brak mnożnika'))
    dims = f"{n(r['length_m'])}×{n(r['width_m'])}×{n(r['height_m'])} / {n(r['weight_t'],1)}"
    L.append(f"| {i} | {r['order_no'] or r['hhl'] or '—'} | {r['shipment_code']} | {dims} | {d(r['load_date'])} | {r['symbol'] or '—'} | {n(r['cost_rate'])} | {n(r['rev_rate'])} | {n(r['mult'])} | {r['status_mult'] or '—'} | {n(r['cost_total'])} | {n(r['rev_total'])} | {'; '.join(note)} |")
open(out, 'w', encoding='utf-8').write('\n'.join(L) + '\n')
print(out, len(rows), len(priced))
