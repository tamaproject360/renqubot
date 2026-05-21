import type { ISystemStatus } from './contracts/system';
import { SystemService } from './modules/system/system-service';

const systemService = new SystemService();

const buildEnvelope = <T>(data: T) => {
  return {
    success: true,
    data,
    error: null,
  };
};

const json = (data: unknown, init?: ResponseInit) => {
  return Response.json(data, init);
};

const notFound = () => {
  return json(
    {
      success: false,
      data: null,
      error: {
        code: 'NOT_FOUND',
        message: 'Route tidak ditemukan.',
      },
    },
    { status: 404 },
  );
};

const server = Bun.serve({
  port: Number(Bun.env.API_PORT || 3001),
  fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return json({
        success: true,
        data: {
          status: 'ok',
          service: 'renqu-bot-api',
        },
        error: null,
      });
    }

    if (url.pathname === '/ready') {
      return json({
        success: true,
        data: {
          status: 'ready',
          phase: 'Phase 1 - Architecture Foundation',
        },
        error: null,
      });
    }

    if (url.pathname === '/api/system/status') {
      const status: ISystemStatus = systemService.getSystemStatus();
      return json(buildEnvelope(status));
    }

    return notFound();
  },
});

console.log(`[API] Listening on http://localhost:${server.port}`);
