"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation";

export default function DeleteAccountPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    contactNumber: "",
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      contactNumber: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.contactNumber) {
      toast.error(t("pleaseFillFields"));
      return;
    }

    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSubmitting(false);
    resetForm();
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#e1e3e4] px-4 py-4 md:py-8">
      <div className="mx-auto max-w-lg rounded-3xl bg-white p-6 shadow-xl md:p-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-black text-[#b0004a] md:text-3xl">
            {t("deleteAccount")}
          </h1>
          <Link
            href="/"
            className="rounded-full p-2 text-[#5a4044] transition-colors hover:bg-[#e3bdc3]/30 hover:text-[#b0004a]"
          >
            <X size={24} />
          </Link>
        </div>

        <p className="mb-8 text-[16px] text-[#5a4044]">
          {t("deleteAccountWarning")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-sm font-semibold text-[#191c1d]"
            >
              {t("fullName")}
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-[#e3bdc3] bg-white px-4 py-3 text-[#191c1d] outline-none transition focus:border-[#b0004a] focus:ring-1 focus:ring-[#b0004a]"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-semibold text-[#191c1d]"
            >
              {t("emailAddress")}
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-[#e3bdc3] bg-white px-4 py-3 text-[#191c1d] outline-none transition focus:border-[#b0004a] focus:ring-1 focus:ring-[#b0004a]"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="contactNumber"
              className="mb-1 block text-sm font-semibold text-[#191c1d]"
            >
              {t("contactNumber")}
            </label>
            <input
              type="tel"
              id="contactNumber"
              name="contactNumber"
              value={formData.contactNumber}
              onChange={handleChange}
              required
              className="w-full rounded-xl border border-[#e3bdc3] bg-white px-4 py-3 text-[#191c1d] outline-none transition focus:border-[#b0004a] focus:ring-1 focus:ring-[#b0004a]"
              placeholder="+1234567890"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-[#b0004a] py-3 font-bold text-white transition-all hover:bg-[#8a0038] disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting ? t("submitting") || "Submitting..." : t("requestDeletion")}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-[#5a4044]">
          <Link href="/" className="underline hover:text-[#b0004a]">
            {t("returnToHome")}
          </Link>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="relative mx-auto w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl md:p-8">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 text-[#5a4044] hover:text-[#b0004a]"
            >
              <X size={20} />
            </button>
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            <h3 className="mb-2 text-xl font-bold text-[#191c1d]">
              {t("requestSubmitted")}
            </h3>
            <p className="mb-6 text-[16px] text-[#5a4044]">
              {t("deleteAccountRequestReceived")}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-[#b0004a] px-6 py-2 font-semibold text-[#b0004a] transition-colors hover:bg-[#b0004a] hover:text-white cursor-pointer"
              >
                {t("close")}
              </button>
              <button
                onClick={() => router.push("/")}
                className="rounded-xl bg-[#b0004a] px-6 py-2 font-semibold text-white transition-colors hover:bg-[#8a0038] cursor-pointer"
              >
                {t("goBackHome")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
