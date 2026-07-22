import { ReactNode } from "react";

type Tone = "success" | "danger" | "warning";

// Deliberately reads from `status-*`, never `brand-*` -- a grep for
// `brand-` inside this file is the regression check for the "status colors
// stay standard, never rebranded" rule.
const toneClasses: Record<Tone, string> = {
  success: "bg-status-success/10 text-status-success border-status-success/30 border-l-status-success",
  danger: "bg-status-danger/10 text-status-danger border-status-danger/30 border-l-status-danger",
  warning: "bg-status-warning/10 text-status-warning border-status-warning/30 border-l-status-warning",
};

export function StatusBanner({
  tone,
  children,
}: {
  tone: Tone;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      className={`animate-slide-up rounded-lg border border-l-4 px-4 py-3 text-sm font-medium ${toneClasses[tone]}`}
    >
      {children}
    </div>
  );
}
