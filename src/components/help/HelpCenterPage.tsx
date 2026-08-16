"use client";

import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Mail,
  Phone,
  HelpCircle,
  ShoppingBag,
  CreditCard,
  User,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useProfile } from "@/hooks/queries/useProfile";
import { useActiveSupportTicket } from "@/hooks/queries/useSupport";
import { getUnreadCount } from "@/lib/support";
import { useAuthed } from "@/hooks/useAuthed";
import { toTelHref } from "@/lib/phone";
import { openSupportChat } from "@/stores/supportChatStore";
import HelpRow from "./HelpRow";
import HelpAccordion from "./HelpAccordion";

/**
 * The Help Center, rebuilt to match the mobile app.
 *
 * Three stacked sections of rows — Contact Support, Browse Topics, Popular
 * Questions — and nothing else. What went, and why:
 *
 * - **The search box.** The app has none, and this one searched a corpus of
 *   four categories and three questions, so almost every honest query returned
 *   nothing. It was reported as "never returns any results" because that was
 *   very nearly true.
 * - **The "Need immediate help?" banner.** Not in the app, and its only control
 *   duplicated the Live Chat row directly above it.
 * - **The card grids.** The app draws every one of these as a row with a tinted
 *   icon circle and a chevron; `HelpRow` is that row.
 */

/** Frontend constants, as in the app — `GET /globalSettings` is 403 for customers. */
const SUPPORT_EMAIL = "contact@deligo.pt";
const SUPPORT_PHONE = "+351 920 136 680";

export default function HelpCenterPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const authed = useAuthed();

  // The unread badge on the Live Chat row. Both queries are shared and cached —
  // the Navbar already holds the profile, and the chat panel reads the same
  // ticket entry — so opening this page costs one `GET /support/tickets`.
  //
  // It is correct and, today, always zero: nothing has ever replied on the test
  // account, so `unreadCount[myUserId]` has had nothing to count. Shipping it
  // now means the day support answers, the customer is told.
  const { data: profile } = useProfile<{ userId?: string }>({ enabled: authed });
  const { data: ticket } = useActiveSupportTicket({ enabled: authed });
  const unread = getUnreadCount(ticket, profile?.userId);

  const faqs = [
    { question: t("faqTrackOrderQuestion"), answer: t("faqTrackOrderAnswer") },
    {
      question: t("faqDeliveryChargesQuestion"),
      answer: t("faqDeliveryChargesAnswer"),
    },
    { question: t("faqVoucherQuestion"), answer: t("faqVoucherAnswer") },
  ];

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-gray-900 transition-colors duration-200 dark:bg-neutral-950 dark:text-neutral-100">
      {/* Narrower than the app's usual `max-w-5xl` list container: this page is
          a single column of rows rather than full-width cards, and stretching a
          row to 64rem leaves its chevron stranded from its title. */}
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        <h1 className="text-2xl font-bold text-[#191c1d] dark:text-neutral-50 sm:text-3xl">
          {t("helpCenter")}
        </h1>

        <Section title={t("contactSupport")}>
          <HelpRow
            icon={MessageSquare}
            title={t("liveChat")}
            description={t("realTimeSupport")}
            badge={unread}
            onClick={() => {
              // A guest can open the panel but not send: `POST
              // /support/send-message` answers 401 and the response interceptor
              // turns that into a redirect. Better to ask for the login now
              // than halfway through a sentence they have already typed.
              if (!authed) {
                router.push("/login");
                return;
              }
              openSupportChat({ category: "GENERAL" });
            }}
          />
          <HelpRow
            icon={Mail}
            tint="blue"
            title={t("emailUs")}
            description={SUPPORT_EMAIL}
            href={`mailto:${SUPPORT_EMAIL}`}
          />
          <HelpRow
            icon={Phone}
            tint="green"
            title={t("callUs")}
            description={SUPPORT_PHONE}
            href={toTelHref(SUPPORT_PHONE)}
          />
        </Section>

        <Section title={t("browseTopics")}>
          <HelpRow
            icon={HelpCircle}
            title={t("generalFaqs")}
            description={t("generalFaqsDescription")}
            href="/faqs"
          />
          <HelpRow
            icon={ShoppingBag}
            title={t("orderIssues")}
            description={t("orderIssuesDescription")}
            href="/help-center/order-issues"
          />
          <HelpRow
            icon={CreditCard}
            title={t("paymentsRefunds")}
            description={t("paymentsRefundsDescription")}
            href="/help-center/payments"
          />
          <HelpRow
            icon={User}
            title={t("accountProfile")}
            description={t("accountProfileDescription")}
            href="/help-center/account"
          />
        </Section>

        <Section title={t("popularQuestions")}>
          <HelpAccordion items={faqs} showIcon />
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-bold text-[#191c1d] dark:text-neutral-50">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
