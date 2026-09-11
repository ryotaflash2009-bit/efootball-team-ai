export function Divider({ className = "", label }: { className?: string; label?: string }) {
  if (label) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <span className="h-px flex-1 bg-border" />
        <span className="text-2xs uppercase tracking-wide text-text-muted">{label}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    );
  }
  return <hr className={`border-0 border-t border-border ${className}`} />;
}
