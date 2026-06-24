"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

// Route-segment error boundary. Catches unhandled render errors thrown anywhere
// below the root layout (e.g. a malformed record) and shows a branded, recoverable
// UI instead of white-screening. See Issue.md #13.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-[#f7f2f5] dark:bg-neutral-950 px-4 py-16 text-center transition-colors duration-200">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ffe1ea] dark:bg-pink-950/40">
        <AlertTriangle className="h-8 w-8 text-[#b0004a] dark:text-pink-400" />
      </div>
      <h1 className="mt-6 text-2xl font-bold text-[#191c1d] dark:text-neutral-50">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-md text-[15px] leading-6 text-[#5a4044] dark:text-neutral-400">
        An unexpected error occurred while loading this page. You can try again or
        head back to the homepage.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#b0004a] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#8a0038]"
        >
          <RotateCcw size={18} />
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-[#e3bdc3] dark:border-neutral-800 bg-white dark:bg-neutral-900 px-6 py-3 font-semibold text-[#5a4044] dark:text-neutral-300 transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800"
        >
          <Home size={18} />
          Back to home
        </Link>
      </div>
    </div>
  );
}
