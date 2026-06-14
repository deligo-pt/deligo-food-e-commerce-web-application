"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  ChevronDown,
  Search,
  CircleHelp,
  Users,
  Store,
  Bike,
  Car,
  Shield,
  Sparkles,
  Globe,
  Mail,
  Phone,
  MapPin,
  MessageCircle,
} from "lucide-react";

const faqCategories = [
  {
    id: "general",
    title: "General Questions",
    icon: Globe,
    faqs: [
      {
        question: "What is DeliGo?",
        answer:
          "DeliGo is a technology-driven platform that offers food delivery, grocery delivery, courier services, logistics solutions, fleet management, and mobility services through a single digital ecosystem.",
      },
      {
        question: "Where does DeliGo operate?",
        answer:
          "DeliGo is headquartered in Lisbon, Portugal, and aims to expand its services across Portugal and other European markets.",
      },
      {
        question: "How do I create a DeliGo account?",
        answer:
          "You can register through the DeliGo mobile app or website using your email address or mobile number.",
      },
      {
        question: "Is DeliGo available 24/7?",
        answer:
          "Service availability depends on your location and merchant operating hours. Some services may be available 24/7.",
      },
      {
        question: "Is DeliGo available on Android and iOS?",
        answer:
          "Yes, DeliGo is available on both Android and iOS platforms.",
      },
    ],
  },

  {
    id: "customer",
    title: "Customer FAQs",
    icon: Users,
    faqs: [
      {
        question: "How can I place an order?",
        answer:
          "Browse available restaurants, stores, or services, add items to your cart, select a delivery address, and complete your payment.",
      },
      {
        question: "How can I track my order?",
        answer:
          "You can track your order in real time through the DeliGo app or website from pickup to delivery.",
      },
      {
        question: "What payment methods are accepted?",
        answer:
          "DeliGo accepts debit cards, credit cards, digital wallets, and other secure online payment methods.",
      },
      {
        question: "Can I schedule an order for later?",
        answer:
          "Yes. Customers can place scheduled orders for future delivery based on merchant availability.",
      },
      {
        question: "Can I cancel my order?",
        answer:
          "Orders can be canceled before preparation or dispatch, subject to the cancellation policy.",
      },
      {
        question: "What if my order is missing items?",
        answer:
          "Contact DeliGo Support immediately through the app, website, WhatsApp, or email for assistance.",
      },
      {
        question: "How do I request a refund?",
        answer:
          "Refund requests can be submitted through customer support and will be reviewed according to our refund policy.",
      },
    ],
  },

  {
    id: "merchant",
    title: "Merchant FAQs",
    icon: Store,
    faqs: [
      {
        question: "How can my business join DeliGo?",
        answer:
          "Simply register through the Merchant Portal and complete the onboarding and verification process.",
      },
      {
        question: "What types of businesses can partner with DeliGo?",
        answer:
          "Restaurants, supermarkets, grocery stores, pharmacies, bakeries, florists, retail stores, and many other local businesses.",
      },
      {
        question: "Does DeliGo charge commission fees?",
        answer:
          "Yes. Commission structures vary depending on partnership agreements and service categories.",
      },
      {
        question: "How do merchants receive payments?",
        answer:
          "Payments are securely processed and transferred according to the agreed settlement schedule.",
      },
      {
        question: "Can merchants manage orders online?",
        answer:
          "Yes. Merchants receive access to a dedicated dashboard for order management, sales tracking, analytics, and reports.",
      },
      {
        question: "Does DeliGo help promote my business?",
        answer:
          "Yes. DeliGo offers marketing campaigns, featured listings, promotions, and digital visibility opportunities.",
      },
    ],
  },

  {
    id: "driver",
    title: "Driver & Delivery Partner FAQs",
    icon: Bike,
    faqs: [
      {
        question: "How can I become a delivery partner?",
        answer:
          "You can apply through the DeliGo Driver App or website and complete the required verification process.",
      },
      {
        question: "What documents are required?",
        answer:
          "Requirements may include identification documents, driving license, vehicle documents, insurance, and work authorization.",
      },
      {
        question: "Can I work part-time?",
        answer:
          "Yes. DeliGo offers flexible earning opportunities for both full-time and part-time partners.",
      },
      {
        question: "How are drivers paid?",
        answer:
          "Payments are transferred directly to the registered bank account according to the payment cycle.",
      },
      {
        question: "Can I choose my own working hours?",
        answer:
          "Yes. Delivery partners can choose flexible schedules based on availability.",
      },
    ],
  },

  {
    id: "ride",
    title: "Ride & Fleet Management",
    icon: Car,
    faqs: [
      {
        question: "What is DeliGo Ride?",
        answer:
          "DeliGo Ride is an upcoming ride-hailing service that connects passengers with licensed drivers through a secure mobile platform.",
      },
      {
        question: "Will DeliGo Ride offer airport transfers?",
        answer:
          "Yes. Airport transfers and scheduled rides will be available.",
      },
      {
        question: "How will passenger safety be ensured?",
        answer:
          "Safety features include driver verification, GPS tracking, ride monitoring, emergency assistance, and customer support.",
      },
      {
        question: "What is DeliGo Fleet Management?",
        answer:
          "A smart platform designed to help businesses manage vehicles, drivers, routes, performance, and operational efficiency.",
      },
      {
        question: "Who can use DeliGo Fleet Management?",
        answer:
          "Logistics companies, transportation providers, delivery businesses, and enterprise fleets.",
      },
      {
        question: "Does DeliGo provide vehicle tracking?",
        answer:
          "Yes. Real-time vehicle tracking and performance monitoring are available through the fleet dashboard.",
      },
    ],
  },

  {
    id: "security",
    title: "Security, Privacy & Innovation",
    icon: Shield,
    faqs: [
      {
        question: "Is my personal information secure?",
        answer:
          "Yes. DeliGo follows industry-standard security practices and data protection regulations.",
      },
      {
        question: "Are online payments secure?",
        answer:
          "Absolutely. All transactions are encrypted and processed through secure payment gateways.",
      },
      {
        question: "Does DeliGo share customer information?",
        answer:
          "No. Customer data is protected and handled according to our Privacy Policy and applicable laws.",
      },
      {
        question: "What future services will DeliGo introduce?",
        answer:
          "Future services include DeliGo Ride, electric mobility solutions, advanced logistics services, fleet technology, and AI-powered delivery optimization.",
      },
      {
        question: "What makes DeliGo different?",
        answer:
          "DeliGo combines delivery, logistics, mobility, and fleet management services into one integrated platform, creating a complete ecosystem for customers and businesses.",
      },
      {
        question: "How can I stay updated about DeliGo?",
        answer:
          "Visit our website, follow our social media channels, or subscribe to our updates and newsletters.",
      },
    ],
  },
];

function FAQItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
      >
        <span className="font-semibold text-slate-900">
          {question}
        </span>

        <ChevronDown
          className={`h-5 w-5 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-4 text-slate-600">
          {answer}
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  const [search, setSearch] = useState("");

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return faqCategories;

    return faqCategories
      .map((category) => ({
        ...category,
        faqs: category.faqs.filter(
          (faq) =>
            faq.question
              .toLowerCase()
              .includes(search.toLowerCase()) ||
            faq.answer
              .toLowerCase()
              .includes(search.toLowerCase())
        ),
      }))
      .filter((category) => category.faqs.length);
  }, [search]);

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-[#E91E7F]">
        <div className="mx-auto max-w-7xl px-6 py-20 text-center">
          <Image
            src="/deligo-logo.png"
            alt="DeliGo"
            width={120}
            height={120}
            className="mx-auto mb-8 rounded-xl bg-white p-2"
          />

          <h1 className="text-4xl font-bold text-white md:text-6xl">
            Frequently Asked Questions
          </h1>

          <p className="mt-4 text-lg text-pink-100">
            Everything you need to know about the
            DeliGo Ecosystem
          </p>

          <div className="mx-auto mt-10 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search FAQs..."
                className="h-14 w-full rounded-2xl border-0 bg-white pl-12 pr-4 text-slate-900 outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Category Cards */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {faqCategories.map((category) => {
            const Icon = category.icon;

            return (
              <div
                key={category.id}
                className="rounded-3xl border border-slate-200 p-6 transition hover:shadow-lg"
              >
                <Icon className="mb-4 h-8 w-8 text-[#E91E7F]" />

                <h3 className="mb-2 text-xl font-bold">
                  {category.title}
                </h3>

                <p className="text-slate-500">
                  {category.faqs.length} Questions
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* FAQs */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="space-y-12">
          {filteredCategories.map((category) => {
            const Icon = category.icon;

            return (
              <div key={category.id}>
                <div className="mb-6 flex items-center gap-3">
                  <Icon className="h-7 w-7 text-[#E91E7F]" />

                  <h2 className="text-3xl font-bold text-[#E91E7F]">
                    {category.title}
                  </h2>
                </div>

                <div className="space-y-4">
                  {category.faqs.map((faq) => (
                    <FAQItem
                      key={faq.question}
                      question={faq.question}
                      answer={faq.answer}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Contact */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <div className="mb-10 flex items-center gap-3">
              <CircleHelp className="h-8 w-8 text-[#E91E7F]" />
              <h2 className="text-3xl font-bold">
                Contact Us
              </h2>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              <div className="space-y-5">
                <div className="flex gap-3">
                  <Globe className="h-5 w-5 text-[#E91E7F]" />
                  <span>www.deligo.pt</span>
                </div>

                <div className="flex gap-3">
                  <Mail className="h-5 w-5 text-[#E91E7F]" />
                  <span>contact@deligo.pt</span>
                </div>

                <div className="flex gap-3">
                  <MessageCircle className="h-5 w-5 text-[#E91E7F]" />
                  <span>+351 920 136 680</span>
                </div>

                <div className="flex gap-3">
                  <Phone className="h-5 w-5 text-[#E91E7F]" />
                  <span>+351 217 570 184</span>
                </div>
              </div>

              <div className="flex gap-3">
                <MapPin className="mt-1 h-5 w-5 text-[#E91E7F]" />

                <div>
                  Rua Joaquim Agostinho 16C
                  <br />
                  1750-126 Lisboa
                  <br />
                  Portugal
                </div>
              </div>
            </div>

            <div className="mt-10 rounded-2xl bg-[#E91E7F] p-8 text-center text-white">
              <Sparkles className="mx-auto mb-4 h-8 w-8" />

              <p className="text-xl font-semibold">
                DeliGo – Delivering Convenience,
                Empowering Communities.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}