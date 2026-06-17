"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import { apiClient } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";
import { useTranslation } from "@/hooks/useTranslation";

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
  const { t } = useTranslation();
  const [slides, setSlides] = useState<Sponsorship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    let alive = true;

    async function loadSponsorships() {
      const token = getAccessToken();

      try {
        // Use open endpoint when no token, otherwise use authenticated endpoint
        const endpoint = token ? "/sponsorships" : "/sponsorships/open";
        const config = token
          ? { headers: { Authorization: `Bearer ${token}` } }
          : {};

        const response = await apiClient.get<SponsorshipResponse>(endpoint, config);

        const activeSlides = (response.data.data ?? []).filter(
          (slide) => slide.isActive && !slide.isDeleted && Boolean(slide.bannerImage)
        );

        if (alive) {
          setSlides(activeSlides);
          setError(false);
        }
      } catch {
        if (alive) {
          setError(true);
          setSlides([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadSponsorships();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi || slides.length <= 1) return;
    const timer = setInterval(() => {
      emblaApi.scrollNext();
    }, 4000);
    return () => clearInterval(timer);
  }, [emblaApi, slides.length]);

  const emptyStateMessage = useMemo(() => {
    if (loading) return t("loadingSponsorshipBanners");
    if (error) return t("unableToLoadSponsorshipBanners");
    if (slides.length === 0) return t("noSponsorshipBannersAvailable");
    return t("browseLatestSponsorshipBanners");
  }, [loading, error, slides.length, t]);

  const hasSlides = slides.length > 0;

  return (
    <section className="group relative mt-8">
      {loading ? (
        <div>
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
        <div>
          <div className="relative overflow-hidden rounded-4xl">
            <div className="absolute inset-0 z-10 pointer-events-none" />
            <div className="overflow-hidden touch-pan-y" ref={emblaRef}>
              <div className="flex">
                {slides.map((slide) => (
                  <div
                    key={slide._id}
                    className="relative aspect-video min-w-0 flex-[0_0_100%] lg:aspect-21/8"
                  >
                    <Image
                      src={slide.bannerImage}
                      alt={slide.sponsorName}
                      fill
                      priority={selectedIndex === 0}
                      sizes="100vw"
                      className="object-fit object-center"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 z-20 flex items-start px-6 pt-6 text-white lg:px-16 lg:pt-8">
              <span className="rounded-full bg-black/40 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] backdrop-blur-sm">
                {slides[selectedIndex]?.sponsorType ?? t("sponsorship")}
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
                  index === selectedIndex
                    ? "h-2.5 w-12 bg-[#b70052]"
                    : "h-2.5 w-2.5 bg-[#b70052]/30",
                ].join(" ")}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex h-125 items-center justify-center bg-[#111418] px-6 text-center text-white">
          <div className="max-w-xl">
            <span className="mb-4 inline-flex rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
              {t("sponsorships")}
            </span>
            <h1 className="mb-4 text-3xl font-extrabold lg:text-5xl">
              {emptyStateMessage}
            </h1>
            <p className="text-base leading-7 text-white/75 lg:text-lg">
              {emptyStateMessage}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}