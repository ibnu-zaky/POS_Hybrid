// components/ui/Button.tsx
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "fill" | "small" | "link";
  /** varian border-radius: r1 (default), r2, r3 */
  radius?: "r1" | "r2" | "r3";
  /** state aktif (untuk chip filter, method bayar, dst.) */
  active?: boolean;
};

export function Button({ variant = "default", radius = "r1", active, className = "", ...props }: Props) {
  const cls = [
    "btn",
    variant === "fill" ? "btn-fill fill" : "",
    variant === "small" ? "btn-small small" : "",
    variant === "link" ? "btn-link link" : "",
    radius !== "r1" ? radius : "",
    active ? "on" : "",
    "box",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <button className={cls} {...props} />;
}
