"use client";

import { Map, ExternalLink, FileText, Search } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useTown } from "@/lib/town-context";
import { useChatWidget } from "@/lib/chat-context";

export default function ZoningMapPage() {
  const town = useTown();
  const { openChat } = useChatWidget();
  const shortTownName = town.name.replace(/,\s*[A-Z]{2}$/i, "");

  // Common zoning resources — these could be moved to TownConfig in the future
  const zoningResources = [
    {
      title: "Zoning By-Laws",
      description: "Official zoning regulations and district definitions",
      question: `What are the zoning districts in ${shortTownName}?`,
      icon: FileText,
    },
    {
      title: "Setback Requirements",
      description: "Minimum setback distances by zoning district",
      question: `What are the setback requirements in ${shortTownName}?`,
      icon: Map,
    },
    {
      title: "Permitted Uses",
      description: "What you can build in each zoning district",
      question: `What are the permitted uses in residential zones in ${shortTownName}?`,
      icon: Search,
    },
    {
      title: "Dimensional Requirements",
      description: "Lot size, coverage, and height limits",
      question: `What are the lot size and height requirements in ${shortTownName}?`,
      icon: FileText,
    },
  ];

  return (
    <>
      <Header />

      <main className="min-h-screen bg-surface">
        <div className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white py-12 px-4">
          <div className="max-w-content mx-auto">
            <h1 className="text-4xl font-bold mb-3">
              {shortTownName} <span className="text-[var(--accent)]">Zoning</span>
            </h1>
            <p className="text-lg text-white/90">
              Zoning districts, regulations, and land use information
            </p>
          </div>
        </div>

        <div className="max-w-content mx-auto px-4 sm:px-6 py-8">
          {/* Interactive Map Embed */}
          <div className="bg-white border border-border-light rounded-xl overflow-hidden mb-8">
            <div className="aspect-[16/9] bg-gray-100 flex items-center justify-center">
              <iframe
                src={`https://www.google.com/maps/embed/v1/view?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ""}&center=${town.location.lat},${town.location.lng}&zoom=14&maptype=roadmap`}
                className="w-full h-full border-0"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`${shortTownName} Map`}
                style={{
                  display: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ? "block" : "none",
                }}
              />
              {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY && (
                <div className="text-center p-8">
                  <Map size={48} className="text-text-muted mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-text-primary mb-2">
                    {shortTownName} Zoning Map
                  </h3>
                  <p className="text-[14px] text-text-secondary max-w-md mx-auto mb-4">
                    Interactive zoning map coming soon. Visit the town&apos;s GIS portal for the official zoning overlay.
                  </p>
                  <a
                    href={`${town.website_url}/zoning`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[14px] text-[var(--primary)] hover:text-[var(--primary-dark)] font-medium transition-colors"
                  >
                    View official zoning map
                    <ExternalLink size={14} />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Zoning Quick Lookup */}
          <h2 className="text-xl font-bold text-text-primary mb-4">Zoning Information</h2>
          <p className="text-[14px] text-text-secondary mb-6">
            Ask Navigator about zoning regulations, or explore common topics below.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {zoningResources.map((resource) => (
              <button
                key={resource.title}
                onClick={() => openChat(resource.question)}
                className="bg-white border border-border-light rounded-xl p-5 text-left hover:shadow-md hover:border-[var(--primary)] transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--accent-light)] flex items-center justify-center flex-shrink-0">
                    <resource.icon size={18} className="text-[var(--primary)]" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-text-primary group-hover:text-[var(--primary)] transition-colors">
                      {resource.title}
                    </h3>
                    <p className="text-[13px] text-text-secondary mt-0.5">
                      {resource.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 text-center">
            <h3 className="text-lg font-bold text-text-primary mb-2">
              Have a specific zoning question?
            </h3>
            <p className="text-[14px] text-text-secondary mb-4 max-w-md mx-auto">
              Ask Navigator about setbacks, permitted uses, variances, or any other zoning topic for your property.
            </p>
            <button
              onClick={() => openChat(`I have a zoning question about my property in ${shortTownName}`)}
              className="px-6 py-3 bg-[var(--primary)] text-white font-medium rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
            >
              Ask a Zoning Question
            </button>
          </div>

          <p className="text-[12px] text-text-muted text-center mt-6">
            Zoning information is for general guidance only. Always verify with the {shortTownName} Planning Department for official determinations.
          </p>
        </div>
      </main>

      <Footer />
    </>
  );
}
