import { redirect } from "next/navigation";
import { DEFAULT_TOWN_ID } from "@/lib/towns";

type LegacyChatPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function readQueryParam(
  searchParams: LegacyChatPageProps["searchParams"],
  key: string
): string | null {
  const value = searchParams?.[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return null;
}

export default function LegacyChatRedirect({ searchParams }: LegacyChatPageProps) {
  const query = readQueryParam(searchParams, "q");
  const queryString = query ? `?q=${encodeURIComponent(query)}` : "";
  redirect(`/${DEFAULT_TOWN_ID}/chat${queryString}`);
}
