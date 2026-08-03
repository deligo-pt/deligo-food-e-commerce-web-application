"use client";

import { X } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface ClearFilterButtonProps {
  /** Empties the field AND resets whatever it filters. */
  onClear: () => void;
  /** Extra positioning/colour overrides — the navbar sits on a pink bar. */
  className?: string;
  size?: number;
}

/**
 * The cross inside a filter field that wipes the text and the filter with it.
 *
 * Positioned absolutely, so the wrapper around the input must be `relative` and
 * the input needs right padding wide enough to clear it (`pr-11` for the 16px
 * icon at `right-4`). `onMouseDown` is swallowed so clicking the cross doesn't
 * blur the input first — the caret stays put and the user can keep typing.
 */
export default function ClearFilterButton({
  onClear,
  className = "",
  size = 16,
}: ClearFilterButtonProps) {
  const { t } = useTranslation();
  const label = t("clearSearch");

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClear}
      aria-label={label}
      title={label}
      className={`absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full p-0.5 text-gray-400 dark:text-neutral-500 transition-colors hover:text-gray-600 dark:hover:text-neutral-300 ${className}`}
    >
      <X size={size} />
    </button>
  );
}
