export default function NotificationsSkeleton() {
  return (
    <div className="min-h-screen bg-[#f6f6f7]">
      <div className="mx-auto max-w-230 px-6 py-8 animate-pulse">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="h-10 w-56 rounded bg-gray-200" />
            <div className="mt-3 h-4 w-80 rounded bg-gray-200" />
          </div>

          <div className="h-10 w-10 rounded-full bg-gray-200" />
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-3">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-10 w-24 rounded-full bg-gray-200" />
          ))}
        </div>

        {/* Notification Cards */}
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((item) => (
            <div
              key={item}
              className="flex gap-4 rounded-xl border border-[#ededed] bg-white p-5"
            >
              <div className="h-11 w-11 rounded-full bg-gray-200" />

              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div className="h-6 w-52 rounded bg-gray-200" />
                  <div className="h-4 w-20 rounded bg-gray-200" />
                </div>

                <div className="mt-3 h-4 w-full rounded bg-gray-200" />
                <div className="mt-2 h-4 w-3/4 rounded bg-gray-200" />

                <div className="mt-4 h-6 w-20 rounded bg-gray-200" />

                <div className="mt-4 h-9 w-32 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
