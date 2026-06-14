"use client";

import { Shield } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

// Helper Components (same as before)
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="block border border-gray-200 rounded-md py-2 px-3 text-sm text-gray-600 hover:border-pink-500 hover:text-pink-600 transition-colors text-center"
    >
      {children}
    </a>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 mb-12">
      <h2 className="text-2xl md:text-3xl font-bold mt-8 mb-4">{title}</h2>
      <div className="text-gray-600 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
      <h3 className="text-lg font-semibold mb-3 text-gray-800">{title}</h3>
      {children}
    </div>
  );
}

export default function PrivacyPolicyPage() {
  const { t } = useTranslation();

  return (
    <main className="bg-white text-gray-900">
      {/* Hero Section */}
      <section className="bg-gray-50 py-16 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
            {t("privacyHeroTitle")}
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl">
            {t("privacyHeroDescription")}
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
                <NavLink href="#who-we-are">{t("privacyNavWhoWeAre")}</NavLink>
                <NavLink href="#data-we-collect">{t("privacyNavDataCollect")}</NavLink>
                <NavLink href="#how-we-use">{t("privacyNavHowWeUse")}</NavLink>
                <NavLink href="#legal-bases">{t("privacyNavLegalBases")}</NavLink>
                <NavLink href="#sharing">{t("privacyNavSharing")}</NavLink>
                <NavLink href="#cookies">{t("privacyNavCookies")}</NavLink>
                <NavLink href="#retention">{t("privacyNavRetention")}</NavLink>
                <NavLink href="#rights">{t("privacyNavRights")}</NavLink>
                <NavLink href="#security">{t("privacyNavSecurity")}</NavLink>
                <NavLink href="#international">{t("privacyNavInternational")}</NavLink>
                <NavLink href="#children">{t("privacyNavChildren")}</NavLink>
                <NavLink href="#changes">{t("privacyNavChanges")}</NavLink>
                <NavLink href="#deletion">{t("privacyNavDeletion")}</NavLink>
                <a
                  href="mailto:info@deligoeu.com"
                  className="block w-full bg-blue-600 text-white rounded-md py-2.5 px-4 text-sm text-center font-bold hover:bg-blue-700 transition-colors mt-4"
                >
                  {t("privacyNavContact")}
                </a>
              </nav>
            </div>
          </aside>

          {/* Main Content Area */}
          <article className="flex-1 max-w-3xl">
            {/* Mobile Navigation */}
            <div className="lg:hidden mb-8">
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-4">
                  On this page
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <NavLink href="#who-we-are">{t("privacyNavWhoWeAre")}</NavLink>
                  <NavLink href="#data-we-collect">{t("privacyNavDataCollect")}</NavLink>
                  <NavLink href="#how-we-use">{t("privacyNavHowWeUse")}</NavLink>
                  <NavLink href="#legal-bases">{t("privacyNavLegalBases")}</NavLink>
                  <NavLink href="#sharing">{t("privacyNavSharing")}</NavLink>
                  <NavLink href="#cookies">{t("privacyNavCookies")}</NavLink>
                  <NavLink href="#retention">{t("privacyNavRetention")}</NavLink>
                  <NavLink href="#rights">{t("privacyNavRights")}</NavLink>
                  <NavLink href="#security">{t("privacyNavSecurity")}</NavLink>
                  <NavLink href="#international">{t("privacyNavInternational")}</NavLink>
                  <NavLink href="#children">{t("privacyNavChildren")}</NavLink>
                  <NavLink href="#changes">{t("privacyNavChanges")}</NavLink>
                  <NavLink href="#deletion">{t("privacyNavDeletion")}</NavLink>
                  <a
                    href="mailto:info@deligoeu.com"
                    className="bg-blue-600 text-white rounded-md py-2 px-3 text-sm text-center font-bold hover:bg-blue-700 transition-colors col-span-2 sm:col-span-1"
                  >
                    {t("privacyNavContact")}
                  </a>
                </div>
              </div>
            </div>

            {/* Sections with flat list items */}
            <Section id="who-we-are" title={t("privacyWhoWeAreTitle")}>
              <p>{t("privacyWhoWeAreText")}</p>
            </Section>

            <Section id="data-we-collect" title={t("privacyDataCollectTitle")}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
                <Card title={t("privacyDataYouProvideTitle")}>
                  <ul className="list-disc pl-5 space-y-1 text-gray-600">
                    <li>{t("privacyDataYouProvide1")}</li>
                    <li>{t("privacyDataYouProvide2")}</li>
                    <li>{t("privacyDataYouProvide3")}</li>
                    <li>{t("privacyDataYouProvide4")}</li>
                  </ul>
                </Card>
                <Card title={t("privacyDataAutoTitle")}>
                  <ul className="list-disc pl-5 space-y-1 text-gray-600">
                    <li>{t("privacyDataAuto1")}</li>
                    <li>{t("privacyDataAuto2")}</li>
                    <li>{t("privacyDataAuto3")}</li>
                    <li>{t("privacyDataAuto4")}</li>
                  </ul>
                </Card>
              </div>
              <p className="text-sm italic text-gray-400">{t("privacyDataThirdPartyNote")}</p>
            </Section>

            <Section id="how-we-use" title={t("privacyHowUseTitle")}>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>{t("privacyHowUse1")}</li>
                <li>{t("privacyHowUse2")}</li>
                <li>{t("privacyHowUse3")}</li>
                <li>{t("privacyHowUse4")}</li>
                <li>{t("privacyHowUse5")}</li>
                <li>{t("privacyHowUse6")}</li>
              </ul>
            </Section>

            <Section id="legal-bases" title={t("privacyLegalBasesTitle")}>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>{t("privacyLegalBases1")}</li>
                <li>{t("privacyLegalBases2")}</li>
                <li>{t("privacyLegalBases3")}</li>
                <li>{t("privacyLegalBases4")}</li>
              </ul>
            </Section>

            <Section id="sharing" title={t("privacySharingTitle")}>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>{t("privacySharing1")}</li>
                <li>{t("privacySharing2")}</li>
                <li>{t("privacySharing3")}</li>
                <li>{t("privacySharing4")}</li>
              </ul>
            </Section>

            <Section id="cookies" title={t("privacyCookiesTitle")}>
              <p>{t("privacyCookiesText")}</p>
            </Section>

            <Section id="retention" title={t("privacyRetentionTitle")}>
              <p>{t("privacyRetentionText")}</p>
            </Section>

            <Section id="security" title={t("privacySecurityTitle")}>
              <p>{t("privacySecurityText")}</p>
            </Section>

            <Section id="international" title={t("privacyInternationalTitle")}>
              <p>{t("privacyInternationalText")}</p>
            </Section>

            <Section id="rights" title={t("privacyRightsTitle")}>
              <p className="mb-4">{t("privacyRightsLead")}</p>
              <ul className="list-disc pl-5 mb-6 space-y-1 text-gray-600">
                <li>{t("privacyRights1")}</li>
                <li>{t("privacyRights2")}</li>
                <li>{t("privacyRights3")}</li>
                <li>{t("privacyRights4")}</li>
              </ul>
              <p>{t("privacyRightsContact")}</p>
            </Section>

            <Section id="deletion" title={t("privacyDeletionTitle")}>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-6 my-4">
                <p className="mb-4">{t("privacyDeletionText")}</p>
                <p className="mb-4 italic">{t("privacyDeletionRequestText")}</p>
                <button className="bg-red-500 text-white px-6 py-2.5 rounded-md font-bold hover:bg-red-700 transition-colors shadow-md">
                  {t("privacyDeletionButton")}
                </button>
                <p className="mt-4 text-xs text-gray-400">{t("privacyDeletionNote")}</p>
              </div>
            </Section>

            <Section id="children" title={t("privacyChildrenTitle")}>
              <p>{t("privacyChildrenText")}</p>
            </Section>

            <Section id="changes" title={t("privacyChangesTitle")}>
              <p className="mb-6">{t("privacyChangesText")}</p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-gray-600 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm mb-1">
                      {t("privacyChangesDataProtectionTitle")}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {t("privacyChangesDataProtectionText")}
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