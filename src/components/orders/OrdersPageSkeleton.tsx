export default function OrdersPageSkeleton() {
  return (
    <section className="min-h-screen bg-[#f8f9fa] dark:bg-neutral-950 py-8 animate-pulse transition-colors duration-200">
      <div className="mx-auto max-w-5xl px-4 md:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="h-10 w-52 rounded bg-gray-200 dark:bg-neutral-800" />
          <div className="mt-3 h-4 w-80 max-w-full rounded bg-gray-200 dark:bg-neutral-800" />
        </div>

        {/* Search bar — same rounded-full footprint and the same reserved line
            for the result count, so nothing shifts when the orders land. */}
        <div className="mb-6">
          <div className="h-11 w-full rounded-full bg-gray-200 dark:bg-neutral-800" />
          <div className="mt-2 min-h-5" />
        </div>

        {/* Tabs */}
        <div className="mb-8 flex border-b border-border">
          <div className="flex-1 py-4">
            <div className="mx-auto h-5 w-20 rounded bg-gray-200 dark:bg-neutral-800" />
          </div>

          <div className="flex-1 py-4">
            <div className="mx-auto h-5 w-20 rounded bg-gray-200 dark:bg-neutral-800" />
          </div>
        </div>

        {/* Order Cards */}
        <div className="space-y-6">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              {/* Header */}
              {/* Shrinks with the card (23 Oct 2026): at 320 px the fixed bars
                  were wider than the screen while the orders loaded. */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 gap-3">
                  <div className="h-12 w-12 shrink-0 rounded-full bg-gray-200 dark:bg-neutral-800" />

                  <div className="min-w-0 flex-1">
                    <div className="h-5 w-40 max-w-full rounded bg-gray-200 dark:bg-neutral-800" />
                    <div className="mt-2 h-3 w-32 max-w-full rounded bg-gray-200 dark:bg-neutral-800" />
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="h-5 w-16 rounded bg-gray-200 dark:bg-neutral-800" />
                  <div className="h-6 w-20 rounded-full bg-gray-200 dark:bg-neutral-800" />
                </div>
              </div>

              {/* Items */}
              <div className="mt-4 rounded-lg bg-[#f3f4f5] dark:bg-neutral-950 px-3 py-3">
                <div className="h-4 w-full rounded bg-gray-200 dark:bg-neutral-800" />
              </div>

              {/* Progress */}
              <div className="mt-4">
                <div className="mb-2 flex justify-between gap-3">
                  <div className="h-3 w-40 max-w-[48%] rounded bg-gray-200 dark:bg-neutral-800" />
                  <div className="h-3 w-32 max-w-[40%] rounded bg-gray-200 dark:bg-neutral-800" />
                </div>

                <div className="h-1.5 rounded-full bg-gray-200 dark:bg-neutral-800" />
              </div>

              {/* Buttons */}
              <div className="mt-4 flex gap-3">
                <div className="h-12 flex-1 rounded-lg bg-gray-200 dark:bg-neutral-800" />
                <div className="h-12 w-32 rounded-lg bg-gray-200 dark:bg-neutral-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}