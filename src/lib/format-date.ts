import { t } from "i18next";

import { i18n, type Language } from "@/i18n";

const LOCALES: Record<Language, string> = { en: "en-GB", fr: "fr-FR" };

/** Intl locale for the current app language (also used by the native date picker) */
export function dateLocale() {
  return LOCALES[i18n.language as Language] ?? LOCALES.en;
}

// Building a formatter is slow, so keep one per locale
const formatters = new Map<
  string,
  {
    day: Intl.DateTimeFormat;
    time: Intl.DateTimeFormat;
    weekday: Intl.DateTimeFormat;
    fullDate: Intl.DateTimeFormat;
  }
>();

function formattersFor(locale: string) {
  let found = formatters.get(locale);
  if (!found) {
    found = {
      day: new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }),
      time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
      weekday: new Intl.DateTimeFormat(locale, { weekday: "short" }),
      fullDate: new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }),
    };
    formatters.set(locale, found);
  }
  return found;
}

/** "18:00" */
export function formatTime(date: Date) {
  return formattersFor(dateLocale()).time.format(date);
}

/** "Sat" */
export function formatWeekday(date: Date) {
  return formattersFor(dateLocale()).weekday.format(date);
}

/** "Sat 25" */
export function formatWeekdayDay(date: Date) {
  return `${formatWeekday(date)} ${date.getDate()}`;
}

/** "Saturday 25 October" */
export function formatFullDate(date: Date) {
  return formattersFor(dateLocale()).fullDate.format(date);
}

/** "Sat 25 Oct" */
export function formatMatchDay(date: Date) {
  return formattersFor(dateLocale()).day.format(date).replace(",", "");
}

/** "Sat 25 Oct · 18:00" */
export function formatMatchDateTime(date: Date) {
  return `${formatMatchDay(date)} · ${formattersFor(dateLocale()).time.format(date)}`;
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
  if (days <= 0) return t("time.today");
  if (days === 1) return t("time.tomorrow");
  return t("time.inDays", { count: days });
}

/** "2 days 4 h", "3 h 20 min", "45 min", or "Started" once it's under way */
export function formatStartsIn(date: Date, now = new Date()) {
  const minutes = Math.floor((date.getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return t("time.started");
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return t("time.daysHours", { count: days, hours });
  if (hours > 0) return t("time.hoursMinutes", { hours, minutes: minutes % 60 });
  return t("time.minutes", { count: minutes });
}

/** "Today · 20:00", "Tomorrow · 18:30", "Sun · 10:00" within a week, else "Sat 25 Oct · 18:00" */
export function formatShortMatchDateTime(date: Date, now = new Date()) {
  const days = daysUntil(date, now);
  const { time, weekday } = formattersFor(dateLocale());
  if (days === 0) return `${t("time.today")} · ${time.format(date)}`;
  if (days === 1) return `${t("time.tomorrow")} · ${time.format(date)}`;
  if (days > 1 && days < 7) return `${weekday.format(date)} · ${time.format(date)}`;
  return formatMatchDateTime(date);
}

/** "Just now", "12 min ago", "1 h ago", "Yesterday", then "Sun 19 Oct" */
export function formatTimeAgo(date: Date, now = new Date()) {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return t("time.justNow");
  if (minutes < 60) return t("time.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("time.hoursAgo", { count: hours });
  if (daysUntil(date, now) === -1) return t("time.yesterday");
  return formatMatchDay(date);
}
