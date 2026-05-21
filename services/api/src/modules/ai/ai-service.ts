import type { IAppConfig, ISecretMeta } from '../../contracts/config';
import type { IDiagnosticResult } from '../../contracts/diagnostics';

export class AiService {
  public testConnection(
    config: IAppConfig,
    secrets: ISecretMeta[],
  ): IDiagnosticResult {
    const checkedAt = new Date().toISOString();
    const activeSecretKey =
      config.activeAiProvider === 'openai-compatible'
        ? 'custom.apiKey'
        : `${config.activeAiProvider}.apiKey`;
    const hasSecret = secrets.some((secret) => secret.key === activeSecretKey);
    const model = this.getActiveModel(config);

    if (!hasSecret) {
      return {
        status: 'unhealthy',
        message: 'API key provider AI aktif belum tersedia.',
        details: {
          provider: config.activeAiProvider,
          requiredSecret: activeSecretKey,
        },
        checkedAt,
      };
    }

    if (!model) {
      return {
        status: 'degraded',
        message: 'Model provider AI aktif belum dikonfigurasi.',
        details: {
          provider: config.activeAiProvider,
        },
        checkedAt,
      };
    }

    return {
      status: 'healthy',
      message: 'Konfigurasi provider AI aktif lengkap untuk diagnostics dasar.',
      details: {
        provider: config.activeAiProvider,
        model,
      },
      checkedAt,
    };
  }

  private getActiveModel(config: IAppConfig) {
    if (config.activeAiProvider === 'gemini') {
      return config.ai.gemini.model;
    }

    if (config.activeAiProvider === 'openai') {
      return config.ai.openai.model;
    }

    if (config.activeAiProvider === 'anthropic') {
      return config.ai.anthropic.model;
    }

    return config.ai.custom.model;
  }
}
