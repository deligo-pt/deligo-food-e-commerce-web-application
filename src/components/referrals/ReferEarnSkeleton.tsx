export default function ReferEarnSkeleton() {
  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-neutral-950 py-10 transition-colors duration-200">
      <div className="mx-auto max-w-5xl px-4 animate-pulse">
        {/* Breadcrumbs Placeholder */}
        <div className="mb-6 flex items-center gap-2">
          <div className="h-4 w-12 rounded bg-gray-200 dark:bg-neutral-800" />
          <div className="h-4 w-4 rounded bg-gray-200 dark:bg-neutral-800" />
          <div className="h-4 w-16 rounded bg-gray-200 dark:bg-neutral-800" />
          <div className="h-4 w-4 rounded bg-gray-200 dark:bg-neutral-800" />
          <div className="h-4 w-20 rounded bg-gray-200 dark:bg-neutral-800" />
        </div>

        {/* Hero Section */}
        <section className="mb-10 flex justify-center">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-sm border border-neutral-200 dark:border-neutral-800 md:p-8">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 h-16 w-16 rounded-full bg-gray-200 dark:bg-neutral-800" />

              <div className="mb-5 h-8 w-56 rounded bg-gray-200 dark:bg-neutral-800" />

              <div className="mb-6 w-full max-w-sm">
                <div className="h-16 w-full rounded-xl bg-gray-200 dark:bg-neutral-800" />
              </div>

              <div className="h-12 w-full max-w-sm rounded-xl bg-gray-200 dark:bg-neutral-800" />
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mb-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="rounded-xl bg-white dark:bg-neutral-900 p-5 text-center shadow-sm border border-neutral-200 dark:border-neutral-800"
            >
              <div className="mx-auto mb-3 h-8 w-8 rounded-full bg-gray-200 dark:bg-neutral-800" />
              <div className="mx-auto mb-2 h-8 w-20 rounded bg-gray-200 dark:bg-neutral-800" />
              <div className="mx-auto h-4 w-28 rounded bg-gray-200 dark:bg-neutral-800" />
            </div>
          ))}
        </section>

        {/* How It Works */}
        <section className="rounded-2xl bg-white dark:bg-neutral-900 p-6 shadow-sm border border-neutral-200 dark:border-neutral-800 md:p-8">
          <div className="mx-auto mb-8 h-8 w-56 rounded bg-gray-200 dark:bg-neutral-800" />

          <div className="grid gap-8 md:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="text-center">
                <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-gray-200 dark:bg-neutral-800" />

                <div className="mx-auto mb-3 h-6 w-32 rounded bg-gray-200 dark:bg-neutral-800" />

                <div className="mx-auto h-4 w-full rounded bg-gray-200 dark:bg-neutral-800" />
                <div className="mx-auto mt-2 h-4 w-4/5 rounded bg-gray-200 dark:bg-neutral-800" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
