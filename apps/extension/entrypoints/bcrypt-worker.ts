import { startBcryptWorker } from '@swiss/core/bcrypt-passwords/worker';

export default defineUnlistedScript({ main: startBcryptWorker });
