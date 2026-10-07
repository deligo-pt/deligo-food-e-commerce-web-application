import { LoaderCircle } from "lucide-react";

/**
 * Shown while the login page loads, e.g. right after logout navigates here,
 * so the customer never sees a blank screen between the two pages.
 */
export default function LoginLoading() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-dvh items-center justify-center bg-background">
      <LoaderCircle aria-hidden className="h-8 w-8 animate-spin text-primary" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
