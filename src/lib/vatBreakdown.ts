/**
 * The ⓘ popups beside Subtotal and Delivery fee on the checkout, payment and
 * order pages (26–27 Oct 2026): a two-column table, Price | of which VAT.
 *
 * Prices are VAT-inclusive, so nothing here is added to a total — the VAT
 * column names VAT the customer is already paying. Every figure is the
 * backend's: a line's `itemSummary.grandTotal` / `totalTaxAmount`, each
 * add-on's `lineTotal` / `taxAmount`, the service fee net + its
 * `serviceChargeVatAmount`, and `delivery.totalDeliveryCharge` / `vatAmount`.
 *
 * Pure, no imports.
 */

type Named = string | { en?: string; pt?: string } | null | undefined;

function money(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value * 100) / 100
    : 0;
}

function rateOf(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function nameOf(name: Named, lang: "en" | "pt"): string {
  if (typeof name === "string") return name;
  return name?.[lang] || name?.en || name?.pt || "";
}

/* ---- The ⓘ popups (27 Oct 2026): a two-column table, Price | of which VAT ---- */

type Translate = (key: string) => string;

type PricedLine = {
  name?: Named;
  isPromoRewardLine?: boolean;
  productPricing?: { taxRate?: number } | null;
  itemSummary?: { quantity?: number; totalTaxAmount?: number; grandTotal?: number } | null;
  addons?: ({ name?: Named; quantity?: number; taxRate?: number; taxAmount?: number; lineTotal?: number } | null | undefined)[] | null;
} | null | undefined;

export interface BreakdownRow {
  label: string;
  /** "VAT 13%" under the label. */
  rateLabel?: string;
  /** What the customer pays for this row, VAT included. */
  price: number;
  /** The VAT inside `price`. */
  vat: number;
  isAddon?: boolean;
}

export interface Breakdown {
  title: string;
  intro: string;
  rows: BreakdownRow[];
  /** The rows added up — the figure on the page row the ⓘ sits beside. */
  total: { label: string; price: number; vat: number };
  /** With a voucher: "Subtotal 48.12 € − voucher 9.60 € = 38.52 €". */
  voucherLine?: string;
  notes: string[];
}

function rateLabel(rate: number | null, t: Translate): string | undefined {
  return rate === null ? undefined : t("vatRate").replace("{rate}", String(rate));
}

const euro = (n: number) => `${n.toFixed(2)}\u00A0€`;

/**
 * Each product and add-on as the backend priced it: the line's
 * `itemSummary.grandTotal` less its add-ons' `lineTotal` is the product's
 * price, and both already have any voucher taken off (checked 27 Oct 2026 with
 * a 20% voucher: Test Kids Menu €15 → €12, VAT €1.73 → €1.38). The VAT is the
 * backend's, so every row's VAT belongs to its own price.
 */
function itemRows(lines: PricedLine[], lang: "en" | "pt", t: Translate): BreakdownRow[] {
  const rows: BreakdownRow[] = [];
  for (const line of lines) {
    if (!line || line.isPromoRewardLine) continue;
    const addons = (line.addons ?? []).filter(Boolean);
    const addonPrice = addons.reduce((sum, addon) => sum + money(addon?.lineTotal), 0);
    const addonVat = addons.reduce((sum, addon) => sum + money(addon?.taxAmount), 0);
    const quantity = line.itemSummary?.quantity ?? 1;
    rows.push({
      label: `${nameOf(line.name, lang)}${quantity > 1 ? ` ×${quantity}` : ""}`,
      rateLabel: rateLabel(rateOf(line.productPricing?.taxRate), t),
      price: money((line.itemSummary?.grandTotal ?? 0) - addonPrice),
      vat: money((line.itemSummary?.totalTaxAmount ?? 0) - addonVat),
    });
    for (const addon of addons) {
      const addonQty = addon?.quantity ?? 1;
      rows.push({
        label: `${nameOf(addon?.name, lang)}${addonQty > 1 ? ` ×${addonQty}` : ""}`,
        rateLabel: rateLabel(rateOf(addon?.taxRate), t),
        price: money(addon?.lineTotal),
        vat: money(addon?.taxAmount),
        isAddon: true,
      });
    }
  }
  return rows.filter((row) => row.price > 0 || row.vat > 0);
}

function sum(rows: BreakdownRow[], key: "price" | "vat"): number {
  return money(rows.reduce((total, row) => total + row[key], 0));
}

/**
 * The Subtotal ⓘ: every product and add-on, then the service fee, each with
 * the VAT inside it. Without a voucher the total is exactly the Subtotal row;
 * with one the rows are after the voucher and `voucherLine` connects them back
 * to the Subtotal row and the voucher row on the page.
 */
export function subtotalBreakdown(input: {
  items: PricedLine[];
  lang: "en" | "pt";
  t: Translate;
  /** Omitted on the checkout page, where the fee is not priced yet. */
  service?: { gross: unknown; vat: unknown; rate: unknown } | null;
  /** The voucher's amount off the items, when one is applied. */
  voucherDiscount?: number;
  /** The Subtotal row as the page shows it, quoted by the voucher line. */
  pageSubtotal?: number;
  /** The page row's own name when it is not "Subtotal" (checkout: "Final Price"). */
  totalLabel?: string;
}): Breakdown {
  const { t } = input;
  const rows = itemRows(input.items, input.lang, t);
  const serviceGross = money(input.service?.gross);
  if (serviceGross > 0) {
    rows.push({
      label: t("serviceCharge"),
      rateLabel: rateLabel(rateOf(input.service?.rate), t),
      price: serviceGross,
      vat: money(input.service?.vat),
    });
  }

  const price = sum(rows, "price");
  const vat = sum(rows, "vat");
  const voucher = money(input.voucherDiscount);
  const notes: string[] = [];
  if (voucher > 0) notes.push(t("vatAfterVoucher"));
  if (!input.service) notes.push(t("vatFeesAtPayment"));

  return {
    title: t("vatBreakdownTitle"),
    intro: t("vatBreakdownIntro"),
    rows,
    total: { label: voucher > 0 ? t("breakdownAfterVoucher") : input.totalLabel ?? t("subtotal"), price, vat },
    voucherLine:
      voucher > 0
        ? t("breakdownVoucherLine")
            .replace("{subtotal}", euro(money(input.pageSubtotal ?? price + voucher)))
            .replace("{voucher}", euro(voucher))
            .replace("{total}", euro(money((input.pageSubtotal ?? price + voucher) - voucher)))
        : undefined,
    notes,
  };
}

/** The Delivery fee ⓘ: one row, the fee and the VAT inside it. */
export function deliveryBreakdown(input: {
  delivery: { vatRate?: unknown; vatAmount?: unknown; totalDeliveryCharge?: unknown; distance?: unknown };
  t: Translate;
}): Breakdown {
  const { t, delivery } = input;
  const row: BreakdownRow = {
    label: t("deliveryFee"),
    rateLabel: rateLabel(rateOf(delivery.vatRate), t),
    price: money(delivery.totalDeliveryCharge),
    vat: money(delivery.vatAmount),
  };
  const distance = typeof delivery.distance === "number" && delivery.distance > 0 ? delivery.distance : 0;
  return {
    title: t("deliveryBreakdownTitle"),
    intro: t("vatBreakdownIntro"),
    rows: [row],
    total: { label: t("deliveryFee"), price: row.price, vat: row.vat },
    notes: distance ? [t("deliveryDistanceNote").replace("{km}", distance.toFixed(2))] : [],
  };
}
