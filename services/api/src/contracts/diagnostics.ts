import type { IHealthStatus } from './health';

export interface IDiagnosticResult {
  status: IHealthStatus;
  message: string;
  details: Record<string, unknown>;
  checkedAt: string;
}
