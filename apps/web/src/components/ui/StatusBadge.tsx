type BadgeTone = "success" | "warning" | "danger";

interface IStatusBadgeProps {
  tone: BadgeTone;
  children: React.ReactNode;
}

export function StatusBadge({ tone, children }: IStatusBadgeProps) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}
