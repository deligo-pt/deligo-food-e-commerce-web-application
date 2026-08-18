"use client";

import { Search } from "lucide-react";
import ClearFilterButton from "@/components/shared/ClearFilterButton";
import { useTranslation } from "@/hooks/useTranslation";

interface OrderSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  /**
   * Matches across **both** tabs, or `null` when the box is empty.
   *
   * Both tabs on purpose: the customer is searching their orders, not the tab
   * they happen to be looking at, and a count that only described the visible
   * half would contradict the per-tab counts sitting right below it.
   */
  resultCount: number | null;
}

/**
 * The search field above the Ongoing/History tabs on `/orders`.
 *
 * Presentational and fully controlled — it owns no term of its own. The page
 * holds the state, because the same term drives two filtered lists and two tab
 * counts, none of which live in here.
 *
 * Visually it is the navbar's search field (`Navbar.tsx`): rounded-full, icon
 * inset left, pink focus ring, same clear button. That is deliberate — the app
 * already taught the customer what a search box looks like, and a second,
 * differently-shaped one on the same screen would read as a different kind of
 * control.
 *
 * No debounce, no submit, no Enter key: the results are already live (see
 * `useOrderSearch`), so there is nothing to submit and nothing to wait for.
 */
export default function OrderSearchBar({
  value,
  onChange,
  resultCount,
}: OrderSearchBarProps) {
  const { t } = useTranslation();
  const label = t("searchOrdersLabel");

  return (
    <div role="search" className="mb-6">
      <div className="relative flex items-center">
        <Search
          size={18}
          aria-hidden="true"
          className="absolute left-4 text-gray-400 dark:text-neutral-500"
        />
        <input
          // `type="search"` for the semantics and the mobile keyboard, minus
          // WebKit's own clear button — which would otherwise sit next to ours
          // and give the field two crosses that do the same thing.
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onChange("");
          }}
          aria-label={label}
          placeholder={t("searchOrdersPlaceholder")}
          autoComplete="off"
          enterKeyHint="search"
          className="w-full rounded-full border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 py-2.5 pl-12 pr-11 text-base text-[#191c1d] dark:text-neutral-100 outline-none placeholder:text-black/45 dark:placeholder:text-white/40 focus:ring-2 focus:ring-[#f9186b]/50 transition-colors [&::-webkit-search-cancel-button]:appearance-none"
        />
        {value.length > 0 && <ClearFilterButton onClear={() => onChange("")} />}
      </div>

      {/*
        Always mounted, never conditionally rendered, for two reasons that
        happen to agree: a live region has to exist in the DOM *before* its
        content changes or screen readers miss the first announcement, and a
        line that appears on the first keystroke would shove the tabs and every
        card below it down the page. `min-h-5` holds the one line of space it
        needs while idle.
      */}
      <p
        role="status"
        aria-live="polite"
        className="mt-2 min-h-5 text-sm text-[#5a4044] dark:text-neutral-400"
      >
        {resultCount === null
          ? null
          : /* `t()` takes one argument and does not interpolate, so the number
               is composed here rather than embedded in the string. */
            `${resultCount} ${resultCount === 1 ? t("resultLabel") : t("resultsLabel")}`}
      </p>
    </div>
  );
}
