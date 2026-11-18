import { contactWorker, analyticsWorker } from './worker';
import { logger } from '../lib/logger';

logger.info('BullMQ Background Workers starting...');

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Gracefully shutting down BullMQ workers...');
  await Promise.all([contactWorker.close(), analyticsWorker.close()]);
  logger.info('All BullMQ workers closed. Process exiting.');
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

logger.info('BullMQ Background Workers running (Contact & Analytics).');
