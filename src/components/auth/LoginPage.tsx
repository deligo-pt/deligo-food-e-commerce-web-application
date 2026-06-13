"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  CircleX,
  Check,
  Globe,
  Gift,
  KeyRound,
  LoaderCircle,
  Mail,
  Phone,
} from "lucide-react";
import Image from "next/image";
import { COUNTRY_OPTIONS, type CountryOption } from "../../data/countryCodes";
import { useLoginFlow } from "../../hooks/useLoginFlow";
import { useTranslation } from "@/hooks/useTranslation";

function CountryFlag({
  countryCode,
  name,
}: {
  countryCode: string;
  name: string;
}) {
  return (
    <Image
      src={`https://flagcdn.com/w40/${countryCode}.png`}
      alt={`${name} flag`}
      width={20}
      height={20}
      className="h-5 w-5 object-contain "
    />
  );
}

function ClearSessionModal({
  open,
  onOpenChange,
  onRemove,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: () => void;
  t: (key: string) => string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-2xl font-bold text-[#191c1d]">
          {t("deviceLimitExceeded")}
        </h3>
        <p className="mt-2 text-[15px] text-[#5a4044]">
          {t("deviceLimitExceededDescription")}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full border border-[#e3bdc3] px-5 py-2 text-[15px] font-medium text-[#5a4044] hover:bg-gray-50"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={() => {
              onRemove();
              onOpenChange(false);
            }}
            className="rounded-full bg-[#b0004a] px-5 py-2 text-[15px] font-medium text-white shadow-sm hover:bg-[#8a0038]"
          >
            {t("removeSession")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { t } = useTranslation();
  const {
    mode,
    step,
    showReferral,
    showLanguageModal,
    showCountryMenu,
    language,
    selectedCountry,
    email,
    mobileNumber,
    referralCode,
    otp,
    isSendingOtp,
    isVerifyingOtp,
    isResendingOtp,
    errorMessage,
    successMessage,
    languageLabel,
    loginHint,
    loginIdentifier,
    showDeviceLimitModal,
    setShowReferral,
    setShowLanguageModal,
    setShowCountryMenu,
    setLanguage,
    setSelectedCountry,
    setEmail,
    setMobileNumber,
    setReferralCode,
    setOtp,
    changeMode,
    sendOtp,
    verifyOtp,
    resendOtp,
    backToCredentials,
    clearSessionAndRetry,
  } = useLoginFlow();

  return (
    <main className="min-h-screen bg-[#f7f2f5] px-4 py-8 text-[#191c1d] sm:px-6 lg:px-8 lg:py-10">
      <section className="mx-auto flex w-full max-w-5xl flex-col overflow-hidden rounded-4xl bg-white shadow-[0_18px_70px_rgba(16,24,40,0.12)] lg:min-h-[calc(100vh-5rem)] lg:flex-row">
        {/* Left side - same as before */}
        <div className="flex items-center justify-center bg-[#ef2f7a] px-6 py-12 text-center text-white sm:px-10 lg:min-h-full lg:w-[42%] lg:px-12 lg:py-16">
          <div className="flex w-full max-w-sm flex-col items-center">
            <div className="overflow-hidden rounded-[28px] shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
              <Image
                src="/deligoLogo.png"
                alt="DeliGo logo"
                width={112}
                height={112}
                className="h-20 w-20 object-cover sm:h-24 sm:w-24 lg:h-28 lg:w-28"
                priority
              />
            </div>
            <h1 className="mt-6 text-[40px] font-extrabold tracking-[-0.03em] text-white sm:text-[46px]">
              DeliGo
            </h1>
            <p className="mt-4 text-[15px] leading-6 text-white/90 sm:text-[16px]">
              {t("loginFastReliable")}
            </p>
          </div>
        </div>

        <div className="flex flex-1 items-start px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
          <div className="flex w-full flex-col">
            <div>
              <h2 className="text-[30px] font-extrabold leading-tight tracking-[-0.03em] text-[#242424] sm:text-[34px] lg:text-[38px]">
                {t("welcomeBack")}
              </h2>
              <p className="mt-4 text-[16px] leading-7 text-[#8b8b8b] sm:text-[17px]">
                {t("loginOrCreateAccount")}
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-6 border-b border-[#e3e3e3] sm:mt-10">
              <button
                type="button"
                onClick={() => changeMode("mobile")}
                className="relative pb-4 text-[18px] font-semibold transition-colors sm:text-[20px]"
              >
                <span
                  className={
                    mode === "mobile" ? "text-[#d7357c]" : "text-[#707070]"
                  }
                >
                  {t("mobile")}
                </span>
                <span
                  className={[
                    "absolute -bottom-px left-0 h-0.5 rounded-full transition-all duration-300",
                    mode === "mobile"
                      ? "w-full bg-[#d7357c]"
                      : "w-0 bg-transparent",
                  ].join(" ")}
                />
              </button>

              <button
                type="button"
                onClick={() => changeMode("email")}
                className="relative pb-4 text-[18px] font-semibold transition-colors sm:text-[20px]"
              >
                <span
                  className={
                    mode === "email" ? "text-[#d7357c]" : "text-[#707070]"
                  }
                >
                  {t("email")}
                </span>
                <span
                  className={[
                    "absolute -bottom-px right-0 h-0.5 rounded-full transition-all duration-300",
                    mode === "email"
                      ? "w-full bg-[#d7357c]"
                      : "w-0 bg-transparent",
                  ].join(" ")}
                />
              </button>
            </div>

            <div className="mt-8 space-y-5 sm:mt-10">
              <p className="text-[15px] leading-6 text-[#6e6e6e] sm:text-[16px]">
                {loginHint}
              </p>

              {errorMessage ? (
                <div className="rounded-2xl border border-[#ffd4dc] bg-[#fff4f7] px-4 py-3 text-[14px] font-medium text-[#b81f57]">
                  {errorMessage}
                </div>
              ) : null}

              {successMessage ? (
                <div className="rounded-2xl border border-[#cdeed9] bg-[#f2fbf5] px-4 py-3 text-[14px] font-medium text-[#166534]">
                  {successMessage}
                </div>
              ) : null}

              <div className="relative rounded-2xl border border-[#dcdcdc] bg-white px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.02)] sm:px-5">
                {step === "credentials" ? (
                  mode === "mobile" ? (
                    <div className="flex items-center gap-3 sm:gap-4">
                      <button
                        type="button"
                        onClick={() =>
                          setShowCountryMenu((currentValue) => !currentValue)
                        }
                        className="flex items-center gap-2 pr-3 text-[15px] font-medium text-[#3f3f3f] transition-colors hover:text-[#d7357c] sm:text-[16px]"
                      >
                        <CountryFlag
                          countryCode={selectedCountry.flagCode}
                          name={selectedCountry.name}
                        />
                        <span>{selectedCountry.dialCode}</span>
                        <ChevronDown
                          size={16}
                          strokeWidth={2.6}
                          className="text-[#767676]"
                        />
                      </button>
                      <div className="h-7 w-px bg-[#dedede]" />
                      <div className="flex flex-1 items-center gap-3">
                        <Phone size={18} className="text-[#7d7d7d]" />
                        <input
                          type="tel"
                          inputMode="tel"
                          value={mobileNumber}
                          onChange={(event) =>
                            setMobileNumber(event.target.value)
                          }
                          placeholder={t("mobileNumber")}
                          className="w-full border-0 bg-transparent text-[16px] text-[#5f5f5f] outline-none placeholder:text-[#8c8c8c] sm:text-[17px]"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-1">
                      <Mail size={18} className="text-[#7d7d7d]" />
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder={t("emailAddress")}
                        className="w-full border-0 bg-transparent text-[16px] text-[#5f5f5f] outline-none placeholder:text-[#8c8c8c] sm:text-[17px]"
                      />
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-3 px-1">
                    <KeyRound size={18} className="text-[#7d7d7d]" />
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={otp}
                      onChange={(event) =>
                        setOtp(
                          event.target.value.replace(/\D/g, "").slice(0, 6),
                        )
                      }
                      placeholder={t("enterOtp")}
                      className="w-full border-0 bg-transparent text-[16px] text-[#5f5f5f] outline-none placeholder:text-[#8c8c8c] sm:text-[17px]"
                    />
                  </div>
                )}

                {showCountryMenu && step === "credentials" ? (
                  <div className="absolute left-4 top-[calc(100%-0.25rem)] z-20 mt-3 w-[calc(100%-2rem)] max-w-80 overflow-hidden rounded-3xl border border-[#e7e7e7] bg-white shadow-[0_24px_60px_rgba(16,24,40,0.18)]">
                    <div className="border-b border-[#efefef] px-4 py-3">
                      <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#a0a0a0]">
                        {t("selectCountryCode")}
                      </p>
                      <p className="mt-1 text-[15px] text-[#5d5d5d]">
                        {t("chooseCountryAndDialCode")}
                      </p>
                    </div>
                    <div className="max-h-72 overflow-y-auto p-2">
                      {COUNTRY_OPTIONS.map((country: CountryOption) => (
                        <button
                          key={`${country.name}-${country.dialCode}`}
                          type="button"
                          onClick={() => {
                            setSelectedCountry(country);
                            setShowCountryMenu(false);
                          }}
                          className={[
                            "flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-colors",
                            selectedCountry.dialCode === country.dialCode &&
                            selectedCountry.name === country.name
                              ? "bg-[#fff4f8] text-[#d7357c]"
                              : "text-[#2f2f2f] hover:bg-[#fafafa]",
                          ].join(" ")}
                        >
                          <div className="flex items-center gap-3">
                            <CountryFlag
                              countryCode={country.flagCode}
                              name={country.name}
                            />
                            <div className="flex flex-col">
                              <span className="text-[15px] font-medium">
                                {country.name}
                              </span>
                              <span className="text-[13px] text-[#7d7d7d]">
                                {country.dialCode}
                              </span>
                            </div>
                          </div>
                          {selectedCountry.dialCode === country.dialCode &&
                          selectedCountry.name === country.name ? (
                            <Check size={18} className="text-[#d7357c]" />
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {showReferral ? (
                <div className="rounded-2xl border border-[#dcdcdc] bg-white px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.02)] sm:px-5">
                  <div className="flex items-center gap-3 px-1">
                    <Gift size={18} className="text-[#7d7d7d]" />
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(event) => setReferralCode(event.target.value)}
                      placeholder={t("enterReferralCode")}
                      className="w-full border-0 bg-transparent text-[16px] text-[#5f5f5f] outline-none placeholder:text-[#8c8c8c] sm:text-[17px]"
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end">
                {showReferral ? (
                  <button
                    type="button"
                    onClick={() => setShowReferral(false)}
                    className="inline-flex items-center gap-2 text-[15px] font-medium text-[#6f6f6f] transition-colors hover:text-[#d7357c]"
                  >
                    <CircleX size={18} />
                    {t("removeReferralCode")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowReferral(true)}
                    className="text-[15px] font-medium text-[#d7357c] transition-colors hover:opacity-80"
                  >
                    {t("haveReferralCode")}
                  </button>
                )}
              </div>

              {step === "credentials" ? (
                <button
                  type="button"
                  onClick={() => sendOtp()}
                  disabled={isSendingOtp}
                  className="mt-1 flex h-14 w-full items-center justify-center rounded-4xl bg-linear-to-r from-[#d9357b] to-[#ff65b4] text-[18px] font-bold text-white shadow-[0_12px_28px_rgba(217,53,123,0.32)] transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 sm:text-[19px]"
                >
                  {isSendingOtp ? (
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle size={18} className="animate-spin" />
                      {t("sendingOtp")}
                    </span>
                  ) : (
                    t("sendOtp")
                  )}
                </button>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={backToCredentials}
                    className="mt-1 inline-flex h-14 items-center justify-center gap-2 rounded-4xl border border-[#e1e1e1] bg-white text-[16px] font-semibold text-[#3f3f3f] transition-colors hover:bg-[#fafafa] sm:text-[17px]"
                  >
                    <ArrowLeft size={18} />
                    {t("changeDetails")}
                  </button>
                  <button
                    type="button"
                    onClick={() => verifyOtp()}
                    disabled={isVerifyingOtp}
                    className="mt-1 inline-flex h-14 items-center justify-center rounded-4xl bg-linear-to-r from-[#d9357b] to-[#ff65b4] text-[18px] font-bold text-white shadow-[0_12px_28px_rgba(217,53,123,0.32)] transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 sm:text-[19px]"
                  >
                    {isVerifyingOtp ? (
                      <span className="inline-flex items-center gap-2">
                        <LoaderCircle size={18} className="animate-spin" />
                        {t("verifyingOtp")}
                      </span>
                    ) : (
                      t("verifyOtp")
                    )}
                  </button>
                </div>
              )}

              {step === "otp" ? (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={resendOtp}
                    disabled={isResendingOtp}
                    className="inline-flex items-center gap-2 text-[15px] font-medium text-[#d7357c] transition-colors hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isResendingOtp ? (
                      <span className="inline-flex items-center gap-2">
                        <LoaderCircle size={16} className="animate-spin" />
                        {t("resendingOtp")}
                      </span>
                    ) : (
                      t("resendOtp")
                    )}
                  </button>
                  <p className="text-[14px] text-[#7a7a7a]">
                    {t("otpSentTo")}{" "}
                    {loginIdentifier?.email ?? loginIdentifier?.contactNumber}
                  </p>
                </div>
              ) : null}

              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setShowLanguageModal(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-[#f5f5f5] px-5 py-3 text-[15px] font-medium text-[#616161] shadow-[0_1px_0_rgba(0,0,0,0.02)]"
                >
                  <Globe size={18} />
                  {languageLabel}
                  <ChevronDown size={16} />
                </button>
              </div>

              <p className="pt-6 text-center text-[15px] leading-7 text-[#696969] sm:text-[16px]">
                {t("byContinuingAgree")}
              </p>
              <p className="-mt-1 text-center text-[15px] font-semibold leading-7 text-[#d7357c] sm:text-[16px]">
                <Link href="#" className="transition-opacity hover:opacity-80">
                  {t("termsOfService")}
                </Link>
                <span className="text-[#696969]"> &amp; </span>
                <Link href="#" className="transition-opacity hover:opacity-80">
                  {t("privacyPolicy")}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {showLanguageModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-140 rounded-[28px] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-[28px] font-extrabold tracking-[-0.03em] text-[#252525] sm:text-[34px]">
                {t("selectLanguage")}
              </h3>
              <button
                type="button"
                onClick={() => setShowLanguageModal(false)}
                className="rounded-full p-1 text-[#2f2f2f] transition-colors hover:bg-black/5"
                aria-label="Close language modal"
              >
                <CircleX size={34} strokeWidth={1.8} />
              </button>
            </div>
            <div className="my-6 h-px w-full bg-[#e7e7e7]" />
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setLanguage("english");
                  setShowLanguageModal(false);
                }}
                className={[
                  "flex w-full items-center justify-between rounded-3xl border px-5 py-5 text-left transition-all",
                  language === "english"
                    ? "border-[#d7357c] bg-[#fff4f8]"
                    : "border-[#f0f0f0] bg-[#fafafa]",
                ].join(" ")}
              >
                <div className="flex items-center gap-4">
                  <span className="text-[34px] leading-none">🇬🇧</span>
                  <span className="text-[24px] font-semibold tracking-[-0.02em] text-[#2f2f2f]">
                    {t("english")}
                  </span>
                </div>
                {language === "english" ? (
                  <Check size={28} className="text-[#d7357c]" />
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLanguage("portugues");
                  setShowLanguageModal(false);
                }}
                className={[
                  "flex w-full items-center justify-between rounded-3xl border px-5 py-5 text-left transition-all",
                  language === "portugues"
                    ? "border-[#d7357c] bg-[#fff4f8]"
                    : "border-[#f0f0f0] bg-[#fafafa]",
                ].join(" ")}
              >
                <div className="flex items-center gap-4">
                  <span className="text-[34px] leading-none">🇵🇹</span>
                  <span className="text-[24px] font-semibold tracking-[-0.02em] text-[#2f2f2f]">
                    {t("portugues")}
                  </span>
                </div>
                {language === "portugues" ? (
                  <Check size={28} className="text-[#d7357c]" />
                ) : null}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Device limit modal */}
      <ClearSessionModal
        open={showDeviceLimitModal}
        onOpenChange={() => {}}
        onRemove={clearSessionAndRetry}
        t={t}
      />
    </main>
  );
}
