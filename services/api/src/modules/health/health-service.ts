import type { IConfigStatus } from '../../contracts/config';
import type {
  IHealthCheckResult,
  IHealthSummary,
} from '../../contracts/health';
import { DiagnosticsService } from '../diagnostics/diagnostics-service';
import { WhatsappService } from '../whatsapp/whatsapp-service';

export class HealthService {
  public constructor(
    private readonly diagnosticsService: DiagnosticsService,
    private readonly whatsappService: WhatsappService,
  ) {}

  public async getHealth(configStatus: IConfigStatus): Promise<IHealthSummary> {
    const [database, spreadsheet] = await Promise.all([
      this.diagnosticsService.testDatabase(configStatus.config),
      this.diagnosticsService.testSpreadsheet(configStatus.config),
    ]);
    const ai = this.diagnosticsService.testAi(
      configStatus.config,
      configStatus.secrets,
    );
    const whatsapp = await this.whatsappService.getStatus();
    const components: IHealthCheckResult[] = [
      {
        name: 'database',
        status: database.status,
        message: database.message,
        checkedAt: database.checkedAt,
      },
      {
        name: 'ai',
        status: ai.status,
        message: ai.message,
        checkedAt: ai.checkedAt,
      },
      {
        name: 'spreadsheet',
        status: spreadsheet.status,
        message: spreadsheet.message,
        checkedAt: spreadsheet.checkedAt,
      },
      {
        name: 'whatsapp',
        status: whatsapp.connection === 'open' ? 'healthy' : 'degraded',
        message:
          whatsapp.connection === 'open'
            ? 'WhatsApp terhubung.'
            : 'WhatsApp belum terhubung atau status belum tersedia.',
        checkedAt: new Date().toISOString(),
      },
    ];

    return {
      status: this.resolveOverallStatus(components),
      components,
    };
  }

  private resolveOverallStatus(components: IHealthCheckResult[]) {
    if (components.some((component) => component.status === 'unhealthy')) {
      return 'unhealthy';
    }

    if (
      components.some(
        (component) =>
          component.status === 'degraded' || component.status === 'unknown',
      )
    ) {
      return 'degraded';
    }

    return 'healthy';
  }
}
