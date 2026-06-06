"use client";

import Image from "next/image";

export default function PromoBanner() {
  return (
    <div className="group relative h-56 overflow-hidden rounded-3xl">
      <Image
        fill
        src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c"
        alt="Promo"
        className="object-cover transition-transform duration-700 group-hover:scale-105"
      />

      <div className="absolute inset-0 bg-linear-to-t from-pink-900/90 to-transparent" />

      <div className="absolute bottom-0 p-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/80">
          Weekend Special
        </p>

        <h3 className="text-2xl font-bold text-white">
          Get €10 off orders over €50
        </h3>
      </div>
    </div>
  );
}