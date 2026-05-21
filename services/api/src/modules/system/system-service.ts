import {
  type ISystemStatus,
  setupStateSchema,
  systemStatusSchema,
} from '../../contracts/system';

const PHASE = 'Phase 3 - Service API';

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
          message: 'Gunakan /api/diagnostics/database untuk status terbaru.',
        },
        {
          name: 'ai',
          status: 'unknown',
          message: 'Gunakan /api/diagnostics/ai untuk status terbaru.',
        },
        {
          name: 'spreadsheet',
          status: 'unknown',
          message: 'Gunakan /api/diagnostics/spreadsheet untuk status terbaru.',
        },
        {
          name: 'whatsapp',
          status: 'unknown',
          message: 'Gunakan /api/whatsapp/status untuk status terbaru.',
        },
      ],
    });
  }
}
