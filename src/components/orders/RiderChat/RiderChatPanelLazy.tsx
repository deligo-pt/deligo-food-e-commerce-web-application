"use client";

import dynamic from "next/dynamic";

// Most order pages never open the rider chat, so the panel (and the dialog
// and list code behind it) is its own chunk, loaded on the first tap. Same
// arrangement as `SupportChatDialogLazy`.
const RiderChatPanelLazy = dynamic(() => import("./RiderChatPanel"), { ssr: false });

export default RiderChatPanelLazy;
