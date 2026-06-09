export default function EditProfileFormSkeleton() {
  return (
    <section className="bg-[#f8f9fa] py-8 animate-pulse">
      <div className="mx-auto max-w-250 px-4">
        {/* Breadcrumb */}
        <div className="mb-6 h-4 w-56 rounded bg-gray-200" />

        <div className="overflow-hidden rounded-xl border border-[#e3bdc3] bg-white shadow-sm">
          {/* Header */}
          <div className="flex flex-col items-center border-b border-[#e3bdc3]/30 py-10">
            <div className="h-32 w-32 rounded-full bg-gray-200" />
            <div className="mt-6 h-8 w-48 rounded bg-gray-200" />
            <div className="mt-3 h-4 w-72 rounded bg-gray-200" />
          </div>

          <div className="space-y-10 p-8 md:p-12">
            {/* Basic Information */}
            <section className="space-y-6">
              <div className="h-7 w-48 rounded bg-gray-200" />

              <div className="grid gap-6 md:grid-cols-2">
                {[1, 2].map((item) => (
                  <div key={item}>
                    <div className="mb-2 h-4 w-24 rounded bg-gray-200" />
                    <div className="h-12 rounded bg-gray-200" />
                  </div>
                ))}
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {[1, 2].map((item) => (
                  <div key={item}>
                    <div className="mb-2 h-4 w-32 rounded bg-gray-200" />
                    <div className="h-12 rounded bg-gray-200" />
                  </div>
                ))}
              </div>

              <div className="max-w-md">
                <div className="mb-2 h-4 w-24 rounded bg-gray-200" />
                <div className="h-12 rounded bg-gray-200" />
              </div>
            </section>

            {/* Delivery Address */}
            <section className="space-y-6 border-t border-[#e3bdc3]/30 pt-8">
              <div className="flex flex-col gap-4 md:flex-row md:justify-between">
                <div>
                  <div className="h-7 w-44 rounded bg-gray-200" />
                  <div className="mt-2 h-4 w-28 rounded bg-gray-200" />
                </div>

                <div className="flex gap-2">
                  <div className="h-10 w-32 rounded bg-gray-200" />
                  <div className="h-10 w-32 rounded bg-gray-200" />
                </div>
              </div>

              <div className="h-14 rounded-full bg-gray-200" />

              {/* Map Skeleton */}
              <div className="h-96 rounded-xl bg-gray-200" />

              {/* Location Confirmed */}
              <div className="flex items-center gap-4 rounded-xl border border-gray-200 p-4">
                <div className="h-12 w-12 rounded-full bg-gray-200" />
                <div className="flex-1">
                  <div className="h-3 w-32 rounded bg-gray-200" />
                  <div className="mt-2 h-4 w-64 rounded bg-gray-200" />
                </div>
              </div>

              {/* Address Type */}
              <div>
                <div className="mb-3 h-4 w-20 rounded bg-gray-200" />
                <div className="flex gap-3">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="h-12 flex-1 rounded bg-gray-200"
                    />
                  ))}
                </div>
              </div>
            </section>

            {/* Address Fields */}
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {[1, 2].map((item) => (
                  <div key={item}>
                    <div className="mb-2 h-4 w-32 rounded bg-gray-200" />
                    <div className="h-12 rounded bg-gray-200" />
                  </div>
                ))}
              </div>

              <div className="grid gap-6 md:grid-cols-4">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item}>
                    <div className="mb-2 h-4 w-20 rounded bg-gray-200" />
                    <div className="h-12 rounded bg-gray-200" />
                  </div>
                ))}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-4 border-t border-[#e3bdc3]/30 pt-8">
              <div className="h-12 w-28 rounded bg-gray-200" />
              <div className="h-12 w-40 rounded bg-gray-200" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}