import { Link } from "react-router-dom";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <h1 className="text-3xl font-semibold text-text">403</h1>
      <p className="text-muted">You don't have access to this page.</p>
      <Link to="/" className="mt-2 text-accent hover:underline">
        Go back home
      </Link>
    </div>
  );
}
