/**
 * Reusable inline banner for surfacing API/network errors and success
 * messages with a user-friendly message (never raw error objects/stack
 * traces). Shared across Authentication and future modules.
 */
export default function AlertBanner({ message, variant = "error" }) {
  if (!message) return null;

  const styles =
    variant === "error"
      ? "bg-error-bg text-error border-error-border"
      : "bg-success-bg text-success border-success-border";

  return (
    <div role="alert" className={`w-full rounded-md border px-4 py-3 text-sm ${styles}`}>
      {message}
    </div>
  );
}
