"use client";

import { useState } from "react";
import { Clock, CreditCard, Headphones, PackageSearch, RefreshCw, XCircle } from "lucide-react";
import PaymentStateCard from "@/components/payment/PaymentStateCard";
import ContactSupportDialog from "@/components/support/ContactSupportDialog";
import SupportChatDialogLazy from "@/components/support/SupportChatDialogLazy";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { useThemeStore } from "@/stores/themeStore";

/**
 * `/_design/payment-result`: "Contact Support" on the payment result card, for
 * sign-off (19 Oct 2026).
 *
 * A real failed payment is hard to come by on demand, so this page draws the
 * three cards that carry the button — failed, not finished, still confirming —
 * with the real `PaymentStateCard`, the real `ContactSupportDialog` and the
 * real chat panel. Language and theme switch here, as there is no navbar.
 *
 * Nothing here pays or checks a payment. Live Chat is the real chat, though:
 * signed in, a message sent from it reaches the support team.
 */

const REFERENCE = "6ad4a13d5b358d1583932228";

type State = "failed" | "notFinished" | "stillConfirming";

export default function PaymentResultPreviewPage() {
  const { t, i18n } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [state, setState] = useState<State>("failed");
  const [supportOpen, setSupportOpen] = useState(false);

  const noop = () => {};
  const contactSupport = { label: t("contactSupport"), onClick: () => setSupportOpen(true), icon: Headphones };
  const anotherWay = { label: t("chooseAnotherWayToPay"), onClick: noop, icon: CreditCard };
  const reference = { reference: REFERENCE, referenceLabel: t("referenceLabel") };

  const STATES: { id: State; label: string }[] = [
    { id: "failed", label: "Failed" },
    { id: "notFinished", label: "Not finished" },
    { id: "stillConfirming", label: "Still confirming" },
  ];

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <header className="space-y-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Payment result: Contact Support</h1>
          <p className="text-sm text-muted-foreground">
            Preview only. Press Contact Support on the card. The other buttons do nothing here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATES.map((s) => (
            <Button
              key={s.id}
              type="button"
              size="sm"
              variant={state === s.id ? "default" : "outline"}
              onClick={() => setState(s.id)}
            >
              {s.label}
            </Button>
          ))}
          <span className="mx-1 w-px self-stretch bg-border" aria-hidden />
          {(["en", "pt"] as const).map((lang) => (
            <Button
              key={lang}
              type="button"
              size="sm"
              variant={i18n.language === lang ? "default" : "outline"}
              onClick={() => i18n.changeLanguage(lang)}
            >
              {lang.toUpperCase()}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </Button>
        </div>
      </header>

      {state === "failed" && (
        <PaymentStateCard
          tone="error"
          icon={XCircle}
          title={t("paymentFailedTitle")}
          body={t("paymentFailedBody")}
          primary={{ label: t("tryAgain"), onClick: noop, icon: RefreshCw }}
          secondary={[anotherWay, contactSupport]}
          {...reference}
        />
      )}
      {state === "notFinished" && (
        <PaymentStateCard
          tone="pending"
          icon={Clock}
          title={t("paymentNotFinishedTitle")}
          body={t("paymentNotFinishedBody")}
          primary={{ label: t("continuePayment"), onClick: noop }}
          secondary={[anotherWay, contactSupport]}
          {...reference}
        />
      )}
      {state === "stillConfirming" && (
        <PaymentStateCard
          tone="pending"
          icon={Clock}
          title={t("stillConfirmingTitle")}
          body={t("stillConfirming")}
          primary={{ label: t("checkAgain"), onClick: noop, icon: RefreshCw }}
          secondary={[{ label: t("myOrders"), onClick: noop, icon: PackageSearch }, contactSupport]}
          {...reference}
        />
      )}

      {/* The same props `PaymentResult` passes. */}
      <ContactSupportDialog
        open={supportOpen}
        onOpenChange={setSupportOpen}
        category="PAYMENT"
        topic={t("supportPaymentPrefill")}
        reference={REFERENCE}
      />
      <SupportChatDialogLazy />
    </main>
  );
}
