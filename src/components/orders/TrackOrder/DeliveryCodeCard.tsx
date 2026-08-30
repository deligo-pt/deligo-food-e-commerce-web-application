"use client";

import { useState } from "react";
import { Bike, Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";

interface DeliveryCodeCardProps {
  /**
   * The code exactly as the API sent it.
   *
   * Typed as `string` and rendered verbatim, for the reason `PickupCodeCard`
   * documents: the first real pickup code came back `"087275"` — six
   * characters, leading zero. Coerce it through `Number()` anywhere and the
   * customer reads "87275" off the screen, gives five digits to the rider, and
   * the verification fails with nothing to explain why. There is no arithmetic
   * to do with this value; it is an identifier that happens to be made of
   * digits.
   */
  code: string;
}

/**
 * The code the customer reads out to the rider at the door.
 *
 * The delivery-side twin of `PickupCodeCard`: the rider types this into their
 * own app, and that verification is what moves the order to `DELIVERED`.
 *
 * Shown from the moment the backend generates it, which is earlier than it
 * looks — `deliveryOtp.generatedAt` matches the `PICKED_UP` history entry to
 * the millisecond, one status before `ON_THE_WAY`. The caller gates on the
 * field being present rather than on a status, so there is no window where the
 * code exists and the customer cannot see it, and none where a spent code
 * lingers: `verifiedAt` arrives in the same response as `DELIVERED`.
 */
export default function DeliveryCodeCard({ code }: DeliveryCodeCardProps) {
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
          <Bike className="h-5 w-5 text-primary dark:text-pink-400" />
        </div>
        <h3 className="text-xl font-bold text-foreground dark:text-neutral-50">
          {t("yourDeliveryCode")}
        </h3>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/* One box per character, the way the mobile app draws it. Split on the
            string rather than formatted from a number — see the prop's note.
            `aria-hidden` on the boxes because a screen reader walking six
            separate elements reads six unrelated digits; the label below says
            it once, spelled out. */}
        <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
          {code.split("").map((char, index) => (
            <span
              // The code is fixed for the life of the card and characters
              // repeat ("300873" has two zeroes), so the position is the only
              // stable identity available — and the only one needed.
              key={index}
              className="flex h-14 w-11 items-center justify-center rounded-xl border-2 border-primary bg-pink-50 text-2xl font-extrabold tabular-nums text-primary dark:border-pink-400 dark:bg-pink-950/20 dark:text-pink-400"
            >
              {char}
            </span>
          ))}
        </div>

        {/* The spoken version: "three zero zero eight seven three" rather than
            "three hundred thousand". */}
        <span className="sr-only">
          {`${t("yourDeliveryCode")}: ${code.split("").join(" ")}`}
        </span>

        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={handleCopy}
          aria-label={t("copyCode")}
          className="rounded-2xl text-gray-500 dark:text-neutral-400"
        >
          {hasCopied ? (
            <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <Copy className="h-5 w-5" />
          )}
        </Button>
      </div>

      <p className="mt-3 text-sm font-medium text-muted-foreground dark:text-neutral-400">
        {t("giveCodeToRider")}
      </p>
    </div>
  );
}
