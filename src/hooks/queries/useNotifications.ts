"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

export const notificationKeys = {
  unreadCount: ["notifications", "unread-count"] as const,
};

/**
 * Unread-notification count for the Navbar badge.
 *
 * Phase 2: replaces the old 5s `setInterval` that ran on *every page*. React
 * Query polls at 60s and — because `refetchIntervalInBackground` defaults to
 * false — automatically **pauses while the tab is hidden** (0 idle-tab
 * requests). Real-time updates still arrive via FCM and the
 * `notificationsUpdated` event (which invalidates this query).
 *
 * NOTE: still pulls `limit:100` and counts client-side; swap to a dedicated
 * `GET /notifications/unread-count` endpoint when the backend adds it.
 */
export function useUnreadNotificationCount(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: async ({ signal }) => {
      const res = await apiClient.get("/notifications/my-notifications", {
        params: { limit: 100 },
        signal,
      });
      const list = (res.data?.data ?? []) as Array<{ isRead?: boolean }>;
      return list.filter((n) => !n.isRead).length;
    },
    enabled: options?.enabled ?? true,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 20_000,
  });
}

/** Invalidate the unread count so the badge refreshes (e.g. after read/mark-all). */
export function useInvalidateUnreadCount() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount });
}
