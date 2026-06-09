export default function ProfilePageSkeleton() {
  return (
    <section className="bg-[#f7f7f7] min-h-screen p-4 md:p-6 animate-pulse">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Left Side */}
          <div className="space-y-4">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="flex flex-col items-center">
                <div className="h-24 w-24 rounded-full bg-gray-200" />
                <div className="mt-4 h-6 w-40 rounded bg-gray-200" />
                <div className="mt-3 h-4 w-56 rounded bg-gray-200" />
                <div className="mt-5 h-12 w-full rounded-lg bg-gray-200" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <div className="mx-auto h-6 w-6 rounded bg-gray-200" />
                <div className="mx-auto mt-3 h-5 w-12 rounded bg-gray-200" />
                <div className="mx-auto mt-2 h-4 w-20 rounded bg-gray-200" />
              </div>

              <div className="rounded-xl bg-white p-5 shadow-sm">
                <div className="mx-auto h-6 w-6 rounded bg-gray-200" />
                <div className="mx-auto mt-3 h-5 w-12 rounded bg-gray-200" />
                <div className="mx-auto mt-2 h-4 w-20 rounded bg-gray-200" />
              </div>
            </div>

            <div className="rounded-xl p-6 bg-gray-300 h-40" />
          </div>

          {/* Right Side */}
          <div className="space-y-6">
            <div>
              <div className="mb-3 h-4 w-32 rounded bg-gray-200" />

              <div className="overflow-hidden rounded-xl bg-white shadow-sm">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="flex items-center justify-between border-b p-5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-gray-200" />
                      <div>
                        <div className="h-4 w-32 rounded bg-gray-200" />
                        <div className="mt-2 h-3 w-48 rounded bg-gray-200" />
                      </div>
                    </div>
                    <div className="h-5 w-5 rounded bg-gray-200" />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3 h-4 w-40 rounded bg-gray-200" />

              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2, 3, 4, 5, 6].map((item) => (
                  <div key={item} className="rounded-xl bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-gray-200" />
                        <div className="h-4 w-28 rounded bg-gray-200" />
                      </div>
                      <div className="h-4 w-4 rounded bg-gray-200" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-12 w-36 rounded-xl bg-gray-200" />
          </div>
        </div>
      </div>
    </section>
  );
}
