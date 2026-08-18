import { SELF_SIGNUP_ROLES, ROLE_META } from "../constants/roles";

/**
 * Compact, responsive role-selection control for signup. Renders as a
 * row of cards on wider screens and wraps/stacks naturally on narrow
 * viewports — implemented as a native radiogroup so it stays keyboard
 * and screen-reader accessible without any extra ARIA plumbing.
 */
export default function RoleSelector({ value, onChange, error }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-medium text-text-secondary">I am a</legend>
      <div
        role="radiogroup"
        aria-describedby={error ? "role-error" : undefined}
        className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
      >
        {SELF_SIGNUP_ROLES.map((role) => {
          const meta = ROLE_META[role];
          const isSelected = value === role;
          return (
            <label
              key={role}
              className={`flex cursor-pointer flex-col gap-0.5 rounded-md border px-3.5 py-3 text-left transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2 ${
                isSelected
                  ? "border-primary bg-primary-light ring-1 ring-primary"
                  : "border-border bg-surface hover:border-border-strong"
              }`}
            >
              <input
                type="radio"
                name="role"
                value={role}
                checked={isSelected}
                onChange={onChange}
                className="sr-only"
              />
              <span className="text-sm font-semibold text-text">{meta.label}</span>
              <span className="text-xs text-muted">{meta.description}</span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id="role-error" className="text-sm text-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}
