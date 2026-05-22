import { ZodError } from 'zod';
import { errorEnvelope, successEnvelope } from '../contracts/api';

const corsOrigin = Bun.env.API_CORS_ORIGIN ?? '*';

const corsHeaders = {
  'Access-Control-Allow-Origin': corsOrigin,
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-correlation-id',
};

const withCorsHeaders = (init?: ResponseInit): ResponseInit => {
  return {
    ...init,
    headers: corsHeaders,
  };
};

export const json = (data: unknown, init?: ResponseInit) => {
  return Response.json(data, withCorsHeaders(init));
};

export const corsPreflight = () => {
  return new Response(null, withCorsHeaders({ status: 204 }));
};

export const ok = <T>(data: T, init?: ResponseInit) => {
  return json(successEnvelope(data), init);
};

export const fail = (
  code: string,
  message: string,
  status = 400,
  details?: unknown,
) => {
  return json(errorEnvelope(code, message, details), { status });
};

export const readJsonBody = async (request: Request) => {
  try {
    return await request.json();
  } catch (error) {
    return null;
  }
};

export const validationError = (error: ZodError) => {
  return fail('VALIDATION_ERROR', 'Payload tidak valid.', 422, error.flatten());
};
