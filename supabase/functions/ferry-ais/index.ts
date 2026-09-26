/** M12 — AIS Digitraffic (CC BY 4.0) dla statków z rejsem w toku. Co 10 min. Potwierdza wyłącznie stronę szwedzką. */
import { serveJob } from '../_shared/integrations/serve.ts';
serveJob('ferry-ais');
