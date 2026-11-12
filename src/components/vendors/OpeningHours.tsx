"use client";

import { Fragment, useId, useMemo, useState } from "react";
import { ChevronDown, Clock } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useStore } from "@/stores/translationStore";
import { DATE_LOCALES, DEFAULT_STORE_TIME_ZONE } from "@/lib/dateFormat";
import { serverNow } from "@/lib/serverClock";
import { cn } from "@/lib/utils";
import {
  groupDays,
  todaySchedule,
  weekFrom,
  weekdayName,
  WEEK,
  type ClockPeriod,
  type ScheduleDetails,
} from "@/lib/weeklySchedule";

/**
 * "12:00–16:00, 19:00–23:00", one no-wrap span per slot, so a narrow line wraps
 * between slots and never inside one. The ", " stays outside the spans: it is
 * the only break point (inside them, a 320 px page came out 39 px too wide).
 */
export function SlotList({ periods }: { periods: readonly ClockPeriod[] }) {
  return (
    <>
      {periods.map((p, i) => (
        <Fragment key={i}>
          <span className="whitespace-nowrap">
            {p.open}–{p.close}
            {i < periods.length - 1 ? "," : ""}
          </span>
          {i < periods.length - 1 ? " " : ""}
        </Fragment>
      ))}
    </>
  );
}

interface OpeningHoursProps {
  /** The vendor's `businessDetails`: `weeklySchedule`, else the legacy hours. */
  details: (ScheduleDetails & { timezone?: string | null }) | null | undefined;
  className?: string;
}

/**
 * The store's week on the vendor page (plan.md Part 3, Phase 13):
 *
 *   🕘 Opening hours                    [See all hours ⌄]
 *   Today       12:00–16:00, 19:00–23:00
 *   ─────────
 *   Mon – Thu   12:00–16:00, 19:00–23:00
 *   Fri         Closed
 *
 * Today's row is always shown; the week is behind "See all hours" on phones and
 * open from `lg`, where there is room. "Today" is the store's day, not the
 * phone's. Display only: whether the store is open now is the banner's job,
 * from the backend's `availability`.
 *
 * Renders nothing when the store has no hours at all (no schedule, legacy
 * fields missing): an empty card would say less than no card.
 */
export default function OpeningHours({ details, className }: OpeningHoursProps) {
  const { t } = useTranslation();
  const lang = useStore((state) => state.lang) as "en" | "pt";
  const locale = DATE_LOCALES[lang] ?? DATE_LOCALES.pt;
  const [expanded, setExpanded] = useState(false);
  const listId = useId();

  const week = useMemo(() => weekFrom(details), [details]);
  const timeZone = details?.timezone || DEFAULT_STORE_TIME_ZONE;
  // The vendor page renders after its query resolves, on the client, so the
  // clock read here is the browser's (corrected to the server's).
  const today = useMemo(
    () => (week ? todaySchedule(week, serverNow(), timeZone) : null),
    [week, timeZone],
  );

  if (!week || !today) return null;

  const closed = t("closed");
  const todayIndex = WEEK.indexOf(today.day);
  const groups = groupDays(week).map((g) => ({
    ...g,
    label:
      g.from === g.to
        ? weekdayName(g.from, locale, "short")
        : `${weekdayName(g.from, locale, "short")} – ${weekdayName(g.to, locale, "short")}`,
    hasToday: WEEK.indexOf(g.from) <= todayIndex && todayIndex <= WEEK.indexOf(g.to),
  }));

  const slots = (periods: typeof today.periods) => <SlotList periods={periods} />;

  return (
    <section
      aria-label={t("storeOpeningHours")}
      className={cn("rounded-2xl border border-border bg-card p-4", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="flex min-w-0 items-center gap-2 text-xl font-bold text-foreground">
          <Clock size={20} aria-hidden="true" className="shrink-0 text-primary dark:text-pink-400" />
          {t("storeOpeningHours")}
        </h2>

        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((v) => !v)}
          className="focus-ring flex h-8 shrink-0 items-center gap-1 rounded-full text-sm font-semibold text-primary-hover hover:underline dark:text-pink-400 lg:hidden"
        >
          {t(expanded ? "hideAllHours" : "seeAllHours")}
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={cn("transition-transform", expanded && "rotate-180")}
          />
        </button>
      </div>

      {/* Phones: today on its own row. From `lg` the whole week is open below
          with today in bold, so this row would only repeat it. */}
      <p className="mt-3 flex gap-4 text-sm lg:hidden">
        <span className="w-24 shrink-0 font-bold text-foreground">{t("today")}</span>
        <span
          className={cn(
            "min-w-0 flex-1 tabular-nums",
            today.periods.length ? "font-bold text-foreground" : "text-muted-foreground",
          )}
        >
          {today.periods.length ? slots(today.periods) : t("closedToday")}
        </span>
      </p>

      <dl
        id={listId}
        className={cn(
          "mt-3 divide-y divide-border border-t border-border",
          expanded ? "block" : "hidden lg:block",
        )}
      >
        {groups.map((g) => (
          <div key={g.from} className="flex gap-4 py-2 text-sm">
            <dt
              className={cn(
                "w-24 shrink-0",
                g.hasToday ? "font-bold text-foreground" : "text-muted-foreground",
              )}
            >
              {g.label}
            </dt>
            <dd
              className={cn(
                "min-w-0 flex-1 tabular-nums",
                g.periods.length === 0
                  ? "text-muted-foreground"
                  : g.hasToday
                    ? "font-bold text-foreground"
                    : "text-foreground",
              )}
            >
              {g.periods.length === 0 ? closed : slots(g.periods)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
