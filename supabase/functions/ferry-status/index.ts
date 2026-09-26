/** M12 — komunikaty kursowania Polferries → opóźnienie / odwołanie / NIEZNANY. Co 15 min, nie częściej. */
import { serveJob } from '../_shared/integrations/serve.ts';
serveJob('ferry-status');
