"use client";

import { useParams } from "next/navigation";
import EditAddressPage from "@/components/address/EditAddressPage";

export default function Page() {
  const params = useParams();

  return (
    <EditAddressPage
      addressId={params.id as string}
    />
  );
}