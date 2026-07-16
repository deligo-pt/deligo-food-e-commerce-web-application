// Product prices are tax-inclusive, but the fees the backend returns are not
// consistent with each other: `delivery.totalDeliveryCharge` is gross, while
// `orderCalculation.serviceCharge` is net. Neither ships its own VAT, so the
// standard rate is applied here to reconcile the summary with the amount
// charged.
//
// Fees are standard-rated (products can be 6%/13%/23%; a service fee is always
// 23%). This is an assumption the frontend shouldn't have to make — the backend
// ought to return the gross fee, or its VAT, alongside the net.
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
