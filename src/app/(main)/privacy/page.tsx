/* eslint-disable react/no-unescaped-entities */
// app/privacy/page.tsx
"use client";

import { Shield } from "lucide-react";
// Helper Components
function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="block border border-gray-200 rounded-md py-2 px-3 text-sm text-gray-600 hover:border-pink-500 hover:text-pink-600 transition-colors text-center"
    >
      {children}
    </a>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 mb-12">
      <h2 className="text-2xl md:text-3xl font-bold mt-8 mb-4">{title}</h2>
      <div className="text-gray-600 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
      <h3 className="text-lg font-semibold mb-3 text-gray-800">{title}</h3>
      {children}
    </div>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="bg-white text-gray-900">
      {/* Hero Section */}
      <section className="bg-gray-50 py-16 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
            Privacy Policy
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl">
            This Privacy Policy explains how DeliGo ("DeliGo", "we", "us", or
            "our") collects, uses, discloses, and safeguards your information
            when you use our websites, apps, and services.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Sidebar Navigation - Desktop sticky */}
          <aside className="lg:w-80 shrink-0">
            <div className="lg:sticky lg:top-24 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-4">
                On this page
              </span>
              <nav className="space-y-2">
                <NavLink href="#who-we-are">Who we are</NavLink>
                <NavLink href="#data-we-collect">Data we collect</NavLink>
                <NavLink href="#how-we-use">How we use</NavLink>
                <NavLink href="#legal-bases">Legal bases</NavLink>
                <NavLink href="#sharing">Sharing</NavLink>
                <NavLink href="#cookies">Cookies</NavLink>
                <NavLink href="#retention">Retention</NavLink>
                <NavLink href="#rights">Your rights</NavLink>
                <NavLink href="#security">Security</NavLink>
                <NavLink href="#international">International transfers</NavLink>
                <NavLink href="#children">Children</NavLink>
                <NavLink href="#changes">Changes</NavLink>
                <NavLink href="#deletion">Delete Account</NavLink>
                <a
                  href="mailto:info@deligoeu.com"
                  className="block w-full bg-blue-600 text-white rounded-md py-2.5 px-4 text-sm text-center font-bold hover:bg-blue-700 transition-colors mt-4"
                >
                  Contact us
                </a>
              </nav>
            </div>
          </aside>

          {/* Main Content Area */}
          <article className="flex-1 max-w-3xl">
            {/* Mobile Navigation (shown below lg) */}
            <div className="lg:hidden mb-8">
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-4">
                  On this page
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <NavLink href="#who-we-are">Who we are</NavLink>
                  <NavLink href="#data-we-collect">Data we collect</NavLink>
                  <NavLink href="#how-we-use">How we use</NavLink>
                  <NavLink href="#legal-bases">Legal bases</NavLink>
                  <NavLink href="#sharing">Sharing</NavLink>
                  <NavLink href="#cookies">Cookies</NavLink>
                  <NavLink href="#retention">Retention</NavLink>
                  <NavLink href="#rights">Your rights</NavLink>
                  <NavLink href="#security">Security</NavLink>
                  <NavLink href="#international">
                    International transfers
                  </NavLink>
                  <NavLink href="#children">Children</NavLink>
                  <NavLink href="#changes">Changes</NavLink>
                  <NavLink href="#deletion">Delete Account</NavLink>
                  <a
                    href="mailto:info@deligoeu.com"
                    className="bg-blue-600 text-white rounded-md py-2 px-3 text-sm text-center font-bold hover:bg-blue-700 transition-colors col-span-2 sm:col-span-1"
                  >
                    Contact us
                  </a>
                </div>
              </div>
            </div>

            {/* Sections */}
            <Section id="who-we-are" title="1) Who we are">
              <p>
                DeliGo LDA is the data controller for personal data processed
                via our websites, apps and platforms (collectively, the
                "Services"). Registered office: [add company address]. Contact:
                info@deligoeu.com. If you access DeliGo through a business or
                fleet partner, that partner may be an independent controller for
                its own processing.
              </p>
            </Section>

            <Section id="data-we-collect" title="2) Data we collect">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
                <Card title="Information you provide">
                  <ul className="list-disc pl-5 space-y-1 text-gray-600">
                    <li>Account details (name, email, phone, password).</li>
                    <li>
                      Profile and verification data (ID, TVDE/driver licence,
                      vehicle docs, vendor/business info).
                    </li>
                    <li>
                      Addresses, delivery instructions, support messages,
                      reviews.
                    </li>
                    <li>
                      Payment details (tokenized by our payment processors; we
                      don't store full card numbers).
                    </li>
                  </ul>
                </Card>
                <Card title="Information we collect automatically">
                  <ul className="list-disc pl-5 space-y-1 text-gray-600">
                    <li>
                      Device and log data (IP, browser, OS version, app version,
                      timestamps, crash logs).
                    </li>
                    <li>
                      Usage data (pages viewed, features used, referral URLs,
                      campaign attribution).
                    </li>
                    <li>
                      Approximate or precise location when you allow location
                      services (for rides/deliveries).
                    </li>
                    <li>
                      Cookies, pixels and similar technologies (see Cookies).
                    </li>
                  </ul>
                </Card>
              </div>
              <p className="text-sm italic text-gray-400">
                We may also receive data from third parties (e.g., identity
                verification services, payment providers, fleet or business
                partners) where lawful.
              </p>
            </Section>

            <Section id="how-we-use" title="3) How we use your information">
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>
                  Provide and operate the Services (account creation, orders,
                  rides, deliveries, payouts).
                </li>
                <li>
                  Verify identity, eligibility and compliance (e.g.,
                  driver/vendor onboarding).
                </li>
                <li>
                  Process payments, prevent fraud and ensure platform safety.
                </li>
                <li>
                  Communicate with you (service messages, support, policy
                  updates, marketing with consent where required).
                </li>
                <li>
                  Improve and personalize the Services, analytics and
                  performance monitoring.
                </li>
                <li>Comply with legal obligations and enforce our Terms.</li>
              </ul>
            </Section>

            <Section
              id="legal-bases"
              title="4) Legal bases for processing (GDPR/EU)"
            >
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>
                  <strong>Contract:</strong> To deliver the Services you request
                  (e.g., rides, deliveries, account &amp; payouts).
                </li>
                <li>
                  <strong>Legitimate interests:</strong> Platform safety, fraud
                  prevention, analytics, product improvement, limited direct
                  marketing.
                </li>
                <li>
                  <strong>Consent:</strong> Where required for marketing,
                  cookies/analytics, or precise location sharing.
                </li>
                <li>
                  <strong>Legal obligation:</strong> Tax, accounting,
                  regulatory, and safety requirements.
                </li>
              </ul>
            </Section>

            <Section id="sharing" title="5) When we share your information">
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>
                  <strong>Service providers (processors):</strong> Cloud
                  hosting, analytics, customer support tools, ID verification,
                  and payment processors—bound by contracts to protect your
                  data.
                </li>
                <li>
                  <strong>Transaction parties:</strong> Drivers, couriers,
                  vendors, fleet or business admins to fulfill your order/ride.
                </li>
                <li>
                  <strong>Legal and safety:</strong> Law enforcement,
                  regulators, or to protect rights, safety and property.
                </li>
                <li>
                  <strong>Corporate events:</strong> In mergers, acquisitions or
                  reorganization, with reasonable notice.
                </li>
              </ul>
            </Section>

            <Section id="cookies" title="6) Cookies & similar technologies">
              <p>
                We use essential cookies to run our site, and optional
                analytics/marketing cookies to understand usage and improve
                performance. You can control non-essential cookies via our
                cookie banner or your browser settings. Blocking some cookies
                may affect functionality.
              </p>
            </Section>

            <Section id="retention" title="7) Data retention">
              <p>
                We keep personal data only as long as necessary for the purposes
                described above—typically for the life of your account and for a
                period required by law (e.g., tax and accounting). When data is
                no longer needed, we securely delete or anonymize it.
              </p>
            </Section>

            <Section id="security" title="8) Security">
              <p>
                We implement administrative, technical, and physical safeguards
                (encryption in transit, access controls, logging,
                least-privilege, regular reviews). No method of transmission or
                storage is 100% secure; we work continuously to enhance our
                protections.
              </p>
            </Section>

            <Section id="international" title="9) International data transfers">
              <p>
                Where data is transferred outside the EEA/UK, we use lawful
                transfer mechanisms such as the European Commission's Standard
                Contractual Clauses and additional safeguards as appropriate.
              </p>
            </Section>

            <Section id="rights" title="10) Your privacy rights">
              <p className="mb-4">
                Depending on your location, you may have the right to:
              </p>
              <ul className="list-disc pl-5 mb-6 space-y-1 text-gray-600">
                <li>Access, correct, or delete your personal data.</li>
                <li>
                  Object to or restrict certain processing, and withdraw consent
                  where we rely on consent.
                </li>
                <li>Receive a portable copy of your data.</li>
                <li>
                  Lodge a complaint with your local data protection authority.
                </li>
              </ul>
              <p>
                To exercise rights, contact us at privacy@deligoeu.com. We may
                need to verify your identity.
              </p>
            </Section>

            <Section id="deletion" title="11) Account Deletion">
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-6 my-4">
                <p className="mb-4">
                  You have the right to request deletion of your DeliGo account
                  and associated personal data. Once your account is deleted,
                  you may lose access to services, history, and stored
                  information.
                </p>
                <p className="mb-4 italic">
                  To request account deletion, please visit our dedicated page:
                </p>
                <button className="bg-red-500 text-white px-6 py-2.5 rounded-md font-bold hover:bg-red-700 transition-colors shadow-md">
                  Request Account Deletion
                </button>
                <p className="mt-4 text-xs text-gray-400">
                  Note: Some data may be retained for legal, tax, or regulatory
                  purposes.
                </p>
              </div>
            </Section>

            <Section id="children" title="12) Children’s privacy">
              <p>
                Our Services are not intended for individuals under 16. We do
                not knowingly collect personal data from children. If you
                believe a child has provided us data, please contact us to
                remove it.
              </p>
            </Section>

            <Section id="changes" title="13) Changes to this policy">
              <p className="mb-6">
                We may update this Privacy Policy from time to time. We will
                post the updated version on this page and adjust the "Last
                updated" date above. Significant changes may be notified via
                email or in-app notice.
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-gray-600 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm mb-1">
                      Data Protection Authority
                    </h4>
                    <p className="text-sm text-gray-600">
                      If you are in the EEA, you can contact your local
                      authority. In Portugal: Comissão Nacional de Proteção de
                      Dados (CNPD).
                    </p>
                  </div>
                </div>
              </div>
            </Section>
          </article>
        </div>
      </div>
    </main>
  );
}
