# Przełączenie hostingu — Vercel ↔ Cloudflare Pages (ANEKS 4 PR8)

**Stan (27.09.2026 11:30):** Pages `tower-hhl.pages.dev` założone przez właściciela (integracja Git, build z `main`, Preview branches = None, Redirect URL w Supabase). Test przełączenia: 200, 37/37 plików identycznych z buildem lokalnym tego samego commitu, `/download/…` z `Content-Disposition: attachment`. Worker `tower-keep-alive` wdrożony (cron co 6 h). Konfiguracja z API (27.09 ok. 11:38): `production_branch` main, `source.type` github, `preview_deployment_setting` "none", `production_deployments_enabled` true, zmienne produkcyjne tylko `NODE_VERSION`, `VITE_AUTH_MODE`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`. Historycznie Pages czekało na jedno działanie właściciela: autoryzację aplikacji GitHub „Cloudflare Workers and Pages” dla repo `Spawn2018/testowe-do-migracji` (integracji Git nie da się podłączyć z wiersza poleceń; projekt „direct upload” nie daje się potem przepiąć na Git, więc nie został założony).

### Kroki właściciela — Cloudflare Pages z integracją Git (ok. 5 min)
1. https://dash.cloudflare.com → konto właściciela → **Workers & Pages** → **Create** → zakładka **Pages** → **Import an existing Git repository** → **Get started**.
2. **Connect GitHub** → na stronie GitHub: **Only select repositories** → wybrać `Spawn2018/testowe-do-migracji` → **Install & Authorize**.
3. Z powrotem w Cloudflare: wybrać repo → **Begin setup**:
   - Project name: `tower-hhl` · Production branch: `main` · Framework preset: `None`
   - Build command: `npm run build` · Build output directory: `dist`
   - Environment variables (Production): `NODE_VERSION=22`, `VITE_AUTH_MODE=supabase`, `VITE_SUPABASE_URL=https://nglnnrmzmhusvxslousq.supabase.co`, `VITE_SUPABASE_ANON_KEY=<klucz anon>` — **nic więcej, nigdy klucza serwisowego**.
4. **Save and Deploy**. Od tej chwili każdy push do `main` buduje nową wersję; gałęzie inne niż `main` (podglądy) budują się zawsze w trybie demo (`build/authMode.ts`, `CF_PAGES_BRANCH`).
5. Supabase → Authentication → URL Configuration → Redirect URLs: dodać `https://tower-hhl.pages.dev/**`.

## Dlaczego przełączenie jest proste (4.3a)
- Aplikacja to **build statyczny** (`dist/`): HTML + JS + CSS. Brak funkcji Vercel, brak `api/`, `functions/`, middleware (test `tests/hosting-switch.test.ts`).
- `vercel.json` zawiera **tylko nagłówki** dla `/download/*` (używane tylko w trybie demo — build produkcyjny nie ma `/download/`, O2). Ten sam zestaw dla Cloudflare Pages: `public/_headers` (test pilnuje zgodności).
- Routing w adresie po `#` (HashRouter) — żaden host nie potrzebuje przepisań na `index.html`. (`public/vercel.json` z przepisaniem ląduje w `dist/`, host go nie czyta — nieszkodliwy.)
- `/api/trafikverket` działa tylko w serwerze dev/podglądu Vite; na hostingu statycznym aplikacja sama przechodzi na dane przykładowe (Trafikverket na produkcji — przez Supabase Edge `road-se`).
- Dane, logowanie, pliki, zadania: Supabase (niezależne od hostingu). Keep-alive: Cloudflare Worker `workers/keep-alive`.

## Ustawienia builda (oba hosty)
| | Vercel | Cloudflare Pages |
|---|---|---|
| Polecenie | `npm run build` | `npm run build` |
| Katalog wyjściowy | `dist` | `dist` |
| Node | 22 | 22 (`NODE_VERSION=22`) |
| Zmienne (produkcja) | `VITE_AUTH_MODE=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | te same |
| Gałąź produkcyjna | `main` (build z innej gałęzi przerywa `build/authMode.ts`) | `main` |
| Podglądy | zawsze tryb demo (A5-PODGLADY, `VERCEL_ENV`) | ustawić `VITE_AUTH_MODE=demo` dla środowiska Preview |

Nigdy nie wpisywać klucza `service_role` w zmienne hostingu (test `3c`).

## Procedura przełączenia (ok. 15 min + propagacja DNS)
1. Cloudflare Pages: projekt z repo, ustawienia jak wyżej; poczekać na zielony build i sprawdzić adres `*.pages.dev` (logowanie linkiem, lista transportów, `/download/…` pobiera plik).
2. Supabase → Authentication → URL Configuration: dodać nowy adres do **Redirect URLs** (inaczej link logowania nie wróci do aplikacji); Site URL zmienić dopiero po przełączeniu DNS.
3. DNS domeny u właściciela: rekord CNAME domeny → `<projekt>.pages.dev` (albo → `cname.vercel-dns.com` przy powrocie). TTL obniżyć do 300 s dzień wcześniej.
4. Po propagacji: Site URL w Supabase = domena; sprawdzić logowanie, zdjęcie kierowcy (link z tokenem), pobranie PDF.
5. Stary host zostawić włączony 7 dni (powrót = zmiana CNAME).

## Test przełączenia (do wykonania przy wdrożeniu)
- ten sam commit na obu hostach → identyczne pliki `dist/` (porównać `sha256sum` `index.html` i `assets/*`);
- `curl -I https://<host>/download/tower-makieta.html` → **404 bez `Content-Disposition`** na obu (O2: build produkcyjny `VITE_AUTH_MODE=supabase` nie zawiera makiety ani `/download/`, `build/prodStrip.ts`, test `tests/o2-prod-strip.test.ts`; w trybie demo makieta zostaje);
- logowanie linkiem z e-maila z nowego adresu (po kroku 2).

## Działania właściciela
Konto Vercel (plan darmowy) i/lub Cloudflare Pages, domena i DNS, Redirect URLs w Supabase.

## Adres produkcyjny tower.log-mar.pl (27.09.2026)
- DNS domeny `log-mar.pl`: serwery `dns1.ct8.pl` / `dns2.ct8.pl` (panel CT8), serwery nazw **nie** przeniesione do Vercel (4.3c). Brak rekordu CAA. Rekord wieloznaczny `*.log-mar.pl` wskazuje serwer CT8 — jawny rekord `tower` go nadpisuje.
- Vercel: `tower.log-mar.pl` dodany do projektu `watch-tower-makieta` (zespół `sebastianbozekq-7781s-projects`), własność domeny potwierdzona (`verified: true`, bez rekordu TXT).
- **Rekord u właściciela (CT8):** `tower  CNAME  c8ddf203a73a39c2.vercel-dns-017.com.` (wartość z `vercel domains verify`; zapasowo Vercel podaje `cname.vercel-dns.com.` albo `A 76.76.21.21`).
- Supabase (Authentication → URL Configuration, przez Management API): Site URL `https://tower.log-mar.pl`; Redirect URLs: `https://watch-tower-makieta.vercel.app/**`, `http://localhost:5173/**`, `https://tower-hhl.pages.dev/**`, `https://tower.log-mar.pl/**`.
- **Uwaga:** produkcja Vercel serwuje dziś build demonstracyjny sprzed 3 dni (makieta bez logowania, 0 odwołań do Supabase w pakiecie). Po dodaniu CNAME `tower.log-mar.pl` pokaże tę makietę, dopóki właściciel nie zgodzi się na wdrożenie wersji produkcyjnej na Vercel (O2). Pages `tower-hhl.pages.dev` serwuje już build produkcyjny.
- Sprawdzenie po propagacji: `bash scripts/check-domain.sh` (DNS, certyfikat: wystawca/daty/SAN, 200, tytuł, http→https, `/download/…`); logowanie linkiem wyłącznie na konto właściciela: `SEND_LOGIN=1 LOGIN_EMAIL=Sebastian@log-mar.pl bash scripts/check-domain.sh`, po kliknięciu `CHECK_LOGIN_SINCE='<czas z wyjścia>' LOGIN_EMAIL=Sebastian@log-mar.pl bash scripts/check-domain.sh` (odczyt `auth.users.last_sign_in_at`).

## Awaria Vercel → tower.log-mar.pl na Cloudflare Pages
Warunek: Pages `tower-hhl` buduje `main` przy każdym pushu (jest), więc zapas ma zawsze bieżącą wersję.

| # | Kto | Krok | Czas |
|---|---|---|---|
| 0 | właściciel (zawczasu, raz) | W CT8 obniżyć TTL rekordu `tower` do **300 s** (i zostawić tak na stałe) | — |
| 1 | my | Krótkie logowanie Cloudflare (`npx -y -p node@22 -p wrangler@latest -- wrangler login`, kliknięcie „Allow” przez właściciela) albo panel: Workers & Pages → `tower-hhl` → **Custom domains** → **Set up a custom domain** → `tower.log-mar.pl` → dalej. (Wrangler nie ma polecenia domen Pages — w panelu albo przez API `POST /accounts/{id}/pages/projects/tower-hhl/domains` z `{"name":"tower.log-mar.pl"}`.) | 2–5 min |
| 2 | właściciel | W CT8 zmienić wartość `tower` CNAME z `c8ddf203a73a39c2.vercel-dns-017.com.` na **`tower-hhl.pages.dev.`** (TTL 300) | 2 min |
| 3 | Cloudflare | Weryfikacja domeny (po CNAME) i wystawienie certyfikatu przez Pages | zwykle kilka do kilkunastu minut |
| 4 | — | Propagacja: stary wpis wygasa w cache resolwerów po TTL | do 300 s (5 min) |
| 5 | my | Supabase: nic nie trzeba zmieniać — Site URL `https://tower.log-mar.pl` i Redirect `https://tower.log-mar.pl/**` są niezależne od hostingu. (Gdyby na czas awarii używać adresu `tower-hhl.pages.dev`, jest już w Redirect URLs.) | — |
| 6 | my | `bash scripts/check-domain.sh` z `EXPECT_CNAME=tower-hhl.pages.dev` (certyfikat, 200, tytuł) i logowanie linkiem na konto właściciela | 5 min |
| 7 | my | `wrangler logout`, potem `wrangler whoami` → w raporcie dosłownie „You are not authenticated…” | 1 min |

**Razem: ok. 15–30 min** od decyzji (najdłużej trwa certyfikat Pages). Powrót na Vercel: CNAME z powrotem na `c8ddf203a73a39c2.vercel-dns-017.com.` (domena zostaje przypięta w Vercel), po 5 min. Domenę w Pages można zostawić przypiętą — nie przeszkadza.
