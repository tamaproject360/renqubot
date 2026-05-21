interface ISummaryStatCardProps {
  label: string;
  value: string;
  description: string;
}

export function SummaryStatCard({
  label,
  value,
  description,
}: ISummaryStatCardProps) {
  return (
    <article className="card stat-card">
      <p className="card__meta">{label}</p>
      <div className="stat-card__value">{value}</div>
      <p className="card__meta">{description}</p>
    </article>
  );
}
