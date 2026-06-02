import { Globe, AtSign, Phone, Smartphone, Play } from "lucide-react";

const companyLinks = [
  "About Us",
  "Our Story",
  "Partner with us",
  "Careers",
];

const supportLinks = [
  "Help Center",
  "Contact Us",
  "Safety Measures",
  "FAQs",
];

const policyLinks = [
  "Privacy Policy",
  "Terms of Service",
  "Cookie Settings",
];

export default function Footer() {
  return (
    <footer className="w-full border-t border-[#e3bdc3]/20 bg-[#e1e3e4] px-4 py-20 md:px-8 lg:px-16">
      <div className="mb-20 grid w-full grid-cols-1 gap-16 md:grid-cols-12">
        {/* Brand */}
        <div className="md:col-span-4">
          <span className="mb-8 block text-[40px] font-black text-[#b0004a]">
            DeliGo
          </span>

          <p className="text-[18px] leading-7 text-[#5a4044]">
            Delivering delight to your doorstep, one order at a time. The most
            reliable and fastest way to get everything you need from local
            stores and restaurants.
          </p>

          <div className="mt-10 flex gap-4">
            <button className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm transition-all hover:bg-[#b0004a] hover:text-white">
              <Globe size={24} />
            </button>

            <button className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm transition-all hover:bg-[#b0004a] hover:text-white">
              <AtSign size={24} />
            </button>

            <button className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm transition-all hover:bg-[#b0004a] hover:text-white">
              <Phone size={24} />
            </button>
          </div>
        </div>

        {/* Company */}
        <div className="md:col-span-2">
          <h4 className="mb-8 text-[14px] font-extrabold uppercase tracking-[0.16em] text-[#191c1d]">
            Company
          </h4>

          <nav className="flex flex-col gap-5">
            {companyLinks.map((label) => (
              <a
                key={label}
                href="#"
                className="text-[16px] leading-6 text-[#5a4044] transition-colors hover:text-[#b0004a]"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>

        {/* Support */}
        <div className="md:col-span-2">
          <h4 className="mb-8 text-[14px] font-extrabold uppercase tracking-[0.16em] text-[#191c1d]">
            Support
          </h4>

          <nav className="flex flex-col gap-5">
            {supportLinks.map((label) => (
              <a
                key={label}
                href="#"
                className="text-[16px] leading-6 text-[#5a4044] transition-colors hover:text-[#b0004a]"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>

        {/* App */}
        <div className="md:col-span-4">
          <h4 className="mb-8 text-[14px] font-extrabold uppercase tracking-[0.16em] text-[#191c1d]">
            Get the app
          </h4>

          <p className="mb-6 text-[16px] leading-6 text-[#5a4044]">
            Enjoy the full experience on your mobile device.
          </p>

          <div className="flex flex-col gap-4">
            <button className="flex items-center gap-4 rounded-2xl bg-[#191c1d] px-6 py-4 text-white transition-opacity hover:opacity-90">
              <Smartphone size={40} />

              <div className="text-left">
                <p className="text-[10px] font-bold uppercase opacity-70">
                  Download on the
                </p>

                <p className="text-lg font-bold">
                  App Store
                </p>
              </div>
            </button>

            <button className="flex items-center gap-4 rounded-2xl bg-[#191c1d] px-6 py-4 text-white transition-opacity hover:opacity-90">
              <Play size={40} />

              <div className="text-left">
                <p className="text-[10px] font-bold uppercase opacity-70">
                  Get it on
                </p>

                <p className="text-lg font-bold">
                  Google Play
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mb-10 h-px w-full bg-[#e3bdc3]/30" />

      {/* Bottom */}
      <div className="flex w-full flex-col items-center justify-between gap-6 text-[14px] leading-5 text-[#5a4044] md:flex-row">
        <div>
          © 2024 DeliGo Technologies Inc. All rights reserved.
        </div>

        <div className="flex flex-wrap justify-center gap-8">
          {policyLinks.map((label) => (
            <a
              key={label}
              href="#"
              className="transition-colors hover:text-[#b0004a]"
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}