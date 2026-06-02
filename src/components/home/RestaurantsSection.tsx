"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronRight, Star, Clock, Heart, Truck, Check } from "lucide-react";

import { apiClient, getApiErrorMessage } from "../../lib/apiClient";
import Link from "next/link";

interface Vendor {
  id: string;
  businessDetails: {
    businessName: string;
    businessType: string;
    restaurantCuisineType?: string;
    openingHours: string;
    closingHours: string;
    isStoreOpen: boolean;
  };
  businessLocation: {
    city: string;
    country: string;
  };
  storePhoto: string[];
  rating: {
    average: number;
    totalReviews: number;
  };
}

export default function RestaurantsSection() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await apiClient.get("/vendors/customer");

        console.log("Vendor Response:", response.data);

        setVendors(response.data?.data || []);
      } catch (err) {
        console.error("Failed to fetch vendors:", err);

        setError(getApiErrorMessage(err, "Unable to load nearby restaurants."));
      } finally {
        setLoading(false);
      }
    };

    fetchVendors();
  }, []);

  if (loading) {
    return (
      <section>
        <div className="mb-10 flex items-center justify-between">
          <h2 className="text-[32px] font-bold leading-10 text-[#191c1d]">
            Near You
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-105 animate-pulse rounded-4xl bg-gray-100"
            />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-600">
          {error}
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-10 flex items-center justify-between">
        <h2 className="text-[32px] font-bold leading-10 text-[#191c1d]">
          Near You
        </h2>

        <Link
          href="/vendors"
          className="flex items-center gap-2 text-[20px] font-bold leading-7 text-[#b0004a] hover:underline"
        >
          View All <ChevronRight size={20} />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
        {vendors.map((vendor) => (
          <article
            key={vendor.id}
            className="group cursor-pointer overflow-hidden rounded-4xl border-2 border-transparent bg-white shadow-[0_10px_40px_rgba(0,0,0,0.06)] transition-all hover:border-[#ffd9de] hover:shadow-2xl"
          >
            <div className="relative aspect-16/10 overflow-hidden">
              <Image
                fill
                sizes="(max-width:1024px) 100vw, 33vw"
                alt={vendor.businessDetails.businessName}
                src={
                  vendor.storePhoto?.[0] || "https://placehold.co/600x400/png"
                }
                className="object-fit transition-transform duration-1000 group-hover:scale-110"
              />

              <div className="absolute left-5 top-5">
                <span className="flex items-center gap-1.5 rounded-2xl bg-white/95 px-4 py-2 text-[14px] font-bold text-[#191c1d] shadow-lg backdrop-blur-md">
                  <Star size={18} className="text-[#f6c344]" />
                  {vendor.rating?.average ?? 0}
                </span>
              </div>

              <div className="absolute bottom-5 right-5">
                <span className="flex items-center gap-2 rounded-2xl bg-black/70 px-4 py-2 text-[14px] text-white backdrop-blur-md">
                  <Clock size={18} />
                  {vendor.businessDetails.openingHours} -
                  {vendor.businessDetails.closingHours}
                </span>
              </div>
            </div>

            <div className="p-8">
              <div className="mb-2 flex items-center justify-between gap-4">
                <h3 className="line-clamp-1 text-[24px] font-bold leading-8 text-[#191c1d]">
                  {vendor.businessDetails.businessName}
                </h3>

                <Heart size={22} className="text-[#d81b60]" />
              </div>

              <p className="mb-6 text-[18px] leading-7 text-[#5a4044]">
                {vendor.businessDetails.restaurantCuisineType ||
                  vendor.businessDetails.businessType}
              </p>

              <div className="flex items-center gap-6 border-t border-[#edeeef] pt-6 text-[14px] font-medium text-[#5a4044]">
                <span className="flex items-center gap-2 text-[#b0004a]">
                  <Truck size={20} />
                  {vendor.businessDetails.isStoreOpen ? "Open Now" : "Closed"}
                </span>

                <span className="flex items-center gap-2 text-[#b70052]">
                  <Check size={20} />
                  {vendor.businessLocation.city},{" "}
                  {vendor.businessLocation.country}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
