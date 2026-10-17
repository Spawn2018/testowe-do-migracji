/**
 * wyglad/P3-c — układ Opcji (HHL) i Ustawień (KSH, SCX).
 * Komputer (E11 `img/e11-desk`, E12 `img/e12-after`): menu boczne z 6 grupami po lewej, ekran po prawej
 * (nagłówek „Opcje › grupa”, tytuł, kto zmienia, zdanie o ekranie).
 * Telefon (E12 „Telefon”, E11 `img/e11-phone`): kafelki grup ze stanem → lista ekranów grupy → ekran z „‹”.
 * Tylko nawigacja między ekranami: bez zapisu, bez zmiany roli i uprawnień.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Locale } from '../../types';
import { t } from '../../i18n/messages';
import { DESC_KEY, GROUP_KEY, RIGHT_KEY, SCREEN_KEY, type OptGroup, type OptGroupId, type OptScreen, type OptScreenId } from './types';
import './options.css';

const PHONE_MQ = '(max-width: 768px)';

function usePhone(): boolean {
  const get = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PHONE_MQ).matches;
  const [phone, setPhone] = useState<boolean>(get);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(PHONE_MQ);
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}

type Props = {
  locale: Locale;
  /** „Opcje” albo „Ustawienia”. */
  rootKey: string;
  /** Pod tytułem menu: firma · rodzaj konta (obraz E11: „HHL · administrator”). */
  who?: string;
  groups: OptGroup[];
  /** Ekran wskazany z zewnątrz (menu konta, adres /opcje/…). Zmiana wartości otwiera ekran. */
  request?: { screen: OptScreenId; seq: number } | null;
  /** Znacznik „Zapisano · …” (obecny mechanizm widoku). */
  saved?: ReactNode;
};

/** Aplikacja przewija się w `main`, nie w oknie — na górę ekranu po otwarciu. */
function toTop() {
  if (typeof document === 'undefined') return;
  const m = document.querySelector('main');
  if (m && typeof m.scrollTo === 'function') m.scrollTo({ top: 0 });
  if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') window.scrollTo({ top: 0 });
}

type Level = { kind: 'groups' } | { kind: 'group'; group: OptGroupId } | { kind: 'screen'; screen: OptScreenId };

export function OptionsShell({ locale, rootKey, who, groups, request, saved }: Props) {
  const phone = usePhone();
  const all = useMemo(() => groups.flatMap((g) => g.screens.map((s) => ({ group: g.id, screen: s }))), [groups]);
  const first = all[0]?.screen.id ?? null;
  const [active, setActive] = useState<OptScreenId | null>(request?.screen ?? first);
  const [level, setLevel] = useState<Level>(request ? { kind: 'screen', screen: request.screen } : { kind: 'groups' });
  /* każde wskazanie z zewnątrz obsłużone raz (numer `seq`) — kolejne odświeżenie widoku nie wraca do tego ekranu */
  const handled = useRef(request?.seq ?? 0);

  useEffect(() => {
    if (!request || request.seq <= handled.current) return;
    if (!all.some((x) => x.screen.id === request.screen)) return;
    handled.current = request.seq;
    setActive(request.screen);
    setLevel({ kind: 'screen', screen: request.screen });
    toTop();
  }, [request, all]);

  /* ekran zniknął (np. zmiana roli w Podglądzie) → pierwszy dostępny */
  const current = all.find((x) => x.screen.id === active) ?? all[0] ?? null;

  const open = (id: OptScreenId) => {
    setActive(id);
    setLevel({ kind: 'screen', screen: id });
    toTop();
  };

  const root = t(locale, rootKey);

  if (!current) return null;

  /* jedna grupa (np. Ustawienia KSH i SCX w demo: tylko „Dla mnie”) — od razu lista ekranów, bez zbędnego poziomu */
  const single = groups.length === 1;
  const screenTiles = (g: OptGroup) => (
    <ul className="ox-tiles" aria-label={single ? t(locale, 'p3c_menu') : undefined}>
      {g.screens.map((s) => (
        <li key={s.id}>
          <button type="button" className="ox-tile" data-opt-nav={s.id} onClick={() => open(s.id)}>
            <span className="ox-tile-copy">
              <b>{t(locale, SCREEN_KEY[s.id])}</b>
              <span className={s.metaTone === 'alert' ? 'ox-alert' : undefined}>{s.meta ?? t(locale, DESC_KEY[s.id])}</span>
            </span>
            <span className="ox-chev" aria-hidden="true">›</span>
          </button>
        </li>
      ))}
    </ul>
  );

  if (phone) {
    if (level.kind === 'groups' && single) {
      return (
        <div className="ox ox-phone" data-opt-level="groups" data-opt-group={groups[0].id}>
          <header className="ox-phone-hd"><h1>{root}</h1>{saved}</header>
          {screenTiles(groups[0])}
        </div>
      );
    }
    if (level.kind === 'groups') {
      return (
        <div className="ox ox-phone" data-opt-level="groups">
          <header className="ox-phone-hd"><h1>{root}</h1>{saved}</header>
          <ul className="ox-tiles" aria-label={t(locale, 'p3c_menu')}>
            {groups.map((g) => {
              const names = g.screens.map((s) => t(locale, SCREEN_KEY[s.id])).join(' · ');
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    className="ox-tile"
                    data-opt-group={g.id}
                    onClick={() => (g.screens.length === 1 ? open(g.screens[0].id) : setLevel({ kind: 'group', group: g.id }))}
                  >
                    <span className="ox-tile-copy">
                      <b>{t(locale, GROUP_KEY[g.id])}</b>
                      <span className={g.summaryTone === 'alert' ? 'ox-alert' : undefined}>
                        {g.summaryTone === 'alert' ? <i className="ox-dot" aria-hidden="true" /> : null}
                        {g.summary ?? names}
                      </span>
                    </span>
                    <span className="ox-chev" aria-hidden="true">›</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      );
    }
    if (level.kind === 'group') {
      const g = groups.find((x) => x.id === level.group) ?? groups[0];
      return (
        <div className="ox ox-phone" data-opt-level="group" data-opt-group={g.id}>
          <header className="ox-phone-hd ox-phone-sub">
            <button type="button" className="ox-backbtn" aria-label={t(locale, 'p3c_back')} onClick={() => setLevel({ kind: 'groups' })}>‹</button>
            <h1>{t(locale, GROUP_KEY[g.id])}</h1>
          </header>
          {screenTiles(g)}
        </div>
      );
    }
    const g = groups.find((x) => x.id === current.group)!;
    return (
      <div className="ox ox-phone" data-opt-level="screen">
        <header className="ox-phone-hd ox-phone-sub">
          <button
            type="button"
            className="ox-backbtn"
            aria-label={t(locale, 'p3c_back')}
            onClick={() => setLevel(single || g.screens.length === 1 ? { kind: 'groups' } : { kind: 'group', group: g.id })}
          >‹</button>
          <h1>{t(locale, SCREEN_KEY[current.screen.id])}</h1>
          {saved}
        </header>
        <ScreenFrame locale={locale} root={root} group={g.id} screen={current.screen} phone />
      </div>
    );
  }

  return (
    <div className="ox ox-desk">
      <aside className="ox-side" aria-label={t(locale, 'p3c_menu')}>
        <div className="ox-side-hd">
          <h1>{root}</h1>
          {who ? <span>{who}</span> : null}
        </div>
        {groups.map((g) => (
          <section key={g.id} className="ox-side-group" data-opt-group={g.id}>
            <h2>{t(locale, GROUP_KEY[g.id])}</h2>
            <ul>
              {g.screens.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="ox-side-item"
                    data-opt-nav={s.id}
                    aria-current={s.id === current.screen.id ? 'page' : undefined}
                    onClick={() => open(s.id)}
                  >
                    <span>{t(locale, SCREEN_KEY[s.id])}</span>
                    {s.meta ? <small className={s.metaTone === 'alert' ? 'ox-alert' : undefined}>{s.meta}</small> : null}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </aside>
      <div className="ox-main">
        {saved ? <div className="ox-saved">{saved}</div> : null}
        <ScreenFrame locale={locale} root={root} group={current.group} screen={current.screen} />
      </div>
    </div>
  );
}

function ScreenFrame({ locale, root, group, screen, phone = false }: { locale: Locale; root: string; group: OptGroupId; screen: OptScreen; phone?: boolean }) {
  return (
    <section className="ox-screen" data-opt-screen={screen.id}>
      <header className="ox-screen-hd">
        <div className="ox-screen-title">
          {phone ? null : <h2>{t(locale, SCREEN_KEY[screen.id])}</h2>}
          <span className="ox-crumb">{t(locale, GROUP_KEY[group]) === root ? root : t(locale, 'p3c_crumb').replace('{root}', root).replace('{group}', t(locale, GROUP_KEY[group]))}</span>
          {screen.mark}
          {screen.right ? <span className="ox-right" data-opt-right={screen.right}>{t(locale, RIGHT_KEY[screen.right])}</span> : null}
        </div>
        <p>{t(locale, DESC_KEY[screen.id])}</p>
      </header>
      <div className="ox-screen-bd">{screen.body}</div>
    </section>
  );
}
