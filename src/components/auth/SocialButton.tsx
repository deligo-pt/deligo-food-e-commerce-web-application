"use client";

import { LoaderCircle } from "lucide-react";

/**
 * A provider sign-in button.
 *
 * Its styling is dictated by Google, not by us. Google Identity Services draws
 * its own button and exposes no way to restyle it, so anything sitting beside
 * it has to match *it* — otherwise the row looks like two unrelated controls.
 * Hence the borrowed values below: they are the ones GIS uses for `outline`
 * (light) and `filled_black` (dark), not tokens from the DeliGo palette.
 *
 * Used for the Facebook button, and as the stand-in inside GoogleSignInButton
 * while GIS is still loading — one definition, so the two cannot drift.
 */
export default function SocialButton({
  onClick,
  label,
  icon,
  busy = false,
}: {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-busy={busy}
      className={[
        // 40px and pill: Google's `size: "large"` with `shape: "pill"`.
        "flex h-10 w-full cursor-pointer items-center justify-center gap-3 rounded-full border transition-colors",
        // 500 weight at 14px with 0.25px tracking is Google's button type.
        "text-sm font-medium tracking-[0.25px]",
        "border-[#dadce0] bg-white text-[#3c4043] hover:bg-[#f8f9fa]",
        "dark:border-[#8e918f] dark:bg-[#131314] dark:text-[#e3e3e3] dark:hover:bg-[#1f1f20]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7357c] focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-70",
      ].join(" ")}
    >
      {busy ? <LoaderCircle size={18} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}
