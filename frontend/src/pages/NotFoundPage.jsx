import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <h1 className="text-3xl font-semibold text-text">404</h1>
      <p className="text-muted">This page doesn't exist.</p>
      <Link to="/" className="mt-2 text-accent hover:underline">
        Go back home
      </Link>
    </div>
  );
}
