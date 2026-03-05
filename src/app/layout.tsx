import type { Metadata } from "next";
import { TOWNS, DEFAULT_TOWN_ID } from "../../config/towns";
import "./globals.css";

const defaultTown = TOWNS.find((t) => t.town_id === DEFAULT_TOWN_ID) ?? TOWNS[0];
const appName = defaultTown.app_name;
const appTagline = defaultTown.app_tagline;
const shortName = defaultTown.name.replace(/,\s*[A-Z]{2}$/i, "");

export const metadata: Metadata = {
  title: {
    default: `${appName} — ${appTagline}`,
    template: `%s | ${appName}`,
  },
  description: `AI-powered information hub for ${shortName}. Get instant answers about services, permits, zoning, schools, taxes, and more.`,
  metadataBase: new URL("https://needhamnavigator.com"),
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  openGraph: {
    title: `${appName} — ${appTagline}`,
    description: `Ask questions about ${shortName} services, permits, schools, zoning, and more. Get instant answers sourced from official documents.`,
    url: "https://needhamnavigator.com",
    siteName: appName,
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${appName} — ${appTagline}`,
    description: `AI-powered answers about ${shortName} services. Permits, zoning, schools, taxes, and more.`,
  },
  robots: {
    index: true,
    follow: true,
  },
  themeColor: "#1B4D7A",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Needham Navigator",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
