export function formatRate(rate) {
  const value = Number(rate);
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function StatusBadge({ status }) {
  const isActive = status === "ACTIVE";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        isActive ? "bg-success-bg text-success" : "bg-surface-muted text-muted"
      }`}
    >
      {status}
    </span>
  );
}
