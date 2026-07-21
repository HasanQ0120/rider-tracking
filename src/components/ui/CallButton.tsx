import { Button } from "@/components/ui/Button";

export function CallButton({ phone, label }: { phone: string; label: string }) {
  return (
    <a href={`tel:${phone}`}>
      <Button variant="accent">{label}</Button>
    </a>
  );
}
