import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Needham Navigator — Your AI Town Guide",
    template: "%s | Needham Navigator",
  },
  description:
    "AI-powered municipal information hub for Needham, MA. Get instant answers about town services, permits, zoning, schools, taxes, and more.",
  metadataBase: new URL("https://needhamnavigator.com"),
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Needham Navigator — Your AI Town Guide",
    description:
      "Ask questions about Needham town services, permits, schools, zoning, and more. Get instant answers sourced from official documents.",
    url: "https://needhamnavigator.com",
    siteName: "Needham Navigator",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Needham Navigator — Your AI Town Guide",
    description:
      "AI-powered answers about Needham, MA town services. Permits, zoning, schools, taxes, and more.",
  },
  robots: {
    index: true,
    follow: true,
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
      </body>
    </html>
  );
}
