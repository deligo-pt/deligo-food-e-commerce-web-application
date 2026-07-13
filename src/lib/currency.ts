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
