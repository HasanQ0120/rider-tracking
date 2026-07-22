import { SelectHTMLAttributes } from "react";

// Same props/behavior as a plain <select> -- visual-only standardization,
// matching Input's treatment.
export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full rounded-lg border border-brand-navy/30 bg-white px-4 py-2.5 text-brand-navy ${className}`}
      {...props}
    />
  );
}
