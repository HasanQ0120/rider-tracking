// Demo aid only -- names which of the four perspectives (rider/customer/
// ops/merchant) a screen belongs to, subtly enough not to compete with the
// real UI. No styling variants: the same pill works sitting in a dark
// header row (ops/merchant) or floating over a map (rider/customer).
export function ViewBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-white/15 bg-black/50 px-3 py-1 text-xs font-medium text-white/70 backdrop-blur-sm">
      {label}
    </span>
  );
}
