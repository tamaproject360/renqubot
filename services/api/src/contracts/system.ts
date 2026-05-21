import { z } from 'zod';

export const setupStateSchema = z.enum([
  'uninitialized',
  'config_saved',
  'credentials_uploaded',
  'whatsapp_pending',
  'ready',
  'degraded',
]);

export const healthStatusSchema = z.enum([
  'healthy',
  'degraded',
  'unhealthy',
  'unknown',
]);

export const healthComponentSchema = z.object({
  name: z.enum(['database', 'ai', 'spreadsheet', 'whatsapp']),
  status: healthStatusSchema,
  message: z.string(),
});

export const systemStatusSchema = z.object({
  app: z.object({
    name: z.string(),
    phase: z.string(),
    setupState: setupStateSchema,
  }),
  components: z.array(healthComponentSchema),
});

export type ISetupState = z.infer<typeof setupStateSchema>;
export type IHealthStatus = z.infer<typeof healthStatusSchema>;
export type ISystemStatus = z.infer<typeof systemStatusSchema>;
