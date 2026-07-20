// Fee VAT, as the API actually reports it (verified against
// GET /checkout/summary and GET /orders/:id on 2026-07-16):
//
//   orderCalculation: { serviceCharge: 1, serviceChargeVatRate: 23,
//                       serviceChargeVatAmount: 0.23 }
//   delivery:         { charge: 0.5, vatRate: 23, vatAmount: 0.12,
//                       totalDeliveryCharge: 0.62 }
//
// So the two fees are reported differently — `serviceCharge` is NET and
// `totalDeliveryCharge` is GROSS — but each ships its own VAT amount. Read
// those fields rather than re-deriving the tax: the rate is the backend's to
// decide, and a hardcoded one would drift silently if it ever changed.
//
// The helpers below fall back to the standard rate only when a VAT field is
// missing, so a summary from an older deployment still reconciles.

/** Portuguese standard rate. Fallback only — prefer the VAT the API reports. */
export const STANDARD_TAX_RATE = 23;

/** Adds VAT to a net amount. */
export function addTax(net: number, rate: number = STANDARD_TAX_RATE): number {
  return net * (1 + rate / 100);
}

/** Extracts the VAT embedded in a tax-inclusive (gross) amount. */
export function extractTax(
  gross: number,
  rate: number = STANDARD_TAX_RATE,
): number {
  if (gross <= 0) return 0;
  return gross - gross / (1 + rate / 100);
}

export interface ServiceChargeFields {
  serviceCharge?: number;
  serviceChargeVatAmount?: number;
}

export interface DeliveryFields {
  vatAmount?: number;
  totalDeliveryCharge?: number;
}

/**
 * The service fee as charged — `grandTotal` includes its VAT, so the net figure
 * alone would leave the breakdown short by exactly the tax.
 */
export function getServiceChargeGross(calc: ServiceChargeFields): number {
  const net = calc.serviceCharge ?? 0;
  if (net <= 0) return 0;
  const vat = calc.serviceChargeVatAmount;
  return net + (typeof vat === "number" ? vat : addTax(net) - net);
}

/** The VAT already contained in the (gross) delivery charge. */
export function getDeliveryTax(delivery: DeliveryFields): number {
  if (typeof delivery.vatAmount === "number") return delivery.vatAmount;
  return extractTax(delivery.totalDeliveryCharge ?? 0);
}
