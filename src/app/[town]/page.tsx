import { getTownById } from "@/lib/towns";
import { HomePage } from "@/components/HomePage";
import { SearchHomePage } from "@/components/SearchHomePage";

interface TownHomePageProps {
  params: Promise<{ town: string }>;
}

export default async function TownHomePage({ params }: TownHomePageProps) {
  const { town } = await params;
  const townConfig = getTownById(town);

  // Check if search skin is enabled via uiMode flag
  // If the flag doesn't exist yet (parallel backend PR), default to classic
  if (townConfig?.feature_flags && "uiMode" in townConfig.feature_flags) {
    const flags = townConfig.feature_flags as Record<string, unknown>;
    if (flags.uiMode === "search") {
      return <SearchHomePage />;
    }
  }

  // Default to classic skin
  return <HomePage />;
}
