"use client";

import { useLinkStatus } from "next/link";
import { Spinner } from "@/components/ui/Spinner";

// Must render as a descendant of a next/link <Link> -- shows a spinner only
// while that specific link's navigation is actually pending (e.g. the
// destination wasn't fully prefetched yet), so a fast/prefetched nav still
// feels instant and only a genuinely slow one gets a loading indicator.
export function NavLinkHint() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <Spinner className="h-3.5 w-3.5" />;
}
