"use client";

import { Shield } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";

// Helper Components (same as before)
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="block border border-border rounded-md py-2 px-3 text-sm text-gray-600 dark:text-neutral-400 hover:border-primary hover:text-primary dark:hover:text-pink-500 transition-colors text-center bg-transparent"
    >
      {children}
    </a>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 mb-12">
      {/* The chapter gap was 80: `mb-12` on the section below plus `mt-8` on
          this heading — two elements each paying in full for one gap, which is
          the third place that shape has turned up (`/terms`' hero, and the
          cuisine strip's clearance). The section owns it, at §1.2's 48. The
          heading keeps only the 24 between itself and its own body. */}
      <h2 className="text-2xl lg:text-display font-bold mb-6 text-slate-900 dark:text-neutral-50">{title}</h2>
      <div className="text-gray-600 dark:text-neutral-300 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-xl p-4 bg-card shadow-sm dark:shadow-none">
      <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-neutral-200">{title}</h3>
      {children}
    </div>
  );
}

export default function PrivacyPolicyPage() {
  const { t } = useTranslation();

  return (
    <main className="bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 transition-colors duration-200">
      {/* Hero Section */}
      <section className="bg-gray-50 dark:bg-neutral-900/50 py-16 border-b border-border">
        <div className="max-w-6xl mx-auto px-6">
          <h1 className="text-display font-extrabold text-gray-900 dark:text-neutral-50 mb-6">
            {t("privacyHeroTitle")}
          </h1>
          <p className="text-base text-gray-500 dark:text-neutral-400 max-w-2xl">
            {t("privacyHeroDescription")}
          </p>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Sidebar Navigation - Desktop sticky */}
          <aside className="lg:w-80 shrink-0">
            <div className="lg:sticky lg:top-24 bg-card border border-border rounded-xl p-6 shadow-sm dark:shadow-none">
              <span className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider block mb-4">
                {t("onThisPage")}
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
                  className="block w-full bg-primary text-white rounded-md py-2.5 px-4 text-sm text-center font-bold hover:bg-primary-hover transition-colors mt-4"
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
              <div className="bg-card border border-border rounded-xl p-6 shadow-sm dark:shadow-none">
                <span className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider block mb-4">
                  {t("onThisPage")}
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
                    className="bg-primary text-white rounded-md py-2 px-3 text-sm text-center font-bold hover:bg-primary-hover transition-colors col-span-2 sm:col-span-1 flex items-center justify-center"
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
                  <ul className="list-disc pl-4 space-y-1 text-gray-600 dark:text-neutral-400">
                    <li>{t("privacyDataYouProvide1")}</li>
                    <li>{t("privacyDataYouProvide2")}</li>
                    <li>{t("privacyDataYouProvide3")}</li>
                    <li>{t("privacyDataYouProvide4")}</li>
                  </ul>
                </Card>
                <Card title={t("privacyDataAutoTitle")}>
                  <ul className="list-disc pl-4 space-y-1 text-gray-600 dark:text-neutral-400">
                    <li>{t("privacyDataAuto1")}</li>
                    <li>{t("privacyDataAuto2")}</li>
                    <li>{t("privacyDataAuto3")}</li>
                    <li>{t("privacyDataAuto4")}</li>
                  </ul>
                </Card>
              </div>
              <p className="text-sm italic text-gray-400 dark:text-neutral-500">{t("privacyDataThirdPartyNote")}</p>
            </Section>

            <Section id="how-we-use" title={t("privacyHowUseTitle")}>
              <ul className="list-disc pl-4 space-y-1 text-gray-600 dark:text-neutral-300">
                <li>{t("privacyHowUse1")}</li>
                <li>{t("privacyHowUse2")}</li>
                <li>{t("privacyHowUse3")}</li>
                <li>{t("privacyHowUse4")}</li>
                <li>{t("privacyHowUse5")}</li>
                <li>{t("privacyHowUse6")}</li>
              </ul>
            </Section>

            <Section id="legal-bases" title={t("privacyLegalBasesTitle")}>
              <ul className="list-disc pl-4 space-y-1 text-gray-600 dark:text-neutral-300">
                <li>{t("privacyLegalBases1")}</li>
                <li>{t("privacyLegalBases2")}</li>
                <li>{t("privacyLegalBases3")}</li>
                <li>{t("privacyLegalBases4")}</li>
              </ul>
            </Section>

            <Section id="sharing" title={t("privacySharingTitle")}>
              <ul className="list-disc pl-4 space-y-1 text-gray-600 dark:text-neutral-300">
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
              <p className="mb-4 text-gray-600 dark:text-neutral-300">{t("privacyRightsLead")}</p>
              <ul className="list-disc pl-4 mb-6 space-y-1 text-gray-600 dark:text-neutral-300">
                <li>{t("privacyRights1")}</li>
                <li>{t("privacyRights2")}</li>
                <li>{t("privacyRights3")}</li>
                <li>{t("privacyRights4")}</li>
              </ul>
              <p>{t("privacyRightsContact")}</p>
            </Section>

            <Section id="deletion" title={t("privacyDeletionTitle")}>
              <div className="bg-gray-50 dark:bg-neutral-900 border border-border rounded-xl p-6 my-4">
                <p className="mb-4">{t("privacyDeletionText")}</p>
                <p className="mb-4 italic text-gray-600 dark:text-neutral-400">{t("privacyDeletionRequestText")}</p>
                <Button className="rounded-md bg-red-500 font-bold shadow-md hover:bg-red-700">
                  {t("privacyDeletionButton")}
                </Button>
                <p className="mt-4 text-xs text-gray-400 dark:text-neutral-500">{t("privacyDeletionNote")}</p>
              </div>
            </Section>

            <Section id="children" title={t("privacyChildrenTitle")}>
              <p>{t("privacyChildrenText")}</p>
            </Section>

            <Section id="changes" title={t("privacyChangesTitle")}>
              <p className="mb-6">{t("privacyChangesText")}</p>
              <div className="bg-gray-50 dark:bg-neutral-900 border border-border rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-gray-600 dark:text-neutral-400 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-neutral-100 text-sm mb-1">
                      {t("privacyChangesDataProtectionTitle")}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-neutral-400">
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