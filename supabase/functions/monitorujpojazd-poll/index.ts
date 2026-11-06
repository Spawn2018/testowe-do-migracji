/**
 * #837 — cron: odczyt pozycji z linku sledz.monitorujpojazd.pl.
 * Job name w integration_runs: monitorujpojazd-poll. Token nigdy w logach (tylko 6 hex).
 */
import { serveJob } from '../_shared/integrations/serve.ts';

serveJob('monitorujpojazd-poll');
