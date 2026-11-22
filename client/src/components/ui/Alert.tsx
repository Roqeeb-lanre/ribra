export function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-rose-200"
    >
      {children}
    </div>
  );
}
