"use client";

import dynamic from "next/dynamic";

// The chat panel is mounted in the (main) layout so any page can open it, but
// most visits never do. Splitting it into its own `ssr:false` chunk keeps it —
// and everything it pulls in — out of the bundle every page pays for. Same
// arrangement as `LocationPromptModalLazy`.
const SupportChatDialog = dynamic(() => import("./SupportChatDialog"), {
  ssr: false,
});

export default function SupportChatDialogLazy() {
  return <SupportChatDialog />;
}
