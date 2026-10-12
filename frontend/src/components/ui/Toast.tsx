// components/ui/Toast.tsx
import { useCallback, useState, type ReactNode } from "react";
import { ToastContext } from "./toast-context";

type ToastItem = { id: number; message: string };

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string) => {
    const id = nextId++;
    setItems((prev) => [...prev, { id, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 2400);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {items.map((t) => (
        <div key={t.id} className="toast" role="status" aria-live="polite">
          {t.message}
        </div>
      ))}
    </ToastContext.Provider>
  );
}
