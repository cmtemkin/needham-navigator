export default function TownRouteLoading() {
  return (
    <div className="mx-auto w-full max-w-content px-4 py-8 sm:px-6" aria-busy="true">
      <div className="mb-4 h-14 animate-pulse rounded-xl bg-surface" />
      <div className="mb-3 h-36 animate-pulse rounded-2xl bg-white" />
      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`skeleton-${index}`} className="h-44 animate-pulse rounded-xl bg-white" />
        ))}
      </div>
      <p className="text-sm text-text-secondary">Loading town experience...</p>
    </div>
  );
}
