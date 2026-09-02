import { forwardRef, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from "react";

export function MerchantCard({
  title,
  subtitle,
  id,
  className = "",
  children,
}: {
  title?: string;
  subtitle?: ReactNode;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      className={`scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}
    >
      {title ? (
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export const MerchantInput = forwardRef<HTMLInputElement, ComponentProps<"input">>(
  function MerchantInput({ className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[var(--merchant-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--merchant-accent)]/20 ${className}`}
        {...props}
      />
    );
  }
);

export function MerchantSelect({ className = "", ...props }: ComponentProps<"select">) {
  return (
    <select
      className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-[var(--merchant-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--merchant-accent)]/20 ${className}`}
      {...props}
    />
  );
}

type MerchantButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function MerchantButton({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: MerchantButtonVariant;
  size?: "sm" | "md";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50";
  const sizes = size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2.5 text-sm";
  const variants: Record<MerchantButtonVariant, string> = {
    primary: "bg-[var(--merchant-accent)] text-white shadow-sm hover:opacity-90",
    secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    danger: "text-red-600 hover:bg-red-50",
  };
  return (
    <button className={`${base} ${sizes} ${variants[variant]} ${className}`} {...props} />
  );
}

export function MerchantPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{title}</h1>
        {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function MerchantStatCard({
  label,
  value,
  hint,
  active,
  alert,
}: {
  label: string;
  value: number | string;
  hint: string;
  active?: boolean;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        active
          ? "border-[var(--merchant-primary)] bg-[var(--merchant-primary)] text-white"
          : "border-slate-200 bg-white text-slate-900"
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${
          active ? "text-white/70" : "text-slate-500"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-bold tabular-nums ${
          alert && !active ? "text-red-600" : ""
        }`}
      >
        {value}
      </p>
      <p className={`mt-1 text-xs ${active ? "text-white/70" : "text-slate-500"}`}>{hint}</p>
    </div>
  );
}

export function MerchantContentCard({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {title || subtitle || action ? (
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            {title ? <h2 className="text-lg font-semibold text-slate-900">{title}</h2> : null}
            {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className="p-6">{children}</div>
    </div>
  );
}
