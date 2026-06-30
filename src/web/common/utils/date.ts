// ─── Date / time formatting utilities ──────────────────────────────────────────

type DateInput = Date | string | null | undefined;

/** Parse any DateInput into a valid Date, or null */
function toDate(d: DateInput): Date | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Full date + time: "04/04/2026, 08:30" */
export function formatDateTime(d: DateInput): string {
  const date = toDate(d);
  if (!date) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Time only: "08:30" */
export function formatTimeOnly(d: DateInput): string {
  const date = toDate(d);
  if (!date) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Human-readable day header: "Today", "Yesterday", or full weekday date */
export function formatDayHeader(d: DateInput): string {
  const date = toDate(d);
  if (!date) return "Unknown";

  const now = new Date();
  const isToday = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.getFullYear() === yesterday.getFullYear() && date.getMonth() === yesterday.getMonth() && date.getDate() === yesterday.getDate();

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";

  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** Unique date key for grouping: "2026-04-04" */
export function getDayKey(d: DateInput): string {
  const date = toDate(d);
  if (!date) return "unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Relative time description.
 * Past: "just now", "5m ago", "2h ago", "3d ago"
 * Future: "in 5m", "in 2h", "in 3d"
 */
export function relativeTime(d: DateInput): string {
  const date = toDate(d);
  if (!date) return "";

  const diffMs = Date.now() - date.getTime();

  if (diffMs < 0) {
    const mins = Math.floor(-diffMs / 60_000);
    if (mins < 60) return `in ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `in ${hrs}h`;
    return `in ${Math.floor(hrs / 24)}d`;
  }

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}
