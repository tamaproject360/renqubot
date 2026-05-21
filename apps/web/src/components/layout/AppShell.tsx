const navigationItems = [
  'Setup',
  'Integrations',
  'WhatsApp',
  'Transactions',
  'System',
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '240px 1fr',
        minHeight: '100vh',
      }}
    >
      <aside
        style={{
          borderRight: '1px solid #1e293b',
          padding: '24px 16px',
          background: '#020617',
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>
          Renqu Bot
        </div>
        <nav style={{ display: 'grid', gap: 12 }}>
          {navigationItems.map((item) => (
            <div
              key={item}
              style={{
                border: '1px solid #1e293b',
                borderRadius: 12,
                padding: '12px 14px',
                background: '#111827',
              }}
            >
              {item}
            </div>
          ))}
        </nav>
      </aside>
      <main style={{ padding: 24 }}>{children}</main>
    </div>
  );
}
