export function ArticleSkeleton({ variant = "grid" }: { variant?: "grid" | "list" }) {
  return (
    <div className={`bg-white border border-border-default rounded-lg animate-pulse ${variant === "list" ? "p-5" : "p-4"}`}>
      {/* Badges */}
      <div className="flex items-center gap-2 mb-3">
        <div className="h-5 w-20 bg-gray-200 rounded" />
        <div className="h-5 w-24 bg-gray-200 rounded" />
      </div>

      {/* Title */}
      <div className={`bg-gray-300 rounded mb-2 ${variant === "list" ? "h-6 w-3/4" : "h-5 w-4/5"}`} />

      {/* Subtitle */}
      <div className="h-4 w-2/3 bg-gray-200 rounded mb-2" />

      {/* Summary lines */}
      <div className="space-y-2 mb-3">
        <div className="h-3 w-full bg-gray-200 rounded" />
        <div className="h-3 w-5/6 bg-gray-200 rounded" />
        {variant === "list" && <div className="h-3 w-4/5 bg-gray-200 rounded" />}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border-light">
        <div className="h-3 w-32 bg-gray-200 rounded" />
        <div className="h-3 w-20 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

export function DailyBriefSkeleton() {
  return (
    <div className="bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl p-6 shadow-lg mb-8 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 bg-white/20 rounded-lg p-3 w-14 h-14" />
        <div className="flex-1 min-w-0">
          <div className="h-8 w-64 bg-white/30 rounded mb-2" />
          <div className="h-4 w-48 bg-white/20 rounded mb-4" />
          <div className="space-y-2 mb-4">
            <div className="h-3 w-full bg-white/20 rounded" />
            <div className="h-3 w-5/6 bg-white/20 rounded" />
            <div className="h-3 w-4/5 bg-white/20 rounded" />
          </div>
          <div className="h-4 w-32 bg-white/30 rounded" />
        </div>
      </div>
    </div>
  );
}
