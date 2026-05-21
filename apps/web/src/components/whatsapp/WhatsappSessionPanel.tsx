"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  getWhatsappQr,
  getWhatsappStatus,
  type IWhatsappQrResponse,
  type IWhatsappStatus,
} from "@/lib/admin-api";

export function WhatsappSessionPanel() {
  const [status, setStatus] = useState<IWhatsappStatus | null>(null);
  const [qr, setQr] = useState<IWhatsappQrResponse | null>(null);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      try {
        const [nextStatus, nextQr] = await Promise.all([
          getWhatsappStatus(),
          getWhatsappQr(),
        ]);

        if (active) {
          setStatus(nextStatus);
          setQr(nextQr);
        }
      } catch (error) {
        if (active) {
          setStatus(null);
          setQr(null);
        }
      }
    };

    refresh();
    const interval = window.setInterval(refresh, 5000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <>
      <PageHeader
        description="Pantau status koneksi, QR code, dan lifecycle session WhatsApp."
        eyebrow="WhatsApp Session"
        title="Session WhatsApp"
        action={<span className="badge badge--warning">Polling 5 detik</span>}
      />

      <div className="grid grid--two">
        <SectionCard
          title="QR Login"
          description="QR ditampilkan bila bot runtime menghasilkan QR aktif."
        >
          <div className="qr-panel">
            <div>
              <strong>
                {qr?.qr ? "QR aktif tersedia" : "QR belum tersedia"}
              </strong>
              <p className="card__meta">
                {qr?.expiresAt
                  ? `QR berlaku sampai ${qr.expiresAt}`
                  : "Jalankan bot runtime lalu tunggu polling berikutnya."}
              </p>
              {qr?.qr ? <code>{qr.qr}</code> : null}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Connection State"
          description="Status dibaca dari runtime bridge WhatsApp."
        >
          <div className="grid">
            <StatusBadge
              tone={status?.connection === "open" ? "success" : "warning"}
            >
              {status?.connection ?? "unknown"}
            </StatusBadge>
            <p className="card__meta">
              {status?.lastError ?? "Belum ada error dari bot runtime."}
            </p>
            <button className="button button--primary">Reset Session</button>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
