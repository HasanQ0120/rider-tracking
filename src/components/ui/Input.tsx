import { ComponentProps } from "react";

// Same props/behavior as a plain <input> -- this only standardizes the
// visual treatment (border, radius, padding, focus state) that was
// previously duplicated with slightly different values across every form.
// ComponentProps<"input"> (rather than InputHTMLAttributes) so `ref` type-
// checks -- React 19 forwards it through a plain function component without
// needing forwardRef, but the props type still has to declare it.
export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      className={`w-full rounded-lg border border-brand-navy/30 px-4 py-2.5 text-brand-navy placeholder:text-brand-navy/40 ${className}`}
      {...props}
    />
  );
}
