/**
 * #274 — pomiar Lighthouse: logowanie na telefonie 5,8–6,0 s; największy element to logo (2 × PNG ~260 kB).
 * Ekrany startowy, logowania i doczytania powłoki używają WebP 480 px (≤ 60 kB każdy); PNG zostają dla ikon i manifestu.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';

describe('lekkie logo na ekranach startu i logowania', () => {
  it('pliki WebP istnieją i są małe', () => {
    for (const f of ['public/brand/watchtower-logo-full.webp', 'public/brand/watchtower-logo-full-dark.webp']) {
      expect(statSync(f).size).toBeLessThan(60_000);
    }
  });
  it('index.html, bramka logowania i ekran doczytania nie pobierają już PNG logo', () => {
    for (const f of ['index.html', 'src/auth/BrandLogo.tsx', 'src/App.tsx']) {
      const s = readFileSync(f, 'utf8');
      expect(s, f).not.toMatch(/watchtower-logo-full(-dark)?\.png/);
      expect(s, f).toMatch(/watchtower-logo-full(-dark)?\.webp/);
    }
  });
});
