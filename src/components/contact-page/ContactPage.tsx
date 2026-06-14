/* eslint-disable react/no-unescaped-entities */
"use client";

import Image from "next/image";
import Link from "next/link";
import { Mail, Phone, MapPin, Globe } from "lucide-react";

export default function ContactPage() {
  const contactCards = [
    {
      icon: Phone,
      title: "Call Us",
      details: ["+351 21 757 0184", "+351 920 136 680"],
    },
    {
      icon: Mail,
      title: "Email Us",
      details: ["contact@deligo.pt", "geral@deligo.pt"],
    },
    {
      icon: MapPin,
      title: "Visit Us",
      details: ["Rua Joaquim Agostinho 16C", "1750-126 Lisbon, Portugal"],
    },
    {
      icon: Globe,
      title: "Website",
      details: ["www.deligo.pt"],
    },
  ];

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-linear-to-r from-[#E91E7F] via-[#f04297] to-[#E91E7F]">
        <div className="absolute inset-0 bg-black/5" />

        <div className="relative mx-auto max-w-7xl px-6 py-24 text-center">
          <div className="mb-8 flex justify-center">
            <div className="rounded-3xl bg-white p-4 shadow-xl">
              <Image
                src="/deligo-logo.png"
                alt="DeliGo"
                width={100}
                height={100}
                className="object-contain"
              />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-white md:text-6xl">
            Contact DeliGo
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-lg text-pink-100 md:text-xl">
            We'd love to hear from you. Whether you have a question, need
            support, want to partner with us, or simply want to learn more about
            DeliGo, our team is here to help.
          </p>
        </div>
      </section>

      {/* Contact Cards */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {contactCards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.title}
                className="rounded-3xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E91E7F]/10">
                  <Icon className="h-7 w-7 text-[#E91E7F]" />
                </div>

                <h3 className="mb-3 text-xl font-bold">{card.title}</h3>

                <div className="space-y-2 text-muted-foreground">
                  {card.details.map((detail) => (
                    <p key={detail}>{detail}</p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Location Card */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="overflow-hidden rounded-3xl bg-linear-to-r from-[#E91E7F] to-[#ff4da6] p-10 text-white">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <MapPin className="h-8 w-8" />
                <h2 className="text-3xl font-bold">Visit Our Office</h2>
              </div>

              <p className="mb-6 text-pink-100">
                Located in Lisbon, Portugal, DeliGo is building the future of
                delivery, logistics, mobility, and digital commerce.
              </p>

              <div className="space-y-2">
                <p className="font-semibold">Rua Joaquim Agostinho 16C</p>
                <p>1750-126 Lisbon, Portugal</p>
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="mailto:contact@deligo.pt"
                  className="rounded-xl bg-white px-6 py-3 font-medium text-[#E91E7F] transition hover:bg-pink-50"
                >
                  Email Us
                </Link>

                <Link
                  href="https://wa.me/351920136680"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-white px-6 py-3 font-medium text-white transition hover:bg-white/10"
                >
                  WhatsApp Us
                </Link>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="flex h-72 w-full max-w-md items-center justify-center rounded-3xl bg-white/10 backdrop-blur-sm">
                <MapPin className="h-24 w-24 text-white/80" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="rounded-3xl bg-linear-to-r from-[#E91E7F] via-[#f04297] to-[#E91E7F] px-8 py-14 text-center text-white">
            <h2 className="text-3xl font-bold md:text-4xl">Need Help?</h2>

            <p className="mx-auto mt-4 max-w-2xl text-pink-100">
              Our team is ready to assist you with any questions, support
              requests, partnerships, or business inquiries.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 md:flex-row md:gap-8">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                <span>contact@deligo.pt</span>
              </div>

              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                <span>+351 920 136 680</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
