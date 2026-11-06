// components/ui/EmptyState.tsx
export function EmptyState({ message, icon }: { message: string; icon?: React.ReactNode }) {
  return (
    <div className="empty">
      {icon}
      {message}
    </div>
  );
}
