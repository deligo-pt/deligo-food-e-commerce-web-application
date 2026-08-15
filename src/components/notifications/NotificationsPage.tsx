/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  CheckCheck,
  Bike,
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
  isCartExpiryNotification,
  resolveNotificationStatus,
} from "@/lib/notificationHeader";
import Link from "next/link";
import NotificationsSkeleton from "./NotificationsSkeleton";

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
const PRIMARY_ACTION_CLASS =
  "mt-4 rounded-lg bg-[#f9186b] dark:bg-pink-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#d4145b] dark:hover:bg-pink-700 cursor-pointer";

/** Circular control — the pagination arrows and the mark-all-read button. */
const ICON_BUTTON_CLASS =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[#f9186b] dark:text-pink-400 transition hover:bg-pink-50 dark:hover:bg-pink-950/30 disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-neutral-900 cursor-pointer";

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

const getIconByType = (type: Notification["type"]) => {
  switch (type) {
    case "ORDER":
      return Bike;
    case "PROMO":
      return Gift;
    case "SECURITY":
      return BellRing;
    case "DELIVERED":
      return CheckCircle2;
    default:
      return BellRing;
  }
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
   * Does this page have to fetch orders to caption its headers?
   *
   * Only when something on it names an order but not the status of that order.
   * A page whose notifications all declare `data.status` — and a page with no
   * order notifications at all — issues no request. That also means the query
   * retires itself the day the backend fills `data.status` in everywhere,
   * without anyone having to notice.
   */
  const needsOrderLookup = useMemo(
    () =>
      notifications.some(
        (notification) =>
          Boolean(getNotificationOrderId(notification)) &&
          !notification.data?.status,
      ),
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

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-neutral-950 py-8 transition-colors duration-200">
      {/* Same container as the orders page — its sibling in the account area,
          which was 100px wider and inset differently. */}
      <div className="mx-auto max-w-5xl px-4 md:px-8">
        {/* `items-start` with `gap-4` and a `shrink-0` button: the heading is
            allowed to wrap without ever squeezing the control beside it. */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#191c1d] dark:text-neutral-50">
              {t("notifications")}
            </h1>
            <p className="mt-1 text-sm text-[#5a4044] dark:text-neutral-400">
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
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition cursor-pointer ${
                  isActive
                    ? "border-[#f9186b] bg-[#f9186b] text-white dark:border-pink-600 dark:bg-pink-600"
                    : "border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[#5a4044] dark:text-neutral-300 hover:bg-pink-50 hover:border-pink-200 dark:hover:bg-neutral-800 dark:hover:border-neutral-700"
                }`}
              >
                {label}
                {/* Fixed min-width so the chips do not resize as counts change
                    from one to two digits, which shifted the whole row. */}
                <span
                  className={`min-w-5 rounded-full px-1.5 py-px text-center ${
                    isActive
                      ? "bg-white/25 text-white"
                      : "bg-gray-100 dark:bg-neutral-800 text-[#5a4044] dark:text-neutral-300"
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
            <div className="flex h-75 items-center justify-center rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-center text-[#5a4044] dark:text-neutral-400 shadow-sm">
              {t("noNotifications")}
            </div>
          ) : (
            filteredNotifications.map((notification) => {
              const Icon = getIconByType(notification.type);
              const isUnread = !notification.isRead;
              const isMarkingThis = markingId === notification._id;

              // The header is composed here rather than taken from `title`,
              // which the backend stores pre-rendered in English — see
              // `lib/notificationHeader`. `orderId` null is a real answer: the
              // cart-expiry warning has no order, and keeps its own title.
              const orderId = getNotificationOrderId(notification);
              const statusLabel = orderId
                ? getOrderStatusLabel(
                    resolveNotificationStatus(
                      notification,
                      orderIndex?.get(orderId),
                    ),
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
                  className={`relative flex gap-4 overflow-hidden rounded-xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 pl-6 shadow-sm transition-shadow hover:shadow-md ${
                    isUnread ? "cursor-pointer" : ""
                  } ${isMarkingThis ? "opacity-60 pointer-events-none" : ""}`}
                  onClick={() => {
                    if (isUnread) handleMarkAsRead(notification._id);
                  }}
                >
                  {isUnread && (
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 w-1 bg-[#f9186b] dark:bg-pink-500"
                    />
                  )}

                  {/* Icon */}
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                      isUnread
                        ? "bg-pink-50 dark:bg-pink-950/30"
                        : "bg-gray-100 dark:bg-neutral-800"
                    }`}
                  >
                    <Icon
                      size={20}
                      className={
                        isUnread
                          ? "text-[#f9186b] dark:text-pink-400"
                          : "text-[#5a4044] dark:text-neutral-400"
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
                      <h3 className="min-w-0 break-words text-lg font-semibold text-[#191c1d] dark:text-neutral-50">
                        {orderId ? (
                          <>
                            {/* Composed in JSX, not interpolated: t() takes a
                                single key and has no placeholder support. */}
                            {t("order")}{" "}
                            <Link
                              href={`/orders/track-order/${orderId}`}
                              onClick={(event) => event.stopPropagation()}
                              className="text-[#f9186b] dark:text-pink-400 hover:underline"
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
                        <span className="text-xs text-[#5a4044] dark:text-neutral-400">
                          {formatRelativeTime(notification.createdAt, t)}
                        </span>
                        {isUnread && (
                          <span
                            aria-hidden
                            className="h-2 w-2 rounded-full bg-[#f9186b] dark:bg-pink-500"
                          />
                        )}
                      </div>
                    </div>

                    <p className="mt-1.5 text-sm leading-6 text-[#5a4044] dark:text-neutral-300">
                      {notification.message}
                    </p>

                    {/* Type badge. `rounded-full` to match the pill language
                        the order cards and filter chips already use. */}
                    <div className="mt-3">
                      <span className="rounded-full bg-pink-50 dark:bg-pink-950/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#f9186b] dark:text-pink-400">
                        {getTypeLabel(notification.type, t)}
                      </span>
                    </div>

                    {/* Conditional actions */}
                    {notification.type === "ORDER" &&
                      notification.data?.orderId && (
                        <Link
                          href={`/orders/track-order/${notification.data.orderId}`}
                        >
                          <button
                            className={PRIMARY_ACTION_CLASS}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {t("trackOrder")}
                          </button>
                        </Link>
                      )}

                    {/* Cart expiry is the one notification with no order
                        behind it, so it gets the one action that makes sense:
                        the cart itself. No id travels in the notification and
                        none is needed — `/carts/view-cart` takes none, there is
                        exactly one cart per customer.

                        Shown unconditionally. These notifications outlive the
                        cart they warned about, so the button may well land on
                        an empty one — but a button that vanishes based on state
                        the customer cannot see is worse than one that lands
                        somewhere self-explanatory. */}
                    {isCartExpiryNotification(notification) && (
                      <Link href="/cart">
                        <button
                          className={PRIMARY_ACTION_CLASS}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t("viewCart")}
                        </button>
                      </Link>
                    )}

                    {notification.type === "DELIVERED" && (
                      <div className="mt-4 flex gap-6">
                        <button
                          className="text-sm font-semibold text-[#f9186b] dark:text-pink-400 hover:underline cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t("rateOrder")}
                        </button>
                        <button
                          className="text-sm font-semibold text-[#f9186b] dark:text-pink-400 hover:underline cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t("orderAgain")}
                        </button>
                      </div>
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
            <p className="text-sm text-[#5a4044] dark:text-neutral-400">
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
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition cursor-pointer ${
                        currentPage === item
                          ? "bg-[#f9186b] dark:bg-pink-600 text-white"
                          : "border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[#191c1d] dark:text-neutral-300 hover:bg-pink-50 dark:hover:bg-pink-950/30"
                      }`}
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
