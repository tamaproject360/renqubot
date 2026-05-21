import { logRuntimeConfig, validateRuntimeConfig } from './config';
import { sql, startMigration } from './db';
import { startSocket } from './whatsapp';

const start = async () => {
  console.log('[APP] Starting application');

  const configValidation = validateRuntimeConfig();

  if (!configValidation.valid) {
    console.error(
      `[CONFIG] Missing required runtime config: ${configValidation.missingFields.join(', ')}`,
    );
    process.exit(1);
  }

  logRuntimeConfig();
  await sql.connect();
  await startMigration();
  console.log('[DB] Database connected and migrations applied.');

  startSocket();
};

const shutdown = async (code: NodeJS.Signals) => {
  console.log(`[APP] Caught ${code}, exiting gracefully`);
  await sql.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
