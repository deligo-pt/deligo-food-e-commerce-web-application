"use client";

import { useRouter } from "next/navigation";
import { Settings, User } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuthed } from "@/hooks/useAuthed";
import { openSupportChat } from "@/stores/supportChatStore";
import HelpRow from "./HelpRow";
import HelpAccordion from "./HelpAccordion";
import { Button } from "@/components/ui/button";

/**
 * "Account & Profile" — the four common questions, the two screens that answer
 * the rest, and a way through to a human.
 *
 * ## 🔴 The answers are the mobile app's, verbatim, and three of them are wrong here
 *
 * Copy parity with the app was asked for explicitly after Phase 9 had diverged
 * from it. Recorded so nobody has to rediscover it:
 *
 * - *"Reset your password from the Login screen"* — **this app has no
 *   passwords.** `LoginPage` is email/mobile + a one-time code (plus Google);
 *   the word "password" does not appear in it. There is no Forgot Password
 *   control to click.
 * - *"You cannot change your registered email address"* — **you can.**
 *   `editProfileFormPage` sends an OTP via `PATCH /profile/send-otp` and
 *   commits with `PATCH /profile/update-email-or-contact-number`.
 * - *"Go to Settings > Delete Account"* — deletion is reached from the **site
 *   footer**, not Settings, and it is a request form; `/delete-account`'s
 *   submit handler is also a `setTimeout` stub that calls no API at all.
 *
 * The fourth — update your name and phone in Edit Profile — is true.
 *
 * Fixing this means either the clients converging on one auth model (Q21) or
 * the app's FAQ being corrected. Changing it back is a dictionary edit: the
 * four answers are `faqPasswordAnswer`, `faqChangeEmailAnswer`,
 * `faqDeleteAccountAnswer`, `faqUpdateProfileAnswer`.
 */
export default function AccountHelpPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const authed = useAuthed();

  const questions = [
    {
      question: t("faqPasswordQuestion"),
      answer: t("faqPasswordAnswer"),
    },
    {
      question: t("faqChangeEmailQuestion"),
      answer: t("faqChangeEmailAnswer"),
    },
    {
      question: t("faqDeleteAccountQuestion"),
      answer: t("faqDeleteAccountAnswer"),
    },
    {
      question: t("faqUpdateProfileQuestion"),
      answer: t("faqUpdateProfileAnswer"),
    },
  ];

  const contactSupport = () => {
    if (!authed) {
      router.push("/login");
      return;
    }
    openSupportChat({ category: "TECHNICAL" });
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-gray-900 transition-colors duration-200 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        <h1 className="text-2xl font-bold text-foreground dark:text-neutral-50">
          {t("accountProfile")}
        </h1>

        <p className="mt-2 text-sm text-muted-foreground dark:text-neutral-400">
          {t("accountHelpSubtitle")}
        </p>

        <div className="mt-6">
          <HelpAccordion items={questions} showIcon={false} />
        </div>

        <section className="mt-8">
          <h2 className="mb-3 text-xl font-bold text-foreground dark:text-neutral-50">
            {t("manageAccount")}
          </h2>

          <div className="space-y-3">
            <HelpRow
              icon={Settings}
              title={t("goToSettings")}
              description={t("goToSettingsDescription")}
              href="/account-settings"
            />
            <HelpRow
              icon={User}
              title={t("editProfile")}
              description={t("editProfileDescription")}
              href="/edit-profile"
            />
          </div>
        </section>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground dark:text-neutral-400">
            {t("stillNeedHelp")}
          </p>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={contactSupport}
            className="mt-1 h-auto cursor-pointer px-0 font-bold"
          >
            {t("contactSupport")}
          </Button>
        </div>
      </div>
    </div>
  );
}
