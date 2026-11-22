import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { logger } from './utils/logger.js';

async function start() {
  try {
    await connectDatabase();
  } catch (err) {
    logger.error(
      { err },
      'Could not connect to MongoDB. Check MONGODB_URI and your Atlas IP list.',
    );
    process.exit(1);
  }

  const server = createApp().listen(env.PORT, () => {
    logger.info(`Ribra API running on http://localhost:${env.PORT}`);
  });

  // Close cleanly when Render (or Ctrl+C) stops the process.
  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

void start();
