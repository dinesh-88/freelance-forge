import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cloud text-ink">
      <div className="rounded-3xl border border-ink/10 bg-white/80 p-10 text-center shadow-lift">
        <p className="text-xs uppercase tracking-[0.2em] text-haze">404</p>
        <h1 className="mt-4 font-display text-3xl">Page not found</h1>
        <p className="mt-2 text-sm text-slate">
          The page you are looking for is missing.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}
