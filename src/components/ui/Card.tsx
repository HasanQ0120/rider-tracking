import { ReactNode } from "react";

// Shared container for every bordered "section box" across the ops panel --
// previously each page hand-rolled its own `rounded-lg border ... p-4`,
// with slightly different radii/padding here and there. One definition
// keeps every card visually identical and easy to adjust later.
export function Card({
  title,
  className = "",
  children,
}: {
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-white/10 bg-surface-raised p-5 shadow-sm transition-shadow hover:shadow-md hover:shadow-black/20 ${className}`}
    >
      {title && <h2 className="mb-3 font-semibold text-white">{title}</h2>}
      {children}
    </div>
  );
}
