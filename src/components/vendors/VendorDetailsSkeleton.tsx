export default function VendorDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-neutral-950 animate-pulse">
      <div className="mx-auto max-w-full px-4 py-6 lg:px-8">
        {/* Hero Section */}
        <section className="mb-6">
          <div className="overflow-hidden rounded-3xl shadow-lg">
            <div className="relative h-62.5 bg-gray-200 dark:bg-neutral-800 md:h-90">
              <div className="absolute bottom-4 left-4 md:bottom-8 md:left-8">
                <div className="rounded-2xl bg-white dark:bg-neutral-900 border dark:border-neutral-800 p-5 shadow-xl dark:shadow-none">
                  <div className="h-8 w-56 rounded bg-gray-200 dark:bg-neutral-800" />
                  <div className="mt-3 h-4 w-40 rounded bg-gray-200 dark:bg-neutral-800" />

                  <div className="mt-5 flex gap-4">
                    <div className="h-4 w-20 rounded bg-gray-200 dark:bg-neutral-800" />
                    <div className="h-4 w-16 rounded bg-gray-200 dark:bg-neutral-800" />
                    <div className="h-4 w-24 rounded bg-gray-200 dark:bg-neutral-800" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="mb-8 overflow-x-auto">
          <div className="flex min-w-max gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-10 w-24 rounded-lg bg-gray-200 dark:bg-neutral-800"
              />
            ))}
          </div>
        </section>

        {/* Menu Title */}
        <div className="mb-6 h-8 w-28 rounded bg-gray-200 dark:bg-neutral-800" />

        {/* Products Grid */}
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex overflow-hidden rounded-2xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm dark:shadow-none"
            >
              {/* Product Image */}
              <div className="h-36 w-32 shrink-0 bg-gray-200 dark:bg-neutral-800" />

              {/* Product Content */}
              <div className="flex flex-1 flex-col justify-between p-4">
                <div>
                  <div className="h-5 w-32 rounded bg-gray-200 dark:bg-neutral-800" />
                  <div className="mt-2 h-3 w-full rounded bg-gray-200 dark:bg-neutral-800" />
                  <div className="mt-2 h-3 w-3/4 rounded bg-gray-200 dark:bg-neutral-800" />
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="h-6 w-20 rounded bg-gray-200 dark:bg-neutral-800" />
                    <div className="mt-2 h-3 w-14 rounded bg-gray-200 dark:bg-neutral-800" />
                  </div>

                  <div className="h-10 w-10 rounded-xl bg-gray-200 dark:bg-neutral-800" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}