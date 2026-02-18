"use client";

import Link from "next/link";
import { ChevronLeft, FileCheck, Map, ExternalLink, FileText, Search } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PermitWizard } from "@/components/PermitWizard";
import { useTown, useTownHref } from "@/lib/town-context";
import { useI18n } from "@/lib/i18n";
import { useChatWidget } from "@/lib/chat-context";

export default function PermitsPage() {
  const town = useTown();
  const { t } = useI18n();
  const { openChat } = useChatWidget();
  const homeHref = useTownHref();
  const townName = town.name.replace(/,\s*[A-Z]{2}$/i, "");

  const zoningResources = [
    {
      title: "Zoning By-Laws",
      description: "Official zoning regulations and district definitions",
      question: `What are the zoning districts in ${townName}?`,
      icon: FileText,
    },
    {
      title: "Setback Requirements",
      description: "Minimum setback distances by zoning district",
      question: `What are the setback requirements in ${townName}?`,
      icon: Map,
    },
    {
      title: "Permitted Uses",
      description: "What you can build in each zoning district",
      question: `What are the permitted uses in residential zones in ${townName}?`,
      icon: Search,
    },
    {
      title: "Dimensional Requirements",
      description: "Lot size, coverage, and height limits",
      question: `What are the lot size and height requirements in ${townName}?`,
      icon: FileText,
    },
  ];

  return (
    <>
      <Header />
      <main className="max-w-[700px] mx-auto px-6 max-sm:px-4 py-6">
        <div className="mb-5">
          <Link
            href={homeHref}
            className="inline-flex items-center gap-1.5 px-3.5 py-[7px] bg-white border border-border-default rounded-lg text-[13px] font-medium text-text-secondary hover:border-primary hover:text-primary transition-all"
          >
            <ChevronLeft size={14} />
            {t("chat.back_home")}
          </Link>
        </div>

        <div className="flex items-start gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center shrink-0">
            <FileCheck size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">
              Permits & Zoning
            </h1>
            <p className="text-[13.5px] text-text-secondary mt-0.5 leading-snug">
              {t("permits.subtitle", { town: townName })}
            </p>
          </div>
        </div>

        <div className="bg-white border border-border-light rounded-2xl p-6 max-sm:p-4 shadow-xs">
          <PermitWizard />
        </div>

        <p className="text-[11.5px] text-text-muted mt-5 leading-relaxed text-center">
          {t("permits.page_disclaimer", { town: townName, phone: town.departments[0]?.phone ?? "" })}
        </p>

        {/* ─── Zoning Section ─── */}
        <div className="border-t border-border-light mt-10 pt-10">
          <div className="flex items-center gap-2 mb-4">
            <Map size={22} className="text-[var(--primary)]" />
            <h2 className="text-xl font-bold text-text-primary">Zoning Information</h2>
          </div>

          {/* Map Placeholder */}
          <div className="bg-white border border-border-light rounded-xl overflow-hidden mb-6">
            <div className="bg-gray-100 p-8 text-center">
              <Map size={48} className="text-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                {townName} Zoning Map
              </h3>
              <p className="text-[14px] text-text-secondary max-w-md mx-auto mb-4">
                Visit the town&apos;s GIS portal for the official zoning overlay map.
              </p>
              <a
                href={`${town.website_url}/zoning`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[14px] text-[var(--primary)] hover:text-[var(--primary-dark)] font-medium transition-colors"
              >
                View official zoning map
                <ExternalLink size={14} />
              </a>
            </div>
          </div>

          {/* Zoning Resource Cards */}
          <p className="text-[14px] text-text-secondary mb-4">
            Ask Navigator about zoning regulations, or explore common topics below.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {zoningResources.map((resource) => (
              <button
                key={resource.title}
                onClick={() => openChat(resource.question)}
                className="bg-white border border-border-light rounded-xl p-5 text-left hover:shadow-md hover:border-[var(--primary)] transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--accent-light)] flex items-center justify-center flex-shrink-0">
                    <resource.icon size={18} className="text-[var(--primary)]" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-text-primary group-hover:text-[var(--primary)] transition-colors">
                      {resource.title}
                    </h3>
                    <p className="text-[13px] text-text-secondary mt-0.5">
                      {resource.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 text-center">
            <h3 className="text-lg font-bold text-text-primary mb-2">
              Have a specific zoning question?
            </h3>
            <p className="text-[14px] text-text-secondary mb-4 max-w-md mx-auto">
              Ask Navigator about setbacks, permitted uses, variances, or any other zoning topic for your property.
            </p>
            <button
              onClick={() => openChat(`I have a zoning question about my property in ${townName}`)}
              className="px-6 py-3 bg-[var(--primary)] text-white font-medium rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
            >
              Ask a Zoning Question
            </button>
          </div>

          <p className="text-[12px] text-text-muted text-center mt-6">
            Zoning information is for general guidance only. Always verify with the {townName} Planning Department for official determinations.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
