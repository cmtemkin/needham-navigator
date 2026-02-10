import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Needham Navigator",
  description:
    "AI-powered municipal information hub for Needham, MA. Get instant answers about town services, zoning, permits, and more.",
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
