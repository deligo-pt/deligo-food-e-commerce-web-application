"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

/**
 * One row of `GET /points/my-history` — the last 18 months, newest first.
 *
 * `type` is typed loosely on purpose: rows from before the points rewrite carry
 * legacy names (`EARN`, `REDEEM`, `REFERRAL_BONUS`, `REFUND`, `ADJUSTMENT`,
 * `OTHER`), and anything unknown is shown with a neutral label.
 */
export interface PointsHistoryRow {
  _id: string;
  type: string;
  /** Signed: credits are positive, `Redeem` and `Expired` negative. */
  points: number;
  /** When this credit expires; `null` on debits and old rows. */
  expireDate: string | null;
  isExpired: boolean;
  isPaid?: boolean;
  createdAt: string;
}

interface HistoryPage {
  rows: PointsHistoryRow[];
  page: number;
  totalPage: number;
  total: number;
}

const HISTORY_PAGE_SIZE = 20;

export const pointsKeys = {
  history: ["points", "my-history"] as const,
};

export function usePointsHistory(options?: { enabled?: boolean }) {
  return useInfiniteQuery({
    queryKey: pointsKeys.history,
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }): Promise<HistoryPage> => {
      const res = await apiClient.get("/points/my-history", {
        params: { page: pageParam, limit: HISTORY_PAGE_SIZE },
        signal,
      });
      const meta = res.data?.meta ?? {};
      return {
        rows: (res.data?.data ?? []) as PointsHistoryRow[],
        page: meta.page ?? pageParam,
        totalPage: meta.totalPage ?? 0,
        total: meta.total ?? 0,
      };
    },
    // `undefined` ends the sequence, so Load more disappears on the last page.
    getNextPageParam: (last) =>
      last.page < last.totalPage ? last.page + 1 : undefined,
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: true,
  });
}

/** How a history row is labelled and coloured. */
export type PointsRowKind =
  | "order"
  | "welcome"
  | "referral"
  | "adjustment"
  | "redeem"
  | "expired"
  | "other";

const KIND_BY_TYPE: Record<string, PointsRowKind> = {
  ORDER: "order",
  EARN: "order",
  WELCOME: "welcome",
  REFERRAL: "referral",
  REFERRAL_BONUS: "referral",
  ADJUSTMENT: "adjustment",
  REFUND: "adjustment",
  REDEEM: "redeem",
  EXPIRED: "expired",
};

export function pointsRowKind(type: string | null | undefined): PointsRowKind {
  return KIND_BY_TYPE[(type ?? "").toUpperCase()] ?? "other";
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The "expiring soon" hint: live credits whose `expireDate` falls in the next
 * `days` days. The API has no per-lot remainder — part of a lot may already
 * have been spent — so the total is an upper bound, worded "up to".
 */
export function expiringSoon(
  rows: PointsHistoryRow[],
  now: number,
  days = 30,
): { points: number; by: string } | null {
  let points = 0;
  let by: string | null = null;
  for (const row of rows) {
    if (row.isExpired || row.points <= 0 || !row.expireDate) continue;
    const at = new Date(row.expireDate).getTime();
    if (Number.isNaN(at) || at < now || at > now + days * DAY_MS) continue;
    points += row.points;
    // The latest expiry in the window: "up to N points expire by <date>".
    if (!by || at > new Date(by).getTime()) by = row.expireDate;
  }
  return points > 0 && by ? { points, by } : null;
}
