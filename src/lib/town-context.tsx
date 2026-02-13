"use client";

import {
  createContext,
  useContext,
  type PropsWithChildren,
} from "react";
import { usePathname } from "next/navigation";
import type { TownConfig } from "@/lib/towns";

const TownContext = createContext<TownConfig | null>(null);

export function TownProvider({
  town,
  children,
}: PropsWithChildren<{ town: TownConfig }>) {
  return <TownContext.Provider value={town}>{children}</TownContext.Provider>;
}

export function useTown(): TownConfig {
  const town = useContext(TownContext);
  if (!town) {
    throw new Error("useTown must be used within a TownProvider.");
  }

  return town;
}

export function townHref(townId: string, path = ""): string {
  const normalizedPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `/${townId}${normalizedPath}`;
}

export function useTownHref(path = ""): string {
  const town = useTown();
  const pathname = usePathname();
  const normalizedPath = path
    ? path.startsWith("/")
      ? path
      : `/${path}`
    : "";

  // When the user arrived via a root-rewritten URL (e.g. "/" or "/chat"),
  // keep links root-relative so the URL bar stays clean.
  const onRootPath = !pathname.startsWith(`/${town.town_id}`);
  if (onRootPath) {
    return normalizedPath || "/";
  }

  return `/${town.town_id}${normalizedPath}`;
}
