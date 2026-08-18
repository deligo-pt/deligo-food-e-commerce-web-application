import { Suspense } from "react";
import VendorDetailsPage from "@/components/vendors/VendorDetailsPage";
import LoadingText from "@/components/shared/LoadingText";

interface PageProps {
  params: Promise<{
    userId: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const { userId } = await params;

  // The Suspense boundary is required because `VendorDetailsPage` reads
  // `useSearchParams()` for `?product=` — the id a search result hands over so
  // the menu opens on the dish that was clicked.
  return (
    <Suspense
      fallback={<LoadingText className="w-full px-4 py-8 lg:px-16" />}
    >
      <VendorDetailsPage vendorId={userId} />
    </Suspense>
  );
}
