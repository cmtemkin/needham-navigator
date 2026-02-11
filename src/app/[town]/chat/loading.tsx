export default function TownChatLoading() {
  return (
    <div
      className="mx-auto flex min-h-[calc(100vh-60px)] w-full max-w-[860px] flex-col gap-4 px-4 py-6 sm:px-6"
      aria-busy="true"
    >
      <div className="h-9 w-36 animate-pulse rounded-lg bg-surface" />
      <div className="h-24 w-full animate-pulse rounded-2xl bg-white" />
      <div className="ml-auto h-20 w-[70%] animate-pulse rounded-2xl bg-white" />
      <div className="h-24 w-[85%] animate-pulse rounded-2xl bg-white" />
      <div className="mt-auto h-16 w-full animate-pulse rounded-xl bg-white" />
    </div>
  );
}
