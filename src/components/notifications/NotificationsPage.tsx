"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCheck,
  Bike,
  Gift,
  BellRing,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { useTranslation } from "@/hooks/useTranslation";

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

interface ApiResponse {
  success: boolean;
  message: string;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPage: number;
  };
  data: Notification[];
}

type FilterType = "all" | "unread" | "orders" | "promos";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");

  // Fetch notifications on mount
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<ApiResponse>(
        "/notifications/my-notifications",
      );
      if (response.data.success) {
        setNotifications(response.data.data);
      } else {
        throw new Error(
          response.data.message || "Failed to fetch notifications",
        );
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load notifications"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
  }, [fetchNotifications]);

  // Mark a single notification as read
  const handleMarkAsRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)),
    );

    try {
      await apiClient.put(`/notifications/${id}/read`);
    } catch (err) {
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: false } : n)),
      );
      console.error("Failed to mark as read:", err);
    }
  }, []);

  // Mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    if (unreadCount === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

    try {
      await apiClient.post("/notifications/mark-all-as-read");
    } catch (err) {
      await fetchNotifications();
      console.error("Failed to mark all as read:", err);
    }
  }, [notifications, fetchNotifications]);

  const filteredNotifications = notifications.filter((notification) => {
    if (filter === "unread") return !notification.isRead;
    if (filter === "orders") return notification.type === "ORDER";
    if (filter === "promos") return notification.type === "PROMO";
    return true;
  });

  const totalCount = notifications.length;
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const ordersCount = notifications.filter((n) => n.type === "ORDER").length;
  const promosCount = notifications.filter((n) => n.type === "PROMO").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6f6f7] flex items-center justify-center">
        <div className="text-[#c1005b]">{t("loadingNotifications")}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f6f6f7] flex items-center justify-center">
        <div className="text-red-500 text-center">
          <p>
            {t("error")}: {error}
          </p>
          <button
            onClick={fetchNotifications}
            className="mt-4 rounded-md bg-[#c1005b] px-4 py-2 text-white"
          >
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f6f7]">
      <div className="mx-auto max-w-230 px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-[36px] font-bold leading-none text-[#1f1f1f]">
              {t("notifications")}
            </h1>
            <p className="mt-2 text-sm text-[#777]">
              {t("notificationsSubtitle")}
            </p>
          </div>

          <button
            onClick={handleMarkAllAsRead}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ffe9ef] text-[#c1005b]"
            disabled={unreadCount === 0}
          >
            <CheckCheck size={18} />
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-3">
          <button
            onClick={() => setFilter("all")}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs ${
              filter === "all"
                ? "border-[#c1005b] bg-[#c1005b] text-white"
                : "border-[#e4d3d8] bg-white text-[#666]"
            }`}
          >
            {t("all")}
            <span
              className={`rounded-full px-2 py-px ${
                filter === "all" ? "bg-white/20 text-white" : "bg-[#f2f2f2]"
              }`}
            >
              {totalCount}
            </span>
          </button>

          <button
            onClick={() => setFilter("unread")}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs ${
              filter === "unread"
                ? "border-[#c1005b] bg-[#c1005b] text-white"
                : "border-[#e4d3d8] bg-white text-[#666]"
            }`}
          >
            {t("unread")}
            <span
              className={`rounded-full px-2 py-px ${
                filter === "unread" ? "bg-white/20 text-white" : "bg-[#f2f2f2]"
              }`}
            >
              {unreadCount}
            </span>
          </button>

          <button
            onClick={() => setFilter("orders")}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs ${
              filter === "orders"
                ? "border-[#c1005b] bg-[#c1005b] text-white"
                : "border-[#e4d3d8] bg-white text-[#666]"
            }`}
          >
            {t("orders")}
            <span
              className={`rounded-full px-2 py-px ${
                filter === "orders" ? "bg-white/20 text-white" : "bg-[#f2f2f2]"
              }`}
            >
              {ordersCount}
            </span>
          </button>

          <button
            onClick={() => setFilter("promos")}
            className={`rounded-full border px-4 py-2 text-xs ${
              filter === "promos"
                ? "border-[#c1005b] bg-[#c1005b] text-white"
                : "border-[#e4d3d8] bg-white text-[#666]"
            }`}
          >
            {t("promos")}
            {filter === "promos" && (
              <span className="ml-2 rounded-full bg-white/20 px-2 py-px">
                {promosCount}
              </span>
            )}
          </button>
        </div>

        {/* Notification List */}
        <div className="space-y-4">
          {filteredNotifications.length === 0 ? (
            <div className="rounded-xl border border-[#ededed] bg-white p-8 text-center text-[#666]">
              {t("noNotifications")}
            </div>
          ) : (
            filteredNotifications.map((notification) => {
              const Icon = getIconByType(notification.type);
              const isUnread = !notification.isRead;

              return (
                <div
                  key={notification._id}
                  className="relative flex gap-4 rounded-xl border border-[#ededed] bg-white p-5 cursor-pointer transition-shadow hover:shadow-md"
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
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                      isUnread ? "bg-[#fff0f5]" : "bg-[#f3f3f3]"
                    }`}
                  >
                    <Icon
                      size={20}
                      className={isUnread ? "text-[#c1005b]" : "text-[#666]"}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <h3 className="text-[20px] font-semibold text-[#222]">
                        {notification.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#888]">
                          {formatRelativeTime(notification.createdAt, t)}
                        </span>
                        {isUnread && (
                          <span className="h-2 w-2 rounded-full bg-[#c1005b]" />
                        )}
                      </div>
                    </div>

                    <p className="mt-1 text-sm leading-6 text-[#666]">
                      {notification.message}
                    </p>

                    {/* Type badge */}
                    <div className="mt-3">
                      <span className="rounded bg-[#fff0f5] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#c1005b]">
                        {notification.type === "ORDER"
                          ? t("order")
                          : notification.type === "PROMO"
                            ? t("promo")
                            : notification.type === "SECURITY"
                              ? t("security")
                              : t("delivered")}
                      </span>
                    </div>

                    {/* Conditional actions based on type */}
                    {notification.type === "ORDER" &&
                      notification.data?.orderId && (
                        <button
                          className="mt-4 rounded-md bg-[#c1005b] px-5 py-2 text-sm font-medium text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: navigate to order tracking page
                            console.log(
                              "Track order:",
                              notification.data.orderId,
                            );
                          }}
                        >
                          {t("trackOrder")}
                        </button>
                      )}

                    {notification.type === "DELIVERED" && (
                      <div className="mt-4 flex gap-6">
                        <button
                          className="text-sm font-medium text-[#c1005b]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t("rateOrder")}
                        </button>
                        <button
                          className="text-sm font-medium text-[#c1005b]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t("orderAgain")}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Chevron for unread items */}
                  {isUnread && (
                    <div className="flex items-center">
                      <ChevronRight size={18} className="text-[#b5b5b5]" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
