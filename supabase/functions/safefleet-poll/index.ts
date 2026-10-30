/**
 * #662 — cron: odczyt pozycji z linku tymczasowego SafeFleet.
 * Job name w integration_runs: safefleet-poll. Token nigdy w logach (tylko 6 ostatnich znaków).
 */
import { serveJob } from '../_shared/integrations/serve.ts';

serveJob('safefleet-poll');
