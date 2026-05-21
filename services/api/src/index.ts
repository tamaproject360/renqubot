import { ZodError } from 'zod';
import { fail, ok, readJsonBody, validationError } from './lib/http';
import { logger } from './lib/logger';
import { AiService } from './modules/ai/ai-service';
import { BotRuntimeService } from './modules/bot-runtime/bot-runtime-service';
import { ConfigService } from './modules/config/config-service';
import { DatabaseService } from './modules/database/database-service';
import { DiagnosticsService } from './modules/diagnostics/diagnostics-service';
import { HealthService } from './modules/health/health-service';
import { SpreadsheetService } from './modules/spreadsheet/spreadsheet-service';
import { SystemService } from './modules/system/system-service';
import { TransactionService } from './modules/transactions/transaction-service';
import { WhatsappService } from './modules/whatsapp/whatsapp-service';

const configService = new ConfigService();
const databaseService = new DatabaseService();
const aiService = new AiService();
const spreadsheetService = new SpreadsheetService(databaseService);
const diagnosticsService = new DiagnosticsService(
  databaseService,
  aiService,
  spreadsheetService,
);
const whatsappService = new WhatsappService(databaseService);
const healthService = new HealthService(diagnosticsService, whatsappService);
const systemService = new SystemService();
const transactionService = new TransactionService(databaseService);
const botRuntimeService = new BotRuntimeService();

const notFound = () => {
  return fail('NOT_FOUND', 'Route tidak ditemukan.', 404);
};

const handleError = (error: unknown, correlationId?: string) => {
  if (error instanceof ZodError) {
    return validationError(error);
  }

  logger.error('Unhandled request error', {
    module: 'API',
    correlationId,
    error: error instanceof Error ? error.message : String(error),
  });
  return fail('INTERNAL_ERROR', 'Terjadi kesalahan internal.', 500);
};

const server = Bun.serve({
  port: Number(Bun.env.API_PORT || 3001),
  async fetch(request) {
    const url = new URL(request.url);
    const correlationId =
      request.headers.get('x-correlation-id') ?? crypto.randomUUID();

    logger.info('Incoming request', {
      module: 'API',
      correlationId,
      method: request.method,
      path: url.pathname,
    });

    if (url.pathname === '/health') {
      const configStatus = await configService.getStatus();
      const health = await healthService.getHealth(configStatus);
      return ok(health, { status: health.status === 'unhealthy' ? 503 : 200 });
    }

    if (url.pathname === '/ready') {
      const configStatus = await configService.getStatus();
      const health = await healthService.getHealth(configStatus);
      const ready = configStatus.valid && health.status !== 'unhealthy';

      return ok(
        {
          status: ready ? 'ready' : 'not_ready',
          phase: 'Phase 6 - Observability & Reliability',
          health,
          missingFields: configStatus.missingFields,
        },
        { status: ready ? 200 : 503 },
      );
    }

      if (url.pathname === '/api/system/status') {
        const status = systemService.getSystemStatus();
        return ok(status);
      }

      if (url.pathname === '/api/bot-runtime/status') {
        return ok(botRuntimeService.getStatus());
      }

    try {
      if (url.pathname === '/api/config' && request.method === 'GET') {
        const status = await configService.getStatus();
        return ok(status);
      }

      if (
        url.pathname === '/api/config' &&
        ['POST', 'PATCH'].includes(request.method)
      ) {
        const payload = await readJsonBody(request);

        if (!payload) {
          return fail('INVALID_JSON', 'Request body harus JSON valid.', 400);
        }

        const status = await configService.savePartialConfig(payload);
        return ok(status);
      }

      if (
        url.pathname === '/api/config/secrets' &&
        request.method === 'PATCH'
      ) {
        const payload = await readJsonBody(request);

        if (!payload) {
          return fail('INVALID_JSON', 'Request body harus JSON valid.', 400);
        }

        const secretMeta = await configService.saveSecret(payload);
        return ok(secretMeta);
      }

      if (
        url.pathname === '/api/config/google-service-account' &&
        request.method === 'POST'
      ) {
        const payload = await readJsonBody(request);

        if (!payload) {
          return fail('INVALID_JSON', 'Request body harus JSON valid.', 400);
        }

        const status = await configService.saveServiceAccount(payload);
        return ok(status);
      }

      if (
        url.pathname === '/api/diagnostics/database' &&
        request.method === 'GET'
      ) {
        const configStatus = await configService.getStatus();
        const result = await diagnosticsService.testDatabase(
          configStatus.config,
        );
        return ok(result, {
          status: result.status === 'unhealthy' ? 503 : 200,
        });
      }

      if (url.pathname === '/api/diagnostics/ai' && request.method === 'GET') {
        const configStatus = await configService.getStatus();
        const result = diagnosticsService.testAi(
          configStatus.config,
          configStatus.secrets,
        );
        return ok(result, {
          status: result.status === 'unhealthy' ? 503 : 200,
        });
      }

      if (url.pathname === '/api/ai/capabilities' && request.method === 'GET') {
        return ok(aiService.getCapabilities());
      }

      if (
        url.pathname === '/api/bot-runtime/start' &&
        request.method === 'POST'
      ) {
        const configStatus = await configService.getStatus();

        if (!configStatus.valid) {
          return fail(
            'CONFIG_NOT_READY',
            `Konfigurasi belum lengkap: ${configStatus.missingFields.join(', ')}`,
            400,
          );
        }

        if (configStatus.config.activeAiProvider !== 'gemini') {
          return fail(
            'UNSUPPORTED_RUNTIME_PROVIDER',
            'Bot runtime saat ini baru mendukung provider aktif Gemini.',
            400,
          );
        }

        const result = botRuntimeService.start(
          configStatus.config,
          await configService.getSecretValues(),
        );
        return ok(result);
      }

      if (
        url.pathname === '/api/diagnostics/spreadsheet' &&
        request.method === 'GET'
      ) {
        const configStatus = await configService.getStatus();
        const result = await diagnosticsService.testSpreadsheet(
          configStatus.config,
        );
        return ok(result, {
          status: result.status === 'unhealthy' ? 503 : 200,
        });
      }

      if (
        url.pathname === '/api/spreadsheet-sync/jobs' &&
        request.method === 'GET'
      ) {
        const limit = Number(url.searchParams.get('limit') || 25);
        const configStatus = await configService.getStatus();
        const result = await spreadsheetService.listSyncJobs(
          configStatus.config,
          Number.isFinite(limit) ? limit : 25,
        );
        return ok(result);
      }

      if (
        url.pathname === '/api/spreadsheet-sync/retry' &&
        request.method === 'POST'
      ) {
        const configStatus = await configService.getStatus();
        const result = await spreadsheetService.retryPendingSyncJobs(
          configStatus.config,
        );
        return ok(result);
      }

      if (url.pathname === '/api/whatsapp/status' && request.method === 'GET') {
        const status = await whatsappService.getStatus();
        return ok(status);
      }

      if (url.pathname === '/api/whatsapp/qr' && request.method === 'GET') {
        const qr = await whatsappService.getQr();
        return ok(qr);
      }

      if (
        url.pathname === '/api/whatsapp/reset-session' &&
        request.method === 'POST'
      ) {
        const payload = await readJsonBody(request);

        if (
          !payload ||
          typeof payload !== 'object' ||
          !('confirm' in payload) ||
          payload.confirm !== 'RESET_WHATSAPP_SESSION'
        ) {
          return fail(
            'CONFIRMATION_REQUIRED',
            'Kirim confirm=RESET_WHATSAPP_SESSION untuk reset session.',
            400,
          );
        }

        const configStatus = await configService.getStatus();
        const result = await whatsappService.resetSession(configStatus.config);
        return ok(result);
      }

      if (url.pathname === '/api/transactions' && request.method === 'GET') {
        const limit = Number(url.searchParams.get('limit') || 25);
        const configStatus = await configService.getStatus();
        const result = await transactionService.listTransactions(
          configStatus.config,
          Number.isFinite(limit) ? limit : 25,
        );
        return ok(result);
      }

      if (url.pathname === '/api/summary' && request.method === 'GET') {
        const configStatus = await configService.getStatus();
        const summary = await transactionService.getSummary(
          configStatus.config,
        );
        return ok(summary);
      }
    } catch (error) {
      return handleError(error, correlationId);
    }

    return notFound();
  },
});

console.log(`[API] Listening on http://localhost:${server.port}`);
