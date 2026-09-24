# C2.4 — test różnicy pikseli (Playwright)

**Status:** Playwright był brakujący w `package.json`; dodany jako `devDependency` (`@playwright/test` ^1.63). Chromium: `npx playwright install chromium` (OK).

## Co jest

| Plik | Rola |
|---|---|
| `playwright.config.ts` | `baseURL http://127.0.0.1:4177`, freeze HashRouter `#/?now=2026-09-23T14:32:00Z`, `deviceScaleFactor: 1`, `maxDiffPixelRatio: 0.001` |
| `tests/visual.spec.ts` | **Smoke** 4 ujęcia: kokpit + mapa, HHL, pl, 1920, light + dark-default |
| `tests/__screenshots__/` | Snapshoty Playwright po pierwszym `test:visual:update` |

## Skrypty npm

```bash
npm run test:visual          # playwright test (wymaga preview na :4177)
npm run test:visual:update   # zapis / odświeżenie snapshotów smoke
```

## Nazwy snapshotów

W teście używamy konwencji `baseline.mjs` (`widok__rola__jezyk__szerokosc__motyw.png`).
Playwright **sanityzuje** `__` → `-` przy zapisie, więc na dysku:

| Test (log) | Plik w `tests/__screenshots__/` |
|---|---|
| `kokpit__hhl__pl__1920__light.png` | `kokpit-hhl-pl-1920-light.png` |
| `kokpit__hhl__pl__1920__dark-default.png` | `kokpit-hhl-pl-1920-dark-default.png` |
| `mapa__hhl__pl__1920__light.png` | `mapa-hhl-pl-1920-light.png` |
| `mapa__hhl__pl__1920__dark-default.png` | `mapa-hhl-pl-1920-dark-default.png` |

## Wzorzec vs pełna matryca

- **Pełna brama / matryca ~720** = C2.3: `scripts/baseline.mjs` → `shots-baseline/` (Puppeteer).
- **C2.4 smoke** = ten sam schemat logiczny nazw, snapshoty w `tests/__screenshots__/` (silnik Playwright ≠ Puppeteer — **nie** nadpisujemy `shots-baseline/` przy update).
- Wzorzec C2.4 = aktualny stan UI (dryf od dziś), nie referencja HTML SoT.
- Playwright was missing; now added. Full gate uses shots from `scripts/baseline.mjs`.

## Pierwszy update / brak baseline

Gdy brak plików w `tests/__screenshots__/`, `toHaveScreenshot` pada z jasnym komunikatem o brakującym snapshocie. Wtedy:

```bash
# preview już na 4177
npm run test:visual:update
npm run test:visual
```

Nie uruchamiać tu pełnej matrycy 720 — to C2.3.

## Smoke (2026-09-23)

- `npm run test:visual:update` → 4 passed (pierwszy zapis snapshotów)
- `npm run test:visual` → 4 passed (~21 s), preview `127.0.0.1:4177`
