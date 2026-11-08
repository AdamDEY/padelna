/** Youngest age allowed to sign up */
export const MIN_AGE = 13;

/** The latest birthday that still makes a player at least `MIN_AGE` today. */
export function latestBirthday(now = new Date()) {
  return new Date(now.getFullYear() - MIN_AGE, now.getMonth(), now.getDate());
}

/** "2000-03-15" from the local date, as Postgres `date` expects (not shifted by the time zone). */
export function toDateOnly(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
