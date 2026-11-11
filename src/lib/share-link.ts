// A player's code is 6 capital letters and digits, like 4XZ123 (`new_share_code()` in the database).
// The first 10-character hex codes are read too, and case never matters.
const CODE_PATTERN = "[a-z0-9]{6,10}";
// What the QR and the copied link hold. The https form is read too, so the day the web link
// exists, codes already shared keep working.
const LINK_PREFIX = "padelna://u/";
const LINK_PATTERN = new RegExp(`^(?:padelna://|https?://(?:www\\.)?padelna\\.tn/)u/(${CODE_PATTERN})/?$`, "i");

/** The link a player's QR code opens. */
export function shareLinkFor(code: string) {
  return `${LINK_PREFIX}${code}`;
}

/** The share code inside a scanned or opened link, or undefined when it isn't a Padelna code. */
export function codeFromLink(text: string) {
  return LINK_PATTERN.exec(text.trim())?.[1].toUpperCase();
}

/** The link to a match, for the text shared with its picture (it opens the match in the app). */
export function matchLinkFor(id: string) {
  return `padelna://match/${id}`;
}

/** The link to a tournament, for the result you share (it opens the tournament in the app). */
export function tournamentLinkFor(id: string) {
  return `padelna://tournament/${id}`;
}
