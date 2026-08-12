"use client";

import { useState } from "react";
import { Check, Copy, Store } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation";

interface PickupCodeCardProps {
  /**
   * The code exactly as the API sent it.
   *
   * Typed as `string` and rendered verbatim, and that is not incidental. The
   * first real pickup order came back with `"087275"` — six characters, leading
   * zero. Coerce it through `Number()` anywhere and the customer reads "87275"
   * off the screen, gives five digits at the counter, and the vendor's lookup
   * fails. There is no arithmetic to do with this value; it is an identifier
   * that happens to be made of digits.
   */
  code: string;
  /** True once the vendor has marked the order ready to collect. */
  isReady: boolean;
}

/**
 * The code the customer reads out at the counter.
 *
 * Shown from the moment the order is placed. The backend generates it at
 * creation (`pickup.generatedAt` matches the order's `createdAt`), so there is
 * no "waiting for your code" state to design — only a note about whether the
 * food is ready yet, which is a different question.
 */
export default function PickupCodeCard({ code, isReady }: PickupCodeCardProps) {
  const { t } = useTranslation();
  const [hasCopied, setHasCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setHasCopied(true);
      // Long enough to register, short enough that the button is back to its
      // normal state before the customer looks again.
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      // Clipboard access is refused on insecure origins and by some privacy
      // settings. The code is on screen regardless, so this is a convenience
      // that failed, not a broken page.
      toast.error(t("copyFailed"));
    }
  };

  return (
    <div className="rounded-3xl border border-transparent bg-white p-6 shadow-md dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ffd9de] dark:bg-pink-950/30">
          <Store className="h-5 w-5 text-[#f9186b] dark:text-pink-400" />
        </div>
        <h3 className="text-lg font-bold text-[#191c1d] dark:text-neutral-50">
          {t("yourPickupCode")}
        </h3>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/* `tabular-nums` keeps the digits evenly spaced, and `tracking` gives
            the code the same wide, readable rhythm the mobile app uses — this
            is meant to be read aloud across a counter. */}
        <p
          className="rounded-2xl bg-pink-50 px-6 py-4 text-4xl font-extrabold tracking-[0.2em] tabular-nums text-[#f9186b] dark:bg-pink-950/20 dark:text-pink-400"
          aria-label={`${t("yourPickupCode")}: ${code.split("").join(" ")}`}
        >
          {code}
        </p>

        <button
          type="button"
          onClick={handleCopy}
          aria-label={t("copyCode")}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50"
        >
          {hasCopied ? (
            <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <Copy className="h-5 w-5" />
          )}
        </button>
      </div>

      <p className="mt-3 text-sm font-medium text-[#5a4044] dark:text-neutral-400">
        {isReady ? t("orderReadyShowCode") : t("showCodeAtCounter")}
      </p>
    </div>
  );
}
