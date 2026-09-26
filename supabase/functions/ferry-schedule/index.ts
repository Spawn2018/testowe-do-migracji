/** M12 — rozkład cargo Polferries → sailings. Harmonogram: raz w tygodniu; także ręcznie przez HHL. */
import { serveJob } from '../_shared/integrations/serve.ts';
serveJob('ferry-schedule', { allowHhl: true });
