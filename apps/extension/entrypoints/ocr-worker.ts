import { startOcrWorker } from '@swiss/core/ocr/worker';

// WXT bundles unlisted scripts locally in development as well as production.
export default defineUnlistedScript({ main: startOcrWorker });
