import type { DropdownOption } from "@/components/dropdown";

// Every padel match in Tunisia is booked for 90 minutes
export const MATCH_MINUTES = 90;
// How far ahead a match can be planned
export const DAYS_AHEAD = 30;

/** "18:00", the value the start-time dropdown uses (always 24 h, whatever the locale) */
export function clockTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// Start times every half hour, 07:00 to 23:00
export const TIME_OPTIONS: DropdownOption[] = Array.from({ length: 33 }, (_, i) => {
  const minutes = 7 * 60 + i * 30;
  const label = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 === 0 ? "00" : "30"}`;
  return { value: label, label };
});

/** `start` moved to the day of `day`, keeping its time (the date picker only changes the day) */
export function withDay(start: Date, day: Date) {
  const next = new Date(start);
  next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
  return next;
}

/** `start` at the "HH:mm" time from the dropdown, keeping its day */
export function withTime(start: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(start);
  next.setHours(hours, minutes, 0, 0);
  return next;
}
