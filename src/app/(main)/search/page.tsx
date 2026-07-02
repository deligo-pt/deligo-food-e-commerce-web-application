import { Suspense } from "react";
import SearchContent from "./SearchContent";
import LoadingText from "@/components/shared/LoadingText";


export const dynamic = 'force-dynamic';

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingText tKey="loadingSearch" className="w-full px-4 py-8 lg:px-16" />}>
      <SearchContent />
    </Suspense>
  );
}