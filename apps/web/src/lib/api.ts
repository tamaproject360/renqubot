export interface IApiEnvelope<T> {
  success: boolean;
  data: T;
  error: null | {
    code: string;
    message: string;
  };
}

export interface IHealthComponent {
  name: 'database' | 'ai' | 'spreadsheet' | 'whatsapp';
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  message: string;
}

export interface ISystemStatusResponse {
  app: {
    name: string;
    phase: string;
    setupState:
      | 'uninitialized'
      | 'config_saved'
      | 'credentials_uploaded'
      | 'whatsapp_pending'
      | 'ready'
      | 'degraded';
  };
  components: IHealthComponent[];
}
