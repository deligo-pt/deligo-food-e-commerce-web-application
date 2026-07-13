import { Suspense } from "react";
import AddAddressPage from "@/components/address/AddAddressPage";
import LoadingText from "@/components/shared/LoadingText";

export default function AddAddressRoute() {
  return (
    <Suspense fallback={<LoadingText />}>
      <AddAddressPage />
    </Suspense>
  );
}