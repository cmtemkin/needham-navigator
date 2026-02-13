"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useTown, useTownHref } from "@/lib/town-context";

const FOOTER_VERSION_LABEL = "v0.1.0";

export function Footer() {
  const town = useTown();
  const releasesHref = useTownHref("/releases");
  const { t } = useI18n();
  const shortTownName = town.name.replace(/,\s*[A-Z]{2}$/i, "");
  const appName = `${shortTownName} Navigator`;
  const townHallPhone = town.departments[0]?.phone ?? "(781) 455-7500";
  const websiteText = town.website_url.replace(/^https?:\/\//, "");

  const disclaimerText = t("footer.disclaimer", {
    app_name: appName,
    town: shortTownName,
    website: websiteText,
    phone: townHallPhone,
  });

  const splitParts = disclaimerText.split(websiteText);
  const beforeWebsite = splitParts[0] ?? disclaimerText;
  const afterWebsite = splitParts.slice(1).join(websiteText);

  return (
    <footer className="mx-auto mt-10 max-w-content border-t border-border-light px-4 py-6 pb-8 text-center sm:px-6">
      <p className="mx-auto max-w-[720px] text-[11.5px] leading-relaxed text-text-muted">
        {beforeWebsite}
        <a
          href={town.website_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {websiteText}
        </a>
        {afterWebsite}
        <span className="text-text-muted"> {t("footer.terms_privacy")}</span>
      </p>
      <div className="mt-2">
        <Link
          href={releasesHref}
          className="text-[10.5px] font-medium text-text-muted opacity-80 transition-all hover:text-primary hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          aria-label={`View release notes (${FOOTER_VERSION_LABEL})`}
        >
          {FOOTER_VERSION_LABEL}
        </Link>
      </div>
    </footer>
  );
}
