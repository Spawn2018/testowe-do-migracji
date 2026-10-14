/**
 * wyglad/P3-b — Kokpit każdej firmy (E9, img/e9-after; telefon: E8 pkt 6 i V5).
 * Komputer: nagłówek „firma · rodzaj · data”, 6 kafelków w 2 kolumnach, w każdym „Strona ›”, stopka (HHL: czas wykrycia).
 * Telefon: nagłówek „Kokpit · firma · rodzaj”, te same kafelki w 2 kolumnach z krótszym opisem, bez „Strona ›”.
 * Kafelek = przycisk (cały klikalny); klasy `kpi`, `k`, `v`, `d` zostają (testy i brama E8).
 */
import type { ReactNode } from 'react';
import type { CockpitTile } from '../../lib/cockpitE9';
import type { NavKey } from '../../lib/permissions';
import { navLabel, t, tp } from '../../i18n/messages';
import type { Locale, RoleId } from '../../types';

export function Cockpit({
  locale,
  role,
  org,
  kind,
  date,
  tiles,
  footer,
  moneyTags,
  onGo,
}: {
  locale: Locale;
  role: RoleId;
  org: string;
  kind: string;
  date: string;
  tiles: CockpitTile[];
  footer?: ReactNode;
  /** Poziom pewności kwoty (G4 z M8) przy kafelku z kwotą. */
  moneyTags?: ReactNode;
  onGo: (tile: CockpitTile) => void;
}) {
  return (
    <section className="panel section-card ck-card" data-cockpit={role}>
      <header className="panel-hd ck-hd">
        <h2>
          <span className="ck-desk">{org}</span>
          <span className="ck-phone">{t(locale, 'p3b_kokpit')}</span>
        </h2>
        <span className="sub">
          <span className="ck-desk">{`${kind} · ${date}`}</span>
          <span className="ck-phone">{`${org} · ${kind}`}</span>
        </span>
      </header>
      <div className="kpis ck-grid">
        {tiles.map((tile) => (
          <button key={tile.id} type="button" className="kpi ck-tile" data-ck={tile.id} onClick={() => onGo(tile)}>
            <span className="ck-top">
              <span className="k">
                <span className="ck-desk">{tile.label}</span>
                <span className="ck-phone">{tile.labelShort}</span>
              </span>
              <span className="ck-go ck-desk" aria-hidden>
                {tile.go ? tp(locale, 'p3b_go', { name: navLabel(locale, tile.go as NavKey, role) }) : '›'}
              </span>
            </span>
            <span className={`v${tile.tone !== 'default' ? ` ${tile.tone}` : ''}`}>
              {tile.valueShort ? (
                <>
                  <span className="ck-desk">{tile.value}</span>
                  <span className="ck-phone">{tile.valueShort}</span>
                </>
              ) : tile.value}
              {tile.of ? <small className="ck-of">{tile.of}</small> : null}
            </span>
            <span className="d">
              <span className="ck-desk">{tile.desc}</span>
              <span className="ck-phone">{tile.descShort}</span>
            </span>
            {tile.money && moneyTags ? <span className="d ck-tags" data-kpi-tags>{moneyTags}</span> : null}
          </button>
        ))}
      </div>
      {footer ? <div className="ck-ft">{footer}</div> : null}
    </section>
  );
}
