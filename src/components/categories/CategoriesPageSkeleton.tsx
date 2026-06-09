export default function CategoriesPageSkeleton() {
  return (
    <div className="animate-pulse mx-auto w-full max-w-7xl px-4 py-10 lg:px-16">
      {/* Header */}
      <div className="mb-10">
        <div className="mb-4 h-5 w-32 rounded bg-gray-200" />

        <div className="h-10 w-64 rounded bg-gray-200" />

        <div className="mt-3 h-5 w-80 rounded bg-gray-200" />
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col items-center gap-4 rounded-3xl bg-white p-5 shadow-[0_10px_40px_rgba(0,0,0,0.06)]"
          >
            {/* Category Image */}
            <div className="h-28 w-28 rounded-full bg-gray-200" />

            {/* Category Name */}
            <div className="h-4 w-20 rounded bg-gray-200" />

            {/* Description */}
            <div className="space-y-2">
              <div className="h-3 w-24 rounded bg-gray-200" />
              <div className="h-3 w-16 rounded bg-gray-200 mx-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}