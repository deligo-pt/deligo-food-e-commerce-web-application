import axios from "axios";
import { apiClient, getApiErrorMessage } from "./apiClient";
import { resolveLocalized, type Lang, type LocalizedField } from "./localizedField";
import { getServiceChargeGross } from "./vat";
import { useStore } from "@/stores/translationStore";

/** The `t` from `useTranslation`, passed in because this is not a component. */
type Translate = (key: string) => string;

/* ------------------------------------------------------------------ *
 * Order shape (only the fields the invoice needs). The backend's own
 * PDF endpoint (Pasta Digital) is unreliable — "Could not retrieve PDF
 * invoice string from Pasta Digital" — so we render the invoice on the
 * client from the plain order JSON instead.
 * ------------------------------------------------------------------ */
interface InvoiceAddress {
  street?: string;
  /** House / apartment / floor. Empty string on older orders. */
  detailedAddress?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  label?: string;
  name?: string;
}

interface InvoiceAddon {
  name?: LocalizedField;
  quantity?: number;
  lineTotal?: number;
}

interface InvoiceItem {
  name?: string;
  sku?: string;
  variationSku?: string | null;
  addons?: InvoiceAddon[];
  itemSummary?: { quantity?: number; grandTotal?: number };
}

interface InvoiceOrder {
  orderId?: string;
  createdAt?: string;
  paymentMethod?: string;
  deliveryAddress?: InvoiceAddress;
  /** `"PICKUP"` on a self-collected order; absent on orders predating the field. */
  fulfillmentType?: string | null;
  vendorId?: { businessDetails?: { businessName?: string } };
  items?: InvoiceItem[];
  orderCalculation?: {
    totalOriginalPrice?: number;
    totalProductDiscount?: number;
    totalOfferDiscount?: number;
    // Net, with its VAT reported alongside.
    serviceCharge?: number;
    serviceChargeVatAmount?: number;
  };
  delivery?: { totalDeliveryCharge?: number; vatAmount?: number };
  payoutSummary?: { grandTotal?: number };
}

type RGB = [number, number, number];

/* ------------------------------------------------------------------ *
 * Palette — the app's own tokens, so a printed invoice and the screen
 * it was downloaded from read as the same product. Each entry keeps its
 * hex next to it because these are the literals used across the Tailwind
 * classes in `src/components`; change one there and change it here.
 *
 * An invoice gets printed, often on a mono laser, so colour here is
 * decorative only: every piece of information is carried by position,
 * weight or a rule as well, and each colour used for TEXT clears 4.5:1
 * against white — which survives a greyscale conversion, since that
 * conversion preserves luminance. That rules out large saturated fills
 * (a solid brand band prints as a heavy grey slab and eats toner) and
 * light grey text (#9AA0A6 is only 2.7:1 and prints faint).
 * ------------------------------------------------------------------ */
const BRAND: RGB = [249, 24, 107]; // #F9186B — primary, 3.9:1 (large text/rules only)
const BRAND_DEEP: RGB = [212, 20, 91]; // #D4145B — accents on small text, 5.2:1
const DARK: RGB = [25, 28, 29]; // #191C1D — headings
const MUTED: RGB = [90, 64, 68]; // #5A4044 — body copy
// Print-safe stand-in for the app's #9AA0A6 secondary text: same role, but
// 5.1:1 instead of 2.7:1 so 8pt SKUs and labels survive a laser printer.
const GRAY: RGB = [106, 111, 116]; // #6A6F74
const RULE: RGB = [213, 215, 218]; // #D5D7DA — structural hairlines, visible on paper
const PINK_LINE: RGB = [227, 189, 195]; // #E3BDC3 — tinted divider
const SURFACE: RGB = [248, 249, 250]; // #F8F9FA — panel fill
const PINK_TINT: RGB = [255, 242, 245]; // #FFF2F5 — table head fill (~2% ink)

const amount = (n: number | undefined) => (n ?? 0).toFixed(2);

// Add-on names arrive localized to a string; tolerate the bilingual object shape
// so an invoice never prints "[object Object]".
const resolveAddonName = (name: InvoiceAddon["name"], lang: Lang) =>
  resolveLocalized(name, lang);

const DATE_LOCALES: Record<Lang, string> = { en: "en-GB", pt: "pt-PT" };

function formatDate(iso: string | undefined, lang: Lang): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(DATE_LOCALES[lang], {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * The "Shipped to" block, as two lines:
 *
 *   [Street] [House / Apartment / Floor]
 *   [Postal code] [City]
 *
 * Postal code before city is the Portuguese postal convention ("1750-126
 * Lisboa"), and it matches the order the address form asks for them in.
 * Region and country are deliberately absent — deliveries are domestic, and
 * the label ("Home"/"Work") is the customer's own filing name, not part of
 * where the courier goes.
 */
function formatAddress(addr?: InvoiceAddress): string[] {
  if (!addr) return [];
  const line1 = [addr.street, addr.detailedAddress]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
  const line2 = [addr.postalCode, addr.city]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return [line1, line2].filter((l): l is string => Boolean(l));
}

/**
 * Renders an order invoice as a PDF (matching the DeliGo receipt layout) and
 * triggers a browser download. Fetches the order JSON so it works from any
 * call site that only has the human order id.
 *
 * `t` comes from the caller's `useTranslation` — this module isn't a component,
 * and the dictionaries are code-split, so it can't resolve keys on its own. The
 * language itself is read from the store (the same source `t` closes over) for
 * the date locale and for add-on names the backend returned bilingual.
 */
export async function downloadInvoice(
  orderId: string,
  t: Translate,
): Promise<void> {
  const lang: Lang = useStore.getState().lang ?? "pt";
  // apiClient sends Accept-Language, so product names come back in `lang`.
  const res = await apiClient.get(`/orders/${orderId}`);
  const order: InvoiceOrder = res.data?.data ?? res.data;

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 18; // page margin
  const right = pageW - M;
  const CW = right - M; // content width
  const NAME_LINE_H = 5; // leading for a wrapped item name
  const HEADER_RULE_Y = 35; // accent rule under the wordmark, page 1 only

  const setColor = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setStroke = (c: RGB, w = 0.3) => {
    doc.setDrawColor(c[0], c[1], c[2]);
    doc.setLineWidth(w);
  };
  const rule = (yy: number, color: RGB = RULE, w = 0.3) => {
    setStroke(color, w);
    doc.line(M, yy, right, yy);
  };

  // jsPDF's standard-Helvetica metrics under-report the euro glyph's advance
  // (1.96mm where a digit is 2.04mm), so a plain "€24.30" prints with the
  // symbol overlapping the 2. Drawing the symbol as its own right-aligned run,
  // one size-proportional kern clear of the number, sidesteps the bad metric
  // while keeping the `€12.15` format the app uses on screen. Every amount on
  // the invoice is right-aligned, so one helper covers them all.
  const money = (
    value: number | undefined,
    x: number,
    yy: number,
    opts: { negative?: boolean } = {},
  ) => {
    // The sign rides with the symbol ("-€4.40"), and the symbol ends its own
    // run, so the short advance has nothing left to collide with.
    const n = amount(value);
    doc.text(n, x, yy, { align: "right" });
    const kern = doc.getFontSize() * 0.075;
    const prefix = opts.negative ? "-€" : "€";
    doc.text(prefix, x - doc.getTextWidth(n) - kern, yy, { align: "right" });
  };

  // The footer is pinned to the bottom of the page, so body content has to stop
  // short of it and continue on a new page rather than printing through it.
  const BODY_BOTTOM = pageH - 34;
  // Continuation pages carry no brand band, so they start at the plain margin.
  const CONTINUED_TOP = 26;
  let y = 0;
  // Returns whether a break happened, so callers can reprint anything the new
  // page needs (the items header).
  const ensureSpace = (needed: number) => {
    if (y + needed <= BODY_BOTTOM) return false;
    doc.addPage();
    y = CONTINUED_TOP;
    return true;
  };

  /* ---- Header (page 1) --------------------------------------------- */
  // The wordmark carries the brand as *text* rather than a full-bleed colour
  // band: same recognition on screen, but a mono print stays mostly white
  // paper instead of a heavy grey slab, and nothing depends on white-on-colour
  // reversed type.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  setColor(BRAND);
  doc.text("DeliGo", M, 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  setColor(DARK);
  doc.text(t("invoiceTitle").toUpperCase(), right, 22, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(GRAY);
  doc.text(t("invoiceTagline"), M, 29);

  // One short brand segment, then a hairline the rest of the way: a small
  // colour cue that still reads as a divider once the colour is gone.
  setStroke(BRAND, 1.2);
  doc.line(M, HEADER_RULE_Y, M + 26, HEADER_RULE_Y);
  setStroke(RULE, 0.4);
  doc.line(M + 26, HEADER_RULE_Y, right, HEADER_RULE_Y);

  y = HEADER_RULE_Y + 9;

  /* ---- Meta panel (Order ID / Date, Shipped to / Payment) ---------- */
  const PX = 8; // panel padding
  const metaL = M + PX;
  const metaR = M + PX + 86;

  // A self-pickup order has no `deliveryAddress` at all, so "Shipped to" would
  // print as a labelled heading with nothing under it. The store the customer
  // collected from is the honest equivalent, and its name is the only part of
  // it the order document carries — the full store address lives on the vendor
  // record, which this function does not fetch.
  const isPickup = order.fulfillmentType === "PICKUP";

  // The panel is a filled box drawn *behind* its text, so its height has to be
  // known first — which means wrapping the address before anything is drawn.
  const addrLines = isPickup
    ? [order.vendorId?.businessDetails?.businessName].filter(
        (line): line is string => Boolean(line),
      )
    : formatAddress(order.deliveryAddress);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const wrapped = addrLines.flatMap(
    (l) => doc.splitTextToSize(l, 80) as string[],
  );
  const addrH = Math.max(wrapped.length, 1) * 5.0;
  const metaH = 9.5 + 5.2 + 9.5 + addrH + 5.5;

  setFill(SURFACE);
  setStroke(RULE);
  doc.roundedRect(M, y, CW, metaH, 3, 3, "FD");

  const metaLabel = (text: string, x: number, yy: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setColor(GRAY);
    doc.text(text.toUpperCase(), x, yy);
  };
  const metaValue = (text: string, x: number, yy: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    setColor(DARK);
    doc.text(text, x, yy);
  };

  let my = y + 9.5;
  metaLabel(t("invoiceOrderId"), metaL, my);
  metaLabel(t("invoiceDate"), metaR, my);
  my += 5.2;
  metaValue(order.orderId || "—", metaL, my);
  metaValue(formatDate(order.createdAt, lang) || "—", metaR, my);
  my += 9.5;

  metaLabel(isPickup ? t("collectFrom") : t("invoiceShippedTo"), metaL, my);
  metaLabel(t("invoicePayment"), metaR, my);
  my += 5.2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setColor(MUTED);
  let addrY = my;
  wrapped.forEach((line) => {
    doc.text(line, metaL, addrY);
    addrY += 5.0;
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setColor(DARK);
  doc.text(order.paymentMethod || "—", metaR, my);

  y += metaH + 8;

  /* ---- Items table ------------------------------------------------- */
  const xNo = M + 5;
  const xItem = M + 14;
  const xTotal = right - 5;
  const xPrice = xTotal - 28;
  const xQty = xPrice - 30;
  const NAME_W = xQty - xItem - 8;

  // Reprinted after every page break — a continuation page of bare numbers
  // gives the reader no way to tell the columns apart.
  const itemsHeader = () => {
    // The tint is ~2% ink — it colours the head on screen and all but vanishes
    // in mono, so the rule underneath is what actually separates head from body.
    setFill(PINK_TINT);
    doc.roundedRect(M, y, CW, 9, 1.5, 1.5, "F");
    setStroke(RULE, 0.5);
    doc.line(M, y + 9, right, y + 9);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setColor(DARK);
    const hy = y + 5.9;
    doc.text(t("invoiceNo").toUpperCase(), xNo, hy);
    doc.text(t("invoiceItem").toUpperCase(), xItem, hy);
    doc.text(t("invoiceQty").toUpperCase(), xQty, hy, { align: "right" });
    doc.text(t("invoicePrice").toUpperCase(), xPrice, hy, { align: "right" });
    doc.text(t("invoiceTotal").toUpperCase(), xTotal, hy, { align: "right" });
    // Leaves `y` on the baseline of the first row under the header.
    y += 9 + 7;
  };

  itemsHeader();

  const items = order.items ?? [];
  items.forEach((item, idx) => {
    const qty = item.itemSummary?.quantity ?? 0;
    const total = item.itemSummary?.grandTotal ?? 0;
    const addons = item.addons ?? [];
    // Add-ons are priced independently of the product's quantity, so the
    // product's own unit price is the line minus its add-ons, over the quantity.
    // Dividing the whole line by the quantity would invent a unit price that
    // matches nothing on the menu.
    const addonsTotal = addons.reduce((s, a) => s + (a.lineTotal ?? 0), 0);
    const productTotal = total - addonsTotal;
    const unit = qty > 0 ? productTotal / qty : productTotal;
    const sku = item.variationSku || item.sku;

    // Measured in the face the name is drawn in, so the wrap matches what
    // actually gets printed.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    const nameLines = doc.splitTextToSize(
      item.name || t("invoiceItem"),
      NAME_W,
    ) as string[];

    const rowH =
      7.4 +
      (nameLines.length - 1) * NAME_LINE_H +
      (sku ? 4.4 : 0) +
      addons.length * 4.6;

    // Keep a row — its wrapped name, sku and add-on lines included — from
    // splitting across a break.
    if (ensureSpace(rowH + 4)) itemsHeader();

    // A hairline under each row rather than zebra fills: rows here are
    // multi-line (name wrap + sku + add-ons) so they need a real separator,
    // and a 2%-grey band would simply disappear on a mono print.
    setStroke(RULE, 0.3);
    doc.line(M, y - 5.5 + rowH, right, y - 5.5 + rowH);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setColor(GRAY);
    doc.text(String(idx + 1), xNo, y);

    doc.setFontSize(10.5);
    setColor(MUTED);
    doc.text(String(qty), xQty, y, { align: "right" });
    money(unit, xPrice, y);

    doc.setFont("helvetica", "bold");
    setColor(DARK);
    money(productTotal, xTotal, y);

    // A long name wraps under the Item column instead of being cut off; the
    // numeric columns stay on the first line.
    let rowY = y;
    nameLines.forEach((line, i) => {
      if (i > 0) rowY += NAME_LINE_H;
      doc.text(line, xItem, rowY);
    });

    if (sku) {
      rowY += 4.4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      setColor(GRAY);
      doc.text(sku, xItem, rowY);
    }

    // Itemise add-ons: they're part of the amount charged, so an invoice that
    // folds them silently into the product's price doesn't stand up.
    addons.forEach((addon) => {
      rowY += 4.6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      setColor(BRAND_DEEP);
      const addonQty = addon.quantity ?? 0;
      const label = `+ ${resolveAddonName(addon.name, lang)}${addonQty > 1 ? ` x${addonQty}` : ""}`;
      doc.text(label, xItem + 2, rowY);
      money(addon.lineTotal, xTotal, rowY);
    });

    y = rowY + 7.4;
  });

  y += 3;

  /* ---- Totals ------------------------------------------------------ */
  const calc = order.orderCalculation ?? {};
  const totalPrice = calc.totalOriginalPrice ?? 0;
  const productDiscount = calc.totalProductDiscount ?? 0;
  const offerDiscount = calc.totalOfferDiscount ?? 0;
  const subtotal = totalPrice - productDiscount;
  // `serviceCharge` arrives net while every other figure here is gross, so it
  // has to carry the VAT the backend reports before the totals add up to what
  // was charged.
  const serviceCharge = getServiceChargeGross(calc);
  const deliveryFee = order.delivery?.totalDeliveryCharge ?? 0;
  const grandTotal = order.payoutSummary?.grandTotal ?? 0;

  const T_ROW = 6.6;
  const PAY_H = 12;
  // Total Price, Discount, Subtotal, [Offer], Service Fee, Delivery fee.
  const totalsRows = 5 + (offerDiscount > 0 ? 1 : 0);
  const panelW = 98;
  const panelX = right - panelW;
  // Derived from where the last row's baseline actually lands (first baseline
  // at +9.5, then one T_ROW per gap, plus 4.5 for the divider) so the space
  // above the Pay chip stays 6.5mm whether or not the offer row is present.
  const panelH = 9.5 + (totalsRows - 1) * T_ROW + 4.5 + 6.5 + PAY_H + 4.5;

  // Keep the whole totals block — divider and Pay bar included — on one page.
  ensureSpace(panelH + 2);

  setFill(SURFACE);
  setStroke(RULE);
  doc.roundedRect(panelX, y, panelW, panelH, 3, 3, "FD");

  const tLabelX = panelX + 8;
  const tValueX = right - 8;
  let ty = y + 9.5;

  const totalRow = (
    label: string,
    value: number,
    opts: { negative?: boolean; color?: RGB } = {},
  ) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    setColor(MUTED);
    doc.text(label, tLabelX, ty);
    doc.setFont("helvetica", "bold");
    setColor(opts.color ?? DARK);
    money(value, tValueX, ty, { negative: opts.negative });
    ty += T_ROW;
  };

  totalRow(t("invoiceTotalPrice"), totalPrice);
  totalRow(t("invoiceDiscount"), productDiscount, {
    negative: true,
    color: BRAND_DEEP,
  });

  ty -= 2;
  setStroke(PINK_LINE, 0.3);
  doc.line(tLabelX, ty, tValueX, ty);
  ty += 6.5;

  totalRow(t("invoiceSubtotal"), subtotal);
  if (offerDiscount > 0) {
    totalRow(t("invoiceOfferDiscount"), offerDiscount, {
      negative: true,
      color: BRAND_DEEP,
    });
  }
  totalRow(t("invoiceServiceFee"), serviceCharge);
  // Omitted on a collected order rather than printed as €0.00, matching the
  // payment and tracking pages: there was no delivery to charge for. The grand
  // total below is the backend's own figure either way, so the rows still add
  // up to it.
  if (!isPickup) {
    totalRow(t("invoiceDeliveryFee"), deliveryFee);
  }

  // The amount actually charged is the one number a reader scans for, so it
  // gets the emphasis — but from a rule and 15pt type rather than a filled
  // brand chip. Reversed white-on-pink was the weakest thing on the page once
  // printed in mono; a rule plus size reads the same in both.
  const payY = y + panelH - 4.5 - PAY_H;
  setStroke(DARK, 0.6);
  doc.line(tLabelX, payY, tValueX, payY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  setColor(DARK);
  doc.text(t("invoicePay"), tLabelX, payY + 9);
  doc.setFontSize(15);
  setColor(BRAND_DEEP);
  money(grandTotal, tValueX, payY + 9);

  /* ---- Footer ------------------------------------------------------ */
  // `ensureSpace` holds this band clear on every page, so the footer is drawn
  // on every page too — otherwise each page but the last ends in a blank strip.
  // Two columns rather than four stacked lines: the same four contact details
  // in half the height, which is what buys a typical order enough room to keep
  // its totals on page one.
  const drawFooter = () => {
    const top = pageH - 30;
    rule(top, PINK_LINE, 0.4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    setColor(BRAND);
    doc.text("DeliGo", M, top + 7);

    // `labelKey` resolves to the bare word; the colon and spacing are layout,
    // not translation, so they're added here rather than baked into the string.
    const footerLine = (
      labelKey: string,
      value: string,
      col: number,
      row: number,
    ) => {
      const x = M + col * 92;
      const fy = top + 13 + row * 5.3;
      const label = `${t(labelKey)}: `;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      setColor(DARK);
      doc.text(label, x, fy);
      doc.setFont("helvetica", "normal");
      setColor(MUTED);
      doc.text(value, x + doc.getTextWidth(label) + 1.5, fy);
    };

    footerLine("invoiceAddress", "R. Joaquim Agostinho 16C, 1750-126 Lisboa.", 0, 0);
    footerLine("invoicePhone", "+35121 757 0184 | +351 920 136 680", 0, 1);
    footerLine("invoiceEmail", "contact@deligo.pt", 1, 0);
    footerLine("invoiceWebsite", "deligo.pt", 1, 1);
  };

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    drawFooter();
    if (pageCount > 1) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      setColor(GRAY);
      const pageLabel = t("invoicePageOf")
        .replace("{page}", String(page))
        .replace("{total}", String(pageCount));
      doc.text(pageLabel, right, pageH - 34, { align: "right" });
    }
  }

  doc.save(`${t("invoiceFilePrefix")}-${order.orderId || orderId}.pdf`);
}

/**
 * Kept for call-site compatibility. Invoice errors are now plain JSON (not a
 * Blob), so this defers to the standard extractor; the Blob branch remains for
 * safety in case a call still returns a blob body.
 */
export async function extractBlobErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      const text = await error.response.data.text();
      const json = JSON.parse(text);
      return json?.errorSources?.[0]?.message || json?.message || fallback;
    } catch {
      return fallback;
    }
  }
  return getApiErrorMessage(error, fallback);
}
