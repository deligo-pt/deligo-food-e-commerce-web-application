"use client";

import { forwardRef, useState } from "react";
import { KeyRound, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import { getAccessToken } from "@/lib/authCookies";
import { useTranslation } from "@/hooks/useTranslation";
import { useInvalidateProfile, useProfile } from "@/hooks/queries/useProfile";
import { normalizePortugueseNumber } from "@/lib/phone";
import {
  MOBILE_OTP_LENGTH,
  VERIFIED_HOLD_MS,
  VERIFIED_HOLD_REDUCED_MS,
} from "@/lib/otp";
import { phoneState, type PhoneProfile } from "@/lib/verifiedPhone";
import PhoneNumberField from "@/components/shared/PhoneNumberField";
import OtpInput from "@/components/auth/OtpInput";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Whether this customer may order: a number on the profile, verified
 * (`lib/verifiedPhone.ts`). `loaded` is false until `/profile` answers; the
 * pages do not block on a profile they have not seen yet, and their submit
 * handlers check again.
 */
export function useVerifiedPhone() {
  const authed = typeof window !== "undefined" && !!getAccessToken();
  const { data, isSuccess } = useProfile<PhoneProfile>({ enabled: authed });
  const state = phoneState(data);
  return { loaded: isSuccess && !!data, verified: state === "verified", state };
}

/**
 * "Add a verified mobile number to place your order", on the checkout and
 * payment pages, with the number and its SMS code right here — the same two
 * calls as Edit Profile (`/profile/send-otp`, then
 * `/profile/update-email-or-contact-number`). The customer keeps their cart
 * and their place; once the code is accepted the profile is refetched and the
 * card goes away by itself.
 *
 * A number already on the profile but not verified is filled in, and its code
 * can be sent as it is (Edit Profile only sends one for a *changed* number).
 *
 * Renders nothing while the profile loads and once the number is verified.
 */
const VerifiedPhoneCard = forwardRef<HTMLElement, { className?: string }>(
  function VerifiedPhoneCard({ className }, ref) {
    const { t } = useTranslation();
    const authed = typeof window !== "undefined" && !!getAccessToken();
    const { data: profile, isSuccess } = useProfile<PhoneProfile>({
      enabled: authed,
    });
    const invalidateProfile = useInvalidateProfile();
    const state = phoneState(profile);

    const [number, setNumber] = useState<string | null>(null);
    const [otp, setOtp] = useState("");
    const [sentTo, setSentTo] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [verified, setVerified] = useState(false);

    // While the code animation plays the profile may already say "verified";
    // keep the card up until it has finished.
    if (!isSuccess || !profile || (state === "verified" && !verified))
      return null;

    const value = number ?? profile.contactNumber ?? "";

    const sendCode = async () => {
      const contactNumber = normalizePortugueseNumber(value);
      if (!contactNumber) {
        toast.error(t("invalidPortugueseNumber"));
        return;
      }
      setSending(true);
      try {
        await apiClient.patch("/profile/send-otp", { contactNumber });
        setSentTo(contactNumber);
        setOtp("");
        toast.success(t("phoneCodeSent"));
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Failed to send OTP"));
      } finally {
        setSending(false);
      }
    };

    const verifyCode = async () => {
      if (otp.length < MOBILE_OTP_LENGTH) {
        toast.error(t("pleaseEnterOtp"));
        return;
      }
      setVerifying(true);
      try {
        await apiClient.patch("/profile/update-email-or-contact-number", {
          otp,
          type: "mobile",
        });
        setVerified(true);
        toast.success(t("phoneVerifiedCanOrder"));
        const reduced =
          typeof window !== "undefined" &&
          window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        await new Promise((r) =>
          setTimeout(r, reduced ? VERIFIED_HOLD_REDUCED_MS : VERIFIED_HOLD_MS),
        );
        await invalidateProfile();
        setVerified(false);
      } catch (err) {
        toast.error(getApiErrorMessage(err, "Failed to verify OTP"));
      } finally {
        setVerifying(false);
      }
    };

    return (
      <section
        ref={ref}
        tabIndex={-1}
        aria-labelledby="verified-phone-title"
        className={cn(
          // `contain: inline-size`: the card takes the column's width and never
          // sets it. Its phone field has a fixed natural width, which used to
          // widen the one-column phone layout by 41 px, cart list included.
          "rounded-2xl border border-primary/30 bg-primary/5 p-4 outline-none [contain:inline-size] dark:border-pink-500/30 dark:bg-pink-950/30",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <Smartphone
            aria-hidden
            className="mt-0.5 h-5 w-5 shrink-0 text-primary dark:text-pink-400"
          />
          <div className="min-w-0">
            <p
              id="verified-phone-title"
              className="font-semibold text-foreground"
            >
              {t("phoneRequiredTitle")}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t(
                state === "unverified"
                  ? "phoneUnverifiedBody"
                  : "phoneRequiredBody",
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <PhoneNumberField
            value={value}
            onChange={(v) => {
              setNumber(v);
              // A different number needs its own code.
              if (sentTo && normalizePortugueseNumber(v) !== sentTo) {
                setSentTo(null);
                setOtp("");
              }
            }}
            disabled={verifying || verified}
          />
          {!sentTo && (
            <Button
              type="button"
              onClick={sendCode}
              disabled={sending || !value.trim()}
              className="w-full rounded-xl"
            >
              {sending ? t("sending") : t("sendOtp")}
            </Button>
          )}
        </div>

        {sentTo && (
          <div
            className="mt-3 flex flex-col gap-2"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void verifyCode();
              }
            }}
          >
            <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-card px-2 py-3 sm:justify-start sm:px-3">
              <KeyRound
                aria-hidden
                size={18}
                // No room for it beside six tiles on a phone.
                className={cn(
                  "hidden shrink-0 text-muted-foreground sm:block",
                  verified && "opacity-0",
                )}
              />
              <div className="min-w-0 flex-1 [container-type:inline-size]">
                <OtpInput
                  length={MOBILE_OTP_LENGTH}
                  fit
                  value={otp}
                  onChange={setOtp}
                  label={t("otp")}
                  disabled={verifying}
                  verified={verified}
                />
              </div>
            </div>
            {!verified && (
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={sending}
                  className="focus-ring rounded-sm text-sm font-semibold text-primary-hover hover:underline disabled:opacity-50 dark:text-pink-400"
                >
                  {sending ? t("sending") : t("resendOtp")}
                </button>
                <Button
                  type="button"
                  onClick={verifyCode}
                  disabled={verifying || otp.length < MOBILE_OTP_LENGTH}
                  className="rounded-xl bg-green-600 px-6 text-white hover:bg-green-700"
                >
                  {verifying ? t("verifying") : t("verify")}
                </Button>
              </div>
            )}
          </div>
        )}
      </section>
    );
  },
);

export default VerifiedPhoneCard;
