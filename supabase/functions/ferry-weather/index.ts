/** II-8 — FMI + DMI + SMHI → marine_conditions + ryzyko FERRY_WEATHER. Co 6 h (po przebiegu modelu). */
import { serveJob } from '../_shared/integrations/serve.ts';
serveJob('ferry-weather');
