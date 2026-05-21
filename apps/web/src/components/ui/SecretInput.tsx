import { FormField } from "./FormField";

interface ISecretInputProps {
  label: string;
  placeholder: string;
}

export function SecretInput({ label, placeholder }: ISecretInputProps) {
  return (
    <FormField
      label={label}
      hint="Secret disimpan lewat endpoint khusus dan tidak ditampilkan ulang dalam bentuk plain text."
    >
      <input className="input" placeholder={placeholder} type="password" />
    </FormField>
  );
}
