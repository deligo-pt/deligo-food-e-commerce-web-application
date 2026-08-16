/**
 * Loading state for the Report an Issue list.
 *
 * Mirrors `ReportIssuePage`'s card: same radius, same padding, same three
 * stacked lines and the same reserved chevron column, so the list does not jump
 * when the orders arrive.
 */
export default function ReportIssueSkeleton() {
  return (
    <ul className="animate-pulse space-y-3">
      {[1, 2, 3, 4].map((row) => (
        <li
          key={row}
          className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="min-w-0 flex-1">
            <div className="h-5 w-56 max-w-full rounded bg-gray-200 dark:bg-neutral-800" />
            <div className="mt-2 h-4 w-40 max-w-full rounded bg-gray-200 dark:bg-neutral-800" />
            <div className="mt-2 h-5 w-20 rounded bg-gray-200 dark:bg-neutral-800" />
          </div>

          <div className="h-5 w-5 shrink-0 rounded bg-gray-200 dark:bg-neutral-800" />
        </li>
      ))}
    </ul>
  );
}
