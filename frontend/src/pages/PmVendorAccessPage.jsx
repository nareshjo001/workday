import { useCallback, useEffect, useRef, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import pmVendorAccess from "../services/pmVendorAccessService";
import pmProjects from "../services/pmProjectService";
import AlertBanner from "../components/AlertBanner";
import Spinner from "../components/Spinner";
import "./PmVendorAccessPage.css";


function UsersIcon({ size = 20, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} aria-hidden="true">
      <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4zm7.5-3a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-.85 0-1.63.2-2.31.54 1.13.88 1.81 2.11 1.81 3.46v3h6.5v-3c0-2.66-5.33-4-6-4z" />
    </svg>
  );
}

function LinkIcon({ size = 18, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function BuildingIcon({ size = 18, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="9" y1="6" x2="9" y2="6.01" />
      <line x1="15" y1="6" x2="15" y2="6.01" />
      <line x1="9" y1="10" x2="9" y2="10.01" />
      <line x1="15" y1="10" x2="15" y2="10.01" />
      <line x1="9" y1="14" x2="9" y2="14.01" />
      <line x1="15" y1="14" x2="15" y2="14.01" />
      <path d="M10 22v-4h4v4" />
    </svg>
  );
}

function FolderIcon({ size = 18, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ChevronDownIcon({ size = 15, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function InfoCircleIcon({ size = 18, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} aria-hidden="true">
      <path fillRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" clipRule="evenodd" />
    </svg>
  );
}

function SearchIcon({ size = 16, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function InboxIcon({ size = 24, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function UserMinusIcon({ size = 18, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="17" y1="11" x2="23" y2="11" />
    </svg>
  );
}

function CloseIcon({ size = 16, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}


function HeroEnterpriseIllustration() {
  return (
    <div className="va-hero-diagram-wrap" aria-hidden="true">
      <svg
        viewBox="0 0 460 135"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="va-hero-svg"
        preserveAspectRatio="xMaxYMid meet"
      >
        <defs>
          <linearGradient id="vaWaveGrad1" x1="0" y1="40" x2="460" y2="135" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f8faff" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#eaf3fe" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#dbeafe" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="vaWaveGrad2" x1="50" y1="0" x2="460" y2="135" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#eff6ff" stopOpacity="0.5" />
            <stop offset="60%" stopColor="#e0f0fe" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#d6e8fc" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="vaWaveGradTop" x1="200" y1="0" x2="460" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f1f7fe" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#e2effe" stopOpacity="0.6" />
          </linearGradient>

          <filter id="vaDocShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#1e40af" floodOpacity="0.08" />
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#1e40af" floodOpacity="0.04" />
          </filter>

          <filter id="vaFolderShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#1d4ed8" floodOpacity="0.16" />
          </filter>
        </defs>

        <path
          d="M220 0C270 24 320 34 370 28C410 23 435 12 460 2V0H220Z"
          fill="url(#vaWaveGradTop)"
        />

        <path
          d="M0 135C40 120 80 88 135 88C190 88 220 120 275 122C330 124 380 94 460 84V135H0Z"
          fill="url(#vaWaveGrad1)"
        />

        <path
          d="M60 135C100 124 140 118 185 128C230 138 290 136 345 124C400 112 435 92 460 96V135H60Z"
          fill="url(#vaWaveGrad2)"
        />

        <g opacity="0.35">
          {[0, 1, 2].map((row) =>
            [0, 1, 2, 3, 4].map((col) => (
              <circle
                key={`tr-${row}-${col}`}
                cx={360 + col * 12}
                cy={14 + row * 10}
                r="1.6"
                fill="#94a3b8"
              />
            ))
          )}
        </g>

        <circle cx="410" cy="18" r="14" fill="#dbeafe" opacity="0.6" />


        <path
          d="M135 38C154 35 174 37 193 42"
          stroke="#93c5fd"
          strokeWidth="2.2"
          strokeDasharray="4 3.5"
          strokeLinecap="round"
          opacity="0.85"
        />

        <path
          d="M239 66C272 94 320 96 353 76"
          stroke="#93c5fd"
          strokeWidth="2.2"
          strokeDasharray="4 3.5"
          strokeLinecap="round"
          opacity="0.85"
        />
        <circle cx="239" cy="66" r="4.5" fill="#ffffff" stroke="#bfdbfe" strokeWidth="1" />
        <circle cx="239" cy="66" r="2.2" fill="#93c5fd" />

        <path
          d="M85 59C101 47 118 41 135 38"
          stroke="#2563eb"
          strokeWidth="2.4"
          strokeDasharray="4 3.5"
          strokeLinecap="round"
        />

        <g>
          <circle cx="135" cy="38" r="9.5" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1.2" opacity="0.95" />
          <circle cx="135" cy="38" r="6.5" fill="#ffffff" />
          <circle cx="135" cy="38" r="3.2" fill="#2563eb" />
        </g>

        <g>
          <circle cx="66" cy="72" r="28" fill="#dbeafe" opacity="0.45" />
          <circle cx="66" cy="72" r="24" fill="#bfdbfe" opacity="0.5" />
          <circle cx="66" cy="72" r="23" fill="#2563eb" />
          <circle cx="66" cy="66.5" r="5" fill="#ffffff" />
          <path
            d="M56.5 82C56.5 77 60.5 73.5 66 73.5C71.5 73.5 75.5 77 75.5 82Z"
            fill="#ffffff"
          />
        </g>

        <g filter="url(#vaDocShadow)">
          <rect
            x="193"
            y="28"
            width="46"
            height="48"
            rx="10"
            fill="#ffffff"
            stroke="#e2e8f0"
            strokeWidth="1"
          />
          <line x1="203" y1="42" x2="229" y2="42" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="203" y1="51" x2="229" y2="51" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="203" y1="60" x2="220" y2="60" stroke="#60a5fa" strokeWidth="2.2" strokeLinecap="round" />
        </g>

        <g filter="url(#vaFolderShadow)">
          <path
            d="M353 55C353 51.5 355.5 49 359 49H374C376.5 49 378.5 51 380 54H393C396.5 54 399 56.5 399 60V89C399 92.5 396.5 95 393 95H359C355.5 95 353 92.5 353 89Z"
            fill="#1d4ed8"
          />
          <rect
            x="353"
            y="58"
            width="46"
            height="37"
            rx="7"
            fill="#2563eb"
          />
          <circle cx="376" cy="77" r="8.5" fill="#3b82f6" opacity="0.65" />
          <path
            d="M372.5 77L375 79.5L379.5 74.5"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
}

export default function PmVendorAccessPage() {
  const [vendors, setVendors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [connections, setConnections] = useState([]);
  const [vendorId, setVendorId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vendorData, projectData, connectionData] = await Promise.all([
        pmVendorAccess.vendors(),
        pmProjects.listProjects(),
        pmVendorAccess.connections(),
      ]);
      setVendors(vendorData.items || []);
      setProjects((projectData.items || projectData.projects || []).filter((project) => project.status === "ACTIVE"));
      setConnections((connectionData.items || []).filter((connection) => connection.status === "ACTIVE"));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (event) => {
    event.preventDefault();
    if (!vendorId) return;
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      await pmVendorAccess.connect(Number(vendorId), projectId ? Number(projectId) : undefined);
      setMessage("Vendor relationship and sourcing access saved.");
      setVendorId("");
      setProjectId("");
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setVendorId("");
    setProjectId("");
    setError(null);
  };

  const [removingVendor, setRemovingVendor] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const triggerRef = useRef(null);

  const handleOpenRemoveModal = (connection, event) => {
    triggerRef.current = event?.currentTarget || null;
    setRemovingVendor(connection);
  };

  const closeRemoveModal = useCallback(() => {
    if (isRemoving) return;
    setRemovingVendor(null);
    if (triggerRef.current && typeof triggerRef.current.focus === "function") {
      triggerRef.current.focus();
    }
  }, [isRemoving]);

  const confirmRemove = async () => {
    if (!removingVendor || isRemoving) return;
    setIsRemoving(true);
    setError(null);
    setMessage(null);
    try {
      await pmVendorAccess.remove(removingVendor.id);
      setMessage("Vendor access was removed from future sourcing.");
      setRemovingVendor(null);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsRemoving(false);
    }
  };

  useEffect(() => {
    if (!removingVendor) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        closeRemoveModal();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [removingVendor, closeRemoveModal]);

  const filteredConnections = connections.filter((connection) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = connection.name?.toLowerCase().includes(q);
    const emailMatch = connection.email?.toLowerCase().includes(q);
    const projectMatch = connection.projects?.some((project) =>
      project.name?.toLowerCase().includes(q)
    );
    return Boolean(nameMatch || emailMatch || projectMatch);
  });

  return (
    <DashboardLayout title="Vendor Access">
      <div className="va-container">
        <AlertBanner message={error} />
        <AlertBanner message={message} variant="success" />

        <section className="va-card va-hero-card" aria-labelledby="vendor-access-heading">
          <div className="va-hero-content">
            <div className="va-hero-badge" aria-hidden="true">
              <UsersIcon size={22} />
            </div>
            <div>
              <h1 id="vendor-access-heading" className="va-hero-title">Vendor Access</h1>
              <p className="va-hero-desc">
                Connect vendors to your client and grant project sourcing access.
              </p>
            </div>
          </div>
          <HeroEnterpriseIllustration />
        </section>

        {loading ? (
          <div className="va-card flex justify-center py-12">
            <Spinner label="Loading vendors…" />
          </div>
        ) : (
          <>
            <section className="va-card" aria-labelledby="connect-vendor-heading">
              <div className="va-card-header">
                <div className="va-icon-badge" aria-hidden="true">
                  <LinkIcon size={20} />
                </div>
                <div>
                  <h2 id="connect-vendor-heading" className="va-card-title">Connect a Vendor</h2>
                  <p className="va-card-subtitle">Select a vendor and choose the level of access.</p>
                </div>
              </div>

              <form onSubmit={submit}>
                <div className="va-form-grid">
                  <div className="va-field-group">
                    <label htmlFor="va-vendor-select" className="va-label">
                      Vendor <span className="va-required-star" aria-hidden="true">*</span>
                    </label>
                    <div className="va-select-wrapper">
                      <span className="va-select-icon" aria-hidden="true">
                        <BuildingIcon size={17} />
                      </span>
                      <select
                        id="va-vendor-select"
                        required
                        value={vendorId}
                        onChange={(e) => setVendorId(e.target.value)}
                        className="va-select"
                        disabled={saving}
                      >
                        <option value="">Select a registered vendor</option>
                        {vendors.map((vendor) => (
                          <option key={vendor.id} value={vendor.id}>
                            {vendor.name} · {vendor.email}
                          </option>
                        ))}
                      </select>
                      <span className="va-select-chevron" aria-hidden="true">
                        <ChevronDownIcon size={15} />
                      </span>
                    </div>
                  </div>

                  <div className="va-field-group">
                    <label htmlFor="va-project-select" className="va-label">
                      Project access <span className="va-optional-tag">(optional)</span>
                    </label>
                    <div className="va-select-wrapper">
                      <span className="va-select-icon" aria-hidden="true">
                        <FolderIcon size={17} />
                      </span>
                      <select
                        id="va-project-select"
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        className="va-select"
                        disabled={saving}
                      >
                        <option value="">Connect to client only</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                      <span className="va-select-chevron" aria-hidden="true">
                        <ChevronDownIcon size={15} />
                      </span>
                    </div>
                  </div>
                </div>

                <div className="va-info-banner" role="note">
                  <span className="va-info-icon" aria-hidden="true">
                    <InfoCircleIcon size={17} />
                  </span>
                  <p className="va-info-text">
                    Connect the vendor to your client. Optionally grant sourcing access to a project.
                  </p>
                </div>

                <div className="va-actions-row">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={saving || (!vendorId && !projectId)}
                    className="va-btn-cancel"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !vendorId}
                    className="va-btn-connect"
                  >
                    <LinkIcon size={16} />
                    <span>{saving ? "Saving…" : "Connect vendor"}</span>
                  </button>
                </div>
              </form>
            </section>

            <section className="va-card" aria-labelledby="connected-vendors-heading">
              <div className="va-connected-header">
                <div className="va-card-header">
                  <div className="va-icon-badge" aria-hidden="true">
                    <UsersIcon size={20} />
                  </div>
                  <div>
                    <h2 id="connected-vendors-heading" className="va-card-title">Connected vendors</h2>
                    <p className="va-card-subtitle">Vendors currently connected to your client and their project access.</p>
                  </div>
                </div>

                <div className="va-search-wrapper">
                  <span className="va-search-icon" aria-hidden="true">
                    <SearchIcon size={16} />
                  </span>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search vendors..."
                    aria-label="Search vendors"
                    className="va-search-input"
                  />
                </div>
              </div>

              <div className="va-inset-box">
                {filteredConnections.length === 0 ? (
                  <div className="va-empty-state">
                    <div className="va-empty-icon-badge" aria-hidden="true">
                      <InboxIcon size={24} />
                    </div>
                    <h3 className="va-empty-title">
                      {connections.length === 0
                        ? "No vendors are currently connected."
                        : "No connected vendors match your search."}
                    </h3>
                    <p className="va-empty-desc">
                      {connections.length === 0
                        ? "Once you connect a vendor, they will appear here with their access details."
                        : "Try searching with a different vendor name or email."}
                    </p>
                  </div>
                ) : (
                  <div className="va-vendor-list" role="list">
                    {filteredConnections.map((connection) => (
                      <div key={connection.id} className="va-vendor-row" role="listitem">
                        <div className="va-vendor-info">
                          <div className="va-vendor-avatar" aria-hidden="true">
                            {(connection.name || "V").charAt(0).toUpperCase()}
                          </div>
                          <div className="va-vendor-details">
                            <div className="va-vendor-name-row">
                              <h3 className="va-vendor-name">{connection.name}</h3>
                              <div className="va-vendor-badges">
                                <span className="va-badge-client">Client access</span>
                                {connection.projects && connection.projects.length > 0 ? (
                                  connection.projects.length <= 3 ? (
                                    connection.projects.map((project) => (
                                      <span
                                        key={project.id}
                                        className="va-badge-project"
                                        title={`Project access: ${project.name}`}
                                      >
                                        {project.name}
                                      </span>
                                    ))
                                  ) : (
                                    <>
                                      {connection.projects.slice(0, 2).map((project) => (
                                        <span
                                          key={project.id}
                                          className="va-badge-project"
                                          title={`Project access: ${project.name}`}
                                        >
                                          {project.name}
                                        </span>
                                      ))}
                                      <span
                                        className="va-badge-project"
                                        title={connection.projects.slice(2).map((p) => p.name).join(", ")}
                                      >
                                        +{connection.projects.length - 2} more
                                      </span>
                                    </>
                                  )
                                ) : (
                                  <span className="va-badge-no-project">No project access</span>
                                )}
                              </div>
                            </div>
                            <p className="va-vendor-email">{connection.email}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="va-btn-remove"
                          onClick={(e) => handleOpenRemoveModal(connection, e)}
                        >
                          Remove access
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {removingVendor && (
          <div
            className="va-modal-backdrop"
            onClick={closeRemoveModal}
          >
            <div
              className="va-remove-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="remove-vendor-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="va-remove-modal-header">
                <div className="va-remove-modal-header-left">
                  <div className="va-remove-icon-badge" aria-hidden="true">
                    <UserMinusIcon size={20} />
                  </div>
                  <h2 id="remove-vendor-modal-title" className="va-remove-modal-title">
                    Remove vendor access
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeRemoveModal}
                  disabled={isRemoving}
                  aria-label="Close"
                  className="va-remove-modal-close"
                >
                  <CloseIcon size={18} />
                </button>
              </div>

              <div className="va-remove-modal-body">
                <p className="va-remove-question">
                  Remove access for {removingVendor.name}?
                </p>
                <p className="va-remove-warning-text">
                  This will remove the vendor's client access and all active project sourcing access. Existing assignments and historical records will remain unchanged.
                </p>

                <div className="va-remove-summary-card">
                  <div className="va-remove-summary-row">
                    <span className="va-remove-summary-label">Client access</span>
                    <span className="va-badge-client-status">Connected</span>
                  </div>
                  <div className="va-remove-summary-row">
                    <span className="va-remove-summary-label">Project access</span>
                    <div className="va-remove-summary-value">
                      {removingVendor.projects && removingVendor.projects.length > 0 ? (
                        <div className="va-remove-project-list">
                          {removingVendor.projects.map((project) => (
                            <span key={project.id} className="va-remove-project-pill">
                              {project.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="va-remove-none-text">None</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="va-remove-modal-footer">
                <button
                  type="button"
                  onClick={closeRemoveModal}
                  disabled={isRemoving}
                  className="va-btn-modal-cancel"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRemove}
                  disabled={isRemoving}
                  className="va-btn-modal-remove"
                >
                  <UserMinusIcon size={15} />
                  <span>{isRemoving ? "Removing…" : "Remove access"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
