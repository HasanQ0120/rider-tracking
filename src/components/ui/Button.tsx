import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "accent" | "accent-outline";

const variantClasses: Record<Variant, string> = {
  // Main actions ("Delivered", "I've Arrived"): navy fill, white text.
  primary:
    "bg-brand-navy text-white shadow-sm hover:bg-brand-navy/90 hover:shadow disabled:bg-brand-navy/40 disabled:shadow-none",
  // Call buttons: gold fill, navy text -- hardcoded, never gold text on
  // white. This is what structurally prevents that contrast mistake.
  accent:
    "bg-brand-gold text-brand-navy shadow-sm hover:bg-brand-gold/90 hover:shadow disabled:bg-brand-gold/40 disabled:shadow-none",
  "accent-outline":
    "bg-transparent text-brand-navy border-2 border-brand-navy hover:bg-brand-navy/5 disabled:opacity-40",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
