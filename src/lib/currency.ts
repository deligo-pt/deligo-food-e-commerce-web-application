// The backend returns ISO currency codes (e.g. "EUR"), but the UI displays
// currency symbols. Map known codes to their symbol, falling back to the euro
// sign (the platform is euro-only) so we never render a bare code like "EUR".
const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
};

export function currencySymbol(code?: string | null): string {
  if (!code) return "€";
  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? code;
}

/**
 * An order's total, as it appears on an order card.
 *
 * Always `payoutSummary.grandTotal` — the one field that is the number the
 * customer paid. It is deliberately *not* derivable from `orderCalculation`,
 * whose parts sum to something else entirely (2 + 0.3 + 1 + 0.23 = 3.13 on an
 * order whose grand total is 2.83), so rebuilding it from the breakdown would
 * quietly disagree with both the app and the receipt.
 *
 * An order with no total is a data problem, not something to render as
 * "€undefined" — hence the dash.
 */
export function formatOrderPrice(amount?: number | null): string {
  return typeof amount === "number" ? `€${amount.toFixed(2)}` : "—";
}
