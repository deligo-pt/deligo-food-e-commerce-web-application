"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";

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
    <div className="min-h-screen bg-[#e1e3e4] dark:bg-neutral-950 px-4 py-4 md:py-8 transition-colors duration-200">
      <div className="mx-auto max-w-lg rounded-3xl bg-card border border-transparent dark:border-neutral-800 p-6 shadow-xl dark:shadow-none md:p-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl lg:text-display font-black text-primary dark:text-primary">
            {t("deleteAccount")}
          </h1>
          <Link
            href="/"
            className="rounded-full p-2 text-muted-foreground dark:text-neutral-400 transition-colors hover:bg-[#e3bdc3]/30 dark:hover:bg-neutral-800 hover:text-primary dark:hover:text-neutral-200"
          >
            <X size={24} />
          </Link>
        </div>

        <p className="mb-8 text-base text-muted-foreground dark:text-neutral-400">
          {t("deleteAccountWarning")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-sm font-semibold text-foreground dark:text-neutral-200"
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
              className="w-full rounded-xl border border-[#e3bdc3] dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 py-3 text-foreground dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-600 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-semibold text-foreground dark:text-neutral-200"
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
              className="w-full rounded-xl border border-[#e3bdc3] dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 py-3 text-foreground dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-600 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="contactNumber"
              className="mb-1 block text-sm font-semibold text-foreground dark:text-neutral-200"
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
              className="w-full rounded-xl border border-[#e3bdc3] dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 py-3 text-foreground dark:text-neutral-100 placeholder:text-gray-400 dark:placeholder:text-neutral-600 outline-none transition focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="+1234567890"
            />
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            className="w-full cursor-pointer rounded-xl font-bold"
          >
            {isSubmitting ? t("submitting") : t("requestDeletion")}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground dark:text-neutral-400">
          <Link href="/" className="underline hover:text-primary dark:hover:text-primary">
            {t("returnToHome")}
          </Link>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="relative mx-auto w-full max-w-md rounded-2xl bg-card border border-transparent dark:border-neutral-800 p-6 text-center shadow-2xl dark:shadow-none md:p-8">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t("close")}
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 rounded-full text-muted-foreground hover:text-primary dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              <X size={20} />
            </Button>
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400">
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
            <h3 className="mb-2 text-xl font-bold text-foreground dark:text-neutral-50">
              {t("requestSubmitted")}
            </h3>
            <p className="mb-6 text-base text-muted-foreground dark:text-neutral-400">
              {t("deleteAccountRequestReceived")}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="cursor-pointer rounded-xl border-primary font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
              >
                {t("close")}
              </Button>
              <Button
                onClick={() => router.push("/")}
                className="cursor-pointer rounded-xl font-semibold"
              >
                {t("goBackHome")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
