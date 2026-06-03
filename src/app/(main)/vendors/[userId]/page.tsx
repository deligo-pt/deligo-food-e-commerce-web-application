// import VendorDetailsPage from "@/components/vendors/VendorDetailsPage";

// export default function Page() {
//   return <VendorDetailsPage />;
// }

import VendorDetailsPage from "@/components/vendors/VendorDetailsPage";

interface PageProps {
  params: Promise<{
    userId: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const { userId } = await params;

  return <VendorDetailsPage vendorId={userId} />;
}