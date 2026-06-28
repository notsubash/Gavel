"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-16 md:px-6 lg:px-8">
      <h1 className="font-serif text-[28px] font-semibold text-ink">
        Something went wrong
      </h1>
      <p className="mt-4 max-w-prose text-ink-muted">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 inline-flex min-h-11 items-center border-2 border-ink bg-heat px-6 py-2 font-sans text-sm font-semibold text-white shadow-hard transition-[transform,box-shadow] duration-150 hover:translate-x-px hover:translate-y-px hover:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-heat"
      >
        Try again
      </button>
    </div>
  );
}
