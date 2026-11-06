// components/ui/Chip.tsx
import { Button } from "./Button";

type Props = {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  /** radius border: r1 (default), r2, r3 — variasi acak ala kapur */
  radius?: "r1" | "r2" | "r3";
};

export function Chip({ active, onClick, children, radius = "r1" }: Props) {
  return (
    <Button variant="small" radius={radius} active={active} onClick={onClick}>
      {children}
    </Button>
  );
}
