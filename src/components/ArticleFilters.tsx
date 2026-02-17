"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface ArticleFiltersProps {
  selectedCategory: string;
  selectedContentType: string;
  onCategoryChange: (category: string) => void;
  onContentTypeChange: (contentType: string) => void;
}

const CATEGORIES: { value: string; label: string }[] = [
  { value: "all", label: "All Categories" },
  { value: "government", label: "Town Government" },
  { value: "schools", label: "Schools" },
  { value: "public_safety", label: "Public Safety" },
  { value: "community", label: "Community" },
  { value: "development", label: "Permits & Development" },
  { value: "business", label: "Business" },
];

const CONTENT_TYPES: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ai_generated", label: "AI Generated" },
  { value: "ai_summary", label: "AI Summary" },
  { value: "external", label: "External" },
];

export function ArticleFilters({
  selectedCategory,
  selectedContentType,
  onCategoryChange,
  onContentTypeChange,
}: ArticleFiltersProps) {
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  const selectedCategoryLabel = CATEGORIES.find((c) => c.value === selectedCategory)?.label || "All Categories";

  return (
    <div className="bg-white border border-border-default rounded-lg p-4 mb-6">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Category Dropdown */}
        <div className="relative flex-1">
          <label className="block text-xs font-medium text-text-muted mb-1.5">
            Category
          </label>
          <div className="relative">
            <button
              onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
              className="w-full flex items-center justify-between px-3 py-2 bg-white border border-border-default rounded-md text-sm text-text-primary hover:border-[var(--primary)] transition-colors"
            >
              <span>{selectedCategoryLabel}</span>
              <ChevronDown size={16} className={`transition-transform ${categoryDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {categoryDropdownOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setCategoryDropdownOpen(false)}
                />
                {/* Dropdown menu */}
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border-default rounded-md shadow-lg z-20 max-h-64 overflow-auto">
                  {CATEGORIES.map((category) => (
                    <button
                      key={category.value}
                      onClick={() => {
                        onCategoryChange(category.value);
                        setCategoryDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                        selectedCategory === category.value ? 'bg-[var(--primary)]/5 text-[var(--primary)] font-medium' : 'text-text-primary'
                      }`}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Content Type Pills */}
        <div className="flex-1">
          <label className="block text-xs font-medium text-text-muted mb-1.5">
            Content Type
          </label>
          <div className="flex flex-wrap gap-2">
            {CONTENT_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => onContentTypeChange(type.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  selectedContentType === type.value
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
