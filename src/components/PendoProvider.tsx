"use client";

import { Suspense, useCallback, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import { useTown } from "@/lib/town-context";
import {
  initializePendo,
  resolvePageType,
  trackCurrentPageView,
  trackEvent,
} from "@/lib/pendo";

const PENDO_API_KEY = process.env.NEXT_PUBLIC_PENDO_API_KEY;

function PendoRouteTracker({ townId }: { townId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const lastTrackedPageRef = useRef<string | null>(null);

  const trackPageView = useCallback(() => {
    const signature = `${townId}:${pathname}:${query}`;
    if (lastTrackedPageRef.current === signature) {
      return;
    }

    lastTrackedPageRef.current = signature;
    trackEvent("page_view", {
      town_id: townId,
      page_path: pathname,
      page_type: resolvePageType(pathname, query),
      has_search_query: query.length > 0,
    });
  }, [pathname, query, townId]);

  useEffect(() => {
    trackPageView();
  }, [trackPageView]);

  return null;
}

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
          trackCurrentPageView(town.town_id);
        }}
      />
      <Suspense fallback={null}>
        <PendoRouteTracker townId={town.town_id} />
      </Suspense>
      {children}
    </>
  );
}
