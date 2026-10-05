/**
 * TELM-EMTRACK-WEB — cron: odczyt pozycji naczepy z emtrack (zapas D-36).
 * Sekrety: EMTRACK_LOGIN, EMTRACK_PASSWORD (nigdy w logach).
 */
import { serveJob } from '../_shared/integrations/serve.ts';

serveJob('emtrack-web');
