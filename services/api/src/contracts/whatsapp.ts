export interface IWhatsappStatus {
  connection: 'close' | 'connecting' | 'open' | 'unknown';
  lastError: string | null;
  hasQr: boolean;
  qrUpdatedAt: string | null;
  updatedAt: string | null;
}

export interface IWhatsappQrResponse {
  qr: string | null;
  qrSvg: string | null;
  expiresAt: string | null;
}
