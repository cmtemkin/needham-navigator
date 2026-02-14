import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-light text-2xl font-extrabold text-white">
          N
        </div>
        <h1 className="mb-2 text-2xl font-bold text-text-primary">
          Page not found
        </h1>
        <p className="mb-8 text-text-secondary">
          This page doesn&apos;t exist. Let&apos;s get you back on track.
        </p>
        <Link
          href="/needham"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
