"use client";

import { useEffect } from "react";
import Script from "next/script";
import { useTown } from "@/lib/town-context";
import { initializePendo } from "@/lib/pendo";

const PENDO_API_KEY = process.env.NEXT_PUBLIC_PENDO_API_KEY;

/**
 * Loads the Pendo snippet and initializes with town context.
 * Must be rendered inside TownProvider.
 */
export function PendoProvider({ children }: { children: React.ReactNode }) {
  const town = useTown();

  useEffect(() => {
    // Initialize Pendo once the script has loaded
    // The script onLoad fires before useEffect, so pendo should be on window
    if (window.pendo) {
      initializePendo(town.town_id, town.name);
    }
  }, [town.town_id, town.name]);

  if (!PENDO_API_KEY) {
    return <>{children}</>;
  }

  return (
    <>
      <Script
        src={`https://cdn.pendo.io/agent/static/${PENDO_API_KEY}/pendo.js`}
        strategy="afterInteractive"
        onLoad={() => {
          initializePendo(town.town_id, town.name);
        }}
      />
      {children}
    </>
  );
}
