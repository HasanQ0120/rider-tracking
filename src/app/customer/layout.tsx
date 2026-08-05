import { ViewBadge } from "@/components/ui/ViewBadge";

// Same reasoning as src/app/rider/layout.tsx -- no header of its own, and
// the customer tracking page already has a fixed bottom action bar
// (z-[2000]), so the badge sits in the top corner instead.
export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <div className="fixed top-3 right-3 z-[3000]">
        <ViewBadge label="Customer View" />
      </div>
    </>
  );
}
