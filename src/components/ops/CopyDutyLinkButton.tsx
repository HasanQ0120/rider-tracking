"use client";

import { useState } from "react";

export function CopyDutyLinkButton({ dutyToken }: { dutyToken: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/duty/${dutyToken}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={copy}
      className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"
      title="Copy this rider's on-duty link"
    >
      {copied ? "Copied!" : "Duty Link"}
    </button>
  );
}
