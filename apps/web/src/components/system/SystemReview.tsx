import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function SystemReview() {
  return (
    <>
      <PageHeader
        description="Review konfigurasi, environment summary, dan audit trail operasional."
        eyebrow="System Governance"
        title="System Review"
      />

      <div className="grid grid--two">
        <SectionCard
          title="Configuration Review"
          description="Ringkasan field readiness Config Platform."
        >
          <div className="grid">
            <StatusBadge tone="warning">Partial Setup</StatusBadge>
            <p className="card__meta">
              Gunakan halaman Setup untuk melengkapi field wajib.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Audit Trail"
          description="Perubahan config dicatat di backend sebagai JSONL."
        >
          <p className="card__meta">
            Audit log tersedia di `data/config/audit-log.jsonl` untuk fase
            backend saat ini.
          </p>
        </SectionCard>
      </div>
    </>
  );
}
