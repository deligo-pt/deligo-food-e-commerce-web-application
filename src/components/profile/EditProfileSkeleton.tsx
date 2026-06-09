export default function EditProfileSkeleton() {
  return (
    <section className="bg-[#f8f9fa] py-10 animate-pulse">
      <div className="mx-auto max-w-5xl px-4">
        {/* Breadcrumb */}
        <div className="mb-6 h-4 w-64 rounded bg-gray-200" />

        <div className="overflow-hidden rounded-2xl border border-[#e3bdc3] bg-white shadow-sm">
          {/* Header */}
          <div className="border-b border-[#e3bdc3] px-6 py-10">
            <div className="flex flex-col items-center">
              <div className="h-24 w-24 rounded-full bg-gray-200" />
              <div className="mt-5 h-8 w-48 rounded bg-gray-200" />
              <div className="mt-2 h-4 w-40 rounded bg-gray-200" />
            </div>
          </div>

          {/* Form Fields */}
          <div className="p-6 md:p-10">
            <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
              {[...Array(6)].map((_, index) => (
                <div
                  key={index}
                  className={index === 5 ? "md:col-span-2" : ""}
                >
                  <div className="mb-2 h-4 w-28 rounded bg-gray-200" />
                  <div className="h-14 rounded-xl bg-gray-200" />
                </div>
              ))}
            </div>

            {/* Button */}
            <div className="mt-6 border-t border-[#e3bdc3] pt-8">
              <div className="flex justify-end">
                <div className="h-12 w-40 rounded-xl bg-gray-200" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}