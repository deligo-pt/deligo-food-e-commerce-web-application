/**
 * Loading state for the support thread.
 *
 * The measurements mirror `SupportMessageBubble` — same 7px avatar gutter, same
 * 2.5 gap, same alternating alignment, same rounded geometry. It is not
 * decoration: a skeleton whose boxes sit anywhere other than where the real
 * bubbles land makes the panel visibly jump when the thread arrives.
 */
const ROWS: { outgoing: boolean; width: string }[] = [
  { outgoing: false, width: "w-40" },
  { outgoing: true, width: "w-28" },
  { outgoing: true, width: "w-52" },
  { outgoing: false, width: "w-36" },
  { outgoing: true, width: "w-44" },
];

export default function SupportMessagesSkeleton() {
  return (
    <div className="min-h-0 flex-1 overflow-hidden bg-[#f8f9fa] px-4 py-4 dark:bg-neutral-950">
      <div className="animate-pulse">
        <div className="my-4 flex justify-center">
          <div className="h-6 w-20 rounded-full bg-gray-200 dark:bg-neutral-800" />
        </div>

        <div className="space-y-2.5">
          {ROWS.map((row, index) => (
            <div
              key={index}
              className={`flex items-end gap-2 ${
                row.outgoing ? "justify-end" : "justify-start"
              }`}
            >
              {!row.outgoing && (
                <div className="h-7 w-7 shrink-0 rounded-full bg-gray-200 dark:bg-neutral-800" />
              )}

              <div
                className={`h-14 ${row.width} max-w-[78%] bg-gray-200 dark:bg-neutral-800 ${
                  row.outgoing
                    ? "rounded-2xl rounded-br-md"
                    : "rounded-2xl rounded-bl-md"
                }`}
              />

              {row.outgoing && (
                <div className="h-7 w-7 shrink-0 rounded-full bg-gray-200 dark:bg-neutral-800" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
