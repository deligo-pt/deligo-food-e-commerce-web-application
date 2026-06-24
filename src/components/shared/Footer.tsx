"use client";

import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "@/hooks/useTranslation";

// Custom Facebook Icon
const FacebookIcon = ({ size = 24 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 16.991 5.65716 21.1283 10.4375 21.8785V14.8906H7.89844V12H10.4375V9.79688C10.4375 7.29063 11.9305 5.90625 14.2146 5.90625C15.3088 5.90625 16.4531 6.10156 16.4531 6.10156V8.5625H15.1922C13.95 8.5625 13.5625 9.33334 13.5625 10.1242V12H16.3359L15.8926 14.8906H13.5625V21.8785C18.3428 21.1283 22 16.991 22 12Z"
      fill="currentColor"
    />
  </svg>
);

// Custom Instagram Icon (official logo style)
const InstagramIcon = ({ size = 24 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.308.975.975 1.246 2.242 1.308 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.308 3.608-.975.975-2.242 1.246-3.608 1.308-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.334-3.608-1.308-.975-.975-1.246-2.242-1.308-3.608-.058-1.266-.07-1.646-.07-4.85s.012-3.584.07-4.85c.062-1.366.334-2.633 1.308-3.608.975-.975 2.242-1.246 3.608-1.308 1.266-.058 1.646-.07 4.85-.07zM12 0C8.741 0 8.332.014 7.052.072 5.173.152 3.689.517 2.468 1.738.246 3.96.152 5.852.072 7.052.014 8.332 0 8.741 0 12c0 3.259.014 3.668.072 4.948.08 1.8.445 3.284 1.666 4.505 1.221 1.221 2.705 1.586 4.505 1.666 1.28.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 1.8-.08 3.284-.445 4.505-1.666 1.221-1.221 1.586-2.705 1.666-4.505.058-1.28.072-1.689.072-4.948 0-3.259-.014-3.668-.072-4.948-.08-1.8-.445-3.284-1.666-4.505C20.311.517 18.827.152 17.027.072 15.747.014 15.338 0 12 0z"
      fill="currentColor"
    />
    <path
      d="M12 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8z"
      fill="currentColor"
    />
    <circle cx="18.406" cy="5.594" r="1.44" fill="currentColor" />
  </svg>
);

// Custom YouTube Icon
const YoutubeIcon = ({ size = 24 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M23.7609 7.2002C23.7609 7.2002 23.5266 5.54551 22.8063 4.81896C21.8969 3.8627 20.8703 3.85742 20.4016 3.8002C17.0437 3.5572 12.0055 3.5572 12.0055 3.5572H11.9945C11.9945 3.5572 6.95625 3.5572 3.59844 3.8002C3.12969 3.85742 2.10312 3.8627 1.19375 4.81896C0.473437 5.54551 0.24375 7.2002 0.24375 7.2002C0.24375 7.2002 0 9.14629 0 11.0879V12.9127C0 14.8543 0.239062 16.8002 0.239062 16.8002C0.239062 16.8002 0.473438 18.4549 1.18906 19.1814C2.09844 20.1377 3.29844 20.1064 3.82344 20.2111C5.73594 20.4002 12 20.4439 12 20.4439C12 20.4439 17.0437 20.4387 20.4016 20.2002C20.8703 20.1429 21.8969 20.1377 22.8063 19.1814C23.5266 18.4549 23.7609 16.8002 23.7609 16.8002C23.7609 16.8002 24 14.8543 24 12.9127V11.0879C24 9.14629 23.7609 7.2002 23.7609 7.2002ZM9.52031 15.1127V8.36739L16.0031 11.7492L9.52031 15.1127Z"
      fill="currentColor"
    />
  </svg>
);

// Custom TikTok Icon
const TiktokIcon = ({ size = 24 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.87-4.3 2.9 2.9 0 0 1 .88.18V9.79a6.32 6.32 0 0 0-1.05-.1 6.33 6.33 0 0 0-4.62 10.74 6.33 6.33 0 0 0 10.75-4.62V11.1c.98.7 2.16 1.12 3.44 1.12h.01V8.87a4.82 4.82 0 0 1-2.85-.93l.01-.01-.02-.24Z"
      fill="currentColor"
    />
  </svg>
);

export default function Footer() {
  const { t } = useTranslation();
  const supportLinks = [
    { label: t("contactUs"), href: "/contact-us" },
    { label: t("faqs"), href: "/faqs" },
  ];
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-[#e3bdc3]/20 dark:border-neutral-800 bg-[#e1e3e4] dark:bg-neutral-900 px-4 py-20 md:px-8 lg:px-16 transition-colors duration-200">
      <div className="mb-20 grid w-full grid-cols-1 gap-16 md:grid-cols-12">
        {/* Brand */}
        <div className="md:col-span-4">
          <Link href="/" className="flex items-center gap-3 mb-8">
            {/* Same white "chip" lockup as the navbar so the brand mark reads
                consistently and gets some depth instead of a flat tile. */}
            <span className="flex items-center justify-center rounded-2xl bg-white dark:bg-neutral-800 p-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.08)] ring-1 ring-black/5 dark:ring-white/10">
              <Image
                src="/deligoLogo.png"
                alt="DeliGo Logo"
                width={44}
                height={44}
                priority
                className="rounded-xl"
              />
            </span>

            <span className=" block text-[40px] font-black tracking-tight text-[#b0004a] dark:text-[#d81b60]">
              DeliGo
            </span>
          </Link>

          <p className="text-[18px] leading-7 text-[#5a4044] dark:text-neutral-400">
            {t("footerDescription")}
          </p>

          {/* Social Media Links */}
          <div className="mt-10 flex gap-4">
            <a
              href="https://www.facebook.com/deligo.pt"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 shadow-sm transition-all hover:bg-[#b0004a] dark:hover:bg-pink-600 hover:text-white dark:hover:text-white"
              aria-label="Facebook"
            >
              <FacebookIcon size={24} />
            </a>
            <a
              href="https://www.instagram.com/deligo.pt/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 shadow-sm transition-all hover:bg-[#b0004a] dark:hover:bg-pink-600 hover:text-white dark:hover:text-white"
              aria-label="Instagram"
            >
              <InstagramIcon size={24} />
            </a>
            <a
              href="https://www.tiktok.com/@deligo.pt"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 shadow-sm transition-all hover:bg-[#b0004a] dark:hover:bg-pink-600 hover:text-white dark:hover:text-white"
              aria-label="TikTok"
            >
              <TiktokIcon size={24} />
            </a>
            <a
              href="https://www.youtube.com/@DeliGoPT"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 shadow-sm transition-all hover:bg-[#b0004a] dark:hover:bg-pink-600 hover:text-white dark:hover:text-white"
              aria-label="YouTube"
            >
              <YoutubeIcon size={24} />
            </a>
          </div>
        </div>

        {/* Company */}
        <div className="md:col-span-2">
          <h4 className="mb-8 text-[14px] font-extrabold uppercase tracking-[0.16em] text-[#191c1d] dark:text-white">
            {t("company")}
          </h4>
          <nav className="flex flex-col gap-5">
            <Link
              href="/about-us"
              className="text-[16px] leading-6 text-[#5a4044] dark:text-neutral-400 transition-colors hover:text-[#b0004a] dark:hover:text-pink-500"
            >
              {t("aboutUs")}
            </Link>
            <a
              href="https://vendor-food.deligo.pt/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[16px] leading-6 text-[#5a4044] dark:text-neutral-400 transition-colors hover:text-[#b0004a] dark:hover:text-pink-500"
            >
              {t("partnerWithUs")}
            </a>
            <a
              href="https://fleet-food.deligo.pt/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[16px] leading-6 text-[#5a4044] dark:text-neutral-400 transition-colors hover:text-[#b0004a] dark:hover:text-pink-500"
            >
              {t("fleetManager")}
            </a>
            <Link
              href="/delete-account"
              className="text-[16px] leading-6 text-[#5a4044] dark:text-neutral-400 transition-colors hover:text-[#b0004a] dark:hover:text-pink-500"
            >
              {t("deleteAccount")}
            </Link>
          </nav>
        </div>

        {/* Support */}
        <div className="md:col-span-2">
          <h4 className="mb-8 text-[14px] font-extrabold uppercase tracking-[0.16em] text-[#191c1d] dark:text-white">
            {t("support")}
          </h4>
          <nav className="flex flex-col gap-5">
            {supportLinks.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="text-[16px] leading-6 text-[#5a4044] dark:text-neutral-400 transition-colors hover:text-[#b0004a] dark:hover:text-pink-500"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* App Store Badges using Next.js Image with consistent size */}
        <div className="md:col-span-4">
          <h4 className="mb-8 text-[14px] font-extrabold uppercase tracking-[0.16em] text-[#191c1d] dark:text-white">
            {t("getTheApp")}
          </h4>
          <p className="mb-6 text-[16px] leading-6 text-[#5a4044] dark:text-neutral-400">
            {t("mobileExperience")}
          </p>
          <div className="flex flex-col gap-4">
            <a
              href="https://apps.apple.com/pt/app/deligo-rider/id6769997602?l=en-GB"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-fit transition-opacity hover:opacity-90"
            >
              <Image
                src="/app-store-badge.png"
                alt="Download on the App Store"
                width={320}
                height={50}
                className="h-auto w-auto"
                priority={false}
              />
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.deligo.customer"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-fit transition-opacity hover:opacity-90"
            >
              <Image
                src="/google-play-badge.png"
                alt="GET IT ON Google Play"
                width={320}
                height={50}
                className="h-auto w-auto"
                priority={false}
              />
            </a>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mb-10 h-px w-full bg-[#e3bdc3]/30 dark:bg-neutral-800" />

      {/* Bottom */}
      <div className="flex w-full flex-col items-center justify-between gap-6 text-[14px] leading-5 text-[#5a4044] dark:text-neutral-400 md:flex-row">
        <div>
          © {currentYear} DeliGo PIXELMIRACLE, LDA. {t("allRightsReserved")}
        </div>
        <div className="flex flex-wrap justify-center gap-8">
          <Link
            href="/privacy"
            className="transition-colors hover:text-[#b0004a] dark:hover:text-pink-500"
          >
            {t("privacyPolicy")}
          </Link>
          <Link
            href="/terms"
            className="transition-colors hover:text-[#b0004a] dark:hover:text-pink-500"
          >
            {t("termsOfService")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
