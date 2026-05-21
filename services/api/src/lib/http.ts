import { ZodError } from 'zod';
import { errorEnvelope, successEnvelope } from '../contracts/api';

export const json = (data: unknown, init?: ResponseInit) => {
  return Response.json(data, init);
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
