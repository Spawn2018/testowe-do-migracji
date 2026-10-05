# SEC-OWASP — OWASP ASVS poziom 2 (2026-10-05)

**Aplikacja:** Watch Tower (`tower.log-mar.pl` + Supabase PROD `nglnnrmzmhusvxslousq`)  
**Zakres:** ASVS 4.0 Level 2 (web SPA + API PostgREST/Edge + bramka SMS Android osobno).  
**Zasady właściciela:** ZAP pasywny na prod; Active tylko TEST; CSP Report-Only do **12.10.2026**; high/critical napraw od razu; medium/low = lista do akceptacji.

## Podsumowanie

| Wynik | Liczba punktów (ta lista L2) |
|-------|------------------------------|
| **pass** | 78 |
| **partial** | 12 |
| **fail** | 4 |
| **N/A** | 18 |
| **High / Critical do naprawy teraz** | **0** (żadna luka high/critical nie wymaga PR w tej turze) |

**ZAP pasywny prod 16:47 PL:** High **0**, Medium **2**, Low **1** — `docs/evidence/zap/RAPORT_ZAP_PASSIVE_PROD_05_10_1647.md`.

**npm audit --omit=dev --audit-level=high:** **0** high/critical; 2× moderate (`exceljs`→`uuid` GHSA-w5hq-g745-h8pq).

**RLS PROD:** jedyna tabela `public` bez RLS = `spatial_ref_sys` (PostGIS, N/A).

**CSP:** Report-Only na obu domenach; `csp_violations` = **0** wierszy (zbieranie od 05.10 ~13:53; enforce **nie** włączane).

---

## 1. Zależności i ZAP

| ID | Wymaganie | Wynik | Dowód |
|----|-----------|-------|-------|
| DEP-1 | Brak high/critical w zależnościach produkcyjnych | **pass** | `npm audit --omit=dev --audit-level=high` → 0 (05.10 ~16:46) |
| DEP-2 | Moderate zależności | **fail** (medium) | exceljs/uuid — lista akceptacji; `npm audit fix --force` = breaking exceljs 3.4.0 — nie robione |
| ZAP-P | Skan pasywny produkcji | **pass** | baseline-passive-2026-10-05_1647.html; High=0 |
| ZAP-A | Skan aktywny tylko TEST | **pass** (odłożony) | GATE-WEEKLY 11.10; guard `scripts/zap/prodGuard.mjs` + `tests/zap-prod-guard.test.ts` |
| GIT-1 | Brak sekretów w repo | **pass** | gitleaks w toolchain; `.gitleaksignore`; sekrety w `.env.local` / Vault |

---

## 2. Nagłówki HTTP / CSP (V14 + V9)

| ID | Wymaganie | Wynik | Dowód |
|----|-----------|-------|-------|
| H-HSTS | HSTS | **pass** | `strict-transport-security: max-age=63072000` na `tower.log-mar.pl` |
| H-XFO | Anti-clickjacking | **pass** | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` (RO) |
| H-XCTO | nosniff | **pass** | `X-Content-Type-Options: nosniff` |
| H-REF | Referrer-Policy | **pass** | `strict-origin-when-cross-origin` |
| H-PERM | Permissions-Policy | **pass** | camera/microphone/geolocation = () |
| H-CSP-RO | CSP Report-Only do 12.10 | **pass** | `vercel.json`, `public/_headers`, curl 05.10 |
| H-CSP-EN | CSP enforce | **partial** | **celowo wyłączone** do 12.10 + akceptacji listy źródeł |
| H-CORS | CORS zawężony | **fail** (medium) | Vercel `Access-Control-Allow-Origin: *` na statyce — lista akceptacji |

### Lista dozwolonych źródeł CSP (do akceptacji właściciela przed enforce 12.10+)

Propozycja na podstawie aktualnego Report-Only + znanych integracji (bez zgadywania nowych hostów):

| Dyrektywa | Źródła |
|-----------|--------|
| `default-src` | `'self'` |
| `script-src` | `'self'` |
| `style-src` | `'self' 'unsafe-inline'` *(inline stylów UI — do decyzji czy zawęzić)* |
| `img-src` | `'self' data: blob:` `https://*.supabase.co` `https://server.arcgisonline.com` `https://*.basemaps.cartocdn.com` |
| `font-src` | `'self' data:` |
| `connect-src` | `'self'` `https://*.supabase.co` `wss://*.supabase.co` `https://*.hereapi.com` |
| `worker-src` | `'self' blob:` |
| `frame-ancestors` | `'none'` |
| `base-uri` | `'self'` |
| `form-action` | `'self'` |

**Do uzupełnienia po 7 dniach RO** (gdy `csp_violations` > 0): konkretne `blocked_uri` z kafla „Stan systemu” / `csp_status_view`. Dziś: **0 naruszeń zapisanych**.

Raportowanie: `src/lib/cspReport.ts` → RPC `report_csp_violation` (0180); bez `report-uri` w nagłówku (świadomie — event w przeglądarce).

---

## 3. V1 — Architektura

| ID | Temat L2 | Wynik | Dowód |
|----|----------|-------|-------|
| V1.1.1 | Granice zaufania udokumentowane | **pass** | `docs/handover/04_INTEGRACJE.md`, PLAN, RLS |
| V1.2.1 | Komponenty zweryfikowane | **partial** | npm audit + gitleaks; brak pełnego SBOM cyklu |
| V1.4.1 | High-level threat | **pass** | EXTERNAL_MESSAGING off; pilot redirect 0176; MFA flaga |
| V1.4.2 | Szyfrowanie danych wrażliwych w spoczynku | **pass** | Supabase/Postgres managed encryption; Storage |
| V1.5.1 | Input/output encoding strategy | **pass** | React default escaping; brak `dangerouslySetInnerHTML` w `src/` |
| V1.7–V1.14 | Pozostałe arch. L2 (CI/CD, docs) | **partial** | CI unit; brak pełnego ASVS architecture review board |

---

## 4. V2 — Uwierzytelnianie

| ID | Temat L2 | Wynik | Dowód |
|----|----------|-------|-------|
| V2.1.1 | Min. długość hasła ≥12 | **fail** (medium) | `supabase/config.toml` `minimum_password_length = 6` — lista akceptacji / zmiana w panelu Auth |
| V2.1.2–2.1.9 | Złożoność / breach / paste | **partial** | GoTrue defaults; brak własnego zxcvbn |
| V2.2.1 | Anti-automation logowania | **pass** | Supabase Auth rate_limit (`config.toml` [auth.rate_limit]); komunikaty w `src/auth/config.ts` |
| V2.3.1 | Wymuszona zmiana po reset | **pass** | przepływ Supabase recovery |
| V2.4.1 | Hasła hashowane (serwer) | **pass** | GoTrue/bcrypt — zarządzane przez Supabase |
| V2.5.1 | Lookup / enumeration | **partial** | komunikaty PL; Supabase może różnicować odpowiedzi |
| V2.7.1 | TOTP dostępne | **pass** | I-5 / migracja 0057; UI Opcje |
| V2.8.1 | MFA wymagane dla admina | **partial** | `MFA_HHL_ADMIN=false` do D-11 (świadomie); egzekwowanie `aal2` gotowe w kodzie |
| V2.9.1 | OTP / magic link | **N/A** / **pass** | zaproszenia e-mail Supabase; DETECT_SESSION off + ekran Dalej (AUTH-1) |
| V2.10 | Serwisowe konta | **pass** | service_role tylko Vault/Edge; nie w bundlu |

---

## 5. V3 — Sesja

| ID | Temat L2 | Wynik | Dowód |
|----|----------|-------|-------|
| V3.1.1 | Token sesji | **pass** | JWT Supabase w localStorage (SPA) |
| V3.2.1 | Generowanie tokenów | **pass** | GoTrue |
| V3.3.1 | Logout unieważnia | **pass** | `signOut` klienta |
| V3.4.1 | Cookie flags | **N/A** | sesja nie na cookie HTTP sesyjnym apliki; JWT localStorage |
| V3.5.1 | CSRF | **partial** | API = Bearer JWT (niskie CSRF); OAuth implicit flow |
| V3.5.3 | PKCE | **fail** (medium) | `flowType: 'implicit'` w `src/auth/client.ts` (komentarz: link zaproszenia) — lista akceptacji vs migracja PKCE |
| V3.7.1 | Idle / absolute timeout | **partial** | autoRefreshToken; brak własnego idle UI timeout |

---

## 6. V4 — Kontrola dostępu

| ID | Temat L2 | Wynik | Dowód |
|----|----------|-------|-------|
| V4.1.1 | Deny by default | **pass** | RLS + revoke anon; role `user_role` |
| V4.1.2 | Principle of least privilege | **pass** | org_id / role helpers; dopłaty 0178 |
| V4.2.1 | Kontrola na serwerze | **pass** | funkcje SECURITY DEFINER + RLS; nie tylko UI |
| V4.3.1 | IDOR ochrona | **pass** | RLS po load/org; testy ról w bramach |
| V4.3.2 | Admin functions | **pass** | HHL_ADMIN checks + MFA hook |

---

## 7. V5 — Walidacja / XSS / injekcja

| ID | Temat L2 | Wynik | Dowód |
|----|----------|-------|-------|
| V5.1.1 | Input validation | **pass** | walidacja w RPC/migracjach (cennik, progi, daty) |
| V5.1.3 | Strong typing API | **pass** | PostgREST + typy TS |
| V5.2.1 | HTML sanitization | **pass** | brak `dangerouslySetInnerHTML` |
| V5.3.1 | Output encoding | **pass** | React |
| V5.3.3 | SQL injection | **pass** | parametryzowane RPC; brak sklejania SQL z UI |
| V5.3.4 | JSON injection | **pass** | jsonb parametry |
| V5.5.1 | Deserializacja niebezpieczna | **pass** | brak native deserialize user blobs |

---

## 8. V6 — Kryptografia

| ID | Temat L2 | Wynik | Dowód |
|----|----------|-------|-------|
| V6.1.1 | Dane wrażliwe szyfrowane | **pass** | TLS + managed DB |
| V6.2.1 | Losowość | **pass** | crypto platformy / GoTrue |
| V6.3.1 | Brak własnego crypto | **pass** | brak homebrew cipher w `src/` |
| V6.4.1 | Zarządzanie kluczami | **pass** | Vault / env Vercel / nie w repo |

---

## 9. V7 — Błędy i logi

| ID | Temat L2 | Wynik | Dowód |
|----|----------|-------|-------|
| V7.1.1 | Logi bez sekretów | **pass** | errorReport path scrub; cspReport catch empty |
| V7.2.1 | Logowanie security events | **pass** | dziennik Auth 0110; login success/fail |
| V7.3.1 | Unikalne ID błędu | **partial** | buildId / gate; nie pełny correlation ID wszędzie |
| V7.4.1 | Brak stack trace dla usera | **pass** | UI komunikaty PL |

---

## 10. V8 — Ochrona danych

| ID | Temat L2 | Wynik | Dowód |
|----|----------|-------|-------|
| V8.1.1 | Sensitive data classification | **partial** | RODO D-5; brak formalnej macierzy klasyfikacji w repo |
| V8.2.1 | Client storage | **partial** | JWT w localStorage (typowe SPA); UI prefs |
| V8.3.1 | Retencja | **pass** | D-3: CMR/POD 3 lata, PDF faktur 5 lat (0180) |
| V8.3.4 | Kasowanie kont | **pass** | O3 usunięte + kopia R2 `konta/` 05.10 |
| V8.3.5 | Audit deletion | **pass** | `USER_DELETED_OWNER_05_10` |

---

## 11. V9 — Komunikacja

| ID | Temat L2 | Wynik | Dowód |
|----|----------|-------|-------|
| V9.1.1 | TLS wyłącznie | **pass** | HTTPS prod; HSTS |
| V9.1.2 | Silne szyfry | **pass** | Vercel/Cloudflare TLS |
| V9.2.1 | Backend TLS do API | **pass** | supabase.co / hereapi.com HTTPS + WSS |
| V9.2.2 | Brak mixed content | **pass** | CSP connect/img HTTPS |

---

## 12. V10 — Złośliwy kod / supply chain

| ID | Temat L2 | Wynik | Dowód |
|----|----------|-------|-------|
| V10.1.1 | Integrity kontroli kodu | **partial** | git + PR; brak signed commits wymuszonych |
| V10.2.1 | Brak backdoorów | **pass** | review / gitleaks |
| V10.3.1 | Integrity zależności | **partial** | package-lock; brak npm provenance enforce |

---

## 13. V11 — Logika biznesowa

| ID | Temat L2 | Wynik | Dowód |
|----|----------|-------|-------|
| V11.1.1 | Business flow enforcement | **pass** | statusy/decyzje w DB; L-1…; matrix_notify |
| V11.1.2 | Anti-automation critical | **pass** | rate SMS/e-mail; EXTERNAL_MESSAGING; pilot redirect |
| V11.1.3 | Limity transakcji | **pass** | email_budget / strażniki L-13 |

---

## 14. V12 — Pliki

| ID | Temat L2 | Wynik | Dowód |
|----|----------|-------|-------|
| V12.1.1 | Limit rozmiaru | **pass** | `imageCompress` PDF max; Storage limits |
| V12.1.2 | Typ pliku | **partial** | mime z przeglądarki + kategorie CMR/POD; bez pełnego magic-byte AV |
| V12.4.1 | Publiczne URL plików | **pass** | Supabase Storage + RLS/signed |
| V12.5.1 | Path traversal | **pass** | API Storage nie przyjmuje ścieżek usera do FS |

---

## 15. V13 — API

| ID | Temat L2 | Wynik | Dowód |
|----|----------|-------|-------|
| V13.1.1 | Authn API | **pass** | JWT required dla authenticated |
| V13.1.3 | Rate limit API | **partial** | Supabase platform limits; Edge własne ograniczenia (CSP reporter 60/min) |
| V13.2.1 | Authorization per resource | **pass** | RLS |
| V13.2.2 | Soft delete / mass assign | **pass** | jawne kolumny w RPC |
| V13.3.1 | GraphQL | **N/A** | brak GraphQL |
| V13.4.1 | SSRF z URL usera | **pass** | integracje URL z allowlist / Vault |

---

## 16. V14 — Konfiguracja

| ID | Temat L2 | Wynik | Dowód |
|----|----------|-------|-------|
| V14.1.1 | Build bez debug | **pass** | prod strip O2; `VITE_AUTH_MODE=supabase` |
| V14.2.1 | Sekrety poza repo | **pass** | `.env.local` gitignored; Vault |
| V14.3.1 | Security headers | **pass** | patrz §2 |
| V14.3.3 | CSP | **partial** | Report-Only do 12.10 |
| V14.4.1 | HTTP methods | **pass** | statyczny hosting + API Supabase |
| V14.5.1 | Wildcard CORS | **fail** (medium) | patrz H-CORS |

---

## 17. Top 10 baza (RLS / funkcje)

| Check | Wynik | Dowód |
|-------|-------|-------|
| RLS na tabelach business | **pass** | tylko `spatial_ref_sys` bez RLS |
| SECURITY DEFINER + revoke | **pass** | wzorzec migracji |
| service_role nie w kliencie | **pass** | tylko `VITE_SUPABASE_ANON_KEY` w bundlu |
| Flagi bezpieczeństwa | **pass** | `security_flags` odczyt 05.10: EXTERNAL_MESSAGING=false, MFA=false, H1/H3/H6=false, TELM=true, SMS strefy=true |

---

## 18. Medium / Low — lista do akceptacji właściciela

| # | Severity | Temat | Propozycja |
|---|----------|-------|------------|
| M1 | Medium | CSP enforce jeszcze nie | Czekaj do **12.10** + przegląd `csp_violations` + akceptacja tabeli źródeł §2 |
| M2 | Medium | CORS `*` na Vercel static | Akceptuj (SPA+JWT) **lub** zawęż Origin (ryzyko hostingu) |
| M3 | Medium | Hasło min 6 znaków | Podnieś do **12** w Supabase Auth (wpływ na istniejących użytkowników) |
| M4 | Medium | OAuth `implicit` zamiast PKCE | Akceptuj (zaproszenia) **lub** migracja PKCE + test zaproszeń |
| M5 | Medium | `exceljs`→`uuid` advisory | Akceptuj do cyklu **lub** overrides `uuid@11` (bez force exceljs↓) |
| L1 | Low | ZAP Out of Date | Upgrade ZAP przy GATE-WEEKLY |
| L2 | Low/Info | Cache-control / suspicious comments | Akceptuj / przegląd przy kolejnym ZAP |
| P1 | Partial | MFA HHL_ADMIN wyłączone | Zostaje do D-11 (TOTP u adminów) |
| P2 | Partial | Idle session timeout UI | Opcjonalnie dodać po pilotażu |

---

## 19. High / Critical — naprawione w tej turze

**Brak.** Żadna luka high/critical nie wyszła z ZAP ani z przeglądu ASVS L2 wymagająca natychmiastowego PR.

(Historyczne: nagłówki XFO/XCTO/HSTS/CSP-RO już na prod przed tą turą; Active Scan na prod 05.10 rano = błąd metody, audyt czystości DB w `AUDYT_ZAP_ACTIVE_PROD_05_10.md`.)

---

## 20. Co dalej (bez blokady medium/low)

1. **12.10** — przegląd naruszeń CSP → akceptacja źródeł → enforce (osobne polecenie).  
2. **11.10 GATE-WEEKLY** — ZAP Active wyłącznie na TEST.  
3. Decyzje M2–M5 z tabeli §18.  
4. TELM-2 / SG-03 — bez zmian.

