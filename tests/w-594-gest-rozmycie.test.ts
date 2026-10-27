import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SWIPE_DISMISS_RATIO, SWIPE_SLOP_PX, swipeAxis, swipeOffset, swipeRelease } from '../src/lib/bellSwipe';

/**
 * #594 B2–B4 (właściciel 27.10, 14:55): telefon — przesunięcie powiadomienia w prawo = odczytane i znika;
 * telefon — tło rozmyte przy otwartym dzwonku; prawy pasek transportu — tło rozmyte.
 */
describe('W-594 gest w dzwonku', () => {
  it('drobny ruch to jeszcze dotknięcie; potem kierunek wg przewagi osi', () => {
    expect(swipeAxis(SWIPE_SLOP_PX - 1, 2)).toBe('none');
    expect(swipeAxis(30, 5)).toBe('x');
    expect(swipeAxis(5, 30)).toBe('y');
    expect(swipeAxis(-30, 4)).toBe('x');
  });

  it('wiersz przesuwa się tylko w prawo', () => {
    expect(swipeOffset(42)).toBe(42);
    expect(swipeOffset(-42)).toBe(0);
  });

  it('próg 40 % szerokości: powyżej usuwa, poniżej wraca', () => {
    expect(SWIPE_DISMISS_RATIO).toBe(0.4);
    expect(swipeRelease(160, 400)).toBe('dismiss');
    expect(swipeRelease(159, 400)).toBe('reset');
    expect(swipeRelease(500, 0)).toBe('reset');
  });

  const bell = readFileSync('src/components/shell/NotificationBell.tsx', 'utf8');
  it('gest tylko dotykiem, usuwa całą grupę jako przeczytaną, przesunięcie nie otwiera powiadomienia', () => {
    expect(bell).toMatch(/e\.pointerType !== 'touch'/);
    expect(bell).toMatch(/onDismiss=\{\(\) => \{ for \(const id of g\.ids\) markNotificationRead\(id\); \}\}/);
    expect(bell).toMatch(/onClickCapture/);
  });

  it('tło pod dzwonkiem: element rozmycia, dotknięcie zamyka', () => {
    expect(bell).toMatch(/className="bell-scrim"[^>]*onPointerDown=\{\(\) => setOpen\(false\)\}/);
  });
});

describe('W-594 rozmycie tła', () => {
  const css = readFileSync('src/index.css', 'utf8');
  const drawer = readFileSync('src/components/drawer/LoadDrawer.tsx', 'utf8');

  it('pasek transportu: tło z rozmyciem na każdej szerokości', () => {
    expect(drawer).toMatch(/className="scrim drawer-scrim"/);
    expect(css).toMatch(/\.drawer-scrim\{[^}]*backdrop-filter:blur\(/);
  });

  it('dzwonek: rozmycie tylko na telefonie (ukryte na komputerze)', () => {
    expect(css).toMatch(/\.bell-scrim\{display:none\}/);
    expect(css).toMatch(/@media \(max-width:768px\)\{\s*\.bell-scrim\{display:block;[^}]*backdrop-filter:blur\(/);
  });

  it('pion przewija listę (touch-action pan-y)', () => {
    expect(css).toMatch(/\.bell-item\{touch-action:pan-y\}/);
  });
});
