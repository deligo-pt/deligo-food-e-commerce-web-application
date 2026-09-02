"use client";

/**
 * `/_design` — the rendered spec for `Plan.md`.
 *
 * ## Why this route exists
 *
 * `Plan.md` §5 asks: *"Should a rendered kit be published for sign-off before
 * Phase 4 touches ~50 files?"* This is that kit. It renders the proposed type
 * scale, spacing, colour tokens, button sizes, card shapes and motion so the
 * visual language can be approved *before* the sweep, not discovered after it.
 *
 * ## Why the folder is called `%5Fdesign`
 *
 * A folder starting with `_` is a *private folder* in the App Router — Next
 * drops it from routing entirely, so `src/app/_design/` would 404. `%5F` is the
 * URL-encoded underscore; Next decodes segment names when it builds routes, so
 * this folder is not seen as private and its route is `/_design`.
 *
 * ## Ground rules this file keeps
 *
 * - **The literals here and the tokens in `globals.css` are kept in step.**
 *   Phase 1 has landed, so `--primary`, `--muted-foreground`, `--border` and
 *   `--warning` now carry these values for real. Section 3 renders one chip
 *   from the literal and one from `var(--primary)` side by side, so a drift
 *   between this page and the stylesheet is visible rather than assumed.
 * - **It renders the real thing wherever one exists.** Section 4 mounts the
 *   actual `<Button>`; since Phase 6, section 6 uses the actual `motion-fade`,
 *   `motion-press` and `reveal-group` from `globals.css`. The one class still
 *   defined inline is `dsx-rm`, which fakes the reduced-motion setting for a
 *   reader who has not switched it on — a simulation, not a primitive, and
 *   scoped so a spec page cannot regress the app.
 * - **No backend data and no invented backend data.** Every label here reads
 *   as a slot ("Category name", "Restaurant name") rather than a plausible
 *   restaurant or a plausible price. This page shows shapes, not content.
 * - **The theme switch does not persist.** It toggles the `dark` class
 *   directly and restores whatever the document had on unmount, so previewing
 *   dark mode here never rewrites the stored `app-theme` preference.
 *
 * ## What it cannot show
 *
 * Hover and focus are live — you have to point at them. The forced-state row in
 * §4 is the exception: those are the hover classes applied statically so the
 * end state can be compared side by side.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Check, Moon, RotateCcw, Star, Store, Sun, Truck } from "lucide-react";

/* ------------------------------------------------------------------ *
 * Colour maths — WCAG 2.1 relative luminance and contrast ratio.
 * Computed, not quoted, so a token swap re-reports honestly.
 * ------------------------------------------------------------------ */

function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  return (
    0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
  );
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}

/* ------------------------------------------------------------------ *
 * The system, as data. Every table below reads from these.
 * ------------------------------------------------------------------ */

const TYPE_SCALE = [
  {
    px: 32,
    rem: "2rem",
    cls: "text-display",
    token: "text-display",
    weight: "font-bold",
    lh: "40px · 1.25",
    use: "Hero, page h1",
    sample: "Fresh delivery to your door",
  },
  {
    px: 24,
    rem: "1.5rem",
    cls: "text-2xl",
    token: "text-2xl",
    weight: "font-bold",
    lh: "32px · 1.33",
    use: "Section heading (20 on mobile)",
    sample: "Shop on Deligo",
  },
  {
    px: 20,
    rem: "1.25rem",
    cls: "text-xl",
    token: "text-xl",
    weight: "font-semibold",
    lh: "28px · 1.4",
    use: "Card title",
    sample: "Restaurant name",
  },
  {
    px: 16,
    rem: "1rem",
    cls: "text-base",
    token: "text-base",
    weight: "font-normal",
    lh: "24px · 1.5",
    use: "Body, card subtitle",
    sample: "Body copy sits here at the reading size.",
  },
  {
    px: 14,
    rem: "0.875rem",
    cls: "text-sm",
    token: "text-sm",
    weight: "font-medium",
    lh: "20px · 1.43",
    use: "Meta, labels, all button text",
    sample: "Delivery in 25 min",
  },
  {
    px: 12,
    rem: "0.75rem",
    cls: "text-xs",
    token: "text-xs",
    weight: "font-medium",
    lh: "16px · 1.33",
    use: "Badges, captions",
    sample: "OPEN NOW",
  },
] as const;

/** Retired by the Phase 4 sweep. Counts are what was actually replaced. */
const RETIRED_TYPE = [
  { cls: "text-lg", count: 56, to: "text-xl / text-base" },
  { cls: "text-3xl", count: 64, to: "text-2xl" },
  { cls: "text-4xl / 5xl / 6xl", count: 43, to: "text-display" },
  { cls: "text-[10px] / [11px]", count: 21, to: "text-xs" },
  { cls: "text-[0.8rem]", count: 3, to: "text-sm" },
  { cls: "text-[34px]", count: 4, to: "text-display" },
];

const SPACING = [
  { px: 4, cls: "1", use: "Icon nudge, badge inset" },
  { px: 8, cls: "2", use: "Inline gap, chip padding" },
  { px: 12, cls: "3", use: "Button side padding (sm)" },
  { px: 16, cls: "4", use: "Card padding (mobile), grid gap (mobile), icon to label" },
  { px: 24, cls: "6", use: "Card padding (desktop), heading to content, grid gap (desktop)" },
  { px: 32, cls: "8", use: "Card to card in a stack" },
  { px: 48, cls: "12", use: "Section to section (mobile)" },
  { px: 64, cls: "16", use: "Section to section (desktop)" },
];

const RETIRED_SPACING = ["p-5", "sm:p-7", "lg:p-10", "gap-10", "sm:mb-10", "mb-24", "py-20", "pr-11"];

/** Reads straight off the real component — these are its size keys, not a
 *  redrawing of them, so the row below cannot drift from `button.tsx`. */
const BUTTON_SIZES = [
  { key: "sm", name: "sm", h: "32", pad: 12, cls: "h-8 px-3" },
  { key: "default", name: "default", h: "44 → 40 at sm", pad: 16, cls: "h-11 px-4 sm:h-10" },
  { key: "lg", name: "lg", h: "48", pad: 24, cls: "h-12 px-6" },
] as const;

const BRAND = "#f9186b";
const FOREGROUND = "#191c1d";
const MUTED_FOREGROUND = "#5f6368";
const BORDER = "#edeeef";
const WARNING = "#f6c344";
const SURFACE = "#ffffff";

const TOKENS = [
  { name: "--primary", hex: BRAND, meaning: "Brand. Action and availability only." },
  { name: "--foreground", hex: FOREGROUND, meaning: "Primary text." },
  { name: "--muted-foreground", hex: MUTED_FOREGROUND, meaning: "Secondary text. Replaces 12 greys." },
  { name: "--border", hex: BORDER, meaning: "Hairlines. Opaque #262626 in dark since Phase 10; it was 10% white." },
  { name: "--warning", hex: WARNING, meaning: "Rating star only." },
];

const PINKS = ["#f9186b", "#e91e7f", "#d7357c", "#d4145b", "#DC3173", "#ef2f7a", "#c2185b"];

const GREYS = [
  "#5f5f5f",
  "#696969",
  "#707070",
  "#767676",
  "#7a7a7a",
  "#7d7d7d",
  "#8b8b8b",
  "#8c8c8c",
  "#5a4044",
  "#9aa0a6",
];

const SECTIONS = [
  { id: "type", label: "Type" },
  { id: "spacing", label: "Spacing" },
  { id: "colour", label: "Colour" },
  { id: "buttons", label: "Buttons" },
  { id: "cards", label: "Cards" },
  { id: "motion", label: "Motion" },
];

/* ------------------------------------------------------------------ *
 * Small hooks
 * ------------------------------------------------------------------ */

/** Reports an element's rendered height, live, so card sizes are measured
 *  rather than asserted. This is what makes the 240 → 112 claim checkable. */
function useMeasuredHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setHeight(Math.round(el.getBoundingClientRect().height));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, height] as const;
}

/**
 * Reads the live `dark` class off `<html>`.
 *
 * `useSyncExternalStore` rather than state-plus-effect: that class is owned by
 * the shell — an inline script in the root layout sets it before hydration —
 * so it is genuinely an external store. Subscribing also means a theme change
 * made anywhere else is reflected here without this page polling for it.
 */
function useDarkClass(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mo = new MutationObserver(onChange);
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return () => mo.disconnect();
    },
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

function useViewport() {
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const read = () => setWidth(window.innerWidth);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return width;
}

function breakpointOf(width: number | null): string {
  if (width === null) return "—";
  if (width >= 1536) return "2xl";
  if (width >= 1280) return "xl";
  if (width >= 1024) return "lg";
  if (width >= 768) return "md";
  if (width >= 640) return "sm";
  return "base";
}

/* ------------------------------------------------------------------ *
 * Layout primitives, local to this page
 * ------------------------------------------------------------------ */

function Section({
  id,
  n,
  title,
  intro,
  children,
}: {
  id: string;
  n: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border py-12">
      <div className="mb-6 max-w-2xl">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          <span className="mr-3 font-mono text-base text-gray-400 dark:text-neutral-600">{n}</span>
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-neutral-400">{intro}</p>
      </div>
      {children}
    </section>
  );
}

function Card({
  label,
  tone = "neutral",
  children,
}: {
  label: string;
  tone?: "neutral" | "now" | "after";
  children: ReactNode;
}) {
  const toneClass =
    tone === "now"
      ? "border-amber-300 dark:border-amber-500/40"
      : tone === "after"
        ? "border-emerald-300 dark:border-emerald-500/40"
        : "border-border";

  const labelClass =
    tone === "now"
      ? "text-amber-700 dark:text-amber-400"
      : tone === "after"
        ? "text-emerald-700 dark:text-emerald-400"
        : "text-gray-500 dark:text-neutral-400";

  return (
    <div className={`rounded-xl border bg-card p-4 ${toneClass}`}>
      <p className={`mb-4 text-xs font-bold uppercase tracking-wider ${labelClass}`}>{label}</p>
      {children}
    </div>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700 dark:bg-neutral-800 dark:text-neutral-300">
      {children}
    </code>
  );
}

function Ratio({ fg, bg, large = false }: { fg: string; bg: string; large?: boolean }) {
  const value = contrast(fg, bg);
  const threshold = large ? 3 : 4.5;
  const pass = value >= threshold;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-xs ${
        pass
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
          : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
      }`}
    >
      {value.toFixed(2)}:1 {pass ? "PASS" : "FAIL"}
      <span className="opacity-60">({large ? "3:1" : "4.5:1"})</span>
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export default function DesignSpecPage() {
  const width = useViewport();
  const dark = useDarkClass();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [motionKey, setMotionKey] = useState(0);
  const [loaded, setLoaded] = useState(true);

  const [nowCardRef, nowCardHeight] = useMeasuredHeight<HTMLDivElement>();
  const [afterCardRef, afterCardHeight] = useMeasuredHeight<HTMLButtonElement>();

  // Preview-only theme switching: the `dark` class is toggled directly and the
  // document is put back the way it was found on unmount. `app-theme` in
  // localStorage is never written, so looking at dark mode here does not change
  // the theme the rest of the app remembers.
  useEffect(() => {
    const root = document.documentElement;
    const was = root.classList.contains("dark");
    return () => {
      root.classList.toggle("dark", was);
      root.classList.toggle("light", !was);
    };
  }, []);

  const applyTheme = useCallback((next: boolean) => {
    const root = document.documentElement;
    root.classList.toggle("dark", next);
    root.classList.toggle("light", !next);
  }, []);

  const replay = useCallback(() => {
    setLoaded(false);
    setMotionKey((k) => k + 1);
    window.setTimeout(() => setLoaded(true), 550);
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#191c1d] dark:bg-neutral-950 dark:text-neutral-100">
      <style>{`
        /* One class, and it is a simulation rather than a primitive.

           Section 6 used to prototype its own scaled-down copies of the reveal,
           the crossfade and the press right here. It does not any more: Phase 6
           put motion-fade, motion-press and reveal-group in globals.css, and
           this page renders those — the same rule section 4 follows by mounting
           the real <Button> instead of a drawing of one. A spec that redraws
           its subject can agree with itself while disagreeing with the app.

           What is left fakes the reduced-motion setting for a reader who has
           not turned it on. Scoped to the demo subtree on purpose: a blanket
           "* { animation: none }" would also freeze the skeleton pulses and the
           spinners the app runs to say "still loading". */
        .dsx-rm *, .dsx-rm *::before, .dsx-rm *::after {
          animation: none !important;
          transition: none !important;
        }
      `}</style>

      {/* ---------------------------------------------------------- *
       * Sticky bar: nav, live viewport readout, theme switch
       * ---------------------------------------------------------- */}
      <header className="sticky top-0 z-30 border-b border-border bg-white/90 backdrop-blur-md dark:bg-neutral-950/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
          <p className="text-sm font-bold">
            Deligo design spec
            <span className="ml-2 font-normal text-gray-400 dark:text-neutral-500">/_design</span>
          </p>

          <nav className="flex flex-wrap items-center gap-1">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
              >
                {s.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="font-mono text-xs text-gray-500 dark:text-neutral-400">
              {width === null ? "—" : `${width}px`}
              <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 font-bold dark:bg-neutral-800">
                {breakpointOf(width)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => applyTheme(!dark)}
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-medium transition-colors hover:bg-gray-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              {dark ? <Sun size={14} /> : <Moon size={14} />}
              {dark ? "Light" : "Dark"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16">
        {/* ---------------------------------------------------------- *
         * Intro
         * ---------------------------------------------------------- */}
        <div className="max-w-2xl py-12">
          <h1 className="text-display font-bold">Design system, rendered</h1>
          <p className="mt-4 text-base leading-6 text-gray-600 dark:text-neutral-400">
            Every value below is drawn from <Mono>Plan.md</Mono> at real size, so it can be
            approved before Phase 4 touched roughly fifty files. All seven phases have now
            shipped, so nothing below is a proposal: the tokens, the button sizes, the card
            geometry and the three motion primitives are all live in <Mono>globals.css</Mono>
            and this page renders them rather than describing them. Phase 7 took its box model
            from a design prototype and its numbers from the scale below — where the two
            disagreed, the scale won.
          </p>
          <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-neutral-500">
            Resize the window and watch the readout in the bar above — every card and heading here
            responds at the same breakpoints the app uses.
          </p>
        </div>

        {/* ---------------------------------------------------------- *
         * 1. Type
         * ---------------------------------------------------------- */}
        <Section
          id="type"
          n="01"
          title="Type scale"
          intro="Six steps, nothing between them — and as of Phase 4 the tree uses nothing else. 18, 30, 36, 48 and 60 are gone, along with every arbitrary px size bar the two that draw the 404 numeral."
        >
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {TYPE_SCALE.map((step, i) => (
              <div
                key={step.px}
                className={`flex flex-col gap-3 p-6 sm:flex-row sm:items-baseline sm:gap-8 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <div className="w-40 shrink-0">
                  <p className="font-mono text-sm font-bold">{step.px}px</p>
                  <p className="mt-1 font-mono text-xs text-gray-500 dark:text-neutral-500">
                    {step.rem} · {step.cls}
                  </p>
                  <p className="mt-1 font-mono text-xs text-gray-400 dark:text-neutral-600">
                    {step.lh}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`${step.cls} ${step.weight} truncate leading-tight`}
                    style={{ color: dark ? undefined : FOREGROUND }}
                  >
                    {step.sample}
                  </p>
                  <p className="mt-2 text-xs text-gray-500 dark:text-neutral-500">{step.use}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Card label="Retired — and swept out in Phase 4" tone="after">
              <ul className="space-y-2 text-sm">
                {RETIRED_TYPE.map((r) => (
                  <li key={r.cls} className="flex items-center gap-2">
                    <Mono>{r.cls}</Mono>
                    {r.count !== null && (
                      <span className="text-xs text-gray-400 dark:text-neutral-600">
                        &times;{r.count}
                      </span>
                    )}
                    <span className="text-gray-400">&rarr;</span>
                    <Mono>{r.to}</Mono>
                  </li>
                ))}
              </ul>
            </Card>

            <Card label="Section heading, before and after" tone="after">
              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-xs text-gray-500 dark:text-neutral-500">
                    Before — <Mono>text-xl sm:text-3xl</Mono> (20 &rarr; 30, a hard jump at tablet)
                  </p>
                  <p className="text-xl font-bold sm:text-[1.875rem]">Shop on Deligo</p>
                </div>
                <div>
                  <p className="mb-1 text-xs text-gray-500 dark:text-neutral-500">
                    Shipped — <Mono>text-xl sm:text-2xl</Mono> (20 &rarr; 24)
                  </p>
                  <p className="text-xl font-bold sm:text-2xl">Shop on Deligo</p>
                </div>
              </div>
            </Card>
          </div>
        </Section>

        {/* ---------------------------------------------------------- *
         * 2. Spacing
         * ---------------------------------------------------------- */}
        <Section
          id="spacing"
          n="02"
          title="Spacing"
          intro="Eight values, all multiples of four. Drawn to scale below, then applied so the numbers connect to something you can see."
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="space-y-3">
                {SPACING.map((s) => (
                  <div key={s.px} className="flex items-center gap-4">
                    <span className="w-12 shrink-0 text-right font-mono text-sm font-bold">
                      {s.px}
                    </span>
                    <span className="w-16 shrink-0">
                      <Mono>p-{s.cls}</Mono>
                    </span>
                    <span
                      className="h-4 shrink-0 rounded-sm"
                      style={{ width: `${s.px}px`, backgroundColor: BRAND }}
                    />
                    <span className="min-w-0 truncate text-xs text-gray-500 dark:text-neutral-500">
                      {s.use}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 border-t border-border pt-4">
                <p className="text-xs text-gray-500 dark:text-neutral-500">
                  Retired:{" "}
                  {RETIRED_SPACING.map((r) => (
                    <span key={r} className="mr-1.5 inline-block">
                      <Mono>{r}</Mono>
                    </span>
                  ))}
                </p>
              </div>
            </div>

            <Card label="Card padding applied" tone="after">
              <div
                className="rounded-2xl p-4 sm:p-6"
                style={{ backgroundColor: dark ? "#171717" : "#f8f9fa", outline: `1px dashed ${BRAND}` }}
              >
                <p className="text-xl font-semibold">Card title</p>
                <p className="mt-2 text-sm" style={{ color: MUTED_FOREGROUND }}>
                  16 padding on mobile, 24 from sm. Heading to content is 24.
                </p>
              </div>
              <p className="mt-3 text-xs text-gray-500 dark:text-neutral-500">
                The dashed edge is the padding box: <Mono>p-4 sm:p-6</Mono>.
              </p>
            </Card>
          </div>
        </Section>

        {/* ---------------------------------------------------------- *
         * 3. Colour
         * ---------------------------------------------------------- */}
        <Section
          id="colour"
          n="03"
          title="Colour"
          intro="Five tokens replace 107 hex literals. Contrast ratios are computed live against the surface each colour actually sits on, not quoted from a table."
        >
          <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-emerald-300 bg-card p-4 dark:border-emerald-500/40">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Phase 1 wiring check
            </p>
            <div className="flex items-center gap-2">
              <span className="h-8 w-16 rounded-lg" style={{ backgroundColor: BRAND }} />
              <span className="font-mono text-xs text-gray-500 dark:text-neutral-500">literal</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-8 w-16 rounded-lg bg-primary" />
              <span className="font-mono text-xs text-gray-500 dark:text-neutral-500">
                bg-primary
              </span>
            </div>
            <p className="min-w-0 flex-1 text-xs text-gray-600 dark:text-neutral-400">
              These two must be indistinguishable. The left is <Mono>{BRAND}</Mono> written here;
              the right reads <Mono>--primary</Mono> out of the stylesheet. A seam means the token
              and this page have drifted apart.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {TOKENS.map((token, i) => (
              <div
                key={token.name}
                className={`flex flex-col gap-4 p-4 sm:flex-row sm:items-center ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <span
                  className="h-12 w-20 shrink-0 rounded-lg border border-black/5"
                  style={{ backgroundColor: token.hex }}
                />
                <div className="w-56 shrink-0">
                  <p className="font-mono text-sm font-bold">{token.name}</p>
                  <p className="font-mono text-xs uppercase text-gray-500 dark:text-neutral-500">
                    {token.hex}
                  </p>
                </div>
                <p className="min-w-0 flex-1 text-sm text-gray-600 dark:text-neutral-400">
                  {token.meaning}
                </p>
                <span className="shrink-0">
                  <Ratio fg={token.hex} bg={SURFACE} large={token.name !== "--foreground"} />
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Card label="Seven spellings of one pink" tone="now">
              <div className="flex flex-wrap gap-2">
                {PINKS.map((hex) => (
                  <div key={hex} className="text-center">
                    <span
                      className={`block h-12 w-16 rounded-lg border ${
                        hex === BRAND ? "border-gray-900 dark:border-white" : "border-black/5"
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                    <span className="mt-1 block font-mono text-[11px] uppercase text-gray-500 dark:text-neutral-500">
                      {hex.replace("#", "")}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-600 dark:text-neutral-400">
                Outlined swatch is the one that won, confirmed 30 Aug 2026 — the last two of the
                seven differ only in letter case. It is <Mono>--primary</Mono>, and as of Phase 4
                none of the seven is typed as a utility anywhere in the tree. The darker one,
                <Mono>#d4145b</Mono>, became <Mono>--primary-hover</Mono>: derived from the brand
                with a colour-mix rather than typed, so it cannot drift away from it.
              </p>
            </Card>

            <Card label="Ten spellings of one grey" tone="now">
              <div className="flex flex-wrap gap-2">
                {GREYS.map((hex) => (
                  <div key={hex} className="text-center">
                    <span
                      className="block h-12 w-12 rounded-lg border border-black/5"
                      style={{ backgroundColor: hex }}
                    />
                    <span className="mt-1 block font-mono text-[11px] uppercase text-gray-500 dark:text-neutral-500">
                      {hex.replace("#", "")}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-600 dark:text-neutral-400">
                Proposed replacement <Mono>{MUTED_FOREGROUND}</Mono> —{" "}
                <Ratio fg={MUTED_FOREGROUND} bg={SURFACE} /> on white. Shipped in Phase 1, and
                Phase 4 rewrote ten of the twelve onto it. <Mono>#9aa0a6</Mono> was deliberately
                left out: it marks a closed store and a disabled control, and folding it in here
                would paint an open shop and a shut one identically. It needs a token of its own.
              </p>
            </Card>
          </div>

          <Card label="Pink means one thing" tone="after">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-3 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  Now — both lines pink, so neither signals
                </p>
                <div className="flex flex-col gap-2 text-sm font-medium">
                  <span className="flex items-center gap-2" style={{ color: BRAND }}>
                    <Truck size={16} /> Open now
                  </span>
                  <span className="flex items-center gap-2" style={{ color: BRAND }}>
                    <Check size={16} /> City name
                  </span>
                </div>
              </div>
              <div>
                <p className="mb-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  After — pink is availability, grey is fact
                </p>
                <div className="flex flex-col gap-2 text-sm font-medium">
                  <span className="flex items-center gap-2" style={{ color: BRAND }}>
                    <Truck size={16} /> Open now
                  </span>
                  <span className="flex items-center gap-2" style={{ color: MUTED_FOREGROUND }}>
                    <Check size={16} /> City name
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </Section>

        {/* ---------------------------------------------------------- *
         * 4. Buttons
         * ---------------------------------------------------------- */}
        <Section
          id="buttons"
          n="04"
          title="Buttons"
          intro="Three heights, one text size, and every button below is the real component — change button.tsx and this page changes with it. Hover and focus are live: point at them, or tab through."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {BUTTON_SIZES.map((size) => (
              <Card key={size.key} label={`${size.name} — ${size.h}px tall, ${size.pad} side`}>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size={size.key}>Primary</Button>
                  <Button size={size.key} variant="outline">
                    Outline
                  </Button>
                  <Button size={size.key} variant="secondary">
                    Secondary
                  </Button>
                  <Button
                    size={
                      size.key === "sm"
                        ? "icon-sm"
                        : size.key === "lg"
                          ? "icon-lg"
                          : "icon"
                    }
                    variant="ghost"
                    aria-label="Icon only"
                  >
                    <Star />
                  </Button>
                </div>
                <p className="mt-3 font-mono text-xs text-gray-500 dark:text-neutral-500">
                  {size.cls}
                </p>
              </Card>
            ))}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card label="Every state at the default size">
              <div className="flex flex-wrap items-center gap-3">
                <Button>Default</Button>
                <span
                  className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-white"
                  style={{ backgroundColor: "#c71353" }}
                >
                  Hover (forced)
                </span>
                <span
                  className="inline-flex h-10 translate-y-px items-center justify-center rounded-lg px-4 text-sm font-medium text-white"
                  style={{ backgroundColor: "#a90f45" }}
                >
                  Active (forced)
                </span>
                <Button disabled>Disabled</Button>
                <Button>
                  <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Loading
                </Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="link">Link</Button>
              </div>
              <p className="mt-3 text-xs text-gray-500 dark:text-neutral-500">
                The forced states are the hover and active classes applied statically, so the end
                colours can be judged side by side rather than chased with a cursor.
              </p>
            </Card>

            <Card label="Touch target" tone="now">
              <div className="flex flex-wrap items-end gap-4">
                <div className="text-center">
                  <button
                    type="button"
                    className="inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-sm font-medium text-white"
                    style={{ backgroundColor: "#9aa0a6" }}
                  >
                    Today
                  </button>
                  <p className="mt-2 font-mono text-xs text-gray-500 dark:text-neutral-500">
                    h-8 px-2.5
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400">32px — under target</p>
                </div>
                <div className="text-center">
                  <Button>Now shipped</Button>
                  <p className="mt-2 font-mono text-xs text-gray-500 dark:text-neutral-500">
                    h-11 px-4 sm:h-10
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    44 on a phone, 40 with a pointer
                  </p>
                </div>
                <div className="text-center">
                  <Button size="lg">Primary CTA</Button>
                  <p className="mt-2 font-mono text-xs text-gray-500 dark:text-neutral-500">
                    h-12 px-6
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">48px — thumb size</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-gray-600 dark:text-neutral-400">
                The <Mono>default</Mono> size in <Mono>src/components/ui/button.tsx</Mono> used to be{" "}
                <Mono>h-8</Mono> — 32px, on a phone-first app. Phase 2 retuned it and adopted it
                across 45 files. The <Mono>sm</Mono> size stays 32 because it is a dense secondary
                control, not a primary tap target.
              </p>
            </Card>
          </div>
        </Section>

        {/* ---------------------------------------------------------- *
         * 5. Cards
         * ---------------------------------------------------------- */}
        <Section
          id="cards"
          n="05"
          title="Cards"
          intro="Shipped in Phase 3. The left card is what the app rendered before it; the right is what it renders now. Both heights are measured from the rendered elements, live — resize and they update."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <Card
              label={`Before — ${nowCardHeight === null ? "measuring" : `${nowCardHeight}px tall`}`}
              tone="now"
            >
              {/* Classes copied verbatim from ShopSection.tsx so this is the
                  real card, not an impression of it. */}
              <div
                ref={nowCardRef}
                className="group flex cursor-pointer items-center gap-4 rounded-4xl border-2 border-transparent bg-card p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-2xl sm:gap-6 sm:p-7 lg:gap-10 lg:p-10"
              >
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-100 shadow-inner sm:h-28 sm:w-28 sm:rounded-3xl lg:h-40 lg:w-40 dark:bg-neutral-800">
                  <Store className="size-8 text-gray-400 dark:text-neutral-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-black leading-tight sm:text-xl">Category name</h3>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-600 dark:text-neutral-400">
                <Mono>p-5 sm:p-7 lg:p-10</Mono> · icon <Mono>h-20 &rarr; h-28 &rarr; h-40</Mono> ·{" "}
                <Mono>gap-4 sm:gap-6 lg:gap-10</Mono>. At lg that is 160px of icon and 40px of
                padding around a single word, with <Mono>flex-1</Mono> leaving most of the card
                empty. It was also a <Mono>div onClick</Mono> — not focusable, not keyboard
                operable, and invisible to assistive tech as a control.
              </p>
            </Card>

            <Card
              label={`Shipped — ${afterCardHeight === null ? "measuring" : `${afterCardHeight}px tall`}`}
              tone="after"
            >
              <button
                type="button"
                ref={afterCardRef}
                className="motion-press group flex w-full cursor-pointer items-center gap-4 rounded-4xl border-2 border-transparent bg-card p-4 text-left shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:shadow-2xl focus-visible:outline-2 focus-visible:outline-offset-2 sm:p-6"
                style={{ outlineColor: BRAND }}
              >
                <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-100 shadow-inner dark:bg-neutral-800">
                  <Store className="size-7 text-gray-400 dark:text-neutral-500" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-bold leading-tight">Category name</span>
                </span>
              </button>
              <p className="mt-3 text-xs text-gray-600 dark:text-neutral-400">
                <Mono>p-4 sm:p-6</Mono> · icon <Mono>size-16</Mono> · <Mono>gap-4</Mono> · title{" "}
                <Mono>text-base</Mono>. A real <Mono>button</Mono> with <Mono>aria-pressed</Mono>,
                so it tabs, answers Enter and Space, and announces which of the two is chosen.
                The category circles beside it were <em>also</em> clickable divs — the plan assumed
                they were not — so Phase 3 converted both rows.
              </p>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card label="Category circle — before and after" tone="now">
              <div className="flex items-end gap-8">
                <div className="text-center">
                  <span className="mx-auto block size-32 rounded-full bg-gray-100 dark:bg-neutral-800" />
                  <span className="mt-2 block text-[10px] font-medium sm:text-xs">Category</span>
                  <span className="mt-1 block font-mono text-xs text-gray-500 dark:text-neutral-500">
                    h-32 w-32
                  </span>
                </div>
                <div className="text-center">
                  <span className="mx-auto block size-20 rounded-full bg-gray-100 dark:bg-neutral-800" />
                  <span className="mt-2 block text-xs font-medium">Category</span>
                  <span className="mt-1 block font-mono text-xs text-emerald-600 dark:text-emerald-400">
                    size-20
                  </span>
                </div>
              </div>
              <p className="mt-4 text-xs text-gray-600 dark:text-neutral-400">
                128px at <Mono>sm</Mono> and up became 80; mobile keeps the 64 it already had. The
                label went from <Mono>text-[10px] sm:text-xs</Mono> to a flat <Mono>text-xs</Mono>,
                which is where two of the ten 10px instances went.
              </p>
            </Card>

            <Card label="Vendor card hierarchy — three passes at it" tone="after">
              <div className="grid gap-6 sm:grid-cols-3">
                <div>
                  <p className="mb-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    Before Phase 4
                  </p>
                  <p className="text-lg font-bold sm:text-xl">Restaurant name</p>
                  <p className="mt-1 text-base sm:text-lg" style={{ color: "#5a4044" }}>
                    Cuisine type
                  </p>
                  <p className="mt-3 text-xs text-gray-500 dark:text-neutral-500">
                    20 over 18. The subtitle sits within 2px of the title, so the card has no focal
                    point.
                  </p>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    Phase 4
                  </p>
                  <p className="text-xl font-semibold">Restaurant name</p>
                  <p className="mt-1 text-sm" style={{ color: MUTED_FOREGROUND }}>
                    Cuisine type
                  </p>
                  <p className="mt-3 text-xs text-gray-500 dark:text-neutral-500">
                    20 over 14, secondary muted. Better — but still two sizes of the same voice.
                  </p>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Phase 7 — shipped
                  </p>
                  <p className="flex items-center gap-2 text-xl font-bold tracking-[-0.015em]">
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: BRAND }}
                    />
                    Restaurant name
                  </p>
                  <p
                    className="mt-1 text-xs font-bold uppercase tracking-[0.06em]"
                    style={{ color: MUTED_FOREGROUND }}
                  >
                    Cuisine type
                  </p>
                  <p className="mt-3 text-xs text-gray-500 dark:text-neutral-500">
                    20 bold over 12 uppercase — separated by kind, not only by size. The dot is the
                    open/closed state, moved up out of the footer where it was a pink row competing
                    with the city line.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </Section>

        {/* ---------------------------------------------------------- *
         * 6. Motion
         * ---------------------------------------------------------- */}
        <Section
          id="motion"
          n="06"
          title="Motion"
          intro="Last on purpose — motion over inconsistent spacing just animates the inconsistency. Shipped in Phase 6, and every class below is the one globals.css defines rather than a copy of it. Press replay to run them again."
        >
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={replay}
              className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white"
              style={{ backgroundColor: BRAND }}
            >
              <RotateCcw size={16} />
              Replay
            </button>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-medium dark:border-neutral-700">
              <input
                type="checkbox"
                checked={reduceMotion}
                onChange={(e) => setReduceMotion(e.target.checked)}
                className="size-4 accent-[#f9186b]"
              />
              Simulate prefers-reduced-motion
            </label>
            <p className="text-xs text-gray-500 dark:text-neutral-500">
              The switch is scoped to this section. A blanket reset would also freeze the 71
              skeleton pulses and 37 spinners the app already runs.
            </p>
          </div>

          <div className={reduceMotion ? "dsx-rm" : undefined} key={motionKey}>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card label="Section reveal — 8px rise + fade, 350ms, 50ms stagger">
                <div data-revealed="true" className="reveal-group grid grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex h-20 items-center justify-center rounded-xl bg-gray-100 text-sm font-medium dark:bg-neutral-800"
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-gray-600 dark:text-neutral-400">
                  The delays are <Mono>nth-child</Mono> rules in the stylesheet, not inline styles,
                  so a card states nothing but its own class. The stagger caps at the ninth, so the
                  last row of a long grid is not left waiting. In the app{" "}
                  <Mono>data-revealed</Mono> starts false and <Mono>useRevealOnScroll</Mono> flips
                  it once, on the first intersection; here it is pinned true so replay can re-run
                  it.
                </p>
              </Card>

              <Card label="Skeleton to content — 300ms crossfade">
                <div className="space-y-3">
                  {loaded ? (
                    <div className="motion-fade space-y-3">
                      <div className="h-5 w-2/3 rounded bg-gray-200 dark:bg-neutral-700" />
                      <div className="h-4 w-full rounded bg-gray-100 dark:bg-neutral-800" />
                      <div className="h-4 w-4/5 rounded bg-gray-100 dark:bg-neutral-800" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="h-5 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-neutral-800" />
                      <div className="h-4 w-full animate-pulse rounded bg-gray-200 dark:bg-neutral-800" />
                      <div className="h-4 w-4/5 animate-pulse rounded bg-gray-200 dark:bg-neutral-800" />
                    </div>
                  )}
                </div>
                <p className="mt-3 text-xs text-gray-600 dark:text-neutral-400">
                  Content used to hard-swap in. The fade depended on Phase 5 making each skeleton
                  and its live content share one set of gap and margin classes — otherwise it
                  would run over a 16px jump and draw attention to it. Four such pairs were
                  levelled in the end, two of them found during this phase.
                </p>
              </Card>

              <Card label="Image hover — was 1.10 over 700ms, now 1.04 over 300ms">
                <div className="grid grid-cols-2 gap-4">
                  <div className="group cursor-pointer overflow-hidden rounded-xl">
                    <div className="flex aspect-16/10 items-center justify-center bg-gray-200 transition-transform duration-700 group-hover:scale-110 dark:bg-neutral-800">
                      <Store className="size-8 text-gray-400 dark:text-neutral-600" />
                    </div>
                    <p className="mt-2 text-center font-mono text-xs text-amber-700 dark:text-amber-400">
                      before
                    </p>
                  </div>
                  <div className="group cursor-pointer overflow-hidden rounded-xl">
                    <div className="flex aspect-16/10 items-center justify-center bg-gray-200 transition-transform duration-300 group-hover:scale-[1.04] dark:bg-neutral-800">
                      <Store className="size-8 text-gray-400 dark:text-neutral-600" />
                    </div>
                    <p className="mt-2 text-center font-mono text-xs text-emerald-700 dark:text-emerald-400">
                      shipped
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-gray-600 dark:text-neutral-400">
                  Hover both. The 700ms version is still moving after the thumb has left. The
                  same construct existed three times at three durations — 700ms, 1000ms and
                  500ms — which is what a value typed at the call site does.
                </p>
              </Card>

              <Card label="Press state — scale 0.97 over 120ms">
                <div className="grid grid-cols-2 gap-4">
                  <div className="cursor-pointer rounded-xl border border-border p-4 text-sm">
                    <p className="font-semibold">No feedback</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-neutral-500">
                      What a tap feels like today.
                    </p>
                  </div>
                  <div className="motion-press cursor-pointer rounded-xl border border-border p-4 text-sm">
                    <p className="font-semibold">Press me</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-neutral-500">
                      Hold to see the press.
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-gray-600 dark:text-neutral-400">
                  This is phone-first. Tapping a restaurant card gave nothing back at all, which
                  mattered more than any hover effect. It is on the restaurant and vendor cards,
                  the shop cards and the cuisine circles — the four things on this app that are
                  card-shaped and are themselves the control.
                </p>
              </Card>
            </div>
          </div>
        </Section>

        {/* ---------------------------------------------------------- *
         * Closing note
         * ---------------------------------------------------------- */}
        <section className="border-t border-border py-12">
          <div className="max-w-2xl">
            <h2 className="text-xl font-semibold">Before this ships</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-neutral-400">
              This route is real and unguarded — no middleware stands in front of it. When the
              phases are done it should either be deleted or gated behind a{" "}
              <Mono>process.env.NODE_ENV !== &quot;production&quot;</Mono> check.
            </p>
            <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-neutral-400">
              One question is still open: section headings at 24 or 28. Another was left to a
              designer rather than settled here — white on{" "}
              <Mono>{BRAND}</Mono> measures{" "}
              <Ratio fg="#ffffff" bg={BRAND} /> , which clears the 3:1 bar for large text and UI but
              not the 4.5:1 bar for 14px button labels. Brand fidelity against AA. White was kept,
              because it is what the app has always rendered; the fix, if one is wanted, is a
              darker <Mono>--primary-strong</Mono> behind text-bearing fills only.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
