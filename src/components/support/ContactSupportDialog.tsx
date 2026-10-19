"use client";

import { Headphones, Mail, MessageSquare, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuthed } from "@/hooks/useAuthed";
import { toTelHref } from "@/lib/phone";
import {
  buildTopicPrefill,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  type SupportCategory,
} from "@/lib/support";
import { openSupportChat } from "@/stores/supportChatStore";
import HelpRow from "@/components/help/HelpRow";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ContactSupportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sent with the chat — best-effort, see `SupportChatIntent.category`. */
  category?: SupportCategory;
  /**
   * The first words of the chat message, e.g. "Payment problem". With
   * `reference` it becomes "Payment problem: Reference 6ad4…", so the agent
   * knows which payment without asking.
   */
  topic?: string | null;
  /** The checkout reference the customer sees on the card. */
  reference?: string | null;
}

/**
 * The three ways to reach DeliGo — live chat, email, phone — in one dialog.
 *
 * The rows are the Help Center's `HelpRow`s (pink chat, blue mail, green
 * phone), so the two places read as the same feature.
 *
 * Live chat opens the support panel through `supportChatStore`; the panel must
 * be mounted on the page (the `(main)` layout and the two RedUniq return pages
 * do). A guest is sent to log in first, as on the Help Center: the chat API
 * answers 401 to guests, better asked now than mid-sentence.
 */
export default function ContactSupportDialog({
  open,
  onOpenChange,
  category = "GENERAL",
  topic,
  reference,
}: ContactSupportDialogProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const authed = useAuthed();

  const startLiveChat = () => {
    onOpenChange(false);
    if (!authed) {
      router.push("/login");
      return;
    }
    openSupportChat({
      category,
      prefill: buildTopicPrefill(topic, reference ? `${t("referenceLabel")} ${reference}` : null),
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-primary/5 text-primary dark:bg-pink-950/40 dark:text-pink-400">
            <Headphones />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("contactSupportTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("contactSupportDescription")}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <HelpRow
            icon={MessageSquare}
            title={t("liveChat")}
            description={t("realTimeSupport")}
            onClick={startLiveChat}
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
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{t("close")}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
