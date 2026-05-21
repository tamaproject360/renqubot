import type { IAppConfig, ISecretMeta } from '../../contracts/config';

export interface IAIModelCapability {
  text: boolean;
  vision: boolean;
  jsonMode: boolean;
  customBaseUrl: boolean;
}

export interface IAIProviderDiagnosticContext {
  config: IAppConfig;
  secrets: ISecretMeta[];
}

export interface IAIProviderDiagnosticResult {
  healthy: boolean;
  message: string;
  details: Record<string, unknown>;
}

export interface IAIProviderAdapter {
  id: IAppConfig['activeAiProvider'];
  label: string;
  capabilities: IAIModelCapability;
  getModel(config: IAppConfig): string;
  getSecretKey(): string;
  validate(context: IAIProviderDiagnosticContext): IAIProviderDiagnosticResult;
}

const hasSecret = (secrets: ISecretMeta[], key: string) => {
  return secrets.some((secret) => secret.key === key);
};

const validateModelAndSecret = (
  adapter: IAIProviderAdapter,
  context: IAIProviderDiagnosticContext,
  providerLabel: string,
) => {
  const model = adapter.getModel(context.config);
  const secretKey = adapter.getSecretKey();

  if (!hasSecret(context.secrets, secretKey)) {
    return {
      healthy: false,
      message: `API key ${providerLabel} belum tersedia.`,
      details: { requiredSecret: secretKey },
    };
  }

  if (!model) {
    return {
      healthy: false,
      message: `Model ${providerLabel} belum dikonfigurasi.`,
      details: {},
    };
  }

  return {
    healthy: true,
    message: `Konfigurasi ${providerLabel} siap digunakan.`,
    details: { model },
  };
};

export class GeminiProviderAdapter implements IAIProviderAdapter {
  public readonly id = 'gemini';
  public readonly label = 'Google Gemini';
  public readonly capabilities = {
    text: true,
    vision: true,
    jsonMode: true,
    customBaseUrl: true,
  };

  public getModel(config: IAppConfig) {
    return config.ai.gemini.model;
  }

  public getSecretKey() {
    return 'gemini.apiKey';
  }

  public validate(context: IAIProviderDiagnosticContext) {
    return validateModelAndSecret(this, context, 'Gemini');
  }
}

export class OpenAIProviderAdapter implements IAIProviderAdapter {
  public readonly id = 'openai';
  public readonly label = 'OpenAI';
  public readonly capabilities = {
    text: true,
    vision: true,
    jsonMode: true,
    customBaseUrl: true,
  };

  public getModel(config: IAppConfig) {
    return config.ai.openai.model;
  }

  public getSecretKey() {
    return 'openai.apiKey';
  }

  public validate(context: IAIProviderDiagnosticContext) {
    return validateModelAndSecret(this, context, 'OpenAI');
  }
}

export class AnthropicProviderAdapter implements IAIProviderAdapter {
  public readonly id = 'anthropic';
  public readonly label = 'Anthropic';
  public readonly capabilities = {
    text: true,
    vision: true,
    jsonMode: false,
    customBaseUrl: true,
  };

  public getModel(config: IAppConfig) {
    return config.ai.anthropic.model;
  }

  public getSecretKey() {
    return 'anthropic.apiKey';
  }

  public validate(context: IAIProviderDiagnosticContext) {
    return validateModelAndSecret(this, context, 'Anthropic');
  }
}

export class OpenAICompatibleProviderAdapter implements IAIProviderAdapter {
  public readonly id = 'openai-compatible';
  public readonly label = 'OpenAI-compatible';
  public readonly capabilities = {
    text: true,
    vision: false,
    jsonMode: true,
    customBaseUrl: true,
  };

  public getModel(config: IAppConfig) {
    return config.ai.custom.model;
  }

  public getSecretKey() {
    return 'custom.apiKey';
  }

  public validate(context: IAIProviderDiagnosticContext) {
    const baseResult = validateModelAndSecret(this, context, 'custom provider');

    if (!baseResult.healthy) {
      return baseResult;
    }

    if (!context.config.ai.custom.baseUrl) {
      return {
        healthy: false,
        message: 'Base URL custom provider belum dikonfigurasi.',
        details: { requiredField: 'ai.custom.baseUrl' },
      };
    }

    return baseResult;
  }
}
