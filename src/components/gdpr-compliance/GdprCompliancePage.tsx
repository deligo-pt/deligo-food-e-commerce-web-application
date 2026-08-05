"use client";

import { Building2, Landmark, CalendarClock, ShieldCheck } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * The statutory Terms + GDPR text for Pixel Miracle LDA (`/gdpr-compliance`).
 *
 * Deliberately built on the same shell as `/privacy` — hero, sticky sidebar,
 * `Section` blocks — so the three legal pages read as one family rather than
 * three separate designs.
 *
 * Every string is a dictionary key, so the language switcher re-renders this
 * page in place like every other surface. Note `t()` takes a key and nothing
 * else: there is no interpolation in this codebase, so anything that looks like
 * a composed sentence (the "Entity · Jurisdiction · Updated" strip, the DPO
 * mailto line) is composed in JSX from separate keys.
 *
 * Source of truth for the copy is `GDR_complience.md` at the repo root, which
 * holds both languages. If one changes, change both — the page states no
 * precedence between them, so they must not be allowed to diverge.
 */

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="block border border-gray-200 dark:border-neutral-800 rounded-md py-2 px-3 text-sm text-gray-600 dark:text-neutral-400 hover:border-pink-500 hover:text-pink-600 dark:hover:text-pink-500 transition-colors text-center bg-transparent"
    >
      {children}
    </a>
  );
}

function PartHeading({ label, title }: { label: string; title: string }) {
  return (
    <div className="mt-4 mb-10 border-l-4 border-[#f9186b] pl-5">
      <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#f9186b] dark:text-pink-500">
        {label}
      </span>
      <h2 className="mt-1 text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-neutral-50">
        {title}
      </h2>
    </div>
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
    <section id={id} className="scroll-mt-24 mb-12">
      <h3 className="text-xl md:text-2xl font-bold mt-8 mb-4 text-slate-900 dark:text-neutral-50">
        {title}
      </h3>
      <div className="text-gray-600 dark:text-neutral-300 leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}

/** A definition-style bullet: bold lead-in, then the clause it introduces. */
function TermItem({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <li>
      <span className="font-semibold text-gray-800 dark:text-neutral-200">{term}</span>
      {" — "}
      {children}
    </li>
  );
}

export default function GdprCompliancePage() {
  const { t } = useTranslation();

  const navItems = [
    { href: "#company", label: t("legalNavCompany") },
    { href: "#account", label: t("legalNavAccount") },
    { href: "#orders", label: t("legalNavOrders") },
    { href: "#invoicing", label: t("legalNavInvoicing") },
    { href: "#cancellations", label: t("legalNavCancellations") },
    { href: "#disputes", label: t("legalNavDisputes") },
    { href: "#controller", label: t("legalNavController") },
    { href: "#data-categories", label: t("legalNavDataCategories") },
    { href: "#legal-bases", label: t("legalNavLegalBases") },
    { href: "#sharing", label: t("legalNavSharing") },
    { href: "#rights", label: t("legalNavRights") },
    { href: "#retention", label: t("legalNavRetention") },
  ];

  // The VAT table, as published. Rendered from data so the three rows can't
  // drift apart in markup, and so a fourth fee only needs a row here.
  const vatRows = [
    {
      component: t("legalTableRow1Component"),
      vat: t("legalTableRow1Vat"),
      issuer: t("legalTableRow1Issuer"),
    },
    {
      component: t("legalTableRow2Component"),
      vat: t("legalTableRow2Vat"),
      issuer: t("legalTableRow2Issuer"),
    },
    {
      component: t("legalTableRow3Component"),
      vat: t("legalTableRow3Vat"),
      issuer: t("legalTableRow3Issuer"),
    },
  ];

  const metaItems = [
    { Icon: Building2, label: t("legalEntityLabel"), value: t("legalEntityValue") },
    { Icon: Landmark, label: t("legalJurisdictionLabel"), value: t("legalJurisdictionValue") },
    { Icon: CalendarClock, label: t("legalLastUpdatedLabel"), value: t("legalLastUpdatedValue") },
  ];

  return (
    <main className="bg-white dark:bg-neutral-950 text-gray-900 dark:text-neutral-100 transition-colors duration-200">
      {/* Hero */}
      <section className="bg-gray-50 dark:bg-neutral-900/50 py-16 border-b border-gray-200 dark:border-neutral-800">
        <div className="max-w-6xl mx-auto px-6">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-neutral-50 mb-6">
            {t("gdprComplianceHeroTitle")}
          </h1>
          <p className="text-lg text-gray-500 dark:text-neutral-400 max-w-2xl">
            {t("gdprComplianceHeroDescription")}
          </p>

          {/* Entity / jurisdiction / last-updated strip */}
          <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
            {metaItems.map(({ Icon, label, value }) => (
              <div
                key={label}
                className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-sm dark:shadow-none"
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#f9186b] dark:text-pink-500" />
                <div className="min-w-0">
                  <dt className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-neutral-500">
                    {label}
                  </dt>
                  <dd className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-neutral-100">
                    {value}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Sidebar — desktop, sticky */}
          <aside className="lg:w-80 shrink-0">
            <div className="lg:sticky lg:top-24 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm dark:shadow-none">
              <span className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider block mb-4">
                {t("onThisPage")}
              </span>
              <nav className="space-y-2">
                {navItems.map(({ href, label }) => (
                  <NavLink key={href} href={href}>
                    {label}
                  </NavLink>
                ))}
                <a
                  href="mailto:dpo@deligo.pt"
                  className="block w-full bg-[#f9186b] text-white rounded-md py-2.5 px-4 text-sm text-center font-bold hover:bg-[#d4145b] transition-colors mt-4"
                >
                  {t("legalNavContactDpo")}
                </a>
              </nav>
            </div>
          </aside>

          <article className="flex-1 max-w-3xl">
            {/* Sidebar — mobile */}
            <div className="lg:hidden mb-8">
              <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm dark:shadow-none">
                <span className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider block mb-4">
                  {t("onThisPage")}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {navItems.map(({ href, label }) => (
                    <NavLink key={href} href={href}>
                      {label}
                    </NavLink>
                  ))}
                  <a
                    href="mailto:dpo@deligo.pt"
                    className="bg-[#f9186b] text-white rounded-md py-2 px-3 text-sm text-center font-bold hover:bg-[#d4145b] transition-colors col-span-2 sm:col-span-1 flex items-center justify-center"
                  >
                    {t("legalNavContactDpo")}
                  </a>
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------------------
                PART 1 — Terms and Conditions of Service
            --------------------------------------------------------------- */}
            <PartHeading label={t("legalPart1Label")} title={t("legalPart1Title")} />

            <Section id="company" title={t("legalCompanyTitle")}>
              <p>{t("legalCompanyIntro")}</p>
              <p>{t("legalCompanyRole")}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{t("legalCompanyParty1")}</li>
                <li>{t("legalCompanyParty2")}</li>
                <li>{t("legalCompanyParty3")}</li>
              </ul>
              <p>{t("legalCompanyPurpose")}</p>
            </Section>

            <Section id="account" title={t("legalAccountTitle")}>
              <ul className="list-disc pl-5 space-y-2">
                <TermItem term={t("legalAccountEligibilityTitle")}>
                  {t("legalAccountEligibilityText")}
                </TermItem>
                <TermItem term={t("legalAccountAccuracyTitle")}>
                  {t("legalAccountAccuracyText")}
                </TermItem>
                <TermItem term={t("legalAccountSecurityTitle")}>
                  {t("legalAccountSecurityText")}
                </TermItem>
              </ul>
            </Section>

            <Section id="orders" title={t("legalOrdersTitle")}>
              <p>{t("legalOrdersIntro")}</p>

              {/* Scrolls inside its own container rather than pushing the page
                  sideways on a narrow screen. */}
              <div className="my-6 overflow-x-auto rounded-xl border border-gray-200 dark:border-neutral-800">
                <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-slate-900 dark:bg-neutral-800 text-white">
                      <th scope="col" className="px-4 py-3.5 font-semibold">
                        {t("legalTableComponent")}
                      </th>
                      <th scope="col" className="px-4 py-3.5 font-semibold">
                        {t("legalTableVatRate")}
                      </th>
                      <th scope="col" className="px-4 py-3.5 font-semibold">
                        {t("legalTableIssuer")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {vatRows.map((row, index) => (
                      <tr
                        key={row.component}
                        className={
                          index % 2 === 1
                            ? "bg-gray-50 dark:bg-neutral-900/60"
                            : "bg-white dark:bg-neutral-900"
                        }
                      >
                        <th
                          scope="row"
                          className="border-t border-gray-200 dark:border-neutral-800 px-4 py-3.5 text-left font-medium text-gray-900 dark:text-neutral-100"
                        >
                          {row.component}
                        </th>
                        <td className="border-t border-gray-200 dark:border-neutral-800 px-4 py-3.5 text-gray-600 dark:text-neutral-300">
                          {row.vat}
                        </td>
                        <td className="border-t border-gray-200 dark:border-neutral-800 px-4 py-3.5 text-gray-600 dark:text-neutral-300">
                          {row.issuer}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p>
                <span className="font-semibold text-gray-800 dark:text-neutral-200">
                  {t("legalPaymentMethodsTitle")}
                </span>
                {" — "}
                {t("legalPaymentMethodsText")}
              </p>
            </Section>

            <Section id="invoicing" title={t("legalInvoicingTitle")}>
              <p>{t("legalInvoicingIntro")}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{t("legalInvoicingQr")}</li>
                <li>{t("legalInvoicingAtcud")}</li>
              </ul>
              <p>{t("legalInvoicingNif")}</p>
            </Section>

            <Section id="cancellations" title={t("legalCancelTitle")}>
              <ul className="list-disc pl-5 space-y-2">
                <TermItem term={t("legalCancelPerishableTitle")}>
                  {t("legalCancelPerishableText")}
                </TermItem>
                <TermItem term={t("legalCancelUserTitle")}>
                  {t("legalCancelUserText")}
                </TermItem>
                <TermItem term={t("legalCancelDefectsTitle")}>
                  {t("legalCancelDefectsText")}
                </TermItem>
              </ul>
            </Section>

            <Section id="disputes" title={t("legalDisputesTitle")}>
              <p>{t("legalDisputesIntro")}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{t("legalDisputesComplaintsBook")}</li>
                <li>{t("legalDisputesAdr")}</li>
              </ul>
            </Section>

            {/* ---------------------------------------------------------------
                PART 2 — Privacy and Data Protection Policy (GDPR)
            --------------------------------------------------------------- */}
            <div className="my-12 h-px w-full bg-gray-200 dark:bg-neutral-800" />
            <PartHeading label={t("legalPart2Label")} title={t("legalPart2Title")} />

            <Section id="controller" title={t("legalControllerTitle")}>
              <p>{t("legalControllerText")}</p>
              <p>
                {t("legalControllerDpoText")}{" "}
                <a
                  href="mailto:dpo@deligo.pt"
                  className="font-semibold text-[#f9186b] hover:underline dark:text-pink-500"
                >
                  dpo@deligo.pt
                </a>
              </p>
            </Section>

            <Section id="data-categories" title={t("legalDataTitle")}>
              <p>{t("legalDataIntro")}</p>
              <ul className="list-disc pl-5 space-y-2">
                <TermItem term={t("legalDataIdentityTitle")}>
                  {t("legalDataIdentityText")}
                </TermItem>
                <TermItem term={t("legalDataLocationTitle")}>
                  {t("legalDataLocationText")}
                </TermItem>
                <TermItem term={t("legalDataFinancialTitle")}>
                  {t("legalDataFinancialText")}
                </TermItem>
                <TermItem term={t("legalDataTechnicalTitle")}>
                  {t("legalDataTechnicalText")}
                </TermItem>
              </ul>
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gray-600 dark:text-neutral-400" />
                <p className="text-sm text-gray-600 dark:text-neutral-400">
                  {t("legalDataFinancialNote")}
                </p>
              </div>
            </Section>

            <Section id="legal-bases" title={t("legalBasesTitle")}>
              <p>{t("legalBasesIntro")}</p>
              <ol className="list-decimal pl-5 space-y-2">
                <TermItem term={t("legalBasesContractTitle")}>
                  {t("legalBasesContractText")}
                </TermItem>
                <TermItem term={t("legalBasesObligationTitle")}>
                  {t("legalBasesObligationText")}
                </TermItem>
                <TermItem term={t("legalBasesConsentTitle")}>
                  {t("legalBasesConsentText")}
                </TermItem>
                <TermItem term={t("legalBasesInterestTitle")}>
                  {t("legalBasesInterestText")}
                </TermItem>
              </ol>
            </Section>

            <Section id="sharing" title={t("legalSharingTitle")}>
              <p>{t("legalSharingIntro")}</p>
              <ul className="list-disc pl-5 space-y-2">
                <TermItem term={t("legalSharingCouriersTitle")}>
                  {t("legalSharingCouriersText")}
                </TermItem>
                <TermItem term={t("legalSharingPartnersTitle")}>
                  {t("legalSharingPartnersText")}
                </TermItem>
                <TermItem term={t("legalSharingAuthoritiesTitle")}>
                  {t("legalSharingAuthoritiesText")}
                </TermItem>
                <TermItem term={t("legalSharingProcessorsTitle")}>
                  {t("legalSharingProcessorsText")}
                </TermItem>
              </ul>
            </Section>

            <Section id="rights" title={t("legalRightsTitle")}>
              <p>{t("legalRightsIntro")}</p>
              <ul className="list-disc pl-5 space-y-2">
                <TermItem term={t("legalRightsAccessTitle")}>
                  {t("legalRightsAccessText")}
                </TermItem>
                <TermItem term={t("legalRightsRectificationTitle")}>
                  {t("legalRightsRectificationText")}
                </TermItem>
                <TermItem term={t("legalRightsErasureTitle")}>
                  {t("legalRightsErasureText")}
                </TermItem>
                <TermItem term={t("legalRightsPortabilityTitle")}>
                  {t("legalRightsPortabilityText")}
                </TermItem>
                <TermItem term={t("legalRightsObjectionTitle")}>
                  {t("legalRightsObjectionText")}
                </TermItem>
                <TermItem term={t("legalRightsComplaintTitle")}>
                  {t("legalRightsComplaintText")}{" "}
                  <a
                    href="https://www.cnpd.pt"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#f9186b] hover:underline dark:text-pink-500"
                  >
                    www.cnpd.pt
                  </a>
                </TermItem>
              </ul>
            </Section>

            <Section id="retention" title={t("legalRetentionTitle")}>
              <p>{t("legalRetentionText")}</p>
              <p>{t("legalSecurityText")}</p>
            </Section>
          </article>
        </div>
      </div>
    </main>
  );
}
