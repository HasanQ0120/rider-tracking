import type { RefObject } from "react";

// Brings a failed-validation field into view instead of leaving the user to
// scroll and find it themselves -- e.g. a long form where the invalid field
// is above the submit button they just pressed.
export function scrollToError(ref: RefObject<HTMLElement | null>) {
  ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
}
