// Gold rounded-square badge with a dark upward-arrow glyph -- the app's
// brand mark, reused at different sizes on the login page and ops header.
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl bg-brand-gold"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.5}
        height={size * 0.5}
        fill="none"
        aria-hidden="true"
      >
        <path d="M12 2 L19 21 L12 17 L5 21 Z" fill="#0A192F" />
      </svg>
    </div>
  );
}
