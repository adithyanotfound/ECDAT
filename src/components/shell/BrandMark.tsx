/**
 * The Vajra mark: a gold globe with one meridian picked out as a key bit,
 * on a charcoal tile. Pure SVG, so it's crisp at any size.
 */
export function BrandMark({ size = 32, onDark = false }: { size?: number; onDark?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill={onDark ? "#2a2d33" : "#1f2126"} />
      <circle cx="16" cy="16" r="9" stroke="#d9ae4a" strokeWidth="1.8" />
      <ellipse cx="16" cy="16" rx="4" ry="9" stroke="#d9ae4a" strokeWidth="1.4" opacity="0.8" />
      <path d="M7 16h18" stroke="#d9ae4a" strokeWidth="1.4" opacity="0.8" />
      <circle cx="25" cy="16" r="2.4" fill="#d9ae4a" />
    </svg>
  );
}

export function BrandName({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className={`text-[15px] font-semibold tracking-tight ${onDark ? "text-white" : "text-ink"}`}>
      Vajra
    </span>
  );
}
