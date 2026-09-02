"use client";

import Link from "next/link";
import { ChevronRight, ShoppingBag } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuthed } from "@/hooks/useAuthed";
import { useStore } from "@/stores/translationStore";
import { formatOrderPrice } from "@/lib/currency";
import { formatOrderDate } from "@/lib/dateFormat";
import { buildTopicPrefill } from "@/lib/support";
import { useOrders } from "@/hooks/queries/useOrders";
import { openSupportChat } from "@/stores/supportChatStore";
import ReportIssueSkeleton from "./ReportIssueSkeleton";

/** The slice of an order this list draws. */
interface ReportableOrder {
  _id?: string | null;
  orderId?: string | null;
  createdAt?: string | null;
  totalItems?: number | null;
  payoutSummary?: { grandTotal?: number | null } | null;
}

/**
 * "Report an Issue" — pick the order, then talk to support about it.
 *
 * The screen behind Help Center → Order Issues. Its whole job is to attach a
 * conversation to a specific order, which is the one thing a support agent
 * cannot guess.
 */
export default function ReportIssuePage() {
  const { t } = useTranslation();
  const lang = useStore((state) => state.lang);

  const authed = useAuthed();

  // The same cached query the orders page uses, not a second request: arriving
  // here from `/orders` costs nothing, and the 30s poll it already runs for
  // in-flight orders keeps this list current for free.
  const { data: orders, isPending } = useOrders<ReportableOrder>({
    enabled: authed,
  });

  const openChatFor = (order: ReportableOrder) => {
    openSupportChat({
      category: "ORDER_ISSUE",
      // The Mongo `_id`. `ORD-…` is rejected with
      // "referenceOrderId has an invalid format" — the one route in this app
      // that wants the `_id` rather than the human-readable id.
      referenceOrderId: order._id ?? null,
      // …and the human-readable one goes in the text, because `referenceOrderId`
      // is honoured only on a ticket that has never been linked. On every
      // conversation after the first, this sentence is the only thing that tells
      // support which order is meant.
      prefill: buildTopicPrefill(
        t("supportPrefillOrderIssue"),
        `#${order.orderId ?? ""}`,
      ),
    });
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-gray-900 transition-colors duration-200 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        <h1 className="text-2xl font-bold text-foreground dark:text-neutral-50">
          {t("reportAnIssue")}
        </h1>

        <p className="mt-2 text-sm text-muted-foreground dark:text-neutral-400">
          {t("selectOrderToReport")}
        </p>

        <div className="mt-6">
          {!authed ? (
            <Empty
              message={t("selectOrderToReport")}
              actionHref="/login"
              actionLabel={t("login")}
            />
          ) : isPending ? (
            <ReportIssueSkeleton />
          ) : !orders?.length ? (
            <Empty
              message={t("noOrdersToReport")}
              actionHref="/vendors"
              actionLabel={t("browseStores")}
            />
          ) : (
            /* Phase 12. `<ReportIssueSkeleton />` above is swapped for this in
               one frame; `motion-fade` is that swap over 300ms. */
            <ul className="motion-fade space-y-3">
              {orders.map((order) => (
                <li key={order._id ?? order.orderId}>
                  <button
                    type="button"
                    onClick={() => openChatFor(order)}
                    className="focus-ring group flex w-full cursor-pointer items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-md dark:hover:border-pink-500/30 dark:hover:shadow-none"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-bold text-foreground dark:text-neutral-50">
                        {t("order")}{" "}
                        <span className="font-medium text-muted-foreground dark:text-neutral-400">
                          (#{order.orderId})
                        </span>
                      </span>

                      <span className="mt-1 block text-sm text-muted-foreground dark:text-neutral-400">
                        {formatOrderDate(order.createdAt, lang)} •{" "}
                        {order.totalItems ?? 0} {t("items")}
                      </span>

                      {/* `payoutSummary.grandTotal`, exactly as the backend
                          returns it — see `formatOrderPrice`. */}
                      <span className="mt-1 block text-base font-bold text-primary dark:text-pink-400">
                        {formatOrderPrice(order.payoutSummary?.grandTotal)}
                      </span>
                    </span>

                    <ChevronRight
                      aria-hidden
                      className="h-5 w-5 shrink-0 text-gray-300 transition-colors group-hover:text-primary dark:text-neutral-600 dark:group-hover:text-pink-400"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Empty({
  message,
  actionHref,
  actionLabel,
}: {
  message: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-12 text-center">
      <ShoppingBag
        aria-hidden
        className="h-10 w-10 text-primary dark:text-pink-400"
      />
      <p className="mt-3 text-sm font-semibold text-foreground dark:text-neutral-50">
        {message}
      </p>
      <Link
        href={actionHref}
        className="mt-4 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover dark:bg-pink-600 dark:hover:bg-pink-700"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
