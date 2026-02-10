"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <div className="sticky bottom-0 px-6 pt-3 pb-5 bg-surface max-sm:px-4 max-sm:pb-4">
      <div className="flex items-center bg-white border-[1.5px] border-border-default rounded-[14px] p-1 pl-4 transition-all shadow-sm focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(0,63,135,0.08),0_2px_8px_rgba(0,0,0,0.06)]">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask anything about Needham..."
          disabled={disabled}
          className="flex-1 border-none bg-transparent outline-none text-[14.5px] text-text-primary py-[11px] font-sans placeholder:text-[#B8BCC8] disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="w-10 h-10 rounded-[10px] bg-primary text-white flex items-center justify-center hover:bg-primary-light transition-colors shrink-0 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          <Send size={18} />
        </button>
      </div>
      <p className="text-[11px] text-text-muted text-center mt-2 leading-snug">
        AI-generated responses may be inaccurate. Always verify with official
        sources. Not affiliated with the Town of Needham.
      </p>
    </div>
  );
}
