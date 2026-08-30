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
// those fields rather than re-deriving the VAT: the rate is the backend's to
// decide, and a hardcoded one would drift silently if it ever changed.
//
// The helpers below fall back to the standard rate only when a VAT field is
// missing, so a summary from an older deployment still reconciles.

/** Portuguese standard rate. Fallback only — prefer the VAT the API reports. */
export const STANDARD_VAT_RATE = 23;

/** Adds VAT to a net amount. */
export function addVat(net: number, rate: number = STANDARD_VAT_RATE): number {
  return net * (1 + rate / 100);
}

/** Extracts the VAT embedded in a VAT-inclusive (gross) amount. */
export function extractVat(
  gross: number,
  rate: number = STANDARD_VAT_RATE,
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
 * alone would leave the breakdown short by exactly the VAT.
 */
export function getServiceChargeGross(calc: ServiceChargeFields): number {
  const net = calc.serviceCharge ?? 0;
  if (net <= 0) return 0;
  const vat = calc.serviceChargeVatAmount;
  return net + (typeof vat === "number" ? vat : addVat(net) - net);
}

/**
 * The VAT contained in the service fee **as displayed**.
 *
 * `getServiceChargeGross` needs this number to build the figure on screen and
 * then has no use for it; the summary row needs the same number to caption that
 * figure. Both read the API's own `serviceChargeVatAmount`, so the caption and
 * the amount can never disagree — deriving one of them from a hardcoded rate is
 * how a breakdown starts failing to add up.
 *
 * Note the asymmetry with delivery: `serviceCharge` is reported NET and shown
 * GROSS, while `totalDeliveryCharge` is already gross. The VAT is "included" in
 * what the customer reads either way, which is what the caption claims.
 */
export function getServiceChargeVat(calc: ServiceChargeFields): number {
  const net = calc.serviceCharge ?? 0;
  if (net <= 0) return 0;
  const vat = calc.serviceChargeVatAmount;
  return typeof vat === "number" ? vat : addVat(net) - net;
}

/** The VAT already contained in the (gross) delivery charge. */
export function getDeliveryVat(delivery: DeliveryFields): number {
  if (typeof delivery.vatAmount === "number") return delivery.vatAmount;
  return extractVat(delivery.totalDeliveryCharge ?? 0);
}
