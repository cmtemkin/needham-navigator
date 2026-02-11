"use client";

import Link from "next/link";
import { ChevronLeft, FileCheck } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PermitWizard } from "@/components/PermitWizard";
import { useTown, useTownHref } from "@/lib/town-context";
import { useI18n } from "@/lib/i18n";

export default function PermitsPage() {
  const town = useTown();
  const { t } = useI18n();
  const homeHref = useTownHref();
  const townName = town.name.replace(/,\s*[A-Z]{2}$/i, "");

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
              {t("permits.title")}
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
      </main>
      <Footer />
    </>
  );
}
