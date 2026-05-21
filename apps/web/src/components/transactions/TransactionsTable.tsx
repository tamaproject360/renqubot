import { PageHeader } from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";

const rows = [
  ["-", "Belum ada data", "-", "-", "-"],
  ["-", "Endpoint siap", "/api/transactions", "-", "-"],
];

export function TransactionsTable() {
  return (
    <>
      <PageHeader
        description="Listing transaksi awal untuk dashboard operasional dan review data keuangan."
        eyebrow="Finance Ledger"
        title="Transactions"
      />

      <SectionCard
        title="Transaksi Terbaru"
        description="Data akan diambil dari endpoint backend Phase 3."
      >
        <table className="table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Deskripsi</th>
              <th>Tipe</th>
              <th>Kategori</th>
              <th>Nominal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.join("-")}>
                {row.map((cell) => (
                  <td key={cell}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
    </>
  );
}
