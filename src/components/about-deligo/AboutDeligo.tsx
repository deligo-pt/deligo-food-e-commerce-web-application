/* eslint-disable react/no-unescaped-entities */
"use client";

import {
  Bike,
  Building2,
  ChartColumn,
  Clock3,
  Handshake,
  Leaf,
  Package,
  ShieldCheck,
  Store,
  Truck,
  Users,
  Zap,
} from "lucide-react";
import Image from "next/image";

export default function AboutDeliGo() {
  const services = [
    "Food Delivery",
    "Grocery Delivery",
    "Courier & Parcel Services",
    "Last-Mile Logistics",
    "Fleet Management Solutions",
    "DeliGo Ride Mobility Platform",
  ];

  const advantages = [
    {
      icon: <Store className="h-6 w-6" />,
      title: "Empowering Local Businesses",
      description:
        "Helping restaurants, supermarkets, pharmacies, retailers, and local merchants grow through digital transformation.",
    },
    {
      icon: <Clock3 className="h-6 w-6" />,
      title: "Real-Time Visibility",
      description:
        "Track orders, deliveries, and fleet operations in real time.",
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Flexible Earning Opportunities",
      description:
        "Income opportunities for delivery partners, drivers, fleet owners, and contractors.",
    },
    {
      icon: <Truck className="h-6 w-6" />,
      title: "Smart Logistics Network",
      description:
        "Intelligent dispatch and route optimization systems improve efficiency.",
    },
    {
      icon: <ChartColumn className="h-6 w-6" />,
      title: "Business Growth Partner",
      description:
        "Powerful tools, analytics, marketing support, and logistics solutions.",
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: "Customer-Centric Innovation",
      description:
        "Every feature is built around convenience, reliability, and satisfaction.",
    },
    {
      icon: <Building2 className="h-6 w-6" />,
      title: "Data-Driven Decision Making",
      description:
        "Analytics and insights continuously improve operational performance.",
    },
    {
      icon: <Package className="h-6 w-6" />,
      title: "Scalable Infrastructure",
      description:
        "Built to support rapid expansion across cities and countries.",
    },
    {
      icon: <Leaf className="h-6 w-6" />,
      title: "Sustainability Commitment",
      description:
        "Supporting environmentally responsible delivery operations.",
    },
    {
      icon: <Handshake className="h-6 w-6" />,
      title: "Community Impact",
      description:
        "Strengthening local economies through meaningful connections.",
    },
  ];

  const values = [
    {
      title: "Innovation",
      text: "Continuously developing smarter solutions.",
    },
    {
      title: "Reliability",
      text: "Delivering on our promises every time.",
    },
    {
      title: "Integrity",
      text: "Building trust through transparency and accountability.",
    },
    {
      title: "Customer Success",
      text: "Putting customers at the center of everything we do.",
    },
    {
      title: "Excellence",
      text: "Striving for the highest standards in service and operations.",
    },
    {
      title: "Sustainability",
      text: "Supporting responsible growth and environmental awareness.",
    },
  ];

  const missionItems = [
    "Simplify everyday life through technology.",
    "Deliver exceptional customer experiences.",
    "Empower local businesses to thrive digitally.",
    "Create sustainable earning opportunities.",
    "Build a reliable and intelligent logistics network.",
    "Drive innovation in mobility and delivery services.",
    "Expand across European markets with scalable solutions.",
  ];

  return (
    <main className="bg-white text-slate-800">
      {/* HERO */}
      <section className="bg-[#e91e7f] text-white">
        <div className="mx-auto max-w-7xl px-6 py-20 text-center">
          <Image
            src="/deligo-logo.png"
            alt="DeliGo"
            className="mx-auto mb-8 h-32 w-32 rounded-lg bg-white object-contain p-2 shadow-xl"
            width={128}
            height={128}
          />

          <h1 className="text-4xl font-bold md:text-6xl">About DeliGo</h1>

          <p className="mt-5 text-lg italic text-pink-100 md:text-2xl">
            Delivering Convenience, Connecting Communities
          </p>
        </div>
      </section>

      {/* ABOUT */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="rounded-2xl border-l-4 border-[#e91e7f] bg-pink-50 p-8 md:p-10">
          <div className="space-y-6 text-lg leading-8 text-slate-700">
            <p>
              <strong>DeliGo</strong> is a next-generation digital platform that
              brings together food delivery, grocery shopping, courier services,
              logistics solutions, and future mobility services into one
              powerful ecosystem. We are committed to transforming how people,
              businesses, and communities connect by providing fast, reliable,
              and technology-driven services across Portugal and beyond.
            </p>

            <p>
              More than a delivery company, DeliGo is a technology platform
              built to solve everyday challenges. Whether it's delivering a meal
              within minutes, helping local merchants reach more customers,
              supporting businesses with logistics solutions, or creating new
              earning opportunities for drivers and delivery partners, DeliGo is
              designed to make life easier and business more efficient.
            </p>

            <p>
              Our platform combines innovation, intelligent logistics, real-time
              tracking, secure digital payments, and customer-focused service to
              ensure a seamless experience for everyone who uses DeliGo.
            </p>
          </div>
        </div>
      </section>

      {/* DIFFERENT */}
      <section className="mx-auto max-w-7xl px-6 pb-16">
        <h2 className="mb-10 text-3xl font-bold text-[#e91e7f]">
          What Makes DeliGo Different?
        </h2>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-8 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <Package className="h-6 w-6 text-[#e91e7f]" />
              <h3 className="text-2xl font-bold text-[#e91e7f]">
                All-in-One Service Ecosystem
              </h3>
            </div>

            <p className="mb-6 text-slate-600">
              A comprehensive suite of integrated everyday services tailored for
              modern needs:
            </p>

            <ul className="space-y-3">
              {services.map((service) => (
                <li
                  key={service}
                  className="flex items-center gap-3 font-medium"
                >
                  <span className="h-2 w-2 rounded-full bg-[#e91e7f]" />
                  {service}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border bg-white p-8 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <Zap className="h-6 w-6 text-[#e91e7f]" />
              <h3 className="text-2xl font-bold text-[#e91e7f]">
                Technology-Driven Operations
              </h3>
            </div>

            <p className="text-lg leading-8 text-slate-600">
              Advanced software and automation help optimize deliveries, routes,
              driver performance, and customer experiences.
            </p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="mb-12 text-center text-3xl font-bold text-[#e91e7f]">
            Delivering Convenience, Connecting Communities
          </h2>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {advantages.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mb-4 text-[#e91e7f]">{item.icon}</div>

                <h3 className="mb-3 text-xl font-bold">{item.title}</h3>

                <p className="text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VISION & MISSION */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="mb-6 text-3xl font-bold text-[#e91e7f]">
              Our Vision
            </h2>

            <p className="text-lg leading-8 text-slate-700">
              To become one of Europe's most trusted and innovative delivery,
              logistics, and mobility ecosystems, creating smarter connections
              between people, businesses, and communities.
            </p>

            <div className="mt-12">
              <h2 className="mb-6 text-3xl font-bold text-[#e91e7f]">
                Our Core Values
              </h2>

              <div className="space-y-5">
                {values.map((value) => (
                  <div key={value.title}>
                    <p className="text-lg">
                      <span className="font-bold">{value.title}</span> –{" "}
                      {value.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-6 text-3xl font-bold text-[#e91e7f]">
              Our Mission
            </h2>

            <ul className="space-y-4">
              {missionItems.map((item) => (
                <li key={item} className="flex items-start gap-3 text-lg">
                  <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-[#e91e7f]" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-12 flex justify-center">
              <Bike className="h-32 w-32 text-pink-200" />
            </div>
          </div>
        </div>
      </section>

      {/* PROMISE */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="rounded-3xl bg-[#e91e7f] px-8 py-14 text-center text-white shadow-xl">
          <h2 className="text-4xl font-bold uppercase">DeliGo Promise</h2>

          <p className="mt-5 text-3xl font-bold italic">
            "Fast. Reliable. Connected."
          </p>

          <p className="mx-auto mt-8 max-w-4xl text-lg leading-8 text-pink-100">
            At DeliGo, we don't just deliver products. We deliver convenience,
            opportunity, growth, and meaningful connections that improve
            everyday life. Our goal is to become the platform people trust
            whenever they need something delivered, transported, or connected.
          </p>
        </div>
      </section>
    </main>
  );
}
