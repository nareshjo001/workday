import { formatRate, getInitials } from "./format";
import { formatSkill } from "../../constants/skills";
import { getSkillTheme } from "../../utils/skillTheme";

export function SkillBadge({ skill }) {
  const theme = getSkillTheme(skill);
  const label = formatSkill(skill);

  return (
    <span
      className="contractor-skill-badge"
      style={{
        backgroundColor: theme.bg,
        color: theme.text,
        borderColor: theme.border,
      }}
      data-testid="contractor-skill-badge"
    >
      <span
        className="contractor-badge-dot"
        style={{ backgroundColor: theme.dot }}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}

export function ContractorStatusBadge({ status }) {
  const isActive = status === "ACTIVE";

  return (
    <span
      className={`contractor-status-badge ${isActive ? "is-active" : "is-inactive"}`}
      data-testid="contractor-status-badge"
    >
      <span className="contractor-badge-dot" aria-hidden="true" />
      <span>{status}</span>
    </span>
  );
}

function MonitorIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="contractor-col-icon">
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="contractor-col-icon">
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r=".75" fill="currentColor" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="contractor-col-icon">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

/**
 * Responsive Contractor Cards List.
 * Replaces the wide table that required horizontal scrolling with compact,
 * responsive row cards inspired by the enterprise list design reference.
 */
export default function ContractorCardList({ contractors, onEdit, onHistory }) {
  if (!contractors || contractors.length === 0) {
    return null;
  }

  return (
    <div className="contractor-card-list" data-testid="contractor-card-list">
      {/* Desktop List Header: ONE lightweight header above all contractor rows */}
      <div
        className="contractor-list-header"
        data-testid="contractor-list-header"
        role="row"
        aria-label="Contractor column headers"
      >
        <div className="contractor-th-cell contractor-th-identity">Contractor</div>
        <div className="contractor-th-cell contractor-th-skill">Skill</div>
        <div className="contractor-th-cell contractor-th-rate">Rate</div>
        <div className="contractor-th-cell contractor-th-status">Status</div>
        <div className="contractor-th-cell contractor-th-actions">Actions</div>
      </div>

      {contractors.map((contractor) => (
        <article
          key={contractor.id}
          className="contractor-row-card"
          data-testid={`contractor-card-${contractor.id}`}
        >
          {/* Identity: Avatar + Name + Email */}
          <div className="contractor-card-identity">
            <div
              className="contractor-avatar"
              aria-hidden="true"
              data-testid="contractor-avatar"
            >
              {getInitials(contractor.name)}
            </div>
            <div className="contractor-identity-info">
              <h2 className="contractor-name" title={contractor.name}>
                {contractor.name}
              </h2>
              <p className="contractor-email" title={contractor.email}>
                {contractor.email}
              </p>
            </div>
          </div>

          {/* Skill column */}
          <div className="contractor-card-col contractor-col-skill">
            <span className="contractor-col-label">
              <MonitorIcon />
              <span>Skill</span>
            </span>
            <div className="contractor-col-value">
              <SkillBadge skill={contractor.skill} />
            </div>
          </div>

          {/* Rate column */}
          <div className="contractor-card-col contractor-col-rate">
            <span className="contractor-col-label">
              <TagIcon />
              <span>Rate</span>
            </span>
            <div className="contractor-col-value">
              <span className="contractor-rate-value">
                {formatRate(contractor.hourly_rate)}
              </span>
            </div>
          </div>

          {/* Status column */}
          <div className="contractor-card-col contractor-col-status">
            <span className="contractor-col-label">
              <ActivityIcon />
              <span>Status</span>
            </span>
            <div className="contractor-col-value">
              <ContractorStatusBadge status={contractor.status} />
            </div>
          </div>

          {/* Actions column */}
          <div className="contractor-card-col contractor-col-actions">
            <div className="contractor-col-value contractor-actions-group">
              <button
                type="button"
                onClick={() => onHistory(contractor)}
                className="contractor-btn-history"
                aria-label={`View history for ${contractor.name}`}
              >
                History
              </button>
              <button
                type="button"
                onClick={() => onEdit(contractor)}
                className="contractor-btn-edit"
                aria-label={`Edit ${contractor.name}`}
              >
                Edit
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
