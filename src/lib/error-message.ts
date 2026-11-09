import { isAuthError, isAuthRetryableFetchError, isAuthSessionMissingError } from "@supabase/supabase-js";
import { t } from "i18next";

import type { Messages } from "@/i18n/locales/en";

// Supabase hands back network failures as plain objects whose message reads "TypeError: Network request failed"
const NETWORK_PATTERN = /network request failed|failed to fetch|fetcherror|aborterror|timed? ?out/i;

// Postgres codes worth their own sentence; everything else from the database is too technical to show
const DATABASE_CODES: Record<string, () => string> = {
  "42501": () => t("errors.notAllowed"), // row-level security said no
  PGRST116: () => t("errors.notFound"), // .single() found no row
};
// `raise exception` in our database functions
const RAISED_BY_US = "P0001";

type ServerKey = keyof Messages["errors"]["server"];

/**
 * The database writes its messages in English, so each one is matched to its translated copy here.
 * Keep the text exactly as in supabase/migrations (straight apostrophes). A message missing from
 * this list is still shown, in English, so a new one never turns into the generic line.
 */
const SERVER_MESSAGES: Record<string, ServerKey> = {
  "A player from the other team confirms this score": "otherTeamConfirms",
  "Add the score first": "addScoreFirst",
  "Each player can be rated once": "ratedOnce",
  "It's too late to add a score for this match": "tooLateToScore",
  "It's too late to rate this match": "tooLateToRate",
  "Only players in this match can add its score": "onlyPlayersScore",
  "Only players in this match can confirm its score": "onlyPlayersConfirm",
  "Only players in this match can rate it": "onlyPlayersRate",
  "Only the host can add the team photo": "onlyHostPhoto",
  "Pick a rating for each player": "pickEachRating",
  "Rate at least one player": "rateAtLeastOne",
  "Sign in to join a match": "signInToJoin",
  "Someone just took that spot": "spotTaken",
  "That photo doesn't belong to this match": "photoNotThisMatch",
  "That score isn't possible. Check each set.": "impossibleScore",
  "That spot isn't open": "spotNotOpen",
  "That's you": "thatsYou",
  "The host adds the score first": "hostScoresFirst",
  "There is no connection to remove": "noConnection",
  "There's no score to confirm yet": "noScoreYet",
  "This match didn't have 4 players": "notFourPlayers",
  "This match has already started": "matchStarted",
  "This match no longer exists": "matchGone",
  "This match was cancelled": "matchCancelled",
  "This player no longer exists": "playerGone",
  "This request is no longer waiting": "requestGone",
  "This score is already confirmed": "scoreConfirmed",
  "This score wasn't confirmed in time": "scoreExpired",
  "This score wasn't confirmed in time, so the match can't be rated": "scoreExpiredCantRate",
  "You already have a match at that time": "matchAtThatTime",
  "You already rated this match": "alreadyRated",
  "Friendly matches aren't rated": "friendlyNotRated",
  "Pick tags from the list": "tagsFromList",
  "Pick up to 5 tags for each player": "maxTags",
  "You can add the score once the match is over": "scoreAfterMatch",
  "You can only rate players from this match": "rateOnlyMatchPlayers",
  "This tournament no longer exists": "tournamentGone",
  "Registration for this tournament is closed": "registrationClosed",
  "You are already in this tournament": "alreadyInTournament",
  "This tournament is for another category": "otherCategory",
  "Your level is outside this tournament's range": "levelOutsideRange",
  "Choose a partner": "choosePartner",
  "You can only invite a friend": "onlyInviteFriend",
  "Your partner is already in a team": "partnerInTeam",
  "Your partner can't play in this category": "partnerOtherCategory",
  "Your partner is outside this tournament's level range": "partnerOutsideRange",
  "This invitation is no longer valid": "invitationGone",
  "Scores can't be sent for this match": "cantSendScore",
  "Only the players in this match can send its score": "onlyPlayersSendScore",
  "This match is waiting for its pairs": "matchWaitingForPairs",
  "The organiser has already confirmed this score": "scoreAlreadyConfirmed",
  "Enter both sets": "enterBothSets",
  "A set is won 4-0 to 4-3": "setWonTo4",
  "One set each: enter the super tie-break": "enterSuperTiebreak",
  "The super tie-break goes to 10, two points clear": "superTiebreakRule",
  "You are not in this tournament": "notInTournament",
  "The tournament has started, so its pairs and groups are locked": "tournamentStarted",
  "You can rate the players once the score is added": "rateAfterScore",
  "You can't rate yourself": "cantRateYourself",
  "You're already connected": "alreadyConnected",
  "You're already in this match": "alreadyInMatch",
  "You're hosting this match. Cancel it instead.": "hostCantLeave",
  "You're not in this match": "notInMatch",
  "Your level is outside this match's range": "levelOutOfRange",
  "This match is for men only": "menOnly",
  "This match is for women only": "womenOnly",
  "You can only host a match for your own gender": "hostOwnGender",
  "Your team already sent this score. A player from the other team confirms it.": "teamAlreadySent",
  "This club isn't open for new matches. Pick another one.": "clubNotOpen",
  "This court isn't available. Pick another one.": "courtUnavailable",
  "Players have joined or been invited, so the time, level and type can't change": "playersJoinedLocked",
  "This invitation is no longer waiting": "inviteGone",
  "That spot is held for an invited player": "spotHeld",
  "Only the host can invite players": "onlyHostInvites",
  "That player is already in this match": "playerAlreadyIn",
  "That player is already invited to this match": "playerAlreadyInvited",
  "That player already has a match at that time": "playerBusy",
  "Pick a time that hasn't passed": "pickFutureTime",
  "Tag 3 different players": "tagThreePlayers",
  "Pick a club and court from the list": "pickClubAndCourt",
  "You can log a match once it's over": "logAfterMatch",
  "You can only log matches from the last 7 days": "logLastWeek",
  "This club no longer exists": "clubGone",
  "Play a match at this club to review it": "playToReview",
  "That court isn't at this club": "courtNotHere",
  "Rate at least one thing": "rateOneThing",
  "Pick between 1 and 5 stars": "pickStars",
  "Pick up to 5 tags for a club": "maxClubTags",
  "Keep your comment under 500 characters": "commentTooLong",
  "You can't report yourself": "cantReportYourself",
  "Pick a reason from the list": "pickReason",
  "Say whether you played with this player": "sayIfPlayed",
  "Keep your comment under 300 characters": "reportCommentTooLong",
  "You've sent a lot of reports today. Try again tomorrow.": "tooManyReports",
};
const SIGNED_OUT_MESSAGES = new Set(["Sign in first", "Not signed in"]);

const AUTH_CODES: Record<string, () => string> = {
  invalid_credentials: () => t("errors.invalidCredentials"),
  email_not_confirmed: () => t("errors.emailNotConfirmed"),
  user_already_exists: () => t("errors.emailTaken"),
  email_exists: () => t("errors.emailTaken"),
  weak_password: () => t("errors.weakPassword"),
  over_request_rate_limit: () => t("errors.tooManyTries"),
  over_email_send_rate_limit: () => t("errors.tooManyTries"),
};

function fieldOf(error: unknown, key: "message" | "code" | "name") {
  if (typeof error !== "object" || error === null) return undefined;
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

/** A sentence a player can read for any thrown error: known causes get our own copy, the rest a calm generic line. */
export function errorMessage(error: unknown): string {
  const message = fieldOf(error, "message") ?? "";
  const code = fieldOf(error, "code") ?? "";

  if (isAuthRetryableFetchError(error) || NETWORK_PATTERN.test(message)) return t("errors.network");
  if (isAuthSessionMissingError(error)) return t("errors.signedOut");
  if (isAuthError(error)) return AUTH_CODES[code]?.() ?? t("errors.generic");
  if (DATABASE_CODES[code]) return DATABASE_CODES[code]();
  if (code === RAISED_BY_US && message) {
    if (SIGNED_OUT_MESSAGES.has(message)) return t("errors.signedOut");
    const key = SERVER_MESSAGES[message];
    return key ? t(`errors.server.${key}`) : message;
  }
  // A plain `new Error("…")` is one of ours (repositories, sign-in helpers), already translated where it's thrown
  if (error instanceof Error && error.name === "Error" && !code && message) return message;
  return t("errors.generic");
}
