"use client";

import Link from "next/link";

const categories = [
  { name: "Rides", icon: "🚗", href: "/terms/rides" },
  { name: "Micromobility", icon: "🛴", href: "/terms/micromobility" },
  { name: "DeliGo Drive", icon: "🚕", href: "/terms/drive" },
  { name: "Delivery", icon: "🍔", href: "/terms/delivery" },
  { name: "Insurance", icon: "🛡️", href: "/terms/insurance" },
  { name: "DeliGo Business", icon: "💼", href: "/terms/business" },
  { name: "Vendors", icon: "🏪", href: "/terms/vendors" },
  { name: "Other", icon: "📄", href: "/terms/other" },
];

const customerTerms = [
  {
    icon: "👤",
    title: "Account Registration",
    text: "To use DeliGo services, you must create an accurate account. You are responsible for maintaining the confidentiality of your login credentials. DeliGo reserves the right to suspend accounts with false information.",
  },
  {
    icon: "💳",
    title: "Payments & Fees",
    text: "All payments are processed securely. By using DeliGo, you agree to pay all fees associated with your orders, rides, or deliveries. DeliGo may charge a service fee, which will be clearly shown before checkout.",
  },
  {
    icon: "🕒",
    title: "Cancellations & Refunds",
    text: "Cancellation policies vary by service (rides, food, etc.). Refunds are issued at DeliGo's discretion based on the specific circumstances. Please review the cancellation policy before confirming an order.",
  },
  {
    icon: "📦",
    title: "Delivery & Service Standards",
    text: "DeliGo strives to provide timely and accurate services. However, we are not liable for delays caused by weather, traffic, or other force majeure events. Estimated delivery times are not guaranteed.",
  },
  {
    icon: "⚖️",
    title: "Prohibited Conduct",
    text: "You agree not to misuse DeliGo services, including fraud, harassment, or violating any laws. DeliGo may terminate your account for such behavior without prior notice.",
  },
  {
    icon: "🔒",
    title: "Privacy & Data Protection",
    text: "Your personal data is handled according to our Privacy Policy and applicable laws (GDPR). DeliGo will never sell your data to third parties without your explicit consent.",
  },
  {
    icon: "🤝",
    title: "Dispute Resolution",
    text: "Any disputes shall first be attempted to be resolved amicably through DeliGo support. If unresolved, disputes will be subject to the laws of Portugal and exclusive jurisdiction of its courts.",
  },
  {
    icon: "✏️",
    title: "Amendments",
    text: "DeliGo may update these Terms from time to time. Continued use of the platform after changes constitutes acceptance. You will be notified of material changes via email or in-app notification.",
  },
];

const CategoryCard = ({
  name,
  icon,
  href,
}: {
  name: string;
  icon: string;
  href: string;
}) => (
  <Link
    href={href}
    className="group bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
  >
    <div className="flex items-center gap-3 mb-2">
      <span className="text-2xl">{icon}</span>
      <span className="text-xl font-semibold text-gray-800">{name}</span>
    </div>
    <p className="text-sm text-gray-500">Terms and Conditions</p>
  </Link>
);

const TermCard = ({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) => (
  <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 hover:shadow-md transition">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 text-xl">
        {icon}
      </div>
      <h4 className="text-xl font-semibold text-gray-800">{title}</h4>
    </div>
    <p className="text-gray-600 leading-relaxed">{text}</p>
  </div>
);

export default function TermsPage() {
  return (
    <main className="bg-gray-50 text-gray-900">
      {/* Hero Section */}
      <section className="relative py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight">
            Terms and Conditions
          </h1>
        </div>
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Introduction */}
        <div className="max-w-3xl mb-16">
          <h2 className="text-3xl font-bold mb-4">
            Customer Terms &amp; Conditions
          </h2>
          <p className="text-lg text-gray-600">
            By using DeliGo products and services as a customer, you agree to
            the applicable terms below. Choose a category to view the detailed
            terms for that product.
          </p>
        </div>

        {/* Categories Grid */}
        <section className="mb-24">
          <h3 className="text-2xl font-bold mb-8 text-gray-700">Categories</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((cat) => (
              <CategoryCard key={cat.name} {...cat} />
            ))}
          </div>
        </section>

        {/* Customer Terms Section */}
        <section className="bg-white rounded-2xl shadow-md p-6 md:p-10 lg:p-12">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Customer Terms &amp; Conditions
            </h2>
            <p className="text-gray-600">
              Please read these terms carefully. They govern your use of DeliGo
              services as a customer.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {customerTerms.map((term, idx) => (
              <TermCard key={idx} {...term} />
            ))}
          </div>

          {/* CTA Button */}
          <div className="text-center mt-12">
            <p className="text-gray-600 mb-6">
              Have questions? Contact our support team anytime.
            </p>
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full transition transform active:scale-95 shadow-md">
              Contact Support
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
