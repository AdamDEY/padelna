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

/** "Sat 25 Oct" */
export function formatMatchDay(date: Date) {
  return dayFormat.format(date).replace(",", "");
}

/** "Sat 25 Oct · 18:00" */
export function formatMatchDateTime(date: Date) {
  return `${formatMatchDay(date)} · ${timeFormat.format(date)}`;
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

/** "2 days 4 h", "3 h 20 min", "45 min", or "Started" once it's under way */
export function formatStartsIn(date: Date, now = new Date()) {
  const minutes = Math.floor((date.getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return "Started";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days} ${days === 1 ? "day" : "days"} ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes % 60} min`;
  return `${minutes} min`;
}

const weekdayFormat = new Intl.DateTimeFormat(LOCALE, { weekday: "short" });

/** "Today · 20:00", "Tomorrow · 18:30", "Sun · 10:00" within a week, else "Sat 25 Oct · 18:00" */
export function formatShortMatchDateTime(date: Date, now = new Date()) {
  const days = daysUntil(date, now);
  const time = timeFormat.format(date);
  if (days === 0) return `Today · ${time}`;
  if (days === 1) return `Tomorrow · ${time}`;
  if (days > 1 && days < 7) return `${weekdayFormat.format(date)} · ${time}`;
  return formatMatchDateTime(date);
}

/** "Just now", "12 min ago", "1 h ago", "Yesterday", then "Sun 19 Oct" */
export function formatTimeAgo(date: Date, now = new Date()) {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  if (daysUntil(date, now) === -1) return "Yesterday";
  return formatMatchDay(date);
}
