import type { IAppConfig, ISecretMeta } from '../../contracts/config';
import { AiService } from '../ai/ai-service';
import { DatabaseService } from '../database/database-service';
import { SpreadsheetService } from '../spreadsheet/spreadsheet-service';

export class DiagnosticsService {
  public constructor(
    private readonly databaseService: DatabaseService,
    private readonly aiService: AiService,
    private readonly spreadsheetService: SpreadsheetService,
  ) {}

  public async testDatabase(config: IAppConfig) {
    return this.databaseService.runDiagnostics(config);
  }

  public testAi(config: IAppConfig, secrets: ISecretMeta[]) {
    return this.aiService.testConnection(config, secrets);
  }

  public async testSpreadsheet(config: IAppConfig) {
    return this.spreadsheetService.testConnection(config);
  }
}
