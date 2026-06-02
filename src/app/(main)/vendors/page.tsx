import VendorsGrid from "@/components/vendors/VendorsGrid";

export default function VendorsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-10">
        <h1 className="text-4xl font-bold text-[#191c1d]">All Vendors</h1>

        <p className="mt-2 text-[#5a4044]">
          Browse all stores and restaurants available on DeliGo.
        </p>
      </div>

      <VendorsGrid />
    </main>
  );
}
