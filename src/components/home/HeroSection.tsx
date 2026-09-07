"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import { isOptimizableImageHost } from "@/lib/imageHosts";
import { apiClient } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";
import { useTranslation } from "@/hooks/useTranslation";
import { usePrefersReducedMotion } from "@/hooks/useMotion";

/**
 * The banner's placeholder art, without a wrapper.
 *
 * It is rendered twice: in flow while the sponsorship request is out, and
 * again as `.motion-image-floor` over the mounted carousel until the visible
 * slide has decoded. The two have to be the same pixels — the moment the
 * request answers, the first is unmounted and the second appears in its place,
 * and any difference between them would read as a flicker at exactly the point
 * where nothing has actually changed yet.
 *
 * The caller owns the box and the pulse. `animate-pulse` animates opacity, and
 * so does the floor's fade-out; on one element the animation wins and the fade
 * never happens, so they are kept one layer apart.
 */
function BannerSkeletonArt() {
  return (
    <>
      <div className="absolute inset-0 bg-linear-to-r from-gray-100 dark:from-neutral-800 via-gray-200 dark:via-neutral-700 to-gray-100 dark:to-neutral-800" />
      <div className="absolute left-6 top-6 h-9 w-40 rounded-full bg-white/80 dark:bg-neutral-900/80 lg:left-16 lg:top-8" />
      <div className="absolute bottom-8 left-6 right-6 space-y-4 lg:left-16 lg:max-w-xl">
        <div className="h-8 w-3/4 rounded-full bg-white/80 dark:bg-neutral-900/80 lg:h-11" />
        <div className="h-4 w-full rounded-full bg-white/70 dark:bg-neutral-900/70" />
        <div className="h-4 w-2/3 rounded-full bg-white/70 dark:bg-neutral-900/70" />
      </div>
    </>
  );
}

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
  const { t, langVersion } = useTranslation();
  const [slides, setSlides] = useState<Sponsorship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Plan.md Phase 6 #5. The carousel advanced every four seconds no matter
  // what the reader was doing — including while they were reaching for a dot,
  // or tabbed onto one.
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  /**
   * Which banners have actually decoded.
   *
   * Keyed by id rather than by index because `slides` is refetched and
   * replaced wholesale when the language changes; an index would carry
   * "already painted" over to whatever ended up in that position.
   *
   * `onLoad` is enough on its own here — `next/image` re-fires it from a ref
   * when `img.complete` is already true, so an image served from cache is not
   * left waiting for an event that fired before React attached the handler.
   */
  const [loadedIds, setLoadedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const markLoaded = useCallback((id: string) => {
    setLoadedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

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
  }, [langVersion]);

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

  /**
   * Autoplay, with the three reasons to stop it.
   *
   * `paused` covers hover and focus: the pointer is over the banner, or a dot
   * has the keyboard, and moving the thing under it is hostile either way.
   *
   * `reducedMotion` stops it outright. This is the one piece of motion in the
   * app that a CSS opt-out cannot reach — nothing here is animated, the
   * carousel is *scrolled* by a timer — so it needs the hook. Content that
   * moves on its own is exactly what "reduce motion" is asking about.
   */
  useEffect(() => {
    if (!emblaApi || slides.length <= 1) return;
    if (paused || reducedMotion) return;
    const timer = setInterval(() => {
      emblaApi.scrollNext();
    }, 4000);
    return () => clearInterval(timer);
  }, [emblaApi, slides.length, paused, reducedMotion]);

  const emptyStateMessage = useMemo(() => {
    if (loading) return t("loadingSponsorshipBanners");
    if (error) return t("unableToLoadSponsorshipBanners");
    if (slides.length === 0) return t("noSponsorshipBannersAvailable");
    return t("browseLatestSponsorshipBanners");
  }, [loading, error, slides.length, t]);

  const hasSlides = slides.length > 0;
  /* The floor covers whichever slide is showing, not only the first. Slides
     other than the priority one are lazy and sit outside the viewport until
     they are scrolled to, so arriving at one that has not loaded should show
     the placeholder again rather than an empty frame. */
  const currentLoaded = loadedIds.has(slides[selectedIndex]?._id ?? "");

  return (
    /* Browser round 5. The banner sat further from the next heading than any
       other band did — ~86 against everyone else's 64 — and the difference was
       this section's own dots strip: `mt-3` + a 6px dot + `pb-1` ≈ 22, stacked
       on top of a rhythm that had already been paid. The same shape the cuisine
       strip fixed for its shadow clearance, and the same fix: the band takes
       its own furniture off the gap instead of adding to it.

       The deduction is 24 at both widths — one step over the 22 the strip
       actually measures, because a 6px dot cannot be made to sum to a scale
       value with scale margins. §18 asserts the deduction is equal at both
       breakpoints and within one optical step of the strip, not that it is 24. */
    <section className="group relative mt-6 mb-2 sm:mt-8 sm:mb-6">
      {loading ? (
        <div>
          <div className="relative overflow-hidden rounded-4xl bg-gray-100 dark:bg-neutral-800">
            <div className="relative aspect-video animate-pulse lg:aspect-21/8">
              <BannerSkeletonArt />
            </div>
          </div>
          <div className="mt-3 flex justify-center gap-3 pb-1">
            <span className="h-1.5 w-12 animate-pulse rounded-full bg-primary/20 dark:bg-pink-600/20" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/20 dark:bg-pink-600/20" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary/20 dark:bg-pink-600/20" />
          </div>
        </div>
      ) : hasSlides ? (
        /* Phase 6 #1 put `motion-fade` on this block, because the banners
           replaced their skeleton by hard-swapping in. Browser round 3 moved
           that job down onto the image itself: the skeleton is no longer
           unmounted when the request answers, it stays as `.motion-image-floor`
           until the artwork has decoded, so there is nothing left up here to
           crossfade — the placeholder is still on screen, unchanged.

           The dots keep the fade. They are the one part of this block that
           really does appear the moment the request answers, and three pulsing
           placeholders becoming five real controls is a swap worth softening.

           The pause handlers cover the whole block, dots included — onFocus and
           onBlur are React's focusin/focusout, so they catch a dot being tabbed
           to without a listener on each one. */
        <div
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div className="relative overflow-hidden rounded-4xl">
            <div className="absolute inset-0 z-10 pointer-events-none" />
            <div className="overflow-hidden touch-pan-y" ref={emblaRef}>
              <div className="flex">
                {slides.map((slide, index) => (
                  <div
                    key={slide._id}
                    className="relative aspect-video min-w-0 flex-[0_0_100%] lg:aspect-21/8"
                  >
                    <Image
                      src={slide.bannerImage}
                      alt={slide.sponsorName}
                      fill
                      // Was `selectedIndex === 0`, which handed `priority` from
                      // one slide to the next as the carousel advanced.
                      // `priority` is a fetch hint read when the element mounts;
                      // moving it afterwards preloads nothing and un-preloads
                      // the LCP image. The first slide is the one that matters.
                      priority={index === 0}
                      sizes="100vw"
                      // Every live banner is on Deligo's own storage, which the
                      // optimizer cannot fetch — see `OPTIMIZER_BYPASS_HOSTS`.
                      // Without this the hero renders blank on every page load.
                      unoptimized={!isOptimizableImageHost(slide.bannerImage)}
                      data-loaded={loadedIds.has(slide._id)}
                      onLoad={() => markLoaded(slide._id)}
                      // A banner that 404s never fires `onLoad`, and the floor
                      // above it would then shimmer forever — which reads as a
                      // hang rather than as a failure. Clearing it shows the
                      // empty frame the broken image actually is.
                      onError={() => markLoaded(slide._id)}
                      className="motion-image-in object-cover object-center"
                    />
                  </div>
                ))}
              </div>
            </div>
            {/* The floor sits above the sponsor pill rather than under it. The
                placeholder draws a pill-shaped bar in the same corner, and a
                real label over a fake one is the one thing that would give the
                handover away. */}
            <div
              aria-hidden
              data-loaded={currentLoaded}
              className="motion-image-floor pointer-events-none absolute inset-0 z-30"
            >
              <div className="absolute inset-0 animate-pulse bg-gray-100 dark:bg-neutral-800">
                <BannerSkeletonArt />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 z-20 flex items-start px-6 pt-6 text-white lg:px-16 lg:pt-8">
              {/* Was `px-4 py-2 text-sm` at 0.2em — a 36px pill of wide-tracked
                  14px over the artwork it is labelling. The prototype's is 28px
                  of 11px at 0.14em; this is the same idea on our scale. */}
              <span className="flex h-7 items-center rounded-lg bg-black/60 px-3 text-xs font-bold uppercase tracking-[0.06em] backdrop-blur-sm">
                {slides[selectedIndex]?.sponsorType ?? t("sponsorship")}
              </span>
            </div>
          </div>
          <div className="motion-fade mt-3 flex justify-center gap-3 pb-1">
            {slides.map((slide, index) => (
              <button
                key={slide._id}
                type="button"
                aria-label={`Go to slide ${index + 1}`}
                onClick={() => emblaApi?.scrollTo(index)}
                className={[
                  "focus-ring rounded-full transition-all",
                  index === selectedIndex
                    ? "h-1.5 w-12 bg-primary"
                    : "h-1.5 w-1.5 bg-primary/30 dark:bg-primary/50",
                ].join(" ")}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex h-125 items-center justify-center bg-[#111418] px-6 text-center text-white">
          <div className="max-w-xl">
            <span className="mb-4 inline-flex rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.06em] text-white/80">
              {t("sponsorships")}
            </span>
            {/* Plan.md Phase 5 #3: the heading and the paragraph beneath it
                both rendered `emptyStateMessage`, so this panel printed the
                same sentence twice. There is no second sentence to say — the
                four states are each one line — so the paragraph is gone rather
                than filled with copy invented to occupy it.

                #4: an <h2>, not an <h1>. The page's single <h1> now lives in
                `HomeContent`, where it exists whether or not the banners load.
                This heading described the state of one section, not the page. */}
            <h2 className="text-2xl font-extrabold lg:text-display">
              {emptyStateMessage}
            </h2>
          </div>
        </div>
      )}
    </section>
  );
}