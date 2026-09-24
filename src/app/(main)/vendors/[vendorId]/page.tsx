import { Suspense } from "react";
import VendorDetailsPage from "@/components/vendors/VendorDetailsPage";
import LoadingText from "@/components/shared/LoadingText";

interface PageProps {
  params: Promise<{
    /**
     * The store's Mongo id. It was its `V-…` userId until 24 Sep 2026, when the
     * API stopped accepting that — see `lib/vendorId.ts`. Links written before
     * then still arrive here and are resolved, not rejected.
     */
    vendorId: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const { vendorId } = await params;

  // The Suspense boundary is required because `VendorDetailsPage` reads
  // `useSearchParams()` for `?product=` — the id a search result hands over so
  // the menu opens on the dish that was clicked.
  return (
    <Suspense
      fallback={<LoadingText className="w-full px-4 py-8 lg:px-16" />}
    >
      <VendorDetailsPage vendorId={vendorId} />
    </Suspense>
  );
}
