"use client";

import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Clock,
  CreditCard,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuthed } from "@/hooks/useAuthed";
import { buildTopicPrefill } from "@/lib/support";
import { PAYMENT_HELP_TOPICS } from "@/lib/supportTopics";
import { openSupportChat } from "@/stores/supportChatStore";
import HelpRow from "./HelpRow";

/** Icons live here, not in the topic list, which stays free of React. */
const TOPIC_ICONS: Record<string, LucideIcon> = {
  REFUND_STATUS: Clock,
  UNRECOGNIZED_CHARGE: AlertCircle,
  PAYMENT_METHODS: CreditCard,
  REQUEST_INVOICE: FileText,
};

/**
 * "Payments & Refunds" — pick what it is about, then talk to support.
 *
 * Four rows, all of which open the chat. That is what the app does, including
 * for the two that have real screens in this product (`/payment-methods`, and
 * the client-side invoice builder) — see Q18 before changing it.
 *
 * Each row prefills `Payment Question: <topic>`, which is the one prefill
 * format a screenshot confirms (`2.jpeg`). It matters more than `category`:
 * the ticket is only ever classified once, so on every conversation after the
 * first this sentence is the only thing that says which topic was picked.
 */
export default function PaymentsHelpPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const authed = useAuthed();

  const openChatFor = (labelKey: string) => {
    // `POST /support/send-message` answers 401 for a guest and the response
    // interceptor turns that into a redirect — better to ask now than halfway
    // through a sentence they have already typed.
    if (!authed) {
      router.push("/login");
      return;
    }

    openSupportChat({
      category: "PAYMENT",
      prefill: buildTopicPrefill(t("supportPrefillPayment"), t(labelKey)),
    });
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-gray-900 transition-colors duration-200 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        <h1 className="text-2xl font-bold text-foreground dark:text-neutral-50">
          {t("paymentsRefunds")}
        </h1>

        <p className="mt-2 text-sm text-muted-foreground dark:text-neutral-400">
          {t("paymentsHelpSubtitle")}
        </p>

        <div className="mt-6 space-y-3">
          {PAYMENT_HELP_TOPICS.map((topic) => (
            <HelpRow
              key={topic.id}
              icon={TOPIC_ICONS[topic.id] ?? CreditCard}
              title={t(topic.labelKey)}
              onClick={() => openChatFor(topic.labelKey)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
