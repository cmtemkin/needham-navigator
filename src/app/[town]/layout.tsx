import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { I18nProvider } from "@/lib/i18n";
import { TownProvider } from "@/lib/town-context";
import { getTownThemeStyle } from "@/lib/town-theme";
import { getTownById, getTownIds, type TownConfig } from "@/lib/towns";
import { PendoProvider } from "@/components/PendoProvider";

type TownLayoutProps = Readonly<{
  children: React.ReactNode;
  params: {
    town: string;
  };
}>;

function normalizeTownId(townId: string): string {
  return townId.trim().toLowerCase();
}

function getTownOr404(rawTownId: string): TownConfig {
  const town = getTownById(normalizeTownId(rawTownId));
  if (!town) {
    notFound();
  }

  return town;
}

export function generateStaticParams(): Array<{ town: string }> {
  return getTownIds().map((townId) => ({ town: townId }));
}

export async function generateMetadata({
  params,
}: Pick<TownLayoutProps, "params">): Promise<Metadata> {
  const town = getTownById(normalizeTownId(params.town));
  if (!town) {
    return {
      title: "Town Not Found | Needham Navigator",
      description: "The requested town configuration could not be found.",
    };
  }

  return {
    title: `${town.name} Navigator`,
    description: `AI-powered municipal information hub for ${town.name}.`,
  };
}

export default function TownLayout({ children, params }: TownLayoutProps) {
  const town = getTownOr404(params.town);

  return (
    <TownProvider town={town}>
      <I18nProvider enabled={town.feature_flags.enableMultiLanguage}>
        <PendoProvider>
          <div className="min-h-screen bg-surface" style={getTownThemeStyle(town)}>
            {children}
          </div>
        </PendoProvider>
      </I18nProvider>
    </TownProvider>
  );
}
