/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useCallback } from "react";
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
import Link from "next/link";
import NotificationsSkeleton from "./NotificationsSkeleton";

interface NotificationData {
  orderId?: string;
}

interface Notification {
  _id: string;
  receiverId: string;
  receiverRole: string;
  title: string;
  message: string;
  data: NotificationData;
  type: "ORDER" | "PROMO" | "SECURITY" | "DELIVERED";
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
  const { t } = useTranslation();
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
    [],
  );

  useEffect(() => {
    fetchNotifications(1, "initial");
  }, [fetchNotifications]);

  useEffect(() => {
    const handleNotificationsUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.source !== "read") {
        fetchNotifications(currentPage, "none");
      }
    };
    const intervalId = setInterval(() => {
      fetchNotifications(currentPage, "none");
    }, 5000);

    window.addEventListener("notificationsUpdated", handleNotificationsUpdate as EventListener);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener("notificationsUpdated", handleNotificationsUpdate as EventListener);
    };
  }, [fetchNotifications, currentPage]);

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

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.isRead;
    if (filter === "orders") return n.type === "ORDER";
    if (filter === "promos") return n.type === "PROMO";
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const ordersCount = notifications.filter((n) => n.type === "ORDER").length;
  const promosCount = notifications.filter((n) => n.type === "PROMO").length;

  if (loading) return <NotificationsSkeleton />;

  if (error) {
    return (
      <div className="min-h-screen bg-[#f6f6f7] dark:bg-neutral-950 flex items-center justify-center transition-colors duration-200">
        <div className="text-red-500 dark:text-red-400 text-center">
          <p>
            {t("error")}: {error}
          </p>
          <button
            onClick={() => fetchNotifications(currentPage, "initial")}
            className="mt-4 rounded-md bg-[#c1005b] dark:bg-pink-600 px-4 py-2 text-white hover:bg-[#a0004c] dark:hover:bg-pink-700 transition cursor-pointer"
          >
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f6f7] dark:bg-neutral-950 transition-colors duration-200">
      <div className="mx-auto max-w-230 px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-[36px] font-bold leading-none text-[#1f1f1f] dark:text-neutral-100">
              {t("notifications")}
            </h1>
            <p className="mt-2 text-sm text-[#777] dark:text-neutral-400">
              {t("notificationsSubtitle")}
            </p>
          </div>

          <button
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0 || markingAll}
            title="Mark all as read"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ffe9ef] dark:bg-pink-950/40 text-[#c1005b] dark:text-pink-400 disabled:opacity-40 dark:disabled:opacity-20 transition cursor-pointer"
          >
            <CheckCheck size={18} />
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-3">
          {(
            [
              { key: "all", label: t("all"), count: notifications.length },
              { key: "unread", label: t("unread"), count: unreadCount },
              { key: "orders", label: t("orders"), count: ordersCount },
              { key: "promos", label: t("promos"), count: promosCount },
            ] as { key: FilterType; label: string; count: number }[]
          ).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs transition cursor-pointer ${filter === key
                ? "border-[#c1005b] bg-[#c1005b] text-white"
                : "border-[#e4d3d8] dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[#666] dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                }`}
            >
              {label}
              <span
                className={`rounded-full px-2 py-px ${filter === key ? "bg-white/20 text-white" : "bg-[#f2f2f2] dark:bg-neutral-800 dark:text-neutral-300"
                  }`}
              >
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Notification List */}
        <div
          className={`space-y-4 transition-opacity ${pageLoading ? "opacity-50 pointer-events-none" : ""}`}
        >
          {filteredNotifications.length === 0 ? (
            <div className="rounded-xl border border-[#ededed] dark:border-neutral-800 bg-white dark:bg-neutral-900 p-8 text-center text-[#666] dark:text-neutral-400">
              {t("noNotifications")}
            </div>
          ) : (
            filteredNotifications.map((notification) => {
              const Icon = getIconByType(notification.type);
              const isUnread = !notification.isRead;
              const isMarkingThis = markingId === notification._id;

              return (
                <div
                  key={notification._id}
                  className={`relative flex gap-4 rounded-xl border border-[#ededed] dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 transition-shadow hover:shadow-md ${isUnread ? "cursor-pointer" : ""
                    } ${isMarkingThis ? "opacity-60 pointer-events-none" : ""}`}
                  onClick={() => {
                    if (isUnread) handleMarkAsRead(notification._id);
                  }}
                >
                  {/* Left border for unread */}
                  {isUnread && (
                    <div className="absolute left-0 top-0 h-full w-0.75 rounded-l-xl bg-[#c1005b]" />
                  )}

                  {/* Icon */}
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${isUnread ? "bg-[#fff0f5] dark:bg-pink-950/20" : "bg-[#f3f3f3] dark:bg-neutral-800"
                      }`}
                  >
                    <Icon
                      size={20}
                      className={isUnread ? "text-[#c1005b] dark:text-pink-400" : "text-[#666] dark:text-neutral-400"}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <h3 className="text-[20px] font-semibold text-[#222] dark:text-neutral-100">
                        {notification.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#888] dark:text-neutral-400">
                          {formatRelativeTime(notification.createdAt, t)}
                        </span>
                        {isUnread && (
                          <span className="h-2 w-2 rounded-full bg-[#c1005b]" />
                        )}
                      </div>
                    </div>

                    <p className="mt-1 text-sm leading-6 text-[#666] dark:text-neutral-300">
                      {notification.message}
                    </p>

                    {/* Type badge */}
                    <div className="mt-3">
                      <span className="rounded bg-[#fff0f5] dark:bg-pink-950/30 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#c1005b] dark:text-pink-400">
                        {notification.type === "ORDER"
                          ? t("order")
                          : notification.type === "PROMO"
                            ? t("promo")
                            : notification.type === "SECURITY"
                              ? t("security")
                              : t("delivered")}
                      </span>
                    </div>

                    {/* Conditional actions */}
                    {notification.type === "ORDER" &&
                      notification.data?.orderId && (
                        <Link
                          href={`/orders/track-order/${notification.data.orderId}`}
                        >
                          <button
                            className="mt-4 rounded-md bg-[#c1005b] dark:bg-pink-600 px-5 py-2 text-sm font-medium text-white hover:bg-[#a0004c] dark:hover:bg-pink-700 transition cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {t("trackOrder")}
                          </button>
                        </Link>
                      )}

                    {notification.type === "DELIVERED" && (
                      <div className="mt-4 flex gap-6">
                        <button
                          className="text-sm font-medium text-[#c1005b] dark:text-pink-400 hover:underline cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t("rateOrder")}
                        </button>
                        <button
                          className="text-sm font-medium text-[#c1005b] dark:text-pink-400 hover:underline cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t("orderAgain")}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Chevron for unread */}
                  {isUnread && (
                    <div className="flex items-center">
                      <ChevronRight size={18} className="text-[#b5b5b5] dark:text-neutral-500" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        {meta.totalPage > 1 && (
          <div className="mt-8 flex items-center justify-between">
            {/* Info */}
            <p className="text-sm text-[#888] dark:text-neutral-400">
              {t("page") || "Page"} {meta.page} {t("of") || "of"}{" "}
              {meta.totalPage} &mdash; {meta.total}{" "}
              {t("totalNotifications") || "total"}
            </p>

            {/* Controls */}
            <div className="flex items-center gap-2">
              {/* Previous */}
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1 || pageLoading}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e4d3d8] dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[#c1005b] dark:text-pink-400 disabled:opacity-40 transition hover:bg-[#fff0f5] dark:hover:bg-pink-950/20 cursor-pointer"
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
                    <span key={`ellipsis-${idx}`} className="px-1 text-[#aaa] dark:text-neutral-600">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => goToPage(item as number)}
                      disabled={pageLoading}
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition cursor-pointer ${currentPage === item
                        ? "bg-[#c1005b] text-white"
                        : "border border-[#e4d3d8] dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[#444] dark:text-neutral-300 hover:bg-[#fff0f5] dark:hover:bg-pink-950/20"
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
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e4d3d8] dark:border-neutral-800 bg-white dark:bg-neutral-900 text-[#c1005b] dark:text-pink-400 disabled:opacity-40 transition hover:bg-[#fff0f5] dark:hover:bg-pink-950/20 cursor-pointer"
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
