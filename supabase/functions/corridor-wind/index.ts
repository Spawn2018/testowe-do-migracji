/** E49-a (DP-205) — SMHI/FMI na punktach korytarza co 25 km. Cron co 1 h. */
import { serveJob } from '../_shared/integrations/serve.ts';
serveJob('corridor-wind');
