import type * as CalendarModule from "expo-calendar";

// Remind the player an hour before kick-off
const REMINDER_MINUTES_BEFORE = 60;

export type CalendarEventDetails = {
  title: string;
  startsAt: Date;
  endsAt: Date;
  location?: string;
  notes?: string;
};

/**
 * Loads the calendar the first time it is needed. It's native code: a build made before it was
 * added (or Expo Go) doesn't contain it, and importing it up front would crash the whole app.
 */
function loadCalendar() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-calendar") as typeof CalendarModule;
  } catch {
    throw new Error(
      "Adding to the calendar needs the Padelna development build. Rebuild the app on this device.",
    );
  }
}

/**
 * Opens the system "new event" form, filled in with the match, so the player picks the calendar
 * and saves it themselves. Asks for write-only access on iOS: Padelna never reads their calendar.
 * Resolves to `false` when permission is denied; `saved` is `undefined` on Android, which can't
 * tell whether the player saved or cancelled.
 */
export async function addToCalendar(
  details: CalendarEventDetails,
): Promise<{ granted: false } | { granted: true; saved: boolean | undefined }> {
  const Calendar = loadCalendar();
  const { granted } = await Calendar.requestCalendarPermissions(true);
  if (!granted) return { granted: false };

  // iOS has a default calendar; Android doesn't, so use the first writable primary one
  let calendar;
  if (process.env.EXPO_OS === "ios") {
    calendar = Calendar.getDefaultCalendarSync();
  } else {
    const writable = (await Calendar.getCalendars()).filter((c) => c.allowsModifications);
    calendar = writable.find((c) => c.isPrimary) ?? writable[0];
  }
  if (!calendar) throw new Error("No calendar on this device can take new events.");

  const result = await calendar.addEventWithForm({
    title: details.title,
    startDate: details.startsAt,
    endDate: details.endsAt,
    location: details.location,
    notes: details.notes,
    alarms: [{ relativeOffset: -REMINDER_MINUTES_BEFORE }],
  });
  return { granted: true, saved: result.action === "done" ? undefined : result.action === "saved" };
}

/**
 * A Google Calendar "new event" link. It opens the Google Calendar app or the website, so it
 * needs no calendar permission and works for accounts that aren't set up on the phone.
 */
export function googleCalendarUrl(details: CalendarEventDetails) {
  // Google wants UTC as 20261102T170000Z
  const stamp = (date: Date) => date.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: details.title,
    dates: `${stamp(details.startsAt)}/${stamp(details.endsAt)}`,
  });
  if (details.location) params.set("location", details.location);
  if (details.notes) params.set("details", details.notes);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** An Outlook.com "new event" link (personal accounts; work accounts are sent on to their own sign-in). */
export function outlookCalendarUrl(details: CalendarEventDetails) {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: details.title,
    startdt: details.startsAt.toISOString(),
    enddt: details.endsAt.toISOString(),
  });
  if (details.location) params.set("location", details.location);
  if (details.notes) params.set("body", details.notes);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
