import { ZodError } from 'zod';
import { fail, ok, readJsonBody, validationError } from './lib/http';
import { ConfigService } from './modules/config/config-service';
import { SystemService } from './modules/system/system-service';

const configService = new ConfigService();
const systemService = new SystemService();

const notFound = () => {
  return fail('NOT_FOUND', 'Route tidak ditemukan.', 404);
};

const handleError = (error: unknown) => {
  if (error instanceof ZodError) {
    return validationError(error);
  }

  console.error('[API] Unhandled request error', error);
  return fail('INTERNAL_ERROR', 'Terjadi kesalahan internal.', 500);
};

const server = Bun.serve({
  port: Number(Bun.env.API_PORT || 3001),
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return ok({
        status: 'ok',
        service: 'renqu-bot-api',
      });
    }

    if (url.pathname === '/ready') {
      return ok({
        status: 'ready',
        phase: 'Phase 2 - Config Platform',
      });
    }

    if (url.pathname === '/api/system/status') {
      const status = systemService.getSystemStatus();
      return ok(status);
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
    } catch (error) {
      return handleError(error);
    }

    return notFound();
  },
});

console.log(`[API] Listening on http://localhost:${server.port}`);
