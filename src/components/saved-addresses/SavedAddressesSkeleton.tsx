export default function SavedAddressesSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 animate-pulse">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-5 w-5 rounded bg-gray-200" />
          <div className="h-8 w-48 rounded bg-gray-200" />
        </div>

        <div className="h-4 w-4 rounded bg-gray-200" />
      </div>

      {/* Address List */}
      <div className="space-y-4">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4"
          >
            <div className="h-10 w-10 rounded-full bg-gray-200" />

            <div className="flex-1">
              <div className="mb-2 h-4 w-20 rounded bg-gray-200" />

              <div className="mb-2 h-4 w-48 rounded bg-gray-200" />

              <div className="h-3 w-64 rounded bg-gray-200" />
            </div>

            <div className="flex gap-3">
              <div className="h-4 w-4 rounded bg-gray-200" />
              <div className="h-4 w-4 rounded bg-gray-200" />
            </div>
          </div>
        ))}

        {/* Add Address Button */}
        <div className="h-24 rounded-xl border border-dashed border-gray-200 bg-white" />
      </div>
    </div>
  );
}
