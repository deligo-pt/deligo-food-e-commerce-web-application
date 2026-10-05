"use client";

import dynamic from "next/dynamic";

// Mounted in the (main) layout so the prompt can appear on any page, but it
// renders nothing on almost every visit. Its own `ssr:false` chunk keeps the
// rating dialog out of the bundle every page pays for. Same arrangement as
// `SupportChatDialogLazy`.
const OrderRatingPrompt = dynamic(() => import("./OrderRatingPrompt"), {
  ssr: false,
});

export default function OrderRatingPromptLazy() {
  return <OrderRatingPrompt />;
}
