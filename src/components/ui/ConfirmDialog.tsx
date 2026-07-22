"use client";

import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirming = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-brand-navy/50 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm animate-scale-in rounded-xl bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className="mb-2 text-lg font-semibold text-brand-navy">{title}</h2>}
        <p className="mb-5 text-sm text-brand-navy/80">{message}</p>
        <div className="flex gap-3">
          <Button variant="accent-outline" className="flex-1" onClick={onCancel} disabled={confirming}>
            {cancelLabel}
          </Button>
          <Button className="flex-1" onClick={onConfirm} disabled={confirming}>
            {confirming && <Spinner className="h-4 w-4" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
