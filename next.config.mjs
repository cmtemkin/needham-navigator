/** @type {import('next').NextConfig} */

// Hostnames where root paths (/, /chat, /permits, /news) serve Needham
// content directly via rewrite. On unrecognized hosts the filesystem
// page.tsx redirect to /{DEFAULT_TOWN_ID} kicks in as a fallback.
const NEEDHAM_HOSTS =
  "(?:needhamnavigator\\.com|www\\.needhamnavigator\\.com|localhost(?::\\d+)?|.*\\.vercel\\.app)";

const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          destination: "/needham",
          has: [{ type: "host", value: NEEDHAM_HOSTS }],
        },
        {
          source: "/:path(chat|permits|news)",
          destination: "/needham/:path",
          has: [{ type: "host", value: NEEDHAM_HOSTS }],
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
