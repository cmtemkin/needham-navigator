"use client";

import { useRouter } from "next/navigation";
import type { DepartmentChip as DeptChipType } from "@/lib/mock-data";
import { useTownHref } from "@/lib/town-context";

interface DepartmentChipProps {
  dept: DeptChipType;
}

export function DepartmentChip({ dept }: DepartmentChipProps) {
  const router = useRouter();
  const chatHref = useTownHref("/chat");

  return (
    <button
      onClick={() => router.push(`${chatHref}?q=${encodeURIComponent(dept.question)}`)}
      className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-white border border-border-light rounded-[10px] cursor-pointer transition-all shadow-xs hover:border-primary hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="text-base">{dept.icon}</span>
      <div className="text-left">
        <div className="text-[13px] font-semibold text-text-primary whitespace-nowrap">
          {dept.name}
        </div>
        <div className="text-[11.5px] text-text-muted whitespace-nowrap">
          {dept.phone}
        </div>
      </div>
    </button>
  );
}
