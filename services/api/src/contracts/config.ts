import { z } from 'zod';

export const aiProviderSchema = z.enum([
  'gemini',
  'openai',
  'anthropic',
  'openai-compatible',
]);

const optionalUrlSchema = z.string().trim().url().optional().or(z.literal(''));

export const appConfigSchema = z.object({
  activeAiProvider: aiProviderSchema.default('gemini'),
  ai: z
    .object({
      gemini: z
        .object({
          model: z.string().trim().min(1).default('gemini-2.0-flash-lite'),
          baseUrl: optionalUrlSchema,
        })
        .default({}),
      openai: z
        .object({
          model: z.string().trim().min(1).default('gpt-4.1-mini'),
          baseUrl: optionalUrlSchema,
        })
        .default({}),
      anthropic: z
        .object({
          model: z.string().trim().min(1).default('claude-3-5-haiku-latest'),
          baseUrl: optionalUrlSchema,
        })
        .default({}),
      custom: z
        .object({
          name: z.string().trim().default('Custom OpenAI-compatible'),
          model: z.string().trim().default(''),
          baseUrl: optionalUrlSchema,
        })
        .default({}),
    })
    .default({}),
  database: z
    .object({
      url: z.string().trim().min(1).default('sqlite://./data/baileys.db'),
    })
    .default({}),
  spreadsheet: z
    .object({
      spreadsheetId: z.string().trim().default(''),
      spreadsheetName: z.string().trim().min(1).default('infos'),
      sheetName: z.string().trim().min(1).default('Logs'),
      serviceAccountPath: z.string().trim().default(''),
    })
    .default({}),
  whatsapp: z
    .object({
      allowedUserIds: z.array(z.string().trim().min(1)).default([]),
    })
    .default({}),
});

export const partialAppConfigSchema = appConfigSchema.deepPartial();

export const secretUpdateSchema = z.object({
  key: z.enum([
    'gemini.apiKey',
    'openai.apiKey',
    'anthropic.apiKey',
    'custom.apiKey',
  ]),
  value: z.string().min(1),
});

export const serviceAccountUploadSchema = z.object({
  fileName: z.string().trim().min(1).default('google-service-account.json'),
  content: z.string().min(2),
});

export type IAppConfig = z.infer<typeof appConfigSchema>;
export type IPartialAppConfig = z.infer<typeof partialAppConfigSchema>;
export type ISecretUpdate = z.infer<typeof secretUpdateSchema>;
export type IServiceAccountUpload = z.infer<typeof serviceAccountUploadSchema>;

export interface IConfigFieldIssue {
  field: string;
  message: string;
}

export interface ISecretMeta {
  key: string;
  provider: string;
  maskedValue: string;
  updatedAt: string;
}

export interface IConfigStatus {
  config: IAppConfig;
  valid: boolean;
  missingFields: string[];
  fieldIssues: IConfigFieldIssue[];
  secrets: ISecretMeta[];
}
