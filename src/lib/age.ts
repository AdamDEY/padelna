/** Youngest age allowed to sign up */
export const MIN_AGE = 13;

/** The latest birthday that still makes a player at least `MIN_AGE` today. */
export function latestBirthday(now = new Date()) {
  return new Date(now.getFullYear() - MIN_AGE, now.getMonth(), now.getDate());
}

/** Age in whole years today, from a Postgres `date` like "2000-03-15". */
export function ageFromBirthDate(birthDate: string, now = new Date()) {
  const [year, month, day] = birthDate.split("-").map(Number);
  const hadBirthday = now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day);
  return now.getFullYear() - year - (hadBirthday ? 0 : 1);
}

/** "2000-03-15" from the local date, as Postgres `date` expects (not shifted by the time zone). */
export function toDateOnly(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
