"use client";

import Link from "next/link";
import { Home, MessageSquare } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-border-light shadow-xs">
      <div className="max-w-content mx-auto px-6 h-[60px] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-[11px]">
          <div className="w-[34px] h-[34px] bg-gradient-to-br from-primary to-primary-light rounded-[9px] flex items-center justify-center text-white font-extrabold text-[15px]">
            N
          </div>
          <div>
            <div className="text-[17px] font-bold text-primary tracking-tight">
              Needham Navigator
            </div>
            <div className="text-[10.5px] text-text-muted font-medium">
              Your AI Town Guide
            </div>
          </div>
        </Link>
        <div className="hidden sm:flex items-center gap-1.5">
          <Link
            href="/"
            className="px-3.5 py-[7px] text-text-secondary text-[13.5px] font-medium rounded-lg hover:bg-surface hover:text-text-primary transition-all flex items-center gap-[5px]"
          >
            <Home size={15} />
            Home
          </Link>
          <Link
            href="/chat"
            className="px-3.5 py-[7px] bg-primary text-white text-[13.5px] font-semibold rounded-lg hover:bg-primary-light transition-all flex items-center gap-[5px]"
          >
            <MessageSquare size={14} />
            Ask a Question
          </Link>
        </div>
      </div>
    </header>
  );
}
