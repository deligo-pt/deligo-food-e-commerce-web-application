/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import { AlertTriangle, ChevronRight, Pencil, User, X } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/apiClient";
import Image from "next/image";
import { isOptimizableImageHost } from "@/lib/imageHosts";
import EditProfileFormSkeleton from "./EditProfileFormSkeleton";
import { useTranslation } from "@/hooks/useTranslation";
import { useProfile, useInvalidateProfile } from "@/hooks/queries/useProfile";
import { normalizePortugueseNumber } from "@/lib/phone";
import { toast } from "sonner";

interface ProfileData {
  userId: string;
  name: { firstName: string; lastName: string };
  email: string;
  contactNumber?: string;
  NIF?: string;
  profilePhoto?: string;
}

export default function EditProfileFormPage() {
  const { t } = useTranslation();
  // Shared, cached profile — populates instantly if loaded elsewhere (Navbar, etc.).
  const { data: profile, isLoading: loading, error: profileError } =
    useProfile<ProfileData>();
  const invalidateProfile = useInvalidateProfile();
  const [submitting, setSubmitting] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [nif, setNif] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // OTP states
  const [originalEmail, setOriginalEmail] = useState("");
  const [originalMobile, setOriginalMobile] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [mobileOtp, setMobileOtp] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [sendingMobileOtp, setSendingMobileOtp] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [verifyingMobile, setVerifyingMobile] = useState(false);

  // Helper: Upload image and return URL
  const uploadProfilePhoto = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("files", file);

    const response = await apiClient.post("/uploads", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    if (!response.data?.success || !response.data?.data?.length) {
      throw new Error("Upload response missing image URL");
    }

    return response.data.data[0];
  };

  /**
   * Mirror of the server's copy. Drives no input — only `userId` for the save
   * and `profilePhoto` for the "remove the picture I just picked" fallback — so
   * it tracks the cache live and there is nothing here to clobber.
   */
  useEffect(() => {
    if (!profile) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfileData(profile);
  }, [profile]);

  /**
   * Seed the editable fields — **once**.
   *
   * 🔴 This used to run on every change to the cached profile, which made the
   * form a live mirror of the server instead of something the customer owns:
   * any refetch overwrote whatever was on screen. It bit hardest while
   * verifying a phone number, because that is the one point where somebody sits
   * on this form for minutes waiting for an SMS, and because the verification
   * itself rewrites the profile — so the very next refetch handed back a new
   * object and the effect fired.
   *
   * What vanished was usually the name, and usually for an email-login account:
   * nothing in the sign-up flow collects a name (`LoginPage` asks for an email
   * or a number, the code, and an optional referral code), so those accounts
   * hold `name.firstName === ""` and the overwrite wrote an empty string over
   * the name that had just been typed. Google accounts get a name from the
   * provider, so the same overwrite wrote the same value back and nobody
   * noticed. A typed-but-unverified number was discarded the same way.
   *
   * Refetches are not rare, either: the profile goes stale after a minute, the
   * navbar's address picker invalidates it outright, and so does saving this
   * very form.
   *
   * Seeding once instead means the server decides what the form starts with and
   * the customer decides everything after that. Nothing needs to re-seed it —
   * after a save the local state *is* what was just sent, and after a
   * verification the handler below has already set the canonical value — so
   * this deliberately has no re-hydration trigger. Unmounting resets the ref,
   * so leaving and coming back seeds afresh.
   */
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!profile || hydratedRef.current) return;
    hydratedRef.current = true;
    const d = profile;
    setFirstName(d.name?.firstName || "");
    setLastName(d.name?.lastName || "");
    setEmail(d.email || "");
    setOriginalEmail(d.email || "");
    setMobileNumber(d.contactNumber || "");
    setOriginalMobile(d.contactNumber || "");
    setNif(d.NIF || "");
    setImagePreview(d.profilePhoto || "");
  }, [profile]);

  // Surface a load failure once (mirrors the old fetch's catch).
  useEffect(() => {
    if (profileError) {
      toast.error(getApiErrorMessage(profileError, t("failedToLoadProfile")));
    }
  }, [profileError, t]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setImagePreview(profileData?.profilePhoto || "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Send OTP for email
  const handleSendEmailOtp = async () => {
    if (!email || email === originalEmail) {
      toast.error(t("enterNewEmailToUpdate"));
      return;
    }
    setSendingEmailOtp(true);
    try {
      await apiClient.patch("/profile/send-otp", { email });
      setEmailOtpSent(true);
      toast.success(t("otpSentToNewEmail"));
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to send OTP"));
    } finally {
      setSendingEmailOtp(false);
    }
  };

  // Verify OTP and update email
  const handleVerifyEmailOtp = async () => {
    if (!emailOtp) {
      toast.error(t("pleaseEnterOtp"));
      return;
    }
    setVerifyingEmail(true);
    try {
      await apiClient.patch("/profile/update-email-or-contact-number", {
        otp: emailOtp,
        type: "email",
      });
      setOriginalEmail(email);
      setEmailOtpSent(false);
      setEmailOtp("");
      toast.success(t("emailUpdatedSuccessfully"));
      // The address really did change on the server, so everything reading the
      // shared profile — navbar, profile page — should stop showing the old
      // one. Safe only because the seed above runs once: this refetch no longer
      // reaches back into the form.
      await invalidateProfile();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to verify OTP"));
    } finally {
      setVerifyingEmail(false);
    }
  };

  // Send OTP for mobile
  const handleSendMobileOtp = async () => {
    if (!mobileNumber || mobileNumber === originalMobile) {
      toast.error(t("enterNewMobileToUpdate"));
      return;
    }
    // The API takes Portuguese numbers only, and rejects the spacing they are
    // normally written with — `920 136 680` fails for the spaces alone. Sending
    // the canonical form means a customer's own way of writing their number is
    // not a validation error.
    const contactNumber = normalizePortugueseNumber(mobileNumber);
    if (!contactNumber) {
      toast.error(t("invalidPortugueseNumber"));
      return;
    }
    setSendingMobileOtp(true);
    try {
      await apiClient.patch("/profile/send-otp", { contactNumber });
      setMobileOtpSent(true);
      toast.success(t("otpSentToNewMobile"));
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to send OTP"));
    } finally {
      setSendingMobileOtp(false);
    }
  };

  // Verify OTP and update mobile
  const handleVerifyMobileOtp = async () => {
    if (!mobileOtp) {
      toast.error(t("pleaseEnterOtp"));
      return;
    }
    setVerifyingMobile(true);
    try {
      await apiClient.patch("/profile/update-email-or-contact-number", {
        otp: mobileOtp,
        type: "mobile",
      });
      // The canonical form, matching what was verified — so the "not saved yet"
      // hint clears even though the customer typed it with spaces.
      setMobileNumber(normalizePortugueseNumber(mobileNumber) ?? mobileNumber);
      setOriginalMobile(normalizePortugueseNumber(mobileNumber) ?? mobileNumber);
      setMobileOtpSent(false);
      setMobileOtp("");
      toast.success(t("mobileUpdatedSuccessfully"));
      // Same as the email above — the navbar and profile page are showing a
      // number that is no longer the customer's.
      await invalidateProfile();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to verify OTP"));
    } finally {
      setVerifyingMobile(false);
    }
  };

  /**
   * Enter inside an OTP box verifies that code.
   *
   * Both boxes sit inside the form, which has a submit button, so Enter used to
   * trigger implicit submission — Save Changes — at the exact moment the
   * customer had just finished typing a code and meant the button beside it.
   */
  const handleOtpKeyDown =
    (verify: () => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      verify();
    };

  /**
   * A typed-but-unverified change to the email or the phone.
   *
   * 🔴 Neither field is part of the save. `PATCH /customers/:userId` rejects
   * both outright — "Unrecognized key(s) in object: 'contactNumber'" — because
   * they can only change through the OTP flow beside them. So a customer who
   * types a new number and presses Save used to get "Profile updated
   * successfully!" while the number went nowhere. These drive an inline warning
   * and an honest toast; they do not block the save, because the name, NIF and
   * photo in the same form are perfectly saveable.
   */
  const emailUnverified = email.trim() !== "" && email !== originalEmail;
  const mobileUnverified =
    mobileNumber.trim() !== "" && mobileNumber !== originalMobile;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileData?.userId) {
      toast.error(t("userIdNotFound"));
      return;
    }
    // The label has always said "First Name *" and nothing ever enforced it.
    // Worth enforcing here in particular: sign-up never asks for a name, so
    // these accounts arrive with an empty one and this is the screen where it
    // gets filled in.
    if (!firstName.trim()) {
      toast.error(t("firstNameRequired"));
      return;
    }

    setSubmitting(true);

    try {
      let uploadedPhotoUrl: string | undefined = undefined;

      if (selectedFile) {
        setImageUploading(true);
        try {
          uploadedPhotoUrl = await uploadProfilePhoto(selectedFile);
        } catch (uploadErr) {
          toast.error(getApiErrorMessage(uploadErr, "Failed to upload profile photo"));
          setSubmitting(false);
          setImageUploading(false);
          return;
        } finally {
          setImageUploading(false);
        }
      }

      const payload: any = {};

      // Both halves of the name every time, and the NIF whatever its value.
      // Omitting a field when it is empty made it unclearable: emptying the
      // last name sent nothing at all, the save reported success, and the old
      // surname was still there on reload. `PATCH /customers/:userId` merges
      // what it is given and takes `""` happily, so sending the emptied field
      // is what actually clears it.
      payload.name = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      };
      payload.NIF = nif.trim();
      if (uploadedPhotoUrl) payload.profilePhoto = uploadedPhotoUrl;

      await apiClient.patch(`/customers/${profileData.userId}`, payload);

      // Not a plain success when something on screen was not saved. The rest of
      // the form did go; saying so and naming what did not is the difference
      // between a confusing screen and an actionable one.
      if (emailUnverified || mobileUnverified) {
        toast.warning(t("profileSavedContactNotVerified"));
      } else {
        toast.success(t("profileUpdatedSuccessfully"));
      }
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      // Swap the local blob preview for the stored URL. The seed effect no
      // longer does this on the way back, and the blob dies with the page.
      if (uploadedPhotoUrl) setImagePreview(uploadedPhotoUrl);

      // Refresh the shared profile cache so every other consumer (Navbar,
      // profile view) picks up the change. This form is not among them — it
      // seeds once, and what is on screen is what was just sent.
      await invalidateProfile();

      // Notify Navbar's photo state instantly (it keeps a local copy).
      const newPhoto = uploadedPhotoUrl ?? profileData.profilePhoto ?? null;
      window.dispatchEvent(
        new CustomEvent("profilePhotoUpdated", {
          detail: { profilePhoto: newPhoto },
        })
      );
    } catch (err) {
      console.error("Update error:", err);
      toast.error(getApiErrorMessage(err, "Failed to update profile"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <EditProfileFormSkeleton />;
  }

  return (
    <section className="bg-[#f8f9fa] dark:bg-neutral-950 py-8 text-gray-900 dark:text-neutral-100 transition-colors duration-200">
      <div className="mx-auto max-w-250 px-4">
        <div className="mb-6 flex items-center gap-2 text-sm text-[#5a4044] dark:text-neutral-400">
          <span>{t("home")}</span>
          <ChevronRight className="h-3.5 w-3.5 text-[#5a4044]/60 dark:text-neutral-500" />
          <span>{t("settings")}</span>
          <ChevronRight className="h-3.5 w-3.5 text-[#5a4044]/60 dark:text-neutral-500" />
          <span className="font-semibold text-[#191c1d] dark:text-neutral-200">
            {t("editProfile")}
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
          <div className="flex flex-col items-center border-b border-neutral-200/50 dark:border-neutral-800 bg-linear-to-b from-neutral-50 dark:from-neutral-800/10 to-transparent py-10">
            <div className="relative">
              <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-white dark:border-neutral-800 shadow-lg flex items-center justify-center bg-pink-50 dark:bg-pink-950/30">
                {imagePreview ? (
                  <Image
                    src={imagePreview}
                    alt="Profile"
                    className="h-full w-full object-cover"
                    width={128}
                    height={128}
                    // Two sources, both of which must skip the optimizer: an
                    // uploaded photo on Deligo's own storage, which the
                    // optimizer cannot fetch (see `OPTIMIZER_BYPASS_HOSTS`), and
                    // the `blob:` URL shown while a newly picked file is still
                    // local to the browser.
                    unoptimized={!isOptimizableImageHost(imagePreview)}
                  />
                ) : (
                  <User className="h-16 w-16 text-[#f9186b] dark:text-pink-400" />
                )}
              </div>
              <label className="absolute bottom-0 right-0 cursor-pointer rounded-full border-2 border-white dark:border-neutral-800 bg-[#f9186b] dark:bg-pink-600 p-2 text-white shadow-lg">
                <Pencil size={18} />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                />
              </label>
              {selectedFile && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute -top-2 -right-2 rounded-full bg-red-500 p-1 text-white shadow-md"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <h1 className="text-2xl font-bold mt-4 text-gray-900 dark:text-neutral-50">{t("editProfile")}</h1>
            <p className="text-sm text-[#5a4044] dark:text-neutral-400">{t("manageAccountInfo")}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-10 p-8 md:p-12 bg-white dark:bg-neutral-900">
            {/* Basic Information */}
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-neutral-50">{t("basicInformation")}</h2>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#5a4044] dark:text-neutral-400">
                    {t("firstName")} *
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 outline-none text-gray-900 dark:text-neutral-100 focus:border-[#f9186b] dark:focus:border-pink-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#5a4044] dark:text-neutral-400">
                    {t("lastName")} ({t("optional")})
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 outline-none text-gray-900 dark:text-neutral-100 focus:border-[#f9186b] dark:focus:border-pink-500"
                  />
                </div>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#5a4044] dark:text-neutral-400">
                    {t("emailAddress")}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="flex-1 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 outline-none text-gray-900 dark:text-neutral-100 focus:border-[#f9186b] dark:focus:border-pink-500"
                    />
                    {!emailOtpSent ? (
                      <button
                        type="button"
                        onClick={handleSendEmailOtp}
                        disabled={sendingEmailOtp || email === originalEmail}
                        className="whitespace-nowrap rounded bg-[#f9186b] dark:bg-pink-600 hover:bg-[#d4145b] dark:hover:bg-pink-700 px-4 py-2 text-white disabled:opacity-50 transition"
                      >
                        {sendingEmailOtp ? t("sending") : t("sendOtp")}
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder={t("otp")}
                          value={emailOtp}
                          onChange={(e) => setEmailOtp(e.target.value)}
                          onKeyDown={handleOtpKeyDown(handleVerifyEmailOtp)}
                          className="w-24 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2 py-2 text-center outline-none text-gray-900 dark:text-neutral-100 focus:border-[#f9186b] dark:focus:border-pink-500"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyEmailOtp}
                          disabled={verifyingEmail}
                          className="whitespace-nowrap rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50 transition"
                        >
                          {verifyingEmail ? t("verifying") : t("verify")}
                        </button>
                      </div>
                    )}
                  </div>
                  {emailUnverified && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {t("changeNotSavedUntilVerified")}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#5a4044] dark:text-neutral-400">
                    {t("mobileNumber")} *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      placeholder={t("mobilePlaceholder")}
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="flex-1 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 outline-none text-gray-900 dark:text-neutral-100 focus:border-[#f9186b] dark:focus:border-pink-500"
                    />
                    {!mobileOtpSent ? (
                      <button
                        type="button"
                        onClick={handleSendMobileOtp}
                        disabled={sendingMobileOtp || mobileNumber === originalMobile}
                        className="whitespace-nowrap rounded bg-[#f9186b] dark:bg-pink-600 hover:bg-[#d4145b] dark:hover:bg-pink-700 px-4 py-2 text-white disabled:opacity-50 transition"
                      >
                        {sendingMobileOtp ? t("sending") : t("sendOtp")}
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder={t("otp")}
                          value={mobileOtp}
                          onChange={(e) => setMobileOtp(e.target.value)}
                          onKeyDown={handleOtpKeyDown(handleVerifyMobileOtp)}
                          className="w-24 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2 py-2 text-center outline-none text-gray-900 dark:text-neutral-100 focus:border-[#f9186b] dark:focus:border-pink-500"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyMobileOtp}
                          disabled={verifyingMobile}
                          className="whitespace-nowrap rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50 transition"
                        >
                          {verifyingMobile ? t("verifying") : t("verify")}
                        </button>
                      </div>
                    )}
                  </div>
                  {mobileUnverified && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {t("changeNotSavedUntilVerified")}
                    </p>
                  )}
                </div>
              </div>
              <div className="max-w-md">
                <label className="mb-2 block text-sm font-medium text-[#5a4044] dark:text-neutral-400">
                  {t("nifTaxId")}
                </label>
                <input
                  type="text"
                  value={nif}
                  onChange={(e) => setNif(e.target.value)}
                  className="w-full rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 outline-none text-gray-900 dark:text-neutral-100 focus:border-[#f9186b] dark:focus:border-pink-500"
                />
              </div>
            </section>

            <div className="flex flex-col justify-end gap-4 border-t border-neutral-200/50 dark:border-neutral-800 pt-8 sm:flex-row">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="px-8 py-3 font-bold text-[#f9186b] dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 transition"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={submitting || imageUploading}
                className="rounded bg-[#f9186b] dark:bg-pink-600 hover:bg-[#d4145b] dark:hover:bg-pink-700 px-12 py-3 font-bold text-white shadow-lg disabled:opacity-50 transition"
              >
                {imageUploading
                  ? t("uploadingImage")
                  : submitting
                    ? t("saving")
                    : t("saveChanges")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
