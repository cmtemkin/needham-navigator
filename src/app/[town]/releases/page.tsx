import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { ChevronLeft, GitCommitHorizontal } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

type CategoryName =
  | "New Features"
  | "Bug Fixes"
  | "Breaking Changes"
  | "Other Changes";

type ReleaseEntry = {
  version: string;
  date: string;
  summary: string;
  categories: Record<CategoryName, string[]>;
};

type ReleasesPageProps = Readonly<{
  params: {
    town: string;
  };
}>;

const CATEGORY_ORDER: CategoryName[] = [
  "New Features",
  "Bug Fixes",
  "Breaking Changes",
  "Other Changes",
];

function makeEmptyCategories(): Record<CategoryName, string[]> {
  return {
    "New Features": [],
    "Bug Fixes": [],
    "Breaking Changes": [],
    "Other Changes": [],
  };
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1")
    .trim();
}

function extractStandaloneBoldText(line: string): string | null {
  const match = /^\*\*(.+?)\*\*$/.exec(line);
  if (!match) {
    return null;
  }

  return stripInlineMarkdown(match[1] ?? "");
}

function toCategoryName(rawHeading: string): CategoryName {
  const normalized = rawHeading.trim().toLowerCase();
  if (normalized.includes("new feature")) {
    return "New Features";
  }
  if (
    normalized.includes("bug fix") ||
    normalized === "fixes" ||
    normalized === "fix"
  ) {
    return "Bug Fixes";
  }
  if (normalized.includes("breaking")) {
    return "Breaking Changes";
  }

  return "Other Changes";
}

function formatReleaseDate(rawDate: string): string {
  const parsed = new Date(`${rawDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return rawDate;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function parseReleaseNotes(markdown: string): ReleaseEntry[] {
  const releases: ReleaseEntry[] = [];
  const lines = markdown.split(/\r?\n/);

  let current: ReleaseEntry | null = null;
  let currentCategory: CategoryName = "Other Changes";
  let subsectionPrefix: string | null = null;

  const pushCurrent = () => {
    if (!current) {
      return;
    }

    if (!current.summary) {
      const fallback = CATEGORY_ORDER.flatMap(
        (category) => current?.categories[category] ?? [],
      )[0];
      current.summary = fallback ?? "Maintenance improvements and refinements.";
    }

    releases.push(current);
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line === "---") {
      continue;
    }

    const versionMatch = /^##\s+(v[^\s]+)\s+[\u2013\u2014-]\s+(.+)$/.exec(line);
    if (versionMatch) {
      pushCurrent();
      current = {
        version: versionMatch[1] ?? "",
        date: (versionMatch[2] ?? "").trim(),
        summary: "",
        categories: makeEmptyCategories(),
      };
      currentCategory = "Other Changes";
      subsectionPrefix = null;
      continue;
    }

    if (!current) {
      continue;
    }

    const headingMatch = /^###\s+(.+)$/.exec(line);
    if (headingMatch) {
      currentCategory = toCategoryName(headingMatch[1] ?? "");
      subsectionPrefix = null;
      continue;
    }

    if (!current.summary) {
      const summary = extractStandaloneBoldText(line);
      if (summary) {
        current.summary = summary;
        continue;
      }
    }

    const subsectionTitle = extractStandaloneBoldText(line);
    if (subsectionTitle) {
      subsectionPrefix = subsectionTitle;
      continue;
    }

    const bulletMatch = /^[-*]\s+(.+)$/.exec(line);
    if (bulletMatch) {
      let item = stripInlineMarkdown(bulletMatch[1] ?? "");
      if (!item) {
        continue;
      }
      if (subsectionPrefix) {
        item = `${subsectionPrefix}: ${item}`;
      }

      current.categories[currentCategory].push(item);
      continue;
    }

    if (line.startsWith("|")) {
      continue;
    }

    const paragraph = stripInlineMarkdown(line);
    if (!paragraph) {
      continue;
    }

    current.categories[currentCategory].push(paragraph);
  }

  pushCurrent();
  return releases;
}

async function getReleases(): Promise<ReleaseEntry[]> {
  const releaseNotesPath = path.join(process.cwd(), "docs", "RELEASE_NOTES.md");
  const markdown = await fs.readFile(releaseNotesPath, "utf8");
  return parseReleaseNotes(markdown);
}

export default async function ReleasesPage({ params }: ReleasesPageProps) {
  const releases = await getReleases();
  const homeHref = `/${params.town}`;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[860px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5">
          <Link
            href={homeHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-white px-3.5 py-[7px] text-[13px] font-medium text-text-secondary transition-all hover:border-primary hover:text-primary"
          >
            <ChevronLeft size={14} />
            Back to home
          </Link>
        </div>

        <section className="mb-6 rounded-2xl border border-border-light bg-white p-5 shadow-xs sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-light">
              <GitCommitHorizontal size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                Release Notes
              </h1>
              <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
                Product updates and technical changes for the platform.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {releases.map((release) => (
            <article
              key={`${release.version}-${release.date}`}
              className="rounded-2xl border border-border-light bg-white p-5 shadow-xs sm:p-6"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-text-primary">
                  {release.version}
                </h2>
                <p className="text-[12px] font-medium text-text-muted">
                  {formatReleaseDate(release.date)}
                </p>
              </div>

              <p className="mt-2 text-[14px] leading-relaxed text-text-secondary">
                {release.summary}
              </p>

              <div className="mt-4 space-y-3">
                {CATEGORY_ORDER.map((category) => {
                  const items = release.categories[category];
                  if (!items.length) {
                    return null;
                  }

                  return (
                    <section key={`${release.version}-${category}`}>
                      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-text-secondary">
                        {category}
                      </h3>
                      <ul className="mt-2 space-y-1.5">
                        {items.map((item, index) => (
                          <li
                            key={`${release.version}-${category}-${index}`}
                            className="text-[13.5px] leading-relaxed text-text-primary"
                          >
                            <span className="mr-2 align-middle text-primary">
                              -
                            </span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </article>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}
