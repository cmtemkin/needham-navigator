"use client";

import { Github, ExternalLink, Info } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useTown } from "@/lib/town-context";

export default function AboutPage() {
  const town = useTown();
  const about = town.about;

  // If no about content configured, show a minimal fallback
  if (!about) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-surface">
          <div className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white py-8 px-4">
            <div className="max-w-[720px] mx-auto text-center">
              <h1 className="text-3xl font-bold mb-2">About {town.app_name}</h1>
              <p className="text-base text-white/90">{town.app_tagline}</p>
            </div>
          </div>
          <div className="max-w-content mx-auto px-4 sm:px-6 py-12 text-center">
            <p className="text-text-secondary">About page content has not been configured for this community.</p>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />

      <main className="min-h-screen bg-surface">
        {/* Hero */}
        <section className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white py-8 px-4">
          <div className="max-w-[720px] mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-4">
              <Info size={16} />
              <span className="text-sm font-medium">About {town.app_name}</span>
            </div>
            <h1 className="text-3xl font-bold mb-3 leading-tight">
              {town.app_tagline}
            </h1>
          </div>
        </section>

        {/* Mission */}
        <section className="mx-auto max-w-content px-4 sm:px-6 mt-10">
          <h2 className="text-2xl font-bold text-text-primary mb-5">Our Mission</h2>
          <div className="bg-white border border-border-default rounded-xl p-6">
            <p className="text-[15px] text-text-primary leading-relaxed">
              {about.mission}
            </p>
          </div>
        </section>

        {/* How It Works */}
        <section className="mx-auto max-w-content px-4 sm:px-6 mt-10">
          <h2 className="text-2xl font-bold text-text-primary mb-5">How It Works</h2>
          <div className="bg-white border border-border-default rounded-xl p-6">
            <p className="text-[15px] text-text-secondary leading-relaxed">
              {about.how_it_works}
            </p>
            {about.disclaimer && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-5">
                <p className="text-[14px] text-yellow-900 font-medium">
                  {about.disclaimer}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* FAQ */}
        {about.faq.length > 0 && (
          <section className="mx-auto max-w-content px-4 sm:px-6 mt-10">
            <h2 className="text-2xl font-bold text-text-primary mb-5">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {about.faq.map((item) => (
                <div
                  key={item.question}
                  className="bg-white border border-border-default rounded-lg p-5"
                >
                  <h3 className="text-[16px] font-semibold text-text-primary mb-2">
                    {item.question}
                  </h3>
                  <p className="text-[14px] text-text-secondary leading-relaxed">
                    {item.answer}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA for Other Towns / Open Source */}
        <section className="mx-auto max-w-content px-4 sm:px-6 mt-10">
          <div className="bg-gradient-to-r from-green-50 to-teal-50 border-2 border-green-300 rounded-xl p-8 text-center">
            <h2 className="text-2xl font-bold text-text-primary mb-3">
              Want This For Your Community?
            </h2>
            <p className="text-[15px] text-text-secondary mb-6 max-w-[600px] mx-auto leading-relaxed">
              This platform is open source and free for any community to use. Fork the project and customize it for your own use case.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              {about.github_url && (
                <a
                  href={about.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--primary)] text-white text-[15px] font-semibold rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
                >
                  <Github size={18} />
                  View on GitHub
                </a>
              )}
            </div>
            <p className="text-[13px] text-text-muted mt-4">
              100% free &middot; Open source &middot; Easy to customize &middot; Multi-tenant ready
            </p>
          </div>
        </section>

        {/* Contact */}
        <section className="mx-auto max-w-content px-4 sm:px-6 mt-10 pb-12">
          <h2 className="text-2xl font-bold text-text-primary mb-5">Get in Touch</h2>
          <div className="bg-white border border-border-default rounded-xl p-6">
            <p className="text-[15px] text-text-primary mb-6">
              Have feedback, found an error, or want to suggest a source? We&apos;d love to hear from you.
            </p>
            <div className="space-y-4">
              {about.github_url && (
                <a
                  href={about.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-[15px] text-[var(--primary)] hover:text-[var(--primary-dark)] font-medium transition-colors group"
                >
                  <Github size={20} className="group-hover:scale-110 transition-transform" />
                  <span>View on GitHub (open source)</span>
                  <ExternalLink size={14} className="opacity-50" />
                </a>
              )}
            </div>
            <p className="text-[13px] text-text-muted mt-6">
              {town.app_name} is open source — contributions welcome!
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
