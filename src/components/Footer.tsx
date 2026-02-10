export function Footer() {
  return (
    <footer className="max-w-content mx-auto mt-10 px-6 py-6 pb-8 text-center border-t border-border-light">
      <p className="text-[11.5px] text-text-muted leading-relaxed max-w-[600px] mx-auto">
        Needham Navigator is an independent community tool. Not affiliated with,
        endorsed by, or operated by the Town of Needham. AI responses may
        contain errors. Always verify with official sources at{" "}
        <a
          href="https://needhamma.gov"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          needhamma.gov
        </a>{" "}
        or call (781) 455-7500.{" "}
        <span className="text-text-muted">Terms &middot; Privacy</span>
      </p>
    </footer>
  );
}
