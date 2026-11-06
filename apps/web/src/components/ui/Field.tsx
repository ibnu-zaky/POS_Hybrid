// components/ui/Field.tsx
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label?: string };
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: string };
type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string };

export function Field({ label, id, className = "", ...props }: FieldProps) {
  return (
    <label className="field" htmlFor={id}>
      {label && <span>{label}</span>}
      <span className="box r3">
        <input id={id} className={className} {...props} />
      </span>
    </label>
  );
}

export function SelectField({ label, id, children, className = "", ...props }: SelectProps) {
  return (
    <label className="field" htmlFor={id}>
      {label && <span>{label}</span>}
      <span className="box r2">
        <select id={id} className={className} {...props}>
          {children}
        </select>
      </span>
    </label>
  );
}

export function TextareaField({ label, id, className = "", ...props }: TextareaProps) {
  return (
    <label className="field" htmlFor={id}>
      {label && <span>{label}</span>}
      <span className="box r2">
        <textarea id={id} className={className} {...props} />
      </span>
    </label>
  );
}
