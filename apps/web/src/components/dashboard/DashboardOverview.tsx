const cards = [
  {
    title: "Architecture Target",
    value: "Split Frontend / Backend",
    description: "Next.js admin frontend dipisah dari Bun backend service.",
  },
  {
    title: "Current Phase",
    value: "Phase 1",
    description: "Fokus pada fondasi arsitektur dan boundary service.",
  },
  {
    title: "API Contract",
    value: "REST v1",
    description:
      "Kontrak awal untuk health, readiness, config, dan WhatsApp status.",
  },
];

export function DashboardOverview() {
  return (
    <section style={{ display: "grid", gap: 24 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 32 }}>Admin Console</h1>
        <p style={{ color: "#94a3b8", marginBottom: 0 }}>
          Fondasi frontend Next.js untuk setup wizard dan monitoring runtime.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        {cards.map((card) => (
          <article
            key={card.title}
            style={{
              border: "1px solid #1e293b",
              borderRadius: 16,
              padding: 20,
              background: "#111827",
            }}
          >
            <p style={{ color: "#94a3b8", marginTop: 0 }}>{card.title}</p>
            <h2 style={{ margin: "0 0 8px", fontSize: 22 }}>{card.value}</h2>
            <p style={{ margin: 0, color: "#cbd5e1" }}>{card.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
