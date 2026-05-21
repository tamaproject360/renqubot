interface ISectionCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function SectionCard({
  title,
  description,
  children,
}: ISectionCardProps) {
  return (
    <section className="card">
      <h2 className="card__title">{title}</h2>
      {description ? <p className="card__meta">{description}</p> : null}
      <div style={{ marginTop: 18 }}>{children}</div>
    </section>
  );
}
