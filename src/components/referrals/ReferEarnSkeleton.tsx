export default function ReferEarnSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-5xl animate-pulse">
        {/* Hero Section */}
        <section className="mb-10 flex justify-center">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 h-16 w-16 rounded-full bg-slate-200" />

              <div className="mb-5 h-8 w-56 rounded bg-slate-200" />

              <div className="mb-6 w-full max-w-sm">
                <div className="h-16 w-full rounded-xl bg-slate-200" />
              </div>

              <div className="h-12 w-full max-w-sm rounded-lg bg-slate-200" />
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mb-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="rounded-xl bg-white p-5 text-center shadow-sm"
            >
              <div className="mx-auto mb-3 h-8 w-8 rounded-full bg-slate-200" />
              <div className="mx-auto mb-2 h-8 w-20 rounded bg-slate-200" />
              <div className="mx-auto h-4 w-28 rounded bg-slate-200" />
            </div>
          ))}
        </section>

        {/* How It Works */}
        <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
          <div className="mx-auto mb-8 h-8 w-56 rounded bg-slate-200" />

          <div className="grid gap-8 md:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="text-center">
                <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-slate-200" />

                <div className="mx-auto mb-3 h-6 w-32 rounded bg-slate-200" />

                <div className="mx-auto h-4 w-full rounded bg-slate-200" />
                <div className="mx-auto mt-2 h-4 w-4/5 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
