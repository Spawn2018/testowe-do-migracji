import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { roadSeRepairTitle, roadSeTitleHasForbidden } from '../src/lib/pl/roadSeTitle';

/** 13 otwartych ROAD_SE z produkcji (13.10.2026) — wejście skryptu tytułów. */
export const E18_P15_ROWS = [
  ['0f692878-7193-40f1-88c7-1bd395e8bd7b', 'Zakaz ruchu ciężarówek w Szwecji: E4: od Trafikplats Piteå S do Trafikplats Bergsviken i riktning mot Sundsvall w regionie Norrbottens (BD)', 'roboty', 'från Trafikplats Piteå S till Trafikplats Bergsviken i riktning mot Sundsvall i Norrbottens län (BD)', '2026-08-18T06:51:00.000+02:00', '2026-12-31T16:00:00.000+01:00'],
  ['11178710-936a-4467-8094-aed82675c164', 'Zakaz ruchu ciężarówek w Szwecji: E4: vid Söderköpings kommun  w regionie Östergötlands (E)', 'roboty', 'vid Söderköpings kommun  i Östergötlands län (E)', '2026-09-08T07:14:00.000+02:00', '2028-12-31T16:00:00.000+01:00'],
  ['2025b772-fd9b-4982-9943-712a8cb17756', 'Zakaz ruchu ciężarówek w Szwecji: E4: od Dockstabaren do Skule oba kierunki w regionie Västernorrlands (Y)', 'roboty', 'från Dockstabaren till Skule båda riktningarna i Västernorrlands län (Y)', '2026-09-22T07:00:00.000+02:00', '2026-11-15T16:00:00.000+01:00'],
  ['5429c408-a801-4475-a62d-e233743c15c2', 'Zakaz ruchu ciężarówek w Szwecji: E4: od Trafikplats Stöcksjö do Söderslättsrondellen oba kierunki w regionie Västerbottens (AC)', 'roboty', 'från Trafikplats Stöcksjö till Söderslättsrondellen båda riktningarna i Västerbottens län (AC)', '2026-10-04T18:00:00.000+02:00', '2026-12-31T16:00:00.000+01:00'],
  ['56900281-409c-4410-8121-7a4d1edee0b1', 'Zakaz ruchu ciężarówek w Szwecji: E4: E 4 vid Trafikplats Torsboda II (236), i riktning mot Härnösand.', 'roboty', 'E 4 vid Trafikplats Torsboda II (236), i riktning mot Härnösand.', '2026-08-10T19:00:00.000+02:00', '2026-11-30T16:00:00.000+01:00'],
  ['6dbc5cc9-2d64-4d20-9471-7cf822a4576b', 'Zakaz ruchu ciężarówek w Szwecji: E4: od Trafikplats Levar do Håknäs oba kierunki w regionie Västerbottens (AC)', 'roboty', 'från Trafikplats Levar till Håknäs båda riktningarna i Västerbottens län (AC)', '2026-06-07T18:00:00.000+02:00', '2027-12-31T16:00:00.000+01:00'],
  ['6dbe6576-bf5a-48b0-8393-ff499dbedb03', 'Zakaz ruchu ciężarówek w Szwecji: E4: od Nydalarondellen do Gimonäsrondellen oba kierunki w regionie Västerbottens (AC)', 'roboty', 'från Nydalarondellen till Gimonäsrondellen båda riktningarna i Västerbottens län (AC)', '2026-09-22T07:59:00.000+02:00', '2026-11-30T16:00:00.000+01:00'],
  ['794e5723-71e1-4a1d-b7d6-2f2eace62069', 'Zakaz ruchu ciężarówek w Szwecji: E4: E22 od Trafikplats Karlshamn Ö (53) do Trafikplats Karlshamn V (51) oba kierunki w regionie Blekinge (K)', 'roboty', 'E22 från Trafikplats Karlshamn Ö (53) till Trafikplats Karlshamn V (51) båda riktningarna i Blekinge län (K)', '2026-06-09T06:00:00.000+02:00', '2026-11-01T16:00:00.000+01:00'],
  ['956266ad-13b0-4a0d-b5b0-884b64e40540', 'Zakaz ruchu ciężarówek w Szwecji: E4: od Örnsköldsvik Lasarettsgatan do Örnsköldsviks brandstn oba kierunki w regionie Västernorrlands (Y)', 'roboty', 'från Örnsköldsvik Lasarettsgatan till Örnsköldsviks brandstn båda riktningarna i Västernorrlands län (Y)', '2026-09-20T18:00:00.000+02:00', '2027-01-31T06:00:00.000+01:00'],
  ['a5283700-b2aa-4527-9443-4a90c31f988d', 'Zakaz ruchu ciężarówek w Szwecji: E4: od Backen do Gärde oba kierunki w regionie Gävleborgs (X)', 'roboty', 'från Backen till Gärde båda riktningarna i Gävleborgs län (X)', '2026-04-22T06:57:00.000+02:00', '2026-12-01T16:00:00.000+01:00'],
  ['a6f75610-59a5-4fce-bd08-50ff71fb83bd', 'Zakaz ruchu ciężarówek w Szwecji: E4: od Hörnefors do Stöcksjö oba kierunki w regionie Västerbottens (AC)', 'roboty', 'från Hörnefors till Stöcksjö båda riktningarna i Västerbottens län (AC)', '2026-05-05T05:41:00.000+02:00', '2026-10-15T16:00:00.000+02:00'],
  ['c51aac20-f2c3-4eb9-8a31-b3ab54ff123d', 'Zakaz ruchu ciężarówek w Szwecji: E4: E 4 mellan Vattrång och Harmånger, i båda riktningar.', 'roboty', 'E 4 mellan Vattrång och Harmånger, i båda riktningar.', '2026-04-22T06:55:10.000+02:00', '2026-12-01T16:00:00.000+01:00'],
  ['eb51a481-ba12-4c38-a10c-cbde4b6c3234', 'Zakaz ruchu ciężarówek w Szwecji: E4: od Länsgr. Västerbottens/Norrbottens län vid Kinnbäck do Trafikplats Björkhammar oba kierunki w regionie Västerbottens (AC)', 'roboty', 'från Länsgr. Västerbottens/Norrbottens län vid Kinnbäck till Trafikplats Björkhammar båda riktningarna i Västerbottens län (AC)', '2026-08-03T00:00:00.000+02:00', '2026-12-31T16:00:00.000+01:00'],
] as const;

export function e18P15NewTitle(row: (typeof E18_P15_ROWS)[number]): string {
  return roadSeRepairTitle({
    currentTitle: row[1],
    rodzaj: row[2],
    event: row[3],
    od: row[4],
    doAt: row[5],
  });
}

describe('E18 P15 poprawka tytułów ROAD_SE', () => {
  it('13 tytułów po polsku, bez słów szwedzkich z listy', () => {
    expect(E18_P15_ROWS).toHaveLength(13);
    for (const row of E18_P15_ROWS) {
      const title = e18P15NewTitle(row);
      expect(roadSeTitleHasForbidden(title), title).toBe(false);
      expect(title.startsWith('Warunki drogowe ')).toBe(true);
      expect(title).toContain('roboty drogowe');
      expect(title).not.toContain('zakaz');
      expect(title).not.toContain('Zakaz');
    }
  });

  it('przykład: węzeł, kierunek, region, czas E21', () => {
    const row = E18_P15_ROWS.find((r) => r[0].startsWith('0f692878'))!;
    expect(e18P15NewTitle(row)).toBe(
      'Warunki drogowe E4: roboty drogowe, od węzła Piteå S do węzła Bergsviken, w kierunku Sundsvall, region Norrbotten, od 18.08.2026, 06:51 do 31.12.2026, 16:00',
    );
  });

  it('migracja ma te same stałe tytuły', () => {
    /* 0195 jest nałożona (13.10.2026) i nie zmienia się; rok w datach dodany 16.10.2026 (właściciel) — tytuły w bazie
       poprawia wykonawca po stronie serwera, tu porównujemy treść 1:1 poza samym rokiem. */
    const sql = readFileSync('supabase/migrations/0195_e18_p15_poprawka.sql', 'utf8');
    for (const row of E18_P15_ROWS) {
      const title = e18P15NewTitle(row).replace(/(\d{2}\.\d{2})\.2026\b/g, '$1').replace(/'/g, "''");
      expect(sql).toContain(title);
      expect(sql).toContain(row[0]);
    }
  });
});
