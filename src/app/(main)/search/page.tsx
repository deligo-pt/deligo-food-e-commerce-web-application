import { Suspense } from "react";
import SearchContent from "./SearchContent";


export const dynamic = 'force-dynamic';

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="w-full px-4 py-8 lg:px-16">Loading search...</div>}>
      <SearchContent />
    </Suspense>
  );
}