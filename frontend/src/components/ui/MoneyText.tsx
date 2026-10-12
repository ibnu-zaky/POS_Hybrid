// components/ui/MoneyText.tsx
import { formatRp } from "../../lib/money";

export function MoneyText({ value, size }: { value: number; size?: "large" | "small" }) {
  if (size === "large") {
    return <span className="grain" style={{ fontFamily: "var(--font-title)" }}>{formatRp(value)}</span>;
  }
  return <span>{formatRp(value)}</span>;
}
