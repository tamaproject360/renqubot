import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SummaryStatCard } from "@/components/ui/SummaryStatCard";

const stats = [
  {
    label: "Readiness",
    value: "Phase 4",
    description: "Admin frontend MVP untuk setup dan operasional.",
  },
  {
    label: "Backend API",
    value: "REST v1",
    description: "Health, config, diagnostics, WhatsApp, transaksi.",
  },
  {
    label: "Layout",
    value: "Corporate",
    description: "Sidebar biru collapsible dan main area putih.",
  },
];

export function DashboardOverview() {
  return (
    <>
      <PageHeader
        description="Pantau readiness sistem, koneksi integrasi, dan status operasional bot dari satu console."
        eyebrow="Executive Overview"
        title="Dashboard Operasional"
      />

      <div className="grid grid--cards">
        {stats.map((stat) => (
          <SummaryStatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid grid--two" style={{ marginTop: 18 }}>
        <SectionCard
          title="Readiness Checklist"
          description="Ringkasan jalur onboarding sebelum bot dipakai produksi."
        >
          <div className="grid">
            <div>
              <StatusBadge tone="success">Backend API tersedia</StatusBadge>
            </div>
            <div>
              <StatusBadge tone="warning">
                Secret provider AI perlu diisi
              </StatusBadge>
            </div>
            <div>
              <StatusBadge tone="warning">WhatsApp perlu login QR</StatusBadge>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Admin Focus"
          description="Fitur frontend Phase 4 dipusatkan pada setup wizard, integrasi, WhatsApp session, transaksi, dan system review."
        >
          <p className="card__meta">
            Gunakan menu kiri untuk berpindah antar area. Sidebar bisa
            dicollapse untuk memberi ruang lebih luas pada layar monitoring.
          </p>
        </SectionCard>
      </div>
    </>
  );
}
