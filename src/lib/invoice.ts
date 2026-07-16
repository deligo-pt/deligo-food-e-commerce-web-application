import axios from "axios";
import { apiClient, getApiErrorMessage } from "./apiClient";
import { resolveLocalized, type LocalizedField } from "./localizedField";
import { addTax } from "./tax";

/* ------------------------------------------------------------------ *
 * Order shape (only the fields the invoice needs). The backend's own
 * PDF endpoint (Pasta Digital) is unreliable — "Could not retrieve PDF
 * invoice string from Pasta Digital" — so we render the invoice on the
 * client from the plain order JSON instead.
 * ------------------------------------------------------------------ */
interface InvoiceAddress {
  street?: string;
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
  items?: InvoiceItem[];
  orderCalculation?: {
    totalOriginalPrice?: number;
    totalProductDiscount?: number;
    totalOfferDiscount?: number;
    serviceCharge?: number;
  };
  delivery?: { totalDeliveryCharge?: number };
  payoutSummary?: { grandTotal?: number };
}

const money = (n: number | undefined) => `€${(n ?? 0).toFixed(2)}`;

// Add-on names arrive localized to a string; tolerate the bilingual object shape
// so an invoice never prints "[object Object]". The invoice is English-only, so
// it resolves to `en` regardless of the app's active language.
const resolveAddonName = (name: InvoiceAddon["name"]) =>
  resolveLocalized(name, "en");

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatAddress(addr?: InvoiceAddress): string[] {
  if (!addr) return [];
  const line1 = addr.street?.trim();
  const line2 = [
    addr.city,
    [addr.state, addr.postalCode].filter(Boolean).join(" "),
    addr.country,
  ]
    .filter(Boolean)
    .join(", ");
  const tag = addr.label || addr.name;
  return [line1, line2, tag && tag !== addr.city ? tag : undefined].filter(
    (l): l is string => Boolean(l),
  );
}

/**
 * Renders an order invoice as a PDF (matching the DeliGo receipt layout) and
 * triggers a browser download. Fetches the order JSON so it works from any
 * call site that only has the human order id.
 */
export async function downloadInvoice(orderId: string): Promise<void> {
  const res = await apiClient.get(`/orders/${orderId}`);
  const order: InvoiceOrder = res.data?.data ?? res.data;

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 18; // page margin
  const right = pageW - M;
  const NAME_LINE_H = 5; // leading for a wrapped item name

  const DARK: [number, number, number] = [25, 28, 29];
  const GRAY: [number, number, number] = [122, 122, 130];
  const LINE: [number, number, number] = [227, 228, 231];
  const RED: [number, number, number] = [214, 55, 63];

  const setColor = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const rule = (yy: number, thick = false, color = LINE) => {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(thick ? 0.6 : 0.3);
    doc.line(M, yy, right, yy);
  };

  let y = 24;

  // The footer is pinned to the bottom of the page, so body content has to stop
  // short of it and continue on a new page rather than printing through it.
  const BODY_BOTTOM = pageH - 52;
  // Returns whether a break happened, so callers can reprint anything the new
  // page needs (the items header).
  const ensureSpace = (needed: number) => {
    if (y + needed <= BODY_BOTTOM) return false;
    doc.addPage();
    y = 24;
    return true;
  };

  /* ---- Header ------------------------------------------------------ */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  setColor(DARK);
  doc.text("DeliGo", M, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  setColor(GRAY);
  doc.text("Fast and reliable food delivery", M, y);
  y += 7;
  rule(y);
  y += 11;

  /* ---- Meta (Order ID / Date, Shipped to / Payment) ---------------- */
  const colR = M + 92;

  const metaLabel = (text: string, x: number, yy: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setColor(GRAY);
    doc.text(text, x, yy);
  };

  metaLabel("Order ID", M, y);
  metaLabel("Date", colR, y);
  y += 5.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(DARK);
  doc.text(order.orderId || "—", M, y);
  doc.text(formatDate(order.createdAt) || "—", colR, y);
  y += 10;

  metaLabel("Shipped to", M, y);
  metaLabel("Payment", colR, y);
  y += 5.5;

  const addrLines = formatAddress(order.deliveryAddress);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  setColor(DARK);
  const wrapped = addrLines.flatMap((l) =>
    doc.splitTextToSize(l, colR - M - 6) as string[],
  );
  let addrY = y;
  wrapped.forEach((line) => {
    doc.text(line, M, addrY);
    addrY += 5.2;
  });

  doc.setFont("helvetica", "bold");
  doc.text(order.paymentMethod || "—", colR, y);

  y = Math.max(addrY, y + 5.2) + 6;
  rule(y);
  y += 10;

  /* ---- Items table ------------------------------------------------- */
  const xTotal = right;
  const xPrice = right - 30;
  const xQty = right - 62;

  // Reprinted after every page break — a continuation page of bare numbers
  // gives the reader no way to tell the columns apart.
  const itemsHeader = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setColor(GRAY);
    doc.text("No.", M, y);
    doc.text("Item", M + 12, y);
    doc.text("Qty", xQty, y, { align: "right" });
    doc.text("Price", xPrice, y, { align: "right" });
    doc.text("Total", xTotal, y, { align: "right" });
    y += 3;
    rule(y);
    y += 8;
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
    const nameLines = doc.splitTextToSize(item.name || "Item", xQty - (M + 12) - 6) as string[];

    // Keep a row — its wrapped name, sku and add-on lines included — from
    // splitting across a break.
    if (ensureSpace(12 + (nameLines.length - 1) * NAME_LINE_H + (sku ? 4.4 : 0) + addons.length * 4.6)) {
      itemsHeader();
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    setColor(DARK);
    doc.text(String(idx + 1), M, y);
    doc.text(String(qty), xQty, y, { align: "right" });
    doc.text(money(unit), xPrice, y, { align: "right" });
    doc.text(money(productTotal), xTotal, y, { align: "right" });

    // A long name wraps under the Item column instead of being cut off; the
    // numeric columns stay on the first line.
    doc.setFont("helvetica", "bold");
    let rowY = y;
    nameLines.forEach((line, i) => {
      if (i > 0) rowY += NAME_LINE_H;
      doc.text(line, M + 12, rowY);
    });

    if (sku) {
      rowY += 4.4;
      doc.setFontSize(8.5);
      setColor(GRAY);
      doc.text(sku, M + 12, rowY);
    }

    // Itemise add-ons: they're part of the amount charged, so an invoice that
    // folds them silently into the product's price doesn't stand up.
    addons.forEach((addon) => {
      rowY += 4.6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      setColor(GRAY);
      const addonQty = addon.quantity ?? 0;
      const label = `+ ${resolveAddonName(addon.name)}${addonQty > 1 ? ` x${addonQty}` : ""}`;
      doc.text(label, M + 14, rowY);
      doc.text(money(addon.lineTotal), xTotal, rowY, { align: "right" });
    });

    y = rowY + 8;
  });

  y += 1;
  rule(y);
  y += 11;

  /* ---- Totals ------------------------------------------------------ */
  // Keep the whole totals block (incl. the optional offer row) on one page.
  ensureSpace(62);

  const calc = order.orderCalculation ?? {};
  const totalPrice = calc.totalOriginalPrice ?? 0;
  const productDiscount = calc.totalProductDiscount ?? 0;
  const offerDiscount = calc.totalOfferDiscount ?? 0;
  const subtotal = totalPrice - productDiscount;
  // `serviceCharge` arrives net while every other figure here is gross, so it
  // has to carry its VAT before the totals will add up to what was charged.
  const serviceCharge = addTax(calc.serviceCharge ?? 0);
  const deliveryFee = order.delivery?.totalDeliveryCharge ?? 0;
  const grandTotal = order.payoutSummary?.grandTotal ?? 0;

  const tLabelX = M + 74;
  const totalRow = (
    label: string,
    value: string,
    opts: { bold?: boolean; size?: number; valueColor?: [number, number, number] } = {},
  ) => {
    const { bold = false, size = 11, valueColor = DARK } = opts;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    setColor(bold ? DARK : GRAY);
    doc.text(label, tLabelX, y);
    setColor(valueColor);
    doc.text(value, right, y, { align: "right" });
  };

  totalRow("Total Price", money(totalPrice));
  y += 8;
  totalRow("Discount", `-${money(productDiscount)}`, { valueColor: RED });
  y += 6;
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
  doc.setLineWidth(0.3);
  doc.line(tLabelX, y, right, y);
  y += 7;

  totalRow("Subtotal (incl. tax)", money(subtotal));
  y += 8;
  if (offerDiscount > 0) {
    totalRow("Offer discount", `-${money(offerDiscount)}`, { valueColor: RED });
    y += 8;
  }
  totalRow("Service Fee", money(serviceCharge));
  y += 8;
  totalRow("Delivery fee (Incl. tax)", money(deliveryFee));
  y += 6;
  doc.setDrawColor(DARK[0], DARK[1], DARK[2]);
  doc.setLineWidth(0.6);
  doc.line(tLabelX, y, right, y);
  y += 8;
  totalRow("Pay", money(grandTotal), { bold: true, size: 14 });

  /* ---- Footer ------------------------------------------------------ */
  // `ensureSpace` holds this band clear on every page, so the footer is drawn
  // on every page too — otherwise each page but the last ends in a blank strip.
  const drawFooter = () => {
    let fy = pageH - 44;
    rule(fy);
    fy += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setColor(DARK);
    doc.text("DeliGo", M, fy);
    fy += 6;

    const footerLine = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      setColor(GRAY);
      doc.text(label, M, fy);
      const w = doc.getTextWidth(label);
      doc.setFont("helvetica", "normal");
      doc.text(value, M + w + 1.5, fy);
      fy += 5.5;
    };

    footerLine("Address: ", "R. Joaquim Agostinho 16C, 1750-126 Lisboa.");
    footerLine("Phone: ", "+35121 757 0184 | +351 920 136 680");
    footerLine("Email: ", "contact@deligo.pt");
    footerLine("Website: ", "deligo.pt");
  };

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    drawFooter();
    if (pageCount > 1) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      setColor(GRAY);
      doc.text(`Page ${page} of ${pageCount}`, right, pageH - 44 - 4, { align: "right" });
    }
  }

  doc.save(`invoice-${order.orderId || orderId}.pdf`);
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
