// Display safe API messages without exposing raw errors or stack traces.
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
