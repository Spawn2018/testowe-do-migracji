/** M12 — TomTom Flow Segment Data przy aktywnych autach → ryzyka ROAD_SE/ROAD_PL. Co 15 min. Wymaga TOMTOM_API_KEY (bez: DEMO). */
import { serveJob } from '../_shared/integrations/serve.ts';
serveJob('traffic-flow');
