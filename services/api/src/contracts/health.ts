export type IHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface IHealthCheckResult {
  name: 'database' | 'ai' | 'spreadsheet' | 'whatsapp';
  status: IHealthStatus;
  message: string;
  checkedAt: string;
}

export interface IHealthSummary {
  status: Exclude<IHealthStatus, 'unknown'>;
  components: IHealthCheckResult[];
}
