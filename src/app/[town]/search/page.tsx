import { SearchHomePage } from "@/components/SearchHomePage";
import { Metadata } from "next";
import { getTownById } from "@/lib/towns";

interface SearchPageProps {
  params: Promise<{ town: string }>;
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata(props: SearchPageProps): Promise<Metadata> {
  const params = await props.params;
  const searchParams = await props.searchParams;

  const townConfig = getTownById(params.town);
  const townName = townConfig?.name ?? "Your Town";
  const query = searchParams.q || "";

  const title = query
    ? `"${query}" - Search Results | ${townName} Navigator`
    : `Search | ${townName} Navigator`;

  const description = query
    ? `Search results for "${query}" in ${townName}, MA. Find municipal information, permits, regulations, and community services.`
    : `Search ${townName} municipal information. Find answers about permits, regulations, town services, and community resources.`;

  const url = query
    ? `https://needhamnavigator.com/${params.town}/search?q=${encodeURIComponent(query)}`
    : `https://needhamnavigator.com/${params.town}/search`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url,
      siteName: `${townName} Navigator`,
      locale: "en_US",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default function TownSearchPage() {
  return <SearchHomePage />;
}
