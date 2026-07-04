"use client";

import dynamic from "next/dynamic";

// Client-only geolocation overlay — split into its own chunk (ssr:false) so it
// stays out of the initial server-rendered bundle shared by every page.
const LocationPromptModal = dynamic(() => import("./LocationPromptModal"), {
  ssr: false,
});

export default function LocationPromptModalLazy() {
  return <LocationPromptModal />;
}
