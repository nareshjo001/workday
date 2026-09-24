import { SELF_SIGNUP_ROLES, ROLE_META } from "../constants/roles";

/**
 * Compact, responsive role-selection control for signup. Renders as a
 * row of cards on wider screens and wraps/stacks naturally on narrow
 * viewports — implemented as a native radiogroup so it stays keyboard
 * and screen-reader accessible without any extra ARIA plumbing.
 */
export default function RoleSelector({ value, onChange, error }) {
  return (
    <fieldset className="signup-role-selector">
      <legend>I am a</legend>
      <div
        role="radiogroup"
        aria-describedby={error ? "role-error" : undefined}
        aria-invalid={!!error}
        className="signup-role-grid"
      >
        {SELF_SIGNUP_ROLES.map((role) => {
          const meta = ROLE_META[role];
          const isSelected = value === role;
          return (
            <label
              key={role}
              className={`signup-role-card${isSelected ? " is-selected" : ""}`}
            >
              <input
                type="radio"
                name="role"
                value={role}
                checked={isSelected}
                onChange={onChange}
                className="sr-only"
              />
              <span className="signup-role-icon" aria-hidden="true"><RoleIcon role={role} /></span>
              <span className="signup-role-copy">
                <strong>{meta.label}</strong>
                <small>{meta.description}</small>
              </span>
              <span className="signup-role-check" aria-hidden="true">✓</span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id="role-error" role="alert" className="signup-role-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function RoleIcon({ role }) {
  if (role === "PM") {
    return <svg viewBox="0 0 24 24"><path d="M4 20V8l8-4 8 4v12M9 20v-5h6v5M8 10h.01M12 10h.01M16 10h.01" /></svg>;
  }
  return <svg viewBox="0 0 24 24"><path d="M4 20V9h16v11M8 9V5h8v4M8 13h3M13 13h3M8 17h3M13 17h3" /></svg>;
}
