# Przełączenie hostingu — Vercel ↔ Cloudflare Pages (ANEKS 4 PR8)

**Stan (27.09.2026):** Worker `tower-keep-alive` wdrożony (Cloudflare, cron co 6 h). Cloudflare Pages **czeka na jedno działanie właściciela**: autoryzację aplikacji GitHub „Cloudflare Workers and Pages” dla repo `Spawn2018/testowe-do-migracji` (integracji Git nie da się podłączyć z wiersza poleceń; projekt „direct upload” nie daje się potem przepiąć na Git, więc nie został założony).

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
- `vercel.json` zawiera **tylko nagłówki** dla `/download/*`. Ten sam zestaw dla Cloudflare Pages: `public/_headers` (test pilnuje zgodności).
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
- `curl -I https://<host>/download/tower-makieta.html` → `Content-Disposition: attachment` na obu;
- logowanie linkiem z e-maila z nowego adresu (po kroku 2).

## Działania właściciela
Konto Vercel (plan darmowy) i/lub Cloudflare Pages, domena i DNS, Redirect URLs w Supabase.
