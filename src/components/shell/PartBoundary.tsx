/**
 * wyglad/P10a-a — E22 pkt 4: zamiast pustej strony, gdy część aplikacji nie wczyta się po wdrożeniu (stary adres
 * pliku) albo przerwie się błędem — komunikat w miejscu tej części; pasek górny i menu zostają.
 * „Ta część aplikacji zmieniła się po aktualizacji · Odśwież stronę, żeby ją otworzyć. Twoje zapisane dane są
 * bezpieczne. · Odśwież”. Ponowienie pobrania pliku (`lazyRetry`) i zgłoszenie błędu — wykonawca (P10a, I-6).
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { a10 } from '../../i18n/p10a';

interface State { failed: boolean }

/** `onError` — część bez własnego miejsca na komunikat (okno): zamiast bloku z „Odśwież” rodzic zamyka ją sam (#594). */
export class PartBoundary extends Component<{ children: ReactNode; name?: string; onError?: () => void }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    /* zgłoszenie do `client_errors` robi globalny reporter (I-6) — tu tylko ślad w konsoli */
    console.error('[część aplikacji]', this.props.name ?? '', error, info.componentStack);
    this.props.onError?.();
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.onError) return null;
    return (
      <div className="part-fail" role="alert" data-part-failed={this.props.name ?? ''}>
        <h2>{a10('a10_part_h')}</h2>
        <p>{a10('a10_part_tx')}</p>
        <button type="button" className="btn" data-part-reload onClick={() => window.location.reload()}>{a10('a10_part_btn')}</button>
      </div>
    );
  }
}
