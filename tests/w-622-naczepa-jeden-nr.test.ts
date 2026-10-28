import { describe, expect, it } from 'vitest';
import { trailerHasManyPlates } from '../src/lib/p7Awiz';
import { pt } from '../src/i18n/p7';

describe('#622: pole naczepy — jeden numer', () => {
  it('dwa numery (myślnik ze spacjami, ukośnik, przecinek, plus, średnik) → ostrzeżenie', () => {
    for (const v of ['ABC 12345 - XYZ 45A', 'ABC12345-  XYZ45A', 'ABC12345 /XYZ45A', 'ABC12345,XYZ45A', 'ABC12345 + XYZ45A', 'ABC12345; XYZ45A', 'ABC12345 – XYZ45A']) {
      expect(trailerHasManyPlates(v), v).toBe(true);
    }
  });
  it('jeden numer (ze spacją w środku albo myślnikiem bez spacji) i puste → bez ostrzeżenia', () => {
    for (const v of ['ABC 12345', 'ABC12345', 'B-AB 123', 'PO 8T201', '', '  ', null, undefined]) {
      expect(trailerHasManyPlates(v), String(v)).toBe(false);
    }
  });
  it('tekst ostrzeżenia po polsku', () => {
    expect(pt('pl', 'p7_m_trailer_many')).toMatch(/jeden numer naczepy/);
  });
});
