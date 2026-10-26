/**
 * E44 — cron: odczyt pozycji z linku RIO (podwykonawca SCX).
 * Job name w integration_runs: rio-links. Secret nigdy w logach.
 * Zgoda RIO na piśmie — właściciel, 22.10.2026 09:02 (dokument u właściciela).
 */
import { serveJob } from '../_shared/integrations/serve.ts';

serveJob('rio-links');
