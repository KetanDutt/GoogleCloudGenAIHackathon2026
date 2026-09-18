import Link from "next/link";
export default function NotFound() {
  return (
    <div className="panel mx-auto max-w-lg p-10 text-center">
      <p className="eyebrow mb-4">404 · A SMALL DETOUR</p>
      <h1 className="text-2xl">This page isn’t in your workspace.</h1>
      <p className="mt-3 text-sm text-muted">
        Let’s get you back to your plans.
      </p>
      <Link href="/" className="btn btn-primary mt-6">
        Back to overview
      </Link>
    </div>
  );
}
