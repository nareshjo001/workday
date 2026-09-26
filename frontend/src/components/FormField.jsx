// Share field styling with controls that require custom input markup.
export function inputClassName(error) {
  return `w-full rounded-md border bg-surface px-3.5 py-2.5 text-base text-text outline-none transition placeholder:text-placeholder focus:ring-2 focus:ring-offset-0 ${
    error
      ? "border-error focus:border-error focus:ring-error/20"
      : "border-border focus:border-accent focus:ring-accent/20"
  }`;
}

export default function FormField({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  error,
  required = true,
  placeholder,
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text-secondary">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClassName(error)}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
