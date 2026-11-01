const labels: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Accepted · active",
  REJECTED: "Declined",
  CANCELLED: "Cancelled",
  RECOVERED: "Recovered",
  EXPIRED: "Expired",
};

export default function ClaimStatusBadge({ status, custodyStatus }: { status: string; custodyStatus?: string | null }) {
  if (custodyStatus === "WITH_STEWARD") return <span className="claim-status-badge claim-status-steward">Transferred to Steward</span>;
  const normalized = status.toUpperCase();
  const tone = normalized === "RECOVERED" ? "recovered" : normalized === "CANCELLED" || normalized === "REJECTED" ? "cancelled" : normalized === "EXPIRED" ? "expired" : normalized === "APPROVED" ? "approved" : "pending";
  return <span className={`claim-status-badge claim-status-${tone}`}>{labels[normalized] ?? normalized.toLowerCase().replaceAll("_", " ")}</span>;
}
