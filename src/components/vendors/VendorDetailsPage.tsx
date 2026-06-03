"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Bike, Plus, Star } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";

interface Vendor {
  id: string;
  userId: string;
  businessDetails: {
    businessName: string;
    businessType: string;
    openingHours: string;
    closingHours: string;
    preparationTimeMinutes: number;
    restaurantCuisineType?: string;
    isStoreOpen: boolean;
  };
  storePhoto?: string[];
}

interface VendorDetailsPageProps {
  vendorId: string;
}

const categories = ["All", "Popular", "PADARIA", "GELATARIA", "BEBIDAS"];

const menuItems = [
  {
    id: 1,
    name: "Pão Artesão de Fermentação",
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=1200",
    price: "€9,00",
    oldPrice: "€10,00",
  },
  {
    id: 2,
    name: "Taça Dolce Gelato",
    image: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?q=80&w=1200",
    price: "€9,00",
    oldPrice: "€10,00",
  },
  {
    id: 3,
    name: "Smartwatch Pulse",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1200",
    price: "€135,00",
    oldPrice: "€150,00",
  },
  {
    id: 4,
    name: "Caderno Explore",
    image: "https://images.unsplash.com/photo-1517842645767-c639042777db?q=80&w=1200",
    price: "€9,00",
    oldPrice: "€10,00",
  },
  {
    id: 5,
    name: "Batata Chips Ondulada",
    image: "https://images.unsplash.com/photo-1585238342024-78d387f4a707?q=80&w=1200",
    price: "€135,00",
    oldPrice: "€150,00",
  },
  {
    id: 6,
    name: "Molho de Tomate Tradicional",
    image: "https://images.unsplash.com/photo-1608897013039-887f21d8c804?q=80&w=1200",
    price: "€54,00",
    oldPrice: "€60,00",
  },
];

export default function VendorDetailsPage({ vendorId }: VendorDetailsPageProps) {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchVendor = async () => {
      try {
        let currentPage = 1;
        let foundVendor: Vendor | null = null;

        while (!foundVendor) {
          const { data } = await apiClient.get(
            `/vendors/customer?page=${currentPage}&limit=50`
          );

          const vendors: Vendor[] = data.data;
          if (vendors.length === 0) break;

          foundVendor = vendors.find((v) => v.userId === vendorId) || null;
          if (foundVendor) break;

          if (currentPage >= (data.meta?.totalPage || 1)) break;
          currentPage++;
        }

        if (!foundVendor) throw new Error("Vendor not found");
        setVendor(foundVendor);
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    fetchVendor();
  }, [vendorId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-lg font-medium">
        Loading vendor...
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-center text-red-500">
        {error || "Vendor not found"}
      </div>
    );
  }

  const heroImage = vendor.storePhoto?.[0] || "/placeholder-store.jpg";
  const prepTime = vendor.businessDetails.preparationTimeMinutes || 30;

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        {/* Hero */}
        <section className="mb-6">
          <div className="relative overflow-hidden rounded-3xl shadow-lg">
            <div className="relative h-62.5 md:h-90">
              <Image
                src={heroImage}
                alt={vendor.businessDetails.businessName}
                fill
                priority
                className="object-cover"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 md:bottom-8 md:left-8">
                <div className="rounded-2xl bg-white p-5 shadow-xl">
                  <div className="mb-1 flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-gray-900">
                      {vendor.businessDetails.businessName}
                    </h1>
                    <span
                      className={`h-3 w-3 rounded-full ${
                        vendor.businessDetails.isStoreOpen ? "bg-green-500" : "bg-red-500"
                      }`}
                    />
                  </div>
                  <p className="mb-4 text-sm text-gray-500">
                    {vendor.businessDetails.restaurantCuisineType || vendor.businessDetails.businessType}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <button className="font-semibold text-pink-600">More Info →</button>
                    <div className="flex items-center gap-1">
                      <Star size={16} className="fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">New</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500">
                      <Bike size={16} />
                      <span>
                        {prepTime}-{prepTime + 10} min
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="mb-8 overflow-x-auto">
          <div className="flex min-w-max gap-3">
            {categories.map((cat, idx) => (
              <button
                key={cat}
                className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${
                  idx === 0
                    ? "bg-pink-600 text-white"
                    : "border border-gray-200 bg-white text-gray-500"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        {/* Menu */}
        <section>
          <h2 className="mb-6 text-xl font-bold text-gray-900">Menu</h2>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {menuItems.map((item) => (
              <div
                key={item.id}
                className="group flex overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-lg"
              >
                <div className="relative h-36 w-32 shrink-0">
                  <Image src={item.image} alt={item.name} fill className="object-cover" />
                  <span className="absolute left-2 top-2 rounded-full bg-pink-600 px-2 py-1 text-[10px] font-bold text-white">
                    10% OFF
                  </span>
                </div>
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                      Premium handcrafted product made with carefully selected ingredients.
                    </p>
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-xl font-bold text-pink-600">{item.price}</p>
                      <p className="text-xs text-gray-400 line-through">{item.oldPrice}</p>
                    </div>
                    <button className="rounded-xl bg-pink-600 p-2 text-white transition hover:scale-105">
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}