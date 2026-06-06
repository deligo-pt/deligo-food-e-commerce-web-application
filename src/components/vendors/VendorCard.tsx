"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock, Heart, Star, Truck, Check } from "lucide-react";

export interface Vendor {
  id: string;
  userId: string; // added for routing
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

interface VendorCardProps {
  vendor: Vendor;
}

export default function VendorCard({ vendor }: VendorCardProps) {
  return (
    <Link href={`/vendors/${vendor.userId}`} className="block">
      <article className="group cursor-pointer overflow-hidden rounded-4xl border-2 border-transparent bg-white shadow-[0_10px_40px_rgba(0,0,0,0.06)] transition-all hover:border-[#ffd9de] hover:shadow-2xl">
        <div className="relative aspect-16/10 overflow-hidden">
          <Image
            fill
            sizes="(max-width: 1024px) 100vw, 33vw"
            alt={vendor.businessDetails.businessName}
            src={vendor.storePhoto?.[0] || "https://placehold.co/600x400/png"}
            className="object-cover transition-transform duration-1000 group-hover:scale-110"
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
              {vendor.businessDetails.openingHours} -{" "}
              {vendor.businessDetails.closingHours}
            </span>
          </div>
        </div>

        <div className="p-8">
          <div className="mb-2 flex items-center justify-between gap-4">
            <h3 className="line-clamp-1 text-[24px] font-bold leading-8 text-[#191c1d]">
              {vendor.businessDetails.businessName}
            </h3>

            <Heart
              size={22}
              className="text-[#d81b60] transition-colors group-hover:fill-current"
            />
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
              {vendor.businessLocation.city}, {vendor.businessLocation.country}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}