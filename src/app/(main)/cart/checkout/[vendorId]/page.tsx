import CheckoutPage from "@/components/cart/CheckoutPage";




export default async function Page({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;

  return <CheckoutPage vendorId={vendorId} />;
}