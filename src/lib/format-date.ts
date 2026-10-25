// English only for now; switch the locale when French and Arabic land.
const LOCALE = "en-GB";

const dayFormat = new Intl.DateTimeFormat(LOCALE, {
  weekday: "short",
  day: "numeric",
  month: "short",
});

const timeFormat = new Intl.DateTimeFormat(LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "Sat 25 Oct · 18:00" */
export function formatMatchDateTime(date: Date) {
  return `${dayFormat.format(date).replace(",", "")} · ${timeFormat.format(date)}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Whole calendar days from `now` to `date`, in local time */
export function daysUntil(date: Date, now = new Date()) {
  return Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
}

/** "Today", "Tomorrow" or "In 2 days" */
export function formatCountdown(date: Date, now = new Date()) {
  const days = daysUntil(date, now);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}
