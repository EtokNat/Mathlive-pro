import { createLogger } from './logger';

const logger = createLogger('SW');

export async function registerSW() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      logger.info('Service worker registered', registration.scope);
      return registration;
    } catch (err) {
      logger.error('Service worker registration failed', err);
      throw err;
    }
  } else {
    logger.warn('Service workers not supported');
  }
}
