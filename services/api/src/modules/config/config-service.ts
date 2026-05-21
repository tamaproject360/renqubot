import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ZodError } from 'zod';
import {
  type IAppConfig,
  type IConfigStatus,
  type IPartialAppConfig,
  type ISecretMeta,
  type ISecretUpdate,
  appConfigSchema,
  partialAppConfigSchema,
  secretUpdateSchema,
  serviceAccountUploadSchema,
} from '../../contracts/config';

interface IAuditLogEntry {
  actor: string;
  action: string;
  field?: string;
  createdAt: string;
}

export type ISecretValues = Record<string, string>;

const CONFIG_PATH = Bun.env.CONFIG_PATH || './data/config/app-config.json';
const SECRETS_PATH = Bun.env.SECRETS_PATH || './data/config/app-secrets.json';
const SECRETS_META_PATH =
  Bun.env.SECRETS_META_PATH || './data/config/app-secrets-meta.json';
const AUDIT_LOG_PATH =
  Bun.env.AUDIT_LOG_PATH || './data/config/audit-log.jsonl';
const CREDENTIALS_DIR = Bun.env.CREDENTIALS_DIR || './data/credentials';

const defaultConfig = appConfigSchema.parse({});

const readJsonFile = async <T>(filePath: string, fallback: T): Promise<T> => {
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch (error) {
    return fallback;
  }
};

const writeJsonFile = async (filePath: string, data: unknown) => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
};

const mergeConfig = (
  current: IAppConfig,
  patch: IPartialAppConfig,
): IAppConfig => {
  return appConfigSchema.parse({
    ...current,
    ...patch,
    ai: {
      ...current.ai,
      ...patch.ai,
      gemini: {
        ...current.ai.gemini,
        ...patch.ai?.gemini,
      },
      openai: {
        ...current.ai.openai,
        ...patch.ai?.openai,
      },
      anthropic: {
        ...current.ai.anthropic,
        ...patch.ai?.anthropic,
      },
      custom: {
        ...current.ai.custom,
        ...patch.ai?.custom,
      },
    },
    database: {
      ...current.database,
      ...patch.database,
    },
    spreadsheet: {
      ...current.spreadsheet,
      ...patch.spreadsheet,
    },
    whatsapp: {
      ...current.whatsapp,
      ...patch.whatsapp,
    },
  });
};

const maskSecret = (value: string) => {
  if (value.length <= 8) {
    return '********';
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

const providerFromSecretKey = (key: ISecretUpdate['key']) => {
  return key.split('.')[0] ?? 'unknown';
};

const safeCredentialFileName = (fileName: string) => {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
};

export class ConfigService {
  public async getConfig(): Promise<IAppConfig> {
    const storedConfig = await readJsonFile<Partial<IAppConfig>>(
      CONFIG_PATH,
      {},
    );
    return appConfigSchema.parse({
      ...defaultConfig,
      ...storedConfig,
    });
  }

  public async getStatus(): Promise<IConfigStatus> {
    const config = await this.getConfig();
    const secrets = await this.getSecretMeta();
    const missingFields = this.getMissingFields(config, secrets);

    return {
      config,
      valid: missingFields.length === 0,
      missingFields,
      fieldIssues: [],
      secrets,
    };
  }

  public async getSecretValues(): Promise<ISecretValues> {
    return readJsonFile<ISecretValues>(SECRETS_PATH, {});
  }

  public async savePartialConfig(payload: unknown): Promise<IConfigStatus> {
    const patch = partialAppConfigSchema.parse(payload);
    const current = await this.getConfig();
    const nextConfig = mergeConfig(current, patch);

    await writeJsonFile(CONFIG_PATH, nextConfig);
    await this.appendAuditLog({
      actor: 'admin',
      action: 'config.updated',
      createdAt: new Date().toISOString(),
    });

    return this.getStatus();
  }

  public async saveSecret(payload: unknown): Promise<ISecretMeta> {
    const secret = secretUpdateSchema.parse(payload);
    const secrets = await readJsonFile<Record<string, string>>(
      SECRETS_PATH,
      {},
    );
    const now = new Date().toISOString();
    const meta: ISecretMeta = {
      key: secret.key,
      provider: providerFromSecretKey(secret.key),
      maskedValue: maskSecret(secret.value),
      updatedAt: now,
    };
    const metaList = await this.getSecretMeta();
    const nextMetaList = [
      ...metaList.filter((item) => item.key !== secret.key),
      meta,
    ];

    secrets[secret.key] = secret.value;

    await writeJsonFile(SECRETS_PATH, secrets);
    await writeJsonFile(SECRETS_META_PATH, nextMetaList);
    await this.appendAuditLog({
      actor: 'admin',
      action: 'secret.updated',
      field: secret.key,
      createdAt: now,
    });

    return meta;
  }

  public async saveServiceAccount(payload: unknown): Promise<IConfigStatus> {
    const upload = serviceAccountUploadSchema.parse(payload);

    try {
      JSON.parse(upload.content);
    } catch (error) {
      throw new ZodError([
        {
          code: 'custom',
          path: ['content'],
          message: 'Content harus berupa JSON service account yang valid.',
        },
      ]);
    }

    const filePath = join(
      CREDENTIALS_DIR,
      safeCredentialFileName(upload.fileName),
    );
    await mkdir(CREDENTIALS_DIR, { recursive: true });
    await writeFile(filePath, `${upload.content.trim()}\n`, 'utf8');

    const status = await this.savePartialConfig({
      spreadsheet: {
        serviceAccountPath: filePath,
      },
    });

    await this.appendAuditLog({
      actor: 'admin',
      action: 'credential.uploaded',
      field: 'spreadsheet.serviceAccountPath',
      createdAt: new Date().toISOString(),
    });

    return status;
  }

  private async getSecretMeta(): Promise<ISecretMeta[]> {
    return readJsonFile<ISecretMeta[]>(SECRETS_META_PATH, []);
  }

  private getMissingFields(config: IAppConfig, secrets: ISecretMeta[]) {
    const missingFields: string[] = [];
    const secretKeys = new Set(secrets.map((secret) => secret.key));
    const activeSecretKey =
      config.activeAiProvider === 'openai-compatible'
        ? 'custom.apiKey'
        : `${config.activeAiProvider}.apiKey`;

    if (!secretKeys.has(activeSecretKey)) {
      missingFields.push(activeSecretKey);
    }

    if (config.activeAiProvider === 'openai-compatible') {
      if (!config.ai.custom.baseUrl) {
        missingFields.push('ai.custom.baseUrl');
      }

      if (!config.ai.custom.model) {
        missingFields.push('ai.custom.model');
      }
    }

    if (!config.database.url) {
      missingFields.push('database.url');
    }

    return missingFields;
  }

  private async appendAuditLog(entry: IAuditLogEntry) {
    await mkdir(dirname(AUDIT_LOG_PATH), { recursive: true });
    await writeFile(AUDIT_LOG_PATH, `${JSON.stringify(entry)}\n`, {
      encoding: 'utf8',
      flag: 'a',
    });
  }
}
