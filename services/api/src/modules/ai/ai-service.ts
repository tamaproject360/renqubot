import type { IAppConfig, ISecretMeta } from '../../contracts/config';
import type { IDiagnosticResult } from '../../contracts/diagnostics';
import {
  AnthropicProviderAdapter,
  GeminiProviderAdapter,
  type IAIProviderAdapter,
  OpenAICompatibleProviderAdapter,
  OpenAIProviderAdapter,
} from './ai-provider';

export class AiService {
  private readonly providers: IAIProviderAdapter[] = [
    new GeminiProviderAdapter(),
    new OpenAIProviderAdapter(),
    new AnthropicProviderAdapter(),
    new OpenAICompatibleProviderAdapter(),
  ];

  public testConnection(
    config: IAppConfig,
    secrets: ISecretMeta[],
  ): IDiagnosticResult {
    const checkedAt = new Date().toISOString();
    const provider = this.getActiveProvider(config);

    if (!provider) {
      return {
        status: 'unhealthy',
        message: 'Provider AI aktif tidak terdaftar.',
        details: {
          provider: config.activeAiProvider,
        },
        checkedAt,
      };
    }

    const result = provider.validate({ config, secrets });

    return {
      status: result.healthy ? 'healthy' : 'unhealthy',
      message: result.message,
      details: {
        provider: provider.id,
        label: provider.label,
        capabilities: provider.capabilities,
        ...result.details,
      },
      checkedAt,
    };
  }

  public getCapabilities() {
    return this.providers.map((provider) => ({
      id: provider.id,
      label: provider.label,
      capabilities: provider.capabilities,
      secretKey: provider.getSecretKey(),
    }));
  }

  private getActiveProvider(config: IAppConfig) {
    return this.providers.find(
      (provider) => provider.id === config.activeAiProvider,
    );
  }
}
