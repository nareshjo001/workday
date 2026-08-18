/**
 * The single primary-action button used across Authentication and future
 * modules (Projects, Timesheets, Billing, ...). Encapsulates hover/active/
 * disabled/loading states so every "submit" style action looks and behaves
 * the same everywhere.
 */
export default function PrimaryButton({
  children,
  loadingText,
  isLoading = false,
  type = "submit",
  disabled = false,
  className = "",
  ...rest
}) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-base font-medium text-primary-foreground shadow-panel transition-colors duration-150 hover:bg-primary-hover active:bg-primary-active disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-primary ${className}`}
      {...rest}
    >
      {isLoading && (
        <span
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white"
          aria-hidden="true"
        />
      )}
      {isLoading ? loadingText || children : children}
    </button>
  );
}
