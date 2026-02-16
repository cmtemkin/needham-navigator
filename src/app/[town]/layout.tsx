import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { I18nProvider } from "@/lib/i18n";
import { TownProvider } from "@/lib/town-context";
import { ChatProvider } from "@/lib/chat-context";
import { getTownThemeStyle } from "@/lib/town-theme";
import { getTownById, getTownIds, type TownConfig } from "@/lib/towns";
import { PendoProvider } from "@/components/PendoProvider";
import { FloatingChatWrapper } from "@/components/FloatingChatWrapper";
import { ErrorBoundary } from "@/components/ErrorBoundary";

type TownLayoutProps = Readonly<{
  children: React.ReactNode;
  params: Promise<{
    town: string;
  }>;
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
  const resolvedParams = await params;
  const town = getTownById(normalizeTownId(resolvedParams.town));
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

export default async function TownLayout({ children, params }: TownLayoutProps) {
  const resolvedParams = await params;
  const town = getTownOr404(resolvedParams.town);

  return (
    <TownProvider town={town}>
      <I18nProvider enabled={town.feature_flags.enableMultiLanguage}>
        <ChatProvider>
          <PendoProvider>
            <ErrorBoundary>
              <div className="min-h-screen bg-surface" style={getTownThemeStyle(town)}>
                {children}
              </div>
              <FloatingChatWrapper townId={town.town_id} />
            </ErrorBoundary>
          </PendoProvider>
        </ChatProvider>
      </I18nProvider>
    </TownProvider>
  );
}
