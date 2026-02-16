"use client";

import { Mail, Github, ExternalLink, Info, Building2, GraduationCap, Newspaper as NewspaperIcon, Users, Shield, Trees, Bus, Briefcase, Heart, Plus } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const SOURCE_CATEGORIES = [
  { icon: Building2, label: "Town Government", example: "needhamma.gov" },
  { icon: GraduationCap, label: "Public Schools", example: "needham.k12.ma.us" },
  { icon: NewspaperIcon, label: "Local News & Media", example: "" },
  { icon: Users, label: "Community Organizations", example: "Library, Community Farm" },
  { icon: Shield, label: "Emergency Services", example: "Police, Fire" },
  { icon: Trees, label: "Parks & Recreation", example: "" },
  { icon: Bus, label: "Public Transit", example: "MBTA" },
  { icon: Briefcase, label: "Local Businesses & Services", example: "" },
  { icon: Heart, label: "Health & Human Services", example: "" },
  { icon: Plus, label: "And more", example: "being added all the time" },
];

const FAQ_ITEMS = [
  {
    question: "Is this an official Town of Needham website?",
    answer: "No. This is an independent community project built by a Needham resident. Always verify important information at needhamma.gov or by calling Town Hall at (781) 455-7500.",
  },
  {
    question: "Is my data being collected?",
    answer: "We don&apos;t require accounts or collect personal information. Search queries are logged anonymously to improve results and understand what information residents are looking for. We use Pendo for anonymous usage analytics (no personal data).",
  },
  {
    question: "Can the AI be wrong?",
    answer: "Yes. AI can make mistakes or misinterpret information. That&apos;s why we always link to original sources so you can verify. For important decisions like permits, taxes, or legal matters, check official town resources or contact the relevant department.",
  },
  {
    question: "How can I help?",
    answer: "Send us feedback, suggest new sources, or report errors at info@needhamnavigator.com. This is a community project and we&apos;d love your input. If you&apos;re technical, contributions are welcome on GitHub!",
  },
  {
    question: "Who built this?",
    answer: "A Needham resident who loves this town and wanted to make public information easier to find. This project is open source — anyone can see how it works and contribute improvements.",
  },
  {
    question: "Is this free?",
    answer: "Yes, and it always will be. This is a passion project built to help the community, not to make money.",
  },
];

export default function AboutPage() {
  return (
    <>
      <Header />

      <main className="min-h-screen bg-surface">
        {/* Hero */}
        <section className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white py-16 px-4">
          <div className="max-w-[720px] mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-6">
              <Info size={16} />
              <span className="text-sm font-medium">About Needham Navigator</span>
            </div>
            <h1 className="text-4xl font-bold mb-4 leading-tight">
              Built by a neighbor, for the neighborhood
            </h1>
            <p className="text-lg text-white/90 leading-relaxed">
              A Needham resident noticed it was hard to find basic town information — transfer station hours, permit applications, school enrollment, town meeting dates — scattered across dozens of websites and PDFs. So we built an AI-powered tool to make it instant.
            </p>
          </div>
        </section>

        {/* Our Mission */}
        <section className="mx-auto max-w-content px-4 sm:px-6 mt-12">
          <h2 className="text-3xl font-bold text-text-primary mb-6">Our Mission</h2>
          <div className="bg-white border border-border-default rounded-xl p-6 space-y-4">
            <p className="text-[15px] text-text-primary leading-relaxed">
              Make Needham&apos;s public information accessible, searchable, and understandable for everyone.
            </p>
            <ul className="space-y-3 text-[15px] text-text-secondary">
              <li className="flex items-start gap-3">
                <span className="text-[var(--primary)] mt-1">•</span>
                <span>Not affiliated with, endorsed by, or operated by the Town of Needham</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--primary)] mt-1">•</span>
                <span>Free to use, always will be</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--primary)] mt-1">•</span>
                <span>Community-first: built to help residents, not to make money</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--primary)] mt-1">•</span>
                <span>Open source and transparent about how it works</span>
              </li>
            </ul>
          </div>
        </section>

        {/* How It Works */}
        <section className="mx-auto max-w-content px-4 sm:px-6 mt-12">
          <h2 className="text-3xl font-bold text-text-primary mb-6">How It Works</h2>
          <div className="bg-white border border-border-default rounded-xl p-6 space-y-4">
            <p className="text-[15px] text-text-primary leading-relaxed">
              Needham Navigator is transparent about using AI. Here&apos;s what happens when you search:
            </p>
            <ol className="space-y-4 text-[15px] text-text-secondary">
              <li className="flex items-start gap-3">
                <span className="text-[var(--primary)] font-semibold min-w-[24px]">1.</span>
                <span>We collect publicly available information from town websites, school district pages, local news, community organizations, and more</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--primary)] font-semibold min-w-[24px]">2.</span>
                <span>When you search, AI finds the most relevant information from our database and generates a clear, sourced answer</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--primary)] font-semibold min-w-[24px]">3.</span>
                <span>Every answer links back to official sources so you can verify</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--primary)] font-semibold min-w-[24px]">4.</span>
                <span>Data is refreshed regularly to stay current with new town information</span>
              </li>
            </ol>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
              <p className="text-[14px] text-yellow-900 font-medium">
                ⚠️ The AI can be wrong — always check official sources for critical decisions (permits, taxes, legal matters).
              </p>
            </div>
          </div>
        </section>

        {/* What We Cover */}
        <section className="mx-auto max-w-content px-4 sm:px-6 mt-12">
          <h2 className="text-3xl font-bold text-text-primary mb-6">What We Cover</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SOURCE_CATEGORIES.map((category) => (
              <div
                key={category.label}
                className="bg-white border border-border-default rounded-lg p-4 flex items-start gap-3"
              >
                <div className="text-[var(--primary)] mt-1">
                  <category.icon size={20} />
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-text-primary">
                    {category.label}
                  </div>
                  {category.example && (
                    <div className="text-[13px] text-text-muted mt-0.5">
                      {category.example}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* What's Coming Next */}
        <section className="mx-auto max-w-content px-4 sm:px-6 mt-12">
          <h2 className="text-3xl font-bold text-text-primary mb-6">What&apos;s Coming Next</h2>
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6">
            <ul className="space-y-3 text-[15px] text-text-primary">
              <li className="flex items-start gap-3">
                <span className="text-blue-600 mt-1">→</span>
                <span>More sources added regularly</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-600 mt-1">→</span>
                <span>AI Daily Brief — a morning summary of what&apos;s happening in Needham</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-600 mt-1">→</span>
                <span>AI-generated articles from meeting minutes and public records</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-600 mt-1">→</span>
                <span>Better recommendations for local services</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-600 mt-1">→</span>
                <span>And more features based on what you tell us you need!</span>
              </li>
            </ul>
          </div>
        </section>

        {/* CTA for Other Towns */}
        <section className="mx-auto max-w-content px-4 sm:px-6 mt-12">
          <div className="bg-gradient-to-r from-green-50 to-teal-50 border-2 border-green-300 rounded-xl p-8 text-center">
            <h2 className="text-2xl font-bold text-text-primary mb-3">
              Want This For Your Town?
            </h2>
            <p className="text-[15px] text-text-secondary mb-6 max-w-[600px] mx-auto leading-relaxed">
              Needham Navigator is open source and free for any community to use. If you&apos;re a town official, resident, or developer who wants to bring AI-powered municipal information to your community, you can fork this project and customize it for your town.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <a
                href="https://github.com/cmtemkin/needham-navigator"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--primary)] text-white text-[15px] font-semibold rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
              >
                <Github size={18} />
                View on GitHub
              </a>
              <a
                href="mailto:info@needhamnavigator.com?subject=Interested%20in%20Navigator%20for%20my%20town"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-[var(--primary)] text-[var(--primary)] text-[15px] font-semibold rounded-lg hover:bg-[var(--primary)] hover:text-white transition-colors"
              >
                <Mail size={18} />
                Get Help Getting Started
              </a>
            </div>
            <p className="text-[13px] text-text-muted mt-4">
              100% free • Open source • Easy to customize • Multi-tenant ready
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-content px-4 sm:px-6 mt-12">
          <h2 className="text-3xl font-bold text-text-primary mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {FAQ_ITEMS.map((item) => (
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

        {/* Contact */}
        <section className="mx-auto max-w-content px-4 sm:px-6 mt-12 pb-12">
          <h2 className="text-3xl font-bold text-text-primary mb-6">Get in Touch</h2>
          <div className="bg-white border border-border-default rounded-xl p-6">
            <p className="text-[15px] text-text-primary mb-6">
              Have feedback, found an error, or want to suggest a source? We&apos;d love to hear from you.
            </p>
            <div className="space-y-4">
              <a
                href="mailto:info@needhamnavigator.com"
                className="flex items-center gap-3 text-[15px] text-[var(--primary)] hover:text-[var(--primary-dark)] font-medium transition-colors group"
              >
                <Mail size={20} className="group-hover:scale-110 transition-transform" />
                <span>info@needhamnavigator.com</span>
                <ExternalLink size={14} className="opacity-50" />
              </a>
              <a
                href="https://github.com/cmtemkin/needham-navigator"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-[15px] text-[var(--primary)] hover:text-[var(--primary-dark)] font-medium transition-colors group"
              >
                <Github size={20} className="group-hover:scale-110 transition-transform" />
                <span>View on GitHub (open source)</span>
                <ExternalLink size={14} className="opacity-50" />
              </a>
            </div>
            <p className="text-[13px] text-text-muted mt-6">
              Needham Navigator is open source — contributions welcome! If you&apos;re a developer, designer, or data enthusiast who wants to help improve this tool for the community, check out our GitHub repository.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
