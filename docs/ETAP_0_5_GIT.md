# ETAP 0.5 — Zamrożenie w Git (Watch Tower / TOWER)

Data: 23.09.2026 (Europe/Warsaw)

## Skopiowane (cp -a, źródła nietknięte)

| Źródło | Cel | Weryfikacja |
|--------|-----|-------------|
| `/workspace/watch-tower/claude-v2.0/` | `design/claude-v2.0/` | 4 pliki, 216907 B, `diff -rq` OK |
| `/workspace/watch-tower/qa-start/` | `docs/qa-start/` | 192 pliki, 20395026 B, `diff -rq` OK |
| `/workspace/watch-tower-app/*.md` (20 plików) | `docs/*.md` | kopie; oryginały nadal w root app |

Oryginały poza drzewem app: **istnieją** — `/workspace/watch-tower/claude-v2.0` oraz `/workspace/watch-tower/qa-start`.

## Commit / tag

- Kanoniczny wskaźnik: tag annotated **`baseline-2026-09-23`**
- SHA: uruchom `git rev-parse baseline-2026-09-23^{}` (zawarty w tym pliku hash byłby stale po amend — używaj tagu)
- Message: `baseline: wersja wdrożona 23.09.2026, wygląd zamrożony`
- Branch: `master`, working tree clean po baseline

## package-lock.json

**PRESENT — original, not reconstructed.** Istniał w root przed `git init` (mtime Sep 23 12:48 CEST, 127462 B, md5 `2f9ce3e5ad8e80f5cd55d2b603bf6616`). Nie regenerowany (`npm i` / lock rebuild nie uruchamiane).

## Remote / gh

- `gh auth status`: **not logged in** (`You are not logged into any GitHub hosts`)
- `git remote`: **brak**
- Sebastian musi utworzyć prywatne repo i podać URL — bez logowania/inventowania.

## .gitignore

Zawiera co najmniej: `node_modules/`, `dist/`, `.env`, `.env.*`, `!.env.example`, `.vercel/`, `*.log`.
