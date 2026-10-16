/**
 * wyglad/P10b-d — podgląd pierwszego wejścia w demo (E37 pkt 9): `pierwsze-wejscie=1` — cała ścieżka 4 ekranów
 * dla firmy wybranej w Podglądzie, `pierwsze-wejscie=telefon` — sam krok 3 (konto bez telefonu przy logowaniu).
 * Bez zapisów: hasło, dane i powiadomienia tylko udają zapis. Po „Zaczynam” — Kokpit z „Jak pracuję” otwartym raz.
 * Ładowany leniwie tylko w demo (App.tsx, warunek trybu wpisany wprost — I-0).
 */
import { useCallback, useEffect, useState } from 'react';
import { useTowerStore } from '../store/useTowerStore';
import { viewedKind } from '../lib/cockpitE9';
import { INVITE_STEPS } from '../lib/firstEntry';
import { requestHelpOnce, type FirstEntryDemoMode } from '../lib/firstEntryFlag';
import { enableNotifications, firstEntryReceives, inviteInfo, saveMyDetails, type InviteInfo } from '../lib/firstEntrySource';
import { FirstBrand, FirstEntryFlow } from './FirstEntry';

export default function FirstEntryDemo({ mode, onDone }: { mode: FirstEntryDemoMode; onDone: () => void }) {
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  /* zaproszona osoba: rodzaj konta firmy z Podglądu (HHL — Administrator, KSH — Użytkownik, SCX — Dyspozytor), jak wersja „Jak pracuję” po wejściu */
  const kind = viewedKind(role, null);
  const [invite, setInvite] = useState<InviteInfo | null | undefined>(mode === 'invite' ? undefined : null);
  useEffect(() => {
    if (mode !== 'invite') return undefined;
    let alive = true;
    void inviteInfo(null, kind).then((i) => { if (alive) setInvite(i); });
    return () => { alive = false; };
  }, [mode, kind]);
  const loadReceives = useCallback(() => firstEntryReceives(), []);
  if (invite === undefined) return null;
  const person = invite?.person.split(' ') ?? ['Piotr', 'Zieliński'];

  return (
    <FirstEntryFlow
      locale={locale}
      brand={<FirstBrand />}
      steps={mode === 'invite' ? INVITE_STEPS : ['details']}
      numbered={mode === 'invite'}
      kind={kind}
      invite={invite}
      initial={{ first: person[0] ?? '', last: person.slice(1).join(' '), phone: null }}
      missing={mode === 'phone'}
      onInviteCancel={onDone}
      onPassword={async () => { await new Promise((r) => { setTimeout(r, 300); }); return null; }}
      onSaveDetails={(d) => saveMyDetails(d) ?? Promise.resolve(false)}
      loadReceives={loadReceives}
      onEnable={enableNotifications}
      onDone={() => {
        useTowerStore.getState().setView('dash');
        if (mode === 'invite') requestHelpOnce();
        onDone();
      }}
    />
  );
}
