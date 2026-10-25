/**
 * B9 (D-20261019-1515-01) — cron: ponowienie translation_queue (blad/brak; limit od 1. dnia miesiąca).
 * Job name w integration_runs: translate-retry. Bez sekretów DeepL w logach.
 */
import { serveJob } from '../_shared/integrations/serve.ts';

serveJob('translate-retry');
