// Sends the pushes waiting in notification_outbox through Expo's push service.
//
// The database wakes this function after it queues a push (and every minute while any
// are waiting), sending the Vault secret in `x-push-secret`. Each run claims a batch,
// writes the text in each phone's language, sends it, and records the result. Phones
// Expo reports as gone (DeviceNotRegistered) lose their token.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
// Expo takes at most 100 messages per request
const EXPO_BATCH_SIZE = 100;
// Batches per run, so one call can't run forever
const MAX_ROUNDS = 5;

type Language = "en" | "fr";

type ClaimedPush = {
  outbox_id: string;
  token: string;
  language: Language;
  kind: Kind;
  params: { name?: string; when?: string; body?: string; tournament?: string };
  url: string;
};

type Kind =
  | "chat_message"
  | "player_joined"
  | "match_full"
  | "player_left"
  | "court_booked"
  | "court_changed"
  | "court_unbooked"
  | "match_cancelled"
  | "score_to_confirm"
  | "rate_players"
  | "match_logged"
  | "connection_request"
  | "connection_accepted"
  | "tournament_invite"
  | "tournament_invite_accepted"
  | "tournament_invite_declined"
  | "tournament_invite_cancelled"
  | "tournament_invite_expired"
  | "tournament_partner_left"
  | "tournament_promoted"
  | "tournament_added"
  | "tournament_removed"
  | "match_invite"
  | "match_invite_declined"
  | "match_invite_cancelled";

type Ticket = { status: "ok"; id: string } | { status: "error"; message: string; details?: { error?: string } };

type Text = { title: string; body: string };
type Params = { name: string; when: string; body: string; tournament: string };

// Same tone as the app: short, warm and direct
const texts: Record<Language, Record<Kind, (p: Params) => Text>> = {
  en: {
    chat_message: (p) => ({ title: `${p.name} · ${p.when}`, body: p.body }),
    player_joined: (p) => ({ title: `${p.name} joined your match`, body: p.when }),
    match_full: (p) => ({ title: "Your match is full", body: `${p.name} took the last spot · ${p.when}` }),
    player_left: (p) => ({ title: `${p.name} left your match`, body: `${p.when} · the spot is open again` }),
    court_booked: (p) => ({ title: "Court booked", body: `${p.name} booked the court for ${p.when}` }),
    court_changed: (p) => ({ title: "Court changed", body: `${p.name} moved ${p.when} to another court. Check the details.` }),
    court_unbooked: (p) => ({ title: "Court not booked anymore", body: `${p.name} is finding a new court for ${p.when}` }),
    match_cancelled: (p) => ({ title: "Match cancelled", body: `${p.name} cancelled the match on ${p.when}` }),
    score_to_confirm: (p) => ({
      title: "Confirm the score",
      body: `${p.name} added the score for ${p.when}. Is it right?`,
    }),
    rate_players: (p) => ({
      title: "How did they play?",
      body: `${p.name} added the score for ${p.when}. Rate the other players.`,
    }),
    match_logged: (p) => ({
      title: `${p.name} logged a match with you`,
      body: `${p.when}. Check the score and confirm it.`,
    }),
    connection_request: (p) => ({ title: `${p.name} wants to connect`, body: "Open Players to accept." }),
    connection_accepted: (p) => ({ title: `${p.name} accepted your request`, body: "You’re now connected." }),
    tournament_invite: (p) => ({ title: `${p.name} invited you to a tournament`, body: `${p.tournament}. Answer within 24 hours.` }),
    tournament_invite_accepted: (p) => ({ title: `${p.name} accepted your invite`, body: p.tournament }),
    tournament_invite_declined: (p) => ({ title: `${p.name} declined your invite`, body: `${p.tournament}. Pick another partner.` }),
    tournament_invite_cancelled: (p) => ({ title: `${p.name} cancelled the invite`, body: p.tournament }),
    tournament_invite_expired: (p) => ({ title: "Your invite expired", body: `${p.name} didn’t answer in time for ${p.tournament}. Pick another partner to join.` }),
    tournament_partner_left: (p) => ({ title: `${p.name} left the tournament`, body: `${p.tournament}. Your team is out; pick a new partner to join again.` }),
    tournament_promoted: (p) => ({ title: "A spot opened up!", body: `You’re in ${p.tournament}.` }),
    tournament_added: (p) => ({ title: "You’re in a tournament", body: `The organiser added you to ${p.tournament}.` }),
    tournament_removed: (p) => ({ title: "Removed from a tournament", body: `The organiser removed your team from ${p.tournament}.` }),
    match_invite: (p) => ({ title: `${p.name} invited you to play`, body: `${p.when}. Open the match to accept or decline.` }),
    match_invite_declined: (p) => ({ title: `${p.name} declined your invitation`, body: `${p.when} · the spot is open again` }),
    match_invite_cancelled: (p) => ({ title: `${p.name} took back the invitation`, body: p.when }),
  },
  fr: {
    chat_message: (p) => ({ title: `${p.name} · ${p.when}`, body: p.body }),
    player_joined: (p) => ({ title: `${p.name} a rejoint ton match`, body: p.when }),
    match_full: (p) => ({ title: "Ton match est complet", body: `${p.name} a pris la dernière place · ${p.when}` }),
    player_left: (p) => ({ title: `${p.name} a quitté ton match`, body: `${p.when} · la place est libre` }),
    court_booked: (p) => ({ title: "Terrain réservé", body: `${p.name} a réservé le terrain pour ${p.when}` }),
    court_changed: (p) => ({ title: "Terrain changé", body: `${p.name} a changé de terrain pour le ${p.when}. Vérifie les détails.` }),
    court_unbooked: (p) => ({ title: "Terrain plus réservé", body: `${p.name} cherche un autre terrain pour le ${p.when}` }),
    match_cancelled: (p) => ({ title: "Match annulé", body: `${p.name} a annulé le match du ${p.when}` }),
    score_to_confirm: (p) => ({
      title: "Confirme le score",
      body: `${p.name} a ajouté le score du ${p.when}. C’est bon ?`,
    }),
    rate_players: (p) => ({
      title: "Comment ont-ils joué ?",
      body: `${p.name} a ajouté le score du ${p.when}. Note les autres joueurs.`,
    }),
    match_logged: (p) => ({
      title: `${p.name} a enregistré un match avec toi`,
      body: `${p.when}. Vérifie le score et confirme-le.`,
    }),
    connection_request: (p) => ({ title: `${p.name} veut se connecter`, body: "Ouvre Joueurs pour accepter." }),
    connection_accepted: (p) => ({ title: `${p.name} a accepté ta demande`, body: "Vous êtes connectés." }),
    tournament_invite: (p) => ({ title: `${p.name} t’invite à un tournoi`, body: `${p.tournament}. Réponds sous 24 heures.` }),
    tournament_invite_accepted: (p) => ({ title: `${p.name} a accepté ton invitation`, body: p.tournament }),
    tournament_invite_declined: (p) => ({ title: `${p.name} a refusé ton invitation`, body: `${p.tournament}. Choisis un autre partenaire.` }),
    tournament_invite_cancelled: (p) => ({ title: `${p.name} a annulé l’invitation`, body: p.tournament }),
    tournament_invite_expired: (p) => ({ title: "Ton invitation a expiré", body: `${p.name} n’a pas répondu à temps pour ${p.tournament}. Choisis un autre partenaire pour t’inscrire.` }),
    tournament_partner_left: (p) => ({ title: `${p.name} a quitté le tournoi`, body: `${p.tournament}. Ton équipe n’est plus inscrite ; choisis un autre partenaire pour revenir.` }),
    tournament_promoted: (p) => ({ title: "Une place s’est libérée !", body: `Tu joues ${p.tournament}.` }),
    tournament_added: (p) => ({ title: "Tu es inscrit à un tournoi", body: `L’organisateur t’a ajouté à ${p.tournament}.` }),
    tournament_removed: (p) => ({ title: "Retiré d’un tournoi", body: `L’organisateur a retiré ton équipe de ${p.tournament}.` }),
    match_invite: (p) => ({ title: `${p.name} t’invite à jouer`, body: `${p.when}. Ouvre le match pour accepter ou refuser.` }),
    match_invite_declined: (p) => ({ title: `${p.name} a refusé ton invitation`, body: `${p.when} · la place est libre` }),
    match_invite_cancelled: (p) => ({ title: `${p.name} a retiré son invitation`, body: p.when }),
  },
};

const locales: Record<Language, string> = { en: "en-GB", fr: "fr-FR" };

/** "2026-10-25T18:00" (already Tunis time) → "Sat 25 Oct · 18:00" */
function formatWhen(value: string | undefined, language: Language) {
  if (!value) return "";
  const [date, time] = value.split("T");
  // Read as UTC and print as UTC, so the clock time stays the Tunis one it already is
  const day = new Intl.DateTimeFormat(locales[language], {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
    .format(new Date(`${date}T00:00:00Z`))
    .replace(",", "");
  return `${day} · ${time}`;
}

function toMessage(push: ClaimedPush) {
  const language: Language = push.language === "fr" ? "fr" : "en";
  const text = texts[language][push.kind]({
    name: push.params.name || (language === "fr" ? "Un joueur" : "A player"),
    when: formatWhen(push.params.when, language),
    body: push.params.body ?? "",
    tournament: push.params.tournament ?? "",
  });
  return {
    to: push.token,
    title: text.title,
    body: text.body,
    sound: "default",
    // Android: the app's own channel (src/lib/push-notifications.ts), not Expo's "Miscellaneous" one
    channelId: "default",
    // The app opens this route when the push is tapped
    data: { url: push.url },
  };
}

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
// Optional: with Expo's enhanced push security on, every request needs this token
const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");

async function sendToExpo(messages: ReturnType<typeof toMessage>[]): Promise<Ticket[]> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(expoAccessToken ? { authorization: `Bearer ${expoAccessToken}` } : {}),
    },
    body: JSON.stringify(messages),
  });
  if (!response.ok) throw new Error(`Expo push service answered ${response.status}: ${await response.text()}`);
  const { data } = (await response.json()) as { data: Ticket[] };
  return data;
}

Deno.serve(async (request) => {
  const { data: secret, error: secretError } = await supabase.rpc("push_sender_secret");
  if (secretError || !secret || request.headers.get("x-push-secret") !== secret) {
    return new Response("Forbidden", { status: 403 });
  }

  let sent = 0;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { data, error } = await supabase.rpc("claim_pushes", { p_limit: EXPO_BATCH_SIZE });
    if (error) return new Response(error.message, { status: 500 });
    const pushes = (data ?? []) as ClaimedPush[];
    if (pushes.length === 0) break;

    const sentIds = new Set<string>();
    const failed = new Map<string, string>();
    const deadTokens: string[] = [];

    // A player with two phones gets two messages, so a batch can pass 100 messages
    for (let start = 0; start < pushes.length; start += EXPO_BATCH_SIZE) {
      const chunk = pushes.slice(start, start + EXPO_BATCH_SIZE);
      let tickets: Ticket[];
      try {
        tickets = await sendToExpo(chunk.map(toMessage));
      } catch (sendError) {
        // Left claimed: the outbox hands these out again after a few minutes
        console.error(sendError);
        continue;
      }
      tickets.forEach((ticket, index) => {
        const push = chunk[index];
        if (ticket.status === "ok") {
          sentIds.add(push.outbox_id);
        } else {
          failed.set(push.outbox_id, ticket.details?.error ?? ticket.message);
          if (ticket.details?.error === "DeviceNotRegistered") deadTokens.push(push.token);
        }
      });
    }

    // Sent to one phone counts as sent, even if another phone of the same player failed
    for (const id of sentIds) failed.delete(id);
    const { error: finishError } = await supabase.rpc("finish_pushes", {
      p_sent: [...sentIds],
      p_failed: [...failed].map(([id, message]) => ({ id, error: message })),
      p_dead_tokens: deadTokens,
    });
    if (finishError) return new Response(finishError.message, { status: 500 });
    sent += sentIds.size;
  }

  return new Response(JSON.stringify({ sent }), { headers: { "content-type": "application/json" } });
});
