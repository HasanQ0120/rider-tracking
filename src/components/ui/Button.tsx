import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "accent" | "accent-outline";
type Size = "sm" | "md";

// On the dark theme, gold is the one bright accent color and reads as the
// main call-to-action everywhere in the redesign (Sign In, New Order,
// Create Order, Assign, Mark as Delivered, ...) -- "primary" and "accent"
// now render identically. Never gold text on a light surface (the contrast
// mistake this used to guard against) is instead structurally prevented by
// there being no light surfaces left to put it on.
const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand-gold text-brand-navy shadow-sm hover:bg-brand-gold/90 hover:shadow disabled:bg-brand-gold/30 disabled:text-white/40 disabled:shadow-none",
  accent:
    "bg-brand-gold text-brand-navy shadow-sm hover:bg-brand-gold/90 hover:shadow disabled:bg-brand-gold/30 disabled:text-white/40 disabled:shadow-none",
  "accent-outline":
    "bg-transparent text-white border-2 border-white/25 hover:bg-white/5 disabled:opacity-40",
};

const sizeClasses: Record<Size, string> = {
  md: "px-5 py-3",
  sm: "px-3 py-1.5 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
