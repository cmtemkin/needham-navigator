import Link from "next/link";
import { DEFAULT_TOWN_ID } from "@/lib/towns";

export default function TownNotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[760px] flex-col items-center justify-center px-4 text-center sm:px-6">
      <h1 className="mb-2 text-2xl font-bold text-text-primary">Town not found</h1>
      <p className="mb-5 max-w-[560px] text-sm text-text-secondary">
        The requested town configuration is missing or unavailable.
      </p>
      <Link
        href={`/${DEFAULT_TOWN_ID}`}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        Go to default town
      </Link>
    </div>
  );
}
