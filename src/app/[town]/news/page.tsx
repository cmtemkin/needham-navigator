"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTownHref } from "@/lib/town-context";

/**
 * News page now redirects to the unified /articles page.
 * All content (AI articles + external news) is shown together.
 */
export default function NewsRedirectPage() {
  const router = useRouter();
  const articlesHref = useTownHref("/articles");

  useEffect(() => {
    router.replace(articlesHref);
  }, [router, articlesHref]);

  return null;
}
