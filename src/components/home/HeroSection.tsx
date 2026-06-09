"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import { apiClient } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";

type Sponsorship = {
  _id: string;
  sponsorName: string;
  sponsorType?: string;
  bannerImage: string;
  isActive: boolean;
  isDeleted: boolean;
};

type SponsorshipResponse = {
  data: Sponsorship[];
};

export default function HeroSection() {
  const [slides, setSlides] = useState<Sponsorship[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Loading sponsorship banners...");
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    let alive = true;

    async function loadSponsorships() {
      const token = getAccessToken();

      if (!token) {
        if (alive) {
          setSlides([]);
          setMessage("Authentication token is missing. Please log in again.");
          setLoading(false);
        }

        return;
      }

      try {
        const response = await apiClient.get<SponsorshipResponse>("/sponsorships", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = response.data;

        const activeSlides = (payload.data ?? []).filter(
          (slide) => slide.isActive && !slide.isDeleted && Boolean(slide.bannerImage),
        );

        if (alive) {
          setSlides(activeSlides);
          setMessage(
            activeSlides.length > 0
              ? "Browse the latest sponsorship banners from the API."
              : "No sponsorship banners available right now.",
          );
        }
      } catch {
        if (alive) {
          setSlides([]);
          setMessage("Unable to load sponsorship banners.");
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    loadSponsorships();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!emblaApi) {
      return;
    }

    const onSelect = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap());
    };

    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);

    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi]);

  const hasSlides = slides.length > 0;

  return (
    <section className="group relative mt-8">
      {loading ? (
        <div className="mx-auto max-w-7xl px-2 sm:px-4 lg:px-0">
          <div className="relative overflow-hidden rounded-4xl bg-gray-100">
            <div className="relative aspect-video animate-pulse lg:aspect-21/8">
              <div className="absolute inset-0 bg-linear-to-r from-gray-100 via-gray-200 to-gray-100" />
              <div className="absolute left-6 top-6 h-9 w-40 rounded-full bg-white/80 lg:left-16 lg:top-8" />
              <div className="absolute bottom-8 left-6 right-6 space-y-4 lg:left-16 lg:max-w-xl">
                <div className="h-8 w-3/4 rounded-full bg-white/80 lg:h-11" />
                <div className="h-4 w-full rounded-full bg-white/70" />
                <div className="h-4 w-2/3 rounded-full bg-white/70" />
              </div>
            </div>
          </div>

          <div className="mt-5 flex justify-center gap-3 pb-1">
            <span className="h-2.5 w-12 animate-pulse rounded-full bg-[#b70052]/20" />
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#b70052]/20" />
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#b70052]/20" />
          </div>
        </div>
      ) : hasSlides ? (
        <div className="mx-auto max-w-7xl px-2 sm:px-4 lg:px-0">
          <div className="relative overflow-hidden rounded-4xl ">
            <div className="absolute inset-0 z-10 pointer-events-none" />

            <div className="overflow-hidden touch-pan-y" ref={emblaRef}>
              <div className="flex">
                {slides.map((slide) => (
                  <div key={slide._id} className="relative aspect-video min-w-0 flex-[0_0_100%] lg:aspect-21/8">
                    <Image
                      src={slide.bannerImage}
                      alt={slide.sponsorName}
                      fill
                      priority={selectedIndex === 0}
                      sizes="(max-width: 1024px) 100vw, 1280px"
                      className="object-fit object-center"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="pointer-events-none absolute inset-0 z-20 flex items-start px-6 pt-6 text-white lg:px-16 lg:pt-8">
              <span className="rounded-full bg-black/40 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] backdrop-blur-sm">
                {slides[selectedIndex]?.sponsorType ?? "Sponsorship"}
              </span>
            </div>
          </div>

          <div className="mt-5 flex justify-center gap-3 pb-1">
            {slides.map((slide, index) => (
              <button
                key={slide._id}
                type="button"
                aria-label={`Go to slide ${index + 1}`}
                onClick={() => emblaApi?.scrollTo(index)}
                className={[
                  "rounded-full transition-all",
                  index === selectedIndex ? "h-2.5 w-12 bg-[#b70052]" : "h-2.5 w-2.5 bg-[#b70052]/30",
                ].join(" ")}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex h-125 items-center justify-center bg-[#111418] px-6 text-center text-white">
          <div className="max-w-xl">
            <span className="mb-4 inline-flex rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
              Sponsorships
            </span>
            <h1 className="mb-4 text-3xl font-extrabold lg:text-5xl">
              {message}
            </h1>
            <p className="text-base leading-7 text-white/75 lg:text-lg">{message}</p>
          </div>
        </div>
      )}
    </section>
  );
}