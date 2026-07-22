import { SelectHTMLAttributes } from "react";

// Same props/behavior as a plain <select> -- visual-only standardization,
// matching Input's treatment.
export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full rounded-lg border border-white/20 bg-surface px-4 py-2.5 text-white ${className}`}
      {...props}
    />
  );
}
