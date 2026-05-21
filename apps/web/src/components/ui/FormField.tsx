interface IFormFieldProps {
  label: string;
  children: React.ReactNode;
  hint?: string;
}

export function FormField({ label, children, hint }: IFormFieldProps) {
  return (
    <div className="form-row">
      <label>{label}</label>
      {children}
      {hint ? <p className="card__meta">{hint}</p> : null}
    </div>
  );
}
