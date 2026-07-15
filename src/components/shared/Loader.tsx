"use client";

import Image from "next/image";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Brand loader — a spinning pink arc around the DeliGo logo chip.
 *
 * `fullScreen` centers it within ~70vh (not `min-h-screen`, which sits *below*
 * the sticky navbar and pushes the spinner past the viewport centre). Pass
 * `label={null}` to hide the caption, or a custom string to override "Loading…".
 */
export default function Loader({
  label,
  fullScreen = false,
  size = "md",
  className = "",
}: {
  label?: string | null;
  fullScreen?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const { t } = useTranslation();
  const text = label === null ? null : (label ?? t("loading"));

  const ring = size === "sm" ? "h-11 w-11" : "h-16 w-16";
  const chip = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const logo = size === "sm" ? 16 : 22;
  const border = size === "sm" ? "border-2" : "border-[3px]";

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "flex flex-col items-center justify-center gap-5",
        fullScreen
          ? "min-h-[70vh] w-full bg-[#f8f9fa] dark:bg-neutral-950"
          : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className={`relative inline-flex items-center justify-center ${ring}`}>
        {/* faint track */}
        <span
          className={`absolute inset-0 rounded-full ${border} border-[#f9186b]/15 dark:border-pink-500/20`}
        />
        {/* spinning brand arc */}
        <span
          className={`absolute inset-0 animate-spin rounded-full ${border} border-transparent border-t-[#f9186b] border-r-[#f9186b] dark:border-t-pink-500 dark:border-r-pink-500`}
        />
        {/* logo chip in the centre (echoes the navbar mark) */}
        <span
          className={`flex ${chip} items-center justify-center rounded-xl bg-white shadow-[0_2px_10px_rgba(249,24,107,0.25)] ring-1 ring-black/5`}
        >
          <Image
            src="/deligoLogo.png"
            alt=""
            width={logo}
            height={logo}
            className="rounded-md"
            priority
          />
        </span>
      </span>

      {text ? (
        <span className="text-sm font-medium text-gray-500 dark:text-neutral-400">
          {text}
        </span>
      ) : null}
      <span className="sr-only">{t("loading")}</span>
    </div>
  );
}
