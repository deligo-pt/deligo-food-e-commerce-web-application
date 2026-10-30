"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Info, ReceiptEuro, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import type { Breakdown } from "@/lib/vatBreakdown";
import { formatEuro } from "@/lib/currency";

interface VatInfoButtonProps {
  breakdown: Breakdown;
  /** What the ⓘ opens, for screen readers ("See VAT details"). */
  label: string;
}

/**
 * The ⓘ beside a summary row and the breakdown it opens (26–27 Oct 2026):
 * Subtotal (items' VAT + service fee) and Delivery fee (charge + VAT), on the
 * checkout, payment and order pages. Styled after the payment page's support
 * panel so it reads as part of the same flow.
 */
export default function VatInfoButton({ breakdown, label }: VatInfoButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (breakdown.rows.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        className="focus-ring inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full align-middle text-gray-400 transition-colors hover:text-primary dark:text-neutral-500 dark:hover:text-pink-400"
      >
        <Info className="h-4 w-4" />
      </button>

      {/* On <body>, not where the button sits: the summary cards are
          `sticky` (a stacking context the overlay could not escape, leaving
          the navbar undimmed) and the "Incl. VAT" line is `text-xs`, which
          the panel would otherwise inherit. */}
      {open && createPortal(
        <div className="fixed inset-0 z-9999 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="breakdown-title"
            className="relative z-10 mx-0 w-full max-w-md overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:mx-4 sm:rounded-2xl"
          >
            <div className="flex items-center justify-between bg-linear-to-r from-primary to-primary-hover px-6 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                  <ReceiptEuro className="h-5 w-5 text-white" />
                </div>
                <h3 id="breakdown-title" className="text-xl font-bold text-white">
                  {breakdown.title}
                </h3>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t("close")}
                onClick={() => setOpen(false)}
                className="rounded-full bg-white/20 text-white hover:bg-white/30 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-6">
              {breakdown.intro && (
                <p className="text-sm text-gray-500 dark:text-neutral-400">{breakdown.intro}</p>
              )}

              {/* Two columns that line up: what each row costs, and the VAT
                  inside it. The bottom line is the row on the page. */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-semibold tracking-wider text-gray-400 uppercase dark:text-neutral-500">
                    <th className="pb-2 text-left font-semibold" />
                    <th className="pb-2 pl-3 text-right font-semibold">{t("breakdownPrice")}</th>
                    <th className="pb-2 pl-3 text-right font-semibold">{t("breakdownVatColumn")}</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.rows.map((row, index) => (
                    <tr key={`${row.label}-${index}`} className="align-top">
                      <td className={`py-2 ${row.isAddon ? "pl-4" : ""}`}>
                        <span
                          className={`block ${
                            row.isAddon
                              ? "text-gray-500 dark:text-neutral-400"
                              : "font-semibold text-gray-900 dark:text-neutral-50"
                          }`}
                        >
                          {row.isAddon && <span className="mr-1 text-primary dark:text-pink-400">+</span>}
                          {row.label}
                        </span>
                        {row.rateLabel && (
                          <span className="block text-xs text-gray-400 dark:text-neutral-500">{row.rateLabel}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-2 pl-3 text-right text-gray-900 dark:text-neutral-50">
                        {formatEuro(row.price)}
                      </td>
                      <td className="whitespace-nowrap py-2 pl-3 text-right text-gray-500 dark:text-neutral-400">
                        {formatEuro(row.vat)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border">
                    <td className="pt-3 font-bold text-gray-900 dark:text-neutral-50">{breakdown.total.label}</td>
                    <td className="whitespace-nowrap pt-3 pl-3 text-right text-base font-extrabold text-primary dark:text-pink-400">
                      {formatEuro(breakdown.total.price)}
                    </td>
                    <td className="whitespace-nowrap pt-3 pl-3 text-right font-bold text-gray-900 dark:text-neutral-50">
                      {formatEuro(breakdown.total.vat)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {breakdown.voucherLine && (
                <p className="rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400">
                  {breakdown.voucherLine}
                </p>
              )}

              {breakdown.notes.map((note) => (
                <p key={note} className="flex items-start gap-2 text-xs text-gray-500 dark:text-neutral-400">
                  <Info className="mt-1 h-3 w-3 shrink-0" />
                  {note}
                </p>
              ))}
            </div>

            <div className="border-t border-border px-6 py-4">
              <Button onClick={() => setOpen(false)} className="h-11 w-full rounded-xl font-semibold">
                {t("vatBreakdownDone")}
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
