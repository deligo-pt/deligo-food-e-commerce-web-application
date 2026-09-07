/**
 * Loading state for the notifications page.
 *
 * Every measurement here mirrors `NotificationsPage` — same container, same
 * card padding, same reserved chevron column. It is not decoration: a skeleton
 * whose boxes sit anywhere other than where the real content lands makes the
 * page visibly jump when the data arrives.
 */
export default function NotificationsSkeleton() {
  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-neutral-950 py-8 transition-colors duration-200">
      <div className="mx-auto max-w-5xl px-4 md:px-8 animate-pulse">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="h-10 w-56 rounded bg-gray-200 dark:bg-neutral-800" />
            <div className="mt-2 h-4 w-80 max-w-full rounded bg-gray-200 dark:bg-neutral-800" />
          </div>

          <div className="mt-1 h-10 w-10 shrink-0 rounded-full bg-gray-200 dark:bg-neutral-800" />
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2.5">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-9 w-24 rounded-full bg-gray-200 dark:bg-neutral-800"
            />
          ))}
        </div>

        {/* Notification Cards */}
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((item) => (
            <div
              key={item}
              className="flex gap-4 rounded-xl border border-border bg-card p-4 pl-6 shadow-sm"
            >
              <div className="h-11 w-11 shrink-0 rounded-full bg-gray-200 dark:bg-neutral-800" />

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="h-6 w-52 max-w-full rounded bg-gray-200 dark:bg-neutral-800" />
                  <div className="h-4 w-20 shrink-0 rounded bg-gray-200 dark:bg-neutral-800" />
                </div>

                <div className="mt-3 h-4 w-full rounded bg-gray-200 dark:bg-neutral-800" />
                <div className="mt-2 h-4 w-3/4 rounded bg-gray-200 dark:bg-neutral-800" />

                <div className="mt-4 h-6 w-20 rounded-full bg-gray-200 dark:bg-neutral-800" />

                <div className="mt-4 h-10 w-32 rounded-lg bg-gray-200 dark:bg-neutral-800" />
              </div>

              {/* Matches the real card's reserved chevron column. */}
              <div className="w-4.5 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
