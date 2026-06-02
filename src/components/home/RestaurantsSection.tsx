/* eslint-disable @typescript-eslint/no-explicit-any */
import Image from "next/image";

import { ChevronRight, Star, Clock, Heart, Truck, Tag, Check, TrendingUp } from "lucide-react";
import { restaurantCards } from "../../data/homePage";

export default function RestaurantsSection() {
  return (
    <section>
      <div className="mb-10 flex items-center justify-between">
        <h2 className="text-[32px] font-bold leading-10 text-[#191c1d]">Near You</h2>
        <button className="flex items-center gap-2 text-[20px] font-bold leading-7 text-[#b0004a] hover:underline">
          View All <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
        {restaurantCards.map((card) => (
          <article
            key={card.title}
            className="group cursor-pointer overflow-hidden rounded-4xl border-2 border-transparent bg-[#ffffff] shadow-[0_10px_40px_rgba(0,0,0,0.06)] transition-all hover:border-[#ffd9de] hover:shadow-2xl"
          >
            <div className="relative aspect-16/10 overflow-hidden">
              <Image
                alt={card.title}
                className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110"
                fill
                sizes="(max-width: 1024px) 100vw, 33vw"
                src={card.image}
              />

              <div className="absolute left-5 top-5 flex gap-2">
                <span className="flex items-center gap-1.5 rounded-2xl bg-white/95 px-4 py-2 text-[14px] font-bold leading-5 text-[#191c1d] shadow-lg backdrop-blur-md">
                  <Star size={18} className="text-[#f6c344]" /> {card.rating}
                </span>
              </div>

              <div className="absolute bottom-5 right-5">
                <span className="flex items-center gap-2 rounded-2xl bg-black/70 px-4 py-2 text-[14px] font-medium leading-5 text-white backdrop-blur-md">
                  <Clock size={18} /> {card.time}
                </span>
              </div>
            </div>

            <div className="p-8">
              <div className="mb-2 flex items-center justify-between gap-4">
                <h3 className="text-[24px] font-bold leading-8 text-[#191c1d]">{card.title}</h3>
                <Heart size={22} className="text-[#d81b60]" fill={card.favoriteFilled ? "currentColor" : "none"} />
              </div>

              <p className="mb-6 text-[18px] leading-7 text-[#5a4044]">{card.cuisine}</p>

              <div className="flex items-center gap-6 border-t border-[#edeeef] pt-6 text-[14px] font-medium leading-5 text-[#5a4044]">
                <span className="flex items-center gap-2 text-[#b0004a]">
                  <Truck size={20} /> {card.delivery}
                </span>
                <span className="flex items-center gap-2 text-[#b70052]">
                  {(() => {
                    const iconMap: Record<string, any> = {
                      local_offer: Tag,
                      verified: Check,
                      trending_up: TrendingUp,
                    };
                    const Icon = iconMap[card.secondaryIcon] ?? Tag;
                    return <Icon size={20} />;
                  })()} {card.secondary}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}