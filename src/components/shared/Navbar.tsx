"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MapPin,
  ChevronDown,
  Search,
  ShoppingCart,
  Menu,
} from "lucide-react";

import { navLinks } from "../../data/navLinks";

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-[#b0004a] text-white transition-all duration-300 dark:bg-[#d81b60]">
      <div className="flex w-full items-center justify-between px-4 py-4 lg:px-16">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-[20px] font-black leading-7 md:text-[24px]">
            DeliGo
          </Link>

          <button className="hidden cursor-pointer items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[#fff2f3] transition-all hover:bg-white/20 lg:flex">
            <MapPin size={20} />
            <span className="text-[14px] font-semibold leading-5">Rua Augusta</span>
            <ChevronDown size={16} />
          </button>
        </div>

        <div className="mx-8 hidden flex-1 md:block">
          <div className="relative flex items-center">
            <Search size={18} className="absolute left-4 text-black/60" />
            <input
              type="text"
              placeholder="Search stores, restaurants, or cuisines..."
              className="w-full rounded-full border-0 bg-[#ffffff] py-2.5 pl-12 pr-4 text-[16px] text-[#191c1d] outline-none ring-0 placeholder:text-black/45 focus:ring-2 focus:ring-[#dd2269]/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <nav className="hidden items-center gap-8 lg:flex">
            {navLinks.map((item, index) => {
              const isActive = pathname === item.href || (pathname === "/" && index === 0);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={[
                    "pb-1 text-[14px] leading-5 transition-colors",
                    isActive
                      ? "border-b-2 border-white font-bold text-white"
                      : "font-medium text-white/80 hover:text-white",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-4 border-l border-white/20 pl-8">
            <button className="relative rounded-full p-2 text-white transition-colors hover:bg-white/10">
              <ShoppingCart size={22} />
              <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-[#b70052] text-[10px] font-medium text-white">
                2
              </span>
            </button>

            <Link href="/login" className="flex items-center gap-3 rounded-full p-1.5 text-white transition-colors hover:bg-white/10">
              <div className="h-9 w-9 overflow-hidden rounded-full border-2 border-white/20 bg-[#edeeef]">
                <Image
                  alt="User avatar"
                  className="h-full w-full object-cover"
                  height={36}
                  width={36}
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuC3HK_ck--tlX6pTwJ0djnpKaVYN3IZ9Bjuz-L9h9EWbAVqiBm4fdfcd7p7_hAJx9ftyhl9KfCemQKsV1XNEie_Gg16WW0xNz3S_lmyMGsTq-ZJ8L30ey1GMPF5XD1S6LiB5j2SetOyaSQfDjnVbtHPCBEKKy0g57EskBQU9VV1-1FG87q7et1ImrR1dz-RpJ3mRwTomBstK_t53Dxcx3ywMYwT6Qi0Ehf3MyaRohi9aJ2KhCbHDGpc0v6gtMmmOf5wpctFt41o9zE"
                />
              </div>
              <span className="hidden text-[14px] font-semibold leading-5 xl:block">
                Account
              </span>
            </Link>
          </div>

          <button className="text-white lg:hidden">
            <Menu size={26} />
          </button>
        </div>
      </div>
    </header>
  );
}