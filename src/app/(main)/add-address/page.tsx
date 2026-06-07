import { Suspense } from "react";
import AddAddressPage from "@/components/address/AddAddressPage";

export default function AddAddressRoute() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AddAddressPage />
    </Suspense>
  );
}