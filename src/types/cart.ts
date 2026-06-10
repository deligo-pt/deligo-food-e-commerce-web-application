export interface CartItem {
  productId: string;
  name: string;
  image: string;
  variationSku: string | null;
  isActive: boolean;

  vendorId: {
    _id: string;
    userId: string;
    name: {
      firstName: string;
      lastName: string;
    };
  };

  productPricing: {
    originalPrice: number;
    productDiscountAmount: number;
    priceAfterProductDiscount: number;
    promoDiscountAmount: number;
    unitPrice: number;
    lineTotal: number;
    taxRate: number;
    taxAmount: number;
  };

  itemSummary: {
    quantity: number;
    totalBeforeTax: number;
    totalTaxAmount: number;
    totalPromoDiscount: number;
    totalProductDiscount: number;
    grandTotal: number;
  };
}

export interface CartResponse {
  _id: string;
  customerId: string;
  items: CartItem[];
  totalItems: number;

  cartCalculation: {
    totalOriginalPrice: number;
    totalProductDiscount: number;
    taxableAmount: number;
    totalTaxAmount: number;
    grandTotal: number;
  };
}