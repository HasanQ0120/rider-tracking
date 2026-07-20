import { ReactNode } from "react";

type Tone = "success" | "danger" | "warning";

// Deliberately reads from `status-*`, never `brand-*` -- a grep for
// `brand-` inside this file is the regression check for the "status colors
// stay standard, never rebranded" rule.
const toneClasses: Record<Tone, string> = {
  success: "bg-status-success/10 text-status-success border-status-success/30",
  danger: "bg-status-danger/10 text-status-danger border-status-danger/30",
  warning: "bg-status-warning/10 text-status-warning border-status-warning/30",
};

export function StatusBanner({
  tone,
  children,
}: {
  tone: Tone;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${toneClasses[tone]}`}>
      {children}
    </div>
  );
}
