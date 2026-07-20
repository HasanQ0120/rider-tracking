import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "accent" | "accent-outline";

const variantClasses: Record<Variant, string> = {
  // Main actions ("Delivered", "I've Arrived"): navy fill, white text.
  primary:
    "bg-brand-navy text-white hover:bg-brand-navy/90 disabled:bg-brand-navy/40",
  // Call buttons: gold fill, navy text -- hardcoded, never gold text on
  // white. This is what structurally prevents that contrast mistake.
  accent:
    "bg-brand-gold text-brand-navy hover:bg-brand-gold/90 disabled:bg-brand-gold/40",
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
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold transition-colors disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
