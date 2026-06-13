export default function VouchersSkeleton() {
  return (
    <section className="w-full bg-[#f8f9fa] px-8 py-12 animate-pulse">
      {/* Header */}
      <div className="mb-10">
        <div className="mb-3 h-10 w-48 rounded bg-gray-200" />
        <div className="h-4 w-80 rounded bg-gray-200" />
      </div>

      {/* Tabs */}
      <div className="mb-8 flex gap-8 border-b border-[#e7e8e9]">
        <div className="h-6 w-20 rounded bg-gray-200" />
        <div className="h-6 w-20 rounded bg-gray-200" />
      </div>

      {/* Voucher Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div
            key={item}
            className="rounded-xl border border-[#f3f4f5] bg-white p-6"
          >
            <div className="mb-4 flex gap-4">
              <div className="h-12 w-12 rounded-full bg-gray-200" />

              <div className="flex-1">
                <div className="mb-2 h-5 w-32 rounded bg-gray-200" />
                <div className="h-4 w-full rounded bg-gray-200" />
                <div className="mt-2 h-4 w-3/4 rounded bg-gray-200" />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="h-10 w-32 rounded-lg bg-gray-200" />
              <div className="h-10 w-20 rounded-lg bg-gray-200" />
            </div>

            <div className="mt-4 border-t border-[#e7e8e9] pt-4">
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 rounded bg-gray-200" />
                <div className="h-4 w-28 rounded bg-gray-200" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
