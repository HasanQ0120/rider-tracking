import { ViewBadge } from "@/components/ui/ViewBadge";

// Wraps both rider routes under this segment ([token] and
// availability/[token]) -- neither has its own header, and both already
// use a fixed, full-width bottom action bar (z-[2000]), so the badge sits
// in the top corner instead to never spatially overlap it.
export default function RiderLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <div className="fixed top-3 right-3 z-[3000]">
        <ViewBadge label="Rider View" />
      </div>
    </>
  );
}
