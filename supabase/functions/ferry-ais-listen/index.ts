/** AIS-POLF — nasłuch aisstream (~50 s) co minutę, zapis pozycji pięciu promów ze źródłem AISSTREAM. Bez filtra Q-18. */
import { serveJob } from '../_shared/integrations/serve.ts';
serveJob('ferry-ais-listen');
