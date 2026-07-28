export default function SavedAddressesSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 animate-pulse">
      {/* Header — just the title, mirroring the page (no refresh control). */}
      <div className="mb-6">
        <div className="h-8 w-48 rounded bg-gray-200 dark:bg-neutral-800" />
      </div>

      {/* Address List */}
      <div className="space-y-4">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="flex items-start gap-3 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 sm:gap-4 sm:p-5"
          >
            <div className="h-10 w-10 shrink-0 rounded-full bg-gray-200 dark:bg-neutral-800" />

            {/* Widths are percentages, not fixed rems, so the placeholder lines
                track the real (wrapping) address rows on narrow screens. */}
            <div className="min-w-0 flex-1">
              <div className="mb-2 h-4 w-20 rounded bg-gray-200 dark:bg-neutral-800" />

              <div className="mb-2 h-4 w-4/5 rounded bg-gray-200 dark:bg-neutral-800" />

              <div className="h-3 w-3/5 rounded bg-gray-200 dark:bg-neutral-800" />
            </div>

            <div className="flex shrink-0 gap-1">
              <div className="h-9 w-9 rounded-lg bg-gray-200 dark:bg-neutral-800" />
              <div className="h-9 w-9 rounded-lg bg-gray-200 dark:bg-neutral-800" />
            </div>
          </div>
        ))}

        {/* Add Address Button */}
        <div className="h-14 rounded-2xl border-2 border-dashed border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900" />
      </div>
    </div>
  );
}
