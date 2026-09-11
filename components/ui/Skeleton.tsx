// Lightweight pulsing placeholder block - callers supply sizing/rounding
// via className so this stays a plain primitive with no default shape.
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-th-surface-alt ${className}`} />
}
