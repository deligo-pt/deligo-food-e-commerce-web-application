/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  CheckCheck,
  Bike,
  Store,
  Gift,
  BellRing,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { useTranslation } from "@/hooks/useTranslation";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";
import {
  useOrderStatusIndex,
  useInvalidateOrderStatusIndex,
} from "@/hooks/queries/useOrders";
import { getOrderStatusLabel } from "@/lib/orderStatusLabel";
import {
  getNotificationOrderId,
  resolveNotificationStatus,
} from "@/lib/notificationHeader";
import {
  getNotificationIconKind,
  type NotificationIconKind,
} from "@/lib/notificationIcon";
import { getNotificationAction } from "@/lib/notificationAction";
import { useOrderRatingStore } from "@/stores/orderRatingStore";
import Link from "next/link";
import NotificationsSkeleton from "./NotificationsSkeleton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NotificationData {
  orderId?: string;
  /**
   * The status this notification announced. Present on only some of them —
   * `resolveNotificationStatus` explains what happens when it isn't.
   */
  status?: string;
  /** Subtype for notifications that aren't about an order, e.g. cart expiry. */
  type?: string;
}

/**
 * The notification kinds this page has copy and behaviour for, plus an open
 * `string` so the union stays honest.
 *
 * It was written as a closed four-value union, and it wasn't true: the backend
 * also sends `OTHER` (cart-expiry warnings arrive that way). Because TypeScript
 * believed the union, nothing flagged the badge's ternary chain for having no
 * default — so an `OTHER` notification fell off the end of it and was labelled
 * DELIVERED. `(string & {})` keeps autocomplete on the four known values while
 * admitting that the server decides this field, not us.
 */
type NotificationType =
  | "ORDER"
  | "PROMO"
  | "SECURITY"
  | "DELIVERED"
  | (string & {});

interface Notification {
  _id: string;
  receiverId: string;
  receiverRole: string;
  title: string;
  message: string;
  data: NotificationData;
  type: NotificationType;
  isRead: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPage: number;
}

interface ApiResponse {
  success: boolean;
  message: string;
  meta: Meta;
  data: Notification[];
}

type FilterType = "all" | "unread" | "orders" | "promos";

const PAGE_LIMIT = 10;

/**
 * The project's primary, and the surfaces built from it.
 *
 * Spelled out once here because this page used to run on `#c1005b` with
 * `#a0004c` for hover and `#ffe9ef`/`#fff0f5` for tints — a pink that appears
 * in **no other file in the app**, which uses `#f9186b` in 347 places. The
 * greys had drifted the same way (`#1f1f1f`, `#222`, `#666`, `#777`, `#888`,
 * `#444`, `#ededed`, `#e4d3d8`), so the page read as a different product.
 *
 * Constants rather than repetition: the four call sites below are what let the
 * drift go unnoticed in the first place.
 */
// Built from `buttonVariants` rather than restated: one of the call sites is a
// `Link`, so these have to stay class strings, but the geometry still comes
// from the one place that owns it (Plan.md Phase 2).
const PRIMARY_ACTION_CLASS = cn(
  buttonVariants(),
  "mt-4 font-semibold cursor-pointer",
);

/** Circular control — the pagination arrows and the mark-all-read button. */
const ICON_BUTTON_CLASS = cn(
  buttonVariants({ size: "icon", variant: "outline" }),
  "shrink-0 rounded-full text-primary hover:bg-primary/5 dark:text-pink-400 dark:hover:bg-pink-950/30 cursor-pointer",
);

const formatRelativeTime = (
  isoDate: string,
  t: (key: string) => string,
): string => {
  const now = new Date();
  const date = new Date(isoDate);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t("justNow");
  if (diffMins < 60) return `${diffMins} ${t("minutesAgo")}`;
  if (diffHours < 24) return `${diffHours} ${t("hoursAgo")}`;
  if (diffDays === 1) return t("yesterday");
  if (diffDays < 7) return `${diffDays} ${t("daysAgo")}`;
  return date.toLocaleDateString();
};

/**
 * Translation keys for the badge, for the types we have copy for.
 *
 * Deliberately a lookup rather than a ternary chain: a chain needs a final
 * `else`, and whatever sits there becomes the label for every value the backend
 * invents next. A map has no such branch — an unrecognized type simply isn't in
 * it, and `getTypeLabel` shows what the server actually said instead of
 * asserting something it didn't.
 */
const TYPE_LABEL_KEYS: Record<string, string> = {
  ORDER: "order",
  PROMO: "promo",
  SECURITY: "security",
  DELIVERED: "delivered",
};

/**
 * The badge's text: translated when we know the type, the backend's own string
 * when we don't.
 *
 * Falling back to the raw value keeps the badge truthful without needing a
 * frontend release every time a type is added — `OTHER` renders as "OTHER",
 * which the badge's `uppercase` styling already makes look native. It stays
 * untranslated on purpose: inventing PT copy for a value we've never seen would
 * be guessing at its meaning.
 */
const getTypeLabel = (
  type: Notification["type"],
  t: (key: string) => string,
): string => {
  const key = TYPE_LABEL_KEYS[type];
  return key ? t(key) : type;
};

/**
 * The glyph for each icon kind. Which kind applies is decided in
 * `lib/notificationIcon`, not here — this map is only the drawing.
 *
 * `Store` for pickup rather than a cutlery or chef glyph: it is what the app
 * already means by "collect it yourself" on the order card, the checkout
 * pickup panel and the payment page chip, and a fourth symbol for the same
 * idea would be a new thing for the customer to learn.
 */
const ICON_BY_KIND: Record<NotificationIconKind, typeof Bike> = {
  delivery: Bike,
  pickup: Store,
  promo: Gift,
  security: BellRing,
  delivered: CheckCircle2,
  generic: BellRing,
};

export default function NotificationsPage() {
  const { t, langVersion } = useTranslation();
  const prevLangVersionRef = useRef(langVersion);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [meta, setMeta] = useState<Meta>({
    page: 1,
    limit: PAGE_LIMIT,
    total: 0,
    totalPage: 1,
  });
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const invalidateOrderStatusIndex = useInvalidateOrderStatusIndex();
  // Selected as a single action rather than the whole store, so this page does
  // not re-render when the pending id changes underneath it.
  const requestOrderRating = useOrderRatingStore(
    (state) => state.requestOrderRating,
  );

  const fetchNotifications = useCallback(
    async (page: number, loadingType: "none" | "initial" | "page" = "page") => {
      try {
        if (loadingType === "initial") {
          setLoading(true);
        } else if (loadingType === "page") {
          setPageLoading(true);
        }
        setError(null);

        const response = await apiClient.get<ApiResponse>(
          `/notifications/my-notifications?page=${page}&limit=${PAGE_LIMIT}`,
        );

        if (response.data.success) {
          setNotifications(response.data.data);
          setMeta(response.data.meta);
          // The headers are drawn from a second query, and a list that moved on
          // while that query sat frozen is what made this page look like it
          // needed a reload. They refresh together or not at all.
          invalidateOrderStatusIndex();
        } else {
          throw new Error(
            response.data.message || "Failed to fetch notifications",
          );
        }
      } catch (err) {
        setError(getApiErrorMessage(err, "Could not load notifications"));
      } finally {
        setLoading(false);
        setPageLoading(false);
      }
    },
    [invalidateOrderStatusIndex],
  );

  useEffect(() => {
    fetchNotifications(1, "initial");
  }, [fetchNotifications]);

  // On a language switch, re-fetch the current page silently so the list stays
  // visible and just updates its localized notification text in place.
  useEffect(() => {
    if (prevLangVersionRef.current === langVersion) return;
    prevLangVersionRef.current = langVersion;
    fetchNotifications(currentPage, "none");
  }, [langVersion, currentPage, fetchNotifications]);

  useEffect(() => {
    const handleNotificationsUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.source !== "read") {
        fetchNotifications(currentPage, "none");
      }
    };
    window.addEventListener("notificationsUpdated", handleNotificationsUpdate as EventListener);
    return () => {
      window.removeEventListener("notificationsUpdated", handleNotificationsUpdate as EventListener);
    };
  }, [fetchNotifications, currentPage]);

  // Phase 2: background refresh at 60s (was 5s), and only while the tab is
  // visible — a hidden notifications tab now makes zero requests, and it
  // refreshes once immediately when you switch back to it.
  useVisiblePolling(() => fetchNotifications(currentPage, "none"), 60_000);

  const goToPage = (page: number) => {
    if (page < 1 || page > meta.totalPage || pageLoading) return;
    setCurrentPage(page);
    fetchNotifications(page, "page");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleMarkAsRead = useCallback(async (id: string) => {
    setMarkingId(id);
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)),
    );
    try {
      await apiClient.patch(`/notifications/${id}/read`);
      window.dispatchEvent(
        new CustomEvent("notificationsUpdated", { detail: { source: "read" } })
      );
    } catch (err) {
      // Roll back on failure
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: false } : n)),
      );
      console.error("Failed to mark as read:", err);
    } finally {
      setMarkingId(null);
    }
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    const hasUnread = notifications.some((n) => !n.isRead);
    if (!hasUnread || markingAll) return;

    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

    try {
      await apiClient.patch("/notifications/mark-all-as-read");
      window.dispatchEvent(
        new CustomEvent("notificationsUpdated", { detail: { source: "read" } })
      );
    } catch (err) {
      // Roll back on failure
      await fetchNotifications(currentPage, "none");
      console.error("Failed to mark all as read:", err);
    } finally {
      setMarkingAll(false);
    }
  }, [notifications, markingAll, fetchNotifications, currentPage]);

  // One pass over the list (recomputed only when it or the filter changes)
  // instead of four `.filter()` scans on every render — this component
  // re-renders on a 60s poll and on each mark-as-read.
  const { unreadCount, ordersCount, promosCount } = useMemo(() => {
    let unread = 0;
    let orders = 0;
    let promos = 0;
    for (const n of notifications) {
      if (!n.isRead) unread++;
      if (n.type === "ORDER") orders++;
      else if (n.type === "PROMO") promos++;
    }
    return { unreadCount: unread, ordersCount: orders, promosCount: promos };
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") return notifications.filter((n) => !n.isRead);
    if (filter === "orders")
      return notifications.filter((n) => n.type === "ORDER");
    if (filter === "promos")
      return notifications.filter((n) => n.type === "PROMO");
    return notifications;
  }, [notifications, filter]);

  /**
   * Does this page have to fetch orders?
   *
   * Whenever anything on it names an order. A page of promos and cart-expiry
   * warnings still issues no request.
   *
   * This used to be narrower — only notifications that named an order *and*
   * omitted `data.status`, since the status was the only thing the lookup was
   * for. The icon changed that: whether a row shows the bike or the storefront
   * depends on the order's `fulfillmentType`, which the notification never
   * carries, so the ones that do declare their status need the order too. The
   * narrow gate would have left every self-pickup notification that announces
   * its own status drawing a rider.
   */
  const needsOrderLookup = useMemo(
    () => notifications.some((notification) => Boolean(getNotificationOrderId(notification))),
    [notifications],
  );

  const { data: orderIndex } = useOrderStatusIndex({
    enabled: needsOrderLookup,
  });

  if (loading) return <NotificationsSkeleton />;

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] dark:bg-neutral-950 flex items-center justify-center px-6 transition-colors duration-200">
        <div className="text-center">
          <p className="text-red-500 dark:text-red-400">
            {t("error")}: {error}
          </p>
          <button
            onClick={() => fetchNotifications(currentPage, "initial")}
            className={PRIMARY_ACTION_CLASS}
          >
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  /* Phase 12. The skeleton above is swapped out in a single frame;
     `motion-fade` is that same swap over 300ms. Opacity only, once, and
     it opts out under prefers-reduced-motion with the rest of the set. */
  return (
    <div className="motion-fade min-h-screen bg-[#f8f9fa] dark:bg-neutral-950 py-8 transition-colors duration-200">
      {/* Same container as the orders page — its sibling in the account area,
          which was 100px wider and inset differently. */}
      <div className="mx-auto max-w-5xl px-4 md:px-8">
        {/* `items-start` with `gap-4` and a `shrink-0` button: the heading is
            allowed to wrap without ever squeezing the control beside it. */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl lg:text-display font-bold text-foreground dark:text-neutral-50">
              {t("notifications")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground dark:text-neutral-400">
              {t("notificationsSubtitle")}
            </p>
          </div>

          <button
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0 || markingAll}
            title={t("markAllAsRead")}
            aria-label={t("markAllAsRead")}
            // `mt-1` drops the 40px circle onto the heading's cap height —
            // top-aligning it against a 40px h1 left it visibly high.
            className={`${ICON_BUTTON_CLASS} mt-1`}
          >
            <CheckCheck size={18} />
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2.5">
          {(
            [
              { key: "all", label: t("all"), count: notifications.length },
              { key: "unread", label: t("unread"), count: unreadCount },
              { key: "orders", label: t("orders"), count: ordersCount },
              { key: "promos", label: t("promos"), count: promosCount },
            ] as { key: FilterType; label: string; count: number }[]
          ).map(({ key, label, count }) => {
            const isActive = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                aria-pressed={isActive}
                className={`focus-ring flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition cursor-pointer ${
                  isActive
                    ? "border-primary bg-primary text-white dark:border-pink-600 dark:bg-pink-600"
                    : "border-border bg-card text-muted-foreground dark:text-neutral-300 hover:bg-primary/5 hover:border-primary/20 dark:hover:bg-neutral-800 dark:hover:border-neutral-700"
                }`}
              >
                {label}
                {/* Fixed min-width so the chips do not resize as counts change
                    from one to two digits, which shifted the whole row. */}
                <span
                  className={`min-w-5 rounded-full px-1.5 py-px text-center ${
                    isActive
                      ? "bg-white/25 text-white"
                      : "bg-gray-100 dark:bg-neutral-800 text-muted-foreground dark:text-neutral-300"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Notification List */}
        <div
          className={`space-y-4 transition-opacity ${pageLoading ? "opacity-50 pointer-events-none" : ""}`}
        >
          {filteredNotifications.length === 0 ? (
            <div className="flex h-75 items-center justify-center rounded-xl border border-border bg-card text-center text-muted-foreground dark:text-neutral-400 shadow-sm">
              {t("noNotifications")}
            </div>
          ) : (
            filteredNotifications.map((notification) => {
              const isUnread = !notification.isRead;
              const isMarkingThis = markingId === notification._id;

              // The header is composed here rather than taken from `title`,
              // which the backend stores pre-rendered in English — see
              // `lib/notificationHeader`. `orderId` null is a real answer: the
              // cart-expiry warning has no order, and keeps its own title.
              const orderId = getNotificationOrderId(notification);
              // One lookup, two uses: the status in the header and the icon
              // beside it. `undefined` while the index is still loading, which
              // both callers already handle.
              const order = orderId ? orderIndex?.get(orderId) : undefined;
              const Icon = ICON_BY_KIND[getNotificationIconKind(notification.type, order)];
              const action = getNotificationAction(notification, order);
              const statusLabel = orderId
                ? getOrderStatusLabel(
                    resolveNotificationStatus(notification, order),
                    t,
                  )
                : null;

              return (
                <div
                  key={notification._id}
                  // `overflow-hidden` lets the unread bar below sit flush
                  // inside the rounded corner instead of needing its own
                  // radius, and `pl-6` keeps the content clear of it — read and
                  // unread rows still start their text on the same x.
                  className={`relative flex gap-4 overflow-hidden rounded-xl border border-border bg-card p-4 pl-6 shadow-sm transition-shadow hover:shadow-md ${
                    isUnread ? "cursor-pointer" : ""
                  } ${isMarkingThis ? "opacity-60 pointer-events-none" : ""}`}
                  onClick={() => {
                    if (isUnread) handleMarkAsRead(notification._id);
                  }}
                >
                  {isUnread && (
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-1 bg-primary dark:bg-pink-500"
                    />
                  )}

                  {/* Icon */}
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                      isUnread
                        ? "bg-primary/5 dark:bg-pink-950/30"
                        : "bg-gray-100 dark:bg-neutral-800"
                    }`}
                  >
                    <Icon
                      size={20}
                      className={
                        isUnread
                          ? "text-primary dark:text-pink-400"
                          : "text-muted-foreground dark:text-neutral-400"
                      }
                    />
                  </div>

                  {/* `min-w-0` so a long header wraps inside this column rather
                      than stretching the row and pushing the timestamp out. */}
                  <div className="min-w-0 flex-1">
                    {/* `items-baseline` sits the 12px timestamp on the same
                        baseline as the 18px heading — `items-start` floated it
                        against the heading's ascender. */}
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="min-w-0 break-words text-xl font-semibold text-foreground dark:text-neutral-50">
                        {orderId ? (
                          <>
                            {/* Composed in JSX, not interpolated: t() takes a
                                single key and has no placeholder support. */}
                            {t("order")}{" "}
                            <Link
                              href={`/orders/track-order/${orderId}`}
                              onClick={(event) => event.stopPropagation()}
                              className="text-primary dark:text-pink-400 hover:underline"
                            >
                              #{orderId}
                            </Link>
                            {statusLabel ? ` — ${statusLabel}` : null}
                          </>
                        ) : (
                          notification.title
                        )}
                      </h3>
                      {/* `shrink-0`: the date is short and fixed, the heading
                          is not — without this a long header truncated the
                          wrong one of the two. */}
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-muted-foreground dark:text-neutral-400">
                          {formatRelativeTime(notification.createdAt, t)}
                        </span>
                        {isUnread && (
                          <span
                            aria-hidden
                            className="h-2 w-2 rounded-full bg-primary dark:bg-pink-500"
                          />
                        )}
                      </div>
                    </div>

                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground dark:text-neutral-300">
                      {notification.message}
                    </p>

                    {/* Type badge. `rounded-full` to match the pill language
                        the order cards and filter chips already use. */}
                    <div className="mt-3">
                      <span className="rounded-full bg-primary/5 dark:bg-pink-950/30 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary dark:text-pink-400">
                        {getTypeLabel(notification.type, t)}
                      </span>
                    </div>

                    {/* One action per row, chosen in `lib/notificationAction`:
                        Rate Order once the order is finished, Track Order while
                        it is live, View Cart for the expiry warning.

                        The cart one is shown unconditionally. Those
                        notifications outlive the cart they warned about, so the
                        button may well land on an empty one — but a button that
                        vanishes based on state the customer cannot see is worse
                        than one that lands somewhere self-explanatory.

                        A `Link` styled as a button rather than a `button` inside
                        a `Link`: one interactive element, one thing for the
                        keyboard to land on. */}
                    {action.kind !== "none" && (
                      <Link
                        href={action.href}
                        className={PRIMARY_ACTION_CLASS}
                        onClick={(event) => {
                          // The row itself is clickable (it marks as read), and
                          // this click is about the order, not the row.
                          event.stopPropagation();
                          // `/orders` owns the only rating modal in the app;
                          // this is how it learns which order to open it for.
                          if (action.kind === "rate" && orderId) {
                            requestOrderRating(orderId);
                          }
                        }}
                      >
                        {t(action.labelKey)}
                      </Link>
                    )}
                  </div>

                  {/* The chevron column is reserved whether or not it holds a
                      chevron. Rendering it only for unread rows made every read
                      row's content 18px wider than its neighbour's, so the list
                      never lined up down its right edge. */}
                  <div
                    aria-hidden
                    className="flex w-4.5 shrink-0 items-center justify-end"
                  >
                    {isUnread && (
                      <ChevronRight
                        size={18}
                        className="text-gray-400 dark:text-neutral-500"
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        {/* `flex-wrap` + `gap-4` on the row below: at narrow widths the summary
            and the controls stack instead of crushing each other. */}
        {meta.totalPage > 1 && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            {/* Info */}
            <p className="text-sm text-muted-foreground dark:text-neutral-400">
              {t("page")} {meta.page} {t("of")} {meta.totalPage} &mdash;{" "}
              {meta.total} {t("totalNotifications")}
            </p>

            {/* Controls */}
            <div className="flex items-center gap-2">
              {/* Previous */}
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1 || pageLoading}
                aria-label={t("previous")}
                className={ICON_BUTTON_CLASS}
              >
                <ChevronLeft size={16} />
              </button>

              {/* Page numbers */}
              {Array.from({ length: meta.totalPage }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 ||
                    p === meta.totalPage ||
                    Math.abs(p - currentPage) <= 1,
                )
                .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1)
                    acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "..." ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-1 text-gray-400 dark:text-neutral-600"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => goToPage(item as number)}
                      disabled={pageLoading}
                      aria-current={currentPage === item ? "page" : undefined}
                      // h-10 w-10, matching the arrows either side of it —
                      // these were h-9 next to h-9 arrows in a row whose other
                      // circular control was h-10.
                      className={cn(
                        buttonVariants({
                          size: "icon",
                          variant: currentPage === item ? "default" : "outline",
                        }),
                        "shrink-0 rounded-full font-semibold cursor-pointer",
                        currentPage === item
                          ? ""
                          : "hover:bg-primary/5 dark:hover:bg-pink-950/30",
                      )}
                    >
                      {item}
                    </button>
                  ),
                )}

              {/* Next */}
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === meta.totalPage || pageLoading}
                aria-label={t("next")}
                className={ICON_BUTTON_CLASS}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
