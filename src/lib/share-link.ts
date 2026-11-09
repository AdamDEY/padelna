// A player's code is 10 lowercase hex characters (`new_share_code()` in the database)
const CODE_PATTERN = "[0-9a-f]{10}";
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
  return LINK_PATTERN.exec(text.trim())?.[1].toLowerCase();
}
