import {
  type ISystemStatus,
  setupStateSchema,
  systemStatusSchema,
} from '../../contracts/system';

const PHASE = 'Phase 1 - Architecture Foundation';

export class SystemService {
  public getSystemStatus(): ISystemStatus {
    const setupState = setupStateSchema.parse('uninitialized');

    return systemStatusSchema.parse({
      app: {
        name: 'Renqu Bot API',
        phase: PHASE,
        setupState,
      },
      components: [
        {
          name: 'database',
          status: 'unknown',
          message: 'Database diagnostics belum dihubungkan.',
        },
        {
          name: 'ai',
          status: 'unknown',
          message: 'AI diagnostics belum dihubungkan.',
        },
        {
          name: 'spreadsheet',
          status: 'unknown',
          message: 'Spreadsheet diagnostics belum dihubungkan.',
        },
        {
          name: 'whatsapp',
          status: 'unknown',
          message: 'WhatsApp session manager belum dihubungkan.',
        },
      ],
    });
  }
}
