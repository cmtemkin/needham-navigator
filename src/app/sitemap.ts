import type { MetadataRoute } from "next";
import { TOWN_CONFIGS } from "@/lib/towns";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://needhamnavigator.com";
  const now = new Date();

  // Root URL
  const urls: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
  ];

  for (const town of TOWN_CONFIGS) {
    // Skip test towns
    if (town.town_id === "mock-town") continue;

    // Town homepage
    urls.push({
      url: `${baseUrl}/${town.town_id}`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    });

    // Chat — always available
    urls.push({
      url: `${baseUrl}/${town.town_id}/chat`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    });

    // Permits — always available
    urls.push({
      url: `${baseUrl}/${town.town_id}/permits`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    });

    // Feature-flagged routes
    if (town.feature_flags.enableNews) {
      urls.push({
        url: `${baseUrl}/${town.town_id}/news`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.6,
      });
    }
  }

  return urls;
}
