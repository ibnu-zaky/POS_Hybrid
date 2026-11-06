// components/ui/Stepper.tsx
type Props = {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  name?: string;
};

export function Stepper({ value, onChange, min = 0, name }: Props) {
  return (
    <span className="step">
      <button
        type="button"
        aria-label={name ? `Kurangi ${name}` : "Kurangi"}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <output>{value}</output>
      <button
        type="button"
        aria-label={name ? `Tambah ${name}` : "Tambah"}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </span>
  );
}
